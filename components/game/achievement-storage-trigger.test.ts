import { describe, expect, it } from "vitest";
import {
  advanceDiagnosticTrigger,
  initialDiagnosticTriggerState,
} from "./achievement-storage-trigger";

describe("업적 저장 진단 히든 트리거", () => {
  it("2초 안의 다섯 번째 클릭에서만 연다", () => {
    let state = initialDiagnosticTriggerState();
    for (const now of [0, 300, 600, 900]) {
      const result = advanceDiagnosticTrigger(state, now);
      state = result.state;
      expect(result.open).toBe(false);
    }

    const fifth = advanceDiagnosticTrigger(state, 1200);
    expect(fifth.open).toBe(true);
    expect(fifth.state).toEqual(initialDiagnosticTriggerState());
  });

  it("첫 클릭에서 2초가 지나면 새 연속 입력으로 센다", () => {
    const first = advanceDiagnosticTrigger(initialDiagnosticTriggerState(), 0);
    const expired = advanceDiagnosticTrigger(first.state, 2001);

    expect(expired).toEqual({ open: false, state: { count: 1, startedAt: 2001 } });
  });

  it("정확히 2초인 다섯 번째 클릭은 연속 입력이다", () => {
    let state = initialDiagnosticTriggerState();
    for (const now of [0, 500, 1000, 1500]) state = advanceDiagnosticTrigger(state, now).state;

    expect(advanceDiagnosticTrigger(state, 2000).open).toBe(true);
  });
});
