"use client";

import { useMemo, useState } from "react";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { createBoardOffers } from "@/lib/rules/board";
import { U3BoardScreen } from "./U3BoardScreen";
import type { TopStatusView } from "./TopStatusBar";
import { createU3BoardView } from "./u3-board-model";

const PREVIEW_SEED = "u3-guild-board-preview";

export function U3Preview() {
  const { campaign, board } = useMemo(() => {
    const campaign = initializeCampaign(PREVIEW_SEED);
    const offers = createBoardOffers(campaign);
    return {
      campaign,
      board: createU3BoardView(campaign, offers),
    };
  }, []);

  const [selectedOfferId, setSelectedOfferId] = useState(
    board.notices[0]?.offerId ?? "",
  );
  const [feedback, setFeedback] = useState("");

  const status: TopStatusView = {
    rank: campaign.rank,
    reputation: campaign.reputation,
    gold: campaign.gold,
    canPromote: false,
    remainingDungeons: campaign.dungeons.filter(
      (dungeon) => dungeon.status !== "cleared",
    ).length,
    nextPromotion: {
      rank: "B",
      reputationRequired: 60,
    },
  };

  return (
    <div className="u3-preview">
      <U3BoardScreen
        status={status}
        board={board}
        selectedOfferId={selectedOfferId}
        onSelectOffer={(offerId) => {
          setSelectedOfferId(offerId);
          setFeedback("");
        }}
        onContract={(offerId) => {
          const selected = board.detailsByOfferId[offerId];
          setFeedback(
            selected === undefined
              ? "계약할 공고를 찾지 못했습니다."
              : `${selected.dungeonName} 계약 요청이 준비되었습니다.`,
          );
        }}
      />
      <p className="u3-preview__feedback" role="status" aria-live="polite">
        {feedback}
      </p>
    </div>
  );
}
