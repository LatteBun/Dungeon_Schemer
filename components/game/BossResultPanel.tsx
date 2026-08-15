import { Panel } from "@/components/ui/Panel";
import type { BossResultView } from "./settlement-view-model";

interface BossResultPanelProps {
  view: BossResultView;
}

/** 자동 보스전 결과. 새 선택 없이 누적 상태가 만든 결말을 원인과 함께 보여준다. */
export function BossResultPanel({ view }: BossResultPanelProps) {
  return (
    <Panel title={`자동 보스전 결과 · ${view.outcomeLabel}`}>
      <ul className="grid gap-2 sm:grid-cols-3">
        {view.members.map((member) => (
          <li
            key={member.memberId}
            className={`rounded border px-3 py-2 ${
              member.survived
                ? "border-trust-up"
                : "border-dashed border-trust-down"
            }`}
          >
            <p className="text-sm text-parchment">
              <span className={member.survived ? "text-trust-up" : "text-trust-down"}>
                {member.survivalMark} {member.survivalLabel}
              </span>
              <span className="ml-2">{member.name}</span>
              <span className="ml-1 text-xs text-muted">{member.className}</span>
            </p>
            <p className="mt-1 text-xs text-muted">
              HP {member.hpBefore} → {member.hpAfter} · 피해 {member.damage}
            </p>
            <p className="mt-1 text-xs text-muted">원인: {member.modifierNote}</p>
            {member.verificationNote === null ? null : (
              <p className="mt-1 text-xs text-muted">
                <span
                  className={
                    member.trustDelta < 0 ? "text-trust-down" : "text-trust-up"
                  }
                >
                  신뢰 {member.trustDelta > 0 ? "+" : ""}{member.trustDelta}
                </span>
                {" · "}
                {member.verificationNote}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
