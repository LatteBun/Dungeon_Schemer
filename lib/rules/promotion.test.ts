import { describe, expect, it } from "vitest";
import {
  PROMOTION_THRESHOLDS,
  calculatePromotionScore,
  nextGradeTarget,
  promote,
} from "./promotion";

describe("promotion", () => {
  it("승급 점수는 현재 명성 2배와 누적 골드를 합산한다", () => {
    expect(calculatePromotionScore(66, 142)).toBe(274);
    expect(calculatePromotionScore(0, 0)).toBe(0);
    expect(calculatePromotionScore(38, 60)).toBe(136);
  });

  it("등급 기준 상수는 확정값이다", () => {
    expect(PROMOTION_THRESHOLDS).toEqual({ C: 0, B: 120, A: 261, S: 489 });
  });

  it("다음 등급은 현재 영구 등급 바로 위이며 S면 null이다", () => {
    expect(nextGradeTarget("C")).toEqual({ grade: "B", threshold: 120 });
    expect(nextGradeTarget("B")).toEqual({ grade: "A", threshold: 261 });
    expect(nextGradeTarget("A")).toEqual({ grade: "S", threshold: 489 });
    expect(nextGradeTarget("S")).toBeNull();
  });

  it("기준 진행의 승급 checkpoint를 정확히 재현한다", () => {
    // docs/systems/PROGRESSION_AND_ENDINGS.md의 프로토타입 승급 속도 기준
    expect(calculatePromotionScore(30, 60)).toBe(120);
    expect(promote("C", 120)).toBe("B");
    expect(calculatePromotionScore(63, 135)).toBe(261);
    expect(promote("B", 261)).toBe("A");
    expect(calculatePromotionScore(117, 255)).toBe(489);
    expect(promote("A", 489)).toBe("S");
    expect(calculatePromotionScore(165, 351)).toBe(681);
  });

  it("조건을 만족하는 가장 높은 등급으로 한 번에 올린다", () => {
    expect(promote("C", 119)).toBe("C");
    expect(promote("C", 260)).toBe("B");
    expect(promote("C", 489)).toBe("S");
  });

  it("점수가 낮아져도 강등하지 않는다", () => {
    expect(promote("B", 0)).toBe("B");
    expect(promote("S", 100)).toBe("S");
    expect(promote("A", 120)).toBe("A");
  });
});
