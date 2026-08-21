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

  it("theme-scenes-wide.avif 는 대화면용 던전 장면 AVIF다", () => {
    const content = readFileSync(extractedPath("theme-scenes-wide.avif"));
    expect(content.subarray(4, 8).toString("ascii")).toBe("ftyp");
    expect(content.subarray(8, 12).toString("ascii")).toMatch(/avif|avis/);
    expect(content.byteLength).toBeGreaterThan(10_000);
  });

  it("공고 장면은 전체 UI 보드 크롭이 아니라 전용 3장 스프라이트를 사용한다", () => {
    const css = readFileSync(join(process.cwd(), "app", "u3-large-screen.css"), "utf8");
    const layout = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8");

    expect(layout).toContain('import "./u3-large-screen.css"');
    expect(css).toContain("theme-scenes-wide.avif");
    expect(css).not.toContain("theme-scenes-board.webp");
    expect(css).toContain("background-size: 300% 100%");
    expect(css).toContain("aspect-ratio: 16 / 9");
    expect(css).toContain(".u3-theme-scene--desert");
    expect(css).toContain(".u3-theme-scene--spider");
    expect(css).toContain(".u3-theme-scene--graveyard");
  });

  it("1440px 이상에서는 던전 장면과 계약 CTA가 함께 확대된다", () => {
    const css = readFileSync(join(process.cwd(), "app", "u3-large-screen.css"), "utf8");

    expect(css).toContain("@media (min-width: 90rem)");
    expect(css).toContain("clamp(15rem, 18vw, 32rem)");
    expect(css).toContain(".u3-contract-button .u3-contract-button__emblem");
    expect(css).toContain("clamp(4.5rem, 4.6vw, 7.25rem)");
    expect(css).toContain(".u3-contract-button .u3-contract-button__arrow");
    expect(css).toContain("clamp(3.5rem, 3.9vw, 6rem)");
  });

  it("대화면 우측 상세 정보도 공고와 함께 읽기 좋은 크기로 확대된다", () => {
    const css = readFileSync(join(process.cwd(), "app", "u3-large-screen.css"), "utf8");

    expect(css).toContain(".u3-party-card__stats > div");
    expect(css).toContain("clamp(0.7rem, 0.65vw, 1rem)");
    expect(css).toContain(".u3-contract-outcomes__rows > div");
    expect(css).toContain("clamp(0.75rem, 0.65vw, 1rem)");
  });
});
