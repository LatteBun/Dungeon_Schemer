import { Panel } from "@/components/ui/Panel";
import type { ChronicleEntryView } from "./settlement-view-model";

interface ExpeditionChronicleProps {
  entries: ChronicleEntryView[];
}

export function ExpeditionChronicle({ entries }: ExpeditionChronicleProps) {
  return (
    <Panel title="원정 연대기" aside={<span className="text-xs text-muted">{entries.length}건</span>}>
      {entries.length === 0 ? (
        <p className="text-xs text-muted">아직 다녀온 원정이 없다.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-xs">
          {entries.map((entry) => (
            <li
              key={entry.order}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-edge pb-1 last:border-b-0"
            >
              <span className="text-muted tabular-nums">{entry.orderLabel}</span>
              <span className="text-parchment">{entry.dungeonLabel}</span>
              <span className="text-muted">{entry.partyLabel}</span>
              <span
                className={
                  entry.statusMark === "✓" ? "text-trust-up" : "text-trust-down"
                }
              >
                {entry.statusMark} {entry.statusLabel}
              </span>
              <span className="text-muted">{entry.rewardLabel}</span>
              <span className="text-muted tabular-nums">{entry.scoreLabel}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
