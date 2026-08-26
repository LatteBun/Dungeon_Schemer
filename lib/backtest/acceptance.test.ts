import { describe, expect, it } from "vitest";
import type { RiskLevel } from "@/lib/domain";
import { B1_RISK_CURVE_V2_TARGETS, evaluateB1BAcceptance, evaluateHealingStructuralGates, evaluatePairedAbilityStructuralGates } from "./acceptance";
import { compareBattleAbilitySnapshots, snapshotForBattleAbilityComparison } from "./battle-ability-comparison";
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
    battles: [],
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
  it("치유 action 구조 위반과 roundLimit을 모두 강제 실패로 보고한다", () => {
    const bad = metric("survival", 0.7, false, 0, "bad-heal");
    const battle = {
      kind: "boss" as const, expeditionId: "bad-heal",
      party: [{ characterId: "cleric" as never, classId: "cleric" as never, hpBefore: 5, hpAfter: 11, maxHp: 10, abilityUsesRemainingBefore: 1, abilityUsesRemainingAfter: 1 }],
      battle: {
        status: "wipe" as const, termination: "roundLimit" as const, rounds: 50,
        actions: [
          { kind: "heal" as const, round: 1, actorSide: "party" as const, actorId: "cleric", targetId: "dead", abilityKind: "emergencyHeal" as const, healing: 6, targetHpBefore: 0, targetHpAfter: 6 },
          { kind: "attack" as const, round: 1, actorSide: "party" as const, actorId: "cleric", targetId: "enemy", damage: 1, defeated: false, targetHpBefore: 5, targetHpAfter: 4 },
        ], party: [], enemies: [],
      },
    };
    const aggregate = aggregateRuns([{ ...bad, battles: [battle], errorKind: "nondeterminism" }]);
    const gates = evaluateHealingStructuralGates(aggregate);

    expect(gates.every((gate) => gate.enforced)).toBe(true);
    expect(gates.find((gate) => gate.id === "healing-amount-and-hp")).toMatchObject({ passed: false });
    expect(gates.find((gate) => gate.id === "healing-live-target-and-turn")).toMatchObject({ passed: false });
    expect(gates.find((gate) => gate.id === "healing-use-chain")).toMatchObject({ passed: false });
    expect(gates.find((gate) => gate.id === "no-round-limit")).toMatchObject({ passed: false });
    expect(gates.find((gate) => gate.id === "reproducible-valid-runs")).toMatchObject({ passed: false });
  });

  it("대상 최대 HP의 25%만 회복하고 전투당 두 번은 허용하되 원정당 세 번은 거절한다", () => {
    const run = metric("survival", 0.7, false, 0, "proportional-heal");
    const battle = (healing: 11 | 5 | 12, uses = 1) => ({
      kind: "general" as const, expeditionId: "proportional-heal",
      party: [
        { characterId: "cleric" as never, classId: "cleric" as never, hpBefore: 20, hpAfter: 20, maxHp: 28, abilityUsesRemainingBefore: 2, abilityUsesRemainingAfter: Math.max(0, 2 - uses) },
        { characterId: "warrior" as never, classId: "warrior" as never, hpBefore: 1, hpAfter: 1 + healing * uses, maxHp: 45 },
      ],
      battle: {
        status: "victory" as const, termination: "defeatedEnemies" as const, rounds: uses,
        actions: Array.from({ length: uses }, (_, index) => ({
          kind: "heal" as const, round: index + 1, actorSide: "party" as const, actorId: "cleric", targetId: "warrior",
          abilityKind: "emergencyHeal" as const, healing, targetHpBefore: 1 + healing * index, targetHpAfter: 1 + healing * (index + 1),
        })),
        party: [], enemies: [{ id: "enemy", monsterId: "one", hp: 1, maxHp: 1, baseDamage: 1 }],
      },
    });

    const valid = evaluateHealingStructuralGates(aggregateRuns([{ ...run, battles: [battle(11, 2)] }]));
    const under = evaluateHealingStructuralGates(aggregateRuns([{ ...run, battles: [battle(5)] }]));
    const over = evaluateHealingStructuralGates(aggregateRuns([{ ...run, battles: [battle(12)] }]));
    const threeUses = evaluateHealingStructuralGates(aggregateRuns([{ ...run, battles: [battle(11, 3)] }]));

    expect(valid.find((gate) => gate.id === "healing-amount-and-hp")).toMatchObject({ passed: true });
    expect(valid.find((gate) => gate.id === "healing-battle-use-limit")).toBeUndefined();
    expect(under.find((gate) => gate.id === "healing-amount-and-hp")).toMatchObject({ passed: false });
    expect(over.find((gate) => gate.id === "healing-amount-and-hp")).toMatchObject({ passed: false });
    expect(threeUses.find((gate) => gate.id === "healing-expedition-use-limit")).toMatchObject({ passed: false });
    expect(threeUses.find((gate) => gate.id === "healing-use-chain")).toMatchObject({ passed: false });
  });

  it("능력 미보유·미발동 control의 라운드가 달라지면 불변 gate를 실패시킨다", () => {
    const base = metric("survival", 0.7, false, 0, "unchanged");
    const controls = { ...base, battles: [{
      kind: "boss" as const, expeditionId: "unchanged",
      party: [{ characterId: "warrior" as never, classId: "warrior" as never, hpBefore: 10, hpAfter: 5, maxHp: 20 }],
      battle: { status: "victory" as const, termination: "defeatedEnemies" as const, rounds: 2, actions: [], party: [], enemies: [] },
    }, {
      kind: "general" as const, expeditionId: "unchanged",
      party: [{ characterId: "cleric" as never, classId: "cleric" as never, hpBefore: 10, hpAfter: 5, maxHp: 28 }],
      battle: { status: "victory" as const, termination: "defeatedEnemies" as const, rounds: 2, actions: [], party: [], enemies: [] },
    }] };
    const changed = { ...controls, battles: controls.battles.map((entry) => ({
      ...entry,
      battle: { ...entry.battle, rounds: 3 },
    })) };
    const comparison = compareBattleAbilitySnapshots(
      snapshotForBattleAbilityComparison([controls]),
      snapshotForBattleAbilityComparison([changed]),
    );

    expect(evaluatePairedAbilityStructuralGates(comparison)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "non-holder-unchanged", passed: false, evidence: "전투 control 불변 0/1", enforced: true }),
      expect.objectContaining({ id: "non-trigger-unchanged", passed: false, evidence: "전투 control 불변 0/1", enforced: true }),
    ]));
  });

  it("여러 적 중 첫 적을 쓰러뜨린 뒤의 치유를 승리 뒤 치유로 오인하지 않는다", () => {
    const run = metric("survival", 0.7, false, 0, "multi-enemy-heal");
    const aggregate = aggregateRuns([{ ...run, battles: [{
      kind: "general" as const, expeditionId: "multi-enemy-heal",
      party: [
        { characterId: "cleric" as never, classId: "cleric" as never, hpBefore: 5, hpAfter: 10, maxHp: 28, abilityUsesRemainingBefore: 1, abilityUsesRemainingAfter: 0 },
        { characterId: "warrior" as never, classId: "warrior" as never, hpBefore: 20, hpAfter: 20, maxHp: 45 },
      ],
      battle: {
        status: "victory" as const, termination: "defeatedEnemies" as const, rounds: 1,
        actions: [
          { kind: "attack" as const, round: 1, actorSide: "party" as const, actorId: "warrior", targetId: "enemy-1", damage: 5, defeated: true, targetHpBefore: 5, targetHpAfter: 0 },
          { kind: "heal" as const, round: 1, actorSide: "party" as const, actorId: "cleric", targetId: "cleric", abilityKind: "emergencyHeal" as const, healing: 5, targetHpBefore: 5, targetHpAfter: 10 },
          { kind: "attack" as const, round: 1, actorSide: "party" as const, actorId: "warrior", targetId: "enemy-2", damage: 5, defeated: true, targetHpBefore: 5, targetHpAfter: 0 },
        ], party: [], enemies: [
          { id: "enemy-1", monsterId: "one", hp: 0, maxHp: 5, baseDamage: 1 },
          { id: "enemy-2", monsterId: "two", hp: 0, maxHp: 5, baseDamage: 1 },
        ],
      },
    }] }]);

    expect(evaluateHealingStructuralGates(aggregate).find((gate) => gate.id === "healing-after-victory"))
      .toMatchObject({ passed: true, evidence: "위반 0건" });
  });

  it("사망한 성직자의 치유 action을 구조 위반으로 거절한다", () => {
    const run = metric("survival", 0.7, false, 0, "dead-cleric-heal");
    const aggregate = aggregateRuns([{ ...run, battles: [{
      kind: "general" as const, expeditionId: "dead-cleric-heal",
      party: [
        { characterId: "cleric" as never, classId: "cleric" as never, hpBefore: 0, hpAfter: 0, maxHp: 28, abilityUsesRemainingBefore: 1, abilityUsesRemainingAfter: 0 },
        { characterId: "warrior" as never, classId: "warrior" as never, hpBefore: 5, hpAfter: 10, maxHp: 45 },
      ],
      battle: {
        status: "wipe" as const, termination: "partyWipe" as const, rounds: 1,
        actions: [
          { kind: "heal" as const, round: 1, actorSide: "party" as const, actorId: "cleric", targetId: "warrior", abilityKind: "emergencyHeal" as const, healing: 5, targetHpBefore: 5, targetHpAfter: 10 },
        ], party: [], enemies: [{ id: "enemy", monsterId: "one", hp: 5, maxHp: 5, baseDamage: 1 }],
      },
    }] }]);

    expect(evaluateHealingStructuralGates(aggregate).find((gate) => gate.id === "healing-live-target-and-turn"))
      .toMatchObject({ passed: false });
  });

  it("같은 원정의 다음 전투가 직전 치유 잔여 횟수를 되돌리거나 endpoint를 누락하면 거절한다", () => {
    const run = metric("survival", 0.7, false, 0, "use-chain-across-battles");
    const battle = (kind: "general" | "boss", before: number | null, after: number | null) => ({
      kind, expeditionId: "use-chain-across-battles",
      party: [{ characterId: "cleric" as never, classId: "cleric" as never, hpBefore: 5, hpAfter: 10, maxHp: 28, abilityUsesRemainingBefore: before, abilityUsesRemainingAfter: after }],
      battle: {
        status: "victory" as const, termination: "defeatedEnemies" as const, rounds: 1,
        actions: [{ kind: "heal" as const, round: 1, actorSide: "party" as const, actorId: "cleric", targetId: "cleric", abilityKind: "emergencyHeal" as const, healing: 5, targetHpBefore: 5, targetHpAfter: 10 }],
        party: [], enemies: [{ id: "enemy", monsterId: "one", hp: 1, maxHp: 1, baseDamage: 1 }],
      },
    });
    const reset = aggregateRuns([{ ...run, battles: [battle("general", 2, 1), battle("boss", 2, 1)] }]);
    const missing = aggregateRuns([{ ...run, battles: [battle("general", 2, 1), battle("boss", 1, null)] }]);

    expect(evaluateHealingStructuralGates(reset).find((gate) => gate.id === "healing-use-chain"))
      .toMatchObject({ passed: false });
    expect(evaluateHealingStructuralGates(missing).find((gate) => gate.id === "healing-use-chain"))
      .toMatchObject({ passed: false });
  });

  it("control pair가 0건이면 미보유·미발동 gate를 통과시키지 않는다", () => {
    const base = metric("survival", 0.7, false, 0, "no-control-evidence");
    const clericRun = {
      ...base,
      battles: [{
        kind: "boss" as const, expeditionId: "no-control-evidence",
        party: [{ characterId: "cleric" as never, classId: "cleric" as never, hpBefore: 5, hpAfter: 10, maxHp: 28 }],
        battle: {
          status: "victory" as const, termination: "defeatedEnemies" as const, rounds: 1,
          actions: [{ kind: "heal" as const, round: 1, actorSide: "party" as const, actorId: "cleric", targetId: "cleric", abilityKind: "emergencyHeal" as const, healing: 5, targetHpBefore: 5, targetHpAfter: 10 }], party: [], enemies: [],
        },
      }],
    };
    const comparison = compareBattleAbilitySnapshots(
      snapshotForBattleAbilityComparison([clericRun]),
      snapshotForBattleAbilityComparison([clericRun]),
    );

    expect(evaluatePairedAbilityStructuralGates(comparison)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "non-holder-unchanged", passed: false }),
      expect.objectContaining({ id: "non-trigger-unchanged", passed: false }),
    ]));
  });
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

    const inclusiveRiskOne = aggregate.combinations["opportunist@0.7"]!.firstAttemptByInitialRisk[1];
    const inclusiveBoundary = evaluateB1BAcceptance({
      ...aggregate,
      combinations: {
        ...aggregate.combinations,
        "opportunist@0.7": {
          ...aggregate.combinations["opportunist@0.7"]!,
          firstAttemptByInitialRisk: {
            ...aggregate.combinations["opportunist@0.7"]!.firstAttemptByInitialRisk,
            1: { ...inclusiveRiskOne, preBossFailures: 10, bossFailures: 10, meanBossEntryHpRatio: 0.70 },
          },
        },
      },
    }, { mode: "calibration", seedsPerCombination: 200, focus: "risk-curve" });
    expect(inclusiveBoundary.find((gate) => gate.id === "boss-axis-guard:opportunist@0.7:risk-1")).toMatchObject({ passed: true, enforced: true });
  });
});
