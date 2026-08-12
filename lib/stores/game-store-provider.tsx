"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useState,
} from "react";
import { useStore } from "zustand";
import type { RunState } from "@/lib/domain";
import {
  createRunStore,
  type RunStore,
  type RunStoreApi,
} from "@/lib/stores/run-store";
import {
  createUiStore,
  type UiStore,
  type UiStoreApi,
} from "@/lib/stores/ui-store";

const RunStoreContext = createContext<RunStoreApi | null>(null);
const UiStoreContext = createContext<UiStoreApi | null>(null);

interface GameStoreProviderProps {
  initialRun: RunState;
  children: ReactNode;
}

export function GameStoreProvider({
  initialRun,
  children,
}: GameStoreProviderProps) {
  const [runStore] = useState<RunStoreApi>(() => createRunStore(initialRun));
  const [uiStore] = useState<UiStoreApi>(() => createUiStore());

  return (
    <RunStoreContext.Provider value={runStore}>
      <UiStoreContext.Provider value={uiStore}>
        {children}
      </UiStoreContext.Provider>
    </RunStoreContext.Provider>
  );
}

export function useRunStore<T>(selector: (state: RunStore) => T): T {
  const store = useContext(RunStoreContext);

  if (store === null) {
    throw new Error(
      "useRunStore는 GameStoreProvider 안에서 호출해야 합니다.",
    );
  }

  return useStore(store, selector);
}

export function useUiStore<T>(selector: (state: UiStore) => T): T {
  const store = useContext(UiStoreContext);

  if (store === null) {
    throw new Error(
      "useUiStore는 GameStoreProvider 안에서 호출해야 합니다.",
    );
  }

  return useStore(store, selector);
}
