import {
  toInfoReactionsView,
  type MemberReactionView,
} from "@/components/game/expedition-view-model";
import type { CampaignMachineContext } from "@/lib/flow/campaign-machine";
import { createRng } from "@/lib/rng";
import { evaluatePartyInfoCard } from "@/lib/rules/info";
import type {
  CampaignMember,
  CampaignState,
  CardId,
} from "@/lib/domain";

export interface InfoCardReview {
  selectedCardId: CardId;
  reactions: MemberReactionView[];
}

/**
 * 실제 전이 전에 정보 반응만 미리 보여준다.
 *
 * 난수 키는 campaign-machine의 정보 전이와 같으며, 일치 여부를 실제 전이와
 * 비교하는 회귀 테스트로 고정한다. 상태 적용은 화면의 계속 버튼만 담당한다.
 */
export function prepareInfoCardReview(
  state: CampaignState,
  cardId: CardId,
  context: CampaignMachineContext,
): InfoCardReview {
  const expedition = state.expedition;
  const pending = expedition?.pendingInfo;
  if (state.phase !== "infoOpportunity" || expedition === null || pending == null) {
    throw new Error("정보 전달 단계가 아니어서 카드 반응을 준비할 수 없습니다.");
  }
  if (!pending.cardIds.includes(cardId)) {
    throw new Error(`제시되지 않은 카드입니다: ${cardId}`);
  }

  const dungeon = state.dungeons.find(
    (candidate) => candidate.id === expedition.dungeonId,
  );
  const party = state.parties.find(
    (candidate) => candidate.id === expedition.partyId,
  );
  const card = context.cards.find((candidate) => candidate.id === cardId);
  if (dungeon === undefined || party === undefined || card === undefined) {
    throw new Error("카드 반응에 필요한 캠페인 데이터를 찾을 수 없습니다.");
  }

  const participants = party.memberIds
    .map((memberId) => state.members.find((member) => member.id === memberId))
    .filter((member): member is CampaignMember => member !== undefined);
  const expeditionKey = `${state.seed}/${dungeon.id}#${dungeon.failureCount}`;
  const rng = createRng(`${expeditionKey}/${pending.nodeId}`);
  const evaluation = evaluatePartyInfoCard({
    card,
    party: participants,
    cardRng: rng.derive("card"),
    trustRng: rng.derive("trust"),
  });

  return {
    selectedCardId: cardId,
    reactions: toInfoReactionsView(evaluation),
  };
}
