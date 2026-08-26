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
  return { pairCount: pairs.length, pairs };
}
