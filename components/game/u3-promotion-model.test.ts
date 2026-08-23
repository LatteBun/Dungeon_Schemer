import { describe, expect, it } from "vitest";
import type {
  PromotionEligibility,
  PromotionResult,
} from "@/lib/domain";
import { createU3PromotionView } from "./u3-promotion-model";

const eligibility: PromotionEligibility = {
  fromRank: "C",
  toRank: "B",
  newlyUnlockedRiskLevel: 3,
  reputationRequired: 60,
  goldRequired: 150,
  currentReputation: 60,
  currentGold: 120,
  canPromoteByReputation: true,
  canPromoteByGold: false,
};

const result: PromotionResult = {
  fromRank: "C",
  toRank: "B",
  method: "reputation",
  reputationBefore: 60,
  reputationAfter: 60,
  goldBefore: 120,
  goldAfter: 120,
  newlyUnlockedRiskLevel: 3,
};

describe("U3 승급 모델", () => {
  it("C5 eligibility와 promotion phase를 화면 모델에 그대로 보존한다", () => {
    expect(createU3PromotionView(eligibility, "promotion", null)).toEqual({
      eligibility,
      isOpen: true,
      result: null,
    });
  });

  it("결과 화면은 PromotionResult를 그대로 소비한다", () => {
    expect(createU3PromotionView(eligibility, "board", result)).toEqual({
      eligibility,
      isOpen: false,
      result,
    });
  });

  it("S급 null eligibility는 승급 overlay를 열지 않는다", () => {
    expect(createU3PromotionView(null, "board", null)).toEqual({
      eligibility: null,
      isOpen: false,
      result: null,
    });
  });
});
