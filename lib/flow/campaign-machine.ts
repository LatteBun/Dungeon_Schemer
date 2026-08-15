import type { DungeonEventPools } from "@/lib/content/events";
import { EVENT_KINDS, RuleError } from "@/lib/domain";
import type {
  BoardOfferId,
  BossDef,
  CampaignDungeon,
  CampaignMember,
  CampaignPhase,
  CampaignState,
  CardId,
  ChoiceId,
  DungeonEvent,
  EventKind,
  ExpeditionState,
  Grade,
  InfoCard,
  ItemDef,
  MapNode,
  MemberId,
  NodeId,
} from "@/lib/domain";
import { createRng } from "@/lib/rng";
import type { Rng } from "@/lib/rng";
import { canAcceptOffer, generateBoard } from "@/lib/rules/board";
import { resolveBossFight } from "@/lib/rules/boss";
import { resolveEventChoice } from "@/lib/rules/event";
import {
  applyInfoRecord,
  createInfoOpportunity,
  evaluatePartyInfoCard,
  toInfoRecords,
} from "@/lib/rules/info";
import { generateGradeMap } from "@/lib/rules/map";
import { settleExpedition } from "@/lib/rules/settlement";

export type CampaignAction =
  | { readonly type: "openBoard" }
  | { readonly type: "acceptContract"; readonly offerId: BoardOfferId }
  | { readonly type: "selectNode"; readonly nodeId: NodeId }
  | { readonly type: "chooseInfoCard"; readonly cardId: CardId }
  | { readonly type: "chooseEvent"; readonly choiceId: ChoiceId }
  | { readonly type: "resolveBoss" }
  | { readonly type: "applySettlement" };

export interface CampaignContentPools {
  readonly events: DungeonEventPools;
  readonly cards: readonly InfoCard[];
  readonly items: readonly ItemDef[];
  readonly bosses: readonly BossDef[];
}

export interface CampaignMachineContext extends CampaignContentPools {
  readonly eventById: ReadonlyMap<string, DungeonEvent>;
  readonly eventKindById: ReadonlyMap<string, EventKind>;
  readonly bossByGrade: ReadonlyMap<Grade, BossDef>;
}

/**
 * 콘텐츠 풀에서 조회표를 미리 만든다.
 *
 * 백테스트가 10,000 시드를 도는 동안 지점마다 사건을 찾으므로, 매번 배열을
 * 훑으면 조회가 전체 실행 시간을 지배한다.
 */
export function createCampaignMachineContext(
  pools: CampaignContentPools,
): CampaignMachineContext {
  const regular = EVENT_KINDS.flatMap((kind) => pools.events.regular[kind]);
  return {
    ...pools,
    eventById: new Map(
      [...regular, ...pools.events.boss].map((event) => [event.id as string, event]),
    ),
    eventKindById: new Map(
      EVENT_KINDS.flatMap((kind) =>
        pools.events.regular[kind].map((event) => [event.id as string, kind])),
    ),
    bossByGrade: new Map(pools.bosses.map((boss) => [boss.grade, boss])),
  };
}

/**
 * 지금 고를 수 있는 사건 선택지다.
 *
 * 잔액을 넘는 거래는 규칙이 원자적으로 거부하므로, 소비자가 미리 알지 못하면
 * 고르는 순간 오류가 난다. 게시판의 `canAcceptOffer`와 같은 자리를 사건에도
 * 둔다. 시작 골드 10으로는 14골드짜리 정보 두루마리를 살 수 없다.
 *
 * 못 고르는 선택지를 목록에서 지우지 않고 따로 알려 주는 이유는, 화면이 잠긴
 * 공고를 그대로 보여주듯 왜 못 사는지 설명할 수 있어야 하기 때문이다.
 */
export function affordableChoiceIds(
  state: CampaignState,
  context: CampaignMachineContext,
): ChoiceId[] {
  const pending = state.expedition?.pendingEvent;
  if (pending === null || pending === undefined) return [];

  const event = context.eventById.get(pending.eventId as string);
  if (event === undefined) return [];

  return event.choices
    .filter((choice) => {
      if (!choice.effectTags.includes("trade")) return true;
      const item = context.items.find((entry) => entry.id === choice.itemId);
      return item !== undefined && item.price <= state.currentGold;
    })
    .map((choice) => choice.id);
}

function invalidTransition(state: CampaignState, action: CampaignAction): never {
  throw new RuleError(
    "INVALID_TRANSITION",
    `${state.phase} 단계에서는 ${action.type}을 처리할 수 없다.`,
    { phase: state.phase, action: action.type },
  );
}

function unknown(message: string, details: Record<string, unknown>): never {
  throw new RuleError("UNKNOWN_ID", message, details);
}

function requireExpedition(state: CampaignState): ExpeditionState {
  if (state.expedition === null) {
    throw new RuleError("INVALID_TRANSITION", "진행 중인 탐험이 없다.", {
      phase: state.phase,
    });
  }
  return state.expedition;
}

function findDungeon(state: CampaignState, expedition: ExpeditionState): CampaignDungeon {
  const dungeon = state.dungeons.find((entry) => entry.id === expedition.dungeonId);
  if (dungeon === undefined) {
    unknown(`캠페인에 없는 던전이다: ${expedition.dungeonId}`, {
      dungeonId: expedition.dungeonId,
    });
  }
  return dungeon;
}

function findNode(expedition: ExpeditionState, nodeId: NodeId): MapNode {
  const node = expedition.map.nodes.find((entry) => entry.id === nodeId);
  if (node === undefined) {
    unknown(`지도에 없는 지점이다: ${nodeId}`, { nodeId });
  }
  return node;
}

/**
 * 한 원정을 가리키는 안정된 난수 키다.
 *
 * 호출 횟수가 아니라 식별자에서 파생하므로 같은 시드로 같은 선택을 하면 중간에
 * 무엇을 몇 번 했든 같은 결과가 나온다. 실패 횟수를 넣는 이유는 전멸 뒤 등급이
 * 올라 같은 던전을 다시 도전할 때 첫 도전과 같은 지도가 나오지 않게 하려는 것이다.
 */
function expeditionKey(state: CampaignState, dungeon: CampaignDungeon): string {
  return `${state.seed}/${dungeon.id}#${dungeon.failureCount}`;
}

function nodeRng(
  state: CampaignState,
  dungeon: CampaignDungeon,
  nodeId: NodeId,
): Rng {
  return createRng(`${expeditionKey(state, dungeon)}/${nodeId}`);
}

/** 이 원정에 나간 사람들. 원정 도중 파티 구성은 바뀌지 않는다. */
function participantsOf(
  state: CampaignState,
  expedition: ExpeditionState,
): CampaignMember[] {
  const party = state.parties.find((entry) => entry.id === expedition.partyId);
  if (party === undefined) {
    unknown(`캠페인에 없는 파티다: ${expedition.partyId}`, { partyId: expedition.partyId });
  }
  return party.memberIds
    .map((id) => state.members.find((member) => member.id === id))
    .filter((member): member is CampaignMember => member !== undefined);
}

function mergeMembers(
  members: readonly CampaignMember[],
  updated: readonly CampaignMember[],
): CampaignMember[] {
  const byId = new Map(updated.map((member) => [member.id as string, member]));
  return members.map((member) => byId.get(member.id as string) ?? { ...member });
}

interface Arrival {
  readonly phase: CampaignPhase;
  readonly expedition: ExpeditionState;
}

/**
 * 지점에 도착했을 때의 처리다.
 *
 * 입구도 다른 지점과 똑같이 도착 처리를 한다. `E1`이 입구를 일반 사건 지점으로
 * 세었기 때문이다. C급 경로의 일반 사건 4개는 입구·갈래 2개·합류이므로, 입구를
 * 건너뛰면 실제로 지나는 사건이 3개가 되어 상위 spec의 등급별 수치가 깨진다.
 */
function arriveAt(
  state: CampaignState,
  expedition: ExpeditionState,
  dungeon: CampaignDungeon,
  node: MapNode,
  context: CampaignMachineContext,
): Arrival {
  const moved: ExpeditionState = {
    ...expedition,
    currentNodeId: node.id,
    visitedNodeIds: [...expedition.visitedNodeIds, node.id],
    pendingInfo: null,
    pendingEvent: null,
  };

  if (node.id === expedition.map.bossNodeId) {
    return { phase: "boss", expedition: moved };
  }

  if (node.hasInfoOpportunity) {
    return {
      phase: "infoOpportunity",
      expedition: {
        ...moved,
        pendingInfo: createInfoOpportunity({
          node,
          eventKind: context.eventKindById.get(node.eventId as string) ?? "special",
          rng: nodeRng(state, dungeon, node.id).derive("card"),
          cards: context.cards,
        }),
      },
    };
  }

  return { phase: "event", expedition: { ...moved, pendingEvent: pendingEventAt(node, context) } };
}

function pendingEventAt(node: MapNode, context: CampaignMachineContext) {
  const event = context.eventById.get(node.eventId as string);
  if (event === undefined) {
    unknown(`콘텐츠에 없는 사건이다: ${node.eventId}`, { eventId: node.eventId });
  }
  return {
    nodeId: node.id,
    eventId: event.id,
    choiceIds: event.choices.map((choice) => choice.id),
  };
}

/** 원정 참가자 중 죽은 사람과 살아남은 사람을 갈라 결과를 만든다. */
function resultFor(
  participants: readonly CampaignMember[],
  reason: string,
): ExpeditionState["result"] {
  const survivorIds = participants.filter((m) => m.alive).map((m) => m.id);
  const casualtyIds = participants.filter((m) => !m.alive).map((m) => m.id);
  return {
    status: survivorIds.length > 0 ? "cleared" : "failed",
    survivorIds,
    casualtyIds,
    reason,
  };
}

function acceptContract(
  state: CampaignState,
  offerId: BoardOfferId,
  context: CampaignMachineContext,
): CampaignState {
  const offer = state.board.find((entry) => entry.id === offerId);
  if (offer === undefined) {
    unknown(`게시판에 없는 공고다: ${offerId}`, { offerId });
  }

  const accepted = canAcceptOffer(state, offer);
  if (!accepted.accepted) {
    throw new RuleError(
      "INVALID_TRANSITION",
      `지원할 수 없는 공고다: ${accepted.reason}`,
      { offerId, reason: accepted.reason },
    );
  }

  const dungeon = state.dungeons.find((entry) => entry.id === offer.dungeonId);
  if (dungeon === undefined) {
    unknown(`캠페인에 없는 던전이다: ${offer.dungeonId}`, { dungeonId: offer.dungeonId });
  }

  const map = generateGradeMap(
    dungeon.grade,
    createRng(expeditionKey(state, dungeon)).derive("map"),
    { eventPools: context.events },
  );
  const started: ExpeditionState = {
    dungeonId: dungeon.id,
    partyId: offer.partyId,
    map,
    currentNodeId: map.entryNodeId,
    visitedNodeIds: [],
    pendingInfo: null,
    pendingEvent: null,
    infoRecords: [],
    bossResult: null,
    result: null,
    log: [],
  };
  const arrival = arriveAt(
    state,
    started,
    dungeon,
    findNode(started, map.entryNodeId),
    context,
  );

  return { ...state, phase: arrival.phase, expedition: arrival.expedition };
}

function selectNode(
  state: CampaignState,
  nodeId: NodeId,
  context: CampaignMachineContext,
): CampaignState {
  const expedition = requireExpedition(state);
  const current = findNode(expedition, expedition.currentNodeId);
  if (!current.nextNodeIds.includes(nodeId)) {
    unknown(`현재 지점에서 갈 수 없다: ${expedition.currentNodeId} → ${nodeId}`, {
      from: expedition.currentNodeId,
      to: nodeId,
    });
  }

  const dungeon = findDungeon(state, expedition);
  const arrival = arriveAt(state, expedition, dungeon, findNode(expedition, nodeId), context);
  return { ...state, phase: arrival.phase, expedition: arrival.expedition };
}

function chooseInfoCard(
  state: CampaignState,
  cardId: CardId,
  context: CampaignMachineContext,
): CampaignState {
  const expedition = requireExpedition(state);
  const pending = expedition.pendingInfo;
  if (pending === null) {
    throw new RuleError("INVALID_TRANSITION", "제시된 정보 기회가 없다.", {
      phase: state.phase,
    });
  }
  if (!pending.cardIds.includes(cardId)) {
    unknown(`제시되지 않은 카드다: ${cardId}`, { cardId, offered: pending.cardIds });
  }
  const card = context.cards.find((entry) => entry.id === cardId);
  if (card === undefined) {
    unknown(`콘텐츠에 없는 카드다: ${cardId}`, { cardId });
  }

  const dungeon = findDungeon(state, expedition);
  const rng = nodeRng(state, dungeon, pending.nodeId);
  const participants = participantsOf(state, expedition);
  const evaluation = evaluatePartyInfoCard({
    card,
    party: participants,
    cardRng: rng.derive("card"),
    trustRng: rng.derive("trust"),
  });

  const recorded = toInfoRecords(card, evaluation).reduce(
    (current, record) => applyInfoRecord(current, record),
    expedition,
  );
  const node = findNode(expedition, pending.nodeId);

  return {
    ...state,
    phase: "event",
    members: mergeMembers(state.members, evaluation.memberResults.map((r) => r.member)),
    expedition: {
      ...recorded,
      pendingInfo: null,
      pendingEvent: pendingEventAt(node, context),
    },
  };
}

function chooseEvent(
  state: CampaignState,
  choiceId: ChoiceId,
  context: CampaignMachineContext,
): CampaignState {
  const expedition = requireExpedition(state);
  const pending = expedition.pendingEvent;
  if (pending === null) {
    throw new RuleError("INVALID_TRANSITION", "제시된 사건이 없다.", { phase: state.phase });
  }
  const event = context.eventById.get(pending.eventId as string);
  if (event === undefined) {
    unknown(`콘텐츠에 없는 사건이다: ${pending.eventId}`, { eventId: pending.eventId });
  }

  const dungeon = findDungeon(state, expedition);
  const participants = participantsOf(state, expedition);
  const resolution = resolveEventChoice({
    event,
    choiceId,
    grade: dungeon.grade,
    members: participants,
    currentGold: state.currentGold,
    rng: nodeRng(state, dungeon, pending.nodeId).derive("event"),
    items: context.items,
  });

  const members = mergeMembers(state.members, resolution.members);
  const withLog: ExpeditionState = {
    ...expedition,
    pendingEvent: null,
    log: [...expedition.log, {
      at: expedition.log.length,
      kind: "event",
      summary: resolution.summary,
      memberIds: resolution.casualtyIds,
    }],
  };

  // 사건 도중 전멸하면 남은 지점과 보스전을 건너뛰고 실패 정산으로 간다.
  if (resolution.wiped) {
    return {
      ...state,
      phase: "settlement",
      currentGold: resolution.currentGold,
      members,
      expedition: {
        ...withLog,
        result: resultFor(mergeMembers(participants, resolution.members), "사건 도중 전멸"),
      },
    };
  }

  return {
    ...state,
    phase: "map",
    currentGold: resolution.currentGold,
    members,
    expedition: withLog,
  };
}

function resolveBoss(
  state: CampaignState,
  context: CampaignMachineContext,
): CampaignState {
  const expedition = requireExpedition(state);
  const dungeon = findDungeon(state, expedition);
  const boss = context.bossByGrade.get(dungeon.grade);
  if (boss === undefined) {
    unknown(`등급별 보스가 없다: ${dungeon.grade}`, { grade: dungeon.grade });
  }

  const participants = participantsOf(state, expedition);
  const resolution = resolveBossFight({
    boss,
    members: participants,
    infoRecords: expedition.infoRecords,
    rng: createRng(expeditionKey(state, dungeon)).derive("boss"),
  });
  const fought = resolution.members.map((entry) => entry.member);
  const afterBoss = mergeMembers(participants, fought);

  return {
    ...state,
    phase: "settlement",
    members: mergeMembers(state.members, fought),
    expedition: {
      ...expedition,
      bossResult: {
        survivorIds: resolution.survivorIds,
        casualtyIds: resolution.casualtyIds,
        damageByMember: Object.fromEntries(
          resolution.members.map((entry) => [entry.member.id as string, entry.damage]),
        ),
      },
      result: resultFor(
        afterBoss,
        resolution.outcome === "clear" ? "보스를 넘고 살아 돌아왔다" : "보스전에서 전멸",
      ),
      log: [...expedition.log, {
        at: expedition.log.length,
        kind: "boss",
        summary: `${boss.name} · ${resolution.outcome === "clear" ? "클리어" : "전멸"}`,
        memberIds: resolution.casualtyIds,
      }],
    },
  };
}

/**
 * 유효한 행동만 상태에 적용한다.
 *
 * 검증을 상태를 만들기 전에 끝내므로 실패한 행동 뒤에도 원래 상태가 그대로다.
 * docs/superpowers/specs/2026-08-15-sbh3821-campaign-machine-backtest-design.md
 */
export function transitionCampaign(
  state: CampaignState,
  action: CampaignAction,
  context: CampaignMachineContext,
): CampaignState {
  switch (action.type) {
    case "openBoard":
      if (state.phase !== "board") invalidTransition(state, action);
      return { ...state, board: generateBoard(state) };

    case "acceptContract":
      if (state.phase !== "board") invalidTransition(state, action);
      return acceptContract(state, action.offerId, context);

    case "selectNode":
      if (state.phase !== "map") invalidTransition(state, action);
      return selectNode(state, action.nodeId, context);

    case "chooseInfoCard":
      if (state.phase !== "infoOpportunity") invalidTransition(state, action);
      return chooseInfoCard(state, action.cardId, context);

    case "chooseEvent":
      if (state.phase !== "event") invalidTransition(state, action);
      return chooseEvent(state, action.choiceId, context);

    case "resolveBoss":
      if (state.phase !== "boss") invalidTransition(state, action);
      return resolveBoss(state, context);

    case "applySettlement": {
      if (state.phase !== "settlement") invalidTransition(state, action);
      const expedition = requireExpedition(state);
      const dungeon = findDungeon(state, expedition);
      return settleExpedition({
        state,
        expedition,
        rng: createRng(expeditionKey(state, dungeon)).derive("regroup"),
      }).state;
    }
  }
}

export type { MemberId };
