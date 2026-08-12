import { describe, expect, it } from "vitest";
import type { MemberId, NodeId, RunState } from "@/lib/domain";
import { createRunStore } from "@/lib/stores/run-store";
import { createUiStore } from "@/lib/stores/ui-store";

const memberId = "ui-member" as MemberId;

describe("화면 상태 스토어", () => {
  it("선택된 파티원 없이 시작한다", () => {
    const store = createUiStore();

    expect(store.getState().selectedMemberId).toBeNull();
  });

  it("파티원을 선택한다", () => {
    const store = createUiStore();

    store.getState().selectMember(memberId);

    expect(store.getState().selectedMemberId).toBe(memberId);
  });

  it("선택을 해제한다", () => {
    const store = createUiStore();

    store.getState().selectMember(memberId);
    store.getState().clearSelectedMember();

    expect(store.getState().selectedMemberId).toBeNull();
  });

  it("UI 상태를 초기화한다", () => {
    const store = createUiStore();

    store.getState().selectMember(memberId);
    store.getState().resetUi();

    expect(store.getState().selectedMemberId).toBeNull();
  });

  it("UI 변경이 Run Store를 바꾸지 않는다", () => {
    const entryNodeId = "ui-entry" as NodeId;
    const initialRun: RunState = {
      seed: "ui-independent",
      phase: "partyIntro",
      party: [],
      dungeon: {
        nodes: [],
        entryNodeId,
        bossNodeId: "ui-boss" as NodeId,
      },
      currentNodeId: entryNodeId,
      resources: {
        gold: 0,
        food: 0,
        reputation: 0,
      },
      pendingClaims: [],
      log: [],
    };
    const runStore = createRunStore(initialRun);
    const uiStore = createUiStore();

    uiStore.getState().selectMember(memberId);

    expect(runStore.getState().run).toBe(initialRun);
  });
});
