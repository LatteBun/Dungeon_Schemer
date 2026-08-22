import { TRUST_MAX, TRUST_MIN } from "@/lib/domain";
import type {
  Character,
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
  "adviceHelped",
  "adviceHarmed",
  "suspicionWasCostly",
  "suspicionWasCorrect",
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
    adviceHelped: rule(2, "의심 많은 성격: 조언이 실제로 도움이 되어 신뢰를 보냄"),
    adviceHarmed: rule(-4, "의심 많은 성격: 조언이 해가 되어 플레이어를 경계함"),
    suspicionWasCostly: rule(10, "의심 많은 성격: 근거 없는 의심으로 입은 손해에서 신뢰할 이유를 배움"),
    suspicionWasCorrect: rule(-5, "의심 많은 성격: 의심이 이득이 되어 플레이어를 더 경계함"),
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
    adviceHelped: rule(3, "정의로운 성격: 조언이 실제로 도움이 되어 신뢰를 보냄"),
    adviceHarmed: rule(-3, "정의로운 성격: 조언이 해가 되어 플레이어를 경계함"),
    suspicionWasCostly: rule(8, "정의로운 성격: 불신으로 동료가 손해 본 일을 반성하며 신뢰함"),
    suspicionWasCorrect: rule(-8, "정의로운 성격: 의심이 옳았다는 결과로 플레이어를 강하게 불신함"),
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
    adviceHelped: rule(2, "탐욕스러운 성격: 조언이 실제 이익으로 이어져 신뢰를 보냄"),
    adviceHarmed: rule(-3, "탐욕스러운 성격: 조언이 이익을 해쳐 플레이어를 경계함"),
    suspicionWasCostly: rule(4, "탐욕스러운 성격: 의심으로 잃은 이익을 보고 신뢰를 조금 회복함"),
    suspicionWasCorrect: rule(-5, "탐욕스러운 성격: 의심 덕분에 이득을 얻어 플레이어를 경계함"),
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
    adviceHelped: rule(3, "신중한 성격: 조언이 실제로 도움이 되어 신뢰를 보냄"),
    adviceHarmed: rule(-4, "신중한 성격: 조언이 해가 되어 플레이어를 경계함"),
    suspicionWasCostly: rule(9, "신중한 성격: 과도한 경계가 손해를 낳았음을 확인하고 신뢰함"),
    suspicionWasCorrect: rule(-7, "신중한 성격: 의심이 위험을 피하게 해 플레이어를 덜 신뢰함"),
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
    adviceHelped: rule(4, "충동적 성격: 조언이 즉시 도움이 되어 신뢰를 보냄"),
    adviceHarmed: rule(-2, "충동적 성격: 조언이 해가 되어 플레이어를 경계함"),
    suspicionWasCostly: rule(7, "충동적 성격: 의심으로 기회를 놓친 일을 보고 신뢰를 회복함"),
    suspicionWasCorrect: rule(-6, "충동적 성격: 의심이 이득이 되어 플레이어를 즉시 불신함"),
  },
} as const satisfies Readonly<
  Record<Personality, Readonly<Record<TrustAction, TrustRule>>>
>;

/**
 * 넘긴 인물 타입을 그대로 돌려준다.
 *
 * `Character`로 못박으면 `CampaignMember`를 넣었을 때 HP·소지 골드·기억이
 * 결과 타입에서 사라진다. 호출자가 단언으로 되돌리게 되고, 그 단언이 실제로
 * 필드를 잃은 자리까지 가려버린다.
 */
export interface TrustEvaluation<M extends Character = Character> {
  member: M;
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

export function evaluateTrust<M extends Character>(
  member: M,
  action: TrustAction,
  rng: Rng,
): TrustEvaluation<M> {
  assertValidTrust(member.trust);
  const trustRule = TRUST_RULES[member.personality][action];

  if (member.trust === TRUST_MIN) {
    return {
      member: { ...member },
      change: {
        characterId: member.id,
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
      characterId: member.id,
      delta: nextTrust - member.trust,
      reason: trustRule.reason,
    },
    exposed: nextTrust === TRUST_MIN,
  };
}
