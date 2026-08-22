import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** U5 화면이 고정 캔버스와 공용 요소 규칙을 지키는지 고정한다. */

const progressCss = readFileSync(join(process.cwd(), "app", "u5-progress.css"), "utf8");
const battleCss = readFileSync(join(process.cwd(), "app", "u5-battle.css"), "utf8");

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

  it("전투가 있는 장면 자체를 full-slot size-query host로 만든다", () => {
    const hostRule = battleCss.match(/\.u5-battle-host\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(hostRule).toContain("position: relative");
    expect(hostRule).toContain("overflow: hidden");
    expect(hostRule).toContain("container-type: size");
    expect(battleCss).not.toContain(".u5-battle-preview .u5-scene");
  });

  /* 조언 세 개가 슬롯별로 다른 모양이 되면 계약이 깨진다. */
  it("조언에 슬롯별 변형 규칙을 두지 않는다", () => {
    expect(progressCss).not.toMatch(/u5-advice[^{]*:nth-child/);
    expect(progressCss).not.toMatch(/u5-advice--/);
  });
});
