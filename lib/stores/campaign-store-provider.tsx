"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import { useStore } from "zustand";
import type { CampaignMachineContext } from "@/lib/flow/campaign-machine";
import type { CampaignState } from "@/lib/domain";
import {
  createCampaignStore,
  type CampaignStore,
  type CampaignStoreApi,
} from "./campaign-store";

const CampaignStoreContext = createContext<CampaignStoreApi | null>(null);

interface CampaignStoreProviderProps {
  initialCampaign: CampaignState;
  context: CampaignMachineContext;
  children: ReactNode;
}

export function CampaignStoreProvider({
  initialCampaign,
  context,
  children,
}: CampaignStoreProviderProps) {
  const [store] = useState<CampaignStoreApi>(() =>
    createCampaignStore(initialCampaign, context),
  );

  return (
    <CampaignStoreContext.Provider value={store}>
      {children}
    </CampaignStoreContext.Provider>
  );
}

export function useCampaignStore<T>(selector: (state: CampaignStore) => T): T {
  const store = useContext(CampaignStoreContext);

  if (store === null) {
    throw new Error(
      "useCampaignStore는 CampaignStoreProvider 안에서 호출해야 합니다.",
    );
  }

  return useStore(store, selector);
}
