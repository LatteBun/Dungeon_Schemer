"use client";

import { useEffect, useState } from "react";
import {
  initialU5CombatFeedbackPhase,
  reduceU5CombatFeedbackPhase,
  u5FeedbackPhaseDurationMs,
  type U5CombatFeedbackPhase,
  type U5CombatFeedbackView,
} from "./u5-combat-feedback";

export interface U5CombatFeedbackState {
  readonly signature: string;
  readonly phase: U5CombatFeedbackPhase;
}

export function u5FeedbackForSignature(
  current: U5CombatFeedbackState,
  feedback: U5CombatFeedbackView,
): U5CombatFeedbackState {
  return current.signature === feedback.signature
    ? current
    : { signature: feedback.signature, phase: initialU5CombatFeedbackPhase(feedback) };
}

export function u5FeedbackTimerMs(phase: U5CombatFeedbackPhase): number | null {
  return u5FeedbackPhaseDurationMs(phase);
}

export function useU5CombatFeedback(
  feedback: U5CombatFeedbackView | undefined,
  battleComplete: boolean,
) {
  const initial = feedback === undefined
    ? { signature: "none", phase: "complete" as const }
    : { signature: feedback.signature, phase: initialU5CombatFeedbackPhase(feedback) };
  const [state, setState] = useState<U5CombatFeedbackState>(initial);
  const active = feedback === undefined ? initial : u5FeedbackForSignature(state, feedback);

  useEffect(() => {
    if (feedback === undefined) return;
    const wait = u5FeedbackTimerMs(active.phase);
    if (wait === null) return;
    const timer = window.setTimeout(() => setState((current) => {
      const currentActive = u5FeedbackForSignature(current, feedback);
      return { ...currentActive, phase: reduceU5CombatFeedbackPhase(feedback, currentActive.phase, "AUTO_ADVANCE") };
    }), wait);
    return () => window.clearTimeout(timer);
  }, [active.phase, feedback]);

  useEffect(() => {
    if (feedback === undefined || active.phase !== "battle" || !battleComplete) return;
    setState((current) => {
      const currentActive = u5FeedbackForSignature(current, feedback);
      return { ...currentActive, phase: reduceU5CombatFeedbackPhase(feedback, currentActive.phase, "BATTLE_COMPLETE") };
    });
  }, [active.phase, battleComplete, feedback]);

  return {
    phase: active.phase,
    acknowledgeReaction: () => feedback === undefined ? undefined : setState((current) => {
      const currentActive = u5FeedbackForSignature(current, feedback);
      return { ...currentActive, phase: reduceU5CombatFeedbackPhase(feedback, currentActive.phase, "ACKNOWLEDGE_REACTION") };
    }),
  };
}
