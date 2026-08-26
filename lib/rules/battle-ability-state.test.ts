import { describe, expect, it } from "vitest";
import type {
  BattlePartyMember,
  Character,
  CharacterId,
  ClassDef,
  ClassId,
} from "@/lib/domain";
import {
  createBattleAbilityUsesForParty,
  extractBattleAbilityUsesAfterBattle,
  hydrateBattlePartyAbility,
  validateBattleAbilityUses,
} from "./battle-ability-state";

const classDefs: readonly ClassDef[] = [
  {
    id: "warrior" as ClassId,
    name: "전사",
    description: "능력 없음",
    maxHp: 45,
    attack: 8,
    hitWeight: 3,
  },
  {
    id: "cleric" as ClassId,
    name: "성직자",
    description: "치유",
    maxHp: 28,
    attack: 5,
    hitWeight: 1,
    battleAbility: {
      kind: "emergencyHeal",
      name: "치유 기도",
      healTargetMaxHpPercent: 25,
      usesPerExpedition: 2,
      triggerAtOrBelowHpPercent: 50,
    },
  },
];

function character(
  id: string,
  classId: "warrior" | "cleric",
  overrides: Partial<Character> = {},
): Character {
  const classDef = classDefs.find((candidate) => candidate.id === classId)!;
  return {
    id: id as CharacterId,
    name: id,
    classId: classDef.id,
    personality: "prudent",
    maxHp: classDef.maxHp,
    hp: classDef.maxHp,
    trust: 50,
    gold: 20,
    alive: true,
    gravelyWounded: false,
    ...overrides,
  };
}

const cleric = character("cleric-alive", "cleric");
const deadCleric = character("cleric-dead", "cleric", { hp: 0, alive: false });
const warrior = character("warrior", "warrior");
const members = [cleric, deadCleric, warrior] as const;

function battleMember(
  member: Character,
  remainingUses: number,
): BattlePartyMember {
  const classDef = classDefs.find((candidate) => candidate.id === member.classId)!;
  return {
    id: member.id,
    classId: member.classId,
    hp: member.hp,
    maxHp: member.maxHp,
    attack: classDef.attack,
    hitWeight: classDef.hitWeight,
    battleAbility: classDef.battleAbility === undefined
      ? undefined
      : { ...classDef.battleAbility, remainingUses },
  };
}

describe("원정 전투 능력 횟수", () => {
  it("현재 파티의 능력 보유자만 원정 초기 횟수로 만든다", () => {
    expect(createBattleAbilityUsesForParty({ members, classDefs })).toEqual({
      "cleric-alive": 2,
      "cleric-dead": 2,
    });
  });

  it("능력 정의와 현재 잔여 횟수를 전투원 런타임 상태로 결합한다", () => {
    const classDef = classDefs[1]!;
    const usesRemaining = { [cleric.id]: 1 };

    const hydrated = hydrateBattlePartyAbility({ member: cleric, classDef, usesRemaining });

    expect(hydrated).toEqual({ ...classDef.battleAbility, remainingUses: 1 });
    expect(hydrated).not.toBe(classDef.battleAbility);
    expect(hydrateBattlePartyAbility({ member: warrior, classDef: classDefs[0]!, usesRemaining: {} }))
      .toBeUndefined();
  });

  it("시작 상태는 모든 능력 보유자의 정확한 초기 횟수만 허용한다", () => {
    expect(() => validateBattleAbilityUses({
      members,
      classDefs,
      usesRemaining: { [cleric.id]: 2, [deadCleric.id]: 2 },
      phase: "start",
      errorCode: "INVALID_TRANSITION",
    })).not.toThrow();

    expect(() => validateBattleAbilityUses({
      members,
      classDefs,
      usesRemaining: { [cleric.id]: 1, [deadCleric.id]: 2 },
      phase: "start",
      errorCode: "INVALID_TRANSITION",
    })).toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }));
  });

  it("활성 상태는 사망한 능력 보유자 키를 포함해 0부터 초기값까지 허용한다", () => {
    for (const usesRemaining of [
      { [cleric.id]: 0, [deadCleric.id]: 1 },
      { [cleric.id]: 2, [deadCleric.id]: 0 },
    ]) {
      expect(() => validateBattleAbilityUses({
        members,
        classDefs,
        usesRemaining,
        phase: "active",
        errorCode: "INVALID_GENERATION",
      })).not.toThrow();
    }
  });

  it.each([
    ["능력 보유자 키 누락", { [cleric.id]: 2 }],
    ["무능력 파티원 키", { [cleric.id]: 2, [deadCleric.id]: 2, [warrior.id]: 0 }],
    ["알 수 없는 캐릭터 키", { [cleric.id]: 2, [deadCleric.id]: 2, unknown: 0 }],
    ["음수", { [cleric.id]: -1, [deadCleric.id]: 2 }],
    ["초기값 초과", { [cleric.id]: 3, [deadCleric.id]: 2 }],
    ["비정수", { [cleric.id]: 1.5, [deadCleric.id]: 2 }],
    ["안전하지 않은 정수", { [cleric.id]: Number.MAX_SAFE_INTEGER + 1, [deadCleric.id]: 2 }],
  ])("%s인 활성 맵을 지정한 오류 코드로 거부한다", (_caseName, usesRemaining) => {
    expect(() => validateBattleAbilityUses({
      members,
      classDefs,
      usesRemaining,
      phase: "active",
      errorCode: "INVALID_GENERATION",
    })).toThrowError(expect.objectContaining({ code: "INVALID_GENERATION" }));
  });

  it("맵 자체가 없으면 TypeError 대신 지정한 규칙 오류로 거부한다", () => {
    expect(() => validateBattleAbilityUses({
      members,
      classDefs,
      usesRemaining: undefined as never,
      phase: "active",
      errorCode: "INVALID_TRANSITION",
    })).toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }));
  });

  it("문자열 캐릭터 ID가 아닌 Symbol own key를 INVALID_GENERATION으로 거부한다", () => {
    const extraKey = Symbol("숨은 능력 키");
    const usesRemaining = {
      [cleric.id]: 2,
      [deadCleric.id]: 2,
      [extraKey]: 0,
    };

    expect(() => validateBattleAbilityUses({
      members,
      classDefs,
      usesRemaining,
      phase: "active",
      errorCode: "INVALID_GENERATION",
    })).toThrowError(expect.objectContaining({ code: "INVALID_GENERATION" }));
  });

  it.each([
    ["Map", new Map([["unknown", 1]])],
    ["Date", new Date(0)],
  ])("%s처럼 record가 아닌 객체를 INVALID_GENERATION으로 거부한다", (_caseName, usesRemaining) => {
    expect(() => validateBattleAbilityUses({
      members: [warrior],
      classDefs,
      usesRemaining: usesRemaining as never,
      phase: "active",
      errorCode: "INVALID_GENERATION",
    })).toThrowError(expect.objectContaining({ code: "INVALID_GENERATION" }));
  });

  it("전투 참가자의 최종 횟수만 덮고 사망한 능력 보유자의 잔여 키는 보존한다", () => {
    const before = { [cleric.id]: 2, [deadCleric.id]: 1 };

    const extracted = extractBattleAbilityUsesAfterBattle({
      before,
      members,
      classDefs,
      battleParty: [battleMember(cleric, 1), battleMember(warrior, 0)],
    });

    expect(extracted).toEqual({ [cleric.id]: 1, [deadCleric.id]: 1 });
    expect(extracted).not.toBe(before);
  });

  it("전투 뒤 횟수가 전투 전보다 늘어나면 INVALID_GENERATION으로 거부한다", () => {
    expect(() => extractBattleAbilityUsesAfterBattle({
      before: { [cleric.id]: 1, [deadCleric.id]: 0 },
      members,
      classDefs,
      battleParty: [battleMember(cleric, 2)],
    })).toThrowError(expect.objectContaining({ code: "INVALID_GENERATION" }));
  });
});
