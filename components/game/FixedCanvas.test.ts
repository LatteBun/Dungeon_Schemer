import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 16:9 고정 캔버스 계약.
 *
 * 화면이 창 크기를 따라 모양을 바꾸던 시절의 CSS가 조용히 돌아오는 것을
 * 막는다. `vw` 하나, 미디어 쿼리 하나가 다시 들어오면 그 규칙만 창을
 * 따라가면서 나머지 캔버스와 어긋나고, 그 어긋남은 특정 창 크기에서만
 * 보이므로 사람이 눈으로 찾기 어렵다.
 */

function css(name: string): string {
  return readFileSync(join(process.cwd(), "app", name), "utf8");
}

function styleSheets(): string[] {
  return readdirSync(join(process.cwd(), "app")).filter((name) =>
    name.endsWith(".css"),
  );
}

describe("16:9 고정 캔버스", () => {
  it("루트 글꼴 크기가 창에 맞춘 축척을 만든다", () => {
    expect(css("globals.css")).toContain("min(100vw / 120, 100vh / 67.5)");
  });

  it("캔버스는 1920x1080 비율의 크기 컨테이너다", () => {
    const sheet = css("globals.css");

    expect(sheet).toContain(".game-canvas");
    expect(sheet).toContain("width: 120rem");
    expect(sheet).toContain("height: 67.5rem");
    expect(sheet).toContain("container-type: size");
    expect(sheet).toContain("container-name: game");
  });

  it("남는 공간은 가운데 정렬된 레터박스로 남는다", () => {
    const sheet = css("globals.css");

    expect(sheet).toContain("place-content: center");
    expect(sheet).toContain("overflow: hidden");
  });

  it("레이아웃이 모든 화면을 캔버스로 감싼다", () => {
    const layout = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8");

    expect(layout).toContain('className="game-canvas"');
  });

  it("고정 비율 화면에는 창 반응형 미디어 쿼리가 없다", () => {
    const offenders = styleSheets().filter((name) => css(name).includes("@media"));

    expect(offenders).toEqual([]);
  });
});
