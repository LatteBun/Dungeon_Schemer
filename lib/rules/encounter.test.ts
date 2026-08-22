import { describe, expect, it } from "vitest";
import { resolveEncounter, expandEncounter } from "@/lib/rules/encounter";
import type { MonsterId } from "@/lib/domain";

const monster = (id: string) => id as MonsterId;

describe("encounter 수정", () => {
  it("base에서 remove한 뒤 기존 위치와 새 그룹 순서로 add한다", () => {
    const resolved = resolveEncounter({
      base: { enemies: [
        { monsterId: monster("mage"), count: 2 },
        { monsterId: monster("archer"), count: 1 },
      ] },
      modifier: {
        removeEnemies: [{ monsterId: monster("mage"), count: 2 }],
        addEnemies: [
          { monsterId: monster("archer"), count: 1 },
          { monsterId: monster("rogue"), count: 1 },
        ],
      },
      activeMonsterIds: [monster("mage"), monster("archer"), monster("rogue")],
    });

    expect(resolved.groups).toEqual([
      { monsterId: "archer", count: 2 },
      { monsterId: "rogue", count: 1 },
    ]);
    expect(expandEncounter(resolved).map((enemy) => enemy.id)).toEqual([
      "archer#1", "archer#2", "rogue#1",
    ]);
  });

  it("avoidCombat은 전투 적을 만들지 않는다", () => {
    const resolved = resolveEncounter({
      base: { enemies: [{ monsterId: monster("mage"), count: 1 }] },
      modifier: { avoidCombat: true },
      activeMonsterIds: [monster("mage")],
    });
    expect(resolved.avoidCombat).toBe(true);
    expect(expandEncounter(resolved)).toEqual([]);
  });
});
