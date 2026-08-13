import { PERSONALITIES } from "@/lib/domain";
import type { Personality } from "@/lib/domain";
import { TRUST_ACTIONS, TRUST_RULES } from "@/lib/rules/trust";
import type { TrustAction } from "@/lib/rules/trust";

/**
 * 강도 구간의 경계다. 상위를 12로 올리면 충동적 파티원의 경계 행동
 * 넷(-10 -10 -8 -7)이 전부 같은 단계로 뭉쳐 구분이 사라진다.
 */
const STRONG_THRESHOLD = 10;
const MEDIUM_THRESHOLD = 6;

export type ReactionStrength = 1 | 2 | 3;

/**
 * docs/systems/PARTY_AND_TRUST.md 「프로토타입 신뢰 판정」 공통 행동 표의 이름이다.
 * 화면이 @/lib/rules 를 직접 읽지 않도록 프로필이 이름을 함께 실어 보낸다.
 */
export const TRUST_ACTION_LABELS: Record<TrustAction, string> = {
  actHonestly: "정직한 행동",
  deceptionExposed: "기만 적발",
  protectAlly: "동료 보호",
  betrayAlly: "동료 배신",
  secureReward: "본인 이익 확보",
  denyReward: "본인 이익 박탈",
  takeRisk: "위험 감수",
  avoidRisk: "위험 회피",
};

export interface TrustReaction {
  action: TrustAction;
  /** "정직한 행동"처럼 화면에 그대로 쓰는 이름이다. */
  label: string;
  strength: ReactionStrength;
}

export interface PersonalityProfile {
  /** 기본 변화량이 양수인 행동. 강한 순 */
  likes: TrustReaction[];
  /** 기본 변화량이 음수인 행동. 강한 순 */
  guards: TrustReaction[];
}

export function strengthOf(baseDelta: number): ReactionStrength {
  const size = Math.abs(baseDelta);
  if (size >= STRONG_THRESHOLD) return 3;
  if (size >= MEDIUM_THRESHOLD) return 2;
  return 1;
}

function collect(
  personality: Personality,
  keep: (baseDelta: number) => boolean,
): TrustReaction[] {
  return TRUST_ACTIONS.map((action) => ({
    action,
    baseDelta: TRUST_RULES[personality][action].baseDelta,
  }))
    .filter((entry) => keep(entry.baseDelta))
    // sort는 안정 정렬이므로 크기가 같으면 TRUST_ACTIONS 순서가 남는다.
    // 순서가 흔들리면 플레이어가 성격을 학습할 수 없다.
    .sort((left, right) => Math.abs(right.baseDelta) - Math.abs(left.baseDelta))
    .map((entry) => ({
      action: entry.action,
      label: TRUST_ACTION_LABELS[entry.action],
      strength: strengthOf(entry.baseDelta),
    }));
}

/**
 * 기본 변화량이 0인 행동은 넣지 않는다. 그 성격이 그 행동에
 * 의미 있는 반응을 보이지 않으므로 보여줄 반응이 없다.
 */
export function describePersonality(
  personality: Personality,
): PersonalityProfile {
  return {
    likes: collect(personality, (baseDelta) => baseDelta > 0),
    guards: collect(personality, (baseDelta) => baseDelta < 0),
  };
}

export const PERSONALITY_PROFILES = Object.fromEntries(
  // as const 가 없으면 튜플이 아니라 유니온 배열로 추론돼 fromEntries 가 거부한다.
  PERSONALITIES.map(
    (personality) => [personality, describePersonality(personality)] as const,
  ),
) as Record<Personality, PersonalityProfile>;
