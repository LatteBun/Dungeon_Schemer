import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 상단 상태 바는 모든 화면이 같아야 한다.
 *
 * 화면마다 다시 선언하면 값이 조용히 갈라진다. 실제로 u1·u2·u3 의 바 높이가
 * 88.8 / 67.4 / 82.6px 로 제각각이었고, 둘을 맞추려고 만든 동기화 파일이 또
 * 하나의 정의가 되어 셋이 넷이 됐다. 사람이 눈으로 찾기 어려운 종류의 어긋남이라
 * 여기서 고정한다.
 */

const APP = join(process.cwd(), "app");

function styleSheets(): string[] {
  return readdirSync(APP).filter((name) => name.endsWith(".css"));
}

function read(name: string): string {
  return readFileSync(join(APP, name), "utf8");
}

describe("상단 상태 바", () => {
  it("정의가 globals.css 한 곳에만 있다", () => {
    const offenders = styleSheets()
      .filter((name) => name !== "globals.css")
      .filter((name) => read(name).includes("game-shell__status"));

    expect(offenders).toEqual([]);
  });

  it("화면 이름으로 범위를 좁힌 상태 바 규칙이 없다", () => {
    const scoped = /\.(u1|u2|u3|u4|u5|u6)[a-z-]*\s+[^{]*game-shell__status/;

    expect(styleSheets().filter((name) => scoped.test(read(name)))).toEqual([]);
  });

  it("크기는 토큰으로만 정한다", () => {
    const globals = read("globals.css");

    for (const token of [
      "--status-bar-padding-block",
      "--status-chip-min-height",
      "--status-icon-size",
      "--status-label-size",
      "--status-value-size",
    ]) {
      expect(globals).toContain(token);
    }
  });
});
