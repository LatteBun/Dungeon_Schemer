"use client";

import { type ReactNode, useEffect, useState } from "react";
import { BOSSES } from "@/lib/content/bosses";
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
import { INFO_CARDS } from "@/lib/content/info-cards";
import { ITEMS } from "@/lib/content/items";
import { createCampaignMachineContext } from "@/lib/flow/campaign-machine";
import type { CampaignAction } from "@/lib/flow/campaign-machine";
import { createSeed } from "@/lib/rng";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import {
  CampaignStoreProvider,
  useCampaignStore,
} from "@/lib/stores/campaign-store-provider";
import type { CampaignState } from "@/lib/domain";

export const CAMPAIGN_CONTEXT = createCampaignMachineContext({
  events: DUNGEON_EVENT_POOLS,
  cards: INFO_CARDS,
  items: ITEMS,
  bosses: BOSSES,
});

/**
 * /play 화면 흐름에 실제 캠페인을 공급한다.
 *
 * 시드는 URL의 ?seed=로 재현하고 없으면 무작위다. 레이아웃은 URL 쿼리를
 * 받지 못하고 서버는 무작위 시드를 미리 알 수 없으므로, 마운트 후에
 * 초기화해 hydration 불일치를 피한다.
 */
export function PlayCampaignProvider({ children }: { children: ReactNode }) {
  const [initial, setInitial] = useState<CampaignState | null>(null);

  useEffect(() => {
    const seedParam = new URLSearchParams(window.location.search).get("seed");
    const seed =
      seedParam === null || seedParam.trim() === "" ? createSeed() : seedParam;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInitial(initializeCampaign(seed));
  }, []);

  if (initial === null) {
    return (
      <p className="p-6 text-center text-sm text-muted">캠페인을 준비하는 중…</p>
    );
  }

  return (
    <CampaignStoreProvider initialCampaign={initial} context={CAMPAIGN_CONTEXT}>
      {children}
    </CampaignStoreProvider>
  );
}

/**
 * 화면의 모든 상태 변경이 지나는 단일 통로다. 화면은 유효한 행동만
 * 제시하므로 여기서 던져진 오류는 화면 버그다. 삼키지 않는다.
 */
export function useCampaignDispatch(): (action: CampaignAction) => void {
  return useCampaignStore((store) => store.dispatch);
}
