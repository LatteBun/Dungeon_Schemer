import { describe, expect, it } from "vitest";
import {
  PROMOTION_THRESHOLDS,
  calculatePromotionScore,
  nextGradeTarget,
} from "./promotion";

describe("promotion", () => {
  it("승급 점수는 현재 명성 2배와 누적 골드를 합산한다", () => {
    expect(calculatePromotionScore(66, 142)).toBe(274);
    expect(calculatePromotionScore(0, 0)).toBe(0);
    expect(calculatePromotionScore(38, 60)).toBe(136);
  });

  it("등급 기준 상수는 확정값이다", () => {
    expect(PROMOTION_THRESHOLDS).toEqual({ C: 0, B: 120, A: 274, S: 370 });
  });

  it("다음 등급은 현재 영구 등급 바로 위이며 S면 null이다", () => {
    expect(nextGradeTarget("C")).toEqual({ grade: "B", threshold: 120 });
    expect(nextGradeTarget("B")).toEqual({ grade: "A", threshold: 274 });
    expect(nextGradeTarget("A")).toEqual({ grade: "S", threshold: 370 });
    expect(nextGradeTarget("S")).toBeNull();
  });
});
