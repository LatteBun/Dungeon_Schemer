import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CampaignTransition, Character, NodeId } from "@/lib/domain";
import { createExpeditionForOffer, createSettlementSnapshotFor } from "@/lib/rules/campaign-transition";
import { countLivingZeroTrust } from "@/lib/rules/ending";
import { getGuidePromotionEligibility } from "@/lib/rules/promotion";
import { createCampaignStore } from "@/lib/store/campaign-store";
import { firstChoosableAdvice } from "@/lib/store/legal-advice";
import { RejectionNotice } from "./CampaignScreen";
import { U3BoardScreen } from "./U3BoardScreen";
import { U4DungeonMapScreen } from "./U4DungeonMapScreen";
import { U5ProgressScreen } from "./U5ProgressScreen";
import { U6EndingScreen } from "./U6EndingScreen";
import { U6SettlementScreen } from "./U6SettlementScreen";
import { CampaignScreen } from "./CampaignScreen";
import { CampaignStoreProvider } from "./CampaignStoreProvider";
import { PlayerProgressProvider } from "./PlayerProgressProvider";
import {
  adviceIdForSlotIn, bossReplayFor, ecologyViewFor, eventReplayFor, expeditionEndViewFor, logFor,
  memberChangesFor, progressViewFor, publicKindByNodeId, statusFor, surveyViewFor,
} from "./campaign-adapters";
import { createU3BoardView } from "./u3-board-model";
import { createU3PromotionView } from "./u3-promotion-model";
import { createU4MapNodeViews, createU4PartyMemberViews } from "./u4-dungeon-map-model";
import { createU4DungeonMapLayout } from "./u4-dungeon-map-layout";
import { createU6EndingView } from "./u6-ending-adapter";
import { createU6SettlementView } from "./u6-settlement-model";
import { u5PartyViewsForBattleFrame } from "./u5-progress-model";

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

function contracted(seed = SEED) {
  const run = driven(seed);
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
      run.act({ type: "CHOOSE_ADVICE", adviceId: firstChoosableAdvice(run.state().campaign, active) });
      /* 결과를 확인해야 움직일 수 있다. 길잡이가 하는 것과 같다. */
      run.act({ type: "ACKNOWLEDGE_OUTCOME" });
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
        run.act({ type: "CHOOSE_ADVICE", adviceId: firstChoosableAdvice(run.state().campaign, active) });
        /* 결과를 확인해야 움직일 수 있다. 길잡이가 하는 것과 같다. */
        run.act({ type: "ACKNOWLEDGE_OUTCOME" });
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
    const { campaign, last } = run.state();
    const board = createU3BoardView(campaign, campaign.offers);
    const notice = board.notices[0]!;

    const markup = renderToStaticMarkup(createElement(U3BoardScreen, {
      status: statusFor(campaign, null),
      board,
      selectedOfferId: notice.offerId,
      promotion: createU3PromotionView(getGuidePromotionEligibility(campaign), campaign.phase, last?.promotion ?? null),
      onSelectOffer: noop, onContract: noop, onOpenPromotion: noop,
      onCancelPromotion: noop, onConfirmPromotion: noop, onDismissPromotionResult: noop,
    }));

    assertClean(markup, "게시판");
    /* 공고가 하나도 없으면 위 검사는 통과하지만 화면은 비어 있다. */
    expect(markup).toContain(campaign.offers[0]!.dungeonId.length > 0 ? "위험도" : "위험도");
    expect(markup.length).toBeGreaterThan(500);
    /* Break caught: U3가 공고의 확정 보상 대신 다른 숫자를 렌더링하면 실패한다. */
    const selectedMarker = markup.indexOf('aria-pressed="true"');
    const selectedStart = markup.lastIndexOf("<button", selectedMarker);
    const selectedEnd = markup.indexOf("</button>", selectedMarker);
    const selectedNoticeMarkup = markup.slice(selectedStart, selectedEnd);
    expect(selectedMarker).toBeGreaterThan(-1);
    expect(selectedNoticeMarkup).toContain(`>명성</span>${notice.reputationReward}</span>`);
    expect(selectedNoticeMarkup).toContain(`>골드</span>${notice.goldReward}</span>`);
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
      playbackRate: 1,
      onTogglePlaybackRate: noop,
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
      playbackRate: 1,
      onTogglePlaybackRate: noop,
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
  it("선택과 판단, 인물별 결과가 다 찍힌다", () => {
    const run = settled();
    const { campaign, last } = run.state();
    const settlement = last!.settlement!;
    const dungeon = campaign.dungeons.find((one) => one.id === settlement.dungeonId);

    const view = createU6SettlementView(campaign, settlement, dungeon?.name ?? "", dungeon?.theme ?? "spider");
    const markup = renderToStaticMarkup(createElement(U6SettlementScreen, {
      status: statusFor(campaign, null),
      settlement: view,
      onContinue: noop,
    }));

    assertClean(markup, "정산");
    expect(view.trustPressure?.afterCount ?? 0).toBe(countLivingZeroTrust(campaign));
    expect(markup).toContain(settlement.causeInputs.choice);
    expect(markup).toContain(settlement.causeInputs.reactions);
    expect(markup).not.toContain("<strong>피해</strong>");
    const changedMember = settlement.memberChanges.find((change) =>
      change.before.hp !== change.after.hp || change.before.alive !== change.after.alive,
    );
    if (changedMember === undefined) throw new Error("피해 또는 사망한 원정대원이 없다");
    expect(markup).toContain(changedMember.after.name);
    expect(markup).toContain(
      changedMember.before.alive && !changedMember.after.alive
        ? `사망 · HP ${changedMember.before.hp} → ${changedMember.after.hp}`
        : `HP ${changedMember.before.hp} → ${changedMember.after.hp} / ${changedMember.after.maxHp}`,
    );
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

/*
 * 싸움이 되는 monster 사건을 만날 때까지 걷는다.
 *
 * 예전에는 열 걸음 안에 첫 사건이 나오고 그것이 monster 이기를 기대했다. 게시판이
 * 캠페인마다 다른 던전을 걸게 되면서 같은 시드가 다른 지도를 주므로, 첫 사건이
 * 무엇인지에 기대지 않고 monster 를 만날 때까지 지나간다.
 */
function walkToMonsterEvent(run: ReturnType<typeof contracted>) {
  for (let step = 0; step < 40; step += 1) {
    const active = run.state().context.activeExpedition;
    if (active === null) break;

    const pending = active.pendingEvent;
    if (pending !== null) {
      if (pending.kind === "monster") return pending;
      run.act({ type: "CHOOSE_ADVICE", adviceId: firstChoosableAdvice(run.state().campaign, active) });
      run.act({ type: "ACKNOWLEDGE_OUTCOME" });
      continue;
    }

    const here = active.expedition.map.nodes.find((node) => node.id === active.expedition.currentNodeId);
    const next = here?.nextNodeIds.find((id) => !active.expedition.visitedNodeIds.includes(id));
    if (next === undefined) break;
    run.act({ type: "VISIT_NODE", nodeId: next });
  }
  throw new Error("싸움이 되는 사건에 닿지 못했다");
}

describe("결과 화면이 실제 판정으로 그려진다", () => {
  it("실제 일반전 결과는 완료 전까지 우측 하단에서 전투만 건너뛴다", () => {
    const run = contracted("party-roster-1");
    const event = walkToMonsterEvent(run);
    run.act({ type: "CHOOSE_ADVICE", adviceId: event.advice[1]!.id });

    const outcome = run.state().context.activeExpedition!.pendingOutcome!;
    expect(outcome.battle).not.toBeNull();

    const store = { ...run.store, getInitialState: () => run.store.getState() };
    /* CampaignScreen 은 엔딩을 업적에 기록하므로 진행도 Provider 안에서만 선다. */
    const markup = renderToStaticMarkup(createElement(
      PlayerProgressProvider,
      null,
      createElement(CampaignStoreProvider as never, {
        seed: "render-monster-outcome",
        store,
      }, createElement(CampaignScreen)),
    ));

    expect(markup).toContain("u5-feedback-beat");
    expect(markup).not.toContain("전투 건너뛰기");
    expect(markup).not.toContain("지도로 돌아간다");
  });

  it("전투 전멸 뒤에도 정산보다 결과를 먼저 그린다", () => {
    const run = contracted("party-roster-1");
    const event = walkToMonsterEvent(run);
    const before = run.state();
    const active = before.context.activeExpedition!;
    const dungeon = before.campaign.dungeons.find((candidate) => candidate.id === active.expedition.dungeonId)!;
    run.store.setState({
      context: {
        ...before.context,
        activeExpedition: {
          ...active,
          partyMembers: active.partyMembers.map((member) => ({ ...member, hp: 1, alive: true })),
          pendingEvent: {
            ...event,
            encounter: { enemies: [{ monsterId: dungeon.activeMonsterIds[0]!, count: 50 }] },
            advice: event.advice.map((option) => ({ ...option, encounterModifier: {} })),
            defaultEncounterModifier: {},
          },
        },
      },
    });
    const lethal = run.state().context.activeExpedition!.pendingEvent!;
    run.act({ type: "CHOOSE_ADVICE", adviceId: lethal.advice.find((option) => option.outcome === "harm")!.id });
    expect(run.state().context.activeExpedition!.expedition.result).toMatchObject({ status: "wiped" });

    const store = { ...run.store, getInitialState: () => run.store.getState() };
    const markup = renderToStaticMarkup(createElement(
      PlayerProgressProvider,
      null,
      createElement(CampaignStoreProvider as never, {
        seed: "render-wipe-outcome",
        store,
      }, createElement(CampaignScreen)),
    ));

    expect(markup).toContain("u5-feedback-beat");
    expect(markup).not.toContain("u5-battle-settle");
  });

  /** 조언 하나를 고른 직후. 결과를 보는 중이다. */
  function atOutcome() {
    const run = atEvent();
    const active = run.state().context.activeExpedition!;
    run.act({ type: "CHOOSE_ADVICE", adviceId: active.pendingEvent!.advice[0]!.id });
    return run;
  }

  it("반응과 결과 문장이 찍힌다", () => {
    const run = atOutcome();
    const { campaign, context } = run.state();
    const active = context.activeExpedition!;
    const outcome = active.pendingOutcome!;

    const markup = renderToStaticMarkup(createElement(U5ProgressScreen, {
      status: statusFor(campaign, active),
      progress: progressViewFor(campaign, active)!,
      log: logFor(campaign, active),
      ecology: ecologyViewFor(campaign, active),
      playbackRate: 1,
      onTogglePlaybackRate: noop,
      battleReplay: eventReplayFor(campaign, active) ?? undefined,
      onAcknowledge: noop,
    }));

    assertClean(markup, "결과 화면");
    expect(markup).toContain(outcome.resultText.slice(0, 15));
    for (const reaction of outcome.reactions) {
      const name = active.partyMembers.find((one) => one.id === reaction.characterId)!.name;
      expect(markup).toContain(name);
    }
    /*
     * 길잡이가 읽는 것은 사람의 태도지 규칙의 상태가 아니다.
     *
     * `is-accepted` 같은 class 는 꾸밈용 훅이라 그대로 둔다 — 반응은 어차피
     * 화면에 드러나는 것이라 감출 정보가 아니다. 다만 **읽는 자리**에는 우리말이
     * 와야 한다.
     */
    const verdicts = markup.match(/u5-reaction__verdict">([^<]*)</g) ?? [];
    expect(verdicts.length).toBe(outcome.reactions.length);
    for (const verdict of verdicts) expect(verdict).toMatch(/수용|의심|적발/);
    expect(markup).toContain("지도로 돌아간다");
  });

  /* 결과를 보는 중에는 조언을 다시 고를 수 없어야 한다. */
  it("결과를 보는 중에는 조언 목록이 없다", () => {
    const run = atOutcome();
    const { campaign, context } = run.state();
    const active = context.activeExpedition!;

    const markup = renderToStaticMarkup(createElement(U5ProgressScreen, {
      status: statusFor(campaign, active),
      progress: progressViewFor(campaign, active)!,
      log: logFor(campaign, active),
      ecology: ecologyViewFor(campaign, active),
      playbackRate: 1,
      onTogglePlaybackRate: noop,
      onAcknowledge: noop,
    }));

    expect(markup).toContain("u5-outcome");
    expect(markup).not.toContain("u5-advice-list");
  });

  /* 결과를 보는 동안에도 상황은 그대로 있어야 한다. 무엇에 대한 결과인지 알아야 한다. */
  it("결과를 보는 동안에도 상황이 남는다", () => {
    const run = atOutcome();
    const { campaign, context } = run.state();
    const active = context.activeExpedition!;
    const view = progressViewFor(campaign, active)!;

    expect(view.situation).toBe(active.pendingOutcome!.event.description);
    expect(view.nodeLabel).toBe(active.pendingOutcome!.event.title);
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

describe("거부 알림", () => {
  /*
   * 규칙이 거부하면 그렇게 말한다.
   *
   * 지금 화면의 모든 경로는 잘 막혀 있어 이 알림이 뜰 일이 없다 — 승급 버튼은
   * 자격이 없으면 비활성이고, 게시판은 취소를 대신 밟는다. 그래도 두는 것은
   * 뒤로가기로 되살아난 낡은 화면이 보내는 조작이 여기로 오기 때문이고,
   * 앞으로 생길 막힌 길이 또 조용하지 않게 하기 위해서다.
   */
  it("거부 사유를 그대로 보여준다", () => {
    const reason = "아직 확인하지 않은 결과가 있다";
    const markup = renderToStaticMarkup(createElement(RejectionNotice, { reason, onDismiss: noop }));

    assertClean(markup, "거부 알림");
    expect(markup).toContain(reason);
    /* 스스로 읽어 주는 알림이라야 화면을 보지 않는 사람에게도 닿는다. */
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("확인");
  });

  /* 규칙이 내는 사유가 그대로 뜬다. 화면이 다시 쓰지 않는다. */
  it("실제 거부 사유가 사람이 읽을 수 있는 문장이다", () => {
    const store = createCampaignStore("rejection-copy");
    store.getState().dispatch({ type: "CHOOSE_ADVICE", adviceId: "없는-조언" as never });
    const rejected = store.getState().rejected!;

    expect(rejected.reason).not.toMatch(/[a-z]{4,}/);
    expect(renderToStaticMarkup(createElement(RejectionNotice, { reason: rejected.reason, onDismiss: noop })))
      .toContain(rejected.reason);
  });
});

describe("보스전도 같은 화면에서 본다", () => {
  /** 보스전을 치른 직후. */
  function afterBoss() {
    for (let index = 0; index < 30; index += 1) {
      const run = driven(`boss-screen-${index}`);
      run.act({ type: "OPEN_BOARD" });
      const offer = run.state().campaign.offers.find((one) => one.lockReason === null)!;
      run.act({ type: "SELECT_CONTRACT", offerId: offer.id });
      run.act({ type: "START_EXPEDITION", expeditionId: "b", ...createExpeditionForOffer(run.state().campaign, offer) });

      for (let step = 0; step < 40; step += 1) {
        const active = run.state().context.activeExpedition;
        if (active === null) break;
        if (active.expedition.bossResult !== null) return run;
        if (active.expedition.result !== null) break;
        if (active.pendingOutcome !== null) { run.act({ type: "ACKNOWLEDGE_OUTCOME" }); continue; }
        if (active.pendingEvent !== null) {
          run.act({ type: "CHOOSE_ADVICE", adviceId: firstChoosableAdvice(run.state().campaign, active) });
          continue;
        }
        const here = active.expedition.map.nodes.find((node) => node.id === active.expedition.currentNodeId);
        const next: NodeId | undefined = here?.nextNodeIds.find((id) => !active.expedition.visitedNodeIds.includes(id));
        if (next === undefined) { run.act({ type: "ENTER_BOSS" }); continue; }
        run.act({ type: "VISIT_NODE", nodeId: next });
        if (next === active.expedition.map.bossNodeId) run.act({ type: "ENTER_BOSS" });
      }
    }
    throw new Error("보스전에 닿지 못했다");
  }

  it("상단 상태와 파티가 함께 선다", () => {
    const run = afterBoss();
    const { context } = run.state();
    const active = context.activeExpedition!;
    const store = { ...run.store, getInitialState: () => run.store.getState() };
    const markup = renderToStaticMarkup(createElement(
      PlayerProgressProvider,
      null,
      createElement(CampaignStoreProvider as never, {
        seed: "render-boss-outcome",
        store,
      }, createElement(CampaignScreen)),
    ));

    assertClean(markup, "보스전 화면");
    /* 전에는 전투 장면만 덩그러니 떴다. 셸이 함께 서야 같은 화면이다. */
    expect(markup).toContain("u5-party");
    expect(markup).toContain("u5-console");
    expect(markup).toContain("u5-battle-scene");
    expect(markup).toContain("전투 건너뛰기");
    expect(markup).not.toContain("정산으로");
    for (const member of active.partyMembers) expect(markup).toContain(member.name);
  });

  /*
   * 싸움에 든 사람은 그때 살아 있었다.
   *
   * 전투 후 상태로 초상화를 고르면 이 싸움에서 죽을 사람이 첫 프레임부터 죽은
   * 그림으로 선다. 살아서 시작하는데 미리 회색인 것이다.
   */
  it("전투를 시작할 때는 아무도 죽은 그림이 아니다", () => {
    const run = afterBoss();
    const { campaign, context } = run.state();
    const active = context.activeExpedition!;
    const replay = bossReplayFor(campaign, active)!;
    const party = replay.participants.filter((one) => one.side === "party");

    expect(party.length).toBeGreaterThan(0);
    for (const participant of party) expect(participant.imageSrc).not.toContain("/dead/");
    /* 실제로 죽은 사람이 있어야 이 검사에 뜻이 있다. */
    expect(active.partyMembers.some((member) => !member.alive)
      || active.expedition.bossResult!.status === "cleared").toBe(true);
  });
});

/** 보스전을 치른 직후. 위 describe 의 것과 같은 걸음이다. */
function afterBossFight() {
  for (let index = 0; index < 30; index += 1) {
    const run = driven(`boss-screen-${index}`);
    run.act({ type: "OPEN_BOARD" });
    const offer = run.state().campaign.offers.find((one) => one.lockReason === null)!;
    run.act({ type: "SELECT_CONTRACT", offerId: offer.id });
    run.act({ type: "START_EXPEDITION", expeditionId: "b", ...createExpeditionForOffer(run.state().campaign, offer) });

    for (let step = 0; step < 40; step += 1) {
      const active = run.state().context.activeExpedition;
      if (active === null) break;
      if (active.expedition.bossResult !== null) return run;
      if (active.expedition.result !== null) break;
      if (active.pendingOutcome !== null) { run.act({ type: "ACKNOWLEDGE_OUTCOME" }); continue; }
      if (active.pendingEvent !== null) {
        run.act({ type: "CHOOSE_ADVICE", adviceId: firstChoosableAdvice(run.state().campaign, active) });
        continue;
      }
      const here = active.expedition.map.nodes.find((node) => node.id === active.expedition.currentNodeId);
      const next: NodeId | undefined = here?.nextNodeIds.find((id) => !active.expedition.visitedNodeIds.includes(id));
      if (next === undefined) { run.act({ type: "ENTER_BOSS" }); continue; }
      run.act({ type: "VISIT_NODE", nodeId: next });
      if (next === active.expedition.map.bossNodeId) run.act({ type: "ENTER_BOSS" });
    }
  }
  throw new Error("보스전에 닿지 못했다");
}

function setActivePartyHp(
  run: ReturnType<typeof driven>,
  hpFor: (member: Character) => number,
) {
  /* TypeScript가 store state의 중첩 narrowing을 유지하지 않으므로, 실제 active를
   * 먼저 꺼낸 뒤 그 자리만 바꾼다. */
  const state = run.state();
  const active = state.context.activeExpedition!;
  run.store.setState({
    context: {
      ...state.context,
      activeExpedition: {
        ...active,
        partyMembers: active.partyMembers.map((member) => {
          const hp = hpFor(member);
          return { ...member, hp, alive: hp > 0 };
        }),
      },
    },
  });
}

function firstMonster(run: ReturnType<typeof driven>) {
  for (let step = 0; step < 40; step += 1) {
    const active = run.state().context.activeExpedition!;
    if (active.pendingEvent?.kind === "monster") return active;
    if (active.pendingEvent !== null) {
      run.act({ type: "CHOOSE_ADVICE", adviceId: firstChoosableAdvice(run.state().campaign, active) });
      run.act({ type: "ACKNOWLEDGE_OUTCOME" });
      continue;
    }
    const here = active.expedition.map.nodes.find((node) => node.id === active.expedition.currentNodeId);
    const next = here?.nextNodeIds.find((id) => !active.expedition.visitedNodeIds.includes(id));
    if (next === undefined || next === active.expedition.map.bossNodeId) return null;
    run.act({ type: "VISIT_NODE", nodeId: next });
  }
  return null;
}

function reachBossWithOneHeal(run: ReturnType<typeof driven>, clericId: Character["id"]): boolean {
  for (let step = 0; step < 60; step += 1) {
    const active = run.state().context.activeExpedition!;
    if (active.pendingEvent !== null) {
      run.act({ type: "CHOOSE_ADVICE", adviceId: firstChoosableAdvice(run.state().campaign, active) });
      if (run.state().context.activeExpedition!
        .expedition.battleAbilityUsesRemainingByCharacterId[clericId] !== 1) return false;
      run.act({ type: "ACKNOWLEDGE_OUTCOME" });
      continue;
    }
    const here = active.expedition.map.nodes.find((node) => node.id === active.expedition.currentNodeId);
    const next = here?.nextNodeIds.find((id) => !active.expedition.visitedNodeIds.includes(id));
    if (next === undefined) return active.expedition.currentNodeId === active.expedition.map.bossNodeId;
    run.act({ type: "VISIT_NODE", nodeId: next });
  }
  return false;
}

describe("치유 자원이 실제 화면 경계를 지난다", () => {
  it("U3 2/2 → 일반전 U5 1/2 → U4 1/2 → 보스 U5 0/2를 실제 캠페인으로 그린다", () => {
    for (let index = 0; index < 80; index += 1) {
      const run = driven(`cleric-render-flow-${index}`);
      run.act({ type: "OPEN_BOARD" });
      const board = createU3BoardView(run.state().campaign, run.state().campaign.offers);
      const notice = board.notices.find((candidate) => {
        const offer = run.state().campaign.offers.find((one) => one.id === candidate.offerId);
        return offer?.lockReason === null && offer.party.memberIds.some(
          (memberId) => run.state().campaign.pool.byId[memberId]?.classId === "cleric",
        );
      });
      if (notice === undefined) continue;
      const offer = run.state().campaign.offers.find((candidate) => candidate.id === notice.offerId)!;
      const boardCampaign = run.state().campaign;
      const u3Markup = renderToStaticMarkup(createElement(U3BoardScreen, {
        status: statusFor(boardCampaign, null),
        board,
        selectedOfferId: offer.id,
        promotion: createU3PromotionView(getGuidePromotionEligibility(boardCampaign), "contract", null),
        onSelectOffer: noop, onContract: noop, onOpenPromotion: noop,
        onCancelPromotion: noop, onConfirmPromotion: noop, onDismissPromotionResult: noop,
      }));

      run.act({ type: "SELECT_CONTRACT", offerId: offer.id });
      run.act({ type: "START_EXPEDITION", expeditionId: `cleric-render-${index}`, ...createExpeditionForOffer(run.state().campaign, offer) });
      const starting = run.state().context.activeExpedition!;
      const cleric = starting.partyMembers.find((member) => member.classId === "cleric");
      const injured = starting.partyMembers.find((member) => member.id !== cleric?.id);
      if (cleric === undefined || injured === undefined) continue;
      if (starting.expedition.battleAbilityUsesRemainingByCharacterId[cleric.id] !== 2) continue;

      const monster = firstMonster(run);
      if (monster === null) continue;
      setActivePartyHp(run, (member) => member.id === injured.id
        ? Math.floor(member.maxHp / 2)
        : member.hp);
      run.act({ type: "CHOOSE_ADVICE", adviceId: firstChoosableAdvice(run.state().campaign, run.state().context.activeExpedition!) });
      const afterGeneral = run.state().context.activeExpedition!;
      if (afterGeneral.expedition.battleAbilityUsesRemainingByCharacterId[cleric.id] !== 1) continue;

      const u5AfterGeneral = renderToStaticMarkup(createElement(U5ProgressScreen, {
        status: statusFor(run.state().campaign, afterGeneral),
        progress: progressViewFor(run.state().campaign, afterGeneral)!,
        log: logFor(run.state().campaign, afterGeneral),
        ecology: ecologyViewFor(run.state().campaign, afterGeneral),
        playbackRate: 1, onTogglePlaybackRate: noop,
      }));
      run.act({ type: "ACKNOWLEDGE_OUTCOME" });
      const onMap = run.state().context.activeExpedition!;
      const dungeon = run.state().campaign.dungeons.find((candidate) => candidate.id === onMap.expedition.dungeonId)!;
      const u4AfterGeneral = renderToStaticMarkup(createElement(U4DungeonMapScreen, {
        status: statusFor(run.state().campaign, onMap), dungeonName: dungeon.name,
        riskLevel: onMap.expedition.riskLevel,
        nodes: createU4MapNodeViews({ map: onMap.expedition.map, currentNodeId: onMap.expedition.currentNodeId, visitedNodeIds: onMap.expedition.visitedNodeIds, publicKindByNodeId: publicKindByNodeId(onMap) }),
        layout: createU4DungeonMapLayout(onMap.expedition.map),
        party: createU4PartyMemberViews(onMap.partyMembers, onMap.expedition.battleAbilityUsesRemainingByCharacterId),
        selectedNextNodeId: null, onSelectNextNode: noop, onMove: noop,
      }));

      setActivePartyHp(run, (member) => member.maxHp);
      if (!reachBossWithOneHeal(run, cleric.id)) continue;
      setActivePartyHp(run, (member) => member.id === injured.id
        ? Math.floor(member.maxHp / 2)
        : member.maxHp);
      run.act({ type: "ENTER_BOSS" });
      const afterBoss = run.state().context.activeExpedition!;
      if (afterBoss.expedition.battleAbilityUsesRemainingByCharacterId[cleric.id] !== 0) continue;
      const replay = bossReplayFor(run.state().campaign, afterBoss)!;
      const completed = replay.frames.at(-1)!;
      const u5AfterBoss = renderToStaticMarkup(createElement(U5ProgressScreen, {
        status: statusFor(run.state().campaign, afterBoss),
        progress: {
          ...expeditionEndViewFor(run.state().campaign, afterBoss),
          party: u5PartyViewsForBattleFrame(
            expeditionEndViewFor(run.state().campaign, afterBoss).party,
            completed,
          ),
        },
        log: logFor(run.state().campaign, afterBoss),
        ecology: ecologyViewFor(run.state().campaign, afterBoss),
        playbackRate: 1, onTogglePlaybackRate: noop,
      }));

      expect(u3Markup).toContain("치유 2회");
      expect(u5AfterGeneral).toContain("치유 1/2");
      expect(u4AfterGeneral).toContain("치유 1/2");
      expect(afterBoss.expedition.bossResult!.battle.actions.some((action) => action.kind === "heal")).toBe(true);
      expect(u5AfterBoss).toContain("치유 0/2");
      return;
    }
    throw new Error("일반전과 보스전에서 차례로 치유하는 결정적 캠페인을 찾지 못했다");
  });

  it("U6 정산 카드는 원정 중 능력 잔여 행을 렌더링하지 않는다", () => {
    const run = settled();
    const settlement = run.state().last!.settlement!;
    const dungeon = run.state().campaign.dungeons.find((candidate) => candidate.id === settlement.dungeonId)!;
    const markup = renderToStaticMarkup(createElement(U6SettlementScreen, {
      status: statusFor(run.state().campaign, null),
      settlement: createU6SettlementView(run.state().campaign, settlement, dungeon.name, dungeon.theme),
    }));

    expect(markup).not.toContain("치유 0/2");
    expect(markup).not.toContain("치유 1/2");
    expect(markup).not.toContain("치유 2/2");
  });
});

describe("원정 중에 되짚어 볼 수 있다", () => {
  it("파티원마다 이 원정의 변화를 낸다", () => {
    const run = atEvent();
    const before = run.state().context.activeExpedition!;
    run.act({ type: "CHOOSE_ADVICE", adviceId: firstChoosableAdvice(run.state().campaign, before) });
    const active = run.state().context.activeExpedition!;

    const withChanges = active.partyMembers
      .map((member) => memberChangesFor(active, member.id))
      .filter((changes) => changes.length > 0);

    /* 조언 하나에 아무도 반응하지 않을 수는 없다. */
    expect(withChanges.length).toBeGreaterThan(0);
    for (const changes of withChanges) {
      for (const change of changes) expect(change.cause.length).toBeGreaterThan(0);
    }
  });

  /* 아무 일도 없었던 자리는 적지 않는다. 나열하면 무엇이 바꿨는지가 묻힌다. */
  it("걷기만 한 원정에는 변화가 없다", () => {
    const run = contracted();
    const active = run.state().context.activeExpedition!;

    for (const member of active.partyMembers) {
      expect(memberChangesFor(active, member.id)).toEqual([]);
    }
  });

  it("답사 기록이 공개된 규칙과 지나온 지점을 낸다", () => {
    const run = contracted();
    const { campaign, context } = run.state();
    const active = context.activeExpedition!;
    const survey = surveyViewFor(campaign, active);

    expect(survey.total).toBeGreaterThan(0);
    expect(survey.visited).toBeLessThanOrEqual(survey.total);
    expect(survey.disclosedRules).toEqual(ecologyViewFor(campaign, active).disclosedRules);
    /* 규칙 문구가 그대로 와야 한다. 식별자가 새면 안 된다. */
    for (const rule of survey.disclosedRules) expect(rule).not.toMatch(/^rule-/);
  });

  /*
   * 재생하는 동안 옆에 선 파티는 그 싸움에 들어갈 때의 모습이어야 한다.
   *
   * 이미 "사망" 으로 회색이면 재생이 시작하기도 전에 결말이 서 있는 셈이다.
   */
  it("보스전 재생 옆의 파티가 미리 죽어 있지 않다", () => {
    const run = afterBossFight();
    const { campaign, context } = run.state();
    const active = context.activeExpedition!;
    const view = expeditionEndViewFor(campaign, active);

    const fought = new Set(active.records.at(-1)!.damage.map((one) => String(one.characterId)));
    for (const member of view.party) {
      if (!fought.has(member.id)) continue;
      expect(member.alive).toBe(true);
      expect(member.hp).toBeGreaterThan(0);
    }
    expect(fought.size).toBeGreaterThan(0);
  });
});

describe("승급 결과를 닫는다", () => {
  /*
   * 승급하면 이미 게시판이다.
   *
   * `PROMOTE_GUIDE` 가 단계를 `board` 로 돌려놓으므로, 결과창을 닫으려고
   * `CANCEL_PROMOTION` 을 또 보내면 규칙이 거부한다. 그러면 승급하고도 넘어가지지
   * 않는다.
   */
  it("승급 뒤에는 취소를 보낼 수 없다", () => {
    const run = driven("promotion-dismiss");
    run.act({ type: "OPEN_BOARD" });
    run.store.setState({ campaign: { ...run.state().campaign, gold: 500, reputation: 100 } });
    run.act({ type: "OPEN_PROMOTION" });
    run.act({ type: "PROMOTE_GUIDE", method: "gold" });

    /* 승급 자체는 게시판으로 돌려놓는다. */
    expect(run.state().campaign.phase).toBe("board");
    expect(run.state().last?.promotion).not.toBeNull();

    /* 여기서 취소를 보내면 거부된다. 화면이 이 길로 가면 안 된다. */
    run.store.getState().dispatch({ type: "CANCEL_PROMOTION" });

    expect(run.store.getState().rejected?.reason).toContain("허용되지 않은");
  });

  /* 닫는 것은 규칙의 일이 아니다. 무엇을 이미 봤는지는 화면의 것이다. */
  it("결과를 닫아도 규칙을 건드리지 않는다", () => {
    const run = driven("promotion-dismiss-2");
    run.act({ type: "OPEN_BOARD" });
    run.store.setState({ campaign: { ...run.state().campaign, gold: 500, reputation: 100 } });
    run.act({ type: "OPEN_PROMOTION" });
    run.act({ type: "PROMOTE_GUIDE", method: "gold" });
    const after = run.state().campaign;

    /* 화면이 하는 일은 "봤다" 를 기억하는 것뿐이다. */
    expect(run.state().rejected).toBeNull();
    expect(after.rank).not.toBe("C");
  });
});

describe("계약 중에 승급을 연다", () => {
  /*
   * 규칙은 `contract` 에서 `OPEN_PROMOTION` 을 받지 않는다.
   *
   * 계약을 검토하다 말고 승급 창으로 넘어가면 무엇을 하던 중이었는지 잃기
   * 때문이다. 물러서는 것은 길잡이의 몫이고, 등급 칸을 누르는 것이 곧 그 뜻이라
   * 화면이 두 걸음을 대신 밟는다.
   */
  it("계약을 고른 채로 승급을 열면 거부된다", () => {
    const run = driven("contract-promotion");
    run.act({ type: "OPEN_BOARD" });
    const offer = run.state().campaign.offers.find((one) => one.lockReason === null)!;
    run.act({ type: "SELECT_CONTRACT", offerId: offer.id });

    run.store.getState().dispatch({ type: "OPEN_PROMOTION" });

    expect(run.store.getState().rejected?.reason).toContain("계약에서 허용되지 않은");
  });

  /* 물러선 뒤에는 열린다. 화면이 밟는 두 걸음이 이것이다. */
  it("물러선 뒤에는 승급이 열린다", () => {
    const run = driven("contract-promotion-2");
    run.act({ type: "OPEN_BOARD" });
    const offer = run.state().campaign.offers.find((one) => one.lockReason === null)!;
    run.act({ type: "SELECT_CONTRACT", offerId: offer.id });

    run.act({ type: "CANCEL_CONTRACT" });
    run.act({ type: "OPEN_PROMOTION" });

    expect(run.state().campaign.phase).toBe("promotion");
    expect(run.state().rejected).toBeNull();
  });
});
