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
        {/*
          * 표어는 이 게임이 무엇인지 말한다.
          *
          * 예전에는 「길드가 기억하지 않는 길을 기록하라」 였는데, 게임에 길드
          * 기록이라는 장치가 없다. 실제로 하는 일은 던전을 미리 답사한 고블린
          * 길잡이로서 용사에게 조언하는 것이고, 그 조언은 도울 수도 해칠 수도 있다.
          * 그 두 가지를 그대로 적는다.
          */}
        <p>당신은 던전 편이다. 용사들은 그것을 모른다</p>
        <h1>Dungeon Schemer</h1>
      </header>
      <nav className="main-menu-screen__actions" aria-label="메인 메뉴">
        <Link className="shell-cta shell-cta--primary main-menu-screen__start" href="/campaign">
          캠페인 시작
        </Link>
        <Link className="shell-cta main-menu-screen__achievements" href="/achievements">
          <span>업적</span>
          <small>{loading ? `— / ${TOTAL_ACHIEVEMENTS}` : `${unlockedCount} / ${TOTAL_ACHIEVEMENTS}`}</small>
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
