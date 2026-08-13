import type {
  BoardOfferId,
  ClassId,
  DungeonId,
  MemberId,
  PartyId,
} from "./ids";
import type { ExpeditionState } from "./expedition";
import type { Personality } from "./party";

export type Grade = "C" | "B" | "A" | "S";

export const GRADES = ["C", "B", "A", "S"] as const satisfies readonly Grade[];

export type CampaignPhase =
  | "board"
  | "contract"
  | "map"
  | "infoOpportunity"
  | "event"
  | "boss"
  | "settlement"
  | "ended";

export const CAMPAIGN_PHASES = [
  "board",
  "contract",
  "map",
  "infoOpportunity",
  "event",
  "boss",
  "settlement",
  "ended",
] as const satisfies readonly CampaignPhase[];

export type DungeonStatus = "remaining" | "cleared";

export interface CampaignDungeon {
  id: DungeonId;
  initialGrade: Grade;
  grade: Grade;
  sortOrder: number;
  status: DungeonStatus;
  failureCount: number;
}

export interface MemoryRecord {
  at: number;
  kind: "info" | "event" | "boss" | "settlement";
  summary: string;
}

export interface CampaignMember {
  id: MemberId;
  name: string;
  classId: ClassId;
  personality: Personality;
  currentHp: number;
  maxHp: number;
  trust: number;
  carriedGold: number;
  alive: boolean;
  memory: MemoryRecord[];
}

export interface CampaignParty {
  id: PartyId;
  memberIds: MemberId[];
  complete: boolean;
}

export type BoardLockReason =
  | "insufficientReputation"
  | "partyUnavailable"
  | null;

export interface BoardOffer {
  id: BoardOfferId;
  dungeonId: DungeonId;
  partyId: PartyId;
  requiredReputation: number;
  baseReputationReward: number;
  baseGoldReward: number;
  nodeCount: number;
  locked: boolean;
  lockReason: BoardLockReason;
}

export type CampaignEndingId =
  | "distrust"
  | "expeditionComplete"
  | "supportUnavailable"
  | "partyExhausted";

export interface CampaignEnding {
  id: CampaignEndingId;
  reason: string;
  at: number;
}

export interface CampaignLogRecord {
  at: number;
  summary: string;
}

export interface CampaignState {
  seed: string;
  phase: CampaignPhase;
  rank: Grade;
  currentReputation: number;
  currentGold: number;
  cumulativeGold: number;
  dungeons: CampaignDungeon[];
  members: CampaignMember[];
  parties: CampaignParty[];
  reserveMemberIds: MemberId[];
  waitingMemberIds: MemberId[];
  board: BoardOffer[];
  expedition: ExpeditionState | null;
  ending: CampaignEnding | null;
  log: CampaignLogRecord[];
}
