import type { EndingKind, GuideRank } from "@/lib/domain";

/**
 * U6 엔딩 화면의 모델 경계.
 *
 * 엔딩 판정과 통계 누적은 각각 C6/C8의 몫이다. 화면은 판정 순서를 알 필요가
 * 없다. kind 와 reason 을 받아 표시만 한다.
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

/*
 * 엔딩마다 오른쪽 문서와 세 번째 패널의 이름이 함께 바뀐다. 결말의 성격을
 * 이름으로 먼저 말하기 때문이다. 시안은
 * docs/experience/reference/u6-ending/README.md 에 있다.
 */
export const ENDING_REPORT_TITLE: Readonly<Record<EndingKind, string>> = {
  completed: "원정 보고서",
  distrust: "최후 보고서",
  denounced: "길드 판결문",
  exhausted: "길드 현황",
  unemployed: "게시판 상태",
};

export const ENDING_CONSEQUENCE_TITLE: Readonly<Record<EndingKind, string>> = {
  completed: "주요 업적",
  distrust: "무너진 관계",
  denounced: "누적 기록",
  exhausted: "남겨진 자리",
  unemployed: "닫힌 게시판",
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

/** 오른쪽 문서와 세 번째 패널의 항목. */
export interface U6EndingNote {
  label: string;
  detail?: string;
}

export interface U6EndingView {
  kind: EndingKind;
  /** 표제 아래와 화면 아래에 같은 문장이 온다. */
  subtitle: string;
  /** 결말의 이유. 한 문장이 아니라 세 줄이다. */
  reasons: readonly string[];
  /** 오른쪽 문서의 확인 항목. */
  report: readonly string[];
  /** 세 번째 패널. 결말의 성격에 따라 업적이거나 손실이다. */
  consequences: readonly U6EndingNote[];
  finalRank: GuideRank;
  survivedCount: number;
  diedCount: number;
  zeroTrustCount: number;
  zeroTrustPartySize: number;
  finalReputation: number;
  cumulativeGold: number;
  adviceTotal: number;
  wipedExpeditions: number;
  turningPoint: { label: string; detail: string } | null;
  /** 15줄 나열이 아니라 두세 문장의 산문이다. */
  chronicleSummary: string;
}
