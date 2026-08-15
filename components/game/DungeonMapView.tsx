import { Panel } from "@/components/ui/Panel";
import type { NodeId } from "@/lib/domain";
import type { MapNodeView, MapView } from "./expedition-view-model";

interface DungeonMapViewProps {
  view: MapView;
  selectedNodeId: NodeId | null;
  onSelectNode: (id: NodeId) => void;
  onEnterNode: () => void;
}

const NODE_STROKE: Record<MapNodeView["state"], string> = {
  current: "var(--color-parchment)",
  visited: "var(--color-trust-up)",
  selectable: "var(--color-trust-up)",
  inactive: "var(--color-edge)",
};

function stateMark(node: MapNodeView): string {
  if (node.state === "current") return "◎";
  if (node.state === "visited") return "✓";
  if (node.state === "selectable") return "→";
  return "×";
}

export function DungeonMapView({
  view,
  selectedNodeId,
  onSelectNode,
  onEnterNode,
}: DungeonMapViewProps) {
  const positionById = new Map(view.nodes.map((node) => [node.id, node]));

  return (
    <div className="grid gap-3 md:grid-cols-[200px_1fr]">
      <Panel title="범례">
        <ul className="flex flex-col gap-1 text-xs text-muted">
          <li>◎ 현재 위치</li>
          <li>✓ 방문 완료</li>
          <li>→ 선택 가능</li>
          <li>× 비활성</li>
          <li className="mt-2">! 몬스터 / 특수</li>
          <li>? 정보 전달 기회</li>
          <li>$ 상인 · + 휴식</li>
          <li className="mt-2">전체 연결·대략 위험·보스 위치 공개</li>
          <li>색 + 기호 + 선으로 구분</li>
        </ul>
      </Panel>
      <Panel title="다음 지점을 선택하세요 · 연결된 미방문 지점만 가능">
        <svg
          viewBox={`0 0 ${view.viewWidth} ${view.viewHeight + 60}`}
          className="w-full"
          role="group"
          aria-label="던전 분기 지도"
        >
          {view.edges.map((edge) => {
            const from = positionById.get(edge.fromId);
            const to = positionById.get(edge.toId);
            if (from === undefined || to === undefined) return null;
            return (
              <line
                key={`${edge.fromId}-${edge.toId}`}
                x1={from.x}
                y1={from.y + 30}
                x2={to.x}
                y2={to.y + 30}
                stroke="var(--color-edge)"
                strokeWidth={3}
              />
            );
          })}
          {view.nodes.map((node) => {
            const selected = node.id === selectedNodeId;
            const clickable = node.state === "selectable";
            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y + 30})`}
                onClick={clickable ? () => onSelectNode(node.id) : undefined}
                role={clickable ? "button" : undefined}
                aria-disabled={node.state === "inactive"}
                aria-pressed={selected}
                style={{ cursor: clickable ? "pointer" : "default" }}
              >
                <circle
                  r={26}
                  fill={selected ? "var(--color-edge)" : "var(--color-panel)"}
                  stroke={NODE_STROKE[node.state]}
                  strokeWidth={selected ? 4 : 2}
                  strokeDasharray={node.state === "inactive" ? "4 3" : undefined}
                />
                <text textAnchor="middle" y={-2} fontSize={11} fill="var(--color-parchment)">
                  {node.categoryLabel}
                </text>
                <text textAnchor="middle" y={14} fontSize={10} fill="var(--color-muted)">
                  {node.hasInfo ? "? " : ""}{stateMark(node)}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="mt-2 text-xs text-muted">{view.caption}</p>
        <button
          type="button"
          disabled={selectedNodeId === null}
          onClick={onEnterNode}
          className="mt-3 w-full rounded border border-edge px-3 py-2 text-sm text-parchment enabled:hover:bg-edge disabled:opacity-40"
        >
          선택 지점 입장 · 정보 기회 →
        </button>
      </Panel>
    </div>
  );
}
