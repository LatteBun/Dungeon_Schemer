import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
import type { DungeonEventPools } from "@/lib/content/events";
import { validateDungeonEventPools } from "@/lib/content/validation";
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

/**
 * 노드 수만큼 분류를 뽑되 네 분류가 아니라 있는 분류를 모두 한 번씩 먼저 넣는다.
 *
 * 단일 런 전용 생성기다. Task 10의 RunState 정리에서 사라진다.
 */
function regularKinds(count: number, rng: Rng): EventKind[] {
  const kinds: EventKind[] = [...EVENT_KINDS];
  while (kinds.length < count) {
    kinds.push(...rng.shuffle(EVENT_KINDS).slice(0, Math.min(EVENT_KINDS.length, count - kinds.length)));
  }
  return rng.shuffle(kinds.slice(0, count));
}


function validateEventPools(pools: DungeonEventPools): void {
  validateDungeonEventPools(pools);
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
