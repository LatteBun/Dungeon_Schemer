import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
import type { DungeonEventPools } from "@/lib/content/events";
import { EVENT_KINDS } from "@/lib/domain";
import type {
  DungeonEvent,
  DungeonNode,
  DungeonState,
  EventId,
  EventKind,
  NodeId,
} from "@/lib/domain";
import type { Rng } from "@/lib/rng";

export const DUNGEON_SHAPES = [
  { branches: 2, pathDepth: 2 },
  { branches: 3, pathDepth: 2 },
  { branches: 2, pathDepth: 3 },
] as const;

export interface GenerateDungeonOptions {
  readonly eventPools?: DungeonEventPools;
}

export interface GeneratedDungeon {
  readonly dungeon: DungeonState;
  readonly events: DungeonEvent[];
}

interface NodeDraft {
  readonly id: NodeId;
  readonly depth: number;
  readonly nextNodeIds: NodeId[];
}

const nodeId = (value: string) => value as NodeId;

function buildNodeDrafts(branches: number, pathDepth: number): NodeDraft[] {
  const mergeId = nodeId("node-merge");
  const bossId = nodeId("node-boss");
  const firstIds = Array.from({ length: branches }, (_, branch) =>
    nodeId(`node-path-${branch + 1}-depth-1`));
  const drafts: NodeDraft[] = [
    { id: nodeId("node-entry"), depth: 0, nextNodeIds: firstIds },
  ];
  for (let branch = 1; branch <= branches; branch += 1) {
    for (let depth = 1; depth <= pathDepth; depth += 1) {
      const next = depth === pathDepth
        ? mergeId
        : nodeId(`node-path-${branch}-depth-${depth + 1}`);
      drafts.push({
        id: nodeId(`node-path-${branch}-depth-${depth}`),
        depth,
        nextNodeIds: [next],
      });
    }
  }
  drafts.push(
    { id: mergeId, depth: pathDepth + 1, nextNodeIds: [bossId] },
    { id: bossId, depth: pathDepth + 2, nextNodeIds: [] },
  );
  return drafts;
}

function regularKinds(count: number, rng: Rng): EventKind[] {
  const extras = count === 6 ? rng.shuffle(EVENT_KINDS).slice(0, 2) : EVENT_KINDS;
  return rng.shuffle([...EVENT_KINDS, ...extras]);
}

function validateEvent(
  event: DungeonEvent,
  expectedKind: EventKind,
  eventIds: Set<string>,
  choiceIds: Set<string>,
): void {
  if (event.kind !== expectedKind) {
    throw new Error(`이벤트 분류가 ${expectedKind} 풀이 아니다: ${event.id}`);
  }
  if (eventIds.has(event.id)) throw new Error(`이벤트 ID가 중복된다: ${event.id}`);
  eventIds.add(event.id);
  if (event.choices.length === 0) throw new Error(`선택지가 없는 이벤트다: ${event.id}`);
  for (const choice of event.choices) {
    if (choiceIds.has(choice.id)) throw new Error(`선택지 ID가 중복된다: ${choice.id}`);
    choiceIds.add(choice.id);
    if (choice.expectedGain.trim() === "") {
      throw new Error(`예상 이득이 비어 있다: ${choice.id}`);
    }
    if (choice.knownRisk.trim() === "") {
      throw new Error(`알려진 위험이 비어 있다: ${choice.id}`);
    }
    if (choice.target?.kind === "member") {
      throw new Error(`파티원 대상 선택지는 사용할 수 없다: ${choice.id}`);
    }
  }
}

function validateEventPools(pools: DungeonEventPools): void {
  const eventIds = new Set<string>();
  const choiceIds = new Set<string>();
  for (const kind of EVENT_KINDS) {
    const events = pools.regular[kind];
    if (events.length < 2) {
      throw new Error(`${kind} 이벤트 풀은 최소 2개여야 한다: ${events.length}`);
    }
    for (const event of events) validateEvent(event, kind, eventIds, choiceIds);
  }
  if (pools.boss.length === 0) throw new Error("보스 이벤트 풀이 비어 있다.");
  for (const event of pools.boss) {
    if (event.kind !== "special") {
      throw new Error(`보스 이벤트는 special이어야 한다: ${event.id}`);
    }
    validateEvent(event, "special", eventIds, choiceIds);
  }
}

export function generateDungeon(
  rng: Rng,
  options: GenerateDungeonOptions = {},
): GeneratedDungeon {
  const pools = options.eventPools ?? DUNGEON_EVENT_POOLS;
  validateEventPools(pools);
  const shape = rng.pick(DUNGEON_SHAPES);
  const drafts = buildNodeDrafts(shape.branches, shape.pathDepth);
  const kinds = regularKinds(drafts.length - 1, rng);
  const queues = Object.fromEntries(
    EVENT_KINDS.map((kind) => [kind, rng.shuffle(pools.regular[kind])]),
  ) as Record<EventKind, DungeonEvent[]>;
  const offsets = Object.fromEntries(EVENT_KINDS.map((kind) => [kind, 0])) as
    Record<EventKind, number>;
  const regularEvents = kinds.map((kind) => queues[kind][offsets[kind]++]);
  const events = [...regularEvents, rng.pick(pools.boss)];
  const nodes: DungeonNode[] = drafts.map((draft, index) => ({
    ...draft,
    eventId: events[index].id as EventId,
  }));
  return {
    dungeon: {
      nodes,
      entryNodeId: nodeId("node-entry"),
      bossNodeId: nodeId("node-boss"),
    },
    events,
  };
}
