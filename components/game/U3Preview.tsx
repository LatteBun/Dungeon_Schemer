"use client";

import { useMemo, useState } from "react";
import {
  createCampaignTransitionContext,
  type CampaignState,
  type CampaignTransition,
  type CampaignTransitionContext,
  type PromotionMethod,
  type PromotionResult,
} from "@/lib/domain";
import { getGuidePromotionEligibility } from "@/lib/rules/promotion";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { createBoardOffers } from "@/lib/rules/board";
import { transitionCampaign } from "@/lib/rules/campaign-transition";
import { U3BoardScreen } from "./U3BoardScreen";
import type { TopStatusView } from "./TopStatusBar";
import { createU3BoardView } from "./u3-board-model";
import { createU3PromotionView } from "./u3-promotion-model";

const PREVIEW_SEED = "u3-guild-board-preview";

export function applyPreviewPromotion(
  campaign: CampaignState,
  method: PromotionMethod,
): { campaign: CampaignState; result: PromotionResult } {
  const transition = transitionCampaign(
    campaign,
    createCampaignTransitionContext(),
    { type: "PROMOTE_GUIDE", method },
  );
  if (transition.promotion === null) {
    throw new Error("승급 결과가 없는 프리뷰 전이");
  }
  return {
    campaign: transition.campaign,
    result: transition.promotion,
  };
}

export function U3Preview() {
  const initialCampaign = useMemo(() => {
    const campaign = initializeCampaign(PREVIEW_SEED);
    return { ...campaign, phase: "board" as const, offers: createBoardOffers({ ...campaign, phase: "board" as const }) };
  }, []);

  const [campaign, setCampaign] = useState<CampaignState>(initialCampaign);
  const [transitionContext, setTransitionContext] = useState<CampaignTransitionContext>(
    createCampaignTransitionContext,
  );

  const board = useMemo(() => createU3BoardView(campaign, campaign.offers), [campaign]);
  const [selectedOfferId, setSelectedOfferId] = useState(
    board.notices[0]?.offerId ?? "",
  );
  const [feedback, setFeedback] = useState("");
  const [promotionResult, setPromotionResult] = useState<PromotionResult | null>(null);
  const eligibility = getGuidePromotionEligibility(campaign);

  function applyTransition(action: CampaignTransition) {
    const transition = transitionCampaign(campaign, transitionContext, action);
    setCampaign(transition.campaign);
    setTransitionContext(transition.context);
    return transition;
  }

  const status: TopStatusView = {
    rank: campaign.rank,
    reputation: campaign.reputation,
    gold: campaign.gold,
    canPromote: eligibility?.canPromoteByReputation === true || eligibility?.canPromoteByGold === true,
    remainingDungeons: campaign.dungeons.filter(
      (dungeon) => dungeon.status !== "cleared",
    ).length,
    ...(eligibility === null ? {} : {
      nextPromotion: {
        rank: eligibility.toRank,
        reputationRequired: eligibility.reputationRequired,
      },
    }),
  };

  return (
    <div className="u3-preview">
      <U3BoardScreen
        status={status}
        board={board}
        selectedOfferId={selectedOfferId}
        promotion={createU3PromotionView(eligibility, campaign.phase, promotionResult)}
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
        onOpenPromotion={() => {
          setPromotionResult(null);
          applyTransition({ type: "OPEN_PROMOTION" });
        }}
        onCancelPromotion={() => {
          applyTransition({ type: "CANCEL_PROMOTION" });
        }}
        onConfirmPromotion={(method) => {
          const transition = applyTransition({ type: "PROMOTE_GUIDE", method });
          if (transition.promotion !== null) {
            setPromotionResult(transition.promotion);
            setSelectedOfferId(transition.campaign.offers[0]?.id ?? "");
          }
        }}
        onDismissPromotionResult={() => {
          setPromotionResult(null);
        }}
      />
      <p className="u3-preview__feedback" role="status" aria-live="polite">
        {feedback}
      </p>
    </div>
  );
}
