import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pngAlphaPadding, pngDimensions } from "./png-alpha";

/**
 * U6 결과 화면 자산 계약.
 *
 * 화면이 배치만 하면 되도록 자산에 투명 여백을 남기지 않는다. 여백이 좌우로
 * 어긋나면 그림이 치우쳐 보이고, CSS 로 정한 크기와 실제로 보이는 크기가
 * 달라진다. 규칙은 docs/experience/SCREEN_LAYOUT.md 의 「자산의 투명 여백」이다.
 *
 * 화면에서 실제로 쓰는 자산만 고정한다. 쓰지 않는 것까지 묶으면 나중에 자산을
 * 정리할 때 관계없는 테스트가 깨진다.
 */

const ROOT = join(process.cwd(), "public", "assets", "u6", "DUNGEON_SCHEMER_RESULT_ASSETS_ALL");

const USED_ASSETS = [
  "ranks/rank_c.png",
  "ranks/rank_b.png",
  "ranks/rank_a.png",
  "ranks/rank_s.png",
  "stats/icon_advice.png",
  "stats/icon_survived.png",
  "stats/icon_dead.png",
  "stats/icon_trust.png",
  "stats/icon_gold.png",
  "stats/icon_reputation.png",
  "stats/icon_expeditions.png",
  "stats/icon_turning_point.png",
  "achievements/achievement_conquest.png",
  "achievements/achievement_guild.png",
  "achievements/achievement_return.png",
  "achievements/achievement_together.png",
  "emblems/laurel_left.png",
  "emblems/laurel_right.png",
  "emblems/star_large.png",
  "emblems/star_small.png",
  "emblems/wax_seal.png",
  "decorations/divider_main.png",
  "decorations/divider_line.png",
  "decorations/ornament_diamond.png",
  "controls/icon_check_on.png",
  "controls/icon_check_off.png",
  "controls/icon_arrow.png",
] as const;

function assetPath(name: string): string {
  return join(ROOT, name);
}

describe("U6 결과 화면 자산", () => {
  it.each(USED_ASSETS)("%s 는 실제 PNG 파일이다", (asset) => {
    const content = readFileSync(assetPath(asset));

    expect(content.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  it.each(USED_ASSETS)("%s 에 투명 여백이 없다", (asset) => {
    expect(pngAlphaPadding(assetPath(asset))).toEqual({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    });
  });

  /*
   * 등급 문장 넷은 한 자리에 하나씩만 나오지만, 캠페인마다 다른 등급이 그
   * 자리에 놓인다. 원본 종횡비가 0.818~0.891 로 달라서 폭으로 크기를 정하면
   * 등급마다 세로 길이가 달라진다. 화면은 높이로 크기를 정해 넷이 같은
   * 시각 무게로 읽히게 한다. 그 전제를 여기서 고정한다.
   */
  it("등급 문장 넷의 종횡비 차이가 화면 규칙을 요구할 만큼 크다", () => {
    const ratios = ["rank_c", "rank_b", "rank_a", "rank_s"].map((rank) => {
      const { width, height } = pngDimensions(assetPath(`ranks/${rank}.png`));
      return width / height;
    });

    expect(Math.max(...ratios) - Math.min(...ratios)).toBeGreaterThan(0.05);
  });
});
