"use client";

import { ChoiceList } from "@/components/game/ChoiceList";
import { SceneStage } from "@/components/game/SceneStage";
import { Panel } from "@/components/ui/Panel";
import { useRunStore } from "@/lib/stores/game-store-provider";
import { usePhaseGuard } from "../phase-route";
import { useRunEvents, useRunTransition } from "../play-run-provider";

/** 항상 스토어의 현재 노드 이벤트를 보여준다. URL에 노드를 담지 않는다. */
export default function EncounterPage() {
  const run = useRunStore((store) => store.run);
  const events = useRunEvents();
  const dispatch = useRunTransition();
  const matches = usePhaseGuard(["event", "bossFight"]);
  if (!matches) return null;

  const node = run.dungeon.nodes.find((item) => item.id === run.currentNodeId);
  const event = events.find((item) => item.id === node?.eventId);
  const isBoss = run.phase === "bossFight";

  if (event === undefined) {
    return (
      <Panel title="조우">
        <p className="text-sm text-trust-down">현재 지점의 이벤트를 찾을 수 없다.</p>
      </Panel>
    );
  }

  return (
    <>
      <SceneStage party={run.party} event={event} isBoss={isBoss} />
      <Panel title={isBoss ? "보스전" : "이벤트와 선택"} className="flex-1">
        <ChoiceList
          event={event}
          party={run.party}
          disabled={isBoss}
          onChoose={(choiceId) => dispatch({ type: "completeEvent", choiceId })}
        />
        {isBoss ? (
          <p className="mt-3 text-xs text-muted">
            보스전 진행과 종료 조건은 아직 구현 전이다. 여기까지가 이번 판의
            끝이다.
          </p>
        ) : null}
      </Panel>
    </>
  );
}
