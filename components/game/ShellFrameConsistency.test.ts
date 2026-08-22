import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 셸의 틀은 모든 화면이 같아야 한다.
 *
 * 두 칸의 여백과 화면 제목이 화면별 파일에서 세 번 더 덮이는 바람에 안쪽
 * 여백이 u4 12.8px, u5·u6 16px, u3 17.3px 로 갈라져 있었다. 제목의 서체마저
 * u3·u4 만 세리프였다. 한 화면 안에서는 보이지 않고, 화면을 옮길 때 제목이
 * 몇 px 미끄러지는 것으로만 드러나는 종류의 어긋남이라 여기서 고정한다.
 *
 * 배경·display 같은 화면 고유의 성질은 화면별 파일에 두어도 된다. 자리를
 * 정하는 값만 막는다.
 */

const APP = join(process.cwd(), "app");

function styleSheets(): string[] {
  return readdirSync(APP).filter((name) => name.endsWith(".css"));
}

function read(name: string): string {
  return readFileSync(join(APP, name), "utf8");
}

/** `.selector { ... }` 한 덩어리씩 끊는다. 여러 줄 선언을 놓치지 않으려는 것이다. */
function rules(css: string): Array<{ selector: string; body: string }> {
  const found: Array<{ selector: string; body: string }> = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    found.push({ selector: match[1].trim(), body: match[2] });
  }
  return found;
}

describe("셸 틀", () => {
  it("두 칸의 여백을 globals.css 밖에서 정하지 않는다", () => {
    const offenders: string[] = [];

    for (const name of styleSheets()) {
      if (name === "globals.css") continue;
      for (const rule of rules(read(name))) {
        if (!/game-shell__(main|right-panel)/.test(rule.selector)) continue;
        if (/(^|[\s;])padding(-\w+)?\s*:/.test(rule.body)) offenders.push(`${name} — ${rule.selector}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("화면 제목을 globals.css 밖에서 꾸미지 않는다", () => {
    const offenders = styleSheets()
      .filter((name) => name !== "globals.css")
      .filter((name) => rules(read(name)).some((rule) => /game-shell__main\s*>\s*h1/.test(rule.selector)));

    expect(offenders).toEqual([]);
  });

  it("틀의 값은 토큰으로만 정한다", () => {
    const globals = read("globals.css");

    for (const token of ["--shell-padding", "--shell-title-size", "--shell-title-gap"]) {
      expect(globals).toContain(token);
    }
  });
});
