import { RuleError, type NodeId } from "@/lib/domain";

export interface LayeredEdge {
  readonly from: NodeId;
  readonly to: NodeId;
}

export interface LayeredOrderResult {
  readonly rows: readonly (readonly NodeId[])[];
  readonly crossingCount: number;
}

export interface LayeredOrderSolver {
  solve(edges: readonly LayeredEdge[]): LayeredOrderResult;
}

interface Permutation {
  readonly order: readonly NodeId[];
  readonly positions: ReadonlyMap<NodeId, number>;
  readonly displacement: number;
}

interface IndexedEdge {
  readonly sourceIndex: number;
  readonly targetIndex: number;
}

interface Score {
  readonly crossings: number;
  readonly displacement: number;
}

function invalid(message: string, details: Record<string, unknown> = {}): never {
  throw new RuleError("INVALID_GENERATION", message, details);
}

function permutations(row: readonly NodeId[]): Permutation[] {
  const result: Permutation[] = [];
  const used = new Set<number>();
  const current: NodeId[] = [];

  const visit = (): void => {
    if (current.length === row.length) {
      const positions = new Map<NodeId, number>();
      current.forEach((node, index) => positions.set(node, index));
      result.push({
        order: [...current],
        positions,
        displacement: current.reduce((sum, node, index) =>
          sum + Math.abs(row.indexOf(node) - index), 0),
      });
      return;
    }
    for (let index = 0; index < row.length; index += 1) {
      if (used.has(index)) continue;
      used.add(index);
      current.push(row[index]!);
      visit();
      current.pop();
      used.delete(index);
    }
  };
  visit();
  return result;
}

function better(left: Score, right: Score): boolean {
  return left.crossings < right.crossings ||
    (left.crossings === right.crossings && left.displacement < right.displacement);
}

function crosses(a: IndexedEdge, b: IndexedEdge): boolean {
  return a.sourceIndex !== b.sourceIndex && a.targetIndex !== b.targetIndex &&
    (a.sourceIndex - b.sourceIndex) * (a.targetIndex - b.targetIndex) < 0;
}

export function createLayeredOrderSolver(
  rows: readonly (readonly NodeId[])[],
): LayeredOrderSolver {
  if (rows.length === 0) invalid("Layered map must contain at least one row");

  const rowIndex = new Map<NodeId, number>();
  const cachedPermutations = rows.map((row, index) => {
    if (row.length === 0 || row.length > 6) {
      invalid("Layered row width must be between 1 and 6", { row: index });
    }
    for (const node of row) {
      if (rowIndex.has(node)) invalid("Layered node must be unique", { node });
      rowIndex.set(node, index);
    }
    return permutations(row);
  });

  return {
    solve(edges) {
      const grouped: LayeredEdge[][] = rows.slice(0, -1).map(() => []);
      const seen = new Set<string>();
      for (const edge of edges) {
        const sourceRow = rowIndex.get(edge.from);
        const targetRow = rowIndex.get(edge.to);
        if (sourceRow === undefined || targetRow === undefined) {
          invalid("Layered edge endpoint is unknown", { edge });
        }
        if (edge.from === edge.to || targetRow !== sourceRow + 1) {
          invalid("Layered edge must connect adjacent rows", { edge });
        }
        const key = `${edge.from}\u0000${edge.to}`;
        if (seen.has(key)) invalid("Layered edge must be unique", { edge });
        seen.add(key);
        grouped[sourceRow]!.push(edge);
      }

      const costs = grouped.map((pair, row) => pair.map((edge) => ({
        from: edge.from,
        to: edge.to,
        row,
      })));
      const scores: Array<Score | undefined> = cachedPermutations[0]!.map((permutation) => ({
        crossings: 0,
        displacement: permutation.displacement,
      }));
      const previous: number[][] = [];

      for (let row = 0; row < rows.length - 1; row += 1) {
        const nextPermutations = cachedPermutations[row + 1]!;
        const nextScores: Array<Score | undefined> = nextPermutations.map(() => undefined);
        const predecessors: number[] = nextPermutations.map(() => -1);
        for (let nextIndex = 0; nextIndex < nextPermutations.length; nextIndex += 1) {
          const target = nextPermutations[nextIndex]!;
          for (let sourceIndex = 0; sourceIndex < cachedPermutations[row]!.length; sourceIndex += 1) {
            const source = cachedPermutations[row]![sourceIndex]!;
            const base = scores[sourceIndex]!;
            const indexed = costs[row]!.map((edge) => ({
              sourceIndex: source.positions.get(edge.from)!,
              targetIndex: target.positions.get(edge.to)!,
            }));
            let crossingCount = 0;
            for (let first = 0; first < indexed.length; first += 1) {
              for (let second = first + 1; second < indexed.length; second += 1) {
                if (crosses(indexed[first]!, indexed[second]!)) crossingCount += 1;
              }
            }
            const candidate = {
              crossings: base.crossings + crossingCount,
              displacement: base.displacement + target.displacement,
            };
            if (nextScores[nextIndex] === undefined || better(candidate, nextScores[nextIndex]!)) {
              nextScores[nextIndex] = candidate;
              predecessors[nextIndex] = sourceIndex;
            }
          }
        }
        scores.splice(0, scores.length, ...nextScores);
        previous.push(predecessors);
      }

      let bestIndex = 0;
      for (let index = 1; index < scores.length; index += 1) {
        if (better(scores[index]!, scores[bestIndex]!)) bestIndex = index;
      }
      const selected = new Array<number>(rows.length);
      selected[rows.length - 1] = bestIndex;
      for (let row = rows.length - 2; row >= 0; row -= 1) {
        selected[row] = previous[row]![selected[row + 1]!]!;
      }
      return {
        rows: selected.map((index, row) => cachedPermutations[row]![index]!.order),
        crossingCount: scores[bestIndex]!.crossings,
      };
    },
  };
}
