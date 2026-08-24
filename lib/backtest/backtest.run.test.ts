import { describe, expect, it } from "vitest";
import { campaignSeed } from "./backtest.run";

describe("B1 backtest seed 계약", () => {
  it("namespace와 번호를 고정 폭으로 조합한다", () => {
    expect(campaignSeed("b1-calibration-v1", 17)).toBe("b1-calibration-v1/000017");
  });
});
