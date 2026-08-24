import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RootLayout from "../layout";
import AchievementPage from "./page";

describe("업적 기록 페이지", () => {
  it("실제 루트 레이아웃에서 8개 카드와 메인 메뉴 연결을 렌더한다", () => {
    const html = renderToStaticMarkup(
      createElement(RootLayout, null, createElement(AchievementPage)),
    );

    expect(html).toContain("길잡이 업적 기록");
    expect(html).toContain('href="/"');
    expect(html.match(/미달성/g)).toHaveLength(8);
    expect(html.match(/role="progressbar"/g)).toHaveLength(3);
  });
});
