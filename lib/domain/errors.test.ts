import { describe, expect, it } from "vitest";
import { RuleError } from "@/lib/domain";

describe("구조화된 규칙 오류", () => {
  it("코드·메시지·상세 정보를 보존한다", () => {
    const error = new RuleError("INVALID_TRANSITION", "보드 단계가 아니다", {
      phase: "event",
      expected: "board",
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("RuleError");
    expect(error.code).toBe("INVALID_TRANSITION");
    expect(error.message).toBe("보드 단계가 아니다");
    expect(error.details).toEqual({ phase: "event", expected: "board" });
  });

  it("잘못된 도메인 상태 오류를 표현한다", () => {
    const error = new RuleError("INVALID_STATE", "월드턴 상태가 유효하지 않다", {
      field: "worldTurn",
    });

    expect(error.code).toBe("INVALID_STATE");
    expect(error.details).toEqual({ field: "worldTurn" });
  });
});
