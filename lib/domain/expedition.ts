import type { Grade } from "./campaign";
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
  bossResult: BossResult | null;
  result: ExpeditionResult | null;
  log: ExpeditionLogRecord[];
}
