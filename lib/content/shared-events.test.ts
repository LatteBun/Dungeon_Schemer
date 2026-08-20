import { describe, expect, it } from "vitest";
import { SHARED_EVENTS } from "@/lib/content/shared-events";
import { validateSituationEvents } from "@/lib/content/situation-validation";

describe("SHARED_EVENTS", () => {
  it("휴식 사건이 5개다", () => {
    expect(SHARED_EVENTS.filter((event) => event.kind === "rest")).toHaveLength(5);
  });

  it("전부 공용이라 테마가 없다", () => {
    for (const event of SHARED_EVENTS) {
      expect(event.theme).toBeUndefined();
    }
  });

  it("묘사가 관찰할 사실을 담을 만큼 길다", () => {
    // 묘사가 짧으면 관찰할 사실을 담지 못한다. 추론의 근거가 여기에만 있다.
    for (const event of SHARED_EVENTS) {
      expect(event.description.length).toBeGreaterThanOrEqual(20);
    }
  });

  it("상인 사건이 5개다", () => {
    expect(SHARED_EVENTS.filter((event) => event.kind === "merchant")).toHaveLength(5);
  });

  it("특수 사건이 5개다", () => {
    expect(SHARED_EVENTS.filter((event) => event.kind === "special")).toHaveLength(5);
  });

  it("모두 15개다", () => {
    expect(SHARED_EVENTS).toHaveLength(15);
  });

  it("검증기를 통과한다", () => {
    expect(() => validateSituationEvents(SHARED_EVENTS)).not.toThrow();
  });
});
