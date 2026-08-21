import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DESERT_MONSTER_ASSETS } from "./DesertMonsterAssets";

function readPngContract(src: string) {
  const file = readFileSync(join(process.cwd(), "public", src.replace(/^\//, "")));
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

describe("DESERT_MONSTER_ASSETS", () => {
  it("contains exactly five monsters and four bosses", () => {
    expect(DESERT_MONSTER_ASSETS).toHaveLength(9);
    expect(new Set(DESERT_MONSTER_ASSETS.map((asset) => asset.id)).size).toBe(9);
    expect(
      DESERT_MONSTER_ASSETS.filter((asset) => asset.kind === "monster"),
    ).toHaveLength(5);
    expect(
      DESERT_MONSTER_ASSETS.filter((asset) => asset.kind === "boss"),
    ).toHaveLength(4);
  });

  it.each(DESERT_MONSTER_ASSETS)("validates $id PNG contract", (asset) => {
    const png = readPngContract(asset.src);

    expect(png.width).toBeGreaterThanOrEqual(1024);
    expect(png.height).toBeGreaterThanOrEqual(1024);
    expect(png.width).toBe(png.height);
    expect([3, 4, 6]).toContain(png.colorType);
    if (png.colorType === 3) expect(png.hasTransparencyChunk).toBe(true);
  });
});

