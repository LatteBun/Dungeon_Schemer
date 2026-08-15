import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import { generateGradeMap } from "@/lib/rules/map";
import { layoutMap } from "./map-layout";

function mapFor(grade: "C" | "B" | "A" | "S") {
  return generateGradeMap(grade, createRng(`u2-layout-${grade}`).derive("map"));
}

describe("layoutMap", () => {
  it("등급별 전체 노드 수를 그대로 배치한다", () => {
    expect(layoutMap(mapFor("C")).nodes).toHaveLength(7);
    expect(layoutMap(mapFor("B")).nodes).toHaveLength(9);
    expect(layoutMap(mapFor("A")).nodes).toHaveLength(11);
    expect(layoutMap(mapFor("S")).nodes).toHaveLength(13);
  });

  it("입구는 맨 아래(y 최대), 보스는 맨 위(y 최소)에 둔다", () => {
    const map = mapFor("C");
    const layout = layoutMap(map);
    const byId = new Map(layout.nodes.map((node) => [node.id, node]));
    const entry = byId.get(map.entryNodeId);
    const boss = byId.get(map.bossNodeId);
    const maxY = Math.max(...layout.nodes.map((node) => node.y));
    const minY = Math.min(...layout.nodes.map((node) => node.y));
    expect(entry?.y).toBe(maxY);
    expect(boss?.y).toBe(minY);
  });

  it("입구·보스는 중앙, 갈래 노드는 좌우로 갈린다", () => {
    const map = mapFor("C");
    const layout = layoutMap(map);
    const byId = new Map(layout.nodes.map((node) => [node.id, node]));
    expect(byId.get(map.entryNodeId)?.x).toBe(200);
    expect(byId.get(map.bossNodeId)?.x).toBe(200);
    const left = layout.nodes.filter((node) => node.x < 200);
    const right = layout.nodes.filter((node) => node.x > 200);
    expect(left.length).toBeGreaterThan(0);
    expect(right.length).toBe(left.length);
  });

  it("간선은 모든 nextNodeIds와 정확히 일치한다", () => {
    const map = mapFor("C");
    const layout = layoutMap(map);
    const expected = map.nodes.flatMap((node) =>
      node.nextNodeIds.map((toId) => `${node.id}->${toId}`),
    ).sort();
    const actual = layout.edges.map((edge) => `${edge.fromId}->${edge.toId}`).sort();
    expect(actual).toEqual(expected);
  });
});
