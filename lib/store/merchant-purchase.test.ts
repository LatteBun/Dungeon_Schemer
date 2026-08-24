import { describe, expect, it } from "vitest";
import type { CampaignTransition, NodeId } from "@/lib/domain";
import { createExpeditionForOffer } from "@/lib/rules/campaign-transition";
import { getMerchantAdviceAvailability } from "@/lib/rules/merchant";
import { createCampaignStore } from "./campaign-store";
import { firstChoosableAdvice } from "./legal-advice";

/**
 * 상인에게 산 것을 실제로 치른다.
 *
 * `C4` 가 골드 차감과 효과 적용을 만들어 두었는데 아무도 부르지 않았다. 8 골드짜리를
 * 사도 골드가 그대로였고, "전투에서 받는 피해를 줄인다" 는 문장만 나오고 아무 일도
 * 일어나지 않았다. 노드 분류 넷 중 하나가 통째로 장식이었다.
 */

/** 상인 사건 앞에 설 때까지 여러 시드를 걷는다. */
function atMerchant(startSeed = 0) {
  for (let index = startSeed; index < startSeed + 60; index += 1) {
    const store = createCampaignStore(`merchant-wire-${index}`);
    const act = (action: CampaignTransition) => store.getState().dispatch(action);
    act({ type: "OPEN_BOARD" });
    const offer = store.getState().campaign.offers.find((one) => one.lockReason === null)!;
    act({ type: "SELECT_CONTRACT", offerId: offer.id });
    act({ type: "START_EXPEDITION", expeditionId: "m", ...createExpeditionForOffer(store.getState().campaign, offer) });

    for (let step = 0; step < 20; step += 1) {
      const active = store.getState().context.activeExpedition;
      if (active === null || active.expedition.result !== null || active.expedition.bossResult !== null) break;
      if (active.pendingEvent !== null) {
        if (active.pendingEvent.kind === "merchant") return { store, act, event: active.pendingEvent, active };
        act({ type: "CHOOSE_ADVICE", adviceId: firstChoosableAdvice(store.getState().campaign, active) });
        continue;
      }
      const here = active.expedition.map.nodes.find((node) => node.id === active.expedition.currentNodeId);
      const next: NodeId | undefined = here?.nextNodeIds.find((id) => !active.expedition.visitedNodeIds.includes(id));
      if (next === undefined) break;
      act({ type: "VISIT_NODE", nodeId: next });
      if (next === active.expedition.map.bossNodeId) act({ type: "ENTER_BOSS" });
    }
  }
  throw new Error("상인 사건에 닿지 못했다");
}

describe("상인에게 산 것을 치른다", () => {
  it("고른 조언의 값만큼 골드가 준다", () => {
    const { store, act, event, active } = atMerchant();
    const priced = event.advice.find((option) => {
      const cost = (option as { goldCost?: number }).goldCost ?? 0;
      return cost > 0 && getMerchantAdviceAvailability(
        option as never,
        store.getState().campaign.gold,
        active.expedition.pendingMerchantEffect,
      ).executable;
    });
    if (priced === undefined) throw new Error("살 수 있는 값 있는 조언이 없다");

    const before = store.getState().campaign.gold;
    const cost = (priced as { goldCost?: number }).goldCost ?? 0;
    expect(cost).toBeGreaterThan(0);
    act({ type: "CHOOSE_ADVICE", adviceId: priced.id });

    /*
     * 수용했으면 치르고, 아무도 수용하지 않았으면 사지 않은 것이다.
     *
     * 둘 중 어느 쪽인지는 규칙이 정했다. 기록의 반응을 보고 그에 맞는 값을
     * 요구한다 - "둘 중 하나면 통과" 로 두면 골드를 아예 안 깎아도 지나간다.
     */
    const record = store.getState().context.activeExpedition!.records.at(-1)!;
    const accepted = record.reactions.some((one) => one.reaction === "accepted");
    const paid = before - store.getState().campaign.gold;

    expect(paid).toBe(accepted ? cost : 0);
  });

  /* 살 수 없는 것은 살 수 없다. 규칙이 막고, 화면은 그 버튼을 잠근다. */
  it("골드가 모자라면 규칙이 막는다", () => {
    const { store, act, event, active } = atMerchant();
    const dear = [...event.advice]
      .map((option) => ({ option, cost: (option as { goldCost?: number }).goldCost ?? 0 }))
      .sort((left, right) => right.cost - left.cost)[0]!;
    if (dear.cost === 0) throw new Error("값 있는 조언이 없다");

    expect(getMerchantAdviceAvailability(dear.option as never, dear.cost - 1, active.expedition.pendingMerchantEffect))
      .toEqual({ executable: false, reason: "insufficientGold" });
    /* 살 수 있는 값이면 통과한다. 경계에서 갈리지 않는다. */
    expect(getMerchantAdviceAvailability(dear.option as never, dear.cost, active.expedition.pendingMerchantEffect).executable)
      .toBe(true);
    void act;
  });

  it("골드가 음수가 되지 않는다", () => {
    const { store, act, event, active } = atMerchant();
    const choosable = firstChoosableAdvice(store.getState().campaign, active);
    act({ type: "CHOOSE_ADVICE", adviceId: choosable });

    expect(store.getState().campaign.gold).toBeGreaterThanOrEqual(0);
    expect(store.getState().rejected).toBeNull();
    void event;
  });
});
