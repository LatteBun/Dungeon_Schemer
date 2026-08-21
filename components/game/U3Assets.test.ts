import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const extractedPngAssets = [
  "risk-star.png",
  "notice-parchment-clean.png",
  "board-wood-tile.png",
  "screen-texture-tile.png",
  "contract-emblem.png",
  "arrow-right.png",
  "section-divider.png",
  "board-pin.png",
  "status-dungeon.png",
] as const;

const wideDungeonScenes = [
  "theme-desert-wide.webp",
  "theme-spider-wide.webp",
  "theme-graveyard-wide.webp",
] as const;

function extractedPath(name: string): string {
  return join(process.cwd(), "public", "assets", "u3", "extracted", name);
}

describe("U3 extracted asset-board assets", () => {
  it.each(extractedPngAssets)("%s 는 실제 PNG 파일이다", (asset) => {
    const content = readFileSync(extractedPath(asset));
    expect(content.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  it.each(wideDungeonScenes)("%s 는 대화면용 WebP 던전 장면이다", (asset) => {
    const content = readFileSync(extractedPath(asset));
    expect(content.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(content.subarray(8, 12).toString("ascii")).toBe("WEBP");
  });

  it("공고 장면은 전체 보드 크롭이 아니라 테마별 고해상도 자산을 직접 사용한다", () => {
    const source = readFileSync(
      join(process.cwd(), "components", "game", "U3BoardScreen.tsx"),
      "utf8",
    );
    const css = readFileSync(join(process.cwd(), "app", "u3-card-theme.css"), "utf8");

    expect(source).toContain("theme-desert-wide.webp");
    expect(source).toContain("theme-spider-wide.webp");
    expect(source).toContain("theme-graveyard-wide.webp");
    expect(source).not.toContain("theme-scenes-board.webp");
    expect(css).not.toContain("theme-scenes-board.webp");
    expect(css).toContain("aspect-ratio: 16 / 9");
  });

  it("1440px 이상에서는 던전 장면과 계약 CTA가 함께 확대된다", () => {
    const css = readFileSync(join(process.cwd(), "app", "u3-card-theme.css"), "utf8");

    expect(css).toContain("@media (min-width: 90rem)");
    expect(css).toContain("clamp(10.4rem, 13.5vw, 26rem)");
    expect(css).toContain("clamp(4.5rem, 4.6vw, 7.25rem)");
    expect(css).toContain("clamp(3.5rem, 3.9vw, 6rem)");
  });
});
