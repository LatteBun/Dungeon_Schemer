import { describe, expect, it } from "vitest";
import { GRAVEYARD_THEME } from "@/lib/content/themes";
import { GRAVEYARD_EVENTS } from "@/lib/content/events/graveyard-events";
import { validateSituationEvents } from "@/lib/content/situation-validation";

describe("GRAVEYARD_EVENTS", () => {
  it("묘지 사건 30개를 제공한다", () => {
    expect(GRAVEYARD_EVENTS).toHaveLength(30);
    expect(GRAVEYARD_EVENTS.filter((event) => event.kind === "monster")).toHaveLength(18);
    expect(GRAVEYARD_EVENTS.filter((event) => event.kind === "special" && event.targetBossId === undefined)).toHaveLength(4);
    expect(GRAVEYARD_EVENTS.filter((event) => event.targetBossId !== undefined)).toHaveLength(8);
    expect(GRAVEYARD_EVENTS.every((event) => event.theme === "graveyard")).toBe(true);
    expect(GRAVEYARD_EVENTS.filter((event) => event.requiresClue !== undefined)).toHaveLength(2);
    expect(() => validateSituationEvents(GRAVEYARD_EVENTS, GRAVEYARD_THEME)).not.toThrow();
  });

  it("생태 규칙 6개가 기본 조언에서 도움·방해를 두 개씩 공급한다", () => {
    for (const rule of GRAVEYARD_THEME.rules) {
      const options = GRAVEYARD_EVENTS.flatMap((event) => event.advice).filter(
        (option) => option.source?.kind === "ecology" && option.source.ruleId === rule.id,
      );
      expect(options.filter((option) => option.outcome === "help").length).toBeGreaterThanOrEqual(2);
      expect(options.filter((option) => option.outcome === "harm").length).toBeGreaterThanOrEqual(2);
    }
  });

  it("보스별 정보 사건이 두 개씩 있다", () => {
    const counts = new Map<string, number>();
    for (const event of GRAVEYARD_EVENTS) {
      if (event.targetBossId !== undefined) {
        counts.set(event.targetBossId, (counts.get(event.targetBossId) ?? 0) + 1);
      }
    }
    expect([...counts.keys()].toSorted()).toEqual([
      "boss-graveyard-1",
      "boss-graveyard-2",
      "boss-graveyard-3",
      "boss-graveyard-4",
    ]);
    expect([...counts.values()]).toEqual([2, 2, 2, 2]);
  });

  it("보스 정보 조언은 BossRuleId source를 가진다", () => {
    for (const event of GRAVEYARD_EVENTS.filter((candidate) => candidate.targetBossId !== undefined)) {
      expect(event.advice.filter((option) => option.outcome !== "neutral").every((option) => option.source?.kind === "boss")).toBe(true);
    }
  });

  it("약한 연계와 강한 연계를 정확히 연결한다", () => {
    const find = (id: string) => GRAVEYARD_EVENTS.find((event) => event.id === id);

    expect(find("graveyard-silence-zombie-bell")?.revealsClue).toBe("clue-graveyard-zombie-sound");
    expect(find("graveyard-silence-rusted-chain")?.upgrades?.[0].clueId).toBe("clue-graveyard-zombie-sound");
    expect(find("graveyard-light-mage-lantern")?.revealsClue).toBe("clue-graveyard-mage-light");
    expect(find("graveyard-light-mage-two-candles")?.requiresClue).toBe("clue-graveyard-mage-light");
    expect(find("graveyard-archer-light-retreat")?.revealsClue).toBe("clue-graveyard-archer-shadow");
    expect(find("graveyard-desecration-archer-shadow")?.requiresClue).toBe("clue-graveyard-archer-shadow");
  });
});
