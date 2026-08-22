import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CharacterId, ClassId, NodeId } from "@/lib/domain";
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
  remainingDungeons: 14,
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
    [ENTRY]: { x: 0.5, y: 0.93 },
    [MONSTER]: { x: 0.3, y: 0.72 },
    [REST]: { x: 0.7, y: 0.72 },
    [MERCHANT]: { x: 0.32, y: 0.42 },
    [SPECIAL]: { x: 0.68, y: 0.42 },
    [BOSS]: { x: 0.5, y: 0.06 },
  },
  corridors: [
    { from: ENTRY, to: MONSTER, start: { x: 0.5, y: 0.93 }, end: { x: 0.3, y: 0.72 }, length: 0.29, angleDeg: -133 },
    { from: ENTRY, to: REST, start: { x: 0.5, y: 0.93 }, end: { x: 0.7, y: 0.72 }, length: 0.29, angleDeg: -47 },
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
    portraitSrc: "/assets/characters/dead/cleric/cleric_b.png",
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

function render(selectedNextNodeId: NodeId | null = MONSTER): string {
  return renderToStaticMarkup(
    createElement(U4DungeonMapScreen, {
      status,
      dungeonName: "고대 유적",
      riskLevel: 3,
      nodes,
      layout,
      party,
      selectedNextNodeId,
      onSelectNextNode: () => undefined,
      onMove: () => undefined,
    }),
  );
}

describe("U4DungeonMapScreen", () => {
  it("reuses GameShell and renders the spatial map assets without a legend", () => {
    const html = render();
    expect(html).toContain('data-testid="game-shell"');
    expect(html).toContain("던전 지도");
    expect(html).toContain("고대 유적");
    expect(html).toContain("/assets/u4/map/map_background_base.png");
    expect(html).toContain("/assets/u4/map/map_background_vignette.png");
    expect(html).toContain("/assets/u4/corridors/corridor_horizontal.png");
    expect(html).not.toContain("legend_panel_frame.png");
    expect(html).not.toContain("범례");
  });

  it("renders all room kinds with their dedicated bases and icons", () => {
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
    expect(html).toContain("/assets/characters/dead/cleric/cleric_b.png");
    expect(html).toContain("/assets/characters/live/archer/archer_a.png");
    expect(html).toContain("u4-party-card is-dead");
    expect(html).toContain("사망");
    expect(html).toContain("/assets/u2/status-gold.svg");
  });

  it("shows the selected destination separately and keeps CTA text in HTML", () => {
    const html = render(MONSTER);
    expect(html).toContain("선택한 다음 지점");
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

  it("orders left/right keyboard navigation by the room x coordinate", () => {
    expect(nextSelectableNodeId(nodes, layout, MONSTER, "right")).toBe(REST);
    expect(nextSelectableNodeId(nodes, layout, REST, "left")).toBe(MONSTER);
  });
});
