import type { CardId, ClaimId, MemberId } from "./ids";

export type TruthType = "truth" | "lie" | "neutral";

export const TRUTH_TYPES = [
  "truth",
  "lie",
  "neutral",
] as const satisfies readonly TruthType[];

/** 정보를 받는 대상. 용사 개인 또는 보스다. */
export type Target = { kind: "member"; id: MemberId } | { kind: "boss" };

export interface InfoCard {
  id: CardId;
  truthType: TruthType;
  /** "보스 약점", "파티 구성"처럼 카드가 다루는 주제다. */
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
