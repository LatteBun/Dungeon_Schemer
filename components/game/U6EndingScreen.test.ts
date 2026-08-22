import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { U6EndingScreen } from "./U6EndingScreen";
import type { U6EndingView } from "./u6-ending-model";
import type { TopStatusView } from "./TopStatusBar";

const status: TopStatusView = {
  rank: "A",
  reputation: 205,
  gold: 331,
  canPromote: false,
  remainingDungeons: 0,
};

const view = (over: Partial<U6EndingView> = {}): U6EndingView => ({
  kind: "completed",
  reason: "던전 15개를 모두 클리어했다",
  finalRank: "A",
  survivedCount: 9,
  diedCount: 6,
  zeroTrustCount: 2,
  finalReputation: 205,
  cumulativeGold: 449,
  expeditionCount: 15,
  adviceStats: [
    { label: "정직한 조언", given: 21, caught: 0 },
    { label: "감춘 조언", given: 14, caught: 3 },
  ],
  turningPoint: { label: "거미굴 5 전멸", detail: "★4 로 오른 뒤 보상이 함께 올랐다" },
  chronicle: Array.from({ length: 15 }, (_, index) => ({
    worldTurn: index + 1,
    dungeonName: `던전 ${index + 1}`,
    outcome: index % 4 === 3 ? "전멸" : "3명 생존",
  })),
  ...over,
});

const render = (over: Partial<U6EndingView> = {}) =>
  renderToStaticMarkup(createElement(U6EndingScreen, { status, ending: view(over) }));

describe("U6EndingScreen", () => {
  it("엔딩 종류와 판정 근거를 함께 보여준다", () => {
    const html = render({ kind: "distrust", reason: "생존자 전원의 신뢰가 0" });

    expect(html).toContain("불신의 대가");
    expect(html).toContain("생존자 전원의 신뢰가 0");
    expect(html).toContain('data-testid="u6-ending-verdict"');
  });

  it("최종 등급을 문장 이미지와 문구로 함께 보여준다", () => {
    const html = render({ finalRank: "S" });

    expect(html).toContain("rank_s.png");
    expect(html).toContain("최종 등급");
    expect(html).toContain(">S<");
  });

  it("정상 완주와 조기 종료를 색이 아니라 문구로 구분한다", () => {
    expect(render({ kind: "completed" })).toContain("정상 완주");
    expect(render({ kind: "unemployed", reason: "모든 공고가 진입 불가" })).toContain("조기 종료");
  });

  it("누적 통계와 전환점과 연대기를 함께 보여준다", () => {
    const html = render();

    expect(html).toContain('data-testid="u6-stats"');
    expect(html).toContain('data-testid="u6-turning-point"');
    expect(html).toContain('data-testid="u6-chronicle"');
    expect(html).toContain("정직한 조언");
    expect(html).toContain("거미굴 5 전멸");
  });

  it("연대기는 원정을 하나도 빠뜨리지 않는다", () => {
    const html = render();

    for (let turn = 1; turn <= 15; turn += 1) {
      expect(html).toContain(`던전 ${turn}<`);
    }
  });

  it("전환점이 없으면 그 자리를 비우지 않고 없다고 적는다", () => {
    const html = render({ turningPoint: null });

    expect(html).toContain('data-testid="u6-turning-point"');
    expect(html).toContain("전환점이라 부를 만한");
  });
});
