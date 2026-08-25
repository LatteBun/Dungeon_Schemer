"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useStore } from "zustand";
import {
  createPlayerProgressStore,
} from "@/lib/store/player-progress-store";
import { acquirePlayerProgressStorage } from "@/lib/achievements/player-progress-storage";
import type {
  PlayerProgressStore,
  PlayerProgressStoreState,
} from "@/lib/store/player-progress-store";

const StoreContext = createContext<PlayerProgressStore | null>(null);

export function PlayerProgressProvider({ children }: { readonly children: React.ReactNode }) {
  const [store] = useState(() => createPlayerProgressStore());

  useEffect(() => {
    store.getState().hydrate(acquirePlayerProgressStorage(window));
  }, [store]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function usePlayerProgressStore<T>(selector: (state: PlayerProgressStoreState) => T): T {
  const store = useContext(StoreContext);
  if (store === null) throw new Error("PlayerProgressProvider 안에서만 쓸 수 있다");
  return useStore(store, selector);
}
