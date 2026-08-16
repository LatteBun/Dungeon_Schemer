import type { ReactNode } from "react";
import { Panel } from "@/components/ui/Panel";
import type { MemberStatusView } from "./expedition-view-model";

interface PartyStatusSidebarProps {
  members: MemberStatusView[];
  footer?: ReactNode;
}

function trustDelta(delta: number): { text: string; className: string } | null {
  if (delta > 0) return { text: `▲${delta}`, className: "text-trust-up" };
  if (delta < 0) return { text: `▼${Math.abs(delta)}`, className: "text-trust-down" };
  return null;
}

export function PartyStatusSidebar({ members, footer }: PartyStatusSidebarProps) {
  return (
    <Panel title="개인 파티 상태">
      <ul className="flex flex-col gap-2">
        {members.map((member) => {
          const delta = trustDelta(member.trustDelta);
          return (
            <li
              key={member.memberId}
              className={`rounded border px-3 py-2 ${
                member.alive ? "border-edge" : "border-dashed border-trust-down"
              }`}
            >
              <p className="text-sm text-parchment">
                {member.name}
                <span className="ml-1 text-xs text-muted">{member.className}</span>
                {member.alive ? null : (
                  <span className="ml-1 text-xs text-trust-down">· 사망</span>
                )}
              </p>
              <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
                <span>HP {member.currentHp} / {member.maxHp}</span>
                <span>
                  신뢰 {member.trust}
                  {delta === null ? null : (
                    <span className={`ml-1 ${delta.className}`}>
                      {delta.text}
                      <span className="sr-only">
                        {member.trustDelta > 0 ? " 신뢰 상승" : " 신뢰 하락"}
                      </span>
                    </span>
                  )}
                </span>
                <span>소지 {member.carriedGold}G</span>
              </p>
              <p className="mt-1 text-xs text-muted">{member.memoryNote}</p>
            </li>
          );
        })}
      </ul>
      {footer === undefined ? null : <div className="mt-3">{footer}</div>}
    </Panel>
  );
}
