import type { RunState } from "@/lib/domain";
import { createSeed } from "@/lib/rng";
import { createStore, type StoreApi } from "zustand/vanilla";

export type RunFactory = (seed: string) => RunState;

export interface RunStoreState {
  run: RunState;
}

export interface RunStoreActions {
  replaceRun(nextRun: RunState): void;
  startNewRun(createRun: RunFactory, seed?: string): void;
  resetRun(): void;
}

export type RunStore = RunStoreState & RunStoreActions;
export type RunStoreApi = StoreApi<RunStore>;

export function createRunStore(initialRun: RunState): RunStoreApi {
  return createStore<RunStore>()((set) => ({
    run: initialRun,
    replaceRun: (nextRun) => {
      set({ run: nextRun });
    },
    startNewRun: (createRun, seed) => {
      const chosenSeed = seed ?? createSeed();
      const nextRun = createRun(chosenSeed);

      if (nextRun.seed !== chosenSeed) {
        throw new Error(
          "새 런 시드가 일치하지 않습니다: expected " +
            chosenSeed +
            ", received " +
            nextRun.seed,
        );
      }

      set({ run: nextRun });
    },
    resetRun: () => {
      set({ run: initialRun });
    },
  }));
}
