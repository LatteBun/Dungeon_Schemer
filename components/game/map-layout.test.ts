import { describe, expect, it } from "vitest";
import { CAMPAIGN_GRADE_CONFIG } from "@/lib/content/dungeons";
import { GRADES } from "@/lib/domain";
import type { Grade } from "@/lib/domain";
import { createRng } from "@/lib/rng";
import { generateGradeMap } from "@/lib/rules/map";
import { layoutMap } from "./map-layout";

function mapFor(grade: Grade, seed = "u2-layout") {
  return generateGradeMap(grade, createRng(`${seed}-${grade}`).derive("map"));
}

describe("layoutMap", () => {
  it("등급별 전체 지점을 그대로 배치한다", () => {
    for (const grade of GRADES) {
      expect(layoutMap(mapFor(grade)).nodes)
        .toHaveLength(CAMPAIGN_GRADE_CONFIG[grade].eventNodeCount + 2);
    }
  });

  it("입구는 맨 아래, 보스는 맨 위에 둔다", () => {
    const map = mapFor("C");
    const layout = layoutMap(map);
    const byId = new Map(layout.nodes.map((node) => [node.id, node]));

    expect(byId.get(map.entryNodeId)?.y).toBe(Math.max(...layout.nodes.map((n) => n.y)));
    expect(byId.get(map.bossNodeId)?.y).toBe(Math.min(...layout.nodes.map((n) => n.y)));
  });

  it("입구와 보스는 흔들지 않고 중앙에 고정한다", () => {
    // 시작과 끝이 축이 되어야 지도가 읽힌다.
    for (const grade of GRADES) {
      const map = mapFor(grade);
      const byId = new Map(layoutMap(map).nodes.map((node) => [node.id, node]));

      expect(byId.get(map.entryNodeId)?.x).toBe(200);
      expect(byId.get(map.bossNodeId)?.x).toBe(200);
    }
  });

  it("사건 지점은 같은 층이어도 좌표가 어긋나 계단으로 보이지 않는다", () => {
    const map = mapFor("S", "흔들림");
    const layout = layoutMap(map);
    const byId = new Map(map.nodes.map((node) => [node.id as string, node]));
    const eventNodes = layout.nodes.filter((node) => {
      const source = byId.get(node.id as string)!;
      return source.id !== map.entryNodeId && source.id !== map.bossNodeId;
    });
    const depths = new Set(eventNodes.map((node) => byId.get(node.id as string)!.depth));
    const ys = new Set(eventNodes.map((node) => node.y));

    // 층마다 y가 하나씩이면 딱딱한 계단이다. 흔들림이 그 수를 늘린다.
    expect(ys.size).toBeGreaterThan(depths.size);
  });

  it("같은 지도는 몇 번을 그려도 같은 좌표를 낸다", () => {
    const map = mapFor("B", "재현");

    expect(layoutMap(map)).toEqual(layoutMap(map));
  });

  it("간선은 모든 nextNodeIds와 정확히 일치한다", () => {
    const map = mapFor("A");
    const expected = map.nodes
      .flatMap((node) => node.nextNodeIds.map((toId) => `${node.id}->${toId}`))
      .sort();
    const actual = layoutMap(map).edges
      .map((edge) => `${edge.fromId}->${edge.toId}`)
      .sort();

    expect(actual).toEqual(expected);
  });
});
