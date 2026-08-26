"use client";

import Link from "next/link";
import { useAppQuickMenu } from "@/components/game/AppQuickMenuContext";

export interface MainMenuScreenProps {
  readonly onOpenSettings: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function MainMenuScreen({ onOpenSettings }: MainMenuScreenProps) {
  return (
    <main className="main-menu-screen">
      <div className="main-menu-screen__canvas">
        <img
          className="main-menu-screen__art"
          src="/assets/main-menu/hero-this-way-main-menu.jpeg"
          alt=""
        />
        <h1 className="main-menu-screen__accessible-title">용사님, 이쪽입니다</h1>
        <nav className="main-menu-screen__actions" aria-label="메인 메뉴">
          <Link
            className="main-menu-screen__action main-menu-screen__start"
            href="/campaign"
            prefetch={false}
          >
            캠페인 시작
          </Link>
          <Link
            className="main-menu-screen__action"
            href={{ pathname: "/achievements", query: { returnTo: "/" } }}
          >
            업적
          </Link>
          <button
            className="main-menu-screen__action"
            type="button"
            aria-haspopup="menu"
            onClick={onOpenSettings}
          >
            설정
          </button>
        </nav>
      </div>
    </main>
  );
}

export function MainMenu() {
  const { openQuickMenu } = useAppQuickMenu();

  return <MainMenuScreen onOpenSettings={(event) => openQuickMenu(event.currentTarget)} />;
}
