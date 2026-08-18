import {
  CAMPAIGN_GRADE_CONFIG,
  MAX_LAYER_WIDTH,
  MAX_NEXT_NODES,
} from "@/lib/content/dungeons";
import {
  BOSS_RISK_SUMMARY,
  DUNGEON_EVENT_POOLS,
  ENTRY_EVENT,
  ENTRY_RISK_SUMMARY,
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
  NodeId,
} from "@/lib/domain";
import type { Rng } from "@/lib/rng";

export interface GenerateMapOptions {
  readonly eventPools?: DungeonEventPools;
}

const nodeId = (value: string): NodeId => value as NodeId;
export const ENTRY_NODE_ID = nodeId("node-entry");
export const BOSS_NODE_ID = nodeId("node-boss");

/** 층과 열로 지점 이름을 짓는다. 화면과 로그가 위치를 바로 읽는다. */
const layerNodeId = (depth: number, column: number): NodeId =>
  nodeId(`node-d${depth}-c${column}`);

function invalid(message: string, details: Record<string, unknown>): never {
  throw new RuleError("INVALID_GENERATION", message, details);
}

/**
 * 층마다 지점을 몇 개 둘지 정한다.
 *
 * 모두 1로 시작해 남는 만큼을 시드로 고른 층에 하나씩 얹는다. 얹을 때마다 세 조건을
 * 확인한다. 층 너비 상한, 입구의 나가는 간선 상한, 그리고 앞 층이 만들 수 있는
 * 간선 수다. 앞 층이 `w`개면 간선은 최대 `2w`개이므로 다음 층은 그보다 넓을 수 없다.
 * docs/superpowers/specs/2026-08-18-sbh3821-irregular-map-generation-design.md
 */
function layerWidths(
  grade: Grade,
  pathLength: number,
  eventNodeCount: number,
  rng: Rng,
): number[] {
  const widths = Array.from({ length: pathLength }, () => 1);
  let remaining = eventNodeCount - pathLength;
  if (remaining < 0) {
    invalid(
      `${grade}급 지도의 지점 수가 경로 길이보다 적다: ${eventNodeCount} < ${pathLength}`,
      { grade, pathLength, eventNodeCount },
    );
  }

  const fits = (index: number): boolean => {
    const next = widths[index] + 1;
    if (next > MAX_LAYER_WIDTH) return false;
    // 첫 층은 입구 하나가 모두 이어야 하므로 입구의 간선 상한을 넘을 수 없다.
    const parentWidth = index === 0 ? 1 : widths[index - 1];
    if (next > parentWidth * MAX_NEXT_NODES) return false;
    const child = widths[index + 1];
    return child === undefined || child <= next * MAX_NEXT_NODES;
  };

  while (remaining > 0) {
    const candidates = widths
      .map((_, index) => index)
      .filter((index) => fits(index));
    if (candidates.length === 0) {
      invalid(
        `${grade}급 지도의 지점 ${eventNodeCount}개를 층 ${pathLength}개에 담을 수 없다`,
        { grade, pathLength, eventNodeCount, widths },
      );
    }
    widths[rng.pick(candidates)] += 1;
    remaining -= 1;
  }

  return widths;
}

/**
 * 층과 층 사이를 잇는다. 간선이 서로 교차하지 않는다.
 *
 * 부모를 아무렇게나 고르면 왼쪽 부모가 오른쪽 자식으로, 오른쪽 부모가 왼쪽
 * 자식으로 가면서 선이 엇갈린다. 그래서 부모를 **왼쪽부터 순서대로** 훑으며
 * 자식도 왼쪽부터 이어 붙인다. 열 순서가 곧 화면의 좌우 순서이므로, 간선을
 * 부모 열 기준으로 정렬했을 때 자식 열이 줄지 않으면 교차가 생기지 않는다.
 *
 * 각 부모는 자식 1~2명을 맡는다. 2명이면 갈림길이고, 앞 부모가 맡은 마지막
 * 자식을 다시 맡으면 그 자리가 합류점이다. 둘 다 순서를 깨지 않는다.
 *
 * 흔들림은 열 간격보다 작으므로 좌우 순서를 뒤집지 못한다. 그래서 순서가 교차
 * 없음을 그대로 보장한다.
 * docs/superpowers/specs/2026-08-18-sbh3821-irregular-map-generation-design.md
 */
function connectLayers(
  parents: readonly NodeId[],
  children: readonly NodeId[],
  rng: Rng,
): Map<string, NodeId[]> {
  const edges = new Map<string, NodeId[]>(parents.map((id) => [id as string, []]));
  // 아직 부모가 없는 첫 자식. 이 왼쪽은 모두 이어졌다.
  let cursor = 0;

  for (let index = 0; index < parents.length; index += 1) {
    const parentsLeft = parents.length - index - 1;
    // 앞 부모의 마지막 자식부터 시작하면 그 자식이 합류점이 된다.
    const starts = cursor > 0 ? [cursor - 1, cursor] : [cursor];
    const options: { start: number; span: number }[] = [];

    for (const start of starts) {
      for (const span of [1, MAX_NEXT_NODES]) {
        if (start + span > children.length) continue;
        const next = Math.max(cursor, start + span);
        // 남은 부모가 나머지 자식을 다 맡을 수 있어야 빈 자식이 남지 않는다.
        if (children.length - next > parentsLeft * MAX_NEXT_NODES) continue;
        // 마지막 부모는 마지막 자식까지 맡아야 한다.
        if (parentsLeft === 0 && next !== children.length) continue;
        options.push({ start, span });
      }
    }

    if (options.length === 0) {
      invalid("교차 없이 층을 이을 수 없다. 층 너비 계산이 잘못됐다.", {
        parents: parents.length,
        children: children.length,
        cursor,
      });
    }

    const chosen = rng.pick(options);
    for (let offset = 0; offset < chosen.span; offset += 1) {
      edges.get(parents[index] as string)!.push(children[chosen.start + offset]);
    }
    cursor = Math.max(cursor, chosen.start + chosen.span);
  }

  return edges;
}

/**
 * 등급이 요구하는 서로 다른 사건 수를 풀이 감당하는지 확인한다.
 *
 * 한 던전 안에서 같은 사건을 두 번 쓰지 않으므로 지점 수만큼 사건이 필요하다.
 */
function assertPoolCapacity(
  grade: Grade,
  eventNodeCount: number,
  pools: DungeonEventPools,
): void {
  const available = EVENT_KINDS.reduce(
    (sum, kind) => sum + pools.regular[kind].length,
    0,
  );
  if (available < eventNodeCount) {
    invalid(
      `${grade}급 지도에 필요한 서로 다른 사건이 부족하다: ${eventNodeCount}개 중 ${available}개`,
      { grade, expected: eventNodeCount, actual: available },
    );
  }
}

export function generateGradeMap(
  grade: Grade,
  rng: Rng,
  options: GenerateMapOptions = {},
): GeneratedMap {
  const pools = options.eventPools ?? DUNGEON_EVENT_POOLS;
  const config = CAMPAIGN_GRADE_CONFIG[grade];
  const { pathLength, eventNodeCount } = config;

  // 난수를 쓰기 전에 거부한다. 절반쯤 만든 지도를 버리면 같은 시드가 같은 결과를
  // 내지 않는다.
  validateDungeonEventPools(pools);
  assertPoolCapacity(grade, eventNodeCount, pools);
  if (pathLength < EVENT_KINDS.length) {
    invalid(
      `${grade}급 경로가 네 분류를 담기에 짧다: ${pathLength}층`,
      { grade, pathLength, kinds: EVENT_KINDS.length },
    );
  }

  const widths = layerWidths(grade, pathLength, eventNodeCount, rng);
  const depths = Array.from({ length: pathLength }, (_, index) => index + 1);
  const idsByDepth = new Map<number, NodeId[]>(
    depths.map((depth, index) => [
      depth,
      Array.from({ length: widths[index] }, (_, column) => layerNodeId(depth, column)),
    ]),
  );

  // 보장 깊이 넷. 어느 길로 가도 이 깊이를 지나므로 네 분류 커버리지가 구조에서
  // 나온다. 경로를 세지 않아도 된다.
  const guaranteedDepths = rng.shuffle(depths).slice(0, EVENT_KINDS.length);
  const kindByGuaranteedDepth = new Map<number, EventKind>(
    rng.shuffle(EVENT_KINDS).map((kind, index) => [guaranteedDepths[index], kind]),
  );

  const infoDepths = new Set(
    rng.shuffle(depths).slice(0, config.infoOpportunityCount),
  );
  const bossDepths = new Set(
    rng.shuffle([...infoDepths]).slice(0, config.bossRelatedInfoCount),
  );

  // 보장 깊이 몫을 먼저 떼어 놓는다. 자유 깊이가 앞에 있으면 그 분류를 다 써 버려
  // 뒤에 오는 보장 깊이가 사건을 못 받는다.
  const remaining = new Map<EventKind, number>(
    EVENT_KINDS.map((kind) => [kind, pools.regular[kind].length]),
  );
  for (const [depth, kind] of kindByGuaranteedDepth) {
    const width = idsByDepth.get(depth)!.length;
    const left = (remaining.get(kind) ?? 0) - width;
    if (left < 0) {
      invalid(
        `보장 깊이 ${depth}의 ${kind} 사건이 부족하다: ${width}개 필요, ${remaining.get(kind) ?? 0}개 보유`,
        { grade, depth, kind, expected: width, actual: remaining.get(kind) ?? 0 },
      );
    }
    remaining.set(kind, left);
  }

  const kindByNode = new Map<string, EventKind>();
  for (const depth of depths) {
    const ids = idsByDepth.get(depth)!;
    const fixed = kindByGuaranteedDepth.get(depth);
    for (const id of ids) {
      if (fixed !== undefined) {
        kindByNode.set(id as string, fixed);
        continue;
      }
      const affordable = EVENT_KINDS.filter((kind) => (remaining.get(kind) ?? 0) > 0);
      if (affordable.length === 0) {
        invalid("자유 깊이에 배정할 사건이 남지 않았다.", { grade, depth });
      }
      const picked = rng.pick(affordable);
      kindByNode.set(id as string, picked);
      remaining.set(picked, (remaining.get(picked) ?? 0) - 1);
    }
  }

  const queues = new Map<EventKind, DungeonEvent[]>(
    EVENT_KINDS.map((kind) => [kind, rng.shuffle(pools.regular[kind])]),
  );
  const takeEvent = (kind: EventKind): DungeonEvent => {
    const event = queues.get(kind)?.shift();
    if (event === undefined) invalid(`${kind} 사건이 떨어졌다.`, { grade, kind });
    return event;
  };

  const edges = new Map<string, NodeId[]>();
  edges.set(ENTRY_NODE_ID as string, [...idsByDepth.get(1)!]);
  for (let index = 0; index < depths.length - 1; index += 1) {
    const layer = connectLayers(
      idsByDepth.get(depths[index])!,
      idsByDepth.get(depths[index + 1])!,
      rng,
    );
    for (const [id, next] of layer) edges.set(id, next);
  }
  for (const id of idsByDepth.get(pathLength)!) {
    edges.set(id as string, [BOSS_NODE_ID]);
  }

  const nodes: MapNode[] = [{
    id: ENTRY_NODE_ID,
    depth: 0,
    column: 0,
    nextNodeIds: edges.get(ENTRY_NODE_ID as string)!,
    eventId: ENTRY_EVENT.id,
    riskSummary: ENTRY_RISK_SUMMARY,
    hasInfoOpportunity: false,
    bossRelatedInfoCount: 0,
  }];

  for (const depth of depths) {
    idsByDepth.get(depth)!.forEach((id, column) => {
      const kind = kindByNode.get(id as string)!;
      nodes.push({
        id,
        depth,
        column,
        nextNodeIds: edges.get(id as string)!,
        eventId: takeEvent(kind).id,
        riskSummary: EVENT_KIND_RISK_SUMMARY[kind],
        hasInfoOpportunity: infoDepths.has(depth),
        bossRelatedInfoCount: bossDepths.has(depth) ? 1 : 0,
      });
    });
  }

  nodes.push({
    id: BOSS_NODE_ID,
    depth: pathLength + 1,
    column: 0,
    nextNodeIds: [],
    eventId: rng.pick(pools.boss).id,
    riskSummary: BOSS_RISK_SUMMARY,
    hasInfoOpportunity: false,
    bossRelatedInfoCount: 0,
  });

  const map: GeneratedMap = {
    grade,
    nodes,
    entryNodeId: ENTRY_NODE_ID,
    bossNodeId: BOSS_NODE_ID,
    regularEventCount: pathLength,
    infoCount: config.infoOpportunityCount,
    bossRelatedInfoCount: config.bossRelatedInfoCount,
  };
  // 생성기가 스스로를 검증한다. 잘못된 지도가 밖으로 나가면 어느 단계가 어긋났는지
  // 탐험 도중에야 드러난다.
  validateGeneratedMap(map, { eventPools: pools });
  return map;
}

export function validateGeneratedMap(
  map: GeneratedMap,
  options: GenerateMapOptions = {},
): void {
  const pools = options.eventPools ?? DUNGEON_EVENT_POOLS;
  const config = CAMPAIGN_GRADE_CONFIG[map.grade];
  const expectedNodes = config.eventNodeCount + 2;

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
    invalid("입구 또는 보스방 지점이 지도에 없다.", { grade: map.grade });
  }
  if (entry.depth !== 0) {
    invalid(`입구 깊이는 0이어야 한다: ${entry.depth}`, { grade: map.grade });
  }
  if (boss.depth !== config.pathLength + 1) {
    invalid(
      `보스방 깊이가 다르다: ${config.pathLength + 1}이 아니라 ${boss.depth}다`,
      { grade: map.grade },
    );
  }

  const byDepth = new Map<number, MapNode[]>();
  for (const node of map.nodes) {
    byDepth.set(node.depth, [...(byDepth.get(node.depth) ?? []), node]);
  }

  for (let depth = 1; depth <= config.pathLength; depth += 1) {
    const layer = byDepth.get(depth) ?? [];
    if (layer.length < 1 || layer.length > MAX_LAYER_WIDTH) {
      invalid(
        `깊이 ${depth}의 지점 수가 1~${MAX_LAYER_WIDTH}를 벗어난다: ${layer.length}개`,
        { grade: map.grade, depth, width: layer.length },
      );
    }
    // 한 깊이의 정보 표시가 갈리면 어느 갈래를 고르느냐로 정보 횟수가 달라진다.
    if (new Set(layer.map((node) => node.hasInfoOpportunity)).size > 1) {
      invalid(`깊이 ${depth}의 정보 표시가 지점마다 다르다.`, { grade: map.grade, depth });
    }
    if (new Set(layer.map((node) => node.bossRelatedInfoCount)).size > 1) {
      invalid(`깊이 ${depth}의 보스 보장이 지점마다 다르다.`, { grade: map.grade, depth });
    }
  }

  for (const node of map.nodes) {
    if (node.nextNodeIds.length > MAX_NEXT_NODES) {
      invalid(
        `다음 지점이 ${MAX_NEXT_NODES}개를 넘는다: ${node.id}에 ${node.nextNodeIds.length}개`,
        { nodeId: node.id, count: node.nextNodeIds.length },
      );
    }
    if (new Set(node.nextNodeIds.map(String)).size !== node.nextNodeIds.length) {
      invalid(`같은 지점을 두 번 가리킨다: ${node.id}`, { nodeId: node.id });
    }
    for (const next of node.nextNodeIds) {
      const target = byId.get(next as string);
      if (target === undefined) {
        invalid(`없는 지점으로 연결된다: ${node.id} → ${next}`, { nodeId: node.id });
      }
      // 깊이를 정확히 1씩 늘려야 어느 길로 가도 진행 횟수가 같다.
      if (target.depth !== node.depth + 1) {
        invalid(
          `간선이 깊이를 정확히 1 늘리지 않는다: ${node.id}(${node.depth}) → ${next}(${target.depth})`,
          { nodeId: node.id, nextNodeId: next },
        );
      }
    }
  }

  // 간선을 부모 열 기준으로 정렬했을 때 자식 열이 줄면 선이 엇갈린다.
  for (let depth = 0; depth <= config.pathLength; depth += 1) {
    const layer = (byDepth.get(depth) ?? [])
      .slice()
      .sort((left, right) => left.column - right.column);
    const columnOf = new Map(
      (byDepth.get(depth + 1) ?? []).map((node) => [node.id as string, node.column]),
    );
    let highest = -1;
    for (const node of layer) {
      const targets = node.nextNodeIds
        .map((next) => columnOf.get(next as string) ?? 0)
        .sort((left, right) => left - right);
      for (const column of targets) {
        if (column < highest) {
          invalid(
            `간선이 교차한다: 깊이 ${depth}의 열 ${node.column}이 열 ${column}으로 되돌아간다`,
            { grade: map.grade, depth, column: node.column, target: column },
          );
        }
      }
      if (targets.length > 0) highest = targets[targets.length - 1];
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
    invalid("보스방에 도달하지 못하고 끊기는 지점이 있다.", { grade: map.grade, deadEnds });
  }

  const eventIds = map.nodes.map((node) => node.eventId as string);
  if (new Set(eventIds).size !== eventIds.length) {
    invalid("한 지도 안에서 사건이 중복된다.", { grade: map.grade });
  }

  const kindById = new Map<string, EventKind>(
    EVENT_KINDS.flatMap((kind) =>
      pools.regular[kind].map((event) => [event.id as string, kind])),
  );
  const bossEventIds = new Set(pools.boss.map((event) => event.id as string));
  if (!bossEventIds.has(boss.eventId as string)) {
    invalid("보스방에 보스 사건이 놓이지 않았다.", { grade: map.grade });
  }

  // 어느 길로 가도 지나는 깊이 중 분류가 통일된 곳이 네 분류를 모두 덮어야 한다.
  const guaranteed = new Set<EventKind>();
  for (let depth = 1; depth <= config.pathLength; depth += 1) {
    const kinds = new Set(
      (byDepth.get(depth) ?? []).map((node) => kindById.get(node.eventId as string)),
    );
    if (kinds.size === 1) {
      const only = [...kinds][0];
      if (only !== undefined) guaranteed.add(only);
    }
  }
  for (const kind of EVENT_KINDS) {
    if (!guaranteed.has(kind)) {
      invalid(`어느 깊이도 ${kind} 분류를 보장하지 않는다.`, { grade: map.grade, kind });
    }
  }

  const infoDepths = new Set(
    map.nodes.filter((node) => node.hasInfoOpportunity).map((node) => node.depth),
  );
  const bossInfoDepths = new Set(
    map.nodes.filter((node) => node.bossRelatedInfoCount > 0).map((node) => node.depth),
  );
  const expected = {
    regularEventCount: config.pathLength,
    infoCount: config.infoOpportunityCount,
    bossRelatedInfoCount: config.bossRelatedInfoCount,
  };
  if (map.regularEventCount !== expected.regularEventCount) {
    invalid(
      `경로의 일반 사건 수가 ${expected.regularEventCount}개가 아니다: ${map.regularEventCount}개다`,
      { grade: map.grade, ...expected },
    );
  }
  if (infoDepths.size !== expected.infoCount || map.infoCount !== expected.infoCount) {
    invalid(
      `경로의 정보 전달 기회가 ${expected.infoCount}회가 아니다: ${infoDepths.size}회다`,
      { grade: map.grade, expected: expected.infoCount, actual: infoDepths.size },
    );
  }
  if (bossInfoDepths.size !== expected.bossRelatedInfoCount
    || map.bossRelatedInfoCount !== expected.bossRelatedInfoCount) {
    invalid(
      `경로의 보스 관련 정보 보장이 ${expected.bossRelatedInfoCount}회가 아니다: ${bossInfoDepths.size}회다`,
      { grade: map.grade, expected: expected.bossRelatedInfoCount, actual: bossInfoDepths.size },
    );
  }
}
