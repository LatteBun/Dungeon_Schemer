import type { ReactNode } from "react";
import { TopStatusBar } from "./TopStatusBar";
import type { TopStatusView } from "./TopStatusBar";

export interface GameShellProps {
  status: TopStatusView;
  onOpenPromotion?: () => void;
  screenTitle: string;
  /** 제목을 비웠을 때 읽어 줄 이름. */
  ariaTitle?: string;
  main: ReactNode;
  rightPanel?: ReactNode;
  rightPanelLabel?: string;
}

export function GameShell({
  status,
  onOpenPromotion,
  screenTitle,
  ariaTitle,
  main,
  rightPanel,
  rightPanelLabel,
}: GameShellProps) {
  const hasRightPanel = rightPanel !== undefined && rightPanel !== null;

  return (
    <div className="game-shell game-shell--reference" data-testid="game-shell">
      <TopStatusBar status={status} onOpenPromotion={onOpenPromotion} />
      <main className="game-shell__body" data-testid="game-shell-body">
        <section
          className="game-shell__main game-shell__surface"
          data-testid="game-shell-main"
          {...(screenTitle === ""
            ? { "aria-label": ariaTitle ?? "화면" }
            : { "aria-labelledby": "game-shell-screen-title" })}
        >
          {/*
            * 제목이 비면 자리도 비운다.
            *
            * 화면이 무엇인지 다른 곳에서 이미 말하고 있으면 제목이 군더더기다.
            * 빈 `h1` 을 두면 글자 없는 줄만 남아 위가 벌어진다. 다만 읽어 주는
            * 이름은 남겨야 하므로 `aria-label` 로 옮긴다.
            */}
          {screenTitle === "" ? null : <h1 id="game-shell-screen-title">{screenTitle}</h1>}
          {main}
        </section>
        <aside
          className="game-shell__right-panel game-shell__surface"
          data-testid="game-shell-right-panel"
          aria-label={
            hasRightPanel ? rightPanelLabel ?? "우측 정보 패널" : undefined
          }
          aria-hidden={hasRightPanel ? undefined : true}
        >
          {rightPanel}
        </aside>
      </main>
    </div>
  );
}
