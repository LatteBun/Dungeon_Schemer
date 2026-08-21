import { describe, expect, it } from "vitest";
import { RuleError } from "@/lib/domain";
import type {
  Character,
  CharacterId,
  ChoiceId,
  ClassId,
  MerchantAdviceOption,
  PendingMerchantEffect,
} from "@/lib/domain";
import {
  applyAcceptedMerchantAdvice,
  consumePendingMerchantEffect,
  getMerchantAdviceAvailability,
} from "@/lib/rules/merchant";

const immediateHelp: MerchantAdviceOption = {
  id: "merchant-immediate-help" as ChoiceId,
  label: "응급 치료를 받는다",
  line: "상처부터 봉합하자고 하세요.",
  outcome: "help",
  relation: "unrelated",
  effectTags: ["trade", "support"],
  resultText: "상처를 봉합했다.",
  goldCost: 5,
  merchantEffect: { immediateHpDeltaPerMember: 8 },
};

const immediateHarm: MerchantAdviceOption = {
  id: "merchant-immediate-harm" as ChoiceId,
  label: "수상한 처치를 받는다",
  line: "값싼 약도 충분하다고 하세요.",
  outcome: "harm",
  relation: "unrelated",
  effectTags: ["trade", "sabotage"],
  resultText: "처치가 상처를 악화시켰다.",
  goldCost: 4,
  merchantEffect: { immediateHpDeltaPerMember: -10 },
};

const delayedHelp: MerchantAdviceOption = {
  id: "merchant-delayed-help" as ChoiceId,
  label: "방호 서비스를 받는다",
  line: "다음 전투를 대비해 달라고 하세요.",
  outcome: "help",
  relation: "unrelated",
  effectTags: ["trade", "support"],
  resultText: "다음 전투를 위한 방호가 준비됐다.",
  goldCost: 6,
  merchantEffect: { nextBattle: { incomingDamageMultiplier: 0.75 } },
};

const compositeHelp: MerchantAdviceOption = {
  id: "merchant-composite-help" as ChoiceId,
  label: "농축 영양식을 먹는다",
  line: "지금 먹고 다음 전투도 대비하자고 하세요.",
  outcome: "help",
  relation: "unrelated",
  effectTags: ["trade", "support"],
  resultText: "기력을 회복하고 다음 전투를 준비했다.",
  goldCost: 8,
  merchantEffect: {
    immediateHpDeltaPerMember: 8,
    nextBattle: { partyDamageMultiplier: 1.3 },
  },
};

const neutral: MerchantAdviceOption = {
  id: "merchant-neutral" as ChoiceId,
  label: "거래하지 않는다",
  line: "필요 없다고 하세요.",
  outcome: "neutral",
  relation: "unrelated",
  effectTags: ["observe"],
  resultText: "아무것도 사지 않았다.",
  goldCost: 0,
};

const pending: PendingMerchantEffect = {
  adviceId: "merchant-existing-delayed" as ChoiceId,
  nextBattle: { incomingDamageMultiplier: 0.9 },
};

function member(
  id: string,
  hp: number,
  maxHp: number,
  alive = true,
): Character {
  return {
    id: id as CharacterId,
    name: id,
    classId: "test-class" as ClassId,
    personality: "prudent",
    maxHp,
    hp,
    trust: 50,
    gold: 30,
    alive,
    gravelyWounded: false,
  };
}

function expectRuleError(
  operation: () => unknown,
  code: RuleError["code"],
): void {
  try {
    operation();
    expect.fail("RuleError가 발생해야 한다");
  } catch (error) {
    expect(error).toBeInstanceOf(RuleError);
    expect((error as RuleError).code).toBe(code);
  }
}

describe("merchant 조언 실행 가능 여부", () => {
  it("현재 골드가 비용보다 적으면 실행할 수 없다", () => {
    expect(getMerchantAdviceAvailability(immediateHelp, 4, null)).toEqual({
      executable: false,
      reason: "insufficientGold",
    });
  });

  it("pending이 있으면 다음 전투 성분을 새로 예약할 수 없다", () => {
    expect(getMerchantAdviceAvailability(delayedHelp, 20, pending)).toEqual({
      executable: false,
      reason: "pendingEffect",
    });
    expect(getMerchantAdviceAvailability(compositeHelp, 20, pending)).toEqual({
      executable: false,
      reason: "pendingEffect",
    });
  });

  it("pending이 있어도 즉시형과 neutral은 실행할 수 있다", () => {
    expect(getMerchantAdviceAvailability(immediateHelp, 20, pending)).toEqual({
      executable: true,
    });
    expect(getMerchantAdviceAvailability(neutral, 0, pending)).toEqual({
      executable: true,
    });
  });

  it("비용과 같은 골드가 있으면 실행할 수 있다", () => {
    expect(getMerchantAdviceAvailability(delayedHelp, 6, null)).toEqual({
      executable: true,
    });
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "유효하지 않은 현재 골드 %s를 거절한다",
    (gold) => {
      expectRuleError(
        () => getMerchantAdviceAvailability(immediateHelp, gold, null),
        "INVALID_STATE",
      );
    },
  );

  it("유효하지 않은 기존 pending 상태를 거절한다", () => {
    const invalidPending = {
      adviceId: "merchant-invalid-pending" as ChoiceId,
      nextBattle: { incomingDamageMultiplier: 0 },
    } as PendingMerchantEffect;

    expectRuleError(
      () => getMerchantAdviceAvailability(immediateHelp, 20, invalidPending),
      "INVALID_STATE",
    );
  });
});

describe("수용된 merchant 조언 적용", () => {
  it("골드를 한 번 차감하고 복합 효과의 HP와 pending을 함께 적용한다", () => {
    const members = [
      member("member-one", 20, 40),
      member("member-two", 27, 30),
      member("member-dead", 32, 40, false),
    ] as const;
    const before = structuredClone(members);

    const applied = applyAcceptedMerchantAdvice({
      advice: compositeHelp,
      gold: 20,
      members,
      pendingMerchantEffect: null,
    });

    expect(applied.gold).toBe(12);
    expect(applied.members.map((candidate) => candidate.hp)).toEqual([28, 30, 32]);
    expect(applied.pendingMerchantEffect).toEqual({
      adviceId: compositeHelp.id,
      nextBattle: { partyDamageMultiplier: 1.3 },
    });
    expect(members).toEqual(before);
    expect(applied.members).not.toBe(members);
  });

  it("merchant 직접 피해는 살아 있는 구성원의 HP를 1 아래로 내리지 않는다", () => {
    const living = member("living", 3, 40);
    const dead = member("dead", 3, 40, false);

    const applied = applyAcceptedMerchantAdvice({
      advice: immediateHarm,
      gold: 10,
      members: [living, dead],
      pendingMerchantEffect: null,
    });

    expect(applied.members.map((candidate) => candidate.hp)).toEqual([1, 3]);
    expect(living.hp).toBe(3);
    expect(dead.hp).toBe(3);
  });

  it("즉시 회복은 maxHp를 넘지 않고 기존 pending을 그대로 보존한다", () => {
    const existing = structuredClone(pending);
    const applied = applyAcceptedMerchantAdvice({
      advice: immediateHelp,
      gold: 10,
      members: [member("member", 38, 40)],
      pendingMerchantEffect: existing,
    });

    expect(applied.gold).toBe(5);
    expect(applied.members[0]?.hp).toBe(40);
    expect(applied.pendingMerchantEffect).toBe(existing);
    expect(existing).toEqual(pending);
  });

  it("neutral은 0G이고 gold, HP, pending을 바꾸지 않는다", () => {
    const members = [member("member", 20, 40)] as const;
    const input = {
      advice: neutral,
      gold: 10,
      members,
      pendingMerchantEffect: pending,
    } as const;

    const applied = applyAcceptedMerchantAdvice(input);

    expect(applied).toEqual({
      gold: 10,
      members,
      pendingMerchantEffect: pending,
    });
    expect(input.gold).toBe(10);
    expect(input.members[0].hp).toBe(20);
    expect(input.pendingMerchantEffect).toBe(pending);
  });

  it("골드 부족을 RuleError로 거절하고 입력을 변경하지 않는다", () => {
    const members = [member("member", 20, 40)] as const;
    const input = {
      advice: immediateHelp,
      gold: 4,
      members,
      pendingMerchantEffect: null,
    } as const;
    const before = structuredClone(input);

    expectRuleError(
      () => applyAcceptedMerchantAdvice(input),
      "INSUFFICIENT_GOLD",
    );
    expect(input).toEqual(before);
  });

  it("pending 교체를 RuleError로 거절하고 입력을 변경하지 않는다", () => {
    const members = [member("member", 20, 40)] as const;
    const input = {
      advice: delayedHelp,
      gold: 20,
      members,
      pendingMerchantEffect: pending,
    } as const;
    const before = structuredClone(input);

    expectRuleError(
      () => applyAcceptedMerchantAdvice(input),
      "INVALID_STATE",
    );
    expect(input).toEqual(before);
  });

  it("유효하지 않은 Character HP 상태를 적용 전에 거절한다", () => {
    const invalid = member("invalid", 0, 40);

    expectRuleError(
      () => applyAcceptedMerchantAdvice({
        advice: immediateHelp,
        gold: 20,
        members: [invalid],
        pendingMerchantEffect: null,
      }),
      "INVALID_STATE",
    );
    expect(invalid.hp).toBe(0);
  });
});

describe("다음 전투 merchant 효과 소비", () => {
  it("pending을 한 번 꺼내고 반환 상태의 슬롯을 비운다", () => {
    const original = structuredClone(pending);

    const consumed = consumePendingMerchantEffect(original);

    expect(consumed).toEqual({
      pendingMerchantEffect: null,
      nextBattle: { incomingDamageMultiplier: 0.9 },
    });
    expect(original).toEqual(pending);
    expect(consumed.nextBattle).not.toBe(original.nextBattle);
    expect(consumePendingMerchantEffect(consumed.pendingMerchantEffect)).toEqual({
      pendingMerchantEffect: null,
      nextBattle: null,
    });
  });

  it("pending이 없으면 적용할 다음 전투 효과도 없다", () => {
    expect(consumePendingMerchantEffect(null)).toEqual({
      pendingMerchantEffect: null,
      nextBattle: null,
    });
  });

  it("유효하지 않은 pending 효과를 소비하지 않는다", () => {
    const invalidPending = {
      adviceId: "merchant-invalid-pending" as ChoiceId,
      nextBattle: { partyDamageMultiplier: Number.NaN },
    } as PendingMerchantEffect;

    expectRuleError(
      () => consumePendingMerchantEffect(invalidPending),
      "INVALID_STATE",
    );
  });
});
