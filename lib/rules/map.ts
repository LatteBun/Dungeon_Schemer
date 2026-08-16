import { CAMPAIGN_GRADE_CONFIG } from "@/lib/content/dungeons";
import {
  BOSS_RISK_SUMMARY,
  DUNGEON_EVENT_POOLS,
  EVENT_KIND_RISK_SUMMARY,
} from "@/lib/content/events";
import type { DungeonEventPools } from "@/lib/content/events";
import { validateDungeonEventPools } from "@/lib/content/validation";
import { EVENT_KINDS, RuleError } from "@/lib/domain";
import type {
  DungeonEvent,
  EventKind,
  GeneratedMap,
  Grade,
  MapNode,
  MapPath,
  NodeId,
} from "@/lib/domain";
import type { Rng } from "@/lib/rng";

export interface GenerateMapOptions {
  readonly eventPools?: DungeonEventPools;
}

/** 지도는 항상 두 갈래다. 상위 spec의 대칭 구조가 두 갈래를 전제한다. */
const BRANCHES = [1, 2] as const;

const nodeId = (value: string): NodeId => value as NodeId;
const ENTRY_ID = nodeId("node-entry");
const MERGE_ID = nodeId("node-merge");
const BOSS_ID = nodeId("node-boss");
const branchNodeId = (branch: number, depth: number): NodeId =>
  nodeId(`node-path-${branch}-depth-${depth}`);

/**
 * 정보 기회를 놓을 수 있는 한 자리다.
 *
 * 갈래 자리는 지점 하나가 아니라 깊이 하나를 가리킨다. 그 깊이를 고르면 양쪽
 * 갈래의 같은 깊이에 함께 표시해야 두 경로의 정보 횟수가 어긋나지 않는다.
 */
type InfoSlot = "node-entry" | "node-merge" | `depth-${number}`;

function invalid(message: string, details: Record<string, unknown>): never {
  throw new RuleError("INVALID_GENERATION", message, details);
}

function infoSlots(branchLength: number): InfoSlot[] {
  return [
    ...Array.from({ length: branchLength }, (_, index): InfoSlot => `depth-${index + 1}`),
    "node-merge",
  ];
}

/**
 * 등급이 요구하는 서로 다른 사건 수를 풀이 감당하는지 확인한다.
 *
 * 필요한 수는 보스방을 뺀 지점 수 `2L + 2`다. 분류별 최소 보유량은 사건 풀
 * 검증이 이미 보장하므로, 여기서는 전체 용량만 본다. 자유 칸은 분류를 가리지
 * 않고 남은 용량에서 뽑기 때문이다.
 */
function assertPoolCapacity(
  grade: Grade,
  branchLength: number,
  pools: DungeonEventPools,
): void {
  const required = branchLength * 2 + 2;
  const available = EVENT_KINDS.reduce(
    (sum, kind) => sum + pools.regular[kind].length,
    0,
  );
  if (available < required) {
    invalid(
      `${grade}급 지도에 필요한 서로 다른 사건이 부족하다: ${required}개 중 ${available}개`,
      { grade, expected: required, actual: available },
    );
  }
}

/**
 * 갈래 한쪽에 놓을 분류 목록을 만든다.
 *
 * 입구와 합류가 두 분류를 맡으므로 각 갈래는 나머지 두 분류를 반드시 포함해야
 * 어느 경로를 골라도 네 분류를 지난다. 남는 칸은 호출자가 남은 풀 용량에서
 * 뽑아 넘긴 자유 분류로 채운다.
 */
function branchKinds(
  requiredKinds: readonly EventKind[],
  freeKinds: readonly EventKind[],
  rng: Rng,
): EventKind[] {
  return rng.shuffle([...requiredKinds, ...freeKinds]);
}

export function generateGradeMap(
  grade: Grade,
  rng: Rng,
  options: GenerateMapOptions = {},
): GeneratedMap {
  const pools = options.eventPools ?? DUNGEON_EVENT_POOLS;
  const config = CAMPAIGN_GRADE_CONFIG[grade];
  const { branchLength } = config;

  // 난수를 쓰기 전에 거부한다. 절반쯤 만든 지도를 버리면 같은 시드가 같은
  // 결과를 내지 않는다.
  validateDungeonEventPools(pools);
  assertPoolCapacity(grade, branchLength, pools);

  const chosenSlots = rng.shuffle(infoSlots(branchLength))
    .slice(0, config.infoOpportunityCount);
  const infoKeys = new Set<string>(chosenSlots);
  const bossKeys = new Set<string>(
    rng.shuffle(chosenSlots).slice(0, config.bossRelatedInfoCount),
  );

  const [entryKind, mergeKind, ...requiredKinds] = rng.shuffle(EVENT_KINDS);

  // 역할이 정해진 칸을 먼저 빼고 남은 용량만 자유 칸 후보로 만든다. 분류마다
  // 남은 수만큼 표를 넣어 두면 뽑기가 자동으로 풀 크기를 넘지 않는다.
  const reserved = new Map<EventKind, number>(EVENT_KINDS.map((kind) => [kind, 0]));
  const reserve = (kind: EventKind, count: number): void => {
    reserved.set(kind, (reserved.get(kind) ?? 0) + count);
  };
  reserve(entryKind, 1);
  reserve(mergeKind, 1);
  for (const kind of requiredKinds) reserve(kind, BRANCHES.length);

  const freePool = EVENT_KINDS.flatMap((kind) =>
    Array.from(
      { length: pools.regular[kind].length - (reserved.get(kind) ?? 0) },
      () => kind,
    ));
  const freePerBranch = branchLength - requiredKinds.length;
  const drawnFree = rng.shuffle(freePool).slice(0, freePerBranch * BRANCHES.length);

  const queues = new Map<EventKind, DungeonEvent[]>(
    EVENT_KINDS.map((kind) => [kind, rng.shuffle(pools.regular[kind])]),
  );
  const takeEvent = (kind: EventKind): DungeonEvent => {
    const event = queues.get(kind)?.shift();
    if (event === undefined) {
      invalid(`${grade}급 지도를 채우는 중 ${kind} 사건이 떨어졌다.`, { grade, kind });
    }
    return event;
  };

  const regularNode = (
    id: NodeId,
    depth: number,
    nextNodeIds: NodeId[],
    kind: EventKind,
    slot: InfoSlot,
  ): MapNode => ({
    id,
    depth,
    nextNodeIds,
    eventId: takeEvent(kind).id,
    riskSummary: EVENT_KIND_RISK_SUMMARY[kind],
    hasInfoOpportunity: infoKeys.has(slot),
    bossRelatedInfoCount: bossKeys.has(slot) ? 1 : 0,
  });

  const nodes: MapNode[] = [
    regularNode(
      ENTRY_ID,
      0,
      BRANCHES.map((branch) => branchNodeId(branch, 1)),
      entryKind,
      "node-entry",
    ),
  ];

  for (const branch of BRANCHES) {
    const kinds = branchKinds(
      requiredKinds,
      drawnFree.slice((branch - 1) * freePerBranch, branch * freePerBranch),
      rng,
    );
    for (let depth = 1; depth <= branchLength; depth += 1) {
      nodes.push(regularNode(
        branchNodeId(branch, depth),
        depth,
        [depth === branchLength ? MERGE_ID : branchNodeId(branch, depth + 1)],
        kinds[depth - 1],
        `depth-${depth}`,
      ));
    }
  }

  nodes.push(regularNode(MERGE_ID, branchLength + 1, [BOSS_ID], mergeKind, "node-merge"));
  nodes.push({
    id: BOSS_ID,
    depth: branchLength + 2,
    nextNodeIds: [],
    eventId: rng.pick(pools.boss).id,
    riskSummary: BOSS_RISK_SUMMARY,
    hasInfoOpportunity: false,
    bossRelatedInfoCount: 0,
  });

  const byId = new Map(nodes.map((node) => [node.id as string, node]));
  const paths: MapPath[] = BRANCHES.map((branch) => {
    const nodeIds = [
      ENTRY_ID,
      ...Array.from({ length: branchLength }, (_, index) =>
        branchNodeId(branch, index + 1)),
      MERGE_ID,
      BOSS_ID,
    ];
    return {
      nodeIds,
      ...countPath(nodeIds.map((id) => byId.get(id as string)!), BOSS_ID),
    };
  });

  const map: GeneratedMap = {
    grade,
    nodes,
    entryNodeId: ENTRY_ID,
    bossNodeId: BOSS_ID,
    paths,
  };
  // 생성기가 스스로를 검증한다. 잘못된 지도가 밖으로 나가면 어느 단계가
  // 어긋났는지 탐험 도중에야 드러난다.
  validateGeneratedMap(map, { eventPools: pools });
  return map;
}

/** 경로 위 지점들에서 실제 수치를 다시 센다. 저장값과 비교하는 기준이 된다. */
function countPath(
  pathNodes: readonly MapNode[],
  bossNodeId: NodeId,
): Omit<MapPath, "nodeIds"> {
  return {
    regularEventCount: pathNodes.filter(
      (node) => node.id !== bossNodeId && node.id !== ENTRY_ID,
    ).length,
    infoCount: pathNodes.filter((node) => node.hasInfoOpportunity).length,
    bossRelatedInfoCount: pathNodes.reduce(
      (sum, node) => sum + node.bossRelatedInfoCount,
      0,
    ),
  };
}

function assertStructure(map: GeneratedMap, expectedNodes: number): Map<string, MapNode> {
  if (map.nodes.length !== expectedNodes) {
    invalid(
      `${map.grade}급 지도의 지점 수가 다르다: ${expectedNodes}개가 아니라 ${map.nodes.length}개다`,
      { grade: map.grade, expected: expectedNodes, actual: map.nodes.length },
    );
  }

  const byId = new Map(map.nodes.map((node) => [node.id as string, node]));
  if (byId.size !== map.nodes.length) {
    invalid("지도에 중복된 지점 식별자가 있다.", { grade: map.grade });
  }

  const entry = byId.get(map.entryNodeId as string);
  const boss = byId.get(map.bossNodeId as string);
  if (entry === undefined || boss === undefined) {
    invalid("입구 또는 보스방 지점이 지도에 없다.", {
      grade: map.grade,
      entryNodeId: map.entryNodeId,
      bossNodeId: map.bossNodeId,
    });
  }
  if (entry.depth !== 0) {
    invalid(`입구 깊이는 0이어야 한다: ${entry.depth}`, { grade: map.grade, depth: entry.depth });
  }
  if (boss.nextNodeIds.length > 0 || boss.hasInfoOpportunity) {
    invalid("보스방은 다음 지점과 정보 기회를 가질 수 없다.", { grade: map.grade });
  }

  for (const node of map.nodes) {
    for (const next of node.nextNodeIds) {
      const target = byId.get(next as string);
      if (target === undefined) {
        invalid(`없는 지점으로 연결된다: ${node.id} → ${next}`, { nodeId: node.id, nextNodeId: next });
      }
      // 깊이가 반드시 늘어나면 되돌아가는 간선이 없으므로 순환이 생기지 않는다.
      if (target.depth <= node.depth) {
        invalid(`뒤로 가는 간선이 있다: ${node.id} → ${next}`, { nodeId: node.id, nextNodeId: next });
      }
    }
  }

  const reachable = new Set<string>();
  const stack: string[] = [map.entryNodeId as string];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const next of byId.get(id)?.nextNodeIds ?? []) stack.push(next as string);
  }
  if (reachable.size !== map.nodes.length) {
    invalid("입구에서 도달할 수 없는 지점이 있다.", {
      grade: map.grade,
      expected: map.nodes.length,
      actual: reachable.size,
    });
  }
  const deadEnds = map.nodes
    .filter((node) => node.nextNodeIds.length === 0)
    .map((node) => node.id);
  if (deadEnds.length !== 1 || deadEnds[0] !== map.bossNodeId) {
    invalid("보스방에 도달하지 못하고 끊기는 지점이 있다.", {
      grade: map.grade,
      deadEnds,
    });
  }

  return byId;
}

export function validateGeneratedMap(
  map: GeneratedMap,
  options: GenerateMapOptions = {},
): void {
  const pools = options.eventPools ?? DUNGEON_EVENT_POOLS;
  const config = CAMPAIGN_GRADE_CONFIG[map.grade];
  const byId = assertStructure(map, config.branchLength * 2 + 3);

  const eventIds = map.nodes.map((node) => node.eventId as string);
  if (new Set(eventIds).size !== eventIds.length) {
    invalid("한 지도 안에서 사건이 중복된다.", { grade: map.grade });
  }

  const kindById = new Map<string, EventKind>(
    EVENT_KINDS.flatMap((kind) =>
      pools.regular[kind].map((event) => [event.id as string, kind])),
  );
  const bossEventIds = new Set(pools.boss.map((event) => event.id as string));

  if (!bossEventIds.has(map.nodes.find((node) => node.id === map.bossNodeId)!.eventId as string)) {
    invalid("보스방에 보스 사건이 놓이지 않았다.", { grade: map.grade });
  }

  if (map.paths.length !== BRANCHES.length) {
    invalid(`경로는 ${BRANCHES.length}개여야 한다: ${map.paths.length}개다`, {
      grade: map.grade,
      expected: BRANCHES.length,
      actual: map.paths.length,
    });
  }

  for (const path of map.paths) {
    if (path.nodeIds[0] !== map.entryNodeId
      || path.nodeIds[path.nodeIds.length - 1] !== map.bossNodeId) {
      invalid("경로가 입구에서 시작해 보스방에서 끝나지 않는다.", { grade: map.grade });
    }
    const pathNodes = path.nodeIds.map((id) => {
      const node = byId.get(id as string);
      if (node === undefined) invalid(`경로에 없는 지점이 있다: ${id}`, { nodeId: id });
      return node;
    });
    for (let index = 0; index < pathNodes.length - 1; index += 1) {
      if (!pathNodes[index].nextNodeIds.includes(path.nodeIds[index + 1])) {
        invalid(
          `경로가 간선으로 연결되지 않는다: ${path.nodeIds[index]} → ${path.nodeIds[index + 1]}`,
          { grade: map.grade },
        );
      }
    }

    const counted = countPath(pathNodes, map.bossNodeId);
    const expected = {
      regularEventCount: config.branchLength + 1,
      infoCount: config.infoOpportunityCount,
      bossRelatedInfoCount: config.bossRelatedInfoCount,
    };
    if (counted.regularEventCount !== expected.regularEventCount
      || path.regularEventCount !== expected.regularEventCount) {
      invalid(
        `경로의 일반 사건 수가 ${expected.regularEventCount}개가 아니다: ${counted.regularEventCount}개다`,
        { grade: map.grade, ...expected, actual: counted.regularEventCount },
      );
    }
    if (counted.infoCount !== expected.infoCount || path.infoCount !== expected.infoCount) {
      invalid(
        `경로의 정보 전달 기회가 ${expected.infoCount}회가 아니다: ${counted.infoCount}회다`,
        { grade: map.grade, expected: expected.infoCount, actual: counted.infoCount },
      );
    }
    if (counted.bossRelatedInfoCount !== expected.bossRelatedInfoCount
      || path.bossRelatedInfoCount !== expected.bossRelatedInfoCount) {
      invalid(
        `경로의 보스 관련 정보 보장이 ${expected.bossRelatedInfoCount}회가 아니다: ${counted.bossRelatedInfoCount}회다`,
        {
          grade: map.grade,
          expected: expected.bossRelatedInfoCount,
          actual: counted.bossRelatedInfoCount,
        },
      );
    }

    const kinds = new Set(
      pathNodes
        .filter((node) => node.id !== map.bossNodeId)
        .map((node) => {
          const kind = kindById.get(node.eventId as string);
          if (kind === undefined) {
            invalid(`풀에 없는 사건이 배치됐다: ${node.eventId}`, { eventId: node.eventId });
          }
          return kind;
        }),
    );
    for (const kind of EVENT_KINDS) {
      if (!kinds.has(kind)) {
        invalid(`경로에 ${kind} 사건 분류가 없다.`, { grade: map.grade, kind });
      }
    }
  }

  for (const node of map.nodes) {
    if (node.bossRelatedInfoCount > 0 && !node.hasInfoOpportunity) {
      invalid(`정보 기회 없이 보스 보장이 붙은 지점이다: ${node.id}`, { nodeId: node.id });
    }
  }
}
