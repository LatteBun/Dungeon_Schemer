import Link from "next/link";
import type { DungeonEvent, DungeonState, EventId, NodeId } from "@/lib/domain";
import { EVENT_KIND_LABELS, EVENT_KIND_MARKS } from "./labels";

interface DungeonMapProps { dungeon: DungeonState; events: DungeonEvent[]; currentNodeId: NodeId; visitedNodeIds: NodeId[] }

export function DungeonMap({ dungeon, events, currentNodeId, visitedNodeIds }: DungeonMapProps) {
  const eventById = new Map<EventId, DungeonEvent>(events.map((event) => [event.id, event]));
  const visited = new Set<string>(visitedNodeIds);
  const depths = [...new Set(dungeon.nodes.map((node) => node.depth))].sort((a, b) => b - a);
  return <ol className="flex flex-col gap-3">{depths.map((depth) => <li key={depth}>
    <div className="flex items-stretch justify-center gap-2">{dungeon.nodes.filter((node) => node.depth === depth).map((node) => {
      const event = eventById.get(node.eventId);
      const isCurrent = node.id === currentNodeId;
      const isBoss = node.id === dungeon.bossNodeId;
      const isVisited = visited.has(node.id);
      return <Link key={node.id} href={`/play/node/${node.id}`} aria-current={isCurrent ? "step" : undefined} className={`flex-1 rounded border px-2 py-2 text-center hover:bg-edge ${isCurrent ? "border-parchment bg-edge" : "border-edge bg-panel"} ${isVisited && !isCurrent ? "opacity-60" : ""}`}>
        <span className="block text-sm text-parchment"><span aria-hidden="true">{event === undefined ? "?" : EVENT_KIND_MARKS[event.kind]}</span>{" "}{isBoss ? "보스방" : (event?.title ?? node.id)}</span>
        <span className="block text-xs text-muted">{event === undefined ? "이벤트 없음" : EVENT_KIND_LABELS[event.kind]}{isCurrent ? " · 현재 위치" : ""}{isVisited && !isCurrent ? " · 지나옴" : ""}</span>
      </Link>;
    })}</div>
    <p className="mt-1 text-center text-xs text-muted">깊이 {depth}</p>
  </li>)}</ol>;
}
