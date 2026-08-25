import { createRng } from "@/lib/rng";

/**
 * 파티원이 화면에 앉는 차례.
 *
 * `C1` 은 파티를 직업 조합으로 짜고, 그 조합은 클래스가 풀에 처음 나온 차례를
 * 따른다. 그래서 한 캠페인 안에서는 어느 공고를 봐도 같은 직업이 같은 자리에
 * 앉는다 — 20 캠페인을 재 보니 100 개 공고가 모두 그랬다. 01 번 자리가 늘
 * 같은 직업이면, 길잡이는 이름을 읽지 않고 자리로 사람을 센다.
 *
 * 규칙이 준 차례를 그대로 바꾸지는 않는다. 전투는 파티 배열 순서대로 행동하고
 * 표적 가중치도 그 배열을 타므로, 규칙에서 섞으면 같은 시드의 전투 결과가
 * 달라진다. 여기서 바꾸는 것은 앉는 자리뿐이다.
 *
 * 자리는 캠페인과 사람에게 매인다. 게시판에서 본 차례와 지도·진행 화면에서 본
 * 차례가 달라지면 같은 파티를 다른 파티로 읽게 되므로, 어느 화면에서 부르든
 * 같은 답이 나와야 한다. 그래서 목록이 아니라 사람 하나하나에 자리를 매긴다.
 */
function seat(seed: string, memberId: string): number {
  return createRng(`${seed}/party-seat/${memberId}`).derive("party").float();
}

export function inSeatOrder<T>(
  seed: string,
  members: readonly T[],
  idOf: (member: T) => string,
): readonly T[] {
  return [...members].sort((left, right) => seat(seed, idOf(left)) - seat(seed, idOf(right)));
}
