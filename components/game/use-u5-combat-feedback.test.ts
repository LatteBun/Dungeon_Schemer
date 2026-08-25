import { describe, expect, it } from "vitest";
import { u5FeedbackForSignature, u5FeedbackTimerMs } from "./use-u5-combat-feedback";
import type { U5CombatFeedbackView } from "./u5-combat-feedback";

const feedback: U5CombatFeedbackView = {
  signature: "feedback-1", kind: "event", consequenceText: null,
  preBattleReaction: null, immediateTrustChanges: [], postBattleReaction: null, postBattleTrustChanges: [],
};

describe("u5 combat feedback controller", () => {
  it("새 signature는 새 view의 첫 phase로 초기화한다", () => {
    expect(u5FeedbackForSignature({ signature: "old", phase: "complete" }, feedback))
      .toEqual({ signature: "feedback-1", phase: "battle" });
  });

  it("자동 phase만 timer를 가진다", () => {
    expect(u5FeedbackTimerMs("preBattleReaction")).toBe(1100);
    expect(u5FeedbackTimerMs("battle")).toBeNull();
    expect(u5FeedbackTimerMs("postBattleDialogue")).toBeNull();
  });
});
