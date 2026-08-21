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
  "theme-desert-wide.png",
  "theme-spider-wide.png",
  "theme-graveyard-wide.png",
] as const;

function extractedPath(name: string): string {
  return join(process.cwd(), "public", "assets", "u3", "extracted", name);
}

function pngDimensions(path: string): { width: number; height: number } {
  const content = readFileSync(path);
  return {
    width: content.readUInt32BE(16),
    height: content.readUInt32BE(20),
  };
}

describe("U3 extracted asset-board assets", () => {
  it.each(extractedPngAssets)("%s 는 실제 PNG 파일이다", (asset) => {
    const content = readFileSync(extractedPath(asset));
    expect(content.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  it.each(["theme-desert-wide.png", "theme-spider-wide.png", "theme-graveyard-wide.png"])(
    "%s 는 대화면에서도 선명한 960x540 16:9 던전 장면이다",
    (asset) => {
      expect(pngDimensions(extractedPath(asset))).toEqual({ width: 960, height: 540 });
    },
  );

  it("공고 장면은 전체 보드 크롭이 아니라 테마별 고해상도 자산을 직접 사용한다", () => {
    const source = readFileSync(
      join(process.cwd(), "components", "game", "U3BoardScreen.tsx"),
      "utf8",
    );
    const css = readFileSync(join(process.cwd(), "app", "u3-card-theme.css"), "utf8");

    expect(source).toContain("theme-desert-wide.png");
    expect(source).toContain("theme-spider-wide.png");
    expect(source).toContain("theme-graveyard-wide.png");
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
