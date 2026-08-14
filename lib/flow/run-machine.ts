import type {
  ChoiceId,
  DecisionRecord,
  DungeonEvent,
  DungeonNode,
  EventChoice,
  NodeId,
  RunState,
} from "@/lib/domain";

/**
 * 상태 머신이 다루는 세 행동이다. partyIntro → 입구 이벤트 → 경로 선택과
 * 이벤트의 반복 → 보스방 도달 시 bossFight 진입까지 관리한다. bossFight
 * 이후의 행동은 보스전·종료 작업이 이 유니온을 확장해 추가한다.
 * docs/superpowers/specs/2026-08-13-sbh3821-game-state-machine-design.md
 */
export type RunAction =
  | { type: "enterDungeon" }
  | { type: "completeEvent"; choiceId: ChoiceId }
  | { type: "choosePath"; nodeId: NodeId };

export interface RunMachineContext {
  /** 이번 던전이 사용하는 이벤트 목록. GeneratedDungeon.events를 그대로 넘긴다. */
  readonly events: readonly DungeonEvent[];
}

function findNode(run: RunState, nodeId: NodeId): DungeonNode {
  const node = run.dungeon.nodes.find((candidate) => candidate.id === nodeId);
  if (node === undefined) {
    throw new Error(`던전에 없는 노드다: ${nodeId}`);
  }
  return node;
}

function findEvent(context: RunMachineContext, node: DungeonNode): DungeonEvent {
  const event = context.events.find((candidate) => candidate.id === node.eventId);
  if (event === undefined) {
    throw new Error(
      `노드 ${node.id}의 이벤트 ${node.eventId}가 이벤트 목록에 없다. 던전 생성 결과의 events를 그대로 넘겨야 한다.`,
    );
  }
  return event;
}

function findChoice(event: DungeonEvent, choiceId: ChoiceId): EventChoice {
  const choice = event.choices.find((candidate) => candidate.id === choiceId);
  if (choice === undefined) {
    throw new Error(`이벤트 ${event.id}에 없는 선택지다: ${choiceId}`);
  }
  return choice;
}

function record(run: RunState, nodeId: NodeId, summary: string): DecisionRecord {
  return { at: run.log.length, nodeId, summary, trustChanges: [] };
}

function rejectAction(run: RunState, action: RunAction): never {
  throw new Error(`${run.phase} 단계에서 ${action.type} 행동은 허용되지 않는다.`);
}

function enterDungeon(run: RunState, context: RunMachineContext): RunState {
  // 입장하면 곧바로 입구 이벤트가 시작되므로 입구 이벤트의 존재를 먼저 확인한다.
  findEvent(context, findNode(run, run.currentNodeId));
  return { ...run, phase: "event" };
}

function completeEvent(
  run: RunState,
  choiceId: ChoiceId,
  context: RunMachineContext,
): RunState {
  const event = findEvent(context, findNode(run, run.currentNodeId));
  const choice = findChoice(event, choiceId);
  return {
    ...run,
    phase: "pathChoice",
    log: [...run.log, record(run, run.currentNodeId, `${event.title} · ${choice.label}`)],
  };
}

function choosePath(
  run: RunState,
  nodeId: NodeId,
  context: RunMachineContext,
): RunState {
  const current = findNode(run, run.currentNodeId);
  if (!current.nextNodeIds.includes(nodeId)) {
    throw new Error(
      `${current.id}에서 갈 수 없는 노드다: ${nodeId}. 가능한 경로: ${current.nextNodeIds.join(", ")}`,
    );
  }
  const nextEvent = findEvent(context, findNode(run, nodeId));
  return {
    ...run,
    phase: nodeId === run.dungeon.bossNodeId ? "bossFight" : "event",
    currentNodeId: nodeId,
    log: [...run.log, record(run, nodeId, `경로 선택 · ${nextEvent.title}`)],
  };
}

/**
 * 유효한 전이면 새 RunState를 반환하고, 아니면 Error를 던진다.
 * 입력 run과 context를 변경하지 않으며, 거부된 호출은 어떤 상태도 바꾸지 않는다.
 */
export function transitionRun(
  run: RunState,
  action: RunAction,
  context: RunMachineContext,
): RunState {
  switch (action.type) {
    case "enterDungeon":
      if (run.phase !== "partyIntro") rejectAction(run, action);
      return enterDungeon(run, context);
    case "completeEvent":
      if (run.phase !== "event") rejectAction(run, action);
      return completeEvent(run, action.choiceId, context);
    case "choosePath":
      if (run.phase !== "pathChoice") rejectAction(run, action);
      return choosePath(run, action.nodeId, context);
  }
}
