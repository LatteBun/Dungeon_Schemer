import { describe, expect, it } from "vitest";
import { EVENT_KINDS } from "@/lib/domain";
import {
  createFixtureCampaignState,
  createFixtureExpeditionState,
} from "@/lib/rules/fixtures";
import type {
  BoardOfferId,
  CampaignState,
  DungeonId,
} from "@/lib/domain";
import {
  toBoardView,
  toCampaignHeaderView,
  toContractView,
  toOfferRiskView,
  toScreenTitle,
} from "./campaign-view-model";

// createFixtureCampaignState: 등급 C, 명성 0, 던전 1개(dungeon-001),
// 완성 파티 1개(party-001, member-001~003), 공고 1개(offer-001, 잠금 없음).

function lockedState(): CampaignState {
  const base = createFixtureCampaignState();
  const dungeon = { ...base.dungeons[0], grade: "B" as const, id: "dungeon-007" as DungeonId };
  const offer = {
    ...base.board[0],
    dungeonId: dungeon.id,
    requiredReputation: 30,
    baseReputationReward: 15,
    baseGoldReward: 35,
    nodeCount: 9,
    locked: true,
    lockReason: "insufficientReputation" as const,
  };
  return {
    ...base,
    currentReputation: 10,
    dungeons: [dungeon],
    board: [offer],
  };
}

describe("toCampaignHeaderView", () => {
  it("점수·다음 등급·남은 던전을 파생한다", () => {
    const base = createFixtureCampaignState();
    const state: CampaignState = {
      ...base,
      rank: "B",
      currentReputation: 38,
      cumulativeGold: 60,
    };
    const view = toCampaignHeaderView(state);
    expect(view.promotionScore).toBe(136);
    expect(view.nextGrade).toEqual({ grade: "A", threshold: 261 });
    expect(view.remainingDungeons).toBe(1);
    expect(view.totalDungeons).toBe(1);
  });

  it("S 등급이면 다음 등급이 null이다", () => {
    const state = { ...createFixtureCampaignState(), rank: "S" as const };
    expect(toCampaignHeaderView(state).nextGrade).toBeNull();
  });
});

describe("toBoardView", () => {
  it("던전·파티를 조인하고 평균 신뢰와 생존 수를 계산한다", () => {
    const view = toBoardView(createFixtureCampaignState(), new Map());
    expect(view).toHaveLength(1);
    expect(view[0].dungeonLabel).toBe("C급 1번");
    expect(view[0].partyLabel).toBe("1팀");
    expect(view[0].survivorCount).toBe(3);
    expect(view[0].averageTrust).toBe(50);
    expect(view[0].locked).toBe(false);
    expect(view[0].shortfall).toBeNull();
  });

  it("잠긴 공고는 부족 명성을 계산한다", () => {
    const view = toBoardView(lockedState(), new Map());
    expect(view[0].locked).toBe(true);
    expect(view[0].dungeonLabel).toBe("B급 7번");
    expect(view[0].shortfall).toBe(20);
  });
});

describe("toContractView", () => {
  it("파티원 상세를 조인하고 계약 가능 여부를 표시한다", () => {
    const state = createFixtureCampaignState();
    const view = toContractView(state, state.board[0].id, null);
    expect(view).not.toBeNull();
    expect(view?.branchCount).toBe(2);
    expect(view?.bossRevealed).toBe(true);
    expect(view?.members).toHaveLength(3);
    expect(view?.members[0].name).toBe("라스");
    expect(view?.members[0].memorySummary).toBe("최근 변화 없음");
    expect(view?.acceptable).toBe(true);
  });

  it("빈 memory는 최근 변화 없음으로 표시한다", () => {
    const state = createFixtureCampaignState();
    const withMemory: CampaignState = {
      ...state,
      members: state.members.map((member, index) =>
        index === 0
          ? { ...member, memory: [{ at: 1, kind: "settlement" as const, summary: "신뢰가 올랐다" }] }
          : member,
      ),
    };
    const view = toContractView(withMemory, withMemory.board[0].id, null);
    expect(view?.members[0].memorySummary).toBe("신뢰가 올랐다");
  });

  it("없는 공고 id는 null을 돌려준다", () => {
    const state = createFixtureCampaignState();
    expect(
      toContractView(state, "no-such-offer" as BoardOfferId, null),
    ).toBeNull();
  });
});

function stateWithExpedition(phase: CampaignState["phase"]): CampaignState {
  return {
    ...createFixtureCampaignState(),
    phase,
    expedition: createFixtureExpeditionState(),
  };
}

describe("toScreenTitle", () => {
  it("게시판과 계약 단계는 같은 제목을 쓴다", () => {
    const base = createFixtureCampaignState();
    expect(toScreenTitle({ ...base, phase: "board" })).toBe("캠페인 게시판");
    expect(toScreenTitle({ ...base, phase: "contract" })).toBe("캠페인 게시판");
  });

  it("엔딩 단계는 고정 제목을 쓴다", () => {
    const base = createFixtureCampaignState();
    expect(toScreenTitle({ ...base, phase: "ended" })).toBe("캠페인 엔딩");
  });

  it("지도 단계는 던전 이름을 앞에 붙인다", () => {
    expect(toScreenTitle(stateWithExpedition("map"))).toBe(
      "C급 1번 · 공개 분기 지도",
    );
  });

  it("단계마다 다른 제목을 낸다", () => {
    const titles = (
      ["map", "infoOpportunity", "event", "boss"] as const
    ).map((phase) => toScreenTitle(stateWithExpedition(phase)));
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("보스와 정산은 같은 제목을 쓴다", () => {
    expect(toScreenTitle(stateWithExpedition("boss"))).toBe(
      toScreenTitle(stateWithExpedition("settlement")),
    );
  });

  it("탐험이 없으면 던전 이름 없이도 문장이 성립한다", () => {
    const base = createFixtureCampaignState();
    expect(toScreenTitle({ ...base, phase: "map" })).toBe("공개 분기 지도");
  });
});

describe("toOfferRiskView", () => {
  const summary = {
    counts: { monster: 2, rest: 2, special: 2 },
    bossCount: 1,
  } as const;

  it("모든 분류를 항상 같은 순서로 낸다", () => {
    const view = toOfferRiskView(summary);
    expect(view.kinds.map((entry) => entry.kind)).toEqual([...EVENT_KINDS]);
  });

  it("기호와 분류명을 함께 담는다", () => {
    const view = toOfferRiskView(summary);
    const monster = view.kinds[0];
    expect(monster.mark).toBe("◆");
    expect(monster.label).toBe("몬스터");
    expect(monster.count).toBe(2);
  });

  it("보스 수를 분류와 섞지 않는다", () => {
    const view = toOfferRiskView(summary);
    expect(view.bossCount).toBe(1);
    expect(view.kinds).toHaveLength(EVENT_KINDS.length);
  });
});
