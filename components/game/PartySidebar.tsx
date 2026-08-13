"use client";

import { Panel } from "@/components/ui/Panel";
import type { ClassDef, MemberId, PartyMember, Personality, TrustChange } from "@/lib/domain";
import type { PersonalityProfile } from "@/lib/rules/personality-profile";
import type { TrustHistoryEntry } from "@/lib/rules/trust-history";
import { useUiStore } from "@/lib/stores/game-store-provider";
import { TRUST_UNIT } from "./labels";
import { MemberDetail } from "./MemberDetail";
import { TrustRow } from "./TrustRow";

interface PartySidebarProps {
  party: PartyMember[];
  classes: ClassDef[];
  latestChanges: TrustChange[];
  profiles: Record<Personality, PersonalityProfile>;
  /** 파티원 id를 키로 쓴다. 서버에서 넘어오므로 Map이 아니라 평범한 객체다. */
  history: Record<string, TrustHistoryEntry[]>;
  className?: string;
}

export function PartySidebar({ party, classes, latestChanges, profiles, history, className }: PartySidebarProps) {
  const selectedMemberId = useUiStore((state) => state.selectedMemberId);
  const selectMember = useUiStore((state) => state.selectMember);
  const clearSelectedMember = useUiStore((state) => state.clearSelectedMember);

  const classNameById = new Map(classes.map((klass) => [klass.id, klass.name]));
  const changeByMemberId = new Map(latestChanges.map((change) => [change.memberId, change]));

  const toggle = (memberId: MemberId) => {
    if (memberId === selectedMemberId) clearSelectedMember();
    else selectMember(memberId);
  };

  return <Panel title={`파티와 개인 ${TRUST_UNIT}`} className={className}><ul className="flex flex-col">
    {party.map((member) => {
      const change = changeByMemberId.get(member.id);
      return <TrustRow key={member.id} member={member}
        classLabel={classNameById.get(member.classId) ?? "직업 미정"}
        change={change === undefined ? undefined : { delta: change.delta, reason: change.reason }}
        expanded={member.id === selectedMemberId}
        onToggle={() => { toggle(member.id); }}
        detail={<MemberDetail profile={profiles[member.personality]} history={history[member.id] ?? []} />} />;
    })}
  </ul></Panel>;
}
