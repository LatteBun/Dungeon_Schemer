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
import {
  createCampaignStore,
  type CampaignStoreApi,
} from "@/lib/stores/campaign-store";
import { deriveResultStage } from "./result-stage";

const CONTEXT = createCampaignMachineContext({
  events: DUNGEON_EVENT_POOLS,
  cards: INFO_CARDS,
  items: ITEMS,
  bosses: BOSSES,
});

function advanceToBoss(store: CampaignStoreApi): void {
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

describe("deriveResultStage", () => {
  it("정산 전이가 게시판으로 끝나도 타임라인 확인 단계를 먼저 보여준다", () => {
    const store = createCampaignStore(initializeCampaign("i1-result-stage"), CONTEXT);
    advanceToBoss(store);
    store.getState().dispatch({ type: "resolveBoss" });

    expect(store.getState().campaign.phase).toBe("settlement");
    expect(deriveResultStage("settlement", false, false)).toBe("settlementAction");

    store.getState().dispatch({ type: "applySettlement" });
    const settled = store.getState();

    expect(settled.campaign.phase).toBe("board");
    expect(settled.lastSettlementSteps?.length).toBeGreaterThan(0);
    expect(
      deriveResultStage(
        settled.campaign.phase,
        true,
        settled.lastSettlementSteps !== null,
      ),
    ).toBe("settlementSummary");
    expect(
      deriveResultStage(
        settled.campaign.phase,
        false,
        settled.lastSettlementSteps !== null,
      ),
    ).toBe("redirect");
  });

  it("엔딩 정산도 타임라인 확인 뒤 엔딩으로 진행한다", () => {
    expect(deriveResultStage("ended", true, true)).toBe("settlementSummary");
    expect(deriveResultStage("ended", false, true)).toBe("ending");
  });
});
