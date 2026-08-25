import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { B1_RISK_CURVE_V2_CALIBRATION_SELECTION } from "@/lib/balance/campaign-balance";
import { B1B_HOLDOUT_APPROVED, evaluateB1BAcceptance, type B1BAcceptanceGate, type BacktestFocus } from "./acceptance";
import { runCampaign } from "./campaign-driver";
import { aggregateRuns, metricsForRun, type BacktestAggregate, type CampaignRunMetrics } from "./metrics";
import { evaluateFixedGates, renderBacktestReport, type CalibrationEvidence, type CalibrationStageEvidence, type FixedGateResult } from "./report";
import { STRATEGY_IDS, createStrategy } from "./strategies";
import type { Accuracy, StrategyId } from "./public-state";

export interface BacktestSuiteOptions {
  readonly mode: "calibration" | "holdout";
  readonly focus: BacktestFocus;
  readonly seedsPerCombination: 2 | 50 | 100 | 200 | 2000;
  readonly namespace: BacktestNamespace;
}

export type BacktestNamespace = "b1b-calibration-v1" | "b1-risk-curve-v2-calibration" | "b1b-holdout-v1";

export function campaignSeed(namespace: BacktestSuiteOptions["namespace"], index: number): string {
  return `${namespace}/${String(index).padStart(6, "0")}`;
}

function metricsEqual(left: CampaignRunMetrics, right: CampaignRunMetrics): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function nondeterministic(metrics: CampaignRunMetrics): CampaignRunMetrics {
  return { ...metrics, ending: "run-error", termination: "run-error", completed: false, errorKind: "nondeterminism" };
}

function expectedNamespace(mode: BacktestSuiteOptions["mode"], focus: BacktestFocus): BacktestNamespace {
  if (mode === "holdout") return "b1b-holdout-v1";
  return focus === "risk-curve" ? "b1-risk-curve-v2-calibration" : "b1b-calibration-v1";
}

export function validateBacktestSuiteOptions(options: BacktestSuiteOptions): void {
  const expected = expectedNamespace(options.mode, options.focus);
  if (options.mode === "holdout" && options.focus === "risk-curve") {
    throw new Error("risk-curve focus는 holdout을 실행할 수 없다");
  }
  if (options.namespace !== expected) {
    throw new Error(`B1_BACKTEST_NAMESPACE가 mode/focus와 일치하지 않는다: ${options.namespace}`);
  }
}

export function runBacktestSuite(options: BacktestSuiteOptions): BacktestAggregate {
  validateBacktestSuiteOptions(options);
  const runs: CampaignRunMetrics[] = [];
  const accuracies: readonly Accuracy[] = [0.4, 0.7];
  for (let index = 0; index < options.seedsPerCombination; index += 1) {
    const seed = campaignSeed(options.namespace, index);
    for (const strategyId of STRATEGY_IDS) {
      for (const accuracy of accuracies) {
        const input = { seed, strategy: createStrategy(strategyId), accuracy };
        const first = metricsForRun(runCampaign(input));
        const second = metricsForRun(runCampaign(input));
        runs.push(metricsEqual(first, second) ? first : nondeterministic(first));
      }
    }
  }
  return aggregateRuns(runs);
}

function aggregateForCalibrationStage(
  aggregate: BacktestAggregate,
  seedsPerCombination: 50 | 100 | 200,
): BacktestAggregate | null {
  const accuracies: readonly Accuracy[] = [0.4, 0.7];
  const runs: CampaignRunMetrics[] = [];
  for (const strategyId of STRATEGY_IDS) {
    for (const accuracy of accuracies) {
      const combinationRuns = aggregate.runs
        .filter((run) => run.strategyId === strategyId && run.accuracy === accuracy)
        .sort((left, right) => left.seed.localeCompare(right.seed));
      if (combinationRuns.length < seedsPerCombination) return null;
      runs.push(...combinationRuns.slice(0, seedsPerCombination));
    }
  }
  return aggregateRuns(runs);
}

function calibrationStageEvidence(
  aggregate: BacktestAggregate,
  seedsPerCombination: 50 | 100 | 200,
  focus: BacktestFocus,
): CalibrationStageEvidence {
  const stageAggregate = aggregateForCalibrationStage(aggregate, seedsPerCombination);
  if (stageAggregate === null) {
    return { seedsPerCombination, depletionVerdict: null, gateStatus: "NOT_RUN", failureIds: [] };
  }
  const fixedGates = evaluateFixedGates(stageAggregate, focus);
  const acceptanceGates = evaluateB1BAcceptance(stageAggregate, {
    mode: "calibration",
    seedsPerCombination,
    focus,
  });
  const failedFixed = fixedGates.filter((gate) => !gate.passed);
  const failedAcceptance = acceptanceGates.filter((gate) => !gate.passed);
  const enforcedFixed = fixedGates.filter((gate) => gate.enforced);
  const enforcedAcceptance = acceptanceGates.filter((gate) => gate.enforced);
  const enforcedFailure = failedFixed.some((gate) => gate.enforced)
    || failedAcceptance.some((gate) => gate.enforced);
  return {
    seedsPerCombination,
    depletionVerdict: stageAggregate.combinations["opportunist@0.7"]?.depletionVerdict ?? null,
    gateStatus: enforcedFailure
      ? "FAIL"
      : enforcedFixed.length + enforcedAcceptance.length === 0 ? "OBSERVE" : "PASS",
    failureIds: [...new Set([
      ...failedFixed.map((gate) => gate.id),
      ...failedAcceptance.map((gate) => gate.id),
    ])].sort(),
  };
}

export function buildCalibrationEvidence(
  options: BacktestSuiteOptions,
  aggregate: BacktestAggregate,
): CalibrationEvidence {
  return {
    selectedAxis: B1_RISK_CURVE_V2_CALIBRATION_SELECTION.selectedAxis,
    before: {
      ...B1_RISK_CURVE_V2_CALIBRATION_SELECTION.before,
      bossBaseStatMultiplierByInitialRisk: { ...B1_RISK_CURVE_V2_CALIBRATION_SELECTION.before.bossBaseStatMultiplierByInitialRisk },
    },
    after: {
      ...B1_RISK_CURVE_V2_CALIBRATION_SELECTION.after,
      bossBaseStatMultiplierByInitialRisk: { ...B1_RISK_CURVE_V2_CALIBRATION_SELECTION.after.bossBaseStatMultiplierByInitialRisk },
    },
    stages: ([50, 100, 200] as const).map((seedsPerCombination) =>
      options.mode === "calibration"
        ? calibrationStageEvidence(aggregate, seedsPerCombination, options.focus)
        : { seedsPerCombination, depletionVerdict: null, gateStatus: "NOT_RUN", failureIds: [] },
    ),
  };
}

type BacktestEnvironment = Partial<Pick<NodeJS.ProcessEnv, "B1_BACKTEST_MODE" | "B1_BACKTEST_FOCUS" | "B1_BACKTEST_NAMESPACE" | "B1_BACKTEST_SEEDS" | "NODE_ENV">>;

export function optionsFromEnvironment(env?: NodeJS.ProcessEnv): BacktestSuiteOptions;
export function optionsFromEnvironment(env?: BacktestEnvironment): BacktestSuiteOptions;
export function optionsFromEnvironment(env: BacktestEnvironment = process.env): BacktestSuiteOptions {
  const mode = env.B1_BACKTEST_MODE;
  if (mode !== "calibration" && mode !== "holdout") throw new Error("B1_BACKTEST_MODE는 calibration 또는 holdout이어야 한다");
  const focus = env.B1_BACKTEST_FOCUS ?? "full-campaign";
  if (focus !== "full-campaign" && focus !== "risk-curve") throw new Error("B1_BACKTEST_FOCUS는 full-campaign 또는 risk-curve이어야 한다");
  if (mode === "holdout" && focus === "risk-curve") throw new Error("risk-curve focus는 holdout을 실행할 수 없다");
  const seedText = env.B1_BACKTEST_SEEDS ?? (mode === "calibration" ? "200" : "2000");
  const seedsPerCombination = Number(seedText);
  const calibrationSeedCount = seedsPerCombination === 50 || seedsPerCombination === 100 || seedsPerCombination === 200;
  const testSeedCount = env.NODE_ENV === "test" && seedsPerCombination === 2;
  if ((mode === "calibration" && !calibrationSeedCount && !testSeedCount) || (mode === "holdout" && seedsPerCombination !== 2000)) {
    throw new Error("B1_BACKTEST_SEEDS는 calibration에서 50, 100, 200(테스트에서는 2), holdout에서 2000이어야 한다");
  }
  const namespace = expectedNamespace(mode, focus);
  if (env.B1_BACKTEST_NAMESPACE !== undefined && env.B1_BACKTEST_NAMESPACE !== namespace) {
    throw new Error(`B1_BACKTEST_NAMESPACE가 focus와 일치하지 않는다: ${env.B1_BACKTEST_NAMESPACE}`);
  }
  if (mode === "holdout" && !B1B_HOLDOUT_APPROVED) throw new Error("B1-B holdout은 calibration 승인 전이다");
  return {
    mode,
    focus,
    seedsPerCombination: seedsPerCombination as BacktestSuiteOptions["seedsPerCombination"],
    namespace,
  };
}

export function shouldFailBacktest(
  fixedGates: readonly FixedGateResult[],
  acceptanceGates: readonly B1BAcceptanceGate[],
): boolean {
  return fixedGates.some((gate) => gate.enforced && !gate.passed)
    || acceptanceGates.some((gate) => gate.enforced && !gate.passed);
}

export function assertBacktestPasses(
  fixedGates: readonly FixedGateResult[],
  acceptanceGates: readonly B1BAcceptanceGate[],
): void {
  const failedGates = [
    ...fixedGates.filter((gate) => gate.enforced && !gate.passed),
    ...acceptanceGates.filter((gate) => gate.enforced && !gate.passed),
  ];
  if (failedGates.length === 0) return;
  throw new Error(`B1 backtest 강제 gate 실패: ${failedGates.map((gate) => `${gate.id} (${gate.evidence})`).join("; ")}`);
}

function runCli(): void {
  const options = optionsFromEnvironment();
  const aggregate = runBacktestSuite(options);
  const gates = evaluateFixedGates(aggregate, options.focus);
  const report = renderBacktestReport({
    mode: options.mode,
    focus: options.focus,
    namespace: options.namespace,
    seedsPerCombination: options.seedsPerCombination,
    sourceRevision: process.env.B1_SOURCE_REVISION ?? "working-tree",
    aggregate,
    fixedGates: gates,
    calibrationEvidence: buildCalibrationEvidence(options, aggregate),
  });
  writeFileSync(resolve(process.cwd(), "docs/technical/BACKTEST_REPORT.md"), report, "utf8");
  const acceptanceGates = evaluateB1BAcceptance(aggregate, {
    mode: options.mode,
    seedsPerCombination: options.seedsPerCombination,
    focus: options.focus,
  });
  assertBacktestPasses(gates, acceptanceGates);
}

if (process.env.B1_BACKTEST_MODE !== undefined) {
  runCli();
  describe("B1 backtest suite", () => {
    it("report를 생성한다", () => {
      expect(true).toBe(true);
    });
  });
}
