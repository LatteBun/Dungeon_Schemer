import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const assetPath = join(
  process.cwd(),
  "public",
  "assets",
  "main-menu",
  "hero-this-way-main-menu.jpeg",
);

function jpegDimensions(path: string): { width: number; height: number } {
  const content = readFileSync(path);
  expect(content.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));

  let offset = 2;
  while (offset < content.length) {
    while (content[offset] === 0xff) offset += 1;
    const marker = content[offset];
    offset += 1;

    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0xda) break;
    if (marker === undefined || offset + 2 > content.length) break;

    const segmentLength = content.readUInt16BE(offset);
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return {
        height: content.readUInt16BE(offset + 3),
        width: content.readUInt16BE(offset + 5),
      };
    }
    offset += segmentLength;
  }

  throw new Error("JPEG SOF0/SOF1/SOF2 marker not found");
}

describe("메인 메뉴 일러스트 자산", () => {
  it("JPEG이고 1672 × 941 크기다", () => {
    expect(jpegDimensions(assetPath)).toEqual({ width: 1672, height: 941 });
  });
});
