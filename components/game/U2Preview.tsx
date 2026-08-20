"use client";

import { useState } from "react";
import { IntroScreen } from "./IntroScreen";
import type { TopStatusView } from "./TopStatusBar";

const U2_START_STATUS: TopStatusView = {
  rank: "C",
  reputation: 30,
  gold: 10,
  canPromote: false,
  remainingDungeons: 15,
  nextPromotion: { rank: "B", reputationRequired: 60 },
};

export function U2Preview() {
  const [entryRequested, setEntryRequested] = useState(false);

  return (
    <div className="u2-preview">
      <IntroScreen
        status={U2_START_STATUS}
        onEnterBoard={() => setEntryRequested(true)}
      />
      <p className="u2-preview__feedback" aria-live="polite">
        {entryRequested ? "게시판 진입 요청됨" : ""}
      </p>
    </div>
  );
}
