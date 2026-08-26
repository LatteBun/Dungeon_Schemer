import { RuleError, createCampaignTransitionContext } from "@/lib/domain";
import type {
  CampaignState,
  CampaignTransition,
  CampaignTransitionContext,
  CampaignTransitionResult,
} from "@/lib/domain";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { recordSettlementStatistics } from "@/lib/rules/campaign-statistics";
import { transitionCampaign } from "@/lib/rules/campaign-transition";

/**
 * 캠페인 한 판을 시드와 액션 기록으로 다룬다.
 *
 * 스토어와 저장이 함께 쓰는 알맹이다. 스토어는 여기에 액션을 하나씩 넣고,
 * 저장에서 되살릴 때는 같은 함수로 처음부터 다시 넣는다. 두 길이 같은 함수를
 * 지나야 이어서 한 판과 처음부터 한 판이 갈라지지 않는다.
 */

export interface CampaignRunState {
  readonly campaign: CampaignState;
  readonly context: CampaignTransitionContext;
  readonly last: CampaignTransitionResult | null;
}

/**
 * 정산 한 번을 `C8-A` 가 누적한다.
 *
 * `C7` 은 통계를 건드리지 않는다 — 정산 결과를 내주고 소유권은 넘긴다. 그 결과를
 * 「재계산하지 않고 단 한 번 소비」하는 것이 여기의 몫이라고 `C8-A` 가 적어 두었고,
 * 그동안 아무도 부르지 않아 누적 통계가 전부 0 이었다. 엔딩 보고서가 「원정 0회 ·
 * 사망 0명」을 내놓는다.
 *
 * 다시 계산하지 않는다. 두 번 세면 두 곳이 갈라진다.
 */
export function accumulate(result: CampaignTransitionResult): CampaignState {
  const settlement = result.settlement;
  if (settlement == null) return result.campaign;

  const dungeon = result.campaign.dungeons.find((one) => one.id === settlement.dungeonId);
  if (dungeon === undefined) return result.campaign;

  return {
    ...result.campaign,
    statistics: recordSettlementStatistics(result.campaign.statistics, settlement, dungeon),
  };
}

export function initialRunState(seed: string): CampaignRunState {
  return {
    campaign: initializeCampaign(seed),
    context: createCampaignTransitionContext(),
    last: null,
  };
}

export type AdvanceResult =
  | { readonly ok: true; readonly state: CampaignRunState }
  | { readonly ok: false; readonly reason: string; readonly details: Readonly<Record<string, unknown>> };

/**
 * 액션 하나를 넣는다.
 *
 * 던지지 않는다. 잘못된 조작 하나가 캠페인을 깨뜨리면 안 되고, 뒤로가기로
 * 되살아난 낡은 화면이 보내는 조작이 바로 이 자리로 온다.
 */
export function advanceRun(state: CampaignRunState, action: CampaignTransition): AdvanceResult {
  try {
    const result = transitionCampaign(state.campaign, state.context, action);
    return {
      ok: true,
      state: { campaign: accumulate(result), context: result.context, last: result },
    };
  } catch (error) {
    if (!(error instanceof RuleError)) throw error;
    return { ok: false, reason: error.message, details: error.details ?? {} };
  }
}

export type ReplayResult =
  | { readonly ok: true; readonly state: CampaignRunState }
  /** 어느 액션에서 막혔는지 남긴다. 규칙이 바뀌면 옛 저장이 여기로 온다. */
  | { readonly ok: false; readonly reason: string; readonly failedAt: number };

function reasonForReplayFailure(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 시드와 액션 기록을 캠페인으로 되돌린다.
 *
 * 하나라도 막히면 **전부 버린다.** 막힌 앞까지만 살리면 플레이어가 겪지 않은
 * 지점으로 되돌려 놓게 되고, 본인은 그것이 진행을 잃은 것인지 알 수 없다.
 * 규칙이 바뀌어 옛 저장을 못 읽게 되는 것은 어쩔 수 없지만, 조용히 다른 판을
 * 내주는 것은 피한다.
 */
export function replayRun(seed: string, actions: readonly CampaignTransition[]): ReplayResult {
  let state = initialRunState(seed);

  for (const [index, action] of actions.entries()) {
    let step: AdvanceResult;
    try {
      step = advanceRun(state, action);
    } catch (error) {
      return { ok: false, reason: reasonForReplayFailure(error), failedAt: index };
    }
    if (!step.ok) return { ok: false, reason: step.reason, failedAt: index };
    state = step.state;
  }

  return { ok: true, state };
}
