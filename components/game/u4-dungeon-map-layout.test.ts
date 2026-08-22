import { describe, expect, it } from "vitest";
import type { GeneratedMap, NodeId } from "@/lib/domain";
import { createU4DungeonMapLayout } from "./u4-dungeon-map-layout";

const id = (value: string) => value as NodeId;

const ENTRY = id("entry");
const D1A = id("d1-a");
const D1B = id("d1-b");
const D2A = id("d2-a");
const D2B = id("d2-b");
const D2C = id("d2-c");
const D3A = id("d3-a");
const D3B = id("d3-b");
const D3C = id("d3-c");
const D3D = id("d3-d");
const D3E = id("d3-e");
const D4A = id("d4-a");
const D4B = id("d4-b");
const BOSS = id("boss");

const MAP: GeneratedMap = {
  entryNodeId: ENTRY,
  bossNodeId: BOSS,
  layers: [
    { depth: 1, nodeIds: [D1A, D1B] },
    { depth: 2, nodeIds: [D2A, D2B, D2C] },
    { depth: 3, nodeIds: [D3A, D3B, D3C, D3D, D3E] },
    { depth: 4, nodeIds: [D4A, D4B] },
  ],
  nodes: [
    { id: ENTRY, kind: "entry", nextNodeIds: [D1A, D1B] },
    { id: D1A, kind: "normal", nextNodeIds: [D2A, D2B] },
    { id: D1B, kind: "normal", nextNodeIds: [D2B, D2C] },
    { id: D2A, kind: "normal", nextNodeIds: [D3A, D3B] },
    { id: D2B, kind: "normal", nextNodeIds: [D3C] },
    { id: D2C, kind: "normal", nextNodeIds: [D3D, D3E] },
    { id: D3A, kind: "normal", nextNodeIds: [D4A] },
    { id: D3B, kind: "normal", nextNodeIds: [D4A] },
    { id: D3C, kind: "normal", nextNodeIds: [D4A, D4B] },
    { id: D3D, kind: "normal", nextNodeIds: [D4B] },
    { id: D3E, kind: "normal", nextNodeIds: [D4B] },
    { id: D4A, kind: "normal", nextNodeIds: [BOSS] },
    { id: D4B, kind: "normal", nextNodeIds: [BOSS] },
    { id: BOSS, kind: "boss", nextNodeIds: [] },
  ],
};

describe("U4 dungeon map layout", () => {
  it("places entry at bottom center and boss at top center", () => {
    const layout = createU4DungeonMapLayout(MAP);
    const entry = layout.nodePositions[ENTRY];
    const boss = layout.nodePositions[BOSS];
    const firstDepth = layout.nodePositions[D1A];
    const lastDepth = layout.nodePositions[D4A];

    expect(entry?.x).toBeCloseTo(0.5);
    expect(entry?.y).toBeCloseTo(0.93);
    expect(boss?.x).toBeCloseTo(0.5);
    expect(boss?.y).toBeCloseTo(0.06);
    expect(entry!.y).toBeGreaterThan(firstDepth!.y);
    expect(boss!.y).toBeLessThan(lastDepth!.y);
  });

  it("keeps deeper layers progressively higher on screen", () => {
    const layout = createU4DungeonMapLayout(MAP);
    const ys = MAP.layers.map(
      (layer) => layout.nodePositions[layer.nodeIds[0]!]!.y,
    );

    expect(ys[0]).toBeGreaterThan(ys[1]!);
    expect(ys[1]).toBeGreaterThan(ys[2]!);
    expect(ys[2]).toBeGreaterThan(ys[3]!);
  });

  it("fits five rooms inside the horizontal safe area in layer order", () => {
    const layout = createU4DungeonMapLayout(MAP);
    const xs = [D3A, D3B, D3C, D3D, D3E].map(
      (nodeId) => layout.nodePositions[nodeId]!.x,
    );

    expect(new Set(xs).size).toBe(5);
    expect(xs.every((x) => x >= 0.1 && x <= 0.9)).toBe(true);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });

  it("preserves every E1 edge exactly once", () => {
    const layout = createU4DungeonMapLayout(MAP);
    const expectedEdges = MAP.nodes.flatMap((node) =>
      node.nextNodeIds.map((next) => `${node.id}->${next}`),
    );
    const actualEdges = layout.corridors.map(
      (corridor) => `${corridor.from}->${corridor.to}`,
    );

    expect(actualEdges).toHaveLength(expectedEdges.length);
    expect([...actualEdges].sort()).toEqual([...expectedEdges].sort());
  });

  it("calculates finite corridor geometry in normalized coordinates", () => {
    const layout = createU4DungeonMapLayout(MAP);

    for (const corridor of layout.corridors) {
      expect(corridor.length).toBeGreaterThan(0);
      expect(Number.isFinite(corridor.length)).toBe(true);
      expect(Number.isFinite(corridor.angleDeg)).toBe(true);
      expect(corridor.start.x).toBeGreaterThanOrEqual(0);
      expect(corridor.start.x).toBeLessThanOrEqual(1);
      expect(corridor.end.y).toBeGreaterThanOrEqual(0);
      expect(corridor.end.y).toBeLessThanOrEqual(1);
    }
  });
});
