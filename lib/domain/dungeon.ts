import type { EventId, NodeId } from "./ids";

/**
 * 이벤트 분류는 닫힌 목록이다. 분류마다 제시하는 행동과 처리가 다르다.
 * 개별 이벤트는 이 분류 안에서 콘텐츠 데이터로 추가한다.
 * docs/systems/DUNGEON_EVENTS_AND_BOSSES.md
 */
export type EventKind = "monster" | "rest" | "merchant" | "special";

export const EVENT_KINDS = [
  "monster",
  "rest",
  "merchant",
  "special",
] as const satisfies readonly EventKind[];

export interface DungeonEvent {
  id: EventId;
  kind: EventKind;
  title: string;
  description: string;
}

/** 던전은 되돌아가지 않는 분기 그래프다. */
export interface DungeonNode {
  id: NodeId;
  /** 입구에서의 거리. 경로 지도가 세로 위치를 잡는 데 쓴다. */
  depth: number;
  eventId: EventId;
  /** 빈 배열이면 보스전 직전이다. */
  nextNodeIds: NodeId[];
}

export interface DungeonState {
  nodes: DungeonNode[];
  entryNodeId: NodeId;
  bossNodeId: NodeId;
}
