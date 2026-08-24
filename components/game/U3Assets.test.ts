import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pngAlphaPadding, pngDimensions } from "./png-alpha";


const extractedPngAssets = [
  "risk-star.png",
  "notice-parchment-clean.png",
  "board-wood-tile.png",
  "contract-emblem.png",
  "arrow-right.png",
  "section-divider.png",
  "board-pin.png",
  "status-dungeon.png",
] as const;

function extractedPath(name: string): string {
  return join(process.cwd(), "public", "assets", "u3", "extracted", name);
}


/* 화면 바탕 질감은 U3 전용이 아니게 됐다. 원정 화면 셋이 함께 쓴다. */
describe("공용 화면 질감", () => {
  it("shared 로 옮긴 자리에 실제 PNG 로 있다", () => {
    const content = readFileSync(join(process.cwd(), "public", "assets", "shared", "screen-texture-tile.png"));
    expect(content.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });
});

describe("U3 extracted asset-board assets", () => {
  it.each(extractedPngAssets)("%s 는 실제 PNG 파일이다", (asset) => {
    const content = readFileSync(extractedPath(asset));
    expect(content.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  it("arrow-right.png은 투명 여백이 없는 가로형 캔버스다", () => {
    expect(pngDimensions(extractedPath("arrow-right.png"))).toEqual({ width: 70, height: 27 });
    expect(pngAlphaPadding(extractedPath("arrow-right.png"))).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  /*
   * 빈 별(PNG)과 채운 별(SVG)은 같은 줄에 나란히 렌더된다. 캔버스를 내용에 딱 맞추면
   * 빈 별만 커져 둘이 어긋나므로, 채운 별 SVG 의 비율(24×24 안에서 상6.3% 하12.1%
   * 좌우 7.4%)에 맞춰 여백을 남긴다. CSS 가 가로·세로를 같은 값으로 묶으므로
   * 캔버스도 정사각으로 두어 눌림을 없앤다.
   */
  it("risk-star.png은 채운 별 SVG 의 비율에 맞춘 정사각 캔버스다", () => {
    expect(pngDimensions(extractedPath("risk-star.png"))).toEqual({ width: 60, height: 60 });
    expect(pngAlphaPadding(extractedPath("risk-star.png"))).toEqual({ top: 4, bottom: 7, left: 5, right: 5 });
  });

  it("board-pin.png은 투명 여백이 없는 캔버스다", () => {
    expect(pngDimensions(extractedPath("board-pin.png"))).toEqual({ width: 50, height: 61 });
    expect(pngAlphaPadding(extractedPath("board-pin.png"))).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  it("section-divider.png은 투명 여백이 없는 캔버스다", () => {
    expect(pngDimensions(extractedPath("section-divider.png"))).toEqual({ width: 321, height: 32 });
    expect(pngAlphaPadding(extractedPath("section-divider.png"))).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  /*
   * 육각형 문양은 위가 뾰족하고 아래가 뭉툭해서 알파 무게가 아래로 1.1px 쏠린다.
   * 캔버스를 내용에 딱 맞추면 가운데 정렬해도 아래로 처져 보이므로, 아래 2px 만
   * 의도적으로 남겨 무게중심을 캔버스 중앙에 올린다. 나머지 세 방향은 0 이다.
   */
  it("contract-emblem.png은 아래 2px 만 남기고 투명 여백을 덜어낸 캔버스다", () => {
    expect(pngDimensions(extractedPath("contract-emblem.png"))).toEqual({ width: 65, height: 68 });
    expect(pngAlphaPadding(extractedPath("contract-emblem.png"))).toEqual({ top: 0, bottom: 2, left: 0, right: 0 });
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

  it("계약 상세는 장면 배경과 전용 scrim 스타일을 사용하지 않는다", () => {
    const boardCss = readFileSync(join(process.cwd(), "app", "u3-board.css"), "utf8");
    const themeCss = readFileSync(join(process.cwd(), "app", "u3-card-theme.css"), "utf8");

    expect(boardCss).not.toContain(".u3-contract-card__scrim");
    expect(themeCss).not.toContain(".u3-detail-section.u3-contract-card");
    expect(themeCss).not.toContain(".u3-contract-card--desert");
    expect(themeCss).not.toContain(".u3-contract-card--spider");
    expect(themeCss).not.toContain(".u3-contract-card--graveyard");
  });

  it("공고 장면과 계약 CTA 크기를 캔버스 기준으로 고정한다", () => {
    const css = readFileSync(join(process.cwd(), "app", "u3-large-screen.css"), "utf8");

    expect(css).toContain("clamp(10rem, 12cqw, 19rem)");
    expect(css).toContain(".u3-contract-button .u3-contract-button__seal");
    expect(css).toContain("clamp(2.5rem, 2.7cqw, 4rem)");
    expect(css).toContain(".u3-contract-button .u3-contract-button__arrow");
    expect(css).toContain("clamp(1.5rem, 1.6cqw, 2.4rem)");
  });

  /*
   * 상태 바는 이 목록에서 빠졌다. 화면별 재선언을 없애고 globals.css 한 곳으로
   * 옮겼기 때문이다. 그 계약은 StatusBarConsistency.test.ts 가 지킨다.
   */
  it("공고와 상세의 텍스트 크기를 캔버스 기준으로 고정한다", () => {
    const css = readFileSync(join(process.cwd(), "app", "u3-large-screen.css"), "utf8");

    expect(css).toContain(".u3-notice__heading strong");
    expect(css).toContain(".u3-notice__heading small");
    expect(css).toContain(".u3-contract-outcomes__rows > div");
  });

  it("공고의 남는 공간은 장면 행에만 배분한다", () => {
    const css = readFileSync(join(process.cwd(), "app", "u3-responsive-layout.css"), "utf8");

    expect(css).toContain("grid-template-rows: auto auto minmax(0, 1fr) auto auto auto");
    expect(css).toContain(".u3-notice__theme-visual");
    expect(css).toContain("max-height: 100%");
    expect(css).toContain("font-size: clamp(0.68rem, calc(0.55rem + 0.18cqw + 0.11cqh), 0.94rem);");
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

  it("수배지 다섯 장을 같은 작은 크기로 불규칙하게 배치한다", () => {
    const boardCss = readFileSync(join(process.cwd(), "app", "u3-board.css"), "utf8");
    const themeCss = readFileSync(join(process.cwd(), "app", "u3-card-theme.css"), "utf8");

    expect(boardCss).toContain("grid-template-columns: repeat(15, minmax(0, 1fr));");
    expect(boardCss).toContain("grid-template-rows: repeat(12, minmax(0, 1fr));");
    expect(boardCss).not.toContain("grid-template-columns: repeat(3, minmax(0, 1fr));");
    expect(boardCss).not.toMatch(/transform:\s*scale\(/);

    const placements = [
      [".u3-notice--0", "grid-column: 1 / span 4", "grid-row: 1 / span 5", "rotate(-2.1deg)"],
      [".u3-notice--1", "grid-column: 6 / span 4", "grid-row: 2 / span 5", "rotate(1.4deg)"],
      [".u3-notice--2", "grid-column: 11 / span 4", "grid-row: 1 / span 5", "rotate(-1.2deg)"],
      [".u3-notice--3", "grid-column: 3 / span 4", "grid-row: 7 / span 5", "translate(0.45rem, 0.85rem) rotate(2.2deg)"],
      [".u3-notice--4", "grid-column: 10 / span 4", "grid-row: 7 / span 5", "translate(-0.35rem, 0.70rem) rotate(-1.8deg)"],
    ] as const;

    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const [selector, column, row, rotation] of placements) {
      expect(boardCss).toMatch(new RegExp(
        `${escapeRegExp(selector)}\\s*\\{[^}]*${escapeRegExp(column)};[^}]*${escapeRegExp(row)};[^}]*${escapeRegExp(rotation)}`,
      ));
    }

    expect(themeCss).not.toMatch(/\.u3-notice--[34]/);
  });

  it("작아진 수배지 안에서 제목·핀·별·장면·보상도 함께 줄인다", () => {
    const largeCss = readFileSync(join(process.cwd(), "app", "u3-large-screen.css"), "utf8");
    const responsiveCss = readFileSync(join(process.cwd(), "app", "u3-responsive-layout.css"), "utf8");

    expect(largeCss).toMatch(/\.u3-notice\s*\{[^}]*grid-template-rows:\s*auto auto minmax\(5\.8rem, 1fr\)/);
    expect(largeCss).toMatch(/\.u3-notice__pin\s*\{[^}]*width:\s*clamp\(1\.5rem, 1\.15cqw, 2\.15rem\);/);
    expect(largeCss).toMatch(/\.u3-notice \.u3-theme-scene\s*\{[^}]*width:\s*min\(100%, clamp\(10rem, 12cqw, 19rem\)\);/);
    expect(responsiveCss).toMatch(/\.u3-notice__heading strong\s*\{[^}]*word-break:\s*keep-all;/);
  });

  it("작은 수배지 보상만 줄이고 우측 계약 보상은 이전 크기를 유지한다", () => {
    const css = readFileSync(join(process.cwd(), "app", "u3-responsive-layout.css"), "utf8");

    expect(css).toMatch(/\.u3-board-screen \.u3-reward__label\s*\{[^}]*font-size:\s*clamp\(0\.72rem, calc\(0\.6rem \+ 0\.18cqw \+ 0\.12cqh\), 1\.05rem\);/);
    expect(css).toMatch(/\.u3-board-screen \.u3-reward--compact\s*\{[^}]*font-size:\s*clamp\(0\.84rem, calc\(0\.68rem \+ 0\.22cqw \+ 0\.14cqh\), 1\.25rem\);/);
    expect(css).toMatch(/\.u3-board-screen \.u3-reward img\s*\{[^}]*width:\s*clamp\(1\.05rem, calc\(0\.82rem \+ 0\.2cqw \+ 0\.08cqh\), 1\.55rem\);[^}]*height:\s*clamp\(1\.05rem, calc\(0\.82rem \+ 0\.2cqw \+ 0\.08cqh\), 1\.55rem\);/);

    expect(css).toMatch(/\.u3-notice \.u3-reward__label\s*\{[^}]*font-size:\s*clamp\(0\.62rem, calc\(0\.5rem \+ 0\.14cqw \+ 0\.1cqh\), 0\.84rem\);/);
    expect(css).toMatch(/\.u3-notice \.u3-reward--compact\s*\{[^}]*font-size:\s*clamp\(0\.68rem, calc\(0\.55rem \+ 0\.18cqw \+ 0\.11cqh\), 0\.94rem\);/);
    expect(css).toMatch(/\.u3-notice \.u3-reward img\s*\{[^}]*width:\s*clamp\(0\.84rem, calc\(0\.65rem \+ 0\.16cqw \+ 0\.06cqh\), 1\.25rem\);[^}]*height:\s*clamp\(0\.84rem, calc\(0\.65rem \+ 0\.16cqw \+ 0\.06cqh\), 1\.25rem\);/);
  });

  it("공고와 계약 패널의 행 분배를 캔버스 기준으로 고정한다", () => {
    const css = readFileSync(join(process.cwd(), "app", "u3-responsive-layout.css"), "utf8");
    const layout = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8");

    expect(layout).toContain('import "./u3-responsive-layout.css"');
    // 파티 · 계약 카드 · 버튼 세 행이다. 던전 정보를 계약 카드에 합치며 한 행이 줄었다.
    expect(css).toContain("grid-template-rows: auto minmax(0, 1fr) auto");
    expect(css).toContain("min-height: 0");
  });

  it("크기 계산은 캔버스 가로·세로를 함께 쓰고 공고의 명성·골드 라벨을 크게 유지한다", () => {
    const css = readFileSync(join(process.cwd(), "app", "u3-responsive-layout.css"), "utf8");

    expect(css).toContain(".u3-notice .u3-reward__label");
    expect(css).toContain("clamp(0.72rem");
    expect(css).not.toContain(".u3-notice__environment strong");
    expect(css).toContain(".u3-contract-outcomes__rows > div");
  });

  /* 탐험대 카드의 골드 표시는 party-card.css 로 옮겼다. 계약은 PartyMemberCard.test.tsx 가 지킨다. */
});
