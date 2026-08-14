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
}

export interface MapPath {
  nodeIds: NodeId[];
  regularEventCount: number;
  infoCount: number;
  /**
   * 이 경로에서 보장하는 보스 주제 카드 수.
   * 보장은 지점이 아니라 경로 단위 요구사항이라 경로에 직접 둔다.
   */
  bossRelatedInfoCount: number;
}

export interface GeneratedMap {
  grade: Grade;
  nodes: MapNode[];
  entryNodeId: NodeId;
  bossNodeId: NodeId;
  paths: MapPath[];
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
