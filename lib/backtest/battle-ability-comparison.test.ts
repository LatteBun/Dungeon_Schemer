import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compareBattleAbilitySnapshots, snapshotForBattleAbilityComparison, writeBattleAbilitySnapshot } from "./battle-ability-comparison";
import type { CampaignRunMetrics } from "./metrics";

function run(seed: string, strategyId: "survival" | "opportunist" = "survival", accuracy: 0.4 | 0.7 = 0.7): CampaignRunMetrics {
  return {
    seed,
    strategyId,
    accuracy,
    battles: [{
      kind: "general",
      expeditionId: `exp-${seed}`,
      party: [{ characterId: "cleric" as never, classId: "cleric" as never, hpBefore: 12, hpAfter: 7, maxHp: 28 }],
      battle: { status: "victory", termination: "defeatedEnemies", rounds: 2, actions: [], party: [], enemies: [] },
    }],
  } as unknown as CampaignRunMetrics;
}

describe("전투 능력 기준선 snapshot", () => {
  it("seed·strategy·accuracy NUL 키로 정렬된 원시 전투 관측치를 만든다", () => {
    const snapshot = snapshotForBattleAbilityComparison([
      run("seed-b", "opportunist", 0.4),
      run("seed-a", "survival", 0.7),
    ]);

    expect(snapshot.runs.map((entry) => entry.key)).toEqual([
      "seed-a\u0000survival\u00000.7",
      "seed-b\u0000opportunist\u00000.4",
    ]);
    expect(snapshot.runs[0]).toMatchObject({
      battleCount: 1,
      battles: [{
        kind: "general",
        rounds: 2,
        termination: "defeatedEnemies",
        party: [{ classId: "cleric", hpBefore: 12, hpAfter: 7, maxHp: 28, aliveBefore: true, aliveAfter: true }],
      }],
    });
  });

  it("중복 안정 키와 전후 snapshot의 누락 짝을 거부한다", () => {
    expect(() => snapshotForBattleAbilityComparison([run("same"), run("same")]))
      .toThrow("중복된 backtest pair key");
    expect(() => compareBattleAbilitySnapshots(
      snapshotForBattleAbilityComparison([run("before")]),
      snapshotForBattleAbilityComparison([run("after")]),
    )).toThrow("짝이 없는 backtest pair key");
  });

  it("JSON 기준선을 기록하고 정확히 같은 안정 키끼리만 비교한다", () => {
    const directory = mkdtempSync(join(tmpdir(), "dungeon-schemer-battle-snapshot-"));
    const path = join(directory, "baseline.json");
    try {
      const before = writeBattleAbilitySnapshot(path, [run("same")]);
      expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(before);
      expect(compareBattleAbilitySnapshots(before, snapshotForBattleAbilityComparison([run("same")]))).toMatchObject({
        pairCount: 1,
        pairs: [expect.objectContaining({ key: "same\u0000survival\u00000.7" })],
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("같은 안정 키의 전후 전투 결과를 성직자 유무별 paired delta로 계산한다", () => {
    const before = snapshotForBattleAbilityComparison([run("with"), {
      ...run("without"),
      battles: [{ ...run("without").battles[0]!, party: [{ characterId: "warrior" as never, classId: "warrior" as never, hpBefore: 20, hpAfter: 10, maxHp: 20 }] }],
    }]);
    const after = snapshotForBattleAbilityComparison([{
      ...run("with"),
      battles: [{ ...run("with").battles[0]!, party: [{ characterId: "cleric" as never, classId: "cleric" as never, hpBefore: 12, hpAfter: 12, maxHp: 28 }] }],
    }, {
      ...run("without"),
      battles: [{ ...run("without").battles[0]!, party: [{ characterId: "warrior" as never, classId: "warrior" as never, hpBefore: 20, hpAfter: 10, maxHp: 20 }] }],
    }]);

    const comparison = compareBattleAbilitySnapshots(before, after);
    expect(comparison).toMatchObject({
      pairCount: 2,
      byCleric: {
        withCleric: { pairCount: 1, meanPartyHpAfterRatioDelta: expect.closeTo(5 / 28, 8) },
        withoutCleric: { pairCount: 1, unchangedPairCount: 1 },
      },
      withoutHealing: { pairCount: 2, unchangedPairCount: 1 },
    });
  });
});
