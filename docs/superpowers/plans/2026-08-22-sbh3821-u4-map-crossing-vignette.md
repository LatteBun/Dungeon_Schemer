# U4 Map Crossing and Vignette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the E1 dungeon topology while making U4 choose the globally minimum-crossing horizontal room order and render the vignette below corridors and rooms.

**Architecture:** Keep `GeneratedMap` and `generateDungeonMap` unchanged. Add a focused U4 row-order optimizer that enumerates at most 120 permutations per Depth and uses dynamic programming to minimize adjacent-layer edge crossings, then let the existing layout map that order onto its current fixed X/Y coordinates. Keep the vignette asset and opacity, but override its stacking depth in the final U4 correction stylesheet.

**Tech Stack:** TypeScript, React 19, Next.js 16, Vitest 4, CSS, headless Chrome/CDP

**Spec:** `docs/superpowers/specs/2026-08-22-sbh3821-u4-map-crossing-vignette-design.md`

## Global Constraints

- Do not modify `generateDungeonMap`, `MAP_TEMPLATES`, `GeneratedMap`, NodeIds, or any `nextNodeIds`.
- Preserve Entry at `(0.5, 0.88)`, Boss at `(0.5, 0.12)`, existing Depth Y positions, and the horizontal safe range `0.1...0.9`.
- A Depth contains at most 5 nodes, so exhaustive candidate generation must stay capped at `5! = 120` orders per row.
- The chosen row order must minimize the total number of straight-line crossings across all adjacent rows, not merely use a local heuristic.
- Equal-cost layouts must resolve deterministically by lower displacement from the original `layers[].nodeIds` order, then earlier candidate enumeration.
- Source- or target-sharing edges represent branching/merging and do not count as crossings.
- Keep vignette opacity `0.84`; only move it below corridors and rooms unless browser evidence requires a separate follow-up decision.
- Keep the fixed 1920×1080 canvas, 60:40 shell split, and no-scroll behavior at all four verification viewports.
- Do not push or create a PR without a separate user request.

---

### Task 1: Synchronize the U4 Branch with Latest Main

**Files:**
- Preserve: all files from commits `8237719`, `c64cf9e`, and `a50b4cb`
- Potential conflict resolution: `vitest.config.mts`
- Potential conflict resolution: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

**Interfaces:**
- Consumes: local branch `feature/u4-completion`, remote base `origin/main`
- Produces: a clean feature branch containing latest main plus the three committed U4 changes

- [ ] **Step 1: Confirm the branch and committed worktree state**

Run:

```bash
git status --short --branch
git log -3 --oneline
```

Expected: branch is `feature/u4-completion`, worktree has only this plan file as an intentional change, and the latest committed design is `a50b4cb`.

- [ ] **Step 2: Commit this implementation plan before synchronization**

Run:

```bash
git add docs/superpowers/plans/2026-08-22-sbh3821-u4-map-crossing-vignette.md
git diff --cached --check
git commit -m "문서: U4 지도 교차 최소화 구현 계획을 기록한다"
```

Expected: one documentation commit and a clean worktree.

- [ ] **Step 3: Fetch and merge latest main without rewriting U4 commits**

Run:

```bash
git fetch origin
git merge --no-edit origin/main
```

Expected: merge succeeds. If Git reports conflicts, preserve both sides according to these exact rules:

- `vitest.config.mts`: retain `include: ["**/*.test.{ts,tsx}"]` and incorporate every non-conflicting main-side test setting.
- `CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`: retain main's E3/I2 changes and the U4 owner/status/completion note from `8237719`.
- U4 CSS/layout files: retain the U4 feature-branch changes unless main contains a newer intentional U4 behavior rather than an unchanged base copy.

After resolving only reported conflicts, run:

```bash
git add -u
git commit --no-edit
```

- [ ] **Step 4: Refresh dependencies and verify the merged baseline**

Run:

```bash
pnpm install --frozen-lockfile
pnpm test
git status --short --branch
```

Expected: all tests pass and the worktree is clean before feature implementation.

---

### Task 2: Build the Deterministic Global Row-Order Optimizer

**Files:**
- Create: `components/game/u4-dungeon-map-order.ts`
- Create: `components/game/u4-dungeon-map-order.test.ts`

**Interfaces:**
- Consumes: `GeneratedMap`, `NodeId` from `@/lib/domain`
- Produces: `createU4OptimizedLayerOrder(map: GeneratedMap): U4OptimizedLayerOrder`
- Produces: `countU4LayerCrossings(map: GeneratedMap, rows: readonly (readonly NodeId[])[]): number`
- Produces type:

```ts
export interface U4OptimizedLayerOrder {
  readonly rows: readonly (readonly NodeId[])[];
  readonly crossingCount: number;
}
```

- [ ] **Step 1: Write failing tests for zeroable crossings, determinism, and topology preservation**

Create `components/game/u4-dungeon-map-order.test.ts` with a two-by-two crossing fixture and assertions shaped as follows:

```ts
import { describe, expect, it } from "vitest";
import type { GeneratedMap, NodeId } from "@/lib/domain";
import {
  countU4LayerCrossings,
  createU4OptimizedLayerOrder,
} from "./u4-dungeon-map-order";

const id = (value: string) => value as NodeId;
const ENTRY = id("entry");
const A = id("a");
const B = id("b");
const C = id("c");
const D = id("d");
const BOSS = id("boss");

const CROSSING_MAP: GeneratedMap = {
  entryNodeId: ENTRY,
  bossNodeId: BOSS,
  layers: [
    { depth: 1, nodeIds: [A, B] },
    { depth: 2, nodeIds: [C, D] },
  ],
  nodes: [
    { id: ENTRY, kind: "entry", nextNodeIds: [A, B] },
    { id: A, kind: "normal", nextNodeIds: [D] },
    { id: B, kind: "normal", nextNodeIds: [C] },
    { id: C, kind: "normal", nextNodeIds: [BOSS] },
    { id: D, kind: "normal", nextNodeIds: [BOSS] },
    { id: BOSS, kind: "boss", nextNodeIds: [] },
  ],
};

describe("U4 global layer ordering", () => {
  it("removes crossings when a zero-crossing row order exists", () => {
    const originalRows = [
      [ENTRY],
      [A, B],
      [C, D],
      [BOSS],
    ] as const;
    expect(countU4LayerCrossings(CROSSING_MAP, originalRows)).toBe(1);

    const optimized = createU4OptimizedLayerOrder(CROSSING_MAP);
    expect(optimized.crossingCount).toBe(0);
    expect(countU4LayerCrossings(CROSSING_MAP, optimized.rows)).toBe(0);
  });

  it("returns the same minimum order for the same map", () => {
    expect(createU4OptimizedLayerOrder(CROSSING_MAP)).toEqual(
      createU4OptimizedLayerOrder(CROSSING_MAP),
    );
  });

  it("keeps every row member exactly once", () => {
    const optimized = createU4OptimizedLayerOrder(CROSSING_MAP);
    expect(optimized.rows.map((row) => [...row].sort())).toEqual([
      [ENTRY],
      [A, B].sort(),
      [C, D].sort(),
      [BOSS],
    ]);
  });
});
```

The production change that makes these tests pass is the new exact optimizer; a greedy or original-order layout must fail the first test.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm test components/game/u4-dungeon-map-order.test.ts
```

Expected: FAIL because `./u4-dungeon-map-order` does not exist.

- [ ] **Step 3: Implement deterministic permutations and crossing cost**

Create `components/game/u4-dungeon-map-order.ts` with these exact public boundaries and internal scoring rules:

```ts
import type { GeneratedMap, NodeId } from "@/lib/domain";

export interface U4OptimizedLayerOrder {
  readonly rows: readonly (readonly NodeId[])[];
  readonly crossingCount: number;
}

interface Score {
  crossings: number;
  displacement: number;
}

interface State extends Score {
  previousOrderIndex: number | null;
}

function rowsForMap(map: GeneratedMap): readonly (readonly NodeId[])[] {
  return [
    [map.entryNodeId],
    ...map.layers.map((layer) => [...layer.nodeIds]),
    [map.bossNodeId],
  ];
}

function permutations<T>(values: readonly T[]): readonly (readonly T[])[] {
  if (values.length <= 1) return [[...values]];
  const result: T[][] = [];
  values.forEach((value, index) => {
    const rest = [...values.slice(0, index), ...values.slice(index + 1)];
    for (const suffix of permutations(rest)) result.push([value, ...suffix]);
  });
  return result;
}

function rowDisplacement(
  original: readonly NodeId[],
  candidate: readonly NodeId[],
): number {
  const originalIndex = new Map(original.map((nodeId, index) => [nodeId, index]));
  return candidate.reduce(
    (total, nodeId, index) => total + Math.abs(index - originalIndex.get(nodeId)!),
    0,
  );
}

function better(left: Score, right: Score): boolean {
  return (
    left.crossings < right.crossings ||
    (left.crossings === right.crossings &&
      left.displacement < right.displacement)
  );
}
```

Implement `countCrossingsBetween(map, sourceOrder, targetOrder)` by collecting only edges whose source is in `sourceOrder` and target is in `targetOrder`. Count a pair only when source IDs differ, target IDs differ, and `(sourceA - sourceB) * (targetA - targetB) < 0`.

Implement `countU4LayerCrossings` by summing `countCrossingsBetween` for every adjacent row pair. Throw an explicit error if `rows.length !== map.layers.length + 2` or a row does not contain exactly the expected NodeIds.

- [ ] **Step 4: Implement the exact dynamic program**

Use the deterministic candidate order returned by `permutations` and this transition shape:

```ts
const originalRows = rowsForMap(map);
const candidates = originalRows.map((row) => permutations(row));
const states: State[][] = candidates.map(() => []);

states[0] = [{ crossings: 0, displacement: 0, previousOrderIndex: null }];

for (let rowIndex = 1; rowIndex < candidates.length; rowIndex += 1) {
  states[rowIndex] = candidates[rowIndex]!.map((candidate) => {
    let best: State | null = null;
    candidates[rowIndex - 1]!.forEach((previous, previousOrderIndex) => {
      const previousState = states[rowIndex - 1]![previousOrderIndex]!;
      const score: State = {
        crossings:
          previousState.crossings +
          countCrossingsBetween(map, previous, candidate),
        displacement:
          previousState.displacement +
          rowDisplacement(originalRows[rowIndex]!, candidate),
        previousOrderIndex,
      };
      if (best === null || better(score, best)) best = score;
    });
    if (best === null) throw new Error("U4 최적 행 순서를 계산하지 못했습니다.");
    return best;
  });
}
```

Choose the first final candidate with the best `(crossings, displacement)` score, then walk `previousOrderIndex` backward to reconstruct `rows`. Because equal scores do not replace an existing best state, candidate enumeration is the final deterministic tie-breaker.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
pnpm test components/game/u4-dungeon-map-order.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit the optimizer**

Run:

```bash
git add components/game/u4-dungeon-map-order.ts components/game/u4-dungeon-map-order.test.ts
git commit -m "기능: U4 지도 행 순서를 전역 최적화한다"
```

---

### Task 3: Integrate the Optimized Order into U4 Coordinates

**Files:**
- Modify: `components/game/u4-dungeon-map-layout.ts`
- Modify: `components/game/u4-dungeon-map-layout.test.ts`
- Modify: `components/game/u4-preview-data.test.ts`

**Interfaces:**
- Consumes: `createU4OptimizedLayerOrder(map)` from Task 2
- Produces: existing `createU4DungeonMapLayout(map: GeneratedMap): U4MapLayout` with optimized X ordering and unchanged public shape

- [ ] **Step 1: Add a failing layout test that compares original and rendered crossings**

Extend `u4-dungeon-map-layout.test.ts` with an explicit reversed-edge fixture so the pre-optimization layout necessarily has one crossing:

```ts
import {
  countU4LayerCrossings,
  createU4OptimizedLayerOrder,
} from "./u4-dungeon-map-order";

const CROSS_ENTRY = id("cross-entry");
const CROSS_A = id("cross-a");
const CROSS_B = id("cross-b");
const CROSS_C = id("cross-c");
const CROSS_D = id("cross-d");
const CROSS_BOSS = id("cross-boss");

const CROSSING_MAP: GeneratedMap = {
  entryNodeId: CROSS_ENTRY,
  bossNodeId: CROSS_BOSS,
  layers: [
    { depth: 1, nodeIds: [CROSS_A, CROSS_B] },
    { depth: 2, nodeIds: [CROSS_C, CROSS_D] },
  ],
  nodes: [
    {
      id: CROSS_ENTRY,
      kind: "entry",
      nextNodeIds: [CROSS_A, CROSS_B],
    },
    { id: CROSS_A, kind: "normal", nextNodeIds: [CROSS_D] },
    { id: CROSS_B, kind: "normal", nextNodeIds: [CROSS_C] },
    { id: CROSS_C, kind: "normal", nextNodeIds: [CROSS_BOSS] },
    { id: CROSS_D, kind: "normal", nextNodeIds: [CROSS_BOSS] },
    { id: CROSS_BOSS, kind: "boss", nextNodeIds: [] },
  ],
};

it("uses the global minimum-crossing row order for room coordinates", () => {
  const originalRows = [
    [CROSS_ENTRY],
    [CROSS_A, CROSS_B],
    [CROSS_C, CROSS_D],
    [CROSS_BOSS],
  ] as const;
  const optimized = createU4OptimizedLayerOrder(CROSSING_MAP);
  const layout = createU4DungeonMapLayout(CROSSING_MAP);
  const rowIds = [
    [CROSS_ENTRY],
    ...CROSSING_MAP.layers.map((layer) =>
      [...layer.nodeIds].sort(
        (left, right) =>
          layout.nodePositions[left]!.x - layout.nodePositions[right]!.x,
      ),
    ),
    [CROSS_BOSS],
  ];

  expect(countU4LayerCrossings(CROSSING_MAP, originalRows)).toBe(1);
  expect(optimized.crossingCount).toBe(0);
  expect(countU4LayerCrossings(CROSSING_MAP, rowIds)).toBe(0);
});
```

Also retain the existing four-decimal geometry test from commit `8237719`; hydration-safe rounding is not optional.

- [ ] **Step 2: Run the layout test and verify RED**

Run:

```bash
pnpm test components/game/u4-dungeon-map-layout.test.ts
```

Expected: FAIL because the layout still assigns X positions by original `layer.nodeIds` order.

- [ ] **Step 3: Assign coordinates from optimized rows**

Modify `createU4DungeonMapLayout` to use rows 1 through N from the optimizer:

```ts
import { createU4OptimizedLayerOrder } from "./u4-dungeon-map-order";

export function createU4DungeonMapLayout(map: GeneratedMap): U4MapLayout {
  const positions: Partial<Record<NodeId, U4Point>> = {
    [map.entryNodeId]: ENTRY_POSITION,
    [map.bossNodeId]: BOSS_POSITION,
  };
  const optimized = createU4OptimizedLayerOrder(map);

  map.layers.forEach((layer, layerIndex) => {
    const orderedNodeIds = optimized.rows[layerIndex + 1]!;
    const xs = xPositions(layer.nodeIds.length);
    const y = depthY(layerIndex, map.layers.length);
    orderedNodeIds.forEach((nodeId, nodeIndex) => {
      positions[nodeId] = renderPoint(xs[nodeIndex]!, y);
    });
  });

  // Keep the existing corridor construction unchanged so every E1 edge remains.
```

Do not alter `map.layers`, `map.nodes`, or any `nextNodeIds` in place.

- [ ] **Step 4: Add an actual preview regression**

Extend `u4-preview-data.test.ts`:

```ts
import { countU4LayerCrossings } from "./u4-dungeon-map-order";

it("renders the actual risk-3 preview with fewer crossings than original row order", () => {
  const preview = createU4PreviewData({ deadPreview: false });
  const originalRows = [
    [preview.map.entryNodeId],
    ...preview.map.layers.map((layer) => layer.nodeIds),
    [preview.map.bossNodeId],
  ];
  const renderedRows = [
    [preview.map.entryNodeId],
    ...preview.map.layers.map((layer) =>
      [...layer.nodeIds].sort(
        (left, right) =>
          preview.layout.nodePositions[left]!.x -
          preview.layout.nodePositions[right]!.x,
      ),
    ),
    [preview.map.bossNodeId],
  ];

  expect(countU4LayerCrossings(preview.map, renderedRows)).toBeLessThan(
    countU4LayerCrossings(preview.map, originalRows),
  );
});
```

- [ ] **Step 5: Run U4 layout and preview tests**

Run:

```bash
pnpm test components/game/u4-dungeon-map-order.test.ts components/game/u4-dungeon-map-layout.test.ts components/game/u4-preview-data.test.ts
```

Expected: all focused tests pass, existing edge preservation and geometry normalization tests remain green.

- [ ] **Step 6: Commit layout integration**

Run:

```bash
git add components/game/u4-dungeon-map-layout.ts components/game/u4-dungeon-map-layout.test.ts components/game/u4-preview-data.test.ts
git commit -m "수정: U4 지도 통로 교차를 최소화한다"
```

---

### Task 4: Move the Vignette Below Information Layers

**Files:**
- Modify: `app/u4-dungeon-map-fixes.css`
- Modify: `components/game/U4FixedCanvas.test.ts`

**Interfaces:**
- Consumes: existing `.u4-map-surface__vignette`, `.u4-map-surface__corridors`, and `.u4-map-surface__rooms` classes
- Produces: effective stacking order `vignette 2 < corridors 3 < rooms 6`

- [ ] **Step 1: Add a failing stacking-depth contract test**

Reuse the existing `numericDeclaration` test helper and add:

```ts
it("keeps the vignette below corridors and rooms", () => {
  const base = readFileSync("app/u4-dungeon-map.css", "utf8");
  const fixes = readFileSync("app/u4-dungeon-map-fixes.css", "utf8");
  const vignette = numericDeclaration(
    fixes,
    ".u4-map-surface__vignette",
    "z-index",
  );
  const corridors = numericDeclaration(
    base,
    ".u4-map-surface__corridors",
    "z-index",
  );
  const rooms = numericDeclaration(
    base,
    ".u4-map-surface__rooms",
    "z-index",
  );

  expect(vignette).toBe(2);
  expect(vignette).toBeLessThan(corridors);
  expect(corridors).toBeLessThan(rooms);
});
```

The test must read the correction layer for vignette because that stylesheet loads after the base U4 CSS.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm test components/game/U4FixedCanvas.test.ts
```

Expected: FAIL because `.u4-map-surface__vignette` has no correction-layer `z-index` declaration.

- [ ] **Step 3: Add the minimal correction-layer override**

Add near the map surface rules in `app/u4-dungeon-map-fixes.css`:

```css
/* Keep atmospheric edge darkening on the map background, below topology. */
.u4-map-surface__vignette {
  z-index: 2;
}
```

Do not change opacity `0.84` in this task.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
pnpm test components/game/U4FixedCanvas.test.ts
```

Expected: all U4 fixed canvas tests pass.

- [ ] **Step 5: Commit the stacking fix**

Run:

```bash
git add app/u4-dungeon-map-fixes.css components/game/U4FixedCanvas.test.ts
git commit -m "수정: U4 비네팅을 지도 정보 아래로 내린다"
```

---

### Task 5: Align the U4 Experience Documentation

**Files:**
- Modify: `docs/experience/U4_DUNGEON_MAP.md`

**Interfaces:**
- Consumes: approved spec and implemented optimizer behavior
- Produces: official U4 documentation that no longer says crossing reduction is out of scope

- [ ] **Step 1: Replace the obsolete layout statement**

In the Depth layout section, replace:

```text
U4는 GeneratedMap.layers[].nodeIds 순서를 기본 x-order로 사용한다.
화면 crossing 감소를 위한 재정렬은 이번 범위에서 하지 않는다.
```

with:

```text
U4는 E1의 NodeId와 nextNodeIds를 바꾸지 않고, 각 Depth의 좌우 순서만
결정적으로 재배치한다. Depth별 가능한 순서를 비교해 직선 통로의 전체 교차
수가 가장 작은 조합을 선택하며, 같은 최소값에서는 원래 nodeIds 순서와의
위치 차이가 작은 조합을 우선한다.
```

- [ ] **Step 2: Document the vignette information-layer boundary**

Add to the map layer description:

```text
비네팅은 배경과 atmosphere 위, corridor와 room 아래에서만 합성한다.
따라서 가장자리 암부는 유지하되 길과 방의 상태 표현을 덮지 않는다.
```

- [ ] **Step 3: Run documentation integrity tests**

Run:

```bash
pnpm test components/game/DocumentationIntegrity.test.ts components/game/U4FixedCanvas.test.ts
```

If `DocumentationIntegrity.test.ts` is not present after merging main, run `pnpm test` instead. Expected: all selected tests pass.

- [ ] **Step 4: Commit documentation alignment**

Run:

```bash
git add docs/experience/U4_DUNGEON_MAP.md
git commit -m "문서: U4 지도 배치와 비네팅 책임을 갱신한다"
```

---

### Task 6: Full Verification and Browser Handoff

**Files:**
- Verify: all changed production, test, spec, plan, and experience documentation files
- Capture: `/private/tmp/ds-u4-optimized-1920x1080.png`
- Capture: `/private/tmp/ds-u4-optimized-2560x1440.png`
- Capture: `/private/tmp/ds-u4-optimized-1440x900.png`
- Capture: `/private/tmp/ds-u4-optimized-1280x1024.png`

**Interfaces:**
- Consumes: completed Tasks 1–5
- Produces: verified branch, running local preview URL, four visual captures, no automatic push/PR

- [ ] **Step 1: Run the complete automated verification suite**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build --webpack
git diff --check
git status --short --branch
```

Expected:

- lint exits 0; report existing warnings separately from errors.
- typecheck exits 0.
- every Vitest file and test passes.
- Next production build exits 0 and includes `/u4-test`.
- no whitespace errors or uncommitted source changes remain.

- [ ] **Step 2: Start a clean production preview after the final build**

Stop any server previously launched from this worktree before rebuilding or reusing its port. Then run:

```bash
pnpm start -p 3201
```

Verify both HTML and its referenced stylesheet return 200. If port 3201 is occupied by a stale process that cannot be stopped safely, use 3202 and report the actual port.

- [ ] **Step 3: Capture and inspect all four fixed-canvas viewports**

Use headless Chrome/CDP only after `document.fonts.ready` and every image has loaded. Capture:

```text
1920×1080 -> /private/tmp/ds-u4-optimized-1920x1080.png
2560×1440 -> /private/tmp/ds-u4-optimized-2560x1440.png
1440×900  -> /private/tmp/ds-u4-optimized-1440x900.png
1280×1024 -> /private/tmp/ds-u4-optimized-1280x1024.png
```

For every viewport verify:

- document scroll size equals viewport size.
- no hydration or runtime error is logged.
- corridors and rooms render above the vignette.
- current and selectable state highlights remain distinct.
- path crossings match the optimized layout and are visibly reduced.
- no map, party panel, destination panel, or CTA clipping occurs.

- [ ] **Step 4: Report the result without integrating the branch**

Provide:

- local `/u4-test` URL using the actual running port.
- clickable 1920×1080 screenshot path.
- before/after crossing counts from automated tests.
- final test/build counts and lint warning count.
- latest commit hashes.
- confirmation that E1 generation and branch count were not changed.

Do not push, create a PR, merge, or remove the worktree until the user chooses an integration action.
