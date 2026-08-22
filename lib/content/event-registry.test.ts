import { describe, expect, it } from "vitest";
import { eventsForTheme, allSituationEvents } from "@/lib/content/event-registry";
import { THEMES } from "@/lib/content/themes";

describe("E3 사건 registry", () => {
  it("테마 registry는 monster 사건에 실행 가능한 encounter를 제공한다", () => {
    const event = eventsForTheme("spider").find((candidate) => candidate.kind === "monster");
    if (event?.kind !== "monster") throw new Error("monster 사건이 없다");
    expect(event.encounter?.enemies.length).toBeGreaterThan(0);
    expect(event.encounterModifier).toBeDefined();
    expect(event.advice.every((option) => option.encounterModifier !== undefined)).toBe(true);
  });

  it("전체 registry의 ID는 유일하다", () => {
    const events = allSituationEvents();
    expect(events.length).toBeGreaterThan(0);
    expect(new Set(events.map((event) => event.id)).size).toBe(events.length);
  });

  it("등록된 테마 수가 콘텐츠 테마 수와 같다", () => {
    expect(THEMES.map((theme) => theme.id)).toContain("spider");
  });
});
