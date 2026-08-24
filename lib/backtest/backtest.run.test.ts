import { describe, expect, it } from "vitest";
import { campaignSeed, optionsFromEnvironment } from "./backtest.run";

describe("B1 backtest seed 계약", () => {
  it("B1-B calibration namespace와 번호를 고정 폭으로 조합한다", () => {
    expect(campaignSeed("b1b-calibration-v1", 17)).toBe("b1b-calibration-v1/000017");
  });
});

describe("B1-B backtest runner 옵션", () => {
  it.each(["50", "100"] as const)("calibration 표본 %s을 허용한다", (seeds) => {
    expect(optionsFromEnvironment({ B1_BACKTEST_MODE: "calibration", B1_BACKTEST_SEEDS: seeds })).toMatchObject({
      mode: "calibration",
      seedsPerCombination: Number(seeds),
      namespace: "b1b-calibration-v1",
    });
  });

  it("calibration 기본 표본은 조합당 200시드다", () => {
    expect(optionsFromEnvironment({ B1_BACKTEST_MODE: "calibration" }).seedsPerCombination).toBe(200);
  });

  it("승인 전 holdout 실행을 거부한다", () => {
    expect(() => optionsFromEnvironment({ B1_BACKTEST_MODE: "holdout" })).toThrow("B1-B holdout은 calibration 승인 전이다");
  });

  it.each([
    { B1_BACKTEST_MODE: "calibration", B1_BACKTEST_SEEDS: "49" },
    { B1_BACKTEST_MODE: "holdout", B1_BACKTEST_SEEDS: "200" },
    { B1_BACKTEST_MODE: "unknown", B1_BACKTEST_SEEDS: "50" },
  ])("지원하지 않는 mode 또는 표본을 명시적으로 거부한다", (env) => {
    expect(() => optionsFromEnvironment(env)).toThrow();
  });
});
