import { describe, expect, it } from "vitest";
import { RuleError, createCampaignTransitionContext } from "@/lib/domain";
import type {
  CampaignState,
  CampaignTransitionContext,
  CampaignTransitionResult,
  Character,
  ExpeditionState,
  NodeId,
} from "@/lib/domain";
import { initializeCampaign } from "./campaign-init";
import { generateDungeonMap } from "./dungeon-map";
import { createExpeditionForOffer, transitionCampaign } from "./campaign-transition";

/**
 * 원정 안쪽 전이.
 *
 * C7 은 원정을 시작하고 끝내는 것만 다뤘고 그 사이가 없었다. 지점을 고르고
 * 조언을 고르고 보스방에 이르는 흐름을 여기서 고정한다. `expedition-sequence`
 * 가 정한 순서를 그대로 따른다.
 */

const SEED = "c7-inner-loop";

function boardedCampaign(seed: string = SEED): { campaign: CampaignState; context: CampaignTransitionContext } {
  const initial = initializeCampaign(seed);
  const opened = transitionCampaign(initial, createCampaignTransitionContext(), { type: "OPEN_BOARD" });
  return { campaign: opened.campaign, context: opened.context };
}

function started(): CampaignTransitionResult {
  return startedWith(SEED);
}

/** 시드를 바꿔 가며 여러 판을 걷고 싶을 때 쓴다. */
function startedWith(seed: string): CampaignTransitionResult {
  const { campaign, context } = boardedCampaign(seed);
  const offer = campaign.offers.find((candidate) => candidate.lockReason === null);
  if (offer === undefined) throw new Error("계약 가능한 공고가 없다");

  const selected = transitionCampaign(campaign, context, { type: "SELECT_CONTRACT", offerId: offer.id });
  const dungeon = selected.campaign.dungeons.find((candidate) => candidate.id === offer.dungeonId)!;
  const map = generateDungeonMap({
    campaignSeed: selected.campaign.seed,
    dungeonId: dungeon.id,
    initialRiskLevel: dungeon.initialRiskLevel,
    attempt: dungeon.attempts,
  });
  const partyMembers = offer.party.memberIds
    .map((id) => selected.campaign.pool.byId[id])
    .filter((member): member is Character => member !== undefined);

  const expedition: ExpeditionState = {
    dungeonId: dungeon.id,
    riskLevel: dungeon.riskLevel,
    party: offer.party,
    activeRuleIds: dungeon.activeRuleIds,
    disclosedRuleIds: [],
    map,
    currentNodeId: map.entryNodeId,
    visitedNodeIds: [map.entryNodeId],
    infoRecords: [],
    pendingMerchantEffect: null,
    bossResult: null,
    result: null,
  };

  return transitionCampaign(selected.campaign, selected.context, {
    type: "START_EXPEDITION",
    expeditionId: "exp-inner-01",
    expedition,
    partyMembers,
  });
}

function firstStep(result: CampaignTransitionResult): NodeId {
  const active = result.context.activeExpedition!;
  const current = active.expedition.map.nodes.find((node) => node.id === active.expedition.currentNodeId)!;
  return current.nextNodeIds[0]!;
}

describe("원정 안쪽 전이", () => {
  it("이어지지 않은 지점을 거부한다", () => {
    const begun = started();
    const far = begun.context.activeExpedition!.expedition.map.bossNodeId;

    expect(() => transitionCampaign(begun.campaign, begun.context, { type: "VISIT_NODE", nodeId: far }))
      .toThrow(RuleError);
  });

  it("이미 방문한 지점을 거부한다", () => {
    const begun = started();
    const entry = begun.context.activeExpedition!.expedition.currentNodeId;

    expect(() => transitionCampaign(begun.campaign, begun.context, { type: "VISIT_NODE", nodeId: entry }))
      .toThrow(RuleError);
  });

  it("지점을 밟으면 그 자리의 사건이 확정된다", () => {
    const begun = started();
    const visited = transitionCampaign(begun.campaign, begun.context, {
      type: "VISIT_NODE", nodeId: firstStep(begun),
    });
    const active = visited.context.activeExpedition!;

    expect(active.pendingEvent).not.toBeNull();
    expect(active.pendingEvent!.advice).toHaveLength(3);
    expect(active.preparedEvents).not.toBeNull();
    expect(active.expedition.visitedNodeIds).toHaveLength(2);
  });

  /* 조언을 고르지 않은 채로 다음 지점에 가면 사건 하나가 통째로 사라진다. */
  it("조언을 고르지 않고 다음 지점으로 갈 수 없다", () => {
    const begun = started();
    const visited = transitionCampaign(begun.campaign, begun.context, {
      type: "VISIT_NODE", nodeId: firstStep(begun),
    });

    expect(() => transitionCampaign(visited.campaign, visited.context, {
      type: "VISIT_NODE", nodeId: firstStep(visited),
    })).toThrow(RuleError);
  });

  it("그 사건에 없는 조언을 거부한다", () => {
    const begun = started();
    const visited = transitionCampaign(begun.campaign, begun.context, {
      type: "VISIT_NODE", nodeId: firstStep(begun),
    });

    expect(() => transitionCampaign(visited.campaign, visited.context, {
      type: "CHOOSE_ADVICE", adviceId: "없는-조언" as never,
    })).toThrow(RuleError);
  });

  it("조언을 고르면 사건이 닫히고 다음 지점으로 갈 수 있다", () => {
    const begun = started();
    const visited = transitionCampaign(begun.campaign, begun.context, {
      type: "VISIT_NODE", nodeId: firstStep(begun),
    });
    const event = visited.context.activeExpedition!.pendingEvent!;
    const chosen = transitionCampaign(visited.campaign, visited.context, {
      type: "CHOOSE_ADVICE", adviceId: event.advice[0]!.id,
    });

    expect(chosen.context.activeExpedition!.pendingEvent).toBeNull();
    expect(() => transitionCampaign(chosen.campaign, chosen.context, {
      type: "VISIT_NODE", nodeId: firstStep(chosen),
    })).not.toThrow();
  });

  /*
   * 계획이 이어지는지를 기전으로 본다.
   *
   * 처음에는 "같은 사건이 두 번 나오지 않는다" 로만 적었는데, 계획을 매번 새로
   * 만들도록 일부러 망가뜨려도 통과했다. 노드마다 시드가 달라 짧은 걸음에서는
   * 겹치지 않기 때문이다. 사용한 사건 목록이 실제로 쌓이는지를 본다.
   */
  it("사용한 사건 목록이 방문 사이에 이어진다", () => {
    let state = started();
    const sizes: number[] = [];

    for (let step = 0; step < 4; step += 1) {
      const active = state.context.activeExpedition!;
      const current = active.expedition.map.nodes.find((node) => node.id === active.expedition.currentNodeId)!;
      const next = current.nextNodeIds.find((id) => !active.expedition.visitedNodeIds.includes(id));
      if (next === undefined) break;
      const target = active.expedition.map.nodes.find((node) => node.id === next)!;
      if (target.kind !== "normal") break;

      state = transitionCampaign(state.campaign, state.context, { type: "VISIT_NODE", nodeId: next });
      sizes.push(state.context.activeExpedition!.preparedEvents!.usedEventIds.size);
      const event = state.context.activeExpedition!.pendingEvent!;
      state = transitionCampaign(state.campaign, state.context, {
        type: "CHOOSE_ADVICE", adviceId: event.advice[0]!.id,
      });
    }

    expect(sizes.length).toBeGreaterThan(1);
    /* 방문마다 하나씩 늘어야 한다. 계획이 끊기면 계속 1 이다. */
    expect(sizes).toEqual(sizes.map((_, index) => index + 1));
  });

  it("같은 사건이 두 번 나오지 않는다", () => {
    let state = started();
    const seen: string[] = [];

    for (let step = 0; step < 4; step += 1) {
      const active = state.context.activeExpedition!;
      const current = active.expedition.map.nodes.find((node) => node.id === active.expedition.currentNodeId)!;
      const next = current.nextNodeIds.find((id) => !active.expedition.visitedNodeIds.includes(id));
      if (next === undefined) break;
      const target = active.expedition.map.nodes.find((node) => node.id === next)!;
      if (target.kind !== "normal") break;

      state = transitionCampaign(state.campaign, state.context, { type: "VISIT_NODE", nodeId: next });
      const event = state.context.activeExpedition!.pendingEvent!;
      seen.push(String(event.id));
      state = transitionCampaign(state.campaign, state.context, {
        type: "CHOOSE_ADVICE", adviceId: event.advice[0]!.id,
      });
    }

    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("보스방이 아니면 보스전에 들 수 없다", () => {
    const begun = started();

    expect(() => transitionCampaign(begun.campaign, begun.context, { type: "ENTER_BOSS" }))
      .toThrow(RuleError);
  });

  it("거부된 전이는 상태를 바꾸지 않는다", () => {
    const begun = started();
    const before = JSON.stringify(begun.context);

    try {
      transitionCampaign(begun.campaign, begun.context, { type: "ENTER_BOSS" });
    } catch { /* 거부는 정상이다 */ }

    expect(JSON.stringify(begun.context)).toBe(before);
  });

  it("같은 액션 순서는 같은 상태를 낸다", () => {
    const run = () => {
      const begun = started();
      const visited = transitionCampaign(begun.campaign, begun.context, {
        type: "VISIT_NODE", nodeId: firstStep(begun),
      });
      const event = visited.context.activeExpedition!.pendingEvent!;
      return transitionCampaign(visited.campaign, visited.context, {
        type: "CHOOSE_ADVICE", adviceId: event.advice[0]!.id,
      });
    };

    expect(JSON.stringify(run().context.activeExpedition!.expedition))
      .toBe(JSON.stringify(run().context.activeExpedition!.expedition));
  });
});

describe("공고에서 원정 상태를 만든다", () => {
  it("지도·공개 규칙·파티가 규칙에서 나온다", () => {
    const { campaign, context } = boardedCampaign();
    const offer = campaign.offers.find((one) => one.lockReason === null)!;
    const selected = transitionCampaign(campaign, context, { type: "SELECT_CONTRACT", offerId: offer.id });
    const built = createExpeditionForOffer(selected.campaign, offer);
    const dungeon = selected.campaign.dungeons.find((one) => one.id === offer.dungeonId)!;

    expect(built.partyMembers).toHaveLength(3);
    expect(built.expedition.map.entryNodeId).toBe(built.expedition.currentNodeId);
    expect(built.expedition.visitedNodeIds).toEqual([built.expedition.map.entryNodeId]);
    /* 계약 시점의 위험도다. 던전이 올라도 이 원정은 이 값으로 정산한다. */
    expect(built.expedition.riskLevel).toBe(dungeon.riskLevel);
    /* 공개 규칙 수는 위험도가 정한다. 활성 3개 중 일부만 나온다. */
    expect(built.expedition.disclosedRuleIds.length).toBeGreaterThan(0);
    expect(built.expedition.disclosedRuleIds.length).toBeLessThanOrEqual(3);
    for (const ruleId of built.expedition.disclosedRuleIds) {
      expect(built.expedition.activeRuleIds).toContain(ruleId);
    }
  });

  it("같은 시드는 같은 원정을 낸다", () => {
    const { campaign, context } = boardedCampaign();
    const offer = campaign.offers.find((one) => one.lockReason === null)!;
    const selected = transitionCampaign(campaign, context, { type: "SELECT_CONTRACT", offerId: offer.id });

    expect(JSON.stringify(createExpeditionForOffer(selected.campaign, offer)))
      .toBe(JSON.stringify(createExpeditionForOffer(selected.campaign, offer)));
  });

  it("만든 원정이 그대로 START_EXPEDITION 을 통과한다", () => {
    const { campaign, context } = boardedCampaign();
    const offer = campaign.offers.find((one) => one.lockReason === null)!;
    const selected = transitionCampaign(campaign, context, { type: "SELECT_CONTRACT", offerId: offer.id });
    const built = createExpeditionForOffer(selected.campaign, offer);

    expect(() => transitionCampaign(selected.campaign, selected.context, {
      type: "START_EXPEDITION", expeditionId: "exp-built-01", ...built,
    })).not.toThrow();
  });
});

describe("원정 이력", () => {
  /*
   * `C8-B` 가 그릇과 draft 함수를 만들어 두었는데 아무도 부르지 않고 있었다.
   * 정산의 원인 사슬과 엔딩의 전환점이 여기서 나온다.
   */
  it("조언마다 이력이 쌓인다", () => {
    let state = started();
    expect(state.campaign.history.events).toHaveLength(0);

    state = transitionCampaign(state.campaign, state.context, {
      type: "VISIT_NODE", nodeId: firstStep(state),
    });
    const event = state.context.activeExpedition!.pendingEvent!;
    state = transitionCampaign(state.campaign, state.context, {
      type: "CHOOSE_ADVICE", adviceId: event.advice[0]!.id,
    });

    expect(state.campaign.history.events).toHaveLength(1);
    const recorded = state.campaign.history.events[0]!;
    expect(recorded.type).toBe("ADVICE_RESOLVED");
    /* `CampaignEvent` 는 종류마다 모양이 다르다. 좁혀서 본다. */
    if (recorded.type !== "ADVICE_RESOLVED") throw new Error("조언 이력이 아니다");
    expect(recorded.expeditionId).toBe("exp-inner-01");
  });

  it("거부된 전이는 이력을 남기지 않는다", () => {
    const begun = started();

    try {
      transitionCampaign(begun.campaign, begun.context, { type: "CHOOSE_ADVICE", adviceId: "없는-조언" as never });
    } catch { /* 거부는 정상이다 */ }

    expect(begun.campaign.history.events).toHaveLength(0);
  });
});

/**
 * 전투에서 죽어도 파티 명단에서 사라지지 않는다.
 *
 * `resolveMonsterEventBattle` 은 살아 있는 사람만 데려간다. 그 결과를 그대로
 * 명단으로 삼으면 죽은 사람이 파티에서 사라지고, 정산이 「최종 파티원이 3명이
 * 아니다」로 거부한다.
 *
 * 사라지는 것은 **이미 죽어 있던** 사람이다. 빈사인 사람은 전투에 참가하므로
 * 결과에 남는다. 앞선 싸움에서 죽은 사람이 다음 싸움에 안 실려 가고, 그때
 * 명단에서 지워진다. 그래서 한 명을 죽은 채로 두고 싸움을 붙인다.
 */
describe("전투 뒤 파티 명단", () => {
  /** 한 명이 이미 죽은 채로 사건 앞까지 간다. */
  function atEventWithDeadMember() {
    /* 이 시드의 첫 사건이 실제로 싸움이 되는 monster 사건이다. */
    const begun = startedWith("party-roster-1");
    const active = begun.context.activeExpedition!;
    const weakened = {
      ...begun.context,
      activeExpedition: {
        ...active,
        partyMembers: active.partyMembers.map((member, index) =>
          index === 0 ? { ...member, hp: 0, alive: false } : member),
      },
    };

    let state: CampaignTransitionResult = { ...begun, context: weakened };
    for (let step = 0; step < 10; step += 1) {
      const current = state.context.activeExpedition!;
      if (current.pendingEvent !== null) return state;
      const here = current.expedition.map.nodes.find((node) => node.id === current.expedition.currentNodeId)!;
      const next = here.nextNodeIds.find((id) => !current.expedition.visitedNodeIds.includes(id));
      if (next === undefined) break;
      state = transitionCampaign(state.campaign, state.context, { type: "VISIT_NODE", nodeId: next });
    }
    throw new Error("사건이 확정되는 지점에 닿지 못했다");
  }

  it("이미 죽은 사람이 다음 전투에서 명단에서 사라지지 않는다", () => {
    const state = atEventWithDeadMember();
    const event = state.context.activeExpedition!.pendingEvent!;
    const fallen = state.context.activeExpedition!.partyMembers[0]!;
    expect(event.kind).toBe("monster");

    let deaths = 0;
    /* 세 조언 중 어느 것을 골라도 명단은 셋이어야 한다. */
    for (const option of event.advice) {
      const chosen = transitionCampaign(state.campaign, state.context, {
        type: "CHOOSE_ADVICE", adviceId: option.id,
      });
      const after = chosen.context.activeExpedition!.partyMembers;

      expect(after).toHaveLength(3);
      expect(after.map((member) => member.id)).toContain(fallen.id);
      /* 죽었으면 사라지는 것이 아니라 표시가 꺼진다. */
      const dead = after.filter((one) => !one.alive);
      deaths += dead.length;
      for (const member of dead) expect(member.hp).toBe(0);
    }

    /* 아무도 안 죽으면 이 검사는 아무것도 보지 않은 것이다. */
    expect(deaths).toBeGreaterThan(0);
  });
});
