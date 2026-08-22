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

  it("loads the U4 stylesheet from the root layout", () => {
    expect(layout).toContain('import "./u4-dungeon-map.css";');
  });

  it("keeps U4 styles inside the fixed canvas coordinate system", () => {
    const css = readFileSync("app/u4-dungeon-map.css", "utf8");
    expect(css).toContain(".u4-dungeon-map-screen .game-shell");
    expect(css).toMatch(/\.u4-dungeon-map-screen[\s\S]*height:\s*100%/);
    expect(css).not.toMatch(/@media\b/);
    expect(css).not.toMatch(/(?:^|[^a-z-])\d*\.?\d+(?:vw|vh)\b/i);
  });
});
