import type {
  CampaignEnding,
  CampaignEndingId,
  CampaignState,
  MemberId,
} from "@/lib/domain";
import { createBoardEnding } from "@/lib/rules/board";

/**
 * 엔딩 판정 순서. 먼저 성립한 것만 적용한다.
 * docs/systems/PROGRESSION_AND_ENDINGS.md
 */
export const ENDING_PRIORITY = [
  "distrust",
  "expeditionComplete",
  "supportUnavailable",
  "partyExhausted",
] as const satisfies readonly CampaignEndingId[];

const ENDING_REASONS: Readonly<Record<CampaignEndingId, string>> = {
  distrust: "살아 돌아온 용사들이 모두 당신을 완전히 불신한다.",
  expeditionComplete: "던전 15개를 모두 정리하고 원정을 끝냈다.",
  supportUnavailable: "남은 공고가 모두 명성 조건에 막혀 지원할 수 없다.",
  partyExhausted: "완성할 수 있는 파티가 남지 않아 아무도 보낼 수 없다.",
};

/**
 * 이번 원정에서 살아 돌아온 사람들이 모두 신뢰 0인지 본다.
 *
 * 캠페인 전체 생존자로 읽지 않는 이유는 51명 중 한 명이라도 신뢰가 남아 있으면
 * 성립하지 않아 사실상 도달 불가능한 엔딩이 되기 때문이다. 문서의 `출전
 * 파티원`은 방금 다녀온 파티를 가리킨다.
 *
 * 생존자가 0명이면 성립하지 않는다. 전멸은 불신이 아니라 실패다.
 */
function isDistrust(
  state: CampaignState,
  survivorIds: readonly MemberId[],
): boolean {
  if (survivorIds.length === 0) return false;

  const byId = new Map(state.members.map((member) => [member.id as string, member]));
  const survivors = survivorIds
    .map((id) => byId.get(id as string))
    .filter((member) => member?.alive === true);

  return survivors.length > 0 && survivors.every((member) => member!.trust === 0);
}

/**
 * 정산과 파티 처리가 끝난 상태에서 엔딩을 판정한다.
 *
 * `state.board`가 이미 다음 회차의 공고여야 한다. 공고가 모두 잠겼는지는 새
 * 게시판을 봐야 알 수 있고, 완성 파티가 0인지는 재편이 끝난 뒤라야 알 수 있다.
 */
export function resolveEnding(
  state: CampaignState,
  survivorIds: readonly MemberId[],
): CampaignEnding | null {
  const id = ((): CampaignEndingId | null => {
    if (isDistrust(state, survivorIds)) return "distrust";
    if (state.dungeons.every((dungeon) => dungeon.status === "cleared")) {
      return "expeditionComplete";
    }
    // 남은 두 엔딩은 C1이 같은 우선순위로 판정한다. 파티가 없어 공고 자체를
    // 만들 수 없으면 지원 불가가 아니라 파티 소진이다.
    return createBoardEnding(state);
  })();

  if (id === null) return null;
  return { id, reason: ENDING_REASONS[id], at: state.log.length };
}
