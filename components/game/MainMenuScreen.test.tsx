import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MainMenuScreen } from "./MainMenuScreen";

describe("메인 메뉴 화면", () => {
  it("캠페인과 업적 기록으로 가는 실제 링크를 제공한다", () => {
    const html = renderToStaticMarkup(
      createElement(MainMenuScreen, { unlockedCount: 3, loading: false }),
    );

    expect(html).toContain('href="/campaign"');
    expect(html).toContain("캠페인 시작");
    expect(html).toContain('href="/achievements"');
    expect(html).toContain("3 / 12");
    expect(html).not.toMatch(/<button[^>]*>[^]*<a/);
  });

  it("저장값을 읽기 전에도 같은 요약 자리를 둔다", () => {
    const html = renderToStaticMarkup(
      createElement(MainMenuScreen, { unlockedCount: 0, loading: true }),
    );

    expect(html).toContain("— / 12");
  });
});
