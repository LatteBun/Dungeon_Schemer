import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertBacktestPasses, buildCalibrationEvidence, campaignSeed, optionsFromEnvironment, runBacktestSuite, shouldFailBacktest, validateBacktestSuiteOptions, writeBacktestSnapshotIfRequested } from "./backtest.run";

describe("B1 backtest seed 계약", () => {
  it("B1-B calibration namespace와 번호를 고정 폭으로 조합한다", () => {
    expect(campaignSeed("b1b-calibration-v1", 17)).toBe("b1b-calibration-v1/000017");
  });

  it("risk-curve namespace와 번호를 고정 폭으로 조합한다", () => {
    expect(campaignSeed("b1-risk-curve-v2-calibration", 17)).toBe("b1-risk-curve-v2-calibration/000017");
  });
});

describe("B1-B backtest runner 옵션", () => {
  it.each(["50", "100"] as const)("calibration 표본 %s을 허용한다", (seeds) => {
    expect(optionsFromEnvironment({ B1_BACKTEST_MODE: "calibration", B1_BACKTEST_SEEDS: seeds })).toMatchObject({
      mode: "calibration",
      focus: "full-campaign",
      seedsPerCombination: Number(seeds),
      namespace: "b1b-calibration-v1",
    });
  });

  it("risk-curve calibration은 독립 namespace를 사용한다", () => {
    expect(optionsFromEnvironment({ B1_BACKTEST_MODE: "calibration", B1_BACKTEST_FOCUS: "risk-curve", B1_BACKTEST_SEEDS: "50" })).toMatchObject({
      mode: "calibration",
      focus: "risk-curve",
      namespace: "b1-risk-curve-v2-calibration",
    });
  });

  it.each([
    { mode: "calibration" as const, focus: "risk-curve" as const, namespace: "b1b-calibration-v1" as const },
    { mode: "calibration" as const, focus: "full-campaign" as const, namespace: "b1-risk-curve-v2-calibration" as const },
    { mode: "holdout" as const, focus: "risk-curve" as const, namespace: "b1b-holdout-v1" as const },
  ])("직접 runner 호출도 mode/focus와 namespace 불일치를 거부한다", (options) => {
    expect(() => validateBacktestSuiteOptions({ ...options, seedsPerCombination: 2 })).toThrow();
  });

  it("calibration 기본 표본은 조합당 200시드다", () => {
    expect(optionsFromEnvironment({ B1_BACKTEST_MODE: "calibration" }).seedsPerCombination).toBe(200);
  });

  it("승인 전 holdout 실행을 거부한다", () => {
    expect(() => optionsFromEnvironment({ B1_BACKTEST_MODE: "holdout" })).toThrow("B1-B holdout은 calibration 승인 전이다");
  });

  it("risk-curve focus holdout은 승인 검사 전에 거부한다", () => {
    expect(() => optionsFromEnvironment({ B1_BACKTEST_MODE: "holdout", B1_BACKTEST_FOCUS: "risk-curve" })).toThrow("risk-curve focus는 holdout을 실행할 수 없다");
  });

  it.each([
    { B1_BACKTEST_MODE: "calibration", B1_BACKTEST_SEEDS: "49" },
    { B1_BACKTEST_MODE: "holdout", B1_BACKTEST_SEEDS: "200" },
    { B1_BACKTEST_MODE: "unknown", B1_BACKTEST_SEEDS: "50" },
    { B1_BACKTEST_MODE: "calibration", B1_BACKTEST_FOCUS: "unknown", B1_BACKTEST_SEEDS: "50" },
    { B1_BACKTEST_MODE: "calibration", B1_BACKTEST_FOCUS: "risk-curve", B1_BACKTEST_NAMESPACE: "b1b-calibration-v1", B1_BACKTEST_SEEDS: "50" },
  ])("지원하지 않는 mode 또는 표본을 명시적으로 거부한다", (env) => {
    expect(() => optionsFromEnvironment(env)).toThrow();
  });
});

describe("B1-C calibration 근거 모델", () => {
  it("runner가 실행하지 않은 후속 단계를 임의 결과로 채우지 않는다", () => {
    const options = {
      mode: "calibration" as const,
      focus: "risk-curve" as const,
      seedsPerCombination: 2 as const,
      namespace: "b1-risk-curve-v2-calibration" as const,
    };
    const evidence = buildCalibrationEvidence(options, runBacktestSuite(options));

    expect(evidence).toMatchObject({
      selectedAxis: "bossBaseStatMultiplierByInitialRisk",
      before: { revision: "b1c-boss-depletion-v1" },
      after: { revision: "b1-risk-curve-v2" },
    });
    expect(evidence.stages).toEqual([
      { seedsPerCombination: 50, depletionVerdict: null, gateStatus: "NOT_RUN", failureIds: [] },
      { seedsPerCombination: 100, depletionVerdict: null, gateStatus: "NOT_RUN", failureIds: [] },
      { seedsPerCombination: 200, depletionVerdict: null, gateStatus: "NOT_RUN", failureIds: [] },
    ]);
  });
});

describe("B1-B backtest 실행 종료 판정", () => {
  it("고정 gate 실패는 관찰 단계에서도 실행을 실패시킨다", () => {
    expect(shouldFailBacktest(
      [{ id: "no-run-errors", passed: false, enforced: true, evidence: "1건" }],
      [],
    )).toBe(true);
  });

  it("관찰 fixed gate 실패는 실행을 실패시키지 않는다", () => {
    expect(shouldFailBacktest(
      [{ id: "accuracy-interval", passed: false, enforced: false, evidence: "관찰" }],
      [],
    )).toBe(false);
  });

  it("OBSERVE acceptance 실패는 실행을 실패시키지 않는다", () => {
    expect(shouldFailBacktest([], [{
      id: "first-attempt-clear-rate:opportunist@0.7:risk-1",
      passed: false,
      enforced: false,
      evidence: "관찰",
    }])).toBe(false);
  });

  it("강제 acceptance 실패는 실행을 실패시킨다", () => {
    expect(shouldFailBacktest([], [{
      id: "first-attempt-clear-rate:opportunist@0.7:risk-1",
      passed: false,
      enforced: true,
      evidence: "기준 이탈",
    }])).toBe(true);
  });

  it("강제 gate 실패를 Vitest 실행 실패로 전파한다", () => {
    expect(() => assertBacktestPasses(
      [{ id: "accuracy-interval", passed: false, enforced: true, evidence: "survival@0.7 이탈" }],
      [],
    )).toThrow("B1 backtest 강제 gate 실패: accuracy-interval (survival@0.7 이탈)");
  });
});

describe("B1 backtest 기준선 기록", () => {
  it("snapshot 경로가 있을 때만 집계 실행을 JSON으로 기록한다", () => {
    const directory = mkdtempSync(join(tmpdir(), "dungeon-schemer-backtest-run-"));
    const path = join(directory, "baseline.json");
    const aggregate = runBacktestSuite({
      mode: "calibration", focus: "risk-curve", seedsPerCombination: 2, namespace: "b1-risk-curve-v2-calibration",
    });
    try {
      writeBacktestSnapshotIfRequested(undefined, aggregate);
      expect(existsSync(path)).toBe(false);
      writeBacktestSnapshotIfRequested(path, aggregate);
      expect(existsSync(path)).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
