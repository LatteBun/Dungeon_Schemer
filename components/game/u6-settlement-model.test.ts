import { describe, expect, it } from "vitest";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import type { SettlementResult } from "@/lib/domain";
import {
  CAUSE_ORDER,
  createU6SettlementView,
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
  members: [],
  reputationDelta: 9,
  goldDelta: 19,
  relicGold: 0,
  nextReward: { reputation: 15, gold: 32 },
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
    const view = createU6SettlementView(result(), "묘지 1", "graveyard");
    expect(view).toMatchObject({ survivors: 0, goldDelta: 0, relicGold: 84, riskBefore: 1, riskAfter: 2 });
    expect(view.causeChain.map((step) => step.order)).toEqual([1, 2, 3, 4, 5]);
  });

  it("클리어 결과의 다음 보상 null을 재계산 없이 보존한다", () => {
    const view = createU6SettlementView(result({
      status: "cleared",
      survivorCount: 3,
      nextReward: null,
    }), "사막 5", "desert");

    expect(view.nextReward).toBeNull();
  });

  it("★5 클리어는 위험도 상한에 막힌 실패가 아니다", () => {
    const campaign = initializeCampaign("u6-settlement-cap");
    const view = createU6SettlementView(result({
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
