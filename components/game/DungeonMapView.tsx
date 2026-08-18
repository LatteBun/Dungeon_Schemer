import { Panel } from "@/components/ui/Panel";
import type { NodeId } from "@/lib/domain";
import { MapNodeIcon } from "./MapNodeIcon";
import type { MapNodeView, MapView } from "./expedition-view-model";

interface DungeonMapViewProps {
  view: MapView;
  selectedNodeId: NodeId | null;
  onSelectNode: (id: NodeId) => void;
}

/** 지점 도형과 흔들림이 잘리지 않도록 위아래에 두는 여백. */
const NODE_MARGIN = 44;

const NODE_STROKE: Record<MapNodeView["state"], string> = {
  current: "var(--color-parchment)",
  visited: "var(--color-trust-up)",
  selectable: "var(--color-trust-up)",
  inactive: "var(--color-edge)",
};

/**
 * 지점 상태를 글자로도 남긴다.
 *
 * 아이콘이 무엇인지는 그림이 말하지만 갈 수 있는지 여부는 색만으로 구분하면
 * 안 된다. 화면 낭독기가 읽을 이름도 여기서 만든다.
 */
/** 지점 하나를 설명하는 한 문장. 툴팁과 낭독기 이름이 같은 문자열을 쓴다. */
function nodeDescription(node: MapNodeView): string {
  return `${node.categoryLabel} · ${node.riskSummary} · ${stateLabel(node)}`
    + (node.hasInfo ? " · 정보 전달 기회" : "");
}

function stateLabel(node: MapNodeView): string {
  if (node.state === "current") return "현재 위치";
  if (node.state === "visited") return "지나옴";
  if (node.state === "selectable") return "선택 가능";
  return "갈 수 없음";
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
      {/* 보스 별 도형의 반지름이 30이고 흔들림이 y로 18까지 가므로 위아래 여백을
          그만큼 준다. 모자라면 맨 위 보스와 맨 아래 입구가 잘린다. */}
      <svg
        viewBox={`0 0 ${view.viewWidth} ${view.viewHeight + NODE_MARGIN * 2}`}
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
              y1={from.y + NODE_MARGIN}
              x2={to.x}
              y2={to.y + NODE_MARGIN}
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
              transform={`translate(${node.x}, ${node.y + NODE_MARGIN})`}
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
              aria-label={nodeDescription(node)}
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
              <MapNodeIcon
                kind={node.icon}
                grade={node.grade}
                size={node.isBoss ? 22 : 18}
                color={NODE_STROKE[node.state]}
              />
              {node.hasInfo ? (
                <g transform="translate(20, -20)">
                  <circle r={8} fill="var(--color-panel)" stroke="var(--color-trust-up)" strokeWidth={1.5} />
                  <text
                    textAnchor="middle"
                    y={3.5}
                    fontSize={10}
                    fill="var(--color-trust-up)"
                  >
                    !
                  </text>
                </g>
              ) : null}
              {/* 자식을 여럿 두면 빈 문자열 조각 때문에 하이드레이션이 어긋난다. */}
              <title>{nodeDescription(node)}</title>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-xs text-muted">{view.caption}</p>
    </Panel>
  );
}
