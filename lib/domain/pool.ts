import type { Character } from "./character";
import type { CharacterId } from "./ids";

/** 캠페인 시작 시 생성하는 인원. 도중에 늘지 않는다. */
export const CHARACTER_POOL_SIZE = 30;

/** 5직업 × 6명, 5성격 × 6명으로 균등하게 생성한다. */
export const CHARACTERS_PER_CLASS = 6;
export const CHARACTERS_PER_PERSONALITY = 6;

/** 한 원정에 나가는 인원. 위험도와 무관하게 서로 다른 직업 3명이다. */
export const EXPEDITION_PARTY_SIZE = 3;

/**
 * 캠페인의 전체 인원이다.
 *
 * 배열이 아니라 맵으로 두는 이유가 있다. 원정 결과와 월드턴 결과가 모두 개인
 * 단위로 돌아오므로, 매번 배열을 훑어 찾으면 어느 쪽이 최신인지 헷갈린다.
 * docs/systems/CHARACTER_POOL_AND_WORLDTURN.md
 */
export interface CharacterPool {
  byId: Readonly<Record<CharacterId, Character>>;
  /** 생성 순서. 시드가 같으면 같은 순서를 만든다. */
  order: readonly CharacterId[];
}

/**
 * 원정 1회짜리 편성이다.
 *
 * 영속 파티 타입은 만들지 않는다. 원정이 끝나면 이 값은 버리고 남는 것은 각
 * 인물의 상태뿐이다. 타입을 남겨 두면 어딘가에서 다시 캠페인 상태에 얹힌다.
 * docs/systems/CHARACTER_POOL_AND_WORLDTURN.md
 */
export interface ExpeditionParty {
  /** 서로 다른 직업 3명. 순서는 시드가 정한다. */
  memberIds: readonly CharacterId[];
}
