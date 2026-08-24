import { CAMPAIGN_BALANCE } from "@/lib/balance/campaign-balance";
import type { EndingKind } from "@/lib/domain";
import { evaluateB1BAcceptance, type B1BAcceptanceGate } from "./acceptance";
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
  readonly id: "no-run-errors" | "accuracy-interval" | "not-all-rank-s" | "betrayal-can-complete";
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
  /** @deprecated B1-B 보고서는 승인 대기 기준을 렌더링하지 않는다. */
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

export function evaluateFixedGates(aggregate: BacktestAggregate, _criteria: AdjustableAcceptanceCriteria | null = null): readonly FixedGateResult[] {
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
  return [
    noErrors,
    { id: "accuracy-interval", passed: accuracyPassed, evidence: accuracyEvidence.join("; ") },
    { id: "not-all-rank-s", passed: notAllS, evidence: "각 조합 S 도달률 100% 미만" },
    { id: "betrayal-can-complete", passed: betrayalCanComplete, evidence: `배신 완주 ${betrayal?.betrayalCompletions ?? 0}건` },
  ];
}

function rate(count: number, total: number): string {
  return total === 0 ? "0.0000" : (count / total).toFixed(4);
}

function lineForGate(gate: FixedGateResult): string {
  return `| ${gate.id} | ${gate.passed ? "PASS" : "FAIL"} | ${gate.evidence} |`;
}

function lineForB1BGate(gate: B1BAcceptanceGate): string {
  return `| ${gate.id} | ${gate.passed ? "PASS" : "FAIL"} | ${gate.evidence} |`;
}

function nullable(value: number | null, digits = 4): string {
  return value === null ? "—" : value.toFixed(digits);
}

export function renderBacktestReport(input: BacktestReportInput): string {
  const aggregate = aggregateRuns([...input.aggregate.runs].sort((left, right) => `${left.strategyId}@${left.accuracy}/${left.seed}`.localeCompare(`${right.strategyId}@${right.accuracy}/${right.seed}`)));
  const gates = [...input.fixedGates].sort((left, right) => left.id.localeCompare(right.id));
  const b1bGates = [...evaluateB1BAcceptance(aggregate)].sort((left, right) => left.id.localeCompare(right.id));
  const rows: string[] = [];
  for (const strategy of STRATEGIES) {
    for (const accuracy of ACCURACIES) {
      const combination = aggregate.combinations[combinationId(strategy, accuracy)];
      if (combination === undefined) continue;
      rows.push(`| ${strategy} | ${accuracy} | ${combination.count} | ${combination.completionRate.toFixed(4)} | ${nullable(combination.completedWipeMean)} | ${nullable(combination.fivePlusWipeRate)} | ${combination.meanMaxAdvicePressure.toFixed(4)} | ${nullable(combination.meanBossEntryHpRatio)} |`);
    }
  }
  const bossRows: string[] = [];
  const endingRows: string[] = [];
  for (const strategy of STRATEGIES) {
    for (const accuracy of ACCURACIES) {
      const combination = aggregate.combinations[combinationId(strategy, accuracy)];
      if (combination === undefined) continue;
      for (const [themeRisk, risk] of Object.entries(combination.bossByThemeRisk).sort(([left], [right]) => left.localeCompare(right))) {
        const [initialRisk, theme] = themeRisk.split("/");
        bossRows.push(`| ${strategy} | ${accuracy} | ${initialRisk} | ${theme} | ${risk.entries} | ${risk.clears} | ${risk.wipes} | ${risk.meanEntryHpRatio.toFixed(4)} |`);
      }
      endingRows.push(`| ${strategy} | ${accuracy} | ${combination.endingCounts.completed} | ${combination.endingCounts.exhausted} | ${combination.endingCounts.unemployed} | ${combination.endingCounts.denounced} | ${combination.endingCounts.distrust} | ${combination.endingCounts["run-error"]} | ${rate(combination.rankSCount, combination.count)} |`);
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
  const bossMultipliers = Object.entries(CAMPAIGN_BALANCE.bossBaseStatMultiplierByInitialRisk).map(([risk, multiplier]) => `★${risk}: ${multiplier.toFixed(2)}`).join(", ");
  const pressureRows = Object.entries(CAMPAIGN_BALANCE.advicePressure).map(([pressure, values]) =>
    `| ${pressure} | ${values.incomingDamageMultiplier.toFixed(2)} | ${values.outgoingDamageMultiplier.toFixed(2)} |`,
  );
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
    "## 설정 revision과 현재 수치",
    "",
    `- revision: ${CAMPAIGN_BALANCE.revision}`,
    `- 휴식 회복: ${CAMPAIGN_BALANCE.worldTurn.restRecoveryRatio.toFixed(2)}`,
    `- 비출전 HP 손실: ${CAMPAIGN_BALANCE.worldTurn.backgroundLossPercent.min}–${CAMPAIGN_BALANCE.worldTurn.backgroundLossPercent.max}%`,
    `- 초기 위험도별 보스 배율: ${bossMultipliers}`,
    "",
    "| 조언 압력 | 받는 피해 배율 | 주는 피해 배율 |",
    "| ---: | ---: | ---: |",
    ...pressureRows,
    "",
    "## 고정 무결성 gate",
    "",
    "| Gate | 결과 | 근거 |",
    "| --- | --- | --- |",
    ...gates.map(lineForGate),
    "",
    "## B1-B 완주율·완주 전멸 gate",
    "",
    "| Gate | 결과 | 근거 |",
    "| --- | --- | --- |",
    ...b1bGates.map(lineForB1BGate),
    "",
    "## 조합별 완주율·완주 전멸 평균·5+ 비율·압력·보스 진입 HP",
    "",
    "| 전략 | 정확도 | 표본 | 완주율 | 완주 전멸 평균 | 5+ 전멸 비율 | 평균 최대 압력 | 보스 진입 HP 비율 |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...rows,
    "",
    "## 위험도·테마별 보스 진입/클리어/전멸",
    "",
    "| 전략 | 정확도 | 초기 위험도 | 테마 | 진입 | 클리어 | 전멸 | 평균 진입 HP 비율 |",
    "| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: |",
    ...(bossRows.length === 0 ? ["| — | — | — | — | 0 | 0 | 0 | — |"] : bossRows),
    "",
    "## 엔딩·최종 등급 분포",
    "",
    "| 전략 | 정확도 | 정상 완주 | 소진 | 실업 | 고발 | 불신 | 실행 오류 | S 도달률 |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...endingRows,
    "",
    "## paired 정확도 비교",
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
  ].join("\n");
}
