import { CLASSES } from "@/lib/content/classes";
import { EVENT_KINDS } from "@/lib/domain";
import { canAcceptOffer } from "@/lib/rules/board";
import type { OfferRiskSummary } from "@/lib/rules/offer-risk";
import {
  calculatePromotionScore,
  nextGradeTarget,
} from "@/lib/rules/promotion";
import type {
  BoardLockReason,
  BoardOfferId,
  CampaignMember,
  CampaignState,
  ClassId,
  EventKind,
  Grade,
} from "@/lib/domain";
import {
  EVENT_KIND_LABELS,
  EVENT_KIND_MARKS,
  PERSONALITY_LABELS,
} from "./labels";

/** 지도는 항상 두 갈래다(상위 spec). 갈래별 지점 수는 E1 소관이다. */
const TOTAL_BRANCHES = 2;

export interface CampaignHeaderView {
  rank: Grade;
  currentReputation: number;
  currentGold: number;
  cumulativeGold: number;
  promotionScore: number;
  nextGrade: { grade: Grade; threshold: number } | null;
  remainingDungeons: number;
  totalDungeons: number;
}

export interface OfferRiskKindView {
  kind: EventKind;
  mark: string;
  label: string;
  count: number;
}

export interface OfferRiskView {
  /** 네 분류가 EVENT_KINDS 순서로 모두 들어온다. 개수가 0인 분류는 없다. */
  kinds: OfferRiskKindView[];
  bossCount: number;
}

/**
 * 기호 옆에 분류명을 함께 담는다.
 * 기호만으로는 스크린리더가 읽지 못하고 색·기호 외 단서를 요구하는
 * 접근성 기준에 걸린다.
 */
export function toOfferRiskView(summary: OfferRiskSummary): OfferRiskView {
  return {
    kinds: EVENT_KINDS.map((kind) => ({
      kind,
      mark: EVENT_KIND_MARKS[kind],
      label: EVENT_KIND_LABELS[kind],
      count: summary.counts[kind],
    })),
    bossCount: summary.bossCount,
  };
}

export interface BoardOfferView {
  offerId: BoardOfferId;
  order: number;
  dungeonLabel: string;
  grade: Grade;
  failureCount: number;
  requiredReputation: number;
  reputationReward: number;
  goldReward: number;
  nodeCount: number;
  partyLabel: string;
  survivorCount: number;
  averageTrust: number;
  locked: boolean;
  shortfall: number | null;
  lockReason: BoardLockReason;
  risk: OfferRiskView | null;
}

export interface ContractMemberView {
  memberId: string;
  name: string;
  className: string;
  personalityLabel: string;
  currentHp: number;
  maxHp: number;
  trust: number;
  carriedGold: number;
  memorySummary: string;
}

export interface ContractView {
  offerId: BoardOfferId;
  dungeonLabel: string;
  grade: Grade;
  requiredReputation: number;
  reputationReward: number;
  goldReward: number;
  nodeCount: number;
  branchCount: number;
  bossRevealed: boolean;
  partyLabel: string;
  members: ContractMemberView[];
  acceptable: boolean;
  acceptBlockReason: "insufficientReputation" | "partyUnavailable" | null;
  risk: OfferRiskView | null;
}

/** "dungeon-001" 또는 "party-007" 같은 id 끝의 숫자를 읽는다. */
export function numericSuffix(id: string): number {
  const match = /(\d+)\s*$/.exec(id);
  return match === null ? 0 : Number(match[1]);
}

function classNameOf(classId: ClassId): string {
  return CLASSES.find((klass) => klass.id === classId)?.name ?? "직업 미정";
}

function memorySummaryOf(member: CampaignMember): string {
  if (member.memory.length === 0) {
    return "최근 변화 없음";
  }
  return member.memory[member.memory.length - 1].summary;
}

function membersOfParty(state: CampaignState, partyId: string): CampaignMember[] {
  const party = state.parties.find((candidate) => candidate.id === partyId);
  if (party === undefined) {
    return [];
  }
  return party.memberIds
    .map((memberId) => state.members.find((member) => member.id === memberId))
    .filter((member): member is CampaignMember => member !== undefined);
}

export function toCampaignHeaderView(state: CampaignState): CampaignHeaderView {
  return {
    rank: state.rank,
    currentReputation: state.currentReputation,
    currentGold: state.currentGold,
    cumulativeGold: state.cumulativeGold,
    promotionScore: calculatePromotionScore(
      state.currentReputation,
      state.cumulativeGold,
    ),
    nextGrade: nextGradeTarget(state.rank),
    remainingDungeons: state.dungeons.filter(
      (dungeon) => dungeon.status === "remaining",
    ).length,
    totalDungeons: state.dungeons.length,
  };
}

export function toBoardView(
  state: CampaignState,
  riskByOfferId: ReadonlyMap<string, OfferRiskSummary>,
): BoardOfferView[] {
  return state.board.map((offer, index) => {
    const dungeon = state.dungeons.find(
      (candidate) => candidate.id === offer.dungeonId,
    );
    const grade: Grade = dungeon?.grade ?? "C";
    const members = membersOfParty(state, offer.partyId);
    const alive = members.filter((member) => member.alive);
    const averageTrust =
      alive.length === 0
        ? 0
        : Math.round(
            alive.reduce((sum, member) => sum + member.trust, 0) / alive.length,
          );
    const shortfall =
      offer.locked && offer.lockReason === "insufficientReputation"
        ? offer.requiredReputation - state.currentReputation
        : null;

    return {
      offerId: offer.id,
      order: index + 1,
      dungeonLabel:
        dungeon === undefined
          ? "알 수 없는 던전"
          : `${grade}급 ${numericSuffix(dungeon.id)}번`,
      grade,
      failureCount: dungeon?.failureCount ?? 0,
      requiredReputation: offer.requiredReputation,
      reputationReward: offer.baseReputationReward,
      goldReward: offer.baseGoldReward,
      nodeCount: offer.nodeCount,
      partyLabel: `${numericSuffix(offer.partyId)}팀`,
      survivorCount: alive.length,
      averageTrust,
      locked: offer.locked,
      shortfall,
      lockReason: offer.lockReason,
      risk: (() => {
        const summary = riskByOfferId.get(offer.id as string);
        return summary === undefined ? null : toOfferRiskView(summary);
      })(),
    };
  });
}

export function toContractView(
  state: CampaignState,
  offerId: BoardOfferId,
  risk: OfferRiskSummary | null,
): ContractView | null {
  const offer = state.board.find((candidate) => candidate.id === offerId);
  if (offer === undefined) {
    return null;
  }
  const dungeon = state.dungeons.find(
    (candidate) => candidate.id === offer.dungeonId,
  );
  const party = state.parties.find(
    (candidate) => candidate.id === offer.partyId,
  );
  if (dungeon === undefined || party === undefined) {
    return null;
  }

  const members = membersOfParty(state, offer.partyId).map((member) => ({
    memberId: member.id,
    name: member.name,
    className: classNameOf(member.classId),
    personalityLabel: PERSONALITY_LABELS[member.personality],
    currentHp: member.currentHp,
    maxHp: member.maxHp,
    trust: member.trust,
    carriedGold: member.carriedGold,
    memorySummary: memorySummaryOf(member),
  }));

  const acceptance = canAcceptOffer(state, offer);

  return {
    offerId: offer.id,
    dungeonLabel: `${dungeon.grade}급 ${numericSuffix(dungeon.id)}번`,
    grade: dungeon.grade,
    requiredReputation: offer.requiredReputation,
    reputationReward: offer.baseReputationReward,
    goldReward: offer.baseGoldReward,
    nodeCount: offer.nodeCount,
    branchCount: TOTAL_BRANCHES,
    bossRevealed: true,
    partyLabel: `${numericSuffix(party.id)}팀`,
    members,
    acceptable: acceptance.accepted,
    acceptBlockReason: acceptance.accepted ? null : acceptance.reason,
    risk: risk === null ? null : toOfferRiskView(risk),
  };
}

/**
 * 화면 제목은 phase와 현재 탐험에서 전부 파생된다.
 * 페이지가 layout 위쪽 HUD에 제목을 올리려면 context가 필요하므로
 * 셸이 상태에서 파생하게 두어 그 비용을 없앤다.
 */
export function toScreenTitle(state: CampaignState): string {
  const expedition = state.expedition;
  const dungeon =
    expedition === null
      ? undefined
      : state.dungeons.find((candidate) => candidate.id === expedition.dungeonId);
  const dungeonLabel =
    dungeon === undefined
      ? null
      : `${dungeon.grade}급 ${numericSuffix(dungeon.id)}번`;

  const withDungeon = (suffix: string): string =>
    dungeonLabel === null ? suffix : `${dungeonLabel} · ${suffix}`;

  switch (state.phase) {
    case "board":
    case "contract":
      return "캠페인 게시판";
    case "map":
      return withDungeon("공개 분기 지도");
    case "infoOpportunity":
      return withDungeon("정보 전달");
    case "event":
      return withDungeon("사건");
    case "boss":
    case "settlement":
      return withDungeon("자동 보스전 결과");
    case "ended":
      return "캠페인 엔딩";
  }
}
