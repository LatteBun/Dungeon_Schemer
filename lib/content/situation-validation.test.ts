import { describe, expect, it } from "vitest";
import { validateSituationEvent } from "@/lib/content/situation-validation";
import { RuleError } from "@/lib/domain";
import type {
  AdviceOption,
  AdviceOutcome,
  ChoiceId,
  EventId,
  SituationEvent,
} from "@/lib/domain";

/** 계약을 만족하는 공용 조언 하나. 테스트가 필요한 필드만 덮어쓴다. */
function advice(
  id: string,
  outcome: AdviceOutcome,
  overrides: Partial<AdviceOption> = {},
): AdviceOption {
  return {
    id: id as ChoiceId,
    label: "깨끗한 천을 찢어 새로 감으세요",
    line: "젖은 천은 상처에 안 좋다고 들었어!",
    outcome,
    relation: "unrelated",
    effectTags: ["support"],
    resultText: "새 천으로 감자 피가 멎는다.",
    ...overrides,
  };
}

/** 계약을 만족하는 공용 사건 하나. */
function sharedEvent(overrides: Partial<SituationEvent> = {}): SituationEvent {
  return {
    id: "shared-rest-wound" as EventId,
    kind: "rest",
    title: "벌어진 상처",
    description: "전사의 상처가 다시 벌어졌다. 붕대는 이미 검게 젖어 있다.",
    advice: [
      advice("a", "help"),
      advice("b", "harm"),
      advice("c", "neutral"),
    ],
    defaultResultText: "파티가 알아서 붕대를 고쳐 맨다.",
    ...overrides,
  };
}

describe("validateSituationEvent 구조", () => {
  it("계약을 만족하는 사건은 통과한다", () => {
    expect(() => validateSituationEvent(sharedEvent())).not.toThrow();
  });

  it("조언이 3개가 아니면 생성 오류다", () => {
    const event = sharedEvent({
      advice: [advice("a", "help"), advice("b", "harm")],
    });
    expect(() => validateSituationEvent(event)).toThrow(RuleError);
  });

  it("유형이 한 개씩이 아니면 생성 오류다", () => {
    const event = sharedEvent({
      advice: [advice("a", "help"), advice("b", "help"), advice("c", "neutral")],
    });
    expect(() => validateSituationEvent(event)).toThrow(RuleError);
  });

  it("조언 ID가 사건 안에서 중복되면 생성 오류다", () => {
    const event = sharedEvent({
      advice: [advice("a", "help"), advice("a", "harm"), advice("c", "neutral")],
    });
    expect(() => validateSituationEvent(event)).toThrow(RuleError);
  });

  it.each<[string, Partial<SituationEvent>]>([
    ["제목", { title: "  " }],
    ["묘사", { description: "" }],
    ["기본 결과", { defaultResultText: "" }],
  ])("%s가 비어 있으면 생성 오류다", (_label, overrides) => {
    expect(() => validateSituationEvent(sharedEvent(overrides))).toThrow(RuleError);
  });

  it.each<[string, Partial<AdviceOption>]>([
    ["선택지 문구", { label: "" }],
    ["근거 대사", { line: "   " }],
    ["결과 문구", { resultText: "" }],
  ])("조언의 %s가 비어 있으면 생성 오류다", (_label, overrides) => {
    const event = sharedEvent({
      advice: [
        advice("a", "help", overrides),
        advice("b", "harm"),
        advice("c", "neutral"),
      ],
    });
    expect(() => validateSituationEvent(event)).toThrow(RuleError);
  });

  it("생성 오류는 INVALID_GENERATION 코드를 쓴다", () => {
    const event = sharedEvent({ title: "" });
    try {
      validateSituationEvent(event);
      throw new Error("오류가 나야 하는데 통과했다");
    } catch (error) {
      expect(error).toBeInstanceOf(RuleError);
      expect((error as RuleError).code).toBe("INVALID_GENERATION");
    }
  });
});
