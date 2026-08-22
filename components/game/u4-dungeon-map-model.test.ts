import { describe, expect, it } from "vitest";
import type {
  Character,
  CharacterId,
  ClassId,
  GeneratedMap,
  NodeId,
} from "@/lib/domain";
import {
  createU4MapNodeViews,
  createU4PartyMemberViews,
  portraitSrcForCharacter,
  portraitVariantForCharacterId,
} from "./u4-dungeon-map-model";

const nodeId = (value: string) => value as NodeId;
const characterId = (value: string) => value as CharacterId;
const classId = (value: string) => value as ClassId;

const ENTRY = nodeId("entry");
const A = nodeId("d1-a");
const B = nodeId("d1-b");
const C = nodeId("d2-a");
const D = nodeId("d2-b");
const BOSS = nodeId("boss");

const MAP: GeneratedMap = {
  entryNodeId: ENTRY,
  bossNodeId: BOSS,
  layers: [
    { depth: 1, nodeIds: [A, B] },
    { depth: 2, nodeIds: [C, D] },
  ],
  nodes: [
    { id: ENTRY, kind: "entry", nextNodeIds: [A, B] },
    { id: A, kind: "normal", nextNodeIds: [C] },
    { id: B, kind: "normal", nextNodeIds: [D] },
    { id: C, kind: "normal", nextNodeIds: [BOSS] },
    { id: D, kind: "normal", nextNodeIds: [BOSS] },
    { id: BOSS, kind: "boss", nextNodeIds: [] },
  ],
};

const PUBLIC_KINDS = {
  [A]: "monster",
  [B]: "rest",
  [C]: "merchant",
  [D]: "special",
} as const;

describe("U4 dungeon map model", () => {
  it("marks only current next nodes selectable", () => {
    const views = createU4MapNodeViews({
      map: MAP,
      currentNodeId: A,
      visitedNodeIds: [ENTRY],
      publicKindByNodeId: PUBLIC_KINDS,
    });
    const byId = Object.fromEntries(views.map((view) => [view.id, view]));

    expect(byId[ENTRY]?.state).toBe("visited");
    expect(byId[A]?.state).toBe("current");
    expect(byId[C]?.state).toBe("selectable");
    expect(byId[B]?.state).toBe("inactive");
    expect(byId[D]?.state).toBe("inactive");
  });

  it("keeps current above visited and visited above inactive", () => {
    const views = createU4MapNodeViews({
      map: MAP,
      currentNodeId: A,
      visitedNodeIds: [ENTRY, A, B],
      publicKindByNodeId: PUBLIC_KINDS,
    });
    const byId = Object.fromEntries(views.map((view) => [view.id, view]));

    expect(byId[A]?.state).toBe("current");
    expect(byId[B]?.state).toBe("visited");
  });

  it("uses E1 kind for entry and boss and public kind for normal nodes", () => {
    const views = createU4MapNodeViews({
      map: MAP,
      currentNodeId: ENTRY,
      visitedNodeIds: [],
      publicKindByNodeId: PUBLIC_KINDS,
    });
    const byId = Object.fromEntries(views.map((view) => [view.id, view]));

    expect(byId[ENTRY]?.kind).toBe("entry");
    expect(byId[A]?.kind).toBe("monster");
    expect(byId[B]?.kind).toBe("rest");
    expect(byId[C]?.kind).toBe("merchant");
    expect(byId[D]?.kind).toBe("special");
    expect(byId[BOSS]?.kind).toBe("boss");
  });

  it("throws instead of inventing a public kind for a normal node", () => {
    expect(() =>
      createU4MapNodeViews({
        map: MAP,
        currentNodeId: ENTRY,
        visitedNodeIds: [],
        publicKindByNodeId: { [A]: "monster" },
      }),
    ).toThrow(/공개 사건 분류/);
  });
});

describe("U4 character portraits", () => {
  it("keeps the portrait variant stable for the same character", () => {
    const id = characterId("char-17");
    expect(portraitVariantForCharacterId(id)).toBe(
      portraitVariantForCharacterId(id),
    );
  });

  it("switches live to the same dead class and variant", () => {
    const id = characterId("char-17");
    const warrior = classId("warrior");
    const live = portraitSrcForCharacter({ id, classId: warrior, alive: true });
    const dead = portraitSrcForCharacter({ id, classId: warrior, alive: false });

    expect(live.replace("/live/", "/dead/")).toBe(dead);
    expect(live).toContain("/warrior/warrior_");
  });

  it("maps class and personality labels while preserving alive state", () => {
    const character: Character = {
      id: characterId("char-warrior"),
      name: "라온",
      classId: classId("warrior"),
      personality: "righteous",
      maxHp: 45,
      hp: 37,
      trust: 0,
      gold: 31,
      alive: true,
      gravelyWounded: true,
    };

    const [view] = createU4PartyMemberViews([character]);
    expect(view).toMatchObject({
      name: "라온",
      classLabel: "전사",
      personalityLabel: "정의로운",
      alive: true,
    });
    expect(view?.portraitSrc).toContain("/characters/live/warrior/");
  });

  it("uses dead portrait only when alive is false", () => {
    const character: Character = {
      id: characterId("char-cleric"),
      name: "세리아",
      classId: classId("cleric"),
      personality: "prudent",
      maxHp: 28,
      hp: 1,
      trust: 0,
      gold: 24,
      alive: false,
      gravelyWounded: true,
    };

    const [view] = createU4PartyMemberViews([character]);
    expect(view?.alive).toBe(false);
    expect(view?.portraitSrc).toContain("/characters/dead/cleric/");
  });
});
