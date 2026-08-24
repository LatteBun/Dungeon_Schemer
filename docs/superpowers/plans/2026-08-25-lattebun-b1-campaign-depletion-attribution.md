# B1-C 캠페인 손실 원인 판정·보정 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실제 Campaign Store 백테스트에서 원정·월드턴 손실을 원장으로 집계하고, 200시드 결과의 지배 원인 한 축만 보정해 위험도 곡선과 B1-B gate를 재판정한다.

**Architecture:** `campaign-driver`가 dispatch 전후의 실제 상태 차이와 전투 action을 원시 `DepletionTraceEntry`로 기록한다. `metrics`는 원장을 검증·집계해 dominant/mixed 판정을 만들고, `report`는 기존 funnel 앞에 손실·종료 표를 결정적으로 렌더링한다. calibration은 지배 원인에 대응하는 단일 공통 축만 변경하며 기존 acceptance와 fixed gate를 그대로 강제한다.

**Tech Stack:** TypeScript, Vitest, Zustand Campaign Store, Markdown

**Spec:** `docs/superpowers/specs/2026-08-25-lattebun-b1-campaign-depletion-attribution-design.md`

## Global Constraints

- 기존 `balanceExpeditions`, 위험도별 첫 시도 gate, B1-B acceptance, fixed gate를 제거·완화하지 않는다.
- 손실 source는 `expedition-general`, `expedition-boss`, `world-turn-background`, `world-turn-rest` 네 개만 쓴다.
- 일반/보스 entry에는 원정 ID·던전 ID·초기 위험도·시도 번호를 붙이고, 월드턴 entry에는 모두 `null`을 둔다.
- 백그라운드 월드턴의 death는 항상 0이며, HP 손실·회복·사망·중상·신뢰 0 count는 음수나 소수가 될 수 없다.
- `opportunist@0.7` 200시드에서 사망 60% 이상(사망 0이면 HP 손실 60% 이상과 종료 최다 원인의 일치)이 한 source에 있을 때만 dominant다. 나머지는 mixed다.
- dominant일 때만 보스, 일반 몬스터, 또는 휴식 회복률 중 하나를 바꾼다. 여러 축, 테마별, 재도전별 특례는 금지한다.
- 보스 배율은 `0.20~1.20`, `0.025` 격자; 휴식 회복률은 `0.20~0.25` 범위를 지킨다.
- holdout과 `B1B_HOLDOUT_APPROVED` 변경은 금지한다. 생성된 `docs/technical/BACKTEST_REPORT.md`는 커밋하지 않는다.
- 커밋 제목과 본문은 한글로 작성한다.

---

### Task 1: 손실 원장 도메인 계약과 driver trace를 만든다

**Files:**
- Modify: `lib/backtest/campaign-driver.ts`
- Modify: `lib/backtest/campaign-driver.test.ts`

**Interfaces:**

```ts
export type DepletionSource =
  | "expedition-general" | "expedition-boss"
  | "world-turn-background" | "world-turn-rest";

export interface DepletionTraceEntry {
  readonly source: DepletionSource;
  readonly worldTurn: number;
  readonly expeditionId: string | null;
  readonly dungeonId: DungeonId | null;
  readonly initialRiskLevel: RiskLevel | null;
  readonly attemptNumber: number | null;
  readonly hpLost: number;
  readonly hpRecovered: number;
  readonly deaths: number;
  readonly seriousInjuriesStarted: number;
  readonly seriousInjuriesCleared: number;
  readonly trustZeroed: number;
}
```

`CampaignRunTrace`와 mutable trace에 `depletion: readonly DepletionTraceEntry[]`를 추가한다.

- [ ] **Step 1: 원정·월드턴 손실 trace 실패 테스트를 쓴다**

`campaign-driver.test.ts`에서 실제 `runCampaign` 결과를 검사한다.

```ts
expect(result.trace.depletion).toEqual(expect.arrayContaining([
  expect.objectContaining({ source: "expedition-boss", expeditionId: expect.any(String), dungeonId: expect.any(String) }),
  expect.objectContaining({ source: "world-turn-rest", expeditionId: null, dungeonId: null }),
]));
expect(result.trace.depletion.every((entry) =>
  Number.isInteger(entry.hpLost) && entry.hpLost >= 0 &&
  Number.isInteger(entry.hpRecovered) && entry.hpRecovered >= 0,
)).toBe(true);
```

step-limit run은 이미 확정된 `depletion` entry가 보존되고, 같은 seed 두 번의 trace가 같음을 추가로 검사한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `node /Users/danny/MakeBun/Dungeon_Schemer/node_modules/vitest/vitest.mjs run lib/backtest/campaign-driver.test.ts`

Expected: FAIL — `depletion` 필드가 없다.

- [ ] **Step 3: dispatch 전후 차이와 전투 기록을 추출한다**

`campaign-driver.ts`에 `poolDelta(before, after)`와 `appendDepletionFor(action, before, after, trace)`를 추가한다. pool의 같은 character ID를 비교해 HP 감소/회복, alive `true → false`, `gravelyWounded false → true/true → false`, `trust > 0 → 0`만 계산한다.

`CHOOSE_ADVICE` 뒤 pending event가 `monster`였으면 `expedition-general`, `ENTER_BOSS` 뒤에는 `expedition-boss` entry를 만들고, action과 무관한 HP 변화는 기록하지 않는다. `COMPLETE_WORLD_TURN`은 `WorldTurnResult.outcomes`의 `background`를 background source로, `rest`·`forcedRest`를 rest source로 합쳐 한 turn당 source별 하나의 entry를 만든다.

```ts
function expeditionLocator(trace: MutableTrace, expeditionId: string): Pick<DepletionTraceEntry,
  "expeditionId" | "dungeonId" | "initialRiskLevel" | "attemptNumber"> { /* balance trace를 찾아 반환 */ }

function appendDepletionFor(action: CampaignTransition, before: CampaignStoreState,
  after: CampaignStoreState, trace: MutableTrace): void { /* 위 source별로 push */ }
```

`freezeTrace`는 모든 entry를 새 객체로 복사한다.

- [ ] **Step 4: driver 테스트를 통과시킨다**

Run: `node /Users/danny/MakeBun/Dungeon_Schemer/node_modules/vitest/vitest.mjs run lib/backtest/campaign-driver.test.ts`

Expected: PASS

- [ ] **Step 5: 커밋한다**

```bash
git add lib/backtest/campaign-driver.ts lib/backtest/campaign-driver.test.ts
git commit -m "백테스트: 캠페인 손실 원장을 기록한다" -m "실제 전이의 원정·월드턴 손실을 source별 trace로 보존한다. 중단된 실행도 이미 확정된 손실을 유지한다."
```

### Task 2: 손실 원장을 검증하고 조합별 지표로 집계한다

**Files:**
- Modify: `lib/backtest/metrics.ts`
- Modify: `lib/backtest/metrics.test.ts`

**Interfaces:**

```ts
export interface DepletionTotals {
  readonly hpLost: number; readonly hpRecovered: number; readonly deaths: number;
  readonly seriousInjuriesStarted: number; readonly seriousInjuriesCleared: number;
  readonly trustZeroed: number;
}
export type DepletionVerdict = { readonly kind: "dominant"; readonly source: DepletionSource; readonly evidence: string }
  | { readonly kind: "mixed"; readonly evidence: string };
```

`CampaignRunMetrics`에는 `depletion`과 종료 사유를, `CombinationAggregate`에는 `depletionBySource`와 `depletionVerdict`를 추가한다.

- [ ] **Step 1: 손계산 fixture와 거부 fixture를 작성한다**

`metrics.test.ts`의 `metric()` fixture에 일반 30 HP/사망 2, 보스 70 HP/사망 4,
background 10 HP, rest 회복 20 HP entry를 넣는다.

```ts
expect(aggregate.combinations["opportunist@0.7"].depletionBySource["expedition-boss"])
  .toMatchObject({ hpLost: 70, deaths: 4 });
expect(aggregate.combinations["opportunist@0.7"].depletionVerdict)
  .toMatchObject({ kind: "dominant", source: "expedition-boss" });
expect(() => aggregateRuns([metric({ depletion: [{ source: "world-turn-background", deaths: 1 }] })]))
  .toThrow("월드턴 백그라운드 손실에 사망이 있다");
```

60% 경계, 59% mixed, 사망 0의 HP-loss fallback, locator 누락, 음수/소수, 원정 attempt 불일치 fixture를 각각 검사한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `node /Users/danny/MakeBun/Dungeon_Schemer/node_modules/vitest/vitest.mjs run lib/backtest/metrics.test.ts`

Expected: FAIL — 새 aggregate 필드와 원장 검증이 없다.

- [ ] **Step 3: 검증·집계·판정을 구현한다**

`validateDepletionTraces()`에서 source/locator/정수/비음수/background death 0을 검사하고, 원정 locator가 `balanceExpeditions`와 정확히 일치하는지 검사한다. `sumDepletion()`은 네 source 각각의 총계를 만들고 `depletionVerdictFor()`는 spec의 60% 규칙을 적용한다. `run-error`는 종료 사유로 집계하되 trace를 버리지 않는다.

- [ ] **Step 4: metrics 테스트와 타입검사를 통과시킨다**

Run: `node /Users/danny/MakeBun/Dungeon_Schemer/node_modules/vitest/vitest.mjs run lib/backtest/metrics.test.ts`

Expected: PASS

Run: `./node_modules/.bin/tsc --noEmit`

Expected: PASS

- [ ] **Step 5: 커밋한다**

```bash
git add lib/backtest/metrics.ts lib/backtest/metrics.test.ts
git commit -m "백테스트: 손실 원인을 집계하고 판정한다" -m "source별 손실과 종료 사유를 검증·집계한다. 60% 기준으로 단일 지배 원인과 혼합 원인을 구분한다."
```

### Task 3: 손실 판정과 drill-down을 보고서에 렌더링한다

**Files:**
- Modify: `lib/backtest/report.ts`
- Modify: `lib/backtest/report.test.ts`

- [ ] **Step 1: 결정적 보고서 실패 테스트를 쓴다**

```ts
expect(report).toContain("## 캠페인 손실 원인 판정");
expect(report).toContain("expedition-boss");
expect(report).toContain("dominant");
expect(report).toContain("## 종료 사유와 최종 풀 상태");
const second = renderBacktestReport(input);
expect(second).toBe(report);
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node /Users/danny/MakeBun/Dungeon_Schemer/node_modules/vitest/vitest.mjs run lib/backtest/report.test.ts`

Expected: FAIL — 손실 표와 판정 section이 없다.

- [ ] **Step 3: source·종료·첫 시도 drill-down 표를 추가한다**

`renderBacktestReport()`에서 strategy, accuracy, source 순으로 정렬한 표를 만든다. 각 행은 HP 손실·회복·사망·중상 시작/해제·신뢰 0과 verdict evidence를 표시한다. 기존 첫 시도 funnel의 앞에 삽입하되 기존 heading과 행을 변경하지 않는다.

- [ ] **Step 4: report 테스트를 통과시킨다**

Run: `node /Users/danny/MakeBun/Dungeon_Schemer/node_modules/vitest/vitest.mjs run lib/backtest/report.test.ts`

Expected: PASS

- [ ] **Step 5: 커밋한다**

```bash
git add lib/backtest/report.ts lib/backtest/report.test.ts
git commit -m "백테스트: 캠페인 손실 판정을 보고한다" -m "손실 source와 종료 원인, 위험도별 drill-down을 결정적인 보고서에 추가한다."
```

### Task 4: 단일 축 보정 계약을 강제한다

**Files:**
- Modify: `lib/balance/campaign-balance.ts`
- Modify: `lib/balance/campaign-balance.test.ts`
- Modify: `lib/rules/balance-validation.ts`
- Modify: `lib/rules/balance-validation.test.ts`
- Modify: `lib/rules/expedition-events.ts`
- Modify: `lib/rules/expedition-events.test.ts`

**Interfaces:**

```ts
export const GENERAL_MONSTER_MULTIPLIER_CALIBRATION = { min: 0.70, max: 1.10, step: 0.025 } as const;
// CampaignBalance에 generalMonsterBaseStatMultiplier: number 추가
```

- [ ] **Step 1: 일반 몬스터 공통 배율의 실패 테스트를 쓴다**

`campaign-balance.test.ts`에 0.70·1.10의 grid 허용과 0.71·1.125 거부를, `expedition-events.test.ts`에 같은 monster의 HP와 baseDamage에 단 한 번 적용됨을 작성한다. 보스 adapter와 월드턴 값이 이 설정으로 바뀌지 않음을 같이 검사한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `node /Users/danny/MakeBun/Dungeon_Schemer/node_modules/vitest/vitest.mjs run lib/balance/campaign-balance.test.ts lib/rules/balance-validation.test.ts lib/rules/expedition-events.test.ts`

Expected: FAIL — 일반 몬스터 배율 계약이 없다.

- [ ] **Step 3: 설정과 runtime validation을 구현한다**

`CAMPAIGN_BALANCE`에 `generalMonsterBaseStatMultiplier: 1.00`을 추가하고 두 validator가 같은 범위·격자를 검사하게 한다. `resolveMonsterEventBattle()` 입력 monster의 HP와 baseDamage에 이 공통 배율을 한 번만 적용한다. 현재 revision은 이 task에서 바꾸지 않는다.

- [ ] **Step 4: 관련 테스트와 타입검사를 통과시킨다**

Run: `node /Users/danny/MakeBun/Dungeon_Schemer/node_modules/vitest/vitest.mjs run lib/balance/campaign-balance.test.ts lib/rules/balance-validation.test.ts lib/rules/expedition-events.test.ts`

Expected: PASS

Run: `./node_modules/.bin/tsc --noEmit`

Expected: PASS

- [ ] **Step 5: 커밋한다**

```bash
git add lib/balance/campaign-balance.ts lib/balance/campaign-balance.test.ts lib/rules/balance-validation.ts lib/rules/balance-validation.test.ts lib/rules/expedition-events.ts lib/rules/expedition-events.test.ts
git commit -m "밸런스: 일반 몬스터 보정 계약을 추가한다" -m "일반 전투가 지배 원인일 때 쓸 공통 배율의 안전 범위와 런타임 검증을 고정한다."
```

### Task 5: 실제 calibration으로 원인을 판정하고 한 축만 조정한다

**Files:**
- Modify: `lib/balance/campaign-balance.ts`
- Modify: `docs/systems/CHARACTER_POOL_AND_WORLDTURN.md` 또는 `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`
- Modify: `docs/technical/BACKTEST_REPORT.md` (생성물, 커밋 제외)

- [ ] **Step 1: 현 설정 50시드 구조 실행을 한다**

Run: `B1_SOURCE_REVISION=$(git rev-parse --short HEAD) B1_BACKTEST_MODE=calibration B1_BACKTEST_SEEDS=50 node /Users/danny/MakeBun/Dungeon_Schemer/node_modules/vitest/vitest.mjs run --config vitest.backtest.config.ts`

Expected: run error 0, 네 source와 종료 사유가 보고서에 있으며 50시드 gate는 OBSERVE다.

- [ ] **Step 2: 100시드로 지배 source와 후보 방향을 확인한다**

Run: `B1_SOURCE_REVISION=$(git rev-parse --short HEAD) B1_BACKTEST_MODE=calibration B1_BACKTEST_SEEDS=100 node /Users/danny/MakeBun/Dungeon_Schemer/node_modules/vitest/vitest.mjs run --config vitest.backtest.config.ts`

Expected: `opportunist@0.7` verdict가 dominant 또는 mixed로 명시된다.

- [ ] **Step 3: 판정에 맞는 한 축만 변경한다**

dominant가 boss면 위험도별 보스 배율만, general이면 `generalMonsterBaseStatMultiplier`만, background면 `restRecoveryRatio`만 변경한다. mixed 또는 신뢰 종료 경고면 수치를 바꾸지 않고 이 task를 blocked로 기록한다. 선택한 값은 해당 격자/범위에 맞추고 `revision`을 새 `b1c-...-v1` 값으로 바꾼다.

- [ ] **Step 4: 200시드 최종 calibration을 실행한다**

Run: `B1_SOURCE_REVISION=$(git rev-parse --short HEAD) B1_BACKTEST_MODE=calibration B1_BACKTEST_SEEDS=200 node /Users/danny/MakeBun/Dungeon_Schemer/node_modules/vitest/vitest.mjs run --config vitest.backtest.config.ts`

Expected: 모든 위험도·B1-B·fixed·원장 gate가 PASS하거나, 실패한 gate와 재현 가능한 원인이 보고서에 남는다.

- [ ] **Step 5: 확정 수치의 공식 문서와 설정만 커밋한다**

```bash
git add lib/balance/campaign-balance.ts docs/systems/CHARACTER_POOL_AND_WORLDTURN.md docs/systems/DUNGEON_EVENTS_AND_BOSSES.md
git commit -m "밸런스: 캠페인 손실 원인을 보정한다" -m "200시드 손실 판정에 따라 단일 공통 축만 조정한다. 확정 수치와 적용 범위를 공식 시스템 문서에 고정한다."
```

문서가 실제로 변경된 파일만 `git add`한다. `docs/technical/BACKTEST_REPORT.md`는 절대 stage하지 않는다.

### Task 6: 전체 회귀와 calibration 결과를 검증한다

**Files:**
- Modify: 필요한 테스트 파일만
- Modify: `docs/technical/BACKTEST_REPORT.md` (생성물, 커밋 제외)

- [ ] **Step 1: 전체 단위 테스트를 실행한다**

Run: `node /Users/danny/MakeBun/Dungeon_Schemer/node_modules/vitest/vitest.mjs run`

Expected: PASS

- [ ] **Step 2: 타입검사와 production build를 실행한다**

Run: `./node_modules/.bin/tsc --noEmit`

Expected: PASS

Run: `./node_modules/.bin/next build`

Expected: PASS

- [ ] **Step 3: 최종 200시드 보고서를 재생성하고 결정성을 확인한다**

동일한 `B1_SOURCE_REVISION`과 200시드 명령을 두 번 실행한다. 두 결과의 source revision, 설정 revision, source totals, verdict, 모든 gate가 같음을 `git diff --no-index`로 확인한다. 생성 보고서는 커밋하지 않는다.

- [ ] **Step 4: 검증 변경이 있다면 커밋한다**

```bash
git add lib/backtest
git commit -m "테스트: 손실 보정 회귀를 검증한다" -m "손실 원장과 단일 축 보정이 기존 B1 gate를 유지하는지 회귀 검증한다."
```

테스트 코드 변경이 없으면 커밋하지 않는다.
