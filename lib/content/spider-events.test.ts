import { describe, expect, it } from "vitest";
import { SPIDER_THEME } from "@/lib/content/themes";
import { SPIDER_EVENTS } from "@/lib/content/events/spider-events";
import { validateSituationEvents } from "@/lib/content/situation-validation";

describe("SPIDER_EVENTS", () => {
  it("거미굴 사건 30개를 제공한다", () => {
    expect(SPIDER_EVENTS).toHaveLength(30);
    expect(SPIDER_EVENTS.filter((event) => event.kind === "monster")).toHaveLength(18);
    expect(SPIDER_EVENTS.filter((event) => event.kind === "special" && event.targetBossId === undefined)).toHaveLength(4);
    expect(SPIDER_EVENTS.filter((event) => event.targetBossId !== undefined)).toHaveLength(8);
    expect(SPIDER_EVENTS.every((event) => event.theme === "spider")).toBe(true);
  });

  it("보스별 정보 사건이 두 개씩 있다", () => {
    const counts = new Map<string, number>();
    for (const event of SPIDER_EVENTS) {
      if (event.targetBossId !== undefined) {
        counts.set(event.targetBossId, (counts.get(event.targetBossId) ?? 0) + 1);
      }
    }
    expect([...counts.keys()].toSorted()).toEqual([
      "boss-spider-1",
      "boss-spider-2",
      "boss-spider-3",
      "boss-spider-4",
    ]);
    expect([...counts.values()]).toEqual([2, 2, 2, 2]);
  });

  it("생태 규칙 6개가 도움·방해를 두 개씩 공급한다", () => {
    for (const rule of SPIDER_THEME.rules) {
      const options = SPIDER_EVENTS.flatMap((event) => event.advice).filter(
        (option) => option.source?.kind === "ecology" && option.source.ruleId === rule.id,
      );
      expect(options.filter((option) => option.outcome === "help").length).toBeGreaterThanOrEqual(2);
      expect(options.filter((option) => option.outcome === "harm").length).toBeGreaterThanOrEqual(2);
    }
  });

  it("약한 연계와 강한 연계를 포함한다", () => {
    expect(SPIDER_EVENTS.some((event) => event.upgrades?.length)).toBe(true);
    expect(SPIDER_EVENTS.filter((event) => event.requiresClue !== undefined)).toHaveLength(2);
    expect(SPIDER_EVENTS.find((event) => event.id === "spider-vibration-pebble")?.revealsClue)
      .toBe("clue-spider-vibration-response");
    expect(SPIDER_EVENTS.find((event) => event.id === "spider-vibration-stone-floor")?.upgrades?.[0].clueId)
      .toBe("clue-spider-vibration-response");
  });

  it("보스 정보 조언은 공통 modifier를 가진다", () => {
    for (const event of SPIDER_EVENTS.filter((candidate) => candidate.targetBossId !== undefined)) {
      expect(event.advice.map((option) => option.bossDamageModifier).toSorted((left, right) => (left ?? 0) - (right ?? 0))).toEqual([
        -0.2,
        -0.1,
        0.25,
      ]);
    }
  });

  it("범용 검증기의 거미굴 테마 모드를 통과한다", () => {
    expect(() => validateSituationEvents(SPIDER_EVENTS, SPIDER_THEME)).not.toThrow();
  });
});
