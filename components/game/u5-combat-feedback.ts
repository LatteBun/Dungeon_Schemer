export type U5CombatFeedbackPhase =
  | "preBattleReaction"
  | "preBattleImmediateTrust"
  | "preBattleConsequence"
  | "battle"
  | "postBattleHp"
  | "postBattleDialogue"
  | "postBattleTrust"
  | "complete";

export interface U5FeedbackValueChange {
  readonly memberId: string;
  readonly before: number;
  readonly after: number;
}

export interface U5FeedbackLine {
  readonly memberId: string;
  readonly memberName: string;
  readonly text: string;
}

export interface U5CombatFeedbackView {
  readonly signature: string;
  readonly kind: "event" | "boss";
  readonly consequenceText: string | null;
  readonly preBattleReaction: U5FeedbackLine | null;
  readonly immediateTrustChanges: readonly U5FeedbackValueChange[];
  readonly postBattleReaction: U5FeedbackLine | null;
  readonly postBattleTrustChanges: readonly U5FeedbackValueChange[];
}

export type U5CombatFeedbackEvent = "AUTO_ADVANCE" | "BATTLE_COMPLETE" | "ACKNOWLEDGE_REACTION";

export const U5_FEEDBACK_PHASE_DURATION_MS = {
  preBattleReaction: 1_100,
  preBattleImmediateTrust: 650,
  preBattleConsequence: 1_100,
  postBattleHp: 500,
  postBattleTrust: 650,
} as const;

function phasesFor(view: U5CombatFeedbackView): readonly U5CombatFeedbackPhase[] {
  return [
    ...(view.preBattleReaction === null ? [] : ["preBattleReaction" as const]),
    ...(view.immediateTrustChanges.length === 0 ? [] : ["preBattleImmediateTrust" as const]),
    ...(view.consequenceText === null ? [] : ["preBattleConsequence" as const]),
    "battle" as const,
    "postBattleHp" as const,
    ...(view.postBattleReaction === null || view.postBattleTrustChanges.length === 0
      ? []
      : ["postBattleDialogue" as const, "postBattleTrust" as const]),
    "complete" as const,
  ];
}

export function initialU5CombatFeedbackPhase(view: U5CombatFeedbackView): U5CombatFeedbackPhase {
  return phasesFor(view)[0] ?? "complete";
}

export function reduceU5CombatFeedbackPhase(
  view: U5CombatFeedbackView,
  phase: U5CombatFeedbackPhase,
  event: U5CombatFeedbackEvent,
): U5CombatFeedbackPhase {
  const expected = phase === "battle"
    ? "BATTLE_COMPLETE"
    : phase === "postBattleDialogue"
      ? "ACKNOWLEDGE_REACTION"
      : u5FeedbackPhaseDurationMs(phase) === null ? null : "AUTO_ADVANCE";
  if (event !== expected) return phase;
  const phases = phasesFor(view);
  return phases[phases.indexOf(phase) + 1] ?? phase;
}

export function u5FeedbackPhaseDurationMs(phase: U5CombatFeedbackPhase): number | null {
  return U5_FEEDBACK_PHASE_DURATION_MS[phase as keyof typeof U5_FEEDBACK_PHASE_DURATION_MS] ?? null;
}

export function u5FeedbackCanAcknowledge(phase: U5CombatFeedbackPhase): boolean {
  return phase === "postBattleDialogue";
}

function appliedBefore(
  phase: U5CombatFeedbackPhase,
  changePhase: U5CombatFeedbackPhase,
): boolean {
  const order: readonly U5CombatFeedbackPhase[] = [
    "preBattleReaction", "preBattleImmediateTrust", "preBattleConsequence", "battle",
    "postBattleHp", "postBattleDialogue", "postBattleTrust", "complete",
  ];
  return order.indexOf(phase) >= order.indexOf(changePhase);
}

export function u5VisibleTrust(
  view: U5CombatFeedbackView,
  phase: U5CombatFeedbackPhase,
  memberId: string,
  finalTrust: number,
): number {
  const post = view.postBattleTrustChanges.find((change) => change.memberId === memberId);
  if (post !== undefined) return appliedBefore(phase, "postBattleTrust") ? post.after : post.before;
  const immediate = view.immediateTrustChanges.find((change) => change.memberId === memberId);
  if (immediate !== undefined) return appliedBefore(phase, "preBattleImmediateTrust") ? immediate.after : immediate.before;
  return finalTrust;
}

export function u5FeedbackIsComplete(phase: U5CombatFeedbackPhase): boolean {
  return phase === "complete";
}
