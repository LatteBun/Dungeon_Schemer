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
import { createExpeditionForOffer, transitionCampaign } from "./campaign-transition";
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
  expeditionId = "exp-c7-01",
): SettlementSnapshot {
  const active = context.activeExpedition;
  if (active === null) throw new Error("active expedition fixture is missing");
  return {
    expeditionId,
    dungeonId: active.expedition.dungeonId,
    contractRisk: active.expedition.riskLevel,
    party: active.expedition.party,
    finalMembers: membersFor(active.offer, campaign),
    status: "cleared",
    causeInputs: { choice: "선택", reactions: "반응", damage: "피해" },
  };
}

function openBoard(campaign = initializeCampaign("c7-transition")) {
  return transitionCampaign(campaign, createCampaignTransitionContext(), { type: "OPEN_BOARD" });
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

  it("공고를 선택하고 계약과 일치하는 원정을 시작한다", () => {
    const board = openBoard();
    const offer = board.campaign.offers.find((candidate) => candidate.lockReason === null);
    expect(offer).toBeDefined();
    const contract = transitionCampaign(board.campaign, board.context, {
      type: "SELECT_CONTRACT",
      offerId: offer!.id,
    });

    const expedition = transitionCampaign(
      contract.campaign,
      contract.context,
      startAction(contract.campaign, contract.context),
    );

    expect(expedition.campaign.phase).toBe("expedition");
    expect(expedition.context.selectedOffer).toBeNull();
    expect(expedition.context.activeExpedition?.offer.id).toBe(offer!.id);
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
    const result = transitionCampaign(
      expedition.campaign,
      expedition.context,
      { type: "COMPLETE_EXPEDITION", snapshot: snapshotFor(expedition.campaign, expedition.context) },
    );

    expect(result.campaign.phase).toBe("settlement");
    expect(result.campaign.settledExpeditionIds).toEqual(["exp-c7-01"]);
    expect(result.campaign.statistics).toEqual(createCampaignStatistics());
    expect(result.settlement?.expeditionId).toBe("exp-c7-01");
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
