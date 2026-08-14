import { describe, expect, it } from "vitest";
import { createF2TestSnapshot } from "@/app/f2-test/f2-test-snapshot";

describe("F2 검증 snapshot", () => {
  it("F1 fixture와 F2 콘텐츠 계약을 한 snapshot에 담는다", () => {
    const snapshot = createF2TestSnapshot("alpha");

    expect(snapshot.seed).toBe("alpha");
    expect(snapshot.f1.campaign.seed).toBe("alpha");
    expect(snapshot.f1.campaign.phase).toBe("board");
    expect(snapshot.f1.campaign.rank).toBe("C");
    expect(snapshot.f1.expedition.mapNodeCount).toBe(2);
    expect(snapshot.contentStatus).toBe("pass");
    expect(snapshot.events.total).toBe(12);
    expect(snapshot.events.byKind).toEqual({ monster: 3, rest: 3, merchant: 3, special: 3 });
    expect(snapshot.events.minimumChoices).toBeGreaterThanOrEqual(2);
    expect(snapshot.cards.total).toBe(12);
    expect(snapshot.cards.byTruthType).toEqual({ truth: 4, lie: 4, neutral: 4 });
    expect(snapshot.cards.bossSubjectCount).toBeGreaterThanOrEqual(2);
    expect(snapshot.items.kinds).toEqual(expect.arrayContaining(["healing", "poison", "food", "information", "lure"]));
    expect(snapshot.items.hasFakeMap).toBe(false);
    expect(snapshot.bosses.grades).toEqual(["C", "B", "A", "S"]);
    expect(snapshot.capacity.every((entry) => entry.pass)).toBe(true);
    expect(snapshot.negativeCases).toHaveLength(5);
    expect(snapshot.negativeCases.every((entry) => entry.pass && entry.errorCode === "INVALID_GENERATION")).toBe(true);
    expect(snapshot.reproducibility.sameSeed).toBe(true);
  });

  it("같은 seed의 F1 fixture 핵심 값이 재현된다", () => {
    const first = createF2TestSnapshot("repeat");
    const second = createF2TestSnapshot("repeat");
    expect(first.f1).toEqual(second.f1);
    expect(first.reproducibility).toEqual(second.reproducibility);
  });
});
