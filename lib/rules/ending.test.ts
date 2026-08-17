import { describe, expect, it } from "vitest";
import type {
  CampaignDungeon,
  CampaignMember,
  CampaignState,
  DungeonId,
  MemberId,
  PartyId,
} from "@/lib/domain";
import { createFixtureCampaignState } from "@/lib/rules/fixtures";
import { resolveEnding } from "@/lib/rules/ending";

function member(id: string, trust: number, alive = true): CampaignMember {
  return {
    id: id as MemberId,
    name: id,
    classId: "warrior" as CampaignMember["classId"],
    personality: "prudent",
    currentHp: alive ? 60 : 0,
    maxHp: 100,
    trust,
    carriedGold: 20,
    alive,
    memory: [],
  };
}

function dungeon(index: number, status: CampaignDungeon["status"]): CampaignDungeon {
  return {
    id: `dungeon-${String(index).padStart(3, "0")}` as DungeonId,
    initialGrade: "C",
    grade: "C",
    sortOrder: index,
    status,
    failureCount: 0,
  };
}

/** 정산 직후 상태를 만든다. 필요한 필드만 갈아 끼운다. */
function stateAfterSettlement(overrides: Partial<CampaignState> = {}): CampaignState {
  const members = [member("member-001", 50), member("member-002", 50), member("member-003", 50)];
  return {
    ...createFixtureCampaignState("ending"),
    currentReputation: 100,
    members,
    parties: [{ id: "party-001" as PartyId, memberIds: members.map((m) => m.id), complete: true }],
    dungeons: [dungeon(1, "remaining"), dungeon(2, "remaining")],
    ...overrides,
  };
}

const SURVIVORS = ["member-001", "member-002"] as MemberId[];

describe("엔딩 우선순위", () => {
  it("이번 원정 생존자 전원의 신뢰가 0이면 불신의 대가다", () => {
    const state = stateAfterSettlement({
      members: [member("member-001", 0), member("member-002", 0), member("member-003", 50)],
    });

    expect(resolveEnding(state, SURVIVORS)?.id).toBe("distrust");
  });

  it("생존자 중 한 명이라도 신뢰가 남으면 불신의 대가가 아니다", () => {
    const state = stateAfterSettlement({
      members: [member("member-001", 0), member("member-002", 1), member("member-003", 50)],
    });

    expect(resolveEnding(state, SURVIVORS)).toBeNull();
  });

  it("전멸이라 생존자가 없으면 불신의 대가가 성립하지 않는다", () => {
    const state = stateAfterSettlement({
      members: [
        member("member-001", 0, false),
        member("member-002", 0, false),
        member("member-003", 0),
      ],
    });

    expect(resolveEnding(state, [])).toBeNull();
  });

  it("불신의 대가는 원정 종료보다 먼저 판정한다", () => {
    const state = stateAfterSettlement({
      members: [member("member-001", 0), member("member-002", 0), member("member-003", 0)],
      dungeons: [dungeon(1, "cleared"), dungeon(2, "cleared")],
    });

    expect(resolveEnding(state, SURVIVORS)?.id).toBe("distrust");
  });

  it("던전을 모두 클리어하면 원정 종료다", () => {
    const state = stateAfterSettlement({
      dungeons: [dungeon(1, "cleared"), dungeon(2, "cleared")],
    });

    expect(resolveEnding(state, SURVIVORS)?.id).toBe("expeditionComplete");
  });

  it("공고가 모두 명성에 막히면 길잡이 자격 박탈이다", () => {
    const state = stateAfterSettlement({ currentReputation: -40 });

    expect(resolveEnding(state, SURVIVORS)?.id).toBe("supportUnavailable");
  });

  it("완성 파티가 없으면 공고를 만들 수 없어 용사들의 시대가 끝난다", () => {
    const state = stateAfterSettlement({
      currentReputation: -10,
      parties: [{
        id: "party-001" as PartyId,
        memberIds: ["member-001" as MemberId],
        complete: false,
      }],
    });

    expect(resolveEnding(state, SURVIVORS)?.id).toBe("partyExhausted");
  });

  it("남은 던전이 있고 지원 가능한 공고가 있으면 엔딩이 없다", () => {
    expect(resolveEnding(stateAfterSettlement(), SURVIVORS)).toBeNull();
  });
});

describe("엔딩 기록", () => {
  it("사람이 읽을 수 있는 사유와 시점을 남긴다", () => {
    const state = stateAfterSettlement({
      dungeons: [dungeon(1, "cleared"), dungeon(2, "cleared")],
      log: [{ at: 0, summary: "이전 기록" }],
    });
    const ending = resolveEnding(state, SURVIVORS);

    expect(ending?.reason.trim()).not.toBe("");
    expect(ending?.at).toBe(state.log.length);
  });

  it("입력 상태를 바꾸지 않는다", () => {
    const state = stateAfterSettlement({ currentReputation: -10 });
    const snapshot = structuredClone(state);
    resolveEnding(state, SURVIVORS);

    expect(state).toEqual(snapshot);
  });
});
