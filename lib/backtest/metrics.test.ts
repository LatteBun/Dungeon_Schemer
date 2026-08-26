import { describe, expect, it } from "vitest";
import { runCampaign } from "./campaign-driver";
import { createStrategy } from "./strategies";
import { aggregateHealingMetrics, aggregateRuns, metricsForRun, pairedMeanDifference, wilsonInterval, type CampaignRunMetrics } from "./metrics";

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
    remainingDungeonsByRisk: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    nodeCategoryChoices: { rest: 0, merchant: 0, special: 0, monster: 0, boss: 0 },
    intendedAdviceCounts: { help: 0, harm: 0, neutral: 0 },
    selectedAdviceCounts: { help: 0, harm: 0, neutral: 0 },
    reactionCounts: { accepted: 0, suspected: 0, exposed: 0 },
    betrayalAttempts: 0, betrayalWipes: 0, betrayalCompletions: 0,
    merchantGoldSpent: 0, merchantEffectsConsumed: 0, adviceHits: 0, adviceTotal: 0,
    errorKind: null,
    termination,
    terminationEvidence: null,
    balanceExpeditions,
    depletion,
    ...overrides,
  } as CampaignRunMetrics;
}

describe("진행 진단 지표", () => {
  it("종료 시 미클리어 던전을 현재 위험도별로 센다", () => {
    const run = runCampaign({
      seed: "metrics-remaining-risk",
      strategy: createStrategy("survival"),
      accuracy: 0.7,
    });
    const metrics = metricsForRun(run);
    const remaining = Object.values(metrics.remainingDungeonsByRisk)
      .reduce((sum, count) => sum + count, 0);

    if (run.ok) {
      expect(remaining).toBe(run.campaign.dungeons.filter((dungeon) => dungeon.status !== "cleared").length);
      for (const risk of [1, 2, 3, 4, 5] as const) {
        expect(metrics.remainingDungeonsByRisk[risk]).toBe(
          run.campaign.dungeons.filter((dungeon) => dungeon.status !== "cleared" && dungeon.riskLevel === risk).length,
        );
      }
    }
  });
});

function withTerminationEvidence(
  run: CampaignRunMetrics,
  evidence: {
    readonly sourceLosses: readonly {
      readonly source: "expedition-general" | "expedition-boss" | "world-turn-background";
      readonly hpLost: number;
      readonly deaths: number;
      readonly seriousInjuriesStarted: number;
      readonly trustZeroed: number;
    }[];
    readonly wipeSource: "expedition-general" | "expedition-boss" | null;
  },
): CampaignRunMetrics {
  return {
    ...run,
    aliveCount: 3,
    deployableCount: 2,
    zeroTrustCount: 1,
    gravelyWoundedCount: 0,
    terminationEvidence: {
      ...evidence,
      precedingPool: {
        aliveCount: 3,
        deployableCount: 3,
        normalEligibleClassCount: 3,
        emergencyEligibleClassCount: 3,
        zeroTrustCount: 0,
        gravelyWoundedCount: 0,
        totalHp: 100,
      },
      resultingPool: {
        aliveCount: 3,
        deployableCount: 2,
        normalEligibleClassCount: 2,
        emergencyEligibleClassCount: 2,
        zeroTrustCount: 1,
        gravelyWoundedCount: 0,
        totalHp: 40,
      },
      finalPool: {
        aliveCount: 3,
        deployableCount: 2,
        normalEligibleClassCount: 2,
        emergencyEligibleClassCount: 2,
        zeroTrustCount: 1,
        gravelyWoundedCount: 0,
        totalHp: 40,
      },
    },
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
  it("확정 heal action만 치유 사용·회복으로 세고 attack과 클래스 미확정 원정은 분모에서 뺀다", () => {
    const run = metric({
      balanceExpeditions: [
        expedition({ expeditionId: "cleric", party: [{ characterId: "c" as never, classId: "cleric" as never }] }),
        expedition({ expeditionId: "no-cleric", party: [{ characterId: "w" as never, classId: "warrior" as never }] }),
        expedition({ expeditionId: "unknown", party: undefined }),
      ],
      battles: [{
        kind: "general", expeditionId: "cleric",
        party: [{ characterId: "c" as never, classId: "cleric" as never, hpBefore: 10, hpAfter: 15, maxHp: 28, abilityUsesRemainingBefore: 2, abilityUsesRemainingAfter: 1 }],
        battle: {
          status: "victory", termination: "defeatedEnemies", rounds: 1,
          actions: [
            { kind: "heal", round: 1, actorSide: "party", actorId: "c", targetId: "c", abilityKind: "emergencyHeal", healing: 5, targetHpBefore: 10, targetHpAfter: 15 },
            { kind: "heal", round: 2, actorSide: "party", actorId: "c", targetId: "c", abilityKind: "emergencyHeal", healing: 5, targetHpBefore: 15, targetHpAfter: 20 },
            { kind: "attack", round: 1, actorSide: "party", actorId: "c", targetId: "e", damage: 999, defeated: true, targetHpBefore: 10, targetHpAfter: 0 },
          ], party: [], enemies: [],
        },
      }],
    });

    expect(aggregateHealingMetrics([run])).toMatchObject({
      expeditions: { withCleric: 1, withoutCleric: 1, unknownComposition: 1 },
      clericBattles: { general: 1, boss: 0 },
      healUsesPerExpedition: { 0: 0, 1: 0, 2: 1, overLimit: 0 },
      healUsesPerBattle: { 0: 0, 1: 0, 2: 1, overLimit: 0 },
      healActions: 2,
      effectiveHealActions: 2,
      actualHealing: 10,
      byCleric: {
        withCleric: { expeditions: 1, firstAttemptStarts: 1, firstAttemptClears: 0, totalDeaths: 0 },
        withoutCleric: { expeditions: 1, firstAttemptStarts: 1, firstAttemptClears: 0, totalDeaths: 0 },
      },
    });
  });

  it("회피 전투는 전투 분모를 만들지 않고 0 회복은 유효 회복 평균의 분모가 아니다", () => {
    const run = metric({
      balanceExpeditions: [expedition({ expeditionId: "evaded", party: [{ characterId: "c" as never, classId: "cleric" as never }] })],
      battles: [],
    });
    const zeroHeal = metric({
      seed: "zero-heal",
      balanceExpeditions: [expedition({ expeditionId: "zero", party: [{ characterId: "c" as never, classId: "cleric" as never }] })],
      battles: [{
        kind: "boss", expeditionId: "zero",
        party: [{ characterId: "c" as never, classId: "cleric" as never, hpBefore: 10, hpAfter: 10, maxHp: 28, abilityUsesRemainingBefore: 2, abilityUsesRemainingAfter: 1 }],
        battle: { status: "victory", termination: "defeatedEnemies", rounds: 1, actions: [{ kind: "heal", round: 1, actorSide: "party", actorId: "c", targetId: "c", abilityKind: "emergencyHeal", healing: 0, targetHpBefore: 10, targetHpAfter: 10 }], party: [], enemies: [] },
      }],
    });

    expect(aggregateHealingMetrics([run, zeroHeal])).toMatchObject({
      clericBattles: { general: 0, boss: 1 }, healActions: 1, effectiveHealActions: 0,
      actualHealing: 0, meanHealingPerEffectiveHeal: null,
    });
  });

  it("같은 성직자가 한 전투에 세 번 치유하면 0·1·2회 bucket은 보존하고 초과 bucket에 센다", () => {
    const run = metric({
      balanceExpeditions: [expedition({ expeditionId: "three-heals", party: [{ characterId: "c" as never, classId: "cleric" as never }] })],
      battles: [{
        kind: "general", expeditionId: "three-heals",
        party: [{ characterId: "c" as never, classId: "cleric" as never, hpBefore: 1, hpAfter: 16, maxHp: 28, abilityUsesRemainingBefore: 2, abilityUsesRemainingAfter: 0 }],
        battle: {
          status: "victory", termination: "defeatedEnemies", rounds: 3,
          actions: [
            { kind: "heal", round: 1, actorSide: "party", actorId: "c", targetId: "c", abilityKind: "emergencyHeal", healing: 5, targetHpBefore: 1, targetHpAfter: 6 },
            { kind: "heal", round: 2, actorSide: "party", actorId: "c", targetId: "c", abilityKind: "emergencyHeal", healing: 5, targetHpBefore: 6, targetHpAfter: 11 },
            { kind: "heal", round: 3, actorSide: "party", actorId: "c", targetId: "c", abilityKind: "emergencyHeal", healing: 5, targetHpBefore: 11, targetHpAfter: 16 },
          ], party: [], enemies: [],
        },
      }],
    });

    expect(aggregateHealingMetrics([run]).healUsesPerBattle).toEqual({ 0: 0, 1: 0, 2: 0, overLimit: 1 });
  });

  it("같은 seed라도 전략·정확도가 다르면 사망 transition과 전체 전투 라운드를 합치지 않는다", () => {
    const deadBattle = {
      kind: "general" as const, expeditionId: "shared-expedition",
      party: [{ characterId: "warrior" as never, classId: "warrior" as never, hpBefore: 10, hpAfter: 0, maxHp: 20 }],
      battle: { status: "wipe" as const, termination: "roundLimit" as const, rounds: 9, actions: [], party: [], enemies: [] },
    };
    const clericBattle = {
      kind: "boss" as const, expeditionId: "cleric-expedition",
      party: [{ characterId: "cleric" as never, classId: "cleric" as never, hpBefore: 10, hpAfter: 10, maxHp: 28, abilityUsesRemainingBefore: 2, abilityUsesRemainingAfter: 2 }],
      battle: { status: "victory" as const, termination: "defeatedEnemies" as const, rounds: 3, actions: [], party: [], enemies: [] },
    };
    const first = metric({ seed: "shared-seed", strategyId: "survival", accuracy: 0.4, battles: [deadBattle, clericBattle] });
    const second = metric({ seed: "shared-seed", strategyId: "opportunist", accuracy: 0.7, battles: [deadBattle, clericBattle] });

    expect(aggregateHealingMetrics([first, second])).toMatchObject({
      byCleric: { withoutCleric: { totalDeaths: 2 } },
      meanBattleRounds: 6,
      roundLimitCount: 2,
    });
  });
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
    expect(metrics.battles).toEqual(run.trace.battles);
    expect(metrics.termination).toBeDefined();
  });

  it("aggregates means for resources and promotion counts", () => {
    const aggregate = aggregateRuns([
      metric({ finalReputation: 40, finalGold: 20, contractGold: 10, relicGold: 5, cumulativeGold: 15, reputationPromotions: 1, goldPromotions: 0 }),
      metric({ finalReputation: 60, finalGold: 40, contractGold: 30, relicGold: 15, cumulativeGold: 45, reputationPromotions: 0, goldPromotions: 2 }),
    ]).combinations["survival@0.7"]!;

    expect(aggregate.means).toMatchObject({
      finalReputation: 50,
      finalGold: 30,
      contractGold: 20,
      relicGold: 10,
      cumulativeGold: 30,
      reputationPromotions: 0.5,
      goldPromotions: 1,
    });
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

  it("첫 시도 위험도·테마별 손실과 최종 풀 상태 평균을 집계한다", () => {
    const combination = aggregateRuns([metric({
      deployableCount: 3,
      aliveCount: 7,
      zeroTrustCount: 3,
      gravelyWoundedCount: 2,
    })]).combinations["survival@0.7"]!;

    expect(combination.firstAttemptDepletionByThemeRisk["spider/1"]!["expedition-general"])
      .toEqual({ hpLost: 30, hpRecovered: 0, deaths: 2, seriousInjuriesStarted: 1, seriousInjuriesCleared: 0, trustZeroed: 1 });
    expect(combination.firstAttemptDepletionByThemeRisk["spider/1"]!["expedition-boss"])
      .toEqual({ hpLost: 70, hpRecovered: 0, deaths: 4, seriousInjuriesStarted: 2, seriousInjuriesCleared: 0, trustZeroed: 2 });
    expect(combination.means).toMatchObject({ totalDeaths: 6, aliveCount: 7, deployableCount: 3, zeroTrustCount: 3, gravelyWoundedCount: 2 });
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

  it("사망 0 HP 손실 60%만으로는 generic 종료를 source에 귀속하지 않는다", () => {
    const unavailable = aggregateRuns([metric({
      depletion: [
        { source: "expedition-general", worldTurn: 1, expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, initialRiskLevel: 1, attemptNumber: 1, hpLost: 60, hpRecovered: 0, deaths: 0, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0, trustZeroed: 0 },
        { source: "expedition-boss", worldTurn: 1, expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, initialRiskLevel: 1, attemptNumber: 1, hpLost: 40, hpRecovered: 0, deaths: 0, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0, trustZeroed: 0 },
      ],
    })]).combinations["survival@0.7"]!;

    expect(unavailable.depletionVerdict).toMatchObject({ kind: "mixed" });
    expect(unavailable.depletionVerdict.evidence).toContain("종료 선행 근거 없음");
  });

  it("사망 0 HP 손실 우세 source가 인력 소진 직전 손실과 일치할 때만 dominant로 판정한다", () => {
    const correlated = aggregateRuns([withTerminationEvidence(metric({
      depletion: [
        { source: "expedition-general", worldTurn: 1, expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, initialRiskLevel: 1, attemptNumber: 1, hpLost: 60, hpRecovered: 0, deaths: 0, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0, trustZeroed: 1 },
        { source: "expedition-boss", worldTurn: 1, expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, initialRiskLevel: 1, attemptNumber: 1, hpLost: 40, hpRecovered: 0, deaths: 0, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0, trustZeroed: 0 },
      ],
    }), {
      sourceLosses: [{ source: "expedition-general", hpLost: 60, deaths: 0, seriousInjuriesStarted: 0, trustZeroed: 1 }],
      wipeSource: "expedition-general",
    })]).combinations["survival@0.7"]!;

    expect(correlated.depletionVerdict).toMatchObject({ kind: "dominant", source: "expedition-general" });
    expect(correlated.depletionVerdict.evidence).toContain("종료 선행 expedition-general");
  });

  it("사망 0 종료 직전 손실 source와 전멸 소유 source가 충돌하면 mixed로 남긴다", () => {
    const conflicting = aggregateRuns([withTerminationEvidence(metric({
      balanceExpeditions: [expedition({
        initialRiskLevel: 1,
        bossEntry: { advicePressure: 0, aliveCount: 3, hp: 100, maxHp: 100 },
      })],
      depletion: [
        { source: "expedition-general", worldTurn: 1, expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, initialRiskLevel: 1, attemptNumber: 1, hpLost: 60, hpRecovered: 0, deaths: 0, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0, trustZeroed: 1 },
        { source: "expedition-boss", worldTurn: 1, expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, initialRiskLevel: 1, attemptNumber: 1, hpLost: 40, hpRecovered: 0, deaths: 0, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0, trustZeroed: 0 },
      ],
    }), {
      sourceLosses: [{ source: "expedition-general", hpLost: 60, deaths: 0, seriousInjuriesStarted: 0, trustZeroed: 1 }],
      wipeSource: "expedition-boss",
    })]).combinations["survival@0.7"]!;

    expect(conflicting.depletionVerdict).toMatchObject({ kind: "mixed" });
    expect(conflicting.depletionVerdict.evidence).toContain("종료 선행 source 충돌");
  });

  it("종료 선행 source 손실이나 final pool 상태가 실제 run과 다르면 집계 오류를 낸다", () => {
    const run = withTerminationEvidence(metric({
      depletion: [
        { source: "expedition-general", worldTurn: 1, expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, initialRiskLevel: 1, attemptNumber: 1, hpLost: 60, hpRecovered: 0, deaths: 0, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0, trustZeroed: 1 },
        { source: "expedition-boss", worldTurn: 1, expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, initialRiskLevel: 1, attemptNumber: 1, hpLost: 40, hpRecovered: 0, deaths: 0, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0, trustZeroed: 0 },
      ],
    }), {
      sourceLosses: [{ source: "expedition-general", hpLost: 999, deaths: 0, seriousInjuriesStarted: 0, trustZeroed: 1 }],
      wipeSource: "expedition-general",
    });
    const validRun = withTerminationEvidence(metric({
      depletion: [
        { source: "expedition-general", worldTurn: 1, expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, initialRiskLevel: 1, attemptNumber: 1, hpLost: 60, hpRecovered: 0, deaths: 0, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0, trustZeroed: 1 },
        { source: "expedition-boss", worldTurn: 1, expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, initialRiskLevel: 1, attemptNumber: 1, hpLost: 40, hpRecovered: 0, deaths: 0, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0, trustZeroed: 0 },
      ],
    }), {
      sourceLosses: [{ source: "expedition-general", hpLost: 60, deaths: 0, seriousInjuriesStarted: 0, trustZeroed: 1 }],
      wipeSource: "expedition-general",
    });
    const invalidFinalPool = {
      ...validRun,
      terminationEvidence: {
        ...validRun.terminationEvidence!,
        finalPool: { ...validRun.terminationEvidence!.finalPool, deployableCount: 1 },
      },
    };

    expect(() => aggregateRuns([run])).toThrow("종료 선행 source 손실이 원장과 다르다");
    expect(() => aggregateRuns([invalidFinalPool])).toThrow("종료 선행 근거와 최종 풀 상태가 다르다");
  });

  it("사망 0 HP 손실 59%는 종료 선행 근거가 있어도 mixed로 남긴다", () => {
    const mixed = aggregateRuns([metric({
      depletion: [
        { source: "expedition-general", worldTurn: 1, expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, initialRiskLevel: 1, attemptNumber: 1, hpLost: 59, hpRecovered: 0, deaths: 0, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0, trustZeroed: 0 },
        { source: "expedition-boss", worldTurn: 1, expeditionId: "fixture", dungeonId: "dungeon-fixture" as never, initialRiskLevel: 1, attemptNumber: 1, hpLost: 41, hpRecovered: 0, deaths: 0, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0, trustZeroed: 0 },
      ],
    })]).combinations["survival@0.7"]!;

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

  it("조합별 승급 도달과 종료 시 잔여 위험도 평균을 집계한다", () => {
    const combination = aggregateRuns([
      metric({
        seed: "progression/a",
        finalRank: "A",
        firstRankAtExpedition: { B: 3, A: 8 },
        remainingDungeonsByRisk: { 1: 0, 2: 1, 3: 2, 4: 3, 5: 1 },
      }),
      metric({
        seed: "progression/b",
        finalRank: "B",
        firstRankAtExpedition: { B: 5 },
        remainingDungeonsByRisk: { 1: 2, 2: 3, 3: 4, 4: 3, 5: 1 },
      }),
    ]).combinations["survival@0.7"]!;

    expect(combination.rankReachedCounts).toEqual({ B: 2, A: 1, S: 0 });
    expect(combination.meanFirstRankAtExpedition).toEqual({ B: 4, A: 8, S: null });
    expect(combination.meanRemainingDungeonsByRisk).toEqual({ 1: 1, 2: 2, 3: 3, 4: 3, 5: 1 });
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
