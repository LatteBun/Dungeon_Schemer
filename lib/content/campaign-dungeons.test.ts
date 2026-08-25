import { describe, expect, it } from "vitest";
import { INITIAL_DUNGEON_SLOTS } from "@/lib/content/campaign-dungeons";
import type { ThemeId } from "@/lib/domain";

const EXPECTED_RISK_BY_THEME: Readonly<Record<ThemeId, readonly number[]>> = {
  spider: [1, 1, 2, 3, 4],
  desert: [1, 2, 2, 3, 4],
  graveyard: [2, 3, 3, 4, 5],
};

const EXPECTED_NAME_BY_ID = {
  "dungeon-spider-01": "라그나의 산란굴",
  "dungeon-spider-02": "라그나의 검은실굴",
  "dungeon-spider-03": "모르칸의 사체길",
  "dungeon-spider-04": "세리나의 그림자굴",
  "dungeon-spider-05": "아라크샤의 왕좌",
  "dungeon-desert-01": "자카르의 불탄 우물",
  "dungeon-desert-02": "카르둠의 바람길",
  "dungeon-desert-03": "카르둠의 매장로",
  "dungeon-desert-04": "오벨론의 순례길",
  "dungeon-desert-05": "네프리스의 황무지",
  "dungeon-graveyard-01": "모르비안의 묘문",
  "dungeon-graveyard-02": "아즈라엘의 납골당",
  "dungeon-graveyard-03": "아즈라엘의 묘역",
  "dungeon-graveyard-04": "발드라크의 사냥터",
  "dungeon-graveyard-05": "발드라크의 왕묘",
} as const;

const EXPECTED_SLOTS = [
  ["dungeon-spider-01", "라그나의 산란굴", "spider", 1, 1],
  ["dungeon-spider-02", "라그나의 검은실굴", "spider", 1, 2],
  ["dungeon-spider-03", "모르칸의 사체길", "spider", 2, 3],
  ["dungeon-spider-04", "세리나의 그림자굴", "spider", 3, 4],
  ["dungeon-spider-05", "아라크샤의 왕좌", "spider", 4, 5],
  ["dungeon-desert-01", "자카르의 불탄 우물", "desert", 1, 6],
  ["dungeon-desert-02", "카르둠의 바람길", "desert", 2, 7],
  ["dungeon-desert-03", "카르둠의 매장로", "desert", 2, 8],
  ["dungeon-desert-04", "오벨론의 순례길", "desert", 3, 9],
  ["dungeon-desert-05", "네프리스의 황무지", "desert", 4, 10],
  ["dungeon-graveyard-01", "모르비안의 묘문", "graveyard", 2, 11],
  ["dungeon-graveyard-02", "아즈라엘의 납골당", "graveyard", 3, 12],
  ["dungeon-graveyard-03", "아즈라엘의 묘역", "graveyard", 3, 13],
  ["dungeon-graveyard-04", "발드라크의 사냥터", "graveyard", 4, 14],
  ["dungeon-graveyard-05", "발드라크의 왕묘", "graveyard", 5, 15],
] as const;

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
    }

    expect(
      Object.fromEntries(INITIAL_DUNGEON_SLOTS.map(({ id, name }) => [id, name])),
    ).toEqual(EXPECTED_NAME_BY_ID);

    expect(
      INITIAL_DUNGEON_SLOTS.map(({ id, name, theme, initialRiskLevel, campaignOrder }) => [
        id,
        name,
        theme,
        initialRiskLevel,
        campaignOrder,
      ]),
    ).toEqual(EXPECTED_SLOTS);
  });

  it("전체 초기 위험도 빈도가 문서의 3·4·4·3·1 매트릭스와 같다", () => {
    const counts = new Map<number, number>();
    for (const slot of INITIAL_DUNGEON_SLOTS) {
      counts.set(slot.initialRiskLevel, (counts.get(slot.initialRiskLevel) ?? 0) + 1);
    }
    expect([1, 2, 3, 4, 5].map((risk) => counts.get(risk) ?? 0)).toEqual([3, 4, 4, 3, 1]);
  });
});
