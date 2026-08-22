import type { EventId, RuleId } from "@/lib/domain";

/**
 * 조건부 생태 규칙이 현재 장면에서 실제로 성립한다고 콘텐츠 작성자가
 * 독립적으로 선언한 목록이다.
 *
 * 조언의 source에서 자동 유도하지 않는다. source와 이 선언이 서로 맞는지는
 * 별도 회귀 테스트가 검증해 조건부 규칙이 자기 자신을 충족시키는 순환을 막는다.
 */
const CONDITIONAL_RULE_IDS_BY_EVENT: Readonly<Record<string, readonly RuleId[]>> = {
  "spider-brood-follow-light": ["spider-brood-light" as RuleId],
  "spider-brood-armored-cross": ["spider-brood-light" as RuleId, "spider-armor-vibration" as RuleId],
  "spider-armored-brood-cross": ["spider-armor-vibration" as RuleId, "spider-brood-light" as RuleId],
  "spider-armored-sleeper": ["spider-armor-vibration" as RuleId],
  "spider-brood-lantern-cluster": ["spider-brood-light" as RuleId],
  "spider-armor-vibration-hammer": ["spider-armor-vibration" as RuleId],
  "spider-special-fire-brood-trap": ["spider-brood-light" as RuleId],

  "desert-lizard-heated-rock": ["desert-lizard-heat" as RuleId],
  "desert-lizard-sunrise-slope": ["desert-lizard-heat" as RuleId],
  "desert-lizard-heat-hot-ridge": ["desert-lizard-heat" as RuleId],
  "desert-special-heat-lizard-trap": ["desert-lizard-heat" as RuleId],
  "desert-spirit-dry-altar": ["desert-spirit-dry" as RuleId],
  "desert-dry-wind-boundary": ["desert-spirit-dry" as RuleId],
  "desert-mummy-dry-chamber": ["desert-spirit-dry" as RuleId],
  "desert-spirit-dry-white-basin": ["desert-spirit-dry" as RuleId],
  "desert-special-water-dry-split": ["desert-spirit-dry" as RuleId],

  "graveyard-ghoul-bone-crunch": ["graveyard-ghoul-sound" as RuleId],
  "graveyard-ghoul-dropped-coin": ["graveyard-ghoul-sound" as RuleId],
  "graveyard-ghoul-sound-small-bell": ["graveyard-ghoul-sound" as RuleId],
  "graveyard-special-sound-light-hall": ["graveyard-ghoul-sound" as RuleId],
  "graveyard-special-zombie-ghoul-sound-trap": ["graveyard-ghoul-sound" as RuleId],
  "graveyard-archer-light-retreat": ["graveyard-archer-light" as RuleId],
  "graveyard-archer-guard-crossfire": ["graveyard-archer-light" as RuleId],
  "graveyard-desecration-archer-shadow": ["graveyard-archer-light" as RuleId],
  "graveyard-archer-light-column": ["graveyard-archer-light" as RuleId],
  "graveyard-special-mage-archer-light": ["graveyard-archer-light" as RuleId],
};

export function conditionalRuleIdsForEvent(eventId: EventId): readonly RuleId[] {
  return CONDITIONAL_RULE_IDS_BY_EVENT[eventId] ?? [];
}
