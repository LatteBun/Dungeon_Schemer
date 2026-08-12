# R4 이벤트·경로 생성 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시드로 7~9개 노드의 동일 길이 분기 경로와 중복 없는 이벤트 배치를 생성한다.

**Architecture:** `lib/content/events.ts`는 네 일반 분류별 이벤트 풀과 보스 조우 풀을 소유한다. `lib/rules/dungeon.ts`는 입력 풀 전체를 난수 소비 전에 검증하고, 허용된 세 경로 형태 중 하나를 생성한 뒤 분류와 이벤트를 배치해 `DungeonState`와 사용 이벤트를 함께 반환한다. 선택 결과, 상태 전이, 보스전은 다루지 않는다.

**Tech Stack:** TypeScript 5.9.3 strict, Vitest 4.1.10, 기존 `@/lib/domain`과 `@/lib/rng`, pnpm 11.21.0, Node.js 24.19.0

## Global Constraints

- 근거 spec은 `docs/superpowers/specs/2026-08-12-event-route-generation-lattebun-design.md`다.
- 공식 규칙은 `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`의 「프로토타입 경로 생성」과 「프로토타입 이벤트 배치」를 따른다.
- 허용 형태는 `(갈래 2, 깊이 2)`, `(갈래 3, 깊이 2)`, `(갈래 2, 깊이 3)`뿐이다. 총 노드는 각각 7, 9, 9개다.
- 입구→갈래→공통 합류→보스 구조이며 모든 경로 길이는 같고 보스방만 막다른 길이다.
- 일반 노드에는 네 `EventKind`가 최소 한 번씩 등장한다. 분류별 기본 풀은 최소 2개이며 한 던전에서 이벤트를 중복하지 않는다.
- 보스방에는 `kind: "special"`인 보스 전용 이벤트를 배치한다.
- 정적 선택지의 `target`은 없거나 `{ kind: "boss" }`다. 파티원 대상은 오류다.
- 모든 풀 검증은 난수 소비 전에 끝낸다. 잘못된 콘텐츠를 자동 보정하거나 재시도하지 않는다.
- 호출자가 `createRng(seed).derive("dungeon")`을 전달한다. `Math.random`과 함수 내부 시드 생성을 금지한다.
- 입력 배열과 이벤트 객체를 변경하지 않는다. 반환 `events[index]`는 `nodes[index]`의 `eventId`와 대응한다.
- 테스트는 Vitest API 명시 import, `@/` 별칭, 한국어 설명, 고정 시드를 사용한다.
- 커밋 메시지는 제목과 본문을 모두 한글로 작성한다.
- `dungeon-schemer-handoff.md`는 개인 미추적 파일이므로 수정하거나 stage하지 않는다.

## File Map

| 파일 | 책임 |
| --- | --- |
| `lib/content/events.ts` | 이벤트 풀 타입, 일반 이벤트 8개, 보스 조우 이벤트 |
| `lib/rules/dungeon.ts` | 풀 검증, 경로 골격 생성, 분류·콘텐츠 배치, 공개 생성 API |
| `lib/rules/dungeon.test.ts` | 기본 콘텐츠 계약, 재현성, 그래프 불변 조건, 배치, 오류·불변성 |
| `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md` | R4 완료와 후속 작업의 최신 남은 선행 갱신 |

---

### Task 1: 기본 이벤트 콘텐츠 풀

**Files:**
- Create: `lib/content/events.ts`
- Create: `lib/rules/dungeon.test.ts`

**Interfaces:**
- Consumes: `DungeonEvent`, `EventKind`, `EventId`, `ChoiceId` from `@/lib/domain`
- Produces: `DungeonEventPools`, `DUNGEON_EVENT_POOLS`

- [ ] **Step 1: 기본 콘텐츠 계약의 실패 테스트를 작성한다**

`lib/rules/dungeon.test.ts`를 만든다.

```ts
import { describe, expect, it } from "vitest";
import { EVENT_KINDS } from "@/lib/domain";
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";

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
```

- [ ] **Step 2: 모듈 부재로 실패하는지 확인한다**

Run: `pnpm test -- lib/rules/dungeon.test.ts`

Expected: FAIL with `@/lib/content/events` not found.

- [ ] **Step 3: 이벤트 풀 타입과 콘텐츠를 구현한다**

`lib/content/events.ts`를 만든다. 보일러플레이트 ID 캐스트는 두 helper로 모은다.

```ts
import type {
  ChoiceId,
  DungeonEvent,
  EventId,
  EventKind,
  EventChoice,
} from "@/lib/domain";

export interface DungeonEventPools {
  readonly regular: Readonly<Record<EventKind, readonly DungeonEvent[]>>;
  readonly boss: readonly DungeonEvent[];
}

function choice(
  id: string,
  label: string,
  expectedGain: string,
  knownRisk: string,
  target?: EventChoice["target"],
): EventChoice {
  return { id: id as ChoiceId, label, expectedGain, knownRisk, target };
}

function event(
  id: string,
  kind: EventKind,
  title: string,
  description: string,
  choices: EventChoice[],
): DungeonEvent {
  return { id: id as EventId, kind, title, description, choices };
}
```

아래 9개 이벤트를 `DUNGEON_EVENT_POOLS`에 넣는다. 각 행의 선택지는 정확한 ID와
문구로 생성하고, `target`은 표에 `boss`라고 쓴 경우에만 `{ kind: "boss" }`다.

| 풀 | 이벤트 ID / 제목 | 선택지 ID / 라벨 | 예상 이득 | 알려진 위험 | 대상 |
| --- | --- | --- | --- | --- | --- |
| monster | `event-goblin-ambush` / 고블린 매복 | `choice-guide-flank` / 우회로를 알려준다 | 파티의 피해를 줄이고 신뢰를 얻는다 | 고블린이 도주해 보스에게 경고할 수 있다 | — |
| monster | `event-spider-nest` / 거미 둥지 | `choice-cut-web` / 안전한 통로를 만든다 | 식량 손실 없이 둥지를 통과한다 | 길잡이가 먼저 독에 노출될 수 있다 | — |
| rest | `event-dying-campfire` / 꺼져 가는 모닥불 | `choice-share-rations` / 식량을 나눈다 | 파티가 회복하고 관계를 확인한다 | 남은 식량이 줄어든다 | — |
| rest | `event-abandoned-camp` / 버려진 야영지 | `choice-search-camp` / 야영지를 조사한다 | 정보와 쓸 만한 물자를 찾을 수 있다 | 함정이나 감시 흔적을 건드릴 수 있다 | — |
| merchant | `event-shadow-merchant` / 그림자 행상인 | `choice-buy-rumor` / 보스의 소문을 산다 | 보스와 경로에 관한 정보를 얻는다 | 거짓 정보에 자원을 낭비할 수 있다 | — |
| merchant | `event-map-peddler` / 지도 장수 | `choice-trade-map` / 낡은 지도를 거래한다 | 다음 경로의 위험을 비교할 단서를 얻는다 | 거래 사실이 양쪽에 알려질 수 있다 | — |
| special | `event-sealed-contract` / 봉인된 계약서 | `choice-read-contract` / 계약 조건을 읽는다 | 던전 세력의 의도를 파악한다 | 계약을 읽은 사실이 보스에게 전달된다 | boss |
| special | `event-whispering-door` / 속삭이는 문 | `choice-answer-door` / 문의 질문에 답한다 | 숨겨진 길과 거래 기회를 발견한다 | 대답이 파티의 비밀을 드러낼 수 있다 | — |
| boss | `event-boss-audience` / 보스의 알현실 | `choice-enter-audience` / 보스 앞에 나아간다 | 탐험 중 모은 정보로 최종 협상을 시작한다 | 선택과 관계가 보스전 결과로 돌아온다 | boss |

표의 각 행을 `event(...)`와 `choice(...)` 호출로 완성해 `regular`의 해당 분류
배열과 `boss` 배열에 넣는다. 표에 없는 이벤트나 선택지를 추가하지 않는다.

- [ ] **Step 4: 콘텐츠 테스트와 정적 검사를 실행한다**

Run:

```bash
pnpm test -- lib/rules/dungeon.test.ts
pnpm typecheck
```

Expected: 3 tests PASS; typecheck exit 0.

- [ ] **Step 5: Task 1을 커밋한다**

```bash
git add lib/content/events.ts lib/rules/dungeon.test.ts
git commit -m "콘텐츠: 던전 이벤트 기본 풀 추가" -m "네 일반 분류와 보스 조우에 필요한 최소 이벤트를 데이터로 분리한다.
경로 생성 규칙을 고치지 않고 사건과 선택지를 확장할 수 있게 하기 위함이다."
```

---

### Task 2: 동일 길이 분기 그래프와 이벤트 배치

**Files:**
- Create: `lib/rules/dungeon.ts`
- Modify: `lib/rules/dungeon.test.ts`

**Interfaces:**
- Consumes: `DungeonEventPools`, `DUNGEON_EVENT_POOLS`, `DungeonState`, `DungeonNode`, `Rng`
- Produces: `DUNGEON_SHAPES`, `GenerateDungeonOptions`, `GeneratedDungeon`, `generateDungeon(rng, options?)`

- [ ] **Step 1: 생성과 그래프 불변 조건의 실패 테스트를 추가한다**

테스트 파일 import에 다음을 추가한다.

```ts
import type { DungeonNode, NodeId } from "@/lib/domain";
import { createRng } from "@/lib/rng";
import { DUNGEON_SHAPES, generateDungeon } from "@/lib/rules/dungeon";

function dungeonOf(seed: string) {
  return generateDungeon(createRng(seed).derive("dungeon"));
}

function pathsToBoss(nodes: readonly DungeonNode[], entry: NodeId, boss: NodeId) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const paths: NodeId[][] = [];
  const visit = (id: NodeId, path: NodeId[]) => {
    if (id === boss) { paths.push([...path, id]); return; }
    const node = byId.get(id);
    if (node === undefined) throw new Error(`없는 노드: ${id}`);
    for (const next of node.nextNodeIds) visit(next, [...path, id]);
  };
  visit(entry, []);
  return paths;
}
```

다음 테스트를 추가한다.

```ts
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
```

- [ ] **Step 2: 새 규칙 모듈 부재로 실패하는지 확인한다**

Run: `pnpm test -- lib/rules/dungeon.test.ts`

Expected: FAIL with `@/lib/rules/dungeon` not found.

- [ ] **Step 3: 경로 골격과 이벤트 배치를 구현한다**

`lib/rules/dungeon.ts`를 다음 구조로 만든다.

```ts
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
import type { DungeonEventPools } from "@/lib/content/events";
import { EVENT_KINDS } from "@/lib/domain";
import type {
  DungeonEvent,
  DungeonNode,
  DungeonState,
  EventId,
  EventKind,
  NodeId,
} from "@/lib/domain";
import type { Rng } from "@/lib/rng";

export const DUNGEON_SHAPES = [
  { branches: 2, pathDepth: 2 },
  { branches: 3, pathDepth: 2 },
  { branches: 2, pathDepth: 3 },
] as const;

export interface GenerateDungeonOptions {
  readonly eventPools?: DungeonEventPools;
}

export interface GeneratedDungeon {
  readonly dungeon: DungeonState;
  readonly events: DungeonEvent[];
}

interface NodeDraft {
  readonly id: NodeId;
  readonly depth: number;
  readonly nextNodeIds: NodeId[];
}

const nodeId = (value: string) => value as NodeId;
```

`buildNodeDrafts`는 노드 순서를 `entry`, path 1의 depth 순서, path 2, 선택적
path 3, `merge`, `boss`로 고정한다. 각 갈래 마지막은 `node-merge`, merge는
`node-boss`, boss는 빈 배열을 가리킨다.

```ts
function buildNodeDrafts(branches: number, pathDepth: number): NodeDraft[] {
  const mergeId = nodeId("node-merge");
  const bossId = nodeId("node-boss");
  const firstIds = Array.from({ length: branches }, (_, branch) =>
    nodeId(`node-path-${branch + 1}-depth-1`));
  const drafts: NodeDraft[] = [
    { id: nodeId("node-entry"), depth: 0, nextNodeIds: firstIds },
  ];
  for (let branch = 1; branch <= branches; branch += 1) {
    for (let depth = 1; depth <= pathDepth; depth += 1) {
      const next = depth === pathDepth
        ? mergeId
        : nodeId(`node-path-${branch}-depth-${depth + 1}`);
      drafts.push({
        id: nodeId(`node-path-${branch}-depth-${depth}`),
        depth,
        nextNodeIds: [next],
      });
    }
  }
  drafts.push(
    { id: mergeId, depth: pathDepth + 1, nextNodeIds: [bossId] },
    { id: bossId, depth: pathDepth + 2, nextNodeIds: [] },
  );
  return drafts;
}
```

분류는 네 종류를 한 번씩 넣고, 6개 일반 노드는 셔플한 네 종류 중 앞의 두 개를,
8개 일반 노드는 네 종류 전부를 한 번 더 넣은 뒤 전체를 셔플한다. 분류별 이벤트
큐는 `rng.shuffle(pool)`로 만들고 `shift` 대신 인덱스 카운터로 소비해 입력을 바꾸지
않는다. 보스는 `rng.pick(pools.boss)`로 고른다.

```ts
function regularKinds(count: number, rng: Rng): EventKind[] {
  const extras = count === 6 ? rng.shuffle(EVENT_KINDS).slice(0, 2) : EVENT_KINDS;
  return rng.shuffle([...EVENT_KINDS, ...extras]);
}
```

```ts
export function generateDungeon(
  rng: Rng,
  options: GenerateDungeonOptions = {},
): GeneratedDungeon {
  const pools = options.eventPools ?? DUNGEON_EVENT_POOLS;
  const shape = rng.pick(DUNGEON_SHAPES);
  const drafts = buildNodeDrafts(shape.branches, shape.pathDepth);
  const kinds = regularKinds(drafts.length - 1, rng);
  const queues = Object.fromEntries(
    EVENT_KINDS.map((kind) => [kind, rng.shuffle(pools.regular[kind])]),
  ) as Record<EventKind, DungeonEvent[]>;
  const offsets = Object.fromEntries(EVENT_KINDS.map((kind) => [kind, 0])) as
    Record<EventKind, number>;
  const regularEvents = kinds.map((kind) => queues[kind][offsets[kind]++]);
  const events = [...regularEvents, rng.pick(pools.boss)];
  const nodes: DungeonNode[] = drafts.map((draft, index) => ({
    ...draft,
    eventId: events[index].id as EventId,
  }));
  return {
    dungeon: {
      nodes,
      entryNodeId: nodeId("node-entry"),
      bossNodeId: nodeId("node-boss"),
    },
    events,
  };
}
```

- [ ] **Step 4: 이벤트 배치 테스트를 추가한다**

다음 테스트는 50개 고정 시드에서 네 분류, 보스 이벤트, 일대일 연결과 중복
방지를 확인한다.

```ts
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
```

- [ ] **Step 5: 생성 테스트와 정적 검사를 실행한다**

Run:

```bash
pnpm test -- lib/rules/dungeon.test.ts
pnpm typecheck
```

Expected: 경로·배치 테스트를 포함한 모든 `dungeon.test.ts` 테스트 PASS; typecheck 0.

- [ ] **Step 6: Task 2를 커밋한다**

```bash
git add lib/rules/dungeon.ts lib/rules/dungeon.test.ts
git commit -m "기능: 분기 경로와 이벤트 배치 생성" -m "허용된 세 경로 형태를 시드로 선택하고 모든 갈래를 같은 길이로 보스 전에 합류시킨다.
네 이벤트 분류와 보스 조우를 중복 없이 배치해 후속 흐름이 완전한 던전을 받게 한다."
```

---

### Task 3: 콘텐츠 검증과 오류 계약

**Files:**
- Modify: `lib/rules/dungeon.ts`
- Modify: `lib/rules/dungeon.test.ts`

**Interfaces:**
- Consumes: Task 2의 `generateDungeon`과 `DungeonEventPools`
- Produces: 난수 소비 전 모든 풀 오류를 거부하는 최종 `generateDungeon`

- [ ] **Step 1: 잘못된 풀을 만드는 테스트 helper를 추가한다**

```ts
import type { DungeonEventPools } from "@/lib/content/events";
import type { DungeonEvent, MemberId } from "@/lib/domain";

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
    regular: { ...pools.regular, [kind]: pools.regular[kind].map((item, itemIndex) =>
      itemIndex === index ? event : item) },
  };
}
```

- [ ] **Step 2: 각 오류의 실패 테스트를 작성한다**

각 테스트는 `clonedPools()`의 한 부분만 바꾸고 다음 메시지 핵심을 확인한다.

```ts
describe("던전 이벤트 풀 검증", () => {
  it("일반 분류별 이벤트가 두 개보다 적으면 거부한다", () => {
    const pools = clonedPools();
    const invalid = { ...pools, regular: { ...pools.regular, monster: pools.regular.monster.slice(0, 1) } };
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
    const duplicateChoice = { ...pools.regular.rest[0], choices: [{
      ...pools.regular.rest[0].choices[0], id: pools.regular.monster[0].choices[0].id,
    }] };
    expect(withPools(replaceEvent(pools, "rest", 0, duplicateChoice))).toThrow(/선택지 ID.*중복/);
  });

  it("빈 선택지와 빈 이득·위험을 거부한다", () => {
    const pools = clonedPools();
    expect(withPools(replaceEvent(pools, "rest", 0, { ...pools.regular.rest[0], choices: [] })))
      .toThrow(/선택지.*없/);
    const base = pools.regular.rest[0];
    expect(withPools(replaceEvent(pools, "rest", 0, { ...base, choices: [{ ...base.choices[0], expectedGain: " " }] })))
      .toThrow(/예상 이득.*비어/);
    expect(withPools(replaceEvent(pools, "rest", 0, { ...base, choices: [{ ...base.choices[0], knownRisk: " " }] })))
      .toThrow(/알려진 위험.*비어/);
  });

  it("파티원 대상 선택지를 거부한다", () => {
    const pools = clonedPools();
    const base = pools.regular.rest[0];
    const invalid = { ...base, choices: [{ ...base.choices[0], target: {
      kind: "member" as const, id: "member-test" as MemberId,
    } }] };
    expect(withPools(replaceEvent(pools, "rest", 0, invalid))).toThrow(/파티원 대상/);
  });
});
```

- [ ] **Step 3: 빈 검증 함수 때문에 테스트가 실패하는지 확인한다**

Run: `pnpm test -- lib/rules/dungeon.test.ts`

Expected: 새 오류 테스트들이 “function did not throw”로 FAIL한다.

- [ ] **Step 4: 난수 소비 전 풀 전체 검증을 구현한다**

`validateEventPools`는 `EVENT_KINDS` 순서로 일반 풀을, 이어서 boss 풀을 순회한다.
모든 이벤트를 한 배열로 모으면서 `Set<EventId>`와 `Set<ChoiceId>`로 중복을 검사한다.

```ts
function validateEvent(event: DungeonEvent, expectedKind: EventKind, eventIds: Set<string>, choiceIds: Set<string>): void {
  if (event.kind !== expectedKind) throw new Error(`이벤트 분류가 ${expectedKind} 풀이 아니다: ${event.id}`);
  if (eventIds.has(event.id)) throw new Error(`이벤트 ID가 중복된다: ${event.id}`);
  eventIds.add(event.id);
  if (event.choices.length === 0) throw new Error(`선택지가 없는 이벤트다: ${event.id}`);
  for (const choice of event.choices) {
    if (choiceIds.has(choice.id)) throw new Error(`선택지 ID가 중복된다: ${choice.id}`);
    choiceIds.add(choice.id);
    if (choice.expectedGain.trim() === "") throw new Error(`예상 이득이 비어 있다: ${choice.id}`);
    if (choice.knownRisk.trim() === "") throw new Error(`알려진 위험이 비어 있다: ${choice.id}`);
    if (choice.target?.kind === "member") throw new Error(`파티원 대상 선택지는 사용할 수 없다: ${choice.id}`);
  }
}

function validateEventPools(pools: DungeonEventPools): void {
  const eventIds = new Set<string>();
  const choiceIds = new Set<string>();
  for (const kind of EVENT_KINDS) {
    const events = pools.regular[kind];
    if (events.length < 2) throw new Error(`${kind} 이벤트 풀은 최소 2개여야 한다: ${events.length}`);
    for (const event of events) validateEvent(event, kind, eventIds, choiceIds);
  }
  if (pools.boss.length === 0) throw new Error("보스 이벤트 풀이 비어 있다.");
  for (const event of pools.boss) validateEvent(event, "special", eventIds, choiceIds);
}
```

보스 kind 오류가 일반 메시지보다 명확하도록 boss 순회 전 별도 검사하거나
`validateEvent`에 위치 라벨을 전달해 `/보스.*special/` 테스트를 만족시킨다.
`generateDungeon`에서 `const pools = ...` 바로 다음, 첫 `rng` 호출보다 앞에
`validateEventPools(pools);`를 추가한다.

- [ ] **Step 5: 집중·인접·전체 정적 검사를 실행한다**

Run:

```bash
pnpm test -- lib/rules/dungeon.test.ts lib/rng/index.test.ts lib/mock/mock.test.ts
pnpm lint
pnpm typecheck
pnpm test
```

Expected: 모든 명령 exit 0, 전체 테스트 출력에 경고 없음.

- [ ] **Step 6: Task 3을 커밋한다**

```bash
git add lib/rules/dungeon.ts lib/rules/dungeon.test.ts
git commit -m "기능: 던전 콘텐츠 계약 검증" -m "이벤트 풀의 최소량, 분류, 식별자와 선택지 정보를 난수 소비 전에 검사한다.
잘못된 콘텐츠가 조용한 중복이나 재현성 변화로 이어지지 않게 하기 위함이다."
```

---

### Task 4: 최신 main 동기화, 배정표 갱신과 전체 검증

**Files:**
- Modify: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`

**Interfaces:**
- Consumes: 완성된 `generateDungeon`과 최신 `origin/main` 배정표
- Produces: R4 완료 상태와 R5·P1·U3·Q1의 최신 남은 선행

- [ ] **Step 1: 최신 main을 병합한다**

Run:

```bash
git fetch origin
git merge origin/main
```

Expected: 충돌 없이 병합. 충돌 시 현재 main의 완료 작업을 되돌리지 말고 최신
배정표를 기준으로 다음 단계를 다시 계산한다. 승인받은 PR에 이후 push하지 않는다.

- [ ] **Step 2: 현재 배정표에서 R4만 완료하고 후속 선행에서 R4를 제거한다**

반드시 병합 후 실제 행을 읽는다. 다음 변환만 적용한다.

- R4 담당 `LatteBun`, 상태 `✅`, 선행 `—`, 풀리는 것은 그대로 둔다.
- R5의 현재 선행 목록에서 `R4`만 제거한다.
- P1의 현재 선행 목록에서 `R4`만 제거한다. 다른 선행이 없으면 `—`다.
- U3의 현재 선행 목록에서 `R4`만 제거한다.
- Q1의 현재 선행 목록에서 `R4`만 제거한다.
- 의존성 그래프와 다른 행은 바꾸지 않는다.

현재 main 기준 예상값은 R5 `R2 R3`, P1 `—`, U3 `P1`, Q1 `R3`이지만, PR #9
등이 먼저 병합되면 실제 최신 값에서 R4만 빼는 원칙이 우선한다.

- [ ] **Step 3: 배정표 무결성 검사를 실행한다**

Run: `pnpm test -- docs/technical/PROTOTYPE_WORK_ASSIGNMENT.test.ts`

Expected: PASS.

- [ ] **Step 4: 전체 검증 네 개를 실행한다**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: 네 명령 exit 0. 빌드가 환경의 포트 바인딩 `EPERM`으로 실패하면 권한
확장으로 동일 명령을 한 번 재시도하고, 그래도 실패하면 성공으로 주장하지 말고
정확한 환경 제한과 나머지 검증 결과를 보고한다.

- [ ] **Step 5: 범위 diff와 개인 파일 제외를 확인한다**

Run:

```bash
git diff --check origin/main..HEAD
git status --short
```

Expected: 범위 diff 오류 없음. 추적 변경은 배정표뿐이며 개인 미추적
`dungeon-schemer-handoff.md`는 stage하지 않는다.

- [ ] **Step 6: 배정표를 커밋한다**

```bash
git add docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md
git commit -m "문서: 이벤트와 경로 생성 완료 기록" -m "R4 구현과 검증 결과를 반영하고 후속 작업의 남은 선행에서 R4를 제거한다.
팀원이 최신 배정표만 보고 시작 가능한 흐름을 판단할 수 있게 한다."
```
