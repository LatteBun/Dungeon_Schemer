import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ACHIEVEMENT_CATALOG } from "@/lib/achievements/player-progress";
import { pngDimensions } from "./png-alpha";

const NEW_ASSETS = [
  "achievement_s_rank.png",
  "achievement_advice.png",
  "achievement_expedition.png",
  "achievement_wipe.png",
  "achievement_first_record.png",
  "achievement_everyone_returned.png",
  "achievement_distrust.png",
  "achievement_denounced.png",
  "achievement_exhausted.png",
  "achievement_unemployed.png",
] as const;

function pathForImageSrc(imageSrc: string): string {
  return join(process.cwd(), "public", imageSrc);
}

describe("업적 문양 자산", () => {
  it.each(NEW_ASSETS)("%s는 충분한 정사각 PNG다", (name) => {
    const path = join(process.cwd(), "public", "assets", "achievements", name);
    const content = readFileSync(path);

    expect(content.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const { width, height } = pngDimensions(path);
    expect(width).toBe(height);
    expect(width).toBeGreaterThanOrEqual(512);
  });

  it("카탈로그의 모든 문양 경로가 실제 파일을 가리킨다", () => {
    for (const achievement of ACHIEVEMENT_CATALOG) {
      expect(readFileSync(pathForImageSrc(achievement.imageSrc)).subarray(0, 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
    }
  });
});
