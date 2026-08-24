import { describe, expect, it } from "vitest";
import { runCampaign } from "./campaign-driver";
import { createStrategy } from "./strategies";
import { aggregateRuns, metricsForRun, type BacktestAggregate } from "./metrics";
import { evaluateFixedGates, renderBacktestReport } from "./report";

function aggregateFixture(): BacktestAggregate {
  const runs = ["survival", "opportunist", "selective-betrayal"].flatMap((strategyId) => [0.4, 0.7].map((accuracy) =>
    runCampaign({ seed: `report-${strategyId}-${accuracy}`, strategy: createStrategy(strategyId as "survival" | "opportunist" | "selective-betrayal"), accuracy: accuracy as 0.4 | 0.7 }),
  )).map(metricsForRun);
  return aggregateRuns(runs);
}

describe("백테스트 gate와 보고서", () => {
  it("같은 집계는 실행 순서와 무관하게 같은 Markdown을 만든다", () => {
    const aggregate = aggregateFixture();
    const gates = evaluateFixedGates(aggregate);
    const input = {
      mode: "calibration" as const,
      namespace: "b1b-calibration-v1" as const,
      sourceRevision: "test-revision",
      aggregate,
      fixedGates: gates,
    };
    const first = renderBacktestReport(input);
    const second = renderBacktestReport({ ...input, aggregate: aggregateRuns([...aggregate.runs].reverse()) });
    expect(second).toBe(first);
    expect(first).toContain("## 고정 무결성 gate");
    expect(first).toContain("## 설정 revision과 현재 수치");
    expect(first).toContain("## B1-B 완주율·완주 전멸 gate");
    expect(first).toContain("## 조합별 완주율·완주 전멸 평균·5+ 비율·압력·보스 진입 HP");
    expect(first).toContain("## 위험도·테마별 보스 진입/클리어/전멸");
    expect(first).toContain("## 엔딩·최종 등급 분포");
    expect(first).toContain("## paired 정확도 비교");
    expect(first).not.toContain("조정 가능한 기준");
    expect(first).not.toMatch(/duration|elapsed|실행 시간/i);
  });
});
