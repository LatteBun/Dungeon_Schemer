import type { CampaignDungeon, RiskLevel } from "./dungeon";
import type { CharacterPool, ExpeditionParty } from "./pool";
import type { DungeonId, OfferId } from "./ids";

/**
 * 길잡이 등급이다. 어느 위험도까지 들어갈 수 있는지만 정한다.
 *
 * 옛 `Grade`는 던전 난이도와 길잡이 자격을 함께 뜻했다. 이름을 바꾸지 않으면
 * 옛 의미가 따라오므로 `GuideRank`로 부른다.
 * docs/systems/PROGRESSION_AND_ENDINGS.md
 */
export type GuideRank = "C" | "B" | "A" | "S";

export const GUIDE_RANKS = ["C", "B", "A", "S"] as const satisfies readonly GuideRank[];

/** 등급별 진입 가능한 최대 위험도. */
export const RANK_RISK_LIMIT: Readonly<Record<GuideRank, RiskLevel>> = {
  C: 2,
  B: 3,
  A: 4,
  S: 5,
};

/** 요구 명성은 문턱이지 비용이 아니다. 승급해도 명성은 줄지 않는다. */
export const PROMOTION_REPUTATION: Readonly<Record<Exclude<GuideRank, "C">, number>> = {
  B: 60,
  A: 120,
  S: 200,
};

/** 골드 승급은 현재 골드를 소비하고 명성을 보지 않는다. */
export const PROMOTION_GOLD: Readonly<Record<Exclude<GuideRank, "C">, number>> = {
  B: 150,
  A: 320,
  S: 600,
};

export const REPUTATION_START = 30;
/** 명성은 승급 요구치로만 쓰이므로 음수까지 내려갈 이유가 없다. */
export const REPUTATION_MIN = 0;
export const GOLD_START = 10;

export const CAMPAIGN_DUNGEON_COUNT = 15;
/** 게시판이 한 번에 보여주는 공고 수. 부족하면 진입 불가로 채운다. */
export const BOARD_OFFER_MAX = 5;

/** 신뢰 0이 이 인원에 이르면 즉시 누적 고발 엔딩이다. */
export const DENOUNCE_THRESHOLD = 5;

/**
 * 엔딩 5종이다. 배열 순서가 곧 판정 순서이며 먼저 성립한 것만 적용한다.
 * docs/systems/PROGRESSION_AND_ENDINGS.md
 */
export type EndingKind =
  | "distrust"
  | "denounced"
  | "completed"
  | "exhausted"
  | "unemployed";

export const ENDING_ORDER = [
  "distrust",
  "denounced",
  "completed",
  "exhausted",
  "unemployed",
] as const satisfies readonly EndingKind[];

export interface CampaignEnding {
  kind: EndingKind;
  /** "생존자 전원의 신뢰가 0"처럼 판정 근거를 사람이 읽는 문장으로 남긴다. */
  reason: string;
  finalRank: GuideRank;
}

/** 진입 불가 공고를 왜 못 들어가는지 게시판이 그대로 보여준다. */
export type OfferLockReason = "rankTooLow";

export interface BoardOffer {
  id: OfferId;
  dungeonId: DungeonId;
  /** 계약 시점의 위험도. 정산의 명성 손실도 이 값을 쓴다. */
  riskLevel: RiskLevel;
  /** 계약 화면에서 본 위험이 정산에서 달라지지 않도록 공고에 고정한다. */
  party: ExpeditionParty;
  lockReason: OfferLockReason | null;
}

/**
 * 캠페인의 단계다. 인트로에서 시작해 월드턴을 거쳐 다음 게시판으로 돌아온다.
 */
export type CampaignPhase =
  | "intro"
  | "board"
  | "contract"
  | "expedition"
  | "settlement"
  | "promotion"
  | "worldTurn"
  | "ended";

export const CAMPAIGN_PHASES = [
  "intro",
  "board",
  "contract",
  "expedition",
  "settlement",
  "promotion",
  "worldTurn",
  "ended",
] as const satisfies readonly CampaignPhase[];

export interface CampaignState {
  seed: string;
  phase: CampaignPhase;
  rank: GuideRank;
  /** REPUTATION_MIN 이상. 상한은 없다. */
  reputation: number;
  gold: number;
  /** 승급에 쓰지 않는다. 엔딩 회고 통계 전용이다. */
  cumulativeGold: number;
  pool: CharacterPool;
  dungeons: readonly CampaignDungeon[];
  offers: readonly BoardOffer[];
  /** 플레이어 원정 1회가 세계의 시간 1단위다. */
  worldTurn: number;
  ending: CampaignEnding | null;
}
