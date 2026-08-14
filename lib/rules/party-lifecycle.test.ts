import { describe, expect, it } from "vitest";
import { CLASSES } from "@/lib/content/classes";
import { CAMPAIGN_PARTY_SIZE, RuleError } from "@/lib/domain";
import type {
  CampaignMember,
  CampaignParty,
  CampaignState,
  ExpeditionResult,
  MemberId,
  PartyId,
  Personality,
} from "@/lib/domain";
import { createRng } from "@/lib/rng";
import type { Rng } from "@/lib/rng";
import {
  healNonParticipants,
  maintainPartiesAfterExpedition,
  regroupSurvivors,
} from "@/lib/rules/party-lifecycle";
import { createFixtureCampaignState } from "@/lib/rules/fixtures";

const asId = <T extends string>(value: string): T => value as T;

const CLASS_IDS = CLASSES.map((klass) => klass.id);

function rngFor(seed: string): Rng {
  return createRng(seed).derive("regroup");
}

/** 테스트에서 인물을 간단히 만든다. 제품 코드로 내보내지 않는다. */
function memberWithHp(
  currentHp: number,
  maxHp: number,
  overrides: Partial<CampaignMember> = {},
): CampaignMember {
  return {
    id: asId<MemberId>(`member-${currentHp}-${maxHp}`),
    name: "테스트 인물",
    classId: CLASS_IDS[0],
    personality: "prudent",
    currentHp,
    maxHp,
    trust: 50,
    carriedGold: 20,
    alive: currentHp > 0,
    memory: [],
    ...overrides,
  };
}

function member(
  id: string,
  classIndex: number,
  overrides: Partial<CampaignMember> = {},
): CampaignMember {
  const personalities: Personality[] = [
    "prudent",
    "righteous",
    "greedy",
    "impulsive",
    "suspicious",
  ];
  return memberWithHp(100, 100, {
    id: asId<MemberId>(id),
    name: id,
    classId: CLASS_IDS[classIndex % CLASS_IDS.length],
    personality: personalities[classIndex % personalities.length],
    ...overrides,
  });
}

function party(id: string, memberIds: string[]): CampaignParty {
  return {
    id: asId<PartyId>(id),
    memberIds: memberIds.map((value) => asId<MemberId>(value)),
    complete: memberIds.length === CAMPAIGN_PARTY_SIZE,
  };
}

/** 한 파티가 출전해 2명이 살아 돌아온 정산 결과다. */
const clearWithTwoSurvivors: ExpeditionResult = {
  status: "cleared",
  survivorIds: [asId<MemberId>("m-a2"), asId<MemberId>("m-a3")],
  casualtyIds: [asId<MemberId>("m-a1")],
  reason: "보스를 넘어섰다",
};

/** party-001이 출전한 상태. 예비는 파티와 직업이 겹치지 않는다. */
function baseState(overrides: Partial<CampaignState> = {}): CampaignState {
  const members = [
    member("m-a1", 0),
    member("m-a2", 1, { currentHp: 40 }),
    member("m-a3", 2, { currentHp: 60 }),
    member("m-r1", 3, { currentHp: 80 }),
    member("m-r2", 4, { currentHp: 90 }),
  ];

  return {
    ...createFixtureCampaignState("c2-fixture"),
    members,
    parties: [party("party-001", ["m-a1", "m-a2", "m-a3"])],
    reserveMemberIds: [asId<MemberId>("m-r1"), asId<MemberId>("m-r2")],
    waitingMemberIds: [],
    board: [],
    ...overrides,
  };
}

function partyOf(state: CampaignState, id: string): CampaignParty | undefined {
  return state.parties.find((candidate) => candidate.id === id);
}

function memberOf(state: CampaignState, id: string): CampaignMember | undefined {
  return state.members.find((candidate) => candidate.id === id);
}

/** 파티 안에 직업 중복이 없는지 본다. */
function uniqueClassIds(state: CampaignState, partyId: string): boolean {
  const target = partyOf(state, partyId);
  if (target === undefined) return false;
  const classIds = target.memberIds.map((id) => memberOf(state, id)?.classId);
  return new Set(classIds).size === target.memberIds.length;
}

describe("파티 유지와 충원", () => {
  it("3명 생존 팀은 유지하고 1~2명 생존 팀은 중복 직업 없는 예비로 채운다", () => {
    const state = baseState();
    const next = maintainPartiesAfterExpedition(
      state,
      clearWithTwoSurvivors,
      rngFor("keep"),
    );
    expect(partyOf(next, "party-001")?.memberIds).toHaveLength(3);
    expect(uniqueClassIds(next, "party-001")).toBe(true);
  });

  it("3명 모두 생존하면 구성이 그대로다", () => {
    const state = baseState();
    const allSurvive: ExpeditionResult = {
      status: "cleared",
      survivorIds: [
        asId<MemberId>("m-a1"),
        asId<MemberId>("m-a2"),
        asId<MemberId>("m-a3"),
      ],
      casualtyIds: [],
      reason: "전원 생존",
    };
    const next = maintainPartiesAfterExpedition(
      state,
      allSurvive,
      rngFor("all-survive"),
    );
    expect(partyOf(next, "party-001")?.memberIds).toEqual([
      "m-a1",
      "m-a2",
      "m-a3",
    ]);
    expect(next.reserveMemberIds).toEqual(["m-r1", "m-r2"]);
  });

  it("1명만 생존하면 예비 두 명으로 완성한다", () => {
    const state = baseState();
    const oneSurvivor: ExpeditionResult = {
      status: "cleared",
      survivorIds: [asId<MemberId>("m-a3")],
      casualtyIds: [asId<MemberId>("m-a1"), asId<MemberId>("m-a2")],
      reason: "혼자 살아남았다",
    };
    const next = maintainPartiesAfterExpedition(
      state,
      oneSurvivor,
      rngFor("one"),
    );
    expect(partyOf(next, "party-001")?.memberIds).toHaveLength(3);
    expect(partyOf(next, "party-001")?.complete).toBe(true);
    expect(uniqueClassIds(next, "party-001")).toBe(true);
  });

  it("충원에 쓰인 예비는 예비 명단에서 빠진다", () => {
    const state = baseState();
    const next = maintainPartiesAfterExpedition(
      state,
      clearWithTwoSurvivors,
      rngFor("reserve-used"),
    );
    expect(next.reserveMemberIds).toHaveLength(1);
    const used = partyOf(next, "party-001")?.memberIds.filter((id) =>
      id.startsWith("m-r"),
    );
    expect(used).toHaveLength(1);
    expect(next.reserveMemberIds).not.toContain(used?.[0]);
  });

  it("예비가 없고 재편으로도 완성할 수 없으면 생존자가 대기 명단으로 간다", () => {
    const state = baseState({ reserveMemberIds: [] });
    const next = maintainPartiesAfterExpedition(
      state,
      clearWithTwoSurvivors,
      rngFor("no-reserve"),
    );
    // 손상 파티는 재편 풀로 해체된다. 완성하지 못한 인원은 미완성 파티로
    // 남지 않고 대기 명단이 보관한다.
    expect(next.parties).toEqual([]);
    expect([...next.waitingMemberIds].sort()).toEqual(["m-a2", "m-a3"]);
  });

  it("충원에 쓰이지 않은 예비는 대기 명단이 아니라 예비로 남는다", () => {
    const state = baseState();
    const next = maintainPartiesAfterExpedition(
      state,
      clearWithTwoSurvivors,
      rngFor("reserve-stays"),
    );
    expect(next.reserveMemberIds).toHaveLength(1);
    expect(next.waitingMemberIds).toEqual([]);
  });

  it("사망자는 alive가 꺼지고 어떤 파티에도 남지 않는다", () => {
    const state = baseState();
    const next = maintainPartiesAfterExpedition(
      state,
      clearWithTwoSurvivors,
      rngFor("dead"),
    );
    expect(memberOf(next, "m-a1")?.alive).toBe(false);
    const assigned = next.parties.flatMap((item) => item.memberIds as string[]);
    expect(assigned).not.toContain("m-a1");
    expect(next.waitingMemberIds).not.toContain("m-a1");
  });
});

describe("자동 재편", () => {
  it("예비로 완성할 수 없으면 손상 파티 생존자를 모아 다시 짠다", () => {
    // 손상 파티 셋에 생존자가 둘씩. 예비는 없다.
    const members = [
      member("s1", 0),
      member("s2", 1),
      member("s3", 2),
      member("s4", 3),
      member("s5", 4),
      member("s6", 0),
    ];
    const parties = regroupSurvivors(
      members.map((item) => item.id),
      members,
      rngFor("regroup"),
    );
    expect(parties).toHaveLength(2);
    for (const item of parties) {
      expect(item.memberIds).toHaveLength(CAMPAIGN_PARTY_SIZE);
      const classIds = item.memberIds.map(
        (id) => members.find((m) => m.id === id)?.classId,
      );
      expect(new Set(classIds).size).toBe(CAMPAIGN_PARTY_SIZE);
    }
  });

  it("직업이 한쪽으로 쏠리면 만들 수 있는 최대 파티 수만 만든다", () => {
    // 전사 4·궁수 1·성직자 1. k=2는 min(4,2)+1+1 = 4 < 6 이라 불가능하고
    // k=1은 1+1+1 = 3 >= 3 이라 가능하다. 한 팀을 짜면 전사만 셋 남는다.
    const members = [
      member("w1", 0),
      member("w2", 0),
      member("w3", 0),
      member("w4", 0),
      member("a1", 1),
      member("c1", 2),
    ];
    const parties = regroupSurvivors(
      members.map((item) => item.id),
      members,
      rngFor("skew"),
    );
    expect(parties).toHaveLength(1);
    const classIds = parties[0].memberIds.map(
      (id) => members.find((m) => m.id === id)?.classId,
    );
    expect(new Set(classIds).size).toBe(CAMPAIGN_PARTY_SIZE);
  });

  it("완성 파티를 하나도 만들 수 없으면 빈 결과를 낸다", () => {
    const members = [member("w1", 0), member("w2", 0)];
    expect(
      regroupSurvivors(
        members.map((item) => item.id),
        members,
        rngFor("none"),
      ),
    ).toEqual([]);
  });

  it("같은 입력과 시드는 같은 재편 결과를 만든다", () => {
    const members = [
      member("s1", 0),
      member("s2", 1),
      member("s3", 2),
      member("s4", 3),
      member("s5", 4),
      member("s6", 0),
    ];
    const ids = members.map((item) => item.id);
    expect(regroupSurvivors(ids, members, rngFor("same"))).toEqual(
      regroupSurvivors(ids, members, rngFor("same")),
    );
  });

  it("완성 파티에 못 들어간 생존자는 대기 명단에 남는다", () => {
    const members = [
      member("s1", 0),
      member("s2", 1),
      member("s3", 2),
      member("s4", 0),
    ];
    const state = baseState({
      members,
      parties: [party("party-001", ["s1", "s2"]), party("party-002", ["s3", "s4"])],
      reserveMemberIds: [],
    });
    const result: ExpeditionResult = {
      status: "cleared",
      survivorIds: [asId<MemberId>("s1"), asId<MemberId>("s2")],
      casualtyIds: [],
      reason: "복귀",
    };
    const next = maintainPartiesAfterExpedition(state, result, rngFor("waiting"));
    const assigned = new Set(
      next.parties.flatMap((item) => item.memberIds as string[]),
    );
    const leftovers = members
      .map((item) => item.id as string)
      .filter((id) => !assigned.has(id));
    expect(next.waitingMemberIds.sort()).toEqual(leftovers.sort());
  });
});

describe("개인 상태 보존", () => {
  it("재편 전후로 HP·신뢰·골드·기억·직업·성격이 그대로다", () => {
    const state = baseState();
    const before = new Map(
      state.members.map((item) => [
        item.id as string,
        {
          currentHp: item.currentHp,
          trust: item.trust,
          carriedGold: item.carriedGold,
          classId: item.classId,
          personality: item.personality,
          memory: item.memory,
        },
      ]),
    );
    const next = maintainPartiesAfterExpedition(
      state,
      clearWithTwoSurvivors,
      rngFor("preserve"),
    );

    for (const item of next.members) {
      const snapshot = before.get(item.id);
      expect(snapshot).toBeDefined();
      if (snapshot === undefined) continue;
      expect(item.trust).toBe(snapshot.trust);
      expect(item.carriedGold).toBe(snapshot.carriedGold);
      expect(item.classId).toBe(snapshot.classId);
      expect(item.personality).toBe(snapshot.personality);
      expect(item.memory).toEqual(snapshot.memory);
    }
  });
});

describe("비출전 회복", () => {
  it("비출전 생존자는 현재 HP의 5%를 반올림하고 최소 1만큼 회복한다", () => {
    const members = healNonParticipants(
      [memberWithHp(19, 100), memberWithHp(1, 100)],
      new Set(),
    );
    expect(members.map((item) => item.currentHp)).toEqual([20, 2]);
  });

  it("출전자는 회복하지 않는다", () => {
    const fighter = memberWithHp(40, 100, { id: asId<MemberId>("fighter") });
    const resting = memberWithHp(40, 100, { id: asId<MemberId>("resting") });
    const healed = healNonParticipants(
      [fighter, resting],
      new Set([asId<MemberId>("fighter")]),
    );
    expect(healed[0].currentHp).toBe(40);
    expect(healed[1].currentHp).toBe(42);
  });

  it("회복은 최대 HP를 넘지 않는다", () => {
    const healed = healNonParticipants(
      [memberWithHp(99, 100), memberWithHp(100, 100)],
      new Set(),
    );
    expect(healed.map((item) => item.currentHp)).toEqual([100, 100]);
  });

  it("죽은 인물은 회복하지 않는다", () => {
    const dead = memberWithHp(0, 100, {
      id: asId<MemberId>("dead"),
      alive: false,
    });
    expect(healNonParticipants([dead], new Set())[0].currentHp).toBe(0);
  });

  it("대기 인물과 예비 인원도 회복한다", () => {
    const state = baseState();
    const next = maintainPartiesAfterExpedition(
      state,
      clearWithTwoSurvivors,
      rngFor("heal-reserve"),
    );
    // m-r2는 충원에 쓰이지 않았거나 쓰였더라도 출전자가 아니므로 회복한다.
    expect(memberOf(next, "m-r2")?.currentHp).toBe(95);
    // 출전 생존자는 회복하지 않는다.
    expect(memberOf(next, "m-a2")?.currentHp).toBe(40);
    expect(memberOf(next, "m-a3")?.currentHp).toBe(60);
  });
});

describe("오류와 불변성", () => {
  it("캠페인에 없는 인물 ID를 거부한다", () => {
    const state = baseState();
    const unknown: ExpeditionResult = {
      status: "cleared",
      survivorIds: [asId<MemberId>("ghost")],
      casualtyIds: [],
      reason: "알 수 없는 인물",
    };
    expect(() =>
      maintainPartiesAfterExpedition(state, unknown, rngFor("unknown")),
    ).toThrow(RuleError);
  });

  it("생존자와 사망자에 같은 ID가 있으면 거부한다", () => {
    const state = baseState();
    const duplicated: ExpeditionResult = {
      status: "cleared",
      survivorIds: [asId<MemberId>("m-a2")],
      casualtyIds: [asId<MemberId>("m-a2")],
      reason: "중복 보고",
    };
    expect(() =>
      maintainPartiesAfterExpedition(state, duplicated, rngFor("dup")),
    ).toThrow(RuleError);
  });

  it("이미 죽은 인물이 생존자로 오면 거부한다", () => {
    const state = baseState();
    const withDead: CampaignState = {
      ...state,
      members: state.members.map((item) =>
        item.id === "m-a2" ? { ...item, alive: false } : item,
      ),
    };
    expect(() =>
      maintainPartiesAfterExpedition(
        withDead,
        clearWithTwoSurvivors,
        rngFor("already-dead"),
      ),
    ).toThrow(RuleError);
  });

  it("어떤 파티에도 속하지 않은 인물의 출전을 거부한다", () => {
    const state = baseState({
      parties: [party("party-001", ["m-a1", "m-a2"])],
    });
    expect(() =>
      maintainPartiesAfterExpedition(
        state,
        clearWithTwoSurvivors,
        rngFor("orphan"),
      ),
    ).toThrow(RuleError);
  });

  it("거부된 호출은 입력 상태를 바꾸지 않는다", () => {
    const state = baseState();
    const snapshot = structuredClone(state);
    const unknown: ExpeditionResult = {
      status: "cleared",
      survivorIds: [asId<MemberId>("ghost")],
      casualtyIds: [],
      reason: "알 수 없는 인물",
    };
    expect(() =>
      maintainPartiesAfterExpedition(state, unknown, rngFor("immutable-fail")),
    ).toThrow();
    expect(state).toEqual(snapshot);
  });

  it("성공한 호출도 입력 상태와 결과를 바꾸지 않는다", () => {
    const state = baseState();
    const stateSnapshot = structuredClone(state);
    const resultSnapshot = structuredClone(clearWithTwoSurvivors);
    maintainPartiesAfterExpedition(
      state,
      clearWithTwoSurvivors,
      rngFor("immutable-ok"),
    );
    expect(state).toEqual(stateSnapshot);
    expect(clearWithTwoSurvivors).toEqual(resultSnapshot);
  });
});
