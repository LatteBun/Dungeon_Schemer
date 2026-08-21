import { describe, expect, it } from "vitest";
import { merchantAdvice as buildMerchantAdvice } from "@/lib/content/shared-event-builders";
import { validateSituationEvent, validateSituationEvents } from "@/lib/content/situation-validation";
import { SPIDER_THEME } from "@/lib/content/themes";
import { RuleError } from "@/lib/domain";
import type {
  AdviceOption,
  AdviceOutcome,
  BossId,
  BossRuleId,
  ChoiceId,
  ClueId,
  EventId,
  MerchantAdviceOption,
  MerchantEffect,
  MerchantSituationEvent,
  NonMerchantSituationEvent,
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
function sharedEvent(overrides: Partial<NonMerchantSituationEvent> = {}): NonMerchantSituationEvent {
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

  it.each<[string, Partial<NonMerchantSituationEvent>]>([
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
    help: {
      relation: "consistent" as const,
      source: { kind: "ecology" as const, ruleId: "spider-fire" as RuleId },
    },
    harm: {
      relation: "contradictory" as const,
      source: { kind: "ecology" as const, ruleId: "spider-fire" as RuleId },
    },
    neutral: { relation: "unrelated" as const, source: undefined },
  };
  return advice(id, outcome, { ...byOutcome[outcome], ...overrides });
}

function themedEvent(overrides: Partial<NonMerchantSituationEvent> = {}): NonMerchantSituationEvent {
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

function bossEvent(overrides: Partial<NonMerchantSituationEvent> = {}): NonMerchantSituationEvent {
  const source = {
    kind: "boss" as const,
    bossRuleId: "boss-ragna-turning" as BossRuleId,
  };
  return {
    id: "spider-boss-hint" as EventId,
    kind: "special",
    theme: "spider",
    targetBossId: "boss-spider-1" as BossId,
    title: "보스 흔적",
    description: "벽 한쪽에 거대한 긁힌 자국이 남아 있다.",
    advice: [
      themedAdvice("help", "help", { source, bossDamageModifier: -0.2 }),
      themedAdvice("harm", "harm", { source, bossDamageModifier: 0.25 }),
      themedAdvice("neutral", "neutral", { bossDamageModifier: -0.1 }),
    ],
    defaultResultText: "파티가 흔적을 살피고 이동한다.",
    ...overrides,
  };
}

function merchantAdvice(
  id: string,
  outcome: "neutral",
  overrides?: Partial<Extract<MerchantAdviceOption, { outcome: "neutral" }>>,
): Extract<MerchantAdviceOption, { outcome: "neutral" }>;
function merchantAdvice(
  id: string,
  outcome: "help" | "harm",
  overrides?: Partial<Extract<MerchantAdviceOption, { outcome: "help" | "harm" }>>,
): Extract<MerchantAdviceOption, { outcome: "help" | "harm" }>;
function merchantAdvice(
  id: string,
  outcome: AdviceOutcome,
  overrides:
    | Partial<Extract<MerchantAdviceOption, { outcome: "neutral" }>>
    | Partial<Extract<MerchantAdviceOption, { outcome: "help" | "harm" }>> = {},
): MerchantAdviceOption {
  if (outcome === "neutral") {
    const neutralOverrides = overrides as Partial<
      Extract<MerchantAdviceOption, { outcome: "neutral" }>
    >;
    return {
      id: id as ChoiceId,
      label: "상인을 통해 상황을 바꾸세요",
      line: "지금은 사지 말자고 하세요.",
      outcome,
      relation: "unrelated",
      effectTags: ["trade"],
      resultText: "상인이 값을 부른다.",
      goldCost: 0,
      ...neutralOverrides,
    };
  }
  const paidOverrides = overrides as Partial<
    Extract<MerchantAdviceOption, { outcome: "help" | "harm" }>
  >;
  return {
    id: id as ChoiceId,
    label: "상인을 통해 상황을 바꾸세요",
    line: "지금 골드를 써서 바로 처리하자고 하세요.",
    outcome,
    relation: "unrelated",
    effectTags: ["trade"],
    resultText: "상인이 값을 부른다.",
    goldCost: 5,
    merchantEffect: { immediateHpDeltaPerMember: outcome === "help" ? 1 : -1 },
    ...paidOverrides,
  };
}

function merchantEvent(overrides: Partial<MerchantSituationEvent> = {}): MerchantSituationEvent {
  return {
    id: "shared-merchant-wound" as EventId,
    kind: "merchant",
    title: "붕대 상인",
    description: "상인이 골드를 받고 지금 파티 상태에 개입하겠다고 제안한다.",
    advice: [
      merchantAdvice("m-a", "help"),
      merchantAdvice("m-b", "harm"),
      merchantAdvice("m-c", "neutral"),
    ],
    defaultResultText: "파티가 거래를 하지 않고 지나간다.",
    ...overrides,
  };
}

function merchantEventWithPaidAdvice(
  overrides: Record<string, unknown>,
): MerchantSituationEvent {
  const event = merchantEvent();
  return {
    ...event,
    advice: [{ ...event.advice[0], ...overrides }, event.advice[1], event.advice[2]],
  } as unknown as MerchantSituationEvent;
}

function merchantEventWithNeutralAdvice(
  overrides: Record<string, unknown>,
): MerchantSituationEvent {
  const event = merchantEvent();
  return {
    ...event,
    advice: [
      event.advice[0],
      event.advice[1],
      { ...event.advice[2], ...overrides },
    ],
  } as unknown as MerchantSituationEvent;
}

describe("merchantAdvice builder", () => {
  it("H/X에 전달한 비용과 효과를 그대로 보존한다", () => {
    const effect: MerchantEffect = {
      immediateHpDeltaPerMember: 8,
      nextBattle: { incomingDamageMultiplier: 0.75 },
    };

    expect(buildMerchantAdvice(
      "merchant-help",
      "help",
      "치료를 부탁하세요",
      "지금 치료하자고 하세요.",
      "상처를 봉합한다.",
      ["trade"],
      9,
      effect,
    )).toMatchObject({ goldCost: 9, merchantEffect: effect });
  });

  it("N은 0G이고 merchant 효과가 없다", () => {
    expect(buildMerchantAdvice(
      "merchant-neutral",
      "neutral",
      "거래하지 마세요",
      "지금은 사지 말자고 하세요.",
      "파티가 거래하지 않고 떠난다.",
      ["observe"],
      0,
    )).toMatchObject({ outcome: "neutral", goldCost: 0 });
  });
});

describe("validateSituationEvent merchant", () => {
  it("계약을 만족하는 merchant 사건은 통과한다", () => {
    expect(() => validateSituationEvent(merchantEvent())).not.toThrow();
  });

  it.each([0, -1, 1.5])("H/X 비용이 %s이면 생성 오류다", (goldCost) => {
    expect(() => validateSituationEvent(merchantEventWithPaidAdvice({ goldCost })))
      .toThrow(/비용/);
  });

  it("H/X 효과가 없으면 생성 오류다", () => {
    expect(() => validateSituationEvent(merchantEventWithPaidAdvice({
      merchantEffect: undefined,
    }))).toThrow(/효과/);
  });

  it.each([0, 1.5])("즉시 HP 변화가 %s이면 생성 오류다", (immediateHpDeltaPerMember) => {
    expect(() => validateSituationEvent(merchantEventWithPaidAdvice({
      merchantEffect: { immediateHpDeltaPerMember },
    }))).toThrow(/즉시 HP/);
  });

  it.each([0, Number.NaN, Number.POSITIVE_INFINITY])(
    "다음 전투 보정이 %s이면 생성 오류다",
    (incomingDamageMultiplier) => {
      expect(() => validateSituationEvent(merchantEventWithPaidAdvice({
        merchantEffect: { nextBattle: { incomingDamageMultiplier } },
      }))).toThrow(/보정/);
    },
  );

  it("다음 전투 보정이 둘 다 있으면 생성 오류다", () => {
    expect(() => validateSituationEvent(merchantEventWithPaidAdvice({
      merchantEffect: {
        nextBattle: {
          incomingDamageMultiplier: 0.75,
          partyDamageMultiplier: 1.3,
        },
      },
    }))).toThrow(/보정/);
  });

  it("다음 전투 보정이 하나도 없으면 생성 오류다", () => {
    expect(() => validateSituationEvent(merchantEventWithPaidAdvice({
      merchantEffect: { nextBattle: {} },
    }))).toThrow(/보정/);
  });

  it("neutral에 merchant 효과가 있으면 생성 오류다", () => {
    expect(() => validateSituationEvent(merchantEventWithNeutralAdvice({
      merchantEffect: { immediateHpDeltaPerMember: 1 },
    }))).toThrow(/neutral/);
  });

  it("neutral 비용이 0G가 아니면 생성 오류다", () => {
    expect(() => validateSituationEvent(merchantEventWithNeutralAdvice({ goldCost: 1 })))
      .toThrow(/비용/);
  });
});

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
        themedAdvice("a", "help", { source: undefined }),
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
        themedAdvice("c", "neutral", {
          source: { kind: "ecology", ruleId: "spider-fire" as RuleId },
        }),
      ],
    });
    expect(() => validateSituationEvent(event)).toThrow(RuleError);
  });

  it("일반 사건이 보스 source를 가지면 생성 오류다", () => {
    const event = themedEvent({
      advice: [
        themedAdvice("a", "help", {
          source: { kind: "boss", bossRuleId: "boss-ragna-turning" as BossRuleId },
        }),
        themedAdvice("b", "harm"),
        themedAdvice("c", "neutral"),
      ],
    });
    expect(() => validateSituationEvent(event)).toThrow(RuleError);
  });

  it("보스 대상 사건의 modifier가 빠지면 생성 오류다", () => {
    const event = bossEvent({
      advice: [
        { ...bossEvent().advice[0], bossDamageModifier: undefined },
        bossEvent().advice[1],
        bossEvent().advice[2],
      ],
    });
    expect(() => validateSituationEvent(event)).toThrow(RuleError);
  });
});

describe("validateSituationEvent 공용", () => {
  it("공용 조언이 무관이 아니면 생성 오류다", () => {
    const event = sharedEvent({
      advice: [
        advice("a", "help", { relation: "consistent" }),
        advice("b", "harm"),
        advice("c", "neutral"),
      ],
    });
    expect(() => validateSituationEvent(event)).toThrow(RuleError);
  });

  it("공용 조언에 참조 규칙이 있으면 생성 오류다", () => {
    const event = sharedEvent({
      advice: [
        advice("a", "help", {
          source: { kind: "ecology", ruleId: "spider-fire" as RuleId },
        }),
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

  it("몬스터 사건에 테마가 없으면 생성 오류다", () => {
    const event = sharedEvent({ kind: "monster" });
    expect(() => validateSituationEvent(event)).toThrow(RuleError);
  });
});

describe("validateSituationEvent 강화판", () => {
  it("계약을 만족하는 강화판은 통과한다", () => {
    const event = themedEvent({
      upgrades: [
        {
          clueId: "spider-molt-seen" as ClueId,
          slotIndex: 0,
          replacement: themedAdvice("a-up", "help"),
        },
      ],
    });
    expect(() => validateSituationEvent(event)).not.toThrow();
  });

  it.each([-1, 3])("slotIndex가 %i이면 생성 오류다", (slotIndex) => {
    const event = themedEvent({
      upgrades: [
        {
          clueId: "spider-molt-seen" as ClueId,
          slotIndex,
          replacement: themedAdvice("a-up", "help"),
        },
      ],
    });
    expect(() => validateSituationEvent(event)).toThrow(RuleError);
  });

  it("대체 조언의 유형이 원래 슬롯과 다르면 생성 오류다", () => {
    // 0번 슬롯은 도움인데 방해로 바꾸면 각 한 개씩이 깨진다.
    const event = themedEvent({
      upgrades: [
        {
          clueId: "spider-molt-seen" as ClueId,
          slotIndex: 0,
          replacement: themedAdvice("a-up", "harm"),
        },
      ],
    });
    expect(() => validateSituationEvent(event)).toThrow(RuleError);
  });

  it("대체 조언의 문구가 비어 있으면 생성 오류다", () => {
    const event = themedEvent({
      upgrades: [
        {
          clueId: "spider-molt-seen" as ClueId,
          slotIndex: 0,
          replacement: themedAdvice("a-up", "help", { resultText: "" }),
        },
      ],
    });
    expect(() => validateSituationEvent(event)).toThrow(RuleError);
  });

  it("공용 사건의 대체 조언도 공용 규칙을 따른다", () => {
    const event = sharedEvent({
      upgrades: [
        {
          clueId: "shared-clue" as ClueId,
          slotIndex: 0,
          replacement: advice("a-up", "help", {
            source: { kind: "ecology", ruleId: "spider-fire" as RuleId },
          }),
        },
      ],
    });
    expect(() => validateSituationEvent(event)).toThrow(RuleError);
  });
});

/** 규칙 하나에 도움·방해를 두 개씩 공급하는 테마 사건 묶음. */
function themedSupply(ruleId: string): NonMerchantSituationEvent[] {
  return [0, 1].map((n) =>
    themedEvent({
      id: `${ruleId}-event-${n}` as EventId,
      advice: [
        themedAdvice(`${ruleId}-h${n}`, "help", {
          source: { kind: "ecology", ruleId: ruleId as RuleId },
        }),
        themedAdvice(`${ruleId}-x${n}`, "harm", {
          source: { kind: "ecology", ruleId: ruleId as RuleId },
        }),
        themedAdvice(`${ruleId}-n${n}`, "neutral"),
      ],
    }),
  );
}

/** 분류마다 다섯 개씩인 공용 사건 15개. */
function sharedSupply(): SituationEvent[] {
  const rest = [0, 1, 2, 3, 4].map((n) =>
    sharedEvent({
      id: `shared-rest-${n}` as EventId,
      kind: "rest",
      advice: [
        advice(`rest${n}-a`, "help"),
        advice(`rest${n}-b`, "harm"),
        advice(`rest${n}-c`, "neutral"),
      ],
    }),
  );
  const merchant = [0, 1, 2, 3, 4].map((n) =>
    merchantEvent({
      id: `shared-merchant-${n}` as EventId,
      advice: [
        merchantAdvice(`merchant${n}-a`, "help"),
        merchantAdvice(`merchant${n}-b`, "harm"),
        merchantAdvice(`merchant${n}-c`, "neutral"),
      ],
    }),
  );
  const special = [0, 1, 2, 3, 4].map((n) =>
    sharedEvent({
      id: `shared-special-${n}` as EventId,
      kind: "special",
      advice: [
        advice(`special${n}-a`, "help"),
        advice(`special${n}-b`, "harm"),
        advice(`special${n}-c`, "neutral"),
      ],
    }),
  );
  return [...rest, ...merchant, ...special];
}

describe("validateSituationEvents 모음", () => {
  it("사건 ID가 중복되면 생성 오류다", () => {
    expect(() =>
      validateSituationEvents([...sharedSupply(), sharedSupply()[0]]),
    ).toThrow(RuleError);
  });

  it("공용 15개가 분류별 5개면 통과한다", () => {
    expect(() => validateSituationEvents(sharedSupply())).not.toThrow();
  });

  it("공용이 분류당 5개보다 적으면 생성 오류다", () => {
    const short = sharedSupply().filter((event) => event.id !== "shared-rest-4");
    expect(() => validateSituationEvents(short)).toThrow(RuleError);
  });

  it("공용이 분류당 5개보다 많아도 통과한다", () => {
    // 수량은 하한이다. F3-4가 30개로 늘려도 검증기가 깨지면 안 된다.
    const extra = [
      ...sharedSupply(),
      sharedEvent({ id: "shared-rest-5" as EventId, kind: "rest" }),
    ];
    expect(() => validateSituationEvents(extra)).not.toThrow();
  });

  it("규칙마다 도움·방해가 2개씩이면 통과한다", () => {
    expect(() =>
      validateSituationEvents([...sharedSupply(), ...themedSupply("spider-fire")]),
    ).not.toThrow();
  });

  it("사건 하나가 구조를 어기면 나머지가 하한을 채워도 생성 오류다", () => {
    // 공급·중복 검사는 모두 만족시키고, 오직 사건 하나의 도움·방해·중립
    // 구성만 깨서 개별 사건 검사(validateSituationEvent)만 걸리게 한다.
    const supply = sharedSupply();
    const broken = [
      sharedEvent({
        id: supply[0].id,
        kind: "rest",
        advice: [
          advice(`${supply[0].id}-a`, "help"),
          advice(`${supply[0].id}-b`, "help"),
          advice(`${supply[0].id}-c`, "help"),
        ],
      }),
      ...supply.slice(1),
    ];
    expect(() => validateSituationEvents(broken)).toThrow(RuleError);
  });

  it("규칙의 도움이 2개보다 적으면 생성 오류다", () => {
    const supply = themedSupply("spider-fire");
    const broken = supply.map((event, index) =>
      index === 0
        ? {
            ...event,
            advice: [
              // 도움을 다른 규칙으로 옮겨 spider-fire의 도움을 1개로 만든다.
              themedAdvice("moved-help", "help", {
                source: { kind: "ecology", ruleId: "spider-shadow" as RuleId },
              }),
              event.advice[1],
              event.advice[2],
            ],
          }
        : event,
    );
    expect(() =>
      validateSituationEvents([...sharedSupply(), ...broken]),
    ).toThrow(RuleError);
  });

  it("테마 전용 모드는 공용 사건 없이 테마 전체 규칙을 검사한다", () => {
    const events = [
      "spider-fire",
      "spider-brood-light",
      "spider-vibration",
      "spider-armor-vibration",
      "spider-carrion",
      "spider-shadow",
    ].flatMap((ruleId) => themedSupply(ruleId));
    expect(() => validateSituationEvents(events, SPIDER_THEME)).not.toThrow();
  });

  it("테마 전용 모드는 사건에 등장하지 않은 테마 규칙도 검사한다", () => {
    expect(() => validateSituationEvents(themedSupply("spider-fire"), SPIDER_THEME))
      .toThrow(/spider-brood-light/);
  });

  it("테마 밖 생태 규칙을 참조하면 생성 오류다", () => {
    const event = themedSupply("spider-fire")[0];
    const foreign = {
      ...event,
      advice: [
        {
          ...event.advice[0],
          source: { kind: "ecology" as const, ruleId: "outside-rule" as RuleId },
        },
        event.advice[1],
        event.advice[2],
      ],
    };
    expect(() => validateSituationEvents([foreign], SPIDER_THEME)).toThrow(/테마 밖/);
  });

  it("보스 정보 사건이 다른 보스의 특징을 참조하면 생성 오류다", () => {
    const event = bossEvent({
      advice: [
        {
          ...bossEvent().advice[0],
          source: { kind: "boss", bossRuleId: "boss-ragna-turning" as BossRuleId },
        },
        bossEvent().advice[1],
        bossEvent().advice[2],
      ],
      targetBossId: "boss-spider-2" as BossId,
    });
    expect(() => validateSituationEvents([event], SPIDER_THEME)).toThrow(/다른 보스/);
  });
});
