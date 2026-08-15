import { describe, expect, it } from "vitest";
import { createFixtureExpeditionState } from "@/lib/rules/fixtures";
import {
  type ExpeditionState,
} from "@/lib/domain";

describe("탐험 도메인 계약", () => {
  it("지도·현재 위치·방문 기록·대기 결과를 분리한다", () => {
    const state: ExpeditionState = createFixtureExpeditionState();

    expect(state.dungeonId).toBe("dungeon-001");
    expect(state.partyId).toBe("party-001");
    expect(state.map.nodes).toHaveLength(2);
    expect(state.currentNodeId).toBe(state.map.entryNodeId);
    expect(state.visitedNodeIds).toEqual([]);
    expect(state.pendingInfo).toBeNull();
    expect(state.pendingEvent).toBeNull();
    expect(state.bossResult).toBeNull();
    expect(state.result).toBeNull();
    expect(state.log).toEqual([]);
  });

  it("각 지도 노드는 위험 요약과 정보 기회를 표현한다", () => {
    const state = createFixtureExpeditionState();
    const entry = state.map.nodes.find(
      (node) => node.id === state.map.entryNodeId,
    );

    expect(entry).toMatchObject({
      depth: 0,
      eventId: "event-entry",
      riskSummary: "낮은 위험",
      hasInfoOpportunity: true,
      bossRelatedInfoCount: 1,
    });
    expect(state.map.paths).toEqual([
      {
        nodeIds: ["node-entry", "node-boss"],
        regularEventCount: 1,
        infoCount: 1,
        bossRelatedInfoCount: 1,
      },
    ]);
  });

  it("탐험 fixture도 호출마다 지도 배열을 새로 만든다", () => {
    const first = createFixtureExpeditionState();
    const second = createFixtureExpeditionState();

    first.map.nodes[0].nextNodeIds.pop();

    expect(second.map.nodes[0].nextNodeIds).toEqual(["node-boss"]);
  });
});
