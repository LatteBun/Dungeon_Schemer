import type { ReactNode } from "react";
import { TopStatusBar } from "./TopStatusBar";
import type { TopStatusView } from "./TopStatusBar";

export interface GameShellProps {
  status: TopStatusView;
  onOpenPromotion?: () => void;
  screenTitle: string;
  main: ReactNode;
  rightPanel?: ReactNode;
  rightPanelLabel?: string;
}

export function GameShell({
  status,
  onOpenPromotion,
  screenTitle,
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
          aria-labelledby="game-shell-screen-title"
        >
          <h1 id="game-shell-screen-title">{screenTitle}</h1>
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
