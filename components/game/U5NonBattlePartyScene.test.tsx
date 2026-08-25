import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { U5NonBattlePartyScene } from "./U5NonBattlePartyScene";
import type { U5PartyMemberView } from "./u5-progress-model";

const party: readonly U5PartyMemberView[] = [
  { id: "warrior", name: "오린", classLabel: "전사", personalityLabel: "용감한", hp: 12, maxHp: 12, trust: 40, gold: 20, portraitSrc: "/assets/characters/live/warrior/warrior_a.png" },
  { id: "rogue", name: "코르빈", classLabel: "도적", personalityLabel: "신중한", hp: 10, maxHp: 10, trust: 42, gold: 16, portraitSrc: "/assets/characters/live/rogue/rogue_a.png" },
  { id: "cleric", name: "에리카", classLabel: "성직자", personalityLabel: "침착한", hp: 14, maxHp: 14, trust: 35, gold: 18, portraitSrc: "/assets/characters/live/cleric/cleric_a.png" },
];

describe("U5NonBattlePartyScene", () => {
  it("첫 세 초상이 있는 파티원을 안정적인 슬롯 순서로 장식 렌더한다", () => {
    const html = renderToStaticMarkup(createElement(U5NonBattlePartyScene, { party }));

    expect(html).toContain('data-testid="u5-nonbattle-party"');
    expect(html).toContain('aria-hidden="true"');
    expect(html.match(/data-u5-party-scene-slot=/g)).toHaveLength(3);
    expect(html.indexOf("warrior_a.png")).toBeLessThan(html.indexOf("rogue_a.png"));
    expect(html.indexOf("rogue_a.png")).toBeLessThan(html.indexOf("cleric_a.png"));
  });

  it("초상 경로가 없어도 처음 세 슬롯은 유지하고 깨진 img는 만들지 않는다", () => {
    const html = renderToStaticMarkup(createElement(U5NonBattlePartyScene, {
      party: [{ ...party[0]!, portraitSrc: undefined }],
    }));

    expect(html.match(/data-u5-party-scene-slot=/g)).toHaveLength(3);
    expect(html).toContain('data-u5-party-scene-slot="0"');
    expect(html).toContain('data-u5-party-scene-slot="1"');
    expect(html).toContain('data-u5-party-scene-slot="2"');
    expect(html).not.toContain("<img");
  });
});
