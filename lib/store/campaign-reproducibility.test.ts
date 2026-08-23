import { describe, expect, it } from "vitest";
import type { CampaignTransition, NodeId } from "@/lib/domain";
import { createExpeditionForOffer } from "@/lib/rules/campaign-transition";
import { createCampaignStore } from "./campaign-store";

/**
 * 같은 시드에 같은 조작을 넣으면 같은 캠페인이 나온다.
 *
 * 화면을 거치지 않고 스토어로 돌린다. 렌더를 섞으면 무엇이 달라졌는지 가려진다.
 * `I1` 이 스토어를 React 밖에 둔 이유가 여기서 살아난다.
 */

const SEED = "i2-repro";

/** 원정 한 판을 걷는다. 액션을 그때그때 정하지 않고 상태를 보고 고른다. */
function playOne(seed: string) {
  const store = createCampaignStore(seed);
  const taken: CampaignTransition["type"][] = [];
  const act = (action: CampaignTransition) => {
    store.getState().dispatch(action);
    taken.push(action.type);
  };

  act({ type: "OPEN_BOARD" });
  const offer = store.getState().campaign.offers.find((one) => one.lockReason === null);
  if (offer === undefined) throw new Error("계약 가능한 공고가 없다");
  act({ type: "SELECT_CONTRACT", offerId: offer.id });
  act({
    type: "START_EXPEDITION",
    expeditionId: "exp-repro",
    ...createExpeditionForOffer(store.getState().campaign, offer),
  });

  /* 지도를 끝까지 걷는다. 갈림길에서는 늘 첫 번째를 고른다. */
  for (let step = 0; step < 12; step += 1) {
    const active = store.getState().context.activeExpedition;
    if (active === null) break;
    const current = active.expedition.map.nodes.find((node) => node.id === active.expedition.currentNodeId);
    if (current === undefined) break;
    const next: NodeId | undefined = current.nextNodeIds
      .find((id) => !active.expedition.visitedNodeIds.includes(id));
    if (next === undefined) break;

    /* 보스방도 먼저 밟는다. 서 있는 자리에서 바로 들어갈 수 없다. */
    act({ type: "VISIT_NODE", nodeId: next });
    if (next === active.expedition.map.bossNodeId) { act({ type: "ENTER_BOSS" }); break; }

    const pending = store.getState().context.activeExpedition?.pendingEvent;
    if (pending == null) continue;
    act({ type: "CHOOSE_ADVICE", adviceId: pending.advice[0]!.id });
  }

  return { store, taken };
}

describe("시드 재현", () => {
  it("같은 시드는 같은 캠페인을 낸다", () => {
    const first = playOne(SEED);
    const second = playOne(SEED);

    expect(second.taken).toEqual(first.taken);
    expect(JSON.stringify(second.store.getState().campaign))
      .toBe(JSON.stringify(first.store.getState().campaign));
  });

  it("같은 시드는 같은 원정 상태를 낸다", () => {
    const first = playOne(SEED);
    const second = playOne(SEED);

    expect(JSON.stringify(second.store.getState().context))
      .toBe(JSON.stringify(first.store.getState().context));
  });

  it("다른 시드는 다른 캠페인을 낸다", () => {
    const one = playOne(SEED);
    const two = playOne("i2-repro-other");

    expect(JSON.stringify(two.store.getState().campaign))
      .not.toBe(JSON.stringify(one.store.getState().campaign));
  });

  /* 한 판을 도는 동안 거부가 하나도 없어야 한다. 있으면 흐름이 끊긴 것이다. */
  it("한 판을 도는 동안 거부가 없다", () => {
    const { store, taken } = playOne(SEED);

    expect(store.getState().rejected).toBeNull();
    expect(taken.length).toBeGreaterThan(4);
    expect(taken).toContain("VISIT_NODE");
    expect(taken).toContain("CHOOSE_ADVICE");
  });

  /* 조언마다 이력이 쌓여야 정산의 원인 사슬과 엔딩의 전환점이 선다. */
  it("걸은 만큼 이력이 쌓인다", () => {
    const { store, taken } = playOne(SEED);
    const advices = taken.filter((type) => type === "CHOOSE_ADVICE").length;

    expect(store.getState().campaign.history.events.length).toBeGreaterThanOrEqual(advices);
  });
});
