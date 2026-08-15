import { RuleError } from "@/lib/domain";
import type { GeneratedMap, NodeId } from "@/lib/domain";

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

const VIEW_WIDTH = 400;
const CENTER_X = 200;
const BRANCH_OFFSET = 120;
const ROW_GAP = 120;

/** 갈래 노드의 x를 ID의 branch 번호로 정한다. 갈래가 아니면 null. */
function branchColumn(id: string): number | null {
  const match = /^node-path-(\d+)-depth-\d+$/.exec(id);
  if (match === null) {
    return null;
  }
  return Number(match[1]) === 1 ? CENTER_X - BRANCH_OFFSET : CENTER_X + BRANCH_OFFSET;
}

/**
 * 지도 구조에서 화면 좌표를 결정한다.
 * y는 depth(입구 0 → 보스 최대)를 뒤집어 입구가 맨 아래로 간다.
 * x는 입구·합류·보스가 중앙, 갈래 노드가 좌우다.
 */
export function layoutMap(map: GeneratedMap): MapLayout {
  const incoming = new Map<string, number>();
  for (const node of map.nodes) {
    for (const next of node.nextNodeIds) {
      incoming.set(next, (incoming.get(next) ?? 0) + 1);
    }
  }

  const maxDepth = Math.max(...map.nodes.map((node) => node.depth));
  const viewHeight = maxDepth * ROW_GAP;

  const nodes = map.nodes.map((node): MapLayoutNode => {
    const y = viewHeight - node.depth * ROW_GAP;
    let x: number;
    if (node.id === map.entryNodeId || node.id === map.bossNodeId) {
      x = CENTER_X;
    } else if ((incoming.get(node.id) ?? 0) >= 2) {
      x = CENTER_X;
    } else {
      const column = branchColumn(node.id);
      if (column === null) {
        throw new RuleError(
          "INVALID_GENERATION",
          `지도 노드 ID가 규약과 다르다: ${node.id}`,
          { nodeId: node.id },
        );
      }
      x = column;
    }
    return { id: node.id, x, y };
  });

  const edges = map.nodes.flatMap((node) =>
    node.nextNodeIds.map((toId): MapLayoutEdge => ({ fromId: node.id, toId })),
  );

  return { viewWidth: VIEW_WIDTH, viewHeight, nodes, edges };
}
