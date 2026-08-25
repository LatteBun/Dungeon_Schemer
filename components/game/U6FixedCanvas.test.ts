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

  it("정산 복귀 버튼은 내용 폭으로 우측 정렬한다", () => {
    const rule = css.match(
      /\.u6-settlement-side \.u6-settlement-continue\s*\{([^}]*)\}/,
    )?.[1] ?? "";

    expect(rule).toMatch(/grid-row:\s*4/);
    expect(rule).toMatch(/justify-self:\s*end/);
    expect(rule).not.toMatch(/justify-self:\s*stretch/);
    expect(rule).not.toMatch(/width:\s*100%/);
  });

  it("정산 본문은 결과·원인·원정대 결과 세 행을 쓴다", () => {
    const rule = css.match(/\.u6-settlement-main\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(rule).toMatch(/grid-template-rows:\s*auto\s+auto\s+minmax\(0,\s*1fr\)/);
  });

  it("원정대 결과 목록은 세 인물을 세로로 담고 넘치지 않는다", () => {
    const rule = css.match(/\.u6-party-results__list\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(rule).toMatch(/display:\s*grid/);
    expect(rule).toMatch(/grid-template-rows:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(rule).toMatch(/min-height:\s*0/);
  });

  it("폐기한 다섯 단계와 다녀온 사람 선택자를 남기지 않는다", () => {
    expect(css).not.toContain("u6-cause__order");
    expect(css).not.toContain("u6-returned");
  });
});
