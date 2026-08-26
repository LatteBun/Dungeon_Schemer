import { describe, expect, it } from "vitest";
import { CLASSES } from "@/lib/content/classes";

describe("CLASSES", () => {
  it("직업 5종이다", () => {
    expect(CLASSES).toHaveLength(5);
  });

  it("직업 ID가 서로 중복되지 않는다", () => {
    const ids = CLASSES.map((classDef) => classDef.id);
    expect(new Set(ids).size).toBe(CLASSES.length);
  });

  it("모든 직업이 이름·설명을 갖고 maxHp·attack·hitWeight가 양수다", () => {
    for (const classDef of CLASSES) {
      expect(classDef.name.trim()).not.toBe("");
      expect(classDef.description.trim()).not.toBe("");
      expect(classDef.maxHp).toBeGreaterThan(0);
      expect(classDef.attack).toBeGreaterThan(0);
      expect(classDef.hitWeight).toBeGreaterThan(0);
    }
  });

  it("성직자만 확정된 응급 치유 능력을 가진다", () => {
    const cleric = CLASSES.find((classDef) => classDef.id === "cleric");

    expect(cleric?.battleAbility).toEqual({
      kind: "emergencyHeal",
      name: "치유 기도",
      healTargetMaxHpPercent: 25,
      usesPerExpedition: 2,
      triggerAtOrBelowHpPercent: 50,
    });
    expect(CLASSES.filter((classDef) => classDef.id !== "cleric")).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ battleAbility: expect.anything() })]),
    );
  });
});
