"use client";

import type { ReactNode } from "react";
import { CampaignHeader } from "@/components/game/CampaignHeader";
import { PartyStatusSidebar } from "@/components/game/PartyStatusSidebar";
import {
  toCampaignHeaderView,
  toScreenTitle,
} from "@/components/game/campaign-view-model";
import { toPartyStatusView } from "@/components/game/expedition-view-model";
import { useCampaignStore } from "@/lib/stores/campaign-store-provider";

/** 모든 캠페인 화면에 영구 진행과 현재 출전 파티를 유지한다. */
export function PlayChrome({ children }: { children: ReactNode }) {
  const campaign = useCampaignStore((store) => store.campaign);
  const expedition = campaign.expedition;
  const party = expedition === null
    ? undefined
    : campaign.parties.find((candidate) => candidate.id === expedition.partyId);
  const participantIds = new Set((party?.memberIds ?? []).map(String));
  const participants = campaign.members.filter((member) =>
    participantIds.has(member.id as string),
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-3 p-3">
      <CampaignHeader
        title={toScreenTitle(campaign)}
        view={toCampaignHeaderView(campaign)}
      />
      <div className="flex flex-1 flex-col gap-3 lg:flex-row">
        <main className="flex flex-1 flex-col gap-3">{children}</main>
        {participants.length === 0 ? null : (
          <aside className="lg:w-72 lg:shrink-0">
            <PartyStatusSidebar members={toPartyStatusView(participants)} />
          </aside>
        )}
      </div>
    </div>
  );
}
