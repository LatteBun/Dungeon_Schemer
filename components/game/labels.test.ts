import { describe, expect, it } from "vitest";
import { EVENT_KINDS, PERSONALITIES, TRUTH_TYPES } from "@/lib/domain";
import { EVENT_KIND_LABELS, EVENT_KIND_MARKS, PERSONALITY_LABELS, TRUTH_TYPE_LABELS } from "@/components/game/labels";

describe("라벨이 모든 값을 덮는다", () => {
  it("빈 라벨이 없다", () => {
    const empty: string[] = [];
    for (const personality of PERSONALITIES) if (PERSONALITY_LABELS[personality] === "") empty.push(`personality ${personality}`);
    for (const kind of EVENT_KINDS) {
      if (EVENT_KIND_LABELS[kind] === "") empty.push(`kind ${kind}`);
      if (EVENT_KIND_MARKS[kind] === "") empty.push(`mark ${kind}`);
    }
    for (const truthType of TRUTH_TYPES) if (TRUTH_TYPE_LABELS[truthType] === "") empty.push(`truthType ${truthType}`);
    expect(empty, "빈 라벨").toEqual([]);
  });
  it("이벤트 분류 기호가 서로 다르다", () => {
    const marks = EVENT_KINDS.map((kind) => EVENT_KIND_MARKS[kind]);
    expect(new Set(marks).size, "겹치는 기호가 있다").toBe(marks.length);
  });
  it("이벤트 분류 라벨이 서로 다르다", () => {
    const labels = EVENT_KINDS.map((kind) => EVENT_KIND_LABELS[kind]);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
