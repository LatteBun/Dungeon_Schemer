import { describe, expect, it } from "vitest";
import { BOSSES } from "@/lib/content/bosses";
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
import { INFO_CARDS } from "@/lib/content/info-cards";
import { ITEMS } from "@/lib/content/items";
import {
  affordableChoiceIds,
  createCampaignMachineContext,
} from "@/lib/flow/campaign-machine";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { createCampaignStore } from "./campaign-store";
import type { CampaignStoreApi } from "./campaign-store";

const CONTEXT = createCampaignMachineContext({
  events: DUNGEON_EVENT_POOLS,
  cards: INFO_CARDS,
  items: ITEMS,
  bosses: BOSSES,
});

/** 스토어를 보스 단계까지 진행한다. 첫 유효 선택만 고른다. */
function advanceToBoss(store: CampaignStoreApi): void {
  store.getState().dispatch({ type: "openBoard" });

  const offer = store.getState().campaign.board.find((candidate) => !candidate.locked)!;
  store.getState().dispatch({ type: "acceptContract", offerId: offer.id });

  for (let guard = 0; store.getState().campaign.phase !== "boss"; guard += 1) {
    if (guard > 100) throw new Error("보스 단계에 닿지 않는다");
    const state = store.getState().campaign;
    const expedition = state.expedition!;

    if (state.phase === "map") {
      const current = expedition.map.nodes.find(
        (node) => node.id === expedition.currentNodeId,
      )!;
      store.getState().dispatch({ type: "selectNode", nodeId: current.nextNodeIds[0] });
    } else if (state.phase === "infoOpportunity") {
      store.getState().dispatch({
        type: "chooseInfoCard",
        cardId: expedition.pendingInfo!.cardIds[0],
      });
    } else if (state.phase === "event") {
      const choiceId =
        affordableChoiceIds(state, CONTEXT)[0] ?? expedition.pendingEvent!.choiceIds[0];
      store.getState().dispatch({ type: "chooseEvent", choiceId });
    } else {
      throw new Error(`예상 밖 단계: ${state.phase}`);
    }
  }
}

/** 보스 단계까지 진행한 스토어를 만든다. 첫 유효 선택만 고른다. */
function storeAtBoss(seed: string): CampaignStoreApi {
  const store = createCampaignStore(initializeCampaign(seed), CONTEXT);
  advanceToBoss(store);

  return store;
}

describe("createCampaignStore", () => {
  it("보스전 직전 파티를 전투 전 HP로 보관한다", () => {
    const store = storeAtBoss("i1-snapshot");
    const before = store.getState().campaign;
    const expedition = before.expedition!;
    const party = before.parties.find((candidate) => candidate.id === expedition.partyId)!;
    const expected = party.memberIds.map(
      (memberId) => before.members.find((member) => member.id === memberId)!.currentHp,
    );

    store.getState().dispatch({ type: "resolveBoss" });

    const snapshot = store.getState().membersBeforeBoss!;
    expect(snapshot.map((member) => member.currentHp)).toEqual(expected);
  });

  it("resolveBoss와 applySettlement이 각각 결과를 채운다", () => {
    const store = storeAtBoss("i1-results");

    store.getState().dispatch({ type: "resolveBoss" });
    expect(store.getState().lastBossResolution).not.toBeNull();
    expect(store.getState().lastSettlementSteps).toBeNull();

    store.getState().dispatch({ type: "applySettlement" });
    expect(store.getState().lastBossResolution).not.toBeNull();
    expect(store.getState().lastSettlementSteps).not.toBeNull();
    expect(store.getState().lastSettlementSteps!.length).toBeGreaterThan(0);
  });

  it("새 계약을 수락하면 지난 탐험 결과를 비운다", () => {
    const store = storeAtBoss("i1-reset");
    store.getState().dispatch({ type: "resolveBoss" });
    store.getState().dispatch({ type: "applySettlement" });
    expect(store.getState().lastBossResolution).not.toBeNull();

    const state = store.getState().campaign;
    if (state.phase !== "board") throw new Error("정산 뒤 게시판으로 돌아오지 않았다");
    const offer = state.board.find((candidate) => !candidate.locked);
    if (offer === undefined) throw new Error("수락할 수 있는 다음 공고가 없다");

    store.getState().dispatch({ type: "acceptContract", offerId: offer.id });
    expect(store.getState().lastBossResolution).toBeNull();
    expect(store.getState().lastSettlementSteps).toBeNull();
    expect(store.getState().membersBeforeBoss).toBeNull();
  });

  it("startCampaign은 그 시드의 캠페인을 만들고 지난 결과를 비운다", () => {
    const store = storeAtBoss("i1-a");
    store.getState().dispatch({ type: "resolveBoss" });
    store.getState().dispatch({ type: "applySettlement" });
    expect(store.getState().lastSettlementSteps).not.toBeNull();

    store.getState().startCampaign("i1-b");

    expect(store.getState().campaign.seed).toBe("i1-b");
    expect(store.getState().lastBossResolution).toBeNull();
    expect(store.getState().lastSettlementSteps).toBeNull();
    expect(store.getState().membersBeforeBoss).toBeNull();
  });

  it("resetCampaign은 처음 캠페인과 빈 결과로 되돌린다", () => {
    const initial = initializeCampaign("i1-reset-action");
    const store = createCampaignStore(initial, CONTEXT);
    advanceToBoss(store);
    store.getState().dispatch({ type: "resolveBoss" });
    store.getState().dispatch({ type: "applySettlement" });
    expect(store.getState().lastBossResolution).not.toBeNull();
    expect(store.getState().lastSettlementSteps).not.toBeNull();
    expect(store.getState().membersBeforeBoss).not.toBeNull();

    store.getState().resetCampaign();

    expect(store.getState().campaign).toBe(initial);
    expect(store.getState().lastBossResolution).toBeNull();
    expect(store.getState().lastSettlementSteps).toBeNull();
    expect(store.getState().membersBeforeBoss).toBeNull();
  });
});

describe("lastTrustDeltas", () => {
  it("처음에는 비어 있다", () => {
    const store = createCampaignStore(initializeCampaign("u4-deltas"), CONTEXT);
    expect(store.getState().lastTrustDeltas).toBeNull();
  });

  it("기억한 값을 그대로 돌려준다", () => {
    const store = createCampaignStore(initializeCampaign("u4-deltas"), CONTEXT);
    store.getState().rememberTrustDeltas({ "member-001": 3, "member-002": -14 });
    expect(store.getState().lastTrustDeltas).toEqual({
      "member-001": 3,
      "member-002": -14,
    });
  });

  it("새 계약을 수락하면 지난 신뢰 변화를 비운다", () => {
    const store = createCampaignStore(initializeCampaign("u4-deltas"), CONTEXT);
    store.getState().dispatch({ type: "openBoard" });
    store.getState().rememberTrustDeltas({ "member-001": 3 });

    const offer = store
      .getState()
      .campaign.board.find((candidate) => !candidate.locked)!;
    store.getState().dispatch({ type: "acceptContract", offerId: offer.id });

    expect(store.getState().lastTrustDeltas).toBeNull();
  });
});
