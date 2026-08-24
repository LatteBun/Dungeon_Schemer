import { createStore } from "zustand/vanilla";
import {
  clearPlayerProgress,
  loadPlayerProgress,
  savePlayerProgress,
} from "@/lib/achievements/player-progress-storage";
import {
  createEmptyPlayerProgress,
  recordCompletedCampaign,
} from "@/lib/achievements/player-progress";
import type { CompletedCampaignRecord, PlayerProgressV1 } from "@/lib/achievements/player-progress";
import type { StringStorage } from "@/lib/achievements/player-progress-storage";

export interface PlayerProgressStoreState {
  readonly progress: PlayerProgressV1;
  readonly status: "loading" | "ready" | "recovered" | "unavailable";
  readonly message: string | null;
  hydrate(storage: StringStorage): void;
  record(record: CompletedCampaignRecord, unlockedAt: string): void;
  clear(): void;
}

export type PlayerProgressStore = ReturnType<typeof createPlayerProgressStore>;

export function createPlayerProgressStore() {
  let storage: StringStorage | null = null;
  let corruptRaw: string | undefined;

  return createStore<PlayerProgressStoreState>((set, get) => ({
    progress: createEmptyPlayerProgress(),
    status: "loading",
    message: null,

    hydrate(nextStorage) {
      storage = nextStorage;
      const result = loadPlayerProgress(nextStorage);
      corruptRaw = result.status === "recovered" ? result.corruptRaw : undefined;

      switch (result.status) {
        case "ready":
        case "empty":
          set({ progress: result.progress, status: "ready", message: null });
          return;
        case "recovered":
          set({
            progress: result.progress,
            status: "recovered",
            message: "손상된 업적 기록을 빈 기록으로 복구했습니다.",
          });
          return;
        case "unavailable":
          set({ status: "unavailable", message: result.reason });
      }
    },

    record(record, unlockedAt) {
      const progress = recordCompletedCampaign(get().progress, record, unlockedAt);
      set({ progress });

      if (storage === null || get().status === "unavailable") return;
      const result = savePlayerProgress(storage, progress, corruptRaw);
      if (!result.ok) {
        set({ status: "unavailable", message: result.reason });
        return;
      }
      corruptRaw = undefined;
    },

    clear() {
      const progress = createEmptyPlayerProgress();
      if (storage === null || get().status === "unavailable") {
        set({ progress });
        return;
      }

      const result = clearPlayerProgress(storage);
      if (!result.ok) {
        set({ progress, status: "unavailable", message: result.reason });
        return;
      }
      corruptRaw = undefined;
      set({ progress, status: "ready", message: null });
    },
  }));
}
