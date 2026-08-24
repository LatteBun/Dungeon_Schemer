import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { U6SettlementScreen } from "./U6SettlementScreen";
import { CAUSE_ORDER, type U6SettlementView } from "./u6-settlement-model";
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
  members: [],
  reputationDelta: 9,
  goldDelta: 19,
  relicGold: 0,
  nextReward: { reputation: 15, gold: 32 },
  ...over,
});

const render = (over: Partial<U6SettlementView> = {}) =>
  renderToStaticMarkup(
    createElement(U6SettlementScreen, { status, settlement: view(over) }),
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

  /*
   * 이 값은 전멸했을 때만 나오고, 그 던전을 다시 맡을 때의 보상이다.
   *
   * 「다음 계약 보상」이라고만 적으면 게시판의 다음 공고가 이미 정해진 것처럼
   * 읽힌다. 무엇에 대한 값인지를 문구가 말해야 한다.
   */
  it("전멸에서만 재도전 보상을 보여준다", () => {
    expect(render({ nextReward: null })).not.toContain("다시 맡으면");
    expect(render({ survivors: 0 })).toContain("이 던전을 다시 맡으면");
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

  it("정산에는 승급 제어가 없다", () => {
    const html = render();

    expect(html).not.toContain("명성으로 승급하기");
    expect(html).not.toContain("골드로 승급하기");
    expect(html).not.toContain('data-testid="u6-promotion"');
    expect(html).toContain("캠페인 변화");
  });
});

describe("다녀온 사람", () => {
  const member = (over: Record<string, unknown> = {}) => ({
    id: "character-1",
    name: "실바나",
    classLabel: "마법사",
    portraitSrc: "/assets/characters/live/mage/mage_a.png",
    alive: true,
    hp: { before: 24, after: 16, max: 24 },
    trust: { before: 53, after: 35 },
    ...over,
  });

  /* 정산은 사람에 대한 셈인데 숫자만 있고 사람이 없었다. */
  it("돌아온 사람과 못 돌아온 사람을 함께 적는다", () => {
    const html = render({
      members: [
        member(),
        member({ id: "character-2", name: "오스왈드", alive: false, hp: { before: 28, after: 0, max: 28 } }),
      ],
    });

    expect(html).toContain("실바나");
    expect(html).toContain("HP 16 / 24");
    expect(html).toContain("오스왈드");
    expect(html).toContain("돌아오지 못했다");
  });

  /* 달라지지 않은 신뢰는 적지 않는다. 줄이 늘면 달라진 것이 묻힌다. */
  it("신뢰가 그대로면 적지 않는다", () => {
    const html = render({ members: [member({ trust: { before: 40, after: 40 } })] });

    expect(html).not.toContain("신뢰 40");
  });

  it("사람이 없으면 칸을 두지 않는다", () => {
    expect(render({ members: [] })).not.toContain("다녀온 사람");
  });
});

describe("정산 인주", () => {
  /* 붉은 인주 한 장뿐이라 색을 돌린다. 문서를 읽기 전에 색으로 먼저 안다. */
  it("생존 인원에 따라 인주 색이 갈린다", () => {
    const seal = (html: string) => html.match(/u6-changes__seal is-(\w+)/)?.[1];

    expect(seal(render({ survivors: 3 }))).toBe("whole");
    expect(seal(render({ survivors: 2 }))).toBe("costly");
    expect(seal(render({ survivors: 0 }))).toBe("lost");
  });
});

describe("끝난 던전", () => {
  /*
   * 클리어한 던전에는 위험도를 적지 않는다.
   *
   * 그 던전은 끝났고 다시 들어갈 수 없다. 「위험도가 그대로다」는 다시 갈 수
   * 있을 때만 뜻이 있는 말이다.
   */
  it("클리어하면 위험도 대신 끝났다고 적는다", () => {
    const html = render({ survivors: 2, riskBefore: 2, riskAfter: 2 });

    expect(html).toContain("정복");
    expect(html).toContain("다시 들어갈 일이 없다");
    expect(html).not.toContain("위험도가 그대로다");
  });

  it("전멸하면 위험도 변화를 적는다", () => {
    const html = render({ survivors: 0, riskBefore: 2, riskAfter: 3 });

    expect(html).toContain("실패로 위험도가 올랐다");
    expect(html).not.toContain("다시 들어갈 일이 없다");
  });
});

describe("피해 칸의 색", () => {
  /* 인주와 같은 색이라 한 화면에서 두 표시가 같은 말을 한다. */
  it("피해 문양이 인주와 같은 색을 탄다", () => {
    const tone = (html: string, klass: string) =>
      html.match(new RegExp(`${klass} is-(\\w+)`))?.[1];

    for (const survivors of [3, 2, 0] as const) {
      const html = render({ survivors });
      expect(tone(html, "u6-cause__order")).toBe(tone(html, "u6-changes__seal"));
    }
  });
});
