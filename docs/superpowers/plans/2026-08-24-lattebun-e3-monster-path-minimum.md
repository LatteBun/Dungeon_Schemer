# E3 경로별 몬스터 최소 보장 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 실제 선택 경로가 ★1~2에서 monster 2개 이상, ★3~5에서 monster 3개 이상을 갖도록 E3 사건 분류를 결정론적으로 예약한다.

**Architecture:** `prepareExpeditionEvents`가 boss-info cut 직후 DAG의 모든 entry→boss 경로를 대상으로 monster 보호 슬롯을 예약한다. strong link와 후보 수용량 보정은 보호 슬롯의 category를 바꾸지 못하며, 최종적으로 경로 하한을 다시 검증한다. 남은 일반 노드의 category RNG와 실제 사건 물질화 경계는 유지한다.

**Tech Stack:** TypeScript, Vitest, 도메인 `RuleError`, 기존 seeded RNG와 E1 `GeneratedMap`

**Spec:** `docs/superpowers/specs/2026-08-24-lattebun-e3-monster-path-minimum-design.md`

## Global Constraints

- 구현 브랜치는 #149가 병합된 `origin/main`에서 만들고, 그 PR이 추가한
  `lib/rules/campaign-profile-event-materialization.test.ts`를 수정한다.
- ★1~2의 모든 entry→boss 선택 경로는 `monster` category를 2개 이상 가진다.
- ★3~5의 모든 entry→boss 선택 경로는 `monster` category를 3개 이상 가진다.
- `bossInfo` cut, strong link 수, 지도 템플릿과 일반 Depth 수는 변경하지 않는다.
- `rest`, `merchant`, 일반 `special`에는 새 경로별 하한·상한을 두지 않는다.
- monster 보호 슬롯 선택은 RNG를 소비하지 않고 안정된 NodeId 순서로 동률을 푼다.
- 콘텐츠·지도·수용량이 계약과 양립하지 않으면 `RuleError("INVALID_GENERATION", ...)`으로 실패하며 재추첨하지 않는다.
- 공식 규칙 변경은 `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`와 `docs/README.md`에 같은 변경 단위로 반영한다.

---

## 파일 구조

- `lib/rules/expedition-events.ts`: 경로 열거, 위험도별 monster 하한, 결정론적 보호 슬롯 예약, 보호 슬롯을 고려한 strong-link/수용량 보정, 최종 검증을 소유한다.
- `lib/rules/expedition-events.test.ts`: 작은 DAG fixture와 실제 생성 지도로 하한·결정성·보호 슬롯 수용량 계약을 검증한다.
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
      const prepared = prepareExpeditionEvents({ /* theme과 active profile을 fixture에 맞춰 전달 */ });
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

### Task 2: 결정론적 monster 보호 슬롯 예약을 구현한다

**Files:**
- Modify: `lib/rules/expedition-events.ts: prepareExpeditionEvents 앞의 private helper 영역 및 준비 흐름`
- Modify: `lib/rules/expedition-events.test.ts: E3 원정 사건 준비 describe 블록`

**Interfaces:**
- Consumes: `GeneratedMap`, `Map<NodeId, PreparedNodePlan>`, `RiskLevel`
- Produces: `minimumMonsterCount(riskLevel: RiskLevel): number`, `reservePathMonsterCategories(input): ReadonlySet<NodeId>`, `assertPathMonsterMinimum(input): void`

- [ ] **Step 1: 작은 분기 DAG에서 공유 노드를 우선 예약하는 실패 테스트를 작성한다**

  `capacityExchangeFixture().map`처럼 두 갈래가 다시 합쳐지는 fixture를 사용한다. monster가 부족한 두 경로를 동시에 충족시키는 공유 normal node가 있을 때, 준비 결과가 두 경로 모두 하한을 만족하는지 검사한다.

  ```ts
  it("여러 부족 경로를 동시에 지나는 normal node를 monster 보호 슬롯으로 예약한다", () => {
    const fixture = capacityExchangeFixture();
    const prepared = prepareExpeditionEvents({ ...fixture, campaignSeed: "issue-117-shared-node" });
    for (const path of [fixture.upperPath, fixture.lowerPath]) {
      expect(monsterCount(prepared, path)).toBeGreaterThanOrEqual(2);
    }
  });
  ```

- [ ] **Step 2: 실패를 확인한다**

  Run: `node node_modules/vitest/vitest.mjs run lib/rules/expedition-events.test.ts -t "여러 부족 경로"`

  Expected: 구현 전에는 시드 추첨에 따라 한 갈래가 하한 미만이어서 FAIL한다.

- [ ] **Step 3: 최소 구현을 작성한다**

  `prepareExpeditionEvents`에서 cut `special` plan을 만든 직후 다음 private helper를 호출한다.

  ```ts
  function minimumMonsterCount(riskLevel: RiskLevel): number {
    return riskLevel <= 2 ? 2 : 3;
  }

  function reservePathMonsterCategories(input: {
    readonly map: GeneratedMap;
    readonly plans: Map<NodeId, PreparedNodePlan>;
    readonly minimum: number;
  }): ReadonlySet<NodeId> {
    // 모든 entry→boss normal-node 경로를 stable NodeId 순서로 열거한다.
    // bossInfo가 아닌 normal node 중 부족 경로 수가 가장 큰 후보를 고른다.
    // 후보가 없으면 invalid("경로별 monster 최소치를 예약할 수 없다", details).
    // 고른 plan은 { ...plan, category: "monster" }로 바꾸고 Set에 넣는다.
  }
  ```

  후보 점수는 “현재 monster 수가 minimum보다 작은 경로 중 이 node를 지나는 경로 수”다. 0점 후보는 고르지 않는다. 동점 후보는 `nodeId.localeCompare`가 가장 앞선 것을 선택한다. 예약이 끝난 뒤 `assertPathMonsterMinimum`이 모든 경로를 검사하고 부족하면 `invalid("경로별 monster 최소치가 충족되지 않는다", details)`를 던진다.

- [ ] **Step 4: 새 회귀와 기존 E3 준비 테스트를 통과시킨다**

  Run: `node node_modules/vitest/vitest.mjs run lib/rules/expedition-events.test.ts`

  Expected: PASS. 기존 bossInfo·strong-link·물질화 테스트가 category 보호 슬롯 추가 뒤에도 통과한다.

- [ ] **Step 5: 예약 구현을 커밋한다**

  ```bash
  git add lib/rules/expedition-events.ts lib/rules/expedition-events.test.ts
  git commit -m "수정: E3 경로별 몬스터 하한을 예약한다" -m "모든 선택 경로가 위험도별 최소 몬스터 수를 갖도록 결정론적 보호 슬롯을 배정한다."
  ```

### Task 3: strong link와 후보 수용량 보정에서 보호 슬롯을 보존한다

**Files:**
- Modify: `lib/rules/expedition-events.ts: reserveStrongLinkCategories, prepareExpeditionEvents, repairNormalCategoryCapacity`
- Modify: `lib/rules/expedition-events.test.ts: capacity exchange와 경로 하한 회귀`

**Interfaces:**
- Consumes: Task 2의 `ReadonlySet<NodeId>` monster 보호 슬롯
- Produces: `reserveStrongLinkCategories`와 `repairNormalCategoryCapacity`가 받는 `protectedNodeIds: ReadonlySet<NodeId>`

- [ ] **Step 1: 수용량 보정이 monster 보호 슬롯을 덮어쓰지 않는 실패 테스트를 작성한다**

  monster 후보가 적고 rest 후보가 충분한 fixture를 만들어, 수용량 보정이 필요해도 각 경로의 monster 하한이 남는지 검사한다. 준비 후 `pathNodeIds(map)`의 모든 경로가 하한을 지켜야 한다.

  ```ts
  it("후보 수용량 보정 뒤에도 monster 보호 슬롯과 경로 하한을 보존한다", () => {
    const fixture = capacityExchangeFixture();
    const prepared = prepareExpeditionEvents({ ...fixture, campaignSeed: "issue-117-capacity-protection" });
    expect([fixture.upperPath, fixture.lowerPath].every((path) => monsterCount(prepared, path) >= 2)).toBe(true);
  });
  ```

- [ ] **Step 2: 실패를 확인한다**

  Run: `node node_modules/vitest/vitest.mjs run lib/rules/expedition-events.test.ts -t "후보 수용량 보정 뒤에도"`

  Expected: 보호 슬롯을 mutable normal node로 취급하는 현재 수용량 보정이 monster를 다른 category로 교체할 수 있으므로 FAIL한다.

- [ ] **Step 3: 보호 슬롯 전달과 최종 검증을 구현한다**

  `prepareExpeditionEvents`가 monster 예약 결과를 `protectedNodeIds`로 보관하고 다음처럼 사용한다.

  ```ts
  const monsterProtectedNodeIds = reservePathMonsterCategories({ map: input.map, plans, minimum: minimumMonsterCount(input.riskLevel) });
  const reservedNodes = new Set([...bossInfoNodeIds, ...monsterProtectedNodeIds]);
  repairNormalCategoryCapacity({ ..., protectedNodeIds: monsterProtectedNodeIds });
  assertPathMonsterMinimum({ map: input.map, plans, minimum: minimumMonsterCount(input.riskLevel) });
  ```

  `reserveStrongLinkCategories`는 `reservedNodes`를 받아 보호 node의 category와 역할을 바꾸지 않는다. `repairNormalCategoryCapacity`의 `mutableNodeIds`에서 `protectedNodeIds`를 제외한다. 최종 검증은 strong-link 및 capacity 변경 뒤에 실행한다. 후보가 없어 보정할 수 없으면 기존처럼 `INVALID_GENERATION`을 던지고, 예외로 보호 슬롯을 풀지 않는다.

- [ ] **Step 4: E3 전체 테스트와 타입 검사를 통과시킨다**

  Run: `node node_modules/vitest/vitest.mjs run lib/rules/expedition-events.test.ts && pnpm exec tsc --noEmit`

  Expected: PASS, exit code 0.

- [ ] **Step 5: 보호 보정을 커밋한다**

  ```bash
  git add lib/rules/expedition-events.ts lib/rules/expedition-events.test.ts
  git commit -m "수정: E3 수용량 보정에서 몬스터 예약을 보존한다" -m "강한 연계와 후보 수용량 보정이 경로별 몬스터 하한을 깨지 않게 한다."
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
  const minimum = dungeon.currentRiskLevel <= 2 ? 2 : 3;
  for (const path of pathNodeIds(map)) {
    expect(monsterCount(prepared, path)).toBeGreaterThanOrEqual(minimum);
    let state = prepared;
    for (const nodeId of path) {
      state = materializeNodeEvent({ prepared: state, nodeId, /* campaign profile input */ }).state;
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
  - [E3 경로별 몬스터 최소 보장 설계](superpowers/specs/2026-08-24-lattebun-e3-monster-path-minimum-design.md): 위험도별 실제 선택 경로의 몬스터 하한과 결정적 보호 슬롯 계약
  - [E3 경로별 몬스터 최소 보장 구현 계획](superpowers/plans/2026-08-24-lattebun-e3-monster-path-minimum.md): E3 예약·수용량 보정·실제 프로필 회귀의 테스트 우선 실행 순서
  ```

- [ ] **Step 3: 전체 관련 테스트와 정적 검증을 실행한다**

  Run: `node node_modules/vitest/vitest.mjs run lib/rules/expedition-events.test.ts lib/rules/campaign-profile-event-materialization.test.ts && pnpm exec tsc --noEmit && git diff --check`

  Expected: 모두 exit code 0. 실패가 있으면 해당 실패를 먼저 재현하고 원인을 수정하며, 테스트 기대값을 낮추거나 RNG 재시도를 추가하지 않는다.

- [ ] **Step 4: 문서와 최종 검증 변경을 커밋한다**

  ```bash
  git add docs/systems/DUNGEON_EVENTS_AND_BOSSES.md docs/README.md
  git commit -m "문서: E3 몬스터 경로 보장을 공식화한다" -m "위험도별 몬스터 최소 횟수와 설계·구현 계획 인덱스를 최신 규칙으로 맞춘다."
  ```
