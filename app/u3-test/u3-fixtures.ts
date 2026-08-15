import { toCampaignHeaderView } from "@/components/game/campaign-view-model";
import { BOSSES } from "@/lib/content/bosses";
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
import { INFO_CARDS } from "@/lib/content/info-cards";
import { ITEMS } from "@/lib/content/items";
import {
  affordableChoiceIds,
  createCampaignMachineContext,
  transitionCampaign,
} from "@/lib/flow/campaign-machine";
import { createRng } from "@/lib/rng";
import { resolveBossFight } from "@/lib/rules/boss";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { resolveEnding } from "@/lib/rules/ending";
import { settleExpedition } from "@/lib/rules/settlement";
import type { CampaignHeaderView } from "@/components/game/campaign-view-model";
import type {
  CampaignEnding,
  CampaignMember,
  CampaignState,
  ExpeditionState,
} from "@/lib/domain";
import type { BossResolution } from "@/lib/rules/boss";
import type { SettlementStep } from "@/lib/rules/settlement";

export interface ExpeditionOutcome {
  headerView: CampaignHeaderView;
  bossResolution: BossResolution;
  membersBefore: CampaignMember[];
  steps: SettlementStep[];
  stateAfter: CampaignState;
  ending: CampaignEnding | null;
}

const CONTEXT = createCampaignMachineContext({
  events: DUNGEON_EVENT_POOLS,
  cards: INFO_CARDS,
  items: ITEMS,
  bosses: BOSSES,
});

/** 전이 함수와 같은 시드를 써야 직접 호출한 보스전이 같은 결과를 낸다. */
function expeditionKey(state: CampaignState, dungeonId: string, failureCount: number): string {
  return `${state.seed}/${dungeonId}#${failureCount}`;
}

function participantsOf(
  state: CampaignState,
  expedition: ExpeditionState,
): CampaignMember[] {
  const party = state.parties.find((candidate) => candidate.id === expedition.partyId);
  const ids = new Set((party?.memberIds ?? []).map(String));
  return state.members.filter((member) => ids.has(member.id as string));
}

/**
 * 한 탐험을 실제 전이 함수로 끝까지 진행한다.
 *
 * 보스전과 정산은 전이 함수 대신 규칙 함수를 직접 부른다. transitionCampaign이
 * BossResolution과 SettlementResult.steps를 버려서 화면이 원인을 못 받기 때문이다.
 * 같은 시드를 쓰므로 결과는 전이 함수를 통과한 상태와 같다.
 */
export function runOneExpedition(seed: string): ExpeditionOutcome {
  let state = initializeCampaign(seed);
  state = transitionCampaign(state, { type: "openBoard" }, CONTEXT);

  const offer = state.board.find((candidate) => !candidate.locked);
  if (offer === undefined) {
    throw new Error(`지원 가능한 공고가 없다: ${seed}`);
  }
  state = transitionCampaign(
    state,
    { type: "acceptContract", offerId: offer.id },
    CONTEXT,
  );

  for (let guard = 0; state.phase !== "boss"; guard += 1) {
    if (guard > 100) {
      throw new Error(`탐험이 보스방에 닿지 않는다: ${seed} · ${state.phase}`);
    }
    const expedition = state.expedition;
    if (expedition === null) {
      throw new Error(`탐험 상태가 비었다: ${seed}`);
    }

    if (state.phase === "map") {
      const current = expedition.map.nodes.find(
        (node) => node.id === expedition.currentNodeId,
      );
      const nextNodeId = current?.nextNodeIds[0];
      if (nextNodeId === undefined) {
        throw new Error(`다음 지점이 없다: ${expedition.currentNodeId}`);
      }
      state = transitionCampaign(
        state,
        { type: "selectNode", nodeId: nextNodeId },
        CONTEXT,
      );
    } else if (state.phase === "infoOpportunity") {
      const cardId = expedition.pendingInfo?.cardIds[0];
      if (cardId === undefined) {
        throw new Error("정보 기회에 카드 후보가 없다");
      }
      state = transitionCampaign(state, { type: "chooseInfoCard", cardId }, CONTEXT);
    } else if (state.phase === "event") {
      // 잔액을 넘는 거래는 규칙이 거부하므로 살 수 있는 것만 고른다.
      const choiceId =
        affordableChoiceIds(state, CONTEXT)[0] ?? expedition.pendingEvent?.choiceIds[0];
      if (choiceId === undefined) {
        throw new Error("사건에 고를 수 있는 선택지가 없다");
      }
      state = transitionCampaign(state, { type: "chooseEvent", choiceId }, CONTEXT);
    } else {
      throw new Error(`예상 밖 단계: ${state.phase}`);
    }
  }

  const expedition = state.expedition;
  if (expedition === null) {
    throw new Error(`보스 단계에 탐험 상태가 없다: ${seed}`);
  }
  const dungeon = state.dungeons.find((candidate) => candidate.id === expedition.dungeonId);
  if (dungeon === undefined) {
    throw new Error(`던전을 찾을 수 없다: ${expedition.dungeonId}`);
  }
  const boss = CONTEXT.bossByGrade.get(dungeon.grade);
  if (boss === undefined) {
    throw new Error(`등급별 보스가 없다: ${dungeon.grade}`);
  }

  const key = expeditionKey(state, dungeon.id as string, dungeon.failureCount);
  const membersBefore = participantsOf(state, expedition).map((member) => ({ ...member }));
  const bossResolution = resolveBossFight({
    boss,
    members: membersBefore,
    infoRecords: expedition.infoRecords,
    rng: createRng(key).derive("boss"),
  });

  state = transitionCampaign(state, { type: "resolveBoss" }, CONTEXT);
  const settledExpedition = state.expedition;
  if (settledExpedition === null) {
    throw new Error(`정산 단계에 탐험 상태가 없다: ${seed}`);
  }
  const settled = settleExpedition({
    state,
    expedition: settledExpedition,
    rng: createRng(key).derive("regroup"),
  });

  return {
    headerView: toCampaignHeaderView(settled.state),
    bossResolution,
    membersBefore,
    steps: settled.steps,
    stateAfter: settled.state,
    ending: settled.state.ending,
  };
}

/**
 * 엔딩 화면을 보기 위해 남은 던전을 모두 클리어 처리한 뒤 다시 판정한다.
 * 규칙을 우회하지 않고 규칙에 넣는 입력만 손질한다.
 */
export function completedCampaignOutcome(seed: string): ExpeditionOutcome {
  const outcome = runOneExpedition(seed);
  const cleared: CampaignState = {
    ...outcome.stateAfter,
    dungeons: outcome.stateAfter.dungeons.map((dungeon) => ({
      ...dungeon,
      status: "cleared" as const,
    })),
  };
  const ending = resolveEnding(cleared, outcome.bossResolution.survivorIds);
  const withEnding: CampaignState = { ...cleared, ending };

  return {
    ...outcome,
    headerView: toCampaignHeaderView(withEnding),
    stateAfter: withEnding,
    ending,
  };
}
