import type { RiskLevel } from "@/lib/domain";
import type { BacktestAggregate, CombinationId } from "./metrics";
import type { BattleAbilitySnapshotComparison } from "./battle-ability-comparison";

/**
 * holdout은 승인된 calibration 설정을 동결한 뒤에만 열어야 한다.
 * 이 값을 true로 바꾸는 변경은 사용자 승인을 포함한다.
 */
export const B1B_HOLDOUT_APPROVED = false;

export const B1B_ACCEPTANCE = {
  minimumPairedAccuracyEffect: 0.05,
  completionRateByCombination: {
    "survival@0.7": [0.60, 0.80],
    "survival@0.4": [0.30, 0.40],
    "opportunist@0.7": [0.40, 0.60],
    "opportunist@0.4": [0.20, 0.30],
    "selective-betrayal@0.7": [0.20, 0.40],
    "selective-betrayal@0.4": [0.05, 0.15],
  },
  completedWipeMeanByCombination: {
    "survival@0.7": [2, 3],
    "survival@0.4": [3, 4],
    "selective-betrayal@0.7": [3, 4],
    "selective-betrayal@0.4": [3, 4],
  },
} as const;

export const B1_RISK_CURVE_V2_TARGETS = {
  1: [0.85, 0.90],
  2: [0.78, 0.85],
  3: [0.70, 0.78],
  4: [0.62, 0.70],
  5: [0.55, 0.65],
} as const satisfies Readonly<Record<RiskLevel, readonly [number, number]>>;

export type BacktestFocus = "full-campaign" | "risk-curve";

export interface B1BAcceptanceContext {
  readonly mode: "calibration" | "holdout";
  readonly seedsPerCombination: 2 | 50 | 100 | 200 | 2000;
  readonly focus?: BacktestFocus;
}

export interface B1BAcceptanceGate {
  readonly id:
    | `completion-rate:${CombinationId}`
    | `completed-wipe-mean:${CombinationId}`
    | `first-attempt-clear-rate:opportunist@0.7:risk-${RiskLevel}`
    | "first-attempt-clear-rate:opportunist@0.7:monotonic"
    | `boss-axis-guard:opportunist@0.7:risk-${RiskLevel}`;
  readonly passed: boolean;
  readonly enforced: boolean;
  readonly evidence: string;
}

export interface HealingStructuralGate {
  readonly id:
    | "healing-expedition-use-limit"
    | "healing-battle-use-limit"
    | "healing-amount-and-hp"
    | "healing-live-target-and-turn"
    | "healing-after-victory"
    | "healing-use-chain"
    | "healing-holder-only"
    | "reproducible-valid-runs"
    | "no-round-limit";
  readonly passed: boolean;
  readonly enforced: true;
  readonly evidence: string;
}

export interface PairedAbilityStructuralGate {
  readonly id: "non-holder-unchanged" | "non-trigger-unchanged";
  readonly passed: boolean;
  readonly enforced: true;
  readonly evidence: string;
}

export function evaluatePairedAbilityStructuralGates(comparison: BattleAbilitySnapshotComparison): readonly PairedAbilityStructuralGate[] {
  const nonHolder = comparison.byCleric.withoutCleric;
  const nonTrigger = comparison.withoutHealing;
  return [{
    id: "non-holder-unchanged",
    passed: nonHolder.unchangedPairCount === nonHolder.pairCount,
    enforced: true,
    evidence: `불변 ${nonHolder.unchangedPairCount}/${nonHolder.pairCount}`,
  }, {
    id: "non-trigger-unchanged",
    passed: nonTrigger.unchangedPairCount === nonTrigger.pairCount,
    enforced: true,
    evidence: `불변 ${nonTrigger.unchangedPairCount}/${nonTrigger.pairCount}`,
  }];
}

export function evaluateHealingStructuralGates(aggregate: BacktestAggregate): readonly HealingStructuralGate[] {
  const violations = new Map<HealingStructuralGate["id"], number>();
  const fail = (id: HealingStructuralGate["id"]): void => {
    violations.set(id, (violations.get(id) ?? 0) + 1);
  };
  for (const run of aggregate.runs) {
    const expeditionUses = new Map<string, number>();
    for (const entry of run.battles) {
      const battleUses = new Map<string, number>();
      const partyById = new Map<string, (typeof entry.party)[number]>(entry.party.map((member) => [member.characterId, member]));
      const partyHpById = new Map<string, number>(entry.party.map((member) => [member.characterId, member.hpBefore]));
      const aliveEnemyIds = new Set(entry.battle.enemies.filter((enemy) => enemy.maxHp > 0).map((enemy) => enemy.id));
      let enemiesDefeated = aliveEnemyIds.size === 0;
      for (const action of entry.battle.actions) {
        if (action.kind === "attack" && action.actorSide === "party" && action.defeated) {
          aliveEnemyIds.delete(action.targetId);
          enemiesDefeated = aliveEnemyIds.size === 0;
        }
        if (action.kind !== "heal") {
          if (partyHpById.has(action.targetId)) partyHpById.set(action.targetId, action.targetHpAfter);
          continue;
        }
        const expeditionKey = `${entry.expeditionId}\u0000${action.actorId}`;
        expeditionUses.set(expeditionKey, (expeditionUses.get(expeditionKey) ?? 0) + 1);
        battleUses.set(action.actorId, (battleUses.get(action.actorId) ?? 0) + 1);
        if (!Number.isInteger(action.healing) || action.healing < 1 || action.healing > 5
          || action.targetHpAfter !== action.targetHpBefore + action.healing
          || action.targetHpAfter > (partyById.get(action.targetId)?.maxHp ?? Number.NEGATIVE_INFINITY)) {
          fail("healing-amount-and-hp");
        }
        const sameTurnAttack = entry.battle.actions.some((candidate) => candidate.kind === "attack"
          && candidate.actorSide === "party" && candidate.actorId === action.actorId && candidate.round === action.round);
        const actorHpBeforeAction = partyHpById.get(action.actorId);
        const targetHpBeforeAction = partyHpById.get(action.targetId);
        if (actorHpBeforeAction === undefined || actorHpBeforeAction <= 0
          || targetHpBeforeAction !== action.targetHpBefore || action.targetHpBefore <= 0 || sameTurnAttack) {
          fail("healing-live-target-and-turn");
        }
        if (enemiesDefeated) fail("healing-after-victory");
        const actor = partyById.get(action.actorId);
        if (actor?.classId !== "cleric" || actor.abilityUsesRemainingBefore === null || actor.abilityUsesRemainingBefore === undefined) {
          fail("healing-holder-only");
        }
        partyHpById.set(action.targetId, action.targetHpAfter);
      }
      for (const count of battleUses.values()) if (count > 1) fail("healing-battle-use-limit");
      for (const member of entry.party) {
        const before = member.abilityUsesRemainingBefore;
        const after = member.abilityUsesRemainingAfter;
        if (before === null || before === undefined || after === null || after === undefined) continue;
        const actions = battleUses.get(member.characterId) ?? 0;
        if (after > before || before - after !== actions) fail("healing-use-chain");
      }
      if (entry.battle.termination === "roundLimit") fail("no-round-limit");
    }
    for (const count of expeditionUses.values()) if (count > 2) fail("healing-expedition-use-limit");
  }
  if (aggregate.errorCount > 0) fail("reproducible-valid-runs");
  const ids: readonly HealingStructuralGate["id"][] = [
    "healing-expedition-use-limit", "healing-battle-use-limit", "healing-amount-and-hp",
    "healing-live-target-and-turn", "healing-after-victory", "healing-use-chain",
    "healing-holder-only", "reproducible-valid-runs", "no-round-limit",
  ];
  return ids.map((id) => ({ id, passed: (violations.get(id) ?? 0) === 0, enforced: true, evidence: `위반 ${violations.get(id) ?? 0}건` }));
}

const DEFAULT_ACCEPTANCE_CONTEXT: B1BAcceptanceContext = { mode: "calibration", seedsPerCombination: 50, focus: "full-campaign" };
const RISK_LEVELS = [1, 2, 3, 4, 5] as const satisfies readonly RiskLevel[];

function within(value: number, [minimum, maximum]: readonly [number, number]): boolean {
  return Number.isFinite(value) && minimum <= value && value <= maximum;
}

function requiredCombination(aggregate: BacktestAggregate, id: CombinationId) {
  const combination = aggregate.combinations[id];
  if (combination === undefined || combination.count === 0) throw new Error(`B1-B 조합 표본이 없다: ${id}`);
  return combination;
}

function acceptancePolicy(context: B1BAcceptanceContext): {
  readonly campaignEnforced: boolean;
  readonly riskEnforced: boolean;
  readonly minimumRiskSamples: number;
} {
  const focus = context.focus ?? "full-campaign";
  const finalCalibration = context.mode === "calibration" && context.seedsPerCombination === 200;
  const holdout = context.mode === "holdout";
  return {
    campaignEnforced: focus === "full-campaign" && (finalCalibration || holdout),
    riskEnforced: finalCalibration || holdout,
    minimumRiskSamples: holdout ? 300 : finalCalibration ? 30 : 0,
  };
}

export function evaluateB1BAcceptance(
  aggregate: BacktestAggregate,
  context: B1BAcceptanceContext = DEFAULT_ACCEPTANCE_CONTEXT,
): readonly B1BAcceptanceGate[] {
  const gates: B1BAcceptanceGate[] = [];
  const policy = acceptancePolicy(context);
  for (const [id, band] of Object.entries(B1B_ACCEPTANCE.completionRateByCombination) as [CombinationId, readonly [number, number]][]) {
    const combination = requiredCombination(aggregate, id);
    gates.push({
      id: `completion-rate:${id}`,
      passed: within(combination.completionRate, band),
      enforced: policy.campaignEnforced,
      evidence: `완주율 ${combination.completionRate.toFixed(4)} (기준 ${band[0].toFixed(2)}–${band[1].toFixed(2)})`,
    });
  }
  for (const [id, band] of Object.entries(B1B_ACCEPTANCE.completedWipeMeanByCombination) as [CombinationId, readonly [number, number]][]) {
    const combination = requiredCombination(aggregate, id);
    const mean = combination.completedWipeMean;
    gates.push({
      id: `completed-wipe-mean:${id}`,
      passed: mean !== null && within(mean, band),
      enforced: policy.campaignEnforced,
      evidence: `완주 전멸 평균 ${mean === null ? "표본 없음" : mean.toFixed(4)} (기준 ${band[0].toFixed(2)}–${band[1].toFixed(2)})`,
    });
  }
  const opportunist = requiredCombination(aggregate, "opportunist@0.7");
  const riskFunnels = RISK_LEVELS.map((risk) => opportunist.firstAttemptByInitialRisk[risk]);
  for (const risk of RISK_LEVELS) {
    const funnel = opportunist.firstAttemptByInitialRisk[risk];
    const target = B1_RISK_CURVE_V2_TARGETS[risk];
    const passed = within(funnel.clearRate ?? Number.NaN, target)
      && (!policy.riskEnforced || funnel.starts >= policy.minimumRiskSamples);
    gates.push({
      id: `first-attempt-clear-rate:opportunist@0.7:risk-${risk}`,
      passed,
      enforced: policy.riskEnforced,
      evidence: `첫 시도 클리어율 ${funnel.clearRate === null ? "표본 없음" : funnel.clearRate.toFixed(4)} (표본 ${funnel.starts}/최소 ${policy.minimumRiskSamples}, 기준 ${target[0].toFixed(2)}–${target[1].toFixed(2)})`,
    });
  }
  const rates = riskFunnels.map((funnel) => funnel.clearRate);
  const monotonic = rates.every((rate, index) => rate !== null && (index === 0 || rates[index - 1] !== null && rates[index - 1]! > rate));
  const sufficientlySampled = riskFunnels.every((funnel) => funnel.starts >= policy.minimumRiskSamples);
  gates.push({
    id: "first-attempt-clear-rate:opportunist@0.7:monotonic",
    passed: monotonic && (!policy.riskEnforced || sufficientlySampled),
    enforced: policy.riskEnforced,
    evidence: `위험도별 첫 시도 클리어율 ${rates.map((rate) => rate === null ? "표본 없음" : rate.toFixed(4)).join(" > ")} (표본 ${riskFunnels.map((funnel) => funnel.starts).join(", ")}/최소 ${policy.minimumRiskSamples})`,
  });
  for (const risk of RISK_LEVELS) {
    const funnel = opportunist.firstAttemptByInitialRisk[risk];
    const guardPassed = funnel.preBossFailures <= funnel.bossFailures
      && funnel.meanBossEntryHpRatio !== null
      && funnel.meanBossEntryHpRatio >= 0.70;
    gates.push({
      id: `boss-axis-guard:opportunist@0.7:risk-${risk}`,
      passed: guardPassed,
      enforced: policy.riskEnforced,
      evidence: `보스 전 실패 ${funnel.preBossFailures}건, 보스 실패 ${funnel.bossFailures}건, 평균 보스 진입 HP ${funnel.meanBossEntryHpRatio === null ? "표본 없음" : funnel.meanBossEntryHpRatio.toFixed(4)} (보스 전 실패≤보스 실패, HP≥0.70)`,
    });
  }
  return gates;
}
