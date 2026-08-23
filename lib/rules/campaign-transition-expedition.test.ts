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
import { transitionCampaign } from "./campaign-transition";

/**
 * 원정 안쪽 전이.
 *
 * C7 은 원정을 시작하고 끝내는 것만 다뤘고 그 사이가 없었다. 지점을 고르고
 * 조언을 고르고 보스방에 이르는 흐름을 여기서 고정한다. `expedition-sequence`
 * 가 정한 순서를 그대로 따른다.
 */

const SEED = "c7-inner-loop";

function boardedCampaign(): { campaign: CampaignState; context: CampaignTransitionContext } {
  const initial = initializeCampaign(SEED);
  const opened = transitionCampaign(initial, createCampaignTransitionContext(), { type: "OPEN_BOARD" });
  return { campaign: opened.campaign, context: opened.context };
}

function started(): CampaignTransitionResult {
  const { campaign, context } = boardedCampaign();
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
