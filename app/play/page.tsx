"use client";

import { PERSONALITY_LABELS } from "@/components/game/labels";
import { Panel } from "@/components/ui/Panel";
import { CLASSES } from "@/lib/content/classes";
import { useRunStore } from "@/lib/stores/game-store-provider";
import { usePhaseGuard } from "./phase-route";
import { useRunEvents, useRunTransition } from "./play-run-provider";

export default function PlayPage() {
  const run = useRunStore((store) => store.run);
  const events = useRunEvents();
  const dispatch = useRunTransition();
  const matches = usePhaseGuard(["partyIntro"]);
  if (!matches) return null;

  const entryNode = run.dungeon.nodes.find(
    (node) => node.id === run.dungeon.entryNodeId,
  );
  const entryEvent = events.find((event) => event.id === entryNode?.eventId);
  const classNameById = new Map(CLASSES.map((klass) => [klass.id, klass.name]));

  return (
    <>
      <Panel title="새 용사 파티">
        <p className="text-sm text-muted">
          파티가 당신을 길잡이로 고용했다. 각자 당신을 다르게 믿는다.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {run.party.map((member) => (
            <li key={member.id} className="rounded border border-edge px-3 py-2">
              <p className="text-sm text-parchment">
                {member.name}
                <span className="ml-1 text-xs text-muted">
                  {classNameById.get(member.classId) ?? "직업 미정"}
                </span>
              </p>
              <p className="text-xs text-muted">
                {PERSONALITY_LABELS[member.personality]} · 신뢰 {member.trust}
              </p>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="던전 입장">
        {entryEvent === undefined ? (
          <p className="text-sm text-trust-down">입구 이벤트를 찾을 수 없다.</p>
        ) : (
          <>
            <h3 className="text-sm text-parchment">{entryEvent.title}</h3>
            <p className="mt-1 text-sm text-muted">{entryEvent.description}</p>
          </>
        )}
        <button
          type="button"
          onClick={() => dispatch({ type: "enterDungeon" })}
          className="mt-3 inline-block rounded border border-edge px-3 py-2 text-sm text-parchment hover:bg-edge"
        >
          던전에 들어간다
        </button>
        <p className="mt-3 text-xs text-muted">
          seed <code className="font-mono">{run.seed}</code> · 주소에{" "}
          <code className="font-mono">?seed=</code>로 붙이면 같은 판을 재현한다
        </p>
      </Panel>
    </>
  );
}
