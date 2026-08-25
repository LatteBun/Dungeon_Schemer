import { describe, expect, it } from "vitest";
import {
  initialU5CombatFeedbackPhase,
  reduceU5CombatFeedbackPhase,
  u5FeedbackCanAcknowledge,
  u5FeedbackPhaseDurationMs,
  u5SettledTrustDelta,
  u5VisibleHp,
  u5VisibleTrust,
  type U5CombatFeedbackView,
} from "./u5-combat-feedback";

const ordinary: U5CombatFeedbackView = {
  signature: "event-1:record-3",
  kind: "event",
  consequenceText: "거미들이 천장에서 쏟아진다.",
  preBattleReaction: { memberId: "brigston", memberName: "브릭스턴", text: "알겠어. 네 말대로 하지." },
  immediateTrustChanges: [],
  postBattleReaction: { memberId: "brigston", memberName: "브릭스턴", text: "네 말을 믿은 게 실수였군." },
  postBattleTrustChanges: [{ memberId: "brigston", before: 4, after: 2 }],
};

const exposed: U5CombatFeedbackView = {
  ...ordinary,
  signature: "event-1:record-4",
  preBattleReaction: { memberId: "brigston", memberName: "브릭스턴", text: "처음부터 우릴 속이려 했군." },
  immediateTrustChanges: [{ memberId: "brigston", before: 3, after: 1 }],
  postBattleReaction: null,
  postBattleTrustChanges: [],
};

describe("u5 combat feedback", () => {
  it("일반전은 반응부터 complete까지 승인된 순서로만 전이한다", () => {
    let phase = initialU5CombatFeedbackPhase(ordinary);
    expect(phase).toBe("preBattleReaction");
    phase = reduceU5CombatFeedbackPhase(ordinary, phase, "AUTO_ADVANCE");
    expect(phase).toBe("preBattleConsequence");
    phase = reduceU5CombatFeedbackPhase(ordinary, phase, "AUTO_ADVANCE");
    expect(phase).toBe("battle");
    phase = reduceU5CombatFeedbackPhase(ordinary, phase, "BATTLE_COMPLETE");
    expect(phase).toBe("postBattleHp");
    phase = reduceU5CombatFeedbackPhase(ordinary, phase, "AUTO_ADVANCE");
    expect(phase).toBe("postBattleDialogue");
    expect(reduceU5CombatFeedbackPhase(ordinary, phase, "AUTO_ADVANCE")).toBe(phase);
    phase = reduceU5CombatFeedbackPhase(ordinary, phase, "ACKNOWLEDGE_REACTION");
    expect(phase).toBe("postBattleTrust");
    expect(reduceU5CombatFeedbackPhase(ordinary, phase, "AUTO_ADVANCE")).toBe("complete");
  });

  it("노출된 거짓말은 전투 전 즉시 신뢰 단계를 거친다", () => {
    expect(initialU5CombatFeedbackPhase(exposed)).toBe("preBattleReaction");
    expect(reduceU5CombatFeedbackPhase(exposed, "preBattleReaction", "AUTO_ADVANCE"))
      .toBe("preBattleImmediateTrust");
  });

  it("반응과 결과가 없는 보스전은 곧바로 전투로 시작한다", () => {
    expect(initialU5CombatFeedbackPhase({
      ...ordinary, kind: "boss", preBattleReaction: null, consequenceText: null,
    })).toBe("battle");
  });

  it("사후 신뢰 변화가 없으면 대사와 trust 단계를 건너뛴다", () => {
    const withoutTrust = { ...ordinary, postBattleReaction: null, postBattleTrustChanges: [] };
    expect(reduceU5CombatFeedbackPhase(withoutTrust, "postBattleHp", "AUTO_ADVANCE")).toBe("complete");
  });

  it("사후 대사 확인 전에는 이전 신뢰를, trust phase부터 최종 신뢰를 보인다", () => {
    expect(u5VisibleTrust(ordinary, "postBattleDialogue", "brigston", 2)).toBe(4);
    expect(u5VisibleTrust(ordinary, "postBattleTrust", "brigston", 2)).toBe(2);
    expect(u5VisibleTrust(ordinary, "complete", "brigston", 2)).toBe(2);
  });

  it("완료 신뢰 변화량은 즉시·사후 변화의 처음과 끝을 합친다", () => {
    const chained: U5CombatFeedbackView = {
      ...ordinary,
      immediateTrustChanges: [{ memberId: "brigston", before: 6, after: 4 }],
      postBattleTrustChanges: [{ memberId: "brigston", before: 4, after: 1 }],
    };

    expect(u5SettledTrustDelta(chained, "brigston")).toBe(-5);
    expect(u5SettledTrustDelta(chained, "unrelated")).toBeUndefined();
  });

  it("전투 뒤에는 오래된 파티 HP보다 replay 최종 HP를 우선한다", () => {
    expect(u5VisibleHp({ phase: "battle", frameHp: 11, replayFinalHp: 5, fallbackHp: 32 })).toBe(11);
    expect(u5VisibleHp({ phase: "postBattleDialogue", frameHp: 11, replayFinalHp: 5, fallbackHp: 32 })).toBe(5);
    expect(u5VisibleHp({ phase: "postBattleTrust", frameHp: 11, replayFinalHp: 5, fallbackHp: 32 })).toBe(5);
    expect(u5VisibleHp({ phase: "complete", frameHp: 11, replayFinalHp: 5, fallbackHp: 32 })).toBe(5);
    expect(u5VisibleHp({ phase: "complete", frameHp: 11, replayFinalHp: undefined, fallbackHp: 32 })).toBe(32);
  });

  it("노출된 거짓말의 즉시 신뢰는 전투 전에 반영한다", () => {
    expect(u5VisibleTrust(exposed, "preBattleReaction", "brigston", 1)).toBe(3);
    expect(u5VisibleTrust(exposed, "preBattleImmediateTrust", "brigston", 1)).toBe(1);
    expect(u5VisibleTrust(exposed, "battle", "brigston", 1)).toBe(1);
  });

  it("자동 phase만 고정 체류 시간을 가진다", () => {
    expect(u5FeedbackPhaseDurationMs("preBattleReaction")).toBe(1100);
    expect(u5FeedbackPhaseDurationMs("postBattleHp")).toBe(500);
    expect(u5FeedbackPhaseDurationMs("battle")).toBeNull();
    expect(u5FeedbackCanAcknowledge("postBattleDialogue")).toBe(true);
  });
});
