import { describe, expect, it } from "vitest";
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
import { INFO_CARDS } from "@/lib/content/info-cards";
import { ITEMS } from "@/lib/content/items";
import { BOSSES } from "@/lib/content/bosses";
import { EVENT_KINDS, GRADES, ITEM_KINDS, TRUTH_TYPES } from "@/lib/domain";

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
});
