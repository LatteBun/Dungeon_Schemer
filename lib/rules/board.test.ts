import { describe, expect, it } from "vitest";
import { GRADE_DEFS } from "@/lib/content/dungeons";
import type { CampaignParty, CampaignState, PartyId } from "@/lib/domain";
import {
  canAcceptOffer,
  createBoardEnding,
  generateBoard,
  MAX_BOARD_OFFERS,
} from "@/lib/rules/board";
import { initializeCampaign } from "@/lib/rules/campaign-init";

/**
 * 초기화 결과에서 정렬 키만 ID 순서로 고정한다. 게시판 규칙은 정렬 키를
 * 그대로 따르므로, 이렇게 두면 어떤 시드에서도 기대 순서를 적을 수 있다.
 */
function withIdOrderedDungeons(state: CampaignState): CampaignState {
  const byGrade = new Map<string, number>();
  return {
    ...state,
    dungeons: state.dungeons.map((dungeon) => {
      const next = byGrade.get(dungeon.grade) ?? 0;
      byGrade.set(dungeon.grade, next + 1);
      return { ...dungeon, sortOrder: next };
    }),
  };
}

function keepParties(state: CampaignState, count: number): CampaignState {
  return {
    ...state,
    parties: state.parties.slice(0, count),
  };
}

function stateWithAllDungeonsAndThreeParties(): CampaignState {
  return keepParties(withIdOrderedDungeons(initializeCampaign("board-001")), 3);
}

/**
 * 남은 던전이 모두 B급 이상인 상태를 만든다. C급은 지원 명성이 0이라
 * 남아 있으면 어떤 명성에서도 잠기지 않기 때문이다.
 */
function stateWithReputation(reputation: number): CampaignState {
  const state = withIdOrderedDungeons(initializeCampaign("board-002"));
  return {
    ...state,
    currentReputation: reputation,
    dungeons: state.dungeons.map((dungeon) =>
      dungeon.grade === "C" ? { ...dungeon, status: "cleared" as const } : dungeon,
    ),
  };
}

describe("게시판 생성", () => {
  it("남은 던전을 C부터 같은 등급의 seed 순서로 최대 5개 제시한다", () => {
    const board = generateBoard(stateWithAllDungeonsAndThreeParties());
    expect(board).toHaveLength(3);
    expect(board.map((offer) => offer.dungeonId)).toEqual([
      "dungeon-001",
      "dungeon-002",
      "dungeon-003",
    ]);
  });

  it("명성 부족 공고는 보이지만 잠기고, 공고가 모두 잠기면 지원 불가가 된다", () => {
    const state = stateWithReputation(0);
    const board = generateBoard(state);
    expect(board.some((offer) => offer.locked)).toBe(true);
    expect(createBoardEnding({ ...state, board })).toBe("supportUnavailable");
  });

  it("완성 파티가 넉넉하면 최대 5개까지만 만든다", () => {
    const board = generateBoard(withIdOrderedDungeons(initializeCampaign("board-max")));
    expect(board).toHaveLength(MAX_BOARD_OFFERS);
  });

  it("완성 파티가 1~4팀이면 그 수만큼만 만든다", () => {
    const base = withIdOrderedDungeons(initializeCampaign("board-count"));
    for (const count of [1, 2, 3, 4]) {
      expect(generateBoard(keepParties(base, count))).toHaveLength(count);
    }
  });

  it("완성 파티가 없으면 공고를 만들지 않는다", () => {
    const base = initializeCampaign("board-empty");
    const state: CampaignState = {
      ...base,
      parties: base.parties.map(
        (party): CampaignParty => ({ ...party, complete: false }),
      ),
    };
    expect(generateBoard(state)).toEqual([]);
  });

  it("남은 던전 수가 파티 수보다 적으면 던전 수만큼만 만든다", () => {
    const base = withIdOrderedDungeons(initializeCampaign("board-few"));
    const state: CampaignState = {
      ...base,
      dungeons: base.dungeons.map((dungeon, index) =>
        index < 2 ? dungeon : { ...dungeon, status: "cleared" as const },
      ),
    };
    expect(generateBoard(state)).toHaveLength(2);
  });

  it("한 공고에 던전과 파티가 중복 없이 하나씩 붙는다", () => {
    const board = generateBoard(withIdOrderedDungeons(initializeCampaign("board-pair")));
    const dungeonIds = board.map((offer) => offer.dungeonId);
    const partyIds = board.map((offer) => offer.partyId);
    const offerIds = board.map((offer) => offer.id);
    expect(new Set(dungeonIds).size).toBe(board.length);
    expect(new Set(partyIds).size).toBe(board.length);
    expect(new Set(offerIds).size).toBe(board.length);
  });

  it("같은 상태에서 몇 번을 다시 열어도 같은 게시판이 나온다", () => {
    const state = withIdOrderedDungeons(initializeCampaign("board-stable"));
    expect(generateBoard(state)).toEqual(generateBoard(state));
    expect(generateBoard(state)).toEqual(generateBoard(state));
  });

  it("공고의 보상과 지점 수가 던전 등급 상수를 따른다", () => {
    const state = withIdOrderedDungeons(initializeCampaign("board-reward"));
    const gradeById = new Map(
      state.dungeons.map((dungeon) => [dungeon.id, dungeon.grade]),
    );
    for (const offer of generateBoard(state)) {
      const grade = gradeById.get(offer.dungeonId);
      expect(grade).toBeDefined();
      if (grade === undefined) continue;
      const def = GRADE_DEFS[grade];
      expect(offer.requiredReputation).toBe(def.requiredReputation);
      expect(offer.baseReputationReward).toBe(def.baseReputationReward);
      expect(offer.baseGoldReward).toBe(def.baseGoldReward);
      expect(offer.nodeCount).toBe(def.nodeCount);
    }
  });

  it("명성이 오르면 잠겼던 공고가 열린다", () => {
    const locked = stateWithReputation(0);
    const opened = { ...locked, currentReputation: GRADE_DEFS.B.requiredReputation };
    expect(generateBoard(locked).every((offer) => offer.locked)).toBe(true);
    expect(generateBoard(opened).some((offer) => !offer.locked)).toBe(true);
  });
});

describe("공고 지원 자격", () => {
  it("명성이 모자라면 이유와 함께 거절한다", () => {
    const state = stateWithReputation(0);
    const [offer] = generateBoard(state);
    expect(canAcceptOffer(state, offer)).toEqual({
      accepted: false,
      reason: "insufficientReputation",
    });
  });

  it("명성이 충분하면 수락한다", () => {
    const state = withIdOrderedDungeons(initializeCampaign("accept-ok"));
    const [offer] = generateBoard(state);
    expect(canAcceptOffer(state, offer)).toEqual({ accepted: true });
  });
});

describe("게시판 엔딩 판정", () => {
  it("완성 파티가 없으면 파티 소진이다", () => {
    const base = initializeCampaign("ending-party");
    const state: CampaignState = {
      ...base,
      parties: base.parties.map(
        (party): CampaignParty => ({ ...party, complete: false }),
      ),
      board: [],
    };
    expect(createBoardEnding(state)).toBe("partyExhausted");
  });

  it("공고가 하나라도 열려 있으면 엔딩이 아니다", () => {
    const state = withIdOrderedDungeons(initializeCampaign("ending-open"));
    expect(createBoardEnding({ ...state, board: generateBoard(state) })).toBeNull();
  });

  it("남은 던전이 없으면 게시판 엔딩을 내지 않는다", () => {
    const base = initializeCampaign("ending-clear");
    const state: CampaignState = {
      ...base,
      dungeons: base.dungeons.map((dungeon) => ({
        ...dungeon,
        status: "cleared" as const,
      })),
      parties: base.parties.map(
        (party): CampaignParty => ({ ...party, complete: false }),
      ),
      board: [],
    };
    expect(createBoardEnding(state)).toBeNull();
  });

  it("파티 소진이 지원 불가보다 먼저 판정된다", () => {
    const locked = stateWithReputation(0);
    const board = generateBoard(locked);
    const state: CampaignState = {
      ...locked,
      board,
      parties: locked.parties.map(
        (party): CampaignParty => ({ ...party, complete: false }),
      ),
    };
    expect(createBoardEnding(state)).toBe("partyExhausted");
  });
});

describe("게시판이 소비하지 않는 것", () => {
  it("입력 상태를 변경하지 않는다", () => {
    const state = withIdOrderedDungeons(initializeCampaign("board-immutable"));
    const snapshot = structuredClone(state);
    generateBoard(state);
    createBoardEnding({ ...state, board: [] });
    canAcceptOffer(state, generateBoard(state)[0]);
    expect(state).toEqual(snapshot);
  });

  it("파티 ID는 캠페인에 있는 완성 파티만 가리킨다", () => {
    const state = withIdOrderedDungeons(initializeCampaign("board-party-id"));
    const complete = new Set(
      state.parties
        .filter((party) => party.complete)
        .map((party) => party.id as PartyId as string),
    );
    for (const offer of generateBoard(state)) {
      expect(complete.has(offer.partyId)).toBe(true);
    }
  });
});
