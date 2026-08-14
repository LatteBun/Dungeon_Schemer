import { describe, expect, it } from "vitest";
import {
  EVENT_EFFECT_HP,
  EVENT_KIND_BASE_HP,
  GRADE_EFFECT_SCALE,
} from "@/lib/content/effects";
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
import { ITEMS } from "@/lib/content/items";
import { EVENT_KINDS, GRADES, RuleError } from "@/lib/domain";
import type {
  CampaignMember,
  ChoiceId,
  ClassId,
  DungeonEvent,
  EventEffectTag,
  EventId,
  EventKind,
  Grade,
  MemberId,
} from "@/lib/domain";
import { createRng } from "@/lib/rng";
import type { Rng } from "@/lib/rng";
import { TRUST_RULES } from "@/lib/rules/trust";
import { resolveEventChoice } from "@/lib/rules/event";

const CHOICE_ID = "choice-test" as ChoiceId;

function member(id: string, currentHp = 100, trust = 50): CampaignMember {
  return {
    id: id as MemberId,
    name: id,
    classId: "warrior" as ClassId,
    personality: "prudent",
    currentHp,
    maxHp: 100,
    trust,
    carriedGold: 20,
    alive: currentHp > 0,
    memory: [],
  };
}

function eventWith(
  kind: EventKind,
  effectTags: readonly EventEffectTag[],
  itemId?: string,
): DungeonEvent {
  return {
    id: "event-test" as EventId,
    kind,
    title: "테스트 사건",
    description: "테스트",
    choices: [{
      id: CHOICE_ID,
      label: "테스트 선택",
      expectedGain: "테스트",
      knownRisk: "테스트",
      effectTags,
      ...(itemId === undefined ? {} : { itemId: itemId as DungeonEvent["choices"][number]["itemId"] }),
    }],
  };
}

function resolve(options: {
  kind: EventKind;
  effectTags: readonly EventEffectTag[];
  grade?: Grade;
  members?: CampaignMember[];
  currentGold?: number;
  itemId?: string;
  rng?: Rng;
}) {
  return resolveEventChoice({
    event: eventWith(options.kind, options.effectTags, options.itemId),
    choiceId: CHOICE_ID,
    grade: options.grade ?? "C",
    members: options.members ?? [member("member-001")],
    currentGold: options.currentGold ?? 30,
    rng: options.rng ?? createRng("사건").derive("event"),
  });
}

function ruleErrorOf(call: () => unknown): RuleError {
  let caught: unknown;
  try {
    call();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(RuleError);
  return caught as RuleError;
}

describe("사건 효과 수치", () => {
  it("분류 기본값과 행동 보정을 더한 뒤 등급 배율을 곱한다", () => {
    for (const grade of GRADES) {
      const result = resolve({ kind: "monster", effectTags: ["sabotage"], grade });
      const expected = Math.round(
        (EVENT_KIND_BASE_HP.monster + EVENT_EFFECT_HP.sabotage)
        * GRADE_EFFECT_SCALE[grade],
      );

      expect(result.hpDelta).toBe(expected);
      expect(result.members[0].currentHp).toBe(100 + expected);
    }
  });

  it("관망해도 분류 기본값만큼 HP가 움직인다", () => {
    for (const kind of EVENT_KINDS) {
      const result = resolve({ kind, effectTags: ["observe"] });

      expect(result.hpDelta).toBe(EVENT_KIND_BASE_HP[kind]);
    }
    expect(resolve({ kind: "monster", effectTags: ["observe"] }).hpDelta)
      .toBeLessThan(0);
  });

  it("회복은 최대 HP를 넘지 않는다", () => {
    const result = resolve({
      kind: "rest",
      effectTags: ["rest"],
      members: [member("member-001", 96)],
    });

    expect(result.hpDelta).toBe(18);
    expect(result.members[0].currentHp).toBe(100);
  });

  it("살아 있는 파티원 전원이 같은 변화를 받고 죽은 사람은 빠진다", () => {
    const dead = { ...member("member-003", 0), alive: false };
    const result = resolve({
      kind: "monster",
      effectTags: ["observe"],
      members: [member("member-001"), member("member-002", 60), dead],
    });

    expect(result.members.map((entry) => entry.currentHp)).toEqual([80, 40, 0]);
    expect(result.members[2].alive).toBe(false);
  });
});

describe("사망과 전멸", () => {
  it("HP가 0 이하가 되면 사망한다", () => {
    const result = resolve({
      kind: "monster",
      effectTags: ["sabotage"],
      members: [member("member-001", 30), member("member-002", 40)],
    });

    expect(result.members[0].currentHp).toBe(0);
    expect(result.members[0].alive).toBe(false);
    expect(result.members[1].currentHp).toBe(6);
    expect(result.members[1].alive).toBe(true);
    expect(result.casualtyIds).toEqual(["member-001"]);
    expect(result.wiped).toBe(false);
  });

  it("살아 있던 파티원이 모두 죽으면 전멸이다", () => {
    const result = resolve({
      kind: "monster",
      effectTags: ["sabotage"],
      grade: "S",
      members: [member("member-001", 30), member("member-002", 40)],
    });

    expect(result.members.every((entry) => entry.alive)).toBe(false);
    expect(result.wiped).toBe(true);
    expect(result.casualtyIds).toEqual(["member-001", "member-002"]);
  });
});

describe("신뢰 변화", () => {
  it("support와 sabotage만 즉시 신뢰를 움직인다", () => {
    const support = resolve({ kind: "rest", effectTags: ["support"] });
    const sabotage = resolve({ kind: "rest", effectTags: ["sabotage"] });
    const observe = resolve({ kind: "rest", effectTags: ["observe"] });

    expect(support.trustChanges[0].reason).toBe(TRUST_RULES.prudent.protectAlly.reason);
    expect(sabotage.trustChanges[0].reason).toBe(TRUST_RULES.prudent.betrayAlly.reason);
    expect(observe.trustChanges).toEqual([]);
  });

  it("죽은 파티원의 신뢰는 바꾸지 않는다", () => {
    const result = resolve({
      kind: "monster",
      effectTags: ["sabotage"],
      members: [member("member-001", 10), member("member-002")],
    });

    expect(result.members[0].alive).toBe(false);
    expect(result.trustChanges.map((change) => change.memberId)).toEqual(["member-002"]);
  });
});

describe("거래", () => {
  it("현재 골드만 줄이고 상품 효과를 즉시 적용한다", () => {
    const potion = ITEMS.find((item) => item.id === "item-healing-potion")!;
    const result = resolve({
      kind: "merchant",
      effectTags: ["trade"],
      itemId: "item-healing-potion",
      currentGold: 30,
      members: [member("member-001", 50)],
    });

    expect(result.goldSpent).toBe(potion.price);
    expect(result.currentGold).toBe(30 - potion.price);
    expect(result.members[0].currentHp).toBeGreaterThan(50);
  });

  it("잔액보다 비싼 거래는 오류를 던지고 아무것도 바꾸지 않는다", () => {
    const members = [member("member-001", 50)];
    const snapshot = structuredClone(members);
    const error = ruleErrorOf(() => resolve({
      kind: "merchant",
      effectTags: ["trade"],
      itemId: "item-information-scroll",
      currentGold: 3,
      members,
    }));

    expect(error.code).toBe("INSUFFICIENT_GOLD");
    expect(members).toEqual(snapshot);
  });

  it("상품을 가리키지 않는 거래 선택지는 거부한다", () => {
    const error = ruleErrorOf(() => resolve({
      kind: "merchant",
      effectTags: ["trade"],
    }));

    expect(error.code).toBe("UNKNOWN_ID");
  });

  it("거래가 아닌 선택은 골드를 쓰지 않는다", () => {
    const result = resolve({ kind: "merchant", effectTags: ["observe"], currentGold: 30 });

    expect(result.goldSpent).toBe(0);
    expect(result.currentGold).toBe(30);
  });
});

describe("입력 검증과 재현성", () => {
  it("사건에 없는 선택지는 거부한다", () => {
    const error = ruleErrorOf(() => resolveEventChoice({
      event: eventWith("rest", ["observe"]),
      choiceId: "choice-없음" as ChoiceId,
      grade: "C",
      members: [member("member-001")],
      currentGold: 10,
      rng: createRng("없음").derive("event"),
    }));

    expect(error.code).toBe("UNKNOWN_ID");
  });

  it("같은 입력과 시드는 같은 결과를 낸다", () => {
    const run = () => resolve({
      kind: "monster",
      effectTags: ["sabotage"],
      rng: createRng("재현").derive("event"),
    });

    expect(run()).toEqual(run());
  });

  it("입력 파티원 배열을 바꾸지 않는다", () => {
    const members = [member("member-001"), member("member-002")];
    const snapshot = structuredClone(members);
    resolve({ kind: "monster", effectTags: ["sabotage"], members });

    expect(members).toEqual(snapshot);
  });
});

describe("F2 콘텐츠와의 연결", () => {
  it("모든 사건 선택지가 실제로 해석 가능한 태그를 갖는다", () => {
    const events = [
      ...EVENT_KINDS.flatMap((kind) => DUNGEON_EVENT_POOLS.regular[kind]),
      ...DUNGEON_EVENT_POOLS.boss,
    ];

    for (const event of events) {
      for (const choice of event.choices) {
        expect(choice.effectTags.length).toBeGreaterThan(0);
        if (choice.effectTags.includes("trade")) {
          expect(ITEMS.some((item) => item.id === choice.itemId)).toBe(true);
        }
      }
    }
  });

  it("사건마다 서로 다른 결과를 내는 선택지가 있다", () => {
    const events = EVENT_KINDS.flatMap((kind) => DUNGEON_EVENT_POOLS.regular[kind]);

    for (const event of events) {
      const outcomes = event.choices.map((choice) => resolveEventChoice({
        event,
        choiceId: choice.id,
        grade: "C",
        members: [member("member-001")],
        currentGold: 50,
        rng: createRng("비교").derive("event"),
      }));
      const signatures = outcomes.map((outcome) =>
        `${outcome.hpDelta}/${outcome.goldSpent}/${outcome.trustChanges.length}`);

      expect(new Set(signatures).size, `${event.id}의 선택지가 모두 같은 결과다`)
        .toBeGreaterThan(1);
    }
  });
});
