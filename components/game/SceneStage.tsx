import type { DungeonEvent, PartyMember } from "@/lib/domain";
import { EVENT_KIND_LABELS, EVENT_KIND_MARKS } from "./labels";

interface SceneStageProps { party: PartyMember[]; event: DungeonEvent; isBoss: boolean }

/** 파티의 자동 행동을 보여주는 정지 장면 자리다. */
export function SceneStage({ party, event, isBoss }: SceneStageProps) {
  return <div className="flex min-h-32 items-center justify-between gap-4 rounded border border-edge bg-panel px-4 py-3" aria-label="파티 행동 장면">
    <ul className="flex flex-wrap gap-3">{party.filter((member) => member.alive).map((member) => <li key={member.id} className="text-center"><span aria-hidden="true" className="block text-2xl">🧍</span><span className="block text-xs text-muted">{member.name}</span></li>)}</ul>
    <span aria-hidden="true" className="text-muted">──▶</span>
    <div className="text-center"><span aria-hidden="true" className="block text-2xl">{isBoss ? "👑" : "👹"}</span><span className="block text-xs text-muted"><span aria-hidden="true">{EVENT_KIND_MARKS[event.kind]}</span>{" "}{EVENT_KIND_LABELS[event.kind]}</span></div>
  </div>;
}
