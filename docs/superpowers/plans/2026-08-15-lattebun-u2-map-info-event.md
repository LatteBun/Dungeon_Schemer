# U2 던전 지도·정보·사건 화면 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공개 던전 지도, 정보 전달 기회, 개인별 반응, 별도 사건 행동 화면을 순수 레이아웃·view-model + 프리뷰 하네스로 구현해 라이브 스토어 없이 병렬로 완성한다.

**Architecture:** `GeneratedMap` 구조에서 좌표를 계산하는 순수 `map-layout.ts`, `ExpeditionState`와 E1·E2·E3 규칙 출력을 표시용 view로 바꾸는 순수 `expedition-view-model.ts`, 그 view를 렌더하는 표시 컴포넌트 다섯, 지도→정보→사건 흐름을 로컬 useState로 구동하는 `app/u2-test` 하네스. 라이브 전이는 I1이 나중에 붙인다.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript 5 strict, Tailwind CSS 4(디자인 토큰), SVG(지도), Vitest 4(node 환경), 기존 프리미티브 `Panel`·`StatValue`와 `CampaignHeader`(U1).

**Spec:** `docs/superpowers/specs/2026-08-15-lattebun-u2-map-info-event-design.md`

## Global Constraints

- 던전·파티는 등급·번호로 표시한다(고유명 금지). 던전 제목은 콘텐츠 값이 있으면 쓰고 없으면 등급·번호.
- 지도는 아래가 입구, 위가 보스인 대칭 두 갈래 그래프다. 좌표는 `MapNode.depth`(행)와 노드 ID `node-path-{branch}-depth-{d}`(열)에서 결정한다.
- 지도 노드 ID 규약(`node-entry`·`node-merge`·`node-boss`·`node-path-{branch}-depth-{d}`)에 맞지 않으면 `RuleError("INVALID_GENERATION", …)`를 던진다.
- 상태·잠금·선택·반응은 색뿐 아니라 기호(◎/✓/→/×, ✓/!/?)·테두리 형태·`aria` 속성으로 함께 구분한다.
- 규칙 재구현 금지. 지도·정보·사건 계산은 `generateGradeMap`·`createInfoOpportunity`·`evaluatePartyInfoCard`·`resolveEventChoice`가 소유하고 U2는 표시·조립만 한다.
- `components/**`는 `@/lib/mock`을 import하지 않는다. view-model·컴포넌트는 `@/lib/domain`·`@/lib/rules`·`@/lib/content`·`./labels`만 참조한다. 데이터는 `app/u2-test`가 주입한다.
- 표시 컴포넌트는 DOM 테스트가 없다(Vitest node 환경). typecheck+lint+build와 `/u2-test` 브라우저로 검증한다. 로직은 `map-layout`·view-model 단위 테스트가 커버한다.
- 검증 명령 넷 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`를 유지한다.
- 커밋 메시지는 제목과 본문을 모두 한글로 쓴다.
- 브랜치는 `feature/u2-map-info-event`이며 spec 커밋(`83f4282`)이 이미 올라가 있다. main에 직접 push하지 않는다.

## 파일 구조

| 파일 | 책임 |
| --- | --- |
| `components/game/map-layout.ts` (+test) | `GeneratedMap` → 노드 x/y·간선(순수 기하) |
| `components/game/expedition-view-model.ts` (+test) | 지도·정보·반응·사건·파티 상태 view 조인(순수) |
| `components/game/DungeonMapView.tsx` | SVG 지도 + 좌측 범례 + 하단 캡션 |
| `components/game/PartyStatusSidebar.tsx` | 파티원 상태 카드 |
| `components/game/InfoOpportunityPanel.tsx` | 관람 영역 + 진실·거짓·중립 카드 |
| `components/game/EventActions.tsx` | 사건 행동 버튼·진행 |
| `components/game/PartyReactionSidebar.tsx` | 카드 선택 후 개인별 반응 |
| `app/u2-test/u2-fixtures.ts` | 지도·파티·조회 fixture |
| `app/u2-test/page.tsx` | 프리뷰 하네스 |

**참조 계약(변경 없음):** `lib/rules/map.ts`(`generateGradeMap`), `lib/rules/info.ts`(`createInfoOpportunity`·`evaluatePartyInfoCard`·`PartyInfoCardEvaluation`), `lib/rules/event.ts`(`resolveEventChoice`), `lib/content/{info-cards,events,items,classes}.ts`, `lib/domain`(`GeneratedMap`·`MapNode`·`PendingInfo`·`InfoCard`·`DungeonEvent`·`EventChoice`·`CampaignMember`·`ItemDef`·`RuleError` 등), `components/game/labels.ts`, `components/game/CampaignHeader.tsx`, `components/ui/Panel.tsx`·`StatValue.tsx`.

---

### Task 1: 지도 레이아웃 순수 모듈

**Files:**
- Create: `components/game/map-layout.ts`
- Test: `components/game/map-layout.test.ts`

**Interfaces:**
- Consumes: `GeneratedMap`, `NodeId`, `RuleError` from `@/lib/domain`.
- Produces:
  - `MapLayoutNode { id: NodeId; x: number; y: number }`
  - `MapLayoutEdge { fromId: NodeId; toId: NodeId }`
  - `MapLayout { viewWidth: number; viewHeight: number; nodes: MapLayoutNode[]; edges: MapLayoutEdge[] }`
  - `layoutMap(map: GeneratedMap): MapLayout`

- [ ] **Step 1: 실패하는 테스트를 작성한다.**

Create `components/game/map-layout.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import { generateGradeMap } from "@/lib/rules/map";
import { layoutMap } from "./map-layout";

function mapFor(grade: "C" | "B" | "A" | "S") {
  return generateGradeMap(grade, createRng(`u2-layout-${grade}`).derive("map"));
}

describe("layoutMap", () => {
  it("등급별 전체 노드 수를 그대로 배치한다", () => {
    expect(layoutMap(mapFor("C")).nodes).toHaveLength(7);
    expect(layoutMap(mapFor("B")).nodes).toHaveLength(9);
    expect(layoutMap(mapFor("A")).nodes).toHaveLength(11);
    expect(layoutMap(mapFor("S")).nodes).toHaveLength(13);
  });

  it("입구는 맨 아래(y 최대), 보스는 맨 위(y 최소)에 둔다", () => {
    const map = mapFor("C");
    const layout = layoutMap(map);
    const byId = new Map(layout.nodes.map((node) => [node.id, node]));
    const entry = byId.get(map.entryNodeId);
    const boss = byId.get(map.bossNodeId);
    const maxY = Math.max(...layout.nodes.map((node) => node.y));
    const minY = Math.min(...layout.nodes.map((node) => node.y));
    expect(entry?.y).toBe(maxY);
    expect(boss?.y).toBe(minY);
  });

  it("입구·보스는 중앙, 갈래 노드는 좌우로 갈린다", () => {
    const map = mapFor("C");
    const layout = layoutMap(map);
    const byId = new Map(layout.nodes.map((node) => [node.id, node]));
    expect(byId.get(map.entryNodeId)?.x).toBe(200);
    expect(byId.get(map.bossNodeId)?.x).toBe(200);
    const left = layout.nodes.filter((node) => node.x < 200);
    const right = layout.nodes.filter((node) => node.x > 200);
    expect(left.length).toBeGreaterThan(0);
    expect(right.length).toBe(left.length);
  });

  it("간선은 모든 nextNodeIds와 정확히 일치한다", () => {
    const map = mapFor("C");
    const layout = layoutMap(map);
    const expected = map.nodes.flatMap((node) =>
      node.nextNodeIds.map((toId) => `${node.id}->${toId}`),
    ).sort();
    const actual = layout.edges.map((edge) => `${edge.fromId}->${edge.toId}`).sort();
    expect(actual).toEqual(expected);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다.**

Run: `pnpm test components/game/map-layout.test.ts`
Expected: FAIL — `./map-layout` 모듈이 없어 import 실패.

- [ ] **Step 3: 레이아웃을 구현한다.**

Create `components/game/map-layout.ts`:

```ts
import { RuleError } from "@/lib/domain";
import type { GeneratedMap, NodeId } from "@/lib/domain";

export interface MapLayoutNode {
  id: NodeId;
  x: number;
  y: number;
}

export interface MapLayoutEdge {
  fromId: NodeId;
  toId: NodeId;
}

export interface MapLayout {
  viewWidth: number;
  viewHeight: number;
  nodes: MapLayoutNode[];
  edges: MapLayoutEdge[];
}

const VIEW_WIDTH = 400;
const CENTER_X = 200;
const BRANCH_OFFSET = 120;
const ROW_GAP = 120;

/** 갈래 노드의 x를 ID의 branch 번호로 정한다. 갈래가 아니면 null. */
function branchColumn(id: string): number | null {
  const match = /^node-path-(\d+)-depth-\d+$/.exec(id);
  if (match === null) {
    return null;
  }
  return Number(match[1]) === 1 ? CENTER_X - BRANCH_OFFSET : CENTER_X + BRANCH_OFFSET;
}

/**
 * 지도 구조에서 화면 좌표를 결정한다.
 * y는 depth(입구 0 → 보스 최대)를 뒤집어 입구가 맨 아래로 간다.
 * x는 입구·합류·보스가 중앙, 갈래 노드가 좌우다.
 */
export function layoutMap(map: GeneratedMap): MapLayout {
  const incoming = new Map<string, number>();
  for (const node of map.nodes) {
    for (const next of node.nextNodeIds) {
      incoming.set(next, (incoming.get(next) ?? 0) + 1);
    }
  }

  const maxDepth = Math.max(...map.nodes.map((node) => node.depth));
  const viewHeight = maxDepth * ROW_GAP;

  const nodes = map.nodes.map((node): MapLayoutNode => {
    const y = viewHeight - node.depth * ROW_GAP;
    let x: number;
    if (node.id === map.entryNodeId || node.id === map.bossNodeId) {
      x = CENTER_X;
    } else if ((incoming.get(node.id) ?? 0) >= 2) {
      x = CENTER_X;
    } else {
      const column = branchColumn(node.id);
      if (column === null) {
        throw new RuleError(
          "INVALID_GENERATION",
          `지도 노드 ID가 규약과 다르다: ${node.id}`,
          { nodeId: node.id },
        );
      }
      x = column;
    }
    return { id: node.id, x, y };
  });

  const edges = map.nodes.flatMap((node) =>
    node.nextNodeIds.map((toId): MapLayoutEdge => ({ fromId: node.id, toId })),
  );

  return { viewWidth: VIEW_WIDTH, viewHeight, nodes, edges };
}
```

- [ ] **Step 4: 테스트와 타입 검사를 통과시킨다.**

Run: `pnpm test components/game/map-layout.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: 검사 발동을 확인한다.**

`y = viewHeight - node.depth * ROW_GAP`의 `-`를 `+`로 바꿔 입구/보스 y 순서 테스트가 실패하는지 본 뒤 되돌린다. 확인 내용을 커밋 본문에 적는다.

- [ ] **Step 6: 커밋한다.**

```bash
git add components/game/map-layout.ts components/game/map-layout.test.ts
git commit -m "화면: 던전 지도 레이아웃 좌표를 계산한다" -m "GeneratedMap의 depth와 노드 ID에서 입구 아래·보스 위 대칭 그래프 좌표와 간선을 만든다. y 뒤집기를 일부러 없애 테스트가 잡는지 확인 후 되돌렸다."
```

---

### Task 2: 탐험 화면 view-model

**Files:**
- Create: `components/game/expedition-view-model.ts`
- Test: `components/game/expedition-view-model.test.ts`

**Interfaces:**
- Consumes: `layoutMap`, `MapLayoutEdge` from `./map-layout`; `PartyInfoCardEvaluation` from `@/lib/rules/info`; `CLASSES` from `@/lib/content/classes`; `EVENT_KIND_RISK_SUMMARY` from `@/lib/content/events`; `EVENT_KIND_LABELS`, `EVENT_KIND_MARKS`, `PERSONALITY_LABELS`, `TRUTH_TYPE_LABELS` from `./labels`; domain types `GeneratedMap`, `MapNode`, `NodeId`, `EventId`, `EventKind`, `PendingInfo`, `CardId`, `InfoCard`, `TruthType`, `InfoReaction`, `DungeonEvent`, `ChoiceId`, `ItemId`, `ItemDef`, `CampaignMember`, `MemberId`.
- Produces the view types and five functions below (Tasks 3–4 consume them):
  - `toMapView(map, currentNodeId, visitedNodeIds, eventKindById): MapView`
  - `toInfoOpportunityView(pendingInfo, cardById, sceneNode, event, party): InfoOpportunityView`
  - `toInfoReactionsView(evaluation): MemberReactionView[]`
  - `toEventView(event, currentGold, itemById): EventView`
  - `toPartyStatusView(members, trustDeltaById?): MemberStatusView[]`

- [ ] **Step 1: 실패하는 테스트를 작성한다.**

Create `components/game/expedition-view-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
import { generateGradeMap } from "@/lib/rules/map";
import { createInfoOpportunity, evaluatePartyInfoCard } from "@/lib/rules/info";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { INFO_CARDS } from "@/lib/content/info-cards";
import { ITEMS } from "@/lib/content/items";
import type {
  CampaignMember,
  ChoiceId,
  DungeonEvent,
  EventId,
  EventKind,
  ItemId,
} from "@/lib/domain";
import {
  toEventView,
  toInfoReactionsView,
  toMapView,
  toPartyStatusView,
} from "./expedition-view-model";

const ALL_EVENTS: DungeonEvent[] = [
  ...Object.values(DUNGEON_EVENT_POOLS.regular).flat(),
  ...DUNGEON_EVENT_POOLS.boss,
];
const eventById = (id: EventId): DungeonEvent => {
  const found = ALL_EVENTS.find((event) => event.id === id);
  if (found === undefined) throw new Error(`no event ${id}`);
  return found;
};
const eventKindById = (id: EventId): EventKind => eventById(id).kind;

function party(): CampaignMember[] {
  const state = initializeCampaign("u2-vm");
  const first = state.parties.find((candidate) => candidate.complete)!;
  return first.memberIds.map(
    (memberId) => state.members.find((member) => member.id === memberId)!,
  );
}

describe("toMapView", () => {
  it("현재·선택 가능·비활성 상태와 보스 노드를 표시한다", () => {
    const map = generateGradeMap("C", createRng("u2-vm-map").derive("map"));
    const view = toMapView(map, map.entryNodeId, [], eventKindById);
    const current = view.nodes.find((node) => node.id === map.entryNodeId);
    const entryNode = map.nodes.find((node) => node.id === map.entryNodeId)!;
    expect(current?.state).toBe("current");
    for (const node of view.nodes) {
      const selectable = entryNode.nextNodeIds.includes(node.id);
      if (selectable) expect(node.state).toBe("selectable");
    }
    expect(view.nodes.find((node) => node.id === map.bossNodeId)?.isBoss).toBe(true);
  });
});

describe("toEventView", () => {
  it("거래 잔액이 부족한 선택지를 비활성으로 표시한다", () => {
    const item = ITEMS[0];
    const event: DungeonEvent = {
      id: "e-merchant" as EventId,
      kind: "merchant",
      title: "떠돌이 상인",
      description: "상인이 물건을 편다.",
      choices: [
        {
          id: "c-buy" as ChoiceId,
          label: `${item.name} 구매`,
          expectedGain: "회복",
          knownRisk: "골드 소모",
          effectTags: ["trade"],
          itemId: item.id,
        },
        {
          id: "c-leave" as ChoiceId,
          label: "관망",
          expectedGain: "자원 보존",
          knownRisk: "기회 상실",
          effectTags: [],
        },
      ],
    };
    const itemById = (id: ItemId) => ITEMS.find((candidate) => candidate.id === id);
    const view = toEventView(event, item.price - 1, itemById);
    expect(view.choices[0].disabled).toBe(true);
    expect(view.choices[0].disabledReason).toMatch(/골드/);
    expect(view.choices[1].disabled).toBe(false);
  });
});

describe("toInfoReactionsView", () => {
  it("살아 있는 파티원마다 반응 라벨과 기호를 만든다", () => {
    const members = party();
    const map = generateGradeMap("C", createRng("u2-vm-info").derive("map"));
    const infoNode = map.nodes.find((node) => node.hasInfoOpportunity)!;
    const pending = createInfoOpportunity({
      node: infoNode,
      eventKind: eventKindById(infoNode.eventId),
      rng: createRng("u2-vm-info").derive("card"),
    });
    const card = INFO_CARDS.find((candidate) => candidate.id === pending.cardIds[0])!;
    const evaluation = evaluatePartyInfoCard({
      card,
      party: members,
      cardRng: createRng("u2-vm-info").derive("card"),
      trustRng: createRng("u2-vm-info").derive("trust"),
    });
    const view = toInfoReactionsView(evaluation);
    expect(view).toHaveLength(members.length);
    for (const row of view) {
      expect(["수용", "의심", "적발"]).toContain(row.reactionLabel);
      expect(["✓", "?", "!"]).toContain(row.reactionMark);
    }
  });
});

describe("toPartyStatusView", () => {
  it("신뢰 변화량과 빈 기억 문구를 파생한다", () => {
    const members = party();
    const view = toPartyStatusView(members, { [members[0].id]: 2 });
    expect(view[0].trustDelta).toBe(2);
    expect(view[1].trustDelta).toBe(0);
    expect(view[0].memoryNote).toBe("최근 변화 없음");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다.**

Run: `pnpm test components/game/expedition-view-model.test.ts`
Expected: FAIL — view-model 모듈이 없어 import 실패.

- [ ] **Step 3: view-model을 구현한다.**

Create `components/game/expedition-view-model.ts`:

```ts
import { CLASSES } from "@/lib/content/classes";
import { EVENT_KIND_RISK_SUMMARY } from "@/lib/content/events";
import type {
  CampaignMember,
  CardId,
  ChoiceId,
  ClassId,
  DungeonEvent,
  EventId,
  EventKind,
  GeneratedMap,
  InfoCard,
  InfoReaction,
  ItemDef,
  ItemId,
  MapNode,
  MemberId,
  NodeId,
  PendingInfo,
  TruthType,
} from "@/lib/domain";
import type { PartyInfoCardEvaluation } from "@/lib/rules/info";
import {
  EVENT_KIND_LABELS,
  EVENT_KIND_MARKS,
  PERSONALITY_LABELS,
  TRUTH_TYPE_LABELS,
} from "./labels";
import { layoutMap } from "./map-layout";
import type { MapLayoutEdge } from "./map-layout";

const MAP_CAPTION = "공개 지도는 결과를 숨기지 않지만 사건의 정확한 수치는 숨긴다.";

const TRUTH_MARKS: Readonly<Record<TruthType, string>> = {
  truth: "✓",
  lie: "!",
  neutral: "?",
};

const EXPECTED_NOTE: Readonly<Record<TruthType, string>> = {
  truth: "안정적 전술 효과 · 검증 가능",
  lie: "큰 전술 왜곡 · 사후 검증",
  neutral: "약한 정보 효과 · 즉시 신뢰 변화 없음",
};

const REACTION_LABELS: Readonly<Record<InfoReaction, string>> = {
  accepted: "수용",
  suspected: "의심",
  exposed: "적발",
};

const REACTION_MARKS: Readonly<Record<InfoReaction, string>> = {
  accepted: "✓",
  suspected: "?",
  exposed: "!",
};

const REACTION_NOTES: Readonly<Record<InfoReaction, string>> = {
  accepted: "효과 적용 · 미검증 기록",
  suspected: "효과 없음 · 의심 검증 기록",
  exposed: "효과 없음 · 기만 적발 기록",
};

function classNameOf(classId: ClassId): string {
  return CLASSES.find((klass) => klass.id === classId)?.name ?? "직업 미정";
}

// --- 지도 ---

export type MapNodeState = "current" | "visited" | "selectable" | "inactive";

export interface MapNodeView {
  id: NodeId;
  x: number;
  y: number;
  categoryLabel: string;
  categoryMark: string;
  hasInfo: boolean;
  state: MapNodeState;
  isBoss: boolean;
  riskSummary: string;
}

export interface MapView {
  viewWidth: number;
  viewHeight: number;
  edges: MapLayoutEdge[];
  nodes: MapNodeView[];
  bossNodeId: NodeId;
  caption: string;
}

export function toMapView(
  map: GeneratedMap,
  currentNodeId: NodeId,
  visitedNodeIds: readonly NodeId[],
  eventKindById: (eventId: EventId) => EventKind,
): MapView {
  const layout = layoutMap(map);
  const positionById = new Map(layout.nodes.map((node) => [node.id, node]));
  const currentNode = map.nodes.find((node) => node.id === currentNodeId);
  const nextIds = new Set<string>(currentNode?.nextNodeIds ?? []);
  const visited = new Set<string>(visitedNodeIds);

  const nodes = map.nodes.map((node): MapNodeView => {
    const position = positionById.get(node.id);
    const x = position?.x ?? 0;
    const y = position?.y ?? 0;
    const isBoss = node.id === map.bossNodeId;
    const isEntry = node.id === map.entryNodeId;

    let state: MapNodeState;
    if (node.id === currentNodeId) {
      state = "current";
    } else if (visited.has(node.id)) {
      state = "visited";
    } else if (nextIds.has(node.id)) {
      state = "selectable";
    } else {
      state = "inactive";
    }

    const kind = isBoss ? null : eventKindById(node.eventId);
    const categoryLabel = isBoss
      ? "보스방"
      : isEntry
        ? "입구"
        : EVENT_KIND_LABELS[kind as EventKind];
    const categoryMark = isBoss ? "★" : kind === null ? "" : EVENT_KIND_MARKS[kind];

    return {
      id: node.id,
      x,
      y,
      categoryLabel,
      categoryMark,
      hasInfo: node.hasInfoOpportunity,
      state,
      isBoss,
      riskSummary: node.riskSummary,
    };
  });

  return {
    viewWidth: layout.viewWidth,
    viewHeight: layout.viewHeight,
    edges: layout.edges,
    nodes,
    bossNodeId: map.bossNodeId,
    caption: MAP_CAPTION,
  };
}

// --- 정보 기회 ---

export interface InfoCardView {
  cardId: CardId;
  truthType: TruthType;
  truthLabel: string;
  truthMark: string;
  topic: string;
  text: string;
  expectedNote: string;
  dashed: boolean;
}

export interface InfoSceneView {
  sceneText: string;
  riskSummary: string;
  memberNames: { id: MemberId; name: string; alive: boolean }[];
}

export interface InfoOpportunityView {
  scene: InfoSceneView;
  cards: InfoCardView[];
}

export function toInfoOpportunityView(
  pendingInfo: PendingInfo,
  cardById: (cardId: CardId) => InfoCard,
  sceneNode: MapNode,
  event: DungeonEvent,
  party: readonly CampaignMember[],
): InfoOpportunityView {
  const cards = pendingInfo.cardIds.map((cardId): InfoCardView => {
    const card = cardById(cardId);
    return {
      cardId: card.id,
      truthType: card.truthType,
      truthLabel: TRUTH_TYPE_LABELS[card.truthType],
      truthMark: TRUTH_MARKS[card.truthType],
      topic: card.topic,
      text: card.text,
      expectedNote: EXPECTED_NOTE[card.truthType],
      dashed: card.truthType === "lie",
    };
  });

  return {
    scene: {
      sceneText: event.title,
      riskSummary: `공개 위험: ${sceneNode.riskSummary}`,
      memberNames: party.map((member) => ({
        id: member.id,
        name: member.name,
        alive: member.alive,
      })),
    },
    cards,
  };
}

// --- 개인별 반응 ---

export interface MemberReactionView {
  memberId: MemberId;
  name: string;
  className: string;
  personalityLabel: string;
  reaction: InfoReaction;
  reactionLabel: string;
  reactionMark: string;
  trustDelta: number;
  currentHp: number;
  maxHp: number;
  trust: number;
  note: string;
}

export function toInfoReactionsView(
  evaluation: PartyInfoCardEvaluation<CampaignMember>,
): MemberReactionView[] {
  return evaluation.memberResults.map((result): MemberReactionView => {
    const member = result.member;
    const evaluated = result.trustEvaluation?.member ?? member;
    return {
      memberId: member.id,
      name: member.name,
      className: classNameOf(member.classId),
      personalityLabel: PERSONALITY_LABELS[member.personality],
      reaction: result.reaction,
      reactionLabel: REACTION_LABELS[result.reaction],
      reactionMark: REACTION_MARKS[result.reaction],
      trustDelta: result.trustEvaluation?.change.delta ?? 0,
      currentHp: member.currentHp,
      maxHp: member.maxHp,
      trust: evaluated.trust,
      note: REACTION_NOTES[result.reaction],
    };
  });
}

// --- 사건 행동 ---

export interface EventChoiceView {
  choiceId: ChoiceId;
  label: string;
  expectedGain: string;
  knownRisk: string;
  disabled: boolean;
  disabledReason: string | null;
}

export interface EventView {
  title: string;
  kindLabel: string;
  description: string;
  riskSummary: string;
  choices: EventChoiceView[];
}

export function toEventView(
  event: DungeonEvent,
  currentGold: number,
  itemById: (itemId: ItemId) => ItemDef | undefined,
): EventView {
  const choices = event.choices.map((choice): EventChoiceView => {
    let disabled = false;
    let disabledReason: string | null = null;
    if (choice.effectTags.includes("trade") && choice.itemId !== undefined) {
      const item = itemById(choice.itemId);
      if (item !== undefined && item.price > currentGold) {
        disabled = true;
        disabledReason = `골드 부족(${item.price}G)`;
      }
    }
    return {
      choiceId: choice.id,
      label: choice.label,
      expectedGain: choice.expectedGain,
      knownRisk: choice.knownRisk,
      disabled,
      disabledReason,
    };
  });

  return {
    title: event.title,
    kindLabel: EVENT_KIND_LABELS[event.kind],
    description: event.description,
    riskSummary: `공개 위험: ${EVENT_KIND_RISK_SUMMARY[event.kind]}`,
    choices,
  };
}

// --- 파티 상태 ---

export interface MemberStatusView {
  memberId: MemberId;
  name: string;
  className: string;
  currentHp: number;
  maxHp: number;
  trust: number;
  trustDelta: number;
  carriedGold: number;
  memoryNote: string;
}

export function toPartyStatusView(
  members: readonly CampaignMember[],
  trustDeltaById: Readonly<Record<string, number>> = {},
): MemberStatusView[] {
  return members.map((member): MemberStatusView => ({
    memberId: member.id,
    name: member.name,
    className: classNameOf(member.classId),
    currentHp: member.currentHp,
    maxHp: member.maxHp,
    trust: member.trust,
    trustDelta: trustDeltaById[member.id] ?? 0,
    carriedGold: member.carriedGold,
    memoryNote:
      member.memory.length === 0
        ? "최근 변화 없음"
        : member.memory[member.memory.length - 1].summary,
  }));
}
```

- [ ] **Step 4: 테스트와 타입 검사를 통과시킨다.**

Run: `pnpm test components/game/expedition-view-model.test.ts && pnpm typecheck`
Expected: PASS. `CampaignMember`가 `evaluatePartyInfoCard`의 `PartyMember` 제약을 만족하므로 `PartyInfoCardEvaluation<CampaignMember>`가 타입 검사를 통과한다.

- [ ] **Step 5: 검사 발동을 확인한다.**

`toEventView`의 거래 비활성 조건 `item.price > currentGold`를 `<`로 바꿔 거래 disabled 테스트가 실패하는지 본 뒤 되돌린다. 확인 내용을 커밋 본문에 적는다.

- [ ] **Step 6: 커밋한다.**

```bash
git add components/game/expedition-view-model.ts components/game/expedition-view-model.test.ts
git commit -m "화면: 탐험 지도·정보·사건 view-model을 추가한다" -m "지도 노드 상태·정보 카드·개인 반응·사건 행동·파티 상태를 표시용 view로 조인한다. 거래 비활성 부등호를 일부러 뒤집어 테스트가 잡는지 확인 후 되돌렸다."
```

---

### Task 3: 표시 컴포넌트 다섯

**Files:**
- Create: `components/game/DungeonMapView.tsx`, `PartyStatusSidebar.tsx`, `InfoOpportunityPanel.tsx`, `EventActions.tsx`, `PartyReactionSidebar.tsx`

**Interfaces:**
- Consumes view types from `./expedition-view-model` (`MapView`, `MapNodeView`, `InfoOpportunityView`, `MemberReactionView`, `EventView`, `MemberStatusView`) and `NodeId`, `CardId`, `ChoiceId` from `@/lib/domain`; `Panel` from `@/components/ui/Panel`.
- Produces components with these exact props (Task 4 renders them):
  - `DungeonMapView({ view: MapView; selectedNodeId: NodeId | null; onSelectNode: (id: NodeId) => void; onEnterNode: () => void })`
  - `PartyStatusSidebar({ members: MemberStatusView[]; footer?: ReactNode })`
  - `InfoOpportunityPanel({ view: InfoOpportunityView; selectedCardId: CardId | null; onSelectCard: (id: CardId) => void })`
  - `EventActions({ view: EventView; selectedChoiceId: ChoiceId | null; onSelectChoice: (id: ChoiceId) => void; onAdvance: () => void })`
  - `PartyReactionSidebar({ reactions: MemberReactionView[] })`

- [ ] **Step 1: `DungeonMapView`를 작성한다.**

Create `components/game/DungeonMapView.tsx`:

```tsx
import { Panel } from "@/components/ui/Panel";
import type { NodeId } from "@/lib/domain";
import type { MapNodeView, MapView } from "./expedition-view-model";

interface DungeonMapViewProps {
  view: MapView;
  selectedNodeId: NodeId | null;
  onSelectNode: (id: NodeId) => void;
  onEnterNode: () => void;
}

const NODE_STROKE: Record<MapNodeView["state"], string> = {
  current: "var(--color-parchment)",
  visited: "var(--color-trust-up)",
  selectable: "var(--color-trust-up)",
  inactive: "var(--color-edge)",
};

function stateMark(node: MapNodeView): string {
  if (node.state === "current") return "◎";
  if (node.state === "visited") return "✓";
  if (node.state === "selectable") return "→";
  return "×";
}

export function DungeonMapView({
  view,
  selectedNodeId,
  onSelectNode,
  onEnterNode,
}: DungeonMapViewProps) {
  const positionById = new Map(view.nodes.map((node) => [node.id, node]));

  return (
    <div className="grid gap-3 md:grid-cols-[200px_1fr]">
      <Panel title="범례">
        <ul className="flex flex-col gap-1 text-xs text-muted">
          <li>◎ 현재 위치</li>
          <li>✓ 방문 완료</li>
          <li>→ 선택 가능</li>
          <li>× 비활성</li>
          <li className="mt-2">! 몬스터 / 특수</li>
          <li>? 정보 전달 기회</li>
          <li>$ 상인 · + 휴식</li>
          <li className="mt-2">전체 연결·대략 위험·보스 위치 공개</li>
          <li>색 + 기호 + 선으로 구분</li>
        </ul>
      </Panel>
      <Panel title="다음 지점을 선택하세요 · 연결된 미방문 지점만 가능">
        <svg
          viewBox={`0 0 ${view.viewWidth} ${view.viewHeight + 60}`}
          className="w-full"
          role="group"
          aria-label="던전 분기 지도"
        >
          {view.edges.map((edge) => {
            const from = positionById.get(edge.fromId);
            const to = positionById.get(edge.toId);
            if (from === undefined || to === undefined) return null;
            return (
              <line
                key={`${edge.fromId}-${edge.toId}`}
                x1={from.x}
                y1={from.y + 30}
                x2={to.x}
                y2={to.y + 30}
                stroke="var(--color-edge)"
                strokeWidth={3}
              />
            );
          })}
          {view.nodes.map((node) => {
            const selected = node.id === selectedNodeId;
            const clickable = node.state === "selectable";
            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y + 30})`}
                onClick={clickable ? () => onSelectNode(node.id) : undefined}
                role={clickable ? "button" : undefined}
                aria-disabled={node.state === "inactive"}
                aria-pressed={selected}
                style={{ cursor: clickable ? "pointer" : "default" }}
              >
                <circle
                  r={26}
                  fill={selected ? "var(--color-edge)" : "var(--color-panel)"}
                  stroke={NODE_STROKE[node.state]}
                  strokeWidth={selected ? 4 : 2}
                  strokeDasharray={node.state === "inactive" ? "4 3" : undefined}
                />
                <text textAnchor="middle" y={-2} fontSize={11} fill="var(--color-parchment)">
                  {node.categoryLabel}
                </text>
                <text textAnchor="middle" y={14} fontSize={10} fill="var(--color-muted)">
                  {node.hasInfo ? "? " : ""}{stateMark(node)}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="mt-2 text-xs text-muted">{view.caption}</p>
        <button
          type="button"
          disabled={selectedNodeId === null}
          onClick={onEnterNode}
          className="mt-3 w-full rounded border border-edge px-3 py-2 text-sm text-parchment enabled:hover:bg-edge disabled:opacity-40"
        >
          선택 지점 입장 · 정보 기회 →
        </button>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: `PartyStatusSidebar`를 작성한다.**

Create `components/game/PartyStatusSidebar.tsx`:

```tsx
import type { ReactNode } from "react";
import { Panel } from "@/components/ui/Panel";
import type { MemberStatusView } from "./expedition-view-model";

interface PartyStatusSidebarProps {
  members: MemberStatusView[];
  footer?: ReactNode;
}

function trustDelta(delta: number): { text: string; className: string } | null {
  if (delta > 0) return { text: `▲${delta}`, className: "text-trust-up" };
  if (delta < 0) return { text: `▼${Math.abs(delta)}`, className: "text-trust-down" };
  return null;
}

export function PartyStatusSidebar({ members, footer }: PartyStatusSidebarProps) {
  return (
    <Panel title="개인 파티 상태">
      <ul className="flex flex-col gap-2">
        {members.map((member) => {
          const delta = trustDelta(member.trustDelta);
          return (
            <li key={member.memberId} className="rounded border border-edge px-3 py-2">
              <p className="text-sm text-parchment">
                {member.name}
                <span className="ml-1 text-xs text-muted">{member.className}</span>
              </p>
              <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
                <span>HP {member.currentHp} / {member.maxHp}</span>
                <span>
                  신뢰 {member.trust}
                  {delta === null ? null : (
                    <span className={`ml-1 ${delta.className}`}>
                      {delta.text}
                      <span className="sr-only">
                        {member.trustDelta > 0 ? " 신뢰 상승" : " 신뢰 하락"}
                      </span>
                    </span>
                  )}
                </span>
                <span>소지 {member.carriedGold}G</span>
              </p>
              <p className="mt-1 text-xs text-muted">{member.memoryNote}</p>
            </li>
          );
        })}
      </ul>
      {footer === undefined ? null : <div className="mt-3">{footer}</div>}
    </Panel>
  );
}
```

- [ ] **Step 3: `InfoOpportunityPanel`을 작성한다.**

Create `components/game/InfoOpportunityPanel.tsx`:

```tsx
import { Panel } from "@/components/ui/Panel";
import type { CardId } from "@/lib/domain";
import type { InfoOpportunityView } from "./expedition-view-model";

interface InfoOpportunityPanelProps {
  view: InfoOpportunityView;
  selectedCardId: CardId | null;
  onSelectCard: (id: CardId) => void;
}

export function InfoOpportunityPanel({
  view,
  selectedCardId,
  onSelectCard,
}: InfoOpportunityPanelProps) {
  return (
    <Panel title="정보 전달 · 관람 영역">
      <p className="text-sm text-parchment">{view.scene.sceneText}</p>
      <p className="mt-1 text-xs text-muted">
        파티: {view.scene.memberNames.map((member) => member.name).join(" · ")}
      </p>
      <p className="mt-1 text-xs text-trust-down">{view.scene.riskSummary}</p>

      <h3 className="mt-3 text-sm font-semibold text-muted">정보 카드 한 장</h3>
      <ul className="mt-2 grid gap-2 sm:grid-cols-3">
        {view.cards.map((card) => {
          const selected = card.cardId === selectedCardId;
          const border = card.dashed ? "border-dashed border-trust-down" : "border-edge";
          return (
            <li key={card.cardId}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelectCard(card.cardId)}
                className={`w-full rounded border px-3 py-2 text-left ${border} ${selected ? "bg-edge" : "hover:bg-edge"}`}
              >
                <p className="text-sm text-parchment">
                  {card.truthMark} {card.truthLabel} 카드
                </p>
                <p className="mt-1 text-xs text-parchment">“{card.text}”</p>
                <p className="mt-1 text-xs text-muted">{card.expectedNote}</p>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
```

- [ ] **Step 4: `EventActions`를 작성한다.**

Create `components/game/EventActions.tsx`:

```tsx
import { Panel } from "@/components/ui/Panel";
import type { ChoiceId } from "@/lib/domain";
import type { EventView } from "./expedition-view-model";

interface EventActionsProps {
  view: EventView;
  selectedChoiceId: ChoiceId | null;
  onSelectChoice: (id: ChoiceId) => void;
  onAdvance: () => void;
}

export function EventActions({
  view,
  selectedChoiceId,
  onSelectChoice,
  onAdvance,
}: EventActionsProps) {
  return (
    <Panel title={`사건 행동 · ${view.kindLabel}`}>
      <p className="text-sm text-parchment">{view.title}</p>
      <p className="mt-1 text-xs text-muted">{view.description}</p>
      <p className="mt-1 text-xs text-trust-down">{view.riskSummary}</p>

      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {view.choices.map((choice) => {
          const selected = choice.choiceId === selectedChoiceId;
          return (
            <li key={choice.choiceId}>
              <button
                type="button"
                disabled={choice.disabled}
                aria-pressed={selected}
                onClick={() => onSelectChoice(choice.choiceId)}
                className={`w-full rounded border px-3 py-2 text-left ${selected ? "border-trust-up bg-edge" : "border-edge"} enabled:hover:bg-edge disabled:opacity-40`}
              >
                <p className="text-sm text-parchment">{choice.label}</p>
                <p className="mt-1 text-xs text-muted">이득: {choice.expectedGain}</p>
                <p className="text-xs text-trust-down">위험: {choice.knownRisk}</p>
                {choice.disabledReason === null ? null : (
                  <p className="text-xs text-trust-down">× {choice.disabledReason}</p>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        disabled={selectedChoiceId === null}
        onClick={onAdvance}
        className="mt-3 w-full rounded border border-edge px-3 py-2 text-sm text-parchment enabled:hover:bg-edge disabled:opacity-40"
      >
        → 진행
      </button>
    </Panel>
  );
}
```

- [ ] **Step 5: `PartyReactionSidebar`를 작성한다.**

Create `components/game/PartyReactionSidebar.tsx`:

```tsx
import { Panel } from "@/components/ui/Panel";
import type { MemberReactionView } from "./expedition-view-model";

interface PartyReactionSidebarProps {
  reactions: MemberReactionView[];
}

export function PartyReactionSidebar({ reactions }: PartyReactionSidebarProps) {
  return (
    <Panel title="개인별 정보 반응">
      {reactions.length === 0 ? (
        <p className="text-sm text-muted">카드를 고르면 파티원별 반응이 나타납니다.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {reactions.map((reaction) => {
            const deltaText = reaction.trustDelta > 0
              ? `▲${reaction.trustDelta}`
              : reaction.trustDelta < 0
                ? `▼${Math.abs(reaction.trustDelta)}`
                : "변화 없음";
            return (
              <li key={reaction.memberId} className="rounded border border-edge px-3 py-2">
                <p className="text-sm text-parchment">
                  {reaction.name}
                  <span className="ml-1 text-xs text-muted">
                    {reaction.className} · {reaction.personalityLabel}
                  </span>
                </p>
                <p className="mt-1 text-xs text-parchment">
                  {reaction.reactionMark} {reaction.reactionLabel} · 신뢰 {reaction.trust} ({deltaText})
                </p>
                <p className="mt-1 text-xs text-muted">{reaction.note}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
```

- [ ] **Step 6: 타입·린트 검사가 통과하는지 확인한다.**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. import 경계 위반이 없고 타입이 맞는다. (표시 컴포넌트는 DOM 테스트 없음 — Global Constraints 참조.)

- [ ] **Step 7: 커밋한다.**

```bash
git add components/game/DungeonMapView.tsx components/game/PartyStatusSidebar.tsx components/game/InfoOpportunityPanel.tsx components/game/EventActions.tsx components/game/PartyReactionSidebar.tsx
git commit -m "화면: 지도·정보·사건·파티 표시 컴포넌트를 추가한다" -m "screen-02·03 구도로 SVG 지도, 정보 카드, 개인 반응, 사건 행동을 그리고 상태를 색 외 기호·테두리·aria로 구분한다."
```

---

### Task 4: 프리뷰 하네스와 전체 검증

**Files:**
- Create: `app/u2-test/u2-fixtures.ts`, `app/u2-test/page.tsx`
- Modify: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md` (U2 상태 갱신 — main 동기화 후, 컨트롤러가 finishing에서)

**Interfaces:**
- Consumes: `generateGradeMap` from `@/lib/rules/map`; `createInfoOpportunity`, `evaluatePartyInfoCard` from `@/lib/rules/info`; `resolveEventChoice` from `@/lib/rules/event`; `initializeCampaign` from `@/lib/rules/campaign-init`; `createRng` from `@/lib/rng`; `DUNGEON_EVENT_POOLS` from `@/lib/content/events`; `INFO_CARDS` from `@/lib/content/info-cards`; `ITEMS` from `@/lib/content/items`; the five components and view-model functions; `CampaignHeader` from `@/components/game/CampaignHeader`; `toCampaignHeaderView` from `@/components/game/campaign-view-model`.
- Produces: `u2Fixture(grade): { map, party, currentNodeId, eventById, eventKindById, cardById, itemById, headerView }` and a stable seed.

- [ ] **Step 1: fixture를 작성한다.**

Create `app/u2-test/u2-fixtures.ts`:

```ts
import { INFO_CARDS } from "@/lib/content/info-cards";
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
import { ITEMS } from "@/lib/content/items";
import { createRng } from "@/lib/rng";
import { generateGradeMap } from "@/lib/rules/map";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { toCampaignHeaderView } from "@/components/game/campaign-view-model";
import type {
  CampaignMember,
  CardId,
  DungeonEvent,
  EventId,
  EventKind,
  GeneratedMap,
  InfoCard,
  ItemDef,
  ItemId,
} from "@/lib/domain";
import type { CampaignHeaderView } from "@/components/game/campaign-view-model";

const ALL_EVENTS: DungeonEvent[] = [
  ...Object.values(DUNGEON_EVENT_POOLS.regular).flat(),
  ...DUNGEON_EVENT_POOLS.boss,
];

export interface U2Fixture {
  map: GeneratedMap;
  party: CampaignMember[];
  currentNodeId: GeneratedMap["entryNodeId"];
  headerView: CampaignHeaderView;
  eventById: (id: EventId) => DungeonEvent;
  eventKindById: (id: EventId) => EventKind;
  cardById: (id: CardId) => InfoCard;
  itemById: (id: ItemId) => ItemDef | undefined;
}

export function u2Fixture(grade: "C" | "B" | "A" | "S" = "C"): U2Fixture {
  const seed = `u2-demo-${grade}`;
  const campaign = initializeCampaign(seed);
  const firstParty = campaign.parties.find((candidate) => candidate.complete);
  const party = (firstParty?.memberIds ?? []).map(
    (memberId) => campaign.members.find((member) => member.id === memberId)!,
  );
  const map = generateGradeMap(grade, createRng(seed).derive("map"));

  const eventById = (id: EventId): DungeonEvent => {
    const found = ALL_EVENTS.find((event) => event.id === id);
    if (found === undefined) throw new Error(`no event ${id}`);
    return found;
  };
  const cardById = (id: CardId): InfoCard => {
    const found = INFO_CARDS.find((card) => card.id === id);
    if (found === undefined) throw new Error(`no card ${id}`);
    return found;
  };

  return {
    map,
    party,
    currentNodeId: map.entryNodeId,
    headerView: toCampaignHeaderView(campaign),
    eventById,
    eventKindById: (id) => eventById(id).kind,
    cardById,
    itemById: (id) => ITEMS.find((item) => item.id === id),
  };
}
```

- [ ] **Step 2: 하네스 페이지를 작성한다.**

Create `app/u2-test/page.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { CampaignHeader } from "@/components/game/CampaignHeader";
import { DungeonMapView } from "@/components/game/DungeonMapView";
import { EventActions } from "@/components/game/EventActions";
import { InfoOpportunityPanel } from "@/components/game/InfoOpportunityPanel";
import { PartyReactionSidebar } from "@/components/game/PartyReactionSidebar";
import { PartyStatusSidebar } from "@/components/game/PartyStatusSidebar";
import {
  toEventView,
  toInfoOpportunityView,
  toInfoReactionsView,
  toMapView,
  toPartyStatusView,
} from "@/components/game/expedition-view-model";
import { createRng } from "@/lib/rng";
import { createInfoOpportunity, evaluatePartyInfoCard } from "@/lib/rules/info";
import type { CardId, ChoiceId, NodeId } from "@/lib/domain";
import type { MemberReactionView } from "@/components/game/expedition-view-model";
import { u2Fixture } from "./u2-fixtures";

type Step = "map" | "info" | "event";

export default function U2TestPage() {
  const fx = useMemo(() => u2Fixture("C"), []);
  const [step, setStep] = useState<Step>("map");
  const [currentNodeId, setCurrentNodeId] = useState<NodeId>(fx.currentNodeId);
  const [visited, setVisited] = useState<NodeId[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<NodeId | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<CardId | null>(null);
  const [reactions, setReactions] = useState<MemberReactionView[]>([]);
  const [selectedChoiceId, setSelectedChoiceId] = useState<ChoiceId | null>(null);

  const activeNode = fx.map.nodes.find((node) => node.id === (selectedNodeId ?? currentNodeId))!;
  const event = fx.eventById(activeNode.eventId);

  const mapView = toMapView(fx.map, currentNodeId, visited, fx.eventKindById);
  const partyStatus = toPartyStatusView(fx.party);

  function enterNode() {
    if (selectedNodeId === null) return;
    setCurrentNodeId(selectedNodeId);
    const node = fx.map.nodes.find((candidate) => candidate.id === selectedNodeId)!;
    setSelectedCardId(null);
    setReactions([]);
    setSelectedChoiceId(null);
    setStep(node.hasInfoOpportunity ? "info" : "event");
  }

  function selectCard(cardId: CardId) {
    setSelectedCardId(cardId);
    const card = fx.cardById(cardId);
    const evaluation = evaluatePartyInfoCard({
      card,
      party: fx.party,
      cardRng: createRng(fx.map.grade).derive("card"),
      trustRng: createRng(fx.map.grade).derive("trust"),
    });
    setReactions(toInfoReactionsView(evaluation));
  }

  function advanceEvent() {
    if (selectedNodeId !== null) {
      setVisited((prev) => (prev.includes(selectedNodeId) ? prev : [...prev, selectedNodeId]));
    }
    setSelectedNodeId(null);
    setStep("map");
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-3 p-4 text-parchment">
      <CampaignHeader view={fx.headerView} />

      {step === "map" ? (
        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
          <DungeonMapView
            view={mapView}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onEnterNode={enterNode}
          />
          <PartyStatusSidebar members={partyStatus} />
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-3">
            {step === "info" && activeNode.hasInfoOpportunity ? (
              <InfoOpportunityPanel
                view={toInfoOpportunityView(
                  createInfoOpportunity({
                    node: activeNode,
                    eventKind: fx.eventKindById(activeNode.eventId),
                    rng: createRng(fx.map.grade).derive("card"),
                  }),
                  fx.cardById,
                  activeNode,
                  event,
                  fx.party,
                )}
                selectedCardId={selectedCardId}
                onSelectCard={selectCard}
              />
            ) : null}
            {step === "info" && selectedCardId !== null ? (
              <button
                type="button"
                onClick={() => setStep("event")}
                className="rounded border border-edge px-3 py-2 text-sm text-parchment hover:bg-edge"
              >
                정보 반응 완료 · 별도 사건 행동 →
              </button>
            ) : null}
            {step === "event" ? (
              <EventActions
                view={toEventView(event, fx.headerView.currentGold, fx.itemById)}
                selectedChoiceId={selectedChoiceId}
                onSelectChoice={setSelectedChoiceId}
                onAdvance={advanceEvent}
              />
            ) : null}
          </div>
          {step === "event"
            ? <PartyStatusSidebar members={partyStatus} />
            : <PartyReactionSidebar reactions={reactions} />}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 3: 전체 검증을 실행한다.**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: 넷 모두 PASS. `/u2-test` 라우트가 빌드에 포함되고 fixture가 모듈 로드 시 오류 없이 실행된다.

- [ ] **Step 4: 브라우저로 눈 확인한다.**

Run: `pnpm dev` 후 `http://localhost:3000/u2-test` 접속.
Expected: 지도가 입구 아래·보스 위로 그려지고 현재◎·선택가능→·비활성×가 구분된다. 선택 가능 노드를 고르고 입장하면, 정보 기회가 있는 노드는 카드 3종과 개인 반응을, 없는 노드는 바로 사건 행동을 보여준다. 사건 행동 선택 후 진행하면 지도로 돌아오고 그 노드가 방문 처리된다.

- [ ] **Step 5: 커밋한다.**

```bash
git add app/u2-test
git commit -m "화면: U2 지도·정보·사건 프리뷰 하네스를 추가한다" -m "실제 generateGradeMap·createInfoOpportunity·evaluatePartyInfoCard·resolveEventChoice로 지도→정보→사건 흐름을 라이브 스토어 없이 시연한다."
```

- [ ] **Step 6: (컨트롤러, main 동기화 후) 배정표 U2 상태를 갱신한다.**

작업 마지막에 `git fetch origin && git merge origin/main`으로 최신 main을 반영한 뒤 `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`에서 `U2` 행 상태를 `⬜`→`✅`, 담당 `LatteBun`으로 바꾸고, `U2`를 `선행`에 가진 행(`I1`)에서 `U2`를 지운다.

Run: `pnpm test docs/technical/PROTOTYPE_WORK_ASSIGNMENT.test.ts`
Expected: 무결성 검사 PASS.

```bash
git add docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md
git commit -m "문서: 배정표에서 U2 완료를 반영한다" -m "지도·정보·사건 화면 구현으로 U2를 완료 처리하고 I1 선행에서 U2를 지운다."
```

---

## 완료 검증 체크리스트

- [ ] `map-layout`이 등급별 좌표·간선을 정확히 만들고(입구 아래·보스 위), ID 규약 위반에 `RuleError`를 던진다.
- [ ] view-model 다섯 함수가 지도 상태·정보 카드·개인 반응·사건 행동·파티 상태를 정확히 조인한다.
- [ ] 지도 화면이 SVG 분기 그래프·범례·파티 상태·지점 선택/입장을 보여준다.
- [ ] 정보 화면이 사건 상황·공개 위험·진실/거짓/중립 카드와 카드 선택 후 개인 반응을 보여준다.
- [ ] 사건 행동을 정보와 분리해 콘텐츠 선택지로 고르고 진행한다.
- [ ] 정보 기회 없는 노드는 정보 단계를 건너뛴다.
- [ ] 상태·선택·반응이 색 외에 기호·테두리·`aria`로 구분된다.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`가 모두 통과한다.
- [ ] 구 단일 런 화면(`app/play/*`, `DungeonMap`·`SceneStage`·`ChoiceList`)과 스토어·상태 머신을 수정하지 않았다.

## 실행 시 검토 지점

- Task 1의 지도 좌표 불변식(입구 아래·보스 위, 갈래 대칭)과 Task 2의 노드 상태·거래 비활성 판정을 별도 리뷰 지점으로 둔다.
- Task 4의 fixture와 하네스가 `initializeCampaign`·`generateGradeMap` 출력 구조에 의존하므로, 규칙 구현이 바뀌면 fixture를 맞춘다.
- `evaluatePartyInfoCard`가 `PartyMember` 제네릭을 받는데 `CampaignMember`가 이를 만족하는지 Task 2 typecheck에서 확인한다. 만족하지 않으면 하네스에서 필요한 형태로 맞춰 넘긴다.
- 배정표 갱신(Task 4 Step 6)은 반드시 main 동기화 뒤에 한다.
