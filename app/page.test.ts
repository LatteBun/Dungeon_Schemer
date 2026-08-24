import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RootLayout from "./layout";
import Home from "./page";

describe("루트 메인 메뉴", () => {
  it("실제 레이아웃 안에서 캠페인과 업적 기록으로 연결한다", () => {
    const html = renderToStaticMarkup(
      createElement(RootLayout, null, createElement(Home)),
    );

    expect(html).toContain('href="/campaign"');
    expect(html).toContain('href="/achievements"');
    expect(html).toContain("달성 — / 12");
    expect(html).not.toContain("캠페인 개편 진행 중");
  });
});
