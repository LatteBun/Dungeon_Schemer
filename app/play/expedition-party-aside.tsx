"use client";

import type { ReactNode } from "react";
import { PartyStatusSidebar } from "@/components/game/PartyStatusSidebar";
import { toPartyStatusView } from "@/components/game/expedition-view-model";
import { useCampaignStore } from "@/lib/stores/campaign-store-provider";

/**
 * 출전 파티 상태. 오른쪽 패널은 화면마다 다르므로 셸이 아니라
 * 필요한 라우트가 직접 놓는다.
 */
export function ExpeditionPartyAside({ footer }: { footer?: ReactNode }) {
  const campaign = useCampaignStore((store) => store.campaign);
  const trustDeltas = useCampaignStore((store) => store.lastTrustDeltas);
  const expedition = campaign.expedition;
  const party = expedition === null
    ? undefined
    : campaign.parties.find((candidate) => candidate.id === expedition.partyId);
  const participantIds = new Set((party?.memberIds ?? []).map(String));
  const participants = campaign.members.filter((member) =>
    participantIds.has(member.id as string),
  );

  if (participants.length === 0) return null;

  return (
    <PartyStatusSidebar
      members={toPartyStatusView(participants, trustDeltas ?? {})}
      footer={footer}
    />
  );
}
