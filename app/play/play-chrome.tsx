"use client";

import type { ReactNode } from "react";
import { CampaignHeader } from "@/components/game/CampaignHeader";
import {
  toCampaignHeaderView,
  toScreenTitle,
} from "@/components/game/campaign-view-model";
import { useCampaignStore } from "@/lib/stores/campaign-store-provider";

/** 모든 캠페인 화면에 영구 진행을 유지한다. 레이아웃은 각 라우트가 소유한다. */
export function PlayChrome({ children }: { children: ReactNode }) {
  const campaign = useCampaignStore((store) => store.campaign);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-3 p-3">
      <CampaignHeader
        title={toScreenTitle(campaign)}
        view={toCampaignHeaderView(campaign)}
      />
      <main className="flex flex-1 flex-col gap-3">{children}</main>
    </div>
  );
}
