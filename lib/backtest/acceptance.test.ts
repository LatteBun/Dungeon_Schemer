import { describe, expect, it } from "vitest";
import { evaluateB1BAcceptance } from "./acceptance";
import { aggregateRuns, type CampaignRunMetrics } from "./metrics";
import type { Accuracy, StrategyId } from "./public-state";

function metric(strategyId: StrategyId, accuracy: Accuracy, completed: boolean, wipedExpeditions: number, seed: string): CampaignRunMetrics {
  return {
    seed, strategyId, accuracy, ending: completed ? "completed" : "exhausted", completed, finalRank: "C", reachedRankS: false,
    totalExpeditions: 0, clearedExpeditions: 0, wipedExpeditions, totalDeaths: 0,
    aliveCount: 0, deployableCount: 0, zeroTrustCount: 0, gravelyWoundedCount: 0,
    finalReputation: 0, finalGold: 0, contractGold: 0, relicGold: 0, cumulativeGold: 0,
    meanTrust: 0, medianTrust: 0, meanHpRatio: 0, medianHpRatio: 0,
    reputationPromotions: 0, goldPromotions: 0, firstRankAtExpedition: {},
    nodeCategoryChoices: { rest: 0, merchant: 0, special: 0, monster: 0, boss: 0 },
    intendedAdviceCounts: { help: 0, harm: 0, neutral: 0 }, selectedAdviceCounts: { help: 0, harm: 0, neutral: 0 }, reactionCounts: { accepted: 0, suspected: 0, exposed: 0 },
    betrayalAttempts: 0, betrayalWipes: 0, betrayalCompletions: 0, merchantGoldSpent: 0, merchantEffectsConsumed: 0,
    adviceHits: 0, adviceTotal: 0, errorKind: null,
    balanceExpeditions: [{
      expeditionId: seed, dungeonId: `dungeon-${seed}` as never, theme: "spider", initialRiskLevel: 1,
      startAdvicePressure: 0, maxAdvicePressure: 0, bossEntry: null, endAdvicePressure: 0, result: "cleared",
    }],
  } as CampaignRunMetrics;
}

function aggregateAtExactBandEdges() {
  const combinations: readonly [StrategyId, Accuracy, number, number | null][] = [
    ["survival", 0.7, 12, 2], ["survival", 0.4, 6, 3],
    ["opportunist", 0.7, 8, null], ["opportunist", 0.4, 4, null],
    ["selective-betrayal", 0.7, 4, 3], ["selective-betrayal", 0.4, 1, 3],
  ];
  const runs = combinations.flatMap(([strategyId, accuracy, completedCount, completedWipes]) =>
    Array.from({ length: 20 }, (_, index) => metric(strategyId, accuracy, index < completedCount, index < completedCount ? completedWipes ?? 0 : 0, `${strategyId}-${accuracy}-${index}`)),
  );
  return aggregateRuns(runs);
}

describe("B1-B 승인 gate", () => {
  it("완주율과 완료 전멸 평균의 양 끝 경계를 통과시킨다", () => {
    const gates = evaluateB1BAcceptance(aggregateAtExactBandEdges());
    expect(gates.every((gate) => gate.passed)).toBe(true);
  });

  it("필수 조합 표본이 없으면 집계 오류를 낸다", () => {
    const aggregate = aggregateRuns([metric("survival", 0.7, true, 2, "only")]);
    expect(() => evaluateB1BAcceptance(aggregate)).toThrow("B1-B 조합 표본이 없다");
  });

  it("완주가 없으면 완료 전멸 gate를 실패시킨다", () => {
    const aggregate = aggregateAtExactBandEdges();
    const withoutCompletion = aggregateRuns(aggregate.runs.map((run) =>
      run.strategyId === "survival" && run.accuracy === 0.7 ? { ...run, completed: false, ending: "exhausted" as const } : run,
    ));
    expect(evaluateB1BAcceptance(withoutCompletion).find((gate) => gate.id === "completed-wipe-mean:survival@0.7")).toMatchObject({ passed: false });
  });
});
