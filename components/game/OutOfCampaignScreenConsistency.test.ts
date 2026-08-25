import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 캠페인 바깥 화면도 같은 게임처럼 보여야 한다.
 *
 * 루트 메뉴와 업적 기록은 상단 상태 바가 없어 공용 셸을 통째로 쓸 수 없다.
 * 그래서 버튼도 바탕도 제목도 따로 그려 두었는데, 밝은 금색 판과 초록기 도는
 * 바탕이라 게임에서 나갔다가 다른 앱에 들어온 것처럼 보였다. 셸을 못 쓰더라도
 * 어휘는 같이 쓴다.
 */

const root = (...parts: string[]) => join(process.cwd(), ...parts);
const css = (name: string) => readFileSync(root("app", name), "utf8");
const tsx = (name: string) => readFileSync(root("components", "game", name), "utf8");

describe("캠페인 바깥 화면의 통일성", () => {
  it("버튼은 공용 CTA 를 쓴다", () => {
    for (const name of ["MainMenuScreen.tsx", "AchievementScreen.tsx"]) {
      expect(tsx(name), name).toContain("shell-cta");
    }
  });

  it("공용 CTA 규칙이 두 화면을 함께 정의한다", () => {
    /* 살결이 한 곳에서 나와야 화면을 옮길 때 버튼이 달라 보이지 않는다. */
    const globals = css("globals.css");
    const rule = globals.match(/\.u6-settlement-continue,[\s\S]*?\{/)?.[0] ?? "";

    expect(rule).toContain(".u5-outcome-continue");
    expect(rule).toContain(".shell-cta");
  });

  it("두 화면이 버튼 살결을 다시 그리지 않는다", () => {
    /*
     * 자리와 크기는 화면이 정해도 되지만 배경 판을 다시 깔면 안 된다.
     * 예전에는 밝은 금색 gradient 와 회색 gradient 를 각각 그려 두었다.
     *
     * 카드 액자와 진행 막대는 버튼이 아니므로 버튼 규칙만 본다.
     */
    const buttonRules = (name: string): readonly string[] => {
      const sheet = css(name);
      const selectors = /^\.(main-menu-screen__(start|achievements)|achievement-screen__actions[^{,]*)[^{]*\{([^}]*)\}/gm;
      return [...sheet.matchAll(selectors)].map((one) => one[3] ?? "");
    };

    for (const name of ["main-menu.css", "achievements.css"]) {
      const redrawn = buttonRules(name).filter((rule) => /background:/.test(rule));
      expect(redrawn, name).toEqual([]);
    }
  });

  it("업적 화면의 제목이 셸의 제목 토큰을 쓴다", () => {
    const rule = css("achievements.css").match(/\.achievement-screen__header h1\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(rule).toContain("var(--shell-title-size)");
    expect(rule).toContain("#e5c77f");
  });

  it("업적 화면이 제 바탕을 따로 칠하지 않는다", () => {
    // 초록기 도는 radial-gradient 가 이 화면만 다른 앱처럼 보이게 했다.
    const rule = css("achievements.css").match(/^\.achievement-screen\s*\{([^}]*)\}/m)?.[1] ?? "";

    expect(rule).not.toMatch(/background:/);
  });

  it("업적 총 개수를 글자로 박지 않는다", () => {
    // 업적을 늘리면 메뉴의 숫자가 조용히 어긋난다.
    expect(tsx("MainMenuScreen.tsx")).toContain("ACHIEVEMENT_CATALOG.length");
    expect(tsx("MainMenuScreen.tsx")).not.toMatch(/달성 [^`"]*\/ \d/);
  });
});
