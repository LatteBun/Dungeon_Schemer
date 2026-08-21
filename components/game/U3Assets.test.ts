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

  it("승인된 컨셉 보드 원본을 직사각형 던전 장면 소스로 재사용한다", () => {
    const content = readFileSync(extractedPath("theme-scenes-board.webp"));
    expect(content.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(content.subarray(8, 12).toString("ascii")).toBe("WEBP");
  });

  it("공고 장면은 16:9로 정렬하고 계약 CTA 아이콘을 크게 중앙 정렬한다", () => {
    const css = readFileSync(join(process.cwd(), "app", "u3-card-theme.css"), "utf8");

    expect(css).toContain("theme-scenes-board.webp");
    expect(css).toContain(".u3-theme-scene");
    expect(css).toContain("aspect-ratio: 16 / 9");
    expect(css).toContain(".u3-theme-scene--desert");
    expect(css).toContain(".u3-theme-scene--spider");
    expect(css).toContain(".u3-theme-scene--graveyard");
    expect(css).toContain(".u3-contract-button__emblem");
    expect(css).toContain("width: 4rem");
    expect(css).toContain(".u3-contract-button__arrow");
    expect(css).toContain("width: 3rem");
  });
});
