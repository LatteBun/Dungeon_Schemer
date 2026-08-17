import { INITIAL_DUNGEON_DEFINITIONS } from "@/lib/content/dungeons";
import { CAMPAIGN_PARTY_SIZE, GRADES } from "@/lib/domain";
import type {
  CampaignMember,
  CampaignParty,
  CampaignState,
  MemberId,
  PartyId,
} from "@/lib/domain";
import { createRng } from "@/lib/rng";
import { generateBoard } from "@/lib/rules/board";
import {
  generateMemberProfile,
  generateParty,
} from "@/lib/rules/party";
import type { MemberProfile } from "@/lib/rules/party";
import { emptyStatistics } from "@/lib/rules/statistics";

const INITIAL_RESERVE_SIZE = 6;
/** 파티원 소지 골드의 시드 범위. 전멸 유품으로만 회수되는 값이다. */
export const INITIAL_MEMBER_GOLD_MIN = 20;
export const INITIAL_MEMBER_GOLD_MAX = 45;

interface ProfileRecord {
  id: MemberId;
  profile: MemberProfile;
}

function memberId(number: number): MemberId {
  return `member-${String(number).padStart(3, "0")}` as MemberId;
}

function partyId(number: number): PartyId {
  return `party-${String(number).padStart(3, "0")}` as PartyId;
}

function toCampaignMember(
  id: MemberId,
  profile: MemberProfile,
  carriedGold: number,
): CampaignMember {
  return {
    id,
    name: profile.name,
    classId: profile.classId,
    personality: profile.personality,
    currentHp: 100,
    maxHp: 100,
    trust: profile.trust,
    carriedGold,
    alive: true,
    memory: [],
  };
}

export function initializeCampaign(seed: string): CampaignState {
  const root = createRng(seed);
  const dungeonRng = root.derive("dungeon");
  const partyRng = root.derive("party");
  const reserveRng = root.derive("reserve");
  const carriedGoldRng = root.derive("carriedGold");

  const dungeons = GRADES.flatMap((grade) => {
    const definitions = INITIAL_DUNGEON_DEFINITIONS.filter(
      (definition) => definition.initialGrade === grade,
    );

    return dungeonRng.shuffle(definitions).map((definition, sortOrder) => ({
      id: definition.id,
      initialGrade: definition.initialGrade,
      grade,
      sortOrder,
      status: "remaining" as const,
      failureCount: 0,
    }));
  });

  const profiles: ProfileRecord[] = [];
  const parties: CampaignParty[] = [];
  for (let partyNumber = 1; partyNumber <= dungeons.length; partyNumber += 1) {
    const generatedParty = generateParty(partyRng, { size: CAMPAIGN_PARTY_SIZE });
    const memberIds = generatedParty.map((member) => {
      const id = memberId(profiles.length + 1);
      profiles.push({
        id,
        profile: {
          name: member.name,
          classId: member.classId,
          personality: member.personality,
          trust: member.trust,
        },
      });
      return id;
    });

    parties.push({
      id: partyId(partyNumber),
      memberIds,
      complete: true,
    });
  }

  const reserveMemberIds: MemberId[] = [];
  for (let index = 0; index < INITIAL_RESERVE_SIZE; index += 1) {
    const id = memberId(profiles.length + 1);
    profiles.push({ id, profile: generateMemberProfile(reserveRng) });
    reserveMemberIds.push(id);
  }

  const members = profiles.map(({ id, profile }) =>
    toCampaignMember(
      id,
      profile,
      carriedGoldRng.int(INITIAL_MEMBER_GOLD_MIN, INITIAL_MEMBER_GOLD_MAX),
    ));

  const initialState: CampaignState = {
    seed,
    phase: "board",
    rank: "C",
    currentReputation: 0,
    currentGold: 10,
    cumulativeGold: 0,
    dungeons,
    members,
    parties,
    reserveMemberIds,
    waitingMemberIds: [],
    board: [],
    expedition: null,
    ending: null,
    log: [],
    statistics: emptyStatistics(),
  };

  return {
    ...initialState,
    board: generateBoard(initialState),
  };
}
