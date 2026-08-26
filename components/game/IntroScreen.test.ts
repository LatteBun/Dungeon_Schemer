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
  it("승인된 단일 이미지와 숨은 요약으로 게임 가이드를 전달한다", () => {
    const html = renderToStaticMarkup(
      createElement(IntroScreen, { status, boardHref: "/u1-test?screen=board" }),
    );

    expect(html).toContain('class="u2-intro-stage"');
    expect(html).toContain('class="u2-intro__guide"');
    expect(html).toContain('class="u2-intro__guide-image"');
    expect(html).toContain('src="/assets/u2/game-guide-bg.png"');
    expect(html).toContain('width="1672"');
    expect(html).toContain('height="941"');
    expect(html).toContain('alt=""');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('<div class="sr-only">');
    expect(html).toContain('<h1 id="u2-intro-title">당신은 용사들을 던전으로 안내하는 고블린 길잡이입니다.</h1>');
    expect(html).toContain("도움과 배신의 전략");
    expect(html).toContain("명성과 골드의 두 승급 경로");
    expect(html).toContain("15개 던전 완주");
    expect(html).toContain("조기 종료 위험");
    expect(html).not.toContain('class="u2-intro__strategy"');
    expect(html).not.toContain('class="u2-intro__strategy-card');
    expect(html).not.toContain('class="u2-intro__facts"');
  });

  it("이미지 하단 프레임에는 텍스트 게시판 링크만 렌더링한다", () => {
    const html = renderToStaticMarkup(
      createElement(IntroScreen, { status, boardHref: "/u1-test?screen=board" }),
    );

    expect(html).toContain('<a class="u2-intro__cta" href="/u1-test?screen=board"><strong>길드 게시판으로</strong></a>');
    expect(html).not.toContain('<button class="u2-intro__cta"');
    expect(html).not.toContain("/assets/u3/extracted/contract-emblem.png");
    expect(html).not.toContain("/assets/u3/extracted/arrow-right.png");
  });

  it("통합 캠페인에서는 기존 CTA 버튼 계약을 유지한다", () => {
    const html = renderToStaticMarkup(
      createElement(IntroScreen, { status, boardHref: "#", onEnterBoard: () => {} }),
    );

    expect(html).toContain('<button class="u2-intro__cta" type="button"><strong>길드 게시판으로</strong></button>');
    expect(html).not.toContain('<a class="u2-intro__cta"');
  });

  it("원본 비율로 이미지를 담고 CTA를 이미지 프레임 좌표에 배치한다", () => {
    expect(css).toMatch(/\.u2-intro-stage\s*\{[\s\S]*?container-type:\s*size/);
    expect(css).toMatch(/\.u2-intro-stage\s*\{[\s\S]*?place-items:\s*center/);
    expect(css).toMatch(/\.u2-intro-stage\s*\{[\s\S]*?overflow:\s*hidden/);
    expect(css).toMatch(/\.u2-intro__guide\s*\{[\s\S]*?aspect-ratio:\s*1672\s*\/\s*941/);
    expect(css).toMatch(/\.u2-intro__guide\s*\{[\s\S]*?100cqh/);
    expect(css).toMatch(/\.u2-intro__guide-image\s*\{[\s\S]*?object-fit:\s*contain/);
    expect(css).toMatch(/\.u2-intro__cta\s*\{[\s\S]*?position:\s*absolute/);
    expect(css).toMatch(/\.u2-intro__cta\s*\{[\s\S]*?left:\s*28\.2%/);
    expect(css).toMatch(/\.u2-intro__cta\s*\{[\s\S]*?top:\s*91\.75%/);
    expect(css).toMatch(/\.u2-intro__cta\s*\{[\s\S]*?width:\s*43\.5%/);
    expect(css).toMatch(/\.u2-intro__cta\s*\{[\s\S]*?height:\s*6\.9%/);
    expect(css).toMatch(/\.u2-intro__cta:focus-visible\s*\{/);
    expect(css).not.toMatch(/u2-intro__(?:copy|strategy|facts)/);
    expect(css).not.toMatch(/intro-background-full\.png/);
    expect(css).not.toMatch(/@media|\b(?:vw|vh)\b/);
    expect(css).not.toMatch(/--status-(?:bar|label|value)/);
  });
});
