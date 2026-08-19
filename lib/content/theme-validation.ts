import { RuleError } from "@/lib/domain";
import type { BossDef, EcologyRule, MonsterDef, RiskLevel, ThemeContent } from "@/lib/domain";

/** 보스 minRiskLevel이 빠짐없이 담아야 하는 구간. */
const REQUIRED_BOSS_TIERS: readonly RiskLevel[] = [1, 2, 3, 4];

const RULES_PER_THEME = 6;
const MONSTERS_PER_THEME = 5;
const BOSSES_PER_THEME = 4;

function invalid(message: string, details: Record<string, unknown>): never {
  throw new RuleError("INVALID_GENERATION", message, details);
}

function requireText(
  value: string,
  message: string,
  details: Record<string, unknown>,
): void {
  if (value.trim() === "") invalid(message, details);
}

function requireUniqueIds(
  ids: readonly string[],
  contentType: string,
  theme: string,
): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      invalid(`${contentType} ID가 테마 안에서 중복된다: ${id}`, { contentType, theme, id });
    }
    seen.add(id);
  }
}

function validateRules(rules: readonly EcologyRule[], theme: string): void {
  if (rules.length !== RULES_PER_THEME) {
    invalid(`생태 규칙이 ${RULES_PER_THEME}개가 아니다: ${theme}`, {
      contentType: "ecologyRule",
      theme,
      expected: RULES_PER_THEME,
      actual: rules.length,
    });
  }

  requireUniqueIds(rules.map((rule) => rule.id), "ecologyRule", theme);

  for (const rule of rules) {
    requireText(rule.text, `생태 규칙 문구가 비어 있다: ${rule.id}`, {
      contentType: "ecologyRule",
      theme,
      id: rule.id,
    });
  }

  if (!rules.some((rule) => rule.conditional)) {
    invalid(`조건부 규칙이 하나도 없다: ${theme}`, { contentType: "ecologyRule", theme });
  }
}

function validateMonsters(monsters: readonly MonsterDef[], theme: string): void {
  if (monsters.length !== MONSTERS_PER_THEME) {
    invalid(`몬스터가 ${MONSTERS_PER_THEME}종이 아니다: ${theme}`, {
      contentType: "monster",
      theme,
      expected: MONSTERS_PER_THEME,
      actual: monsters.length,
    });
  }

  requireUniqueIds(monsters.map((monster) => monster.id), "monster", theme);

  for (const monster of monsters) {
    requireText(monster.name, `몬스터 이름이 비어 있다: ${monster.id}`, {
      contentType: "monster",
      theme,
      id: monster.id,
    });
  }
}

function validateBosses(bosses: readonly BossDef[], theme: string): void {
  if (bosses.length !== BOSSES_PER_THEME) {
    invalid(`보스가 ${BOSSES_PER_THEME}종이 아니다: ${theme}`, {
      contentType: "boss",
      theme,
      expected: BOSSES_PER_THEME,
      actual: bosses.length,
    });
  }

  requireUniqueIds(bosses.map((boss) => boss.id), "boss", theme);

  const tiers = bosses.map((boss) => boss.minRiskLevel).toSorted((a, b) => a - b);
  const tiersMatch =
    tiers.length === REQUIRED_BOSS_TIERS.length &&
    tiers.every((tier, index) => tier === REQUIRED_BOSS_TIERS[index]);
  if (!tiersMatch) {
    invalid(`보스의 minRiskLevel이 1·2·3·4를 빠짐없이 정확히 담지 않는다: ${theme}`, {
      contentType: "boss",
      theme,
      expected: REQUIRED_BOSS_TIERS,
      actual: tiers,
    });
  }

  for (const boss of bosses) {
    requireText(boss.name, `보스 이름이 비어 있다: ${boss.id}`, {
      contentType: "boss",
      theme,
      id: boss.id,
    });
    requireText(boss.description, `보스 설명이 비어 있다: ${boss.id}`, {
      contentType: "boss",
      theme,
      id: boss.id,
    });
  }
}

/**
 * 테마 콘텐츠 배열을 검증한다.
 *
 * 테마 배열을 받는 형태로 짜서, F2-2가 사막·묘지를 THEMES에 더해도 이
 * 검증기를 다시 쓰지 않는다.
 * docs/systems/DUNGEON_THEMES_AND_ECOLOGY.md
 */
export function validateThemes(themes: readonly ThemeContent[]): void {
  for (const theme of themes) {
    validateRules(theme.rules, theme.id);
    validateMonsters(theme.monsters, theme.id);
    validateBosses(theme.bosses, theme.id);
  }
}
