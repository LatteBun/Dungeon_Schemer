import type { AdviceOutcome, CampaignState, EndingKind, GuideRank, InfoReaction, RiskLevel } from "@/lib/domain";
import type { CampaignRun, DepletionSource, DepletionTraceEntry, ExpeditionBalanceTrace, RunErrorKind } from "./campaign-driver";
import type { Accuracy, PublicNodeCategory, StrategyId } from "./public-state";

export type CombinationId = `${StrategyId}@${Accuracy}`;

export type CampaignTerminationReason =
  | "completed"
  | "pool-exhausted"
  | "no-eligible-party"
  | "distrust"
  | "denounced"
  | "run-error";

export interface DepletionTotals {
  readonly hpLost: number;
  readonly hpRecovered: number;
  readonly deaths: number;
  readonly seriousInjuriesStarted: number;
  readonly seriousInjuriesCleared: number;
  readonly trustZeroed: number;
}

export type DepletionVerdict =
  | { readonly kind: "dominant"; readonly source: DepletionSource; readonly evidence: string }
  | { readonly kind: "mixed"; readonly evidence: string };

export interface CampaignRunMetrics {
  readonly seed: string;
  readonly strategyId: StrategyId;
  readonly accuracy: Accuracy;
  readonly ending: EndingKind | "run-error";
  readonly completed: boolean;
  readonly finalRank: GuideRank;
  readonly reachedRankS: boolean;
  readonly totalExpeditions: number;
  readonly clearedExpeditions: number;
  readonly wipedExpeditions: number;
  readonly totalDeaths: number;
  readonly aliveCount: number;
  readonly deployableCount: number;
  readonly zeroTrustCount: number;
  readonly gravelyWoundedCount: number;
  readonly finalReputation: number;
  readonly finalGold: number;
  readonly contractGold: number;
  readonly relicGold: number;
  readonly cumulativeGold: number;
  readonly meanTrust: number;
  readonly medianTrust: number;
  readonly meanHpRatio: number;
  readonly medianHpRatio: number;
  readonly reputationPromotions: number;
  readonly goldPromotions: number;
  readonly firstRankAtExpedition: Readonly<Partial<Record<Exclude<GuideRank, "C">, number>>>;
  readonly nodeCategoryChoices: Readonly<Record<PublicNodeCategory, number>>;
  readonly intendedAdviceCounts: Readonly<Record<AdviceOutcome, number>>;
  readonly selectedAdviceCounts: Readonly<Record<AdviceOutcome, number>>;
  readonly reactionCounts: Readonly<Record<InfoReaction, number>>;
  readonly betrayalAttempts: number;
  readonly betrayalWipes: number;
  readonly betrayalCompletions: number;
  readonly merchantGoldSpent: number;
  readonly merchantEffectsConsumed: number;
  readonly adviceHits: number;
  readonly adviceTotal: number;
  readonly errorKind: RunErrorKind | null;
  readonly balanceExpeditions: readonly ExpeditionBalanceTrace[];
  readonly depletion: readonly DepletionTraceEntry[];
  readonly termination: CampaignTerminationReason;
}

export interface WilsonInterval {
  readonly low: number;
  readonly high: number;
}

export interface PairedDifference {
  readonly mean: number;
  readonly standardError: number;
  readonly low95: number;
  readonly high95: number;
}

export interface ExpeditionFunnel {
  readonly starts: number;
  readonly bossEntries: number;
  readonly clears: number;
  readonly wipes: number;
  readonly interrupted: number;
  readonly preBossFailures: number;
  readonly bossFailures: number;
  readonly clearRate: number | null;
  readonly bossReachRate: number | null;
  readonly bossConversionRate: number | null;
  readonly meanBossEntryHpRatio: number | null;
  readonly meanBossEntryAliveCount: number | null;
  readonly clearRateWilson95: WilsonInterval | null;
}

export interface EventualDungeonRate {
  readonly attemptedDungeons: number;
  readonly clearedDungeons: number;
  readonly clearRate: number | null;
  readonly clearRateWilson95: WilsonInterval | null;
}

export interface CombinationAggregate {
  readonly id: CombinationId;
  readonly count: number;
  readonly completedCount: number;
  readonly completionRate: number;
  readonly completedWipeMean: number | null;
  readonly fivePlusWipeCount: number;
  readonly fivePlusWipeRate: number | null;
  readonly meanMaxAdvicePressure: number;
  readonly meanBossEntryHpRatio: number | null;
  readonly bossByThemeRisk: Readonly<Record<string, {
    readonly entries: number;
    readonly clears: number;
    readonly wipes: number;
    readonly meanEntryHpRatio: number;
  }>>;
  readonly firstAttemptByInitialRisk: Readonly<Record<RiskLevel, ExpeditionFunnel>>;
  readonly allAttemptsByCurrentRisk: Readonly<Record<RiskLevel, ExpeditionFunnel>>;
  readonly eventualDungeonByInitialRisk: Readonly<Record<RiskLevel, EventualDungeonRate>>;
  readonly firstAttemptByThemeRisk: Readonly<Record<string, ExpeditionFunnel>>;
  readonly rankSCount: number;
  readonly endingCounts: Readonly<Record<EndingKind | "run-error", number>>;
  readonly terminationCounts: Readonly<Record<CampaignTerminationReason, number>>;
  readonly depletionBySource: Readonly<Record<DepletionSource, DepletionTotals>>;
  readonly depletionVerdict: DepletionVerdict;
  readonly adviceHits: number;
  readonly adviceTotal: number;
  readonly betrayalAttempts: number;
  readonly betrayalCompletions: number;
  readonly betrayalWipes: number;
  readonly means: Readonly<Record<string, number>>;
  readonly runs: readonly CampaignRunMetrics[];
}

export interface BacktestAggregate {
  readonly runs: readonly CampaignRunMetrics[];
  readonly combinations: Readonly<Record<CombinationId, CombinationAggregate>>;
  readonly errorCount: number;
  readonly errorCounts: Readonly<Record<RunErrorKind, number>>;
}

export class AggregationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AggregationError";
  }
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

function emptyCounts<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
}

const ENDINGS: readonly (EndingKind | "run-error")[] = ["distrust", "denounced", "completed", "exhausted", "unemployed", "run-error"];
const ERROR_KINDS: readonly RunErrorKind[] = ["generation", "rejected-transition", "invalid-strategy-decision", "stall", "step-limit", "nondeterminism"];
const DEPLETION_SOURCES = ["expedition-general", "expedition-boss", "world-turn-background", "world-turn-rest"] as const satisfies readonly DepletionSource[];
const TERMINATION_REASONS = ["completed", "pool-exhausted", "no-eligible-party", "distrust", "denounced", "run-error"] as const satisfies readonly CampaignTerminationReason[];
const NODE_CATEGORIES: readonly PublicNodeCategory[] = ["rest", "merchant", "special", "monster", "boss"];
const OUTCOMES: readonly AdviceOutcome[] = ["help", "harm", "neutral"];
const REACTIONS: readonly InfoReaction[] = ["accepted", "suspected", "exposed"];
const RISK_LEVELS = [1, 2, 3, 4, 5] as const satisfies readonly RiskLevel[];

function terminationForEnding(ending: EndingKind | "run-error"): CampaignTerminationReason {
  switch (ending) {
    case "completed": return "completed";
    case "exhausted": return "pool-exhausted";
    case "unemployed": return "no-eligible-party";
    case "distrust": return "distrust";
    case "denounced": return "denounced";
    case "run-error": return "run-error";
  }
}

function baseFailure(run: Extract<CampaignRun, { ok: false }>): CampaignRunMetrics {
  if (run.trace.termination !== "run-error") throw new AggregationError("실행 오류 trace의 종료 사유가 유효하지 않다");
  const members = run.campaign.pool.order.map((id) => run.campaign.pool.byId[id]).filter((member): member is NonNullable<typeof member> => member !== undefined);
  return {
    seed: run.trace.seed, strategyId: run.trace.strategyId, accuracy: run.trace.accuracy,
    ending: "run-error", completed: false, finalRank: "C", reachedRankS: false,
    totalExpeditions: 0, clearedExpeditions: 0, wipedExpeditions: 0, totalDeaths: run.campaign.statistics.totalDeaths,
    aliveCount: members.filter((member) => member.alive).length,
    deployableCount: members.filter((member) => member.alive && member.trust > 0 && !member.gravelyWounded).length,
    zeroTrustCount: members.filter((member) => member.trust === 0).length,
    gravelyWoundedCount: members.filter((member) => member.gravelyWounded).length,
    finalReputation: 0, finalGold: 0, contractGold: 0, relicGold: 0, cumulativeGold: 0,
    meanTrust: 0, medianTrust: 0, meanHpRatio: 0, medianHpRatio: 0,
    reputationPromotions: 0, goldPromotions: 0, firstRankAtExpedition: {},
    nodeCategoryChoices: { ...run.trace.nodeCategoryChoices },
    intendedAdviceCounts: { ...run.trace.intendedAdviceCounts },
    selectedAdviceCounts: { ...run.trace.selectedAdviceCounts },
    reactionCounts: { ...run.trace.reactionCounts },
    betrayalAttempts: run.trace.betrayalExpeditionIds.length, betrayalWipes: 0, betrayalCompletions: 0,
    merchantGoldSpent: run.trace.merchantGoldSpent, merchantEffectsConsumed: run.trace.merchantEffectsConsumed,
    adviceHits: run.trace.adviceSelections.filter((selection) => selection.hit).length,
    adviceTotal: run.trace.adviceSelections.length, errorKind: run.errorKind,
    balanceExpeditions: run.trace.balanceExpeditions,
    depletion: run.trace.depletion,
    termination: terminationForEnding(run.trace.termination),
  };
}

function successfulMetrics(campaign: CampaignState, run: Extract<CampaignRun, { ok: true }>): CampaignRunMetrics {
  if (campaign.ending === null) throw new AggregationError("성공 실행에 종료 사유가 없다");
  if (run.trace.termination === undefined) throw new AggregationError("손실 trace에 종료 사유가 없다");
  if (run.trace.termination !== campaign.ending.kind) throw new AggregationError("성공 실행의 종료 사유가 일치하지 않는다");
  const members = campaign.pool.order.map((id) => campaign.pool.byId[id]).filter((member): member is NonNullable<typeof member> => member !== undefined);
  const trusts = members.map((member) => member.trust);
  const hpRatios = members.map((member) => member.hp / member.maxHp);
  const settlements = campaign.statistics.settlements;
  const byBetrayal = new Set(run.trace.betrayalExpeditionIds);
  const betrayalSettlements = settlements.filter((settlement) => byBetrayal.has(settlement.expeditionId));
  const firstRankAtExpedition: Partial<Record<Exclude<GuideRank, "C">, number>> = {};
  let expeditionCount = 0;
  for (const event of campaign.history.events) {
    if (event.type === "EXPEDITION_SETTLED") expeditionCount += 1;
    if (event.type === "GUIDE_PROMOTED" && event.toRank !== "C" && firstRankAtExpedition[event.toRank] === undefined) firstRankAtExpedition[event.toRank] = expeditionCount;
  }
  const promotionEvents = campaign.history.events.filter((event): event is Extract<typeof event, { type: "GUIDE_PROMOTED" }> => event.type === "GUIDE_PROMOTED");
  return {
    seed: run.trace.seed, strategyId: run.trace.strategyId, accuracy: run.trace.accuracy,
    ending: campaign.ending.kind, completed: campaign.ending.kind === "completed",
    finalRank: campaign.rank, reachedRankS: campaign.rank === "S",
    totalExpeditions: campaign.statistics.totalExpeditions,
    clearedExpeditions: campaign.statistics.clearedExpeditions,
    wipedExpeditions: campaign.statistics.wipedExpeditions,
    totalDeaths: campaign.statistics.totalDeaths,
    aliveCount: members.filter((member) => member.alive).length,
    deployableCount: members.filter((member) => member.alive && member.trust > 0 && !member.gravelyWounded).length,
    zeroTrustCount: members.filter((member) => member.trust === 0).length,
    gravelyWoundedCount: members.filter((member) => member.gravelyWounded).length,
    finalReputation: campaign.reputation, finalGold: campaign.gold,
    contractGold: settlements.reduce((sum, settlement) => sum + settlement.goldDelta, 0),
    relicGold: settlements.reduce((sum, settlement) => sum + settlement.relicGold, 0),
    cumulativeGold: campaign.cumulativeGold,
    meanTrust: trusts.reduce((sum, value) => sum + value, 0) / Math.max(1, trusts.length),
    medianTrust: median(trusts),
    meanHpRatio: hpRatios.reduce((sum, value) => sum + value, 0) / Math.max(1, hpRatios.length),
    medianHpRatio: median(hpRatios),
    reputationPromotions: promotionEvents.filter((event) => event.method === "reputation").length,
    goldPromotions: promotionEvents.filter((event) => event.method === "gold").length,
    firstRankAtExpedition,
    nodeCategoryChoices: { ...run.trace.nodeCategoryChoices },
    intendedAdviceCounts: { ...run.trace.intendedAdviceCounts },
    selectedAdviceCounts: { ...run.trace.selectedAdviceCounts },
    reactionCounts: { ...run.trace.reactionCounts },
    betrayalAttempts: run.trace.betrayalExpeditionIds.length,
    betrayalWipes: betrayalSettlements.filter((settlement) => settlement.status === "wiped").length,
    betrayalCompletions: betrayalSettlements.filter((settlement) => settlement.status === "cleared").length,
    merchantGoldSpent: run.trace.merchantGoldSpent,
    merchantEffectsConsumed: run.trace.merchantEffectsConsumed,
    adviceHits: run.trace.adviceSelections.filter((selection) => selection.hit).length,
    adviceTotal: run.trace.adviceSelections.length,
    errorKind: null,
    balanceExpeditions: run.trace.balanceExpeditions,
    depletion: run.trace.depletion,
    termination: terminationForEnding(run.trace.termination),
  };
}

export function metricsForRun(run: CampaignRun): CampaignRunMetrics {
  return run.ok ? successfulMetrics(run.campaign, run) : baseFailure(run);
}

export function wilsonInterval(successes: number, total: number, z = 1.959963984540054): WilsonInterval {
  if (!Number.isInteger(successes) || !Number.isInteger(total) || total <= 0 || successes < 0 || successes > total) {
    throw new AggregationError("유효하지 않은 비율 표본");
  }
  const p = successes / total;
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total) / denominator;
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

export function pairedMeanDifference(left: readonly number[], right: readonly number[]): PairedDifference {
  if (left.length !== right.length || left.length < 2) throw new AggregationError("paired 표본 수가 맞지 않다");
  const differences = left.map((value, index) => value - right[index]!);
  const mean = differences.reduce((sum, value) => sum + value, 0) / differences.length;
  const variance = differences.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (differences.length - 1);
  const standardError = Math.sqrt(variance / differences.length);
  return { mean, standardError, low95: mean - 1.96 * standardError, high95: mean + 1.96 * standardError };
}

function meanOrNull(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function finalizeFunnel(entries: readonly ExpeditionBalanceTrace[]): ExpeditionFunnel {
  const starts = entries.length;
  const bossEntries = entries.filter((entry) => entry.bossEntry !== null);
  const clears = entries.filter((entry) => entry.result === "cleared").length;
  const wipes = entries.filter((entry) => entry.result === "wiped").length;
  const interrupted = entries.filter((entry) => entry.result === "interrupted").length;
  return {
    starts,
    bossEntries: bossEntries.length,
    clears,
    wipes,
    interrupted,
    preBossFailures: starts - bossEntries.length,
    bossFailures: bossEntries.length - clears,
    clearRate: starts === 0 ? null : clears / starts,
    bossReachRate: starts === 0 ? null : bossEntries.length / starts,
    bossConversionRate: bossEntries.length === 0 ? null : clears / bossEntries.length,
    meanBossEntryHpRatio: meanOrNull(bossEntries.map(({ bossEntry }) => bossEntry!.hp / bossEntry!.maxHp)),
    meanBossEntryAliveCount: meanOrNull(bossEntries.map(({ bossEntry }) => bossEntry!.aliveCount)),
    clearRateWilson95: starts === 0 ? null : wilsonInterval(clears, starts),
  };
}

function funnelsByRisk(entries: readonly ExpeditionBalanceTrace[], risk: (entry: ExpeditionBalanceTrace) => RiskLevel): Readonly<Record<RiskLevel, ExpeditionFunnel>> {
  return Object.fromEntries(RISK_LEVELS.map((level) => [
    level,
    finalizeFunnel(entries.filter((entry) => risk(entry) === level)),
  ])) as Record<RiskLevel, ExpeditionFunnel>;
}

function validateExpeditionTraces(runs: readonly CampaignRunMetrics[], id: CombinationId): void {
  for (const run of runs) {
    const attemptsByDungeon = new Map<string, number>();
    for (const expedition of run.balanceExpeditions) {
      if (!RISK_LEVELS.includes(expedition.initialRiskLevel)) throw new AggregationError(`유효하지 않은 초기 위험도: ${id}`);
      if (!Number.isInteger(expedition.attemptNumber) || expedition.attemptNumber < 1
        || !RISK_LEVELS.includes(expedition.currentRiskLevel)
        || (expedition.result !== "cleared" && expedition.result !== "wiped" && expedition.result !== "interrupted")
        || (expedition.result === "cleared" && expedition.bossEntry === null)) {
        throw new AggregationError(`유효하지 않은 원정 trace: ${id}`);
      }
      const expectedAttempt = (attemptsByDungeon.get(expedition.dungeonId) ?? 0) + 1;
      if (expedition.attemptNumber !== expectedAttempt) throw new AggregationError(`원정 시도 번호가 이어지지 않는다: ${id}`);
      attemptsByDungeon.set(expedition.dungeonId, expedition.attemptNumber);
    }
  }
}

function emptyDepletionTotals(): DepletionTotals {
  return {
    hpLost: 0,
    hpRecovered: 0,
    deaths: 0,
    seriousInjuriesStarted: 0,
    seriousInjuriesCleared: 0,
    trustZeroed: 0,
  };
}

function validDepletionCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function validateDepletionTraces(runs: readonly CampaignRunMetrics[], id: CombinationId): void {
  for (const run of runs) {
    if (!Array.isArray(run.depletion)) throw new AggregationError(`손실 원장이 없다: ${id}`);
    if (run.termination === undefined) throw new AggregationError(`종료 사유가 없다: ${id}`);
    if (!TERMINATION_REASONS.includes(run.termination)
      || run.termination !== terminationForEnding(run.ending)) {
      throw new AggregationError(`유효하지 않은 종료 사유: ${id}`);
    }
    const totals = { ...emptyDepletionTotals() };
    for (const entry of run.depletion) {
      if (!DEPLETION_SOURCES.includes(entry.source)
        || !Number.isInteger(entry.worldTurn)
        || entry.worldTurn < 0
        || !validDepletionCount(entry.hpLost)
        || !validDepletionCount(entry.hpRecovered)
        || !validDepletionCount(entry.deaths)
        || !validDepletionCount(entry.seriousInjuriesStarted)
        || !validDepletionCount(entry.seriousInjuriesCleared)
        || !validDepletionCount(entry.trustZeroed)) {
        throw new AggregationError(`유효하지 않은 손실 원장: ${id}`);
      }
      const expeditionSource = entry.source === "expedition-general" || entry.source === "expedition-boss";
      if (expeditionSource) {
        if (entry.expeditionId === null || entry.dungeonId === null
          || entry.initialRiskLevel === null || entry.attemptNumber === null) {
          throw new AggregationError(`유효하지 않은 손실 원장: ${id}`);
        }
        const expedition = run.balanceExpeditions.find((candidate) => candidate.expeditionId === entry.expeditionId);
        if (expedition === undefined
          || expedition.dungeonId !== entry.dungeonId
          || expedition.initialRiskLevel !== entry.initialRiskLevel
          || expedition.attemptNumber !== entry.attemptNumber) {
          throw new AggregationError(`원정 손실 locator가 balance trace와 다르다: ${id}`);
        }
      } else if (entry.expeditionId !== null || entry.dungeonId !== null
        || entry.initialRiskLevel !== null || entry.attemptNumber !== null) {
        throw new AggregationError(`유효하지 않은 손실 원장: ${id}`);
      }
      if (entry.source === "world-turn-background" && entry.deaths !== 0) {
        throw new AggregationError(`월드턴 백그라운드 손실에 사망이 있다: ${id}`);
      }
      totals.hpLost += entry.hpLost;
      totals.hpRecovered += entry.hpRecovered;
      totals.deaths += entry.deaths;
      totals.seriousInjuriesStarted += entry.seriousInjuriesStarted;
      totals.seriousInjuriesCleared += entry.seriousInjuriesCleared;
      totals.trustZeroed += entry.trustZeroed;
    }
    if (totals.deaths !== run.totalDeaths
      || totals.trustZeroed !== run.zeroTrustCount
      || totals.seriousInjuriesStarted - totals.seriousInjuriesCleared !== run.gravelyWoundedCount) {
      throw new AggregationError(`손실 원장과 최종 풀 상태가 모순된다: ${id}`);
    }
  }
}

function sumDepletion(runs: readonly CampaignRunMetrics[]): Readonly<Record<DepletionSource, DepletionTotals>> {
  const totals = Object.fromEntries(DEPLETION_SOURCES.map((source) => [source, emptyDepletionTotals()])) as Record<DepletionSource, DepletionTotals>;
  for (const entry of runs.flatMap((run) => run.depletion)) {
    const total = totals[entry.source];
    totals[entry.source] = {
      hpLost: total.hpLost + entry.hpLost,
      hpRecovered: total.hpRecovered + entry.hpRecovered,
      deaths: total.deaths + entry.deaths,
      seriousInjuriesStarted: total.seriousInjuriesStarted + entry.seriousInjuriesStarted,
      seriousInjuriesCleared: total.seriousInjuriesCleared + entry.seriousInjuriesCleared,
      trustZeroed: total.trustZeroed + entry.trustZeroed,
    };
  }
  return totals;
}

function dominantTerminationFor(terminationCounts: Readonly<Record<CampaignTerminationReason, number>>): CampaignTerminationReason | null {
  const maximum = Math.max(...TERMINATION_REASONS.map((reason) => terminationCounts[reason]));
  const dominant = TERMINATION_REASONS.filter((reason) => terminationCounts[reason] === maximum);
  return maximum > 0 && dominant.length === 1 ? dominant[0]! : null;
}

function depletionVerdictFor(
  depletionBySource: Readonly<Record<DepletionSource, DepletionTotals>>,
  terminationCounts: Readonly<Record<CampaignTerminationReason, number>>,
): DepletionVerdict {
  const lossSources = DEPLETION_SOURCES.filter((source) => source !== "world-turn-rest");
  const totalDeaths = lossSources.reduce((total, source) => total + depletionBySource[source].deaths, 0);
  if (totalDeaths > 0) {
    const source = lossSources.find((candidate) => depletionBySource[candidate].deaths / totalDeaths >= 0.6);
    if (source !== undefined) {
      const deaths = depletionBySource[source].deaths;
      return { kind: "dominant", source, evidence: `사망 ${deaths}/${totalDeaths} (${(deaths / totalDeaths * 100).toFixed(1)}%)` };
    }
    return { kind: "mixed", evidence: `사망 60% 이상 source 없음 (총 ${totalDeaths})` };
  }
  const totalHpLost = lossSources.reduce((total, source) => total + depletionBySource[source].hpLost, 0);
  if (totalHpLost > 0) {
    const source = lossSources.find((candidate) => depletionBySource[candidate].hpLost / totalHpLost >= 0.6);
    if (source !== undefined) {
      const hpLost = depletionBySource[source].hpLost;
      const termination = dominantTerminationFor(terminationCounts);
      if (termination === "pool-exhausted" || termination === "no-eligible-party") {
        return { kind: "dominant", source, evidence: `사망 0건, HP 손실 ${hpLost}/${totalHpLost} (${(hpLost / totalHpLost * 100).toFixed(1)}%), 종료 ${termination}` };
      }
      return {
        kind: "mixed",
        evidence: termination === null
          ? `사망 0건, HP 손실 ${hpLost}/${totalHpLost}이나 종료 최다 원인이 동률이다`
          : `사망 0건, HP 손실 ${hpLost}/${totalHpLost}이나 종료 ${termination}과 충돌한다`,
      };
    }
    return { kind: "mixed", evidence: `사망 0건, HP 손실 60% 이상 source 없음 (총 ${totalHpLost})` };
  }
  return { kind: "mixed", evidence: "사망과 HP 손실이 없다" };
}

function eventualDungeonRates(runs: readonly CampaignRunMetrics[]): Readonly<Record<RiskLevel, EventualDungeonRate>> {
  const dungeons = runs.flatMap((run) => {
    const attemptsByDungeon = new Map<string, ExpeditionBalanceTrace[]>();
    for (const expedition of run.balanceExpeditions) {
      const attempts = attemptsByDungeon.get(expedition.dungeonId) ?? [];
      attempts.push(expedition);
      attemptsByDungeon.set(expedition.dungeonId, attempts);
    }
    return [...attemptsByDungeon.values()].map((attempts) => ({
      initialRiskLevel: attempts[0]!.initialRiskLevel,
      cleared: attempts.some((attempt) => attempt.result === "cleared"),
    }));
  });
  return Object.fromEntries(RISK_LEVELS.map((level) => {
    const entries = dungeons.filter((dungeon) => dungeon.initialRiskLevel === level);
    const clearedDungeons = entries.filter((dungeon) => dungeon.cleared).length;
    const attemptedDungeons = entries.length;
    return [level, {
      attemptedDungeons,
      clearedDungeons,
      clearRate: attemptedDungeons === 0 ? null : clearedDungeons / attemptedDungeons,
      clearRateWilson95: attemptedDungeons === 0 ? null : wilsonInterval(clearedDungeons, attemptedDungeons),
    }];
  })) as Record<RiskLevel, EventualDungeonRate>;
}

function aggregateCombination(id: CombinationId, runs: readonly CampaignRunMetrics[]): CombinationAggregate {
  if (runs.length === 0) throw new AggregationError(`조합 표본이 없다: ${id}`);
  const completed = runs.filter((run) => run.completed);
  const completedWipes = completed.map((run) => run.wipedExpeditions);
  if (completedWipes.some((wipes) => !Number.isFinite(wipes) || wipes < 0)) {
    throw new AggregationError(`유효하지 않은 완료 전멸 수: ${id}`);
  }
  validateExpeditionTraces(runs, id);
  validateDepletionTraces(runs, id);
  const depletionBySource = sumDepletion(runs);
  const expeditionPressures = runs.flatMap((run) => {
    if (!Array.isArray(run.balanceExpeditions)) throw new AggregationError(`원정 밸런스 지표가 없다: ${id}`);
    return run.balanceExpeditions.map((expedition) => expedition.maxAdvicePressure);
  });
  if (expeditionPressures.length === 0) throw new AggregationError(`원정 밸런스 지표가 없다: ${id}`);
  if (expeditionPressures.some((pressure) => !Number.isFinite(pressure))) throw new AggregationError(`유효하지 않은 조언 압력: ${id}`);
  const bossEntries = runs.flatMap((run) => run.balanceExpeditions.flatMap((expedition) => expedition.bossEntry === null ? [] : [{ expedition, entry: expedition.bossEntry }]));
  const bossEntryRatios = bossEntries.map(({ entry }) => {
    if (!Number.isFinite(entry.hp) || !Number.isFinite(entry.maxHp) || entry.maxHp <= 0) {
      throw new AggregationError(`유효하지 않은 보스 진입 HP: ${id}`);
    }
    return entry.hp / entry.maxHp;
  });
  const bossGroups = new Map<string, { entries: number; clears: number; wipes: number; hpRatios: number[] }>();
  for (const { expedition, entry } of bossEntries) {
    if (!Number.isFinite(expedition.initialRiskLevel)) throw new AggregationError(`유효하지 않은 초기 위험도: ${id}`);
    const groupId = `${expedition.initialRiskLevel}/${expedition.theme}`;
    const group = bossGroups.get(groupId) ?? { entries: 0, clears: 0, wipes: 0, hpRatios: [] };
    group.entries += 1;
    group.clears += expedition.result === "cleared" ? 1 : 0;
    group.wipes += expedition.result === "wiped" ? 1 : 0;
    group.hpRatios.push(entry.hp / entry.maxHp);
    bossGroups.set(groupId, group);
  }
  const bossByThemeRisk = Object.fromEntries([...bossGroups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([groupId, group]) => [groupId, {
    entries: group.entries,
    clears: group.clears,
    wipes: group.wipes,
    meanEntryHpRatio: group.hpRatios.reduce((total, ratio) => total + ratio, 0) / group.hpRatios.length,
  }])) as CombinationAggregate["bossByThemeRisk"];
  const endingCounts = emptyCounts(ENDINGS);
  for (const run of runs) endingCounts[run.ending] += 1;
  const terminationCounts = emptyCounts(TERMINATION_REASONS);
  for (const run of runs) terminationCounts[run.termination] += 1;
  const depletionVerdict = depletionVerdictFor(depletionBySource, terminationCounts);
  const sum = (selector: (run: CampaignRunMetrics) => number) => runs.reduce((total, run) => total + selector(run), 0) / runs.length;
  const allExpeditions = runs.flatMap((run) => run.balanceExpeditions);
  const firstAttempts = allExpeditions.filter((expedition) => expedition.attemptNumber === 1);
  const firstAttemptByThemeRisk = Object.fromEntries([...new Set(firstAttempts.map((expedition) => `${expedition.theme}/${expedition.initialRiskLevel}`))]
    .sort((left, right) => left.localeCompare(right))
    .map((themeRisk) => [themeRisk, finalizeFunnel(firstAttempts.filter((expedition) => `${expedition.theme}/${expedition.initialRiskLevel}` === themeRisk))])) as Record<string, ExpeditionFunnel>;
  return {
    id, count: runs.length, completedCount: completed.length,
    completionRate: completed.length / runs.length,
    completedWipeMean: completed.length === 0 ? null : completedWipes.reduce((total, wipes) => total + wipes, 0) / completed.length,
    fivePlusWipeCount: completedWipes.filter((wipes) => wipes >= 5).length,
    fivePlusWipeRate: completed.length === 0 ? null : completedWipes.filter((wipes) => wipes >= 5).length / completed.length,
    meanMaxAdvicePressure: expeditionPressures.reduce((total, pressure) => total + pressure, 0) / expeditionPressures.length,
    meanBossEntryHpRatio: bossEntryRatios.length === 0 ? null : bossEntryRatios.reduce((total, ratio) => total + ratio, 0) / bossEntryRatios.length,
    bossByThemeRisk,
    firstAttemptByInitialRisk: funnelsByRisk(firstAttempts, (expedition) => expedition.initialRiskLevel),
    allAttemptsByCurrentRisk: funnelsByRisk(allExpeditions, (expedition) => expedition.currentRiskLevel),
    eventualDungeonByInitialRisk: eventualDungeonRates(runs),
    firstAttemptByThemeRisk,
    rankSCount: runs.filter((run) => run.reachedRankS).length, endingCounts,
    terminationCounts, depletionBySource, depletionVerdict,
    adviceHits: runs.reduce((total, run) => total + run.adviceHits, 0),
    adviceTotal: runs.reduce((total, run) => total + run.adviceTotal, 0),
    betrayalAttempts: runs.reduce((total, run) => total + run.betrayalAttempts, 0),
    betrayalCompletions: runs.reduce((total, run) => total + run.betrayalCompletions, 0),
    betrayalWipes: runs.reduce((total, run) => total + run.betrayalWipes, 0),
    means: {
      totalExpeditions: sum((run) => run.totalExpeditions), totalDeaths: sum((run) => run.totalDeaths),
      aliveCount: sum((run) => run.aliveCount), relicGold: sum((run) => run.relicGold),
      cumulativeGold: sum((run) => run.cumulativeGold), betrayalAttempts: sum((run) => run.betrayalAttempts),
    },
    runs: [...runs],
  };
}

export function aggregateRuns(runs: readonly CampaignRunMetrics[]): BacktestAggregate {
  if (runs.length === 0) throw new AggregationError("집계할 실행 결과가 없다");
  const groups = new Map<CombinationId, CampaignRunMetrics[]>();
  for (const run of runs) {
    const id = `${run.strategyId}@${run.accuracy}` as CombinationId;
    const group = groups.get(id) ?? [];
    group.push(run);
    groups.set(id, group);
  }
  const combinations = Object.fromEntries([...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, group]) => [id, aggregateCombination(id, group)])) as Record<CombinationId, CombinationAggregate>;
  const errorCounts = emptyCounts(ERROR_KINDS);
  for (const run of runs) if (run.errorKind !== null) errorCounts[run.errorKind] += 1;
  return { runs: [...runs], combinations, errorCount: Object.values(errorCounts).reduce((sum, count) => sum + count, 0), errorCounts };
}
