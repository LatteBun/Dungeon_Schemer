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
          * 기록이라는 장치가 없다. 길잡이는 직접 싸우지 않고 조언만 하며, 그
          * 조언은 용사가 받아들여야 실행된다. 믿게 만드는 것이 이 게임의
          * 수단이므로 그것을 적는다.
          */}
        <p>그들은 당신의 말을 믿는다</p>
        <h1>Dungeon Schemer</h1>
      </header>
      <nav className="main-menu-screen__actions" aria-label="메인 메뉴">
        <Link
          className="shell-cta shell-cta--primary main-menu-screen__start"
          href="/campaign"
          prefetch={false}
        >
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
