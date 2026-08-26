import { describe, expect, it } from "vitest";
import { ADVICE_OUTCOMES, ECOLOGY_RELATIONS } from "@/lib/domain";
import type {
  AdviceOption,
  BossId,
  BossRuleId,
  CharacterId,
  ChoiceId,
  ClueId,
  ExpeditionState,
  EventId,
  InfoRecord,
  MerchantAdviceOption,
  MerchantSituationEvent,
  PendingMerchantEffect,
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
        },
        {
          ...advice("harm", "harm"),
          source: { kind: "boss", bossRuleId: "boss-ragna-turning" as BossRuleId },
          relation: "contradictory",
        },
        { ...advice("neutral", "neutral") },
      ],
      defaultResultText: "파티가 흔적을 확인하고 이동한다.",
    };

    expect(event.targetBossId).toBe("boss-spider-1");
    expect(event.advice[0].source).toEqual({
      kind: "boss",
      bossRuleId: "boss-ragna-turning",
    });
  });

  it("merchant 사건은 골드 비용과 상인 효과를 담는다", () => {
    const merchantHelp: MerchantAdviceOption = {
      id: "merchant-help" as ChoiceId,
      outcome: "help",
      label: "치료를 부탁하세요",
      line: "상처가 깊으니 지금 치료하자고 하세요.",
      relation: "unrelated",
      effectTags: ["trade"],
      resultText: "상처를 봉합한다.",
      goldCost: 5,
      merchantEffect: { immediateHpDeltaPerMember: 8 },
    };
    const event: MerchantSituationEvent = {
      id: "shared-merchant-healer" as EventId,
      kind: "merchant",
      title: "약초 장수",
      description: "갈라진 약병에서 쌉싸래한 냄새가 난다.",
      advice: [
        merchantHelp,
        {
          id: "merchant-harm" as ChoiceId,
          outcome: "harm",
          label: "독한 약을 사세요",
          line: "효과가 강하니 빨리 낫는다고 우기세요.",
          relation: "unrelated",
          effectTags: ["trade"],
          resultText: "약이 속을 뒤튼다.",
          goldCost: 4,
          merchantEffect: {
            nextBattle: { incomingDamageMultiplier: 1.25 },
          },
        },
        {
          id: "merchant-neutral" as ChoiceId,
          outcome: "neutral",
          label: "그냥 지나치세요",
          line: "지금은 살 것이 없다고 하세요.",
          relation: "unrelated",
          effectTags: ["trade"],
          resultText: "상인이 어깨를 으쓱한다.",
          goldCost: 0,
        },
      ],
      defaultResultText: "파티가 그냥 지나친다.",
    };

    expect(merchantHelp.goldCost).toBe(5);
    expect(event.kind).toBe("merchant");
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
      bossRuleId: "boss-ragna-turning" as never,
      pendingVerification: false,
    };

    expect(record.outcome).toBe("help");
    expect(record.bossRuleId).toBe("boss-ragna-turning");
  });
});

describe("ExpeditionState", () => {
  it("pending merchant effect 슬롯 하나를 들고 있다", () => {
    const pendingMerchantEffect: PendingMerchantEffect = {
      adviceId: "merchant-harm" as ChoiceId,
      nextBattle: { incomingDamageMultiplier: 1.25 },
    };
    const state: ExpeditionState = {
      dungeonId: "dungeon-001" as never,
      riskLevel: 2,
      party: {
        memberIds: [
          "character-001" as CharacterId,
          "character-002" as CharacterId,
          "character-003" as CharacterId,
        ],
      },
      activeRuleIds: ["rule-a" as RuleId, "rule-b" as RuleId, "rule-c" as RuleId],
      disclosedRuleIds: ["rule-a" as RuleId],
      map: {
        entryNodeId: "node-entry" as never,
        bossNodeId: "node-boss" as never,
        layers: [],
        nodes: [
          { id: "node-entry" as never, kind: "entry", nextNodeIds: ["node-boss" as never] },
          { id: "node-boss" as never, kind: "boss", nextNodeIds: [] },
        ],
      },
      currentNodeId: "node-entry" as never,
      visitedNodeIds: ["node-entry" as never],
      advicePressure: 0,
      battleAbilityUsesRemainingByCharacterId: {},
      infoRecords: [],
      pendingMerchantEffect,
      bossResult: null,
      result: null,
    };

    expect(state.pendingMerchantEffect?.adviceId).toBe("merchant-harm");
  });
});
