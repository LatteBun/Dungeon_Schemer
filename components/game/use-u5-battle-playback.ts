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

export type U5BattlePlaybackRate = 1 | 2;

export interface U5BattlePlaybackState {
  readonly signature: string;
  readonly frameIndex: number;
  readonly playbackRate: U5BattlePlaybackRate;
}

export interface U5BattlePlayback {
  readonly frame: U5BattleReplayFrame | undefined;
  readonly frameIndex: number;
  readonly playbackRate: U5BattlePlaybackRate;
  readonly isComplete: boolean;
  readonly togglePlaybackRate: () => void;
  readonly skipToComplete: () => void;
  readonly replayFromStart: () => void;
}

export function u5BattleFrameDurationMs(
  phase: U5BattleReplayPhase,
  playbackRate: U5BattlePlaybackRate,
): number {
  return FRAME_DURATION_MS[phase] / playbackRate;
}

export function u5BattlePlaybackForSignature(
  playback: U5BattlePlaybackState,
  signature: string,
): U5BattlePlaybackState {
  return playback.signature === signature ? playback : { signature, frameIndex: 0, playbackRate: 1 };
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

export function useU5BattlePlayback(replay: U5BattleReplay | undefined): U5BattlePlayback {
  const signature = u5ReplaySignature(replay);
  const [playback, setPlayback] = useState<U5BattlePlaybackState>({ signature, frameIndex: 0, playbackRate: 1 });
  const activePlayback = u5BattlePlaybackForSignature(playback, signature);
  const { frameIndex, playbackRate } = activePlayback;
  const frame = replay?.frames[Math.min(frameIndex, replay.frames.length - 1)];

  useEffect(() => {
    if (replay === undefined || frame === undefined || frame.phase === "complete") return;
    const timeout = window.setTimeout(
      () => setPlayback((current) => {
        const currentPlayback = u5BattlePlaybackForSignature(current, signature);
        return {
          ...currentPlayback,
          frameIndex: nextU5BattleFrameIndex(replay, currentPlayback.frameIndex),
        };
      }),
      u5BattleFrameDurationMs(frame.phase, playbackRate),
    );
    return () => window.clearTimeout(timeout);
  }, [frame, frameIndex, playbackRate, replay, signature]);

  return {
    frame,
    frameIndex,
    playbackRate,
    isComplete: frame?.phase === "complete",
    togglePlaybackRate: () => setPlayback((current) => {
      const currentPlayback = u5BattlePlaybackForSignature(current, signature);
      return {
        ...currentPlayback,
        playbackRate: currentPlayback.playbackRate === 1 ? 2 : 1,
      };
    }),
    skipToComplete: () => setPlayback((current) => ({
      ...u5BattlePlaybackForSignature(current, signature),
      frameIndex: Math.max(0, (replay?.frames.length ?? 1) - 1),
    })),
    replayFromStart: () => setPlayback((current) => ({
      ...u5BattlePlaybackForSignature(current, signature),
      frameIndex: 0,
    })),
  };
}
