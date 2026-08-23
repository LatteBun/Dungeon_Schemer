import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_IDS } from "@/lib/domain";
import type { ThemeId } from "@/lib/domain";
import { pngDimensions } from "./png-alpha";
import { U5_SCENE_KINDS, sceneSrc } from "./u5-progress-model";

/**
 * U5 던전 진행 장면 자산 계약.
 *
 * 자산 폴더 이름을 도메인 ThemeId 와 같게 맞춰 두었다. 매핑 표가 다시 생기면
 * 도메인과 자산이 또 갈라지므로, 경로가 ThemeId 를 그대로 쓴다는 것을 여기서
 * 고정한다.
 */

const ROOT = join(process.cwd(), "public", "assets", "u5", "dungeon-progress-scenes");

function assetPath(theme: ThemeId, kind: string): string {
  return join(ROOT, theme, `${kind}.png`);
}

describe("U5 던전 진행 장면 자산", () => {
  it("장면 경로가 ThemeId 를 그대로 쓴다", () => {
    for (const theme of THEME_IDS) {
      expect(sceneSrc(theme, "monster")).toContain(`/${theme}/`);
    }
  });

  it("테마 셋 × 종류 여섯 조합이 빠짐없이 있다", () => {
    for (const theme of THEME_IDS) {
      for (const kind of U5_SCENE_KINDS) {
        const content = readFileSync(assetPath(theme, kind));

        expect(content.subarray(0, 8)).toEqual(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        );
      }
    }
  });

  /*
   * 장면은 슬롯을 cover 로 채운다. 슬롯보다 작으면 늘어나 뭉개지므로 가로가
   * 캔버스 좌측 폭(1920 × 0.6 ≈ 1152)보다 넉넉해야 한다.
   */
  it("장면은 좌측 슬롯을 채울 만큼 크고 가로로 길다", () => {
    for (const theme of THEME_IDS) {
      for (const kind of U5_SCENE_KINDS) {
        const { width, height } = pngDimensions(assetPath(theme, kind));

        expect(width).toBeGreaterThanOrEqual(1152);
        expect(width / height).toBeGreaterThan(1.5);
      }
    }
  });
});
