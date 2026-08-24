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
      seedsPerCombination: 2 as const,
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
    expect(first).toContain("## 캠페인 손실 원인 판정");
    expect(first).toContain("expedition-boss");
    expect(first).toContain("dominant");
    expect(first).toContain("## 종료 사유와 최종 풀 상태");
    expect(first).toContain("평균 출전 가능");
    expect(first).toContain("평균 신뢰 0");
    expect(first).toContain("평균 중상");
    expect(first).toContain("## opportunist@0.7 초기 위험도·테마별 첫 시도 손실");
    expect(first).toContain("| opportunist | 0.7 | expedition-boss | 988 | 0 | 26 | 3 | 0 | 0 | dominant (expedition-boss) | 사망 26/26 (100.0%) |");
    expect(first).toContain("| opportunist | 0.7 | 0 | 1 | 0 | 0 | 0 | 0 | 26.0000 | 4.0000 | 3.0000 | 1.0000 | 0.0000 |");
    expect(first).toContain("| 2 | desert | expedition-boss | 128 | 0 | 4 | 0 | 0 | 0 |");
    expect(first).toContain("## 초기 위험도별 첫 시도 던전 funnel");
    expect(first).toContain("## 현재 위험도별 전체 시도와 최종 통과");
    expect(first).toContain("첫 시도 표본");
    expect(first).toContain("보스 전 실패");
    expect(first).toContain("보스 실패");
    expect(first).toContain("Wilson 95%");
    expect(first).toContain("OBSERVE");
    expect(first).toContain("## 엔딩·최종 등급 분포");
    expect(first).toContain("## paired 정확도 비교");
    expect(first).not.toContain("조정 가능한 기준");
    expect(first).not.toMatch(/duration|elapsed|실행 시간/i);
  });
});
