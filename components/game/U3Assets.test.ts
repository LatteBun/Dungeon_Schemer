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

  it("던전 장면과 계약 CTA 크기를 캔버스 기준으로 고정한다", () => {
    const css = readFileSync(join(process.cwd(), "app", "u3-large-screen.css"), "utf8");

    expect(css).toContain("clamp(13rem, 15cqw, 24rem)");
    expect(css).toContain(".u3-contract-button .u3-contract-button__emblem");
    expect(css).toContain("clamp(4.5rem, 4.6cqw, 7.25rem)");
    expect(css).toContain(".u3-contract-button .u3-contract-button__arrow");
    expect(css).toContain("clamp(3.5rem, 3.9cqw, 6rem)");
  });

  it("대화면에서는 상태바부터 공고와 상세까지 텍스트가 함께 확대된다", () => {
    const css = readFileSync(join(process.cwd(), "app", "u3-large-screen.css"), "utf8");

    expect(css).toContain(".u3-board-screen .game-shell__status-copy dt");
    expect(css).toContain(".u3-board-screen .game-shell__status-copy dd");
    expect(css).toContain(".u3-notice__heading strong");
    expect(css).toContain(".u3-notice__heading small");
    expect(css).toContain(".u3-party-card__identity strong");
    expect(css).toContain(".u3-party-card__stats > div");
    expect(css).toContain(".u3-contract-outcomes__rows > div");
  });

  it("공고의 남는 공간은 장면 행에만 배분한다", () => {
    const css = readFileSync(join(process.cwd(), "app", "u3-responsive-layout.css"), "utf8");

    expect(css).toContain("grid-template-rows: auto auto minmax(0, 1fr) auto auto auto");
    expect(css).toContain(".u3-notice__theme-visual");
    expect(css).toContain("max-height: 100%");
    expect(css).toContain("font-size: clamp(0.78rem, 0.68cqw, 1rem);");
  });

  it("탐험대 카드도 대화면에서 내용과 함께 커진다", () => {
    const css = readFileSync(join(process.cwd(), "app", "u3-large-screen.css"), "utf8");

    expect(css).toContain(".u3-party-card {");
    expect(css).toContain("min-height: clamp(7.5rem, 8.5cqw, 12rem)");
    expect(css).toContain(".u3-party-card__portrait");
    expect(css).toContain("clamp(3.4rem, 3.3cqw, 5.5rem)");
  });

  it("계약 조건 보상은 명성과 골드를 항상 한 줄에 유지한다", () => {
    const css = readFileSync(join(process.cwd(), "app", "u3-contract-layout.css"), "utf8");

    expect(css).toContain(".u3-contract-outcome__reward .u3-reward");
    expect(css).toContain("flex-wrap: nowrap");
    expect(css).toContain("white-space: nowrap");
  });

  it("활성 위험도 별은 내부가 채워진 SVG를 사용한다", () => {
    const svg = readFileSync(join(process.cwd(), "public", "assets", "u3", "risk-star-filled.svg"), "utf8");
    expect(svg).toContain("<polygon");
    expect(svg).toContain("fill=\"#d4ad4e\"");
  });

  it("공고와 계약 패널의 행 분배를 캔버스 기준으로 고정한다", () => {
    const css = readFileSync(join(process.cwd(), "app", "u3-responsive-layout.css"), "utf8");
    const layout = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8");

    expect(layout).toContain('import "./u3-responsive-layout.css"');
    expect(css).toContain("grid-template-rows: auto minmax(0, 1fr) auto auto");
    expect(css).toContain("min-height: 0");
  });

  it("크기 계산은 캔버스 가로·세로를 함께 쓰고 명성·골드 라벨을 크게 유지한다", () => {
    const css = readFileSync(join(process.cwd(), "app", "u3-responsive-layout.css"), "utf8");

    expect(css).toContain("calc(0.68rem + 0.18cqw + 0.12cqh)");
    expect(css).toContain(".u3-board-screen .u3-reward__label");
    expect(css).toContain("clamp(0.72rem");
    expect(css).not.toContain(".u3-notice__environment strong");
    expect(css).toContain(".u3-contract-outcomes__rows > div");
  });

  it("탐험대 골드 행은 아이콘과 소지 골드 라벨을 같은 줄에 고정한다", () => {
    const css = readFileSync(join(process.cwd(), "app", "u3-responsive-layout.css"), "utf8");

    expect(css).toContain(".u3-party-card__gold-row");
    expect(css).toContain(".u3-party-card__gold-label");
    expect(css).toContain("white-space: nowrap");
    expect(css).toContain("align-items: center");
  });
});
