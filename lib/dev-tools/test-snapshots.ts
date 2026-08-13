import type {
  InfoCard,
  PartyMember,
  RunState,
} from "@/lib/domain";
import { MOCK_CARDS, MOCK_PARTY } from "@/lib/mock";
import { createRng } from "@/lib/rng";
import type { TrustAction, TrustEvaluation } from "@/lib/rules/trust";
import { evaluateInfoCard } from "@/lib/rules/info";
import { evaluateTrust } from "@/lib/rules/trust";
import {
  generateDungeon,
  type GeneratedDungeon,
} from "@/lib/rules/dungeon";
import { generateParty } from "@/lib/rules/party";

export type HarnessAudience = "party" | "boss";

export interface R3HarnessOptions {
  readonly seed: string;
  readonly audience: HarnessAudience;
  readonly cardIndex: number;
}

export interface R3HarnessResult {
  readonly seed: string;
  readonly audience: HarnessAudience;
  readonly card: InfoCard;
  readonly party: readonly PartyMember[];
  readonly evaluation: ReturnType<typeof evaluateInfoCard>;
}

export interface IntegrationSnapshotOptions extends R3HarnessOptions {
  readonly memberIndex: number;
  readonly trustAction: TrustAction;
}

export interface IntegrationSnapshot {
  readonly seed: string;
  readonly audience: HarnessAudience;
  readonly card: InfoCard;
  readonly party: readonly PartyMember[];
  readonly dungeon: GeneratedDungeon;
  readonly selectedMemberIndex: number;
  readonly trustAction: TrustAction;
  readonly trustEvaluation: TrustEvaluation;
  readonly infoEvaluation: ReturnType<typeof evaluateInfoCard>;
  readonly run: RunState;
}

function boundedIndex(index: number, length: number): number {
  if (length === 0) throw new RangeError("빈 목록에는 인덱스를 적용할 수 없다.");
  if (!Number.isFinite(index)) return 0;
  return Math.min(length - 1, Math.max(0, Math.trunc(index)));
}

function selectedCard(cardIndex: number): InfoCard {
  return MOCK_CARDS[boundedIndex(cardIndex, MOCK_CARDS.length)];
}

function evaluatePartyOrBoss(
  options: R3HarnessOptions,
  card: InfoCard,
  party: readonly PartyMember[],
) {
  const rng = createRng(options.seed);
  if (options.audience === "boss") {
    return evaluateInfoCard({
      audience: "boss",
      card,
      cardRng: rng.derive("card"),
    });
  }
  return evaluateInfoCard({
    audience: "party",
    card,
    party,
    cardRng: rng.derive("card"),
    trustRng: rng.derive("trust"),
  });
}

export function createR3HarnessResult(
  options: R3HarnessOptions,
): R3HarnessResult {
  const card = selectedCard(options.cardIndex);
  const party = MOCK_PARTY.map((member) => ({ ...member }));
  return {
    seed: options.seed,
    audience: options.audience,
    card,
    party,
    evaluation: evaluatePartyOrBoss(options, card, party),
  };
}

function createRunState(
  seed: string,
  party: PartyMember[],
  dungeon: GeneratedDungeon,
): RunState {
  return {
    seed,
    phase: "event",
    party,
    dungeon: dungeon.dungeon,
    currentNodeId: dungeon.dungeon.entryNodeId,
    resources: { gold: 42, food: 7, reputation: 3 },
    pendingClaims: [],
    log: [],
  };
}

export function createIntegrationSnapshot(
  options: IntegrationSnapshotOptions,
): IntegrationSnapshot {
  const rng = createRng(options.seed);
  const party = generateParty(rng.derive("party"));
  const dungeon = generateDungeon(rng.derive("dungeon"));
  const selectedMemberIndex = boundedIndex(options.memberIndex, party.length);
  const card = selectedCard(options.cardIndex);
  const evaluationOptions: R3HarnessOptions = {
    seed: options.seed,
    audience: options.audience,
    cardIndex: options.cardIndex,
  };
  const infoEvaluation = evaluatePartyOrBoss(evaluationOptions, card, party);
  const trustEvaluation = evaluateTrust(
    party[selectedMemberIndex],
    options.trustAction,
    rng.derive("trust"),
  );

  return {
    seed: options.seed,
    audience: options.audience,
    card,
    party,
    dungeon,
    selectedMemberIndex,
    trustAction: options.trustAction,
    trustEvaluation,
    infoEvaluation,
    run: createRunState(options.seed, party, dungeon),
  };
}
