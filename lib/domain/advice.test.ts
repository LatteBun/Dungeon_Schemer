import { describe, expect, it } from "vitest";
import { ADVICE_OUTCOMES, ECOLOGY_RELATIONS } from "@/lib/domain";
import type {
  AdviceOption,
  BossId,
  BossRuleId,
  CharacterId,
  ChoiceId,
  ClueId,
  EventId,
  InfoRecord,
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
    const isNeutral = outcome === "neutral";
    return {
      id: id as ChoiceId,
      label: "횃불을 하나 집어 거미들 사이의 바닥에 던지세요",
      line: "거미는 불을 싫어한다고 들었어!",
      outcome,
      source: isNeutral
        ? undefined
        : { kind: "ecology", ruleId: "spider-fire" as RuleId },
      relation: isNeutral ? "unrelated" : "consistent",
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

  it("보스 정보 사건이 대상 보스와 보스 특징 근거를 담는다", () => {
    const event: SituationEvent = {
      id: "spider-boss-hint" as EventId,
      kind: "special",
      theme: "spider",
      targetBossId: "boss-spider-1" as BossId,
      title: "좁은 통로의 흔적",
      description: "벽 한쪽이 길게 긁혀 있다.",
      advice: [
        {
          ...advice("help", "help"),
          source: { kind: "boss", bossRuleId: "boss-ragna-turning" as BossRuleId },
          bossDamageModifier: -0.2,
        },
        {
          ...advice("harm", "harm"),
          source: { kind: "boss", bossRuleId: "boss-ragna-turning" as BossRuleId },
          relation: "contradictory",
          bossDamageModifier: 0.25,
        },
        { ...advice("neutral", "neutral"), bossDamageModifier: -0.1 },
      ],
      defaultResultText: "파티가 흔적을 확인하고 이동한다.",
    };

    expect(event.targetBossId).toBe("boss-spider-1");
    expect(event.advice[0].source).toEqual({
      kind: "boss",
      bossRuleId: "boss-ragna-turning",
    });
  });
});

describe("InfoRecord", () => {
  it("지연형 조언의 수용 기록을 담는다", () => {
    const record: InfoRecord = {
      eventId: "spider-boss-hint" as EventId,
      adviceId: "a" as ChoiceId,
      outcome: "help",
      characterId: "character-001" as CharacterId,
      reaction: "accepted",
      modifier: -0.2,
      pendingVerification: false,
    };

    expect(record.outcome).toBe("help");
    expect(record.modifier).toBeLessThan(0);
  });
});
