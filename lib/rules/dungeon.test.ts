import { describe, expect, it } from "vitest";
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
import type { DungeonEventPools } from "@/lib/content/events";
import { EVENT_KINDS } from "@/lib/domain";
import type { DungeonEvent, DungeonNode, MemberId, NodeId } from "@/lib/domain";
import { createRng } from "@/lib/rng";
import { DUNGEON_SHAPES, generateDungeon } from "@/lib/rules/dungeon";

function dungeonOf(seed: string) {
  return generateDungeon(createRng(seed).derive("dungeon"));
}

function clonedPools(): DungeonEventPools {
  return structuredClone(DUNGEON_EVENT_POOLS);
}

function withPools(pools: DungeonEventPools) {
  return () => generateDungeon(createRng("invalid").derive("dungeon"), { eventPools: pools });
}

function replaceEvent(
  pools: DungeonEventPools,
  kind: keyof DungeonEventPools["regular"],
  index: number,
  event: DungeonEvent,
): DungeonEventPools {
  return {
    ...pools,
    regular: {
      ...pools.regular,
      [kind]: pools.regular[kind].map((item, itemIndex) =>
        itemIndex === index ? event : item),
    },
  };
}

function pathsToBoss(nodes: readonly DungeonNode[], entry: NodeId, boss: NodeId) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const paths: NodeId[][] = [];
  const visit = (id: NodeId, path: NodeId[]) => {
    if (id === boss) {
      paths.push([...path, id]);
      return;
    }
    const node = byId.get(id);
    if (node === undefined) throw new Error(`없는 노드: ${id}`);
    for (const next of node.nextNodeIds) visit(next, [...path, id]);
  };
  visit(entry, []);
  return paths;
}

describe("던전 이벤트 기본 콘텐츠", () => {
  it("일반 네 분류에 이벤트가 두 개 이상 있다", () => {
    for (const kind of EVENT_KINDS) {
      expect(DUNGEON_EVENT_POOLS.regular[kind].length).toBeGreaterThanOrEqual(2);
      expect(
        DUNGEON_EVENT_POOLS.regular[kind].every((event) => event.kind === kind),
      ).toBe(true);
    }
  });

  it("보스 풀은 special 이벤트를 하나 이상 가진다", () => {
    expect(DUNGEON_EVENT_POOLS.boss.length).toBeGreaterThan(0);
    expect(DUNGEON_EVENT_POOLS.boss.every((event) => event.kind === "special")).toBe(true);
  });

  it("모든 이벤트와 선택지 식별자가 고유하고 선택지가 완전하다", () => {
    const events = [
      ...EVENT_KINDS.flatMap((kind) => DUNGEON_EVENT_POOLS.regular[kind]),
      ...DUNGEON_EVENT_POOLS.boss,
    ];
    expect(new Set(events.map((event) => event.id)).size).toBe(events.length);
    const choices = events.flatMap((event) => event.choices);
    expect(new Set(choices.map((choice) => choice.id)).size).toBe(choices.length);
    for (const event of events) expect(event.choices.length).toBeGreaterThan(0);
    for (const choice of choices) {
      expect(choice.expectedGain.trim()).not.toBe("");
      expect(choice.knownRisk.trim()).not.toBe("");
      expect(choice.target?.kind).not.toBe("member");
    }
  });
});

describe("던전 이벤트 풀 검증", () => {
  it("일반 분류별 이벤트가 두 개보다 적으면 거부한다", () => {
    const pools = clonedPools();
    const invalid = {
      ...pools,
      regular: { ...pools.regular, monster: pools.regular.monster.slice(0, 1) },
    };
    expect(withPools(invalid)).toThrow(/monster.*최소 2/);
  });

  it("빈 보스 풀을 거부한다", () => {
    expect(withPools({ ...clonedPools(), boss: [] })).toThrow(/보스.*비어/);
  });

  it("풀과 kind가 다른 이벤트를 거부한다", () => {
    const pools = clonedPools();
    const event = { ...pools.regular.monster[0], kind: "rest" as const };
    expect(withPools(replaceEvent(pools, "monster", 0, event))).toThrow(/분류.*monster/);
  });

  it("special이 아닌 보스 이벤트를 거부한다", () => {
    const pools = clonedPools();
    expect(withPools({ ...pools, boss: [{ ...pools.boss[0], kind: "monster" }] }))
      .toThrow(/보스.*special/);
  });

  it("중복 이벤트 ID와 선택지 ID를 거부한다", () => {
    const pools = clonedPools();
    const duplicateEvent = { ...pools.regular.rest[0], id: pools.regular.monster[0].id };
    expect(withPools(replaceEvent(pools, "rest", 0, duplicateEvent))).toThrow(/이벤트 ID.*중복/);
    const duplicateChoice = {
      ...pools.regular.rest[0],
      choices: [{
        ...pools.regular.rest[0].choices[0],
        id: pools.regular.monster[0].choices[0].id,
      }],
    };
    expect(withPools(replaceEvent(pools, "rest", 0, duplicateChoice))).toThrow(/선택지 ID.*중복/);
  });

  it("빈 선택지와 빈 이득·위험을 거부한다", () => {
    const pools = clonedPools();
    expect(withPools(replaceEvent(pools, "rest", 0, { ...pools.regular.rest[0], choices: [] })))
      .toThrow(/선택지.*없/);
    const base = pools.regular.rest[0];
    expect(withPools(replaceEvent(pools, "rest", 0, {
      ...base,
      choices: [{ ...base.choices[0], expectedGain: " " }],
    }))).toThrow(/예상 이득.*비어/);
    expect(withPools(replaceEvent(pools, "rest", 0, {
      ...base,
      choices: [{ ...base.choices[0], knownRisk: " " }],
    }))).toThrow(/알려진 위험.*비어/);
  });

  it("파티원 대상 선택지를 거부한다", () => {
    const pools = clonedPools();
    const base = pools.regular.rest[0];
    const invalid = {
      ...base,
      choices: [{
        ...base.choices[0],
        target: { kind: "member" as const, id: "member-test" as MemberId },
      }],
    };
    expect(withPools(replaceEvent(pools, "rest", 0, invalid))).toThrow(/파티원 대상/);
  });
});

describe("던전 경로 생성", () => {
  it("같은 시드는 같은 경로와 이벤트를 만든다", () => {
    expect(dungeonOf("same-seed")).toEqual(dungeonOf("same-seed"));
  });

  it("여러 시드에서 허용된 형태와 노드 수만 만든다", () => {
    const allowed = new Set(DUNGEON_SHAPES.map(({ branches, pathDepth }) =>
      `${branches}/${pathDepth}`));
    const seen = new Set<string>();
    for (let index = 0; index < 100; index += 1) {
      const { dungeon } = dungeonOf(`shape-${index}`);
      expect(dungeon.nodes.length).toBeGreaterThanOrEqual(7);
      expect(dungeon.nodes.length).toBeLessThanOrEqual(10);
      const entry = dungeon.nodes.find((node) => node.id === dungeon.entryNodeId)!;
      const merge = dungeon.nodes.find((node) => node.id === "node-merge")!;
      const shape = `${entry.nextNodeIds.length}/${merge.depth - 1}`;
      expect(allowed.has(shape)).toBe(true);
      seen.add(shape);
    }
    expect(seen).toEqual(allowed);
  });

  it("모든 노드가 앞으로 진행해 같은 길이로 보스에 도달한다", () => {
    for (let index = 0; index < 30; index += 1) {
      const { dungeon } = dungeonOf(`graph-${index}`);
      const byId = new Map(dungeon.nodes.map((node) => [node.id, node]));
      const reachable = new Set<NodeId>();
      const stack = [dungeon.entryNodeId];
      while (stack.length > 0) {
        const id = stack.pop()!;
        if (reachable.has(id)) continue;
        reachable.add(id);
        stack.push(...(byId.get(id)?.nextNodeIds ?? []));
      }
      expect(reachable.size).toBe(dungeon.nodes.length);
      expect(dungeon.nodes.filter((node) => node.nextNodeIds.length === 0)
        .map((node) => node.id)).toEqual([dungeon.bossNodeId]);
      for (const node of dungeon.nodes) for (const next of node.nextNodeIds) {
        expect(byId.get(next)!.depth).toBeGreaterThan(node.depth);
      }
      const paths = pathsToBoss(
        dungeon.nodes,
        dungeon.entryNodeId,
        dungeon.bossNodeId,
      );
      expect(new Set(paths.map((path) => path.length)).size).toBe(1);
      const merge = byId.get("node-merge" as NodeId)!;
      const inDegree = dungeon.nodes.flatMap((node) => node.nextNodeIds)
        .filter((id) => id === merge.id).length;
      expect(inDegree).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("던전 이벤트 배치", () => {
  it("일반 경로에 네 분류를 보장하고 보스 전용 이벤트를 배치한다", () => {
    for (let index = 0; index < 50; index += 1) {
      const { dungeon, events } = dungeonOf(`events-${index}`);
      expect(events).toHaveLength(dungeon.nodes.length);
      dungeon.nodes.forEach((node, nodeIndex) => {
        expect(events[nodeIndex].id).toBe(node.eventId);
      });
      const bossIndex = dungeon.nodes.findIndex((node) => node.id === dungeon.bossNodeId);
      expect(DUNGEON_EVENT_POOLS.boss.map((event) => event.id))
        .toContain(events[bossIndex].id);
      expect(events[bossIndex].kind).toBe("special");
      const regular = events.filter((_, eventIndex) => eventIndex !== bossIndex);
      expect(new Set(regular.map((event) => event.kind)))
        .toEqual(new Set(EVENT_KINDS));
      expect(new Set(events.map((event) => event.id)).size).toBe(events.length);
    }
  });

  it("입력 콘텐츠를 변경하지 않는다", () => {
    const before = structuredClone(DUNGEON_EVENT_POOLS);
    dungeonOf("immutable-pools");
    expect(DUNGEON_EVENT_POOLS).toEqual(before);
  });
});
