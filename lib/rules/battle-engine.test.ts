import { describe, expect, it } from "vitest";
import { RuleError } from "@/lib/domain";
import {
  resolveBattle,
  type BattleInput,
  type BattlePartyMember,
  type BattlePartyMemberAbilityState,
} from "@/lib/rules/battle-engine";

const party = [
  { id: "warrior", classId: "warrior", hp: 20, maxHp: 20, attack: 6, hitWeight: 3 },
  { id: "mage", classId: "mage", hp: 20, maxHp: 20, attack: 9, hitWeight: 1 },
];

function emergencyHeal(
  overrides: Partial<BattlePartyMemberAbilityState> = {},
): BattlePartyMemberAbilityState {
  return {
    kind: "emergencyHeal",
    name: "치유 기도",
    healAmount: 5,
    usesPerExpedition: 2,
    maxUsesPerBattle: 1,
    triggerAtOrBelowHpPercent: 50,
    remainingUses: 2,
    ...overrides,
  };
}

function member(
  id: string,
  overrides: Partial<BattlePartyMember> = {},
): BattlePartyMember {
  return {
    id,
    classId: "cleric",
    hp: 20,
    maxHp: 20,
    attack: 5,
    hitWeight: 1,
    ...overrides,
  };
}

function durableEnemy(overrides: Partial<BattleInput["enemies"][number]> = {}) {
  return {
    id: "ogre#1",
    monsterId: "ogre",
    hp: 100,
    maxHp: 100,
    baseDamage: 0,
    ...overrides,
  };
}

function expectInvalidGeneration(input: BattleInput): void {
  try {
    resolveBattle(input);
    throw new Error("INVALID_GENERATION이 발생하지 않았다");
  } catch (error) {
    expect(error).toBeInstanceOf(RuleError);
    expect((error as RuleError).code).toBe("INVALID_GENERATION");
  }
}

describe("공통 BattleEngine", () => {
  it("party phase 후 살아 있는 적이 없으면 enemy phase를 생략한다", () => {
    const result = resolveBattle({
      seed: "battle-1",
      party,
      enemies: [{ id: "rat#1", monsterId: "rat", hp: 1, maxHp: 1, baseDamage: 5 }],
    });
    expect(result.status).toBe("victory");
    expect(result.actions.some((action) => action.actorSide === "enemy")).toBe(false);
  });

  it("동일 입력은 action record까지 결정적이고 50라운드에 wipe한다", () => {
    const input = {
      seed: "battle-2",
      party: [{ ...party[0], attack: 0 }],
      enemies: [{ id: "ogre#1", monsterId: "ogre", hp: 999, maxHp: 999, baseDamage: 0 }],
    };
    const first = resolveBattle(input);
    expect(first.status).toBe("wipe");
    expect(first.rounds).toBe(50);
    expect(first.termination).toBe("roundLimit");
    expect(first).toEqual(resolveBattle(input));
  });

  it("파티가 전멸하면 roundLimit과 구분되는 partyWipe를 기록한다", () => {
    const result = resolveBattle({
      seed: "battle-party-wipe",
      party: [{ ...party[0], hp: 1, attack: 0 }],
      enemies: [{ id: "ogre#1", monsterId: "ogre", hp: 10, maxHp: 10, baseDamage: 5 }],
    });
    expect(result.status).toBe("wipe");
    expect(result.termination).toBe("partyWipe");
  });

  it("적 target weight는 직업 hitWeight와 modifier의 곱이다", () => {
    const result = resolveBattle({
      seed: "battle-3",
      party,
      enemies: [{ id: "rat#1", monsterId: "rat", hp: 50, maxHp: 50, baseDamage: 1 }],
      targetWeightMultipliers: { warrior: 2, mage: 0.5 },
    });
    expect(result.actions.find((action) => action.actorSide === "enemy")?.targetId).toBeDefined();
  });

  it("적별 target weight를 적용한다", () => {
    const result = resolveBattle({
      seed: "battle-enemy-target-weight",
      party,
      enemies: [{ id: "hunter#1", monsterId: "hunter", hp: 50, maxHp: 50, baseDamage: 1, targetWeightMultipliers: { warrior: 0, mage: 10 } }],
    });
    expect(result.actions.find((action) => action.actorSide === "enemy")?.targetId).toBe("mage");
  });

  it("같은 직업이어도 member ID별 target weight를 적용한다", () => {
    const result = resolveBattle({
      seed: "battle-member-target-weight",
      party: [
        { id: "warrior-a", classId: "warrior", hp: 20, maxHp: 20, attack: 0, hitWeight: 1 },
        { id: "warrior-b", classId: "warrior", hp: 20, maxHp: 20, attack: 0, hitWeight: 1 },
      ],
      enemies: [{ id: "rat#1", monsterId: "rat", hp: 50, maxHp: 50, baseDamage: 1 }],
      targetWeightMultiplierByMemberId: { "warrior-a": 0.01, "warrior-b": 100 },
    });
    expect(result.actions.find((action) => action.actorSide === "enemy")?.targetId).toBe("warrior-b");
  });

  it("outgoing damage를 member ID별로 적용한다", () => {
    const result = resolveBattle({
      seed: "battle-member-outgoing",
      party: [{ id: "warrior-a", classId: "warrior", hp: 20, maxHp: 20, attack: 10, hitWeight: 1 }],
      enemies: [{ id: "rat#1", monsterId: "rat", hp: 50, maxHp: 50, baseDamage: 0 }],
      outgoingDamageMultiplierByMemberId: { "warrior-a": 0.8 },
    });
    const first = result.actions[0];
    expect(first?.kind).toBe("attack");
    if (first?.kind !== "attack") throw new Error("첫 행동이 공격이 아니다");
    expect(first.damage).toBe(8);
  });
});

describe("응급 치유 선택", () => {
  it("정확히 50%인 자기 자신을 공격 대신 치유하고 한 차례에 행동 하나만 기록한다", () => {
    const result = resolveBattle({
      seed: "heal-exact-half-self",
      party: [member("cleric", { hp: 10, battleAbility: emergencyHeal() })],
      enemies: [durableEnemy({ hp: 5, maxHp: 5 })],
    });

    expect(result.actions[0]).toEqual({
      kind: "heal",
      round: 1,
      actorSide: "party",
      actorId: "cleric",
      targetId: "cleric",
      abilityKind: "emergencyHeal",
      healing: 5,
      targetHpBefore: 10,
      targetHpAfter: 15,
    });
    expect(result.actions.filter((action) => action.round === 1 && action.actorId === "cleric")).toHaveLength(1);
    expect(result.party[0]).toMatchObject({
      hp: 15,
      battleAbility: { remainingUses: 1 },
    });
  });

  it("50%를 초과하면 치유하지 않고 기존 공격을 한다", () => {
    const result = resolveBattle({
      seed: "heal-above-half",
      party: [member("cleric", { hp: 11, battleAbility: emergencyHeal() })],
      enemies: [durableEnemy({ hp: 5, maxHp: 5 })],
    });

    expect(result.actions[0]).toMatchObject({
      kind: "attack",
      actorId: "cleric",
      targetId: "ogre#1",
      damage: 5,
    });
    expect(result.party[0]?.battleAbility?.remainingUses).toBe(2);
  });

  it("홀수 max HP는 정수 경계 비교로 50% 이하만 치유한다", () => {
    const eligible = resolveBattle({
      seed: "heal-odd-eligible",
      party: [member("cleric", { hp: 10, maxHp: 21, battleAbility: emergencyHeal() })],
      enemies: [durableEnemy({ hp: 5, maxHp: 5 })],
    });
    const ineligible = resolveBattle({
      seed: "heal-odd-ineligible",
      party: [member("cleric", { hp: 11, maxHp: 21, battleAbility: emergencyHeal() })],
      enemies: [durableEnemy({ hp: 5, maxHp: 5 })],
    });

    expect(eligible.actions[0]?.kind).toBe("heal");
    expect(ineligible.actions[0]?.kind).toBe("attack");
  });

  it("사망자를 제외하고 HP 비율이 가장 낮은 생존자를 교차 곱으로 고른다", () => {
    const result = resolveBattle({
      seed: "heal-lowest-ratio",
      party: [
        member("dead", { hp: 0, maxHp: 100, battleAbility: undefined }),
        member("cleric", { hp: 5, maxHp: 20, battleAbility: emergencyHeal() }),
        member("ally", { hp: 3, maxHp: 20, battleAbility: undefined }),
      ],
      enemies: [durableEnemy()],
    });

    expect(result.actions[0]).toMatchObject({
      kind: "heal",
      actorId: "cleric",
      targetId: "ally",
      healing: 5,
    });
  });

  it("같은 HP 비율이면 BattleInput.party의 앞선 생존자를 고른다", () => {
    const result = resolveBattle({
      seed: "heal-input-order-tie",
      party: [
        member("ally-first", { hp: 4, maxHp: 20, battleAbility: undefined }),
        member("cleric", { hp: 5, maxHp: 20, battleAbility: emergencyHeal() }),
        member("ally-second", { hp: 2, maxHp: 10, battleAbility: undefined }),
      ],
      enemies: [durableEnemy()],
    });

    expect(result.actions.find((action) => action.kind === "heal")?.targetId).toBe("ally-first");
  });

  it("max HP에서 clamp한 실제 회복량만 기록하고 소비한다", () => {
    const result = resolveBattle({
      seed: "heal-max-hp-clamp",
      party: [member("cleric", {
        hp: 18,
        battleAbility: emergencyHeal({ triggerAtOrBelowHpPercent: 100 }),
      })],
      enemies: [durableEnemy({ hp: 5, maxHp: 5 })],
    });

    expect(result.actions[0]).toMatchObject({
      kind: "heal",
      healing: 2,
      targetHpBefore: 18,
      targetHpAfter: 20,
    });
    expect(result.party[0]?.battleAbility?.remainingUses).toBe(1);
  });

  it("잔여 횟수가 0이면 조건을 만족해도 공격한다", () => {
    const result = resolveBattle({
      seed: "heal-no-remaining-uses",
      party: [member("cleric", {
        hp: 10,
        battleAbility: emergencyHeal({ remainingUses: 0 }),
      })],
      enemies: [durableEnemy({ hp: 5, maxHp: 5 })],
    });

    expect(result.actions[0]?.kind).toBe("attack");
    expect(result.party[0]?.battleAbility?.remainingUses).toBe(0);
  });

  it("한 능력 보유자는 여러 라운드에서도 전투당 한도까지만 치유한다", () => {
    const result = resolveBattle({
      seed: "heal-once-per-battle",
      party: [member("cleric", {
        hp: 1,
        attack: 1,
        battleAbility: emergencyHeal(),
      })],
      enemies: [durableEnemy({ hp: 3, maxHp: 3 })],
    });

    expect(result.actions.filter((action) => action.kind === "heal")).toHaveLength(1);
    expect(result.actions.filter((action) => action.kind === "attack" && action.actorId === "cleric")).toHaveLength(3);
    expect(result.party[0]?.battleAbility?.remainingUses).toBe(1);
  });

  it("앞선 파티원이 마지막 적을 쓰러뜨리면 뒤 능력 보유자는 치유하거나 소비하지 않는다", () => {
    const result = resolveBattle({
      seed: "heal-after-last-enemy",
      party: [
        member("fighter", { hp: 20, attack: 10, battleAbility: undefined }),
        member("cleric", { hp: 1, battleAbility: emergencyHeal() }),
      ],
      enemies: [durableEnemy({ hp: 1, maxHp: 1 })],
    });

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toMatchObject({ kind: "attack", actorId: "fighter" });
    expect(result.party[1]?.battleAbility?.remainingUses).toBe(2);
  });

  it("서로 다른 두 능력 보유자는 전투당 한도와 잔여 횟수를 독립적으로 관리한다", () => {
    const result = resolveBattle({
      seed: "heal-independent-holders",
      party: [
        member("cleric-a", { hp: 1, battleAbility: emergencyHeal() }),
        member("cleric-b", { hp: 2, battleAbility: emergencyHeal({ remainingUses: 1 }) }),
      ],
      enemies: [durableEnemy({ hp: 10, maxHp: 10 })],
    });

    expect(result.actions.filter((action) => action.kind === "heal").map((action) => action.actorId)).toEqual([
      "cleric-a",
      "cleric-b",
    ]);
    expect(result.party.map((one) => one.battleAbility?.remainingUses)).toEqual([1, 0]);
  });

  it("사건·상인·조언 압력·보스 outgoingDamage 공격 배율은 고정 회복량을 바꾸지 않는다", () => {
    const result = resolveBattle({
      seed: "heal-ignores-outgoing-multipliers",
      party: [member("cleric", { hp: 1, battleAbility: emergencyHeal() })],
      enemies: [durableEnemy({ hp: 5, maxHp: 5 })],
      partyDamageMultiplier: 0.25 * 1.8,
      outgoingDamageMultiplierByMemberId: { cleric: 0.2 * 1.5 },
    });

    expect(result.actions[0]).toMatchObject({
      kind: "heal",
      healing: 5,
      targetHpBefore: 1,
      targetHpAfter: 6,
    });
  });
});

describe("응급 치유 입력 계약과 회귀", () => {
  it.each([
    ["빈 이름", emergencyHeal({ name: "  " })],
    ["0 회복량", emergencyHeal({ healAmount: 0 })],
    ["안전하지 않은 회복량", emergencyHeal({ healAmount: Number.MAX_SAFE_INTEGER + 1 })],
    ["0 원정 횟수", emergencyHeal({ usesPerExpedition: 0 })],
    ["0 전투 횟수", emergencyHeal({ maxUsesPerBattle: 0 })],
    ["전투 횟수가 원정 횟수 초과", emergencyHeal({ maxUsesPerBattle: 3 })],
    ["0 발동 백분율", emergencyHeal({ triggerAtOrBelowHpPercent: 0 })],
    ["100 초과 발동 백분율", emergencyHeal({ triggerAtOrBelowHpPercent: 101 })],
    ["음수 잔여 횟수", emergencyHeal({ remainingUses: -1 })],
    ["원정 횟수 초과 잔여 횟수", emergencyHeal({ remainingUses: 3 })],
    ["비정수 잔여 횟수", emergencyHeal({ remainingUses: 0.5 })],
  ])("%s 런타임 능력 입력을 INVALID_GENERATION으로 거부한다", (_caseName, battleAbility) => {
    expectInvalidGeneration({
      seed: "heal-invalid-runtime",
      party: [member("cleric", { battleAbility })],
      enemies: [durableEnemy()],
    });
  });

  it("알 수 없는 런타임 능력 kind를 INVALID_GENERATION으로 거부한다", () => {
    expectInvalidGeneration({
      seed: "heal-invalid-kind",
      party: [member("cleric", {
        battleAbility: {
          ...emergencyHeal(),
          kind: "unknown",
        } as unknown as BattlePartyMemberAbilityState,
      })],
      enemies: [durableEnemy()],
    });
  });

  it("입력과 중첩 능력을 복사하고 결과에 최종 remainingUses를 반환한다", () => {
    const ability = emergencyHeal();
    const input: BattleInput = {
      seed: "heal-copy-input",
      party: [member("cleric", { hp: 10, battleAbility: ability })],
      enemies: [durableEnemy({ hp: 5, maxHp: 5 })],
    };
    const before = structuredClone(input);

    const result = resolveBattle(input);

    expect(input).toEqual(before);
    expect(result.party[0]).not.toBe(input.party[0]);
    expect(result.party[0]?.battleAbility).not.toBe(ability);
    expect(result.party[0]?.battleAbility?.remainingUses).toBe(1);
    expect(ability.remainingUses).toBe(2);
  });

  it("능력이 없는 기존 전투는 kind 외의 행동 순서·대상·피해·최종 HP와 seed 재현성을 보존한다", () => {
    const input: BattleInput = {
      seed: "battle-regression",
      party: [
        member("warrior", { classId: "warrior", hp: 12, attack: 4, hitWeight: 3 }),
        member("mage", { classId: "mage", hp: 20, attack: 6, hitWeight: 1 }),
      ],
      enemies: [durableEnemy({ id: "rat#1", monsterId: "rat", hp: 15, maxHp: 15, baseDamage: 3 })],
    };

    const first = resolveBattle(input);
    expect(first).toEqual(resolveBattle(input));
    expect(first.actions).toEqual([
      { kind: "attack", round: 1, actorSide: "party", actorId: "warrior", targetId: "rat#1", damage: 4, targetHpBefore: 15, targetHpAfter: 11, defeated: false },
      { kind: "attack", round: 1, actorSide: "party", actorId: "mage", targetId: "rat#1", damage: 6, targetHpBefore: 11, targetHpAfter: 5, defeated: false },
      { kind: "attack", round: 1, actorSide: "enemy", actorId: "rat#1", targetId: "mage", damage: 3, targetHpBefore: 20, targetHpAfter: 17, defeated: false },
      { kind: "attack", round: 2, actorSide: "party", actorId: "warrior", targetId: "rat#1", damage: 4, targetHpBefore: 5, targetHpAfter: 1, defeated: false },
      { kind: "attack", round: 2, actorSide: "party", actorId: "mage", targetId: "rat#1", damage: 6, targetHpBefore: 1, targetHpAfter: 0, defeated: true },
    ]);
    expect(first.party.map(({ id, hp }) => ({ id, hp }))).toEqual([
      { id: "warrior", hp: 12 },
      { id: "mage", hp: 17 },
    ]);
    expect(first.enemies.map(({ id, hp }) => ({ id, hp }))).toEqual([{ id: "rat#1", hp: 0 }]);
  });

  it("치유 조건이 없는 능력 입력은 기존 공격과 같은 대상 RNG·피해·최종 HP를 보존한다", () => {
    const base: BattleInput = {
      seed: "battle-non-trigger-regression",
      party: [
        member("cleric", { hp: 20, battleAbility: undefined }),
        member("warrior", { classId: "warrior", hp: 20, attack: 6, hitWeight: 3 }),
      ],
      enemies: [durableEnemy({ hp: 30, maxHp: 30, baseDamage: 2 })],
    };
    const withNonTriggeringAbility: BattleInput = {
      ...base,
      party: [member("cleric", { hp: 20, battleAbility: emergencyHeal() }), base.party[1]!],
    };

    const withoutAbility = resolveBattle(base);
    const withAbility = resolveBattle(withNonTriggeringAbility);

    expect(withAbility.actions).toEqual(withoutAbility.actions);
    expect(withAbility.party.map(({ id, hp }) => ({ id, hp }))).toEqual(
      withoutAbility.party.map(({ id, hp }) => ({ id, hp })),
    );
    expect(withAbility.enemies).toEqual(withoutAbility.enemies);
    expect(withAbility.party[0]?.battleAbility?.remainingUses).toBe(2);
  });
});
