"use client";

import { useState } from "react";
import { DungeonMapView } from "@/components/game/DungeonMapView";
import { toMapView } from "@/components/game/expedition-view-model";
import type { NodeId } from "@/lib/domain";
import { useCampaignStore } from "@/lib/stores/campaign-store-provider";
import { usePhaseGuard } from "../phase-route";
import {
  CAMPAIGN_CONTEXT,
  useCampaignDispatch,
} from "../play-campaign-provider";

export default function MapPage() {
  const campaign = useCampaignStore((store) => store.campaign);
  const dispatch = useCampaignDispatch();
  const [selectedNodeId, setSelectedNodeId] = useState<NodeId | null>(null);
  const matches = usePhaseGuard(["map"]);
  const expedition = campaign.expedition;
  if (!matches || expedition === null) return null;

  const view = toMapView(
    expedition.map,
    expedition.currentNodeId,
    expedition.visitedNodeIds,
    (eventId) => CAMPAIGN_CONTEXT.eventKindById.get(eventId as string) ?? "special",
  );

  return (
    <DungeonMapView
      view={view}
      selectedNodeId={selectedNodeId}
      onSelectNode={setSelectedNodeId}
      onEnterNode={() => {
        if (selectedNodeId !== null) {
          dispatch({ type: "selectNode", nodeId: selectedNodeId });
        }
      }}
    />
  );
}
