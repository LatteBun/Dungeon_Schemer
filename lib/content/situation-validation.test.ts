import { describe, expect, it } from "vitest";
import { validateSituationEvent } from "@/lib/content/situation-validation";
import { RuleError } from "@/lib/domain";
import type {
  AdviceOption,
  AdviceOutcome,
  ChoiceId,
  EventId,
  RuleId,
  SituationEvent,
  ThemeId,
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

/** 계약을 만족하는 테마 전용 조언. */
function themedAdvice(
  id: string,
  outcome: AdviceOutcome,
  overrides: Partial<AdviceOption> = {},
): AdviceOption {
  const byOutcome = {
    help: { relation: "consistent" as const, ruleId: "spider-fire" as RuleId },
    harm: { relation: "contradictory" as const, ruleId: "spider-fire" as RuleId },
    neutral: { relation: "unrelated" as const, ruleId: undefined },
  };
  return advice(id, outcome, { ...byOutcome[outcome], ...overrides });
}

function themedEvent(overrides: Partial<SituationEvent> = {}): SituationEvent {
  return {
    id: "spider-webbed-hunter" as EventId,
    kind: "monster",
    theme: "spider" as ThemeId,
    title: "실에 걸린 사냥꾼",
    description: "바닥과 벽에는 오래된 거미줄이 잔뜩 붙어 있다.",
    advice: [
      themedAdvice("a", "help"),
      themedAdvice("b", "harm"),
      themedAdvice("c", "neutral"),
    ],
    defaultResultText: "파티가 알아서 거미를 밀어낸다.",
    ...overrides,
  };
}

describe("validateSituationEvent 테마 전용", () => {
  it("계약을 만족하는 테마 사건은 통과한다", () => {
    expect(() => validateSituationEvent(themedEvent())).not.toThrow();
  });

  it("도움이 정합이 아니면 생성 오류다", () => {
    const event = themedEvent({
      advice: [
        themedAdvice("a", "help", { relation: "contradictory" }),
        themedAdvice("b", "harm"),
        themedAdvice("c", "neutral"),
      ],
    });
    expect(() => validateSituationEvent(event)).toThrow(RuleError);
  });

  it("방해가 모순이 아니면 생성 오류다", () => {
    const event = themedEvent({
      advice: [
        themedAdvice("a", "help"),
        themedAdvice("b", "harm", { relation: "consistent" }),
        themedAdvice("c", "neutral"),
      ],
    });
    expect(() => validateSituationEvent(event)).toThrow(RuleError);
  });

  it("정합·모순인데 참조 규칙이 없으면 생성 오류다", () => {
    const event = themedEvent({
      advice: [
        themedAdvice("a", "help", { ruleId: undefined }),
        themedAdvice("b", "harm"),
        themedAdvice("c", "neutral"),
      ],
    });
    expect(() => validateSituationEvent(event)).toThrow(RuleError);
  });

  it("무관인데 참조 규칙이 있으면 생성 오류다", () => {
    const event = themedEvent({
      advice: [
        themedAdvice("a", "help"),
        themedAdvice("b", "harm"),
        themedAdvice("c", "neutral", { ruleId: "spider-fire" as RuleId }),
      ],
    });
    expect(() => validateSituationEvent(event)).toThrow(RuleError);
  });
});

describe("validateSituationEvent 공용", () => {
  it("공용 조언이 무관이 아니면 생성 오류다", () => {
    const event = sharedEvent({
      advice: [
        advice("a", "help", { relation: "consistent", ruleId: "spider-fire" as RuleId }),
        advice("b", "harm"),
        advice("c", "neutral"),
      ],
    });
    expect(() => validateSituationEvent(event)).toThrow(RuleError);
  });

  it("공용 조언에 참조 규칙이 있으면 생성 오류다", () => {
    const event = sharedEvent({
      advice: [
        advice("a", "help", { ruleId: "spider-fire" as RuleId }),
        advice("b", "harm"),
        advice("c", "neutral"),
      ],
    });
    expect(() => validateSituationEvent(event)).toThrow(RuleError);
  });

  it("공용 조언에 보스 피해 보정이 있으면 생성 오류다", () => {
    const event = sharedEvent({
      advice: [
        advice("a", "help", { bossDamageModifier: -0.2 }),
        advice("b", "harm"),
        advice("c", "neutral"),
      ],
    });
    expect(() => validateSituationEvent(event)).toThrow(RuleError);
  });
});
