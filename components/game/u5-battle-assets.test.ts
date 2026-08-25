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

/*
 * 전투에서 둘은 서로를 본다.
 *
 * 그림에 규약이 있다 — 파티 초상은 오른쪽을 보고 그려졌고, 몹 그림은 왼쪽을
 * 보고 그려졌다. 파티는 왼쪽에 서고 몹은 오른쪽에 서므로, 그대로 두면 마주 본다.
 *
 * 한동안 몹만 `scaleX(-1)` 로 뒤집고 있었다. 그러면 몹이 파티에게 등을 돌리고
 * 파티와 같은 쪽을 보게 된다 — 거미의 턱도, 좀비의 얼굴도, 전갈의 집게도 모두
 * 바깥을 향했다. 세 테마의 몹과 보스 여섯 장을 확인했고 전부 왼쪽을 보고 있다.
 */
describe("전투 스프라이트가 보는 쪽", () => {
  const battleCss = readFileSync(join(process.cwd(), "app", "u5-battle.css"), "utf8");

  function orientationRule(side: "party" | "enemy"): string {
    const found = battleCss.match(
      new RegExp(`\\.u5-battle-orientation\\.is-${side}\\s*\\{([^}]*)\\}`),
    );
    return found?.[1] ?? "";
  }

  it("어느 쪽도 좌우로 뒤집지 않는다", () => {
    for (const side of ["party", "enemy"] as const) {
      expect(orientationRule(side), side).not.toMatch(/scaleX\(\s*-1\s*\)/);
    }
    /* 공통 규칙에도 뒤집기가 숨어 있으면 안 된다. */
    const shared = battleCss.match(/\.u5-battle-orientation\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(shared).not.toMatch(/scaleX\(\s*-1\s*\)/);
  });

  it("달려드는 쪽은 진영마다 반대다", () => {
    /*
     * 보는 쪽과 달려드는 쪽은 다른 값이다. 뒤집기를 없앤다고 달려드는 쪽까지
     * 같아지면 둘이 나란히 같은 데로 뛴다.
     */
    const scene = readFileSync(join(process.cwd(), "components", "game", "U5BattleScene.tsx"), "utf8");
    const lunge = scene.match(/--u5-battle-lunge-x[^,\n]*:\s*([^,\n]*)/)?.[1] ?? "";

    expect(lunge).toContain("16%");
    expect(lunge).toContain("-16%");
  });
});
