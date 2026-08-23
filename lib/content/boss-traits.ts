import { RuleError } from "@/lib/domain";
import type { AdviceOutcome, BossRuleId, ThemeContent } from "@/lib/domain";

export type BossTraitId =
  | "TARGET_COMMITMENT"
  | "PURSUIT_LIMIT"
  | "ATTACK_TELEGRAPH"
  | "AMBUSH_TELEGRAPH"
  | "RECOVERY_WINDOW"
  | "STRUCTURAL_WEAKNESS"
  | "CONTROL_DEPENDENCY"
  | "DISTRACTION_WINDOW";

export type BossTraitAxis = "targetWeight" | "incomingDamage" | "outgoingDamage";

export interface BossTrait {
  readonly id: BossTraitId;
  readonly axis: BossTraitAxis;
}

export const BOSS_INFO_MULTIPLIERS = {
  targetWeight: { help: 0.8, harm: 1.25 },
  incomingDamage: { help: 0.8, harm: 1.25 },
  outgoingDamage: { help: 1.25, harm: 0.8 },
} as const satisfies Readonly<Record<BossTraitAxis, Readonly<Record<"help" | "harm", number>>>>;

export const BOSS_INFO_MULTIPLIER_LIMITS = {
  min: 0.7,
  max: 1.5,
} as const;

export const BOSS_INFO_CUE_AXIS_PRIORITY = {
  targetWeight: 0,
  incomingDamage: 1,
  outgoingDamage: 2,
} as const satisfies Readonly<Record<BossTraitAxis, number>>;

export const BOSS_RULE_TRAITS: Readonly<Record<string, BossTrait>> = {
  "boss-ragna-turning": { id: "PURSUIT_LIMIT", axis: "targetWeight" },
  "boss-ragna-crouch": { id: "ATTACK_TELEGRAPH", axis: "incomingDamage" },
  "boss-morkan-cocoon-side": { id: "STRUCTURAL_WEAKNESS", axis: "outgoingDamage" },
  "boss-morkan-spin-pause": { id: "RECOVERY_WINDOW", axis: "outgoingDamage" },
  "boss-serina-web-hub": { id: "CONTROL_DEPENDENCY", axis: "outgoingDamage" },
  "boss-serina-block-retreat": { id: "ATTACK_TELEGRAPH", axis: "incomingDamage" },
  "boss-araksha-swarm-follow": { id: "ATTACK_TELEGRAPH", axis: "incomingDamage" },
  "boss-araksha-summon-first": { id: "DISTRACTION_WINDOW", axis: "outgoingDamage" },
  "boss-zakar-burrow-trace": { id: "AMBUSH_TELEGRAPH", axis: "incomingDamage" },
  "boss-zakar-emerge-gap": { id: "RECOVERY_WINDOW", axis: "outgoingDamage" },
  "boss-kardum-sand-ridge": { id: "AMBUSH_TELEGRAPH", axis: "incomingDamage" },
  "boss-kardum-landing-pause": { id: "RECOVERY_WINDOW", axis: "outgoingDamage" },
  "boss-obelon-leg-collapse": { id: "STRUCTURAL_WEAKNESS", axis: "outgoingDamage" },
  "boss-obelon-rebuild-stones": { id: "ATTACK_TELEGRAPH", axis: "incomingDamage" },
  "boss-nephris-question-still": { id: "DISTRACTION_WINDOW", axis: "outgoingDamage" },
  "boss-nephris-wrong-answer-tell": { id: "ATTACK_TELEGRAPH", axis: "incomingDamage" },
  "boss-barkan-command-blade": { id: "TARGET_COMMITMENT", axis: "targetWeight" },
  "boss-barkan-reform-line": { id: "DISTRACTION_WINDOW", axis: "outgoingDamage" },
  "boss-morbian-staff-link": { id: "CONTROL_DEPENDENCY", axis: "outgoingDamage" },
  "boss-morbian-death-tell": { id: "ATTACK_TELEGRAPH", axis: "incomingDamage" },
  "boss-azrael-marked-prey": { id: "TARGET_COMMITMENT", axis: "targetWeight" },
  "boss-azrael-scythe-mist": { id: "ATTACK_TELEGRAPH", axis: "incomingDamage" },
  "boss-valdrak-oath-boundary": { id: "PURSUIT_LIMIT", axis: "targetWeight" },
  "boss-valdrak-tomb-priority": { id: "DISTRACTION_WINDOW", axis: "outgoingDamage" },
};

export function bossTraitForRule(bossRuleId: BossRuleId): BossTrait {
  const trait = BOSS_RULE_TRAITS[bossRuleId];
  if (trait === undefined) {
    throw new RuleError("INVALID_GENERATION", "보스 규칙의 전투 특성 매핑이 없다", { bossRuleId });
  }
  return trait;
}

export function modifierForBossInfo(
  axis: BossTraitAxis,
  outcome: Extract<AdviceOutcome, "help" | "harm">,
): number {
  return BOSS_INFO_MULTIPLIERS[axis][outcome];
}

export function clampBossInfoMultiplier(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RuleError("INVALID_GENERATION", "보스 정보 multiplier가 유한하지 않다", { value });
  }
  return Math.max(BOSS_INFO_MULTIPLIER_LIMITS.min, Math.min(BOSS_INFO_MULTIPLIER_LIMITS.max, value));
}

export function validateBossTraitMappings(themes: readonly ThemeContent[]): void {
  const seen = new Set<string>();
  for (const theme of themes) {
    for (const boss of theme.bosses) {
      if (boss.rules.length !== 2) {
        throw new RuleError("INVALID_GENERATION", `보스 특징이 정확히 2개가 아니다: ${boss.id}`, {
          bossId: boss.id,
          actual: boss.rules.length,
        });
      }
      for (const rule of boss.rules) {
        if (seen.has(rule.id)) {
          throw new RuleError("INVALID_GENERATION", `보스 규칙 trait 매핑이 중복된다: ${rule.id}`, { bossRuleId: rule.id });
        }
        seen.add(rule.id);
        bossTraitForRule(rule.id);
      }
    }
  }
}
