import { describe, expect, it } from "vitest";
import type { CampaignTransition, NodeId, SettlementResult } from "@/lib/domain";
import { createExpeditionForOffer, createSettlementSnapshotFor } from "@/lib/rules/campaign-transition";
import { createCampaignStore } from "./campaign-store";
import { firstChoosableAdvice } from "./legal-advice";

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
  /* 정산 결과는 다음 액션이 `last` 를 덮어쓰기 전에 붙든다. */
  let settlement: SettlementResult | null = null;
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

    const afterVisit = store.getState().context.activeExpedition;
    if (afterVisit?.pendingEvent == null) continue;
    act({ type: "CHOOSE_ADVICE", adviceId: firstChoosableAdvice(store.getState().campaign, afterVisit) });
    /* 결과를 확인해야 움직일 수 있다. 길잡이가 하는 것과 같다. */
    act({ type: "ACKNOWLEDGE_OUTCOME" });
  }

  /* 원정이 끝났으면 정산하고 세상을 한 턴 돌린다. 한 바퀴가 닫혀야 한다. */
  const ended = store.getState().context.activeExpedition;
  if (ended !== null && (ended.expedition.bossResult !== null || ended.expedition.result !== null)) {
    act({ type: "COMPLETE_EXPEDITION", snapshot: createSettlementSnapshotFor(store.getState().campaign, ended) });
    settlement = store.getState().last?.settlement ?? null;
    if (store.getState().campaign.phase === "settlement") {
      act({ type: "START_WORLD_TURN" });
      act({ type: "COMPLETE_WORLD_TURN" });
    }
  }

  return { store, taken, settlement };
}

describe("시드 재현", () => {
  it("같은 시드는 같은 캠페인을 낸다", () => {
    const first = playOne(SEED);
    const second = playOne(SEED);

    expect(second.taken).toEqual(first.taken);
    /* Break caught: 같은 시드의 다음 게시판 보상이나 정산이 실행마다 달라지면 실패한다. */
    expect(first.store.getState().campaign.offers.map((offer) => offer.reward))
      .toEqual(second.store.getState().campaign.offers.map((offer) => offer.reward));
    expect(first.settlement).toEqual(second.settlement);
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

  /* 한 바퀴가 닫힌다 - 원정을 끝내고 게시판으로 돌아온다. */
  it("원정 한 판이 정산까지 간다", () => {
    const { store, taken } = playOne(SEED);

    expect(taken).toContain("COMPLETE_EXPEDITION");
    expect(store.getState().context.activeExpedition).toBeNull();
  });

  /* 정산이 원정 근거를 세 줄 다 보존한다. 빈 줄이면 사후 검증 근거가 사라진다. */
  it("정산의 원정 근거가 지어낸 값이 아니다", () => {
    const { settlement } = playOne(SEED);
    if (settlement === null) throw new Error("정산 결과가 없다");

    expect(settlement.causeInputs.choice.length).toBeGreaterThan(0);
    expect(settlement.causeInputs.reactions.length).toBeGreaterThan(0);
    expect(settlement.causeInputs.damage.length).toBeGreaterThan(0);
    /* 조언 문구는 사건에서 온다. 자리를 채우는 기본값이 아니다. */
    expect(settlement.causeInputs.choice).not.toBe("조언을 고를 일이 없었다");
  });

  /*
   * 결과를 정한 것이 보스전이면 원인도 보스전이어야 한다.
   *
   * 마지막 조언의 피해만 남기면 보스에게 전멸한 원정이 "피해 없이 지나갔다" 로
   * 정산된다. 실제로 걸어 본 한 판이 그랬다.
   */
  it("보스전이 끝낸 원정은 보스전을 원인으로 적는다", () => {
    const { store, settlement } = playOne(SEED);
    if (settlement === null) throw new Error("정산 결과가 없다");
    if (!store.getState().campaign.history.events.some((one) => one.type === "BOSS_BATTLE_RESOLVED")) {
      throw new Error("이 시드는 보스전까지 가지 않는다");
    }

    expect(settlement.causeInputs.choice).toContain("보스");
    /* 전멸했다면 누군가는 HP 0 이 되었다. 피해 없이 전멸할 수는 없다. */
    if (settlement.survivorIds.length === 0) expect(settlement.causeInputs.damage).toContain("→ 0");
  });

  /* 조언마다 이력이 쌓여야 정산의 원정 근거와 엔딩의 전환점이 선다. */
  it("걸은 만큼 이력이 쌓인다", () => {
    const { store, taken } = playOne(SEED);
    const advices = taken.filter((type) => type === "CHOOSE_ADVICE").length;

    expect(store.getState().campaign.history.events.length).toBeGreaterThanOrEqual(advices);
  });
});
