import { describe, expect, it } from "vitest";
import type { GeneratedMap, NodeId } from "@/lib/domain";
import {
  countU4LayerCrossings,
  createU4OptimizedLayerOrder,
} from "./u4-dungeon-map-order";

const id = (value: string) => value as NodeId;
const ENTRY = id("entry");
const A = id("a");
const B = id("b");
const C = id("c");
const D = id("d");
const BOSS = id("boss");

const CROSSING_MAP: GeneratedMap = {
  entryNodeId: ENTRY,
  bossNodeId: BOSS,
  layers: [
    { depth: 1, nodeIds: [A, B] },
    { depth: 2, nodeIds: [C, D] },
  ],
  nodes: [
    { id: ENTRY, kind: "entry", nextNodeIds: [A, B] },
    { id: A, kind: "normal", nextNodeIds: [D] },
    { id: B, kind: "normal", nextNodeIds: [C] },
    { id: C, kind: "normal", nextNodeIds: [BOSS] },
    { id: D, kind: "normal", nextNodeIds: [BOSS] },
    { id: BOSS, kind: "boss", nextNodeIds: [] },
  ],
};

describe("U4 global layer ordering", () => {
  it("removes crossings when a zero-crossing row order exists", () => {
    const originalRows = [
      [ENTRY],
      [A, B],
      [C, D],
      [BOSS],
    ] as const;
    expect(countU4LayerCrossings(CROSSING_MAP, originalRows)).toBe(1);

    const optimized = createU4OptimizedLayerOrder(CROSSING_MAP);
    expect(optimized.crossingCount).toBe(0);
    expect(countU4LayerCrossings(CROSSING_MAP, optimized.rows)).toBe(0);
  });

  it("returns the same minimum order for the same map", () => {
    expect(createU4OptimizedLayerOrder(CROSSING_MAP)).toEqual(
      createU4OptimizedLayerOrder(CROSSING_MAP),
    );
  });

  it("keeps every row member exactly once", () => {
    const optimized = createU4OptimizedLayerOrder(CROSSING_MAP);
    expect(optimized.rows.map((row) => [...row].sort())).toEqual([
      [ENTRY],
      [A, B].sort(),
      [C, D].sort(),
      [BOSS],
    ]);
  });
});
