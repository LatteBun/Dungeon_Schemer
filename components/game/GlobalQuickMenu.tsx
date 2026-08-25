"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

export interface GlobalQuickMenuProps {
  readonly open: boolean;
  readonly bgmEnabled: boolean;
  readonly sfxEnabled: boolean;
  readonly statusMessage: string | null;
  readonly buttonRef: RefObject<HTMLButtonElement | null>;
  readonly onToggleOpen: () => void;
  readonly onRequestClose: () => void;
  readonly onToggleBgm: () => void;
  readonly onToggleSfx: () => void;
  readonly onOpenAchievements: () => void;
}

export function GlobalQuickMenu({
  open,
  bgmEnabled,
  sfxEnabled,
  statusMessage,
  buttonRef,
  onToggleOpen,
  onRequestClose,
  onToggleBgm,
  onToggleSfx,
  onOpenAchievements,
}: GlobalQuickMenuProps) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeAndRestoreFocus = () => {
      onRequestClose();
      requestAnimationFrame(() => { buttonRef.current?.focus(); });
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (buttonRef.current?.contains(event.target) || panelRef.current?.contains(event.target)) return;
      closeAndRestoreFocus();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeAndRestoreFocus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [buttonRef, onRequestClose, open]);

  return (
    <div className="global-quick-menu">
      <button
        ref={buttonRef}
        className="global-quick-menu__trigger"
        type="button"
        aria-label={open ? "빠른 메뉴 닫기" : "빠른 메뉴 열기"}
        aria-expanded={open}
        aria-controls="global-quick-menu-panel"
        data-ui-sound="none"
        onClick={onToggleOpen}
      >
        <svg viewBox="0 0 64 72" aria-hidden="true" focusable="false">
          <path className="global-quick-menu__shield" d="M32 4 55 13v20c0 16-9 27-23 35C18 60 9 49 9 33V13Z" />
          <path className="global-quick-menu__rune" d="M23 23v25M30 19v33M37 24v23M44 29v13" />
          <path className="global-quick-menu__bar" d="M18 35h28" />
        </svg>
      </button>

      {open ? (
        <section
          ref={panelRef}
          id="global-quick-menu-panel"
          className="global-quick-menu__panel"
          aria-label="빠른 메뉴"
        >
          <header>
            <span aria-hidden="true">◆</span>
            <h2>길드 장부</h2>
            <span aria-hidden="true">◆</span>
          </header>
          <button
            className="global-quick-menu__item"
            type="button"
            role="switch"
            aria-checked={bgmEnabled}
            data-ui-sound="none"
            onClick={onToggleBgm}
          >
            <span>BGM</span>
            <strong>{bgmEnabled ? "ON" : "OFF"}</strong>
          </button>
          <button
            className="global-quick-menu__item"
            type="button"
            role="switch"
            aria-checked={sfxEnabled}
            data-ui-sound="none"
            onClick={onToggleSfx}
          >
            <span>효과음</span>
            <strong>{sfxEnabled ? "ON" : "OFF"}</strong>
          </button>
          <button
            className="global-quick-menu__item global-quick-menu__achievements"
            type="button"
            data-ui-sound="none"
            onClick={onOpenAchievements}
          >
            <span>업적 기록</span>
            <strong aria-hidden="true">›</strong>
          </button>
          {statusMessage !== null ? (
            <p className="global-quick-menu__message" role="status">{statusMessage}</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
