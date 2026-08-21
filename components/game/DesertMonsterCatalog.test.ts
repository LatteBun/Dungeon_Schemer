import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DESERT_MONSTER_ASSETS } from "./DesertMonsterAssets";
import { DesertMonsterCatalog } from "./DesertMonsterCatalog";

describe("DesertMonsterCatalog", () => {
  it("일반 몬스터 5종과 보스 4종을 모두 렌더링한다", () => {
    const html = renderToStaticMarkup(createElement(DesertMonsterCatalog));

    expect(html).toContain("일반 몬스터 5종");
    expect(html).toContain("보스 4종");

    for (const asset of DESERT_MONSTER_ASSETS) {
      expect(html).toContain(asset.name);
      expect(html).toContain(asset.src);
      expect(html).toContain(asset.id);
    }
  });
});
