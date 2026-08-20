import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IntroScreen } from "./IntroScreen";

const status = {
  rank: "C",
  reputation: 30,
  gold: 10,
  canPromote: false,
  remainingDungeons: 15,
  nextPromotion: { rank: "B", reputationRequired: 60 },
};

describe("IntroScreen", () => {
  it("인트로 전용 전체 폭 스테이지에서 역할·수단·목표를 전달한다", () => {
    const html = renderToStaticMarkup(
      createElement(IntroScreen, { status, onEnterBoard: () => undefined }),
    );

    expect(html).toContain('class="u2-intro-stage"');
    expect(html).toContain("길잡이의 첫 기록");
    expect(html).toContain("던전은 검보다 먼저 말을 건넨다");
    expect(html).toContain("내 역할");
    expect(html).toContain("내 수단");
    expect(html).toContain("나의 목표");
    expect(html).toContain("열다섯 던전");
    expect(html).toContain("S급 길잡이");
    expect(html).toContain("길드 게시판으로");
  });

  it("캠페인 시작 라벨과 우측 40% 패널을 렌더링하지 않는다", () => {
    const html = renderToStaticMarkup(
      createElement(IntroScreen, { status, onEnterBoard: () => undefined }),
    );

    expect(html).not.toContain("캠페인 시작");
    expect(html).not.toContain('data-testid="game-shell-right-panel"');
    expect(html).toContain("/assets/u2/intro-contract.svg");
  });
});
