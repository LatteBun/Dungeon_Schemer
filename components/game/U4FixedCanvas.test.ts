import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globals = readFileSync("app/globals.css", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");

function numericDeclaration(
  css: string,
  selector: string,
  property: string,
): number {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const propertyPattern = new RegExp(
    `${property}\\s*:\\s*(\\d+(?:\\.\\d+)?)`,
  );
  const rule = [
    ...css.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "g")),
  ].find((match) => propertyPattern.test(match[1] ?? ""));
  const declaration = rule?.[1]?.match(propertyPattern);

  if (declaration?.[1] === undefined) {
    throw new Error(`${selector}의 ${property} 값을 찾을 수 없습니다.`);
  }

  return Number(declaration[1]);
}

describe("U4 fixed 16:9 canvas contract", () => {
  it("inherits the shared 1920x1080 canvas and 60:40 GameShell split", () => {
    expect(globals).toContain("width: 120rem");
    expect(globals).toContain("height: 67.5rem");
    expect(globals).toContain(
      "grid-template-columns: minmax(0, 3fr) minmax(0, 2fr)",
    );
  });

  it("loads the U4 stylesheet and its visual correction layer from the root layout", () => {
    expect(layout).toContain('import "./u4-dungeon-map.css";');
    expect(layout).toContain('import "./u4-dungeon-map-fixes.css";');
  });

  it("keeps U4 styles inside the fixed canvas coordinate system", () => {
    const css = readFileSync("app/u4-dungeon-map.css", "utf8");
    const fixes = readFileSync("app/u4-dungeon-map-fixes.css", "utf8");
    expect(css).toContain(".u4-dungeon-map-screen .game-shell");
    expect(css).toMatch(/\.u4-dungeon-map-screen[\s\S]*height:\s*100%/);
    expect(`${css}\n${fixes}`).not.toMatch(/@media\b/);
    expect(`${css}\n${fixes}`).not.toMatch(
      /(?:^|[^a-z-])\d*\.?\d+(?:vw|vh)\b/i,
    );
  });

  it("removes ornate map-frame chrome and enlarges room iconography", () => {
    const fixes = readFileSync("app/u4-dungeon-map-fixes.css", "utf8");
    expect(fixes).toMatch(
      /\.u4-map-surface__frame\s*\{[\s\S]*display:\s*none/,
    );
    expect(fixes).toMatch(
      /\.u4-room__icon\s*\{[\s\S]*width:\s*49%[\s\S]*height:\s*49%/,
    );
    expect(fixes).toMatch(
      /\.u4-corridor\s*\{[\s\S]*height:\s*clamp\(1\.05rem/,
    );
  });

  it("keeps the complete route topology visible while preserving state priority", () => {
    const fixes = readFileSync("app/u4-dungeon-map-fixes.css", "utf8");
    const inactiveCorridor = numericDeclaration(
      fixes,
      ".u4-corridor",
      "opacity",
    );
    const visitedCorridor = numericDeclaration(
      fixes,
      ".u4-corridor.is-visited",
      "opacity",
    );
    const selectableCorridor = numericDeclaration(
      fixes,
      ".u4-corridor.is-selectable",
      "opacity",
    );
    const inactiveRoom = numericDeclaration(
      fixes,
      ".u4-room.is-inactive",
      "opacity",
    );

    expect(inactiveCorridor).toBeGreaterThanOrEqual(0.62);
    expect(visitedCorridor).toBeGreaterThan(inactiveCorridor);
    expect(selectableCorridor).toBeGreaterThan(visitedCorridor);
    expect(inactiveRoom).toBeGreaterThanOrEqual(0.68);
    expect(inactiveRoom).toBeLessThan(visitedCorridor);
  });

  it("keeps the vignette below corridors and rooms", () => {
    const base = readFileSync("app/u4-dungeon-map.css", "utf8");
    const fixes = readFileSync("app/u4-dungeon-map-fixes.css", "utf8");
    const vignette = numericDeclaration(
      fixes,
      ".u4-map-surface__vignette",
      "z-index",
    );
    const corridors = numericDeclaration(
      base,
      ".u4-map-surface__corridors",
      "z-index",
    );
    const rooms = numericDeclaration(
      base,
      ".u4-map-surface__rooms",
      "z-index",
    );

    expect(vignette).toBe(2);
    expect(vignette).toBeLessThan(corridors);
    expect(corridors).toBeLessThan(rooms);
  });

  /*
   * 우측 패널은 덩어리를 위에서부터 쌓고, 어느 쪽도 늘리지 않는다.
   *
   * 전에는 2fr : 1fr 로 나눠 다음 지점을 아래 3분의 1 에 붙였다. 그러면 파티
   * 칸이 내용보다 커져 카드 아래가 빈 상자로 남는다. U3 처럼 두 덩어리 모두
   * 내용 높이에 맞추고, 남는 자리는 상자가 아니라 패널 바탕으로 둔다.
   */
  it("stacks the right panel from the top without stretching either block", () => {
    const base = readFileSync("app/u4-dungeon-map.css", "utf8");
    const rule = base.match(/\.u4-right-panel\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(rule).toMatch(/grid-template-rows:\s*auto auto/);
    expect(rule).toMatch(/align-content:\s*start/);

    const fixes = readFileSync("app/u4-dungeon-map-fixes.css", "utf8");
    const override = fixes.match(/\.u4-right-panel\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(override).not.toMatch(/grid-template-rows/);
  });

  it("keeps destination content above its decorative panel and the move CTA fully visible", () => {
    const fixes = readFileSync("app/u4-dungeon-map-fixes.css", "utf8");
    expect(fixes).toMatch(
      /\.u4-destination__panel-frame\s*\{[\s\S]*z-index:\s*1/,
    );
    expect(fixes).toMatch(/\.u4-destination__summary[\s\S]*z-index:\s*2/);
    expect(fixes).toMatch(
      /\.u4-move-button\s*\{[\s\S]*height:\s*clamp\(3\.7rem/,
    );
    expect(fixes).toMatch(/\.u4-move-button__left,[\s\S]*display:\s*none/);
  });
});
