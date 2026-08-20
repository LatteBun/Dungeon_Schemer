import { describe, expect, it } from "vitest";
import { INITIAL_DUNGEON_SLOTS } from "@/lib/content/campaign-dungeons";
import type { ThemeId } from "@/lib/domain";

const EXPECTED_RISK_BY_THEME: Readonly<Record<ThemeId, readonly number[]>> = {
  spider: [1, 1, 2, 3, 4],
  desert: [1, 2, 2, 3, 4],
  graveyard: [2, 3, 3, 4, 5],
};

describe("INITIAL_DUNGEON_SLOTS", () => {
  it("세 테마의 고정 슬롯 15개를 번호순으로 제공한다", () => {
    expect(INITIAL_DUNGEON_SLOTS).toHaveLength(15);
    expect(new Set(INITIAL_DUNGEON_SLOTS.map((slot) => slot.id)).size).toBe(15);

    for (const theme of ["spider", "desert", "graveyard"] as const) {
      const slots = INITIAL_DUNGEON_SLOTS.filter((slot) => slot.theme === theme);
      expect(slots).toHaveLength(5);
      expect(slots.map((slot) => slot.initialRiskLevel)).toEqual(EXPECTED_RISK_BY_THEME[theme]);
      expect(slots.map((slot) => slot.id)).toEqual(
        [1, 2, 3, 4, 5].map((number) => `dungeon-${theme}-${String(number).padStart(2, "0")}`),
      );
      expect(slots.map((slot) => slot.name)).toEqual(
        [1, 2, 3, 4, 5].map((number) => `${theme === "spider" ? "거미굴" : theme === "desert" ? "사막" : "묘지"} ${number}`),
      );
    }
  });

  it("전체 초기 위험도 빈도가 문서의 3·4·4·3·1 매트릭스와 같다", () => {
    const counts = new Map<number, number>();
    for (const slot of INITIAL_DUNGEON_SLOTS) {
      counts.set(slot.initialRiskLevel, (counts.get(slot.initialRiskLevel) ?? 0) + 1);
    }
    expect([1, 2, 3, 4, 5].map((risk) => counts.get(risk) ?? 0)).toEqual([3, 4, 4, 3, 1]);
  });
});
