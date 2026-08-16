import type { CampaignDungeon, CampaignState } from "@/lib/domain";

/**
 * 한 원정을 가리키는 안정된 난수 키다.
 *
 * 호출 횟수가 아니라 식별자에서 파생하므로 같은 시드로 같은 선택을 하면 중간에
 * 무엇을 몇 번 했든 같은 결과가 나온다. 실패 횟수를 넣는 이유는 전멸 뒤 등급이
 * 올라 같은 던전을 다시 도전할 때 첫 도전과 같은 지도가 나오지 않게 하려는 것이다.
 *
 * 캠페인 시드·던전 id·실패 횟수에만 의존하고 공고와 파티를 타지 않는다. 그래서
 * 계약 전에 만든 지도와 계약 후 만든 지도가 같다. 게시판의 위험 미리보기가
 * 이 성질에 기댄다.
 */
export function expeditionKey(
  state: CampaignState,
  dungeon: CampaignDungeon,
): string {
  return `${state.seed}/${dungeon.id}#${dungeon.failureCount}`;
}
