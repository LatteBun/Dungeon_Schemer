"use client";

import { DungeonMap } from "@/components/game/DungeonMap";
import { Panel } from "@/components/ui/Panel";
import { reconstructPath } from "@/lib/flow/path";
import { useRunStore } from "@/lib/stores/game-store-provider";
import { usePhaseGuard } from "../phase-route";
import { useRunEvents, useRunTransition } from "../play-run-provider";

export default function MapPage() {
  const run = useRunStore((store) => store.run);
  const events = useRunEvents();
  const dispatch = useRunTransition();
  const matches = usePhaseGuard(["pathChoice"]);
  if (!matches) return null;

  const currentNode = run.dungeon.nodes.find(
    (node) => node.id === run.currentNodeId,
  );

  return (
    <Panel title="던전 분기 지도">
      <p className="mb-3 text-sm text-muted">
        입구는 맨 아래 한 곳이다. 어떤 길을 골라도 맨 위의 보스방으로
        모인다. 당신이 길을 고른다.
      </p>
      <DungeonMap
        dungeon={run.dungeon}
        events={events}
        currentNodeId={run.currentNodeId}
        visitedNodeIds={reconstructPath(run)}
        selectableNodeIds={currentNode?.nextNodeIds ?? []}
        onSelect={(nodeId) => dispatch({ type: "choosePath", nodeId })}
      />
    </Panel>
  );
}
