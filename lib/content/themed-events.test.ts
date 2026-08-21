import { describe, expect, it } from "vitest";
import { DESERT_EVENTS } from "@/lib/content/events/desert-events";
import { GRAVEYARD_EVENTS } from "@/lib/content/events/graveyard-events";
import { SPIDER_EVENTS } from "@/lib/content/events/spider-events";

const THEMED_EVENTS = [...SPIDER_EVENTS, ...DESERT_EVENTS, ...GRAVEYARD_EVENTS];

describe("테마 전용 사건 전역 계약", () => {
  it("세 테마 전용 사건 90개의 식별자와 문구가 전역에서 유일하다", () => {
    expect(THEMED_EVENTS).toHaveLength(90);
    expect(new Set(THEMED_EVENTS.map((event) => event.id)).size).toBe(90);
    expect(new Set(THEMED_EVENTS.flatMap((event) => event.advice.map((advice) => advice.id))).size).toBe(270);
    expect(new Set(THEMED_EVENTS.map((event) => event.title)).size).toBe(90);
    expect(new Set(THEMED_EVENTS.map((event) => event.description)).size).toBe(90);
  });
});
