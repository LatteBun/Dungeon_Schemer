import type { Grade } from "./campaign";
import type { InfoRecord } from "./info";
import type {
  CardId,
  ChoiceId,
  DungeonId,
  EventId,
  MemberId,
  NodeId,
  PartyId,
} from "./ids";

export interface MapNode {
  id: NodeId;
  depth: number;
  nextNodeIds: NodeId[];
  eventId: EventId;
  riskSummary: string;
  hasInfoOpportunity: boolean;
  bossRelatedInfoCount: number;
  /** 같은 깊이 안에서 몇 번째인지. 화면이 좌표를 잡는 기준이다. */
  column: number;
}

export interface GeneratedMap {
  grade: Grade;
  nodes: MapNode[];
  entryNodeId: NodeId;
  bossNodeId: NodeId;
  /**
   * 어느 길로 가도 지나는 사건 수. 층 수와 같다.
   *
   * 경로 목록을 두지 않는 이유는 간선이 깊이를 정확히 1씩 늘려 모든 경로가 같은
   * 값을 갖기 때문이다. 목록으로 두면 같은 수를 최대 2048번 반복하게 된다.
   * docs/superpowers/specs/2026-08-18-sbh3821-irregular-map-generation-design.md
   */
  regularEventCount: number;
  infoCount: number;
  bossRelatedInfoCount: number;
}

export interface PendingInfo {
  nodeId: NodeId;
  cardIds: CardId[];
  bossRelatedCardCount: number;
}

export interface PendingEvent {
  nodeId: NodeId;
  eventId: EventId;
  choiceIds: ChoiceId[];
}

export interface BossResult {
  survivorIds: MemberId[];
  casualtyIds: MemberId[];
  damageByMember: Record<string, number>;
}

export type ExpeditionResultStatus = "cleared" | "failed";

export interface ExpeditionResult {
  status: ExpeditionResultStatus;
  survivorIds: MemberId[];
  casualtyIds: MemberId[];
  reason: string;
}

export interface ExpeditionLogRecord {
  at: number;
  kind: "map" | "info" | "event" | "boss" | "settlement";
  summary: string;
  memberIds: MemberId[];
}

export interface ExpeditionState {
  dungeonId: DungeonId;
  partyId: PartyId;
  map: GeneratedMap;
  currentNodeId: NodeId;
  visitedNodeIds: NodeId[];
  pendingInfo: PendingInfo | null;
  pendingEvent: PendingEvent | null;
  /** 전달한 카드에 대한 파티원별 반응. 보스전과 사후 검증의 입력이다. */
  infoRecords: InfoRecord[];
  bossResult: BossResult | null;
  result: ExpeditionResult | null;
  log: ExpeditionLogRecord[];
}
