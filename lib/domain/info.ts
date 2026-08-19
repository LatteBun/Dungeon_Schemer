import type { CardId, ClaimId, CharacterId } from "./ids";

export type TruthType = "truth" | "lie" | "neutral";

export const TRUTH_TYPES = [
  "truth",
  "lie",
  "neutral",
] as const satisfies readonly TruthType[];

/** 정보 카드의 수신자는 살아 있는 용사 개인으로 제한한다. */
export type Target = { kind: "member"; id: CharacterId };

/** 사건 행동은 역사적 호환성을 위해 보스를 대상으로 삼을 수 있다. */
export type EventTarget = Target | { kind: "boss" };

export type InfoSubject =
  | "route"
  | "event"
  | "monster"
  | "rest"
  | "merchant"
  | "boss";

export const INFO_SUBJECTS = [
  "route",
  "event",
  "monster",
  "rest",
  "merchant",
  "boss",
] as const satisfies readonly InfoSubject[];

export interface InfoCard {
  id: CardId;
  truthType: TruthType;
  subject: InfoSubject;
  /** "보스 약점", "파티 구성"처럼 카드가 다루는 설명이다. */
  topic: string;
  text: string;
}

/** 카드를 받은 파티원 한 명의 반응. 보스는 수신자가 아니라 주제일 뿐이다. */
export type InfoReaction = "accepted" | "suspected" | "exposed";

/**
 * 한 파티원에게 카드 한 장을 전달한 결과다.
 *
 * 보스전과 사후 검증이 `누가 무엇을 믿었는지`를 알아야 하므로 그 순간에 남긴다.
 * 정산이 나중에 앞뒤 상태를 비교하면 신뢰가 얼마나 움직였는지는 알아도 어느
 * 카드 때문인지는 복원할 수 없다.
 * docs/superpowers/specs/2026-08-15-sbh3821-party-info-evaluation-design.md
 */
export interface InfoRecord {
  cardId: CardId;
  /** 카드가 실제로 진실이었는지. 보스전 뒤 의심을 검증할 때 쓴다. */
  truthType: TruthType;
  subject: InfoSubject;
  characterId: CharacterId;
  reaction: InfoReaction;
  /** 이 카드 한 장이 만드는 보스 피해 보정. 합산과 상한은 보스전이 한다. */
  modifier: number;
  /** 수용된 거짓이라 보스전 뒤 검증할 대상이다. */
  pendingVerification: boolean;
}

/**
 * 전달했지만 아직 사실 여부가 드러나지 않은 정보다.
 * docs/systems/INFORMATION_AND_DECEPTION.md
 */
export interface InfoClaim {
  id: ClaimId;
  cardId: CardId;
  target: Target;
  /** 전달한 시점의 로그 순번. 캠페인 로그와 같은 순번 축이다. */
  toldAt: number;
}
