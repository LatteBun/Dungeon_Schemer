import { describe, expect, it } from "vitest";
import {
  PROMOTION_GOLD,
  PROMOTION_REPUTATION,
  RuleError,
  type CampaignState,
  type GuideRank,
} from "@/lib/domain";
import { initializeCampaign } from "./campaign-init";
import {
  executeGuidePromotion,
  getGuidePromotionEligibility,
} from "./promotion";

function campaignState(overrides: Partial<CampaignState> = {}): CampaignState {
  return {
    ...initializeCampaign("c5-promotion"),
    phase: "promotion",
    ...overrides,
  };
}

function expectRuleError(action: () => unknown, code: string): void {
  expect(action).toThrowError(RuleError);
  try {
    action();
  } catch (error) {
    expect(error).toMatchObject({ code });
  }
}

describe("phase-free 길잡이 승급 계산", () => {
  it("다음 등급과 두 승급 경로의 조건을 독립적으로 반환한다", () => {
    expect(getGuidePromotionEligibility(campaignState({
      reputation: PROMOTION_REPUTATION.B,
      gold: PROMOTION_GOLD.B - 1,
    }))).toEqual({
      fromRank: "C",
      toRank: "B",
      newlyUnlockedRiskLevel: 3,
      reputationRequired: PROMOTION_REPUTATION.B,
      goldRequired: PROMOTION_GOLD.B,
      currentReputation: PROMOTION_REPUTATION.B,
      currentGold: PROMOTION_GOLD.B - 1,
      canPromoteByReputation: true,
      canPromoteByGold: false,
    });
  });

  it("S급은 다음 승급 정보가 없다", () => {
    expect(getGuidePromotionEligibility(campaignState({ rank: "S" }))).toBeNull();
  });

  it("명성 승급은 rank만 바꾸고 phase·공고·골드를 보존한다", () => {
    const campaign = campaignState({
      reputation: PROMOTION_REPUTATION.B,
      gold: 222,
      cumulativeGold: 777,
    });
    const before = structuredClone(campaign);
    const execution = executeGuidePromotion(campaign, "reputation");

    expect(execution.result).toEqual({
      fromRank: "C",
      toRank: "B",
      method: "reputation",
      reputationBefore: PROMOTION_REPUTATION.B,
      reputationAfter: PROMOTION_REPUTATION.B,
      goldBefore: 222,
      goldAfter: 222,
      newlyUnlockedRiskLevel: 3,
    });
    expect(execution.campaign).toMatchObject({
      phase: "promotion",
      rank: "B",
      reputation: PROMOTION_REPUTATION.B,
      gold: 222,
      cumulativeGold: 777,
      offers: campaign.offers,
    });
    expect(campaign).toEqual(before);
  });

  it("골드 승급은 현재 gold만 차감한다", () => {
    const execution = executeGuidePromotion(campaignState({
      reputation: 4,
      gold: PROMOTION_GOLD.B,
      cumulativeGold: 777,
    }), "gold");

    expect(execution.result).toMatchObject({
      method: "gold",
      goldBefore: PROMOTION_GOLD.B,
      goldAfter: 0,
      reputationBefore: 4,
      reputationAfter: 4,
    });
    expect(execution.campaign).toMatchObject({
      rank: "B", gold: 0, reputation: 4, cumulativeGold: 777,
    });
  });

  it("B급과 A급도 한 번에 다음 등급만 계산한다", () => {
    for (const [rank, reputation, expected] of [
      ["B", PROMOTION_REPUTATION.A, "A"],
      ["A", PROMOTION_REPUTATION.S, "S"],
    ] as const satisfies readonly [GuideRank, number, Exclude<GuideRank, "C">][]) {
      const execution = executeGuidePromotion(campaignState({ rank, reputation }), "reputation");
      expect(execution.result.toRank).toBe(expected);
      expect(execution.campaign.rank).toBe(expected);
    }
  });

  it("phase와 무관하게 계산하고 잘못된 조건을 거부한다", () => {
    for (const phase of ["intro", "board", "expedition", "ended"] as const) {
      expect(executeGuidePromotion(campaignState({
        phase, reputation: PROMOTION_REPUTATION.B,
      }), "reputation").campaign.phase).toBe(phase);
    }
    expectRuleError(() => executeGuidePromotion(
      campaignState({ reputation: PROMOTION_REPUTATION.B - 1 }), "reputation",
    ), "INVALID_PROMOTION");
    expectRuleError(() => executeGuidePromotion(
      campaignState({ gold: PROMOTION_GOLD.B - 1 }), "gold",
    ), "INSUFFICIENT_GOLD");
    expectRuleError(() => executeGuidePromotion(
      campaignState({ rank: "S" }), "gold",
    ), "INVALID_PROMOTION");
  });
});

