import type { ReactNode } from "react";
import { TRUST_MIN } from "@/lib/domain";
import type { PartyMember } from "@/lib/domain";
import { PERSONALITY_LABELS } from "./labels";

interface TrustChangeView { delta: number; reason: string }

interface TrustRowProps {
  member: PartyMember;
  classLabel: string;
  change?: TrustChangeView;
  expanded: boolean;
  onToggle: () => void;
  detail: ReactNode;
}

function TrustDelta({ delta, reason }: TrustChangeView) {
  const rising = delta >= 0;
  return <p className={`mt-1 text-xs ${rising ? "text-trust-up" : "text-trust-down"}`}>
    <span aria-hidden="true">{rising ? "▲" : "▼"}</span>
    <span className="sr-only">{rising ? "신뢰 상승 " : "신뢰 하락 "}</span>
    {Math.abs(delta)} · {reason}
  </p>;
}

export function TrustRow({ member, classLabel, change, expanded, onToggle, detail }: TrustRowProps) {
  const detailId = `member-detail-${member.id}`;
  return <li className="border-b border-edge py-2 last:border-b-0 last:pb-0">
    <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={detailId} className="w-full text-left">
      {/* button 은 구문 콘텐츠만 담을 수 있으므로 div 와 p 대신 span 을 쓴다. */}
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-parchment">
          <span aria-hidden="true" className="mr-1 text-xs text-muted">{expanded ? "▼" : "▶"}</span>
          {member.name}<span className="ml-1 text-xs text-muted">{classLabel}</span>
        </span>
        <span className="text-sm font-semibold tabular-nums text-parchment">{member.trust}</span>
      </span>
      <span className="block text-xs text-muted">{PERSONALITY_LABELS[member.personality]}{member.alive ? "" : " · 사망"}</span>
    </button>
    {member.trust === TRUST_MIN ? <p className="text-xs text-trust-down"><span aria-hidden="true">⚠ </span>정체 발각</p> : null}
    {change === undefined ? null : <TrustDelta {...change} />}
    <div id={detailId} hidden={!expanded}>{expanded ? detail : null}</div>
  </li>;
}
