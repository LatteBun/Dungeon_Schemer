import { describe, expect, it } from "vitest";
import { CLASSES, MEMBER_MAX_HP } from "@/lib/content/classes";
import {
  INITIAL_DUNGEON_COUNTS,
  TOTAL_DUNGEON_COUNT,
} from "@/lib/content/dungeons";
import { CAMPAIGN_PARTY_SIZE, GRADES, TRUST_MAX, TRUST_MIN } from "@/lib/domain";
import type { Grade } from "@/lib/domain";
import {
  CARRIED_GOLD_MAX,
  CARRIED_GOLD_MIN,
  COMPLETE_PARTY_COUNT,
  initializeCampaign,
  INITIAL_TRUST_BASE,
  INITIAL_TRUST_JITTER,
  RESERVE_MEMBER_COUNT,
} from "@/lib/rules/campaign-init";

const SEEDS = ["campaign-001", "campaign-002", "던전-캠페인", "seed-x"];

describe("캠페인 초기화", () => {
  it("같은 seed는 15개 던전·15팀·6예비를 같은 순서로 생성한다", () => {
    const first = initializeCampaign("campaign-001");
    const second = initializeCampaign("campaign-001");
    expect(second).toEqual(first);
    expect(first.dungeons).toHaveLength(15);
    expect(first.parties.filter((party) => party.complete)).toHaveLength(15);
    expect(first.reserveMemberIds).toHaveLength(6);
  });

  it("초기 캠페인 자원과 인물 골드 범위를 고정한다", () => {
    const state = initializeCampaign("campaign-002");
    expect([
      state.currentReputation,
      state.currentGold,
      state.cumulativeGold,
    ]).toEqual([0, 10, 0]);
    expect(
      state.members.every(
        (member) =>
          member.carriedGold >= CARRIED_GOLD_MIN &&
          member.carriedGold <= CARRIED_GOLD_MAX,
      ),
    ).toBe(true);
  });

  it("다른 seed는 던전 순서나 파티 구성이 달라진다", () => {
    const first = initializeCampaign("campaign-001");
    const second = initializeCampaign("campaign-002");
    const signature = (state: ReturnType<typeof initializeCampaign>) =>
      JSON.stringify([
        state.dungeons.map((dungeon) => dungeon.sortOrder),
        state.members.map((member) => [member.classId, member.personality]),
      ]);
    expect(signature(first)).not.toBe(signature(second));
  });

  it("게시판 없이 board 단계에서 시작하고 등급은 C다", () => {
    const state = initializeCampaign("start-check");
    expect(state.phase).toBe("board");
    expect(state.rank).toBe("C");
    expect(state.board).toEqual([]);
    expect(state.expedition).toBeNull();
    expect(state.ending).toBeNull();
    expect(state.waitingMemberIds).toEqual([]);
    expect(state.seed).toBe("start-check");
  });
});

describe("캠페인 초기 던전", () => {
  it("등급별 던전 수가 C6 B4 A3 S2다", () => {
    const { dungeons } = initializeCampaign("dungeon-count");
    for (const grade of GRADES) {
      const count = dungeons.filter((dungeon) => dungeon.grade === grade).length;
      expect(count, `${grade}급 던전 수`).toBe(INITIAL_DUNGEON_COUNTS[grade]);
    }
    expect(dungeons).toHaveLength(TOTAL_DUNGEON_COUNT);
  });

  it("던전 ID가 중복 없이 dungeon-001부터 순서대로다", () => {
    const { dungeons } = initializeCampaign("dungeon-id");
    const ids = dungeons.map((dungeon) => dungeon.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("dungeon-001");
    expect(ids.at(-1)).toBe("dungeon-015");
  });

  it("모든 던전이 남아 있고 초기 등급과 현재 등급이 같다", () => {
    const { dungeons } = initializeCampaign("dungeon-status");
    for (const dungeon of dungeons) {
      expect(dungeon.status).toBe("remaining");
      expect(dungeon.grade).toBe(dungeon.initialGrade);
      expect(dungeon.failureCount).toBe(0);
    }
  });

  it("같은 등급 안의 정렬 키가 0부터 중복 없이 채워진다", () => {
    const { dungeons } = initializeCampaign("dungeon-sort");
    for (const grade of GRADES) {
      const orders = dungeons
        .filter((dungeon) => dungeon.grade === grade)
        .map((dungeon) => dungeon.sortOrder)
        .sort((a, b) => a - b);
      const expected = Array.from(
        { length: INITIAL_DUNGEON_COUNTS[grade as Grade] },
        (_, index) => index,
      );
      expect(orders, `${grade}급 정렬 키`).toEqual(expected);
    }
  });
});

describe("캠페인 초기 인물과 파티", () => {
  it("완성 파티는 3인이고 직업·성격이 파티 안에서 겹치지 않는다", () => {
    for (const seed of SEEDS) {
      const state = initializeCampaign(seed);
      const memberById = new Map(
        state.members.map((member) => [member.id, member]),
      );

      for (const party of state.parties) {
        expect(party.memberIds).toHaveLength(CAMPAIGN_PARTY_SIZE);
        const members = party.memberIds.map((id) => memberById.get(id));
        expect(members.every((member) => member !== undefined)).toBe(true);
        const classIds = members.map((member) => member?.classId);
        const personalities = members.map((member) => member?.personality);
        expect(new Set(classIds).size).toBe(CAMPAIGN_PARTY_SIZE);
        expect(new Set(personalities).size).toBe(CAMPAIGN_PARTY_SIZE);
      }
    }
  });

  it("인물 수는 완성 파티 인원과 예비 인원의 합이다", () => {
    const state = initializeCampaign("member-count");
    expect(state.members).toHaveLength(
      COMPLETE_PARTY_COUNT * CAMPAIGN_PARTY_SIZE + RESERVE_MEMBER_COUNT,
    );
  });

  it("인물 ID와 이름이 캠페인 전체에서 겹치지 않는다", () => {
    const state = initializeCampaign("member-unique");
    const ids = state.members.map((member) => member.id);
    const names = state.members.map((member) => member.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it("예비 인원은 어떤 완성 파티에도 속하지 않는다", () => {
    const state = initializeCampaign("reserve-check");
    const assigned = new Set(
      state.parties.flatMap((party) => party.memberIds as string[]),
    );
    for (const id of state.reserveMemberIds) {
      expect(assigned.has(id)).toBe(false);
    }
    expect(state.reserveMemberIds).toHaveLength(RESERVE_MEMBER_COUNT);
  });

  it("모든 인물이 최대 HP로 살아서 시작한다", () => {
    const state = initializeCampaign("hp-check");
    for (const member of state.members) {
      expect(member.currentHp).toBe(MEMBER_MAX_HP);
      expect(member.maxHp).toBe(MEMBER_MAX_HP);
      expect(member.alive).toBe(true);
      expect(member.memory).toEqual([]);
    }
  });

  it("초기 신뢰는 성격별 기본값 ± 랜덤 폭 안이고 신뢰 척도 안이다", () => {
    for (const seed of SEEDS) {
      for (const member of initializeCampaign(seed).members) {
        const base = INITIAL_TRUST_BASE[member.personality];
        expect(member.trust).toBeGreaterThanOrEqual(base - INITIAL_TRUST_JITTER);
        expect(member.trust).toBeLessThanOrEqual(base + INITIAL_TRUST_JITTER);
        expect(member.trust).toBeGreaterThanOrEqual(TRUST_MIN);
        expect(member.trust).toBeLessThanOrEqual(TRUST_MAX);
      }
    }
  });

  it("모든 인물의 직업이 콘텐츠 풀 안에 있다", () => {
    const known = new Set(CLASSES.map((klass) => klass.id as string));
    for (const member of initializeCampaign("class-check").members) {
      expect(known.has(member.classId)).toBe(true);
    }
  });
});
