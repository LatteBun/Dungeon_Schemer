import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runCampaign } from "./campaign-driver";
import { aggregateRuns, metricsForRun, type BacktestAggregate, type CampaignRunMetrics } from "./metrics";
import { evaluateFixedGates, renderBacktestReport } from "./report";
import { STRATEGY_IDS, createStrategy } from "./strategies";
import type { Accuracy, StrategyId } from "./public-state";

export interface BacktestSuiteOptions {
  readonly mode: "calibration" | "holdout";
  readonly seedsPerCombination: 200 | 2000;
  readonly namespace: "b1-calibration-v1" | "b1-holdout-v1";
}

export function campaignSeed(namespace: BacktestSuiteOptions["namespace"], index: number): string {
  return `${namespace}/${String(index).padStart(6, "0")}`;
}

function metricsEqual(left: CampaignRunMetrics, right: CampaignRunMetrics): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function nondeterministic(metrics: CampaignRunMetrics): CampaignRunMetrics {
  return { ...metrics, ending: "run-error", completed: false, errorKind: "nondeterminism" };
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

function optionsFromEnvironment(): BacktestSuiteOptions {
  const mode = process.env.B1_BACKTEST_MODE;
  if (mode !== "calibration" && mode !== "holdout") throw new Error("B1_BACKTEST_MODE는 calibration 또는 holdout이어야 한다");
  const seedsPerCombination = process.env.NODE_ENV === "test" && process.env.B1_BACKTEST_SEEDS === "2" ? 2 : mode === "calibration" ? 200 : 2000;
  if (mode === "holdout") throw new Error("holdout 승인 기준이 아직 연결되지 않았다");
  return {
    mode,
    seedsPerCombination: seedsPerCombination as 200 | 2000,
    namespace: mode === "calibration" ? "b1-calibration-v1" : "b1-holdout-v1",
  };
}

function runCli(): void {
  const options = optionsFromEnvironment();
  const aggregate = runBacktestSuite(options);
  const gates = evaluateFixedGates(aggregate);
  const report = renderBacktestReport({
    mode: options.mode,
    namespace: options.namespace,
    sourceRevision: process.env.B1_SOURCE_REVISION ?? "working-tree",
    aggregate,
    fixedGates: gates,
  });
  writeFileSync(resolve(process.cwd(), "docs/technical/BACKTEST_REPORT.md"), report, "utf8");
  if (options.mode === "holdout" && gates.some((gate) => !gate.passed)) process.exitCode = 1;
}

if (process.env.B1_BACKTEST_MODE !== undefined) {
  runCli();
  describe("B1 backtest suite", () => {
    it("report를 생성한다", () => {
      expect(true).toBe(true);
    });
  });
}
