import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DENOUNCE_THRESHOLD, THEME_IDS, type CharacterId, type ClassId, type NodeId, type ThemeId } from "@/lib/domain";
import type { TopStatusView } from "./TopStatusBar";
import type { U4MapLayout } from "./u4-dungeon-map-layout";
import type { U4MapNodeView, U4PartyMemberView } from "./u4-dungeon-map-model";
import {
  U4DungeonMapScreen,
  nextSelectableNodeId,
} from "./U4DungeonMapScreen";

const nodeId = (value: string) => value as NodeId;
const characterId = (value: string) => value as CharacterId;
const classId = (value: string) => value as ClassId;

const ENTRY = nodeId("entry");
const MONSTER = nodeId("monster-room");
const REST = nodeId("rest-room");
const MERCHANT = nodeId("merchant-room");
const SPECIAL = nodeId("special-room");
const BOSS = nodeId("boss");

const status: TopStatusView = {
  rank: "C",
  reputation: 30,
  gold: 120,
  canPromote: false,
  remainingAdventurers: 12,
  remainingDungeons: 14,
  zeroTrust: { livingCount: 0, threshold: DENOUNCE_THRESHOLD },
  nextPromotion: { rank: "B", reputationRequired: 60 },
  currentDungeon: { name: "고대 유적", riskLevel: 3 },
};

const nodes: readonly U4MapNodeView[] = [
  { id: ENTRY, kind: "entry", state: "current", nextNodeIds: [MONSTER, REST] },
  { id: MONSTER, kind: "monster", state: "selectable", nextNodeIds: [MERCHANT] },
  { id: REST, kind: "rest", state: "selectable", nextNodeIds: [SPECIAL] },
  { id: MERCHANT, kind: "merchant", state: "inactive", nextNodeIds: [BOSS] },
  { id: SPECIAL, kind: "special", state: "inactive", nextNodeIds: [BOSS] },
  { id: BOSS, kind: "boss", state: "inactive", nextNodeIds: [] },
];

const layout: U4MapLayout = {
  nodePositions: {
    [ENTRY]: { x: 0.5, y: 0.88 },
    [MONSTER]: { x: 0.3, y: 0.72 },
    [REST]: { x: 0.7, y: 0.72 },
    [MERCHANT]: { x: 0.32, y: 0.42 },
    [SPECIAL]: { x: 0.68, y: 0.42 },
    [BOSS]: { x: 0.5, y: 0.12 },
  },
  corridors: [
    { from: ENTRY, to: MONSTER, start: { x: 0.5, y: 0.88 }, end: { x: 0.3, y: 0.72 }, length: 0.26, angleDeg: -141 },
    { from: ENTRY, to: REST, start: { x: 0.5, y: 0.88 }, end: { x: 0.7, y: 0.72 }, length: 0.26, angleDeg: -39 },
  ],
};

const party: readonly U4PartyMemberView[] = [
  {
    id: characterId("warrior-1"),
    name: "라온",
    classId: classId("warrior"),
    classLabel: "전사",
    personalityLabel: "정의로운",
    hp: 37,
    maxHp: 45,
    trust: 58,
    gold: 31,
    alive: true,
    portraitSrc: "/assets/characters/live/warrior/warrior_a.png",
  },
  {
    id: characterId("cleric-1"),
    name: "세리아",
    classId: classId("cleric"),
    classLabel: "성직자",
    personalityLabel: "신중한",
    hp: 0,
    maxHp: 28,
    trust: 42,
    gold: 24,
    alive: false,
    portraitSrc: "/assets/characters/live/cleric/cleric_b.png",
  },
  {
    id: characterId("archer-1"),
    name: "에린",
    classId: classId("archer"),
    classLabel: "궁수",
    personalityLabel: "의심 많은",
    hp: 25,
    maxHp: 32,
    trust: 65,
    gold: 18,
    alive: true,
    portraitSrc: "/assets/characters/live/archer/archer_a.png",
  },
];

const survey = {
  visited: 2,
  total: 12,
  disclosedRules: [
    "거미는 불을 피한다",
    "동굴거미는 발소리와 진동에 민감하게 반응한다",
    "그림자거미는 빛이 없는 곳에서만 모습을 드러낸다",
  ],
} as const;

function render(
  selectedNextNodeId: NodeId | null = MONSTER,
  themeId?: ThemeId,
): string {
  return renderToStaticMarkup(
    createElement(U4DungeonMapScreen, {
      status,
      dungeonName: "고대 유적",
      riskLevel: 3,
      nodes,
      layout,
      party,
      themeId,
      selectedNextNodeId,
      onSelectNextNode: () => undefined,
      onMove: () => undefined,
      survey,
    }),
  );
}

describe("U4DungeonMapScreen", () => {
  it("reuses GameShell and renders the spatial map without decorative map-frame or legend chrome", () => {
    const html = render();
    expect(html).toContain('data-testid="game-shell"');
    expect(html).toContain("던전 지도");
    expect(html).toContain("고대 유적");
    expect(html).toContain("/assets/u4/map/map_background_base.png");
    expect(html).toContain("/assets/u4/map/map_background_vignette.png");
    expect(html).toContain("/assets/u4/corridors/corridor_horizontal.png");
    expect(html).not.toContain("map_main_panel_frame.png");
    expect(html).not.toContain("legend_panel_frame.png");
    expect(html).not.toContain("범례");
  });

  it("renders all room kinds with their dedicated bases and icons but no visible room labels on the map", () => {
    const html = render();
    for (const asset of [
      "room_entry_base.png",
      "room_battle_base.png",
      "room_rest_base.png",
      "room_merchant_base.png",
      "room_special_base.png",
      "room_boss_base.png",
      "icon_entry.png",
      "icon_battle.png",
      "icon_rest.png",
      "icon_merchant.png",
      "icon_special.png",
      "icon_boss.png",
    ]) {
      expect(html).toContain(asset);
    }
    expect(html).not.toContain('class="u4-room__label"');
  });

  it("makes only selectable next rooms buttons and exposes selected state", () => {
    const html = render(MONSTER);
    expect((html.match(/data-testid=\"u4-selectable-room\"/g) ?? [])).toHaveLength(2);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-label="전투 지점 선택"');
    expect(html).toContain('aria-label="휴식 지점 선택"');
  });

  it("renders actual class portraits and marks dead party members with dead art", () => {
    const html = render();
    expect((html.match(/data-testid=\"u4-party-member\"/g) ?? [])).toHaveLength(3);
    expect(html).toContain("/assets/characters/live/warrior/warrior_a.png");
    expect(html).toContain("/assets/characters/live/cleric/cleric_b.png");
    expect(html).toContain("/assets/characters/live/archer/archer_a.png");
    expect(html).toContain("party-card is-dead");
    expect(html).toContain("사망");
    expect(html).toContain("/assets/u2/status-gold.svg");
  });

  it("shows the selected destination separately and keeps CTA text in HTML", () => {
    const html = render(MONSTER);
    expect(html).toContain("선택한 지점");
    /* 「공개 사건 분류」라는 이름표는 없앴다. 분류 자체가 곧 그 뜻이다. */
    expect(html).not.toContain("공개 사건 분류");
    expect(html).toContain("전투");
    expect(html).toContain("이 지점으로 이동");
    expect(html).toContain("/assets/u4/navigation/cta_button_arrow.png");
    expect(html).not.toContain("disabled=\"\"");
  });

  it("disables the move CTA before a destination is selected", () => {
    const html = render(null);
    expect(html).toContain("다음 지점을 선택하세요");
    expect(html).toMatch(/data-testid=\"u4-move-button\"[^>]*disabled=\"\"/);
  });

  it("orders the survey before the selected destination and keeps the move CTA last", () => {
    const html = render(MONSTER);
    const surveyIndex = html.indexOf("계약 전 답사");
    const destinationIndex = html.indexOf("선택한 지점");
    const moveIndex = html.indexOf("이 지점으로 이동");

    expect(surveyIndex).toBeGreaterThan(-1);
    expect(surveyIndex).toBeLessThan(destinationIndex);
    expect(destinationIndex).toBeLessThan(moveIndex);
  });

  it("orders left/right keyboard navigation by the room x coordinate", () => {
    expect(nextSelectableNodeId(nodes, layout, MONSTER, "right")).toBe(REST);
    expect(nextSelectableNodeId(nodes, layout, REST, "left")).toBe(MONSTER);
  });
});

describe("선택한 다음 지점", () => {
  /* 파티 카드에도 `small` 이 있다. 목적지 요약 안에서만 찾는다. */
  const hintOf = (html: string) => {
    const summary = html.match(/u4-destination__summary[\s\S]*?<\/section>/)?.[0] ?? "";
    return summary.match(/<small>([^<]*)<\/small>/)?.[1] ?? "";
  };

  /*
   * 고른 지점이 무엇인지 말해야 한다.
   *
   * 전에는 어디를 고르든 "현재 위치에서 이동 가능한 지점" 이라고만 적혀 있었다.
   * 늘 같은 문장은 아무것도 알려 주지 않는다.
   */
  it("분류마다 다른 설명이 붙는다", () => {
    const monster = hintOf(render(MONSTER));
    const rest = hintOf(render(REST));

    expect(monster.length).toBeGreaterThan(0);
    expect(rest.length).toBeGreaterThan(0);
    expect(monster).not.toBe(rest);
    for (const line of [monster, rest]) expect(line).not.toContain("이동 가능한 지점");
  });

  /* 그 안에 무슨 사건이 있는지는 밟아 봐야 안다. 미리 알면 고를 이유가 없다. */
  it("숨은 것을 미리 알려 주지 않는다", () => {
    const html = render(MONSTER);

    for (const leak of ["bossInfo", "strongPredecessor", "strongFollower", "-help", "-harm"]) {
      expect(html).not.toContain(leak);
    }
  });

  /* 고르지 않았으면 고르라고만 한다. */
  it("고르지 않았으면 안내만 남는다", () => {
    expect(render(null)).toContain("다음 지점을 선택하세요");
  });
});

/*
 * 지도 배경은 던전마다 달라야 한다.
 *
 * 한동안 map_background_base.png 한 장이 모든 던전에 깔렸다. 거미굴에 들어가든
 * 묘지에 들어가든 눈에 보이는 돌바닥이 똑같으니, 어디에 와 있는지가 화면 위쪽
 * 이름표에만 남았다.
 */
describe("U4DungeonMapScreen 배경", () => {
  it("던전의 테마마다 다른 배경을 깐다", () => {
    const backgrounds = THEME_IDS.map((themeId) => {
      const html = render(MONSTER, themeId);
      const found = /class="u4-map-surface__background[^"]*" src="([^"]+)"/.exec(html);
      expect(found, `${themeId} 배경`).not.toBeNull();
      return found![1];
    });

    for (const [index, themeId] of THEME_IDS.entries()) {
      expect(backgrounds[index]).toContain(themeId);
    }
    expect(new Set(backgrounds).size).toBe(THEME_IDS.length);
  });

  it("테마를 주지 않으면 예전 돌바닥을 그대로 쓴다", () => {
    // 프리뷰에는 던전이 없다. 테마 없이도 화면이 서야 한다.
    const html = render(MONSTER, undefined);
    expect(html).toContain("/assets/u4/map/map_background_base.png");
  });
});
