import { describe, expect, it } from "vitest";
import type {
  ClassId,
  EventId,
  MemberId,
  NodeId,
  RunState,
} from "@/lib/domain";
import { createRunStore } from "@/lib/stores/run-store";

function createTestRun(seed: string): RunState {
  const entryNodeId = "test-entry" as NodeId;
  const bossNodeId = "test-boss" as NodeId;

  return {
    seed,
    phase: "partyIntro",
    party: [
      {
        id: "test-member-1" as MemberId,
        name: "첫 번째",
        classId: "test-class-1" as ClassId,
        personality: "righteous",
        trust: 70,
        alive: true,
      },
      {
        id: "test-member-2" as MemberId,
        name: "두 번째",
        classId: "test-class-2" as ClassId,
        personality: "suspicious",
        trust: 50,
        alive: true,
      },
      {
        id: "test-member-3" as MemberId,
        name: "세 번째",
        classId: "test-class-3" as ClassId,
        personality: "prudent",
        trust: 30,
        alive: true,
      },
    ],
    dungeon: {
      nodes: [
        {
          id: entryNodeId,
          depth: 0,
          eventId: "test-entry-event" as EventId,
          nextNodeIds: [bossNodeId],
        },
        {
          id: bossNodeId,
          depth: 1,
          eventId: "test-boss-event" as EventId,
          nextNodeIds: [],
        },
      ],
      entryNodeId,
      bossNodeId,
    },
    currentNodeId: entryNodeId,
    resources: {
      gold: 10,
      food: 5,
      reputation: 1,
    },
    pendingClaims: [],
    log: [],
  };
}

describe("런 상태 스토어", () => {
  it("전달한 초기 런을 정확히 보관한다", () => {
    const initialRun = createTestRun("initial-seed");
    const store = createRunStore(initialRun);

    expect(store.getState().run).toBe(initialRun);
  });

  it("런 전체를 교체하고 이전 객체를 변경하지 않는다", () => {
    const initialRun = createTestRun("initial-seed");
    const nextRun = {
      ...initialRun,
      seed: "next-seed",
      resources: {
        ...initialRun.resources,
        gold: 99,
      },
    };
    const store = createRunStore(initialRun);

    store.getState().replaceRun(nextRun);

    expect(store.getState().run).toBe(nextRun);
    expect(initialRun.seed).toBe("initial-seed");
    expect(initialRun.resources.gold).toBe(10);
  });

  it("고정 시드를 새 런 factory에 전달하고 결과를 저장한다", () => {
    const store = createRunStore(createTestRun("initial-seed"));
    let receivedSeed = "";

    store.getState().startNewRun((seed) => {
      receivedSeed = seed;
      return createTestRun(seed);
    }, "fixed-seed");

    expect(receivedSeed).toBe("fixed-seed");
    expect(store.getState().run.seed).toBe("fixed-seed");
  });

  it("시드를 생략하면 생성한 시드를 factory와 상태에 함께 쓴다", () => {
    const store = createRunStore(createTestRun("initial-seed"));
    let receivedSeed = "";

    store.getState().startNewRun((seed) => {
      receivedSeed = seed;
      return createTestRun(seed);
    });

    expect(receivedSeed).not.toBe("");
    expect(store.getState().run.seed).toBe(receivedSeed);
  });

  it("factory의 시드가 다르면 오류를 던지고 기존 런을 유지한다", () => {
    const initialRun = createTestRun("initial-seed");
    const store = createRunStore(initialRun);

    expect(() =>
      store
        .getState()
        .startNewRun(() => createTestRun("wrong-seed"), "expected-seed"),
    ).toThrow("새 런 시드가 일치하지 않습니다");

    expect(store.getState().run).toBe(initialRun);
  });

  it("생성 시점의 초기 런으로 되돌린다", () => {
    const initialRun = createTestRun("initial-seed");
    const store = createRunStore(initialRun);

    store.getState().replaceRun(createTestRun("changed-seed"));
    store.getState().resetRun();

    expect(store.getState().run).toBe(initialRun);
  });
});
