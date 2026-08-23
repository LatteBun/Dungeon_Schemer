import { describe, expect, it } from "vitest";
import { createBoardOffers } from "@/lib/rules/board";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import {
  GOLD_START,
  PROMOTION_GOLD,
  PROMOTION_REPUTATION,
  RuleError,
  type CampaignState,
  type GuideRank,
} from "@/lib/domain";
import {
  cancelGuidePromotion,
  executeGuidePromotion,
  getGuidePromotionEligibility,
  openGuidePromotion,
  promoteGuide,
} from "./promotion";

function boardState(overrides: Partial<CampaignState> = {}): CampaignState {
  return {
    ...initializeCampaign("c5-promotion"),
    phase: "board",
    ...overrides,
  };
}

function open(overrides: Partial<CampaignState> = {}): CampaignState {
  return openGuidePromotion(boardState(overrides));
}

function expectRuleError(action: () => unknown, code: string): void {
  expect(action).toThrowError(RuleError);
  try {
    action();
  } catch (error) {
    expect(error).toMatchObject({ code });
  }
}

describe("길잡이 승급 조회", () => {
  it("C급은 다음 등급과 두 경로의 현재 조건을 독립적으로 반환한다", () => {
    const eligibility = getGuidePromotionEligibility(
      boardState({ reputation: PROMOTION_REPUTATION.B, gold: PROMOTION_GOLD.B - 1 }),
    );

    expect(eligibility).toEqual({
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

  it("S급은 더 이상 승급 선택 정보를 만들지 않는다", () => {
    expect(getGuidePromotionEligibility(boardState({ rank: "S" }))).toBeNull();
  });
});

describe("길잡이 승급 상태 전이", () => {
  it("phase-free 승급 계산은 phase와 현재 공고를 바꾸지 않는다", () => {
    const base = boardState({ reputation: PROMOTION_REPUTATION.B });
    const campaign = {
      ...base,
      phase: "promotion" as const,
      offers: createBoardOffers(base),
    };
    const before = structuredClone(campaign);

    const execution = executeGuidePromotion(campaign, "reputation");

    expect(execution.campaign).toMatchObject({
      phase: "promotion",
      rank: "B",
      offers: campaign.offers,
      reputation: PROMOTION_REPUTATION.B,
      gold: campaign.gold,
      cumulativeGold: campaign.cumulativeGold,
    });
    expect(campaign).toEqual(before);
  });

  it("phase-free 승급 계산은 어떤 phase도 직접 바꾸지 않는다", () => {
    for (const phase of ["board", "expedition", "ended"] as const) {
      const campaign = boardState({ phase, reputation: PROMOTION_REPUTATION.B });
      expect(executeGuidePromotion(campaign, "reputation").campaign.phase).toBe(phase);
    }
  });

  it("게시판에서 승급 선택 화면을 열고 취소하면 상태를 되돌린다", () => {
    const board = boardState({ reputation: PROMOTION_REPUTATION.B });
    const opened = openGuidePromotion(board);

    expect(opened).toMatchObject({ phase: "promotion", rank: "C", reputation: PROMOTION_REPUTATION.B, gold: GOLD_START });
    expect(cancelGuidePromotion(opened)).toEqual(board);
  });

  it("명성 방식은 정확히 한 단계 올리고 자원을 소비하지 않는다", () => {
    const board = open({ reputation: PROMOTION_REPUTATION.B, gold: 222, cumulativeGold: 777 });
    const execution = promoteGuide(board, "reputation");

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
      phase: "board",
      rank: "B",
      reputation: PROMOTION_REPUTATION.B,
      gold: 222,
      cumulativeGold: 777,
      offers: [],
    });
  });

  it("골드 방식은 현재 골드만 정확히 차감한다", () => {
    const board = open({ reputation: 4, gold: PROMOTION_GOLD.B, cumulativeGold: 777 });
    const execution = promoteGuide(board, "gold");

    expect(execution.result).toMatchObject({
      method: "gold",
      goldBefore: PROMOTION_GOLD.B,
      goldAfter: 0,
      reputationBefore: 4,
      reputationAfter: 4,
    });
    expect(execution.campaign).toMatchObject({ rank: "B", gold: 0, reputation: 4, cumulativeGold: 777 });
  });

  it("B급과 A급도 한 번에 다음 등급만 해금한다", () => {
    for (const [rank, reputation, expected] of [
      ["B", PROMOTION_REPUTATION.A, "A"],
      ["A", PROMOTION_REPUTATION.S, "S"],
    ] as const satisfies readonly [GuideRank, number, Exclude<GuideRank, "C">][]) {
      const execution = promoteGuide(open({ rank, reputation }), "reputation");
      expect(execution.result.toRank).toBe(expected);
      expect(execution.campaign.rank).toBe(expected);
    }
  });

  it("성공·실패 모두 입력 상태를 변경하지 않는다", () => {
    const board = open({ reputation: PROMOTION_REPUTATION.B });
    const before = structuredClone(board);

    promoteGuide(board, "reputation");

    expect(board).toEqual(before);
  });
});

describe("길잡이 승급 오류", () => {
  it("승급 조건은 문턱과 같을 때만 충족한다", () => {
    const reputationShort = open({ reputation: PROMOTION_REPUTATION.B - 1 });
    const goldShort = open({ gold: PROMOTION_GOLD.B - 1 });

    expectRuleError(() => promoteGuide(reputationShort, "reputation"), "INVALID_PROMOTION");
    expectRuleError(() => promoteGuide(goldShort, "gold"), "INSUFFICIENT_GOLD");
  });

  it("S급은 열기와 확인을 모두 거부한다", () => {
    expectRuleError(() => openGuidePromotion(boardState({ rank: "S" })), "INVALID_PROMOTION");
    expectRuleError(() => promoteGuide({ ...boardState({ rank: "S" }), phase: "promotion" }, "gold"), "INVALID_PROMOTION");
  });

  it("허용되지 않은 캠페인 단계의 열기·취소·확인을 거부한다", () => {
    const intro = boardState({ phase: "intro" });
    const board = boardState();

    expectRuleError(() => openGuidePromotion(intro), "INVALID_STATE");
    expectRuleError(() => cancelGuidePromotion(board), "INVALID_STATE");
    expectRuleError(() => promoteGuide(board, "reputation"), "INVALID_STATE");
  });

  it("새 등급으로 게시판을 다시 만들면 위험도 제한이 반영된다", () => {
    const board = open({ reputation: PROMOTION_REPUTATION.B });
    const execution = promoteGuide(board, "reputation");
    const offers = createBoardOffers(execution.campaign);

    expect(offers.some((offer) => offer.riskLevel === 3 && offer.lockReason === null)).toBe(true);
  });
});
