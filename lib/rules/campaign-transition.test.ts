import { describe, expect, it } from "vitest";
import {
  createCampaignTransitionContext,
  createCampaignStatistics,
  runWorldTurn,
  type BoardOffer,
  type CampaignState,
  type CampaignTransition,
  type CampaignTransitionContext,
  type Character,
  type ExpeditionState,
  type SettlementSnapshot,
} from "@/lib/domain";
import { initializeCampaign } from "./campaign-init";
import { createBoardOffers } from "./board";
import {
  createExpeditionForOffer,
  createSettlementSnapshotFor,
  transitionCampaign,
} from "./campaign-transition";
import { createRng } from "@/lib/rng";

function membersFor(offer: BoardOffer, campaign: CampaignState): Character[] {
  return offer.party.memberIds.map((id) => campaign.pool.byId[id]).filter(
    (member): member is Character => member !== undefined,
  );
}

function startAction(
  campaign: CampaignState,
  context: CampaignTransitionContext,
  expeditionId = "exp-c7-01",
): CampaignTransition {
  const offer = context.selectedOffer;
  if (offer === null) throw new Error("selected offer fixture is missing");
  /*
   * 최소 ExpeditionState 를 손으로 만들지 않는다.
   *
   * 규칙이 원정 상태를 만들게 됐으므로 그것을 쓴다. 손으로 만든 것은 지도가
   * 없어서, 사건 계획을 원정 시작 때 만들도록 바꾸자마자 깨졌다.
   */
  return { type: "START_EXPEDITION", expeditionId, ...createExpeditionForOffer(campaign, offer) };
}

function snapshotFor(
  campaign: CampaignState,
  context: CampaignTransitionContext,
): SettlementSnapshot {
  const active = context.activeExpedition;
  if (active === null) throw new Error("active expedition fixture is missing");
  const finalMembers = membersFor(active.offer, campaign);
  return createSettlementSnapshotFor(campaign, {
    ...active,
    expedition: {
      ...active.expedition,
      result: {
        status: "cleared",
        survivorIds: finalMembers.map((member) => member.id),
      },
    },
    partyMembers: finalMembers,
  });
}

function openBoard(campaign = initializeCampaign("c7-transition")) {
  return transitionCampaign(campaign, createCampaignTransitionContext(), { type: "OPEN_BOARD" });
}

function rankLockedCampaign(seed: string): CampaignState {
  const initial = initializeCampaign(seed);
  return {
    ...initial,
    rank: "C",
    reputation: 0,
    gold: 0,
    dungeons: initial.dungeons.map((dungeon) => ({
      ...dungeon,
      status: "unexplored" as const,
      riskLevel: 5 as const,
    })),
  };
}

function expeditionFlow(seed = "c7-transition") {
  const board = openBoard(initializeCampaign(seed));
  const offer = board.campaign.offers.find((candidate) => candidate.lockReason === null)!;
  const contract = transitionCampaign(board.campaign, board.context, {
    type: "SELECT_CONTRACT", offerId: offer.id,
  });
  const expedition = transitionCampaign(
    contract.campaign,
    contract.context,
    startAction(contract.campaign, contract.context),
  );
  return { board, contract, expedition, offer };
}

function abilityExpeditionFlow() {
  for (let index = 0; index < 30; index += 1) {
    const flow = expeditionFlow(`c7-ability-${index}`);
    if (flow.expedition.context.activeExpedition!.partyMembers.some((member) => member.classId === "cleric")) {
      return flow;
    }
  }
  throw new Error("능력 보유자가 든 원정 fixture를 찾지 못했다");
}

describe("C7 캠페인 전이", () => {
  it("intro에서 board로 가며 C2 공고를 만들고 입력을 보존한다", () => {
    const campaign = initializeCampaign("c7-open-board");
    const context = createCampaignTransitionContext();
    const action: CampaignTransition = { type: "OPEN_BOARD" };
    const beforeCampaign = structuredClone(campaign);
    const beforeContext = structuredClone(context);

    const result = transitionCampaign(campaign, context, action);

    expect(result.campaign.phase).toBe("board");
    expect(result.campaign.offers.length).toBeGreaterThan(0);
    expect(result.context).toEqual(context);
    expect(campaign).toEqual(beforeCampaign);
    expect(context).toEqual(beforeContext);
  });

  it("승급할 수 없는 전부 rankTooLow 공고는 게시판 진입에서 실직으로 끝낸다", () => {
    // Break caught: OPEN_BOARD used to expose a board with no selectable contract.
    const campaign = rankLockedCampaign("c7-open-board-unemployed");

    const result = transitionCampaign(campaign, createCampaignTransitionContext(), { type: "OPEN_BOARD" });

    expect(result.campaign).toMatchObject({ phase: "ended", ending: { kind: "unemployed" } });
    expect(result.ending).toEqual(result.campaign.ending);
    expect(result.campaign.history.events.at(-1)?.type).toBe("CAMPAIGN_ENDED");
  });

  it("승급 취소도 선택 불가능한 기존 rankTooLow 게시판으로 돌아가지 않는다", () => {
    // Break caught: CANCEL_PROMOTION used to restore an unusable board without re-checking its ending.
    const base = rankLockedCampaign("c7-cancel-promotion-unemployed");
    const campaign: CampaignState = {
      ...base,
      phase: "promotion",
      offers: createBoardOffers(base),
    };

    const result = transitionCampaign(campaign, createCampaignTransitionContext(), { type: "CANCEL_PROMOTION" });

    expect(result.campaign).toMatchObject({ phase: "ended", ending: { kind: "unemployed" } });
    expect(result.ending).toEqual(result.campaign.ending);
    expect(result.campaign.history.events.at(-1)?.type).toBe("CAMPAIGN_ENDED");
  });

  it("승급 뒤 새로 만든 전부 rankTooLow 공고도 실직으로 끝낸다", () => {
    // Break caught: a successful promotion used to create an unusable board without evaluating endings.
    const base = rankLockedCampaign("c7-promote-unemployed");
    const campaign: CampaignState = {
      ...base,
      rank: "B",
      reputation: 120,
      phase: "promotion",
      offers: createBoardOffers({ ...base, rank: "B", reputation: 120 }),
    };

    const result = transitionCampaign(campaign, createCampaignTransitionContext(), {
      type: "PROMOTE_GUIDE",
      method: "reputation",
    });

    expect(result.campaign).toMatchObject({ phase: "ended", ending: { kind: "unemployed" } });
    expect(result.ending).toEqual(result.campaign.ending);
    expect(result.campaign.history.events.at(-1)?.type).toBe("CAMPAIGN_ENDED");
  });

  it("공고를 선택하고 계약과 일치하는 원정을 시작한다", () => {
    const board = openBoard();
    const offer = board.campaign.offers.find((candidate) => candidate.lockReason === null);
    expect(offer).toBeDefined();
    const contract = transitionCampaign(board.campaign, board.context, {
      type: "SELECT_CONTRACT",
      offerId: offer!.id,
    });

    const action = startAction(contract.campaign, contract.context);
    const expedition = transitionCampaign(
      contract.campaign,
      contract.context,
      action,
    );

    expect(expedition.campaign.phase).toBe("expedition");
    expect(expedition.context.selectedOffer).toBeNull();
    expect(expedition.context.activeExpedition?.offer.id).toBe(offer!.id);
    expect(expedition.context.activeExpedition?.offer.reward).toEqual(offer!.reward);
    expect(expedition.context.activeExpedition?.offer.reward).not.toBe(offer!.reward);
    expect(expedition.context.activeExpedition?.expedition.battleAbilityUsesRemainingByCharacterId)
      .not.toBe((action as Extract<CampaignTransition, { type: "START_EXPEDITION" }>).expedition.battleAbilityUsesRemainingByCharacterId);
  });

  it("활성 원정 전이는 감소한 횟수는 허용하고 범위를 넘은 횟수는 거부한다", () => {
    const flow = abilityExpeditionFlow();
    const active = flow.expedition.context.activeExpedition!;
    const abilityId = Object.keys(active.expedition.battleAbilityUsesRemainingByCharacterId)[0];
    if (abilityId === undefined) throw new Error("능력 보유자 fixture가 없다");
    const reducedContext = {
      ...flow.expedition.context,
      activeExpedition: {
        ...active,
        expedition: {
          ...active.expedition,
          battleAbilityUsesRemainingByCharacterId: {
            ...active.expedition.battleAbilityUsesRemainingByCharacterId,
            [abilityId]: 0,
          },
        },
      },
    };

    expect(() => transitionCampaign(flow.expedition.campaign, reducedContext, {
      type: "APPLY_TRUST_BATCH",
      partyMembers: active.partyMembers,
    })).not.toThrow();
    expect(() => transitionCampaign(flow.expedition.campaign, {
      ...reducedContext,
      activeExpedition: {
        ...reducedContext.activeExpedition!,
        expedition: {
          ...reducedContext.activeExpedition!.expedition,
          battleAbilityUsesRemainingByCharacterId: {
            ...reducedContext.activeExpedition!.expedition.battleAbilityUsesRemainingByCharacterId,
            [abilityId]: 3,
          },
        },
      },
    }, {
      type: "APPLY_TRUST_BATCH",
      partyMembers: active.partyMembers,
    })).toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }));
  });

  it("정산은 C4를 한 번 적용하고 C8 통계에는 기록하지 않는다", () => {
    const board = openBoard();
    const offer = board.campaign.offers.find((candidate) => candidate.lockReason === null)!;
    const contract = transitionCampaign(board.campaign, board.context, {
      type: "SELECT_CONTRACT", offerId: offer.id,
    });
    const expedition = transitionCampaign(
      contract.campaign,
      contract.context,
      startAction(contract.campaign, contract.context),
    );
    const snapshot = snapshotFor(expedition.campaign, expedition.context);
    expect(snapshot.finalMembers).toHaveLength(3);
    expect(snapshot.finalMembers.every((member) => member.alive)).toBe(true);
    /* Break caught: 정산 snapshot이 활성 공고의 확정 보상과 갈라지면 실패한다. */
    expect(snapshot.contractReward).toEqual(expedition.context.activeExpedition?.offer.reward);

    const result = transitionCampaign(
      expedition.campaign,
      expedition.context,
      { type: "COMPLETE_EXPEDITION", snapshot },
    );

    expect(result.campaign.phase).toBe("settlement");
    expect(result.campaign.settledExpeditionIds).toEqual(["exp-c7-01"]);
    expect(result.campaign.statistics).toEqual(createCampaignStatistics());
    expect(result.settlement?.expeditionId).toBe("exp-c7-01");
    /* Break caught: 세 명 생존 정산이 계약 확정값을 다시 계산하거나 바꾸면 실패한다. */
    expect(result.settlement?.reputationDelta).toBe(snapshot.contractReward.reputation);
    expect(result.settlement?.goldDelta).toBe(snapshot.contractReward.gold);
  });

  it("활성 공고와 다른 계약 보상 snapshot을 거부한다", () => {
    const expedition = expeditionFlow("c7-reward-mismatch").expedition;
    const snapshot = snapshotFor(expedition.campaign, expedition.context);

    expect(() => transitionCampaign(expedition.campaign, expedition.context, {
      type: "COMPLETE_EXPEDITION",
      snapshot: {
        ...snapshot,
        contractReward: {
          ...snapshot.contractReward,
          reputation: snapshot.contractReward.reputation + 1,
        },
      },
    })).toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }));
  });

  it("잠긴 공고·없는 공고와 계약 밖 원정은 INVALID_TRANSITION이다", () => {
    const board = openBoard();
    const locked: BoardOffer = {
      ...board.campaign.offers[0]!,
      lockReason: "rankTooLow",
    };
    const lockedCampaign = { ...board.campaign, offers: [locked] };

    expect(() => transitionCampaign(lockedCampaign, board.context, {
      type: "SELECT_CONTRACT", offerId: locked.id,
    })).toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }));
    expect(() => transitionCampaign(board.campaign, board.context, {
      type: "SELECT_CONTRACT", offerId: "offer-missing" as BoardOffer["id"],
    })).toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }));
    expect(() => transitionCampaign(board.campaign, board.context, {
      type: "START_EXPEDITION",
      expeditionId: "exp-outside-contract",
      expedition: {} as ExpeditionState,
      partyMembers: [],
    })).toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }));
  });

  it("계약과 다른 원정은 campaign과 context를 변경하지 않는다", () => {
    const board = openBoard();
    const offer = board.campaign.offers.find((candidate) => candidate.lockReason === null)!;
    const contract = transitionCampaign(board.campaign, board.context, {
      type: "SELECT_CONTRACT", offerId: offer.id,
    });
    const campaignBefore = structuredClone(contract.campaign);
    const contextBefore = structuredClone(contract.context);
    const baseAction = startAction(contract.campaign, contract.context) as Extract<CampaignTransition, { type: "START_EXPEDITION" }>;
    const action: Extract<CampaignTransition, { type: "START_EXPEDITION" }> = {
      ...baseAction,
      type: "START_EXPEDITION",
      expedition: {
        dungeonId: "dungeon-mismatch" as never,
        riskLevel: offer.riskLevel,
        party: offer.party,
      } as unknown as ExpeditionState,
    };

    expect(() => transitionCampaign(contract.campaign, contract.context, action))
      .toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }));
    expect(contract.campaign).toEqual(campaignBefore);
    expect(contract.context).toEqual(contextBefore);
  });

  it("같은 원정 ID의 두 번째 정산은 C4 호출 전에 거부한다", () => {
    const board = openBoard();
    const offer = board.campaign.offers.find((candidate) => candidate.lockReason === null)!;
    const contract = transitionCampaign(board.campaign, board.context, {
      type: "SELECT_CONTRACT", offerId: offer.id,
    });
    const expedition = transitionCampaign(
      contract.campaign,
      contract.context,
      startAction(contract.campaign, contract.context),
    );
    const first = transitionCampaign(
      expedition.campaign,
      expedition.context,
      { type: "COMPLETE_EXPEDITION", snapshot: snapshotFor(expedition.campaign, expedition.context) },
    );
    const beforeCampaign = structuredClone(first.campaign);
    const beforeContext = structuredClone(first.context);

    expect(() => transitionCampaign(
      { ...first.campaign, phase: "expedition" },
      first.context,
      { type: "COMPLETE_EXPEDITION", snapshot: snapshotFor(first.campaign, first.context) },
    )).toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }));
    expect(first.campaign).toEqual(beforeCampaign);
    expect(first.context).toEqual(beforeContext);
  });

  it("정산 뒤 월드턴을 한 번 실행하고 새 월드턴 공고를 만든다", () => {
    const flow = expeditionFlow("c7-worldturn");
    const settled = transitionCampaign(
      flow.expedition.campaign,
      flow.expedition.context,
      { type: "COMPLETE_EXPEDITION", snapshot: snapshotFor(flow.expedition.campaign, flow.expedition.context) },
    );
    const worldStart = transitionCampaign(
      settled.campaign,
      settled.context,
      { type: "START_WORLD_TURN" },
    );
    const expected = runWorldTurn(
      settled.campaign.pool,
      flow.offer.party,
      settled.campaign.worldTurn,
      createRng(`${settled.campaign.seed}/${settled.campaign.worldTurn}`).derive("worldturn"),
    );
    const worldComplete = transitionCampaign(
      worldStart.campaign,
      worldStart.context,
      { type: "COMPLETE_WORLD_TURN" },
    );

    expect(worldStart.campaign.phase).toBe("worldTurn");
    expect(worldComplete.worldTurn).toEqual(expected.result);
    expect(worldComplete.campaign.pool).toEqual(expected.pool);
    expect(worldComplete.campaign.worldTurn).toBe(settled.campaign.worldTurn + 1);
    expect(worldComplete.campaign.offers).toEqual(createBoardOffers(worldComplete.campaign));
    expect(worldComplete.context.activeExpedition).toBeNull();
  });

  it("게시판 승급은 C5 계산을 사용하고 C7이 phase와 공고를 적용한다", () => {
    const initial = initializeCampaign("c7-promotion");
    const boardCampaign = {
      ...initial,
      phase: "board" as const,
      reputation: 60,
      offers: createBoardOffers({ ...initial, phase: "board" as const, reputation: 60 }),
    };
    const opened = transitionCampaign(
      boardCampaign,
      createCampaignTransitionContext(),
      { type: "OPEN_PROMOTION" },
    );
    const promoted = transitionCampaign(
      opened.campaign,
      opened.context,
      { type: "PROMOTE_GUIDE", method: "reputation" },
    );

    expect(opened.campaign.phase).toBe("promotion");
    expect(promoted.campaign).toMatchObject({ phase: "board", rank: "B" });
    expect(promoted.promotion?.toRank).toBe("B");
    expect(promoted.campaign.offers).toEqual(createBoardOffers(promoted.campaign));
  });

  it("유효한 최신 파티는 원정에 남기고 전원 trust 0이면 즉시 종료한다", () => {
    const flow = expeditionFlow("c7-trust");
    const party = flow.expedition.context.activeExpedition!.partyMembers;
    const updated = party.map((member) => ({ ...member, trust: 1 }));
    const staying = transitionCampaign(flow.expedition.campaign, flow.expedition.context, {
      type: "APPLY_TRUST_BATCH", partyMembers: updated,
    });

    expect(staying.campaign.phase).toBe("expedition");
    expect(staying.context.activeExpedition?.partyMembers).toEqual(updated);
    expect(staying.campaign.pool.byId[updated[0]!.id]).toMatchObject({ trust: 1 });

    const before = structuredClone(flow.expedition.campaign);
    const distrust = transitionCampaign(flow.expedition.campaign, flow.expedition.context, {
      type: "APPLY_TRUST_BATCH",
      partyMembers: party.map((member) => ({ ...member, trust: 0 })),
    });

    expect(distrust.campaign).toMatchObject({ phase: "ended", ending: { kind: "distrust" } });
    expect(distrust.ending).toEqual(distrust.campaign.ending);
    expect(distrust.campaign.dungeons).toEqual(before.dungeons);
    expect(distrust.campaign.worldTurn).toBe(before.worldTurn);
    expect(distrust.campaign.offers).toEqual(before.offers);
    expect(distrust.campaign.statistics).toEqual(before.statistics);
    expect(distrust.campaign.settledExpeditionIds).toEqual(before.settledExpeditionIds);

    expect(() => transitionCampaign(distrust.campaign, distrust.context, {
      type: "OPEN_BOARD",
    })).toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }));

    /*
     * 붕괴와 종료를 둘 다 남긴다.
     *
     * `C8-B` 의 전환점은 「신뢰 붕괴」를 가장 높게 치는데, 그 이벤트가 없으면
     * 그 전환점이 나올 자리가 없다. 오래 아무도 남기지 않아 엔딩의 전환점이
     * 「보스 돌파」밖에 될 수 없었다.
     */
    const types = distrust.campaign.history.events.map((event) => event.type);

    expect(types).toContain("TRUST_COLLAPSED");
    expect(types).toContain("CAMPAIGN_ENDED");
    expect(distrust.campaign.history.turningPoints.map((point) => point.kind))
      .toContain("trustCollapse");
  });

  it("최신 파티의 중복 ID와 고정 정보 불일치는 C6 전에 거부한다", () => {
    const flow = expeditionFlow("c7-trust-invalid");
    const party = flow.expedition.context.activeExpedition!.partyMembers;
    const beforeCampaign = structuredClone(flow.expedition.campaign);
    const beforeContext = structuredClone(flow.expedition.context);

    expect(() => transitionCampaign(flow.expedition.campaign, flow.expedition.context, {
      type: "APPLY_TRUST_BATCH",
      partyMembers: [party[0]!, party[0]!, party[2]!],
    })).toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }));
    expect(() => transitionCampaign(flow.expedition.campaign, flow.expedition.context, {
      type: "APPLY_TRUST_BATCH",
      partyMembers: party.map((member, index) => index === 0
        ? { ...member, maxHp: member.maxHp + 1 }
        : member),
    })).toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }));
    expect(flow.expedition.campaign).toEqual(beforeCampaign);
    expect(flow.expedition.context).toEqual(beforeContext);
  });

  it.each([
    ["completed", (campaign: CampaignState) => ({
      ...campaign,
      dungeons: campaign.dungeons.map((dungeon) => ({ ...dungeon, status: "cleared" as const })),
    })],
    ["denounced", (campaign: CampaignState) => {
      const byId = { ...campaign.pool.byId };
      for (const id of campaign.pool.order.slice(0, 5)) {
        const member = byId[id]!;
        byId[id] = { ...member, trust: 0, alive: true, hp: Math.max(1, member.hp) };
      }
      return { ...campaign, pool: { ...campaign.pool, byId } };
    }],
    ["exhausted", (campaign: CampaignState) => {
      const byId = { ...campaign.pool.byId };
      const keep = new Set(campaign.pool.order.slice(0, 2));
      for (const id of campaign.pool.order) {
        if (!keep.has(id)) byId[id] = { ...byId[id]!, alive: false, hp: 0 };
      }
      return { ...campaign, pool: { ...campaign.pool, byId } };
    }],
    ["unemployed", (campaign: CampaignState) => ({
      ...campaign,
      dungeons: campaign.dungeons.map((dungeon) => ({
        ...dungeon,
        riskLevel: 5 as const,
        status: "unexplored" as const,
      })),
    })],
  ] as const)("월드턴 뒤 %s 엔딩을 C6 결과로 기록한다", (kind, adjust) => {
    const flow = expeditionFlow(`c7-ending-${kind}`);
    const settled = transitionCampaign(
      flow.expedition.campaign,
      flow.expedition.context,
      { type: "COMPLETE_EXPEDITION", snapshot: snapshotFor(flow.expedition.campaign, flow.expedition.context) },
    );
    const adjusted = adjust(settled.campaign);
    const worldStart = transitionCampaign(
      adjusted,
      settled.context,
      { type: "START_WORLD_TURN" },
    );
    const completed = transitionCampaign(
      worldStart.campaign,
      worldStart.context,
      { type: "COMPLETE_WORLD_TURN" },
    );

    expect(completed.campaign.phase).toBe("ended");
    expect(completed.campaign.ending?.kind).toBe(kind);
    expect(completed.ending?.kind).toBe(kind);
  });
});

/*
 * 공고를 고를 수 없는 두 갈래는 서로 다른 일이다.
 *
 * 게시판에 없는 공고를 고르는 것은 정상 조작으로는 일어나지 않는다 — 화면이 낡은
 * 목록을 들고 있거나 규칙이 틀린 것이다. 등급이 모자란 공고를 누르는 것은 길잡이가
 * 늘 하는 일이다. 예전에는 둘을 「선택할 수 있는 공고가 없다」 로 묶어 말했는데,
 * 뒤쪽에는 사실이 아니다 — 고를 수 있는 공고는 옆에 남아 있다.
 */
describe("공고를 고를 수 없을 때 무엇을 말하나", () => {
  const reasonOf = (run: () => unknown): string => {
    try {
      run();
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    throw new Error("거부되지 않았다");
  };

  it("등급이 모자라면 무엇이 모자란지 말한다", () => {
    const board = openBoard();
    const locked: BoardOffer = { ...board.campaign.offers[0]!, riskLevel: 4, lockReason: "rankTooLow" };
    const campaign = { ...board.campaign, offers: [locked] };

    const reason = reasonOf(() => transitionCampaign(campaign, board.context, {
      type: "SELECT_CONTRACT", offerId: locked.id,
    }));

    expect(reason).toContain(campaign.rank);
    expect(reason).toContain("★4");
    /* 고를 수 있는 공고가 없다고 말하지 않는다. 있기 때문이다. */
    expect(reason).not.toContain("공고가 없다");
  });

  it("게시판에 없는 공고는 그렇게 말한다", () => {
    const board = openBoard();

    const reason = reasonOf(() => transitionCampaign(board.campaign, board.context, {
      type: "SELECT_CONTRACT", offerId: "offer-missing" as BoardOffer["id"],
    }));

    expect(reason).toContain("게시판에 없는");
    expect(reason).not.toContain("★");
  });

  it("두 갈래가 서로 다른 말을 한다", () => {
    // 같은 말을 하면 어느 쪽인지 알 수 없어 고칠 곳도 찾지 못한다.
    const board = openBoard();
    const locked: BoardOffer = { ...board.campaign.offers[0]!, riskLevel: 5, lockReason: "rankTooLow" };

    const lockedReason = reasonOf(() => transitionCampaign(
      { ...board.campaign, offers: [locked] }, board.context,
      { type: "SELECT_CONTRACT", offerId: locked.id },
    ));
    const missingReason = reasonOf(() => transitionCampaign(board.campaign, board.context, {
      type: "SELECT_CONTRACT", offerId: "offer-missing" as BoardOffer["id"],
    }));

    expect(lockedReason).not.toBe(missingReason);
  });
});
