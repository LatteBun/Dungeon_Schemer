import { describe, expect, it } from "vitest";
import { createInitialRun } from "@/lib/flow/initial-run";
import { transitionRun } from "@/lib/flow/run-machine";
import type { RunAction, RunMachineContext } from "@/lib/flow/run-machine";
import type {
  ChoiceId,
  DungeonEvent,
  DungeonNode,
  NodeId,
  RunPhase,
  RunState,
} from "@/lib/domain";

const SEEDS = ["seed-a", "seed-b", "seed-c", "던전-1", "던전-2"];

function nodeOf(run: RunState, nodeId: NodeId): DungeonNode {
  const node = run.dungeon.nodes.find((candidate) => candidate.id === nodeId);
  if (node === undefined) throw new Error(`테스트: 노드가 없다: ${nodeId}`);
  return node;
}

function eventOf(context: RunMachineContext, node: DungeonNode): DungeonEvent {
  const event = context.events.find((candidate) => candidate.id === node.eventId);
  if (event === undefined) throw new Error(`테스트: 이벤트가 없다: ${node.eventId}`);
  return event;
}

/** 항상 첫 선택지·첫 경로를 골라 보스방까지 진행한다. */
function walkToBoss(seed: string) {
  const { run: initial, events } = createInitialRun(seed);
  const context: RunMachineContext = { events };
  const states: RunState[] = [initial];
  const visited: NodeId[] = [initial.currentNodeId];

  let run = transitionRun(initial, { type: "enterDungeon" }, context);
  states.push(run);

  for (let step = 0; run.phase !== "bossFight"; step += 1) {
    if (step > 50) throw new Error("테스트: 보스방에 도달하지 못했다.");
    const node = nodeOf(run, run.currentNodeId);
    if (run.phase === "event") {
      const event = eventOf(context, node);
      run = transitionRun(
        run,
        { type: "completeEvent", choiceId: event.choices[0].id },
        context,
      );
    } else {
      run = transitionRun(
        run,
        { type: "choosePath", nodeId: node.nextNodeIds[0] },
        context,
      );
      visited.push(run.currentNodeId);
    }
    states.push(run);
  }

  return { initial, states, final: run, visited, context };
}

describe("게임 상태 머신 전체 여정", () => {
  it("파티 등장부터 보스전 진입까지 유효한 여정이 통과한다", () => {
    for (const seed of SEEDS) {
      const { final } = walkToBoss(seed);
      expect(final.phase).toBe("bossFight");
      expect(final.currentNodeId).toBe(final.dungeon.bossNodeId);
    }
  });

  it("허용된 세 경로 형태 모두에서 여정이 완주된다", () => {
    const shapes = new Set<string>();
    for (let index = 0; index < 30; index += 1) {
      const { final } = walkToBoss(`shape-${index}`);
      const bossDepth = nodeOf(final, final.dungeon.bossNodeId).depth;
      shapes.add(`${final.dungeon.nodes.length}노드-깊이${bossDepth}`);
      expect(final.phase).toBe("bossFight");
    }
    expect(shapes).toEqual(new Set(["7노드-깊이4", "9노드-깊이4", "9노드-깊이5"]));
  });

  it("같은 시드와 같은 행동 순서는 같은 상태를 재현한다", () => {
    for (const seed of SEEDS) {
      expect(walkToBoss(seed).final).toEqual(walkToBoss(seed).final);
    }
  });

  it("전이는 입력 상태와 이벤트 목록을 변경하지 않는다", () => {
    const { run, events } = createInitialRun("immutable-check");
    const context: RunMachineContext = { events };
    const runSnapshot = structuredClone(run);
    const eventsSnapshot = structuredClone(events);

    const next = transitionRun(run, { type: "enterDungeon" }, context);

    expect(next).not.toBe(run);
    expect(run).toEqual(runSnapshot);
    expect(events).toEqual(eventsSnapshot);
  });
});

describe("게임 상태 머신 로그", () => {
  it("이벤트 선택과 경로 선택을 순번대로 기록하고 신뢰 변화는 비워 둔다", () => {
    const { final } = walkToBoss("log-check");
    expect(final.log.length).toBeGreaterThan(0);
    for (const [index, record] of final.log.entries()) {
      expect(record.at).toBe(index);
      expect(record.trustChanges).toEqual([]);
    }
  });

  it("요약은 이벤트 제목·선택지 라벨과 경로 선택 형식을 따른다", () => {
    const { initial, final, context } = walkToBoss("summary-check");
    const entryNode = nodeOf(initial, initial.dungeon.entryNodeId);
    const entryEvent = eventOf(context, entryNode);

    expect(final.log[0].summary).toBe(
      `${entryEvent.title} · ${entryEvent.choices[0].label}`,
    );
    expect(final.log[1].summary).toMatch(/^경로 선택 · /);
  });

  it("로그의 노드 순서로 입구부터 보스방까지 경로가 재구성된다", () => {
    const { initial, final, visited } = walkToBoss("path-rebuild");
    const rebuilt: NodeId[] = [initial.dungeon.entryNodeId];
    for (const record of final.log) {
      if (record.nodeId !== rebuilt[rebuilt.length - 1]) {
        rebuilt.push(record.nodeId);
      }
    }
    expect(rebuilt).toEqual(visited);
  });
});

describe("게임 상태 머신 거부", () => {
  const journey = walkToBoss("reject-check");
  const stateOf = (phase: RunPhase): RunState => {
    const found = journey.states.find((state) => state.phase === phase);
    if (found === undefined) {
      // settlement·ended는 P2 전이가 아직 없으므로 단계만 바꿔 만든다.
      return { ...journey.final, phase };
    }
    return found;
  };
  const context = journey.context;
  const actions: RunAction[] = [
    { type: "enterDungeon" },
    { type: "completeEvent", choiceId: "ghost-choice" as ChoiceId },
    { type: "choosePath", nodeId: "ghost-node" as NodeId },
  ];
  const allowed: Record<RunPhase, RunAction["type"] | null> = {
    partyIntro: "enterDungeon",
    event: "completeEvent",
    pathChoice: "choosePath",
    bossFight: null,
    settlement: null,
    ended: null,
  };

  it("단계에 맞지 않는 행동을 모두 거부한다", () => {
    for (const phase of Object.keys(allowed) as RunPhase[]) {
      const state = stateOf(phase);
      for (const action of actions) {
        if (action.type === allowed[phase]) continue;
        expect(() => transitionRun(state, action, context)).toThrow(/단계/);
      }
    }
  });

  it("현재 노드에서 갈 수 없는 경로를 거부한다", () => {
    const state = stateOf("pathChoice");
    expect(() =>
      transitionRun(state, { type: "choosePath", nodeId: state.currentNodeId }, context),
    ).toThrow(/갈 수 없는 노드/);
  });

  it("이벤트에 없는 선택지를 거부한다", () => {
    const state = stateOf("event");
    expect(() =>
      transitionRun(
        state,
        { type: "completeEvent", choiceId: "ghost-choice" as ChoiceId },
        context,
      ),
    ).toThrow(/없는 선택지/);
  });

  it("이벤트 목록에 현재 노드의 이벤트가 없으면 거부한다", () => {
    const state = stateOf("event");
    expect(() =>
      transitionRun(
        state,
        { type: "completeEvent", choiceId: "ghost-choice" as ChoiceId },
        { events: [] },
      ),
    ).toThrow(/이벤트 목록에 없다/);
  });

  it("던전에 없는 현재 노드를 거부한다", () => {
    const broken: RunState = {
      ...stateOf("partyIntro"),
      currentNodeId: "ghost-node" as NodeId,
    };
    expect(() =>
      transitionRun(broken, { type: "enterDungeon" }, context),
    ).toThrow(/던전에 없는 노드/);
  });

  it("거부된 호출은 어떤 상태도 바꾸지 않는다", () => {
    const state = stateOf("pathChoice");
    const snapshot = structuredClone(state);
    expect(() =>
      transitionRun(state, { type: "enterDungeon" }, context),
    ).toThrow();
    expect(state).toEqual(snapshot);
  });
});
