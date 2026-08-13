import { CLASSES, MEMBER_MAX_HP } from "@/lib/content/classes";
import {
  INITIAL_DUNGEON_COUNTS,
  TOTAL_DUNGEON_COUNT,
} from "@/lib/content/dungeons";
import { MEMBER_NAMES } from "@/lib/content/names";
import {
  CAMPAIGN_PARTY_SIZE,
  GRADES,
  PERSONALITIES,
  RuleError,
  TRUST_MAX,
  TRUST_MIN,
} from "@/lib/domain";
import type {
  CampaignDungeon,
  CampaignMember,
  CampaignParty,
  CampaignState,
  DungeonId,
  Grade,
  MemberId,
  PartyId,
  Personality,
} from "@/lib/domain";
import { createRng } from "@/lib/rng";
import type { Rng } from "@/lib/rng";

/** 캠페인 시작 자원. 시작 골드 10은 누적 획득 골드에 넣지 않는다. */
export const INITIAL_CAMPAIGN_RESOURCES = {
  currentReputation: 0,
  currentGold: 10,
  cumulativeGold: 0,
  rank: "C",
} as const satisfies {
  currentReputation: number;
  currentGold: number;
  cumulativeGold: number;
  rank: Grade;
};

export const COMPLETE_PARTY_COUNT = 15;
export const RESERVE_MEMBER_COUNT = 6;

/** 인물이 들고 시작하는 골드 범위. 전멸하면 길잡이가 유품으로 챙긴다. */
export const CARRIED_GOLD_MIN = 10;
export const CARRIED_GOLD_MAX = 30;

/**
 * 성격별 초기 신뢰 기본값. 의심 많음은 높은 신뢰에 도달하기 어렵고
 * 충동적은 쉽게 믿는다는 방향을 시작값에 반영한다.
 * docs/systems/PARTY_AND_TRUST.md
 */
export const INITIAL_TRUST_BASE: Readonly<Record<Personality, number>> = {
  suspicious: 35,
  prudent: 45,
  greedy: 50,
  righteous: 55,
  impulsive: 60,
};

/** 초기 신뢰에 더하는 랜덤 폭. 기본값 ± 이 값 안에서 정해진다. */
export const INITIAL_TRUST_JITTER = 5;

const TOTAL_MEMBER_COUNT =
  COMPLETE_PARTY_COUNT * CAMPAIGN_PARTY_SIZE + RESERVE_MEMBER_COUNT;

const pad = (value: number): string => String(value).padStart(3, "0");

function clampTrust(value: number): number {
  return Math.min(TRUST_MAX, Math.max(TRUST_MIN, value));
}

/**
 * 던전 15개를 만든다. ID는 등급 순으로 고정되어 캠페인 내내 같은 던전을
 * 추적할 수 있고, 같은 등급 안의 제시 순서만 시드로 섞은 `sortOrder`가
 * 정한다. 전멸로 등급이 올라가도 ID는 바뀌지 않는다.
 */
function createDungeons(rng: Rng): CampaignDungeon[] {
  const dungeons: CampaignDungeon[] = [];
  let index = 0;

  for (const grade of GRADES) {
    const count = INITIAL_DUNGEON_COUNTS[grade];
    const sortOrders = rng.shuffle(
      Array.from({ length: count }, (_, position) => position),
    );

    for (let inGrade = 0; inGrade < count; inGrade += 1) {
      index += 1;
      dungeons.push({
        id: `dungeon-${pad(index)}` as DungeonId,
        initialGrade: grade,
        grade,
        sortOrder: sortOrders[inGrade],
        status: "remaining",
        failureCount: 0,
      });
    }
  }

  return dungeons;
}

interface MemberDraft {
  readonly classIndex: number;
  readonly personality: Personality;
}

/**
 * 한 파티의 직업과 성격을 겹치지 않게 고른다. 같은 파티 안에서 직업이
 * 겹치면 역할이 무의미해지고 성격이 겹치면 개인차가 드러나지 않는다.
 */
function draftParty(rng: Rng): MemberDraft[] {
  const classIndexes = rng
    .shuffle(CLASSES.map((_, position) => position))
    .slice(0, CAMPAIGN_PARTY_SIZE);
  const personalities = rng.shuffle(PERSONALITIES).slice(0, CAMPAIGN_PARTY_SIZE);

  return classIndexes.map((classIndex, position) => ({
    classIndex,
    personality: personalities[position],
  }));
}

function buildMember(
  index: number,
  draft: MemberDraft,
  name: string,
  trustRng: Rng,
  goldRng: Rng,
): CampaignMember {
  const base = INITIAL_TRUST_BASE[draft.personality];
  const jitter = trustRng.int(-INITIAL_TRUST_JITTER, INITIAL_TRUST_JITTER);

  return {
    id: `member-${pad(index)}` as MemberId,
    name,
    classId: CLASSES[draft.classIndex].id,
    personality: draft.personality,
    currentHp: MEMBER_MAX_HP,
    maxHp: MEMBER_MAX_HP,
    trust: clampTrust(base + jitter),
    carriedGold: goldRng.int(CARRIED_GOLD_MIN, CARRIED_GOLD_MAX),
    alive: true,
    memory: [],
  };
}

function assertContentIsSufficient(): void {
  if (CLASSES.length < CAMPAIGN_PARTY_SIZE) {
    throw new RuleError(
      "INVALID_GENERATION",
      `직업 풀(${CLASSES.length})이 파티 인원(${CAMPAIGN_PARTY_SIZE})보다 작아 직업 중복 없는 파티를 만들 수 없다.`,
      { available: CLASSES.length, required: CAMPAIGN_PARTY_SIZE },
    );
  }
  if (PERSONALITIES.length < CAMPAIGN_PARTY_SIZE) {
    throw new RuleError(
      "INVALID_GENERATION",
      `성격 수(${PERSONALITIES.length})가 파티 인원(${CAMPAIGN_PARTY_SIZE})보다 작다.`,
      { available: PERSONALITIES.length, required: CAMPAIGN_PARTY_SIZE },
    );
  }
  if (MEMBER_NAMES.length < TOTAL_MEMBER_COUNT) {
    throw new RuleError(
      "INVALID_GENERATION",
      `이름 풀(${MEMBER_NAMES.length})이 필요한 인물 수(${TOTAL_MEMBER_COUNT})보다 작아 이름을 겹치지 않게 줄 수 없다.`,
      { available: MEMBER_NAMES.length, required: TOTAL_MEMBER_COUNT },
    );
  }
}

/**
 * 캠페인 시작 상태를 만든다. 같은 시드는 같은 캠페인을 재현한다.
 *
 * 던전·파티·예비 인물·소지 골드는 각각 이름 있는 난수 스트림에서 파생하므로
 * 한 영역의 난수 소비가 다른 영역의 결과를 바꾸지 않는다.
 * docs/superpowers/specs/2026-08-13-sanghwan-yoo-game-direction-rework-design.md
 */
export function initializeCampaign(seed: string): CampaignState {
  assertContentIsSufficient();

  const rng = createRng(seed);
  const dungeonRng = rng.derive("dungeon");
  const partyRng = rng.derive("party");
  const reserveRng = rng.derive("reserve");
  const goldRng = rng.derive("carriedGold");

  const dungeons = createDungeons(dungeonRng);
  const names = partyRng.shuffle(MEMBER_NAMES).slice(0, TOTAL_MEMBER_COUNT);

  const members: CampaignMember[] = [];
  const parties: CampaignParty[] = [];

  for (let team = 0; team < COMPLETE_PARTY_COUNT; team += 1) {
    const drafts = draftParty(partyRng);
    const memberIds = drafts.map((draft) => {
      const index = members.length + 1;
      const member = buildMember(
        index,
        draft,
        names[index - 1],
        partyRng,
        goldRng,
      );
      members.push(member);
      return member.id;
    });

    parties.push({
      id: `party-${pad(team + 1)}` as PartyId,
      memberIds,
      complete: true,
    });
  }

  // 예비 인원은 파티에 속하지 않으므로 직업·성격 중복 제약을 받지 않는다.
  // 충원될 파티가 정해질 때 직업이 겹치지 않는 사람을 고른다.
  const reserveMemberIds: MemberId[] = [];
  for (let slot = 0; slot < RESERVE_MEMBER_COUNT; slot += 1) {
    const index = members.length + 1;
    const member = buildMember(
      index,
      {
        classIndex: reserveRng.int(0, CLASSES.length - 1),
        personality: reserveRng.pick(PERSONALITIES),
      },
      names[index - 1],
      reserveRng,
      goldRng,
    );
    members.push(member);
    reserveMemberIds.push(member.id);
  }

  if (dungeons.length !== TOTAL_DUNGEON_COUNT) {
    throw new RuleError(
      "INVALID_GENERATION",
      `던전 수가 ${TOTAL_DUNGEON_COUNT}개가 아니다: ${dungeons.length}`,
      { expected: TOTAL_DUNGEON_COUNT, received: dungeons.length },
    );
  }

  return {
    seed,
    phase: "board",
    rank: INITIAL_CAMPAIGN_RESOURCES.rank,
    currentReputation: INITIAL_CAMPAIGN_RESOURCES.currentReputation,
    currentGold: INITIAL_CAMPAIGN_RESOURCES.currentGold,
    cumulativeGold: INITIAL_CAMPAIGN_RESOURCES.cumulativeGold,
    dungeons,
    members,
    parties,
    reserveMemberIds,
    waitingMemberIds: [],
    board: [],
    expedition: null,
    ending: null,
    log: [],
  };
}
