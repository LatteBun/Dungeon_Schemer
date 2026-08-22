import type { EndingKind, GuideRank } from "@/lib/domain";

/**
 * U6 엔딩 화면의 모델 경계.
 *
 * 엔딩 판정은 C6, 통계 누적은 C8 의 몫이고 둘 다 아직 없다. 화면은 판정 순서를
 * 알 필요가 없다. kind 와 reason 을 받아 표시만 한다.
 */

export const ENDING_TITLE: Readonly<Record<EndingKind, string>> = {
  distrust: "불신의 대가",
  denounced: "누적 고발",
  completed: "원정 종료",
  exhausted: "인력 소진",
  unemployed: "실직",
};

const ACHIEVEMENT_ROOT = "/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/achievements";

/** 자산 넷을 엔딩 다섯에 나눠 쓴다. 배신으로 끝난 둘은 같은 문양을 쓴다. */
const ENDING_CREST: Readonly<Record<EndingKind, string>> = {
  completed: "achievement_conquest",
  distrust: "achievement_together",
  denounced: "achievement_together",
  exhausted: "achievement_return",
  unemployed: "achievement_guild",
};

export function endingCrestSrc(kind: EndingKind): string {
  return `${ACHIEVEMENT_ROOT}/${ENDING_CREST[kind]}.png`;
}

/** 던전 15개를 모두 클리어했는가. 등급이 아니라 엔딩 종류가 정한다. */
export function isNormalCompletion(kind: EndingKind): boolean {
  return kind === "completed";
}

export interface U6AdviceStat {
  label: string;
  given: number;
  caught: number;
}

export interface U6ChronicleEntry {
  worldTurn: number;
  dungeonName: string;
  outcome: string;
}

export interface U6EndingView {
  kind: EndingKind;
  /** "생존자 전원의 신뢰가 0" 처럼 사람이 읽는 판정 근거. */
  reason: string;
  finalRank: GuideRank;
  survivedCount: number;
  diedCount: number;
  zeroTrustCount: number;
  finalReputation: number;
  cumulativeGold: number;
  expeditionCount: number;
  adviceStats: readonly U6AdviceStat[];
  turningPoint: { label: string; detail: string } | null;
  chronicle: readonly U6ChronicleEntry[];
}
