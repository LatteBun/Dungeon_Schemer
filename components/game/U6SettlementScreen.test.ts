import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { U6SettlementScreen } from "./U6SettlementScreen";
import { CAUSE_ORDER, createU6PromotionView, type U6SettlementView } from "./u6-settlement-model";
import type { TopStatusView } from "./TopStatusBar";

const status: TopStatusView = {
  rank: "C",
  reputation: 74,
  gold: 186,
  canPromote: true,
  remainingDungeons: 11,
};

const LABELS = ["선택", "개인 반응", "피해", "보상·손실", "캠페인 변화"] as const;

const view = (over: Partial<U6SettlementView> = {}): U6SettlementView => ({
  dungeonName: "거미굴 3",
  themeId: "spider",
  survivors: 2,
  causeChain: CAUSE_ORDER.map((order, index) => ({
    order,
    label: LABELS[index],
    detail: `${LABELS[index]} 내용`,
  })),
  riskBefore: 3,
  riskAfter: 3,
  riskCapped: false,
  reputationDelta: 9,
  goldDelta: 19,
  relicGold: 0,
  nextReward: { reputation: 15, gold: 32 },
  promotion: createU6PromotionView("C", 74, 186),
  ...over,
});

const render = (over: Partial<U6SettlementView> = {}) =>
  renderToStaticMarkup(
    createElement(U6SettlementScreen, { status, settlement: view(over), onPromote: () => {} }),
  );

describe("U6SettlementScreen", () => {
  it("원인 사슬을 번호와 함께 순서대로 보여준다", () => {
    const html = render();

    for (const [index, label] of LABELS.entries()) {
      expect(html).toContain(label);
      expect(html).toContain(`>${index + 1}<`);
    }
    expect(html).toContain('data-testid="u6-cause-chain"');
  });

  it("전멸이면 계약 보상 없음과 유품 회수를 문구로 밝힌다", () => {
    const html = render({ survivors: 0, reputationDelta: -10, goldDelta: 0, relicGold: 84 });

    expect(html).toContain("전멸");
    expect(html).toContain("계약 보상 없음");
    expect(html).toContain("유품");
  });

  it("전멸 명성 손실이 계약 시점 위험도를 쓴다는 것을 밝힌다", () => {
    const html = render({ survivors: 0, riskBefore: 2, riskAfter: 3, reputationDelta: -10 });

    expect(html).toContain("계약 시점");
  });

  it("클리어에서는 다음 계약 보상을 표시하지 않는다", () => {
    expect(render({ nextReward: null })).not.toContain("다음 계약 보상");
    expect(render({ survivors: 0 })).toContain("다음 계약 보상");
  });

  it("위험도 변화를 전후로 함께 보여준다", () => {
    const html = render({ survivors: 0, riskBefore: 2, riskAfter: 3 });

    expect(html).toContain('data-testid="u6-risk-change"');
    expect(html).toContain("★2");
    expect(html).toContain("★3");
  });

  it("★5 상한이면 오르지 않았음을 밝힌다", () => {
    const html = render({ survivors: 0, riskBefore: 5, riskAfter: 5, riskCapped: true });

    expect(html).toContain("더 오르지 않");
  });

  it("승급 두 경로를 나란히 보여준다", () => {
    const html = render();

    expect(html).toContain("명성 승급");
    expect(html).toContain("골드 승급");
    expect(html).toContain('data-testid="u6-promotion"');
  });

  it("두 경로 모두 미달이면 무엇이 모자란지 적고 버튼을 잠근다", () => {
    const html = render({ promotion: createU6PromotionView("C", 10, 20) });

    expect(html).toContain("명성 50 부족");
    expect(html).toContain("골드 130 부족");
    expect(html).toMatch(/disabled=""/);
  });

  it("최고 등급이면 승급 영역을 두지 않는다", () => {
    const html = render({ promotion: null });

    expect(html).not.toContain('data-testid="u6-promotion"');
    expect(html).toContain("최고 등급");
  });
});
