import { GRADE_DEFS } from "@/lib/content/dungeons";
import { GRADES } from "@/lib/domain";
import type {
  BoardOffer,
  BoardOfferId,
  CampaignDungeon,
  CampaignParty,
  CampaignState,
} from "@/lib/domain";
import { createRng } from "@/lib/rng";

/** 한 번에 제시하는 공고의 최대 개수. */
export const MAX_BOARD_OFFERS = 5;

export type OfferAcceptance =
  | { accepted: true }
  | { accepted: false; reason: "insufficientReputation" };

export type BoardEndingId = "supportUnavailable" | "partyExhausted";

function remainingDungeons(state: CampaignState): CampaignDungeon[] {
  return state.dungeons
    .filter((dungeon) => dungeon.status === "remaining")
    .sort((left, right) => {
      const byGrade =
        GRADES.indexOf(left.grade) - GRADES.indexOf(right.grade);
      return byGrade !== 0 ? byGrade : left.sortOrder - right.sortOrder;
    });
}

/**
 * 출전 가능한 완성 파티를 시드 기반 순서로 정한다.
 *
 * 스토어의 난수 상태를 소비하지 않고 캠페인 시드에서 매번 같은 스트림을
 * 파생하므로, 게시판을 다시 열거나 화면을 전환해도 짝이 바뀌지 않는다.
 * 정산 뒤에 짝이 달라지는 것은 남은 던전과 완성 파티 목록이 달라지기
 * 때문이다.
 */
function availableParties(state: CampaignState): CampaignParty[] {
  const complete = state.parties.filter((party) => party.complete);
  return createRng(state.seed).derive("board").shuffle(complete);
}

/**
 * 남은 던전을 C→B→A→S로, 같은 등급 안에서는 시드 정렬 키로 세워 완성
 * 파티와 중복 없이 짝짓는다. 명성이 부족한 공고도 지우지 않고 잠근 채로
 * 보여준다. 무엇이 왜 막혔는지 보이지 않으면 다음 목표를 세울 수 없다.
 * docs/superpowers/specs/2026-08-13-sanghwan-yoo-game-direction-rework-design.md
 */
export function generateBoard(state: CampaignState): BoardOffer[] {
  const dungeons = remainingDungeons(state);
  const parties = availableParties(state);
  const count = Math.min(MAX_BOARD_OFFERS, dungeons.length, parties.length);

  return Array.from({ length: count }, (_, index) => {
    const dungeon = dungeons[index];
    const grade = GRADE_DEFS[dungeon.grade];
    const locked = state.currentReputation < grade.requiredReputation;

    return {
      id: `offer-${dungeon.id}` as BoardOfferId,
      dungeonId: dungeon.id,
      partyId: parties[index].id,
      requiredReputation: grade.requiredReputation,
      baseReputationReward: grade.baseReputationReward,
      baseGoldReward: grade.baseGoldReward,
      nodeCount: grade.nodeCount,
      locked,
      lockReason: locked ? "insufficientReputation" : null,
    };
  });
}

/** 공고에 지원할 수 있는지 본다. 막힌 이유를 함께 돌려준다. */
export function canAcceptOffer(
  state: CampaignState,
  offer: BoardOffer,
): OfferAcceptance {
  if (state.currentReputation < offer.requiredReputation) {
    return { accepted: false, reason: "insufficientReputation" };
  }
  return { accepted: true };
}

/**
 * 게시판 때문에 캠페인이 끝나는 두 경우를 판정한다.
 *
 * 남은 던전이 없으면 완주이므로 여기서는 판정하지 않는다. 엔딩 우선순위
 * 전체는 정산이 정한다.
 */
export function createBoardEnding(state: CampaignState): BoardEndingId | null {
  if (remainingDungeons(state).length === 0) return null;

  if (state.parties.every((party) => !party.complete)) {
    return "partyExhausted";
  }
  if (state.board.length > 0 && state.board.every((offer) => offer.locked)) {
    return "supportUnavailable";
  }
  return null;
}
