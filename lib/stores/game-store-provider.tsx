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

/**
 * UI 상태만 필요한 화면을 위해 런 스토어와 떼어 놓는다.
 * app/play 는 아직 런을 스토어에 넣지 않는다. 그 배선은 P1의 몫이다.
 */
export function UiStoreProvider({ children }: { children: ReactNode }) {
  const [uiStore] = useState<UiStoreApi>(() => createUiStore());

  return (
    <UiStoreContext.Provider value={uiStore}>
      {children}
    </UiStoreContext.Provider>
  );
}

export function GameStoreProvider({
  initialRun,
  children,
}: GameStoreProviderProps) {
  const [runStore] = useState<RunStoreApi>(() => createRunStore(initialRun));

  return (
    <RunStoreContext.Provider value={runStore}>
      <UiStoreProvider>{children}</UiStoreProvider>
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
      "useUiStore는 UiStoreProvider 또는 GameStoreProvider 안에서 호출해야 합니다.",
    );
  }

  return useStore(store, selector);
}
