import { describe, expect, it } from "vitest";
import { CAMPAIGN_PHASES } from "@/lib/domain";
import type { CampaignPhase, CampaignTransition } from "@/lib/domain";
import { createExpeditionForOffer, createSettlementSnapshotFor } from "@/lib/rules/campaign-transition";
import { createCampaignStore, screenForPhase } from "./campaign-store";
import { firstChoosableAdvice } from "./legal-advice";

/**
 * 스토어 계약.
 *
 * 스토어가 React 밖에 있으므로 렌더 없이 본다. `C7` 이 규칙을 다 갖고 있어서
 * 여기서 볼 것은 셋뿐이다. 상태를 옳게 옮기는가, 거부를 값으로 남기는가,
 * `phase` 가 화면을 정하는가.
 */

const SEED = "i1-store";

describe("캠페인 스토어", () => {
  it("시드로 시작하고 인트로에 선다", () => {
    const store = createCampaignStore(SEED);
    const state = store.getState();

    expect(state.campaign.seed).toBe(SEED);
    expect(state.campaign.phase).toBe("intro");
    expect(state.context.selectedOffer).toBeNull();
    expect(state.rejected).toBeNull();
  });

  it("액션이 상태를 옮긴다", () => {
    const store = createCampaignStore(SEED);
    store.getState().dispatch({ type: "OPEN_BOARD" });

    expect(store.getState().campaign.phase).toBe("board");
    expect(store.getState().campaign.offers.length).toBeGreaterThan(0);
    expect(store.getState().last).not.toBeNull();
  });

  /*
   * 잘못된 조작 하나가 캠페인을 깨뜨리면 안 된다.
   *
   * 뒤로가기로 되살아난 낡은 화면이 보내는 조작이 바로 이 자리로 온다.
   */
  it("거부된 전이가 던지지 않고 상태를 그대로 둔다", () => {
    const store = createCampaignStore(SEED);
    store.getState().dispatch({ type: "OPEN_BOARD" });
    const before = store.getState();

    expect(() => store.getState().dispatch({ type: "ENTER_BOSS" })).not.toThrow();

    const after = store.getState();
    expect(after.campaign).toBe(before.campaign);
    expect(after.context).toBe(before.context);
    expect(after.rejected).not.toBeNull();
    expect(after.rejected!.type).toBe("ENTER_BOSS");
  });

  it("다음 전이가 성공하면 거부 기록이 지워진다", () => {
    const store = createCampaignStore(SEED);
    store.getState().dispatch({ type: "ENTER_BOSS" });
    expect(store.getState().rejected).not.toBeNull();

    store.getState().dispatch({ type: "OPEN_BOARD" });
    expect(store.getState().rejected).toBeNull();
  });

  /* 모듈 전역이면 서버에서 다른 사람의 캠페인이 새어 나온다. */
  it("스토어마다 상태가 갈린다", () => {
    const one = createCampaignStore(SEED);
    const two = createCampaignStore(SEED);
    one.getState().dispatch({ type: "OPEN_BOARD" });

    expect(one.getState().campaign.phase).toBe("board");
    expect(two.getState().campaign.phase).toBe("intro");
  });

  it("같은 시드에 같은 액션 순서는 같은 상태를 낸다", () => {
    const run = () => {
      const store = createCampaignStore(SEED);
      store.getState().dispatch({ type: "OPEN_BOARD" });
      const offer = store.getState().campaign.offers.find((one) => one.lockReason === null)!;
      store.getState().dispatch({ type: "SELECT_CONTRACT", offerId: offer.id });
      return store.getState().campaign;
    };

    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });

  it("snapshot 이 지금 상태를 그대로 준다", () => {
    const store = createCampaignStore(SEED);
    store.getState().dispatch({ type: "OPEN_BOARD" });
    const snapshot = store.getState().snapshot();

    expect(snapshot.campaign).toBe(store.getState().campaign);
    expect(snapshot.context).toBe(store.getState().context);
  });
});

describe("phase 가 화면을 정한다", () => {
  it("모든 phase 에 화면이 있다", () => {
    for (const phase of CAMPAIGN_PHASES as readonly CampaignPhase[]) {
      expect(screenForPhase(phase)).toBeTruthy();
    }
  });

  /* 계약 상세와 승급은 게시판 셸 안에서 열린다. 별도 화면이 아니다. */
  it("계약과 승급은 게시판 화면이다", () => {
    expect(screenForPhase("contract")).toBe("board");
    expect(screenForPhase("promotion")).toBe("board");
  });

  it("월드턴은 정산 화면에 머문다", () => {
    expect(screenForPhase("worldTurn")).toBe("settlement");
  });

  it("종료는 엔딩 화면이다", () => {
    expect(screenForPhase("ended")).toBe("ending");
  });
});

/** 원정 하나를 끝까지 걷고 정산까지 간다. */
function settleOnce() {
  const store = createCampaignStore("c8a-settle");
  const act = (action: CampaignTransition) => store.getState().dispatch(action);
  act({ type: "OPEN_BOARD" });
  const offer = store.getState().campaign.offers.find((one) => one.lockReason === null)!;
  act({ type: "SELECT_CONTRACT", offerId: offer.id });
  act({ type: "START_EXPEDITION", expeditionId: "c8a-exp", ...createExpeditionForOffer(store.getState().campaign, offer) });

  for (let step = 0; step < 30; step += 1) {
    const active = store.getState().context.activeExpedition;
    if (active === null) break;
    if (active.expedition.bossResult !== null || active.expedition.result !== null) {
      act({ type: "COMPLETE_EXPEDITION", snapshot: createSettlementSnapshotFor(store.getState().campaign, active) });
      break;
    }
    if (active.pendingEvent !== null) {
      act({ type: "CHOOSE_ADVICE", adviceId: firstChoosableAdvice(store.getState().campaign, active) });
      continue;
    }
    const here = active.expedition.map.nodes.find((node) => node.id === active.expedition.currentNodeId);
    const next = here?.nextNodeIds.find((id) => !active.expedition.visitedNodeIds.includes(id));
    if (next === undefined) { act({ type: "ENTER_BOSS" }); continue; }
    act({ type: "VISIT_NODE", nodeId: next });
    if (next === active.expedition.map.bossNodeId) act({ type: "ENTER_BOSS" });
  }

  const state = store.getState();
  return { campaign: state.campaign, settlement: state.last?.settlement ?? null };
}

describe("C8-A 누적", () => {
  /* C7 은 통계를 건드리지 않는다. 소비는 스토어의 몫이다. */
  it("정산 한 번을 통계에 쌓는다", () => {
    const run = settleOnce();

    expect(run.campaign.statistics.totalExpeditions).toBe(1);
    expect(run.campaign.statistics.settlements).toHaveLength(1);
  });

  it("정산 결과를 다시 계산하지 않는다", () => {
    const run = settleOnce();
    const recorded = run.campaign.statistics.settlements[0]!;

    expect(recorded.expeditionId).toBe(run.settlement!.expeditionId);
    expect(recorded.dungeonId).toBe(run.settlement!.dungeonId);
  });

  /* 정산이 없는 전이는 통계를 건드리지 않는다. */
  it("정산이 아닌 전이는 통계를 그대로 둔다", () => {
    const store = createCampaignStore("c8a-noop");
    const before = store.getState().campaign.statistics;
    store.getState().dispatch({ type: "OPEN_BOARD" });

    expect(store.getState().campaign.statistics).toBe(before);
  });
});
