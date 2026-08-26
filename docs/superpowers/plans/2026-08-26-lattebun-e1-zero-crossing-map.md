# E1 지도 경로 교차 0 보장 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** E1이 zero-crossing 가능한 topology만 생성하고 U4가 동일한 exact solver와 실제 corridor 중심선 fallback으로 이를 화면에 안전하게 표현한다.

**Architecture:** 순수한 `lib/rules/layered-map-crossing.ts`가 rows와 인접 행 edges를 검증하고, 정확한 DP 최소 crossing/최적 순서를 계산한다. E1은 이 solver 한 인스턴스로 optional edge를 greedy하게 필터하고 진단을 반환하며, U4 adapter는 `GeneratedMap`을 같은 solver 입력으로 변환한다. U4 layout은 렌더에 쓰는 정규화 좌표의 non-shared closed-segment 교차를 검사하고 필요할 때만 일반 노드의 Y wobble을 제거한다.

**Tech Stack:** TypeScript 5, Vitest 4, Next.js 16, React 19

**Spec:** `docs/superpowers/specs/2026-08-26-lattebun-e1-zero-crossing-map-design.md`

## Global Constraints

- `GeneratedMap`, `MAP_TEMPLATES`, Store, 저장 데이터, E3 topology 소비 방식은 변경하지 않는다.
- 모든 generated map은 exact minimum logical crossing `0`이어야 한다.
- Entry/Boss, 기본 연결, 폭/차수/도달성/동일 path length, 25% RNG gate, 후보 shuffle, attempt 결정성을 유지한다.
- optional edge는 degree/RNG/zero-crossing 순서로만 채택하며, crossing 거절은 차수를 소비하지 않는다.
- 공용 solver는 잘못된 rows/edges를 `RuleError("INVALID_GENERATION")`으로 거부하고 UI를 import하지 않는다.
- 공용 solver는 각 행의 순열/displacement를 한 번만 만들고, solve마다 row-pair edge를 한 번만 분류한다.
- U4는 Entry `(0.5, 0.88)`, Boss `(0.5, 0.12)`, X safe range `0.1...0.9`, X wobble/room variation을 유지한다.
- 기하 교차는 4자리 렌더 좌표를 `10_000` 배 정수화한 closed segment 기준이며, endpoint NodeId를 공유하는 corridor 쌍은 제외한다.
- fallback 후 기하 교차가 남으면 `U4MapLayoutError`를 던지고 재생성·좌표 재추첨·사용자 복구 UI를 추가하지 않는다.
- 고정 회귀 행렬은 `e1-zero-crossing-00`부터 `e1-zero-crossing-19`, `dungeonId: e1-zero-crossing-risk-{riskLevel}`, 위험도 1~5, attempt 0~2다.
- 공식 문서 `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`와 `docs/experience/U4_DUNGEON_MAP.md`를 같은 변경에 갱신한다.
- 커밋 제목과 본문은 한국어로 작성한다. PR 생성은 하지 않고 기존 PR #204만 갱신한다.

---

### Task 1: 공용 exact layered crossing solver

**Files:**

- Create: `lib/rules/layered-map-crossing.ts`
- Create: `lib/rules/layered-map-crossing.test.ts`

**Interfaces:**

```ts
export interface LayeredEdge {
  readonly from: NodeId;
  readonly to: NodeId;
}

export interface LayeredOrderResult {
  readonly rows: readonly (readonly NodeId[])[];
  readonly crossingCount: number;
}

export interface LayeredOrderSolver {
  solve(edges: readonly LayeredEdge[]): LayeredOrderResult;
}

export function createLayeredOrderSolver(
  rows: readonly (readonly NodeId[])[],
): LayeredOrderSolver;
```

- [ ] **Step 1: solver fixture와 실패 계약을 먼저 작성한다.**

`lib/rules/layered-map-crossing.test.ts`에 `entry / [a,b] / [c,d] / boss` rows를 만들고 다음을 테스트한다.

```ts
const solver = createLayeredOrderSolver([[ENTRY], [A, B], [C, D], [BOSS]]);

expect(solver.solve([
  { from: ENTRY, to: A }, { from: ENTRY, to: B },
  { from: A, to: D }, { from: B, to: C },
  { from: C, to: BOSS }, { from: D, to: BOSS },
]).crossingCount).toBe(0);

expect(() => createLayeredOrderSolver([[A, A]])).toThrowError(
  expect.objectContaining({ code: "INVALID_GENERATION" }),
);
expect(() => solver.solve([{ from: A, to: BOSS }])).toThrowError(
  expect.objectContaining({ code: "INVALID_GENERATION" }),
);
```

동일 rows/edges 결정성, safe edge `A->D`, unavoidable K2,2, shared source/target, 빈 행/폭 6/행 간 중복/unknown endpoint/reversed/skipped/self/duplicate edge도 각각 넣는다.

- [ ] **Step 2: 집중 테스트가 새 module 부재로 실패하는지 확인한다.**

Run: `pnpm exec vitest run lib/rules/layered-map-crossing.test.ts`

Expected: module을 찾지 못해 실패한다.

- [ ] **Step 3: 순수 solver를 구현한다.**

`createLayeredOrderSolver`에서 row membership/row index, 모든 순열, 원래 순서 기준 displacement를 캐시한다. `solve`에서 edges를 검증하고 row pair별 `LayeredEdge[]`로 분류한 뒤, 인접 row 순열 조합의 crossing 비용과 DP state를 계산한다.

```ts
function better(left: Score, right: Score): boolean {
  return left.crossings < right.crossings ||
    (left.crossings === right.crossings && left.displacement < right.displacement);
}

function crosses(a: IndexedEdge, b: IndexedEdge): boolean {
  return a.from !== b.from && a.to !== b.to &&
    (a.sourceIndex - b.sourceIndex) * (a.targetIndex - b.targetIndex) < 0;
}
```

동점은 더 낮은 displacement, 그 다음 순열 생성 순서로 해결한다. 유효하지만 미완성인 edge 집합은 허용하되, 구조/차수/도달성은 solver가 검사하지 않는다.

- [ ] **Step 4: focused solver 테스트를 실행한다.**

Run: `pnpm exec vitest run lib/rules/layered-map-crossing.test.ts`

Expected: 모든 solver fixture가 통과한다.

- [ ] **Step 5: solver 변경을 커밋한다.**

```bash
git add lib/rules/layered-map-crossing.ts lib/rules/layered-map-crossing.test.ts
git diff --cached --check
git commit -m "규칙: 공용 레이어 교차 계산기를 추가한다" -m "행과 간선을 검증하고 정확한 최소 교차 순서를 계산한다."
```

### Task 2: E1 optional edge 필터·진단·validator

**Files:**

- Modify: `lib/rules/dungeon-map.ts`
- Modify: `lib/rules/dungeon-map.test.ts`

**Interfaces:**

```ts
export interface DungeonMapGenerationDiagnostics {
  readonly baseEdgeCount: number;
  readonly evaluatedOptionalCandidateCount: number;
  readonly acceptedOptionalEdgeCount: number;
  readonly rejectedForCrossingCount: number;
  readonly maximumRowCandidateCount: number;
}

export interface DungeonMapGenerationResult {
  readonly map: GeneratedMap;
  readonly diagnostics: DungeonMapGenerationDiagnostics;
}

export function generateDungeonMapWithDiagnostics(
  input: GenerateDungeonMapInput,
): DungeonMapGenerationResult;

export function generateDungeonMap(input: GenerateDungeonMapInput): GeneratedMap;
```

- [ ] **Step 1: E1 집중 실패 테스트를 추가한다.**

`dungeon-map.test.ts`에서 공용 solver로 manual unavoidable-crossing `GeneratedMap`을 검증해 `minimumCrossingCount`가 든 `INVALID_GENERATION`을 기대한다. 또한 deterministic generator seam으로 다음을 검증한다.

```ts
const result = generateDungeonMapWithDiagnostics(INPUT);
expect(result.map).toEqual(generateDungeonMap(INPUT));
expect(result.diagnostics.acceptedOptionalEdgeCount).toBeGreaterThanOrEqual(0);
expect(result.diagnostics.baseEdgeCount).toBe(
  result.map.nodes.reduce((sum, node) => sum + node.nextNodeIds.length, 0)
    - result.diagnostics.acceptedOptionalEdgeCount,
);
```

후보/RNG callback을 주입하는 module-local named test seam으로 safe candidate는 채택되고 K2,2를 완성하는 candidate는 거절되며 거절 뒤 source/target 차수가 그대로인 fixture도 작성한다.

- [ ] **Step 2: 새 테스트가 API 부재 또는 validator 미검증으로 실패하는지 확인한다.**

Run: `pnpm exec vitest run lib/rules/dungeon-map.test.ts`

Expected: diagnostics API와 zero-crossing validator assertion 때문에 실패한다.

- [ ] **Step 3: E1 생성 경계를 구현한다.**

모든 Entry/normal/Boss 기본 간선을 먼저 만들고 rows solver를 한 번 생성한다. outgoing/incoming `Map<NodeId, number>`을 유지하고, candidate가 duplicate/degree/RNG를 통과할 때만 trial edge snapshot을 solver에 건넨다.

```ts
if (!hasDegreeCapacity(candidate) || !passesRandomGate()) continue;
diagnostics.evaluatedOptionalCandidateCount += 1;
if (solver.solve(edgesWith(candidate)).crossingCount !== 0) {
  diagnostics.rejectedForCrossingCount += 1;
  continue;
}
addAcceptedEdge(candidate);
diagnostics.acceptedOptionalEdgeCount += 1;
```

`validateGeneratedMap`은 기존 구조 검증이 끝난 뒤 공용 solver를 사용해 crossing `0`을 강제하고, 실패 details에 `minimumCrossingCount`를 넣는다. 기존 public generator는 diagnostics generator의 `map`만 반환한다.

- [ ] **Step 4: 고정 300-map 회귀와 E3 회귀를 추가·실행한다.**

고정 20 seeds × 5 risks × 3 attempts에서 validator, crossing 0, reachability, degree, 결정성, optional-edge 진단 산식을 검사한다. `expedition-events.test.ts`를 함께 실행해 monster minimum, bossInfo cut, strong link, materialization이 그대로인지 확인한다.

Run: `pnpm exec vitest run lib/rules/dungeon-map.test.ts lib/rules/expedition-events.test.ts`

Expected: E1 구조·진단·300-map·E3 테스트가 모두 통과한다.

- [ ] **Step 5: E1 변경을 커밋한다.**

```bash
git add lib/rules/dungeon-map.ts lib/rules/dungeon-map.test.ts
git diff --cached --check
git commit -m "규칙: 교차 없는 던전 지도를 생성한다" -m "선택 간선을 exact solver로 필터하고 생성 진단을 제공한다."
```

### Task 3: U4 adapter와 실제 corridor fallback

**Files:**

- Modify: `components/game/u4-dungeon-map-order.ts`
- Modify: `components/game/u4-dungeon-map-order.test.ts`
- Modify: `components/game/u4-dungeon-map-layout.ts`
- Modify: `components/game/u4-dungeon-map-layout.test.ts`
- Modify: `components/game/u4-preview-data.test.ts`

**Interfaces:**

```ts
export interface U4OptimizedLayerOrder {
  readonly rows: readonly (readonly NodeId[])[];
  readonly crossingCount: number;
}

export class U4MapLayoutError extends Error {
  readonly geometricCrossingCount: number;
}

export function countU4GeometricCrossings(
  corridors: readonly U4CorridorLayout[],
): number;
```

- [ ] **Step 1: U4 adapter와 geometry 테스트를 먼저 갱신한다.**

기존 logical crossing fixture는 공용 solver를 통한 0 결과를 기대하도록 유지한다. manual `U4CorridorLayout[]` fixture로 proper intersection, endpoint touch, collinear overlap은 1 이상이며 shared endpoint `A->B`/`B->C`와 shared branch/merge는 0임을 검증한다.

layout fixture는 generated E1 map의 `optimized.crossingCount === 0`, 실제 layout corridor crossing 0, 모든 E1 edge 단 한 번, X safe range/Entry/Boss/room variation을 검증한다. 일반 노드 Y를 강제로 깊이 행에 맞춘 test helper fixture에서 fallback geometry 0도 검증하고, fallback 뒤에도 교차하도록 만든 manual layout fixture는 `U4MapLayoutError`와 `geometricCrossingCount`를 기대한다.

- [ ] **Step 2: focused U4 테스트가 이전 adapter/geometry 부재로 실패하는지 확인한다.**

Run: `pnpm exec vitest run components/game/u4-dungeon-map-order.test.ts components/game/u4-dungeon-map-layout.test.ts components/game/u4-preview-data.test.ts`

Expected: geometry export와 zero-crossing expectation 때문에 실패한다.

- [ ] **Step 3: U4 adapter와 fallback을 구현한다.**

`u4-dungeon-map-order.ts`은 `GeneratedMap` rows/edges 변환만 남기고 공용 solver를 호출한다. layout은 positions/corridors를 만드는 pure helper를 두 번 호출할 수 있게 분리한다.

```ts
const wobbled = buildLayout(map, optimized.rows, {
  xWobble: true,
  yWobble: true,
  layerShift: true,
});
if (countU4GeometricCrossings(wobbled.corridors) === 0) return wobbled;

const flatDepths = buildLayout(map, optimized.rows, {
  xWobble: true,
  yWobble: false,
  layerShift: true,
});
const geometricCrossingCount = countU4GeometricCrossings(flatDepths.corridors);
if (geometricCrossingCount !== 0) {
  throw new U4MapLayoutError(geometricCrossingCount);
}
return flatDepths;
```

closed-segment intersection은 이미 정규화된 point를 `Math.round(value * 10_000)` 정수 point로 바꾸고 orientation/on-segment를 사용한다. 어떤 endpoint NodeId가 같으면 pair를 건너뛴다.

- [ ] **Step 4: focused U4 테스트를 실행한다.**

Run: `pnpm exec vitest run components/game/u4-dungeon-map-order.test.ts components/game/u4-dungeon-map-layout.test.ts components/game/u4-preview-data.test.ts`

Expected: adapter, geometry, fallback, preview의 `crossingCount === 0` 계약이 모두 통과한다.

- [ ] **Step 5: U4 변경을 커밋한다.**

```bash
git add components/game/u4-dungeon-map-order.ts components/game/u4-dungeon-map-order.test.ts components/game/u4-dungeon-map-layout.ts components/game/u4-dungeon-map-layout.test.ts components/game/u4-preview-data.test.ts
git diff --cached --check
git commit -m "화면: U4 통로 교차를 0으로 보장한다" -m "공용 순서 계산기를 사용하고 Y wobble fallback을 적용한다."
```

### Task 4: 공식 문서·기준선 진단·통합 검증

**Files:**

- Modify: `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`
- Modify: `docs/experience/U4_DUNGEON_MAP.md`
- Modify: `docs/README.md`
- Modify: `docs/superpowers/plans/2026-08-26-lattebun-e1-zero-crossing-map.md`

- [x] **Step 1: 공식 문서를 갱신한다.**

`DUNGEON_EVENTS_AND_BOSSES.md`의 위험도별 지도 절에 E1이 optional edge를 exact minimum crossing 0일 때만 채택하고 `GeneratedMap`이 zero-crossing 가능한 topology라는 규칙을 한 번만 기록한다. `U4_DUNGEON_MAP.md`에는 공용 solver adapter, 4자리 중심선 검사, Y-only fallback, 전용 오류 책임을 기록한다. `docs/README.md`의 이번 개편 설계 목록에 spec과 이 Plan 링크를 추가한다. 완료했다.

- [x] **Step 2: 기준선/변경 후 진단 표를 수집한다.**

spec 기준 SHA `226085835516fe5487e6dce681db76e9c6dbb06d`에서 고정 300-map 행렬의 `전체 edge 수 - base edge 수`를 위험도별로 집계한다. 현재 구현에서도 동일 집계를 하고 accepted/rejected optional edge, maximum row candidates, maximum logical crossing을 기록한다. 이 값은 PR #204 설명 또는 PR comment에 표로 남기며 `GeneratedMap`에 저장하지 않는다.

재현 명령: 임시 Vitest 진단 스크립트로 seed `e1-zero-crossing-00..19`, `dungeonId=e1-zero-crossing-risk-{1..5}`, attempt `0..2`를 순회했다. baseline은 SHA `226085835516fe5487e6dce681db76e9c6dbb06d`를 archive한 별도 임시 작업공간에서 실행했다.

| 위험도 | baseline total-base | current accepted optional | current rejected crossing | max row candidates | max logical crossing |
| ---: | ---: | ---: | ---: | ---: | ---: |
| ★1 | 93 | 86 | 8 | 6 | 0 |
| ★2 | 145 | 115 | 28 | 9 | 0 |
| ★3 | 297 | 150 | 110 | 20 | 0 |
| ★4 | 415 | 181 | 222 | 20 | 0 |
| ★5 | 563 | 208 | 341 | 25 | 0 |

현재 accepted 합계는 `total edges - base edges`와 일치했으며 300개 지도 모두 logical crossing 최대값이 0이었다. 진단값은 PR #204 설명 또는 comment에도 동일 표로 남긴다.

- [ ] **Step 3: 전체 정적·단위 검증을 실행한다.**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: lint, TypeScript, 모든 Vitest, production build가 모두 성공한다.

실행 결과(2026-08-26): `pnpm typecheck`은 성공했다. `pnpm lint`는 PR base에도
동일하게 존재하는 `components/game/TopStatusBar.tsx:90`의
`react-hooks/immutability` 오류로 실패했고, `pnpm test`는 PR base 이후 변경되지
않은 U5 preview 두 suite와 IntroScreen assertion에서 3 suite/1 assertion이
실패했다. `pnpm build`는 검수용 dev server 종료와 stale `.next/lock` 격리 후에도
Turbopack 최적화 단계가 worker 없이 완료 신호를 내지 않아 중단했다. 이 PR은 해당
범위 밖 기준선 실패를 고치지 않으며, PR 갱신에 결과를 기록한다.

- [x] **Step 4: 네 viewport 브라우저 검수를 수행한다.**

`/u4-test` 또는 실제 campaign U4에서 `1920×1080`, `2560×1440`, `1440×900`, `1280×1024`를 각각 확인한다. X자 corridor 교차, room overlap, scroll, 60:40 비율 변화, clipping, current/selectable 상태 손실이 없어야 한다. 결과 캡처와 관찰값을 PR #204에 남긴다. 완료했다: 네 viewport 모두 corridor 28개/room 23개/selectable state 1개를 유지했고 room/page horizontal overflow는 0이었다. 60:40 패널, scroll 범위, clipping 및 X자 교차도 보이지 않았다.

- [ ] **Step 5: 문서와 검증 변경을 커밋하고 PR을 갱신한다.**

```bash
git add docs/systems/DUNGEON_EVENTS_AND_BOSSES.md docs/experience/U4_DUNGEON_MAP.md docs/README.md docs/superpowers/plans/2026-08-26-lattebun-e1-zero-crossing-map.md
git diff --cached --check
git commit -m "문서: 지도 교차 0 계약과 검증 기준을 갱신한다" -m "E1 생성과 U4 표시 책임 및 회귀 검수 기준을 기록한다."
git push origin spec/e1-zero-crossing-map
```

## Spec Coverage Review

- 공용 solver exact DP, tie-break, 입력 검증, 재사용/성능: Task 1
- E1 optional edge greedy filtering, validator, diagnostics, 300-map, E3 불변성: Task 2
- U4 adapter, 4자리 기하 검사, Y fallback, U4 오류: Task 3
- 공식 문서, baseline/after 진단, 전체 검증, viewport, PR 갱신: Task 4

## Plan Self-Review

- Placeholder scan: 미정 API, 빈 단계, 선택적 구현 단계 없음.
- Type consistency: solver, diagnostics, U4 adapter/error public names are defined before use.
- Scope: `GeneratedMap`/Store/저장 shape와 E3 규칙을 유지하며 E1·U4·문서·검증만 변경한다.
