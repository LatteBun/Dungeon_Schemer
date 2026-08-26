import { describe, expect, it } from "vitest";
import { createU4PreviewData } from "./u4-preview-data";
import { countU4LayerCrossings } from "./u4-dungeon-map-order";
import { countU4GeometricCrossings } from "./u4-dungeon-map-layout";

const TARGET_WIDTHS = [2, 3, 5, 4, 3, 2, 2] as const;

describe("U4 preview data", () => {
  it("renders the actual risk-3 preview with zero logical crossings", () => {
    const preview = createU4PreviewData({ deadPreview: false });
    const originalRows = [
      [preview.map.entryNodeId],
      ...preview.map.layers.map((layer) => layer.nodeIds),
      [preview.map.bossNodeId],
    ];
    const renderedRows = [
      [preview.map.entryNodeId],
      ...preview.map.layers.map((layer) =>
        [...layer.nodeIds].sort(
          (left, right) =>
            preview.layout.nodePositions[left]!.x -
            preview.layout.nodePositions[right]!.x,
        ),
      ),
      [preview.map.bossNodeId],
    ];

    expect(countU4LayerCrossings(preview.map, renderedRows)).toBe(0);
    expect(countU4LayerCrossings(preview.map, originalRows)).toBeGreaterThanOrEqual(0);
    expect(countU4GeometricCrossings(preview.layout.corridors)).toBe(0);
  });

  it("uses an actual risk-3 E1 map with the non-consecutive-five example template", () => {
    const preview = createU4PreviewData({ deadPreview: false });
    expect(preview.riskLevel).toBe(3);
    expect(preview.map.layers.map((layer) => layer.nodeIds.length)).toEqual(TARGET_WIDTHS);
    expect(preview.map.layers.some((layer) => layer.nodeIds.length === 5)).toBe(true);
    for (let index = 1; index < preview.map.layers.length; index += 1) {
      expect(
        preview.map.layers[index - 1]!.nodeIds.length === 5 &&
          preview.map.layers[index]!.nodeIds.length === 5,
      ).toBe(false);
    }
  });

  it("uses the actual board party and maps every normal node to a public kind fixture", () => {
    const preview = createU4PreviewData({ deadPreview: false });
    expect(preview.party).toHaveLength(3);
    expect(new Set(preview.party.map((member) => member.classId)).size).toBe(3);

    const normalNodes = preview.map.nodes.filter((node) => node.kind === "normal");
    expect(normalNodes.every((node) => preview.publicKindByNodeId[node.id] !== undefined)).toBe(true);
  });

  it("starts on the centered entry and exposes only the first depth as selectable", () => {
    const preview = createU4PreviewData({ deadPreview: false });
    expect(preview.currentNodeId).toBe(preview.map.entryNodeId);
    expect(preview.visitedNodeIds).toEqual([]);

    const selectable = preview.nodes.filter((node) => node.state === "selectable");
    expect(selectable.map((node) => node.id).sort()).toEqual(
      [...preview.map.nodes.find((node) => node.id === preview.map.entryNodeId)!.nextNodeIds].sort(),
    );
  });

  it("dead preview keeps the official live portrait for the deceased member", () => {
    const live = createU4PreviewData({ deadPreview: false });
    const dead = createU4PreviewData({ deadPreview: true });

    expect(live.party.every((member) => member.alive)).toBe(true);
    expect(dead.party.filter((member) => !member.alive)).toHaveLength(1);
    expect(dead.party.filter((member) => !member.alive)[0]?.portraitSrc).toContain(
      "/assets/characters/live/",
    );
  });

  it("builds the screen model and default destination from actual generated data", () => {
    const preview = createU4PreviewData({ deadPreview: false });
    expect(preview.nodes.some((node) => node.state === "current")).toBe(true);
    expect(preview.nodes.some((node) => node.state === "selectable")).toBe(true);
    expect(preview.selectedNextNodeId).not.toBeNull();
    expect(preview.layout.nodePositions[preview.map.entryNodeId]?.y).toBeCloseTo(0.88);
    expect(preview.layout.nodePositions[preview.map.bossNodeId]?.y).toBeCloseTo(0.12);
  });
});
