import type { CardId, ClaimId, MemberId } from "./ids";

export type TruthType = "truth" | "lie" | "neutral";

export const TRUTH_TYPES = [
  "truth",
  "lie",
  "neutral",
] as const satisfies readonly TruthType[];

/** 정보 카드의 수신자는 살아 있는 용사 개인으로 제한한다. */
export type Target = { kind: "member"; id: MemberId };

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

/**
 * 전달했지만 아직 사실 여부가 드러나지 않은 정보다.
 * docs/systems/INFORMATION_AND_DECEPTION.md
 */
export interface InfoClaim {
  id: ClaimId;
  cardId: CardId;
  target: Target;
  /** 전달한 시점의 로그 순번. DecisionRecord.at과 같은 축이다. */
  toldAt: number;
}
