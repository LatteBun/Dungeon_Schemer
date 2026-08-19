import { describe, expect, it } from "vitest";
import { validateThemes } from "@/lib/content/theme-validation";
import { selectThemeBoss, THEMES } from "@/lib/content/themes";
import type { RiskLevel } from "@/lib/domain";

describe("THEMES", () => {
  it("거미굴이 검증기를 통과한다", () => {
    expect(() => validateThemes(THEMES)).not.toThrow();
  });

  it("거미굴 하나만 있다", () => {
    // F2-2가 사막·묘지를 더할 때 이 숫자가 3으로 바뀐다.
    expect(THEMES).toHaveLength(1);
    expect(THEMES[0].id).toBe("spider");
  });
});

describe("selectThemeBoss", () => {
  const spider = THEMES[0];

  it.each<[RiskLevel, string]>([
    [1, "거대거미 라그나"],
    [2, "고치관리자 모르칸"],
    [3, "아라크네 세리나"],
    [4, "거미여왕 아라크샤"],
    [5, "거미여왕 아라크샤"],
  ])("위험도 ★%i는 %s를 만난다", (riskLevel, expectedName) => {
    expect(selectThemeBoss(spider, riskLevel).name).toBe(expectedName);
  });

  it("★4와 ★5가 같은 보스로 묶인다", () => {
    expect(selectThemeBoss(spider, 4).id).toBe(selectThemeBoss(spider, 5).id);
  });
});
