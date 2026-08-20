import { describe, expect, it } from "vitest";
import { validateThemes } from "@/lib/content/theme-validation";
import { RuleError } from "@/lib/domain";
import type {
  BossDef,
  BossId,
  EcologyProfile,
  EcologyProfileId,
  EcologyRule,
  EnvironmentTagDefinition,
  MonsterDef,
  MonsterId,
  PublicEnvironmentTagId,
  RuleId,
  ThemeContent,
} from "@/lib/domain";

function rule(id: string, conditional = false): EcologyRule {
  return { id: id as RuleId, theme: "spider", text: `규칙 ${id}`, conditional };
}

function monster(id: string): MonsterDef {
  return {
    id: id as MonsterId,
    theme: "spider",
    name: `몬스터 ${id}`,
    traits: ["특성"],
  };
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

function profile(id: string, initialRiskLevel: 1 | 2 | 3 | 4 | 5): EcologyProfile {
  const conditional = initialRiskLevel >= 4;
  return {
    id: id as EcologyProfileId,
    theme: "spider",
    initialRiskLevel,
    activeRuleIds: [
      (conditional ? "r1" : "r2") as RuleId,
      "r3" as RuleId,
      (conditional ? "r4" : "r5") as RuleId,
    ],
    activeMonsterIds: ["m1" as MonsterId],
    publicEnvironmentTagId: `tag-${(Number(id.slice(1)) % 3) + 1}` as PublicEnvironmentTagId,
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
    publicEnvironmentTags: [1, 2, 3].map(
      (index): EnvironmentTagDefinition => ({
        id: `tag-${index}` as PublicEnvironmentTagId,
        label: `환경 ${index}`,
        evidenceMonsterTraits: ["특성"],
      }),
    ),
    bosses: [boss("b1", 1), boss("b2", 2), boss("b3", 3), boss("b4", 4)],
    ecologyProfiles: [
      profile("p1", 1),
      profile("p2", 2),
      profile("p3", 3),
      profile("p4", 4),
      profile("p5", 5),
    ],
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

  it("생태 패키지가 테마마다 정확히 5개가 아니면 거부한다", () => {
    const theme = validTheme({ ecologyProfiles: validTheme().ecologyProfiles.slice(0, 4) });
    expectInvalidGeneration(() => validateThemes([theme]));
  });

  it("생태 패키지 ID가 중복이면 거부한다", () => {
    const profiles = validTheme().ecologyProfiles;
    const theme = validTheme({ ecologyProfiles: [profiles[0], profiles[0], ...profiles.slice(2)] });
    expectInvalidGeneration(() => validateThemes([theme]));
  });

  it("생태 패키지의 규칙이 정확히 3개가 아니거나 테마 밖이면 거부한다", () => {
    const profiles = validTheme().ecologyProfiles;
    const theme = validTheme({
      ecologyProfiles: [
        { ...profiles[0], activeRuleIds: ["r2" as RuleId, "r3" as RuleId] },
        ...profiles.slice(1),
      ],
    });
    expectInvalidGeneration(() => validateThemes([theme]));

    const foreignRuleTheme = validTheme({
      ecologyProfiles: [
        {
          ...profiles[0],
          activeRuleIds: ["r2" as RuleId, "r3" as RuleId, "outside" as RuleId],
        },
        ...profiles.slice(1),
      ],
    });
    expectInvalidGeneration(() => validateThemes([foreignRuleTheme]));
  });

  it("생태 패키지의 잡몹 목록이 비었거나 테마 밖이면 거부한다", () => {
    const profiles = validTheme().ecologyProfiles;
    const emptyMonsterTheme = validTheme({
      ecologyProfiles: [{ ...profiles[0], activeMonsterIds: [] }, ...profiles.slice(1)],
    });
    expectInvalidGeneration(() => validateThemes([emptyMonsterTheme]));

    const foreignMonsterTheme = validTheme({
      ecologyProfiles: [
        { ...profiles[0], activeMonsterIds: ["outside" as MonsterId] },
        ...profiles.slice(1),
      ],
    });
    expectInvalidGeneration(() => validateThemes([foreignMonsterTheme]));
  });

  it("저위험도 패키지의 조건부 규칙은 거부한다", () => {
    const profiles = validTheme().ecologyProfiles;
    const theme = validTheme({
      ecologyProfiles: [
        { ...profiles[1], activeRuleIds: ["r1" as RuleId, "r2" as RuleId, "r3" as RuleId] },
        profiles[0],
        profiles[2],
        profiles[3],
        profiles[4],
      ],
    });
    expectInvalidGeneration(() => validateThemes([theme]));
  });

  it("고위험도 패키지에 조건부 규칙이 없으면 거부한다", () => {
    const profiles = validTheme().ecologyProfiles;
    const theme = validTheme({
      ecologyProfiles: [
        profiles[0],
        profiles[1],
        profiles[2],
        { ...profiles[3], activeRuleIds: ["r2" as RuleId, "r3" as RuleId, "r5" as RuleId] },
        profiles[4],
      ],
    });
    expectInvalidGeneration(() => validateThemes([theme]));
  });
});
