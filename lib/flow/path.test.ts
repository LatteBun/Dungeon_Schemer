import { describe, expect, it } from "vitest";
import { createInitialRun } from "@/lib/flow/initial-run";
import { reconstructPath } from "@/lib/flow/path";
import { transitionRun } from "@/lib/flow/run-machine";
import type { RunMachineContext } from "@/lib/flow/run-machine";
import type { NodeId, RunState } from "@/lib/domain";

/** 항상 첫 선택지·첫 경로를 골라 보스방까지 진행한다. */
function walkToBoss(seed: string) {
  const { run: initial, events } = createInitialRun(seed);
  const context: RunMachineContext = { events };
  const visited: NodeId[] = [initial.currentNodeId];

  let run = transitionRun(initial, { type: "enterDungeon" }, context);
  for (let step = 0; run.phase !== "bossFight"; step += 1) {
    if (step > 50) throw new Error("테스트: 보스방에 도달하지 못했다.");
    const node = run.dungeon.nodes.find((candidate) => candidate.id === run.currentNodeId);
    if (node === undefined) throw new Error("테스트: 현재 노드가 없다.");
    if (run.phase === "event") {
      const event = events.find((candidate) => candidate.id === node.eventId);
      if (event === undefined) throw new Error("테스트: 이벤트가 없다.");
      run = transitionRun(
        run,
        { type: "completeEvent", choiceId: event.choices[0].id },
        context,
      );
    } else {
      run = transitionRun(run, { type: "choosePath", nodeId: node.nextNodeIds[0] }, context);
      visited.push(run.currentNodeId);
    }
  }
  return { final: run, visited };
}

describe("방문 경로 재구성", () => {
  it("시작 직후에는 입구만 있다", () => {
    const { run } = createInitialRun("path-start");
    expect(reconstructPath(run)).toEqual([run.dungeon.entryNodeId]);
  });

  it("전체 여정에서 입구부터 보스방까지 방문 순서와 일치한다", () => {
    for (const seed of ["path-a", "path-b", "던전-경로"]) {
      const { final, visited } = walkToBoss(seed);
      expect(reconstructPath(final)).toEqual(visited);
    }
  });

  it("재구성한 경로에 중복 노드가 없다", () => {
    const { final } = walkToBoss("path-unique");
    const path = reconstructPath(final);
    expect(new Set(path).size).toBe(path.length);
  });

  it("입력 상태를 변경하지 않는다", () => {
    const { final } = walkToBoss("path-immutable");
    const snapshot = structuredClone(final) as RunState;
    reconstructPath(final);
    expect(final).toEqual(snapshot);
  });
});
