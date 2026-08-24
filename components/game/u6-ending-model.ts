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

/*
 * 실패한 판에 훈장을 주지 않는다.
 *
 * 다섯 결말에 업적 문양 넷을 나눠 쓰고 있었다. 그러면 실직에 길드 훈장이, 인력
 * 소진에 귀환 훈장이 걸린다 - 상을 받은 것처럼 읽힌다. 업적 문양은 완주한 판의
 * 「주요 업적」 칸이 쓰는 것이고, 결말의 문양이 아니다.
 *
 * 끝난 판에 남는 것은 길드가 찍은 판결이다. 인주 하나를 쓰고 색으로 가른다.
 */
const ENDING_SEAL = "/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/emblems/wax_seal.png";

/** 결말마다 인주 색이 다르다. 깃발과 같은 색을 탄다. */
export const ENDING_SEAL_TONE: Readonly<Record<EndingKind, string>> = {
  completed: "green",
  denounced: "red",
  distrust: "ash",
  exhausted: "ash",
  unemployed: "blue",
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

export function endingCrestSrc(_kind: EndingKind): string {
  return ENDING_SEAL;
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
  /** `C8-A` 가 센 값이다. 전멸 횟수의 분모라 함께 있어야 뜻이 산다. */
  totalExpeditions: number;
  clearedExpeditions: number;
  wipedExpeditions: number;
  /** 가장 깊이 간 던전 순번. 0 이면 하나도 클리어하지 못했다. */
  highestDungeonCleared: number;
  turningPoint: { label: string; detail: string } | null;
  /** 15줄 나열이 아니라 두세 문장의 산문이다. */
  chronicleSummary: string;
}
