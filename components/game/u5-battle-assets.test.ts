import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { THEMES } from "@/lib/content/themes";
import {
  enemyBattleAssetSrc,
  U5_BATTLE_ENEMY_ASSET_SRC_BY_CONTENT_ID,
} from "./u5-battle-assets";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const officialContent = THEMES.flatMap((theme) => [...theme.monsters, ...theme.bosses]);

describe("U5 battle enemy assets", () => {
  it("공식 monster와 boss 콘텐츠는 정확히 스물일곱 개다", () => {
    expect(officialContent).toHaveLength(27);
  });

  it("모든 공식 콘텐츠 ID는 manifest에 있고 PNG 파일을 가리킨다", () => {
    for (const content of officialContent) {
      const src = enemyBattleAssetSrc(content.id);
      const file = readFileSync(join(process.cwd(), "public", src.replace(/^\//, "")));
      expect(file.subarray(0, 8)).toEqual(PNG_SIGNATURE);
    }
  });

  it("manifest key 집합은 공식 콘텐츠 ID 집합과 정확히 같다", () => {
    expect(Object.keys(U5_BATTLE_ENEMY_ASSET_SRC_BY_CONTENT_ID).toSorted()).toEqual(officialContent.map((content) => content.id).toSorted());
  });

  it("알 수 없는 콘텐츠 ID는 fallback 없이 오류를 던진다", () => {
    expect(() => enemyBattleAssetSrc("not-an-official-monster")).toThrowError(/U5 전투 이미지가 없는 콘텐츠다/);
  });
});
