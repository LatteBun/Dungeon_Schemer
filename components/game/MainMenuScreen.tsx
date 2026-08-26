"use client";

import { useSyncExternalStore } from "react";
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
            * 이어할 판이 없으면 아예 두지 않는다.
            *
            * 잠긴 단추를 남겨 두면 「왜 안 눌리지」를 먼저 겪게 된다. 처음 온
            * 사람에게는 고를 수 있는 것만 보이는 편이 낫다.
            *
            * 서버는 브라우저 저장을 볼 수 없어 언제나 없는 쪽으로 그린다. 이어할
            * 판이 있는 사람은 붙는 순간 단추가 하나 늘어난다.
            */}
          {canResume ? (
            <a className="main-menu-screen__action" href="/campaign">
              이어하기
            </a>
          ) : null}

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

/*
 * 이어할 판이 있는지는 브라우저 밖의 상태다.
 *
 * effect 안에서 `setState` 로 읽으면 붙자마자 한 번 더 그리게 되고, 그 방식은
 * 이 저장소에서 이미 lint 에 걸려 `ScreenFit` 이 같은 자리로 옮겨 왔다.
 * `useSyncExternalStore` 는 서버 몫과 클라이언트 몫을 따로 받으므로 hydration
 * 이 어긋나지 않는다 — 서버는 저장을 볼 수 없어 언제나 「없음」이다.
 */
function subscribeSavedRun(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  /* 다른 탭에서 시작하거나 버린 판이 이 화면에도 반영된다. */
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener("storage", onChange); };
}

/* 불리언이라 값으로 비교된다. 매번 새 객체를 내주면 React 가 무한히 다시 그린다. */
const savedRunSnapshot = (): boolean => hasSavedCampaignRun();
const savedRunServerSnapshot = (): boolean => false;

export function MainMenu() {
  const canResume = useSyncExternalStore(
    subscribeSavedRun,
    savedRunSnapshot,
    savedRunServerSnapshot,
  );

  return <MainMenuScreen canResume={canResume} />;
}
