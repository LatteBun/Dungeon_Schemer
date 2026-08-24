import type { RiskLevel } from "@/lib/domain";
import type { BacktestAggregate, CombinationId } from "./metrics";

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

export const B1B_RISK_CLEARANCE_TARGETS = {
  1: [0.80, 0.90],
  2: [0.65, 0.75],
  3: [0.50, 0.60],
  4: [0.35, 0.45],
  5: [0.20, 0.30],
} as const satisfies Readonly<Record<RiskLevel, readonly [number, number]>>;

export interface B1BAcceptanceContext {
  readonly mode: "calibration" | "holdout";
  readonly seedsPerCombination: 2 | 50 | 100 | 200 | 2000;
}

export interface B1BAcceptanceGate {
  readonly id:
    | `completion-rate:${CombinationId}`
    | `completed-wipe-mean:${CombinationId}`
    | `first-attempt-clear-rate:opportunist@0.7:risk-${RiskLevel}`
    | "first-attempt-clear-rate:opportunist@0.7:monotonic";
  readonly passed: boolean;
  readonly enforced: boolean;
  readonly evidence: string;
}

const DEFAULT_ACCEPTANCE_CONTEXT: B1BAcceptanceContext = { mode: "calibration", seedsPerCombination: 50 };
const RISK_LEVELS = [1, 2, 3, 4, 5] as const satisfies readonly RiskLevel[];

function within(value: number, [minimum, maximum]: readonly [number, number]): boolean {
  return Number.isFinite(value) && minimum <= value && value <= maximum;
}

function requiredCombination(aggregate: BacktestAggregate, id: CombinationId) {
  const combination = aggregate.combinations[id];
  if (combination === undefined || combination.count === 0) throw new Error(`B1-B 조합 표본이 없다: ${id}`);
  return combination;
}

function riskGatePolicy(context: B1BAcceptanceContext): { readonly enforced: boolean; readonly minimumSamples: number } {
  if (context.mode === "holdout") return { enforced: true, minimumSamples: 300 };
  if (context.seedsPerCombination === 200) return { enforced: true, minimumSamples: 30 };
  return { enforced: false, minimumSamples: 0 };
}

export function evaluateB1BAcceptance(
  aggregate: BacktestAggregate,
  context: B1BAcceptanceContext = DEFAULT_ACCEPTANCE_CONTEXT,
): readonly B1BAcceptanceGate[] {
  const gates: B1BAcceptanceGate[] = [];
  const policy = riskGatePolicy(context);
  for (const [id, band] of Object.entries(B1B_ACCEPTANCE.completionRateByCombination) as [CombinationId, readonly [number, number]][]) {
    const combination = requiredCombination(aggregate, id);
    gates.push({
      id: `completion-rate:${id}`,
      passed: within(combination.completionRate, band),
      enforced: policy.enforced,
      evidence: `완주율 ${combination.completionRate.toFixed(4)} (기준 ${band[0].toFixed(2)}–${band[1].toFixed(2)})`,
    });
  }
  for (const [id, band] of Object.entries(B1B_ACCEPTANCE.completedWipeMeanByCombination) as [CombinationId, readonly [number, number]][]) {
    const combination = requiredCombination(aggregate, id);
    const mean = combination.completedWipeMean;
    gates.push({
      id: `completed-wipe-mean:${id}`,
      passed: mean !== null && within(mean, band),
      enforced: policy.enforced,
      evidence: `완주 전멸 평균 ${mean === null ? "표본 없음" : mean.toFixed(4)} (기준 ${band[0].toFixed(2)}–${band[1].toFixed(2)})`,
    });
  }
  const opportunist = requiredCombination(aggregate, "opportunist@0.7");
  const riskFunnels = RISK_LEVELS.map((risk) => opportunist.firstAttemptByInitialRisk[risk]);
  for (const risk of RISK_LEVELS) {
    const funnel = opportunist.firstAttemptByInitialRisk[risk];
    const target = B1B_RISK_CLEARANCE_TARGETS[risk];
    const passed = within(funnel.clearRate ?? Number.NaN, target)
      && (!policy.enforced || funnel.starts >= policy.minimumSamples);
    gates.push({
      id: `first-attempt-clear-rate:opportunist@0.7:risk-${risk}`,
      passed,
      enforced: policy.enforced,
      evidence: `첫 시도 클리어율 ${funnel.clearRate === null ? "표본 없음" : funnel.clearRate.toFixed(4)} (표본 ${funnel.starts}/최소 ${policy.minimumSamples}, 기준 ${target[0].toFixed(2)}–${target[1].toFixed(2)})`,
    });
  }
  const rates = riskFunnels.map((funnel) => funnel.clearRate);
  const monotonic = rates.every((rate, index) => rate !== null && (index === 0 || rates[index - 1] !== null && rates[index - 1]! > rate));
  const sufficientlySampled = riskFunnels.every((funnel) => funnel.starts >= policy.minimumSamples);
  gates.push({
    id: "first-attempt-clear-rate:opportunist@0.7:monotonic",
    passed: monotonic && (!policy.enforced || sufficientlySampled),
    enforced: policy.enforced,
    evidence: `위험도별 첫 시도 클리어율 ${rates.map((rate) => rate === null ? "표본 없음" : rate.toFixed(4)).join(" > ")} (표본 ${riskFunnels.map((funnel) => funnel.starts).join(", ")}/최소 ${policy.minimumSamples})`,
  });
  return gates;
}
