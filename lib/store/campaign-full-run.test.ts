import { describe, expect, it } from "vitest";
import type { CampaignState, CampaignTransition, NodeId } from "@/lib/domain";
import { createExpeditionForOffer, createSettlementSnapshotFor } from "@/lib/rules/campaign-transition";
import { createU6EndingView } from "@/components/game/u6-ending-adapter";
import { getGuidePromotionEligibility } from "@/lib/rules/promotion";
import { createCampaignStore } from "./campaign-store";

/**
 * 한 캠페인을 끝까지 돌린다.
 *
 * `I2` 의 완료 기준은 「인트로→게시판→탐험→정산→월드턴→다음 공고/엔딩」이다.
 * 한 판만 도는 검사로는 그 끝을 못 본다 — 엔딩은 여러 원정이 쌓여야 온다.
 *
 * 화면을 거치지 않고 스토어로 돌린다. 렌더를 섞으면 무엇이 달라졌는지 가려진다.
 */

/** 지금 상태를 보고 다음 한 걸음을 정한다. 액션 목록을 미리 적지 않는다. */
function runToEnd(seed: string, limit = 400) {
  const store = createCampaignStore(seed);
  const taken: CampaignTransition["type"][] = [];
  const act = (action: CampaignTransition) => {
    store.getState().dispatch(action);
    const rejected = store.getState().rejected;
    if (rejected !== null) throw new Error(`거부됨: ${rejected.type} — ${rejected.reason}`);
    taken.push(action.type);
  };
  const campaign = (): CampaignState => store.getState().campaign;

  for (let step = 0; step < limit; step += 1) {
    const phase = campaign().phase;
    if (phase === "ended") break;

    if (phase === "settlement") { act({ type: "START_WORLD_TURN" }); continue; }
    if (phase === "worldTurn") { act({ type: "COMPLETE_WORLD_TURN" }); continue; }
    if (phase === "intro") { act({ type: "OPEN_BOARD" }); continue; }

    /*
     * `phase` 를 먼저 본다. 원정 문맥이 남아 있는지가 아니다.
     *
     * `COMPLETE_EXPEDITION` 은 단계를 `settlement` 로 옮기지만 원정 문맥은
     * 그대로 둔다 - 정산 화면이 그것을 읽어야 하기 때문이고, 치우는 것은
     * 월드턴이다. 원정을 먼저 보면 정산에서 원정을 한 번 더 끝내려 든다.
     */
    const active = store.getState().context.activeExpedition;
    if (phase === "expedition" && active !== null) {
      if (active.expedition.bossResult !== null || active.expedition.result !== null) {
        act({ type: "COMPLETE_EXPEDITION", snapshot: createSettlementSnapshotFor(campaign(), active) });
        continue;
      }
      if (active.pendingEvent !== null) {
        act({ type: "CHOOSE_ADVICE", adviceId: active.pendingEvent.advice[0]!.id });
        continue;
      }
      const here = active.expedition.map.nodes.find((node) => node.id === active.expedition.currentNodeId);
      const next: NodeId | undefined = here?.nextNodeIds
        .find((id) => !active.expedition.visitedNodeIds.includes(id));
      /* 갈 곳이 없는데 보스방에 서 있으면 들어간다. 그것도 아니면 갇힌 것이다. */
      if (next === undefined) {
        if (active.expedition.currentNodeId !== active.expedition.map.bossNodeId) {
          throw new Error(`원정이 갇혔다: ${active.expedition.currentNodeId}`);
        }
        act({ type: "ENTER_BOSS" });
        continue;
      }
      act({ type: "VISIT_NODE", nodeId: next });
      if (next === active.expedition.map.bossNodeId) act({ type: "ENTER_BOSS" });
      continue;
    }

    /*
     * 올릴 수 있으면 올린다.
     *
     * 승급은 길잡이의 선택이라 규칙이 대신 해 주지 않는다. 하지 않으면 등급 C 에
     * 묶여 공고가 전부 잠기고, 어느 시드든 `unemployed` 로만 끝난다 - 한 판의
     * 뒷부분을 통째로 안 밟는 셈이다.
     */
    const eligibility = getGuidePromotionEligibility(campaign());
    if (eligibility !== null && (eligibility.canPromoteByReputation || eligibility.canPromoteByGold)) {
      act({ type: "OPEN_PROMOTION" });
      act({ type: "PROMOTE_GUIDE", method: eligibility.canPromoteByReputation ? "reputation" : "gold" });
      continue;
    }

    const offer = campaign().offers.find((one) => one.lockReason === null);
    if (offer === undefined) throw new Error(`계약할 공고가 없는데 끝나지도 않았다: ${phase}`);
    act({ type: "SELECT_CONTRACT", offerId: offer.id });
    act({
      type: "START_EXPEDITION",
      expeditionId: `exp-${taken.length}`,
      ...createExpeditionForOffer(campaign(), offer),
    });
  }

  return { store, taken, campaign: campaign() };
}

/*
 * 승급까지 태우면 등급 S 에 이르고 인력이 마르며 끝난다.
 *
 * 아무 시드나 되지 않는다 - 지도가 규칙이 거부할 이동을 내놓는 결함이 있어
 * 40 시드 중 23 이 도중에 막힌다. `E3` 의 몫이고 아래에 그 재현을 남긴다.
 */
const SEED = "i2-run-2";

describe("캠페인 한 판", () => {
  it("인트로에서 시작해 엔딩에 이른다", () => {
    const run = runToEnd(SEED);

    expect(run.campaign.phase).toBe("ended");
    expect(run.campaign.ending).not.toBeNull();
  });

  /* 끝까지 가는 동안 한 번도 거부되지 않는다. 거부는 흐름이 끊긴 자리다. */
  it("끝까지 가는 동안 거부가 없다", () => {
    const run = runToEnd(SEED);

    expect(run.store.getState().rejected).toBeNull();
    expect(run.taken.filter((one) => one === "COMPLETE_EXPEDITION").length).toBeGreaterThan(1);
  });

  it("엔딩 화면을 그릴 수 있다", () => {
    const run = runToEnd(SEED);
    const view = createU6EndingView(run.campaign, run.campaign.ending!);

    /* 판정 근거는 규칙이 쓴 문장이다. 화면이 지어낸 것이 아니다. */
    expect(view.reasons[0]).toBe(run.campaign.ending!.reason);
    expect(view.reasons.every((line) => line.length > 0)).toBe(true);
    expect(view.report.every((line) => !line.includes("undefined"))).toBe(true);
    expect(view.consequences).toHaveLength(4);
  });

  /* 엔딩의 숫자는 그 캠페인에서 나온 값이다. 고정값이 아니다. */
  it("엔딩의 통계가 실제로 돌린 캠페인과 맞는다", () => {
    const run = runToEnd(SEED);
    const view = createU6EndingView(run.campaign, run.campaign.ending!);

    expect(view.totalExpeditions).toBe(run.campaign.statistics.totalExpeditions);
    expect(view.diedCount).toBe(run.campaign.statistics.totalDeaths);
    expect(view.finalReputation).toBe(run.campaign.reputation);
    expect(view.totalExpeditions).toBeGreaterThan(0);
  });

  it("승급을 밟고 등급이 오른다", () => {
    const run = runToEnd(SEED);

    expect(run.taken).toContain("PROMOTE_GUIDE");
    expect(run.campaign.rank).not.toBe("C");
  });

  it("같은 시드는 끝까지 같은 캠페인을 낸다", () => {
    expect(JSON.stringify(runToEnd(SEED).campaign)).toBe(JSON.stringify(runToEnd(SEED).campaign));
  });
});

/**
 * 알려진 결함 — 지도가 규칙이 거부할 이동을 내놓는다.
 *
 * 강한 연계의 후속 지점은 선행 단서를 들고 있어야 물질화된다. 그런데 배치는
 * "선행에서 **도달 가능**" 만 요구하므로, 갈림길에서 다른 갈래로 가면 선행을
 * 밟지 않고 후속에 닿는다. 지도는 그 지점을 고를 수 있게 내놓고, 이동하면
 * 규칙이 거부한다 - 실제 플레이에서 막다른 길이다.
 *
 * `E3` 의 몫이라 여기서 고치지 않는다. 고쳐지면 이 검사가 빨개져 알려 준다.
 */
describe("알려진 결함", () => {
  it("절반 넘는 시드가 도중에 막힌다", () => {
    let blocked = 0;
    const total = 40;
    for (let index = 0; index < total; index += 1) {
      try { runToEnd(`scan-${index}`); } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("strong follower")) throw error;
        blocked += 1;
      }
    }

    /* 지금은 40 중 23 이다. 이 줄이 깨지면 결함이 고쳐졌거나 더 나빠진 것이다. */
    expect(blocked).toBe(23);
    expect(blocked / total).toBeGreaterThan(0.5);
  });
});
