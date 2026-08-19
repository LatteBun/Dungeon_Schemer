import { describe, expect, it } from "vitest";
import { validateThemes } from "@/lib/content/theme-validation";
import { selectThemeBoss, THEMES } from "@/lib/content/themes";
import type { ThemeId, RiskLevel } from "@/lib/domain";

function themeOf(id: ThemeId) {
  const theme = THEMES.find((candidate) => candidate.id === id);
  if (theme === undefined) throw new Error(`fixture 오류: ${id} 테마가 없다`);
  return theme;
}

describe("THEMES", () => {
  it("세 테마 전체가 검증기를 통과한다", () => {
    expect(() => validateThemes(THEMES)).not.toThrow();
  });

  it("거미굴·사막·묘지 세 테마가 있다", () => {
    expect(THEMES).toHaveLength(3);
    expect(THEMES.map((theme) => theme.id).toSorted()).toEqual([
      "desert",
      "graveyard",
      "spider",
    ]);
  });
});

describe("selectThemeBoss", () => {
  it.each<[ThemeId, RiskLevel, string]>([
    ["spider", 1, "거대거미 라그나"],
    ["spider", 2, "고치관리자 모르칸"],
    ["spider", 3, "아라크네 세리나"],
    ["spider", 4, "거미여왕 아라크샤"],
    ["spider", 5, "거미여왕 아라크샤"],
    ["desert", 1, "거대 전갈 자카르"],
    ["desert", 2, "샌드웜 카르둠"],
    ["desert", 3, "모래거신 오벨론"],
    ["desert", 4, "스핑크스 네프리스"],
    ["desert", 5, "스핑크스 네프리스"],
    ["graveyard", 1, "스켈레톤 장군 바르칸"],
    ["graveyard", 2, "리치 모르비안"],
    ["graveyard", 3, "사신 아즈라엘"],
    ["graveyard", 4, "데스나이트 발드라크"],
    ["graveyard", 5, "데스나이트 발드라크"],
  ])("%s 위험도 ★%i는 %s를 만난다", (themeId, riskLevel, expectedName) => {
    expect(selectThemeBoss(themeOf(themeId), riskLevel).name).toBe(expectedName);
  });

  it.each<ThemeId>(["spider", "desert", "graveyard"])(
    "%s는 ★4와 ★5가 같은 보스로 묶인다",
    (themeId) => {
      const theme = themeOf(themeId);
      expect(selectThemeBoss(theme, 4).id).toBe(selectThemeBoss(theme, 5).id);
    },
  );
});
