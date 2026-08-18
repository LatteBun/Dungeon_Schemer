import { describe, expect, it } from "vitest";
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
import { INFO_CARDS } from "@/lib/content/info-cards";
import { ITEMS } from "@/lib/content/items";
import { BOSSES } from "@/lib/content/bosses";
import { CARDS_PER_COMBINATION } from "@/lib/content/validation";
import { EVENT_KINDS, GRADES, INFO_SUBJECTS, ITEM_KINDS, TRUTH_TYPES } from "@/lib/domain";
import { RuleError } from "@/lib/domain";
import type { BossDef, DungeonEvent, EventKind, InfoCard, ItemDef } from "@/lib/domain";
import { validateContentPools } from "@/lib/content/validation";

describe("F2 콘텐츠 정상 풀", () => {
  it("일반 사건 20개를 네 분류별 5개로 제공한다", () => {
    // S급 지도가 사건 지점 16개를 서로 다른 사건으로 채워야 한다. 여유가 없으면
    // 자유 깊이의 분류 선택이 한 가지로 정해져 시드가 의미를 잃는다.
    expect(EVENT_KINDS.every((kind) => DUNGEON_EVENT_POOLS.regular[kind].length === 5)).toBe(true);
    expect(EVENT_KINDS.flatMap((kind) => DUNGEON_EVENT_POOLS.regular[kind])).toHaveLength(20);
  });

  it("모든 사건의 선택지가 두 개 이상이다", () => {
    const events = [
      ...EVENT_KINDS.flatMap((kind) => DUNGEON_EVENT_POOLS.regular[kind]),
      ...DUNGEON_EVENT_POOLS.boss,
    ];
    expect(events.every((event) => event.choices.length >= 2)).toBe(true);
  });

  it("카드·아이템·보스의 요구 수량을 제공한다", () => {
    expect(INFO_CARDS).toHaveLength(INFO_SUBJECTS.length * TRUTH_TYPES.length * CARDS_PER_COMBINATION);
    for (const truthType of TRUTH_TYPES) {
      expect(INFO_CARDS.filter((card) => card.truthType === truthType))
        .toHaveLength(INFO_SUBJECTS.length * CARDS_PER_COMBINATION);
    }
    expect(ITEMS.map((item) => item.kind)).toEqual(expect.arrayContaining([...ITEM_KINDS]));
    expect(BOSSES.map((boss) => boss.grade)).toEqual([...GRADES]);
  });

  // 조합 하나가 비면 그 지점에서 제시할 카드가 없어지고, 진위 하나가 비면 그
  // 진위의 보스 피해 보정이 실제 플레이에서 발생하지 않는다.
  it("주제와 진위의 모든 조합에 같은 장수를 제공한다", () => {
    const missing: string[] = [];
    for (const subject of INFO_SUBJECTS) {
      for (const truthType of TRUTH_TYPES) {
        const actual = INFO_CARDS.filter(
          (card) => card.subject === subject && card.truthType === truthType,
        ).length;
        if (actual !== CARDS_PER_COMBINATION) {
          missing.push(`${subject}/${truthType}: ${actual}장`);
        }
      }
    }

    expect(missing, `${CARDS_PER_COMBINATION}장이 아닌 조합`).toEqual([]);
  });

  it("카드 식별자와 본문이 중복되지 않는다", () => {
    expect(new Set(INFO_CARDS.map((card) => card.id)).size).toBe(INFO_CARDS.length);
    expect(new Set(INFO_CARDS.map((card) => card.text)).size).toBe(INFO_CARDS.length);
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

  it("주제·진위 조합의 장수가 어긋난 카드 풀을 거부한다", () => {
    const short = mutablePools();
    short.cards = short.cards.filter(
      (card) => !(card.subject === "rest" && card.truthType === "neutral"),
    );
    expect(expectInvalid(short).message).toMatch(/rest|중립|neutral/);

    const extra = mutablePools();
    extra.cards = [
      ...extra.cards,
      { ...extra.cards[0], id: "card-extra" as InfoCard["id"], text: "여분 카드" },
    ];
    expectInvalid(extra);
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
