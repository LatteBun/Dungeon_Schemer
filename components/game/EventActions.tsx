import { Panel } from "@/components/ui/Panel";
import type { ChoiceId } from "@/lib/domain";
import type { EventView } from "./expedition-view-model";

interface EventActionsProps {
  view: EventView;
  selectedChoiceId: ChoiceId | null;
  onSelectChoice: (id: ChoiceId) => void;
  onAdvance: () => void;
}

export function EventActions({
  view,
  selectedChoiceId,
  onSelectChoice,
  onAdvance,
}: EventActionsProps) {
  return (
    <Panel title="조작 영역 · 사건 행동">
      <ul className="grid gap-2 sm:grid-cols-2">
        {view.choices.map((choice) => {
          const selected = choice.choiceId === selectedChoiceId;
          return (
            <li key={choice.choiceId}>
              <button
                type="button"
                disabled={choice.disabled}
                aria-pressed={selected}
                onClick={() => onSelectChoice(choice.choiceId)}
                className={`w-full rounded border px-3 py-2 text-left ${selected ? "border-trust-up bg-edge" : "border-edge"} enabled:hover:bg-edge disabled:opacity-40`}
              >
                <p className="text-sm text-parchment">{choice.label}</p>
                <p className="mt-1 text-xs text-muted">이득: {choice.expectedGain}</p>
                <p className="text-xs text-trust-down">위험: {choice.knownRisk}</p>
                {choice.disabledReason === null ? null : (
                  <p className="text-xs text-trust-down">× {choice.disabledReason}</p>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        disabled={selectedChoiceId === null}
        onClick={onAdvance}
        className="mt-3 w-full rounded border border-edge px-3 py-2 text-sm text-parchment enabled:hover:bg-edge disabled:opacity-40"
      >
        → 진행
      </button>
    </Panel>
  );
}
