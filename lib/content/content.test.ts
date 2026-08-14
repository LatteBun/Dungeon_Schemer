import { describe, expect, it } from "vitest";
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
import { INFO_CARDS } from "@/lib/content/info-cards";
import { ITEMS } from "@/lib/content/items";
import { BOSSES } from "@/lib/content/bosses";
import { EVENT_KINDS, GRADES, ITEM_KINDS, TRUTH_TYPES } from "@/lib/domain";
import { RuleError } from "@/lib/domain";
import type { BossDef, DungeonEvent, EventKind, InfoCard, ItemDef } from "@/lib/domain";
import { validateContentPools } from "@/lib/content/validation";

describe("F2 콘텐츠 정상 풀", () => {
  it("일반 사건 12개를 네 분류별 3개로 제공한다", () => {
    expect(EVENT_KINDS.every((kind) => DUNGEON_EVENT_POOLS.regular[kind].length === 3)).toBe(true);
    expect(EVENT_KINDS.flatMap((kind) => DUNGEON_EVENT_POOLS.regular[kind])).toHaveLength(12);
  });

  it("모든 사건의 선택지가 두 개 이상이다", () => {
    const events = [
      ...EVENT_KINDS.flatMap((kind) => DUNGEON_EVENT_POOLS.regular[kind]),
      ...DUNGEON_EVENT_POOLS.boss,
    ];
    expect(events.every((event) => event.choices.length >= 2)).toBe(true);
  });

  it("카드·아이템·보스의 요구 수량을 제공한다", () => {
    expect(INFO_CARDS).toHaveLength(12);
    for (const truthType of TRUTH_TYPES) {
      expect(INFO_CARDS.filter((card) => card.truthType === truthType)).toHaveLength(4);
    }
    expect(INFO_CARDS.filter((card) => card.subject === "boss").length).toBeGreaterThanOrEqual(2);
    expect(ITEMS.map((item) => item.kind)).toEqual(expect.arrayContaining([...ITEM_KINDS]));
    expect(BOSSES.map((boss) => boss.grade)).toEqual([...GRADES]);
  });

  // 보스 주제에 진위가 하나라도 빠지면 그 진위의 보스 피해 보정이 실제
  // 플레이에서 한 번도 발생하지 않는다. 규칙만 있고 도달할 수 없는 상태가 된다.
  it("보스 주제 카드가 진실·거짓·중립을 모두 갖는다", () => {
    const bossCards = INFO_CARDS.filter((card) => card.subject === "boss");

    expect(new Set(bossCards.map((card) => card.truthType)))
      .toEqual(new Set(TRUTH_TYPES));
  });

  it("보스가 아닌 주제도 세 진위를 모두 갖는다", () => {
    const otherCards = INFO_CARDS.filter((card) => card.subject !== "boss");

    expect(new Set(otherCards.map((card) => card.truthType)))
      .toEqual(new Set(TRUTH_TYPES));
  });
});

function validPools() {
  return {
    events: structuredClone(DUNGEON_EVENT_POOLS),
    cards: structuredClone(INFO_CARDS),
    items: structuredClone(ITEMS),
    bosses: structuredClone(BOSSES),
  };
}

type MutablePools = {
  events: { regular: Record<EventKind, DungeonEvent[]>; boss: DungeonEvent[] };
  cards: InfoCard[];
  items: ItemDef[];
  bosses: BossDef[];
};

function mutablePools(): MutablePools {
  return structuredClone(validPools()) as MutablePools;
}

function expectInvalid(pools: MutablePools) {
  try {
    validateContentPools(pools);
    throw new Error("검증이 실패해야 한다.");
  } catch (error) {
    expect(error).toBeInstanceOf(RuleError);
    expect((error as RuleError).code).toBe("INVALID_GENERATION");
    return error as RuleError;
  }
}

describe("F2 콘텐츠 validator", () => {
  it("사건 ID 중복을 구조화 오류로 거부한다", () => {
    const pools = mutablePools();
    pools.events.regular.rest[0].id = pools.events.regular.monster[0].id;
    expectInvalid(pools);
  });

  it("부족한 사건·보스 카드·아이템 종류를 거부하고 입력을 바꾸지 않는다", () => {
    const pools = mutablePools();
    const snapshot = structuredClone(pools);
    pools.events.regular.special = pools.events.regular.special.slice(0, 2);
    pools.cards = pools.cards.filter((card) => card.subject !== "boss");
    pools.items = pools.items.filter((item) => item.kind !== "lure");
    expectInvalid(pools);
    expect(pools.events.regular.monster).toEqual(snapshot.events.regular.monster);
  });

  it("보스 대상 선택지와 잘못된 수치를 거부한다", () => {
    const pools = mutablePools();
    pools.events.regular.special[0].choices[0].target = { kind: "boss" };
    pools.items[0].price = -1;
    pools.bosses[0].baseDamage = 0;
    const error = expectInvalid(pools);
    expect(error.details).toHaveProperty("contentType");
  });
});
  it("정상 콘텐츠 풀을 통과시키며 입력을 변형하지 않는다", () => {
    const pools = mutablePools();
    const snapshot = structuredClone(pools);
    expect(() => validateContentPools(pools)).not.toThrow();
    expect(pools).toEqual(snapshot);
  });
