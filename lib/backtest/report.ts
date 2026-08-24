import type { AdviceOutcome, EndingKind } from "@/lib/domain";
import {
  aggregateRuns,
  pairedMeanDifference,
  wilsonInterval,
  type BacktestAggregate,
  type CombinationId,
  type PairedDifference,
} from "./metrics";
import type { Accuracy, StrategyId } from "./public-state";

export interface FixedGateResult {
  readonly id: "no-run-errors" | "accuracy-interval" | "not-all-rank-s" | "betrayal-can-complete" | "accuracy-has-effect";
  readonly passed: boolean;
  readonly evidence: string;
}

export interface AdjustableAcceptanceCriteria {
  readonly completionRateByCombination: Readonly<Record<CombinationId, readonly [number, number]>>;
  readonly minimumAccuracyEffect: number;
  readonly maximumEndingConcentration: number;
  readonly minimumStrategySeparation: number;
  readonly betrayalAttemptRate: readonly [number, number];
}

export interface BacktestReportInput {
  readonly mode: "calibration" | "holdout";
  readonly namespace: "b1-calibration-v1" | "b1-holdout-v1";
  readonly sourceRevision: string;
  readonly aggregate: BacktestAggregate;
  readonly fixedGates: readonly FixedGateResult[];
  readonly adjustableCriteria: AdjustableAcceptanceCriteria | null;
}

const STRATEGIES: readonly StrategyId[] = ["survival", "opportunist", "selective-betrayal"];
const ACCURACIES: readonly Accuracy[] = [0.4, 0.7];
const ENDINGS: readonly EndingKind[] = ["completed", "exhausted", "unemployed", "denounced", "distrust"];

function combinationId(strategy: StrategyId, accuracy: Accuracy): CombinationId {
  return `${strategy}@${accuracy}` as CombinationId;
}

function pairedCompleted(aggregate: BacktestAggregate, strategy: StrategyId): PairedDifference | null {
  const left = aggregate.runs.filter((run) => run.strategyId === strategy && run.accuracy === 0.4).sort((a, b) => a.seed.localeCompare(b.seed));
  const right = aggregate.runs.filter((run) => run.strategyId === strategy && run.accuracy === 0.7).sort((a, b) => a.seed.localeCompare(b.seed));
  const rightBySeed = new Map(right.map((run) => [run.seed, run]));
  const pairedLeft: number[] = [];
  const pairedRight: number[] = [];
  for (const run of left) {
    const match = rightBySeed.get(run.seed);
    if (match !== undefined) {
      pairedLeft.push(run.completed ? 1 : 0);
      pairedRight.push(match.completed ? 1 : 0);
    }
  }
  return pairedLeft.length < 2 ? null : pairedMeanDifference(pairedRight, pairedLeft);
}

export function evaluateFixedGates(aggregate: BacktestAggregate, criteria: AdjustableAcceptanceCriteria | null = null): readonly FixedGateResult[] {
  const noErrors: FixedGateResult = {
    id: "no-run-errors", passed: aggregate.errorCount === 0,
    evidence: `실행 오류 ${aggregate.errorCount}건`,
  };
  let accuracyPassed = true;
  const accuracyEvidence: string[] = [];
  for (const strategy of STRATEGIES) {
    for (const accuracy of ACCURACIES) {
      const combination = aggregate.combinations[combinationId(strategy, accuracy)];
      if (combination === undefined || combination.adviceTotal === 0) {
        accuracyPassed = false;
        accuracyEvidence.push(`${strategy}@${accuracy}: 표본 없음`);
        continue;
      }
      const interval = wilsonInterval(combination.adviceHits, combination.adviceTotal, 3.2905267314919255);
      const inside = interval.low <= accuracy && accuracy <= interval.high;
      accuracyPassed &&= inside;
      accuracyEvidence.push(`${strategy}@${accuracy} ${interval.low.toFixed(4)}–${interval.high.toFixed(4)} ${inside ? "포함" : "이탈"}`);
    }
  }
  const notAllS = STRATEGIES.every((strategy) => ACCURACIES.every((accuracy) => {
    const combination = aggregate.combinations[combinationId(strategy, accuracy)];
    return combination !== undefined && combination.rankSCount < combination.count;
  }));
  const betrayal = aggregate.combinations["selective-betrayal@0.7"];
  const betrayalCanComplete = betrayal !== undefined && betrayal.betrayalCompletions > 0;
  const effects = STRATEGIES.map((strategy) => pairedCompleted(aggregate, strategy)).filter((value): value is PairedDifference => value !== null);
  const statisticalEffect = effects.some((effect) => effect.low95 > 0 || effect.high95 < 0);
  const practicalEffect = criteria === null ? false : effects.some((effect) => Math.abs(effect.mean) >= criteria.minimumAccuracyEffect);
  return [
    noErrors,
    { id: "accuracy-interval", passed: accuracyPassed, evidence: accuracyEvidence.join("; ") },
    { id: "not-all-rank-s", passed: notAllS, evidence: "각 조합 S 도달률 100% 미만" },
    { id: "betrayal-can-complete", passed: betrayalCanComplete, evidence: `배신 완주 ${betrayal?.betrayalCompletions ?? 0}건` },
    { id: "accuracy-has-effect", passed: statisticalEffect && practicalEffect, evidence: `paired 통계 ${statisticalEffect ? "차이 있음" : "차이 없음"}; 실질 기준 ${criteria === null ? "승인 대기" : practicalEffect ? "충족" : "미충족"}` },
  ];
}

function rate(count: number, total: number): string {
  return total === 0 ? "0.0000" : (count / total).toFixed(4);
}

function lineForGate(gate: FixedGateResult): string {
  return `| ${gate.id} | ${gate.passed ? "PASS" : "FAIL"} | ${gate.evidence} |`;
}

export function renderBacktestReport(input: BacktestReportInput): string {
  const aggregate = aggregateRuns([...input.aggregate.runs].sort((left, right) => `${left.strategyId}@${left.accuracy}/${left.seed}`.localeCompare(`${right.strategyId}@${right.accuracy}/${right.seed}`)));
  const gates = [...input.fixedGates].sort((left, right) => left.id.localeCompare(right.id));
  const rows: string[] = [];
  for (const strategy of STRATEGIES) {
    for (const accuracy of ACCURACIES) {
      const combination = aggregate.combinations[combinationId(strategy, accuracy)];
      if (combination === undefined) continue;
      rows.push(`| ${strategy} | ${accuracy} | ${combination.count} | ${rate(combination.completedCount, combination.count)} | ${rate(combination.rankSCount, combination.count)} | ${rate(combination.adviceHits, combination.adviceTotal)} | ${combination.betrayalAttempts} | ${combination.betrayalCompletions} |`);
    }
  }
  const pairedRows: string[] = [];
  for (const strategy of STRATEGIES) {
    const difference = pairedCompleted(aggregate, strategy);
    if (difference === null) {
      pairedRows.push(`| ${strategy} | 표본 부족 | 표본 부족 | 표본 부족 |`);
    } else {
      pairedRows.push(`| ${strategy} | ${difference.mean.toFixed(3)} | ${difference.low95.toFixed(3)} | ${difference.high95.toFixed(3)} |`);
    }
  }
  const criteriaText = input.adjustableCriteria === null
    ? "calibration 결과 검토 및 사용자 승인 대기"
    : "승인된 calibration 기준을 적용함";
  return [
    "# B1 현행 캠페인 백테스트 보고서",
    "",
    `- 모드: ${input.mode}`,
    `- namespace: ${input.namespace}`,
    `- source revision: ${input.sourceRevision}`,
    "- 전략: survival, opportunist, selective-betrayal",
    "- 정확도: 0.4, 0.7",
    `- 조합당 표본: ${input.aggregate.runs.length / 6}`,
    "",
    "## 고정 gate",
    "",
    "| Gate | 결과 | 근거 |",
    "| --- | --- | --- |",
    ...gates.map(lineForGate),
    "",
    "## 조정 가능한 기준",
    "",
    `- ${criteriaText}`,
    "",
    "## 조합별 결과",
    "",
    "| 전략 | 정확도 | 표본 | 정상 완주율 | S 도달률 | 조언 적중률 | 배신 시도 | 배신 완주 |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...rows,
    "",
    "## paired 비교",
    "",
    "| 전략 | 0.7−0.4 평균 | 95% CI 하한 | 95% CI 상한 |",
    "| --- | ---: | ---: | ---: |",
    ...pairedRows,
    "",
    "## 오류와 재현 seed",
    "",
    `- 총 오류: ${aggregate.errorCount}`,
    ...Object.entries(aggregate.errorCounts).filter(([, count]) => count > 0).sort(([left], [right]) => left.localeCompare(right)).map(([kind, count]) => `- ${kind}: ${count}`),
    `- 대표 실패 seed: ${aggregate.runs.filter((run) => run.errorKind !== null).map((run) => run.seed).sort().slice(0, 20).join(", ") || "없음"}`,
    "",
    "## B1 판정",
    "",
    `- holdout 승인 기준 판정: ${input.mode === "holdout" && gates.every((gate) => gate.passed) ? "검토 필요" : "calibration/실패 근거 검토 필요"}`,
    `- B1-B 필요 여부: ${input.mode === "holdout" && gates.every((gate) => gate.passed) ? "없음" : "holdout 결과에 따라 결정"}`,
    "",
  ].join("\n");
}
