import type {
  InfoCard,
  PartyMember,
} from "@/lib/domain";
import { MOCK_CARDS, MOCK_PARTY } from "@/lib/mock";
import { createRng } from "@/lib/rng";
import { evaluateInfoCard } from "@/lib/rules/info";

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
