import type { DungeonNode, DungeonState, EventId, NodeId } from "@/lib/domain";

function node(id: string, depth: number, eventId: string, nextNodeIds: string[]): DungeonNode {
  return { id: id as NodeId, depth, eventId: eventId as EventId, nextNodeIds: nextNodeIds.map((next) => next as NodeId) };
}

/** 입구에서 위로 갈라지고 합쳐진 뒤 모든 경로가 보스방으로 모인다. */
export const MOCK_DUNGEON: DungeonState = {
  entryNodeId: "n-entry" as NodeId,
  bossNodeId: "n-boss" as NodeId,
  nodes: [
    node("n-entry", 0, "e-entry", ["n-a1", "n-a2", "n-a3"]),
    node("n-a1", 1, "e-a1", ["n-b1"]),
    node("n-a2", 1, "e-a2", ["n-b1", "n-b2"]),
    node("n-a3", 1, "e-a3", ["n-b2"]),
    node("n-b1", 2, "e-b1", ["n-boss"]),
    node("n-b2", 2, "e-b2", ["n-boss"]),
    node("n-boss", 3, "e-boss", []),
  ],
};
