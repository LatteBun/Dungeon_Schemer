import type { GeneratedMap, NodeId } from "@/lib/domain";

export interface U4Point {
  x: number;
  y: number;
}

export interface U4CorridorLayout {
  from: NodeId;
  to: NodeId;
  start: U4Point;
  end: U4Point;
  length: number;
  angleDeg: number;
}

export interface U4MapLayout {
  nodePositions: Readonly<Partial<Record<NodeId, U4Point>>>;
  corridors: readonly U4CorridorLayout[];
}

const HORIZONTAL_MIN = 0.1;
const HORIZONTAL_MAX = 0.9;
const MAP_TOP = 0.12;
const MAP_BOTTOM = 0.88;
const BOSS_POSITION: U4Point = { x: 0.5, y: MAP_TOP };
const ENTRY_POSITION: U4Point = { x: 0.5, y: MAP_BOTTOM };

function renderGeometry(value: number): number {
  return Number(value.toFixed(4));
}

function renderPoint(x: number, y: number): U4Point {
  return { x: renderGeometry(x), y: renderGeometry(y) };
}

function xPositions(count: number): readonly number[] {
  if (count <= 0) return [];
  if (count === 1) return [0.5];

  const step = (HORIZONTAL_MAX - HORIZONTAL_MIN) / (count - 1);
  return Array.from({ length: count }, (_, index) =>
    HORIZONTAL_MIN + step * index,
  );
}

function depthY(index: number, depthCount: number): number {
  // Entry + all normal depths + Boss are one explicit bottom-to-top row sequence.
  // A normal depth therefore occupies rows 1..depthCount between the two endpoints.
  const rowCount = depthCount + 1;
  const ratio = (index + 1) / rowCount;
  return MAP_BOTTOM - (MAP_BOTTOM - MAP_TOP) * ratio;
}

function requirePosition(
  positions: Readonly<Partial<Record<NodeId, U4Point>>>,
  nodeId: NodeId,
): U4Point {
  const point = positions[nodeId];
  if (point === undefined) {
    throw new Error(`U4 지도 좌표를 찾을 수 없습니다: ${nodeId}`);
  }
  return point;
}

export function createU4DungeonMapLayout(map: GeneratedMap): U4MapLayout {
  const positions: Partial<Record<NodeId, U4Point>> = {
    [map.entryNodeId]: ENTRY_POSITION,
    [map.bossNodeId]: BOSS_POSITION,
  };

  map.layers.forEach((layer, layerIndex) => {
    const xs = xPositions(layer.nodeIds.length);
    const y = depthY(layerIndex, map.layers.length);
    layer.nodeIds.forEach((nodeId, nodeIndex) => {
      positions[nodeId] = renderPoint(xs[nodeIndex]!, y);
    });
  });

  const corridors: U4CorridorLayout[] = [];
  for (const node of map.nodes) {
    const start = requirePosition(positions, node.id);
    for (const nextNodeId of node.nextNodeIds) {
      const end = requirePosition(positions, nextNodeId);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      corridors.push({
        from: node.id,
        to: nextNodeId,
        start,
        end,
        length: renderGeometry(Math.hypot(dx, dy)),
        angleDeg: renderGeometry((Math.atan2(dy, dx) * 180) / Math.PI),
      });
    }
  }

  return {
    nodePositions: positions,
    corridors,
  };
}
