import { Panel } from "@/components/ui/Panel";
import type { ClassDef, PartyMember, TrustChange } from "@/lib/domain";
import { TRUST_UNIT } from "./labels";
import { TrustRow } from "./TrustRow";

interface PartySidebarProps { party: PartyMember[]; classes: ClassDef[]; latestChanges: TrustChange[]; className?: string }

export function PartySidebar({ party, classes, latestChanges, className }: PartySidebarProps) {
  const classNameById = new Map(classes.map((klass) => [klass.id, klass.name]));
  const changeByMemberId = new Map(latestChanges.map((change) => [change.memberId, change]));
  return <Panel title={`파티와 개인 ${TRUST_UNIT}`} className={className}><ul className="flex flex-col">
    {party.map((member) => {
      const change = changeByMemberId.get(member.id);
      return <TrustRow key={member.id} member={member} classLabel={classNameById.get(member.classId) ?? "직업 미정"} change={change === undefined ? undefined : { delta: change.delta, reason: change.reason }} />;
    })}
  </ul></Panel>;
}
