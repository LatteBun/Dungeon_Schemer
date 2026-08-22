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

/**
 * CharacterId 문자열만으로 A/B를 결정해 render 시점이나 생사 상태와 무관하게
 * 같은 캐릭터는 항상 같은 변형을 사용한다.
 */
export function portraitVariantForCharacterId(
  characterId: CharacterId,
): "a" | "b" {
  let hash = 2166136261;
  for (let index = 0; index < characterId.length; index += 1) {
    hash ^= characterId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2 === 0 ? "a" : "b";
}

export function portraitSrcForCharacter(input: {
  id: CharacterId;
  classId: ClassId;
  alive: boolean;
}): string {
  const variant = portraitVariantForCharacterId(input.id);
  const lifeFolder = input.alive ? "live" : "dead";
  return `/assets/characters/${lifeFolder}/${input.classId}/${input.classId}_${variant}.png`;
}

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
