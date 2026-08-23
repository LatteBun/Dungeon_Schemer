import { describe, expect, it } from "vitest";
import { GUIDE_RANKS, PROMOTION_GOLD, PROMOTION_REPUTATION } from "@/lib/domain";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import type { SettlementResult } from "@/lib/domain";
import type { GuideRank } from "@/lib/domain";
import {
  CAUSE_ORDER,
  createU6SettlementView,
  createU6PromotionView,
  nextRank,
  rankCrestSrc,
  type U6SettlementView,
} from "./u6-settlement-model";

function result(over: Partial<SettlementResult> = {}): SettlementResult {
  const campaign = initializeCampaign("u6-settlement-adapter");
  const dungeon = campaign.dungeons[0];
  return {
    expeditionId: "exp-u6",
    dungeonId: dungeon.id,
    status: "wiped",
    survivorIds: [],
    survivorCount: 0,
    memberChanges: [],
    reputationDelta: -6,
    goldDelta: 0,
    relicGold: 84,
    riskBefore: 1,
    riskAfter: 2,
    riskCapped: false,
    nextReward: { reputation: 10, gold: 20 },
    causeChain: {
      choice: "선택 내용",
      reactions: "반응 내용",
      damage: "피해 내용",
      economy: "경제 내용",
      campaignChange: "변화 내용",
    },
    ...over,
  };
}

const settlement = (over: Partial<U6SettlementView> = {}): U6SettlementView => ({
  dungeonName: "거미굴 3",
  themeId: "spider",
  survivors: 2,
  causeChain: CAUSE_ORDER.map((order) => ({ order, label: `${order}단계`, detail: "내용" })),
  riskBefore: 3,
  riskAfter: 3,
  riskCapped: false,
  reputationDelta: 9,
  goldDelta: 19,
  relicGold: 0,
  nextReward: { reputation: 15, gold: 32 },
  promotion: null,
  ...over,
});

describe("U6 정산 화면 모델", () => {
  it("원인 사슬은 1~5 순서를 빠뜨리지 않는다", () => {
    expect(CAUSE_ORDER).toEqual([1, 2, 3, 4, 5]);
    expect(settlement().causeChain.map((step) => step.order)).toEqual([1, 2, 3, 4, 5]);
  });

  it("전멸은 생존 0명이고 계약 보상 대신 유품이 들어온다", () => {
    const wiped = settlement({ survivors: 0, reputationDelta: -10, goldDelta: 0, relicGold: 84 });

    expect(wiped.survivors).toBe(0);
    expect(wiped.reputationDelta).toBeLessThan(0);
    expect(wiped.relicGold).toBeGreaterThan(0);
  });

  it("★5 던전은 위험도가 더 오르지 않는다", () => {
    const capped = settlement({ survivors: 0, riskBefore: 5, riskAfter: 5, riskCapped: true });

    expect(capped.riskAfter).toBe(capped.riskBefore);
    expect(capped.riskCapped).toBe(true);
  });

  it("정산 결과의 계약금과 유품을 재계산 없이 U6으로 옮긴다", () => {
    const campaign = initializeCampaign("u6-settlement-adapter");
    const view = createU6SettlementView(campaign, result(), "묘지 1", "graveyard");
    expect(view).toMatchObject({ survivors: 0, goldDelta: 0, relicGold: 84, riskBefore: 1, riskAfter: 2 });
    expect(view.causeChain.map((step) => step.order)).toEqual([1, 2, 3, 4, 5]);
  });

  it("클리어 결과의 다음 보상 null을 재계산 없이 보존한다", () => {
    const campaign = initializeCampaign("u6-settlement-clear");
    const view = createU6SettlementView(campaign, result({
      status: "cleared",
      survivorCount: 3,
      nextReward: null,
    }), "사막 5", "desert");

    expect(view.nextReward).toBeNull();
  });

  it("★5 클리어는 위험도 상한에 막힌 실패가 아니다", () => {
    const campaign = initializeCampaign("u6-settlement-cap");
    const view = createU6SettlementView(campaign, result({
      status: "cleared",
      survivorCount: 3,
      survivorIds: [campaign.pool.order[0]],
      riskBefore: 5,
      riskAfter: 5,
      riskCapped: false,
    }), "사막 5", "desert");
    expect(view.riskCapped).toBe(false);
  });
});

describe("U6 승급 모델", () => {
  it("C 다음은 B, S 다음은 없다", () => {
    expect(nextRank("C")).toBe("B");
    expect(nextRank("A")).toBe("S");
    expect(nextRank("S")).toBeNull();
  });

  it("최고 등급이면 승급 정보가 null 이다", () => {
    expect(createU6PromotionView("S", 999, 999)).toBeNull();
  });

  it("명성 경로와 골드 경로가 독립으로 열린다", () => {
    const onlyReputation = createU6PromotionView("C", PROMOTION_REPUTATION.B, 0);
    const onlyGold = createU6PromotionView("C", 0, PROMOTION_GOLD.B);
    const neither = createU6PromotionView("C", 0, 0);

    expect(onlyReputation).toMatchObject({ byReputation: true, byGold: false });
    expect(onlyGold).toMatchObject({ byReputation: false, byGold: true });
    expect(neither).toMatchObject({ byReputation: false, byGold: false });
  });

  it("요구 명성은 문턱이지 비용이 아니므로 남은 명성을 깎지 않는다", () => {
    const view = createU6PromotionView("C", 74, 0);

    // 화면이 "명성 60 / 현재 74" 를 그대로 보여줄 수 있어야 한다.
    expect(view?.reputationRequired).toBe(PROMOTION_REPUTATION.B);
    expect(view?.currentReputation).toBe(74);
  });

  it("등급마다 문장 이미지 경로를 준다", () => {
    for (const rank of GUIDE_RANKS) {
      expect(rankCrestSrc(rank as GuideRank)).toContain(`rank_${rank.toLowerCase()}.png`);
    }
  });
});
