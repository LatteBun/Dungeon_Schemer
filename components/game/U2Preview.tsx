"use client";

import { DENOUNCE_THRESHOLD } from "@/lib/domain";
import { IntroScreen } from "./IntroScreen";
import type { TopStatusView } from "./TopStatusBar";

const U2_START_STATUS: TopStatusView = {
  rank: "C",
  reputation: 30,
  gold: 10,
  canPromote: false,
  remainingAdventurers: 30,
  remainingDungeons: 15,
  zeroTrust: { livingCount: 0, threshold: DENOUNCE_THRESHOLD },
  nextPromotion: { rank: "B", reputationRequired: 60 },
};

export function U2Preview() {
  return (
    <div className="u2-preview">
      <IntroScreen status={U2_START_STATUS} boardHref="/u3-test" />
    </div>
  );
}
