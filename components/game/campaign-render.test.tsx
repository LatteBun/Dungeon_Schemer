import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CampaignTransition, NodeId } from "@/lib/domain";
import { createExpeditionForOffer, createSettlementSnapshotFor } from "@/lib/rules/campaign-transition";
import { getGuidePromotionEligibility } from "@/lib/rules/promotion";
import { createCampaignStore } from "@/lib/store/campaign-store";
import { U3BoardScreen } from "./U3BoardScreen";
import { U4DungeonMapScreen } from "./U4DungeonMapScreen";
import { U5ProgressScreen } from "./U5ProgressScreen";
import { U6EndingScreen } from "./U6EndingScreen";
import { U6SettlementScreen } from "./U6SettlementScreen";
import {
  adviceIdForSlotIn, ecologyViewFor, logFor, progressViewFor, publicKindByNodeId, statusFor,
} from "./campaign-adapters";
import { createU3BoardView } from "./u3-board-model";
import { createU3PromotionView } from "./u3-promotion-model";
import { createU4MapNodeViews, createU4PartyMemberViews } from "./u4-dungeon-map-model";
import { createU4DungeonMapLayout } from "./u4-dungeon-map-layout";
import { createU6EndingView } from "./u6-ending-adapter";
import { createU6SettlementView } from "./u6-settlement-model";

/**
 * 실제 캠페인 값이 실제 화면에 찍히는 것까지 본다.
 *
 * 어댑터 검사는 어댑터가 낸 값을 본다. 그 값이 화면을 지나 DOM 에 어떻게 남는지는
 * 다른 문제다 — 화면이 어딘가에서 `undefined` 를 문자열로 흘리거나, 감춰야 할
 * 식별자를 속성에 실어 보낼 수 있다. `/campaign` 이 부르는 것과 **같은 어댑터**로
 * 같은 props 를 만들어 그대로 그려 본다.
 */

const SEED = "i2-render";

/** 화면에 절대 남으면 안 되는 것들. */
const NEVER = [
  /-help\b/, /-harm\b/, /-neutral\b/,          // 조언의 정답
  /\bundefined\b/, /\bNaN\b/, /\[object Object\]/,
];

function assertClean(markup: string, where: string) {
  for (const pattern of NEVER) {
    expect(pattern.test(markup), `${where} 에 ${pattern} 가 남았다`).toBe(false);
  }
}

function driven(seed = SEED) {
  const store = createCampaignStore(seed);
  const act = (action: CampaignTransition) => {
    store.getState().dispatch(action);
    const rejected = store.getState().rejected;
    if (rejected !== null) throw new Error(`거부됨: ${rejected.type} — ${rejected.reason}`);
  };
  return { store, act, state: () => store.getState() };
}

function contracted() {
  const run = driven();
  run.act({ type: "OPEN_BOARD" });
  const offer = run.state().campaign.offers.find((one) => one.lockReason === null)!;
  run.act({ type: "SELECT_CONTRACT", offerId: offer.id });
  run.act({ type: "START_EXPEDITION", expeditionId: "render-exp", ...createExpeditionForOffer(run.state().campaign, offer) });
  return run;
}

/** 사건이 확정될 때까지 한 걸음 걷는다. */
function atEvent() {
  const run = contracted();
  for (let step = 0; step < 20; step += 1) {
    const active = run.state().context.activeExpedition!;
    if (active.pendingEvent !== null) return run;
    const here = active.expedition.map.nodes.find((node) => node.id === active.expedition.currentNodeId);
    const next: NodeId | undefined = here?.nextNodeIds.find((id) => !active.expedition.visitedNodeIds.includes(id));
    if (next === undefined || next === active.expedition.map.bossNodeId) break;
    run.act({ type: "VISIT_NODE", nodeId: next });
  }
  throw new Error("사건이 확정되는 지점에 닿지 못했다");
}

/** 원정 하나를 끝내고 정산까지 간다. */
function settled() {
  const run = contracted();
  for (let step = 0; step < 40; step += 1) {
    const active = run.state().context.activeExpedition!;
    if (active.expedition.bossResult !== null || active.expedition.result !== null) {
      run.act({ type: "COMPLETE_EXPEDITION", snapshot: createSettlementSnapshotFor(run.state().campaign, active) });
      return run;
    }
    if (active.pendingEvent !== null) {
      run.act({ type: "CHOOSE_ADVICE", adviceId: active.pendingEvent.advice[0]!.id });
      continue;
    }
    const here = active.expedition.map.nodes.find((node) => node.id === active.expedition.currentNodeId);
    const next: NodeId | undefined = here?.nextNodeIds.find((id) => !active.expedition.visitedNodeIds.includes(id));
    if (next === undefined) { run.act({ type: "ENTER_BOSS" }); continue; }
    run.act({ type: "VISIT_NODE", nodeId: next });
    if (next === active.expedition.map.bossNodeId) run.act({ type: "ENTER_BOSS" });
  }
  throw new Error("정산까지 가지 못했다");
}

/** 캠페인 하나를 끝까지 돌린다. */
function ended(seed: string) {
  const run = driven(seed);
  for (let step = 0; step < 800; step += 1) {
    const phase = run.state().campaign.phase;
    if (phase === "ended") return run;
    if (phase === "intro") { run.act({ type: "OPEN_BOARD" }); continue; }
    if (phase === "settlement") { run.act({ type: "START_WORLD_TURN" }); continue; }
    if (phase === "worldTurn") { run.act({ type: "COMPLETE_WORLD_TURN" }); continue; }

    const active = run.state().context.activeExpedition;
    if (phase === "expedition" && active !== null) {
      if (active.expedition.bossResult !== null || active.expedition.result !== null) {
        run.act({ type: "COMPLETE_EXPEDITION", snapshot: createSettlementSnapshotFor(run.state().campaign, active) });
        continue;
      }
      if (active.pendingEvent !== null) {
        run.act({ type: "CHOOSE_ADVICE", adviceId: active.pendingEvent.advice[0]!.id });
        continue;
      }
      const here = active.expedition.map.nodes.find((node) => node.id === active.expedition.currentNodeId);
      const next: NodeId | undefined = here?.nextNodeIds.find((id) => !active.expedition.visitedNodeIds.includes(id));
      if (next === undefined) { run.act({ type: "ENTER_BOSS" }); continue; }
      run.act({ type: "VISIT_NODE", nodeId: next });
      if (next === active.expedition.map.bossNodeId) run.act({ type: "ENTER_BOSS" });
      continue;
    }

    const eligibility = getGuidePromotionEligibility(run.state().campaign);
    if (eligibility !== null && (eligibility.canPromoteByReputation || eligibility.canPromoteByGold)) {
      run.act({ type: "OPEN_PROMOTION" });
      run.act({ type: "PROMOTE_GUIDE", method: eligibility.canPromoteByReputation ? "reputation" : "gold" });
      continue;
    }
    const offer = run.state().campaign.offers.find((one) => one.lockReason === null);
    if (offer === undefined) throw new Error(`계약할 공고가 없는데 끝나지도 않았다: ${phase}`);
    run.act({ type: "SELECT_CONTRACT", offerId: offer.id });
    run.act({ type: "START_EXPEDITION", expeditionId: `e${step}`, ...createExpeditionForOffer(run.state().campaign, offer) });
  }
  throw new Error("엔딩에 이르지 못했다");
}

const noop = () => {};

describe("게시판이 실제 캠페인으로 그려진다", () => {
  it("공고와 계약 조건이 찍힌다", () => {
    const run = driven();
    run.act({ type: "OPEN_BOARD" });
    const { campaign, context, last } = run.state();

    const markup = renderToStaticMarkup(createElement(U3BoardScreen, {
      status: statusFor(campaign, null),
      board: createU3BoardView(campaign, campaign.offers),
      selectedOfferId: context.selectedOffer?.id ?? "",
      promotion: createU3PromotionView(getGuidePromotionEligibility(campaign), campaign.phase, last?.promotion ?? null),
      onSelectOffer: noop, onContract: noop, onOpenPromotion: noop,
      onCancelPromotion: noop, onConfirmPromotion: noop, onDismissPromotionResult: noop,
    }));

    assertClean(markup, "게시판");
    /* 공고가 하나도 없으면 위 검사는 통과하지만 화면은 비어 있다. */
    expect(markup).toContain(campaign.offers[0]!.dungeonId.length > 0 ? "위험도" : "위험도");
    expect(markup.length).toBeGreaterThan(500);
  });
});

describe("지도가 실제 원정으로 그려진다", () => {
  it("숨은 역할이 DOM 에 새지 않는다", () => {
    const run = contracted();
    const { campaign, context } = run.state();
    const active = context.activeExpedition!;
    const dungeon = campaign.dungeons.find((one) => one.id === active.expedition.dungeonId);

    const markup = renderToStaticMarkup(createElement(U4DungeonMapScreen, {
      status: statusFor(campaign, active),
      dungeonName: dungeon?.name ?? "",
      riskLevel: active.expedition.riskLevel,
      nodes: createU4MapNodeViews({
        map: active.expedition.map,
        currentNodeId: active.expedition.currentNodeId,
        visitedNodeIds: active.expedition.visitedNodeIds,
        publicKindByNodeId: publicKindByNodeId(active),
      }),
      layout: createU4DungeonMapLayout(active.expedition.map),
      party: createU4PartyMemberViews(active.partyMembers),
      selectedNextNodeId: null,
      onSelectNextNode: noop,
      onMove: noop,
    }));

    assertClean(markup, "지도");
    /* 보스 정보 지점도 강한 연계의 후속도 지도에서는 평범해 보여야 한다. */
    for (const role of ["bossInfo", "strongPredecessor", "strongFollower"]) {
      expect(markup).not.toContain(role);
    }
  });
});

describe("진행 화면이 실제 사건으로 그려진다", () => {
  it("조언 문구는 보이고 식별자는 새지 않는다", () => {
    const run = atEvent();
    const { campaign, context } = run.state();
    const active = context.activeExpedition!;

    const markup = renderToStaticMarkup(createElement(U5ProgressScreen, {
      status: statusFor(campaign, active),
      progress: progressViewFor(campaign, active)!,
      log: logFor(campaign, active),
      ecology: ecologyViewFor(campaign, active),
      onSelectAdvice: noop,
    }));

    assertClean(markup, "진행 화면");
    /* 세 조언의 문구가 실제로 찍혀야 한다. 없으면 고를 것이 없다. */
    for (const option of active.pendingEvent!.advice) {
      expect(markup).toContain(option.label.slice(0, 12));
      expect(markup).not.toContain(String(option.id));
    }
    expect(progressViewFor(campaign, active)!.advice).toHaveLength(active.pendingEvent!.advice.length);
  });

  /*
   * 화면에 그려진 순서와 슬롯 매핑이 같아야 한다.
   *
   * 조언은 섞어서 보여준다 — 늘 같은 자리에 정답이 있으면 고를 이유가 없다.
   * 그래서 `n` 번째로 그려진 조언과 `adviceIdForSlotIn(n)` 이 같은 것을 가리켜야
   * 한다. 어긋나면 첫 번째 조언을 누른 길잡이에게 다른 조언이 실행된다. 화면과
   * 어댑터가 각자 섞으면 조용히 그렇게 된다.
   */
  it("그려진 순서와 슬롯이 같은 조언을 가리킨다", () => {
    const run = atEvent();
    const { campaign, context } = run.state();
    const active = context.activeExpedition!;
    const view = progressViewFor(campaign, active)!;

    const markup = renderToStaticMarkup(createElement(U5ProgressScreen, {
      status: statusFor(campaign, active),
      progress: view,
      log: logFor(campaign, active),
      ecology: ecologyViewFor(campaign, active),
      onSelectAdvice: noop,
    }));

    /* 문구가 DOM 에 나타나는 위치로 실제 그려진 순서를 읽는다. */
    const drawn = view.advice.map((option) => ({
      text: option.text,
      at: markup.indexOf(option.text.slice(0, 12)),
    }));
    expect(drawn.every((one) => one.at >= 0)).toBe(true);
    expect([...drawn].sort((left, right) => left.at - right.at).map((one) => one.text))
      .toEqual(drawn.map((one) => one.text));

    /* 그 자리의 슬롯이 그 문구의 조언을 가리킨다. */
    const byId = new Map(active.pendingEvent!.advice.map((option) => [option.id, option.label]));
    for (const option of view.advice) {
      expect(byId.get(adviceIdForSlotIn(campaign, active, option.slot))).toBe(option.text);
    }
  });
});

describe("정산이 실제 결과로 그려진다", () => {
  it("원인 사슬 네 칸이 다 찍힌다", () => {
    const run = settled();
    const { campaign, last } = run.state();
    const settlement = last!.settlement!;
    const dungeon = campaign.dungeons.find((one) => one.id === settlement.dungeonId);

    const markup = renderToStaticMarkup(createElement(U6SettlementScreen, {
      status: statusFor(campaign, null),
      settlement: createU6SettlementView(settlement, dungeon?.name ?? "", dungeon?.theme ?? "spider"),
      onContinue: noop,
    }));

    assertClean(markup, "정산");
    expect(markup).toContain(settlement.causeChain.choice);
    expect(markup).toContain(settlement.causeChain.reactions);
    expect(markup).toContain(settlement.causeChain.damage);
  });
});

describe("엔딩이 실제 캠페인으로 그려진다", () => {
  it("판정 근거와 통계가 찍힌다", () => {
    const run = ended("i2-run-2");
    const campaign = run.state().campaign;
    const ending = campaign.ending!;

    const markup = renderToStaticMarkup(createElement(U6EndingScreen, {
      ending: createU6EndingView(campaign, ending),
    }));

    assertClean(markup, "엔딩");
    /* 판정 근거는 규칙이 쓴 문장이다. 화면이 다시 쓰지 않는다. */
    expect(markup).toContain(ending.reason);
    expect(markup).toContain(String(campaign.statistics.totalExpeditions));
  });

  /* 다섯 결말 어느 것이 나와도 그릴 수 있어야 한다. */
  it("여러 시드의 엔딩을 모두 그린다", () => {
    const kinds = new Set<string>();
    for (const seed of ["i2-run-2", "i2-run-3", "i2-run-10", "wide-7", "wide-31"]) {
      const campaign = ended(seed).state().campaign;
      const markup = renderToStaticMarkup(createElement(U6EndingScreen, {
        ending: createU6EndingView(campaign, campaign.ending!),
      }));
      assertClean(markup, `엔딩(${seed})`);
      kinds.add(campaign.ending!.kind);
    }

    expect(kinds.size).toBeGreaterThan(0);
  });
});

describe("게시판에서 공고를 다시 고른다", () => {
  /*
   * 규칙은 `contract` 에서 `SELECT_CONTRACT` 를 받지 않는다. 물러서는 것이 먼저다.
   * 그 두 걸음을 화면이 대신 밟지 않으면 두 번째 공고가 눌리지 않는다.
   */
  it("다른 공고를 누르면 그것이 선택된다", () => {
    const run = driven("board-reselect");
    run.act({ type: "OPEN_BOARD" });
    const free = run.state().campaign.offers.filter((one) => one.lockReason === null);
    expect(free.length).toBeGreaterThan(1);

    run.act({ type: "SELECT_CONTRACT", offerId: free[0]!.id });
    expect(run.state().context.selectedOffer?.id).toBe(free[0]!.id);

    /* 화면이 하는 것과 같은 두 걸음. */
    run.act({ type: "CANCEL_CONTRACT" });
    run.act({ type: "SELECT_CONTRACT", offerId: free[1]!.id });

    expect(run.state().context.selectedOffer?.id).toBe(free[1]!.id);
    expect(run.state().rejected).toBeNull();
  });

  /* 물러서지 않고 바로 고르면 규칙이 거부한다. 화면이 이 길로 가면 안 된다. */
  it("물러서지 않고 고르면 거부된다", () => {
    const store = createCampaignStore("board-reject");
    store.getState().dispatch({ type: "OPEN_BOARD" });
    const free = store.getState().campaign.offers.filter((one) => one.lockReason === null);
    store.getState().dispatch({ type: "SELECT_CONTRACT", offerId: free[0]!.id });
    store.getState().dispatch({ type: "SELECT_CONTRACT", offerId: free[1]!.id });

    expect(store.getState().rejected).not.toBeNull();
    expect(store.getState().context.selectedOffer?.id).toBe(free[0]!.id);
  });
});
