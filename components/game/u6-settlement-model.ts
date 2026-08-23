import { GUIDE_RANKS, PROMOTION_GOLD, PROMOTION_REPUTATION } from "@/lib/domain";
import type {
  CampaignState,
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
 * 어댑터는 SettlementResult를 화면이 받을 모양으로만 변환한다. 승급 실행은
 * C5의 몫으로 남겨 둔다.
 *
 * 승급만은 지금도 계산한다. 요구치 상수가 이미 도메인에 있기 때문이다.
 */

/** 선택 → 개인 반응 → 피해 → 보상·손실 → 캠페인 변화. */
export const CAUSE_ORDER = [1, 2, 3, 4, 5] as const;

export type U6CauseOrder = (typeof CAUSE_ORDER)[number];

export interface U6CauseStep {
  order: U6CauseOrder;
  label: string;
  detail: string;
}

export interface U6PromotionView {
  from: GuideRank;
  to: Exclude<GuideRank, "C">;
  reputationRequired: number;
  goldRequired: number;
  currentReputation: number;
  currentGold: number;
  /** 명성 경로가 열렸나. 승급해도 명성은 줄지 않는다. */
  byReputation: boolean;
  /** 골드 경로가 열렸나. 골드를 소비하고 명성을 보지 않는다. */
  byGold: boolean;
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
  /** 최고 등급이면 null. */
  promotion: U6PromotionView | null;
}

const CAUSE_LABELS = ["선택", "개인 반응", "피해", "보상·손실", "캠페인 변화"] as const;

export function createU6SettlementView(
  campaign: CampaignState,
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
    promotion: createU6PromotionView(campaign.rank, campaign.reputation, campaign.gold),
  };
}

const RANK_CREST_ROOT = "/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/ranks";

export function rankCrestSrc(rank: GuideRank): string {
  return `${RANK_CREST_ROOT}/rank_${rank.toLowerCase()}.png`;
}

export function nextRank(rank: GuideRank): Exclude<GuideRank, "C"> | null {
  const index = GUIDE_RANKS.indexOf(rank);
  const next = GUIDE_RANKS[index + 1];
  return next === undefined ? null : (next as Exclude<GuideRank, "C">);
}

/**
 * 두 경로를 각각 판정한다. 하나로 합치면 어느 쪽으로 벌었는지가 지워진다.
 */
export function createU6PromotionView(
  from: GuideRank,
  currentReputation: number,
  currentGold: number,
): U6PromotionView | null {
  const to = nextRank(from);
  if (to === null) {
    return null;
  }

  const reputationRequired = PROMOTION_REPUTATION[to];
  const goldRequired = PROMOTION_GOLD[to];

  return {
    from,
    to,
    reputationRequired,
    goldRequired,
    currentReputation,
    currentGold,
    byReputation: currentReputation >= reputationRequired,
    byGold: currentGold >= goldRequired,
  };
}
