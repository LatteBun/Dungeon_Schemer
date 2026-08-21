import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const assets = [
  "board-pin.svg",
  "risk-star.svg",
  "environment.svg",
  "notice-lock.svg",
  "theme-spider.svg",
  "theme-desert.svg",
  "theme-graveyard.svg",
] as const;

describe("U3 fixed SVG assets", () => {
  it.each(assets)("%s 는 24x24 viewBox를 가진다", (asset) => {
    const content = readFileSync(
      join(process.cwd(), "public", "assets", "u3", asset),
      "utf8",
    );

    expect(content).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(content).toContain('viewBox="0 0 24 24"');
  });
});
