import { describe, expect, it } from "vitest";
import { createIntegrationSnapshot } from "./integration-test-snapshot";

describe("F1·F2·C1 통합 snapshot", () => {
  it("같은 seed로 세 트랙 결과를 재현한다", () => {
    const first = createIntegrationSnapshot("integration-seed");
    const second = createIntegrationSnapshot("integration-seed");

    expect(second).toEqual(first);
    expect(first.f1.campaign.phase).toBe("board");
    expect(first.f2.contentStatus).toBe("pass");
    expect(first.c1.phase).toBe("board");
    expect(first.c1.reproducible).toBe(true);
  });

  it("F1·F2·C1 핵심 수량과 초기 게시판 지원 가능 상태를 표시한다", () => {
    const snapshot = createIntegrationSnapshot("integration-counts");

    expect(snapshot.f1.campaign.dungeonCount).toBeGreaterThan(0);
    expect(snapshot.f2.events.total).toBe(12);
    expect(snapshot.f2.cards.total).toBe(36);
    expect(snapshot.c1).toMatchObject({
      phase: "board",
      rank: "C",
      currentReputation: 0,
      currentGold: 10,
      dungeonCount: 15,
      partyCount: 15,
      completePartyCount: 15,
      memberCount: 51,
      reserveMemberCount: 6,
    });
    expect(snapshot.c1.dungeonCounts).toEqual({ C: 6, B: 4, A: 3, S: 2 });
    expect(snapshot.c1.board).toHaveLength(5);
    expect(snapshot.c1.board.every((offer) => offer.dungeonGrade === "C")).toBe(true);
    expect(snapshot.c1.board.every((offer) =>
      offer.requiredReputation === 0
      && !offer.locked
      && offer.lockReason === null,
    )).toBe(true);
  });

  it("다른 seed는 C1 결과를 바꾼다", () => {
    const first = createIntegrationSnapshot("integration-a");
    const second = createIntegrationSnapshot("integration-b");

    expect(second.c1).not.toEqual(first.c1);
  });
});
