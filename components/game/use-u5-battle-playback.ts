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
  return JSON.stringify({
    outcome: replay.outcome,
    termination: replay.termination,
    participants: replay.participants.map((one) => ({
      id: one.id,
      side: one.side,
      name: one.name,
      imageSrc: one.imageSrc,
      maxHp: one.maxHp,
      initialHp: one.initialHp,
      finalHp: one.finalHp,
    })),
    frames: replay.frames.map((one) => ({
      phase: one.phase,
      actionIndex: one.actionIndex,
      actorId: one.actorId,
      targetId: one.targetId,
      damage: one.damage,
      hpByParticipantId: Object.entries(one.hpByParticipantId).sort(([left], [right]) => left.localeCompare(right)),
      defeatedParticipantIds: [...one.defeatedParticipantIds].sort(),
      cues: one.cues.map((cue) => ({
        characterId: cue.characterId,
        axis: cue.axis,
        direction: cue.direction,
        presentationKey: cue.presentationKey,
      })),
    })),
    verifications: replay.verifications.map((one) => ({
      characterId: one.characterId,
      action: one.action,
      applied: one.applied,
    })),
  });
}

export function nextU5BattleFrameIndex(replay: U5BattleReplay, current: number): number {
  return Math.min(current + 1, Math.max(0, replay.frames.length - 1));
}

export function shouldAdvanceU5BattleFrame(
  frame: U5BattleReplayFrame | undefined,
  playing: boolean,
): boolean {
  return playing && frame !== undefined && frame.phase !== "complete";
}

export function useU5BattlePlayback(replay: U5BattleReplay | undefined, playing = true): U5BattlePlayback {
  const signature = u5ReplaySignature(replay);
  const [playback, setPlayback] = useState({ signature, frameIndex: 0 });
  const frameIndex = playback.signature === signature ? playback.frameIndex : 0;
  const frame = replay?.frames[Math.min(frameIndex, replay.frames.length - 1)];

  useEffect(() => {
    if (replay === undefined || frame === undefined || !shouldAdvanceU5BattleFrame(frame, playing)) return;
    const timeout = window.setTimeout(
      () => setPlayback((current) => ({
        signature,
        frameIndex: nextU5BattleFrameIndex(replay, current.signature === signature ? current.frameIndex : 0),
      })),
      FRAME_DURATION_MS[frame.phase],
    );
    return () => window.clearTimeout(timeout);
  }, [frame?.phase, frameIndex, playing, replay?.frames.length, signature]);

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
