import { describe, expect, it } from "vitest";
import { DESERT_THEME } from "@/lib/content/themes";
import { DESERT_EVENTS } from "@/lib/content/events/desert-events";
import { validateSituationEvents } from "@/lib/content/situation-validation";

describe("DESERT_EVENTS", () => {
  it("사막 사건 30개를 제공한다", () => {
    expect(DESERT_EVENTS).toHaveLength(30);
    expect(DESERT_EVENTS.filter((event) => event.kind === "monster")).toHaveLength(18);
    expect(DESERT_EVENTS.filter((event) => event.kind === "special" && event.targetBossId === undefined)).toHaveLength(4);
    expect(DESERT_EVENTS.filter((event) => event.targetBossId !== undefined)).toHaveLength(8);
    expect(DESERT_EVENTS.every((event) => event.theme === "desert")).toBe(true);
    expect(DESERT_EVENTS.filter((event) => event.requiresClue !== undefined)).toHaveLength(2);
    expect(() => validateSituationEvents(DESERT_EVENTS, DESERT_THEME)).not.toThrow();
  });

  it("생태 규칙 6개가 기본 조언에서 도움·방해를 두 개씩 공급한다", () => {
    for (const rule of DESERT_THEME.rules) {
      const options = DESERT_EVENTS.flatMap((event) => event.advice).filter(
        (option) => option.source?.kind === "ecology" && option.source.ruleId === rule.id,
      );
      expect(options.filter((option) => option.outcome === "help").length).toBeGreaterThanOrEqual(2);
      expect(options.filter((option) => option.outcome === "harm").length).toBeGreaterThanOrEqual(2);
    }
  });

  it("보스별 정보 사건이 두 개씩 있다", () => {
    const counts = new Map<string, number>();
    for (const event of DESERT_EVENTS) {
      if (event.targetBossId !== undefined) {
        counts.set(event.targetBossId, (counts.get(event.targetBossId) ?? 0) + 1);
      }
    }
    expect([...counts.keys()].toSorted()).toEqual([
      "boss-desert-1",
      "boss-desert-2",
      "boss-desert-3",
      "boss-desert-4",
    ]);
    expect([...counts.values()]).toEqual([2, 2, 2, 2]);
  });

  it("보스 정보 조언은 공통 modifier를 가진다", () => {
    for (const event of DESERT_EVENTS.filter((candidate) => candidate.targetBossId !== undefined)) {
      expect(event.advice.map((option) => option.bossDamageModifier).toSorted((left, right) => (left ?? 0) - (right ?? 0))).toEqual([
        -0.2,
        -0.1,
        0.25,
      ]);
    }
  });

  it("약한 연계와 강한 연계를 정확히 연결한다", () => {
    const find = (id: string) => DESERT_EVENTS.find((event) => event.id === id);

    expect(find("desert-heat-moving-shadow")?.revealsClue).toBe("clue-desert-cobra-shade");
    expect(find("desert-heat-torn-canopy")?.upgrades?.[0].clueId).toBe("clue-desert-cobra-shade");
    expect(find("desert-water-damp-well")?.revealsClue).toBe("clue-desert-scorpion-damp-burrow");
    expect(find("desert-water-leaking-cargo")?.requiresClue).toBe("clue-desert-scorpion-damp-burrow");
    expect(find("desert-mummy-silent-tomb")?.revealsClue).toBe("clue-desert-mummy-no-tracks");
    expect(find("desert-wind-mummy-courtyard")?.requiresClue).toBe("clue-desert-mummy-no-tracks");
  });
});
