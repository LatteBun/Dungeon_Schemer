import { createElement, createRef } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GlobalQuickMenu, setGlobalQuickMenuRestoreOrigin } from "./GlobalQuickMenu";

const noop = () => {};

function renderMenu({
  open,
  bgmEnabled,
  sfxEnabled,
  playbackRate = 1,
  triggerVisible = true,
}: {
  readonly open: boolean;
  readonly bgmEnabled: boolean;
  readonly sfxEnabled: boolean;
  readonly playbackRate?: 1 | 2;
  readonly triggerVisible?: boolean;
}) {
  return renderToStaticMarkup(createElement(GlobalQuickMenu, {
    open,
    bgmEnabled,
    sfxEnabled,
    statusMessage: null,
    buttonRef: createRef<HTMLButtonElement>(),
    restoreFocusRef: createRef<HTMLElement>(),
    triggerVisible,
    onToggleOpen: noop,
    onRequestClose: noop,
    onToggleBgm: noop,
    onToggleSfx: noop,
    playbackRate,
    onTogglePlaybackRate: noop,
    onOpenAchievements: noop,
  }));
}

describe("전역 퀵 메뉴", () => {
  it("열린 메뉴는 세 설정과 구분된 업적 진입을 접근 가능하게 표시한다", () => {
    const html = renderMenu({ open: true, bgmEnabled: false, sfxEnabled: false });

    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-controls="global-quick-menu-panel"');
    expect(html.match(/role="switch"/g)).toHaveLength(2);
    expect(html.match(/aria-checked="false"/g)).toHaveLength(2);
    expect(html).toContain("BGM");
    expect(html).toContain("효과음");
    expect(html).toContain("전투 속도");
    expect(html).toContain("×1");
    expect(html.match(/>OFF</g)).toHaveLength(2);
    expect(html).toContain("업적 기록");
    expect(html).toContain('class="global-quick-menu__settings"');
    expect(html).toContain('class="global-quick-menu__divider"');
    expect(html).toContain('class="global-quick-menu__achievements"');
    expect(html).not.toContain("길드 장부");
    expect(html.match(/class="global-quick-menu__dot"/g)).toHaveLength(3);
    expect(html.match(/data-ui-sound="none"/g)).toHaveLength(5);
  });

  it("저장된 ON 상태를 색 이외의 텍스트와 switch 값으로 표시한다", () => {
    const html = renderMenu({ open: true, bgmEnabled: true, sfxEnabled: true });

    expect(html.match(/aria-checked="true"/g)).toHaveLength(2);
    expect(html.match(/>ON</g)).toHaveLength(2);
  });

  it("전투 속도는 switch가 아닌 현재 배속 버튼으로 표시한다", () => {
    const html = renderMenu({
      open: true,
      bgmEnabled: false,
      sfxEnabled: false,
      playbackRate: 2,
    });

    expect(html).toContain('aria-label="전투 속도 ×2, 누르면 ×1"');
    expect(html).toContain("×2");
    expect(html.match(/role="switch"/g)).toHaveLength(2);
  });

  it("닫힌 상태에서는 문장 버튼만 남기고 panel 내용을 숨긴다", () => {
    const html = renderMenu({ open: false, bgmEnabled: false, sfxEnabled: false });

    expect(html).toContain('aria-label="빠른 메뉴 열기"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('id="global-quick-menu-panel"');
    expect(html).not.toContain('role="switch"');
  });

  it("메인 화면에서는 trigger를 숨겨도 열린 panel은 유지한다", () => {
    const html = renderMenu({
      open: true,
      bgmEnabled: false,
      sfxEnabled: false,
      triggerVisible: false,
    });

    expect(html).toContain('class="global-quick-menu__trigger global-quick-menu__trigger--hidden"');
    expect(html).toContain('id="global-quick-menu-panel"');
  });

  it("숨김 modifier는 trigger만 감춰 열린 panel을 보존한다", () => {
    const css = readFileSync(join(process.cwd(), "app", "app-frame.css"), "utf8");
    const hiddenRule = css.match(/\.global-quick-menu__trigger--hidden\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(hiddenRule).toMatch(/display:\s*none/);
  });

  it("visible global trigger를 누르면 그 trigger를 focus 복귀 출발점으로 쓴다", () => {
    const trigger = {} as HTMLButtonElement;
    const buttonRef = { current: trigger };
    const restoreFocusRef = { current: {} as HTMLElement | null };

    setGlobalQuickMenuRestoreOrigin(buttonRef, restoreFocusRef);

    expect(restoreFocusRef.current).toBe(trigger);
  });
});
