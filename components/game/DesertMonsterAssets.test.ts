import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DESERT_MONSTER_ASSETS } from "./DesertMonsterAssets";

function assetPath(src: string): string {
  return join(process.cwd(), "public", src.replace(/^\//, ""));
}

function readPngContract(path: string) {
  const file = readFileSync(path);
  expect(file.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );

  return {
    width: file.readUInt32BE(16),
    height: file.readUInt32BE(20),
    colorType: file[25],
    hasTransparencyChunk: file.includes(Buffer.from("tRNS", "ascii")),
  };
}

describe("사막 몬스터 에셋 계약", () => {
  it("일반 5종과 보스 4종을 정확히 제공한다", () => {
    expect(DESERT_MONSTER_ASSETS).toHaveLength(9);
    expect(new Set(DESERT_MONSTER_ASSETS.map((asset) => asset.id)).size).toBe(9);
    expect(DESERT_MONSTER_ASSETS.filter((asset) => asset.kind === "monster")).toHaveLength(5);
    expect(DESERT_MONSTER_ASSETS.filter((asset) => asset.kind === "boss")).toHaveLength(4);
  });

  it.each(DESERT_MONSTER_ASSETS)("$name 은 1024 정사각 투명 PNG다", (asset) => {
    const { width, height, colorType, hasTransparencyChunk } = readPngContract(
      assetPath(asset.src),
    );

    expect(width).toBeGreaterThanOrEqual(1024);
    expect(height).toBeGreaterThanOrEqual(1024);
    expect(width).toBe(height);
    expect([3, 4, 6]).toContain(colorType);
    if (colorType === 3) {
      expect(hasTransparencyChunk).toBe(true);
    }
  });
});
