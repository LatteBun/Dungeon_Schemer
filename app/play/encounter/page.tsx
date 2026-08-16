"use client";

import { useState } from "react";
import { EncounterScenePanel } from "@/components/game/EncounterScenePanel";
import { EventActions } from "@/components/game/EventActions";
import { InfoCardChoices } from "@/components/game/InfoCardChoices";
import { PartyReactionSidebar } from "@/components/game/PartyReactionSidebar";
import {
  toEventView,
  toInfoOpportunityView,
  type MemberReactionView,
} from "@/components/game/expedition-view-model";
import type { CardId, ChoiceId } from "@/lib/domain";
import { useCampaignStore } from "@/lib/stores/campaign-store-provider";
import { ExpeditionPartyAside } from "../expedition-party-aside";
import { usePhaseGuard } from "../phase-route";
import {
  CAMPAIGN_CONTEXT,
  useCampaignDispatch,
} from "../play-campaign-provider";
import { prepareInfoCardReview } from "./info-review";

/** 항상 스토어의 현재 노드 이벤트를 보여준다. URL에 노드를 담지 않는다. */
export default function EncounterPage() {
  const campaign = useCampaignStore((store) => store.campaign);
  const rememberTrustDeltas = useCampaignStore(
    (store) => store.rememberTrustDeltas,
  );
  const dispatch = useCampaignDispatch();
  const [selectedCardId, setSelectedCardId] = useState<CardId | null>(null);
  const [reactions, setReactions] = useState<MemberReactionView[]>([]);
  const [selectedChoiceId, setSelectedChoiceId] = useState<ChoiceId | null>(null);
  const matches = usePhaseGuard(["infoOpportunity", "event"]);
  const expedition = campaign.expedition;
  if (!matches || expedition === null) return null;

  const party = campaign.parties.find(
    (candidate) => candidate.id === expedition.partyId,
  );
  const memberIds = new Set((party?.memberIds ?? []).map(String));
  const participants = campaign.members.filter((member) =>
    memberIds.has(member.id as string),
  );

  if (campaign.phase === "infoOpportunity") {
    const pending = expedition.pendingInfo;
    const node = expedition.map.nodes.find(
      (candidate) => candidate.id === pending?.nodeId,
    );
    const event = node === undefined
      ? undefined
      : CAMPAIGN_CONTEXT.eventById.get(node.eventId as string);
    if (pending === null || node === undefined || event === undefined) {
      throw new Error("정보 전달 화면의 캠페인 데이터가 올바르지 않습니다.");
    }

    const infoView = toInfoOpportunityView(
      pending,
      (cardId) => {
        const card = CAMPAIGN_CONTEXT.cards.find(
          (candidate) => candidate.id === cardId,
        );
        if (card === undefined) {
          throw new Error(`콘텐츠에 없는 카드입니다: ${cardId}`);
        }
        return card;
      },
      node,
      event,
      participants,
    );

    return (
      <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-3">
          <EncounterScenePanel
            title={event.title}
            sceneText={infoView.scene.sceneText}
            riskSummary={infoView.scene.riskSummary}
            memberNames={infoView.scene.memberNames}
          />
          <InfoCardChoices
            cards={infoView.cards}
            selectedCardId={selectedCardId}
            onSelectCard={(cardId) => {
              const review = prepareInfoCardReview(
                campaign,
                cardId,
                CAMPAIGN_CONTEXT,
              );
              setSelectedCardId(review.selectedCardId);
              setReactions(review.reactions);
              rememberTrustDeltas(
                Object.fromEntries(
                  review.reactions.map((reaction) => [
                    reaction.memberId as string,
                    reaction.trustDelta,
                  ]),
                ),
              );
            }}
          />
          {selectedCardId === null ? null : (
            <button
              type="button"
              onClick={() => {
                const cardId = selectedCardId;
                setSelectedCardId(null);
                setReactions([]);
                dispatch({ type: "chooseInfoCard", cardId });
              }}
              className="rounded border border-edge px-3 py-2 text-sm text-parchment hover:bg-edge"
            >
              정보 반응 확인 완료 · 사건 행동으로 →
            </button>
          )}
        </div>
        <PartyReactionSidebar reactions={reactions} />
      </div>
    );
  }

  const pending = expedition.pendingEvent;
  const event = pending === null
    ? undefined
    : CAMPAIGN_CONTEXT.eventById.get(pending.eventId as string);
  if (pending === null || event === undefined) {
    throw new Error("사건 화면의 캠페인 데이터가 올바르지 않습니다.");
  }

  const eventView = toEventView(
    event,
    campaign.currentGold,
    (itemId) => CAMPAIGN_CONTEXT.items.find(
      (candidate) => candidate.id === itemId,
    ),
  );

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-3">
        <EncounterScenePanel
          title={eventView.title}
          sceneText={eventView.description}
          riskSummary={eventView.riskSummary}
          memberNames={participants.map((member) => ({
            id: member.id,
            name: member.name,
            alive: member.alive,
          }))}
        />
        <EventActions
          view={eventView}
          selectedChoiceId={selectedChoiceId}
          onSelectChoice={setSelectedChoiceId}
          onAdvance={() => {
            if (selectedChoiceId !== null) {
              dispatch({ type: "chooseEvent", choiceId: selectedChoiceId });
            }
          }}
        />
      </div>
      <ExpeditionPartyAside />
    </div>
  );
}
