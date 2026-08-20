"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { GameShell } from "./GameShell";
import {
  U1_PREVIEW_SCREEN_IDS,
  U1_PREVIEW_SCREENS,
  U1_PREVIEW_STATUS,
} from "./u1-preview-data";
import type { U1PreviewScreen } from "./u1-preview-data";

function PreviewMainContent({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Panel title={title} className="u1-preview__content-panel">
      <div className="flex flex-col gap-4 text-sm leading-relaxed">
        <p>{description}</p>
        <p className="text-muted">
          <span aria-hidden="true">✓</span> 선택 결과와 변화 원인은 다음 화면에서
          확인합니다.
        </p>
      </div>
    </Panel>
  );
}

function PreviewRightPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Panel title={title} className="u1-preview__content-panel">
      <div className="flex flex-col gap-3 text-sm leading-relaxed">
        <p>{description}</p>
        <p className="text-muted">
          <span aria-hidden="true">•</span> 공통 우측 패널 영역
        </p>
      </div>
    </Panel>
  );
}

export function U1Preview() {
  const [selectedScreen, setSelectedScreen] = useState<U1PreviewScreen>("intro");
  const definition =
    U1_PREVIEW_SCREENS.find((screen) => screen.id === selectedScreen) ??
    U1_PREVIEW_SCREENS[0];

  return (
    <div className="u1-preview min-h-screen p-4 sm:p-6">
      <nav
        className="u1-preview__navigation mb-4"
        aria-label="U1 프리뷰 화면"
      >
        {U1_PREVIEW_SCREEN_IDS.map((screenId) => {
          const screen = U1_PREVIEW_SCREENS.find(
            (candidate) => candidate.id === screenId,
          );

          if (screen === undefined) {
            return null;
          }

          return (
            <button
              key={screen.id}
              type="button"
              className="rounded border border-edge bg-panel px-3 py-2 text-sm text-parchment transition-colors hover:border-muted"
              aria-pressed={screen.id === selectedScreen}
              onClick={() => setSelectedScreen(screen.id)}
            >
              {screen.label}
            </button>
          );
        })}
      </nav>

      <GameShell
        status={U1_PREVIEW_STATUS}
        screenTitle={definition.label}
        main={
          <PreviewMainContent
            title={definition.mainTitle}
            description={definition.mainDescription}
          />
        }
        rightPanel={
          definition.rightTitle === null || definition.rightDescription === null
            ? undefined
            : (
              <PreviewRightPanel
                title={definition.rightTitle}
                description={definition.rightDescription}
              />
            )
        }
        rightPanelLabel={definition.rightTitle ?? undefined}
      />
    </div>
  );
}
