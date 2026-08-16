"use client";

import { useState } from "react";
import { Board } from "@/components/game/Board";
import { ContractPanel } from "@/components/game/ContractPanel";
import {
  toBoardView,
  toContractView,
} from "@/components/game/campaign-view-model";
import type { BoardOfferId } from "@/lib/domain";
import { useCampaignStore } from "@/lib/stores/campaign-store-provider";
import { usePhaseGuard } from "./phase-route";
import { useCampaignDispatch } from "./play-campaign-provider";

export default function PlayPage() {
  const campaign = useCampaignStore((store) => store.campaign);
  const dispatch = useCampaignDispatch();
  const [selectedOfferId, setSelectedOfferId] = useState<BoardOfferId | null>(null);
  const matches = usePhaseGuard(["board", "contract"]);
  if (!matches) return null;

  const contract = selectedOfferId === null
    ? null
    : toContractView(campaign, selectedOfferId);

  return (
    <div className="grid gap-3 lg:grid-cols-[3fr_2fr]">
      <Board
        offers={toBoardView(campaign)}
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
