import type { GeneratedMap, NodeId } from "@/lib/domain";

export interface U4OptimizedLayerOrder {
  readonly rows: readonly (readonly NodeId[])[];
  readonly crossingCount: number;
}

interface Score {
  crossings: number;
  displacement: number;
}

interface State extends Score {
  previousOrderIndex: number | null;
}

function rowsForMap(map: GeneratedMap): readonly (readonly NodeId[])[] {
  return [
    [map.entryNodeId],
    ...map.layers.map((layer) => [...layer.nodeIds]),
    [map.bossNodeId],
  ];
}

function permutations<T>(values: readonly T[]): readonly (readonly T[])[] {
  if (values.length <= 1) return [[...values]];
  const result: T[][] = [];
  values.forEach((value, index) => {
    const rest = [...values.slice(0, index), ...values.slice(index + 1)];
    for (const suffix of permutations(rest)) result.push([value, ...suffix]);
  });
  return result;
}

function rowDisplacement(
  original: readonly NodeId[],
  candidate: readonly NodeId[],
): number {
  const originalIndex = new Map(original.map((nodeId, index) => [nodeId, index]));
  return candidate.reduce(
    (total, nodeId, index) =>
      total + Math.abs(index - originalIndex.get(nodeId)!),
    0,
  );
}

function better(left: Score, right: Score): boolean {
  return (
    left.crossings < right.crossings ||
    (left.crossings === right.crossings &&
      left.displacement < right.displacement)
  );
}

function countCrossingsBetween(
  map: GeneratedMap,
  sourceOrder: readonly NodeId[],
  targetOrder: readonly NodeId[],
): number {
  const sourceIndex = new Map(
    sourceOrder.map((nodeId, index) => [nodeId, index]),
  );
  const targetIndex = new Map(
    targetOrder.map((nodeId, index) => [nodeId, index]),
  );
  const edges: {
    sourceId: NodeId;
    targetId: NodeId;
    sourceIndex: number;
    targetIndex: number;
  }[] = [];

  for (const node of map.nodes) {
    const from = sourceIndex.get(node.id);
    if (from === undefined) continue;
    for (const targetId of node.nextNodeIds) {
      const to = targetIndex.get(targetId);
      if (to === undefined) continue;
      edges.push({
        sourceId: node.id,
        targetId,
        sourceIndex: from,
        targetIndex: to,
      });
    }
  }

  let crossings = 0;
  for (let left = 0; left < edges.length; left += 1) {
    const edgeA = edges[left]!;
    for (let right = left + 1; right < edges.length; right += 1) {
      const edgeB = edges[right]!;
      if (
        edgeA.sourceId === edgeB.sourceId ||
        edgeA.targetId === edgeB.targetId
      ) {
        continue;
      }
      if (
        (edgeA.sourceIndex - edgeB.sourceIndex) *
          (edgeA.targetIndex - edgeB.targetIndex) <
        0
      ) {
        crossings += 1;
      }
    }
  }
  return crossings;
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
    crossings += countCrossingsBetween(
      map,
      rows[rowIndex]!,
      rows[rowIndex + 1]!,
    );
  }
  return crossings;
}

export function createU4OptimizedLayerOrder(
  map: GeneratedMap,
): U4OptimizedLayerOrder {
  const originalRows = rowsForMap(map);
  const candidates = originalRows.map((row) => permutations(row));
  const states: State[][] = candidates.map(() => []);

  states[0] = [{
    crossings: 0,
    displacement: 0,
    previousOrderIndex: null,
  }];

  for (let rowIndex = 1; rowIndex < candidates.length; rowIndex += 1) {
    states[rowIndex] = candidates[rowIndex]!.map((candidate) => {
      let best: State | null = null;
      candidates[rowIndex - 1]!.forEach((previous, previousOrderIndex) => {
        const previousState = states[rowIndex - 1]![previousOrderIndex]!;
        const score: State = {
          crossings:
            previousState.crossings +
            countCrossingsBetween(map, previous, candidate),
          displacement:
            previousState.displacement +
            rowDisplacement(originalRows[rowIndex]!, candidate),
          previousOrderIndex,
        };
        if (best === null || better(score, best)) best = score;
      });
      if (best === null) {
        throw new Error("U4 최적 행 순서를 계산하지 못했습니다.");
      }
      return best;
    });
  }

  const finalRowIndex = candidates.length - 1;
  let finalOrderIndex = 0;
  for (
    let candidateIndex = 1;
    candidateIndex < states[finalRowIndex]!.length;
    candidateIndex += 1
  ) {
    if (
      better(
        states[finalRowIndex]![candidateIndex]!,
        states[finalRowIndex]![finalOrderIndex]!,
      )
    ) {
      finalOrderIndex = candidateIndex;
    }
  }

  const rows: (readonly NodeId[])[] = new Array(candidates.length);
  let orderIndex = finalOrderIndex;
  for (let rowIndex = finalRowIndex; rowIndex >= 0; rowIndex -= 1) {
    rows[rowIndex] = candidates[rowIndex]![orderIndex]!;
    const previousOrderIndex = states[rowIndex]![orderIndex]!.previousOrderIndex;
    if (previousOrderIndex !== null) orderIndex = previousOrderIndex;
  }

  return {
    rows,
    crossingCount: states[finalRowIndex]![finalOrderIndex]!.crossings,
  };
}
