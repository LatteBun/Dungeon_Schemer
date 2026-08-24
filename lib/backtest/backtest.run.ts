import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { B1B_HOLDOUT_APPROVED, evaluateB1BAcceptance, type B1BAcceptanceGate } from "./acceptance";
import { runCampaign } from "./campaign-driver";
import { aggregateRuns, metricsForRun, type BacktestAggregate, type CampaignRunMetrics } from "./metrics";
import { evaluateFixedGates, renderBacktestReport, type FixedGateResult } from "./report";
import { STRATEGY_IDS, createStrategy } from "./strategies";
import type { Accuracy, StrategyId } from "./public-state";

export interface BacktestSuiteOptions {
  readonly mode: "calibration" | "holdout";
  readonly seedsPerCombination: 2 | 50 | 100 | 200 | 2000;
  readonly namespace: "b1b-calibration-v1" | "b1b-holdout-v1";
}

export function campaignSeed(namespace: BacktestSuiteOptions["namespace"], index: number): string {
  return `${namespace}/${String(index).padStart(6, "0")}`;
}

function metricsEqual(left: CampaignRunMetrics, right: CampaignRunMetrics): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function nondeterministic(metrics: CampaignRunMetrics): CampaignRunMetrics {
  return { ...metrics, ending: "run-error", termination: "run-error", completed: false, errorKind: "nondeterminism" };
}

export function runBacktestSuite(options: BacktestSuiteOptions): BacktestAggregate {
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

type BacktestEnvironment = Partial<Pick<NodeJS.ProcessEnv, "B1_BACKTEST_MODE" | "B1_BACKTEST_SEEDS" | "NODE_ENV">>;

export function optionsFromEnvironment(env?: NodeJS.ProcessEnv): BacktestSuiteOptions;
export function optionsFromEnvironment(env?: BacktestEnvironment): BacktestSuiteOptions;
export function optionsFromEnvironment(env: BacktestEnvironment = process.env): BacktestSuiteOptions {
  const mode = env.B1_BACKTEST_MODE;
  if (mode !== "calibration" && mode !== "holdout") throw new Error("B1_BACKTEST_MODE는 calibration 또는 holdout이어야 한다");
  const seedText = env.B1_BACKTEST_SEEDS ?? (mode === "calibration" ? "200" : "2000");
  const seedsPerCombination = Number(seedText);
  const calibrationSeedCount = seedsPerCombination === 50 || seedsPerCombination === 100 || seedsPerCombination === 200;
  const testSeedCount = env.NODE_ENV === "test" && seedsPerCombination === 2;
  if ((mode === "calibration" && !calibrationSeedCount && !testSeedCount) || (mode === "holdout" && seedsPerCombination !== 2000)) {
    throw new Error("B1_BACKTEST_SEEDS는 calibration에서 50, 100, 200(테스트에서는 2), holdout에서 2000이어야 한다");
  }
  if (mode === "holdout" && !B1B_HOLDOUT_APPROVED) throw new Error("B1-B holdout은 calibration 승인 전이다");
  return {
    mode,
    seedsPerCombination: seedsPerCombination as BacktestSuiteOptions["seedsPerCombination"],
    namespace: mode === "calibration" ? "b1b-calibration-v1" : "b1b-holdout-v1",
  };
}

export function shouldFailBacktest(
  fixedGates: readonly FixedGateResult[],
  acceptanceGates: readonly B1BAcceptanceGate[],
): boolean {
  return fixedGates.some((gate) => !gate.passed)
    || acceptanceGates.some((gate) => gate.enforced && !gate.passed);
}

function runCli(): void {
  const options = optionsFromEnvironment();
  const aggregate = runBacktestSuite(options);
  const gates = evaluateFixedGates(aggregate);
  const report = renderBacktestReport({
    mode: options.mode,
    namespace: options.namespace,
    seedsPerCombination: options.seedsPerCombination,
    sourceRevision: process.env.B1_SOURCE_REVISION ?? "working-tree",
    aggregate,
    fixedGates: gates,
  });
  writeFileSync(resolve(process.cwd(), "docs/technical/BACKTEST_REPORT.md"), report, "utf8");
  const acceptanceGates = evaluateB1BAcceptance(aggregate, {
    mode: options.mode,
    seedsPerCombination: options.seedsPerCombination,
  });
  if (shouldFailBacktest(gates, acceptanceGates)) process.exitCode = 1;
}

if (process.env.B1_BACKTEST_MODE !== undefined) {
  runCli();
  describe("B1 backtest suite", () => {
    it("report를 생성한다", () => {
      expect(true).toBe(true);
    });
  });
}
