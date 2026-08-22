import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globals = readFileSync("app/globals.css", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");

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

  it("moves destination upward and enlarges party information without leaving the fixed canvas", () => {
    const fixes = readFileSync("app/u4-dungeon-map-fixes.css", "utf8");
    expect(fixes).toMatch(
      /\.u4-right-panel\s*\{[\s\S]*grid-template-rows:\s*minmax\(0, 2fr\) minmax\(0, 1fr\)/,
    );
    expect(fixes).toMatch(
      /\.u4-party-card__content > header strong\s*\{[\s\S]*font-size:\s*clamp\(0\.9rem/,
    );
    expect(fixes).toMatch(
      /\.u4-party-card__content > header small\s*\{[\s\S]*font-size:\s*clamp\(0\.68rem/,
    );
    expect(fixes).toMatch(
      /\.u4-party-card__stats dt,[\s\S]*font-size:\s*clamp\(0\.68rem/,
    );
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
