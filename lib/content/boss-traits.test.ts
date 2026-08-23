import { describe, expect, it } from "vitest";
import { THEMES } from "@/lib/content/themes";
import {
  BOSS_INFO_MULTIPLIER_LIMITS,
  BOSS_RULE_TRAITS,
  clampBossInfoMultiplier,
  modifierForBossInfo,
  validateBossTraitMappings,
} from "@/lib/content/boss-traits";
import { RuleError, type ThemeContent } from "@/lib/domain";

describe("BossTrait 카탈로그", () => {
  it("shipped 보스 12종의 24개 규칙을 모두 정확히 매핑한다", () => {
    expect(Object.keys(BOSS_RULE_TRAITS)).toHaveLength(24);
    expect(() => validateBossTraitMappings(THEMES)).not.toThrow();
  });

  it("매핑되지 않은 BossRuleId를 생성 오류로 거부한다", () => {
    const broken = structuredClone(THEMES[0]) as ThemeContent;
    const boss = broken.bosses[0];
    const brokenTheme = {
      ...broken,
      bosses: [{ ...boss, rules: [{ ...boss.rules[0], id: "unknown-boss-rule" as never }, boss.rules[1]] }, ...broken.bosses.slice(1)],
    };
    expect(() => validateBossTraitMappings([brokenTheme])).toThrow(RuleError);
  });

  it("도움·방해는 축별 방향을 갖고 최종 multiplier를 clamp한다", () => {
    expect(modifierForBossInfo("incomingDamage", "help")).toBe(0.8);
    expect(modifierForBossInfo("outgoingDamage", "harm")).toBe(0.8);
    expect(clampBossInfoMultiplier(0.1)).toBe(BOSS_INFO_MULTIPLIER_LIMITS.min);
    expect(clampBossInfoMultiplier(2)).toBe(BOSS_INFO_MULTIPLIER_LIMITS.max);
  });
});
