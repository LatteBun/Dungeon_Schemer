import { describe, expect, it } from "vitest";
import { validateClasses } from "@/lib/content/class-validation";
import { RuleError, type ClassDef, type ClassId } from "@/lib/domain";

function classDef(id: string, overrides: Partial<ClassDef> = {}): ClassDef {
  return {
    id: id as ClassId,
    name: `직업 ${id}`,
    description: `설명 ${id}`,
    maxHp: 10,
    attack: 5,
    hitWeight: 1,
    ...overrides,
  };
}

function emergencyHeal(overrides: Partial<NonNullable<ClassDef["battleAbility"]>> = {}) {
  return {
    kind: "emergencyHeal" as const,
    name: "치유 기도",
    healAmount: 5,
    usesPerExpedition: 2,
    maxUsesPerBattle: 1,
    triggerAtOrBelowHpPercent: 50,
    ...overrides,
  };
}

function expectInvalidGeneration(run: () => void): void {
  try {
    run();
    throw new Error("INVALID_GENERATION이 발생하지 않았다");
  } catch (error) {
    expect(error).toBeInstanceOf(RuleError);
    expect((error as RuleError).code).toBe("INVALID_GENERATION");
  }
}

describe("validateClasses", () => {
  it("능력이 없는 직업과 올바른 응급 치유 능력을 통과시킨다", () => {
    expect(() => validateClasses([
      classDef("warrior"),
      classDef("cleric", { battleAbility: emergencyHeal() }),
    ])).not.toThrow();
  });

  it.each([
    ["빈 이름", emergencyHeal({ name: "  " })],
    ["안전하지 않은 회복량", emergencyHeal({ healAmount: Number.MAX_SAFE_INTEGER + 1 })],
    ["0 회복량", emergencyHeal({ healAmount: 0 })],
    ["0 원정 횟수", emergencyHeal({ usesPerExpedition: 0 })],
    ["0 전투 횟수", emergencyHeal({ maxUsesPerBattle: 0 })],
    ["전투 횟수가 원정 횟수 초과", emergencyHeal({ maxUsesPerBattle: 3 })],
    ["0 발동 백분율", emergencyHeal({ triggerAtOrBelowHpPercent: 0 })],
    ["100 초과 발동 백분율", emergencyHeal({ triggerAtOrBelowHpPercent: 101 })],
  ])("%s 능력을 INVALID_GENERATION으로 거부한다", (_caseName, battleAbility) => {
    expectInvalidGeneration(() => validateClasses([
      classDef("cleric", { battleAbility }),
    ]));
  });

  it.each([
    ["null 능력", null],
    ["문자열이 아닌 이름", emergencyHeal({ name: 42 as never })],
    ["지원하지 않는 kind", { ...emergencyHeal(), kind: "manaShield" }],
  ])("%s 주입값을 RuleError INVALID_GENERATION으로 거부한다", (_caseName, battleAbility) => {
    expectInvalidGeneration(() => validateClasses([
      classDef("cleric", { battleAbility: battleAbility as never }),
    ]));
  });

  it("중복 직업 ID를 INVALID_GENERATION으로 거부한다", () => {
    expectInvalidGeneration(() => validateClasses([
      classDef("cleric"),
      classDef("cleric"),
    ]));
  });
});
