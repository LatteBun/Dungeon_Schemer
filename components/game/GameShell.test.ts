import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameShell } from "./GameShell";

const status = {
  rank: "B",
  reputation: 74,
  gold: 186,
  canPromote: true,
  remainingDungeons: 11,
  currentDungeon: { name: "거미굴 3번", riskLevel: 2 },
};

const paragraph = (children: string) => createElement("p", null, children);

describe("GameShell", () => {
  it("상태 바·본문·우측 레일 landmark를 렌더링한다", () => {
    const html = renderToStaticMarkup(
      createElement(GameShell, {
        status,
        screenTitle: "게시판",
        main: paragraph("공고 본문"),
        rightPanel: paragraph("계약 상세"),
        rightPanelLabel: "계약 상세",
      }),
    );

    expect(html).toContain('data-testid="game-shell"');
    expect(html).toContain('data-testid="game-shell-body"');
    expect(html).toContain('data-testid="game-shell-main"');
    expect(html).toContain('data-testid="game-shell-right-panel"');
    expect(html).toContain('aria-label="계약 상세"');
    expect(html).toContain('class="game-shell game-shell--reference"');
    expect(html).toContain('class="game-shell__main game-shell__surface"');
    expect(html).toContain('class="game-shell__right-panel game-shell__surface"');
    expect(html).toContain("game-shell__status-chip");
    expect(html).toContain("게시판");
    expect(html).toContain("공고 본문");
    expect(html).toContain("계약 상세");
  });

  it("우측 콘텐츠가 없어도 구조적 레일을 제거하지 않는다", () => {
    const html = renderToStaticMarkup(
      createElement(GameShell, {
        status,
        screenTitle: "인트로",
        main: paragraph("인트로 본문"),
      }),
    );

    expect(html).toContain('data-testid="game-shell-right-panel"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('class="game-shell__body"');
    expect(html).toContain('class="game-shell__right-panel game-shell__surface"');
  });

  it("승급 가능 여부를 색상 외 문구로 표시한다", () => {
    const html = renderToStaticMarkup(
      createElement(GameShell, {
        status,
        screenTitle: "게시판",
        main: paragraph("본문"),
      }),
    );

    expect(html).toContain("등급");
    expect(html).toContain("명성");
    expect(html).toContain("골드");
    expect(html).toContain("승급 가능");
    expect(html).toContain("남은 던전");
    expect(html).toContain("거미굴 3번");
  });
});
