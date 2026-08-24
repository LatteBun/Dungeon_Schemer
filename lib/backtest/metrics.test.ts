import { describe, expect, it } from "vitest";
import { runCampaign } from "./campaign-driver";
import { createStrategy } from "./strategies";
import { aggregateRuns, metricsForRun, pairedMeanDifference, wilsonInterval, type CampaignRunMetrics } from "./metrics";

function metric({
  balanceExpeditions: balanceOverrides,
  depletion: depletionOverrides,
  ending: endingOverride,
  termination: terminationOverride,
  totalDeaths: totalDeathsOverride,
  zeroTrustCount: zeroTrustCountOverride,
  gravelyWoundedCount: gravelyWoundedCountOverride,
  ...overrides
}: Partial<CampaignRunMetrics> = {}): CampaignRunMetrics {
  const balanceExpeditions = balanceOverrides ?? [{
    expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, theme: "spider", initialRiskLevel: 1, currentRiskLevel: 1, attemptNumber: 1,
    startAdvicePressure: 0, maxAdvicePressure: 0, bossEntry: null, endAdvicePressure: 0, result: "wiped",
  }];
  const locator = balanceExpeditions[0];
  const depletion = depletionOverrides ?? (locator === undefined ? [] : [
    { source: "expedition-general", worldTurn: 1, expeditionId: locator.expeditionId, dungeonId: locator.dungeonId, initialRiskLevel: locator.initialRiskLevel, attemptNumber: locator.attemptNumber, hpLost: 30, hpRecovered: 0, deaths: 2, seriousInjuriesStarted: 1, seriousInjuriesCleared: 0, trustZeroed: 1 },
    { source: "expedition-boss", worldTurn: 1, expeditionId: locator.expeditionId, dungeonId: locator.dungeonId, initialRiskLevel: locator.initialRiskLevel, attemptNumber: locator.attemptNumber, hpLost: 70, hpRecovered: 0, deaths: 4, seriousInjuriesStarted: 2, seriousInjuriesCleared: 0, trustZeroed: 2 },
    { source: "world-turn-background", worldTurn: 2, expeditionId: null, dungeonId: null, initialRiskLevel: null, attemptNumber: null, hpLost: 10, hpRecovered: 0, deaths: 0, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0, trustZeroed: 0 },
    { source: "world-turn-rest", worldTurn: 2, expeditionId: null, dungeonId: null, initialRiskLevel: null, attemptNumber: null, hpLost: 0, hpRecovered: 20, deaths: 0, seriousInjuriesStarted: 0, seriousInjuriesCleared: 1, trustZeroed: 0 },
  ]);
  const ending = endingOverride ?? "exhausted";
  const termination = terminationOverride ?? ({
    completed: "completed",
    exhausted: "pool-exhausted",
    unemployed: "no-eligible-party",
    distrust: "distrust",
    denounced: "denounced",
    "run-error": "run-error",
  } as const)[ending];
  const totalDeaths = totalDeathsOverride ?? depletion.reduce((sum, entry) => sum + entry.deaths, 0);
  const zeroTrustCount = zeroTrustCountOverride ?? depletion.reduce((sum, entry) => sum + entry.trustZeroed, 0);
  const gravelyWoundedCount = gravelyWoundedCountOverride ?? depletion.reduce((sum, entry) => sum + entry.seriousInjuriesStarted - entry.seriousInjuriesCleared, 0);
  return {
    seed: "fixture", strategyId: "survival", accuracy: 0.7,
    ending, completed: false, finalRank: "C", reachedRankS: false,
    totalExpeditions: 0, clearedExpeditions: 0, wipedExpeditions: 0, totalDeaths,
    aliveCount: 0, deployableCount: 0, zeroTrustCount, gravelyWoundedCount,
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
    termination,
    balanceExpeditions,
    depletion,
    ...overrides,
  } as CampaignRunMetrics;
}

function expedition(overrides: Partial<CampaignRunMetrics["balanceExpeditions"][number]> = {}): CampaignRunMetrics["balanceExpeditions"][number] {
  return {
    expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, theme: "spider", initialRiskLevel: 2, currentRiskLevel: 2, attemptNumber: 1,
    startAdvicePressure: 0, maxAdvicePressure: 0, bossEntry: null, endAdvicePressure: 0, result: "wiped",
    ...overrides,
  } as CampaignRunMetrics["balanceExpeditions"][number];
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
    expect(metrics.depletion).toEqual(run.trace.depletion);
    expect(metrics.termination).toBeDefined();
  });

  it("성공 실행에 campaign 또는 trace 종료 사유가 없으면 metrics 변환을 거절한다", () => {
    const run = runCampaign({ seed: "metrics-missing-termination", strategy: createStrategy("survival"), accuracy: 0.7 });
    if (!run.ok) throw new Error(`${run.errorKind}: ${run.message}`);
    const missingCampaignEnding = { ...run, campaign: { ...run.campaign, ending: null } };
    const missingTraceTermination = { ...run, trace: { ...run.trace } } as unknown as { trace: { termination?: unknown } };
    delete missingTraceTermination.trace.termination;

    expect(() => metricsForRun(missingCampaignEnding)).toThrow("성공 실행에 종료 사유가 없다");
    expect(() => metricsForRun(missingTraceTermination as typeof run)).toThrow("손실 trace에 종료 사유가 없다");
  });

  it("run-error의 이미 확정된 손실 trace와 종료 사유를 보존한다", () => {
    const run = runCampaign({ seed: "metrics-run-error", strategy: createStrategy("survival"), accuracy: 0.7, stepLimit: 30 });
    if (run.ok) throw new Error("step limit fixture가 실행 오류를 만들지 않았다");

    const metrics = metricsForRun(run);
    const aggregate = aggregateRuns([metrics]).combinations["survival@0.7"]!;
    expect(metrics.depletion).toEqual(run.trace.depletion);
    expect(metrics.termination).toBe("run-error");
    expect(aggregate.terminationCounts["run-error"]).toBe(1);
  });

  it("손실 원장을 source별로 손계산 집계하고 사망 60% 우세 원인을 판정한다", () => {
    const aggregate = aggregateRuns([metric({
      strategyId: "opportunist", totalDeaths: 6,
    })]);
    const combination = aggregate.combinations["opportunist@0.7"]!;

    expect(combination.depletionBySource["expedition-general"]).toMatchObject({ hpLost: 30, deaths: 2 });
    expect(combination.depletionBySource["expedition-boss"]).toMatchObject({ hpLost: 70, deaths: 4 });
    expect(combination.depletionBySource["world-turn-background"]).toMatchObject({ hpLost: 10, deaths: 0 });
    expect(combination.depletionBySource["world-turn-rest"]).toMatchObject({ hpRecovered: 20, deaths: 0 });
    expect(combination.depletionVerdict).toMatchObject({ kind: "dominant", source: "expedition-boss" });
  });

  it("사망 비중이 정확히 60%이면 dominant로 판정한다", () => {
    const aggregate = aggregateRuns([metric({
      depletion: [
        { source: "expedition-general", worldTurn: 1, expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, initialRiskLevel: 1, attemptNumber: 1, hpLost: 10, hpRecovered: 0, deaths: 3, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0, trustZeroed: 0 },
        { source: "expedition-boss", worldTurn: 1, expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, initialRiskLevel: 1, attemptNumber: 1, hpLost: 10, hpRecovered: 0, deaths: 2, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0, trustZeroed: 0 },
      ],
    })]);

    expect(aggregate.combinations["survival@0.7"]!.depletionVerdict).toMatchObject({ kind: "dominant", source: "expedition-general" });
  });

  it("사망이 0이면 HP 손실 60%로 dominant를 판정하고 59%는 mixed로 남긴다", () => {
    const dominant = aggregateRuns([metric({
      depletion: [
        { source: "expedition-general", worldTurn: 1, expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, initialRiskLevel: 1, attemptNumber: 1, hpLost: 60, hpRecovered: 0, deaths: 0, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0, trustZeroed: 0 },
        { source: "expedition-boss", worldTurn: 1, expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, initialRiskLevel: 1, attemptNumber: 1, hpLost: 40, hpRecovered: 0, deaths: 0, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0, trustZeroed: 0 },
      ],
    })]).combinations["survival@0.7"]!;
    const mixed = aggregateRuns([metric({
      depletion: [
        { source: "expedition-general", worldTurn: 1, expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, initialRiskLevel: 1, attemptNumber: 1, hpLost: 59, hpRecovered: 0, deaths: 0, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0, trustZeroed: 0 },
        { source: "expedition-boss", worldTurn: 1, expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, initialRiskLevel: 1, attemptNumber: 1, hpLost: 41, hpRecovered: 0, deaths: 0, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0, trustZeroed: 0 },
      ],
    })]).combinations["survival@0.7"]!;

    expect(dominant.depletionVerdict).toMatchObject({ kind: "dominant", source: "expedition-general" });
    expect(mixed.depletionVerdict).toMatchObject({ kind: "mixed" });
  });

  it("사망 0 HP 손실 우세는 종료 최다 원인이 충돌하면 mixed로 남긴다", () => {
    const aggregate = aggregateRuns([metric({
      ending: "completed",
      depletion: [
        { source: "expedition-general", worldTurn: 1, expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, initialRiskLevel: 1, attemptNumber: 1, hpLost: 60, hpRecovered: 0, deaths: 0, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0, trustZeroed: 0 },
        { source: "expedition-boss", worldTurn: 1, expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, initialRiskLevel: 1, attemptNumber: 1, hpLost: 40, hpRecovered: 0, deaths: 0, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0, trustZeroed: 0 },
      ],
    })]).combinations["survival@0.7"]!;

    expect(aggregate.depletionVerdict).toMatchObject({ kind: "mixed" });
  });

  it("사망 0 HP 손실 우세는 종료 최다 원인이 동률이면 mixed로 남긴다", () => {
    const depletion: CampaignRunMetrics["depletion"] = [
      { source: "expedition-general", worldTurn: 1, expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, initialRiskLevel: 1, attemptNumber: 1, hpLost: 60, hpRecovered: 0, deaths: 0, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0, trustZeroed: 0 },
      { source: "expedition-boss", worldTurn: 1, expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, initialRiskLevel: 1, attemptNumber: 1, hpLost: 40, hpRecovered: 0, deaths: 0, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0, trustZeroed: 0 },
    ];
    const aggregate = aggregateRuns([
      metric({ depletion, ending: "exhausted" }),
      metric({ depletion, ending: "unemployed" }),
    ]).combinations["survival@0.7"]!;

    expect(aggregate.depletionVerdict).toMatchObject({ kind: "mixed" });
  });

  it.each([
    ["사망", { totalDeaths: 5 }],
    ["신뢰 0", { zeroTrustCount: 2 }],
    ["중상", { gravelyWoundedCount: 1 }],
  ])("손실 원장과 최종 풀 %s 수치가 모순되면 집계 오류를 낸다", (_, overrides) => {
    expect(() => aggregateRuns([metric(overrides)])).toThrow("손실 원장과 최종 풀 상태가 모순된다");
  });

  it("손실 원장 또는 명시 종료 사유가 없으면 집계 오류를 낸다", () => {
    const missingDepletion: { depletion?: unknown } = { ...metric() };
    const missingTermination: { termination?: unknown } = { ...metric() };
    delete missingDepletion.depletion;
    delete missingTermination.termination;

    expect(() => aggregateRuns([missingDepletion as unknown as CampaignRunMetrics])).toThrow("손실 원장이 없다");
    expect(() => aggregateRuns([missingTermination as unknown as CampaignRunMetrics])).toThrow("종료 사유가 없다");
  });

  it("월드턴 백그라운드 손실의 사망을 거절한다", () => {
    expect(() => aggregateRuns([metric({
      depletion: [{ source: "world-turn-background", worldTurn: 1, expeditionId: null, dungeonId: null, initialRiskLevel: null, attemptNumber: null, hpLost: 0, hpRecovered: 0, deaths: 1, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0, trustZeroed: 0 }],
    })])).toThrow("월드턴 백그라운드 손실에 사망이 있다");
  });

  it.each([
    ["원정 locator 누락", { expeditionId: null }],
    ["음수 HP", { hpLost: -1 }],
    ["소수 사망", { deaths: 0.5 }],
  ])("잘못된 손실 원장(%s)을 집계 오류로 거절한다", (_, overrides) => {
    expect(() => aggregateRuns([metric({
      depletion: [{ source: "expedition-general", worldTurn: 1, expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, initialRiskLevel: 1, attemptNumber: 1, hpLost: 0, hpRecovered: 0, deaths: 0, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0, trustZeroed: 0, ...overrides }],
    })])).toThrow("유효하지 않은 손실 원장");
  });

  it("원정 손실 locator의 attempt가 balance trace와 다르면 거절한다", () => {
    expect(() => aggregateRuns([metric({
      depletion: [{ source: "expedition-boss", worldTurn: 1, expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, initialRiskLevel: 1, attemptNumber: 2, hpLost: 0, hpRecovered: 0, deaths: 0, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0, trustZeroed: 0 }],
    })])).toThrow("원정 손실 locator가 balance trace와 다르다");
  });

  it("빈 집계는 aggregation error를 낸다", () => {
    expect(() => aggregateRuns([])).toThrow("집계할 실행 결과가 없다");
  });

  it("완주 전멸, 5회 이상 전멸, 압력과 보스 진입 HP를 손계산으로 집계한다", () => {
    const combination = aggregateRuns([
      metric({
        seed: "a", completed: true, ending: "completed", wipedExpeditions: 0,
        balanceExpeditions: [{
          expeditionId: "a", dungeonId: "dungeon-a" as never, theme: "spider", initialRiskLevel: 1, currentRiskLevel: 1, attemptNumber: 1,
          startAdvicePressure: 0, maxAdvicePressure: 0, bossEntry: { advicePressure: 0, aliveCount: 3, hp: 50, maxHp: 100 }, endAdvicePressure: 0, result: "cleared",
        }],
      }),
      metric({
        seed: "b", completed: true, ending: "completed", wipedExpeditions: 5,
        balanceExpeditions: [{
          expeditionId: "b", dungeonId: "dungeon-b" as never, theme: "spider", initialRiskLevel: 1, currentRiskLevel: 1, attemptNumber: 1,
          startAdvicePressure: 0, maxAdvicePressure: 2, bossEntry: { advicePressure: 2, aliveCount: 2, hp: 50, maxHp: 100 }, endAdvicePressure: 2, result: "wiped",
        }],
      }),
      metric({
        seed: "c", wipedExpeditions: 3,
        balanceExpeditions: [{
          expeditionId: "c", dungeonId: "dungeon-c" as never, theme: "desert", initialRiskLevel: 2, currentRiskLevel: 2, attemptNumber: 1,
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

  it("첫 시도, 현재 위험도별 전체 시도, 최종 던전 통과를 분리해 손계산 집계한다", () => {
    const combination = aggregateRuns([metric({
      balanceExpeditions: [
        expedition({
          expeditionId: "retry-first", dungeonId: "dungeon-retry" as never,
          bossEntry: { advicePressure: 0, aliveCount: 2, hp: 50, maxHp: 100 }, result: "wiped",
        }),
        expedition({
          expeditionId: "retry-second", dungeonId: "dungeon-retry" as never, currentRiskLevel: 3, attemptNumber: 2,
          bossEntry: { advicePressure: 0, aliveCount: 3, hp: 75, maxHp: 100 }, result: "cleared",
        }),
        expedition({ expeditionId: "interrupted", dungeonId: "dungeon-interrupted" as never, result: "interrupted" }),
      ],
    })]).combinations["survival@0.7"]!;

    expect(combination.firstAttemptByInitialRisk[2]).toMatchObject({
      starts: 2,
      bossEntries: 1,
      clears: 0,
      wipes: 1,
      interrupted: 1,
      preBossFailures: 1,
      bossFailures: 1,
      clearRate: 0,
      bossReachRate: 0.5,
      bossConversionRate: 0,
      meanBossEntryHpRatio: 0.5,
      meanBossEntryAliveCount: 2,
      clearRateWilson95: wilsonInterval(0, 2),
    });
    expect(combination.firstAttemptByInitialRisk[1]).toMatchObject({ starts: 0, clearRate: null, clearRateWilson95: null });
    expect(combination.allAttemptsByCurrentRisk[3]).toMatchObject({ starts: 1, clears: 1, clearRate: 1 });
    expect(combination.eventualDungeonByInitialRisk[2]).toMatchObject({
      attemptedDungeons: 2,
      clearedDungeons: 1,
      clearRate: 0.5,
      clearRateWilson95: wilsonInterval(1, 2),
    });
    expect(combination.firstAttemptByThemeRisk["spider/2"]).toMatchObject({ starts: 2, wipes: 1, interrupted: 1 });
  });

  it("원정 압력 표본이 없으면 0으로 위장하지 않고 집계 오류를 낸다", () => {
    expect(() => aggregateRuns([metric({ balanceExpeditions: [] })])).toThrow("원정 밸런스 지표가 없다");
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])("유한하지 않은 초기 위험도 %p는 보스 병목 키로 만들지 않고 집계 오류를 낸다", (initialRiskLevel) => {
    expect(() => aggregateRuns([metric({
      balanceExpeditions: [{
        expeditionId: "invalid-risk", dungeonId: "dungeon-invalid-risk" as never, theme: "spider", initialRiskLevel: initialRiskLevel as never, currentRiskLevel: 1, attemptNumber: 1,
        startAdvicePressure: 0, maxAdvicePressure: 0, bossEntry: { advicePressure: 0, aliveCount: 3, hp: 30, maxHp: 60 }, endAdvicePressure: 0, result: "cleared",
      }],
    })])).toThrow("유효하지 않은 초기 위험도");
  });

  it.each([
    ["시도 번호 0", { attemptNumber: 0 }],
    ["위험도 누락", { currentRiskLevel: Number.NaN }],
    ["보스 없이 cleared", { bossEntry: null, result: "cleared" }],
  ])("잘못된 원정 trace(%s)를 집계 오류로 거절한다", (_, overrides) => {
    expect(() => aggregateRuns([metric({
      balanceExpeditions: [expedition(overrides as Partial<CampaignRunMetrics["balanceExpeditions"][number]>)],
    })])).toThrow("유효하지 않은 원정 trace");
  });

  it("같은 run의 던전 시도 번호가 건너뛰면 집계 오류를 낸다", () => {
    expect(() => aggregateRuns([metric({
      balanceExpeditions: [
        expedition({ expeditionId: "first", dungeonId: "dungeon-retry" as never, attemptNumber: 1 }),
        expedition({ expeditionId: "third", dungeonId: "dungeon-retry" as never, attemptNumber: 3 }),
      ],
    })])).toThrow("원정 시도 번호가 이어지지 않는다");
  });
});
