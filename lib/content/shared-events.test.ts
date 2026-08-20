import { describe, expect, it } from "vitest";
import { SHARED_EVENTS } from "@/lib/content/shared-events";

describe("SHARED_EVENTS", () => {
  it("휴식 사건이 5개다", () => {
    expect(SHARED_EVENTS.filter((event) => event.kind === "rest")).toHaveLength(5);
  });

  it("전부 공용이라 테마가 없다", () => {
    for (const event of SHARED_EVENTS) {
      expect(event.theme).toBeUndefined();
    }
  });

  it("묘사에 결론이 아니라 사실을 적는다", () => {
    // 묘사가 짧으면 관찰할 사실을 담지 못한다. 추론의 근거가 여기에만 있다.
    for (const event of SHARED_EVENTS) {
      expect(event.description.length).toBeGreaterThanOrEqual(20);
    }
  });

  it("상인 사건이 5개다", () => {
    expect(SHARED_EVENTS.filter((event) => event.kind === "merchant")).toHaveLength(5);
  });
});
