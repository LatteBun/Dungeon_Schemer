import { describe, expect, it } from "vitest";
import {
  EVENT_KINDS,
  PARTY_SIZE_MAX,
  PARTY_SIZE_MIN,
  TRUST_MAX,
  TRUST_MIN,
} from "@/lib/domain";
import {
  MOCK_CARDS,
  MOCK_CLASSES,
  MOCK_DUNGEON,
  MOCK_EVENTS,
  MOCK_PARTY,
  MOCK_SETTLEMENT,
} from "@/lib/mock";

const nodeById = new Map<string, (typeof MOCK_DUNGEON.nodes)[number]>(
  MOCK_DUNGEON.nodes.map((node) => [node.id, node]),
);

/** 입구에서 너비 우선으로 닿을 수 있는 노드 집합이다. */
function reachableFromEntry(): Set<string> {
  const seen = new Set<string>([MOCK_DUNGEON.entryNodeId]);
  const queue: string[] = [MOCK_DUNGEON.entryNodeId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const next of nodeById.get(current)?.nextNodeIds ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

describe("파티 목", () => {
  it("파티 인원이 정해진 범위 안이다", () => {
    expect(MOCK_PARTY.length).toBeGreaterThanOrEqual(PARTY_SIZE_MIN);
    expect(MOCK_PARTY.length).toBeLessThanOrEqual(PARTY_SIZE_MAX);
  });
  it("모든 신뢰가 정해진 범위 안이다", () => {
    const outOfRange = MOCK_PARTY.filter(
      (member) => member.trust < TRUST_MIN || member.trust > TRUST_MAX,
    ).map((member) => `${member.name}: ${member.trust}`);
    expect(outOfRange, "범위를 벗어난 신뢰").toEqual([]);
  });
  it("성격이 서로 다른 파티원이 둘 이상 있다", () => {
    expect(new Set(MOCK_PARTY.map((member) => member.personality)).size).toBeGreaterThan(1);
  });
  it("모든 classId가 직업 목록에 있다", () => {
    const known = new Set(MOCK_CLASSES.map((klass) => klass.id));
    const missing = MOCK_PARTY.filter((member) => !known.has(member.classId)).map(
      (member) => `${member.name}: ${member.classId}`,
    );
    expect(missing, "직업 목록에 없는 classId").toEqual([]);
  });
  it("파티원 id가 중복되지 않는다", () => {
    expect(new Set(MOCK_PARTY.map((member) => member.id)).size).toBe(MOCK_PARTY.length);
  });
});

describe("이벤트 목", () => {
  it("모든 이벤트가 선택지를 하나 이상 가진다", () => {
    const empty = MOCK_EVENTS.filter((event) => event.choices.length === 0).map((event) => event.id);
    expect(empty, "선택지가 없는 이벤트").toEqual([]);
  });
  it("모든 선택지에 예상 이득과 알려진 위험이 있다", () => {
    const incomplete: string[] = [];
    for (const event of MOCK_EVENTS) {
      for (const choice of event.choices) {
        if (choice.expectedGain === "" || choice.knownRisk === "") incomplete.push(`${event.id} / ${choice.id}`);
      }
    }
    expect(incomplete, "이득이나 위험이 빈 선택지").toEqual([]);
  });
  it("네 가지 이벤트 분류가 모두 등장한다", () => {
    const used = new Set(MOCK_EVENTS.map((event) => event.kind));
    expect(EVENT_KINDS.filter((kind) => !used.has(kind)), "목에 등장하지 않는 이벤트 분류").toEqual([]);
  });
  it("이벤트 id와 선택지 id가 중복되지 않는다", () => {
    expect(new Set(MOCK_EVENTS.map((event) => event.id)).size).toBe(MOCK_EVENTS.length);
    const choiceIds = MOCK_EVENTS.flatMap((event) => event.choices.map((choice) => choice.id));
    expect(new Set(choiceIds).size).toBe(choiceIds.length);
  });
  it("선택지의 대상 파티원이 파티에 있다", () => {
    const known = new Set(MOCK_PARTY.map((member) => member.id));
    const unknown: string[] = [];
    for (const event of MOCK_EVENTS) {
      for (const choice of event.choices) {
        if (choice.target?.kind === "member" && !known.has(choice.target.id)) unknown.push(`${choice.id} → ${choice.target.id}`);
      }
    }
    expect(unknown, "파티에 없는 대상").toEqual([]);
  });
});

describe("던전 지도 목", () => {
  it("입구와 보스방이 노드 목록에 있다", () => {
    expect(nodeById.has(MOCK_DUNGEON.entryNodeId), "입구").toBe(true);
    expect(nodeById.has(MOCK_DUNGEON.bossNodeId), "보스방").toBe(true);
  });
  it("모든 eventId가 이벤트 목록에 있다", () => {
    const known = new Set(MOCK_EVENTS.map((event) => event.id));
    const missing = MOCK_DUNGEON.nodes.filter((node) => !known.has(node.eventId)).map((node) => `${node.id}: ${node.eventId}`);
    expect(missing, "이벤트 목록에 없는 eventId").toEqual([]);
  });
  it("모든 간선이 존재하는 노드를 가리킨다", () => {
    const dangling: string[] = [];
    for (const node of MOCK_DUNGEON.nodes) for (const next of node.nextNodeIds) if (!nodeById.has(next)) dangling.push(`${node.id} → ${next}`);
    expect(dangling, "없는 노드를 가리키는 간선").toEqual([]);
  });
  it("입구에서 보스방까지 갈 수 있다", () => {
    expect(reachableFromEntry().has(MOCK_DUNGEON.bossNodeId)).toBe(true);
  });
  it("입구에서 닿지 않는 노드가 없다", () => {
    const reachable = reachableFromEntry();
    expect(MOCK_DUNGEON.nodes.filter((node) => !reachable.has(node.id)).map((node) => node.id), "입구에서 닿지 않는 노드").toEqual([]);
  });
  it("모든 간선이 depth를 늘린다", () => {
    const backwards: string[] = [];
    for (const node of MOCK_DUNGEON.nodes) {
      for (const next of node.nextNodeIds) {
        const target = nodeById.get(next);
        if (target !== undefined && target.depth <= node.depth) backwards.push(`${node.id}(${node.depth}) → ${next}(${target.depth})`);
      }
    }
    expect(backwards, "depth를 늘리지 않는 간선").toEqual([]);
  });
  it("막다른 길은 보스방 하나뿐이다", () => {
    expect(MOCK_DUNGEON.nodes.filter((node) => node.nextNodeIds.length === 0).map((node) => node.id)).toEqual([MOCK_DUNGEON.bossNodeId]);
  });
  it("갈라지는 노드와 합쳐지는 노드가 모두 있다", () => {
    const branching = MOCK_DUNGEON.nodes.filter((node) => node.nextNodeIds.length > 1);
    const inDegree = new Map<string, number>();
    for (const node of MOCK_DUNGEON.nodes) for (const next of node.nextNodeIds) inDegree.set(next, (inDegree.get(next) ?? 0) + 1);
    const mergingBeforeBoss = MOCK_DUNGEON.nodes.filter(
      (node) =>
        node.id !== MOCK_DUNGEON.bossNodeId &&
        (inDegree.get(node.id) ?? 0) > 1,
    );
    expect(branching.length, "갈라지는 노드 수").toBeGreaterThan(0);
    expect(
      mergingBeforeBoss.length,
      "보스방 이전에 합쳐지는 노드 수",
    ).toBeGreaterThan(0);
  });
});

describe("정보 카드 목", () => {
  it("카드가 진실·거짓·중립을 모두 담는다", () => {
    expect([...new Set(MOCK_CARDS.map((card) => card.truthType))].sort()).toEqual(["lie", "neutral", "truth"]);
  });
});

describe("정산 목", () => {
  it("생존자와 사망자가 겹치지 않는다", () => {
    const survivors = new Set(MOCK_SETTLEMENT.survivors.map((entry) => entry.memberId));
    expect(MOCK_SETTLEMENT.casualties.filter((entry) => survivors.has(entry.memberId)).map((entry) => entry.name), "생존자와 사망자에 함께 있는 사람").toEqual([]);
  });
  it("생존자와 사망자를 합치면 파티 전원이다", () => {
    const listed = [...MOCK_SETTLEMENT.survivors, ...MOCK_SETTLEMENT.casualties].map((entry) => entry.memberId);
    expect(listed.sort()).toEqual(MOCK_PARTY.map((member) => member.id).sort());
  });
  it("정산에 나오는 모든 memberId가 파티에 있다", () => {
    const known = new Set(MOCK_PARTY.map((member) => member.id));
    const unknown = [...MOCK_SETTLEMENT.survivors, ...MOCK_SETTLEMENT.casualties, ...MOCK_SETTLEMENT.trustChanges].filter((entry) => !known.has(entry.memberId)).map((entry) => `${entry.name}: ${entry.memberId}`);
    expect(unknown, "파티에 없는 memberId").toEqual([]);
  });
  it("모든 신뢰 변화에 사유가 있다", () => {
    expect(MOCK_SETTLEMENT.trustChanges.filter((change) => change.reason === "").map((change) => change.name), "사유 없는 신뢰 변화").toEqual([]);
  });
  it("영향을 준 선택이 하나 이상 있다", () => expect(MOCK_SETTLEMENT.influentialDecisions.length).toBeGreaterThan(0));
});
