import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/*
 * Link 를 대역으로 세우되 주소는 진짜처럼 만든다.
 *
 * `prefetch` 가 실제로 꺼져 있는지 보려면 대역이 필요한데, 진짜 `Link` 는
 * 그것을 표시로 남기지 않는다. 다만 대역이 `href` 를 문자열로만 다루면
 * `{ pathname, query }` 로 넘어오는 주소가 `[object Object]` 가 된다. Next 가
 * 하는 직렬화를 여기서도 해 두어야 두 가지를 함께 확인할 수 있다.
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

const { openQuickMenu } = vi.hoisted(() => ({ openQuickMenu: vi.fn() }));

vi.mock("./AppQuickMenuContext", () => ({
  useAppQuickMenu: () => ({ openQuickMenu }),
}));

import { MainMenu, MainMenuScreen } from "./MainMenuScreen";

describe("메인 메뉴 화면", () => {
  it("승인 일러스트 위에 접근 가능한 제목과 세 메뉴를 표시한다", () => {
    const onOpenSettings = vi.fn();
    const html = renderToStaticMarkup(
      createElement(MainMenuScreen, { onOpenSettings }),
    );

    expect(html).toContain('src="/assets/main-menu/hero-this-way-main-menu.jpeg"');
    expect(html).toContain('class="main-menu-screen__accessible-title"');
    expect(html).toContain("용사님, 이쪽입니다");
    expect(html).not.toContain("Dungeon Schemer");
    expect(html).toContain('aria-label="메인 메뉴"');
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain(">설정</button>");
    expect(html).not.toContain("3 / 12");
  });

  it("캠페인과 업적 기록으로 가는 실제 링크를 제공한다", () => {
    const html = renderToStaticMarkup(
      createElement(MainMenuScreen, { onOpenSettings: vi.fn() }),
    );

    expect(html).toContain('href="/campaign"');
    expect(html).toContain('data-prefetch="false"');
    expect(html).toContain("캠페인 시작");
    expect(html).toContain('href="/achievements?returnTo=%2F"');
    expect(html).not.toMatch(/<button[^>]*>[^]*<a/);
  });

  it("설정 click event의 currentTarget을 전역 메뉴 열기에 전달한다", () => {
    openQuickMenu.mockClear();
    const screen = MainMenu();
    const trigger = {} as HTMLButtonElement;
    screen.props.onOpenSettings({ currentTarget: trigger } as React.MouseEvent<HTMLButtonElement>);

    expect(openQuickMenu).toHaveBeenCalledWith(trigger);
  });
});
