import { describe, expect, it } from "vitest";
import { runCampaign } from "./campaign-driver";
import { createStrategy } from "./strategies";
import { aggregateRuns, metricsForRun, type BacktestAggregate } from "./metrics";
import { evaluateFixedGates, renderBacktestReport } from "./report";

function aggregateFixture(): BacktestAggregate {
  const runs = [
    runCampaign({ seed: "report-a", strategy: createStrategy("survival"), accuracy: 0.4 }),
    runCampaign({ seed: "report-a", strategy: createStrategy("survival"), accuracy: 0.7 }),
  ].map(metricsForRun);
  return aggregateRuns(runs);
}

describe("백테스트 gate와 보고서", () => {
  it("같은 집계는 실행 순서와 무관하게 같은 Markdown을 만든다", () => {
    const aggregate = aggregateFixture();
    const gates = evaluateFixedGates(aggregate);
    const input = {
      mode: "calibration" as const,
      namespace: "b1-calibration-v1" as const,
      sourceRevision: "test-revision",
      aggregate,
      fixedGates: gates,
      adjustableCriteria: null,
    };
    const first = renderBacktestReport(input);
    const second = renderBacktestReport({ ...input, aggregate: aggregateRuns([...aggregate.runs].reverse()) });
    expect(second).toBe(first);
    expect(first).toContain("## 고정 gate");
    expect(first).toContain("## 조합별 결과");
    expect(first).toContain("## paired 비교");
    expect(first).not.toMatch(/duration|elapsed|실행 시간/i);
  });
});
