import { describe, expect, it } from "vitest";
import { RuleError, createCampaignTransitionContext } from "@/lib/domain";
import type {
  ChoiceId,
  CampaignState,
  CampaignTransitionContext,
  CampaignTransitionResult,
  AdvicePressure,
  Character,
  ExpeditionState,
  NodeId,
} from "@/lib/domain";
import { eventsForTheme } from "@/lib/content/event-registry";
import { CLASSES } from "@/lib/content/classes";
import { initializeCampaign } from "./campaign-init";
import { createBattleAbilityUsesForParty } from "./battle-ability-state";
import { generateDungeonMap } from "./dungeon-map";
import { createExpeditionForOffer, createSettlementSnapshotFor, transitionCampaign } from "./campaign-transition";

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
    advicePressure: 0,
    battleAbilityUsesRemainingByCharacterId: createBattleAbilityUsesForParty({
      members: partyMembers,
      classDefs: CLASSES,
    }),
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

function resolveExecutedPressure(outcome: "help" | "harm", initial: AdvicePressure): AdvicePressure {
  for (let index = 0; index < 100; index += 1) {
    const begun = startedWith(`pressure-${outcome}-${index}`);
    const event = eventsForTheme("spider").find((candidate) =>
      candidate.kind === "rest" && candidate.advice.some((option) => option.outcome === outcome));
    if (event === undefined) throw new Error("rest 조언 fixture가 없다");
    const option = event.advice.find((candidate) => candidate.outcome === outcome)!;
    const active = begun.context.activeExpedition!;
    const context = {
      ...begun.context,
      activeExpedition: {
        ...active,
        expedition: { ...active.expedition, advicePressure: initial },
        pendingEvent: event,
      },
    };
    const next = transitionCampaign(begun.campaign, context, { type: "CHOOSE_ADVICE", adviceId: option.id });
    const pressure = next.context.activeExpedition!.expedition.advicePressure;
    if (pressure !== initial) return pressure;
  }
  throw new Error(`${outcome} executed 시드를 찾지 못했다`);
}

describe("원정 안쪽 전이", () => {
  it("실행된 도움과 방해 조언은 현재 원정 압력을 갱신한다", () => {
    expect(resolveExecutedPressure("harm", 0)).toBe(1);
    expect(resolveExecutedPressure("help", 2)).toBe(1);
  });

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

  /*
   * 조언을 고르면 사건이 닫히고 결과가 열린다.
   *
   * 결과를 보기 전에는 움직일 수 없다. 곧장 지도로 돌려보내면 자기 조언이 어떻게
   * 됐는지 모른 채 다음 갈림길에 서게 된다.
   */
  it("조언을 고르면 결과가 열리고, 확인해야 움직인다", () => {
    const begun = started();
    const visited = transitionCampaign(begun.campaign, begun.context, {
      type: "VISIT_NODE", nodeId: firstStep(begun),
    });
    const event = visited.context.activeExpedition!.pendingEvent!;
    const chosen = transitionCampaign(visited.campaign, visited.context, {
      type: "CHOOSE_ADVICE", adviceId: event.advice[0]!.id,
    });

    expect(chosen.context.activeExpedition!.pendingEvent).toBeNull();
    expect(chosen.context.activeExpedition!.pendingOutcome).not.toBeNull();
    expect(() => transitionCampaign(chosen.campaign, chosen.context, {
      type: "VISIT_NODE", nodeId: firstStep(chosen),
    })).toThrow(/확인하지 않은 결과/);

    const seen = transitionCampaign(chosen.campaign, chosen.context, { type: "ACKNOWLEDGE_OUTCOME" });

    expect(seen.context.activeExpedition!.pendingOutcome).toBeNull();
    expect(() => transitionCampaign(seen.campaign, seen.context, {
      type: "VISIT_NODE", nodeId: firstStep(seen),
    })).not.toThrow();
  });

  /* 결과에는 반응과 결과 문장이 실제로 들어 있어야 한다. 빈 화면이면 뜻이 없다. */
  it("결과가 반응과 결과 문장을 담는다", () => {
    const begun = started();
    const visited = transitionCampaign(begun.campaign, begun.context, {
      type: "VISIT_NODE", nodeId: firstStep(begun),
    });
    const event = visited.context.activeExpedition!.pendingEvent!;
    const chosen = transitionCampaign(visited.campaign, visited.context, {
      type: "CHOOSE_ADVICE", adviceId: event.advice[0]!.id,
    });
    const outcome = chosen.context.activeExpedition!.pendingOutcome!;

    expect(outcome.resultText.length).toBeGreaterThan(0);
    expect(outcome.reactions.length).toBeGreaterThan(0);
    expect(outcome.event.id).toBe(event.id);
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
      /* 결과를 확인해야 움직일 수 있다. 길잡이가 하는 것과 같다. */
      state = transitionCampaign(state.campaign, state.context, { type: "ACKNOWLEDGE_OUTCOME" });
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
      /* 결과를 확인해야 움직일 수 있다. 길잡이가 하는 것과 같다. */
      state = transitionCampaign(state.campaign, state.context, { type: "ACKNOWLEDGE_OUTCOME" });
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
    expect(built.expedition.advicePressure).toBe(0);
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

  it("새 원정과 재도전은 현재 파티의 능력 보유자만 2회로 다시 초기화한다", () => {
    let found: ReturnType<typeof boardedCampaign> | undefined;
    let offer: CampaignState["offers"][number] | undefined;
    for (let index = 0; index < 30 && offer === undefined; index += 1) {
      const candidate = boardedCampaign(`ability-expedition-${index}`);
      const candidateOffer = candidate.campaign.offers.find((one) =>
        one.lockReason === null
        && one.party.memberIds.some((id) => candidate.campaign.pool.byId[id]?.classId === "cleric"));
      if (candidateOffer !== undefined) {
        found = candidate;
        offer = candidateOffer;
      }
    }
    if (found === undefined || offer === undefined) throw new Error("성직자가 든 계약 fixture를 찾지 못했다");

    const initial = createExpeditionForOffer(found.campaign, offer);
    const retriedCampaign = {
      ...found.campaign,
      dungeons: found.campaign.dungeons.map((dungeon) => dungeon.id === offer!.dungeonId
        ? { ...dungeon, attempts: dungeon.attempts + 1 }
        : dungeon),
    };
    const retried = createExpeditionForOffer(retriedCampaign, offer);
    const expected = Object.fromEntries(
      initial.partyMembers
        .filter((member) => member.classId === "cleric")
        .map((member) => [member.id, 2]),
    );

    expect(initial.expedition.battleAbilityUsesRemainingByCharacterId).toEqual(expected);
    expect(retried.expedition.battleAbilityUsesRemainingByCharacterId).toEqual(expected);
    expect(retried.expedition.battleAbilityUsesRemainingByCharacterId)
      .not.toBe(initial.expedition.battleAbilityUsesRemainingByCharacterId);
  });

  it("START_EXPEDITION은 능력 보유자의 감소된 초기 횟수를 거부한다", () => {
    let selected: CampaignTransitionResult | undefined;
    let built: ReturnType<typeof createExpeditionForOffer> | undefined;
    for (let index = 0; index < 30 && built === undefined; index += 1) {
      const candidate = boardedCampaign(`ability-start-${index}`);
      const offer = candidate.campaign.offers.find((one) =>
        one.lockReason === null
        && one.party.memberIds.some((id) => candidate.campaign.pool.byId[id]?.classId === "cleric"));
      if (offer === undefined) continue;
      selected = transitionCampaign(candidate.campaign, candidate.context, {
        type: "SELECT_CONTRACT",
        offerId: offer.id,
      });
      built = createExpeditionForOffer(selected.campaign, offer);
    }
    if (selected === undefined || built === undefined) throw new Error("성직자가 든 계약 fixture를 찾지 못했다");
    const clericId = built.partyMembers.find((member) => member.classId === "cleric")!.id;

    expect(() => transitionCampaign(selected.campaign, selected.context, {
      type: "START_EXPEDITION",
      expeditionId: "exp-reduced-ability",
      ...built,
      expedition: {
        ...built.expedition,
        battleAbilityUsesRemainingByCharacterId: {
          ...built.expedition.battleAbilityUsesRemainingByCharacterId,
          [clericId]: 1,
        },
      },
    })).toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }));
  });

  it("START_EXPEDITION에 잔여 횟수 맵이 없으면 INVALID_TRANSITION이다", () => {
    const { campaign, context } = boardedCampaign("ability-map-missing");
    const offer = campaign.offers.find((one) => one.lockReason === null)!;
    const selected = transitionCampaign(campaign, context, { type: "SELECT_CONTRACT", offerId: offer.id });
    const built = createExpeditionForOffer(selected.campaign, offer);

    expect(() => transitionCampaign(selected.campaign, selected.context, {
      type: "START_EXPEDITION",
      expeditionId: "exp-missing-ability-map",
      ...built,
      expedition: {
        ...built.expedition,
        battleAbilityUsesRemainingByCharacterId: undefined as never,
      },
    })).toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }));
  });

  it("START_EXPEDITION은 Symbol own key가 추가된 맵을 INVALID_TRANSITION으로 거부한다", () => {
    const { campaign, context } = boardedCampaign("ability-symbol-key");
    const offer = campaign.offers.find((one) => one.lockReason === null)!;
    const selected = transitionCampaign(campaign, context, { type: "SELECT_CONTRACT", offerId: offer.id });
    const built = createExpeditionForOffer(selected.campaign, offer);
    const extraKey = Symbol("숨은 능력 키");

    expect(() => transitionCampaign(selected.campaign, selected.context, {
      type: "START_EXPEDITION",
      expeditionId: "exp-symbol-ability-map",
      ...built,
      expedition: {
        ...built.expedition,
        battleAbilityUsesRemainingByCharacterId: {
          ...built.expedition.battleAbilityUsesRemainingByCharacterId,
          [extraKey]: 0,
        } as never,
      },
    })).toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }));
  });

  it("START_EXPEDITION은 own 값이 맞아도 Date 객체인 맵을 INVALID_TRANSITION으로 거부한다", () => {
    const { campaign, context } = boardedCampaign("ability-date-map");
    const offer = campaign.offers.find((one) => one.lockReason === null)!;
    const selected = transitionCampaign(campaign, context, { type: "SELECT_CONTRACT", offerId: offer.id });
    const built = createExpeditionForOffer(selected.campaign, offer);
    const dateMap = Object.assign(
      new Date(0),
      built.expedition.battleAbilityUsesRemainingByCharacterId,
    );

    expect(() => transitionCampaign(selected.campaign, selected.context, {
      type: "START_EXPEDITION",
      expeditionId: "exp-date-ability-map",
      ...built,
      expedition: {
        ...built.expedition,
        battleAbilityUsesRemainingByCharacterId: dateMap as never,
      },
    })).toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }));
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

  it("잘못된 조언 압력으로 START_EXPEDITION 하면 상태 오류다", () => {
    const { campaign, context } = boardedCampaign();
    const offer = campaign.offers.find((one) => one.lockReason === null)!;
    const selected = transitionCampaign(campaign, context, { type: "SELECT_CONTRACT", offerId: offer.id });
    const built = createExpeditionForOffer(selected.campaign, offer);

    expect(() => transitionCampaign(selected.campaign, selected.context, {
      type: "START_EXPEDITION",
      expeditionId: "exp-invalid-pressure-01",
      ...built,
      expedition: { ...built.expedition, advicePressure: 4 as never },
    })).toThrowError(expect.objectContaining({ code: "INVALID_STATE" }));
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
 * 신뢰가 무너질수록 조언이 안 먹힌다.
 *
 * `C6` 가 살아 있는 신뢰 0 인원 수로 보정을 내주는데(둘이면 수용 -5, 셋이면 -10,
 * 넷이면 -15) 아무도 넘기지 않아 늘 0 이었다. 하강 나선이 통째로 없었다.
 *
 * 지금 밸런스에서는 이 구간에 닿지 않는다 - 40 판을 걸어도 살아 있는 신뢰 0 은
 * 최대 한 명이다. 사람이 신뢰를 잃기 전에 죽기 때문이다. 그래서 걸어서는 못 보고
 * 상태를 직접 만들어 본다.
 */
describe("캠페인 전체 신뢰 보정", () => {
  /** 풀에서 살아 있는 사람 `count` 명의 신뢰를 0 으로 만든다. 파티 밖 사람들이다. */
  function withZeroTrustOutsiders(state: CampaignTransitionResult, count: number): CampaignTransitionResult {
    const party = new Set(state.context.activeExpedition!.partyMembers.map((member) => member.id));
    const byId = { ...state.campaign.pool.byId };
    let left = count;
    for (const id of state.campaign.pool.order) {
      if (left === 0) break;
      const member = byId[id];
      if (member === undefined || !member.alive || party.has(id)) continue;
      byId[id] = { ...member, trust: 0 };
      left -= 1;
    }
    if (left > 0) throw new Error("신뢰 0 으로 만들 사람이 모자란다");
    return { ...state, campaign: { ...state.campaign, pool: { ...state.campaign.pool, byId } } };
  }

  function reactionsFor(state: CampaignTransitionResult, adviceId: ChoiceId) {
    return transitionCampaign(state.campaign, state.context, { type: "CHOOSE_ADVICE", adviceId })
      .context.activeExpedition!.records.at(-1)!.reactions.map((one) => one.reaction);
  }

  /** 사건 하나 앞에 선 상태. */
  function atEvent(seed: string): CampaignTransitionResult | null {
    let state = startedWith(seed);
    for (let step = 0; step < 8; step += 1) {
      if (state.context.activeExpedition!.pendingEvent !== null) return state;
      const active = state.context.activeExpedition!;
      const here = active.expedition.map.nodes.find((node) => node.id === active.expedition.currentNodeId)!;
      /* 보스방으로 들어가면 사건이 없다. 평범한 지점만 밟는다. */
      const next = here.nextNodeIds.find((id) => {
        if (active.expedition.visitedNodeIds.includes(id)) return false;
        return active.expedition.map.nodes.find((node) => node.id === id)?.kind === "normal";
      });
      if (next === undefined) return null;
      state = transitionCampaign(state.campaign, state.context, { type: "VISIT_NODE", nodeId: next });
    }
    return null;
  }

  /*
   * 보정이 걸리면 반응이 달라진다.
   *
   * 한 사건으로는 못 본다 - 보정이 임계를 넘기지 못하면 같은 반응이 나온다.
   * 여러 사건을 훑어 달라지는 경우를 찾고, 하나도 못 찾으면 그것이 곧 실패다.
   */
  it("보정 구간에 들면 반응이 달라진다", () => {
    let differed = 0;
    let compared = 0;

    for (let index = 0; index < 30 && differed === 0; index += 1) {
      const state = atEvent(`trust-modifier-${index}`);
      if (state === null) continue;
      /* 넷이면 수용 -15 · 적발 +15 로 가장 크게 갈린다. */
      const shakenState = withZeroTrustOutsiders(state, 4);

      for (const option of state.context.activeExpedition!.pendingEvent!.advice) {
        compared += 1;
        if (reactionsFor(state, option.id).join() !== reactionsFor(shakenState, option.id).join()) differed += 1;
      }
    }

    expect(compared).toBeGreaterThan(2);
    expect(differed).toBeGreaterThan(0);
  });

  /* 구간 밖이면 그대로다. 아무 때나 흔들리면 보정이 아니라 잡음이다. */
  it("한 명뿐이면 아직 보정이 없다", () => {
    for (let index = 0; index < 30; index += 1) {
      const state = atEvent(`trust-modifier-${index}`);
      if (state === null) continue;
      const oneDown = withZeroTrustOutsiders(state, 1);

      for (const option of state.context.activeExpedition!.pendingEvent!.advice) {
        expect(reactionsFor(oneDown, option.id)).toEqual(reactionsFor(state, option.id));
      }
      return;
    }
    throw new Error("사건 앞에 선 시드를 찾지 못했다");
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
    /*
     * 싸움이 되는 monster 사건 앞까지 간다.
     *
     * 예전에는 「이 시드의 첫 사건이 monster 다」에 기대고 있었다. 게시판이
     * 캠페인마다 다른 던전을 걸게 되면서 같은 시드가 다른 지도를 주므로, 첫
     * 사건이 무엇인지에 기대지 않고 monster 를 만날 때까지 지나간다.
     */
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
    for (let step = 0; step < 40; step += 1) {
      const current = state.context.activeExpedition!;
      const pending = current.pendingEvent;

      if (pending !== null) {
        if (pending.kind === "monster") return state;
        /* 싸움이 아니면 지나간다. 고르고, 결과를 확인하고, 다시 걷는다. */
        state = transitionCampaign(state.campaign, state.context, {
          type: "CHOOSE_ADVICE", adviceId: pending.advice[0]!.id,
        });
        state = transitionCampaign(state.campaign, state.context, { type: "ACKNOWLEDGE_OUTCOME" });
        continue;
      }

      const here = current.expedition.map.nodes.find((node) => node.id === current.expedition.currentNodeId)!;
      const next = here.nextNodeIds.find((id) => !current.expedition.visitedNodeIds.includes(id));
      if (next === undefined) break;
      state = transitionCampaign(state.campaign, state.context, { type: "VISIT_NODE", nodeId: next });
    }
    throw new Error("싸움이 되는 사건에 닿지 못했다");
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

  it("전투 전멸 결과는 확인하기 전에는 정산할 수 없다", () => {
    const state = atEventWithDeadMember();
    const active = state.context.activeExpedition!;
    const fragile = {
      ...state.context,
      activeExpedition: {
        ...active,
        partyMembers: active.partyMembers.map((member, index) => index === 0
          ? { ...member, hp: 0, alive: false }
          : { ...member, hp: 1, alive: true }),
      },
    };
    const event = fragile.activeExpedition!.pendingEvent!;
    if (event.kind !== "monster") throw new Error("monster 사건 fixture가 아니다");
    const dungeon = state.campaign.dungeons.find((candidate) => candidate.id === active.expedition.dungeonId)!;
    const lethalEvent = {
      ...event,
      encounter: { enemies: [{ monsterId: dungeon.activeMonsterIds[0]!, count: 50 }] },
      advice: event.advice.map((option) => ({ ...option, encounterModifier: {} })),
      defaultEncounterModifier: {},
    };
    const context = {
      ...fragile,
      activeExpedition: { ...fragile.activeExpedition!, pendingEvent: lethalEvent },
    };
    const wiped = transitionCampaign(state.campaign, context, {
      type: "CHOOSE_ADVICE", adviceId: lethalEvent.advice.find((option) => option.outcome === "harm")!.id,
    });
    expect(wiped.context.activeExpedition!.expedition.result).toMatchObject({ status: "wiped" });
    const after = wiped.context.activeExpedition!;

    expect(after.pendingOutcome).not.toBeNull();
    expect(() => transitionCampaign(wiped.campaign, wiped.context, {
      type: "COMPLETE_EXPEDITION",
      snapshot: createSettlementSnapshotFor(wiped.campaign, after),
    })).toThrow("아직 확인하지 않은 결과가 있다");

    const acknowledged = transitionCampaign(wiped.campaign, wiped.context, { type: "ACKNOWLEDGE_OUTCOME" });
    const snapshot = createSettlementSnapshotFor(
      acknowledged.campaign,
      acknowledged.context.activeExpedition!,
    );
    expect(snapshot.contractReward).toEqual(acknowledged.context.activeExpedition!.offer.reward);
    expect(snapshot.contractReward).not.toBe(acknowledged.context.activeExpedition!.offer.reward);
    expect(() => transitionCampaign(acknowledged.campaign, acknowledged.context, {
      type: "COMPLETE_EXPEDITION",
      snapshot,
    })).not.toThrow();
  });
});
