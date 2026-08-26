import type { GeneratedMap, NodeId } from "@/lib/domain";
import { createLayeredOrderSolver } from "@/lib/rules/layered-map-crossing";

export interface U4OptimizedLayerOrder {
  readonly rows: readonly (readonly NodeId[])[];
  readonly crossingCount: number;
}

function rowsForMap(map: GeneratedMap): readonly (readonly NodeId[])[] {
  return [
    [map.entryNodeId],
    ...map.layers.map((layer) => [...layer.nodeIds]),
    [map.bossNodeId],
  ];
}

function rowContainsExactly(
  actual: readonly NodeId[],
  expected: readonly NodeId[],
): boolean {
  if (actual.length !== expected.length) return false;
  const remaining = new Map<NodeId, number>();
  for (const nodeId of expected) {
    remaining.set(nodeId, (remaining.get(nodeId) ?? 0) + 1);
  }
  for (const nodeId of actual) {
    const count = remaining.get(nodeId);
    if (count === undefined || count === 0) return false;
    remaining.set(nodeId, count - 1);
  }
  return [...remaining.values()].every((count) => count === 0);
}

export function countU4LayerCrossings(
  map: GeneratedMap,
  rows: readonly (readonly NodeId[])[],
): number {
  const expectedRows = rowsForMap(map);
  if (rows.length !== expectedRows.length) {
    throw new Error(
      `U4 행 수가 올바르지 않습니다. 예상: ${expectedRows.length}, 실제: ${rows.length}`,
    );
  }
  rows.forEach((row, rowIndex) => {
    if (!rowContainsExactly(row, expectedRows[rowIndex]!)) {
      throw new Error(`U4 ${rowIndex}번 행의 NodeId 구성이 올바르지 않습니다.`);
    }
  });

  let crossings = 0;
  for (let rowIndex = 0; rowIndex < rows.length - 1; rowIndex += 1) {
    const sourceIndex = new Map(rows[rowIndex]!.map((node, index) => [node, index]));
    const targetIndex = new Map(rows[rowIndex + 1]!.map((node, index) => [node, index]));
    const edges = map.nodes.flatMap((node) => node.nextNodeIds.flatMap((to) => {
      const from = sourceIndex.get(node.id);
      const target = targetIndex.get(to);
      return from === undefined || target === undefined ? [] : [{ fromId: node.id, toId: to, from, target }];
    }));
    for (let left = 0; left < edges.length; left += 1) {
      for (let right = left + 1; right < edges.length; right += 1) {
        const a = edges[left]!;
        const b = edges[right]!;
        if (a.fromId === b.fromId || a.toId === b.toId) continue;
        if ((a.from - b.from) * (a.target - b.target) < 0) crossings += 1;
      }
    }
  }
  return crossings;
}

export function createU4OptimizedLayerOrder(
  map: GeneratedMap,
): U4OptimizedLayerOrder {
  const originalRows = rowsForMap(map);
  const edges = map.nodes.flatMap((node) =>
    node.nextNodeIds.map((to) => ({ from: node.id, to })),
  );
  return createLayeredOrderSolver(originalRows).solve(edges);
}
