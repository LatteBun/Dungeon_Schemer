import { describe, expect, it } from "vitest";
import type { GeneratedMap, NodeId } from "@/lib/domain";
import { countU4GeometricCrossings, createU4DungeonMapLayout, createU4DungeonMapLayoutCandidatesForTest, resolveU4MapLayoutCandidatesForTest, roomVariationFor, U4MapLayoutError } from "./u4-dungeon-map-layout";
import {
  countU4LayerCrossings,
  createU4OptimizedLayerOrder,
} from "./u4-dungeon-map-order";

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

const CROSS_ENTRY = id("cross-entry");
const CROSS_A = id("cross-a");
const CROSS_B = id("cross-b");
const CROSS_C = id("cross-c");
const CROSS_D = id("cross-d");
const CROSS_BOSS = id("cross-boss");

const CROSSING_MAP: GeneratedMap = {
  entryNodeId: CROSS_ENTRY,
  bossNodeId: CROSS_BOSS,
  layers: [
    { depth: 1, nodeIds: [CROSS_A, CROSS_B] },
    { depth: 2, nodeIds: [CROSS_C, CROSS_D] },
  ],
  nodes: [
    {
      id: CROSS_ENTRY,
      kind: "entry",
      nextNodeIds: [CROSS_A, CROSS_B],
    },
    { id: CROSS_A, kind: "normal", nextNodeIds: [CROSS_D] },
    { id: CROSS_B, kind: "normal", nextNodeIds: [CROSS_C] },
    { id: CROSS_C, kind: "normal", nextNodeIds: [CROSS_BOSS] },
    { id: CROSS_D, kind: "normal", nextNodeIds: [CROSS_BOSS] },
    { id: CROSS_BOSS, kind: "boss", nextNodeIds: [] },
  ],
};

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
  const crossingLayout = (crossing: boolean): import("./u4-dungeon-map-layout").U4MapLayout => ({
    nodePositions: {},
    corridors: crossing
      ? [{ from: id("a"), to: id("b"), start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, length: 1, angleDeg: 45 }, { from: id("c"), to: id("d"), start: { x: 0, y: 1 }, end: { x: 1, y: 0 }, length: 1, angleDeg: -45 }]
      : [],
  });

  it("falls back to flat depths when wobbled geometry crosses", () => {
    const flat = crossingLayout(false);
    expect(resolveU4MapLayoutCandidatesForTest(crossingLayout(true), flat)).toBe(flat);
  });

  it("fallback flattens only normal-depth Y wobble and preserves X placement", () => {
    const { wobbled, fallback } = createU4DungeonMapLayoutCandidatesForTest(MAP);

    for (const layer of MAP.layers) {
      const wobbledYs = layer.nodeIds.map((nodeId) => wobbled.nodePositions[nodeId]!.y);
      const fallbackYs = layer.nodeIds.map((nodeId) => fallback.nodePositions[nodeId]!.y);
      expect(new Set(fallbackYs).size).toBe(1);
      expect(new Set(wobbledYs).size).toBeGreaterThan(1);
      for (const nodeId of layer.nodeIds) {
        expect(fallback.nodePositions[nodeId]!.x).toBe(wobbled.nodePositions[nodeId]!.x);
      }
    }
    expect(fallback.nodePositions[ENTRY]).toEqual(wobbled.nodePositions[ENTRY]);
    expect(fallback.nodePositions[BOSS]).toEqual(wobbled.nodePositions[BOSS]);
  });

  it("throws the geometric crossing count when both candidates cross", () => {
    expect(() => resolveU4MapLayoutCandidatesForTest(crossingLayout(true), crossingLayout(true)))
      .toThrowError(expect.objectContaining({ geometricCrossingCount: 1 } satisfies Partial<U4MapLayoutError>));
  });

  it("uses the global minimum-crossing row order for room coordinates", () => {
    const originalRows = [
      [CROSS_ENTRY],
      [CROSS_A, CROSS_B],
      [CROSS_C, CROSS_D],
      [CROSS_BOSS],
    ] as const;
    const optimized = createU4OptimizedLayerOrder(CROSSING_MAP);
    const layout = createU4DungeonMapLayout(CROSSING_MAP);
    const rowIds = [
      [CROSS_ENTRY],
      ...CROSSING_MAP.layers.map((layer) =>
        [...layer.nodeIds].sort(
          (left, right) =>
            layout.nodePositions[left]!.x -
            layout.nodePositions[right]!.x,
        ),
      ),
      [CROSS_BOSS],
    ];

    expect(countU4LayerCrossings(CROSSING_MAP, originalRows)).toBe(1);
    expect(optimized.crossingCount).toBe(0);
    expect(countU4LayerCrossings(CROSSING_MAP, rowIds)).toBe(0);
  });

  it("places entry at bottom center and boss at top center with safe margins", () => {
    const layout = createU4DungeonMapLayout(MAP);
    const entry = layout.nodePositions[ENTRY];
    const boss = layout.nodePositions[BOSS];

    expect(entry?.x).toBeCloseTo(0.5);
    expect(entry?.y).toBeCloseTo(0.88);
    expect(boss?.x).toBeCloseTo(0.5);
    expect(boss?.y).toBeCloseTo(0.12);
  });

  it("forms one strict bottom-to-top sequence from entry through every depth to boss", () => {
    const layout = createU4DungeonMapLayout(MAP);
    const rowYs = [
      layout.nodePositions[ENTRY]!.y,
      ...MAP.layers.map((layer) => layout.nodePositions[layer.nodeIds[0]!]!.y),
      layout.nodePositions[BOSS]!.y,
    ];

    for (let index = 1; index < rowYs.length; index += 1) {
      expect(rowYs[index - 1]).toBeGreaterThan(rowYs[index]!);
    }
    expect(rowYs.slice(1, -1).every((y) => y < 0.88 && y > 0.12)).toBe(true);
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

  it("has no geometric corridor crossings", () => {
    const layout = createU4DungeonMapLayout(MAP);
    expect(countU4GeometricCrossings(layout.corridors)).toBe(0);
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

  it("normalizes render geometry to four decimals for identical server and client styles", () => {
    const layout = createU4DungeonMapLayout(MAP);
    const geometry = [
      ...Object.values(layout.nodePositions).flatMap((point) =>
        point === undefined ? [] : [point.x, point.y],
      ),
      ...layout.corridors.flatMap((corridor) => [
        corridor.start.x,
        corridor.start.y,
        corridor.end.x,
        corridor.end.y,
        corridor.length,
        corridor.angleDeg,
      ]),
    ];

    expect(geometry.every((value) => value === Number(value.toFixed(4)))).toBe(
      true,
    );
  });
});

describe("지도가 자로 잰 듯 보이지 않는다", () => {
  /* 같은 던전은 늘 같은 모양이어야 한다. 흐트러뜨리되 난수를 쓰지 않는다. */
  it("같은 지도는 같은 좌표를 낸다", () => {
    expect(createU4DungeonMapLayout(MAP)).toEqual(createU4DungeonMapLayout(MAP));
    expect(roomVariationFor(D3A)).toEqual(roomVariationFor(D3A));
  });

  /* 한 층의 노드가 모두 같은 높이면 표처럼 보인다. */
  it("같은 층의 높이가 서로 다르다", () => {
    const layout = createU4DungeonMapLayout(MAP);
    const ys = [D3A, D3B, D3C, D3D, D3E].map((nodeId) => layout.nodePositions[nodeId]!.y);

    expect(new Set(ys).size).toBeGreaterThan(1);
  });

  /* 간격이 자로 잰 듯 같으면 격자다. */
  it("좌우 간격이 균등하지 않다", () => {
    const layout = createU4DungeonMapLayout(MAP);
    const xs = [D3A, D3B, D3C, D3D, D3E].map((nodeId) => layout.nodePositions[nodeId]!.x);
    const gaps = xs.slice(1).map((x, index) => Number((x - xs[index]!).toFixed(4)));

    expect(new Set(gaps).size).toBeGreaterThan(1);
  });

  /* 흐트러뜨려도 뜻은 그대로다. 순서가 뒤집히면 길이 달라 보인다. */
  it("흐트러뜨려도 좌우 순서와 층 순서는 그대로다", () => {
    const layout = createU4DungeonMapLayout(MAP);
    const xs = [D3A, D3B, D3C, D3D, D3E].map((nodeId) => layout.nodePositions[nodeId]!.x);

    expect(xs).toEqual([...xs].sort((left, right) => left - right));
    expect(xs.every((x) => x >= 0.1 && x <= 0.9)).toBe(true);
    /* 입구와 보스는 흔들지 않는다. 그 둘은 자리가 곧 뜻이다. */
    expect(layout.nodePositions[ENTRY]).toEqual({ x: 0.5, y: 0.88 });
    expect(layout.nodePositions[BOSS]).toEqual({ x: 0.5, y: 0.12 });
  });

  /* 같은 분류의 방이 도장 찍은 것처럼 보이지 않아야 한다. */
  it("방마다 기울기와 크기가 다르다", () => {
    const tilts = new Set([D3A, D3B, D3C, D3D, D3E].map((nodeId) => roomVariationFor(nodeId).tiltDeg));
    const scales = new Set([D3A, D3B, D3C, D3D, D3E].map((nodeId) => roomVariationFor(nodeId).scale));

    expect(tilts.size).toBeGreaterThan(1);
    expect(scales.size).toBeGreaterThan(1);
    /* 너무 기울면 방이 아니라 기울어진 그림으로 보인다. */
    for (const tilt of tilts) expect(Math.abs(tilt)).toBeLessThanOrEqual(7);
    for (const scale of scales) expect(scale).toBeGreaterThan(0.9);
  });
});
