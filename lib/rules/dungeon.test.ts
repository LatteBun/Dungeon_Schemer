import { describe, expect, it } from "vitest";
import { EVENT_KINDS } from "@/lib/domain";
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";

describe("던전 이벤트 기본 콘텐츠", () => {
  it("일반 네 분류에 이벤트가 두 개 이상 있다", () => {
    for (const kind of EVENT_KINDS) {
      expect(DUNGEON_EVENT_POOLS.regular[kind].length).toBeGreaterThanOrEqual(2);
      expect(
        DUNGEON_EVENT_POOLS.regular[kind].every((event) => event.kind === kind),
      ).toBe(true);
    }
  });

  it("보스 풀은 special 이벤트를 하나 이상 가진다", () => {
    expect(DUNGEON_EVENT_POOLS.boss.length).toBeGreaterThan(0);
    expect(DUNGEON_EVENT_POOLS.boss.every((event) => event.kind === "special")).toBe(true);
  });

  it("모든 이벤트와 선택지 식별자가 고유하고 선택지가 완전하다", () => {
    const events = [
      ...EVENT_KINDS.flatMap((kind) => DUNGEON_EVENT_POOLS.regular[kind]),
      ...DUNGEON_EVENT_POOLS.boss,
    ];
    expect(new Set(events.map((event) => event.id)).size).toBe(events.length);
    const choices = events.flatMap((event) => event.choices);
    expect(new Set(choices.map((choice) => choice.id)).size).toBe(choices.length);
    for (const event of events) expect(event.choices.length).toBeGreaterThan(0);
    for (const choice of choices) {
      expect(choice.expectedGain.trim()).not.toBe("");
      expect(choice.knownRisk.trim()).not.toBe("");
      expect(choice.target?.kind).not.toBe("member");
    }
  });
});
