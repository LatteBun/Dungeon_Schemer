import { describe, expect, it } from "vitest";
import {
  EVENT_KINDS,
  PERSONALITIES,
  RUN_PHASES,
  TRUST_MAX,
  TRUST_MIN,
  TRUTH_TYPES,
} from "@/lib/domain";

describe("도메인 상수", () => {
  it("성격은 다섯이다", () => {
    expect(PERSONALITIES).toHaveLength(5);
  });

  it("이벤트 분류는 넷이다", () => {
    expect(EVENT_KINDS).toHaveLength(4);
  });

  it("진실 유형은 셋이다", () => {
    expect(TRUTH_TYPES).toHaveLength(3);
  });

  it("진행 단계는 여섯이다", () => {
    expect(RUN_PHASES).toHaveLength(6);
  });

  it("신뢰 척도는 0 이상 100 이하다", () => {
    expect([TRUST_MIN, TRUST_MAX]).toEqual([0, 100]);
  });
});
