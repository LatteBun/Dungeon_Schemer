import { describe, expect, it } from "vitest";
import type { CampaignState, CampaignTransition, NodeId } from "@/lib/domain";
import { createExpeditionForOffer, createSettlementSnapshotFor } from "@/lib/rules/campaign-transition";
import { createU6EndingView } from "@/components/game/u6-ending-adapter";
import { getGuidePromotionEligibility } from "@/lib/rules/promotion";
import type { CampaignStoreState } from "./campaign-store";
import { createCampaignStore, screenForPhase } from "./campaign-store";
import { firstChoosableAdvice } from "./legal-advice";

/**
 * 한 캠페인을 끝까지 돌린다.
 *
 * `I2` 의 완료 기준은 「인트로→게시판→탐험→정산→월드턴→다음 공고/엔딩」이다.
 * 한 판만 도는 검사로는 그 끝을 못 본다 — 엔딩은 여러 원정이 쌓여야 온다.
 *
 * 화면을 거치지 않고 스토어로 돌린다. 렌더를 섞으면 무엇이 달라졌는지 가려진다.
 */

/** 지금 상태를 보고 다음 한 걸음을 정한다. 액션 목록을 미리 적지 않는다. */
function runToEnd(seed: string, limit = 400, onStep: (state: CampaignStoreState) => void = () => {}) {
  const store = createCampaignStore(seed);
  const taken: CampaignTransition["type"][] = [];
  const act = (action: CampaignTransition) => {
    store.getState().dispatch(action);
    const rejected = store.getState().rejected;
    if (rejected !== null) throw new Error(`거부됨: ${rejected.type} — ${rejected.reason}`);
    taken.push(action.type);
    onStep(store.getState());
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
        act({ type: "CHOOSE_ADVICE", adviceId: firstChoosableAdvice(campaign(), active) });
        /* 결과를 확인해야 움직일 수 있다. 길잡이가 하는 것과 같다. */
        act({ type: "ACKNOWLEDGE_OUTCOME" });
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
 * 지도는 규칙이 거부할 이동을 내놓지 않는다.
 *
 * 한때 40 시드 중 23 이 막혔다. 강한 연계의 후속 지점은 선행 단서를 들고 있어야
 * 물질화되는데, 배치가 "선행에서 **도달 가능**" 만 요구했기 때문이다. 갈림길에서
 * 다른 갈래로 가면 선행을 밟지 않고 후속에 닿고, 그 지점은 지도에서 고를 수 있게
 * 보였다. 이제 배치가 후속에 닿는 **모든** 길이 선행을 지날 것을 요구한다.
 *
 * 한 시드로는 못 본다. 지도가 갈라지는 모양이 시드마다 다르고, 막히는 것은 그
 * 갈래 중 하나를 골랐을 때뿐이다.
 */
describe("막다른 길이 없다", () => {
  it("어느 시드로 시작해도 끝까지 간다", () => {
    const stuck: string[] = [];
    for (let index = 0; index < 40; index += 1) {
      const seed = `scan-${index}`;
      try {
        const run = runToEnd(seed);
        if (run.campaign.phase !== "ended") stuck.push(`${seed}: ${run.campaign.phase} 에서 멈춤`);
      } catch (error) {
        stuck.push(`${seed}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    expect(stuck).toEqual([]);
  });
});

/**
 * 캠페인이 제 기록을 남긴다.
 *
 * `C8-B` 가 이벤트 여섯 종을 정의했는데 오래 두 종만 쌓이고 있었다. 정산도
 * 승급도 종료도 남지 않아, 「첫 사망」 전환점이 구조적으로 나올 수 없었다.
 */
describe("캠페인 이력", () => {
  it("조언과 보스전 말고도 남는다", () => {
    const run = runToEnd(SEED);
    const types = new Set(run.campaign.history.events.map((event) => event.type));

    expect(types).toContain("ADVICE_RESOLVED");
    expect(types).toContain("BOSS_BATTLE_RESOLVED");
    expect(types).toContain("EXPEDITION_SETTLED");
    expect(types).toContain("GUIDE_PROMOTED");
    expect(types).toContain("CAMPAIGN_ENDED");
  });

  /* 정산 횟수와 정산 이력 수가 갈라지면 한쪽이 빠뜨린 것이다. */
  it("정산한 만큼 정산 이력이 남는다", () => {
    const run = runToEnd(SEED);
    const settled = run.campaign.history.events.filter((event) => event.type === "EXPEDITION_SETTLED");

    expect(settled).toHaveLength(run.campaign.statistics.totalExpeditions);
    expect(settled.length).toBeGreaterThan(1);
  });

  it("승급한 만큼 승급 이력이 남는다", () => {
    const run = runToEnd(SEED);
    const promoted = run.campaign.history.events.filter((event) => event.type === "GUIDE_PROMOTED");

    expect(promoted).toHaveLength(run.taken.filter((one) => one === "PROMOTE_GUIDE").length);
    expect(promoted.length).toBeGreaterThan(0);
  });

  /* 첫 사망은 정산 이력에서만 찾을 수 있다. 그 이력이 없으면 영영 안 나온다. */
  it("첫 사망이 전환점으로 나온다", () => {
    const run = runToEnd(SEED);
    const kinds = run.campaign.history.turningPoints.map((point) => point.kind);

    expect(kinds).toContain("firstCharacterDeath");
    /* 첫 사망은 한 번뿐이다. */
    expect(kinds.filter((kind) => kind === "firstCharacterDeath")).toHaveLength(1);
  });
});

/**
 * 캠페인이 지나는 모든 단계를 그릴 수 있어야 한다.
 *
 * 한 단계라도 그릴 수 없으면 길잡이는 「이 단계를 그릴 수 없다」 앞에 선다.
 * `worldTurn` 이 그랬다 — 정산 화면으로 오는데 그때는 `last.settlement` 가 이미
 * 비어 있었다. 두 액션을 한 핸들러에서 연달아 보내 사이에 렌더가 없었던 덕에
 * 드러나지 않았을 뿐이다.
 */
describe("모든 단계를 그릴 수 있다", () => {
  it("한 판 내내 빈 화면이 없다", () => {
    const blank = new Set<string>();
    const seen = new Set<string>();

    const look = (state: CampaignStoreState) => {
      const screen = screenForPhase(state.campaign.phase);
      seen.add(`${state.campaign.phase}→${screen}`);
      /* `CampaignScreen` 이 따지는 조건을 그대로 따져 본다. */
      const drawable = screen === "intro" || screen === "board"
        || (screen === "expedition" && state.context.activeExpedition !== null)
        || (screen === "settlement"
          && (state.last?.settlement != null || state.campaign.statistics.settlements.length > 0))
        || (screen === "ending" && state.campaign.ending !== null);
      if (!drawable) blank.add(`${state.campaign.phase}→${screen}`);
    };

    runToEnd(SEED, 800, look);

    expect(blank).toEqual(new Set());
    /* 실제로 여러 단계를 지나야 위 단언에 뜻이 있다. */
    expect(seen.size).toBeGreaterThan(5);
  });
});
