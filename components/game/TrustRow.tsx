import type { PartyMember } from "@/lib/domain";
import { PERSONALITY_LABELS } from "./labels";

interface TrustChangeView { delta: number; reason: string }
interface TrustRowProps { member: PartyMember; classLabel: string; change?: TrustChangeView }

function TrustDelta({ delta, reason }: TrustChangeView) {
  const rising = delta >= 0;
  return <p className={`mt-1 text-xs ${rising ? "text-trust-up" : "text-trust-down"}`}>
    <span aria-hidden="true">{rising ? "▲" : "▼"}</span>
    <span className="sr-only">{rising ? "신뢰 상승 " : "신뢰 하락 "}</span>
    {Math.abs(delta)} · {reason}
  </p>;
}

export function TrustRow({ member, classLabel, change }: TrustRowProps) {
  return <li className="border-b border-edge py-2 last:border-b-0 last:pb-0">
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-sm text-parchment">{member.name}<span className="ml-1 text-xs text-muted">{classLabel}</span></span>
      <span className="text-sm font-semibold tabular-nums text-parchment">{member.trust}</span>
    </div>
    <p className="text-xs text-muted">{PERSONALITY_LABELS[member.personality]}{member.alive ? "" : " · 사망"}</p>
    {change === undefined ? null : <TrustDelta {...change} />}
  </li>;
}
