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
}

export interface U5BattlePlayback {
  readonly frame: U5BattleReplayFrame | undefined;
  readonly frameIndex: number;
  readonly isComplete: boolean;
  readonly skipToComplete: () => void;
  readonly replayFromStart: () => void;
}

export interface U5BattlePlaybackRateControl {
  readonly playbackRate: U5BattlePlaybackRate;
  readonly togglePlaybackRate: () => void;
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
  return playback.signature === signature ? playback : { signature, frameIndex: 0 };
}

export function nextU5BattlePlaybackRate(current: U5BattlePlaybackRate): U5BattlePlaybackRate {
  return current === 1 ? 2 : 1;
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
  return nextU5BattleFrameIndexForLength(replay.frames.length, current);
}

export function nextU5BattleFrameIndexForLength(frameCount: number, current: number): number {
  return Math.min(current + 1, Math.max(0, frameCount - 1));
}

export function useU5BattlePlayback(
  replay: U5BattleReplay | undefined,
  playbackRate: U5BattlePlaybackRate,
): U5BattlePlayback {
  const signature = u5ReplaySignature(replay);
  const [playback, setPlayback] = useState<U5BattlePlaybackState>({ signature, frameIndex: 0 });
  const activePlayback = u5BattlePlaybackForSignature(playback, signature);
  const { frameIndex } = activePlayback;
  const frame = replay?.frames[Math.min(frameIndex, replay.frames.length - 1)];
  const framePhase = frame?.phase;
  const frameCount = replay?.frames.length ?? 0;

  useEffect(() => {
    if (framePhase === undefined || framePhase === "complete") return;
    const timeout = window.setTimeout(
      () => setPlayback((current) => {
        const currentPlayback = u5BattlePlaybackForSignature(current, signature);
        return {
          ...currentPlayback,
          frameIndex: nextU5BattleFrameIndexForLength(frameCount, currentPlayback.frameIndex),
        };
      }),
      u5BattleFrameDurationMs(framePhase, playbackRate),
    );
    return () => window.clearTimeout(timeout);
  }, [frameCount, frameIndex, framePhase, playbackRate, signature]);

  return {
    frame,
    frameIndex,
    isComplete: frame?.phase === "complete",
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
