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
  readonly replayingFromStart: boolean;
}

export interface U5BattlePlayback {
  readonly frame: U5BattleReplayFrame | undefined;
  readonly frameIndex: number;
  readonly isComplete: boolean;
  readonly isReplaying: boolean;
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

export function nextU5BattlePlaybackRate(current: U5BattlePlaybackRate): U5BattlePlaybackRate {
  return current === 1 ? 2 : 1;
}

export function useU5BattlePlaybackRate(): U5BattlePlaybackRateControl {
  const [playbackRate, setPlaybackRate] = useState<U5BattlePlaybackRate>(1);

  return {
    playbackRate,
    togglePlaybackRate: () => setPlaybackRate(nextU5BattlePlaybackRate),
  };
}

export function u5BattlePlaybackForSignature(
  playback: U5BattlePlaybackState,
  signature: string,
): U5BattlePlaybackState {
  return playback.signature === signature
    ? playback
    : { signature, frameIndex: 0, replayingFromStart: false };
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

export function replayU5BattlePlayback(
  playback: U5BattlePlaybackState,
  signature: string,
): U5BattlePlaybackState {
  return {
    ...u5BattlePlaybackForSignature(playback, signature),
    frameIndex: 0,
    replayingFromStart: true,
  };
}

export function advanceU5BattlePlayback(
  playback: U5BattlePlaybackState,
  signature: string,
  frameCount: number,
): U5BattlePlaybackState {
  const current = u5BattlePlaybackForSignature(playback, signature);
  const frameIndex = nextU5BattleFrameIndexForLength(frameCount, current.frameIndex);
  return {
    ...current,
    frameIndex,
    replayingFromStart: current.replayingFromStart && frameIndex < frameCount - 1,
  };
}

export function shouldAdvanceU5BattleFrame(
  frame: U5BattleReplayFrame | undefined,
  playing: boolean,
  replayingFromStart = false,
): boolean {
  return (playing || replayingFromStart) && frame !== undefined && frame.phase !== "complete";
}

export function useU5BattlePlayback(
  replay: U5BattleReplay | undefined,
  playbackRate: U5BattlePlaybackRate,
  playing = true,
): U5BattlePlayback {
  const signature = u5ReplaySignature(replay);
  const [playback, setPlayback] = useState<U5BattlePlaybackState>({
    signature,
    frameIndex: 0,
    replayingFromStart: false,
  });
  const activePlayback = u5BattlePlaybackForSignature(playback, signature);
  const { frameIndex, replayingFromStart } = activePlayback;
  const frame = replay?.frames[Math.min(frameIndex, replay.frames.length - 1)];
  const framePhase = frame?.phase;
  const frameCount = replay?.frames.length ?? 0;
  const shouldAdvance = shouldAdvanceU5BattleFrame(frame, playing, replayingFromStart);

  useEffect(() => {
    if (!shouldAdvance || framePhase === undefined) return;
    const timeout = window.setTimeout(
      () => setPlayback((current) => advanceU5BattlePlayback(current, signature, frameCount)),
      u5BattleFrameDurationMs(framePhase, playbackRate),
    );
    return () => window.clearTimeout(timeout);
  }, [frameCount, frameIndex, framePhase, playbackRate, shouldAdvance, signature]);

  return {
    frame,
    frameIndex,
    isComplete: frame?.phase === "complete",
    isReplaying: replayingFromStart,
    skipToComplete: () => setPlayback((current) => ({
      ...u5BattlePlaybackForSignature(current, signature),
      frameIndex: Math.max(0, frameCount - 1),
      replayingFromStart: false,
    })),
    replayFromStart: () => setPlayback((current) => replayU5BattlePlayback(current, signature)),
  };
}
