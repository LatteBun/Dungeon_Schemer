"use client";

import {
  useRef,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import type { NodeId } from "@/lib/domain";
import { GameShell } from "./GameShell";
import { PartyMemberCard } from "./PartyMemberCard";
import type { TopStatusView } from "./TopStatusBar";
import type { U4MapLayout } from "./u4-dungeon-map-layout";
import type {
  U4MapNodeView,
  U4PartyMemberView,
  U4RoomKind,
} from "./u4-dungeon-map-model";

export interface U4DungeonMapScreenProps {
  status: TopStatusView;
  dungeonName: string;
  riskLevel: number;
  nodes: readonly U4MapNodeView[];
  layout: U4MapLayout;
  party: readonly U4PartyMemberView[];
  selectedNextNodeId: NodeId | null;
  onSelectNextNode: (nodeId: NodeId) => void;
  onMove: (nodeId: NodeId) => void;
}

type Direction = "left" | "right";

const ROOM_LABEL: Readonly<Record<U4RoomKind, string>> = {
  entry: "입구",
  monster: "전투",
  rest: "휴식",
  merchant: "상인",
  special: "특수 사건",
  boss: "보스",
};

const ROOM_BASE: Readonly<Record<U4RoomKind, string>> = {
  entry: "/assets/u4/rooms/room_entry_base.png",
  monster: "/assets/u4/rooms/room_battle_base.png",
  rest: "/assets/u4/rooms/room_rest_base.png",
  merchant: "/assets/u4/rooms/room_merchant_base.png",
  special: "/assets/u4/rooms/room_special_base.png",
  boss: "/assets/u4/rooms/room_boss_base.png",
};

const ROOM_ICON: Readonly<Record<U4RoomKind, string>> = {
  entry: "/assets/u4/icons/icon_entry.png",
  monster: "/assets/u4/icons/icon_battle.png",
  rest: "/assets/u4/icons/icon_rest.png",
  merchant: "/assets/u4/icons/icon_merchant.png",
  special: "/assets/u4/icons/icon_special.png",
  boss: "/assets/u4/icons/icon_boss.png",
};

const STATE_OVERLAY = {
  current: "/assets/u4/states/overlay_current_glow.png",
  visited: "/assets/u4/states/overlay_completed_glow.png",
  selectable: "/assets/u4/states/overlay_selectable_glow.png",
  inactive: "/assets/u4/states/overlay_unvisited_glow.png",
} as const;

export function nextSelectableNodeId(
  nodes: readonly U4MapNodeView[],
  layout: U4MapLayout,
  currentNodeId: NodeId,
  direction: Direction,
): NodeId | null {
  const selectable = nodes
    .filter((node) => node.state === "selectable")
    .map((node) => ({
      id: node.id,
      x: layout.nodePositions[node.id]?.x,
    }))
    .filter((item): item is { id: NodeId; x: number } => item.x !== undefined)
    .sort((left, right) => left.x - right.x);

  if (selectable.length === 0) return null;

  const currentIndex = selectable.findIndex((item) => item.id === currentNodeId);
  if (currentIndex < 0) return selectable[0]!.id;

  const delta = direction === "right" ? 1 : -1;
  const nextIndex =
    (currentIndex + delta + selectable.length) % selectable.length;
  return selectable[nextIndex]!.id;
}

function RiskStars({ riskLevel }: { riskLevel: number }) {
  return (
    <span className="u4-risk-stars" aria-label={`위험도 ${riskLevel}`}>
      {Array.from({ length: 5 }, (_, index) => {
        const active = index < riskLevel;
        return (
          <img
            key={index}
            src={
              active
                ? "/assets/u3/risk-star-filled.svg"
                : "/assets/u3/extracted/risk-star.png"
            }
            alt=""
            aria-hidden="true"
            width={16}
            height={16}
          />
        );
      })}
    </span>
  );
}

function roomPositionStyle(x: number, y: number): CSSProperties {
  return {
    left: `${x * 100}%`,
    top: `${y * 100}%`,
  };
}

function RoomVisual({ node }: { node: U4MapNodeView }) {
  return (
    <>
      <img
        className="u4-room__base"
        src={ROOM_BASE[node.kind]}
        alt=""
        aria-hidden="true"
      />
      <img
        className="u4-room__state"
        src={STATE_OVERLAY[node.state]}
        alt=""
        aria-hidden="true"
      />
      <img
        className="u4-room__icon"
        src={ROOM_ICON[node.kind]}
        alt=""
        aria-hidden="true"
      />
      {node.state === "current" ? (
        <img
          className="u4-room__current-marker"
          src="/assets/u4/states/overlay_current_marker.png"
          alt=""
          aria-hidden="true"
        />
      ) : null}
    </>
  );
}

function corridorClass(
  corridor: U4MapLayout["corridors"][number],
  byId: ReadonlyMap<NodeId, U4MapNodeView>,
): string {
  const from = byId.get(corridor.from);
  const to = byId.get(corridor.to);
  if (from?.state === "current" && to?.state === "selectable") {
    return "u4-corridor is-selectable";
  }
  if (
    (from?.state === "visited" || from?.state === "current") &&
    (to?.state === "visited" || to?.state === "current")
  ) {
    return "u4-corridor is-visited";
  }
  return "u4-corridor";
}

function DungeonMap({
  dungeonName,
  riskLevel,
  nodes,
  layout,
  selectedNextNodeId,
  onSelectNextNode,
}: Omit<
  U4DungeonMapScreenProps,
  "status" | "party" | "onMove"
>) {
  const roomRefs = useRef(new Map<NodeId, HTMLButtonElement>());
  const byId = new Map(nodes.map((node) => [node.id, node] as const));

  const handleArrow = (
    event: KeyboardEvent<HTMLButtonElement>,
    nodeId: NodeId,
  ) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const nextId = nextSelectableNodeId(
      nodes,
      layout,
      nodeId,
      event.key === "ArrowRight" ? "right" : "left",
    );
    if (nextId === null) return;
    onSelectNextNode(nextId);
    roomRefs.current.get(nextId)?.focus();
  };

  return (
    <div className="u4-map-panel">
      <header className="u4-map-panel__header">
        <div>
          <span>공개 분기 지도</span>
          <strong>{dungeonName}</strong>
        </div>
        <RiskStars riskLevel={riskLevel} />
      </header>

      <div className="u4-map-surface" data-testid="u4-map-surface">
        <img
          className="u4-map-surface__background"
          src="/assets/u4/map/map_background_base.png"
          alt=""
          aria-hidden="true"
        />
        <img
          className="u4-map-surface__atmosphere"
          src="/assets/u4/map/map_atmosphere_ruins_props.png"
          alt=""
          aria-hidden="true"
        />
        <img
          className="u4-map-surface__vignette"
          src="/assets/u4/map/map_background_vignette.png"
          alt=""
          aria-hidden="true"
        />

        <div className="u4-map-surface__corridors" aria-hidden="true">
          {layout.corridors.map((corridor) => (
            <span
              key={`${corridor.from}-${corridor.to}`}
              className={corridorClass(corridor, byId)}
              style={{
                left: `${corridor.start.x * 100}%`,
                top: `${corridor.start.y * 100}%`,
                width: `${corridor.length * 100}%`,
                transform: `rotate(${corridor.angleDeg}deg)`,
              }}
            >
              <img
                src="/assets/u4/corridors/corridor_horizontal.png"
                alt=""
                aria-hidden="true"
              />
            </span>
          ))}
        </div>

        <div className="u4-map-surface__rooms">
          {nodes.map((node) => {
            const point = layout.nodePositions[node.id];
            if (point === undefined) return null;
            const className = `u4-room u4-room--${node.kind} is-${node.state}`;

            if (node.state === "selectable") {
              return (
                <button
                  key={node.id}
                  ref={(element) => {
                    if (element === null) roomRefs.current.delete(node.id);
                    else roomRefs.current.set(node.id, element);
                  }}
                  type="button"
                  className={className}
                  style={roomPositionStyle(point.x, point.y)}
                  data-testid="u4-selectable-room"
                  data-node-id={node.id}
                  aria-label={`${ROOM_LABEL[node.kind]} 지점 선택`}
                  aria-pressed={selectedNextNodeId === node.id}
                  onClick={() => onSelectNextNode(node.id)}
                  onKeyDown={(event) => handleArrow(event, node.id)}
                >
                  <RoomVisual node={node} />
                </button>
              );
            }

            return (
              <div
                key={node.id}
                className={className}
                style={roomPositionStyle(point.x, point.y)}
                data-node-id={node.id}
                aria-label={`${ROOM_LABEL[node.kind]} · ${
                  node.state === "current"
                    ? "현재 위치"
                    : node.state === "visited"
                      ? "방문 완료"
                      : "미방문"
                }`}
              >
                <RoomVisual node={node} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function U4PartyMember({ member, index }: { member: U4PartyMemberView; index: number }) {
  /* 표시는 공용 카드가 맡는다. 여기서는 U4 의 뷰를 카드 뷰로 옮기기만 한다. */
  return (
    <PartyMemberCard
      member={{
        id: String(member.id),
        name: member.name,
        classLabel: member.classLabel,
        personalityLabel: member.personalityLabel,
        hp: member.hp,
        maxHp: member.maxHp,
        trust: member.trust,
        gold: member.gold,
        portraitSrc: member.portraitSrc,
        alive: member.alive,
      }}
      index={index}
      testId="u4-party-member"
    />
  );
}

function MoveButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="u4-move-button"
      data-testid="u4-move-button"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="u4-move-button__skin" aria-hidden="true">
        <img
          className="u4-move-button__left"
          src="/assets/u4/navigation/cta_button_left.png"
          alt=""
        />
        <img
          className="u4-move-button__center"
          src="/assets/u4/navigation/cta_button_center.png"
          alt=""
        />
        <img
          className="u4-move-button__right"
          src="/assets/u4/navigation/cta_button_right.png"
          alt=""
        />
      </span>
      <strong>이 지점으로 이동</strong>
      <img
        className="u4-move-button__arrow"
        src="/assets/u4/navigation/cta_button_arrow.png"
        alt=""
        aria-hidden="true"
      />
    </button>
  );
}

function RightPanel({
  nodes,
  party,
  selectedNextNodeId,
  onMove,
}: Pick<
  U4DungeonMapScreenProps,
  "nodes" | "party" | "selectedNextNodeId" | "onMove"
>) {
  const destination =
    selectedNextNodeId === null
      ? undefined
      : nodes.find(
          (node) =>
            node.id === selectedNextNodeId && node.state === "selectable",
        );

  return (
    <div className="u4-right-panel">
      <section className="panel-section u4-party" aria-labelledby="u4-party-title">
        <h3 id="u4-party-title">파티 상태</h3>
        <ul className="party-list">
          {party.map((member, index) => (
            <li key={member.id}>
              <U4PartyMember member={member} index={index} />
            </li>
          ))}
        </ul>
      </section>

      <section
        className="panel-section u4-destination"
        aria-labelledby="u4-destination-title"
      >
        <h3 id="u4-destination-title">선택한 다음 지점</h3>
        <div className="u4-destination__panel">
          {destination === undefined ? (
            <p className="u4-destination__empty">다음 지점을 선택하세요</p>
          ) : (
            <div className="u4-destination__summary">
              <div className="u4-destination__thumbnail" aria-hidden="true">
                <img
                  className="u4-destination__room"
                  src={ROOM_BASE[destination.kind]}
                  alt=""
                />
                <img
                  className="u4-destination__icon"
                  src={ROOM_ICON[destination.kind]}
                  alt=""
                />
                <img
                  className="u4-destination__frame"
                  src="/assets/u4/navigation/destination_thumbnail_frame.png"
                  alt=""
                />
              </div>
              <div>
                <span>공개 사건 분류</span>
                <strong>{ROOM_LABEL[destination.kind]}</strong>
                <small>현재 위치에서 이동 가능한 지점</small>
              </div>
            </div>
          )}
          <img
            className="u4-destination__panel-frame"
            src="/assets/u4/navigation/destination_panel_frame.png"
            alt=""
            aria-hidden="true"
          />
        </div>
        <MoveButton
          disabled={destination === undefined}
          onClick={() => {
            if (destination !== undefined) onMove(destination.id);
          }}
        />
      </section>
    </div>
  );
}

export function U4DungeonMapScreen({
  status,
  dungeonName,
  riskLevel,
  nodes,
  layout,
  party,
  selectedNextNodeId,
  onSelectNextNode,
  onMove,
}: U4DungeonMapScreenProps) {
  return (
    <div className="u4-dungeon-map-screen">
      <GameShell
        status={status}
        screenTitle="던전 지도"
        main={
          <DungeonMap
            dungeonName={dungeonName}
            riskLevel={riskLevel}
            nodes={nodes}
            layout={layout}
            selectedNextNodeId={selectedNextNodeId}
            onSelectNextNode={onSelectNextNode}
          />
        }
        rightPanel={
          <RightPanel
            nodes={nodes}
            party={party}
            selectedNextNodeId={selectedNextNodeId}
            onMove={onMove}
          />
        }
        rightPanelLabel="파티 상태와 다음 지점"
      />
    </div>
  );
}
