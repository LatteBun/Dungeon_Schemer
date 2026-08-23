import type {
  GuideRank,
  RiskLevel,
  Reward,
  SettlementResult,
  ThemeId,
} from "@/lib/domain";

/**
 * U6 정산 화면의 모델 경계.
 *
 * 화면은 CampaignState 를 직접 읽지 않는다. 정산 계산은 C4가 만들고, 이
 * 어댑터는 SettlementResult를 화면이 받을 모양으로만 변환한다. 승급은
 * 게시판의 C5 규칙과 U3 화면이 소유하며 이 모델에는 포함하지 않는다.
 */

/** 선택 → 개인 반응 → 피해 → 보상·손실 → 캠페인 변화. */
export const CAUSE_ORDER = [1, 2, 3, 4, 5] as const;

export type U6CauseOrder = (typeof CAUSE_ORDER)[number];

export interface U6CauseStep {
  order: U6CauseOrder;
  label: string;
  detail: string;
}

export interface U6SettlementView {
  dungeonName: string;
  themeId: ThemeId;
  /** 0 이면 전멸이다. */
  survivors: 0 | 1 | 2 | 3;
  causeChain: readonly U6CauseStep[];
  riskBefore: RiskLevel;
  riskAfter: RiskLevel;
  /** ★5 전멸이라 위험도가 더 오르지 않았다. */
  riskCapped: boolean;
  reputationDelta: number;
  goldDelta: number;
  /** 전멸에서만 회수한다. 그 외에는 0. */
  relicGold: number;
  nextReward: Reward | null;
}

const RANK_CREST_ROOT = "/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/ranks";

export function rankCrestSrc(rank: GuideRank): string {
  return `${RANK_CREST_ROOT}/rank_${rank.toLowerCase()}.png`;
}

const CAUSE_LABELS = ["선택", "개인 반응", "피해", "보상·손실", "캠페인 변화"] as const;

export function createU6SettlementView(
  settlement: SettlementResult,
  dungeonName: string,
  themeId: ThemeId,
): U6SettlementView {
  const details = [
    settlement.causeChain.choice,
    settlement.causeChain.reactions,
    settlement.causeChain.damage,
    settlement.causeChain.economy,
    settlement.causeChain.campaignChange,
  ] as const;
  return {
    dungeonName,
    themeId,
    survivors: settlement.survivorCount,
    causeChain: CAUSE_ORDER.map((order, index) => ({
      order,
      label: CAUSE_LABELS[index],
      detail: details[index],
    })),
    riskBefore: settlement.riskBefore,
    riskAfter: settlement.riskAfter,
    riskCapped: settlement.riskCapped,
    reputationDelta: settlement.reputationDelta,
    goldDelta: settlement.goldDelta,
    relicGold: settlement.relicGold,
    nextReward: settlement.nextReward,
  };
}
