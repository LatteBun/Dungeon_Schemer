"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  nextU5BattlePlaybackRate,
  type U5BattlePlaybackRate,
  type U5BattlePlaybackRateControl,
} from "./use-u5-battle-playback";

const PlaybackRateContext = createContext<U5BattlePlaybackRateControl | null>(null);

export function AppBattlePlaybackRateProvider({ children }: { readonly children: ReactNode }) {
  const [playbackRate, setPlaybackRate] = useState<U5BattlePlaybackRate>(1);
  const value = useMemo<U5BattlePlaybackRateControl>(() => ({
    playbackRate,
    togglePlaybackRate: () => setPlaybackRate(nextU5BattlePlaybackRate),
  }), [playbackRate]);

  return <PlaybackRateContext.Provider value={value}>{children}</PlaybackRateContext.Provider>;
}

export function useAppBattlePlaybackRate(): U5BattlePlaybackRateControl {
  const control = useContext(PlaybackRateContext);
  if (control === null) {
    throw new Error("AppBattlePlaybackRateProvider 안에서만 쓸 수 있다");
  }
  return control;
}
