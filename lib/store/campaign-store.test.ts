import { describe, expect, it } from "vitest";
import { CAMPAIGN_PHASES } from "@/lib/domain";
import type { CampaignPhase } from "@/lib/domain";
import { createCampaignStore, screenForPhase } from "./campaign-store";

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
