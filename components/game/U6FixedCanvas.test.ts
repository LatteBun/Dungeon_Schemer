import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * U6 화면이 고정 캔버스와 공용 요소 규칙을 지키는지 고정한다.
 * 규칙은 docs/experience/SCREEN_LAYOUT.md 의 「공용 요소 규칙」이다.
 */

const css = readFileSync(join(process.cwd(), "app", "u6-result.css"), "utf8");

describe("U6 고정 캔버스 계약", () => {
  it("창을 가리키는 단위를 쓰지 않는다", () => {
    expect(css).not.toMatch(/\d(vw|vh)\b/);
  });

  it("미디어 쿼리를 넣지 않는다", () => {
    expect(css).not.toContain("@media");
  });

  it("상단 상태 바를 다시 선언하지 않는다", () => {
    expect(css).not.toContain("game-shell__status");
  });

  it("레이아웃에 등록되어 있다", () => {
    const layout = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8");

    expect(layout).toContain('import "./u6-result.css"');
  });
});
