import type { Grade } from "@/lib/domain";

/** 승급 점수 기준. 상위 spec에서 확정된 값이다. */
export const PROMOTION_THRESHOLDS: Readonly<Record<Grade, number>> = {
  C: 0,
  B: 120,
  A: 274,
  S: 370,
};

const GRADE_ORDER: readonly Grade[] = ["C", "B", "A", "S"];

/** 승급 점수 = 현재 명성 × 2 + 누적 획득 골드. */
export function calculatePromotionScore(
  currentReputation: number,
  cumulativeGold: number,
): number {
  return currentReputation * 2 + cumulativeGold;
}

/**
 * 현재 영구 등급 바로 위 등급과 그 기준을 돌려준다.
 * 강등이 없으므로 등급이 점수보다 앞설 수 있어 등급 기준으로 계산한다.
 * S면 최고 등급이므로 null이다.
 */
export function nextGradeTarget(
  rank: Grade,
): { grade: Grade; threshold: number } | null {
  const next = GRADE_ORDER[GRADE_ORDER.indexOf(rank) + 1];
  if (next === undefined) {
    return null;
  }
  return { grade: next, threshold: PROMOTION_THRESHOLDS[next] };
}
