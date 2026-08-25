"use client";

import { useRef, useState } from "react";
import { AchievementOverlay } from "./AchievementOverlay";
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
  const settings = useAppAudioStore((state) => state.settings);
  const statusMessage = useAppAudioStore((state) => state.message);
  const resumeBgmFromGesture = useAppAudioStore((state) => state.resumeBgmFromGesture);
  const toggleBgm = useAppAudioStore((state) => state.toggleBgm);
  const toggleSfx = useAppAudioStore((state) => state.toggleSfx);
  const playUiSound = useAppAudioStore((state) => state.playUiSound);
  const [menuOpen, setMenuOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

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
      <div className="app-frame__screen" inert={achievementsOpen ? true : undefined}>
        {children}
      </div>
      <GlobalQuickMenu
        open={menuOpen}
        bgmEnabled={settings.bgmEnabled}
        sfxEnabled={settings.sfxEnabled}
        statusMessage={statusMessage}
        buttonRef={menuButtonRef}
        onToggleOpen={toggleMenu}
        onRequestClose={() => setMenuOpen(false)}
        onToggleBgm={() => { void toggleBgm(); }}
        onToggleSfx={() => { void toggleSfx(); }}
        onOpenAchievements={openAchievements}
      />
      {achievementsOpen ? <AchievementOverlay onClose={closeAchievements} /> : null}
    </div>
  );
}
