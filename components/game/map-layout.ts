import type { GeneratedMap, MapNode, NodeId } from "@/lib/domain";

export interface MapLayoutNode {
  id: NodeId;
  x: number;
  y: number;
}

export interface MapLayoutEdge {
  fromId: NodeId;
  toId: NodeId;
}

export interface MapLayout {
  viewWidth: number;
  viewHeight: number;
  nodes: MapLayoutNode[];
  edges: MapLayoutEdge[];
}

const VIEW_WIDTH = 480;
const CENTER_X = 240;
const COLUMN_GAP = 128;
const ROW_GAP = 76;

/**
 * 층 구조가 계단으로 보이지 않게 흔드는 폭.
 *
 * 세로는 층 간격이 좁아 조금만 흔든다. 가로는 여유가 있어 더 흔들어도 겹치지 않는다.
 */
const JITTER_X = 30;
const JITTER_Y = 11;

/**
 * 지점 ID에서 뽑는 고정 난수다.
 *
 * 그릴 때마다 새로 뽑으면 지도가 출렁인다. ID에서 뽑으면 같은 지도는 언제 그려도
 * 같은 모양이고, 시드가 다르면 흔들림도 달라진다.
 */
function jitter(id: string, salt: number): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash = Math.imul(hash ^ salt, 2246822507);
  hash ^= hash >>> 13;
  // -1 이상 1 미만으로 편다.
  return ((hash >>> 0) / 4294967296) * 2 - 1;
}

/** 층 안에서 열을 가운데 정렬한 x. 너비가 1이면 중앙이다. */
function columnX(node: MapNode, width: number): number {
  return CENTER_X + (node.column - (width - 1) / 2) * COLUMN_GAP;
}

/**
 * 지도 구조에서 화면 좌표를 결정한다.
 *
 * y는 깊이를 뒤집어 입구가 맨 아래로 간다. x는 층 안의 열을 가운데 정렬한다.
 * 그다음 지점마다 고정 난수로 흔들어 딱딱한 계단으로 보이지 않게 한다.
 * docs/superpowers/specs/2026-08-18-sbh3821-irregular-map-generation-design.md
 */
export function layoutMap(map: GeneratedMap): MapLayout {
  const widthByDepth = new Map<number, number>();
  for (const node of map.nodes) {
    widthByDepth.set(node.depth, (widthByDepth.get(node.depth) ?? 0) + 1);
  }

  const maxDepth = Math.max(...map.nodes.map((node) => node.depth));
  const viewHeight = maxDepth * ROW_GAP;

  const nodes = map.nodes.map((node): MapLayoutNode => {
    const width = widthByDepth.get(node.depth) ?? 1;
    // 입구와 보스방은 흔들지 않는다. 시작과 끝은 축이 되어야 읽기 쉽다.
    const anchored = node.id === map.entryNodeId || node.id === map.bossNodeId;
    const id = node.id as string;
    return {
      id: node.id,
      x: columnX(node, width) + (anchored ? 0 : jitter(id, 1) * JITTER_X),
      y: viewHeight - node.depth * ROW_GAP + (anchored ? 0 : jitter(id, 2) * JITTER_Y),
    };
  });

  const edges = map.nodes.flatMap((node) =>
    node.nextNodeIds.map((toId): MapLayoutEdge => ({ fromId: node.id, toId })),
  );

  return { viewWidth: VIEW_WIDTH, viewHeight, nodes, edges };
}
