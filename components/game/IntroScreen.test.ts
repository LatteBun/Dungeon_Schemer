import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DENOUNCE_THRESHOLD } from "@/lib/domain";
import { IntroScreen } from "./IntroScreen";

const status = {
  rank: "C",
  reputation: 30,
  gold: 10,
  canPromote: false,
  remainingAdventurers: 12,
  remainingDungeons: 15,
  zeroTrust: { livingCount: 0, threshold: DENOUNCE_THRESHOLD },
  nextPromotion: { rank: "B", reputationRequired: 60 },
};

const css = readFileSync("app/u2-intro.css", "utf8");

describe("IntroScreen", () => {
  it("인트로 전용 전체 폭 스테이지에서 정적 전략 가이드를 전달한다", () => {
    const html = renderToStaticMarkup(
      createElement(IntroScreen, { status, boardHref: "/u1-test?screen=board" }),
    );
    const introHtml = html.slice(html.indexOf('data-testid="u2-intro"'));

    expect(html).toContain('class="u2-intro-stage"');
    expect(introHtml).toContain("당신은 용사들을 던전으로 안내하는 고블린 길잡이입니다.");
    expect(introHtml).toContain("직접 싸우지 않습니다. 길을 읽고, 어떤 조언을 건넬지 결정하십시오.");
    expect(introHtml).toContain("용사를 돕는다");
    expect(introHtml).toContain("안전 · 꾸준한 보상");
    expect(introHtml).toContain("용사를 배신한다");
    expect(introHtml).toContain("위험 · 막대한 보상");
    expect(introHtml).toContain("명성으로 인정받아 정식 승급");
    expect(introHtml).toContain("골드로 뒷거래 승급");
    expect(introHtml).toContain("C → B → A → S");
    expect(introHtml).toContain("높은 등급일수록 더 위험한 던전에 입장할 수 있습니다.");
    expect(introHtml).toContain("15개의 던전을 돌파하십시오.");
    expect(introHtml).toContain("최고의 목표는 S급 길잡이");
    expect(introHtml).toContain("길잡이에게도 끝은 찾아옵니다");
    expect(html).toContain("길드 게시판으로");
    expect(html).toContain("<a class=\"u2-intro__cta\" href=\"/u1-test?screen=board\">");
    expect(html).not.toContain('<button class="u2-intro__cta"');
    expect(introHtml).not.toContain("신뢰 0 생존자 5명");
    expect(introHtml).not.toContain("서로 다른 직업 3명");
    expect(introHtml).not.toContain("60 / 120 / 200");
    expect(introHtml).not.toContain("150G / 320G / 600G");
  });

  it("도움과 배신을 비상호작용 strategy article로 렌더링한다", () => {
    const html = renderToStaticMarkup(
      createElement(IntroScreen, { status, boardHref: "/u1-test?screen=board" }),
    );

    expect(html).toContain('<section class="u2-intro__strategy" aria-labelledby="u2-strategy-title">');
    expect(html).toContain('<article class="u2-intro__strategy-card u2-intro__strategy-card--help">');
    expect(html).toContain('<article class="u2-intro__strategy-card u2-intro__strategy-card--betray">');
    expect(html).not.toContain('<button class="u2-intro__strategy-card');
    expect(html).not.toContain('<a class="u2-intro__strategy-card');
  });

  it("캠페인 시작 라벨과 우측 40% 패널을 렌더링하지 않는다", () => {
    const html = renderToStaticMarkup(
      createElement(IntroScreen, { status, boardHref: "/u1-test?screen=board" }),
    );

    expect(html).not.toContain("캠페인 시작");
    expect(html).not.toContain('data-testid="game-shell-right-panel"');
    expect(html).toContain("/assets/u3/extracted/contract-emblem.png");
    expect(html).not.toContain("/assets/u2/intro-guild-scroll.svg");
    expect(html).not.toContain("/assets/u2/intro-board.svg");
    expect(html).toContain("/assets/u3/extracted/arrow-right.png");
    expect(html).toContain('class="u2-intro__cta-arrow"');
  });

  it("통합 캠페인에서는 기존 CTA 버튼 계약을 유지한다", () => {
    const html = renderToStaticMarkup(
      createElement(IntroScreen, { status, boardHref: "#", onEnterBoard: () => {} }),
    );

    expect(html).toContain('<button class="u2-intro__cta" type="button">');
    expect(html).not.toContain('<a class="u2-intro__cta"');
  });

  it("고정 캔버스 안에서 도움과 배신 전략 및 원정 정보를 배치한다", () => {
    expect(css).toMatch(/\.u2-intro\s*\{[\s\S]*?grid-template-rows:/);
    expect(css).toMatch(/\.u2-intro__strategy\s*\{[\s\S]*?grid-template-columns:/);
    expect(css).toMatch(/\.u2-intro__facts\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,/);
    expect(css).toMatch(/\.u2-intro__strategy-card--help/);
    expect(css).toMatch(/\.u2-intro__strategy-card--betray/);
    expect(css).toMatch(/\.u2-intro-stage\s*\{[\s\S]*?overflow:\s*hidden/);
    expect(css).toMatch(/\.u2-intro__cta:focus-visible\s*\{/);
    expect(css).not.toMatch(/@media/);
    expect(css).not.toMatch(/--status-(?:bar|label|value)/);
  });
});
