"use client";

import { useRef, useState } from "react";
import { AchievementOverlay } from "./AchievementOverlay";
import { AppQuickMenuProvider } from "./AppQuickMenuContext";
import { useAppBattlePlaybackRate } from "./AppBattlePlaybackRateProvider";
import { GlobalQuickMenu } from "./GlobalQuickMenu";
import { useAppAudioStore } from "./AppAudioProvider";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import type { UiSoundKind } from "@/lib/audio/audio-playback";

function soundKindFor(control: Element): UiSoundKind | null {
  if (control.matches(":disabled") || control.getAttribute("aria-disabled") === "true") return null;
  const explicit = control.getAttribute("data-ui-sound");
  if (explicit === "none") return null;
  return explicit === "menu" ? "menu" : "select";
}

export function AppFrame({ children }: { readonly children: ReactNode }) {
  const playbackRateControl = useAppBattlePlaybackRate();
  const settings = useAppAudioStore((state) => state.settings);
  const statusMessage = useAppAudioStore((state) => state.message);
  const resumeBgmFromGesture = useAppAudioStore((state) => state.resumeBgmFromGesture);
  const toggleBgm = useAppAudioStore((state) => state.toggleBgm);
  const toggleSfx = useAppAudioStore((state) => state.toggleSfx);
  const playUiSound = useAppAudioStore((state) => state.playUiSound);
  const [menuOpen, setMenuOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const handleAppClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    void resumeBgmFromGesture();
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest("button, a, [data-ui-sound]");
    if (control === null) return;
    const kind = soundKindFor(control);
    if (kind !== null) void playUiSound(kind);
  };

  const toggleMenu = () => {
    void playUiSound("menu");
    setMenuOpen((open) => !open);
  };
  const openQuickMenu = (trigger: HTMLElement) => {
    restoreFocusRef.current = trigger;
    setMenuOpen(true);
  };
  const openAchievements = () => {
    void playUiSound("menu");
    setMenuOpen(false);
    setAchievementsOpen(true);
  };
  const closeAchievements = () => {
    setAchievementsOpen(false);
    requestAnimationFrame(() => { menuButtonRef.current?.focus(); });
  };

  return (
    <div className="app-frame" onClick={handleAppClick}>
      <AppQuickMenuProvider value={{ openQuickMenu }}>
        <div className="app-frame__screen" inert={achievementsOpen ? true : undefined}>
          {children}
        </div>
      </AppQuickMenuProvider>
      {/*
        * 설정은 어느 화면에서나 우측 상단에 있다.
        *
        * 한동안 메인 화면에서만 이 단추를 숨기고 메뉴 목록에 「설정」을 끼워
        * 넣었는데, 그러면 설정을 찾는 자리가 화면마다 달라진다. 늘 같은 자리에
        * 두어 한 번 익히면 어디서든 통하게 한다.
        */}
      <GlobalQuickMenu
        open={menuOpen}
        bgmEnabled={settings.bgmEnabled}
        sfxEnabled={settings.sfxEnabled}
        statusMessage={statusMessage}
        buttonRef={menuButtonRef}
        restoreFocusRef={restoreFocusRef}
        triggerVisible
        onToggleOpen={toggleMenu}
        onRequestClose={() => setMenuOpen(false)}
        onToggleBgm={() => { void toggleBgm(); }}
        onToggleSfx={() => { void toggleSfx(); }}
        playbackRate={playbackRateControl.playbackRate}
        onTogglePlaybackRate={playbackRateControl.togglePlaybackRate}
        onOpenAchievements={openAchievements}
      />
      {achievementsOpen ? <AchievementOverlay onClose={closeAchievements} /> : null}
    </div>
  );
}
