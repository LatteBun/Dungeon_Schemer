import type { MemberId, NodeId } from "./ids";
import type { DungeonState } from "./dungeon";
import type { InfoClaim } from "./info";
import type { PartyMember } from "./party";

/**
 * 프로토타입이 다루는 한 판의 진행 단계다.
 * docs/design/CORE_GAME_LOOP.md
 */
export type RunPhase =
  | "partyIntro"
  | "pathChoice"
  | "event"
  | "bossFight"
  | "settlement"
  | "ended";

export const RUN_PHASES = [
  "partyIntro",
  "pathChoice",
  "event",
  "bossFight",
  "settlement",
  "ended",
] as const satisfies readonly RunPhase[];

/** 한 판에서 관리하는 자원. 개별 물품은 아이템으로 따로 관리한다. */
export interface Resources {
  gold: number;
  food: number;
  reputation: number;
}

export interface TrustChange {
  memberId: MemberId;
  delta: number;
  /** "정의로운 성격: 거짓 정보가 발각됨"처럼 사람이 읽는 문장이다. */
  reason: string;
}

/**
 * 한 번의 결정과 그 결과를 남긴 기록이다.
 * 정산이 "영향을 준 선택"을 만들고 화면이 신뢰 변화 사유를 보여줄 때 쓴다.
 */
export interface DecisionRecord {
  /** 0부터 시작하는 로그 순번. 시각이 아니다. 시각을 쓰면 재현성이 깨진다. */
  at: number;
  nodeId: NodeId;
  summary: string;
  trustChanges: TrustChange[];
}

export interface RunState {
  seed: string;
  phase: RunPhase;
  party: PartyMember[];
  dungeon: DungeonState;
  currentNodeId: NodeId;
  resources: Resources;
  /** 아직 사실 여부가 드러나지 않은 정보다. */
  pendingClaims: InfoClaim[];
  /** 추가 전용이다. 이미 쌓인 기록을 고치지 않는다. */
  log: DecisionRecord[];
}
