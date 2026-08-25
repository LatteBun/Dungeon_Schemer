import { describe, expect, it } from "vitest";
import type { CampaignTransition, NodeId } from "@/lib/domain";
import { createExpeditionForOffer } from "@/lib/rules/campaign-transition";
import { createCampaignStore } from "@/lib/store/campaign-store";
import {
  maxMerchantGoldCost,
  projectAdviceDecision,
  projectBoardDecision,
} from "./public-state";

function pendingEventState(seed: string) {
  const store = createCampaignStore(seed);
  const act = (action: CampaignTransition) => store.getState().dispatch(action);
  act({ type: "OPEN_BOARD" });
  const offer = store.getState().campaign.offers.find((candidate) => candidate.lockReason === null);
  if (offer === undefined) throw new Error("공개 가능한 공고가 없다");
  act({ type: "SELECT_CONTRACT", offerId: offer.id });
  const prepared = createExpeditionForOffer(store.getState().campaign, offer);
  act({ type: "START_EXPEDITION", expeditionId: "public-state-expedition", ...prepared });
  const active = store.getState().context.activeExpedition;
  if (active === null) throw new Error("활성 원정이 없다");
  const here = active.expedition.map.nodes.find((node) => node.id === active.expedition.currentNodeId);
  const next = here?.nextNodeIds[0] as NodeId | undefined;
  if (next === undefined) throw new Error("다음 지점이 없다");
  act({ type: "VISIT_NODE", nodeId: next });
  const pending = store.getState().context.activeExpedition;
  if (pending === null || pending.pendingEvent === null) throw new Error("사건이 열리지 않았다");
  return { campaign: store.getState().campaign, active: pending };
}

describe("백테스트 공개 상태 projection", () => {
  it("게시판 view는 공개 공고와 승급 정보만 제공한다", () => {
    const store = createCampaignStore("public-board");
    store.getState().dispatch({ type: "OPEN_BOARD" });
    const view = projectBoardDecision(store.getState().campaign);
    const source = store.getState().campaign.offers[0]!;

    expect(view.offers.length).toBeGreaterThan(0);
    expect(view.offers[0]?.fullSurvivorReward).toEqual(source.reward);
    expect(view.offers[0]?.fullSurvivorReward).not.toBe(source.reward);
    expect(view).not.toHaveProperty("history");
    expect(view).not.toHaveProperty("statistics");
    expect(view.offers[0]).not.toHaveProperty("preparedEvents");
  });

  it("조언 view에는 내부 판정 필드와 숨은 사건 계획이 없다", () => {
    const { campaign, active } = pendingEventState("public-boundary");
    const view = projectAdviceDecision(campaign, active, false);

    expect(view.options).toHaveLength(3);
    for (const option of view.options) {
      expect(option).not.toHaveProperty("outcome");
      expect(option).not.toHaveProperty("relation");
      expect(option).not.toHaveProperty("immediateEffect");
    }
    expect(view).not.toHaveProperty("preparedEvents");
    expect(view).not.toHaveProperty("hiddenRole");
    expect(JSON.stringify(view)).not.toContain("advicePressure");
  });

  it("공식 상인 콘텐츠에서 최대 비용을 계산한다", () => {
    expect(maxMerchantGoldCost()).toBeGreaterThan(0);
    expect(Number.isInteger(maxMerchantGoldCost())).toBe(true);
  });
});
