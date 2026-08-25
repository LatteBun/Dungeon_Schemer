import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { U6SettlementScreen } from "./U6SettlementScreen";
import type { U6SettlementMember, U6SettlementView } from "./u6-settlement-model";
import type { TopStatusView } from "./TopStatusBar";

const status: TopStatusView = {
  rank: "C",
  reputation: 74,
  gold: 186,
  canPromote: true,
  remainingDungeons: 11,
};

const member = (over: Partial<U6SettlementMember> = {}): U6SettlementMember => ({
  id: "character-1",
  name: "실바나",
  classLabel: "마법사",
  portraitSrc: "/assets/characters/live/mage/mage_a.png",
  alive: true,
  diedThisExpedition: false,
  gravelyWounded: false,
  hp: { before: 24, after: 16, max: 24 },
  trust: {
    before: 53,
    after: 35,
    changed: true,
    isZero: false,
    becameZero: false,
    countsTowardCampaign: false,
  },
  ...over,
});

const BASE_MEMBERS: readonly U6SettlementMember[] = [
  member(),
  member({ id: "character-2", name: "카일" }),
  member({
    id: "character-3",
    name: "오스왈드",
    alive: false,
    diedThisExpedition: true,
    hp: { before: 28, after: 0, max: 28 },
  }),
];

const view = (over: Partial<U6SettlementView> = {}): U6SettlementView => ({
  dungeonName: "거미굴 3",
  themeId: "spider",
  outcome: {
    kind: "cleared",
    title: "거미굴 3 정복",
    summary: "2명 귀환 · 오스왈드 사망",
  },
  causes: [
    { kind: "choice", label: "마지막 조언", detail: "수상한 표식 두 건만 믿으라고 했다" },
    { kind: "reactions", label: "파티의 판단", detail: "실바나 수용 · 오스왈드 의심" },
  ],
  dungeonOutcome: { kind: "cleared" },
  members: BASE_MEMBERS,
  reputationDelta: 9,
  goldDelta: 19,
  relicGold: 0,
  nextReward: null,
  trustPressure: null,
  ...over,
});

const render = (over: Partial<U6SettlementView> = {}) =>
  renderToStaticMarkup(
    createElement(U6SettlementScreen, { status, settlement: view(over) }),
  );

describe("U6SettlementScreen", () => {
  it("클리어는 정복과 사망자를 말하고 위험도 유지를 말하지 않는다", () => {
    const html = render();

    expect(html).toContain("거미굴 3 정복");
    expect(html).toContain("2명 귀환 · 오스왈드 사망");
    expect(html).toContain("게시판에서 제거됨");
    expect(html).not.toContain("위험도 유지");
    expect(html).not.toContain("생존 인원 비율만큼");
  });

  it("선택과 파티 판단만 원인으로 요약한다", () => {
    const html = render();

    expect(html).toContain("마지막 조언");
    expect(html).toContain("수상한 표식 두 건만 믿으라고 했다");
    expect(html).toContain("파티의 판단");
    expect(html).toContain("실바나 수용 · 오스왈드 의심");
    expect(html).not.toContain("보상·손실");
  });

  it("살아 있는 신뢰 0은 변화가 없어도 정체 발각과 출전 불가를 보여준다", () => {
    const html = render({
      members: [
        member({
          trust: {
            before: 0,
            after: 0,
            changed: false,
            isZero: true,
            becameZero: false,
            countsTowardCampaign: true,
          },
        }),
        ...BASE_MEMBERS.slice(1),
      ],
      trustPressure: {
        beforeCount: 1,
        afterCount: 1,
        threshold: 5,
        acceptModifier: 0,
        exposeModifier: 0,
        reachedThreshold: false,
      },
    });

    expect(html).toContain("신뢰 0");
    expect(html).toContain("정체 발각");
    expect(html).toContain("원정 출전 불가");
    expect(html).toContain("1 / 5");
  });

  it("사망자는 마지막 신뢰를 남기되 누적 원인으로 표시하지 않는다", () => {
    const html = render({
      members: [
        member({
          alive: false,
          diedThisExpedition: true,
          hp: { before: 24, after: 0, max: 24 },
          trust: {
            before: 8,
            after: 0,
            changed: true,
            isZero: true,
            becameZero: true,
            countsTowardCampaign: false,
          },
        }),
        ...BASE_MEMBERS.slice(1),
      ],
    });

    expect(html).toContain("사망 · HP 24 → 0");
    expect(html).toContain("마지막 신뢰 8 → 0");
    expect(html).not.toContain("이후 원정 출전 불가");
  });

  it("전멸은 계약 보상과 유품 골드를 분리한다", () => {
    const html = render({
      outcome: { kind: "wiped", title: "원정대 전멸", summary: "3명 전원 사망 · 계약 실패" },
      dungeonOutcome: { kind: "riskIncreased", before: 2, after: 3 },
      reputationDelta: -10,
      goldDelta: 0,
      relicGold: 84,
      nextReward: { reputation: 15, gold: 32 },
    });

    expect(html).toContain("계약 보상");
    expect(html).toContain("없음");
    expect(html).toContain("유품 골드");
    expect(html).toContain("+84");
    expect(html).toContain("★2");
    expect(html).toContain("★3");
  });

  it("정산에는 승급 제어가 없다", () => {
    const html = render();

    expect(html).not.toContain("명성으로 승급하기");
    expect(html).not.toContain("골드로 승급하기");
    expect(html).not.toContain('data-testid="u6-promotion"');
    expect(html).toContain("캠페인 변화");
  });
});
