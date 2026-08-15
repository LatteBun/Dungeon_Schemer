import { describe, expect, it } from "vitest";
import { BOSSES } from "@/lib/content/bosses";
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
import { INFO_CARDS } from "@/lib/content/info-cards";
import { ITEMS } from "@/lib/content/items";
import { RuleError } from "@/lib/domain";
import type {
  BoardOfferId,
  CampaignState,
  CardId,
  ChoiceId,
  NodeId,
} from "@/lib/domain";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { generateBoard } from "@/lib/rules/board";
import {
  affordableChoiceIds,
  createCampaignMachineContext,
  transitionCampaign,
  transitionCampaignDetailed,
} from "@/lib/flow/campaign-machine";
import type { CampaignAction } from "@/lib/flow/campaign-machine";

const CONTEXT = createCampaignMachineContext({
  events: DUNGEON_EVENT_POOLS,
  cards: INFO_CARDS,
  items: ITEMS,
  bosses: BOSSES,
});

function boardState(seed = "머신"): CampaignState {
  const state = initializeCampaign(seed);
  return { ...state, board: generateBoard(state) };
}

function apply(state: CampaignState, action: CampaignAction): CampaignState {
  return transitionCampaign(state, action, CONTEXT);
}

function firstOpenOffer(state: CampaignState): BoardOfferId {
  const offer = state.board.find((entry) => !entry.locked);
  if (offer === undefined) throw new Error("지원 가능한 공고가 없다.");
  return offer.id;
}

function ruleErrorOf(call: () => unknown): RuleError {
  let caught: unknown;
  try {
    call();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(RuleError);
  return caught as RuleError;
}

/** 현재 지점에서 갈 수 있는 다음 지점 중 첫 번째. */
function nextNode(state: CampaignState): NodeId {
  const expedition = state.expedition!;
  const current = expedition.map.nodes.find(
    (node) => node.id === expedition.currentNodeId,
  )!;
  return current.nextNodeIds[0];
}

/** 현재 지점의 정보·사건을 처리해 지도 단계까지 나아간다. */
function advanceToMap(start: CampaignState): CampaignState {
  let state = start;
  if (state.phase === "infoOpportunity") {
    state = apply(state, {
      type: "chooseInfoCard",
      cardId: state.expedition!.pendingInfo!.cardIds[0],
    });
  }
  if (state.phase === "event") {
    state = apply(state, {
      type: "chooseEvent",
      choiceId: affordableChoiceIds(state, CONTEXT)[0],
    });
  }
  return state;
}

/** 정보 기회가 있는 지점에 닿을 때까지 진행한다. */
function advanceToInfo(start: CampaignState): CampaignState {
  let state = apply(start, { type: "acceptContract", offerId: firstOpenOffer(start) });
  let guard = 0;
  while (state.phase !== "infoOpportunity" && guard < 100) {
    guard += 1;
    if (state.phase === "map") {
      state = apply(state, { type: "selectNode", nodeId: nextNode(state) });
    } else if (state.phase === "event") {
      state = apply(state, {
        type: "chooseEvent",
        choiceId: affordableChoiceIds(state, CONTEXT)[0],
      });
    } else {
      break;
    }
  }
  expect(state.phase).toBe("infoOpportunity");
  return state;
}

/**
 * 한 원정을 끝까지 진행한다. 매 선택마다 첫 후보를 고른다.
 * 전략 비교는 백테스트가 하고, 여기서는 흐름이 이어지는지만 본다.
 */
function runExpedition(start: CampaignState): CampaignState {
  let state = apply(start, { type: "acceptContract", offerId: firstOpenOffer(start) });
  let guard = 0;

  while (state.phase !== "settlement" && guard < 100) {
    guard += 1;
    if (state.phase === "map") {
      state = apply(state, { type: "selectNode", nodeId: nextNode(state) });
    } else if (state.phase === "infoOpportunity") {
      state = apply(state, {
        type: "chooseInfoCard",
        cardId: state.expedition!.pendingInfo!.cardIds[0],
      });
    } else if (state.phase === "event") {
      state = apply(state, {
        type: "chooseEvent",
        choiceId: affordableChoiceIds(state, CONTEXT)[0],
      });
    } else if (state.phase === "boss") {
      state = apply(state, { type: "resolveBoss" });
    } else {
      break;
    }
  }

  expect(guard).toBeLessThan(100);
  return apply(state, { type: "applySettlement" });
}

describe("허용된 전이", () => {
  // 입구도 다른 지점과 똑같이 도착 처리를 한다. E1이 입구를 일반 사건 지점으로
  // 세었으므로 건너뛰면 C급 경로가 지나는 사건이 4개가 아니라 3개가 된다.
  it("계약을 수락하면 입구에 도착해 그 지점의 사건을 만난다", () => {
    const state = boardState();
    const next = apply(state, { type: "acceptContract", offerId: firstOpenOffer(state) });
    const entry = next.expedition!.map.nodes.find(
      (node) => node.id === next.expedition!.map.entryNodeId,
    )!;

    expect(next.expedition).not.toBeNull();
    expect(next.expedition?.currentNodeId).toBe(next.expedition?.map.entryNodeId);
    expect(next.phase).toBe(entry.hasInfoOpportunity ? "infoOpportunity" : "event");
    expect(next.expedition?.visitedNodeIds).toEqual([entry.id]);
  });

  it("한 경로에서 등급이 요구하는 만큼 사건을 지난다", () => {
    const state = boardState("경로");
    const started = apply(state, { type: "acceptContract", offerId: firstOpenOffer(state) });
    const expected = started.expedition!.map.paths[0].regularEventCount;
    let current = started;
    let events = 0;
    let guard = 0;

    while (current.phase !== "boss" && guard < 100) {
      guard += 1;
      if (current.phase === "map") {
        current = apply(current, { type: "selectNode", nodeId: nextNode(current) });
      } else if (current.phase === "infoOpportunity") {
        current = apply(current, {
          type: "chooseInfoCard",
          cardId: current.expedition!.pendingInfo!.cardIds[0],
        });
      } else if (current.phase === "event") {
        events += 1;
        current = apply(current, {
          type: "chooseEvent",
          choiceId: affordableChoiceIds(current, CONTEXT)[0],
        });
      } else {
        break;
      }
    }

    expect(events).toBe(expected);
  });

  it("게시판 열기는 공고를 다시 만들되 같은 시드면 같은 결과다", () => {
    const state = boardState();
    const next = apply(state, { type: "openBoard" });

    expect(next.phase).toBe("board");
    expect(next.board).toEqual(state.board);
  });

  it("지점을 고르면 정보 기회 여부에 따라 단계가 갈린다", () => {
    const state = boardState();
    const started = apply(state, { type: "acceptContract", offerId: firstOpenOffer(state) });
    const atMap = advanceToMap(started);
    const moved = apply(atMap, { type: "selectNode", nodeId: nextNode(atMap) });
    const node = moved.expedition!.map.nodes.find(
      (entry) => entry.id === moved.expedition!.currentNodeId,
    )!;

    expect(moved.phase).toBe(node.hasInfoOpportunity ? "infoOpportunity" : "event");
    expect(moved.expedition?.visitedNodeIds).toContain(moved.expedition?.currentNodeId);
  });

  it("정보 카드를 고르면 파티원별 기록이 남고 사건 단계로 간다", () => {
    const current = advanceToInfo(boardState("정보"));
    const chosen = apply(current, {
      type: "chooseInfoCard",
      cardId: current.expedition!.pendingInfo!.cardIds[0],
    });

    expect(chosen.phase).toBe("event");
    expect(chosen.expedition?.pendingInfo).toBeNull();
    expect(chosen.expedition?.infoRecords.length).toBeGreaterThan(0);
  });

  it("보스방에 도착하면 보스 단계가 되고 보스전 뒤 정산으로 간다", () => {
    const state = boardState("보스");
    let current = apply(state, { type: "acceptContract", offerId: firstOpenOffer(state) });
    let guard = 0;
    while (current.phase !== "boss" && guard < 100) {
      guard += 1;
      if (current.phase === "map") {
        current = apply(current, { type: "selectNode", nodeId: nextNode(current) });
      } else if (current.phase === "infoOpportunity") {
        current = apply(current, {
          type: "chooseInfoCard",
          cardId: current.expedition!.pendingInfo!.cardIds[0],
        });
      } else if (current.phase === "event") {
        current = apply(current, {
          type: "chooseEvent",
          choiceId: affordableChoiceIds(current, CONTEXT)[0],
        });
      } else {
        break;
      }
    }

    expect(current.phase).toBe("boss");
    const settled = apply(current, { type: "resolveBoss" });
    expect(settled.phase).toBe("settlement");
    expect(settled.expedition?.result).not.toBeNull();
  });

  it("정산을 적용하면 게시판으로 돌아가고 탐험이 비워진다", () => {
    const finished = runExpedition(boardState("정산"));

    expect(["board", "ended"]).toContain(finished.phase);
    expect(finished.expedition).toBeNull();
    expect(finished.dungeons.some((dungeon) => dungeon.status === "cleared")
      || finished.dungeons.some((dungeon) => dungeon.failureCount > 0)).toBe(true);
  });
});

describe("금지된 전이", () => {
  it.each([
    ["board", { type: "resolveBoss" }],
    ["board", { type: "selectNode", nodeId: "node-entry" as NodeId }],
    ["board", { type: "applySettlement" }],
    ["board", { type: "chooseEvent", choiceId: "choice-guide-flank" as ChoiceId }],
  ] as const)("%s 단계에서 %o는 거부한다", (_phase, action) => {
    const state = boardState();
    const snapshot = structuredClone(state);
    const error = ruleErrorOf(() => apply(state, action as CampaignAction));

    expect(error.code).toBe("INVALID_TRANSITION");
    expect(state).toEqual(snapshot);
  });

  it("탐험 중에 계약을 다시 수락할 수 없다", () => {
    const state = boardState();
    const started = apply(state, { type: "acceptContract", offerId: firstOpenOffer(state) });
    const error = ruleErrorOf(() =>
      apply(started, { type: "acceptContract", offerId: firstOpenOffer(state) }));

    expect(error.code).toBe("INVALID_TRANSITION");
  });

  it("없는 공고와 잠긴 공고를 거부한다", () => {
    const state = boardState();
    expect(ruleErrorOf(() =>
      apply(state, { type: "acceptContract", offerId: "offer-없음" as BoardOfferId })).code)
      .toBe("UNKNOWN_ID");

    const locked = { ...state, currentReputation: -1 };
    const withLockedBoard = { ...locked, board: generateBoard(locked) };
    expect(ruleErrorOf(() => apply(withLockedBoard, {
      type: "acceptContract",
      offerId: withLockedBoard.board[0].id,
    })).code).toBe("INVALID_TRANSITION");
  });

  it("현재 지점에서 갈 수 없는 지점을 거부한다", () => {
    const state = boardState();
    const started = advanceToMap(
      apply(state, { type: "acceptContract", offerId: firstOpenOffer(state) }),
    );
    const error = ruleErrorOf(() =>
      apply(started, { type: "selectNode", nodeId: started.expedition!.map.bossNodeId }));

    expect(error.code).toBe("UNKNOWN_ID");
  });

  it("제시되지 않은 카드를 거부한다", () => {
    const current = advanceToInfo(boardState("정보"));
    const error = ruleErrorOf(() =>
      apply(current, { type: "chooseInfoCard", cardId: "card-없음" as CardId }));

    expect(error.code).toBe("UNKNOWN_ID");
  });
});

describe("전멸 처리", () => {
  it("사건에서 전멸하면 남은 지점과 보스전을 건너뛰고 정산으로 간다", () => {
    const state = boardState("전멸");
    let current = apply(state, { type: "acceptContract", offerId: firstOpenOffer(state) });
    // 파티를 빈사 상태로 만들어 다음 사건에서 전멸하게 한다.
    current = {
      ...current,
      members: current.members.map((member) => ({ ...member, currentHp: 1 })),
    };
    if (current.phase === "infoOpportunity") {
      current = apply(current, {
        type: "chooseInfoCard",
        cardId: current.expedition!.pendingInfo!.cardIds[0],
      });
    }
    const sabotage = current.expedition!.pendingEvent!.choiceIds;
    const afterEvent = apply(current, {
      type: "chooseEvent",
      choiceId: sabotage[sabotage.length - 1],
    });

    if (afterEvent.phase === "settlement") {
      expect(afterEvent.expedition?.result?.status).toBe("failed");
      expect(afterEvent.expedition?.result?.survivorIds).toEqual([]);
    }
  });
});

describe("재현성과 완주", () => {
  it("같은 시드와 같은 선택은 같은 최종 상태를 만든다", () => {
    expect(runExpedition(boardState("재현"))).toEqual(runExpedition(boardState("재현")));
  });

  it("다른 시드는 다른 지도를 만든다", () => {
    const first = apply(boardState("A"), {
      type: "acceptContract",
      offerId: firstOpenOffer(boardState("A")),
    });
    const second = apply(boardState("B"), {
      type: "acceptContract",
      offerId: firstOpenOffer(boardState("B")),
    });

    expect(first.expedition?.map).not.toEqual(second.expedition?.map);
  });

  it("한 원정을 끝내면 자원이 움직이고 로그가 남는다", () => {
    const start = boardState("자원");
    const finished = runExpedition(start);

    expect(
      finished.currentReputation !== start.currentReputation
      || finished.cumulativeGold !== start.cumulativeGold,
    ).toBe(true);
  });
});

describe("transitionCampaignDetailed", () => {
  /** 보스 단계까지 진행한 상태를 만든다. 첫 유효 선택만 고른다. */
  function stateAtBoss(seed: string): CampaignState {
    let state = transitionCampaign(
      initializeCampaign(seed),
      { type: "openBoard" },
      CONTEXT,
    );
    const offer = state.board.find((candidate) => !candidate.locked)!;
    state = transitionCampaign(
      state,
      { type: "acceptContract", offerId: offer.id },
      CONTEXT,
    );

    for (let guard = 0; state.phase !== "boss"; guard += 1) {
      if (guard > 100) throw new Error("보스 단계에 닿지 않는다");
      const expedition = state.expedition!;

      if (state.phase === "map") {
        const current = expedition.map.nodes.find(
          (node) => node.id === expedition.currentNodeId,
        )!;
        state = transitionCampaign(
          state,
          { type: "selectNode", nodeId: current.nextNodeIds[0] },
          CONTEXT,
        );
      } else if (state.phase === "infoOpportunity") {
        state = transitionCampaign(
          state,
          { type: "chooseInfoCard", cardId: expedition.pendingInfo!.cardIds[0] },
          CONTEXT,
        );
      } else if (state.phase === "event") {
        const choiceId =
          affordableChoiceIds(state, CONTEXT)[0] ?? expedition.pendingEvent!.choiceIds[0];
        state = transitionCampaign(state, { type: "chooseEvent", choiceId }, CONTEXT);
      } else {
        throw new Error(`예상 밖 단계: ${state.phase}`);
      }
    }

    return state;
  }

  it("resolveBoss는 상태와 함께 보스 결과를 돌려준다", () => {
    const transition = transitionCampaignDetailed(
      stateAtBoss("detailed-boss"),
      { type: "resolveBoss" },
      CONTEXT,
    );

    expect(transition.state.phase).toBe("settlement");
    expect(transition.bossResolution).toBeDefined();
    expect(transition.bossResolution!.members.length).toBeGreaterThan(0);
    expect(transition.settlementSteps).toBeUndefined();
  });

  it("applySettlement은 상태와 함께 정산 단계를 돌려준다", () => {
    const beforeSettlement = transitionCampaign(
      stateAtBoss("detailed-settlement"),
      { type: "resolveBoss" },
      CONTEXT,
    );
    const transition = transitionCampaignDetailed(
      beforeSettlement,
      { type: "applySettlement" },
      CONTEXT,
    );

    expect(transition.settlementSteps).toBeDefined();
    expect(transition.settlementSteps!.length).toBeGreaterThan(0);
    expect(transition.settlementSteps![0].kind).toBe("survival");
    expect(transition.bossResolution).toBeUndefined();
  });

  it("결과가 없는 행동은 상태만 돌려준다", () => {
    const transition = transitionCampaignDetailed(
      initializeCampaign("detailed-open"),
      { type: "openBoard" },
      CONTEXT,
    );

    expect(transition.bossResolution).toBeUndefined();
    expect(transition.settlementSteps).toBeUndefined();
  });

  it("transitionCampaign은 detailed의 state와 같다", () => {
    const board = initializeCampaign("detailed-wrapper");
    const viaWrapper = transitionCampaign(board, { type: "openBoard" }, CONTEXT);
    const viaDetailed = transitionCampaignDetailed(
      board,
      { type: "openBoard" },
      CONTEXT,
    ).state;

    expect(viaWrapper).toEqual(viaDetailed);
  });
});
