import { describe, expect, it } from "vitest";
import {
  createCampaignTransitionContext,
  type BoardOffer,
  type CampaignState,
  type CampaignTransition,
  type CampaignTransitionContext,
  type Character,
  type ExpeditionState,
  type SettlementSnapshot,
} from "@/lib/domain";
import { initializeCampaign } from "./campaign-init";
import { transitionCampaign } from "./campaign-transition";

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
  const partyMembers = membersFor(offer, campaign);
  return {
    type: "START_EXPEDITION",
    expeditionId,
    partyMembers,
    expedition: {
      dungeonId: offer.dungeonId,
      riskLevel: offer.riskLevel,
      party: offer.party,
    } as ExpeditionState,
  };
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
    expect(result.campaign.statistics.settlements).toEqual([]);
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
});
