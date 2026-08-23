import { EXPEDITION_PARTY_SIZE, RuleError } from "@/lib/domain";
import type {
  BoardOffer,
  CampaignState,
  CampaignTransition,
  CampaignTransitionContext,
  CampaignTransitionResult,
  Character,
  ExpeditionState,
  SettlementSnapshot,
} from "@/lib/domain";
import { createBoardOffers } from "./board";
import { settleExpedition } from "./settlement";

function invalidTransition(message: string, details: Record<string, unknown> = {}): never {
  throw new RuleError("INVALID_TRANSITION", message, details);
}

function requirePhase(campaign: CampaignState, expected: CampaignState["phase"]): void {
  if (campaign.phase !== expected) {
    invalidTransition("허용되지 않은 캠페인 전이다", {
      phase: campaign.phase,
      expectedPhase: expected,
    });
  }
}

function emptyResult(
  campaign: CampaignState,
  context: CampaignTransitionContext,
): CampaignTransitionResult {
  return {
    campaign,
    context,
    settlement: null,
    worldTurn: null,
    promotion: null,
    ending: null,
  };
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length
    && new Set(left).size === left.length
    && new Set(right).size === right.length
    && left.every((id) => right.includes(id));
}

function selectedOffer(context: CampaignTransitionContext): BoardOffer {
  if (context.selectedOffer === null) {
    return invalidTransition("선택한 공고가 없다");
  }
  return context.selectedOffer;
}

function activeExpedition(
  context: CampaignTransitionContext,
): NonNullable<CampaignTransitionContext["activeExpedition"]> {
  if (context.activeExpedition === null) {
    return invalidTransition("활성 원정이 없다");
  }
  return context.activeExpedition;
}

function memberById(campaign: CampaignState, id: string): Character {
  const member = campaign.pool.byId[id as keyof typeof campaign.pool.byId];
  if (member === undefined) {
    return invalidTransition("원정 파티원이 캠페인 풀에 없다", { characterId: id });
  }
  return member;
}

function validatePartyMembers(
  campaign: CampaignState,
  offer: BoardOffer,
  partyMembers: readonly Character[],
): void {
  if (partyMembers.length !== EXPEDITION_PARTY_SIZE) {
    invalidTransition("원정 파티는 정확히 3명이어야 한다", { count: partyMembers.length });
  }
  const ids = partyMembers.map((member) => member.id);
  if (!sameIds(ids, offer.party.memberIds)) {
    invalidTransition("원정 파티가 공고와 다르다", {
      expectedParty: offer.party.memberIds,
      actualParty: ids,
    });
  }
  for (const member of partyMembers) {
    const before = memberById(campaign, member.id);
    if (before.classId !== member.classId || before.maxHp !== member.maxHp) {
      invalidTransition("고정 캐릭터 정보가 공고 시점과 다르다", {
        characterId: member.id,
      });
    }
  }
}

function validateExpedition(
  offer: BoardOffer,
  expeditionId: string,
  expedition: ExpeditionState,
  partyMembers: readonly Character[],
  campaign: CampaignState,
): void {
  if (expeditionId.length === 0) {
    invalidTransition("원정 ID가 비어 있다");
  }
  if (expedition.dungeonId !== offer.dungeonId || expedition.riskLevel !== offer.riskLevel) {
    invalidTransition("원정 계약 정보가 공고와 다르다", {
      expectedDungeonId: offer.dungeonId,
      actualDungeonId: expedition.dungeonId,
      expectedRiskLevel: offer.riskLevel,
      actualRiskLevel: expedition.riskLevel,
    });
  }
  if (!sameIds(expedition.party.memberIds, offer.party.memberIds)) {
    invalidTransition("원정 파티가 공고와 다르다");
  }
  validatePartyMembers(campaign, offer, partyMembers);
}

function validateSnapshot(
  active: NonNullable<CampaignTransitionContext["activeExpedition"]>,
  snapshot: SettlementSnapshot,
): void {
  if (snapshot.expeditionId !== active.expeditionId) {
    invalidTransition("정산 원정 ID가 활성 원정과 다르다", {
      expectedExpeditionId: active.expeditionId,
      actualExpeditionId: snapshot.expeditionId,
    });
  }
  if (
    snapshot.dungeonId !== active.expedition.dungeonId
    || snapshot.contractRisk !== active.expedition.riskLevel
    || !sameIds(snapshot.party.memberIds, active.expedition.party.memberIds)
  ) {
    invalidTransition("정산 계약 정보가 활성 원정과 다르다");
  }
}

function copyActiveExpedition(
  action: Extract<CampaignTransition, { type: "START_EXPEDITION" }>,
  offer: BoardOffer,
): NonNullable<CampaignTransitionContext["activeExpedition"]> {
  return {
    expeditionId: action.expeditionId,
    offer: {
      ...offer,
      party: { memberIds: [...offer.party.memberIds] },
    },
    expedition: {
      ...action.expedition,
      party: { memberIds: [...action.expedition.party.memberIds] },
    },
    partyMembers: action.partyMembers.map((member) => ({ ...member })),
  };
}

function transitionBoard(
  campaign: CampaignState,
  context: CampaignTransitionContext,
  action: CampaignTransition,
): CampaignTransitionResult {
  if (action.type === "OPEN_BOARD") {
    requirePhase(campaign, "intro");
    return emptyResult(
      { ...campaign, phase: "board", offers: createBoardOffers(campaign) },
      context,
    );
  }

  requirePhase(campaign, "board");
  if (action.type === "SELECT_CONTRACT") {
    if (context.selectedOffer !== null || context.activeExpedition !== null) {
      invalidTransition("게시판에 이미 선택된 계약이 있다");
    }
    const offer = campaign.offers.find((candidate) => candidate.id === action.offerId);
    if (offer === undefined || offer.lockReason !== null) {
      invalidTransition("선택할 수 있는 공고가 없다", { offerId: action.offerId });
    }
    return emptyResult(campaignWithPhase(campaign, "contract"), {
      ...context,
      selectedOffer: {
        ...offer,
        party: { memberIds: [...offer.party.memberIds] },
      },
    });
  }

  if (action.type === "OPEN_PROMOTION") {
    return invalidTransition("승급 전이는 다음 단계에서 구현한다");
  }
  return invalidTransition("게시판에서 허용되지 않은 전이다", { type: action.type });
}

function transitionContract(
  campaign: CampaignState,
  context: CampaignTransitionContext,
  action: CampaignTransition,
): CampaignTransitionResult {
  requirePhase(campaign, "contract");
  const offer = selectedOffer(context);

  if (action.type === "CANCEL_CONTRACT") {
    return emptyResult(campaignWithPhase(campaign, "board"), {
      ...context,
      selectedOffer: null,
    });
  }

  if (action.type === "START_EXPEDITION") {
    if (context.activeExpedition !== null) {
      invalidTransition("이미 활성 원정이 있다");
    }
    validateExpedition(offer, action.expeditionId, action.expedition, action.partyMembers, campaign);
    return emptyResult(
      campaignWithPhase(campaign, "expedition"),
      {
        ...context,
        selectedOffer: null,
        activeExpedition: copyActiveExpedition(action, offer),
      },
    );
  }

  return invalidTransition("계약에서 허용되지 않은 전이다", { type: action.type });
}

function campaignWithPhase(
  campaign: CampaignState,
  phase: CampaignState["phase"],
): CampaignState {
  return { ...campaign, phase };
}

export function transitionCampaign(
  campaign: CampaignState,
  context: CampaignTransitionContext,
  action: CampaignTransition,
): CampaignTransitionResult {
  if (campaign.phase === "ended") {
    return invalidTransition("종료된 캠페인은 다시 진행할 수 없다", { type: action.type });
  }

  if (campaign.phase === "intro" || campaign.phase === "board") {
    return transitionBoard(campaign, context, action);
  }

  if (campaign.phase === "contract") {
    return transitionContract(campaign, context, action);
  }

  if (campaign.phase === "expedition") {
    requirePhase(campaign, "expedition");
    const active = activeExpedition(context);
    if (action.type === "COMPLETE_EXPEDITION") {
      if (campaign.settledExpeditionIds.includes(action.snapshot.expeditionId)) {
        return invalidTransition("이미 정산한 원정이다", {
          expeditionId: action.snapshot.expeditionId,
        });
      }
      validateSnapshot(active, action.snapshot);
      const execution = settleExpedition(campaign, action.snapshot);
      return {
        ...emptyResult(
          {
            ...execution.campaign,
            phase: "settlement",
            settledExpeditionIds: [
              ...campaign.settledExpeditionIds,
              action.snapshot.expeditionId,
            ],
          },
          context,
        ),
        settlement: execution.result,
      };
    }
    return invalidTransition("원정에서 허용되지 않은 전이다", { type: action.type });
  }

  if (campaign.phase === "settlement") {
    requirePhase(campaign, "settlement");
    activeExpedition(context);
    if (action.type === "START_WORLD_TURN") {
      return emptyResult(campaignWithPhase(campaign, "worldTurn"), context);
    }
    return invalidTransition("정산에서 허용되지 않은 전이다", { type: action.type });
  }

  if (campaign.phase === "worldTurn") {
    requirePhase(campaign, "worldTurn");
    return invalidTransition("월드턴 전이는 다음 단계에서 구현한다", { type: action.type });
  }

  if (campaign.phase === "promotion") {
    requirePhase(campaign, "promotion");
    return invalidTransition("승급 전이는 다음 단계에서 구현한다", { type: action.type });
  }

  return invalidTransition("알 수 없는 캠페인 전이다", { phase: campaign.phase });
}
