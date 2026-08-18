"use client";

import { useMemo, useState } from "react";
import { CampaignHeader } from "@/components/game/CampaignHeader";
import { DungeonMapView } from "@/components/game/DungeonMapView";
import { EncounterScenePanel } from "@/components/game/EncounterScenePanel";
import { EventActions } from "@/components/game/EventActions";
import { InfoCardChoices } from "@/components/game/InfoCardChoices";
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
import { GRADES } from "@/lib/domain";
import type { CardId, ChoiceId, Grade, NodeId, PendingInfo } from "@/lib/domain";
import type { MemberReactionView } from "@/components/game/expedition-view-model";
import { u2Fixture } from "./u2-fixtures";

type Step = "map" | "info" | "event";

export default function U2TestPage() {
  const [grade, setGrade] = useState<Grade>("C");
  const fx = useMemo(() => u2Fixture(grade), [grade]);
  const [step, setStep] = useState<Step>("map");
  const [currentNodeId, setCurrentNodeId] = useState<NodeId>(fx.currentNodeId);
  const [visited, setVisited] = useState<NodeId[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<NodeId | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<CardId | null>(null);
  const [reactions, setReactions] = useState<MemberReactionView[]>([]);
  const [selectedChoiceId, setSelectedChoiceId] = useState<ChoiceId | null>(null);
  const [pendingInfo, setPendingInfo] = useState<PendingInfo | null>(null);

  // 등급을 바꾸면 지도가 통째로 달라지므로 걷던 상태를 모두 되돌린다. 남겨 두면
  // 이전 지도의 지점 ID를 가리켜 화면이 깨진다.
  function changeGrade(next: Grade): void {
    const fixture = u2Fixture(next);
    setGrade(next);
    setStep("map");
    setCurrentNodeId(fixture.currentNodeId);
    setVisited([]);
    setSelectedNodeId(null);
    setSelectedCardId(null);
    setReactions([]);
    setSelectedChoiceId(null);
    setPendingInfo(null);
  }

  const activeNode = fx.map.nodes.find((node) => node.id === (selectedNodeId ?? currentNodeId))!;
  const event = fx.eventById(activeNode.eventId);

  const mapView = toMapView(fx.map, currentNodeId, visited, fx.eventKindById);
  const partyStatus = toPartyStatusView(fx.party);
  const infoView =
    pendingInfo === null
      ? null
      : toInfoOpportunityView(pendingInfo, fx.cardById, activeNode, event, fx.party);
  const eventView = toEventView(event, fx.headerView.currentGold, fx.itemById);

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
          event: fx.eventById(node.eventId),
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
      <CampaignHeader title="U2 하네스 · 지도·정보·사건" view={fx.headerView} />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">등급</span>
        {GRADES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === grade}
            onClick={() => changeGrade(option)}
            className={
              "rounded border px-3 py-1 "
              + (option === grade
                ? "border-trust-up text-trust-up"
                : "border-edge text-muted hover:bg-edge")
            }
          >
            {option}급
          </button>
        ))}
        <span className="text-xs text-muted">
          경로 {fx.map.regularEventCount}칸 · 지점 {fx.map.nodes.length}개
        </span>
      </div>

      {step === "map" ? (
        <div className="grid gap-3 lg:grid-cols-[1fr_18rem]">
              <DungeonMapView
            view={mapView}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />
          <PartyStatusSidebar
            members={partyStatus}
            footer={
              <button
                type="button"
                disabled={selectedNodeId === null}
                onClick={enterNode}
                className="w-full rounded border border-edge px-3 py-2 text-sm text-parchment enabled:hover:bg-edge disabled:opacity-40"
              >
                선택 지점 입장 · 정보 기회 →
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
          <div className="flex flex-col gap-3">
            {step === "info" && infoView !== null ? (
              <>
                <EncounterScenePanel
                  title={event.title}
                  sceneText={infoView.scene.sceneText}
                  riskSummary={infoView.scene.riskSummary}
                  memberNames={infoView.scene.memberNames}
                />
                <InfoCardChoices
                  cards={infoView.cards}
                  selectedCardId={selectedCardId}
                  onSelectCard={selectCard}
                />
              </>
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
              <>
                <EncounterScenePanel
                  title={eventView.title}
                  sceneText={eventView.description}
                  riskSummary={eventView.riskSummary}
                  memberNames={fx.party.map((member) => ({
                    id: member.id,
                    name: member.name,
                    alive: member.alive,
                  }))}
                />
                <EventActions
                  view={eventView}
                  selectedChoiceId={selectedChoiceId}
                  onSelectChoice={setSelectedChoiceId}
                  onAdvance={advanceEvent}
                />
              </>
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
