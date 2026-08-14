import type { InfoCard, PartyMember } from "@/lib/domain";
import { MOCK_CARDS, MOCK_PARTY } from "@/lib/mock";
import { createRng } from "@/lib/rng";
import { evaluatePartyInfoCard } from "@/lib/rules/info";
import type { PartyInfoCardEvaluation } from "@/lib/rules/info";

export interface InfoCardHarnessOptions {
  readonly seed: string;
  readonly cardIndex: number;
}

export interface InfoCardHarnessResult {
  readonly seed: string;
  readonly card: InfoCard;
  readonly party: readonly PartyMember[];
  readonly evaluation: PartyInfoCardEvaluation<PartyMember>;
}

function boundedIndex(index: number, length: number): number {
  if (length === 0) throw new RangeError("빈 목록에는 인덱스를 적용할 수 없다.");
  if (!Number.isFinite(index)) return 0;
  return Math.min(length - 1, Math.max(0, Math.trunc(index)));
}

function selectedCard(cardIndex: number): InfoCard {
  return MOCK_CARDS[boundedIndex(cardIndex, MOCK_CARDS.length)];
}

/**
 * 카드 수신자는 살아 있는 용사 파티원뿐이다. 보스는 카드의 주제일 수 있지만
 * 수신자가 아니므로 하네스에도 수신자 선택이 없다.
 * docs/superpowers/specs/2026-08-15-sbh3821-party-info-evaluation-design.md
 */
export function createInfoCardHarnessResult(
  options: InfoCardHarnessOptions,
): InfoCardHarnessResult {
  const card = selectedCard(options.cardIndex);
  const party = MOCK_PARTY.map((member) => ({ ...member }));
  const rng = createRng(options.seed);

  return {
    seed: options.seed,
    card,
    party,
    evaluation: evaluatePartyInfoCard({
      card,
      party,
      cardRng: rng.derive("card"),
      trustRng: rng.derive("trust"),
    }),
  };
}
