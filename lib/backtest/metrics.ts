import type { AdviceOutcome, CampaignState, EndingKind, GuideRank, InfoReaction } from "@/lib/domain";
import type { CampaignRun, RunErrorKind } from "./campaign-driver";
import type { Accuracy, PublicNodeCategory, StrategyId } from "./public-state";

export type CombinationId = `${StrategyId}@${Accuracy}`;

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

export interface CombinationAggregate {
  readonly id: CombinationId;
  readonly count: number;
  readonly completedCount: number;
  readonly rankSCount: number;
  readonly endingCounts: Readonly<Record<EndingKind | "run-error", number>>;
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
const NODE_CATEGORIES: readonly PublicNodeCategory[] = ["rest", "merchant", "special", "monster", "boss"];
const OUTCOMES: readonly AdviceOutcome[] = ["help", "harm", "neutral"];
const REACTIONS: readonly InfoReaction[] = ["accepted", "suspected", "exposed"];

function baseFailure(run: Extract<CampaignRun, { ok: false }>): CampaignRunMetrics {
  return {
    seed: run.trace.seed, strategyId: run.trace.strategyId, accuracy: run.trace.accuracy,
    ending: "run-error", completed: false, finalRank: "C", reachedRankS: false,
    totalExpeditions: 0, clearedExpeditions: 0, wipedExpeditions: 0, totalDeaths: 0,
    aliveCount: 0, deployableCount: 0, zeroTrustCount: 0, gravelyWoundedCount: 0,
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
  };
}

function successfulMetrics(campaign: CampaignState, run: Extract<CampaignRun, { ok: true }>): CampaignRunMetrics {
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
    ending: campaign.ending?.kind ?? "unemployed", completed: campaign.ending?.kind === "completed",
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

function aggregateCombination(id: CombinationId, runs: readonly CampaignRunMetrics[]): CombinationAggregate {
  if (runs.length === 0) throw new AggregationError(`조합 표본이 없다: ${id}`);
  const endingCounts = emptyCounts(ENDINGS);
  for (const run of runs) endingCounts[run.ending] += 1;
  const sum = (selector: (run: CampaignRunMetrics) => number) => runs.reduce((total, run) => total + selector(run), 0) / runs.length;
  return {
    id, count: runs.length, completedCount: runs.filter((run) => run.completed).length,
    rankSCount: runs.filter((run) => run.reachedRankS).length, endingCounts,
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
