"use client";

import { useMemo, useState } from "react";
import { CampaignHeader } from "@/components/game/CampaignHeader";
import { DungeonMapView } from "@/components/game/DungeonMapView";
import { EventActions } from "@/components/game/EventActions";
import { InfoOpportunityPanel } from "@/components/game/InfoOpportunityPanel";
import { PartyReactionSidebar } from "@/components/game/PartyReactionSidebar";
import { PartyStatusSidebar } from "@/components/game/PartyStatusSidebar";
import {
  toEventView,
  toInfoOpportunityView,
  toInfoReactionsView,
  toMapView,
  toPartyStatusView,
} from "@/components/game/expedition-view-model";
import { createRng } from "@/lib/rng";
import { createInfoOpportunity, evaluatePartyInfoCard } from "@/lib/rules/info";
import type { CardId, ChoiceId, NodeId, PendingInfo } from "@/lib/domain";
import type { MemberReactionView } from "@/components/game/expedition-view-model";
import { u2Fixture } from "./u2-fixtures";

type Step = "map" | "info" | "event";

export default function U2TestPage() {
  const fx = useMemo(() => u2Fixture("C"), []);
  const [step, setStep] = useState<Step>("map");
  const [currentNodeId, setCurrentNodeId] = useState<NodeId>(fx.currentNodeId);
  const [visited, setVisited] = useState<NodeId[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<NodeId | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<CardId | null>(null);
  const [reactions, setReactions] = useState<MemberReactionView[]>([]);
  const [selectedChoiceId, setSelectedChoiceId] = useState<ChoiceId | null>(null);
  const [pendingInfo, setPendingInfo] = useState<PendingInfo | null>(null);

  const activeNode = fx.map.nodes.find((node) => node.id === (selectedNodeId ?? currentNodeId))!;
  const event = fx.eventById(activeNode.eventId);

  const mapView = toMapView(fx.map, currentNodeId, visited, fx.eventKindById);
  const partyStatus = toPartyStatusView(fx.party);

  function enterNode() {
    if (selectedNodeId === null) return;
    setCurrentNodeId(selectedNodeId);
    const node = fx.map.nodes.find((candidate) => candidate.id === selectedNodeId)!;
    setSelectedCardId(null);
    setReactions([]);
    setSelectedChoiceId(null);
    if (node.hasInfoOpportunity) {
      setPendingInfo(
        createInfoOpportunity({
          node,
          eventKind: fx.eventKindById(node.eventId),
          rng: createRng(node.id).derive("card"),
        }),
      );
      setStep("info");
    } else {
      setPendingInfo(null);
      setStep("event");
    }
  }

  function selectCard(cardId: CardId) {
    setSelectedCardId(cardId);
    const card = fx.cardById(cardId);
    const nodeId = selectedNodeId ?? currentNodeId;
    const evaluation = evaluatePartyInfoCard({
      card,
      party: fx.party,
      cardRng: createRng(nodeId).derive("card"),
      trustRng: createRng(nodeId).derive("trust"),
    });
    setReactions(toInfoReactionsView(evaluation));
  }

  // I1 전까지 resolveEventChoice의 HP·골드·신뢰 결과는 적용하지 않는다.
  // docs/superpowers/specs/2026-08-15-lattebun-u2-map-info-event-design.md
  // "범위 > 제외": 실제 전이·정산 반영은 I1 소관이다.
  function advanceEvent() {
    if (selectedNodeId !== null) {
      setVisited((prev) => (prev.includes(selectedNodeId) ? prev : [...prev, selectedNodeId]));
    }
    setSelectedNodeId(null);
    setStep("map");
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-3 p-4 text-parchment">
      <CampaignHeader view={fx.headerView} />

      {step === "map" ? (
        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
          <DungeonMapView
            view={mapView}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onEnterNode={enterNode}
          />
          <PartyStatusSidebar members={partyStatus} />
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-3">
            {step === "info" && pendingInfo !== null ? (
              <InfoOpportunityPanel
                view={toInfoOpportunityView(pendingInfo, fx.cardById, activeNode, event, fx.party)}
                selectedCardId={selectedCardId}
                onSelectCard={selectCard}
              />
            ) : null}
            {step === "info" && selectedCardId !== null ? (
              <button
                type="button"
                onClick={() => setStep("event")}
                className="rounded border border-edge px-3 py-2 text-sm text-parchment hover:bg-edge"
              >
                정보 반응 완료 · 별도 사건 행동 →
              </button>
            ) : null}
            {step === "event" ? (
              <EventActions
                view={toEventView(event, fx.headerView.currentGold, fx.itemById)}
                selectedChoiceId={selectedChoiceId}
                onSelectChoice={setSelectedChoiceId}
                onAdvance={advanceEvent}
              />
            ) : null}
          </div>
          {step === "event"
            ? <PartyStatusSidebar members={partyStatus} />
            : <PartyReactionSidebar reactions={reactions} />}
        </div>
      )}
    </main>
  );
}
