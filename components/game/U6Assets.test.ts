import { readFileSync, readdirSync } from "node:fs";
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
  /* 오래 그려만 두었던 것들. 이제 화면이 실제로 쓴다. */
  "emblems/emblem_banner_green.png",
  "emblems/emblem_banner_red.png",
  "emblems/emblem_banner_black.png",
  "emblems/emblem_banner_blue.png",
  "decorations/corner_deco.png",
  "decorations/divider_small.png",
  "decorations/ornament_arrow.png",
  "controls/button_back.png",
  "controls/icon_button_handshake.png",
  "controls/quote_left.png",
  "controls/quote_right.png",
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

/**
 * 만들어 둔 자산이 놀지 않게 한다.
 *
 * 결과 화면용으로 서른여덟 장을 그려 두고 여덟 장을 쓰지 않고 있었다. 배너 넉
 * 장과 모서리 장식, 작은 구분선, 화살 문양, 돌아가기 판이 그랬다. 자산이 놀면
 * 화면이 밋밋해지는데, 그 사실은 폴더를 세어 보기 전에는 드러나지 않는다.
 */
const NOT_FOR_SCREEN = new Set(["_source"]);

function assetFiles(): readonly string[] {
  return readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !NOT_FOR_SCREEN.has(entry.name))
    .flatMap((dir) => readdirSync(join(ROOT, dir.name))
      .filter((name) => name.endsWith(".png"))
      .map((name) => `${dir.name}/${name}`));
}

function screenSources(): string {
  const roots = ["components/game", "app"];
  const read = (dir: string): string => readdirSync(dir, { withFileTypes: true })
    .map((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return read(path);
      if (!/\.(tsx?|css)$/.test(entry.name) || entry.name.includes(".test.")) return "";
      return readFileSync(path, "utf8");
    })
    .join("\n");
  return roots.map(read).join("\n");
}

describe("U6 자산", () => {
  it("그려 둔 자산을 화면이 모두 쓴다", () => {
    const sources = screenSources();
    const idle = assetFiles().filter((file) => {
      const base = file.split("/")[1]!.replace(".png", "");
      if (sources.includes(base)) return false;
      /*
       * 마지막 조각을 떼어 낸 접두사로 다시 찾는다.
       *
       * `icon_check_off` 는 `icon_check_` 로, `star_large` 는 `star_` 로 찾는다.
       * 조각이 하나뿐인 이름까지 줄이지는 않는다 - 그러면 아무 이름에나 걸린다.
       */
      const parts = base.split("_");
      return !parts.slice(0, -1).length || !sources.includes(`${parts.slice(0, -1).join("_")}_`);
    });

    expect(idle.join(" ")).toBe("");
  });

  /* 세어 두지 않으면 자산이 늘 때 검사가 조용히 헐거워진다. */
  it("결과 화면 자산이 서른여덟 장이다", () => {
    expect(assetFiles()).toHaveLength(38);
  });
});
