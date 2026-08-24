import { describe, expect, it } from "vitest";
import { runCampaign } from "./campaign-driver";
import { createStrategy } from "./strategies";
import { aggregateRuns, metricsForRun, pairedMeanDifference, wilsonInterval } from "./metrics";

describe("백테스트 통계", () => {
  it("Wilson 95% 구간의 알려진 값을 계산한다", () => {
    expect(wilsonInterval(50, 100)).toEqual({ low: expect.closeTo(0.4038315304, 9), high: expect.closeTo(0.5961684696, 9) });
  });

  it("같은 seed 순서의 paired 평균 차이와 95% 구간을 계산한다", () => {
    expect(pairedMeanDifference([1, 3, 8], [0, 1, 5])).toMatchObject({ mean: 2 });
  });

  it("정산의 계약 보상과 유품 골드를 분리해 한 판 지표로 만든다", () => {
    const run = runCampaign({ seed: "metrics-run", strategy: createStrategy("survival"), accuracy: 0.7 });
    const metrics = metricsForRun(run);
    expect(metrics.contractGold).toBeGreaterThanOrEqual(0);
    expect(metrics.relicGold).toBeGreaterThanOrEqual(0);
    expect(metrics.totalExpeditions).toBeGreaterThan(0);
    expect(metrics.adviceTotal).toBe(run.ok ? run.trace.adviceSelections.length : 0);
  });

  it("빈 집계는 aggregation error를 낸다", () => {
    expect(() => aggregateRuns([])).toThrow("집계할 실행 결과가 없다");
  });
});
