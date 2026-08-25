import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** U5 화면이 고정 캔버스와 공용 요소 규칙을 지키는지 고정한다. */

const progressCss = readFileSync(join(process.cwd(), "app", "u5-progress.css"), "utf8");
const battleCss = readFileSync(join(process.cwd(), "app", "u5-battle.css"), "utf8");

/** 주석은 규칙이 아니다. 주석에 속성 이름을 적었다고 걸리면 안 된다. */
function declarations(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("U5 고정 캔버스 계약", () => {
  it("창을 가리키는 단위를 쓰지 않는다", () => {
    for (const source of [progressCss, battleCss]) {
      expect(source).not.toMatch(/\d(vw|vh)\b/);
    }
  });

  it("미디어 쿼리를 넣지 않는다", () => {
    for (const source of [progressCss, battleCss]) {
      expect(source).not.toContain("@media");
    }
  });

  it("상단 상태 바를 다시 선언하지 않는다", () => {
    expect(progressCss).not.toContain("game-shell__status");
    expect(battleCss).not.toContain("game-shell__status");
    expect(battleCss).not.toContain(".u5-party");
  });

  it("레이아웃에 등록되어 있다", () => {
    const layout = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8");

    expect(layout).toContain('import "./u5-progress.css"');
    expect(layout).toContain('import "./u5-battle.css"');
  });

  it("전투 장면을 슬롯에 꽉 채우되 화면 이름으로 슬롯을 다시 잡지 않는다", () => {
    const hostRule = battleCss.match(/\.u5-battle-host\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(hostRule).toContain("position: relative");
    expect(hostRule).toContain("overflow: hidden");
    expect(battleCss).not.toContain(".u5-battle-preview .u5-scene");
  });

  /*
   * 컨테이너는 globals.css 의 고정 캔버스 하나뿐이다.
   *
   * .u5-battle-host 가 container-type: size 를 들고 있었다. 그러면 안쪽 cqh 가
   * 1080px 캔버스가 아니라 362px 짜리 장면 슬롯을 기준으로 잡는다. 1cqh 가
   * 10.8px 에서 3.62px 로 줄어드는 바람에 u5-battle.css 의 cqh 18곳이 전부
   * clamp 하한에 박혀, 적어 둔 값이 하나도 살아 있지 않았다. 스프라이트는
   * 123px, 이름은 8.96px, HP 숫자는 7.68px 로 나왔다. 한 화면 안에서는 그저
   * 작아 보일 뿐이라 눈으로 찾기 어려운 종류의 어긋남이다.
   *
   * @container 질의를 쓰게 되면 그때 이 검사를 다시 논의한다. 지금은 없다.
   */
  it("캔버스 말고 다른 컨테이너를 만들지 않는다", () => {
    const sheets = readdirSync(join(process.cwd(), "app")).filter((name) => name.endsWith(".css"));
    const offenders = sheets
      .filter((name) => name !== "globals.css")
      .filter((name) => /container-(type|name)\s*:/.test(declarations(readFileSync(join(process.cwd(), "app", name), "utf8"))));

    expect(offenders).toEqual([]);
  });

  /* 조언 세 개가 슬롯별로 다른 모양이 되면 계약이 깨진다. */
  it("조언에 슬롯별 변형 규칙을 두지 않는다", () => {
    expect(progressCss).not.toMatch(/u5-advice[^{]*:nth-child/);
    expect(progressCss).not.toMatch(/u5-advice--/);
  });
});

/*
 * 넘어가는 버튼은 화면 바닥에 붙는다.
 *
 * `.u5-right-panel` 은 `auto minmax(0,1fr) auto` 로 파티를 위에, 버튼을 아래에
 * 두려 한다. 그런데 감싸는 `.game-shell__right-panel` 이 `align-content: start`
 * 로 내용 높이에 묶여 있어 가운데 칸이 0 이 되었다. 버튼이 파티 카드 바로 밑에
 * 붙고 그 아래로 460px 이 빈 채 남았다.
 */
describe("U5 우측 패널이 화면 높이를 다 쓴다", () => {
  const progressCss = readFileSync("app/u5-progress.css", "utf8");

  /*
   * 한 선택자가 여러 규칙에 나온다 — 목록으로 묶인 것까지 포함해서다.
   * 처음 걸린 것만 보면 엉뚱한 블록을 읽으므로 전부 모으고, 최종 값은
   * 나중에 온 것이 이긴다.
   */
  function rulesFor(selector: string): readonly string[] {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return [...progressCss.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g"))].map((m) => m[1] ?? "");
  }

  function ruleFor(selector: string): string {
    const rules = rulesFor(selector);
    return rules.at(-1) ?? "";
  }

  it("감싸는 칸을 내용 높이에 묶지 않는다", () => {
    const rules = rulesFor(".u5-progress-screen .game-shell__right-panel");
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) expect(rule).not.toMatch(/align-content:\s*start/);
    expect(ruleFor(".u5-progress-screen .game-shell__right-panel"))
      .toMatch(/grid-template-rows:\s*minmax\(0,\s*1fr\)/);
  });

  it("가운데 칸이 남는 높이를 받아 버튼을 아래로 민다", () => {
    expect(ruleFor(".u5-right-panel")).toMatch(/grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto/);
    expect(ruleFor(".u5-right-panel .u5-outcome-continue")).toMatch(/grid-row:\s*3/);
  });
});
