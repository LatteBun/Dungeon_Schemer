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
  it("업적 화면의 버튼은 공용 CTA 를 쓴다", () => {
    expect(tsx("AchievementScreen.tsx")).toContain("shell-cta");
  });

  it("공용 CTA 규칙이 두 화면을 함께 정의한다", () => {
    /* 살결이 한 곳에서 나와야 화면을 옮길 때 버튼이 달라 보이지 않는다. */
    const globals = css("globals.css");
    const rule = globals.match(/\.u6-settlement-continue,[\s\S]*?\{/)?.[0] ?? "";

    expect(rule).toContain(".u5-outcome-continue");
    expect(rule).toContain(".shell-cta");
  });

  it("일러스트 메인 메뉴의 액션 버튼은 불투명한 어두운 판을 쓴다", () => {
    /*
     * 승인된 명패 구도에서 버튼은 그림 위에 떠도 글자가 묻히지 않는 어두운 판이다.
     * `.main-menu-screen__action`의 배경을 지우거나 투명하게 바꾸면 이 검사가 실패한다.
     */
    const rule = css("main-menu.css").match(/\.main-menu-screen__action\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(rule).toMatch(/background:\s*linear-gradient\(180deg,\s*#171315\s+0%,\s*#090708\s+100%\)/);
  });

  it("메인 메뉴 단추 사이를 판 높이로 띄운다", () => {
    /*
     * 세로 간격의 퍼센트는 이 상자 자신의 높이를 기준으로 푼다. 그 높이는 결국
     * 단추를 쌓은 만큼이라, 예전의 `gap: 2.15%` 는 실제로 5px 로 풀렸다. 78px
     * 짜리 단추가 5px 을 사이에 두고 서면 테두리와 안쪽 그림자가 겹쳐 한 덩어리로
     * 읽힌다. 단추 높이가 `cqh` 로 잡혀 있으므로 간격도 같은 자를 써야 판이
     * 커지든 작아지든 비율이 유지된다.
     */
    const rule = css("main-menu.css").match(/\.main-menu-screen__actions\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(rule).toMatch(/gap:\s*[\d.]+cqh/);
    expect(rule).not.toMatch(/gap:\s*[\d.]+%/);
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

  it("일러스트 메인 메뉴는 업적 저장 요약을 별도로 그리지 않는다", () => {
    // 승인된 명패 구도에는 저장값을 표시할 자리가 없다.
    expect(tsx("MainMenuScreen.tsx")).not.toContain("ACHIEVEMENT_CATALOG.length");
    expect(tsx("MainMenuScreen.tsx")).not.toContain("unlockedCount");
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
