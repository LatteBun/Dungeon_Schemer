import { Panel } from "@/components/ui/Panel";
import type { SettlementStepView } from "./settlement-view-model";

interface SettlementTimelineProps {
  steps: SettlementStepView[];
}

/**
 * 정산의 원인 사슬. 순서가 곧 의미이므로 ol로 그려 보조기술도 순서를 읽게 한다.
 */
export function SettlementTimeline({ steps }: SettlementTimelineProps) {
  return (
    <Panel title="정산 · 원인 사슬">
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        {steps.map((step) => (
          <li
            key={step.kind}
            className="rounded border border-edge px-3 py-2"
          >
            <p className="text-sm text-parchment">
              <span className="mr-2 inline-block rounded border border-edge px-2 text-xs text-muted">
                {step.order}
              </span>
              {step.label}
            </p>
            <p className="mt-1 text-xs text-muted">{step.summary}</p>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
