"use client";

import { useMemo, useState } from "react";
import { Board } from "@/components/game/Board";
import { ContractPanel } from "@/components/game/ContractPanel";
import {
  toBoardView,
  toContractView,
} from "@/components/game/campaign-view-model";
import type { BoardOfferId } from "@/lib/domain";
import { summarizeOfferRisk } from "@/lib/rules/offer-risk";
import type { OfferRiskSummary } from "@/lib/rules/offer-risk";
import { useCampaignStore } from "@/lib/stores/campaign-store-provider";
import { usePhaseGuard } from "./phase-route";
import { CAMPAIGN_CONTEXT, useCampaignDispatch } from "./play-campaign-provider";

export default function PlayPage() {
  const campaign = useCampaignStore((store) => store.campaign);
  const dispatch = useCampaignDispatch();
  const [selectedOfferId, setSelectedOfferId] = useState<BoardOfferId | null>(null);
  const matches = usePhaseGuard(["board", "contract"]);

  const riskByOfferId = useMemo(() => {
    const entries = new Map<string, OfferRiskSummary>();
    for (const offer of campaign.board) {
      entries.set(
        offer.id as string,
        summarizeOfferRisk(campaign, offer, CAMPAIGN_CONTEXT.events),
      );
    }
    return entries;
  }, [campaign]);

  if (!matches) return null;

  const contract = selectedOfferId === null
    ? null
    : toContractView(
        campaign,
        selectedOfferId,
        riskByOfferId.get(selectedOfferId as string) ?? null,
      );

  return (
    <div className="grid gap-3 lg:grid-cols-[3fr_2fr]">
      <Board
        offers={toBoardView(campaign, riskByOfferId)}
        selectedOfferId={selectedOfferId}
        onSelectOffer={setSelectedOfferId}
        onAcceptContract={(offerId) =>
          dispatch({ type: "acceptContract", offerId })
        }
      />
      <ContractPanel contract={contract} />
    </div>
  );
}
