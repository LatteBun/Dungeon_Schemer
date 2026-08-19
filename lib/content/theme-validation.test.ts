import { describe, expect, it } from "vitest";
import { validateThemes } from "@/lib/content/theme-validation";
import type {
  BossDef,
  BossId,
  EcologyRule,
  MonsterDef,
  MonsterId,
  RuleId,
  ThemeContent,
} from "@/lib/domain";

function rule(id: string, conditional = false): EcologyRule {
  return { id: id as RuleId, theme: "spider", text: `규칙 ${id}`, conditional };
}

function monster(id: string): MonsterDef {
  return { id: id as MonsterId, theme: "spider", name: `몬스터 ${id}`, traits: [] };
}

function boss(id: string, minRiskLevel: 1 | 2 | 3 | 4): BossDef {
  return {
    id: id as BossId,
    theme: "spider",
    name: `보스 ${id}`,
    description: `설명 ${id}`,
    minRiskLevel,
    baseDamage: 10,
    maxHp: 100,
  };
}

/** 계약을 만족하는 최소 fixture. 개별 위반 테스트가 이 값을 부분적으로 망가뜨린다. */
function validTheme(overrides: Partial<ThemeContent> = {}): ThemeContent {
  return {
    id: "spider",
    name: "거미굴",
    rules: [
      rule("r1", true),
      rule("r2"),
      rule("r3"),
      rule("r4"),
      rule("r5"),
      rule("r6"),
    ],
    monsters: [
      monster("m1"),
      monster("m2"),
      monster("m3"),
      monster("m4"),
      monster("m5"),
    ],
    bosses: [boss("b1", 1), boss("b2", 2), boss("b3", 3), boss("b4", 4)],
    ...overrides,
  };
}

describe("validateThemes", () => {
  it("계약을 만족하는 테마는 통과한다", () => {
    expect(() => validateThemes([validTheme()])).not.toThrow();
  });

  it("규칙이 5개뿐이면 거부한다", () => {
    const theme = validTheme({ rules: validTheme().rules.slice(0, 5) });
    expect(() => validateThemes([theme])).toThrow(/생태 규칙이 6개가 아니다/);
  });

  it("몬스터가 4종뿐이면 거부한다", () => {
    const theme = validTheme({ monsters: validTheme().monsters.slice(0, 4) });
    expect(() => validateThemes([theme])).toThrow(/몬스터가 5종이 아니다/);
  });

  it("보스가 3종뿐이면 거부한다", () => {
    const theme = validTheme({ bosses: validTheme().bosses.slice(0, 3) });
    expect(() => validateThemes([theme])).toThrow(/보스가 4종이 아니다/);
  });

  it("보스 minRiskLevel이 중복이면 거부한다", () => {
    const theme = validTheme({
      bosses: [boss("b1", 1), boss("b2", 2), boss("b3", 3), boss("b4", 3)],
    });
    expect(() => validateThemes([theme])).toThrow(/minRiskLevel이 1·2·3·4를 빠짐없이/);
  });

  it("조건부 규칙이 하나도 없으면 거부한다", () => {
    const theme = validTheme({
      rules: validTheme().rules.map((r) => ({ ...r, conditional: false })),
    });
    expect(() => validateThemes([theme])).toThrow(/조건부 규칙이 하나도 없다/);
  });

  it("규칙 ID가 테마 안에서 중복이면 거부한다", () => {
    const rules = validTheme().rules;
    const theme = validTheme({ rules: [rules[0], rules[0], ...rules.slice(2)] });
    expect(() => validateThemes([theme])).toThrow(/ecologyRule ID가 테마 안에서 중복된다/);
  });

  it("규칙 문구가 비어 있으면 거부한다", () => {
    const rules = validTheme().rules;
    const theme = validTheme({
      rules: [{ ...rules[0], text: "  " }, ...rules.slice(1)],
    });
    expect(() => validateThemes([theme])).toThrow(/생태 규칙 문구가 비어 있다/);
  });

  it("보스 이름이 비어 있으면 거부한다", () => {
    const bosses = validTheme().bosses;
    const theme = validTheme({
      bosses: [{ ...bosses[0], name: "" }, ...bosses.slice(1)],
    });
    expect(() => validateThemes([theme])).toThrow(/보스 이름이 비어 있다/);
  });
});
