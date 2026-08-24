import { describe, expect, it } from "vitest";
import {
  advanceAdvicePressure,
  assertAdvicePressure,
  combatMultipliersForAdvicePressure,
} from "./advice-pressure";

describe("조언 압력", () => {
  it.each([
    [0, { executed: true, outcome: "harm" as const }, 1],
    [3, { executed: true, outcome: "harm" as const }, 3],
    [2, { executed: true, outcome: "help" as const }, 1],
    [0, { executed: true, outcome: "help" as const }, 0],
    [2, { executed: true, outcome: "neutral" as const }, 2],
    [2, { executed: false, outcome: "harm" as const }, 2],
  ])("%i에서 %o 결정 뒤 압력은 %i다", (current, decision, expected) => {
    expect(advanceAdvicePressure(current as 0 | 1 | 2 | 3, decision)).toBe(expected);
  });

  it("0~3 정수가 아닌 압력을 상태 오류로 거부한다", () => {
    expect(() => assertAdvicePressure(4)).toThrowError(expect.objectContaining({ code: "INVALID_STATE" }));
  });

  it("검증된 압력의 전투 배율을 설정에서 조회한다", () => {
    expect(combatMultipliersForAdvicePressure(2)).toEqual({
      incomingDamageMultiplier: 1.15,
      outgoingDamageMultiplier: 0.90,
    });
  });
});
