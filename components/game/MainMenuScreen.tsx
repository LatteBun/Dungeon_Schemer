"use client";

import Link from "next/link";
import { usePlayerProgressStore } from "@/components/game/PlayerProgressProvider";
import { ACHIEVEMENT_CATALOG, unlockedAchievementCount } from "@/lib/achievements/player-progress";

const TOTAL_ACHIEVEMENTS = ACHIEVEMENT_CATALOG.length;

export interface MainMenuScreenProps {
  readonly unlockedCount: number;
  readonly loading: boolean;
}

export function MainMenuScreen({ unlockedCount, loading }: MainMenuScreenProps) {
  return (
    <main className="main-menu-screen">
      <div className="main-menu-screen__shade" aria-hidden="true" />
      <header className="main-menu-screen__title">
        <p>길드가 기억하지 않는 길을 기록하라</p>
        <h1>Dungeon Schemer</h1>
      </header>
      <nav className="main-menu-screen__actions" aria-label="메인 메뉴">
        <Link className="shell-cta shell-cta--primary main-menu-screen__start" href="/campaign">
          캠페인 시작
        </Link>
        <Link className="shell-cta main-menu-screen__achievements" href="/achievements">
          <span>업적 기록</span>
          <small>
            {loading
              ? `달성 — / ${TOTAL_ACHIEVEMENTS}`
              : `달성 ${unlockedCount} / ${TOTAL_ACHIEVEMENTS}`}
          </small>
        </Link>
      </nav>
    </main>
  );
}

export function MainMenu() {
  const status = usePlayerProgressStore((state) => state.status);
  const progress = usePlayerProgressStore((state) => state.progress);

  return (
    <MainMenuScreen
      unlockedCount={unlockedAchievementCount(progress)}
      loading={status === "loading"}
    />
  );
}
