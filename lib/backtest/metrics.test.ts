import { describe, expect, it } from "vitest";
import { runCampaign } from "./campaign-driver";
import { createStrategy } from "./strategies";
import { aggregateRuns, metricsForRun, pairedMeanDifference, wilsonInterval, type CampaignRunMetrics } from "./metrics";

function metric(overrides: Partial<CampaignRunMetrics> = {}): CampaignRunMetrics {
  return {
    seed: "fixture", strategyId: "survival", accuracy: 0.7,
    ending: "exhausted", completed: false, finalRank: "C", reachedRankS: false,
    totalExpeditions: 0, clearedExpeditions: 0, wipedExpeditions: 0, totalDeaths: 0,
    aliveCount: 0, deployableCount: 0, zeroTrustCount: 0, gravelyWoundedCount: 0,
    finalReputation: 0, finalGold: 0, contractGold: 0, relicGold: 0, cumulativeGold: 0,
    meanTrust: 0, medianTrust: 0, meanHpRatio: 0, medianHpRatio: 0,
    reputationPromotions: 0, goldPromotions: 0, firstRankAtExpedition: {},
    nodeCategoryChoices: { rest: 0, merchant: 0, special: 0, monster: 0, boss: 0 },
    intendedAdviceCounts: { help: 0, harm: 0, neutral: 0 },
    selectedAdviceCounts: { help: 0, harm: 0, neutral: 0 },
    reactionCounts: { accepted: 0, suspected: 0, exposed: 0 },
    betrayalAttempts: 0, betrayalWipes: 0, betrayalCompletions: 0,
    merchantGoldSpent: 0, merchantEffectsConsumed: 0, adviceHits: 0, adviceTotal: 0,
    errorKind: null,
    balanceExpeditions: [{
      expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, theme: "spider", initialRiskLevel: 1,
      startAdvicePressure: 0, maxAdvicePressure: 0, bossEntry: null, endAdvicePressure: 0, result: "cleared",
    }],
    ...overrides,
  } as CampaignRunMetrics;
}

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

  it("완주 전멸, 5회 이상 전멸, 압력과 보스 진입 HP를 손계산으로 집계한다", () => {
    const combination = aggregateRuns([
      metric({
        seed: "a", completed: true, ending: "completed", wipedExpeditions: 0,
        balanceExpeditions: [{
          expeditionId: "a", dungeonId: "dungeon-a" as never, theme: "spider", initialRiskLevel: 1,
          startAdvicePressure: 0, maxAdvicePressure: 0, bossEntry: { advicePressure: 0, aliveCount: 3, hp: 50, maxHp: 100 }, endAdvicePressure: 0, result: "cleared",
        }],
      }),
      metric({
        seed: "b", completed: true, ending: "completed", wipedExpeditions: 5,
        balanceExpeditions: [{
          expeditionId: "b", dungeonId: "dungeon-b" as never, theme: "spider", initialRiskLevel: 1,
          startAdvicePressure: 0, maxAdvicePressure: 2, bossEntry: { advicePressure: 2, aliveCount: 2, hp: 50, maxHp: 100 }, endAdvicePressure: 2, result: "wiped",
        }],
      }),
      metric({
        seed: "c", wipedExpeditions: 3,
        balanceExpeditions: [{
          expeditionId: "c", dungeonId: "dungeon-c" as never, theme: "desert", initialRiskLevel: 2,
          startAdvicePressure: 0, maxAdvicePressure: 3, bossEntry: null, endAdvicePressure: 3, result: "wiped",
        }],
      }),
    ]).combinations["survival@0.7"]!;

    expect(combination.completionRate).toBeCloseTo(2 / 3);
    expect(combination.completedWipeMean).toBe(2.5);
    expect(combination.fivePlusWipeCount).toBe(1);
    expect(combination.fivePlusWipeRate).toBe(0.5);
    expect(combination.meanMaxAdvicePressure).toBeCloseTo(5 / 3);
    expect(combination.meanBossEntryHpRatio).toBeCloseTo(0.5);
    expect(combination.bossByThemeRisk).toEqual({
      "1/spider": { entries: 2, clears: 1, wipes: 1, meanEntryHpRatio: 0.5 },
    });
  });

  it("완주가 없으면 완료 전멸 관련 분모를 null로 보존한다", () => {
    const combination = aggregateRuns([metric({ wipedExpeditions: 5 })]).combinations["survival@0.7"]!;
    expect(combination.completedWipeMean).toBeNull();
    expect(combination.fivePlusWipeRate).toBeNull();
  });

  it("원정 압력 표본이 없으면 0으로 위장하지 않고 집계 오류를 낸다", () => {
    expect(() => aggregateRuns([metric({ balanceExpeditions: [] })])).toThrow("원정 밸런스 지표가 없다");
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])("유한하지 않은 초기 위험도 %p는 보스 병목 키로 만들지 않고 집계 오류를 낸다", (initialRiskLevel) => {
    expect(() => aggregateRuns([metric({
      balanceExpeditions: [{
        expeditionId: "invalid-risk", dungeonId: "dungeon-invalid-risk" as never, theme: "spider", initialRiskLevel: initialRiskLevel as never,
        startAdvicePressure: 0, maxAdvicePressure: 0, bossEntry: { advicePressure: 0, aliveCount: 3, hp: 30, maxHp: 60 }, endAdvicePressure: 0, result: "cleared",
      }],
    })])).toThrow("유효하지 않은 초기 위험도");
  });
});
