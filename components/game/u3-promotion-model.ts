import type {
  CampaignPhase,
  PromotionEligibility,
  PromotionResult,
} from "@/lib/domain";

export interface U3PromotionView {
  eligibility: PromotionEligibility | null;
  result: PromotionResult | null;
  isOpen: boolean;
}

export function createU3PromotionView(
  eligibility: PromotionEligibility | null,
  phase: CampaignPhase,
  result: PromotionResult | null,
): U3PromotionView {
  return {
    eligibility,
    isOpen: phase === "promotion",
    result,
  };
}
