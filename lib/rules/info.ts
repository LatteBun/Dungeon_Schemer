import { INFO_CARDS } from "@/lib/content/info-cards";
import { RuleError, TRUTH_TYPES } from "@/lib/domain";
import type {
  CardId,
  ExpeditionState,
  InfoCard,
  InfoReaction,
  InfoRecord,
  MapNode,
  PartyMember,
  PendingInfo,
  Personality,
  TruthType,
} from "@/lib/domain";
import type { Rng } from "@/lib/rng";
import { evaluateTrust } from "@/lib/rules/trust";
import type { TrustAction, TrustEvaluation } from "@/lib/rules/trust";

export type { InfoReaction } from "@/lib/domain";

export interface MemberInfoCardResult<M extends PartyMember = PartyMember> {
  readonly member: M;
  readonly reaction: InfoReaction;
  readonly trustEvaluation: TrustEvaluation<M> | null;
  readonly pendingVerification: boolean;
  readonly pendingSuspicionEvaluation: boolean;
  /** 이 카드 한 장이 이 파티원에게 만드는 보스 피해 보정. */
  readonly bossDamageModifier: number;
}

/**
 * `audience`는 파티 하나뿐이지만 필드를 남긴다. 보스 수신 계약을 지운 결과를
 * 소비자 코드가 명시적으로 확인할 수 있게 하려는 것이다.
 */
export interface PartyInfoCardEvaluation<M extends PartyMember = PartyMember> {
  readonly audience: "party";
  readonly memberResults: readonly MemberInfoCardResult<M>[];
}

export interface PartyInfoCardOptions<M extends PartyMember> {
  readonly card: InfoCard;
  readonly party: readonly M[];
  readonly cardRng: Rng;
  readonly trustRng: Rng;
}

export interface CreateInfoOpportunityOptions {
  readonly cards?: readonly InfoCard[];
}

/**
 * 수용한 보스 주제 카드가 그 파티원의 보스 피해에 주는 보정이다.
 * docs/superpowers/specs/2026-08-13-sanghwan-yoo-game-direction-rework-design.md
 */
export const BOSS_DAMAGE_MODIFIERS: Readonly<Record<TruthType, number>> = {
  truth: -0.2,
  neutral: -0.1,
  lie: 0.25,
};

/** 정보 기회 하나가 제시해야 하는 최소 후보 수. */
export const MIN_INFO_CARD_CANDIDATES = 2;

const REACTION_LABELS: Readonly<Record<InfoReaction, string>> = {
  accepted: "수용",
  suspected: "의심",
  exposed: "적발",
};

interface ChanceModifiers {
  readonly accept: number;
  readonly expose: number;
}

const BASE_CHANCES: Readonly<
  Record<TruthType, Readonly<{ accept: number; expose: number }>>
> = {
  truth: { accept: 70, expose: 0 },
  neutral: { accept: 55, expose: 0 },
  lie: { accept: 45, expose: 15 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function trustModifier(trust: number): ChanceModifiers {
  if (trust <= 33) return { accept: -20, expose: 15 };
  if (trust <= 66) return { accept: 0, expose: 0 };
  return { accept: 15, expose: -10 };
}

function personalityModifier(
  personality: Personality,
  truthType: TruthType,
): ChanceModifiers {
  switch (personality) {
    case "suspicious":
      return { accept: -20, expose: 20 };
    case "righteous":
      return {
        accept:
          truthType === "truth" ? 15 : truthType === "lie" ? -10 : 0,
        expose: 15,
      };
    case "greedy":
      return { accept: 10, expose: -5 };
    case "prudent":
      return { accept: -10, expose: 10 };
    case "impulsive":
      return { accept: 15, expose: -10 };
  }
}

function reactionFor(
  card: InfoCard,
  member: PartyMember,
  rng: Rng,
): InfoReaction {
  const base = BASE_CHANCES[card.truthType];
  const trust = trustModifier(member.trust);
  const personality = personalityModifier(member.personality, card.truthType);
  const expose = card.truthType === "lie"
    ? clamp(base.expose + trust.expose + personality.expose, 5, 80)
    : base.expose;
  const accept = card.truthType === "lie"
    ? clamp(base.accept + trust.accept + personality.accept, 5, 95 - expose)
    : clamp(base.accept + trust.accept + personality.accept, 5, 95);
  const roll = rng.int(1, 100);

  if (card.truthType === "lie" && roll <= expose) return "exposed";
  if (roll <= expose + accept) return "accepted";
  return "suspected";
}

function immediateTrustAction(
  truthType: TruthType,
  reaction: InfoReaction,
): Extract<
  TrustAction,
  "actHonestly" | "deceptionAccepted" | "deceptionExposed"
> | null {
  if (truthType === "truth" && reaction === "accepted") return "actHonestly";
  if (truthType === "lie" && reaction === "accepted") return "deceptionAccepted";
  if (truthType === "lie" && reaction === "exposed") return "deceptionExposed";
  return null;
}

/**
 * 카드 한 장이 만드는 보스 피해 보정이다.
 *
 * 보스 주제를 수용했을 때만 값이 생긴다. 여러 장의 합산과 `-30%~+50%` 상한은
 * 보스전이 한다. 여기서 합산하면 아직 만나지 않은 카드까지 포함한 값을 미리
 * 만들게 된다.
 */
export function bossDamageModifier(
  card: InfoCard,
  reaction: InfoReaction,
): number {
  if (card.subject !== "boss" || reaction !== "accepted") return 0;
  return BOSS_DAMAGE_MODIFIERS[card.truthType];
}

function resultForMember<M extends PartyMember>(
  card: InfoCard,
  member: M,
  cardRng: Rng,
  trustRng: Rng,
): MemberInfoCardResult<M> {
  const reaction = reactionFor(card, member, cardRng);
  const action = immediateTrustAction(card.truthType, reaction);
  const trustEvaluation = action ? evaluateTrust(member, action, trustRng) : null;

  return {
    member: trustEvaluation?.member ?? { ...member },
    reaction,
    trustEvaluation,
    pendingVerification: card.truthType === "lie" && reaction === "accepted",
    pendingSuspicionEvaluation: reaction === "suspected",
    bossDamageModifier: bossDamageModifier(card, reaction),
  };
}

/**
 * 살아 있는 파티원 각자가 카드 한 장에 독립으로 반응한다.
 *
 * 보스는 카드 수신자가 아니다. 보스 관련 여부는 `InfoCard.subject`로만 나타낸다.
 * docs/superpowers/specs/2026-08-15-sbh3821-party-info-evaluation-design.md
 */
export function evaluatePartyInfoCard<M extends PartyMember>(
  options: PartyInfoCardOptions<M>,
): PartyInfoCardEvaluation<M> {
  return {
    audience: "party",
    memberResults: options.party
      .filter((member) => member.alive)
      .map((member) =>
        resultForMember(options.card, member, options.cardRng, options.trustRng)),
  };
}

/**
 * 도착한 지점에서 고를 수 있는 카드 후보를 만든다.
 *
 * 보스 보장 지점은 보스 주제만 제시해 무엇을 고르든 보스 정보가 전달되게 한다.
 * 반대로 일반 지점에서 보스 주제를 빼는 이유는 E1이 경로마다 고정한 보장 수를
 * 실제 전달 수와 같게 유지하기 위해서다. 일반 지점에서도 보스 카드가 나오면
 * 지도가 선언한 값이 실제를 설명하지 못한다.
 */
export function createInfoOpportunity(
  node: MapNode,
  rng: Rng,
  options: CreateInfoOpportunityOptions = {},
): PendingInfo {
  if (!node.hasInfoOpportunity) {
    throw new RuleError(
      "INVALID_GENERATION",
      `정보 기회가 없는 지점이다: ${node.id}`,
      { nodeId: node.id },
    );
  }

  const wantsBoss = node.bossRelatedInfoCount > 0;
  const eligible = (options.cards ?? INFO_CARDS)
    .filter((card) => (card.subject === "boss") === wantsBoss);
  const cards = TRUTH_TYPES
    .map((truthType) => eligible.filter((card) => card.truthType === truthType))
    .filter((group) => group.length > 0)
    .map((group) => rng.pick(group));

  if (cards.length < MIN_INFO_CARD_CANDIDATES) {
    throw new RuleError(
      "INVALID_GENERATION",
      `정보 기회의 후보가 두 장 미만이다: ${node.id}에 ${cards.length}장`,
      { nodeId: node.id, expected: MIN_INFO_CARD_CANDIDATES, actual: cards.length },
    );
  }

  return {
    nodeId: node.id,
    cardIds: cards.map((card) => card.id as CardId),
    bossRelatedCardCount: cards.filter((card) => card.subject === "boss").length,
  };
}

/** 판정 결과를 파티원별 기록으로 바꾼다. 한 번의 기회가 인원수만큼 기록을 만든다. */
export function toInfoRecords(
  card: InfoCard,
  evaluation: PartyInfoCardEvaluation<PartyMember>,
): InfoRecord[] {
  return evaluation.memberResults.map((result) => ({
    cardId: card.id,
    subject: card.subject,
    memberId: result.member.id,
    reaction: result.reaction,
    modifier: result.bossDamageModifier,
    pendingVerification: result.pendingVerification,
  }));
}

/**
 * 기록과 탐험 로그를 덧붙인다.
 *
 * `pendingInfo`를 지우지 않는 이유는 한 번의 정보 기회가 파티원 수만큼 기록을
 * 만들어 어느 것이 마지막인지 여기서 알 수 없기 때문이다. 비우는 것은 단계
 * 전이의 몫이다.
 */
export function applyInfoRecord(
  expedition: ExpeditionState,
  record: InfoRecord,
): ExpeditionState {
  return {
    ...expedition,
    infoRecords: [...expedition.infoRecords, record],
    log: [
      ...expedition.log,
      {
        at: expedition.log.length,
        kind: "info",
        summary: `${record.cardId} · ${REACTION_LABELS[record.reaction]}`,
        memberIds: [record.memberId],
      },
    ],
  };
}
