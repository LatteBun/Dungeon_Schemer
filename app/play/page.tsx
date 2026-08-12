import Link from "next/link";
import { PERSONALITY_LABELS } from "@/components/game/labels";
import { Panel } from "@/components/ui/Panel";
import { MOCK_CLASSES, MOCK_RUN, findEvent, findNode } from "@/lib/mock";

export default function PlayPage() {
  const entryNode = findNode(MOCK_RUN.dungeon.entryNodeId);
  const entryEvent = entryNode === undefined ? undefined : findEvent(entryNode.eventId);
  const classNameById = new Map(MOCK_CLASSES.map((klass) => [klass.id, klass.name]));
  return <>
    <Panel title="새 용사 파티"><p className="text-sm text-muted">파티가 당신을 길잡이로 고용했다. 각자 당신을 다르게 믿는다.</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">{MOCK_RUN.party.map((member) => <li key={member.id} className="rounded border border-edge px-3 py-2">
        <p className="text-sm text-parchment">{member.name}<span className="ml-1 text-xs text-muted">{classNameById.get(member.classId) ?? "직업 미정"}</span></p>
        <p className="text-xs text-muted">{PERSONALITY_LABELS[member.personality]} · 신뢰 {member.trust}</p>
      </li>)}</ul>
    </Panel>
    <Panel title="던전 입장">{entryEvent === undefined ? <p className="text-sm text-trust-down">입구 노드를 찾을 수 없다.</p> : <><h3 className="text-sm text-parchment">{entryEvent.title}</h3><p className="mt-1 text-sm text-muted">{entryEvent.description}</p></>}
      <Link href="/play/map" className="mt-3 inline-block rounded border border-edge px-3 py-2 text-sm text-parchment hover:bg-edge">던전에 들어간다</Link>
    </Panel>
  </>;
}
