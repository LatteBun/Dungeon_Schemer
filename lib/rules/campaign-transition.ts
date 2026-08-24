import {
  EXPEDITION_PARTY_SIZE,
  RuleError,
  TRUST_MAX,
  TRUST_MIN,
} from "@/lib/domain";
import type {
  BoardOffer,
  ChoiceId,
  NodeId,
  PreparedExpeditionEvents,
  CampaignState,
  CampaignTransition,
  CampaignTransitionContext,
  CampaignTransitionResult,
  Character,
  ExpeditionRecord,
  ExpeditionState,
  SettlementSnapshot,
} from "@/lib/domain";
import { THEMES } from "@/lib/content/themes";
import { CLASSES } from "@/lib/content/classes";
import {
  decideImmediateAdvice,
  disclosedRuleIds,
  finalizeImmediateAdviceTrust,
  resolveBossInfoAdvice,
} from "./advice-evaluation";
import { createBoardOffers } from "./board";
import {
  appendCampaignEvent,
  toAdviceResolvedEventDraft,
  toBossBattleResolvedEventDraft,
} from "./campaign-history";
import { resolveBossBattle } from "./boss-battle-adapter";
import { generateDungeonMap } from "./dungeon-map";
import { evaluateCampaignEnding, evaluateImmediateDistrustEnding } from "./ending";
import { executeGuidePromotion, getGuidePromotionEligibility } from "./promotion";
import {
  activateStrongFollower,
  applyEventChoice,
  materializeNodeEvent,
  prepareExpeditionEvents,
  resolveMonsterEventBattle,
} from "./expedition-events";
import { settleExpedition } from "./settlement";
import { runWorldTurn } from "@/lib/domain";
import { createRng } from "@/lib/rng";

function invalidTransition(message: string, details: Record<string, unknown> = {}): never {
  throw new RuleError("INVALID_TRANSITION", message, details);
}

function requirePhase(campaign: CampaignState, expected: CampaignState["phase"]): void {
  if (campaign.phase !== expected) {
    invalidTransition("허용되지 않은 캠페인 전이다", {
      phase: campaign.phase,
      expectedPhase: expected,
    });
  }
}

function emptyResult(
  campaign: CampaignState,
  context: CampaignTransitionContext,
): CampaignTransitionResult {
  return {
    campaign,
    context,
    settlement: null,
    worldTurn: null,
    promotion: null,
    ending: null,
  };
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length
    && new Set(left).size === left.length
    && new Set(right).size === right.length
    && left.every((id) => right.includes(id));
}

function selectedOffer(context: CampaignTransitionContext): BoardOffer {
  if (context.selectedOffer === null) {
    return invalidTransition("선택한 공고가 없다");
  }
  return context.selectedOffer;
}

function activeExpedition(
  context: CampaignTransitionContext,
): NonNullable<CampaignTransitionContext["activeExpedition"]> {
  if (context.activeExpedition === null) {
    return invalidTransition("활성 원정이 없다");
  }
  return context.activeExpedition;
}

function memberById(campaign: CampaignState, id: string): Character {
  const member = campaign.pool.byId[id as keyof typeof campaign.pool.byId];
  if (member === undefined) {
    return invalidTransition("원정 파티원이 캠페인 풀에 없다", { characterId: id });
  }
  return member;
}

function validatePartyMembers(
  campaign: CampaignState,
  offer: BoardOffer,
  partyMembers: readonly Character[],
): void {
  if (partyMembers.length !== EXPEDITION_PARTY_SIZE) {
    invalidTransition("원정 파티는 정확히 3명이어야 한다", { count: partyMembers.length });
  }
  const ids = partyMembers.map((member) => member.id);
  if (!sameIds(ids, offer.party.memberIds)) {
    invalidTransition("원정 파티가 공고와 다르다", {
      expectedParty: offer.party.memberIds,
      actualParty: ids,
    });
  }
  for (const member of partyMembers) {
    const before = memberById(campaign, member.id);
    if (before.classId !== member.classId || before.maxHp !== member.maxHp) {
      invalidTransition("고정 캐릭터 정보가 공고 시점과 다르다", {
        characterId: member.id,
      });
    }
  }
}

function validateExpedition(
  offer: BoardOffer,
  expeditionId: string,
  expedition: ExpeditionState,
  partyMembers: readonly Character[],
  campaign: CampaignState,
): void {
  if (expeditionId.length === 0) {
    invalidTransition("원정 ID가 비어 있다");
  }
  if (expedition.dungeonId !== offer.dungeonId || expedition.riskLevel !== offer.riskLevel) {
    invalidTransition("원정 계약 정보가 공고와 다르다", {
      expectedDungeonId: offer.dungeonId,
      actualDungeonId: expedition.dungeonId,
      expectedRiskLevel: offer.riskLevel,
      actualRiskLevel: expedition.riskLevel,
    });
  }
  if (!sameIds(expedition.party.memberIds, offer.party.memberIds)) {
    invalidTransition("원정 파티가 공고와 다르다");
  }
  validatePartyMembers(campaign, offer, partyMembers);
}

function validateSnapshot(
  active: NonNullable<CampaignTransitionContext["activeExpedition"]>,
  snapshot: SettlementSnapshot,
): void {
  if (snapshot.expeditionId !== active.expeditionId) {
    invalidTransition("정산 원정 ID가 활성 원정과 다르다", {
      expectedExpeditionId: active.expeditionId,
      actualExpeditionId: snapshot.expeditionId,
    });
  }
  if (
    snapshot.dungeonId !== active.expedition.dungeonId
    || snapshot.contractRisk !== active.expedition.riskLevel
    || !sameIds(snapshot.party.memberIds, active.expedition.party.memberIds)
  ) {
    invalidTransition("정산 계약 정보가 활성 원정과 다르다");
  }
}

function validateTrustBatch(
  campaign: CampaignState,
  active: NonNullable<CampaignTransitionContext["activeExpedition"]>,
  partyMembers: readonly Character[],
): void {
  if (partyMembers.length !== EXPEDITION_PARTY_SIZE) {
    invalidTransition("신뢰 변화 파티는 정확히 3명이어야 한다", {
      count: partyMembers.length,
    });
  }
  const ids = partyMembers.map((member) => member.id);
  if (!sameIds(ids, active.offer.party.memberIds)) {
    invalidTransition("최신 파티가 계약 파티와 다르다", {
      expectedParty: active.offer.party.memberIds,
      actualParty: ids,
    });
  }
  for (const member of partyMembers) {
    const before = memberById(campaign, member.id);
    if (before.classId !== member.classId || before.maxHp !== member.maxHp) {
      invalidTransition("고정 캐릭터 정보가 바뀌었다", { characterId: member.id });
    }
    if (!Number.isSafeInteger(member.hp) || member.hp < 0 || member.hp > member.maxHp) {
      invalidTransition("최신 파티 HP가 유효하지 않다", { characterId: member.id });
    }
    if (!Number.isSafeInteger(member.trust) || member.trust < TRUST_MIN || member.trust > TRUST_MAX) {
      invalidTransition("최신 파티 신뢰가 유효하지 않다", { characterId: member.id });
    }
    if (!Number.isSafeInteger(member.gold) || member.gold < 0) {
      invalidTransition("최신 파티 골드가 유효하지 않다", { characterId: member.id });
    }
    if (member.alive !== (member.hp > 0)) {
      invalidTransition("최신 파티 생존 상태와 HP가 모순된다", { characterId: member.id });
    }
  }
}

/**
 * 사건 배치 계획을 만든다.
 *
 * 호출부가 넘기게 하지 않는다. `C7` 은 시드와 던전을 이미 알고 있고, 계획이
 * 어떤 입력으로 만들어졌는지가 갈라지면 같은 시드에서 다른 원정이 나온다.
 */
function prepareFor(
  campaign: CampaignState,
  expedition: ExpeditionState,
  attempt: number,
): PreparedExpeditionEvents {
  const dungeon = campaign.dungeons.find((candidate) => candidate.id === expedition.dungeonId);
  if (dungeon === undefined) invalidTransition("원정 던전이 캠페인에 없다", { dungeonId: expedition.dungeonId });
  const theme = THEMES.find((candidate) => candidate.id === dungeon.theme);
  if (theme === undefined) invalidTransition("원정 던전의 테마가 없다", { theme: dungeon.theme });
  return prepareExpeditionEvents({
    campaignSeed: campaign.seed,
    dungeonId: dungeon.id,
    initialRiskLevel: dungeon.initialRiskLevel,
    riskLevel: expedition.riskLevel,
    attempt,
    map: expedition.map,
    theme,
    activeRuleIds: dungeon.activeRuleIds,
    activeMonsterIds: dungeon.activeMonsterIds,
  });
}

/**
 * 지점을 밟고 그 자리의 사건을 확정한다.
 *
 * 문서가 「지점 선택 → 연결·미방문 검증 → 상황 묘사」로 이어 놓았으므로 둘을
 * 하나로 둔다. 조언은 아직 고르지 않는다. 화면이 상황과 조언 셋을 보여줄 틈이
 * 필요하다.
 */
function transitionVisitNode(
  campaign: CampaignState,
  context: CampaignTransitionContext,
  active: NonNullable<CampaignTransitionContext["activeExpedition"]>,
  nodeId: NodeId,
): CampaignTransitionResult {
  const expedition = active.expedition;
  if (active.pendingEvent !== null) {
    invalidTransition("아직 조언을 고르지 않은 지점이 있다", { nodeId: expedition.currentNodeId });
  }

  const current = expedition.map.nodes.find((node) => node.id === expedition.currentNodeId);
  if (current === undefined) invalidTransition("현재 지점이 지도에 없다", { nodeId: expedition.currentNodeId });
  if (!current.nextNodeIds.includes(nodeId)) {
    invalidTransition("현재 지점에서 이어지지 않는 지점이다", { from: expedition.currentNodeId, to: nodeId });
  }
  if (expedition.visitedNodeIds.includes(nodeId)) {
    invalidTransition("이미 방문한 지점이다", { nodeId });
  }

  const target = expedition.map.nodes.find((node) => node.id === nodeId);
  if (target === undefined) invalidTransition("이동할 지점이 지도에 없다", { nodeId });

  const dungeon = campaign.dungeons.find((candidate) => candidate.id === expedition.dungeonId);
  if (dungeon === undefined) invalidTransition("원정 던전이 캠페인에 없다", { dungeonId: expedition.dungeonId });
  const theme = THEMES.find((candidate) => candidate.id === dungeon.theme);
  if (theme === undefined) invalidTransition("원정 던전의 테마가 없다", { theme: dungeon.theme });

  const prepared = active.preparedEvents ?? prepareFor(campaign, expedition, dungeon.attempts);
  const nextExpedition: ExpeditionState = {
    ...expedition,
    currentNodeId: nodeId,
    visitedNodeIds: [...expedition.visitedNodeIds, nodeId],
  };

  /* 보스 지점은 사건을 물질화하지 않는다. ENTER_BOSS 가 받는다. */
  if (target.kind !== "normal") {
    return emptyResult(campaign, {
      ...context,
      activeExpedition: { ...active, expedition: nextExpedition, preparedEvents: prepared, pendingEvent: null },
    });
  }

  const materialized = materializeNodeEvent({
    prepared,
    nodeId,
    campaignSeed: campaign.seed,
    dungeonId: dungeon.id,
    attempt: dungeon.attempts,
    theme,
    targetBossId: dungeon.bossId,
    activeRuleIds: dungeon.activeRuleIds,
    activeMonsterIds: dungeon.activeMonsterIds,
  });

  /* 단서를 얻었으면 후속 기회를 연다. 없던 노드를 새로 만들지는 않는다. */
  const opened = materialized.revealedClueId === undefined
    ? materialized.state
    : activateStrongFollower({ prepared: materialized.state, clueId: materialized.revealedClueId, nodeId });

  return emptyResult(campaign, {
    ...context,
    activeExpedition: {
      ...active,
      expedition: nextExpedition,
      preparedEvents: opened,
      pendingEvent: materialized.event,
    },
  });
}

/**
 * 조언을 적용한다.
 *
 * `expedition-sequence` 가 정한 순서를 그대로 탄다. 판정 → 결과 처리 → 전투 →
 * 결과를 아는 시점에 신뢰 검증이다. 이 함수는 순서를 지키기만 하고 판단은
 * `E2`·`E3` 가 한다.
 */
function transitionChooseAdvice(
  campaign: CampaignState,
  context: CampaignTransitionContext,
  active: NonNullable<CampaignTransitionContext["activeExpedition"]>,
  adviceId: ChoiceId,
): CampaignTransitionResult {
  const event = active.pendingEvent;
  if (event === null) invalidTransition("조언을 고를 사건이 없다", { nodeId: active.expedition.currentNodeId });
  if (!event.advice.some((candidate) => candidate.id === adviceId)) {
    invalidTransition("이 사건에 없는 조언이다", { eventId: event.id, adviceId });
  }

  const dungeon = campaign.dungeons.find((candidate) => candidate.id === active.expedition.dungeonId);
  if (dungeon === undefined) invalidTransition("원정 던전이 캠페인에 없다", { dungeonId: active.expedition.dungeonId });
  const theme = THEMES.find((candidate) => candidate.id === dungeon.theme);
  if (theme === undefined) invalidTransition("원정 던전의 테마가 없다", { theme: dungeon.theme });

  const depth = active.expedition.map.layers.findIndex((layer) => layer.nodeIds.includes(active.expedition.currentNodeId));
  const living = active.partyMembers.filter((member) => member.alive);
  const decideInput = {
    campaignSeed: campaign.seed,
    dungeonId: dungeon.id,
    attempt: dungeon.attempts,
    depth: depth < 0 ? 0 : depth,
    event,
    adviceId,
    members: living,
  };

  /* 보스 정보는 지연형이다. 즉시 신뢰를 확정하지 않고 기록만 쌓는다. */
  const isBossInfo = event.targetBossId !== undefined;
  const resolution = isBossInfo
    ? resolveBossInfoAdvice({ ...decideInput, dungeon })
    : (() => {
      const decision = decideImmediateAdvice(decideInput);
      const chosen = event.advice.find((candidate) => candidate.id === adviceId);
      const resultText = decision.executed
        ? chosen?.resultText ?? event.defaultResultText
        : event.defaultResultText;
      return finalizeImmediateAdviceTrust({ decision, members: living, applied: { executed: decision.executed, resultText } });
    })();

  const applied = applyEventChoice({ event, decision: resolution.decision, members: active.partyMembers });
  /* kind 가 유니온인 한 덩어리라 조건문으로 좁혀지지 않는다. 술어로 확인한다. */
  const isMonster = (candidate: typeof event): candidate is typeof event & { readonly kind: "monster" } =>
    candidate.kind === "monster";
  const battle = !isMonster(event) ? null : resolveMonsterEventBattle({
    event,
    modifier: applied.encounterModifier ?? {},
    activeMonsterIds: dungeon.activeMonsterIds,
    monsterDefs: theme.monsters,
    members: applied.members,
    classDefs: CLASSES,
    seed: `${campaign.seed}/${dungeon.id}/${dungeon.attempts}/${active.expedition.currentNodeId}`,
    pendingMerchantEffect: active.expedition.pendingMerchantEffect,
    retrySteps: dungeon.attempts,
  });

  /*
   * 전투 결과를 파티 명단 **위에** 얹는다. 명단을 결과로 갈아치우지 않는다.
   *
   * `resolveMonsterEventBattle` 은 살아 있는 사람만 데려가므로 그 결과에는 이미
   * 죽어 있던 사람이 없다. 결과를 그대로 명단으로 삼으면 죽은 사람이 파티에서
   * 사라지고, 정산이 "최종 파티원이 3명이 아니다" 로 거부한다.
   *
   * 여태 드러나지 않은 것은 일반 몹이 전부 HP 1 이라 아무도 죽지 않았기
   * 때문이다. 몬스터에 제 수치를 넣자마자 120 시드 중 6 이 거기서 멈췄다.
   */
  const battleParty = new Map((battle?.battle?.party ?? []).map((member) => [String(member.id), member]));
  const afterBattle = applied.members.map((member) => {
    const fought = battleParty.get(String(member.id));
    return fought === undefined ? member : { ...member, hp: fought.hp, alive: fought.hp > 0 };
  });

  const withTrust = afterBattle.map((member) => {
    const change = resolution.trustChanges.filter((one) => one.characterId === member.id)
      .reduce((total, one) => total + one.delta, 0);
    return change === 0 ? member : { ...member, trust: Math.max(TRUST_MIN, Math.min(TRUST_MAX, member.trust + change)) };
  });

  const wiped = withTrust.every((member) => !member.alive);
  const nextExpedition: ExpeditionState = {
    ...active.expedition,
    infoRecords: [...active.expedition.infoRecords, ...resolution.decision.delayedRecords],
    pendingMerchantEffect: battle?.pendingMerchantEffect ?? active.expedition.pendingMerchantEffect,
    /* 전멸하면 남은 경로와 보스전을 건너뛴다. 문서가 그렇게 정한다. */
    result: wiped
      ? { status: "wiped" as const, survivorIds: [] }
      : active.expedition.result,
  };

  /*
   * 조언 하나가 끝날 때마다 이력에 남긴다.
   *
   * `C8-B` 가 그릇과 draft 함수와 무결성 검사를 만들어 두었는데 아무도 부르지
   * 않고 있었다. 전이 안에서 붙이면 누락이 구조적으로 불가능하다. 화면이
   * `dispatch` 뒤에 붙이면 빠뜨릴 수 있고, 캠페인 기록을 화면이 소유하게 된다.
   */
  const withHistory: CampaignState = {
    ...campaign,
    history: appendCampaignEvent(campaign.history, {
      campaignTurn: campaign.worldTurn,
      event: toAdviceResolvedEventDraft({
        expeditionId: active.expeditionId,
        dungeonId: dungeon.id,
        sourceEventId: event.id,
        decision: resolution.decision,
      }),
    }),
  };

  /*
   * 이 조언이 남긴 사실을 붙든다.
   *
   * 정산은 원정이 끝난 뒤에 온다. 그때는 사건도 조언 목록도 사라진 뒤라, 무엇을
   * 골랐는지 물을 곳이 없다. 사라지기 전에 적어 둔다.
   */
  const chosen = event.advice.find((option) => option.id === resolution.decision.adviceId);
  const record: ExpeditionRecord = {
    observation: event.description,
    choice: chosen?.label ?? "",
    reactions: resolution.decision.reactions.map((one) => ({ characterId: one.characterId, reaction: one.reaction })),
    damage: withTrust.flatMap((after) => {
      const before = active.partyMembers.find((candidate) => candidate.id === after.id);
      return before === undefined || before.hp === after.hp
        ? []
        : [{ characterId: after.id, before: before.hp, after: after.hp }];
    }),
    battle: battle?.battle == null
      ? null
      : { rounds: battle.battle.rounds, victory: battle.battle.status === "victory" },
  };

  return emptyResult(withHistory, {
    ...context,
    activeExpedition: {
      ...active,
      expedition: nextExpedition,
      partyMembers: withTrust,
      pendingEvent: null,
      records: [...active.records, record],
    },
  });
}

/**
 * 보스방에 든다.
 *
 * 새 조언을 주지 않는다. 수용해 온 보스 정보만 `E4` 가 modifier 로 바꾸고,
 * 전투 뒤 그 믿음을 사후 검증한다. 정산은 하지 않는다. `COMPLETE_EXPEDITION`
 * 이 그 몫을 이미 가지고 있다.
 */
function transitionEnterBoss(
  campaign: CampaignState,
  context: CampaignTransitionContext,
  active: NonNullable<CampaignTransitionContext["activeExpedition"]>,
): CampaignTransitionResult {
  const expedition = active.expedition;
  if (expedition.currentNodeId !== expedition.map.bossNodeId) {
    invalidTransition("보스방이 아니다", { nodeId: expedition.currentNodeId });
  }
  if (expedition.bossResult !== null) invalidTransition("이미 치른 보스전이다", { expeditionId: active.expeditionId });
  if (active.pendingEvent !== null) invalidTransition("아직 조언을 고르지 않은 지점이 있다", {});

  const dungeon = campaign.dungeons.find((candidate) => candidate.id === expedition.dungeonId);
  if (dungeon === undefined) invalidTransition("원정 던전이 캠페인에 없다", { dungeonId: expedition.dungeonId });
  const theme = THEMES.find((candidate) => candidate.id === dungeon.theme);
  if (theme === undefined) invalidTransition("원정 던전의 테마가 없다", { theme: dungeon.theme });

  const resolved = resolveBossBattle({
    dungeon,
    theme,
    members: active.partyMembers,
    classDefs: CLASSES,
    infoRecords: expedition.infoRecords,
    seed: `${campaign.seed}/${dungeon.id}/${dungeon.attempts}/boss`,
    pendingMerchantEffect: expedition.pendingMerchantEffect,
  });

  const withTrust = resolved.members.map((member) => {
    const change = resolved.trustChanges.filter((one) => one.characterId === member.id)
      .reduce((total, one) => total + one.delta, 0);
    return change === 0 ? member : { ...member, trust: Math.max(TRUST_MIN, Math.min(TRUST_MAX, member.trust + change)) };
  });

  const nextExpedition: ExpeditionState = {
    ...expedition,
    bossResult: resolved.bossResult,
    pendingMerchantEffect: resolved.pendingMerchantEffect,
    result: { status: resolved.bossResult.status, survivorIds: resolved.bossResult.survivorIds },
  };

  const withHistory: CampaignState = {
    ...campaign,
    history: appendCampaignEvent(campaign.history, {
      campaignTurn: campaign.worldTurn,
      event: toBossBattleResolvedEventDraft({
        expeditionId: active.expeditionId,
        dungeonId: dungeon.id,
        bossId: dungeon.bossId,
        result: resolved.bossResult,
      }),
    }),
  };

  /*
   * 보스전이 원인 사슬의 마지막 칸을 덮어쓴다.
   *
   * 마지막 조언의 피해만 남겨 두면 보스에게 전멸한 원정이 "피해 없이
   * 지나갔다" 로 정산된다 - 실제로 걸어 본 한 판이 그랬다. 결과를 정한 것이
   * 보스전이라면 원인도 보스전이어야 한다.
   *
   * 고른 것은 무엇을 믿고 들어갔는가다. `E4` 가 실제로 적용한 믿음만 센다.
   */
  const applied = resolved.bossResult.applications.length;
  const bossRecord: ExpeditionRecord = {
    observation: "보스방에 들었다",
    choice: applied === 0
      ? "보스 정보 없이 보스방에 들었다"
      : `수용한 보스 정보 ${applied}건을 믿고 들었다`,
    /* 누구의 믿음이 어떻게 돌아왔는지. `E4` 가 판정한 것을 옮긴다. */
    reactions: resolved.bossResult.verifications.map((one) => ({
      characterId: one.characterId,
      reaction: one.action,
    })),
    damage: withTrust.flatMap((after) => {
      const before = active.partyMembers.find((candidate) => candidate.id === after.id);
      return before === undefined || before.hp === after.hp
        ? []
        : [{ characterId: after.id, before: before.hp, after: after.hp }];
    }),
    battle: {
      rounds: resolved.bossResult.battle.rounds,
      victory: resolved.bossResult.status === "cleared",
    },
  };

  return emptyResult(withHistory, {
    ...context,
    activeExpedition: {
      ...active,
      expedition: nextExpedition,
      partyMembers: withTrust,
      records: [...active.records, bossRecord],
    },
  });
}

/**
 * 공고 하나에서 원정 상태를 만든다.
 *
 * `START_EXPEDITION` 이 완성된 `ExpeditionState` 를 받으므로 누군가는 지도를
 * 만들고 공개 규칙을 정하고 파티를 확정해야 한다. 그 일을 화면이 하면 화면
 * 계층이 규칙 판단을 하게 된다. 규칙 계층이 내준다.
 *
 * 액션의 payload 는 바꾸지 않는다. 호출부가 이 함수를 부르고 그 결과를 넘긴다.
 * 액션 모양을 바꾸면 기존 검사가 통째로 깨지는데 얻는 것이 없다.
 */
/**
 * 원정을 정산 입력으로 옮긴다.
 *
 * 화면이 `SettlementSnapshot` 을 조립하지 않게 한다. 그것은 `C4` 의 입력이고,
 * 무엇이 최종 파티인지 · 어떤 상태로 끝났는지는 규칙의 판단이다. 화면이 그것을
 * 조립하면 정산의 근거를 화면이 소유하게 된다.
 *
 * 원인 사슬의 세 줄은 사람 이름이 붙은 문장이다. 이름을 붙일 수 있는 곳은
 * 파티를 들고 있는 여기뿐이라 여기서 짓는다.
 */
export function createSettlementSnapshotFor(
  campaign: CampaignState,
  active: NonNullable<CampaignTransitionContext["activeExpedition"]>,
): SettlementSnapshot {
  const expedition = active.expedition;
  const status = expedition.result?.status ?? expedition.bossResult?.status;
  if (status === undefined) invalidTransition("아직 끝나지 않은 원정이다", { expeditionId: active.expeditionId });

  const nameOf = (characterId: Character["id"]) =>
    active.partyMembers.find((member) => member.id === characterId)?.name ?? String(characterId);
  const word: Readonly<Record<string, string>> = {
    accepted: "수용", suspected: "의심", detected: "적발",
    /* `E4` 가 보스전 뒤에 그 믿음이 옳았는지 판정한 결과다. */
    adviceHelped: "믿음이 맞았다", adviceHarmed: "믿음이 틀렸다",
    suspicionWasCorrect: "의심이 맞았다", suspicionWasCostly: "의심이 손해였다",
  };
  const cause = active.records.at(-1) ?? null;

  return {
    expeditionId: active.expeditionId,
    dungeonId: expedition.dungeonId,
    /* 계약 시점의 위험도다. 던전이 그 사이 올랐어도 이 원정은 이 값으로 센다. */
    contractRisk: expedition.riskLevel,
    party: { memberIds: [...expedition.party.memberIds] },
    finalMembers: active.partyMembers.map((member) => ({ ...member })),
    status,
    causeInputs: {
      choice: cause?.choice ?? "조언을 고를 일이 없었다",
      reactions: cause === undefined || cause === null || cause.reactions.length === 0
        ? "반응한 사람이 없다"
        : cause.reactions.map((one) => `${nameOf(one.characterId)} ${word[one.reaction] ?? one.reaction}`).join(" · "),
      damage: cause === undefined || cause === null || cause.damage.length === 0
        ? "피해 없이 지나갔다"
        : cause.damage.map((one) => `${nameOf(one.characterId)} HP ${one.before} → ${one.after}`).join(" · "),
    },
  };
}

export function createExpeditionForOffer(
  campaign: CampaignState,
  offer: BoardOffer,
): { readonly expedition: ExpeditionState; readonly partyMembers: readonly Character[] } {
  const dungeon = campaign.dungeons.find((candidate) => candidate.id === offer.dungeonId);
  if (dungeon === undefined) invalidTransition("공고의 던전이 캠페인에 없다", { dungeonId: offer.dungeonId });

  const partyMembers = offer.party.memberIds.map((id) => {
    const member = campaign.pool.byId[id];
    if (member === undefined) invalidTransition("공고 파티원이 캠페인 풀에 없다", { characterId: id });
    return { ...member };
  });

  const map = generateDungeonMap({
    campaignSeed: campaign.seed,
    dungeonId: dungeon.id,
    initialRiskLevel: dungeon.initialRiskLevel,
    attempt: dungeon.attempts,
  });

  return {
    expedition: {
      dungeonId: dungeon.id,
      /* 계약 시점의 위험도다. 던전이 올라도 이 원정은 이 값으로 정산한다. */
      riskLevel: dungeon.riskLevel,
      party: { memberIds: [...offer.party.memberIds] },
      activeRuleIds: [...dungeon.activeRuleIds],
      disclosedRuleIds: [...disclosedRuleIds({
        campaignSeed: campaign.seed,
        dungeonId: dungeon.id,
        riskLevel: dungeon.riskLevel,
        activeRuleIds: dungeon.activeRuleIds,
      })],
      map,
      currentNodeId: map.entryNodeId,
      visitedNodeIds: [map.entryNodeId],
      infoRecords: [],
      pendingMerchantEffect: null,
      bossResult: null,
      result: null,
    },
    partyMembers,
  };
}

/** 재도전 횟수다. 사건 배치가 재도전마다 달라야 하므로 시드에 들어간다. */
function attemptOf(campaign: CampaignState, expedition: ExpeditionState): number {
  return campaign.dungeons.find((candidate) => candidate.id === expedition.dungeonId)?.attempts ?? 0;
}

function copyActiveExpedition(
  campaign: CampaignState,
  action: Extract<CampaignTransition, { type: "START_EXPEDITION" }>,
  offer: BoardOffer,
): NonNullable<CampaignTransitionContext["activeExpedition"]> {
  return {
    expeditionId: action.expeditionId,
    offer: {
      ...offer,
      party: { memberIds: [...offer.party.memberIds] },
    },
    expedition: {
      ...action.expedition,
      party: { memberIds: [...action.expedition.party.memberIds] },
    },
    partyMembers: action.partyMembers.map((member) => ({ ...member })),
    /*
     * 원정을 시작할 때 만든다.
     *
     * 첫 방문 때로 미뤘더니 지도 화면이 노드별 공개 분류를 얻지 못했다. 지점을
     * 밟기 전에 무엇이 있는지 보여주는 것이 지도의 일이므로, 계획이 그때 이미
     * 있어야 한다.
     */
    preparedEvents: prepareFor(campaign, action.expedition, attemptOf(campaign, action.expedition)),
    pendingEvent: null,
    records: [],
  };
}


function transitionBoard(
  campaign: CampaignState,
  context: CampaignTransitionContext,
  action: CampaignTransition,
): CampaignTransitionResult {
  if (action.type === "OPEN_BOARD") {
    requirePhase(campaign, "intro");
    return emptyResult(
      { ...campaign, phase: "board", offers: createBoardOffers(campaign) },
      context,
    );
  }

  requirePhase(campaign, "board");
  if (action.type === "SELECT_CONTRACT") {
    if (context.selectedOffer !== null || context.activeExpedition !== null) {
      invalidTransition("게시판에 이미 선택된 계약이 있다");
    }
    const offer = campaign.offers.find((candidate) => candidate.id === action.offerId);
    if (offer === undefined || offer.lockReason !== null) {
      invalidTransition("선택할 수 있는 공고가 없다", { offerId: action.offerId });
    }
    return emptyResult(campaignWithPhase(campaign, "contract"), {
      ...context,
      selectedOffer: {
        ...offer,
        party: { memberIds: [...offer.party.memberIds] },
      },
    });
  }

  if (action.type === "OPEN_PROMOTION") {
    if (getGuidePromotionEligibility(campaign) === null) {
      return invalidTransition("현재 등급은 승급할 수 없다", { rank: campaign.rank });
    }
    return emptyResult(campaignWithPhase(campaign, "promotion"), context);
  }
  return invalidTransition("게시판에서 허용되지 않은 전이다", { type: action.type });
}

function transitionContract(
  campaign: CampaignState,
  context: CampaignTransitionContext,
  action: CampaignTransition,
): CampaignTransitionResult {
  requirePhase(campaign, "contract");
  const offer = selectedOffer(context);

  if (action.type === "CANCEL_CONTRACT") {
    return emptyResult(campaignWithPhase(campaign, "board"), {
      ...context,
      selectedOffer: null,
    });
  }

  if (action.type === "START_EXPEDITION") {
    if (context.activeExpedition !== null) {
      invalidTransition("이미 활성 원정이 있다");
    }
    validateExpedition(offer, action.expeditionId, action.expedition, action.partyMembers, campaign);
    return emptyResult(
      campaignWithPhase(campaign, "expedition"),
      {
        ...context,
        selectedOffer: null,
        activeExpedition: copyActiveExpedition(campaign, action, offer),
      },
    );
  }

  return invalidTransition("계약에서 허용되지 않은 전이다", { type: action.type });
}

function campaignWithPhase(
  campaign: CampaignState,
  phase: CampaignState["phase"],
): CampaignState {
  return { ...campaign, phase };
}

export function transitionCampaign(
  campaign: CampaignState,
  context: CampaignTransitionContext,
  action: CampaignTransition,
): CampaignTransitionResult {
  if (campaign.phase === "ended") {
    return invalidTransition("종료된 캠페인은 다시 진행할 수 없다", { type: action.type });
  }

  if (campaign.phase === "intro" || campaign.phase === "board") {
    return transitionBoard(campaign, context, action);
  }

  if (campaign.phase === "contract") {
    return transitionContract(campaign, context, action);
  }

  if (campaign.phase === "expedition") {
    requirePhase(campaign, "expedition");
    const active = activeExpedition(context);
    if (action.type === "APPLY_TRUST_BATCH") {
      validateTrustBatch(campaign, active, action.partyMembers);
      const nextById = { ...campaign.pool.byId };
      for (const member of action.partyMembers) nextById[member.id] = { ...member };
      const withLatestParty: CampaignState = {
        ...campaign,
        pool: { ...campaign.pool, byId: nextById },
      };
      const nextActive = {
        ...active,
        partyMembers: action.partyMembers.map((member) => ({ ...member })),
      };
      const ending = evaluateImmediateDistrustEnding(withLatestParty, action.partyMembers);
      const nextCampaign = ending === null
        ? withLatestParty
        : { ...withLatestParty, phase: "ended" as const, ending };
      return {
        ...emptyResult(nextCampaign, {
          ...context,
          activeExpedition: nextActive,
        }),
        ending,
      };
    }
    if (action.type === "VISIT_NODE") {
      return transitionVisitNode(campaign, context, active, action.nodeId);
    }

    if (action.type === "CHOOSE_ADVICE") {
      return transitionChooseAdvice(campaign, context, active, action.adviceId);
    }

    if (action.type === "ENTER_BOSS") {
      return transitionEnterBoss(campaign, context, active);
    }

    if (action.type === "COMPLETE_EXPEDITION") {
      if (campaign.settledExpeditionIds.includes(action.snapshot.expeditionId)) {
        return invalidTransition("이미 정산한 원정이다", {
          expeditionId: action.snapshot.expeditionId,
        });
      }
      validateSnapshot(active, action.snapshot);
      const execution = settleExpedition(campaign, action.snapshot);

      return {
        ...emptyResult(
          {
            ...execution.campaign,
            phase: "settlement",
            settledExpeditionIds: [
              ...campaign.settledExpeditionIds,
              action.snapshot.expeditionId,
            ],
          },
          context,
        ),
        settlement: execution.result,
      };
    }
    return invalidTransition("원정에서 허용되지 않은 전이다", { type: action.type });
  }

  if (campaign.phase === "settlement") {
    requirePhase(campaign, "settlement");
    activeExpedition(context);
    if (action.type === "START_WORLD_TURN") {
      return emptyResult(campaignWithPhase(campaign, "worldTurn"), context);
    }
    return invalidTransition("정산에서 허용되지 않은 전이다", { type: action.type });
  }

  if (campaign.phase === "worldTurn") {
    requirePhase(campaign, "worldTurn");
    const active = activeExpedition(context);
    if (action.type !== "COMPLETE_WORLD_TURN") {
      return invalidTransition("월드턴에서 허용되지 않은 전이다", { type: action.type });
    }
    const worldTurnExecution = runWorldTurn(
      campaign.pool,
      active.offer.party,
      campaign.worldTurn,
      createRng(`${campaign.seed}/${campaign.worldTurn}`).derive("worldturn"),
    );
    const nextTurnCampaign: CampaignState = {
      ...campaign,
      pool: worldTurnExecution.pool,
      worldTurn: worldTurnExecution.result.worldTurn,
      phase: "board",
      offers: [],
    };
    const withOffers = {
      ...nextTurnCampaign,
      offers: createBoardOffers(nextTurnCampaign),
    };
    const ending = evaluateCampaignEnding(withOffers);
    const nextCampaign = ending === null
      ? withOffers
      : { ...withOffers, phase: "ended" as const, ending };
    return {
      ...emptyResult(nextCampaign, {
        selectedOffer: null,
        activeExpedition: null,
      }),
      worldTurn: worldTurnExecution.result,
      ending,
    };
  }

  if (campaign.phase === "promotion") {
    requirePhase(campaign, "promotion");
    if (action.type === "CANCEL_PROMOTION") {
      return emptyResult(campaignWithPhase(campaign, "board"), context);
    }
    if (action.type === "PROMOTE_GUIDE") {
      const execution = executeGuidePromotion(campaign, action.method);
      const promoted: CampaignState = {
        ...execution.campaign,
        phase: "board",
        offers: [],
      };
      return {
        ...emptyResult(
          { ...promoted, offers: createBoardOffers(promoted) },
          context,
        ),
        promotion: execution.result,
      };
    }
    return invalidTransition("승급에서 허용되지 않은 전이다", { type: action.type });
  }

  return invalidTransition("알 수 없는 캠페인 전이다", { phase: campaign.phase });
}
