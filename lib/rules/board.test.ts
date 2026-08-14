import { describe, expect, it } from "vitest";
import type {
  BoardOffer,
  BoardOfferId,
  CampaignState,
  DungeonId,
  Grade,
  PartyId,
} from "@/lib/domain";
import { createFixtureCampaignState } from "@/lib/rules/fixtures";
import {
  canAcceptOffer,
  createBoardEnding,
  generateBoard,
} from "@/lib/rules/board";

function gradeAt(index: number): Grade {
  if (index < 6) return "C";
  if (index < 10) return "B";
  if (index < 13) return "A";
  return "S";
}

function stateWithBoardInputs(
  completePartyCount: number,
  currentReputation = 0,
): CampaignState {
  const base = createFixtureCampaignState("board-fixture");
  const dungeons = Array.from({ length: 15 }, (_, index) => {
    const grade = gradeAt(index);
    return {
      ...base.dungeons[0],
      id: `dungeon-${String(index + 1).padStart(3, "0")}` as DungeonId,
      initialGrade: grade,
      grade,
      sortOrder: index,
    };
  });
  const parties = Array.from({ length: completePartyCount }, (_, index) => ({
    id: `party-${String(index + 1).padStart(3, "0")}` as PartyId,
    memberIds: [...base.parties[0].memberIds],
    complete: true,
  }));

  return {
    ...base,
    currentReputation,
    dungeons,
    parties,
    board: [],
  };
}

function stateWithCungeonsCleared(
  completePartyCount: number,
  currentReputation = 0,
): CampaignState {
  const state = stateWithBoardInputs(completePartyCount, currentReputation);
  return {
    ...state,
    dungeons: state.dungeons.map((dungeon) =>
      dungeon.grade === "C" ? { ...dungeon, status: "cleared" } : dungeon,
    ),
  };
}

describe("게시판 생성 규칙", () => {
  it("남은 던전을 C부터 sortOrder 순으로 최대 5개 제시한다", () => {
    const state = stateWithBoardInputs(15);
    state.dungeons = [...state.dungeons].reverse();

    const board = generateBoard(state);

    expect(board).toHaveLength(5);
    expect(board.map((offer) => offer.dungeonId)).toEqual([
      "dungeon-001",
      "dungeon-002",
      "dungeon-003",
      "dungeon-004",
      "dungeon-005",
    ]);
    expect(new Set(board.map((offer) => offer.dungeonId)).size).toBe(5);
    expect(new Set(board.map((offer) => offer.partyId)).size).toBe(5);
  });

  it("완성 파티가 1~4팀이면 공고 수도 줄어든다", () => {
    expect(generateBoard(stateWithBoardInputs(1))).toHaveLength(1);
    expect(generateBoard(stateWithBoardInputs(4))).toHaveLength(4);
  });

  it("명성 부족 공고를 숨기지 않고 잠근다", () => {
    const board = generateBoard(stateWithCungeonsCleared(5, 0));
    const firstBOffer = board.find((offer) => offer.dungeonId === "dungeon-007");

    expect(firstBOffer).toMatchObject({
      requiredReputation: 30,
      locked: true,
      lockReason: "insufficientReputation",
    });
  });

  it("같은 상태에서 재생성해도 입력을 바꾸지 않고 같은 보드를 반환한다", () => {
    const state = stateWithBoardInputs(15);
    const before = structuredClone(state);

    const first = generateBoard(state);
    const second = generateBoard(state);

    expect(second).toEqual(first);
    expect(state).toEqual(before);
  });
});

describe("공고 지원 판정", () => {
  it("지원 가능한 공고는 수락하고 명성 부족 공고는 잠근다", () => {
    const availableState = stateWithBoardInputs(5, 0);
    const availableBoard = generateBoard(availableState);
    const stateWithAvailableBoard = { ...availableState, board: availableBoard };

    expect(canAcceptOffer(stateWithAvailableBoard, availableBoard[0])).toEqual({
      accepted: true,
    });

    const lockedState = stateWithCungeonsCleared(5, 0);
    const lockedBoard = generateBoard(lockedState);
    const stateWithLockedBoard = { ...lockedState, board: lockedBoard };

    expect(canAcceptOffer(stateWithLockedBoard, lockedBoard[0])).toEqual({
      accepted: false,
      reason: "insufficientReputation",
    });
  });

  it("stale 공고와 불완성 파티는 partyUnavailable로 거부한다", () => {
    const state = stateWithBoardInputs(5);
    const board = generateBoard(state);
    const stateWithBoard = { ...state, board };
    const staleOffer: BoardOffer = {
      ...board[0],
      id: "offer-stale" as BoardOfferId,
    };

    expect(canAcceptOffer(stateWithBoard, staleOffer)).toEqual({
      accepted: false,
      reason: "partyUnavailable",
    });

    const incompleteState: CampaignState = {
      ...stateWithBoard,
      parties: stateWithBoard.parties.map((party) =>
        party.id === board[0].partyId ? { ...party, complete: false } : party,
      ),
    };

    expect(canAcceptOffer(incompleteState, board[0])).toEqual({
      accepted: false,
      reason: "partyUnavailable",
    });
  });
});

describe("게시판 종료 후보", () => {
  it("완성 파티가 없으면 partyExhausted를 반환한다", () => {
    expect(createBoardEnding(stateWithBoardInputs(0))).toBe("partyExhausted");
  });

  it("모든 공고가 잠기면 supportUnavailable을 반환한다", () => {
    expect(createBoardEnding(stateWithCungeonsCleared(5, 0))).toBe(
      "supportUnavailable",
    );
  });

  it("남은 던전이 없으면 C1은 정상 완주 엔딩을 만들지 않는다", () => {
    const state = stateWithBoardInputs(5);
    const clearedState = {
      ...state,
      dungeons: state.dungeons.map((dungeon) => ({
        ...dungeon,
        status: "cleared" as const,
      })),
    };

    expect(createBoardEnding(clearedState)).toBeNull();
  });
});
