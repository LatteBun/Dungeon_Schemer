import { createElement, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GlobalQuickMenu } from "./GlobalQuickMenu";

const noop = () => {};

function renderMenu({
  open,
  bgmEnabled,
  sfxEnabled,
}: {
  readonly open: boolean;
  readonly bgmEnabled: boolean;
  readonly sfxEnabled: boolean;
}) {
  return renderToStaticMarkup(createElement(GlobalQuickMenu, {
    open,
    bgmEnabled,
    sfxEnabled,
    statusMessage: null,
    buttonRef: createRef<HTMLButtonElement>(),
    onToggleOpen: noop,
    onRequestClose: noop,
    onToggleBgm: noop,
    onToggleSfx: noop,
    onOpenAchievements: noop,
  }));
}

describe("전역 퀵 메뉴", () => {
  it("열린 메뉴는 기본 OFF 두 상태와 업적 진입을 접근 가능하게 표시한다", () => {
    const html = renderMenu({ open: true, bgmEnabled: false, sfxEnabled: false });

    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-controls="global-quick-menu-panel"');
    expect(html.match(/role="switch"/g)).toHaveLength(2);
    expect(html.match(/aria-checked="false"/g)).toHaveLength(2);
    expect(html).toContain("BGM");
    expect(html).toContain("효과음");
    expect(html.match(/>OFF</g)).toHaveLength(2);
    expect(html).toContain("업적 기록");
    expect(html.match(/data-ui-sound="none"/g)).toHaveLength(4);
  });

  it("저장된 ON 상태를 색 이외의 텍스트와 switch 값으로 표시한다", () => {
    const html = renderMenu({ open: true, bgmEnabled: true, sfxEnabled: true });

    expect(html.match(/aria-checked="true"/g)).toHaveLength(2);
    expect(html.match(/>ON</g)).toHaveLength(2);
  });

  it("닫힌 상태에서는 문장 버튼만 남기고 panel 내용을 숨긴다", () => {
    const html = renderMenu({ open: false, bgmEnabled: false, sfxEnabled: false });

    expect(html).toContain('aria-label="빠른 메뉴 열기"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('id="global-quick-menu-panel"');
    expect(html).not.toContain('role="switch"');
  });
});
