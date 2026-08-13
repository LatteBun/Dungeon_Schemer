import type { DungeonEvent, DungeonState, EventId, NodeId } from "@/lib/domain";
import { EVENT_KIND_LABELS, EVENT_KIND_MARKS } from "./labels";

interface DungeonMapProps {
  dungeon: DungeonState;
  events: readonly DungeonEvent[];
  currentNodeId: NodeId;
  visitedNodeIds: NodeId[];
  /** 지금 고를 수 있는 노드. 현재 노드의 nextNodeIds다. */
  selectableNodeIds: readonly NodeId[];
  onSelect: (nodeId: NodeId) => void;
}

/**
 * 아래(입구)에서 위(보스방)로 진행하는 분기 지도다. 선택은 onSelect로
 * 상태 머신에 전달되고, 갈 수 없는 노드는 비활성 버튼이다. 상태 구분은
 * 색상 외에 문구(현재 위치·지나옴·선택 가능)와 비활성 처리를 함께 쓴다.
 */
export function DungeonMap({
  dungeon,
  events,
  currentNodeId,
  visitedNodeIds,
  selectableNodeIds,
  onSelect,
}: DungeonMapProps) {
  const eventById = new Map<EventId, DungeonEvent>(
    events.map((event) => [event.id, event]),
  );
  const visited = new Set<string>(visitedNodeIds);
  const selectable = new Set<string>(selectableNodeIds);
  const depths = [...new Set(dungeon.nodes.map((node) => node.depth))].sort(
    (a, b) => b - a,
  );

  return (
    <ol className="flex flex-col gap-3">
      {depths.map((depth) => (
        <li key={depth}>
          <div className="flex items-stretch justify-center gap-2">
            {dungeon.nodes
              .filter((node) => node.depth === depth)
              .map((node) => {
                const event = eventById.get(node.eventId);
                const isCurrent = node.id === currentNodeId;
                const isBoss = node.id === dungeon.bossNodeId;
                const isVisited = visited.has(node.id);
                const isSelectable = selectable.has(node.id);
                const stateLabel = isCurrent
                  ? " · 현재 위치"
                  : isSelectable
                    ? " · 선택 가능"
                    : isVisited
                      ? " · 지나옴"
                      : "";
                return (
                  <button
                    key={node.id}
                    type="button"
                    disabled={!isSelectable}
                    onClick={() => onSelect(node.id)}
                    aria-current={isCurrent ? "step" : undefined}
                    className={`flex-1 rounded border px-2 py-2 text-center ${
                      isCurrent
                        ? "border-parchment bg-edge"
                        : isSelectable
                          ? "border-parchment bg-panel hover:bg-edge"
                          : "border-edge bg-panel"
                    } ${isVisited && !isCurrent ? "opacity-60" : ""} ${
                      !isSelectable ? "cursor-not-allowed" : ""
                    }`}
                  >
                    <span className="block text-sm text-parchment">
                      <span aria-hidden="true">
                        {event === undefined ? "?" : EVENT_KIND_MARKS[event.kind]}
                      </span>{" "}
                      {isBoss ? "보스방" : (event?.title ?? node.id)}
                    </span>
                    <span className="block text-xs text-muted">
                      {event === undefined
                        ? "이벤트 없음"
                        : EVENT_KIND_LABELS[event.kind]}
                      {stateLabel}
                    </span>
                  </button>
                );
              })}
          </div>
          <p className="mt-1 text-center text-xs text-muted">깊이 {depth}</p>
        </li>
      ))}
    </ol>
  );
}
