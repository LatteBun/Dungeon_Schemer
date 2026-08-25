import { CAMPAIGN_BALANCE, type CampaignCalibrationSettings } from "@/lib/balance/campaign-balance";
import type { EndingKind } from "@/lib/domain";
import { B1B_ACCEPTANCE, evaluateB1BAcceptance, type B1BAcceptanceGate } from "./acceptance";
import {
  aggregateRuns,
  pairedMeanDifference,
  wilsonInterval,
  type BacktestAggregate,
  type CombinationId,
  type DepletionVerdict,
  type PairedDifference,
} from "./metrics";
import type { Accuracy, StrategyId } from "./public-state";

export interface FixedGateResult {
  readonly id: "no-run-errors" | "accuracy-interval" | "not-all-rank-s" | "betrayal-can-complete" | "accuracy-has-effect";
  readonly passed: boolean;
  readonly evidence: string;
}

export interface BacktestReportInput {
  readonly mode: "calibration" | "holdout";
  readonly namespace: "b1b-calibration-v1" | "b1b-holdout-v1";
  readonly seedsPerCombination: 2 | 50 | 100 | 200 | 2000;
  readonly sourceRevision: string;
  readonly aggregate: BacktestAggregate;
  readonly fixedGates: readonly FixedGateResult[];
  readonly calibrationEvidence: CalibrationEvidence;
}

export interface CalibrationStageEvidence {
  readonly seedsPerCombination: 50 | 100 | 200;
  readonly depletionVerdict: DepletionVerdict | null;
  readonly gateStatus: "PASS" | "FAIL" | "OBSERVE" | "NOT_RUN";
  readonly failureIds: readonly string[];
}

export interface CalibrationEvidence {
  readonly selectedAxis: "generalMonsterBaseStatMultiplier" | "worldTurn" | "bossBaseStatMultiplierByInitialRisk";
  readonly before: CampaignCalibrationSettings;
  readonly after: CampaignCalibrationSettings;
  readonly stages: readonly CalibrationStageEvidence[];
}

const STRATEGIES: readonly StrategyId[] = ["survival", "opportunist", "selective-betrayal"];
const ACCURACIES: readonly Accuracy[] = [0.4, 0.7];
const ENDINGS: readonly EndingKind[] = ["completed", "exhausted", "unemployed", "denounced", "distrust"];
const DEPLETION_SOURCES = ["expedition-general", "expedition-boss", "world-turn-background", "world-turn-rest"] as const;
const TERMINATION_REASONS = ["completed", "pool-exhausted", "no-eligible-party", "distrust", "denounced", "run-error"] as const;

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

export function evaluateFixedGates(aggregate: BacktestAggregate): readonly FixedGateResult[] {
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
  const completedBetrayalCampaigns = betrayal?.runs.filter((run) => run.completed).length ?? 0;
  const betrayalCanComplete = completedBetrayalCampaigns > 0;
  let accuracyHasEffect = true;
  const pairedEvidence: string[] = [];
  for (const strategy of STRATEGIES) {
    const difference = pairedCompleted(aggregate, strategy);
    if (difference === null) {
      accuracyHasEffect = false;
      pairedEvidence.push(`${strategy}: paired 표본 부족`);
      continue;
    }
    const practical = difference.mean >= B1B_ACCEPTANCE.minimumPairedAccuracyEffect;
    const statistical = difference.low95 > 0;
    accuracyHasEffect &&= practical && statistical;
    pairedEvidence.push(`${strategy}: ${difference.mean.toFixed(3)} (${difference.low95.toFixed(3)}–${difference.high95.toFixed(3)}, ${statistical ? "0 제외" : "0 포함"})`);
  }
  return [
    noErrors,
    { id: "accuracy-interval", passed: accuracyPassed, evidence: accuracyEvidence.join("; ") },
    { id: "not-all-rank-s", passed: notAllS, evidence: "각 조합 S 도달률 100% 미만" },
    { id: "betrayal-can-complete", passed: betrayalCanComplete, evidence: `캠페인 정상 완주 ${completedBetrayalCampaigns}건` },
    {
      id: "accuracy-has-effect",
      passed: accuracyHasEffect,
      evidence: `최소 실질 차이 ${B1B_ACCEPTANCE.minimumPairedAccuracyEffect.toFixed(3)}; ${pairedEvidence.join("; ")}`,
    },
  ];
}

function rate(count: number, total: number): string {
  return total === 0 ? "0.0000" : (count / total).toFixed(4);
}

function lineForGate(gate: FixedGateResult): string {
  return `| ${gate.id} | ${gate.passed ? "PASS" : "FAIL"} | ${gate.evidence} |`;
}

function lineForB1BGate(gate: B1BAcceptanceGate): string {
  return `| ${gate.id} | ${gateStatus(gate)} | ${gate.evidence} |`;
}

function gateStatus(gate: B1BAcceptanceGate): "PASS" | "FAIL" | "OBSERVE" {
  if (!gate.enforced) return "OBSERVE";
  return gate.passed ? "PASS" : "FAIL";
}

function nullable(value: number | null, digits = 4): string {
  return value === null ? "—" : value.toFixed(digits);
}

function nullableInterval(interval: { readonly low: number; readonly high: number } | null): string {
  return interval === null ? "—" : `${interval.low.toFixed(4)}–${interval.high.toFixed(4)}`;
}

function calibrationMultiplier(multiplier: number): string {
  return Math.abs(multiplier * 100 - Math.round(multiplier * 100)) < 1e-9
    ? multiplier.toFixed(2)
    : multiplier.toFixed(3);
}

function calibrationSettingsMultipliers(settings: CampaignCalibrationSettings): string {
  return Object.entries(settings.bossBaseStatMultiplierByInitialRisk)
    .map(([risk, multiplier]) => `★${risk}: ${multiplier.toFixed(3)}`)
    .join(", ");
}

function calibrationVerdict(verdict: DepletionVerdict | null): string {
  if (verdict === null) return "—";
  return `${verdict.kind}${verdict.kind === "dominant" ? ` (${verdict.source})` : ""}: ${verdict.evidence}`;
}

function resolveSeedsPerCombination(input: BacktestReportInput): 2 | 50 | 100 | 200 | 2000 {
  const { seedsPerCombination } = input;
  if (seedsPerCombination !== 2
    && seedsPerCombination !== 50
    && seedsPerCombination !== 100
    && seedsPerCombination !== 200
    && seedsPerCombination !== 2000) {
    throw new Error("조합당 표본 수는 2, 50, 100, 200, 2000 중 하나여야 한다");
  }
  return seedsPerCombination;
}

export function renderBacktestReport(input: BacktestReportInput): string {
  const aggregate = aggregateRuns([...input.aggregate.runs].sort((left, right) => `${left.strategyId}@${left.accuracy}/${left.seed}`.localeCompare(`${right.strategyId}@${right.accuracy}/${right.seed}`)));
  const seedsPerCombination = resolveSeedsPerCombination(input);
  const gates = [...input.fixedGates].sort((left, right) => left.id.localeCompare(right.id));
  const b1bGates = [...evaluateB1BAcceptance(aggregate, {
    mode: input.mode,
    seedsPerCombination,
  })].sort((left, right) => left.id.localeCompare(right.id));
  const rows: string[] = [];
  for (const strategy of STRATEGIES) {
    for (const accuracy of ACCURACIES) {
      const combination = aggregate.combinations[combinationId(strategy, accuracy)];
      if (combination === undefined) continue;
      rows.push(`| ${strategy} | ${accuracy} | ${combination.count} | ${combination.completionRate.toFixed(4)} | ${nullable(combination.completedWipeMean)} | ${nullable(combination.fivePlusWipeRate)} | ${combination.meanMaxAdvicePressure.toFixed(4)} | ${nullable(combination.meanBossEntryHpRatio)} |`);
    }
  }
  const firstAttemptFunnelRows: string[] = [];
  const allAttemptFunnelRows: string[] = [];
  const eventualClearRows: string[] = [];
  const themeFunnelRows: string[] = [];
  const endingRows: string[] = [];
  const progressionRows: string[] = [];
  const remainingRiskRows: string[] = [];
  const depletionRows: string[] = [];
  const terminationRows: string[] = [];
  const opportunistFirstAttemptDepletionRows: string[] = [];
  for (const strategy of STRATEGIES) {
    for (const accuracy of ACCURACIES) {
      const combination = aggregate.combinations[combinationId(strategy, accuracy)];
      if (combination === undefined) continue;
      for (const source of DEPLETION_SOURCES) {
        const totals = combination.depletionBySource[source];
        const verdict = combination.depletionVerdict;
        depletionRows.push(`| ${strategy} | ${accuracy} | ${source} | ${totals.hpLost} | ${totals.hpRecovered} | ${totals.deaths} | ${totals.seriousInjuriesStarted} | ${totals.seriousInjuriesCleared} | ${totals.trustZeroed} | ${verdict.kind}${verdict.kind === "dominant" ? ` (${verdict.source})` : ""} | ${verdict.evidence} |`);
      }
      terminationRows.push(`| ${strategy} | ${accuracy} | ${TERMINATION_REASONS.map((reason) => combination.terminationCounts[reason]).join(" | ")} | ${combination.means.totalDeaths.toFixed(4)} | ${combination.means.aliveCount.toFixed(4)} | ${combination.means.deployableCount.toFixed(4)} | ${combination.means.zeroTrustCount.toFixed(4)} | ${combination.means.gravelyWoundedCount.toFixed(4)} |`);
      if (strategy === "opportunist" && accuracy === 0.7) {
        for (const { theme, initialRisk, sourceTotals } of Object.entries(combination.firstAttemptDepletionByThemeRisk)
          .map(([themeRisk, sourceTotals]) => {
            const [theme, initialRisk] = themeRisk.split("/");
            return { theme: theme!, initialRisk: Number(initialRisk), sourceTotals };
          })
          .sort((left, right) => left.initialRisk - right.initialRisk || left.theme.localeCompare(right.theme))) {
          for (const source of DEPLETION_SOURCES) {
            const totals = sourceTotals[source];
            if (totals.hpLost === 0 && totals.hpRecovered === 0 && totals.deaths === 0 && totals.seriousInjuriesStarted === 0 && totals.seriousInjuriesCleared === 0 && totals.trustZeroed === 0) continue;
            opportunistFirstAttemptDepletionRows.push(`| ${initialRisk} | ${theme} | ${source} | ${totals.hpLost} | ${totals.hpRecovered} | ${totals.deaths} | ${totals.seriousInjuriesStarted} | ${totals.seriousInjuriesCleared} | ${totals.trustZeroed} |`);
          }
        }
      }
      for (const risk of [1, 2, 3, 4, 5] as const) {
        const funnel = combination.firstAttemptByInitialRisk[risk];
        firstAttemptFunnelRows.push(`| ${strategy} | ${accuracy} | ${risk} | ${funnel.starts} | ${funnel.bossEntries} | ${funnel.clears} | ${funnel.wipes} | ${funnel.interrupted} | ${funnel.preBossFailures} | ${funnel.bossFailures} | ${nullable(funnel.clearRate)} | ${nullable(funnel.bossReachRate)} | ${nullable(funnel.bossConversionRate)} | ${nullable(funnel.meanBossEntryHpRatio)} | ${nullable(funnel.meanBossEntryAliveCount)} | ${nullableInterval(funnel.clearRateWilson95)} |`);
      }
      for (const risk of [1, 2, 3, 4, 5] as const) {
        const funnel = combination.allAttemptsByCurrentRisk[risk];
        allAttemptFunnelRows.push(`| ${strategy} | ${accuracy} | ${risk} | ${funnel.starts} | ${funnel.bossEntries} | ${funnel.clears} | ${funnel.wipes} | ${funnel.interrupted} | ${funnel.preBossFailures} | ${funnel.bossFailures} | ${nullable(funnel.clearRate)} | ${nullable(funnel.bossReachRate)} | ${nullable(funnel.bossConversionRate)} | ${nullable(funnel.meanBossEntryHpRatio)} | ${nullable(funnel.meanBossEntryAliveCount)} | ${nullableInterval(funnel.clearRateWilson95)} |`);
      }
      for (const risk of [1, 2, 3, 4, 5] as const) {
        const eventual = combination.eventualDungeonByInitialRisk[risk];
        eventualClearRows.push(`| ${strategy} | ${accuracy} | ${risk} | ${eventual.attemptedDungeons} | ${eventual.clearedDungeons} | ${nullable(eventual.clearRate)} | ${nullableInterval(eventual.clearRateWilson95)} |`);
      }
      for (const themeRisk of Object.entries(combination.firstAttemptByThemeRisk)
        .map(([themeRisk, funnel]) => {
          const [theme, initialRisk] = themeRisk.split("/");
          return { theme: theme!, initialRisk: Number(initialRisk), funnel };
        })
        .sort((left, right) => left.initialRisk - right.initialRisk || left.theme.localeCompare(right.theme))) {
        const { theme, initialRisk, funnel } = themeRisk;
        themeFunnelRows.push(`| ${strategy} | ${accuracy} | ${initialRisk} | ${theme} | ${funnel.starts} | ${funnel.bossEntries} | ${funnel.clears} | ${funnel.wipes} | ${funnel.interrupted} | ${funnel.preBossFailures} | ${funnel.bossFailures} | ${nullable(funnel.clearRate)} | ${nullable(funnel.bossReachRate)} | ${nullable(funnel.bossConversionRate)} | ${nullable(funnel.meanBossEntryHpRatio)} | ${nullable(funnel.meanBossEntryAliveCount)} | ${nullableInterval(funnel.clearRateWilson95)} |`);
      }
      endingRows.push(`| ${strategy} | ${accuracy} | ${combination.endingCounts.completed} | ${combination.endingCounts.exhausted} | ${combination.endingCounts.unemployed} | ${combination.endingCounts.denounced} | ${combination.endingCounts.distrust} | ${combination.endingCounts["run-error"]} | ${rate(combination.rankSCount, combination.count)} |`);
      progressionRows.push(`| ${strategy} | ${accuracy} | ${rate(combination.rankReachedCounts.B, combination.count)} | ${nullable(combination.meanFirstRankAtExpedition.B)} | ${rate(combination.rankReachedCounts.A, combination.count)} | ${nullable(combination.meanFirstRankAtExpedition.A)} | ${rate(combination.rankReachedCounts.S, combination.count)} | ${nullable(combination.meanFirstRankAtExpedition.S)} |`);
      remainingRiskRows.push(`| ${strategy} | ${accuracy} | ${([1, 2, 3, 4, 5] as const).map((risk) => combination.meanRemainingDungeonsByRisk[risk].toFixed(4)).join(" | ")} |`);
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
  const bossMultipliers = Object.entries(CAMPAIGN_BALANCE.bossBaseStatMultiplierByInitialRisk).map(([risk, multiplier]) => `★${risk}: ${calibrationMultiplier(multiplier)}`).join(", ");
  const pressureRows = Object.entries(CAMPAIGN_BALANCE.advicePressure).map(([pressure, values]) =>
    `| ${pressure} | ${values.incomingDamageMultiplier.toFixed(2)} | ${values.outgoingDamageMultiplier.toFixed(2)} |`,
  );
  const calibrationSettingRows = ([
    ["이전", input.calibrationEvidence.before],
    ["이후", input.calibrationEvidence.after],
  ] as const).map(([label, settings]) =>
    `| ${label} | ${settings.revision} | ${settings.generalMonsterBaseStatMultiplier.toFixed(3)} | ${settings.restRecoveryRatio.toFixed(3)} | ${calibrationSettingsMultipliers(settings)} |`,
  );
  const calibrationStageRows = [...input.calibrationEvidence.stages]
    .sort((left, right) => left.seedsPerCombination - right.seedsPerCombination)
    .map((stage) => `| ${stage.seedsPerCombination} | ${calibrationVerdict(stage.depletionVerdict)} | ${stage.gateStatus} | ${stage.failureIds.join(", ") || "없음"} |`);
  return [
    "# B1 현행 캠페인 백테스트 보고서",
    "",
    `- 모드: ${input.mode}`,
    `- namespace: ${input.namespace}`,
    `- source revision: ${input.sourceRevision}`,
    "- 전략: survival, opportunist, selective-betrayal",
    "- 정확도: 0.4, 0.7",
    `- 조합당 표본: ${seedsPerCombination}`,
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
    "## calibration 선택과 단계별 근거",
    "",
    `- 선택 축: ${input.calibrationEvidence.selectedAxis}`,
    "",
    "| 설정 | revision | 일반 몬스터 배율 | 휴식 회복률 | 초기 위험도별 보스 배율 |",
    "| --- | --- | ---: | ---: | --- |",
    ...calibrationSettingRows,
    "",
    "| 조합당 시드 | 손실 판정 | Gate 상태 | 실패 ID |",
    "| ---: | --- | --- | --- |",
    ...calibrationStageRows,
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
    "## 캠페인 손실 원인 판정",
    "",
    "| 전략 | 정확도 | source | HP 손실 | HP 회복 | 사망 | 중상 시작 | 중상 해제 | 신뢰 0 | 판정 | 근거 |",
    "| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
    ...depletionRows,
    "",
    "## 종료 사유와 최종 풀 상태",
    "",
    "| 전략 | 정확도 | 완료 | 풀 소진 | 출전 불가 | 불신 | 고발 | 실행 오류 | 평균 사망 | 평균 생존 | 평균 출전 가능 | 평균 신뢰 0 | 평균 중상 |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...terminationRows,
    "",
    "## opportunist@0.7 초기 위험도·테마별 첫 시도 손실",
    "",
    "| 초기 위험도 | 테마 | source | HP 손실 | HP 회복 | 사망 | 중상 시작 | 중상 해제 | 신뢰 0 |",
    "| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...(opportunistFirstAttemptDepletionRows.length === 0 ? ["| — | — | — | 0 | 0 | 0 | 0 | 0 | 0 |"] : opportunistFirstAttemptDepletionRows),
    "",
    "## 초기 위험도별 첫 시도 던전 funnel",
    "",
    "| 전략 | 정확도 | 초기 위험도 | 첫 시도 표본 | 보스 진입 | 클리어 | 전멸 | 중단 | 보스 전 실패 | 보스 실패 | 클리어율 | 보스 도달률 | 보스 전환율 | 평균 보스 진입 HP 비율 | 평균 보스 진입 생존 인원 | Wilson 95% |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...firstAttemptFunnelRows,
    "",
    "## 현재 위험도별 전체 시도와 최종 통과",
    "",
    "### 전체 시도 funnel",
    "",
    "| 전략 | 정확도 | 현재 위험도 | 전체 시도 표본 | 보스 진입 | 클리어 | 전멸 | 중단 | 보스 전 실패 | 보스 실패 | 클리어율 | 보스 도달률 | 보스 전환율 | 평균 보스 진입 HP 비율 | 평균 보스 진입 생존 인원 | Wilson 95% |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...allAttemptFunnelRows,
    "",
    "### 초기 위험도별 최종 통과",
    "",
    "| 전략 | 정확도 | 초기 위험도 | 시도 던전 | 최종 통과 던전 | 최종 통과율 | Wilson 95% |",
    "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ...eventualClearRows,
    "",
    "## 초기 위험도·테마별 첫 시도 funnel",
    "",
    "| 전략 | 정확도 | 초기 위험도 | 테마 | 첫 시도 표본 | 보스 진입 | 클리어 | 전멸 | 중단 | 보스 전 실패 | 보스 실패 | 클리어율 | 보스 도달률 | 보스 전환율 | 평균 보스 진입 HP 비율 | 평균 보스 진입 생존 인원 | Wilson 95% |",
    "| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...(themeFunnelRows.length === 0 ? ["| — | — | — | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — | — | — | — | — | — |"] : themeFunnelRows),
    "",
    "## 엔딩·최종 등급 분포",
    "",
    "| 전략 | 정확도 | 정상 완주 | 소진 | 실업 | 고발 | 불신 | 실행 오류 | S 도달률 |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...endingRows,
    "",
    "## 승급 도달과 평균 최초 도달 원정",
    "",
    "| 전략 | 정확도 | B 도달률 | B 평균 원정 | A 도달률 | A 평균 원정 | S 도달률 | S 평균 원정 |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...progressionRows,
    "",
    "## 종료 시 평균 잔여 던전 위험도",
    "",
    "| 전략 | 정확도 | ★1 | ★2 | ★3 | ★4 | ★5 |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...remainingRiskRows,
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
