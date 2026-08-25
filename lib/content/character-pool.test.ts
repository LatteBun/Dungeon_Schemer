import { describe, expect, it } from "vitest";
import { generateCharacterPool } from "@/lib/content/character-pool";
import { CLASSES } from "@/lib/content/classes";
import { CHARACTER_ROSTER } from "@/lib/content/character-roster";
import { createRng } from "@/lib/rng";
import {
  CHARACTER_POOL_SIZE,
  CHARACTERS_PER_CLASS,
  CHARACTERS_PER_PERSONALITY,
  PERSONALITIES,
  TRUST_MAX,
  TRUST_MIN,
} from "@/lib/domain";

function countBy<T extends string>(values: readonly T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

describe("generateCharacterPool", () => {
  it("30명을 생성한다", () => {
    const pool = generateCharacterPool(createRng("f4-pool-1"));
    expect(pool.order).toHaveLength(CHARACTER_POOL_SIZE);
    expect(Object.keys(pool.byId)).toHaveLength(CHARACTER_POOL_SIZE);
  });

  it("직업마다 정확히 6명이다", () => {
    const pool = generateCharacterPool(createRng("f4-pool-2"));
    const characters = pool.order.map((id) => pool.byId[id]);
    const counts = countBy(characters.map((character) => character.classId));
    for (const classDef of CLASSES) {
      expect(counts.get(classDef.id)).toBe(CHARACTERS_PER_CLASS);
    }
  });

  it("성격마다 정확히 6명이다", () => {
    const pool = generateCharacterPool(createRng("f4-pool-3"));
    const characters = pool.order.map((id) => pool.byId[id]);
    const counts = countBy(characters.map((character) => character.personality));
    for (const personality of PERSONALITIES) {
      expect(counts.get(personality)).toBe(CHARACTERS_PER_PERSONALITY);
    }
  });

  it("이름과 ID가 풀 안에서 중복되지 않는다", () => {
    const pool = generateCharacterPool(createRng("f4-pool-4"));
    const characters = pool.order.map((id) => pool.byId[id]);
    expect(new Set(characters.map((c) => c.name)).size).toBe(CHARACTER_POOL_SIZE);
    expect(new Set(pool.order).size).toBe(CHARACTER_POOL_SIZE);
  });

  it("직업별 최대 HP로 시작하고 현재 HP가 최대 HP와 같다", () => {
    const pool = generateCharacterPool(createRng("f4-pool-5"));
    for (const id of pool.order) {
      const character = pool.byId[id];
      const classDef = CLASSES.find((c) => c.id === character.classId);
      expect(classDef).toBeDefined();
      expect(character.maxHp).toBe(classDef?.maxHp);
      expect(character.hp).toBe(character.maxHp);
    }
  });

  it("신뢰는 0~100 범위 안이고 골드는 20~45 범위 안이다", () => {
    const pool = generateCharacterPool(createRng("f4-pool-6"));
    for (const id of pool.order) {
      const character = pool.byId[id];
      expect(character.trust).toBeGreaterThanOrEqual(TRUST_MIN);
      expect(character.trust).toBeLessThanOrEqual(TRUST_MAX);
      expect(character.gold).toBeGreaterThanOrEqual(20);
      expect(character.gold).toBeLessThanOrEqual(45);
    }
  });

  it("생존해 있고 중상이 아닌 상태로 시작한다", () => {
    const pool = generateCharacterPool(createRng("f4-pool-7"));
    for (const id of pool.order) {
      const character = pool.byId[id];
      expect(character.alive).toBe(true);
      expect(character.gravelyWounded).toBe(false);
    }
  });

  it("같은 시드는 같은 풀을 만든다", () => {
    const poolA = generateCharacterPool(createRng("f4-pool-repro"));
    const poolB = generateCharacterPool(createRng("f4-pool-repro"));
    expect(poolA).toEqual(poolB);
  });

  it("시드가 달라도 모든 인물의 ID·이름·직업은 공식 로스터와 같다", () => {
    const first = generateCharacterPool(createRng("fixed-roster-a"));
    const second = generateCharacterPool(createRng("fixed-roster-b"));

    for (const entry of CHARACTER_ROSTER) {
      expect(first.byId[entry.id]).toMatchObject({
        id: entry.id,
        name: entry.name,
        classId: entry.classId,
      });
      expect(second.byId[entry.id]).toMatchObject({
        id: entry.id,
        name: entry.name,
        classId: entry.classId,
      });
    }
  });

  it("다른 시드는 다른 배정을 만든다", () => {
    const poolA = generateCharacterPool(createRng("f4-pool-seed-a"));
    const poolB = generateCharacterPool(createRng("f4-pool-seed-b"));
    expect(poolA.byId).not.toEqual(poolB.byId);
  });

  it("성별은 로스터 메타데이터에만 두고 런타임 캐릭터 상태에는 복사하지 않는다", () => {
    const pool = generateCharacterPool(createRng("fixed-roster-gender-boundary"));

    for (const entry of CHARACTER_ROSTER) {
      expect(pool.byId[entry.id]).not.toHaveProperty("gender");
    }
  });
});
