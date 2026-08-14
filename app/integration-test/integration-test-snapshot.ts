import {
  createF2TestSnapshot,
  type F2Snapshot,
} from "@/app/f2-test/f2-test-snapshot";
import { GRADES } from "@/lib/domain";
import type { CampaignState, Grade } from "@/lib/domain";
import { initializeCampaign } from "@/lib/rules/campaign-init";

export interface CampaignIntegrationSnapshot {
  seed: string;
  phase: string;
  rank: string;
  currentReputation: number;
  currentGold: number;
  cumulativeGold: number;
  dungeonCounts: Record<Grade, number>;
  dungeonCount: number;
  partyCount: number;
  completePartyCount: number;
  memberCount: number;
  reserveMemberCount: number;
  board: Array<{
    id: string;
    dungeonId: string;
    dungeonGrade: Grade;
    partyId: string;
    partyMemberNames: string[];
    requiredReputation: number;
    baseReputationReward: number;
    baseGoldReward: number;
    nodeCount: number;
    locked: boolean;
    lockReason: string | null;
  }>;
  reproducible: boolean;
}

export interface IntegrationSnapshot {
  seed: string;
  f1: F2Snapshot["f1"];
  f2: {
    contentStatus: F2Snapshot["contentStatus"];
    contentError?: string;
    events: F2Snapshot["events"];
    cards: F2Snapshot["cards"];
    items: F2Snapshot["items"];
    bosses: F2Snapshot["bosses"];
    capacity: F2Snapshot["capacity"];
    negativeCases: F2Snapshot["negativeCases"];
    reproducibility: F2Snapshot["reproducibility"];
  };
  c1: CampaignIntegrationSnapshot;
}

function createDungeonCounts(
  state: CampaignState,
): Record<Grade, number> {
  const counts = Object.fromEntries(
    GRADES.map((grade) => [grade, 0]),
  ) as Record<Grade, number>;

  for (const dungeon of state.dungeons) {
    counts[dungeon.grade] += 1;
  }

  return counts;
}

function createCampaignSnapshot(
  seed: string,
  state: CampaignState,
): CampaignIntegrationSnapshot {
  const members = new Map(state.members.map((member) => [member.id, member]));
  const parties = new Map(state.parties.map((party) => [party.id, party]));
  const dungeons = new Map(state.dungeons.map((dungeon) => [dungeon.id, dungeon]));

  return {
    seed: state.seed,
    phase: state.phase,
    rank: state.rank,
    currentReputation: state.currentReputation,
    currentGold: state.currentGold,
    cumulativeGold: state.cumulativeGold,
    dungeonCounts: createDungeonCounts(state),
    dungeonCount: state.dungeons.length,
    partyCount: state.parties.length,
    completePartyCount: state.parties.filter((party) => party.complete).length,
    memberCount: state.members.length,
    reserveMemberCount: state.reserveMemberIds.length,
    board: state.board.map((offer) => {
      const party = parties.get(offer.partyId);
      const dungeon = dungeons.get(offer.dungeonId);
      const partyMemberNames = party?.memberIds.map(
        (memberId) => members.get(memberId)?.name ?? String(memberId),
      ) ?? [];

      if (dungeon === undefined) {
        throw new Error(`게시판 공고의 던전을 찾을 수 없다: ${offer.dungeonId}`);
      }

      return {
        id: String(offer.id),
        dungeonId: String(offer.dungeonId),
        dungeonGrade: dungeon.grade,
        partyId: String(offer.partyId),
        partyMemberNames,
        requiredReputation: offer.requiredReputation,
        baseReputationReward: offer.baseReputationReward,
        baseGoldReward: offer.baseGoldReward,
        nodeCount: offer.nodeCount,
        locked: offer.locked,
        lockReason: offer.lockReason,
      };
    }),
    reproducible: JSON.stringify(state) === JSON.stringify(initializeCampaign(seed)),
  };
}

export function createIntegrationSnapshot(seed: string): IntegrationSnapshot {
  const f2 = createF2TestSnapshot(seed);
  const campaign = initializeCampaign(seed);

  return {
    seed,
    f1: f2.f1,
    f2: {
      contentStatus: f2.contentStatus,
      contentError: f2.contentError,
      events: f2.events,
      cards: f2.cards,
      items: f2.items,
      bosses: f2.bosses,
      capacity: f2.capacity,
      negativeCases: f2.negativeCases,
      reproducibility: f2.reproducibility,
    },
    c1: createCampaignSnapshot(seed, campaign),
  };
}
