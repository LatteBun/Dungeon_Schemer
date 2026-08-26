"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useStore } from "zustand";
import { acquireAudioSettingsStorage } from "@/lib/audio/audio-settings-storage";
import { createBrowserAudioPlayback } from "@/lib/audio/audio-playback";
import { createAudioSettingsStore } from "@/lib/store/audio-settings-store";
import type {
  AudioSettingsStore,
  AudioSettingsStoreState,
} from "@/lib/store/audio-settings-store";

const StoreContext = createContext<AudioSettingsStore | null>(null);

export function AppAudioProvider({ children }: { readonly children: React.ReactNode }) {
  const [store] = useState(() => createAudioSettingsStore());

  useEffect(() => {
    const playback = createBrowserAudioPlayback();
    store.getState().attachPlayback(playback);
    store.getState().hydrate(acquireAudioSettingsStorage(window));
    const resumeVisibleBgm = () => {
      if (document.visibilityState === "visible") {
        void store.getState().resumeBgmAfterVisibility();
      }
    };
    document.addEventListener("visibilitychange", resumeVisibleBgm);
    return () => {
      document.removeEventListener("visibilitychange", resumeVisibleBgm);
      playback.dispose();
    };
  }, [store]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useAppAudioStore<T>(selector: (state: AudioSettingsStoreState) => T): T {
  const store = useContext(StoreContext);
  if (store === null) throw new Error("AppAudioProvider 안에서만 쓸 수 있다");
  return useStore(store, selector);
}
