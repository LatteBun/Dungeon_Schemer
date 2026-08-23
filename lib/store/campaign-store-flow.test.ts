import { describe, expect, it } from "vitest";
import type { Character, ExpeditionState, NodeId } from "@/lib/domain";
import { generateDungeonMap } from "@/lib/rules/dungeon-map";
import { createCampaignStore, screenForPhase } from "./campaign-store";

/**
 * 인트로부터 원정까지 스토어 하나로 걸어 본다.
 *
 * `I2` 가 볼 전체 재현은 여기서 다루지 않는다. 다만 스토어가 실제 흐름을 버티는지
 * 는 지금 확인해야 한다. 통과하는 액션만 넣고 화면이 따라 바뀌는지 본다.
 */

const SEED = "i1-flow";

describe("스토어로 걷는 흐름", () => {
  it("인트로 → 게시판 → 계약 → 원정 → 지점 → 조언", () => {
    const store = createCampaignStore(SEED);
    const at = () => screenForPhase(store.getState().campaign.phase);

    expect(at()).toBe("intro");

    store.getState().dispatch({ type: "OPEN_BOARD" });
    expect(at()).toBe("board");

    const offer = store.getState().campaign.offers.find((one) => one.lockReason === null);
    expect(offer).toBeDefined();

    store.getState().dispatch({ type: "SELECT_CONTRACT", offerId: offer!.id });
    expect(store.getState().campaign.phase).toBe("contract");
    /* 계약 상세는 게시판 셸 안에서 열린다. 화면은 그대로다. */
    expect(at()).toBe("board");

    const campaign = store.getState().campaign;
    const dungeon = campaign.dungeons.find((one) => one.id === offer!.dungeonId)!;
    const map = generateDungeonMap({
      campaignSeed: campaign.seed,
      dungeonId: dungeon.id,
      initialRiskLevel: dungeon.initialRiskLevel,
      attempt: dungeon.attempts,
    });
    const partyMembers = offer!.party.memberIds
      .map((id) => campaign.pool.byId[id])
      .filter((member): member is Character => member !== undefined);
    const expedition: ExpeditionState = {
      dungeonId: dungeon.id,
      riskLevel: dungeon.riskLevel,
      party: offer!.party,
      activeRuleIds: dungeon.activeRuleIds,
      disclosedRuleIds: [],
      map,
      currentNodeId: map.entryNodeId,
      visitedNodeIds: [map.entryNodeId],
      infoRecords: [],
      pendingMerchantEffect: null,
      bossResult: null,
      result: null,
    };

    store.getState().dispatch({
      type: "START_EXPEDITION", expeditionId: "exp-i1-01", expedition, partyMembers,
    });
    expect(at()).toBe("expedition");
    expect(store.getState().rejected).toBeNull();

    const active = store.getState().context.activeExpedition!;
    const entry = active.expedition.map.nodes.find((node) => node.id === active.expedition.currentNodeId)!;
    const next: NodeId = entry.nextNodeIds[0]!;

    store.getState().dispatch({ type: "VISIT_NODE", nodeId: next });
    const pending = store.getState().context.activeExpedition!.pendingEvent;
    expect(pending).not.toBeNull();
    expect(store.getState().rejected).toBeNull();

    store.getState().dispatch({ type: "CHOOSE_ADVICE", adviceId: pending!.advice[0]!.id });
    expect(store.getState().context.activeExpedition!.pendingEvent).toBeNull();
    expect(store.getState().rejected).toBeNull();
  });

  /*
   * 뒤로가기로 되살아난 화면이 보내는 조작이다.
   *
   * 계약을 맺고 원정에 든 뒤 게시판이 `계약 전` 모습으로 되살아나 같은 공고를
   * 다시 계약하려 하는 경우다. `C7` 이 거부하고 스토어가 상태를 지킨다.
   */
  it("낡은 화면이 보낸 조작을 거부하고 상태를 지킨다", () => {
    const store = createCampaignStore(SEED);
    store.getState().dispatch({ type: "OPEN_BOARD" });
    const offer = store.getState().campaign.offers.find((one) => one.lockReason === null)!;
    store.getState().dispatch({ type: "SELECT_CONTRACT", offerId: offer.id });

    const before = store.getState().campaign;
    store.getState().dispatch({ type: "SELECT_CONTRACT", offerId: offer.id });

    expect(store.getState().rejected).not.toBeNull();
    expect(store.getState().campaign).toBe(before);
  });
});
