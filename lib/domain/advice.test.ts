import { describe, expect, it } from "vitest";
import { ADVICE_OUTCOMES, ECOLOGY_RELATIONS } from "@/lib/domain";
import type {
  AdviceOption,
  ChoiceId,
  ClueId,
  EventId,
  RuleId,
  SituationEvent,
} from "@/lib/domain";

describe("ADVICE_OUTCOMES", () => {
  it("도움·방해·중립 셋이다", () => {
    expect([...ADVICE_OUTCOMES].toSorted()).toEqual(["harm", "help", "neutral"]);
  });
});

describe("ECOLOGY_RELATIONS", () => {
  it("정합·모순·무관 셋이다", () => {
    expect([...ECOLOGY_RELATIONS].toSorted()).toEqual([
      "consistent",
      "contradictory",
      "unrelated",
    ]);
  });
});

describe("SituationEvent", () => {
  function advice(id: string, outcome: AdviceOption["outcome"]): AdviceOption {
    return {
      id: id as ChoiceId,
      label: "횃불을 하나 집어 거미들 사이의 바닥에 던지세요",
      line: "거미는 불을 싫어한다고 들었어!",
      outcome,
      ruleId: "spider-fire" as RuleId,
      relation: "consistent",
      effectTags: ["support"],
      resultText: "거미들이 불을 피해 한쪽으로 몰린다.",
    };
  }

  it("조언 3개와 기본 결과를 담는다", () => {
    const event: SituationEvent = {
      id: "spider-webbed-hunter" as EventId,
      kind: "monster",
      theme: "spider",
      title: "실에 걸린 사냥꾼",
      description: "바닥과 벽에는 오래된 거미줄이 잔뜩 붙어 있다.",
      advice: [advice("a", "help"), advice("b", "harm"), advice("c", "neutral")],
      defaultResultText: "파티가 알아서 거미를 밀어낸다.",
    };

    expect(event.advice).toHaveLength(3);
    expect(event.defaultResultText).not.toBe("");
  });

  it("단서와 연계를 선택적으로 담는다", () => {
    const event: SituationEvent = {
      id: "spider-molt" as EventId,
      kind: "special",
      theme: "spider",
      title: "허물",
      description: "통로 구석에 커다란 허물이 벗겨져 있다.",
      advice: [advice("a", "help"), advice("b", "harm"), advice("c", "neutral")],
      defaultResultText: "파티가 허물을 지나친다.",
      revealsClue: "spider-molt-seen" as ClueId,
      requiresClue: "spider-brood-seen" as ClueId,
      upgrades: [
        {
          clueId: "spider-molt-seen" as ClueId,
          slotIndex: 0,
          replacement: advice("a-upgraded", "help"),
        },
      ],
    };

    expect(event.revealsClue).toBe("spider-molt-seen");
    expect(event.upgrades?.[0].slotIndex).toBe(0);
  });
});
