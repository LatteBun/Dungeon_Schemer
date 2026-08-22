import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globals = readFileSync("app/globals.css", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");

describe("U4 fixed 16:9 canvas contract", () => {
  it("inherits the shared 1920x1080 canvas and 60:40 GameShell split", () => {
    expect(globals).toContain("width: 120rem");
    expect(globals).toContain("height: 67.5rem");
    expect(globals).toContain("grid-template-columns: minmax(0, 3fr) minmax(0, 2fr)");
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
    expect(`${css}\n${fixes}`).not.toMatch(/(?:^|[^a-z-])\d*\.?\d+(?:vw|vh)\b/i);
  });

  it("pushes the heavy map frame outward and keeps corridors visually substantial", () => {
    const fixes = readFileSync("app/u4-dungeon-map-fixes.css", "utf8");
    expect(fixes).toMatch(/\.u4-map-surface__frame\s*\{[\s\S]*inset:\s*-1\.6rem/);
    expect(fixes).toMatch(/\.u4-corridor\s*\{[\s\S]*height:\s*clamp\(1\.05rem/);
  });

  it("keeps destination content above its decorative panel and the move CTA fully inside its row", () => {
    const fixes = readFileSync("app/u4-dungeon-map-fixes.css", "utf8");
    expect(fixes).toMatch(/\.u4-destination__panel-frame\s*\{[\s\S]*z-index:\s*1/);
    expect(fixes).toMatch(/\.u4-destination__summary[\s\S]*z-index:\s*2/);
    expect(fixes).toMatch(/\.u4-move-button\s*\{[\s\S]*height:\s*clamp\(3\.5rem/);
    expect(fixes).toMatch(/\.u4-move-button__left,[\s\S]*display:\s*none/);
  });
});
