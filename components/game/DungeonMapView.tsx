import { Panel } from "@/components/ui/Panel";
import type { NodeId } from "@/lib/domain";
import type { MapNodeView, MapView } from "./expedition-view-model";

interface DungeonMapViewProps {
  view: MapView;
  selectedNodeId: NodeId | null;
  onSelectNode: (id: NodeId) => void;
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

/** 반지름 r의 5각 별 좌표. 원과 같은 자리에 놓이도록 중심이 (0,0)이다. */
function starPoints(r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(
      `${(radius * Math.cos(angle)).toFixed(2)},${(radius * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return points.join(" ");
}

export function DungeonMapView({
  view,
  selectedNodeId,
  onSelectNode,
}: DungeonMapViewProps) {
  const positionById = new Map(view.nodes.map((node) => [node.id, node]));

  return (
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
              onKeyDown={
                clickable
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectNode(node.id);
                      }
                    }
                  : undefined
              }
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              aria-disabled={node.state === "inactive"}
              aria-pressed={selected}
              style={{ cursor: clickable ? "pointer" : "default" }}
            >
              {node.isBoss ? (
                <polygon
                  points={starPoints(30)}
                  fill={selected ? "var(--color-edge)" : "var(--color-panel)"}
                  stroke={NODE_STROKE[node.state]}
                  strokeWidth={selected ? 4 : 2}
                  strokeDasharray={node.state === "inactive" ? "4 3" : undefined}
                />
              ) : (
                <circle
                  r={26}
                  fill={selected ? "var(--color-edge)" : "var(--color-panel)"}
                  stroke={NODE_STROKE[node.state]}
                  strokeWidth={selected ? 4 : 2}
                  strokeDasharray={node.state === "inactive" ? "4 3" : undefined}
                />
              )}
              <text textAnchor="middle" y={-2} fontSize={11} fill="var(--color-parchment)">
                {node.categoryMark} {node.categoryLabel}
              </text>
              <text textAnchor="middle" y={14} fontSize={10} fill="var(--color-muted)">
                {node.hasInfo ? "? " : ""}{stateMark(node)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-xs text-muted">{view.caption}</p>
    </Panel>
  );
}
