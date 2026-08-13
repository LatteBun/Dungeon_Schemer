import { GRADES } from "@/lib/domain";
import type { Grade } from "@/lib/domain";

/**
 * 등급별 던전 상수. 첫 백테스트를 위한 프로토타입 값이며 밸런스 조정은
 * 이 표를 바꿔서 한다.
 * docs/superpowers/specs/2026-08-13-sanghwan-yoo-game-direction-rework-design.md
 */
export interface GradeDef {
  /** 공고에 지원하기 위한 최소 현재 명성 */
  readonly requiredReputation: number;
  /** 3명 전원 생존 클리어의 기본 명성 보상 */
  readonly baseReputationReward: number;
  /** 3명 전원 생존 클리어의 기본 골드 보상 */
  readonly baseGoldReward: number;
  /** 지도의 전체 지점 수. 입구 1 + 양쪽 갈래 + 합류 1 + 보스방 1 */
  readonly nodeCount: number;
  /** 한쪽 갈래의 지점 수 */
  readonly branchLength: number;
  /** 실제 경로에서 보장하는 보스 관련 정보 수 */
  readonly bossInfoGuarantee: number;
}

export const GRADE_DEFS: Readonly<Record<Grade, GradeDef>> = {
  C: {
    requiredReputation: 0,
    baseReputationReward: 10,
    baseGoldReward: 20,
    nodeCount: 7,
    branchLength: 2,
    bossInfoGuarantee: 1,
  },
  B: {
    requiredReputation: 30,
    baseReputationReward: 15,
    baseGoldReward: 35,
    nodeCount: 9,
    branchLength: 3,
    bossInfoGuarantee: 1,
  },
  A: {
    requiredReputation: 60,
    baseReputationReward: 25,
    baseGoldReward: 55,
    nodeCount: 11,
    branchLength: 4,
    bossInfoGuarantee: 2,
  },
  S: {
    requiredReputation: 100,
    baseReputationReward: 40,
    baseGoldReward: 80,
    nodeCount: 13,
    branchLength: 5,
    bossInfoGuarantee: 2,
  },
};

/** 캠페인 시작 시 등급별 던전 수. 합계 15개다. */
export const INITIAL_DUNGEON_COUNTS: Readonly<Record<Grade, number>> = {
  C: 6,
  B: 4,
  A: 3,
  S: 2,
};

export const TOTAL_DUNGEON_COUNT = GRADES.reduce(
  (total, grade) => total + INITIAL_DUNGEON_COUNTS[grade],
  0,
);

/**
 * 전멸한 던전이 올라갈 다음 등급. S급은 유지한다.
 * 정산에서 등급을 올릴 때 쓴다.
 */
export function nextGradeAfterFailure(grade: Grade): Grade {
  const index = GRADES.indexOf(grade);
  return GRADES[Math.min(index + 1, GRADES.length - 1)];
}
