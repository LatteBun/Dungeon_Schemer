import type {
  EventEffectTag,
  EventKind,
  Grade,
  ItemEffectTag,
} from "@/lib/domain";

/**
 * 개입하지 않아도 일어나는 사건 분류별 HP 변화다.
 *
 * 기본값을 두는 이유는 아무것도 하지 않는 것이 안전한 선택이 되지 않게 하려는
 * 것이다. 길잡이가 개입하지 않으면 파티는 서서히 깎인다. 관망은 `개입하지
 * 않는다`는 선택이지 `아무 일도 없다`가 아니다.
 * docs/superpowers/specs/2026-08-15-sbh3821-event-action-boss-fight-design.md
 */
export const EVENT_KIND_BASE_HP: Readonly<Record<EventKind, number>> = {
  monster: -20,
  rest: 8,
  merchant: 0,
  special: -12,
};

/**
 * 선택한 행동이 분류 기본값에 더하는 HP 보정이다.
 *
 * `information`이 0이 아닌 이유는 그러면 `observe`와 완전히 같아져 두 선택지가
 * 모두 그 조합인 사건이 선택 없는 사건이 되기 때문이다. 던전의 의도를 읽으면
 * 파티가 조금 덜 다치는 것으로 해석한다.
 */
export const EVENT_EFFECT_HP: Readonly<Record<EventEffectTag, number>> = {
  support: 12,
  sabotage: -14,
  rest: 10,
  item: 8,
  information: 4,
  trade: 0,
  observe: 0,
};

/**
 * 상품을 사서 바로 썼을 때의 HP 보정이다.
 *
 * 독과 미끼는 파티를 직접 회복시키지 않지만 위협을 줄여 파티가 덜 다치게 한다.
 * 소지품 목록이 없으므로 구매와 사용을 한 번에 처리한다.
 */
export const ITEM_EFFECT_HP: Readonly<Record<ItemEffectTag, number>> = {
  restoreHp: 20,
  dealDamage: 12,
  lureMonster: 10,
  restoreFood: 6,
  revealInformation: 4,
};

/**
 * 던전 등급이 사건 효과 크기에 주는 배율이다.
 *
 * 경로 길이만으로는 난이도 차이가 벌어지지 않는다. C의 일반 사건은 4개, S는
 * 7개로 1.75배인데 보스 기본 피해는 3배 차이다. 사건 쪽도 함께 올려야 보스방
 * 도착 HP가 등급별로 갈린다.
 */
export const GRADE_EFFECT_SCALE: Readonly<Record<Grade, number>> = {
  C: 1,
  B: 1.3,
  A: 1.6,
  S: 2,
};

/** 보스 정보 보정의 누적 상한. 파티원마다 독립으로 적용한다. */
export const BOSS_MODIFIER_MIN = -0.3;
export const BOSS_MODIFIER_MAX = 0.5;

/**
 * 한 사건 지점에서 살아 있는 파티원 전원이 함께 받는 HP 변화다.
 *
 * 개인차를 두지 않는 이유는 사건이 파티 전체가 겪는 상황이기 때문이다. 개인별
 * 차이는 정보 카드 반응이 만든다.
 *
 * 구매한 상품의 효과도 같은 배율을 지난다. 등급마다 다른 배율을 쓰면 같은
 * 가격의 상품이 등급별로 다른 값을 갖게 되고, 조정할 상수가 두 벌이 된다.
 */
export function eventHpDelta(
  kind: EventKind,
  effectTags: readonly EventEffectTag[],
  grade: Grade,
  itemEffectTags: readonly ItemEffectTag[] = [],
): number {
  const base = EVENT_KIND_BASE_HP[kind];
  const action = effectTags.reduce((sum, tag) => sum + EVENT_EFFECT_HP[tag], 0);
  const item = itemEffectTags.reduce((sum, tag) => sum + ITEM_EFFECT_HP[tag], 0);
  return Math.round((base + action + item) * GRADE_EFFECT_SCALE[grade]);
}
