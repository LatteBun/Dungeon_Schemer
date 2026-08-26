"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  discardSavedCampaignRun,
  hasSavedCampaignRun,
} from "@/lib/store/campaign-run-storage";

export interface MainMenuScreenProps {
  /**
   * 이어할 판이 있는가.
   *
   * 서버는 브라우저 저장을 볼 수 없으므로 첫 그림에서는 언제나 `false` 다.
   * 붙은 뒤에 `MainMenu` 가 다시 알려 준다.
   */
  readonly canResume?: boolean;
}

export function MainMenuScreen({ canResume = false }: MainMenuScreenProps) {
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
          {/*
            * 새로 시작하는 자리는 이어하기를 버리고 나간다.
            *
            * 버리지 않으면 `/campaign` 이 저장된 판을 되살려서, 새로 시작을 누른
            * 사람이 하던 판으로 돌아온다.
            *
            * `next/link` 가 아니라 평범한 `a` 다. 캠페인 스토어는 첫 렌더에서 한
            * 번만 만들어지므로 클라이언트 이동으로는 새 판이 서지 않는다. 문서를
            * 새로 불러야 한다.
            */}
          <a
            className="main-menu-screen__action main-menu-screen__start"
            href="/campaign"
            onClick={discardSavedCampaignRun}
          >
            새 캠페인 시작
          </a>

          {/*
            * 이어할 판이 없으면 누를 수 없게 둔다. 감추지 않는 이유는 자리가
            * 흔들리면 세 번째 단추를 매번 다시 찾게 되기 때문이다.
            */}
          {canResume ? (
            <a className="main-menu-screen__action" href="/campaign">
              이어하기
            </a>
          ) : (
            <button className="main-menu-screen__action" type="button" disabled>
              이어하기
            </button>
          )}

          <Link
            className="main-menu-screen__action"
            href={{ pathname: "/achievements", query: { returnTo: "/" } }}
          >
            업적
          </Link>
        </nav>
      </div>
    </main>
  );
}

export function MainMenu() {
  /*
   * 저장은 붙은 뒤에 본다.
   *
   * 서버가 그린 것과 클라이언트의 첫 그림이 같아야 hydration 이 어긋나지 않는다.
   * 서버는 저장을 볼 수 없으므로 양쪽 모두 「이어할 판 없음」으로 시작하고, 붙은
   * 뒤 한 번 더 그린다.
   */
  const [canResume, setCanResume] = useState(false);

  useEffect(() => {
    setCanResume(hasSavedCampaignRun());
  }, []);

  return <MainMenuScreen canResume={canResume} />;
}
