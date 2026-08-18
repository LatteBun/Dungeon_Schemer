import { CAMPAIGN_GRADE_CONFIG } from "@/lib/content/dungeons";
import { createRng } from "@/lib/rng";
import type {
  BoardOffer,
  BoardOfferId,
  CampaignDungeon,
  CampaignParty,
  CampaignState,
  Grade,
} from "@/lib/domain";

const GRADE_INDEX: Readonly<Record<Grade, number>> = {
  C: 0,
  B: 1,
  A: 2,
  S: 3,
};

function sortedRemainingDungeons(state: CampaignState): CampaignDungeon[] {
  return state.dungeons
    .filter((dungeon) => dungeon.status === "remaining")
    .sort((left, right) =>
      GRADE_INDEX[left.grade] - GRADE_INDEX[right.grade]
      || left.sortOrder - right.sortOrder
      || left.id.localeCompare(right.id),
    );
}

function completeParties(state: CampaignState): CampaignParty[] {
  return state.parties.filter((party) => party.complete);
}

export function generateBoard(state: CampaignState): BoardOffer[] {
  const dungeons = sortedRemainingDungeons(state);
  const parties = createRng(state.seed)
    .derive("board")
    .shuffle(completeParties(state));
  const count = Math.min(5, dungeons.length, parties.length);

  return Array.from({ length: count }, (_, index) => {
    const dungeon = dungeons[index];
    const party = parties[index];
    const config = CAMPAIGN_GRADE_CONFIG[dungeon.grade];
    const locked = state.currentReputation < config.requiredReputation;

    return {
      id: `offer-${dungeon.id}-${party.id}` as BoardOfferId,
      dungeonId: dungeon.id,
      partyId: party.id,
      requiredReputation: config.requiredReputation,
      baseReputationReward: config.baseReputationReward,
      baseGoldReward: config.baseGoldReward,
      nodeCount: config.eventNodeCount,
      locked,
      lockReason: locked ? "insufficientReputation" : null,
    };
  });
}

export function canAcceptOffer(
  state: CampaignState,
  offer: BoardOffer,
): { accepted: true } | {
  accepted: false;
  reason: "insufficientReputation" | "partyUnavailable";
} {
  const currentOffer = state.board.find(
    (candidate) =>
      candidate.id === offer.id
      && candidate.dungeonId === offer.dungeonId
      && candidate.partyId === offer.partyId,
  );
  const dungeon = state.dungeons.find((candidate) => candidate.id === offer.dungeonId);
  const party = state.parties.find((candidate) => candidate.id === offer.partyId);

  if (
    currentOffer === undefined
    || dungeon === undefined
    || dungeon.status !== "remaining"
    || party === undefined
    || !party.complete
  ) {
    return { accepted: false, reason: "partyUnavailable" };
  }

  if (state.currentReputation < currentOffer.requiredReputation) {
    return { accepted: false, reason: "insufficientReputation" };
  }

  return { accepted: true };
}

export function createBoardEnding(
  state: CampaignState,
): "supportUnavailable" | "partyExhausted" | null {
  if (!state.dungeons.some((dungeon) => dungeon.status === "remaining")) {
    return null;
  }

  if (completeParties(state).length === 0) {
    return "partyExhausted";
  }

  const board = generateBoard(state);
  if (board.length > 0 && board.every((offer) => offer.locked)) {
    return "supportUnavailable";
  }

  return null;
}
