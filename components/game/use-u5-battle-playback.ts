"use client";

import { useEffect, useState } from "react";
import type { U5BattleReplay, U5BattleReplayFrame, U5BattleReplayPhase } from "./u5-battle-replay";

const FRAME_DURATION_MS: Readonly<Record<U5BattleReplayPhase, number>> = {
  idle: 500,
  attack: 360,
  impact: 420,
  settle: 520,
  complete: 0,
};

export interface U5BattlePlayback {
  readonly frame: U5BattleReplayFrame | undefined;
  readonly frameIndex: number;
  readonly isComplete: boolean;
  readonly skipToComplete: () => void;
  readonly replayFromStart: () => void;
}

export function u5ReplaySignature(replay: U5BattleReplay | undefined): string {
  if (replay === undefined) return "none";
  return [
    replay.frames.length,
    replay.outcome,
    replay.termination,
    replay.participants
      .map((one) => `${one.id}@${one.initialHp}/${one.finalHp}`)
      .join(","),
    replay.frames
      .map((one) => [
        one.phase,
        one.actionIndex,
        one.actorId,
        one.targetId,
        one.damage,
        Object.entries(one.hpByParticipantId).map(([id, hp]) => `${id}@${hp}`).join(";"),
        one.defeatedParticipantIds.join(";"),
      ].join(":"))
      .join(","),
  ].join("|");
}

export function nextU5BattleFrameIndex(replay: U5BattleReplay, current: number): number {
  return Math.min(current + 1, Math.max(0, replay.frames.length - 1));
}

export function useU5BattlePlayback(replay: U5BattleReplay | undefined): U5BattlePlayback {
  const signature = u5ReplaySignature(replay);
  const [playback, setPlayback] = useState({ signature, frameIndex: 0 });
  const frameIndex = playback.signature === signature ? playback.frameIndex : 0;
  const frame = replay?.frames[Math.min(frameIndex, replay.frames.length - 1)];

  useEffect(() => {
    if (replay === undefined || frame === undefined || frame.phase === "complete") return;
    const timeout = window.setTimeout(
      () => setPlayback((current) => ({
        signature,
        frameIndex: nextU5BattleFrameIndex(replay, current.signature === signature ? current.frameIndex : 0),
      })),
      FRAME_DURATION_MS[frame.phase],
    );
    return () => window.clearTimeout(timeout);
  }, [frame?.phase, frameIndex, replay?.frames.length, signature]);

  return {
    frame,
    frameIndex,
    isComplete: frame?.phase === "complete",
    skipToComplete: () => setPlayback({
      signature,
      frameIndex: Math.max(0, (replay?.frames.length ?? 1) - 1),
    }),
    replayFromStart: () => setPlayback({ signature, frameIndex: 0 }),
  };
}
