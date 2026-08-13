import type {
  InfoCard,
  PartyMember,
  Personality,
  TruthType,
} from "@/lib/domain";
import type { Rng } from "@/lib/rng";
import { evaluateTrust } from "@/lib/rules/trust";
import type { TrustAction, TrustEvaluation } from "@/lib/rules/trust";

export type InfoAudience = "party" | "boss";
export type InfoReaction = "accepted" | "suspected" | "exposed";

export interface MemberInfoCardResult {
  readonly member: PartyMember;
  readonly reaction: InfoReaction;
  readonly trustEvaluation: TrustEvaluation | null;
  readonly pendingVerification: boolean;
  readonly pendingSuspicionEvaluation: boolean;
}

export interface PartyInfoCardEvaluation {
  readonly audience: "party";
  readonly memberResults: readonly MemberInfoCardResult[];
}

export interface BossInfoCardEvaluation {
  readonly audience: "boss";
  readonly reaction: InfoReaction;
  readonly pendingVerification: boolean;
  readonly pendingSuspicionEvaluation: boolean;
}

export type InfoCardEvaluation =
  | PartyInfoCardEvaluation
  | BossInfoCardEvaluation;

export interface PartyInfoCardOptions {
  readonly audience: "party";
  readonly card: InfoCard;
  readonly party: readonly PartyMember[];
  readonly cardRng: Rng;
  readonly trustRng: Rng;
}

export interface BossInfoCardOptions {
  readonly audience: "boss";
  readonly card: InfoCard;
  readonly cardRng: Rng;
}

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
  rng: Rng,
  member?: PartyMember,
): InfoReaction {
  const base = BASE_CHANCES[card.truthType];
  const trust = member
    ? trustModifier(member.trust)
    : { accept: 0, expose: 0 };
  const personality = member
    ? personalityModifier(member.personality, card.truthType)
    : { accept: 0, expose: 0 };
  const expose =
    member !== undefined && card.truthType === "lie"
      ? clamp(base.expose + trust.expose + personality.expose, 5, 80)
      : base.expose;
  const accept =
    member === undefined
      ? base.accept
      : card.truthType === "lie"
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
  if (truthType === "lie" && reaction === "accepted") {
    return "deceptionAccepted";
  }
  if (truthType === "lie" && reaction === "exposed") {
    return "deceptionExposed";
  }
  return null;
}

function resultForMember(
  card: InfoCard,
  member: PartyMember,
  cardRng: Rng,
  trustRng: Rng,
): MemberInfoCardResult {
  const reaction = reactionFor(card, cardRng, member);
  const action = immediateTrustAction(card.truthType, reaction);
  const trustEvaluation = action
    ? evaluateTrust(member, action, trustRng)
    : null;

  return {
    member: trustEvaluation?.member ?? { ...member },
    reaction,
    trustEvaluation,
    pendingVerification:
      card.truthType === "lie" && reaction === "accepted",
    pendingSuspicionEvaluation: reaction === "suspected",
  };
}

export function evaluateInfoCard(
  options: PartyInfoCardOptions | BossInfoCardOptions,
): InfoCardEvaluation {
  if (options.audience === "boss") {
    const reaction = reactionFor(options.card, options.cardRng);
    return {
      audience: "boss",
      reaction,
      pendingVerification:
        options.card.truthType === "lie" && reaction === "accepted",
      pendingSuspicionEvaluation: reaction === "suspected",
    };
  }

  return {
    audience: "party",
    memberResults: options.party
      .filter((member) => member.alive)
      .map((member) =>
        resultForMember(
          options.card,
          member,
          options.cardRng,
          options.trustRng,
        ),
      ),
  };
}
