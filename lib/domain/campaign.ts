import type {
  BoardOfferId,
  ClassId,
  DungeonId,
  MemberId,
  PartyId,
} from "./ids";
import type { ExpeditionResultStatus, ExpeditionState } from "./expedition";
import type { TruthType } from "./info";
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

/**
 * 정산이 남기는 원인 사슬 한 단계다.
 *
 * 규칙이 아니라 도메인에 두는 이유는 원정 기록이 이 단계를 그대로 품기
 * 때문이다. 도메인이 `lib/rules`를 가져오면 의존 방향이 뒤집힌다. 단계의
 * 순서는 여전히 규칙의 결정이므로 `SETTLEMENT_STEP_ORDER`는 규칙에 남는다.
 */
export type SettlementStepKind =
  | "survival"
  | "reward"
  | "dungeon"
  | "promotion"
  | "party"
  | "ending";

export interface SettlementStep {
  readonly kind: SettlementStepKind;
  readonly summary: string;
}

/**
 * 진위 한 종류의 전달·반응 누적이다.
 *
 * 두 단위를 일부러 함께 둔다. `delivered`는 플레이어가 내린 결정의 수이고
 * 나머지는 카드 × 파티원 판정의 수다. 한 단위로 통일하면 둘 중 하나를 잃는다.
 * docs/superpowers/specs/2026-08-16-sanghwan-yoo-campaign-statistics-design.md
 */
export interface CardTruthStat {
  /** 용사에게 전달한 카드 장수. */
  delivered: number;
  accepted: number;
  suspected: number;
  exposed: number;
  /** 수용됐다가 보스전 뒤 드러난 거짓. `lie` 외에는 항상 0이다. */
  lateExposed: number;
}

export type TurningPointKind = "firstWipe" | "promotion" | "scoreSwing";

export interface TurningPoint {
  kind: TurningPointKind;
  /** 가리키는 `ExpeditionRecord.order`. */
  expeditionOrder: number;
  /** 왜 이 원정이 전환점인지. 규칙이 쓴 문장을 화면이 그대로 쓴다. */
  summary: string;
}

/** 원정 하나가 캠페인에 남긴 것. 한 캠페인에 15건 남짓이라 통째로 들고 있는다. */
export interface ExpeditionRecord {
  /** 1부터 빈틈없이 증가한다. */
  order: number;
  dungeonId: DungeonId;
  /** 출전 당시 등급. 실패로 등급이 오르기 전 값이다. */
  grade: Grade;
  partyId: PartyId;
  status: ExpeditionResultStatus;
  survivorCount: number;
  casualtyCount: number;
  cards: Record<TruthType, CardTruthStat>;
  /** 보스전에서 파티가 입은 피해 합. 보스전이 없었으면 0이다. */
  bossDamageTotal: number;
  reputationDelta: number;
  goldDelta: number;
  scoreBefore: number;
  scoreAfter: number;
  rankBefore: Grade;
  rankAfter: Grade;
  /** 정산이 만든 원인 사슬 그대로. */
  steps: SettlementStep[];
}

/**
 * 캠페인 누적 통계다.
 *
 * `cards`와 `expeditions`의 중복은 의도한 것이다. 엔딩 화면이 매 렌더마다
 * 15건을 접지 않아도 되고, 두 벌의 일치는 `statistics.test.ts`가 검사한다.
 */
export interface CampaignStatistics {
  cards: Record<TruthType, CardTruthStat>;
  clearedExpeditions: number;
  wipedExpeditions: number;
  expeditions: ExpeditionRecord[];
  /** 정산마다 연대기 전체에서 다시 고른다. */
  turningPoint: TurningPoint | null;
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
  statistics: CampaignStatistics;
}
