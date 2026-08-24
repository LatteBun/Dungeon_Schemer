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

function aggregateWithPairedCompletionDifference(sampleCount: number, differenceCount: number): BacktestAggregate {
  const base = aggregateFixture();
  const strategies = ["survival", "opportunist", "selective-betrayal"] as const;
  const runs = strategies.flatMap((strategyId) => {
    const low = base.runs.find((run) => run.strategyId === strategyId && run.accuracy === 0.4)!;
    const high = base.runs.find((run) => run.strategyId === strategyId && run.accuracy === 0.7)!;
    const lowCompletions = Math.floor(sampleCount * 0.30);
    return Array.from({ length: sampleCount }, (_, index) => [
      {
        ...low,
        seed: `paired/${String(index).padStart(4, "0")}`,
        completed: index < lowCompletions,
        ending: index < lowCompletions ? "completed" as const : "exhausted" as const,
        termination: index < lowCompletions ? "completed" as const : "pool-exhausted" as const,
      },
      {
        ...high,
        seed: `paired/${String(index).padStart(4, "0")}`,
        completed: index < lowCompletions + differenceCount,
        ending: index < lowCompletions + differenceCount ? "completed" as const : "exhausted" as const,
        termination: index < lowCompletions + differenceCount ? "completed" as const : "pool-exhausted" as const,
      },
    ]).flat();
  });
  return aggregateRuns(runs);
}

describe("백테스트 gate와 보고서", () => {
  it("배신 원정 클리어가 있어도 selective-betrayal@0.7 캠페인 완주가 0이면 gate를 실패시킨다", () => {
    const aggregate = aggregateFixture();
    const betrayal = aggregate.combinations["selective-betrayal@0.7"]!;
    const withoutCampaignCompletion: BacktestAggregate = {
      ...aggregate,
      combinations: {
        ...aggregate.combinations,
        "selective-betrayal@0.7": {
          ...betrayal,
          completedCount: 0,
          betrayalCompletions: 7,
        },
      },
    };

    expect(evaluateFixedGates(withoutCampaignCompletion).find((gate) => gate.id === "betrayal-can-complete"))
      .toMatchObject({ passed: false, evidence: expect.stringContaining("캠페인 정상 완주 0건") });
  });

  it("paired 완주 효과가 0.05이고 95% CI가 0을 제외할 때 accuracy gate를 통과시킨다", () => {
    const gate = evaluateFixedGates(aggregateWithPairedCompletionDifference(100, 5))
      .find((candidate) => candidate.id === "accuracy-has-effect");

    expect(gate).toMatchObject({ passed: true });
    expect(gate?.evidence).toContain("최소 실질 차이 0.050");
  });

  it("paired 완주 차이가 통계적으로 유의해도 0.05 미만이면 accuracy gate를 실패시킨다", () => {
    const gate = evaluateFixedGates(aggregateWithPairedCompletionDifference(200, 8))
      .find((candidate) => candidate.id === "accuracy-has-effect");

    expect(gate).toMatchObject({ passed: false });
    expect(gate?.evidence).toContain("0.040");
  });

  it("paired 완주 차이가 0.05여도 95% CI가 0을 포함하면 accuracy gate를 실패시킨다", () => {
    const gate = evaluateFixedGates(aggregateWithPairedCompletionDifference(20, 1))
      .find((candidate) => candidate.id === "accuracy-has-effect");

    expect(gate).toMatchObject({ passed: false });
    expect(gate?.evidence).toContain("0 포함");
  });

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
      calibrationEvidence: {
        selectedAxis: "bossBaseStatMultiplierByInitialRisk" as const,
        before: {
          revision: "b1b-risk-curve-v1",
          generalMonsterBaseStatMultiplier: 1,
          restRecoveryRatio: 0.20,
          bossBaseStatMultiplierByInitialRisk: { 1: 1.125, 2: 0.85, 3: 0.675, 4: 0.575, 5: 0.625 },
        },
        after: {
          revision: "b1c-boss-depletion-v1",
          generalMonsterBaseStatMultiplier: 1,
          restRecoveryRatio: 0.20,
          bossBaseStatMultiplierByInitialRisk: { 1: 1.10, 2: 0.825, 3: 0.65, 4: 0.55, 5: 0.60 },
        },
        stages: [
          {
            seedsPerCombination: 50 as const,
            depletionVerdict: { kind: "dominant" as const, source: "expedition-boss" as const, evidence: "사망 99.8%" },
            gateStatus: "FAIL" as const,
            failureIds: ["accuracy-has-effect"],
          },
          {
            seedsPerCombination: 100 as const,
            depletionVerdict: { kind: "dominant" as const, source: "expedition-boss" as const, evidence: "사망 99.9%" },
            gateStatus: "FAIL" as const,
            failureIds: ["completion-rate:opportunist@0.7"],
          },
          {
            seedsPerCombination: 200 as const,
            depletionVerdict: { kind: "dominant" as const, source: "expedition-boss" as const, evidence: "사망 99.9%" },
            gateStatus: "PASS" as const,
            failureIds: [],
          },
        ],
      },
    };
    const first = renderBacktestReport(input);
    const second = renderBacktestReport({ ...input, aggregate: aggregateRuns([...aggregate.runs].reverse()) });
    expect(second).toBe(first);
    expect(first).toContain("## 고정 무결성 gate");
    expect(first).toContain("## 설정 revision과 현재 수치");
    expect(first).toContain("## calibration 선택과 단계별 근거");
    expect(first).toContain("선택 축: bossBaseStatMultiplierByInitialRisk");
    expect(first).toContain("| 이전 | b1b-risk-curve-v1 | 1.000 | 0.200 | ★1: 1.125, ★2: 0.850, ★3: 0.675, ★4: 0.575, ★5: 0.625 |");
    expect(first).toContain("| 이후 | b1c-boss-depletion-v1 | 1.000 | 0.200 | ★1: 1.100, ★2: 0.825, ★3: 0.650, ★4: 0.550, ★5: 0.600 |");
    expect(first).toContain("| 50 | dominant (expedition-boss): 사망 99.8% | FAIL | accuracy-has-effect |");
    expect(first).toContain("| 100 | dominant (expedition-boss): 사망 99.9% | FAIL | completion-rate:opportunist@0.7 |");
    expect(first).toContain("| 200 | dominant (expedition-boss): 사망 99.9% | PASS | 없음 |");
    expect(first).toContain("초기 위험도별 보스 배율: ★1: 1.10, ★2: 0.825, ★3: 0.65, ★4: 0.55, ★5: 0.60");
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
    expect(first).toContain("| opportunist | 0.7 |");
    expect(first).toContain("| 2 | desert |");
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
