import type { ChoiceId, EventId, ItemId, NodeId } from "./ids";
import type { EventEffectTag } from "./content";
import type { EventTarget, InfoSubject } from "./info";

/**
 * 이벤트 분류는 닫힌 목록이다. 분류마다 제시하는 행동과 처리가 다르다.
 * 개별 이벤트는 이 분류 안에서 콘텐츠 데이터로 추가한다.
 * docs/systems/DUNGEON_EVENTS_AND_BOSSES.md
 */
export type EventKind = "monster" | "rest" | "special";

export const EVENT_KINDS = [
  "monster",
  "rest",
  "special",
] as const satisfies readonly EventKind[];

/**
 * 이벤트에서 플레이어가 고를 수 있는 하나의 행동이다.
 *
 * 인터페이스 문서가 선택 전에 행동 대상·예상 이득·알려진 위험을 확인할 수
 * 있어야 한다고 정했으므로 셋을 타입에 담는다. 정확한 계산식을 다 공개할
 * 필요는 없지만 위험이 완전히 숨겨져서는 안 된다.
 * docs/experience/ONBOARDING_AND_INTERFACE.md
 */
export interface EventChoice {
  id: ChoiceId;
  label: string;
  /** 행동 대상. 없으면 파티 전체나 상황 자체를 향한다. */
  target?: EventTarget;
  /** "성직자의 신뢰를 얻는다"처럼 플레이어에게 알려주는 기대치다. */
  expectedGain: string;
  /** "발각되면 처형"처럼 플레이어가 아는 위험이다. */
  knownRisk: string;
  effectTags: readonly EventEffectTag[];
  /** `trade` 태그가 사는 상품. 거래 선택지가 아니면 없다. */
  itemId?: ItemId;
}

export interface DungeonEvent {
  id: EventId;
  kind: EventKind;
  /**
   * 이 지점에서 제시할 정보 카드 주제. 없으면 분류에서 정한다.
   *
   * 상인 조우를 특수 사건으로 합치면서 생겼다. 분류만으로 주제를 정하면 상인
   * 주제 카드가 영영 나오지 않는다. 사건이 스스로 선언하면 그 자리의 상황과
   * 맞는 카드가 나온다.
   * docs/superpowers/specs/2026-08-18-sbh3821-irregular-map-generation-design.md
   */
  infoSubject?: InfoSubject;
  title: string;
  description: string;
  /** 비어 있을 수 없다. 모든 이벤트는 최소 하나의 선택을 제공한다. */
  choices: EventChoice[];
}

/** 던전은 되돌아가지 않는 분기 그래프다. */
export interface DungeonNode {
  id: NodeId;
  /** 입구에서의 거리. 경로 지도가 세로 위치를 잡는 데 쓴다. */
  depth: number;
  eventId: EventId;
  /** 빈 배열이면 마지막 지점이다. DungeonState의 bossNodeId가 그렇다. */
  nextNodeIds: NodeId[];
}

export interface DungeonState {
  nodes: DungeonNode[];
  entryNodeId: NodeId;
  bossNodeId: NodeId;
}
