import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

describe("IntroScreen", () => {
  it("인트로 전용 전체 폭 스테이지에서 역할·수단·목표를 전달한다", () => {
    const html = renderToStaticMarkup(
      createElement(IntroScreen, { status, boardHref: "/u1-test?screen=board" }),
    );

    expect(html).toContain('class="u2-intro-stage"');
    expect(html).toContain("길잡이의 첫 기록");
    expect(html).toContain("던전은 검보다 먼저 말을 건넨다");
    expect(html).toContain(">역할<");
    expect(html).toContain(">수단<");
    expect(html).toContain(">목표<");
    expect(html).not.toContain("내 역할");
    expect(html).not.toContain("내 수단");
    expect(html).not.toContain("나의 목표");
    expect(html).toContain("열다섯 던전");
    expect(html).toContain("S급 길잡이");
    expect(html).toContain("길드 게시판으로");
    expect(html).toContain("<a class=\"u2-intro__cta\" href=\"/u1-test?screen=board\">");
    expect(html).not.toContain('<button class="u2-intro__cta"');
  });

  it("제목은 강제 줄바꿈 없이 렌더링하고 소개문은 의미 단위 두 줄로 묶는다", () => {
    const html = renderToStaticMarkup(
      createElement(IntroScreen, { status, boardHref: "/u1-test?screen=board" }),
    );

    expect(html).toContain('<h1 id="u2-intro-title">던전은 검보다 먼저 말을 건넨다</h1>');
    expect(html).toContain('<span>용사들은 앞으로 나아갑니다. 당신은 그보다 먼저 길을 읽고, 흔적을 기록합니다.</span>');
    expect(html).toContain('<span>무엇을 믿게 할지 결정하는 이 기록이, 던전과 용사 사이의 첫 약속이 됩니다.</span>');
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

  it("안내 카드는 의미가 분명한 단순 아이콘을 사용한다", () => {
    const html = renderToStaticMarkup(
      createElement(IntroScreen, { status, boardHref: "/u1-test?screen=board" }),
    );

    expect(html).toContain("/assets/u2/intro-role-observer.svg");
    expect(html).toContain("/assets/u2/intro-means-map-quill.svg");
    expect(html).toContain("/assets/u2/intro-goal-rank-crest.svg");
    expect(html).not.toContain("/assets/u2/intro-role.png");
  });

  it("공용 상태 바를 건드리지 않고 인트로 본문 글자를 확대한다", () => {
    const css = readFileSync(join(process.cwd(), "app", "u2-intro.css"), "utf8");

    expect(css).toMatch(/\.u2-intro__eyebrow\s*\{[^}]*font-size:\s*clamp\(0\.86rem, 1\.15cqw, 1\.06rem\)/);
    expect(css).toMatch(/\.u2-intro__copy h1\s*\{[^}]*font-size:\s*clamp\(2\.18rem, 3\.45cqw, 3\.55rem\)/);
    expect(css).toMatch(/\.u2-intro__lead\s*\{[^}]*font-size:\s*clamp\(0\.9rem, 1\.29cqw, 1\.1rem\)/);
    expect(css).toMatch(/\.u2-intro__card h2\s*\{[^}]*font-size:\s*clamp\(1\.2rem, 1\.67cqw, 1\.55rem\)/);
    expect(css).toMatch(/\.u2-intro__card p\s*\{[^}]*font-size:\s*clamp\(0\.81rem, 1\.09cqw, 0\.97rem\)/);
    expect(css).toMatch(/\.u2-intro__cta\s*\{[^}]*--cta-text-size:\s*clamp\(1\.36rem, 2\.3cqw, 1\.9rem\)/);
    expect(css).not.toMatch(/--status-(?:bar|label|value)/);
  });

  it("U2 본문은 전체 폭을 쓰고 카드 영역을 U3 밀도에 맞춘다", () => {
    const css = readFileSync(join(process.cwd(), "app", "u2-intro.css"), "utf8");

    expect(css).toMatch(/\.u2-intro\s*\{[\s\S]*?width:\s*100%/);
    expect(css).toMatch(/\.u2-intro-stage::before\s*\{[^}]*transform:\s*scale\(1\.012\)/);
    expect(css).not.toMatch(/\.u2-intro-stage::before\s*\{[^}]*scaleX/);
    expect(css).toMatch(/\.u2-intro-stage::after\s*\{[^}]*linear-gradient\(270deg/);
    expect(css).not.toMatch(/\.u2-intro-stage::after\s*\{[^}]*linear-gradient\(90deg/);
    expect(css).toMatch(/\.u2-intro__copy\s*\{[\s\S]*?transform:\s*translateY\(clamp\(0\.75rem, 1\.5cqh, 1rem\)\)/);
    expect(css).toMatch(/\.u2-intro__cards\s*\{[\s\S]*?align-self:\s*center/);
    expect(css).toMatch(/\.u2-intro__cards\s*\{[\s\S]*?justify-self:\s*end/);
    expect(css).toMatch(/\.u2-intro__cards\s*\{[\s\S]*?width:\s*min\(60cqw, 54rem\)/);
    expect(css).toMatch(/\.u2-intro__cards\s*\{[^}]*margin:\s*0 clamp\(0\.5rem, 4cqw, 3\.2rem\) 0 0/);
    expect(css).toMatch(/\.u2-intro__cta\s*\{[\s\S]*?justify-self:\s*center/);
    expect(css).not.toMatch(/\.u2-intro__cta\s*\{[\s\S]*?margin-left:/);
    expect(css).not.toContain("inset 0 1px 0 rgb(255 241 176 / 24%)");
  });
});
