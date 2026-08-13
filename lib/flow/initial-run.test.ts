import { describe, expect, it } from "vitest";
import {
  createInitialRun,
  INITIAL_RESOURCES,
} from "@/lib/flow/initial-run";
import { PARTY_SIZE_MAX, PARTY_SIZE_MIN } from "@/lib/domain";

describe("초기 런 생성", () => {
  it("같은 시드는 같은 시작 상태를 재현한다", () => {
    expect(createInitialRun("seed-a")).toEqual(createInitialRun("seed-a"));
  });

  it("다른 시드는 다른 시작 상태를 만든다", () => {
    expect(createInitialRun("seed-a")).not.toEqual(createInitialRun("seed-b"));
  });

  it("파티 소개 단계, 입구 위치, 빈 기록으로 시작한다", () => {
    const { run } = createInitialRun("start-check");
    expect(run.seed).toBe("start-check");
    expect(run.phase).toBe("partyIntro");
    expect(run.currentNodeId).toBe(run.dungeon.entryNodeId);
    expect(run.party.length).toBeGreaterThanOrEqual(PARTY_SIZE_MIN);
    expect(run.party.length).toBeLessThanOrEqual(PARTY_SIZE_MAX);
    expect(run.pendingClaims).toEqual([]);
    expect(run.log).toEqual([]);
  });

  it("자원은 잠정 기본값으로 시작하고 옵션으로 대체할 수 있다", () => {
    const { run } = createInitialRun("resource-default");
    expect(run.resources).toEqual(INITIAL_RESOURCES);
    // 런 상태를 고쳐도 공용 상수가 오염되면 안 되므로 사본이어야 한다.
    expect(run.resources).not.toBe(INITIAL_RESOURCES);

    const custom = { gold: 1, food: 2, reputation: 3 };
    const { run: customRun } = createInitialRun("resource-custom", {
      resources: custom,
    });
    expect(customRun.resources).toEqual(custom);
    expect(customRun.resources).not.toBe(custom);
  });

  it("모든 노드의 이벤트가 반환된 이벤트 목록에 있다", () => {
    const { run, events } = createInitialRun("event-link");
    const eventIds = new Set(events.map((event) => event.id));
    for (const node of run.dungeon.nodes) {
      expect(eventIds.has(node.eventId)).toBe(true);
    }
  });
});
