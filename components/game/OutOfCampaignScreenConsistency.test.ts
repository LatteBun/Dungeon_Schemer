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

/*
 * 확인 창은 화면 한가운데 선다.
 *
 * 모달 `dialog` 는 원래 `margin: auto` 로 가운데 서는데, Tailwind preflight 가
 * 모든 요소의 margin 을 0 으로 만들어 좌상단 (0,0) 에 붙어 있었다. 프레임워크가
 * 미는 값이라 되돌려 놓아도 조용히 다시 밀려날 수 있다.
 */
describe("업적 기록 초기화 확인 창", () => {
  const rule = (): string =>
    css("achievements.css").match(/\.achievement-screen__dialog\s*\{([^}]*)\}/)?.[1] ?? "";

  it("가운데 세우는 margin 을 되돌려 놓는다", () => {
    expect(rule()).toMatch(/margin:\s*auto/);
  });

  it("너비를 창이 아니라 캔버스에서 잡는다", () => {
    /* 최상위 층이라 컨테이너 질의가 없다. rem 은 캔버스에서 나오므로 rem 을 쓴다. */
    const width = rule().match(/width:\s*([^;]+)/)?.[1] ?? "";

    expect(width).not.toBe("");
    expect(width).not.toMatch(/\d(vw|vh)\b/);
    expect(width).not.toMatch(/cqw|cqh/);
    expect(width).toMatch(/rem/);
  });
});

describe("업적 저장 진단 창", () => {
  const sheet = (): string => css("achievements.css");

  it("달성 수 버튼은 상태 chip 모양 위에 브라우저 기본 버튼 판을 덧씌우지 않는다", () => {
    const rule = sheet().match(/\.achievement-screen__count\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(rule).toMatch(/border:\s*0/);
    expect(rule).toMatch(/background:\s*none/);
    expect(rule).toMatch(/font:\s*inherit/);
  });

  it("진단 창과 원문은 캔버스 안에서 넘침을 스크롤한다", () => {
    const dialog = sheet().match(/\.achievement-storage-diagnostics\s*\{([^}]*)\}/)?.[1] ?? "";
    const raw = sheet().match(/\.achievement-storage-diagnostics pre\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(dialog).toMatch(/max-height:/);
    expect(dialog).toMatch(/overflow:\s*hidden/);
    expect(raw).toMatch(/overflow:\s*auto/);
    expect(raw).toMatch(/white-space:\s*pre-wrap/);
  });
});
