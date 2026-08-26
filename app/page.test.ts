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
    expect(html).toContain('href="/achievements?returnTo=%2F"');
    expect(html).toContain('src="/assets/main-menu/hero-this-way-main-menu.jpeg"');
    expect(html).not.toContain("캠페인 개편 진행 중");
    expect(html).toContain('<div class="game-canvas"><div class="app-frame">');

    /*
     * 설정은 메인 화면에서도 우측 상단 자리에 있다.
     *
     * 한동안 이 화면에서만 그 단추를 숨기고 메뉴 목록에 「설정」을 끼워 넣었다.
     * 그러면 설정을 찾는 자리가 화면마다 달라진다. 단추가 있는지만이 아니라
     * 숨김 표시가 붙지 않았는지까지 본다 — 숨겨진 단추도 마크업에는 남는다.
     */
    expect(html).toContain('aria-label="빠른 메뉴 열기"');
    expect(html).not.toContain("global-quick-menu__trigger--hidden");
    expect(html).not.toContain(">설정<");
  });
});
