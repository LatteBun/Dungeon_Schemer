import { describe, expect, it } from "vitest";
import type { RiskLevel } from "@/lib/domain";
import { B1_RISK_CURVE_V2_TARGETS, evaluateB1BAcceptance } from "./acceptance";
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
    remainingDungeonsByRisk: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    nodeCategoryChoices: { rest: 0, merchant: 0, special: 0, monster: 0, boss: 0 },
    intendedAdviceCounts: { help: 0, harm: 0, neutral: 0 }, selectedAdviceCounts: { help: 0, harm: 0, neutral: 0 }, reactionCounts: { accepted: 0, suspected: 0, exposed: 0 },
    betrayalAttempts: 0, betrayalWipes: 0, betrayalCompletions: 0, merchantGoldSpent: 0, merchantEffectsConsumed: 0,
    adviceHits: 0, adviceTotal: 0, errorKind: null,
    termination: completed ? "completed" : "pool-exhausted",
    terminationEvidence: null,
    depletion: [],
    balanceExpeditions: [{
      expeditionId: seed, dungeonId: `dungeon-${seed}` as never, theme: "spider", initialRiskLevel: 1, currentRiskLevel: 1, attemptNumber: 1,
      startAdvicePressure: 0, maxAdvicePressure: 0, bossEntry: { advicePressure: 0, aliveCount: 3, hp: 100, maxHp: 100 }, endAdvicePressure: 0, result: "cleared",
    }],
  } as CampaignRunMetrics;
}

function aggregateAtExactBandEdges(edge: "lower" | "upper" = "lower") {
  const combinations: readonly [StrategyId, Accuracy, number, number | null][] = edge === "lower" ? [
    ["survival", 0.7, 12, 2], ["survival", 0.4, 6, 3],
    ["opportunist", 0.7, 8, null], ["opportunist", 0.4, 4, null],
    ["selective-betrayal", 0.7, 4, 3], ["selective-betrayal", 0.4, 1, 3],
  ] : [
    ["survival", 0.7, 16, 3], ["survival", 0.4, 8, 4],
    ["opportunist", 0.7, 12, null], ["opportunist", 0.4, 6, null],
    ["selective-betrayal", 0.7, 8, 4], ["selective-betrayal", 0.4, 3, 4],
  ];
  const runs = combinations.flatMap(([strategyId, accuracy, completedCount, completedWipes]) =>
    Array.from({ length: 20 }, (_, index) => metric(strategyId, accuracy, index < completedCount, index < completedCount ? completedWipes ?? 0 : 0, `${strategyId}-${accuracy}-${index}`)),
  );
  return aggregateRuns(runs);
}

const RISK_LEVELS = [1, 2, 3, 4, 5] as const satisfies readonly RiskLevel[];

function aggregateAtRiskRates(
  rates: readonly [number, number, number, number, number],
  samplesPerRisk: number | Readonly<Record<RiskLevel, number>> = 100,
) {
  const sampleCount = (risk: RiskLevel) => typeof samplesPerRisk === "number" ? samplesPerRisk : samplesPerRisk[risk];
  const runCount = Math.max(...RISK_LEVELS.map(sampleCount));
  const opportunistRuns = Array.from({ length: runCount }, (_, index) => {
    const balanceExpeditions: CampaignRunMetrics["balanceExpeditions"] = RISK_LEVELS.flatMap((risk, riskIndex) => {
      const samples = sampleCount(risk);
      if (index >= samples) return [];
      const cleared = index < Math.round(rates[riskIndex]! * samples);
      return [{
        expeditionId: `risk-${risk}-${index}`,
        dungeonId: `dungeon-risk-${risk}-${index}` as never,
        theme: "spider" as const,
        initialRiskLevel: risk,
        currentRiskLevel: risk,
        attemptNumber: 1,
        startAdvicePressure: 0,
        maxAdvicePressure: 0,
        bossEntry: { advicePressure: 0, aliveCount: 3, hp: 100, maxHp: 100 },
        endAdvicePressure: 0,
        result: cleared ? "cleared" as const : "wiped" as const,
      }];
    });
    return {
      ...metric("opportunist", 0.7, index < Math.round(runCount * 0.4), 0, `opportunist-risk-${index}`),
      balanceExpeditions,
    };
  });
  const legacyRuns = aggregateAtExactBandEdges().runs.filter((run) => !(run.strategyId === "opportunist" && run.accuracy === 0.7));
  return aggregateRuns([...legacyRuns, ...opportunistRuns]);
}

function isRiskGate(gate: { id: string }): boolean {
  return gate.id.startsWith("first-attempt-clear-rate:");
}

describe("B1-B 승인 gate", () => {
  it("완주율과 완료 전멸 평균의 하한 경계를 통과시킨다", () => {
    const gates = evaluateB1BAcceptance(aggregateAtExactBandEdges("lower"));
    const legacyGates = gates.filter((gate) => gate.id.startsWith("completion-rate:") || gate.id.startsWith("completed-wipe-mean:"));
    expect(legacyGates.every((gate) => gate.passed)).toBe(true);
  });

  it("여섯 완주율과 완료 전멸 평균의 상한 경계를 통과시킨다", () => {
    const gates = evaluateB1BAcceptance(aggregateAtExactBandEdges("upper"));
    const legacyGates = gates.filter((gate) => gate.id.startsWith("completion-rate:") || gate.id.startsWith("completed-wipe-mean:"));
    expect(legacyGates.every((gate) => gate.passed)).toBe(true);
  });

  it("필수 조합 표본이 없으면 집계 오류를 낸다", () => {
    const aggregate = aggregateRuns([metric("survival", 0.7, true, 2, "only")]);
    expect(() => evaluateB1BAcceptance(aggregate)).toThrow("B1-B 조합 표본이 없다");
  });

  it("완주가 없으면 완료 전멸 gate를 실패시킨다", () => {
    const aggregate = aggregateAtExactBandEdges();
    const withoutCompletion = aggregateRuns(aggregate.runs.map((run) =>
      run.strategyId === "survival" && run.accuracy === 0.7 ? { ...run, completed: false, ending: "exhausted" as const, termination: "pool-exhausted" as const } : run,
    ));
    expect(evaluateB1BAcceptance(withoutCompletion).find((gate) => gate.id === "completed-wipe-mean:survival@0.7")).toMatchObject({ passed: false });
  });

  it("위험도별 첫 시도 클리어율 목표의 하한과 상한을 통과시킨다", () => {
    expect(B1_RISK_CURVE_V2_TARGETS).toEqual({
      1: [0.85, 0.90],
      2: [0.78, 0.85],
      3: [0.70, 0.78],
      4: [0.62, 0.70],
      5: [0.55, 0.65],
    });

    for (const rates of [[0.85, 0.78, 0.70, 0.62, 0.55], [0.90, 0.85, 0.78, 0.70, 0.65]] as const) {
      const gates = evaluateB1BAcceptance(aggregateAtRiskRates(rates), { mode: "calibration", seedsPerCombination: 200, focus: "risk-curve" });
      expect(gates.filter(isRiskGate).every((gate) => gate.enforced && gate.passed)).toBe(true);
    }
  });

  it("목표 밖 값과 위험도 역전을 실패시킨다", () => {
    const outside = evaluateB1BAcceptance(aggregateAtRiskRates([0.84, 0.78, 0.70, 0.62, 0.55]), { mode: "calibration", seedsPerCombination: 200, focus: "risk-curve" });
    expect(outside.find((gate) => gate.id.endsWith("risk-1"))).toMatchObject({ enforced: true, passed: false });

    const inverted = evaluateB1BAcceptance(aggregateAtRiskRates([0.85, 0.86, 0.70, 0.62, 0.55]), { mode: "calibration", seedsPerCombination: 200, focus: "risk-curve" });
    expect(inverted.find((gate) => gate.id.endsWith("monotonic"))).toMatchObject({ enforced: true, passed: false });
  });

  it("기본값과 50, 100시드 calibration에서는 위험도 gate를 관찰로 남긴다", () => {
    const aggregate = aggregateAtRiskRates([0.84, 0.78, 0.70, 0.62, 0.55]);
    for (const context of [undefined, { mode: "calibration", seedsPerCombination: 50 }, { mode: "calibration", seedsPerCombination: 100 }] as const) {
      const gates = context === undefined ? evaluateB1BAcceptance(aggregate) : evaluateB1BAcceptance(aggregate, { ...context, focus: "risk-curve" });
      expect(gates.filter(isRiskGate).every((gate) => gate.enforced === false)).toBe(true);
      expect(gates.find((gate) => gate.id.endsWith("risk-1"))).toMatchObject({ passed: false });
    }
  });

  it("최종 calibration은 위험도별 최소 30개 표본을 요구한다", () => {
    const aggregate = aggregateAtRiskRates([0.85, 0.78, 0.70, 0.62, 0.55], { 1: 100, 2: 100, 3: 100, 4: 100, 5: 29 });
    const gate = evaluateB1BAcceptance(aggregate, { mode: "calibration", seedsPerCombination: 200, focus: "risk-curve" }).find((candidate) => candidate.id.endsWith("risk-5"));
    expect(gate).toMatchObject({
      enforced: true,
      passed: false,
      evidence: expect.stringContaining("표본 29/최소 30"),
    });
  });

  it("holdout은 위험도별 최소 300개 표본을 요구한다", () => {
    const targetRates = [0.85, 0.78, 0.70, 0.62, 0.55] as const;
    const withinBandsAt299 = [255 / 299, 235 / 299, 215 / 299, 190 / 299, 165 / 299] as const;
    const aggregateAt299 = aggregateAtRiskRates(withinBandsAt299, 299);
    const observedAt299 = RISK_LEVELS.map((risk) => aggregateAt299.combinations["opportunist@0.7"]!.firstAttemptByInitialRisk[risk].clearRate);
    expect(observedAt299).toEqual(withinBandsAt299);
    for (const risk of RISK_LEVELS) {
      const rate = aggregateAt299.combinations["opportunist@0.7"]!.firstAttemptByInitialRisk[risk].clearRate;
      const [minimum, maximum] = B1_RISK_CURVE_V2_TARGETS[risk];
      expect(rate).toBeGreaterThan(minimum);
      expect(rate).toBeLessThan(maximum);
    }

    const insufficient = evaluateB1BAcceptance(aggregateAt299, { mode: "holdout", seedsPerCombination: 2000, focus: "full-campaign" });
    expect(insufficient.find((gate) => gate.id.endsWith("risk-1"))).toMatchObject({
      enforced: true,
      passed: false,
      evidence: expect.stringContaining("표본 299/최소 300"),
    });

    const sufficient = evaluateB1BAcceptance(aggregateAtRiskRates(targetRates, 300), { mode: "holdout", seedsPerCombination: 2000, focus: "full-campaign" });
    expect(sufficient.filter(isRiskGate).every((gate) => gate.enforced && gate.passed)).toBe(true);
  });

  it("risk-curve 200에서는 캠페인 gate를 관찰로 남기고 full-campaign에서는 강제한다", () => {
    const aggregate = aggregateAtRiskRates([0.85, 0.78, 0.70, 0.62, 0.55]);
    const riskCurve = evaluateB1BAcceptance(aggregate, { mode: "calibration", seedsPerCombination: 200, focus: "risk-curve" });
    const fullCampaign = evaluateB1BAcceptance(aggregate, { mode: "calibration", seedsPerCombination: 200, focus: "full-campaign" });
    expect(riskCurve.filter((gate) => gate.id.startsWith("completion-rate:")).every((gate) => !gate.enforced)).toBe(true);
    expect(fullCampaign.filter((gate) => gate.id.startsWith("completion-rate:")).every((gate) => gate.enforced)).toBe(true);
  });

  it("보스 이전 실패 우세 또는 평균 진입 HP 0.70 미만이면 축 guard를 실패시킨다", () => {
    const aggregate = aggregateAtRiskRates([0.85, 0.78, 0.70, 0.62, 0.55]);
    const opportunist = aggregate.combinations["opportunist@0.7"]!;
    const riskOne = opportunist.firstAttemptByInitialRisk[1];
    const guardFailure = evaluateB1BAcceptance({
      ...aggregate,
      combinations: {
        ...aggregate.combinations,
        "opportunist@0.7": {
          ...opportunist,
          firstAttemptByInitialRisk: {
            ...opportunist.firstAttemptByInitialRisk,
            1: { ...riskOne, preBossFailures: 11, bossFailures: 10, meanBossEntryHpRatio: 0.80 },
          },
        },
      },
    }, { mode: "calibration", seedsPerCombination: 200, focus: "risk-curve" });
    expect(guardFailure.find((gate) => gate.id === "boss-axis-guard:opportunist@0.7:risk-1")).toMatchObject({ passed: false, enforced: true });

    const hpFailure = evaluateB1BAcceptance({
      ...aggregate,
      combinations: {
        ...aggregate.combinations,
        "opportunist@0.7": {
          ...opportunist,
          firstAttemptByInitialRisk: {
            ...opportunist.firstAttemptByInitialRisk,
            2: { ...opportunist.firstAttemptByInitialRisk[2], meanBossEntryHpRatio: 0.6999 },
          },
        },
      },
    }, { mode: "calibration", seedsPerCombination: 200, focus: "risk-curve" });
    expect(hpFailure.find((gate) => gate.id === "boss-axis-guard:opportunist@0.7:risk-2")).toMatchObject({ passed: false, enforced: true });
  });
});
