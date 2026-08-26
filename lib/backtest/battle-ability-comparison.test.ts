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
      battle: {
        status: "victory", termination: "defeatedEnemies", rounds: 2,
        actions: [{
          kind: "attack", round: 1, actorSide: "party", actorId: "cleric", targetId: "enemy",
          damage: 5, defeated: true, targetHpBefore: 5, targetHpAfter: 0,
        }],
        party: [], enemies: [],
      },
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
        actions: [{ kind: "attack", actorSide: "party", damage: 5 }],
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

  it("한 실행 안의 전투를 원정과 순서로 맞춘 뒤 성직자 유무를 전투별로 층화한다", () => {
    const nonClericBattle = {
      ...run("mixed").battles[0]!,
      expeditionId: "exp-without-cleric",
      party: [{ characterId: "warrior" as never, classId: "warrior" as never, hpBefore: 20, hpAfter: 15, maxHp: 20 }],
    };
    const clericBattle = {
      ...run("mixed").battles[0]!,
      expeditionId: "exp-with-cleric",
    };
    const mixedRun = { ...run("mixed"), battles: [nonClericBattle, clericBattle] };

    const comparison = compareBattleAbilitySnapshots(
      snapshotForBattleAbilityComparison([mixedRun]),
      snapshotForBattleAbilityComparison([mixedRun]),
    );

    expect(comparison.byCleric).toMatchObject({
      withCleric: { pairCount: 1, unchangedPairCount: 1 },
      withoutCleric: { pairCount: 1, unchangedPairCount: 1 },
    });
  });

  it("첫 치유 뒤의 비성직자 전투는 직접 불변 control에서 제외한다", () => {
    const healed = {
      ...run("causal").battles[0]!,
      expeditionId: "exp-with-cleric",
      battle: {
        ...run("causal").battles[0]!.battle,
        actions: [{
          kind: "heal" as const, round: 1, actorSide: "party" as const, actorId: "cleric", targetId: "cleric",
          abilityKind: "emergencyHeal" as const, healing: 5, targetHpBefore: 7, targetHpAfter: 12,
        }],
      },
    };
    const laterControl = {
      ...run("causal").battles[0]!,
      expeditionId: "exp-without-cleric",
      party: [{ characterId: "warrior" as never, classId: "warrior" as never, hpBefore: 20, hpAfter: 15, maxHp: 20 }],
    };
    const before = { ...run("causal"), battles: [{ ...healed, battle: { ...healed.battle, actions: [] } }, laterControl] };
    const after = { ...run("causal"), battles: [healed, { ...laterControl, battle: { ...laterControl.battle, rounds: 3 } }] };

    const comparison = compareBattleAbilitySnapshots(
      snapshotForBattleAbilityComparison([before]),
      snapshotForBattleAbilityComparison([after]),
    );

    expect(comparison.byCleric.withoutCleric.pairCount).toBe(1);
    expect(comparison.controls.nonHolder).toEqual({ pairCount: 0, unchangedPairCount: 0 });
  });

  it("전후 원정의 성직자 포함 여부가 바뀐 전투를 두 주층에서 분리한다", () => {
    const beforeRun = {
      ...run("composition-changed"),
      battles: [{
        ...run("composition-changed").battles[0]!,
        party: [{ characterId: "warrior" as never, classId: "warrior" as never, hpBefore: 20, hpAfter: 15, maxHp: 20 }],
      }],
    };
    const afterRun = run("composition-changed");

    const comparison = compareBattleAbilitySnapshots(
      snapshotForBattleAbilityComparison([beforeRun]),
      snapshotForBattleAbilityComparison([afterRun]),
    );

    expect(comparison.byCleric).toMatchObject({
      withCleric: { pairCount: 0 },
      withoutCleric: { pairCount: 0 },
      compositionChanged: { pairCount: 1 },
    });
  });

  it("구현 전 암묵적 공격과 구현 후 attack 판별자를 같은 행동으로 정규화한다", () => {
    const after = snapshotForBattleAbilityComparison([run("legacy-attack")]);
    const battle = after.runs[0]!.battles[0]!;
    const attack = battle.actions[0]!;
    if (attack.kind !== "attack") throw new Error("공격 fixture가 아니다");
    const legacyAttack = {
      round: attack.round,
      actorSide: attack.actorSide,
      actorId: attack.actorId,
      targetId: attack.targetId,
      damage: attack.damage,
      defeated: attack.defeated,
      targetHpBefore: attack.targetHpBefore,
      targetHpAfter: attack.targetHpAfter,
    };
    const before = {
      ...after,
      runs: [{ ...after.runs[0]!, battles: [{ ...battle, actions: [legacyAttack as never] }] }],
    };

    expect(compareBattleAbilitySnapshots(before, after).controls.nonTrigger)
      .toEqual({ pairCount: 1, unchangedPairCount: 1 });
  });

  it("라운드가 같아도 공격 행동이 달라지면 불변 control로 세지 않는다", () => {
    const before = snapshotForBattleAbilityComparison([run("changed-action")]);
    const battle = before.runs[0]!.battles[0]!;
    const attack = battle.actions[0]!;
    if (attack.kind !== "attack") throw new Error("공격 fixture가 아니다");
    const after = {
      ...before,
      runs: [{
        ...before.runs[0]!,
        battles: [{ ...battle, actions: [{ ...attack, damage: attack.damage + 1 }] }],
      }],
    };

    expect(compareBattleAbilitySnapshots(before, after).controls.nonTrigger)
      .toEqual({ pairCount: 1, unchangedPairCount: 0 });
  });
});
