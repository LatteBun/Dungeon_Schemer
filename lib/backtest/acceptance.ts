import type { BacktestAggregate, CombinationId } from "./metrics";

export const B1B_ACCEPTANCE = {
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

export interface B1BAcceptanceGate {
  readonly id: `completion-rate:${CombinationId}` | `completed-wipe-mean:${CombinationId}`;
  readonly passed: boolean;
  readonly evidence: string;
}

function within(value: number, [minimum, maximum]: readonly [number, number]): boolean {
  return Number.isFinite(value) && minimum <= value && value <= maximum;
}

function requiredCombination(aggregate: BacktestAggregate, id: CombinationId) {
  const combination = aggregate.combinations[id];
  if (combination === undefined || combination.count === 0) throw new Error(`B1-B 조합 표본이 없다: ${id}`);
  return combination;
}

export function evaluateB1BAcceptance(aggregate: BacktestAggregate): readonly B1BAcceptanceGate[] {
  const gates: B1BAcceptanceGate[] = [];
  for (const [id, band] of Object.entries(B1B_ACCEPTANCE.completionRateByCombination) as [CombinationId, readonly [number, number]][]) {
    const combination = requiredCombination(aggregate, id);
    gates.push({
      id: `completion-rate:${id}`,
      passed: within(combination.completionRate, band),
      evidence: `완주율 ${combination.completionRate.toFixed(4)} (기준 ${band[0].toFixed(2)}–${band[1].toFixed(2)})`,
    });
  }
  for (const [id, band] of Object.entries(B1B_ACCEPTANCE.completedWipeMeanByCombination) as [CombinationId, readonly [number, number]][]) {
    const combination = requiredCombination(aggregate, id);
    const mean = combination.completedWipeMean;
    gates.push({
      id: `completed-wipe-mean:${id}`,
      passed: mean !== null && within(mean, band),
      evidence: `완주 전멸 평균 ${mean === null ? "표본 없음" : mean.toFixed(4)} (기준 ${band[0].toFixed(2)}–${band[1].toFixed(2)})`,
    });
  }
  return gates;
}
