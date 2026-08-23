import {
  GUIDE_RANKS,
  PROMOTION_GOLD,
  PROMOTION_REPUTATION,
  RANK_RISK_LIMIT,
  RuleError,
} from "@/lib/domain";
import type {
  CampaignState,
  GuideRank,
  PromotionEligibility,
  PromotionExecution,
  PromotionMethod,
  PromotionResult,
} from "@/lib/domain";

function nextRank(rank: GuideRank): PromotionEligibility["toRank"] | null {
  const index = GUIDE_RANKS.indexOf(rank);
  const next = GUIDE_RANKS[index + 1];
  return next === undefined || next === "C" ? null : next;
}

function requirePhase(campaign: CampaignState, phase: CampaignState["phase"]): void {
  if (campaign.phase !== phase) {
    throw new RuleError("INVALID_STATE", `승급 단계가 아니다: ${campaign.phase}`, {
      phase: campaign.phase,
      expectedPhase: phase,
      rank: campaign.rank,
    });
  }
}

function invalidPromotion(
  campaign: CampaignState,
  details: Record<string, unknown> = {},
): never {
  throw new RuleError("INVALID_PROMOTION", "현재 등급은 승급할 수 없다", {
    rank: campaign.rank,
    ...details,
  });
}

export function getGuidePromotionEligibility(
  campaign: CampaignState,
): PromotionEligibility | null {
  const toRank = nextRank(campaign.rank);
  if (toRank === null) return null;

  const reputationRequired = PROMOTION_REPUTATION[toRank];
  const goldRequired = PROMOTION_GOLD[toRank];
  return {
    fromRank: campaign.rank,
    toRank,
    newlyUnlockedRiskLevel: RANK_RISK_LIMIT[toRank],
    reputationRequired,
    goldRequired,
    currentReputation: campaign.reputation,
    currentGold: campaign.gold,
    canPromoteByReputation: campaign.reputation >= reputationRequired,
    canPromoteByGold: campaign.gold >= goldRequired,
  };
}

export function openGuidePromotion(campaign: CampaignState): CampaignState {
  requirePhase(campaign, "board");
  if (getGuidePromotionEligibility(campaign) === null) {
    return invalidPromotion(campaign);
  }
  return { ...campaign, phase: "promotion" };
}

export function cancelGuidePromotion(campaign: CampaignState): CampaignState {
  requirePhase(campaign, "promotion");
  return { ...campaign, phase: "board" };
}

export function executeGuidePromotion(
  campaign: CampaignState,
  method: PromotionMethod,
): PromotionExecution {
  const eligibility = getGuidePromotionEligibility(campaign);
  if (eligibility === null) return invalidPromotion(campaign, { method });

  if (method === "reputation" && !eligibility.canPromoteByReputation) {
    return invalidPromotion(campaign, {
      method,
      required: eligibility.reputationRequired,
      actual: campaign.reputation,
    });
  }

  if (method === "gold" && !eligibility.canPromoteByGold) {
    throw new RuleError("INSUFFICIENT_GOLD", "골드 승급 비용이 부족하다", {
      rank: campaign.rank,
      method,
      required: eligibility.goldRequired,
      actual: campaign.gold,
    });
  }

  const goldAfter = method === "gold"
    ? campaign.gold - eligibility.goldRequired
    : campaign.gold;
  const result: PromotionResult = {
    fromRank: eligibility.fromRank,
    toRank: eligibility.toRank,
    method,
    reputationBefore: campaign.reputation,
    reputationAfter: campaign.reputation,
    goldBefore: campaign.gold,
    goldAfter,
    newlyUnlockedRiskLevel: eligibility.newlyUnlockedRiskLevel,
  };

  return {
    campaign: {
      ...campaign,
      rank: eligibility.toRank,
      gold: goldAfter,
    },
    result,
  };
}

export function promoteGuide(
  campaign: CampaignState,
  method: PromotionMethod,
): PromotionExecution {
  requirePhase(campaign, "promotion");
  const execution = executeGuidePromotion(campaign, method);
  return {
    ...execution,
    campaign: {
      ...execution.campaign,
      phase: "board",
      offers: [],
    },
  };
}
