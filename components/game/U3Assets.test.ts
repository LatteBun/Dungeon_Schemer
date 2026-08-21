import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const extractedPngAssets = [
  "theme-desert.png",
  "theme-spider.png",
  "theme-graveyard.png",
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

function readExtractedAsset(name: string): Buffer {
  return readFileSync(
    join(process.cwd(), "public", "assets", "u3", "extracted", name),
  );
}

describe("U3 extracted asset-board PNG assets", () => {
  it.each(extractedPngAssets)("%s 는 실제 PNG 파일이다", (asset) => {
    const content = readExtractedAsset(asset);
    expect(content.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  it("던전 3종은 보드에서 추출한 별도 이미지로 분리된다", () => {
    const desert = readExtractedAsset("theme-desert.png");
    const spider = readExtractedAsset("theme-spider.png");
    const graveyard = readExtractedAsset("theme-graveyard.png");

    expect(desert.equals(spider)).toBe(false);
    expect(spider.equals(graveyard)).toBe(false);
    expect(desert.equals(graveyard)).toBe(false);
  });

  it("공고 스타일은 깨끗한 양피지와 분리 배치·확대 CTA를 사용한다", () => {
    const css = readFileSync(join(process.cwd(), "app", "u3-card-theme.css"), "utf8");

    expect(css).toContain("notice-parchment-clean.png");
    expect(css).toContain(".u3-notice--3");
    expect(css).toContain("grid-column: 1");
    expect(css).toContain(".u3-notice--4");
    expect(css).toContain("grid-column: 3");
    expect(css).toContain(".u3-contract-button__emblem");
    expect(css).toContain("width: 3.25rem");
  });
});
