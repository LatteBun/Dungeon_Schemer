import { TRUST_MAX, TRUST_MIN } from "@/lib/domain";
import type {
  PartyMember,
  Personality,
  TrustChange,
} from "@/lib/domain";
import type { Rng } from "@/lib/rng";

export const TRUST_ACTIONS = [
  "actHonestly",
  "deceptionExposed",
  "protectAlly",
  "betrayAlly",
  "secureReward",
  "denyReward",
  "takeRisk",
  "avoidRisk",
] as const;

export type TrustAction = (typeof TRUST_ACTIONS)[number];

export interface TrustRule {
  readonly baseDelta: number;
  readonly reason: string;
}

const rule = (baseDelta: number, reason: string): TrustRule => ({
  baseDelta,
  reason,
});

export const TRUST_RULES = {
  suspicious: {
    actHonestly: rule(8, "의심 많은 성격: 정직한 태도에서 신뢰할 근거를 얻음"),
    deceptionExposed: rule(-14, "의심 많은 성격: 기만이 드러나 강하게 경계함"),
    protectAlly: rule(3, "의심 많은 성격: 동료를 보호한 행동을 긍정적으로 봄"),
    betrayAlly: rule(-8, "의심 많은 성격: 동료를 배신한 행동에서 위험을 느낌"),
    secureReward: rule(3, "의심 많은 성격: 실질적인 이익을 확인함"),
    denyReward: rule(-5, "의심 많은 성격: 약속된 이익이 사라져 의심함"),
    takeRisk: rule(-5, "의심 많은 성격: 근거 없는 위험 감수를 경계함"),
    avoidRisk: rule(7, "의심 많은 성격: 위험을 피한 신중한 판단을 신뢰함"),
  },
  righteous: {
    actHonestly: rule(12, "정의로운 성격: 정직한 행동을 높이 평가함"),
    deceptionExposed: rule(-16, "정의로운 성격: 드러난 기만을 용납하지 않음"),
    protectAlly: rule(12, "정의로운 성격: 동료를 보호한 행동을 높이 평가함"),
    betrayAlly: rule(-16, "정의로운 성격: 동료를 배신한 행동을 용납하지 않음"),
    secureReward: rule(4, "정의로운 성격: 정당한 이익을 긍정적으로 받아들임"),
    denyReward: rule(-6, "정의로운 성격: 마땅한 몫을 빼앗긴 일을 부당하게 여김"),
    takeRisk: rule(-3, "정의로운 성격: 불필요한 위험으로 동료를 위태롭게 한 점을 걱정함"),
    avoidRisk: rule(3, "정의로운 성격: 동료의 안전을 고려한 판단을 긍정적으로 봄"),
  },
  greedy: {
    actHonestly: rule(0, "탐욕스러운 성격: 이익과 무관한 정직에는 반응하지 않음"),
    deceptionExposed: rule(-6, "탐욕스러운 성격: 기만으로 손해 볼 가능성을 경계함"),
    protectAlly: rule(0, "탐욕스러운 성격: 보상 없는 동료 보호에는 반응하지 않음"),
    betrayAlly: rule(-4, "탐욕스러운 성격: 자신도 배신당할 수 있다고 경계함"),
    secureReward: rule(14, "탐욕스러운 성격: 자신의 이익을 확보해 크게 만족함"),
    denyReward: rule(-16, "탐욕스러운 성격: 자신의 이익을 빼앗겨 크게 분노함"),
    takeRisk: rule(3, "탐욕스러운 성격: 더 큰 이익을 노린 위험 감수를 긍정적으로 봄"),
    avoidRisk: rule(0, "탐욕스러운 성격: 이익과 무관한 위험 회피에는 반응하지 않음"),
  },
  prudent: {
    actHonestly: rule(5, "신중한 성격: 예측 가능한 정직한 태도를 신뢰함"),
    deceptionExposed: rule(-10, "신중한 성격: 드러난 기만을 중대한 위험으로 봄"),
    protectAlly: rule(7, "신중한 성격: 동료의 생존을 지킨 판단을 높이 평가함"),
    betrayAlly: rule(-10, "신중한 성격: 파티를 불안정하게 만든 배신을 경계함"),
    secureReward: rule(5, "신중한 성격: 안정적인 이익을 확보한 점을 긍정적으로 봄"),
    denyReward: rule(-7, "신중한 성격: 확보할 수 있던 이익을 잃은 판단을 나쁘게 봄"),
    takeRisk: rule(-12, "신중한 성격: 무모한 위험 감수를 강하게 반대함"),
    avoidRisk: rule(12, "신중한 성격: 위험을 피한 안전한 판단을 높이 평가함"),
  },
  impulsive: {
    actHonestly: rule(3, "충동적 성격: 솔직하고 즉각적인 태도를 긍정적으로 봄"),
    deceptionExposed: rule(-7, "충동적 성격: 기만당했다는 사실에 즉각 반발함"),
    protectAlly: rule(8, "충동적 성격: 망설이지 않고 동료를 구한 행동을 좋아함"),
    betrayAlly: rule(-10, "충동적 성격: 동료를 저버린 행동에 강하게 반발함"),
    secureReward: rule(7, "충동적 성격: 즉시 얻은 보상에 만족함"),
    denyReward: rule(-8, "충동적 성격: 눈앞의 보상을 잃어 강하게 불만을 느낌"),
    takeRisk: rule(12, "충동적 성격: 과감한 위험 감수를 높이 평가함"),
    avoidRisk: rule(-10, "충동적 성격: 위험을 피한 소극적인 판단을 답답해함"),
  },
} as const satisfies Readonly<
  Record<Personality, Readonly<Record<TrustAction, TrustRule>>>
>;

export interface TrustEvaluation {
  member: PartyMember;
  change: TrustChange;
  exposed: boolean;
}

function clampTrust(value: number): number {
  return Math.min(TRUST_MAX, Math.max(TRUST_MIN, value));
}

function assertValidTrust(trust: number): void {
  if (
    !Number.isInteger(trust) ||
    trust < TRUST_MIN ||
    trust > TRUST_MAX
  ) {
    throw new RangeError(
      `신뢰도는 ${TRUST_MIN} 이상 ${TRUST_MAX} 이하의 정수여야 한다: ${trust}`,
    );
  }
}

function rollDelta(baseDelta: number, rng: Rng): number {
  if (baseDelta === 0) return 0;
  const spread = Math.max(1, Math.round(Math.abs(baseDelta) * 0.2));
  const rolled = baseDelta + rng.int(-spread, spread);
  return baseDelta > 0 ? Math.max(1, rolled) : Math.min(-1, rolled);
}

export function evaluateTrust(
  member: PartyMember,
  action: TrustAction,
  rng: Rng,
): TrustEvaluation {
  assertValidTrust(member.trust);
  const trustRule = TRUST_RULES[member.personality][action];

  if (member.trust === TRUST_MIN) {
    return {
      member: { ...member },
      change: {
        memberId: member.id,
        delta: 0,
        reason: `${trustRule.reason} · 이미 정체가 발각됨`,
      },
      exposed: true,
    };
  }

  const nextTrust = clampTrust(member.trust + rollDelta(trustRule.baseDelta, rng));
  const nextMember = { ...member, trust: nextTrust };
  return {
    member: nextMember,
    change: {
      memberId: member.id,
      delta: nextTrust - member.trust,
      reason: trustRule.reason,
    },
    exposed: nextTrust === TRUST_MIN,
  };
}
