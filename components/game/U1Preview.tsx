"use client";

import { useState } from "react";
import { GameShell } from "./GameShell";
import {
  U1PreviewMainContent,
  U1PreviewRightPanelContent,
} from "./U1PreviewContent";
import {
  U1_PREVIEW_SCREEN_IDS,
  U1_PREVIEW_SCREENS,
  U1_PREVIEW_STATUS,
} from "./u1-preview-data";
import type { U1PreviewScreen } from "./u1-preview-data";

export function U1Preview() {
  const [selectedScreen, setSelectedScreen] = useState<U1PreviewScreen>("intro");
  const definition =
    U1_PREVIEW_SCREENS.find((screen) => screen.id === selectedScreen) ??
    U1_PREVIEW_SCREENS[0];

  return (
    <div className="u1-preview u1-preview__reference-frame min-h-screen p-4 sm:p-6">
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
              className={
                "u1-preview__screen-button" +
                (screen.id === selectedScreen ? " is-active" : "")
              }
              aria-pressed={screen.id === selectedScreen}
              onClick={() => setSelectedScreen(screen.id)}
            >
              {screen.label}
            </button>
          );
        })}
      </nav>

      <p className="u1-preview__eyebrow">게임 셸 프리뷰</p>
      <GameShell
        status={U1_PREVIEW_STATUS}
        screenTitle={definition.label}
        main={<U1PreviewMainContent screenId={definition.id} />}
        rightPanel={
          definition.id === "intro"
            ? undefined
            : <U1PreviewRightPanelContent screenId={definition.id} />
        }
        rightPanelLabel={definition.rightTitle ?? undefined}
      />
    </div>
  );
}
