import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { U1Preview } from "./U1Preview";

describe("U1Preview", () => {
  it("다섯 화면 선택 버튼과 초기 인트로를 렌더링한다", () => {
    const html = renderToStaticMarkup(createElement(U1Preview));

    expect(html).toContain('aria-label="U1 프리뷰 화면"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("인트로");
    expect(html).toContain("게시판");
    expect(html).toContain("지도");
    expect(html).toContain("진행");
    expect(html).toContain('class="u1-preview__screen-button is-active"');
    expect(html).toContain("u1-preview__reference-frame");
    expect(html).toContain("게임 셸 프리뷰");
    expect(html).toContain("정산·엔딩");
    expect(html).toContain("길잡이의 시작");
    expect(html).toContain('data-testid="game-shell-right-panel"');
  });

  it("게시판을 초기 화면으로 선택할 수 있다", () => {
    const html = renderToStaticMarkup(
      createElement(U1Preview, { initialScreen: "board" }),
    );

    expect(html).toContain('aria-pressed="true">게시판</button>');
    expect(html).toContain("길드 공고");
    expect(html).toContain("계약 상세");
  });
});
