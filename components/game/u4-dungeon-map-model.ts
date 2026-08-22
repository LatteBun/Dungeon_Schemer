import { CLASSES } from "@/lib/content/classes";
import type {
  Character,
  CharacterId,
  ClassId,
  EventKind,
  GeneratedMap,
  NodeId,
  Personality,
} from "@/lib/domain";

export type U4RoomKind =
  | "entry"
  | "monster"
  | "rest"
  | "merchant"
  | "special"
  | "boss";

export type U4RoomState = "current" | "visited" | "selectable" | "inactive";

export interface U4MapNodeView {
  id: NodeId;
  kind: U4RoomKind;
  state: U4RoomState;
  nextNodeIds: readonly NodeId[];
}

export interface U4PartyMemberView {
  id: CharacterId;
  name: string;
  classId: ClassId;
  classLabel: string;
  personalityLabel: string;
  hp: number;
  maxHp: number;
  trust: number;
  gold: number;
  alive: boolean;
  portraitSrc: string;
}

const PERSONALITY_LABELS: Readonly<Record<Personality, string>> = {
  suspicious: "의심 많은",
  righteous: "정의로운",
  greedy: "탐욕적인",
  prudent: "신중한",
  impulsive: "충동적인",
};

function classLabel(classId: ClassId): string {
  return CLASSES.find((candidate) => candidate.id === classId)?.name ?? classId;
}

function roomKindForNode(
  node: GeneratedMap["nodes"][number],
  publicKindByNodeId: Readonly<Partial<Record<NodeId, EventKind>>>,
): U4RoomKind {
  if (node.kind === "entry") return "entry";
  if (node.kind === "boss") return "boss";

  const publicKind = publicKindByNodeId[node.id];
  if (publicKind === undefined) {
    throw new Error(`U4 일반 지점의 공개 사건 분류가 없습니다: ${node.id}`);
  }
  return publicKind;
}

export function createU4MapNodeViews(input: {
  map: GeneratedMap;
  currentNodeId: NodeId;
  visitedNodeIds: readonly NodeId[];
  publicKindByNodeId: Readonly<Partial<Record<NodeId, EventKind>>>;
}): readonly U4MapNodeView[] {
  const current = input.map.nodes.find((node) => node.id === input.currentNodeId);
  if (current === undefined) {
    throw new Error(`U4 현재 지점을 지도에서 찾을 수 없습니다: ${input.currentNodeId}`);
  }

  const visited = new Set<NodeId>(input.visitedNodeIds);
  const selectable = new Set<NodeId>(current.nextNodeIds);

  return input.map.nodes.map((node) => {
    let state: U4RoomState = "inactive";
    if (node.id === input.currentNodeId) {
      state = "current";
    } else if (visited.has(node.id)) {
      state = "visited";
    } else if (selectable.has(node.id)) {
      state = "selectable";
    }

    return {
      id: node.id,
      kind: roomKindForNode(node, input.publicKindByNodeId),
      state,
      nextNodeIds: node.nextNodeIds,
    } satisfies U4MapNodeView;
  });
}

/* 초상 매핑은 character-labels.ts 로 옮겼다. 기존 import 를 위해 다시 내보낸다. */
import { portraitSrcForCharacter, portraitVariantForCharacterId } from "./character-labels";

export { portraitSrcForCharacter, portraitVariantForCharacterId };

export function createU4PartyMemberViews(
  characters: readonly Character[],
): readonly U4PartyMemberView[] {
  return characters.map((character) => ({
    id: character.id,
    name: character.name,
    classId: character.classId,
    classLabel: classLabel(character.classId),
    personalityLabel: PERSONALITY_LABELS[character.personality],
    hp: character.hp,
    maxHp: character.maxHp,
    trust: character.trust,
    gold: character.gold,
    alive: character.alive,
    portraitSrc: portraitSrcForCharacter(character),
  }));
}
