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

  it("각 테마는 위험도와 의미적으로 맞물린 생태 패키지 5개를 가진다", () => {
    for (const theme of THEMES) {
      expect(theme.ecologyProfiles).toHaveLength(5);
      for (const profile of theme.ecologyProfiles) {
        expect(profile.theme).toBe(theme.id);
        expect(profile.activeRuleIds).toHaveLength(3);
        expect(profile.activeMonsterIds.length).toBeGreaterThan(0);
        const activeRules = profile.activeRuleIds.map((id) =>
          theme.rules.find((rule) => rule.id === id),
        );
        expect(activeRules.every((rule) => rule !== undefined)).toBe(true);
        const hasConditionalRule = activeRules.some((rule) => rule?.conditional);
        expect(hasConditionalRule).toBe(profile.initialRiskLevel >= 4);
      }
    }
  });

  it("각 테마는 세 후보 환경 특성과 패키지별 태그 참조를 가진다", () => {
    for (const theme of THEMES) {
      expect(theme.publicEnvironmentTags).toHaveLength(3);
      expect(new Set(theme.publicEnvironmentTags.map((tag) => tag.id)).size).toBe(3);
      expect(theme.ecologyProfiles.every((profile) =>
        theme.publicEnvironmentTags.some((tag) => tag.id === profile.publicEnvironmentTagId),
      )).toBe(true);
    }
  });

  it("15개 생태 패키지의 공개 환경 특성 매핑이 고정돼 있다", () => {
    const labelsByProfileId = Object.fromEntries(
      THEMES.flatMap((theme) =>
        theme.ecologyProfiles.map((profile) => [
          profile.id,
          theme.publicEnvironmentTags.find(
            (tag) => tag.id === profile.publicEnvironmentTagId,
          )?.label,
        ]),
      ),
    );

    expect(labelsByProfileId).toEqual({
      "spider-shallow-a": "진동 경계",
      "spider-shallow-b": "어둠 잠복",
      "spider-carrion-route": "시체 흔적",
      "spider-dark-passage": "어둠 잠복",
      "spider-queens-forecourt": "어둠 잠복",
      "desert-scorched-well": "수분 지대",
      "desert-wind-well": "열기 노출",
      "desert-buried-trail": "발자국 소실",
      "desert-dry-trail": "수분 지대",
      "desert-burning-waste": "열기 노출",
      "graveyard-quiet-guard": "매장물 수호",
      "graveyard-dim-crypt": "빛 노출",
      "graveyard-grave-robber": "매장물 수호",
      "graveyard-hunters": "소리 경계",
      "graveyard-blighted-tomb": "소리 경계",
    });
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
