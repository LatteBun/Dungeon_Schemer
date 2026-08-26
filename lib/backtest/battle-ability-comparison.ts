import { writeFileSync } from "node:fs";
import type { Accuracy, StrategyId } from "./public-state";
import type { CampaignRunMetrics } from "./metrics";

export interface BacktestPairKey {
  readonly seed: string;
  readonly strategyId: StrategyId;
  readonly accuracy: Accuracy;
}

export interface BattleAbilitySnapshotBattle {
  readonly kind: "general" | "boss";
  readonly expeditionId: string;
  readonly status: "victory" | "wipe";
  readonly termination: "defeatedEnemies" | "partyWipe" | "roundLimit";
  readonly rounds: number;
  readonly healActions?: number;
  readonly actualHealing?: number;
  readonly party: readonly {
    readonly characterId: string;
    readonly classId: string;
    readonly hpBefore: number;
    readonly hpAfter: number;
    readonly maxHp: number;
    readonly aliveBefore: boolean;
    readonly aliveAfter: boolean;
  }[];
}

export interface BattleAbilitySnapshotRun extends BacktestPairKey {
  readonly key: string;
  readonly battleCount: number;
  readonly battles: readonly BattleAbilitySnapshotBattle[];
}

export interface BattleAbilitySnapshot {
  readonly version: 1;
  readonly runs: readonly BattleAbilitySnapshotRun[];
}

export interface BattleAbilitySnapshotComparison {
  readonly pairCount: number;
  readonly pairs: readonly {
    readonly key: string;
    readonly before: BattleAbilitySnapshotRun;
    readonly after: BattleAbilitySnapshotRun;
  }[];
  readonly byCleric: Readonly<Record<"withCleric" | "withoutCleric", {
    readonly pairCount: number;
    readonly unchangedPairCount: number;
    readonly battleVictoryRateDelta: number | null;
    readonly meanPartyHpAfterRatioDelta: number | null;
    readonly deathCountDelta: number;
    readonly meanRoundsDelta: number | null;
    readonly healActionDelta: number;
    readonly actualHealingDelta: number;
  }>>;
  readonly withoutHealing: {
    readonly pairCount: number;
    readonly unchangedPairCount: number;
  };
  readonly controls: Readonly<Record<"nonHolder" | "nonTrigger", {
    readonly pairCount: number;
    readonly unchangedPairCount: number;
  }>>;
}

export function serializeBacktestPairKey(key: BacktestPairKey): string {
  return `${key.seed}\u0000${key.strategyId}\u0000${key.accuracy}`;
}

function snapshotRunFor(run: CampaignRunMetrics): BattleAbilitySnapshotRun {
  const key = { seed: run.seed, strategyId: run.strategyId, accuracy: run.accuracy };
  const battles = run.battles.map((entry) => ({
    kind: entry.kind,
    expeditionId: entry.expeditionId,
    status: entry.battle.status,
    termination: entry.battle.termination,
    rounds: entry.battle.rounds,
    healActions: entry.battle.actions.filter((action) => action.kind === "heal").length,
    actualHealing: entry.battle.actions.reduce((sum, action) => sum + (action.kind === "heal" ? action.healing : 0), 0),
    party: entry.party.map((member) => ({
      characterId: member.characterId,
      classId: member.classId,
      hpBefore: member.hpBefore,
      hpAfter: member.hpAfter,
      maxHp: member.maxHp,
      aliveBefore: member.hpBefore > 0,
      aliveAfter: member.hpAfter > 0,
    })),
  }));
  return { ...key, key: serializeBacktestPairKey(key), battleCount: battles.length, battles };
}

function validateUniqueRuns(runs: readonly BattleAbilitySnapshotRun[]): void {
  const seen = new Set<string>();
  for (const run of runs) {
    if (seen.has(run.key)) throw new Error(`중복된 backtest pair key: ${run.key}`);
    seen.add(run.key);
  }
}

export function snapshotForBattleAbilityComparison(runs: readonly CampaignRunMetrics[]): BattleAbilitySnapshot {
  const snapshotRuns = runs.map(snapshotRunFor).sort((left, right) => left.key.localeCompare(right.key));
  validateUniqueRuns(snapshotRuns);
  return { version: 1, runs: snapshotRuns };
}

export function writeBattleAbilitySnapshot(path: string, runs: readonly CampaignRunMetrics[]): BattleAbilitySnapshot {
  const snapshot = snapshotForBattleAbilityComparison(runs);
  writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return snapshot;
}

export function compareBattleAbilitySnapshots(
  before: BattleAbilitySnapshot,
  after: BattleAbilitySnapshot,
): BattleAbilitySnapshotComparison {
  validateUniqueRuns(before.runs);
  validateUniqueRuns(after.runs);
  const afterByKey = new Map(after.runs.map((run) => [run.key, run]));
  const beforeKeys = new Set(before.runs.map((run) => run.key));
  for (const run of before.runs) {
    if (!afterByKey.has(run.key)) throw new Error(`짝이 없는 backtest pair key: ${run.key}`);
  }
  for (const run of after.runs) {
    if (!beforeKeys.has(run.key)) throw new Error(`짝이 없는 backtest pair key: ${run.key}`);
  }
  const pairs = before.runs.map((run) => ({ key: run.key, before: run, after: afterByKey.get(run.key)! }));
  const summarize = (run: BattleAbilitySnapshotRun) => {
    const parties = run.battles.flatMap((battle) => battle.party);
    return {
      hasCleric: parties.some((member) => member.classId === "cleric"),
      victoryRate: run.battles.length === 0 ? null : run.battles.filter((battle) => battle.status === "victory").length / run.battles.length,
      hpRatio: parties.length === 0 ? null : parties.reduce((sum, member) => sum + member.hpAfter / member.maxHp, 0) / parties.length,
      deaths: parties.filter((member) => member.aliveBefore && !member.aliveAfter).length,
      rounds: run.battles.length === 0 ? null : run.battles.reduce((sum, battle) => sum + battle.rounds, 0) / run.battles.length,
      heals: run.battles.reduce((sum, battle) => sum + (battle.healActions ?? 0), 0),
      healing: run.battles.reduce((sum, battle) => sum + (battle.actualHealing ?? 0), 0),
    };
  };
  const semanticBattles = (run: BattleAbilitySnapshotRun) => run.battles.map((battle) => ({
    ...battle,
    healActions: battle.healActions ?? 0,
    actualHealing: battle.actualHealing ?? 0,
  }));
  const controlBattlePairs = pairs.flatMap((pair) => pair.after.battles.flatMap((afterBattle, index) => {
    const beforeBattle = pair.before.battles[index];
    return beforeBattle === undefined || beforeBattle.kind !== afterBattle.kind || beforeBattle.expeditionId !== afterBattle.expeditionId
      ? []
      : [{ before: beforeBattle, after: afterBattle }];
  }));
  const hasNoHealingEffect = (battle: BattleAbilitySnapshotBattle) =>
    (battle.healActions ?? 0) === 0 && (battle.actualHealing ?? 0) === 0;
  const control = (predicate: (battle: BattleAbilitySnapshotBattle) => boolean) => {
    const selected = controlBattlePairs.filter((pair) => predicate(pair.before) && predicate(pair.after));
    return {
      pairCount: selected.length,
      unchangedPairCount: selected.filter((pair) => hasNoHealingEffect(pair.before) && hasNoHealingEffect(pair.after)).length,
    };
  };
  const group = (withCleric: boolean) => {
    const selected = pairs.filter((pair) => summarize(pair.before).hasCleric || summarize(pair.after).hasCleric ? withCleric : !withCleric);
    const deltas = selected.map((pair) => ({ before: summarize(pair.before), after: summarize(pair.after), pair }));
    const nullableDelta = (selector: (value: ReturnType<typeof summarize>) => number | null): number | null => {
      const values = deltas.flatMap(({ before: left, after: right }) => {
        const beforeValue = selector(left);
        const afterValue = selector(right);
        return beforeValue === null || afterValue === null ? [] : [afterValue - beforeValue];
      });
      return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
    };
    return {
      pairCount: selected.length,
      unchangedPairCount: selected.filter(({ before: left, after: right }) => JSON.stringify(semanticBattles(left)) === JSON.stringify(semanticBattles(right))).length,
      battleVictoryRateDelta: nullableDelta((value) => value.victoryRate),
      meanPartyHpAfterRatioDelta: nullableDelta((value) => value.hpRatio),
      deathCountDelta: deltas.reduce((sum, value) => sum + value.after.deaths - value.before.deaths, 0),
      meanRoundsDelta: nullableDelta((value) => value.rounds),
      healActionDelta: deltas.reduce((sum, value) => sum + value.after.heals - value.before.heals, 0),
      actualHealingDelta: deltas.reduce((sum, value) => sum + value.after.healing - value.before.healing, 0),
    };
  };
  const withoutHealing = pairs.filter((pair) => summarize(pair.after).heals === 0);
  return {
    pairCount: pairs.length,
    pairs,
    byCleric: { withCleric: group(true), withoutCleric: group(false) },
    withoutHealing: {
      pairCount: withoutHealing.length,
      unchangedPairCount: withoutHealing.filter((pair) => JSON.stringify(semanticBattles(pair.before)) === JSON.stringify(semanticBattles(pair.after))).length,
    },
    controls: {
      nonHolder: control((battle) => !battle.party.some((member) => member.classId === "cleric")),
      nonTrigger: control((battle) => battle.party.some((member) => member.classId === "cleric") && (battle.healActions ?? 0) === 0),
    },
  };
}
