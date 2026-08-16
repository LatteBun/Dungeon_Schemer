"use client";

import { useState } from "react";
import { DungeonMapView } from "@/components/game/DungeonMapView";
import { MapLegend } from "@/components/game/MapLegend";
import { toMapView } from "@/components/game/expedition-view-model";
import type { NodeId } from "@/lib/domain";
import { useCampaignStore } from "@/lib/stores/campaign-store-provider";
import { ExpeditionPartyAside } from "../expedition-party-aside";
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
    <div className="grid gap-3 lg:grid-cols-[13rem_1fr_18rem]">
      <MapLegend />
      <DungeonMapView
        view={view}
        selectedNodeId={selectedNodeId}
        onSelectNode={setSelectedNodeId}
      />
      <ExpeditionPartyAside
        footer={
          <button
            type="button"
            disabled={selectedNodeId === null}
            onClick={() => {
              if (selectedNodeId !== null) {
                dispatch({ type: "selectNode", nodeId: selectedNodeId });
              }
            }}
            className="w-full rounded border border-edge px-3 py-2 text-sm text-parchment enabled:hover:bg-edge disabled:opacity-40"
          >
            선택 지점 입장 · 정보 기회 →
          </button>
        }
      />
    </div>
  );
}
