import { Panel } from "@/components/ui/Panel";
import type { CardId } from "@/lib/domain";
import type { InfoOpportunityView } from "./expedition-view-model";

interface InfoOpportunityPanelProps {
  view: InfoOpportunityView;
  selectedCardId: CardId | null;
  onSelectCard: (id: CardId) => void;
}

export function InfoOpportunityPanel({
  view,
  selectedCardId,
  onSelectCard,
}: InfoOpportunityPanelProps) {
  return (
    <Panel title="정보 전달 · 관람 영역">
      <p className="text-sm text-parchment">{view.scene.sceneText}</p>
      <p className="mt-1 text-xs text-muted">
        파티: {view.scene.memberNames.map((member) => member.name).join(" · ")}
      </p>
      <p className="mt-1 text-xs text-trust-down">{view.scene.riskSummary}</p>

      <h3 className="mt-3 text-sm font-semibold text-muted">정보 카드 한 장</h3>
      <ul className="mt-2 grid gap-2 sm:grid-cols-3">
        {view.cards.map((card) => {
          const selected = card.cardId === selectedCardId;
          const border = card.dashed ? "border-dashed border-trust-down" : "border-edge";
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
