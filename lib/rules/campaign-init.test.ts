import { describe, expect, it } from "vitest";
import { GRADES } from "@/lib/domain";
import {
  INITIAL_MEMBER_GOLD_MAX,
  INITIAL_MEMBER_GOLD_MIN,
  initializeCampaign,
} from "@/lib/rules/campaign-init";
import { emptyStatistics } from "@/lib/rules/statistics";

describe("캠페인 초기화", () => {
  it("같은 seed는 전체 초기 캠페인을 재현한다", () => {
    const first = initializeCampaign("campaign-001");
    const second = initializeCampaign("campaign-001");

    expect(second).toEqual(first);
    expect(first.dungeons).toHaveLength(15);
    expect(first.parties).toHaveLength(15);
    expect(first.parties.filter((party) => party.complete)).toHaveLength(15);
    expect(first.reserveMemberIds).toHaveLength(6);
    expect(first.board).toHaveLength(5);
  });

  it("초기 등급·자원·개인 상태 불변식을 지킨다", () => {
    const state = initializeCampaign("campaign-002");
    const gradeCounts = Object.fromEntries(
      GRADES.map((grade) => [
        grade,
        state.dungeons.filter((dungeon) => dungeon.grade === grade).length,
      ]),
    );

    expect(gradeCounts).toEqual({ C: 6, B: 4, A: 3, S: 2 });
    expect(state.dungeons.every((dungeon) =>
      dungeon.initialGrade === dungeon.grade
      && dungeon.status === "remaining"
      && dungeon.failureCount === 0,
    )).toBe(true);
    expect(state).toMatchObject({
      phase: "board",
      rank: "C",
      currentReputation: 0,
      currentGold: 10,
      cumulativeGold: 0,
      waitingMemberIds: [],
      expedition: null,
      ending: null,
      log: [],
      statistics: emptyStatistics(),
    });
    expect(state.members).toHaveLength(51);
    expect(state.members.every((member) =>
      member.currentHp === 100
      && member.maxHp === 100
      && member.alive
      && member.trust >= 0
      && member.trust <= 100
      && member.carriedGold >= INITIAL_MEMBER_GOLD_MIN
      && member.carriedGold <= INITIAL_MEMBER_GOLD_MAX
      && member.memory.length === 0,
    )).toBe(true);
  });

  it("파티 내부 직업·성격과 전체 ID를 중복하지 않는다", () => {
    const state = initializeCampaign("campaign-003");
    const members = new Map(state.members.map((member) => [member.id, member]));
    const partyMemberIds = new Set(state.parties.flatMap((party) => party.memberIds));

    expect(new Set(state.dungeons.map((dungeon) => dungeon.id)).size).toBe(15);
    expect(new Set(state.members.map((member) => member.id)).size).toBe(51);
    expect(new Set(state.parties.map((party) => party.id)).size).toBe(15);
    expect(state.parties.every((party) => party.complete && party.memberIds.length === 3)).toBe(true);
    for (const party of state.parties) {
      const partyMembers = party.memberIds.map((id) => members.get(id));
      expect(partyMembers.every((member) => member !== undefined)).toBe(true);
      expect(new Set(partyMembers.map((member) => member?.classId)).size).toBe(3);
      expect(new Set(partyMembers.map((member) => member?.personality)).size).toBe(3);
    }
    expect(state.reserveMemberIds.every((id) => !partyMemberIds.has(id))).toBe(true);
  });

  it("다른 seed는 초기 상태를 바꾼다", () => {
    expect(initializeCampaign("campaign-001")).not.toEqual(
      initializeCampaign("campaign-002"),
    );
  });

  it("반환 상태의 중첩 배열 변경이 다음 초기화에 영향을 주지 않는다", () => {
    const first = initializeCampaign("campaign-isolated");
    first.members[0].memory.push({ at: 1, kind: "info", summary: "test" });
    first.parties[0].memberIds.pop();
    first.board.pop();

    const second = initializeCampaign("campaign-isolated");
    expect(second.members[0].memory).toEqual([]);
    expect(second.parties[0].memberIds).toHaveLength(3);
    expect(second.board).toHaveLength(5);
  });
});
