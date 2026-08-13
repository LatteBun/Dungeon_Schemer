"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import type { DungeonEvent } from "@/lib/domain";
import { createInitialRun, type InitialRun } from "@/lib/flow/initial-run";
import { transitionRun, type RunAction } from "@/lib/flow/run-machine";
import { createSeed } from "@/lib/rng";
import {
  GameStoreProvider,
  useRunStore,
} from "@/lib/stores/game-store-provider";

const RunEventsContext = createContext<readonly DungeonEvent[] | null>(null);

/**
 * /play 화면 흐름에 실제 런을 공급한다.
 *
 * 시드는 URL의 ?seed=로 재현하고 없으면 무작위다. 레이아웃은 URL 쿼리를
 * 받지 못하고 서버는 무작위 시드를 미리 알 수 없으므로, 마운트 후에
 * 초기화해 hydration 불일치를 피한다. 준비 전에는 짧은 안내만 보인다.
 * docs/superpowers/specs/2026-08-13-sbh3821-dungeon-map-integration-design.md
 */
export function PlayRunProvider({ children }: { children: ReactNode }) {
  const [initial, setInitial] = useState<InitialRun | null>(null);

  useEffect(() => {
    const seedParam = new URLSearchParams(window.location.search).get("seed");
    const seed =
      seedParam === null || seedParam.trim() === "" ? createSeed() : seedParam;
    // 무작위 시드는 서버가 미리 알 수 없어 마운트 후 한 번의 상태 갱신이
    // 필요하다. 렌더 중 초기화하면 서버와 클라이언트 결과가 달라진다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInitial(createInitialRun(seed));
  }, []);

  if (initial === null) {
    return (
      <p className="p-6 text-center text-sm text-muted">던전을 준비하는 중…</p>
    );
  }

  return (
    <GameStoreProvider initialRun={initial.run}>
      <RunEventsContext.Provider value={initial.events}>
        {children}
      </RunEventsContext.Provider>
    </GameStoreProvider>
  );
}

export function useRunEvents(): readonly DungeonEvent[] {
  const events = useContext(RunEventsContext);
  if (events === null) {
    throw new Error("useRunEvents는 PlayRunProvider 안에서 호출해야 합니다.");
  }
  return events;
}

/**
 * 화면의 모든 상태 변경이 지나는 단일 통로다. P1 transitionRun을 적용해
 * 스토어에 반영한다. 화면은 유효한 행동만 제시하므로 여기서 던져진
 * Error는 화면 버그다. 삼키지 않고 그대로 드러낸다.
 */
export function useRunTransition(): (action: RunAction) => void {
  const events = useRunEvents();
  const run = useRunStore((store) => store.run);
  const replaceRun = useRunStore((store) => store.replaceRun);
  return (action) => {
    replaceRun(transitionRun(run, action, { events }));
  };
}
