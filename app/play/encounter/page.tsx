"use client";

import { useState } from "react";
import { EventActions } from "@/components/game/EventActions";
import { InfoOpportunityPanel } from "@/components/game/InfoOpportunityPanel";
import {
  toEventView,
  toInfoOpportunityView,
} from "@/components/game/expedition-view-model";
import type { ChoiceId } from "@/lib/domain";
import { useCampaignStore } from "@/lib/stores/campaign-store-provider";
import { usePhaseGuard } from "../phase-route";
import {
  CAMPAIGN_CONTEXT,
  useCampaignDispatch,
} from "../play-campaign-provider";

/** 항상 스토어의 현재 노드 이벤트를 보여준다. URL에 노드를 담지 않는다. */
export default function EncounterPage() {
  const campaign = useCampaignStore((store) => store.campaign);
  const dispatch = useCampaignDispatch();
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

    return (
      <InfoOpportunityPanel
        view={toInfoOpportunityView(
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
        )}
        selectedCardId={null}
        onSelectCard={(cardId) =>
          dispatch({ type: "chooseInfoCard", cardId })
        }
      />
    );
  }

  const pending = expedition.pendingEvent;
  const event = pending === null
    ? undefined
    : CAMPAIGN_CONTEXT.eventById.get(pending.eventId as string);
  if (pending === null || event === undefined) {
    throw new Error("사건 화면의 캠페인 데이터가 올바르지 않습니다.");
  }

  return (
    <EventActions
      view={toEventView(
        event,
        campaign.currentGold,
        (itemId) => CAMPAIGN_CONTEXT.items.find(
          (candidate) => candidate.id === itemId,
        ),
      )}
      selectedChoiceId={selectedChoiceId}
      onSelectChoice={setSelectedChoiceId}
      onAdvance={() => {
        if (selectedChoiceId !== null) {
          dispatch({ type: "chooseEvent", choiceId: selectedChoiceId });
        }
      }}
    />
  );
}
