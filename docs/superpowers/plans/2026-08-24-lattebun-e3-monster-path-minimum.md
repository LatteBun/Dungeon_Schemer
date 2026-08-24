# E3 경로별 몬스터 최소 보장 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 실제 선택 경로가 ★1~2에서 monster 2개 이상, ★3~5에서 monster 3개 이상을 갖도록 E3 사건 분류를 결정론적으로 예약한다.

**Architecture:** `prepareExpeditionEvents`가 boss-info와 strong-link 역할을 확정한 뒤, 나머지 normal node category를 하나의 결정적 완전 탐색으로 배정한다. 부분 배정은 경로별 monster 달성 가능성과 사건 후보 수용량을 함께 pruning하고, 완성 배정은 두 계약을 모두 만족해야 한다. 최초 category와 후보 순서에는 기존 seeded RNG를 사용하되 탐색 중 새 RNG는 소비하지 않는다.

**Tech Stack:** TypeScript, Vitest, 도메인 `RuleError`, 기존 seeded RNG와 E1 `GeneratedMap`

**Spec:** `docs/superpowers/specs/2026-08-24-lattebun-e3-monster-path-minimum-design.md`

## Global Constraints

- 구현 브랜치는 #149가 병합된 `origin/main`에서 만들고, 그 PR이 추가한
  `lib/rules/campaign-profile-event-materialization.test.ts`를 수정한다.
- ★1~2의 모든 entry→boss 선택 경로는 `monster` category를 2개 이상 가진다.
- ★3~5의 모든 entry→boss 선택 경로는 `monster` category를 3개 이상 가진다.
- `bossInfo` cut, strong link 수, 지도 템플릿과 일반 Depth 수는 변경하지 않는다.
- `rest`, `merchant`, 일반 `special`에는 새 경로별 하한·상한을 두지 않는다.
- 전역 탐색은 RNG를 소비하지 않고, 탐색 전에 확정한 seeded node·category 순서를 따른다.
- 콘텐츠·지도·수용량이 계약과 양립하지 않으면 `RuleError("INVALID_GENERATION", ...)`으로 실패하며 재추첨하지 않는다.
- 공식 규칙 변경은 `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`와 `docs/README.md`에 같은 변경 단위로 반영한다.

---

## 파일 구조

- `lib/rules/expedition-events.ts`: 경로 열거, 위험도별 monster 하한, monster 가능성·후보 수용량 동시 전역 배정과 최종 검증을 소유한다.
- `lib/rules/expedition-events.test.ts`: 작은 DAG fixture와 실제 생성 지도로 하한·결정성·동시 수용량 계약을 검증한다.
- `lib/rules/campaign-profile-event-materialization.test.ts`: 실제 CampaignDungeon 생태 프로필에서 경로별 monster 하한과 물질화 가능성을 함께 확인한다.
- `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`: 공개 category 계약에 위험도별 monster 경로 최소치를 기록한다.
- `docs/README.md`: 이 spec과 계획 링크를 문서 인덱스에 추가한다.

### Task 1: 경로 monster 하한의 실패 회귀를 고정한다

**Files:**
- Modify: `lib/rules/expedition-events.test.ts: E3 원정 사건 준비 describe 블록`

**Interfaces:**
- Consumes: `prepareExpeditionEvents(input)`, `GeneratedMap`, `PreparedExpeditionEvents`
- Produces: 테스트 전용 `pathNodeIds(map): readonly NodeId[][]`, `monsterCount(prepared, path): number` helper와 위험도별 경로 하한의 회귀 기준

- [ ] **Step 1: 경로 열거와 하한 helper를 테스트 파일에 작성한다**

  `entryNodeId`부터 `bossNodeId`까지 DFS하고 boss를 제외한 normal node ID 배열을 반환한다. 각 경로의 `nodePlans`에서 `category === "monster"` 수를 세도록 한다.

  ```ts
  function pathNodeIds(map: GeneratedMap): readonly NodeId[][] {
    const byId = new Map(map.nodes.map((node) => [node.id, node]));
    const visit = (nodeId: NodeId, path: readonly NodeId[]): readonly NodeId[][] => {
      if (nodeId === map.bossNodeId) return [path];
      const node = byId.get(nodeId);
      if (node === undefined) throw new Error("지도 node 없음");
      return node.nextNodeIds.flatMap((nextNodeId) => visit(
        nextNodeId,
        node.kind === "normal" ? [...path, node.id] : path,
      ));
    };
    return visit(map.entryNodeId, []);
  }

  function monsterCount(prepared: PreparedExpeditionEvents, path: readonly NodeId[]): number {
    return path.filter((nodeId) => prepared.nodePlans.get(nodeId)?.category === "monster").length;
  }
  ```

- [ ] **Step 2: 실제 ★1 및 ★3 지도의 모든 경로 하한을 검증하는 실패 테스트를 작성한다**

  각 risk fixture에서 `generateDungeonMap`과 `prepareExpeditionEvents`를 호출한 뒤 모든 경로를 검사한다. ★1은 2, ★3은 3을 기대한다. issue에 기록된 monster 0~1 사례가 다시 생기면 실패하도록 seed를 명시한다.

  ```ts
  it("위험도별 모든 실제 선택 경로에 monster 최소치를 보장한다", () => {
    const cases = [
      { seed: "issue-117-risk-1", dungeonId: "dungeon-spider-01" as DungeonId, riskLevel: 1 as const, minimum: 2 },
      { seed: "issue-117-risk-3", dungeonId: "dungeon-graveyard-03" as DungeonId, riskLevel: 3 as const, minimum: 3 },
    ];
    for (const testCase of cases) {
      const map = generateDungeonMap({ campaignSeed: testCase.seed, dungeonId: testCase.dungeonId, initialRiskLevel: testCase.riskLevel, riskLevel: testCase.riskLevel, attempt: 0 });
      const prepared = prepareExpeditionEvents({ ...input, map, theme: testCase.theme });
      expect(pathNodeIds(map).every((path) => monsterCount(prepared, path) >= testCase.minimum)).toBe(true);
    }
  });
  ```

- [ ] **Step 3: 실패를 확인한다**

  Run: `node node_modules/vitest/vitest.mjs run lib/rules/expedition-events.test.ts -t "위험도별 모든 실제 선택 경로"`

  Expected: 현재 균등 category 추첨으로 인해 적어도 한 경로가 2 또는 3 미만이라 FAIL한다. 만약 고정 seed가 우연히 통과하면, issue #117에서 기록한 저 monster 시드로 바꾸어 실패 사례를 고정한다.

- [ ] **Step 4: 테스트 helper만 커밋한다**

  ```bash
  git add lib/rules/expedition-events.test.ts
  git commit -m "검증: E3 경로별 몬스터 하한 실패를 고정한다" -m "위험도별 실제 선택 경로의 몬스터 수를 세는 회귀 기준을 추가한다."
  ```

### Task 2: 부분 배정의 경로 monster 가능성 검사를 구현한다

**Files:**
- Modify: `lib/rules/expedition-events.ts: findDeterministicCapacityAssignment 앞의 private helper 영역`
- Modify: `lib/rules/expedition-events.test.ts: deterministic assignment describe 블록`

**Interfaces:**
- Consumes: `GeneratedMap`, `ReadonlyMap<NodeId, PreparedNodePlan>`, partial `ReadonlyMap<NodeId, EventKind>`
- Produces: `minimumMonsterCount(riskLevel: RiskLevel): number`, `normalPaths(map): readonly NodeId[][]`, `hasPathMonsterPotential(input): boolean`, `hasPathMonsterMinimum(input): boolean`

- [ ] **Step 1: 부분 배정의 가능·불가능 가지를 구분하는 실패 테스트를 작성한다**

  테스트용 작은 두 갈래 DAG에서 한 경로의 확정 monster 1개와 미배정 monster 가능 노드 1개는 minimum 2 가능으로, 남은 후보가 전부 rest이면 불가능으로 검사한다.

  ```ts
  it("부분 배정에서 모든 경로의 monster 하한 달성 가능성을 판정한다", () => {
    const fixture = monsterPotentialFixture();
    expect(hasPathMonsterPotential({ ...fixture, categoryChoices: fixture.monsterAvailableChoices })).toBe(true);
    expect(hasPathMonsterPotential({ ...fixture, categoryChoices: fixture.restOnlyChoices })).toBe(false);
  });
  ```

- [ ] **Step 2: 실패를 확인한다**

  Run: `node node_modules/vitest/vitest.mjs run lib/rules/expedition-events.test.ts -t "부분 배정에서 모든 경로"`

  Expected: `hasPathMonsterPotential`이 없어 FAIL한다.

- [ ] **Step 3: 최소 구현을 작성한다**

  production helper는 각 경로에서 확정 monster 수와 아직 monster를 선택할 수 있는 미배정 노드 수를 센다.

  ```ts
  function minimumMonsterCount(riskLevel: RiskLevel): number {
    return riskLevel <= 2 ? 2 : 3;
  }

  function hasPathMonsterPotential(input: {
    readonly map: GeneratedMap;
    readonly plans: ReadonlyMap<NodeId, PreparedNodePlan>;
    readonly assignment: ReadonlyMap<NodeId, EventKind>;
    readonly unassignedNodeIds: ReadonlySet<NodeId>;
    readonly categoryChoices: ReadonlyMap<NodeId, readonly EventKind[]>;
    readonly minimum: number;
  }): boolean {
    // 각 path에서 확정 monster + monster 가능 미배정 node >= minimum인지 반환한다.
  }
  ```

  `hasPathMonsterMinimum`은 미배정 가능성을 더하지 않고 완성된 `plans`의 실제 monster 수만 검사한다. map node 누락은 `INVALID_GENERATION`으로 보고한다.

- [ ] **Step 4: 새 회귀와 기존 E3 준비 테스트를 통과시킨다**

  Run: `node node_modules/vitest/vitest.mjs run lib/rules/expedition-events.test.ts -t "부분 배정에서 모든 경로"`

  Expected: PASS.

- [ ] **Step 5: 예약 구현을 커밋한다**

  ```bash
  git add lib/rules/expedition-events.ts lib/rules/expedition-events.test.ts
  git commit -m "수정: E3 몬스터 경로 가능성을 판정한다" -m "부분 배정에서도 모든 선택 경로가 위험도별 하한에 도달할 수 있는지 검사한다."
  ```

### Task 3: monster 하한과 후보 수용량을 동시에 배정한다

**Files:**
- Modify: `lib/rules/expedition-events.ts: prepareExpeditionEvents, repairNormalCategoryCapacity`
- Modify: `lib/rules/expedition-events.test.ts: capacity exchange와 경로 하한 회귀`

**Interfaces:**
- Consumes: Task 2의 `hasPathMonsterPotential`, `hasPathMonsterMinimum`, 기존 `categoryCapacityDeficit`, `findDeterministicCapacityAssignment`
- Produces: `assignNormalCategories(input): void`와 경로 하한·후보 수용량을 동시에 만족하는 최종 `plans`

- [ ] **Step 1: 두 제약을 동시에 만족해야 하는 실패 테스트를 작성한다**

  `capacityExchangeFixture`에 양쪽 경로의 monster 하한을 채울 수 있는 4개 monster 후보와 나머지 category 후보를 제공한다. 준비가 성공하고 양쪽 경로 모두 minimum 2를 만족하며 실제 경로 물질화가 중복 없이 끝나야 한다.

  ```ts
  it("후보 수용량과 monster 경로 하한을 동시에 만족하는 분류를 만든다", () => {
    const fixture = capacityExchangeFixture();
    const prepared = prepareExpeditionEvents({ ...fixture, campaignSeed: "issue-117-capacity-protection" });
    expect([fixture.upperPath, fixture.lowerPath].every((path) => monsterCount(prepared, path) >= 2)).toBe(true);
  });
  ```

- [ ] **Step 2: 실패를 확인한다**

  Run: `node node_modules/vitest/vitest.mjs run lib/rules/expedition-events.test.ts -t "후보 수용량과 monster 경로 하한"`

  Expected: 기존 순차 보호 구현은 실제 후보 수용량과 양립하는 다른 monster 배치를 탐색하지 못해 FAIL한다.

- [ ] **Step 3: 동시 전역 배정을 구현한다**

  `repairNormalCategoryCapacity`를 `assignNormalCategories`로 바꾸고, deficit이 이미 0이어도 monster 하한이 부족하면 탐색한다.

  ```ts
  const assignment = findDeterministicCapacityAssignment({
    nodeOrder,
    categoryChoices,
    hasPotential: (partial) => {
      const unassignedNodeIds = new Set(nodeOrder.filter((nodeId) => !partial.has(nodeId)));
      return hasPathMonsterPotential({ map, plans, assignment: partial, unassignedNodeIds, categoryChoices, minimum })
        && categoryCapacityDeficit({ ...input, plans: plansWith(partial), ignoredNormalNodeIds: unassignedNodeIds }) === 0;
    },
    isValid: (complete) => {
      const completedPlans = plansWith(complete);
      return hasPathMonsterMinimum({ map, plans: completedPlans, minimum })
        && categoryCapacityDeficit({ ...input, plans: completedPlans }) === 0;
    },
  });
  ```

  `nodeOrder`는 기존 seeded shuffle을 사용한다. 각 node의 첫 선택은 기존 plan category이고, 나머지는 실제 normal 후보가 존재하는 category의 seeded shuffle이다. bossInfo와 strong-link node는 mutable 목록에서 제외한다. assignment가 없으면 `INVALID_GENERATION`을 던지고 RNG 재시도나 하한 완화를 하지 않는다.

- [ ] **Step 4: E3 전체 테스트와 타입 검사를 통과시킨다**

  Run: `node node_modules/vitest/vitest.mjs run lib/rules/expedition-events.test.ts && pnpm exec tsc --noEmit`

  Expected: PASS, exit code 0.

- [ ] **Step 5: 보호 보정을 커밋한다**

  ```bash
  git add lib/rules/expedition-events.ts lib/rules/expedition-events.test.ts
  git commit -m "수정: E3 분류 제약을 전역 배정한다" -m "몬스터 경로 하한과 사건 후보 수용량을 하나의 결정적 탐색에서 함께 만족시킨다."
  ```

### Task 4: 모든 공식 지도와 실제 생태 프로필에서 계약을 검증한다

**Files:**
- Modify: `lib/rules/campaign-profile-event-materialization.test.ts: CampaignDungeon profile 회귀 describe 블록`
- Modify: `lib/rules/expedition-events.test.ts: 위험도별 모든 실제 선택 경로 회귀`

**Interfaces:**
- Consumes: `CampaignDungeon`, `prepareExpeditionEvents`, `materializeNodeEvent`, Task 1 `pathNodeIds`/`monsterCount`
- Produces: 공식 던전·고정 3시드·attempt 0/1·실제 active profile의 통합 회귀

- [ ] **Step 1: CampaignDungeon 프로필 테스트에 경로 하한 assertion을 추가한다**

  기존 3시드 × 15 던전 × attempt 0/1 루프에서 prepared 직후 현재 위험도로 최소치를 계산하고 모든 경로를 확인한다. 기존처럼 각 경로의 이벤트를 순서대로 물질화한다.

  ```ts
  const minimum = dungeon.riskLevel <= 2 ? 2 : 3;
  for (const path of pathNodeIds(map)) {
    expect(monsterCount(prepared, path)).toBeGreaterThanOrEqual(minimum);
    let state = prepared;
    for (const nodeId of path) {
      state = materializeNodeEvent({
        prepared: state,
        nodeId,
        campaignSeed,
        dungeonId: dungeon.id,
        attempt,
        theme,
        targetBossId: dungeon.bossId,
        activeRuleIds: dungeon.activeRuleIds,
        activeMonsterIds: dungeon.activeMonsterIds,
      }).state;
    }
  }
  ```

- [ ] **Step 2: 통합 회귀를 실행해 구현 전 실패를 확인한다**

  Run: `node node_modules/vitest/vitest.mjs run lib/rules/campaign-profile-event-materialization.test.ts`

  Expected: Task 2~3이 적용되기 전에는 저 monster 사례에서 FAIL한다. Task 2~3 뒤에는 PASS한다.

- [ ] **Step 3: 모든 공식 위험도·여러 고정 시드·두 attempt를 아우르는 단위 회귀를 보강한다**

  `expedition-events.test.ts`에서 risk 1~5 각각에 대해 최소 3개 고정 seed와 attempt 0/1을 실행한다. 지도 path마다 하한을 검증하고 같은 입력 두 번의 `PreparedExpeditionEvents` 동등성도 확인한다.

  ```ts
  for (const riskLevel of [1, 2, 3, 4, 5] as const) {
    for (const seed of ["issue-117-a", "issue-117-b", "issue-117-c"]) {
      for (const attempt of [0, 1]) {
        // generateDungeonMap → prepareExpeditionEvents를 두 번 호출
        // expect(first).toEqual(second)
        // 모든 path의 monsterCount >= (riskLevel <= 2 ? 2 : 3)
      }
    }
  }
  ```

- [ ] **Step 4: 집중 회귀를 통과시킨다**

  Run: `node node_modules/vitest/vitest.mjs run lib/rules/expedition-events.test.ts lib/rules/campaign-profile-event-materialization.test.ts`

  Expected: PASS. 모든 profile 물질화와 경로 monster 계약이 함께 통과한다.

- [ ] **Step 5: 통합 회귀를 커밋한다**

  ```bash
  git add lib/rules/expedition-events.test.ts lib/rules/campaign-profile-event-materialization.test.ts
  git commit -m "검증: 실제 원정 경로의 몬스터 하한을 회귀로 고정한다" -m "모든 공식 위험도와 캠페인 생태 프로필에서 경로별 몬스터 최소치를 검증한다."
  ```

### Task 5: 공식 문서와 전체 검증을 완료한다

**Files:**
- Modify: `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md: 사건 분류`
- Modify: `docs/README.md: 이번 개편 설계`

**Interfaces:**
- Consumes: 구현된 위험도별 경로 monster 계약
- Produces: 코드와 같은 의미의 공식 E3 규칙 및 문서 인덱스

- [ ] **Step 1: 공식 사건 분류 문서를 갱신한다**

  기존 “네 분류의 경로별 동시 보장은 요구하지 않는다” 문장을 아래 의미로 교체한다.

  ```md
  지도 category는 원정 시작 때 확정된다. 모든 실제 선택 경로는 현재 위험도 ★1~2에서
  `monster` 2개 이상, ★3~5에서 `monster` 3개 이상을 가진다. 보스 정보 `special`은
  이 수를 대체하지 않는다. `rest`, `merchant`, 일반 `special`에는 경로별 동시
  보장을 두지 않으며, 남는 지점에는 시드로 고른 분류를 추가한다.
  ```

- [ ] **Step 2: README의 이번 개편 설계 인덱스에 spec·plan 링크를 추가한다**

  ```md
  - [E3 경로별 몬스터 최소 보장 설계](superpowers/specs/2026-08-24-lattebun-e3-monster-path-minimum-design.md): 위험도별 실제 선택 경로의 몬스터 하한과 결정적 전역 배정 계약
  - [E3 경로별 몬스터 최소 보장 구현 계획](superpowers/plans/2026-08-24-lattebun-e3-monster-path-minimum.md): E3 동시 제약 배정·실제 프로필 회귀의 테스트 우선 실행 순서
  ```

- [ ] **Step 3: 전체 관련 테스트와 정적 검증을 실행한다**

  Run: `node node_modules/vitest/vitest.mjs run lib/rules/expedition-events.test.ts lib/rules/campaign-profile-event-materialization.test.ts && pnpm exec tsc --noEmit && git diff --check`

  Expected: 모두 exit code 0. 실패가 있으면 해당 실패를 먼저 재현하고 원인을 수정하며, 테스트 기대값을 낮추거나 RNG 재시도를 추가하지 않는다.

- [ ] **Step 4: 문서와 최종 검증 변경을 커밋한다**

  ```bash
  git add docs/systems/DUNGEON_EVENTS_AND_BOSSES.md docs/README.md
  git commit -m "문서: E3 몬스터 경로 보장을 공식화한다" -m "위험도별 몬스터 최소 횟수와 설계·구현 계획 인덱스를 최신 규칙으로 맞춘다."
  ```
