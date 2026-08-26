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
  readonly actions: readonly BattleAbilitySnapshotAction[];
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

export type BattleAbilitySnapshotAction =
  | {
      readonly kind: "attack";
      readonly round: number;
      readonly actorSide: "party" | "enemy";
      readonly actorId: string;
      readonly targetId: string;
      readonly damage: number;
      readonly defeated: boolean;
      readonly targetHpBefore: number;
      readonly targetHpAfter: number;
    }
  | {
      readonly kind: "heal";
      readonly round: number;
      readonly actorSide: "party";
      readonly actorId: string;
      readonly targetId: string;
      readonly abilityKind: "emergencyHeal";
      readonly healing: number;
      readonly targetHpBefore: number;
      readonly targetHpAfter: number;
    };

export interface BattleAbilitySnapshotRun extends BacktestPairKey {
  readonly key: string;
  readonly battleCount: number;
  readonly battles: readonly BattleAbilitySnapshotBattle[];
}

export interface BattleAbilitySnapshot {
  readonly version: 2;
  readonly runs: readonly BattleAbilitySnapshotRun[];
}

export interface BattleAbilitySnapshotComparison {
  readonly pairCount: number;
  readonly pairs: readonly {
    readonly key: string;
    readonly before: BattleAbilitySnapshotRun;
    readonly after: BattleAbilitySnapshotRun;
  }[];
  readonly byCleric: Readonly<Record<"withCleric" | "withoutCleric" | "compositionChanged", {
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
    actions: entry.battle.actions.map((action) => ({ ...action })),
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
  return { version: 2, runs: snapshotRuns };
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
  const summarize = (battle: BattleAbilitySnapshotBattle) => {
    const parties = battle.party;
    return {
      hasCleric: parties.some((member) => member.classId === "cleric"),
      victoryRate: battle.status === "victory" ? 1 : 0,
      hpRatio: parties.length === 0 ? null : parties.reduce((sum, member) => sum + member.hpAfter / member.maxHp, 0) / parties.length,
      deaths: parties.filter((member) => member.aliveBefore && !member.aliveAfter).length,
      rounds: battle.rounds,
      heals: battle.healActions ?? 0,
      healing: battle.actualHealing ?? 0,
    };
  };
  const semanticAction = (action: BattleAbilitySnapshotAction): BattleAbilitySnapshotAction => action.kind === "heal"
    ? {
        kind: "heal",
        round: action.round,
        actorSide: "party",
        actorId: action.actorId,
        targetId: action.targetId,
        abilityKind: action.abilityKind,
        healing: action.healing,
        targetHpBefore: action.targetHpBefore,
        targetHpAfter: action.targetHpAfter,
      }
    : {
        kind: "attack",
        round: action.round,
        actorSide: action.actorSide,
        actorId: action.actorId,
        targetId: action.targetId,
        damage: action.damage,
        defeated: action.defeated,
        targetHpBefore: action.targetHpBefore,
        targetHpAfter: action.targetHpAfter,
      };
  const semanticBattle = (battle: BattleAbilitySnapshotBattle) => ({
    kind: battle.kind,
    expeditionId: battle.expeditionId,
    status: battle.status,
    termination: battle.termination,
    rounds: battle.rounds,
    actions: battle.actions.map(semanticAction),
    party: battle.party.map((member) => ({ ...member })),
    healActions: battle.healActions ?? 0,
    actualHealing: battle.actualHealing ?? 0,
  });
  const indexedBattles = (run: BattleAbilitySnapshotRun) => {
    const occurrences = new Map<string, number>();
    return run.battles.map((battle, index) => {
      const baseKey = `${battle.expeditionId}\u0000${battle.kind}`;
      const occurrence = occurrences.get(baseKey) ?? 0;
      occurrences.set(baseKey, occurrence + 1);
      return { key: `${baseKey}\u0000${occurrence}`, battle, index };
    });
  };
  const battlePairs = pairs.flatMap((pair) => {
    const beforeBattles = indexedBattles(pair.before);
    const afterBattles = indexedBattles(pair.after);
    const firstHealingBefore = beforeBattles.findIndex((entry) => summarize(entry.battle).heals > 0);
    const firstHealingAfter = afterBattles.findIndex((entry) => summarize(entry.battle).heals > 0);
    const beforeControlLimit = firstHealingBefore < 0 ? Number.POSITIVE_INFINITY : firstHealingBefore;
    const afterControlLimit = firstHealingAfter < 0 ? Number.POSITIVE_INFINITY : firstHealingAfter;
    const afterByBattleKey = new Map(afterBattles.map((entry) => [entry.key, entry]));
    return beforeBattles.flatMap((entry) => {
      const afterEntry = afterByBattleKey.get(entry.key);
      return afterEntry === undefined ? [] : [{
        key: `${pair.key}\u0000${entry.key}`,
        before: entry.battle,
        after: afterEntry.battle,
        controlEligible: entry.index < beforeControlLimit && afterEntry.index < afterControlLimit,
      }];
    });
  });
  const battlesEqual = (left: BattleAbilitySnapshotBattle, right: BattleAbilitySnapshotBattle) =>
    JSON.stringify(semanticBattle(left)) === JSON.stringify(semanticBattle(right));
  const control = (predicate: (battle: BattleAbilitySnapshotBattle) => boolean) => {
    const selected = battlePairs.filter((pair) => pair.controlEligible && predicate(pair.before) && predicate(pair.after));
    return {
      pairCount: selected.length,
      unchangedPairCount: selected.filter((pair) => battlesEqual(pair.before, pair.after)).length,
    };
  };
  const group = (stratum: "withCleric" | "withoutCleric" | "compositionChanged") => {
    const selected = battlePairs.filter((pair) => {
      const beforeHasCleric = summarize(pair.before).hasCleric;
      const afterHasCleric = summarize(pair.after).hasCleric;
      if (stratum === "compositionChanged") return beforeHasCleric !== afterHasCleric;
      return stratum === "withCleric"
        ? beforeHasCleric && afterHasCleric
        : !beforeHasCleric && !afterHasCleric;
    });
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
      unchangedPairCount: selected.filter(({ before: left, after: right }) => battlesEqual(left, right)).length,
      battleVictoryRateDelta: nullableDelta((value) => value.victoryRate),
      meanPartyHpAfterRatioDelta: nullableDelta((value) => value.hpRatio),
      deathCountDelta: deltas.reduce((sum, value) => sum + value.after.deaths - value.before.deaths, 0),
      meanRoundsDelta: nullableDelta((value) => value.rounds),
      healActionDelta: deltas.reduce((sum, value) => sum + value.after.heals - value.before.heals, 0),
      actualHealingDelta: deltas.reduce((sum, value) => sum + value.after.healing - value.before.healing, 0),
    };
  };
  const withoutHealing = battlePairs.filter((pair) => summarize(pair.before).heals === 0 && summarize(pair.after).heals === 0);
  return {
    pairCount: pairs.length,
    pairs,
    byCleric: {
      withCleric: group("withCleric"),
      withoutCleric: group("withoutCleric"),
      compositionChanged: group("compositionChanged"),
    },
    withoutHealing: {
      pairCount: withoutHealing.length,
      unchangedPairCount: withoutHealing.filter((pair) => battlesEqual(pair.before, pair.after)).length,
    },
    controls: {
      nonHolder: control((battle) => !battle.party.some((member) => member.classId === "cleric")),
      nonTrigger: control((battle) => battle.party.some((member) => member.classId === "cleric") && (battle.healActions ?? 0) === 0),
    },
  };
}
