import { Panel } from "@/components/ui/Panel";
import type { CardId } from "@/lib/domain";
import type { InfoCardView } from "./expedition-view-model";

interface InfoCardChoicesProps {
  cards: InfoCardView[];
  selectedCardId: CardId | null;
  onSelectCard: (id: CardId) => void;
}

/** 와이어프레임의 조작 영역 1. 카드 한 장을 고른다. */
export function InfoCardChoices({
  cards,
  selectedCardId,
  onSelectCard,
}: InfoCardChoicesProps) {
  return (
    <Panel title="조작 영역 · 정보 카드 한 장">
      <ul className="grid gap-2 sm:grid-cols-3">
        {cards.map((card) => {
          const selected = card.cardId === selectedCardId;
          const border = card.dashed
            ? "border-dashed border-trust-down"
            : "border-edge";
          return (
            <li key={card.cardId}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelectCard(card.cardId)}
                className={`w-full rounded border px-3 py-2 text-left ${border} ${selected ? "bg-edge" : "hover:bg-edge"}`}
              >
                <p className="text-sm text-parchment">
                  {card.truthMark} {card.truthLabel} 카드
                </p>
                <p className="mt-1 text-xs text-parchment">“{card.text}”</p>
                <p className="mt-1 text-xs text-muted">{card.expectedNote}</p>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
