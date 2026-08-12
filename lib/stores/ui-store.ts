import type { MemberId } from "@/lib/domain";
import { createStore, type StoreApi } from "zustand/vanilla";

export interface UiStoreState {
  selectedMemberId: MemberId | null;
}

export interface UiStoreActions {
  selectMember(memberId: MemberId): void;
  clearSelectedMember(): void;
  resetUi(): void;
}

export type UiStore = UiStoreState & UiStoreActions;
export type UiStoreApi = StoreApi<UiStore>;

export function createUiStore(): UiStoreApi {
  return createStore<UiStore>()((set) => ({
    selectedMemberId: null,
    selectMember: (memberId) => {
      set({ selectedMemberId: memberId });
    },
    clearSelectedMember: () => {
      set({ selectedMemberId: null });
    },
    resetUi: () => {
      set({ selectedMemberId: null });
    },
  }));
}
