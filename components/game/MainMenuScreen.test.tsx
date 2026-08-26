import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/*
 * Link 를 대역으로 세우되 주소는 진짜처럼 만든다.
 *
 * 대역이 `href` 를 문자열로만 다루면 `{ pathname, query }` 로 넘어오는 주소가
 * `[object Object]` 가 된다. Next 가 하는 직렬화를 여기서도 해 두어야 업적으로
 * 가는 주소를 확인할 수 있다.
 */
type LinkHref = string | { pathname: string; query?: Record<string, string> };

function hrefToString(href: LinkHref): string {
  if (typeof href === "string") return href;
  const query = new URLSearchParams(href.query ?? {}).toString();
  return query === "" ? href.pathname : `${href.pathname}?${query}`;
}

vi.mock("next/link", () => ({
  default: ({ prefetch, href, className, children }: { prefetch?: boolean; href: LinkHref; className?: string; children: ReactNode }) =>
    createElement("a", { href: hrefToString(href), className, "data-prefetch": String(prefetch) }, children),
}));

import { MainMenuScreen } from "./MainMenuScreen";

const render = (canResume?: boolean) =>
  renderToStaticMarkup(createElement(MainMenuScreen, canResume === undefined ? {} : { canResume }));

describe("메인 메뉴 화면", () => {
  it("승인 일러스트 위에 접근 가능한 제목과 메뉴를 표시한다", () => {
    const html = render(true);

    expect(html).toContain('src="/assets/main-menu/hero-this-way-main-menu.jpeg"');
    expect(html).toContain('class="main-menu-screen__accessible-title"');
    expect(html).toContain("용사님, 이쪽입니다");
    expect(html).not.toContain("Dungeon Schemer");
    expect(html).toContain('aria-label="메인 메뉴"');
    expect(html).toContain("새 캠페인 시작");
    expect(html).toContain("이어하기");
    expect(html).toContain("업적");
  });

  /*
   * 설정은 우측 상단 ⋮ 로 돌아갔다. 메뉴 목록에 다시 끼어들면 설정을 찾는 자리가
   * 화면마다 달라진다.
   */
  it("설정을 메뉴 목록에 두지 않는다", () => {
    const html = render();
    expect(html).not.toContain("설정");
    expect(html).not.toContain('aria-haspopup="menu"');
  });

  it("업적으로 가는 실제 링크를 제공한다", () => {
    expect(render()).toContain('href="/achievements?returnTo=%2F"');
  });

  /*
   * 새로 시작하는 자리는 `next/link` 가 아니라 평범한 `a` 여야 한다. 캠페인
   * 스토어는 첫 렌더에서 한 번만 만들어지므로, 클라이언트 이동으로는 저장을
   * 버려도 새 판이 서지 않는다.
   */
  it("새 캠페인은 문서를 새로 부르는 링크로 나간다", () => {
    const html = render();
    expect(html).toMatch(/<a[^>]*class="main-menu-screen__action main-menu-screen__start"[^>]*href="\/campaign"/);
    expect(html).not.toMatch(/class="[^"]*main-menu-screen__start[^"]*"[^>]*data-prefetch/);
  });

  describe("이어하기", () => {
    /*
     * 잠긴 단추를 남기지 않는다. 처음 온 사람에게는 고를 수 있는 것만 보인다.
     */
    it("이어할 판이 없으면 단추를 두지 않는다", () => {
      const html = render(false);
      expect(html).not.toContain("이어하기");
    });

    it("이어할 판이 없으면 단추가 둘이다", () => {
      const html = render(false);
      expect(html.match(/main-menu-screen__action[" ]/g) ?? []).toHaveLength(2);
    });

    it("이어할 판이 있으면 단추가 셋이다", () => {
      const html = render(true);
      expect(html.match(/main-menu-screen__action[" ]/g) ?? []).toHaveLength(3);
    });

    it("이어할 판이 있으면 캠페인으로 가는 링크가 된다", () => {
      const html = render(true);
      expect(html).toMatch(/<a[^>]*href="\/campaign"[^>]*>이어하기<\/a>/);
      expect(html).not.toMatch(/<button[^>]*>이어하기/);
    });
  });
});
