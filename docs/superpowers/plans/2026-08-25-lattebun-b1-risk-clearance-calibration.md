# B1 위험도별 던전 클리어율 보정 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실제 Campaign Store 백테스트에 첫 시도·초기 위험도별 던전 클리어율 gate를 추가하고, 같은 시드의 calibration으로 ★1 80~90%에서 ★5 20~30%까지 내려가는 승인된 난이도 곡선을 만든다.

**Architecture:** 기존 `campaign-driver`가 원정별 초기/현재 위험도와 시도 번호, 종료 상태를 원시 trace로 기록하고 `metrics`가 첫 시도·전체 시도·최종 통과 funnel을 계산한다. `acceptance`는 기회주의적 균형·정확도 0.7의 목표 곡선과 최소 표본을 판정하며 `report`와 backtest runner는 50/100시드 관찰, 200시드 calibration gate, 승인 뒤 2,000시드 holdout을 분리한다. 프로덕션 전투는 `CAMPAIGN_BALANCE`의 초기 위험도별 공통 보스 배율만 읽는다.

**Tech Stack:** TypeScript, Vitest, Zustand Campaign Store, pnpm, Markdown

**Spec:** `docs/superpowers/specs/2026-08-25-lattebun-b1-risk-clearance-calibration-design.md`

## Global Constraints

- 주지표는 `opportunist@0.7`의 `attemptNumber === 1` 원정을 초기 위험도별로 집계한 클리어율이다.
- 목표 구간은 ★1 `0.80~0.90`, ★2 `0.65~0.75`, ★3 `0.50~0.60`, ★4 `0.35~0.45`, ★5 `0.20~0.30`이며 경계를 포함한다.
- 첫 시도에서 `cleared`, `wiped`, `interrupted`를 모두 시작 분모에 포함한다.
- 최종 calibration의 위험도별 최소 표본은 30, holdout 최소 표본은 300이다.
- 50·100시드는 관찰 전용이고 200·2,000시드만 위험도별 acceptance를 강제한다.
- 보스 배율 후보는 `0.20~1.20` 범위의 `0.025` 격자만 사용한다.
- 첫 calibration은 보스 배율만 바꾸며 일반 몬스터, 월드턴, 조언 압력, 상인·회복, 승급·보상·엔딩 수치를 바꾸지 않는다.
- 보스 전 실패 몫이 보스 실패 몫보다 크거나 평균 보스 진입 HP 비율이 `0.70` 미만이면 해당 위험도 보정은 중단한다.
- 테마별·보스별 별도 배율을 추가하지 않는다.
- 기존 B1-B 완주율·전멸·정확도·배신·무결성 gate를 제거하거나 완화하지 않는다.
- holdout은 최종 calibration과 설정 revision에 대한 사용자 승인 전까지 실행하지 않는다.
- 같은 revision·시드·전략·정확도는 같은 trace, 집계, 보고서를 생성해야 한다.
- 커밋 메시지는 제목과 본문을 모두 한글로 작성한다.
- 사용자 소유 미추적 에셋 파일은 스테이징하거나 수정하지 않는다.

---

### Task 1: 원정 trace에 시도와 종료 의미를 완전하게 기록한다

**Files:**
- Modify: `lib/backtest/campaign-driver.ts`
- Modify: `lib/backtest/campaign-driver.test.ts`
- Modify: `lib/backtest/metrics.test.ts`
- Modify: `lib/backtest/acceptance.test.ts`

**Interfaces:**
- Consumes: `CampaignDungeon.initialRiskLevel`, `CampaignDungeon.riskLevel`, `CampaignDungeon.attempts`, 기존 `runCampaign(options)`
- Produces:

```ts
export type ExpeditionTraceResult = ExpeditionStatus | "interrupted";

export interface ExpeditionBalanceTrace {
  readonly expeditionId: string;
  readonly dungeonId: DungeonId;
  readonly theme: ThemeId;
  readonly initialRiskLevel: RiskLevel;
  readonly currentRiskLevel: RiskLevel;
  readonly attemptNumber: number;
  readonly startAdvicePressure: 0;
  readonly maxAdvicePressure: AdvicePressure;
  readonly bossEntry: null | {
    readonly advicePressure: AdvicePressure;
    readonly aliveCount: number;
    readonly hp: number;
    readonly maxHp: number;
  };
  readonly endAdvicePressure: AdvicePressure | null;
  readonly result: ExpeditionTraceResult;
}
```

- [ ] **Step 1: 첫 시도·재도전과 중단 결과를 요구하는 실패 테스트를 쓴다**

`lib/backtest/campaign-driver.test.ts`의 balance trace 테스트를 다음 계약으로 확장한다.

```ts
it("원정마다 초기·현재 위험도와 던전별 시도 번호를 기록한다", () => {
  const result = runCampaign({
    seed: "driver-balance-trace",
    strategy: createStrategy("survival"),
    accuracy: 0.7,
  });
  if (!result.ok) throw new Error(`${result.errorKind}: ${result.message}`);

  const attempts = new Map<string, number>();
  for (const expedition of result.trace.balanceExpeditions) {
    const expected = (attempts.get(expedition.dungeonId) ?? 0) + 1;
    expect(expedition.attemptNumber).toBe(expected);
    expect(expedition.currentRiskLevel).toBeGreaterThanOrEqual(expedition.initialRiskLevel);
    attempts.set(expedition.dungeonId, expected);
  }
});

it("step limit로 끝난 시작 원정을 interrupted로 보존한다", () => {
  const result = runCampaign({
    seed: "driver-interrupted-trace",
    strategy: createStrategy("survival"),
    accuracy: 0.7,
    stepLimit: 3,
  });

  expect(result.ok).toBe(false);
  expect(result.trace.balanceExpeditions).toHaveLength(1);
  expect(result.trace.balanceExpeditions[0]).toMatchObject({
    attemptNumber: 1,
    result: "interrupted",
  });
});
```

모든 `CampaignRunMetrics` fixture의 원정에 `currentRiskLevel`과 `attemptNumber`를 추가하고 공개 trace의 `result: null` 사용을 제거한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run lib/backtest/campaign-driver.test.ts lib/backtest/metrics.test.ts lib/backtest/acceptance.test.ts`

Expected: FAIL — 새 필드가 없고 중단된 trace의 `result`가 `null`이다.

- [ ] **Step 3: mutable trace와 공개 trace의 경계를 구현한다**

`campaign-driver.ts` 내부 mutable 타입만 `result: ExpeditionTraceResult | null`을 허용한다. 원정 시작 직후 값을 다음처럼 기록한다.

```ts
trace.balanceExpeditions.push({
  expeditionId,
  dungeonId: active.expedition.dungeonId,
  theme: dungeon.theme,
  initialRiskLevel: dungeon.initialRiskLevel,
  currentRiskLevel: dungeon.riskLevel,
  attemptNumber: dungeon.attempts + 1,
  startAdvicePressure: 0,
  maxAdvicePressure: active.expedition.advicePressure,
  bossEntry: null,
  endAdvicePressure: null,
  result: null,
});
```

`freezeTrace`에서 아직 `null`인 결과를 `interrupted`로 바꾸고, 활성 원정이 있으면 종료 압력도 보존한다. 성공·실패 반환 모두 같은 freeze 경로를 사용한다.

```ts
function freezeTrace(
  trace: MutableTrace,
  active: ActiveExpeditionContext | null,
): CampaignRunTrace {
  return {
    ...trace,
    balanceExpeditions: trace.balanceExpeditions.map((expedition) => ({
      ...expedition,
      endAdvicePressure: expedition.endAdvicePressure
        ?? (active?.expeditionId === expedition.expeditionId
          ? active.expedition.advicePressure
          : null),
      result: expedition.result ?? "interrupted",
      bossEntry: expedition.bossEntry === null ? null : { ...expedition.bossEntry },
    })),
  };
}
```

- [ ] **Step 4: driver와 기존 fixture 테스트를 통과시킨다**

Run: `pnpm vitest run lib/backtest/campaign-driver.test.ts lib/backtest/metrics.test.ts lib/backtest/acceptance.test.ts`

Expected: PASS

- [ ] **Step 5: 타입검사를 실행한다**

Run: `pnpm typecheck`

Expected: PASS

- [ ] **Step 6: 커밋한다**

```bash
git add lib/backtest/campaign-driver.ts lib/backtest/campaign-driver.test.ts lib/backtest/metrics.test.ts lib/backtest/acceptance.test.ts
git commit -m "백테스트: 원정 시도와 중단 결과를 기록한다" -m "초기·현재 위험도와 던전별 시도 번호를 trace에 남긴다. 정산 전에 끝난 원정도 interrupted로 보존해 클리어율 분모에서 누락되지 않게 한다."
```

---

### Task 2: 위험도별 원정 funnel을 손계산 가능한 집계로 만든다

**Files:**
- Modify: `lib/backtest/metrics.ts`
- Modify: `lib/backtest/metrics.test.ts`

**Interfaces:**
- Consumes: Task 1의 `ExpeditionBalanceTrace`
- Produces:

```ts
export interface ExpeditionFunnel {
  readonly starts: number;
  readonly bossEntries: number;
  readonly clears: number;
  readonly wipes: number;
  readonly interrupted: number;
  readonly preBossFailures: number;
  readonly bossFailures: number;
  readonly clearRate: number | null;
  readonly bossReachRate: number | null;
  readonly bossConversionRate: number | null;
  readonly meanBossEntryHpRatio: number | null;
  readonly meanBossEntryAliveCount: number | null;
  readonly clearRateWilson95: WilsonInterval | null;
}

export interface EventualDungeonRate {
  readonly attemptedDungeons: number;
  readonly clearedDungeons: number;
  readonly clearRate: number | null;
  readonly clearRateWilson95: WilsonInterval | null;
}

export interface CombinationAggregate {
  // 기존 필드 유지
  readonly firstAttemptByInitialRisk: Readonly<Record<RiskLevel, ExpeditionFunnel>>;
  readonly allAttemptsByCurrentRisk: Readonly<Record<RiskLevel, ExpeditionFunnel>>;
  readonly eventualDungeonByInitialRisk: Readonly<Record<RiskLevel, EventualDungeonRate>>;
  readonly firstAttemptByThemeRisk: Readonly<Record<string, ExpeditionFunnel>>;
}
```

- [ ] **Step 1: 첫 시도·재도전·중단을 구분하는 손계산 실패 테스트를 쓴다**

`metrics.test.ts`에 하나의 초기 ★2 던전이 첫 시도 전멸 후 현재 ★3 재도전에서
클리어되고, 다른 초기 ★2 던전이 보스 전 중단되는 fixture를 추가한다.

```ts
expect(combination.firstAttemptByInitialRisk[2]).toMatchObject({
  starts: 2,
  bossEntries: 1,
  clears: 0,
  wipes: 1,
  interrupted: 1,
  preBossFailures: 1,
  bossFailures: 1,
  clearRate: 0,
  bossReachRate: 0.5,
  bossConversionRate: 0,
});
expect(combination.allAttemptsByCurrentRisk[3]).toMatchObject({
  starts: 1,
  clears: 1,
  clearRate: 1,
});
expect(combination.eventualDungeonByInitialRisk[2]).toMatchObject({
  attemptedDungeons: 2,
  clearedDungeons: 1,
  clearRate: 0.5,
});
```

보스 진입 `hp/maxHp`, 생존 인원 평균과 `wilsonInterval(clears, starts)`도 fixture의
정확한 값으로 검사한다.

- [ ] **Step 2: 잘못된 trace 불변식의 실패 테스트를 쓴다**

다음 경우를 `it.each`로 넣는다.

```ts
[
  ["시도 번호 0", { attemptNumber: 0 }],
  ["위험도 누락", { currentRiskLevel: Number.NaN }],
  ["보스 없이 cleared", { bossEntry: null, result: "cleared" }],
]
```

같은 run·dungeon의 attempt 번호가 `1, 3`으로 건너뛰는 fixture도 집계 오류를 기대한다.

- [ ] **Step 3: 실패를 확인한다**

Run: `pnpm vitest run lib/backtest/metrics.test.ts`

Expected: FAIL — funnel 타입과 집계 필드가 없다.

- [ ] **Step 4: 원정 검증과 funnel 집계를 최소 구현한다**

`RISK_LEVELS`를 `[1, 2, 3, 4, 5] as const`로 고정하고, 분모가 0인 모든 비율과
Wilson 구간은 `null`을 반환한다.

```ts
function finalizeFunnel(entries: readonly ExpeditionBalanceTrace[]): ExpeditionFunnel {
  const starts = entries.length;
  const bossEntries = entries.filter((entry) => entry.bossEntry !== null);
  const clears = entries.filter((entry) => entry.result === "cleared").length;
  const wipes = entries.filter((entry) => entry.result === "wiped").length;
  const interrupted = entries.filter((entry) => entry.result === "interrupted").length;
  return {
    starts,
    bossEntries: bossEntries.length,
    clears,
    wipes,
    interrupted,
    preBossFailures: starts - bossEntries.length,
    bossFailures: bossEntries.length - clears,
    clearRate: starts === 0 ? null : clears / starts,
    bossReachRate: starts === 0 ? null : bossEntries.length / starts,
    bossConversionRate: bossEntries.length === 0 ? null : clears / bossEntries.length,
    meanBossEntryHpRatio: meanOrNull(bossEntries.map(({ bossEntry }) => bossEntry!.hp / bossEntry!.maxHp)),
    meanBossEntryAliveCount: meanOrNull(bossEntries.map(({ bossEntry }) => bossEntry!.aliveCount)),
    clearRateWilson95: starts === 0 ? null : wilsonInterval(clears, starts),
  };
}
```

첫 시도는 `attemptNumber === 1`, 전체 시도는 `currentRiskLevel`, 최종 통과는 같은
run 안에서 `dungeonId`별로 묶어 한 번이라도 `cleared`인지 계산한다. 모든 위험도
Record는 표본이 없어도 키 1~5를 가진다.

- [ ] **Step 5: 집계 테스트를 통과시킨다**

Run: `pnpm vitest run lib/backtest/metrics.test.ts`

Expected: PASS

- [ ] **Step 6: 관련 백테스트 테스트와 타입검사를 실행한다**

Run: `pnpm vitest run lib/backtest && pnpm typecheck`

Expected: PASS

- [ ] **Step 7: 커밋한다**

```bash
git add lib/backtest/metrics.ts lib/backtest/metrics.test.ts
git commit -m "백테스트: 위험도별 원정 성공 funnel을 집계한다" -m "첫 시도와 전체 시도, 최종 던전 통과를 분리한다. 보스 전 실패와 보스 실패, 표본 없는 비율과 Wilson 구간도 명시적으로 계산한다."
```

---

### Task 3: 위험도별 목표와 최소 표본을 acceptance gate로 고정한다

**Files:**
- Modify: `lib/backtest/acceptance.ts`
- Modify: `lib/backtest/acceptance.test.ts`

**Interfaces:**
- Consumes: Task 2의 `CombinationAggregate.firstAttemptByInitialRisk`
- Produces:

```ts
export const B1B_RISK_CLEARANCE_TARGETS: Readonly<Record<RiskLevel, readonly [number, number]>>;

export interface B1BAcceptanceContext {
  readonly mode: "calibration" | "holdout";
  readonly seedsPerCombination: 2 | 50 | 100 | 200 | 2000;
}

export interface B1BAcceptanceGate {
  readonly id:
    | `completion-rate:${CombinationId}`
    | `completed-wipe-mean:${CombinationId}`
    | `first-attempt-clear-rate:opportunist@0.7:risk-${RiskLevel}`
    | "first-attempt-clear-rate:opportunist@0.7:monotonic";
  readonly passed: boolean;
  readonly enforced: boolean;
  readonly evidence: string;
}

export function evaluateB1BAcceptance(
  aggregate: BacktestAggregate,
  context?: B1BAcceptanceContext,
): readonly B1BAcceptanceGate[];
```

- [ ] **Step 1: 목표의 하한·상한과 단조성을 검증하는 실패 테스트를 쓴다**

100개의 `opportunist@0.7` run에 위험도 1~5 첫 시도 fixture를 넣어 각 경계의 정확한
성공 개수를 만든다.

```ts
expect(B1B_RISK_CLEARANCE_TARGETS).toEqual({
  1: [0.80, 0.90],
  2: [0.65, 0.75],
  3: [0.50, 0.60],
  4: [0.35, 0.45],
  5: [0.20, 0.30],
});

const gates = evaluateB1BAcceptance(aggregateAtRiskRates([0.80, 0.65, 0.50, 0.35, 0.20]), {
  mode: "calibration",
  seedsPerCombination: 200,
});
expect(gates.filter((gate) => gate.id.startsWith("first-attempt"))
  .every((gate) => gate.enforced && gate.passed)).toBe(true);
```

상한 fixture도 통과하고, 목표 밖 값과 위험도 역전은 실패하도록 검사한다.
기존 완주율·전멸 경계 테스트의 `gates.every(...)`는 새 관찰 gate까지 우연히
통과한다고 가정하지 않도록 다음처럼 기존 gate만 명시적으로 검사한다.

```ts
const legacyGates = gates.filter((gate) =>
  gate.id.startsWith("completion-rate:")
  || gate.id.startsWith("completed-wipe-mean:"),
);
expect(legacyGates.every((gate) => gate.passed)).toBe(true);
```

- [ ] **Step 2: 관찰 단계와 최소 표본 실패 테스트를 쓴다**

```ts
expect(evaluateB1BAcceptance(aggregate, {
  mode: "calibration",
  seedsPerCombination: 100,
}).filter(isRiskGate).every((gate) => gate.enforced === false)).toBe(true);

expect(evaluateB1BAcceptance(aggregateWith29RiskFiveSamples, {
  mode: "calibration",
  seedsPerCombination: 200,
}).find((gate) => gate.id.endsWith("risk-5"))).toMatchObject({
  enforced: true,
  passed: false,
  evidence: expect.stringContaining("표본 29/최소 30"),
});
```

holdout fixture는 299/300 경계를 각각 실패/통과시킨다.

- [ ] **Step 3: 실패를 확인한다**

Run: `pnpm vitest run lib/backtest/acceptance.test.ts`

Expected: FAIL — 위험도 target, context, `enforced` 필드가 없다.

- [ ] **Step 4: acceptance를 최소 구현한다**

```ts
export const B1B_RISK_CLEARANCE_TARGETS = {
  1: [0.80, 0.90],
  2: [0.65, 0.75],
  3: [0.50, 0.60],
  4: [0.35, 0.45],
  5: [0.20, 0.30],
} as const satisfies Readonly<Record<RiskLevel, readonly [number, number]>>;

function riskGatePolicy(context: B1BAcceptanceContext) {
  if (context.mode === "holdout") return { enforced: true, minimumSamples: 300 };
  if (context.seedsPerCombination === 200) return { enforced: true, minimumSamples: 30 };
  return { enforced: false, minimumSamples: 0 };
}
```

관찰 단계도 `passed`에는 현재 값이 구간 안인지 기록하되 `enforced: false`로 반환한다.
분모 0이나 최소 표본 미달은 강제 단계에서 반드시 실패한다. 기존 완주율·전멸 gate도
같은 context를 받아 `enforced`를 표시하되 수치와 경계를 바꾸지 않는다. 기존 호출부가
이 Task에서 깨지지 않도록 생략된 context는
`{ mode: "calibration", seedsPerCombination: 50 }`로 해석한다. Task 4와 5에서 모든
프로덕션 호출부가 실제 context를 넘긴 뒤에도 이 기본값은 단위 fixture 호환용으로
남긴다.

- [ ] **Step 5: acceptance 테스트를 통과시킨다**

Run: `pnpm vitest run lib/backtest/acceptance.test.ts`

Expected: PASS

- [ ] **Step 6: 타입검사를 실행한다**

Run: `pnpm typecheck`

Expected: PASS

- [ ] **Step 7: 현재 Task 파일만 커밋한다**

```bash
git add lib/backtest/acceptance.ts lib/backtest/acceptance.test.ts
git commit -m "백테스트: 위험도별 클리어율 gate를 고정한다" -m "균형 전략 정확도 0.7의 위험도별 목표와 최소 표본을 정의한다. 관찰 단계와 최종 calibration 및 holdout 판정을 구분한다."
```

---

### Task 4: 위험도별 funnel과 gate를 결정적 보고서에 표시한다

**Files:**
- Modify: `lib/backtest/report.ts`
- Modify: `lib/backtest/report.test.ts`

**Interfaces:**
- Consumes: Task 2의 위험도별 집계, Task 3의 `evaluateB1BAcceptance(aggregate, context)`
- Produces:

```ts
export interface BacktestReportInput {
  readonly mode: "calibration" | "holdout";
  readonly namespace: "b1b-calibration-v1" | "b1b-holdout-v1";
  readonly seedsPerCombination?: 2 | 50 | 100 | 200 | 2000;
  readonly sourceRevision: string;
  readonly aggregate: BacktestAggregate;
  readonly fixedGates: readonly FixedGateResult[];
}
```

- [ ] **Step 1: 새 보고서 표와 OBSERVE 상태를 요구하는 실패 테스트를 쓴다**

기존 report fixture 입력에 `seedsPerCombination: 2`를 추가하고 다음을 검사한다.

```ts
expect(first).toContain("## 초기 위험도별 첫 시도 던전 funnel");
expect(first).toContain("## 현재 위험도별 전체 시도와 최종 통과");
expect(first).toContain("첫 시도 표본");
expect(first).toContain("보스 전 실패");
expect(first).toContain("보스 실패");
expect(first).toContain("Wilson 95%");
expect(first).toContain("OBSERVE");
```

입력 run 순서를 뒤집어도 Markdown 전체가 같은 기존 결정성 검사도 유지한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run lib/backtest/report.test.ts`

Expected: FAIL — 새 표와 sample context가 없다.

- [ ] **Step 3: 보고서 렌더링을 구현한다**

gate 표시는 다음 규칙을 사용한다.

```ts
function gateStatus(gate: B1BAcceptanceGate): "PASS" | "FAIL" | "OBSERVE" {
  if (!gate.enforced) return "OBSERVE";
  return gate.passed ? "PASS" : "FAIL";
}
```

첫 시도 표는 전략·정확도·초기 위험도 순서, 전체 시도 표는 전략·정확도·현재
위험도 순서, 테마 drill-down은 전략·정확도·초기 위험도·테마 순서로 정렬한다.
`null` 비율과 구간은 `—`로 표시하고 0으로 바꾸지 않는다. 기존 보스 표와 새 funnel
표가 같은 정보를 중복하면 기존 표를 새 테마 drill-down 표로 대체한다. runner가
연결되기 전의 단위 fixture 호환을 위해 생략된 `seedsPerCombination`은
`input.aggregate.runs.length / 6`으로 계산하고 허용된 표본 수인지 검증한다.

- [ ] **Step 4: 보고서 테스트와 타입검사를 통과시킨다**

Run: `pnpm vitest run lib/backtest/report.test.ts && pnpm typecheck`

Expected: PASS

- [ ] **Step 5: 커밋한다**

```bash
git add lib/backtest/report.ts lib/backtest/report.test.ts
git commit -m "백테스트: 위험도별 던전 funnel을 보고한다" -m "첫 시도와 전체 시도, 최종 통과와 실패 위치를 결정적 Markdown으로 표시한다. 관찰 단계 gate는 PASS나 FAIL 대신 OBSERVE로 구분한다."
```

---

### Task 5: 200시드 calibration과 holdout에서 acceptance를 강제한다

**Files:**
- Modify: `lib/backtest/backtest.run.ts`
- Modify: `lib/backtest/backtest.run.test.ts`

**Interfaces:**
- Consumes: Task 3의 `B1BAcceptanceGate.enforced`, Task 4의 `BacktestReportInput.seedsPerCombination`
- Produces:

```ts
export function shouldFailBacktest(
  fixedGates: readonly FixedGateResult[],
  acceptanceGates: readonly B1BAcceptanceGate[],
): boolean;
```

- [ ] **Step 1: 실행 종료 판정의 실패 테스트를 쓴다**

```ts
it("고정 gate 실패는 관찰 단계에서도 실행을 실패시킨다", () => {
  expect(shouldFailBacktest(
    [{ id: "no-run-errors", passed: false, evidence: "1건" }],
    [],
  )).toBe(true);
});

it("OBSERVE acceptance 실패는 실행을 실패시키지 않는다", () => {
  expect(shouldFailBacktest([], [{
    id: "first-attempt-clear-rate:opportunist@0.7:risk-1",
    passed: false,
    enforced: false,
    evidence: "관찰",
  }])).toBe(false);
});

it("강제 acceptance 실패는 실행을 실패시킨다", () => {
  expect(shouldFailBacktest([], [{
    id: "first-attempt-clear-rate:opportunist@0.7:risk-1",
    passed: false,
    enforced: true,
    evidence: "기준 이탈",
  }])).toBe(true);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run lib/backtest/backtest.run.test.ts`

Expected: FAIL — `shouldFailBacktest`가 없다.

- [ ] **Step 3: runner 판정을 구현한다**

```ts
export function shouldFailBacktest(
  fixedGates: readonly FixedGateResult[],
  acceptanceGates: readonly B1BAcceptanceGate[],
): boolean {
  return fixedGates.some((gate) => !gate.passed)
    || acceptanceGates.some((gate) => gate.enforced && !gate.passed);
}
```

`runCli`는 `seedsPerCombination`을 report와 acceptance context에 전달하고,
`shouldFailBacktest` 결과로 `process.exitCode`를 설정한다. 승인 전 holdout 차단은
그대로 유지한다. 이 Task에서 `BacktestReportInput.seedsPerCombination`을 필수
필드로 바꾸고 모든 호출부와 fixture가 명시적으로 값을 넘기게 한다.

- [ ] **Step 4: runner, report, acceptance 테스트와 타입검사를 통과시킨다**

Run: `pnpm vitest run lib/backtest/backtest.run.test.ts lib/backtest/report.test.ts lib/backtest/acceptance.test.ts && pnpm typecheck`

Expected: PASS

- [ ] **Step 5: 커밋한다**

```bash
git add lib/backtest/backtest.run.ts lib/backtest/backtest.run.test.ts
git commit -m "백테스트: 단계별 acceptance 실행 판정을 연결한다" -m "고정 무결성 실패는 즉시 실패시키고 50·100시드 관찰 gate는 종료 코드에 반영하지 않는다. 200시드와 holdout의 강제 gate만 실행 결과에 반영한다."
```

---

### Task 6: 보스 배율 탐색 범위와 격자를 설정 계약으로 검증한다

**Files:**
- Modify: `lib/balance/campaign-balance.ts`
- Modify: `lib/balance/campaign-balance.test.ts`
- Modify: `lib/rules/boss-battle-adapter.test.ts`

**Interfaces:**
- Produces:

```ts
export const BOSS_MULTIPLIER_CALIBRATION = {
  min: 0.20,
  max: 1.20,
  step: 0.025,
} as const;

export function validateCampaignBalance(balance: CampaignBalance): void;
```

- [ ] **Step 1: 범위·격자·위험도 키의 실패 테스트를 쓴다**

`campaign-balance.test.ts`에서 현재 설정이 검증을 통과하고 다음 값이 각각 실패하는지
검사한다.

```ts
it.each([0.199, 1.201, 0.81, Number.NaN, Number.POSITIVE_INFINITY])(
  "보스 배율 %p를 calibration 계약으로 거부한다",
  (multiplier) => {
    expect(() => validateCampaignBalance({
      ...CAMPAIGN_BALANCE,
      bossBaseStatMultiplierByInitialRisk: {
        ...CAMPAIGN_BALANCE.bossBaseStatMultiplierByInitialRisk,
        3: multiplier,
      },
    })).toThrow();
  },
);
```

키 5가 없는 fixture와 0 이하 배율도 별도로 실패시킨다.

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run lib/balance/campaign-balance.test.ts`

Expected: FAIL — calibration 계약과 검증 함수가 없다.

- [ ] **Step 3: 검증 함수를 구현하고 현재 설정을 모듈 로드 때 검증한다**

격자 판정은 부동소수 오차를 허용한다.

```ts
function isCalibrationStep(value: number): boolean {
  const steps = (value - BOSS_MULTIPLIER_CALIBRATION.min)
    / BOSS_MULTIPLIER_CALIBRATION.step;
  return Math.abs(steps - Math.round(steps)) < 1e-9;
}
```

위험도 1~5 키가 정확히 존재하고 각 값이 유한·양수·범위·격자를 만족하는지
검사한다. `CAMPAIGN_BALANCE` 선언 직후 `validateCampaignBalance(CAMPAIGN_BALANCE)`를
호출한다. 나머지 worldTurn, pressure, bossInfo 검증은 기존 테스트를 유지한다.

- [ ] **Step 4: 보스 설정과 adapter 회귀 테스트를 통과시킨다**

Run: `pnpm vitest run lib/balance/campaign-balance.test.ts lib/rules/boss-battle-adapter.test.ts`

Expected: PASS

- [ ] **Step 5: 타입검사를 실행한다**

Run: `pnpm typecheck`

Expected: PASS

- [ ] **Step 6: 커밋한다**

```bash
git add lib/balance/campaign-balance.ts lib/balance/campaign-balance.test.ts lib/rules/boss-battle-adapter.test.ts
git commit -m "밸런스: 보스 배율 calibration 계약을 검증한다" -m "위험도별 보스 배율의 허용 범위와 0.025 격자를 고정한다. 잘못된 키와 유한하지 않은 값을 실행 전에 거부한다."
```

---

### Task 7: 동일 calibration 시드로 위험도별 보스 배율을 조정한다

**Files:**
- Modify: `lib/balance/campaign-balance.ts`
- Modify: `lib/balance/campaign-balance.test.ts`
- Regenerate: `docs/technical/BACKTEST_REPORT.md`

**Interfaces:**
- Consumes: `pnpm backtest:structure`, `pnpm backtest:tune`, `pnpm backtest:quick`
- Produces: `CAMPAIGN_BALANCE.revision = "b1b-risk-curve-v1"`과 승인 후보 다섯 배율

- [ ] **Step 1: 현재 수치로 50시드 기준 보고서를 생성한다**

Run: `pnpm backtest:structure`

Expected: 실행 오류 0건. 새 보고서의 위험도 gate는 `OBSERVE`이며 ★1~5의 첫 시도
표본, 클리어율, 보스 전 실패, 보스 실패, 진입 HP가 모두 표시된다.

- [ ] **Step 2: 각 위험도의 변경 방향을 표에서 판정한다**

★1부터 순서대로 다음 결정표를 적용한다.

| 상태 | 조치 |
| --- | --- |
| 클리어율이 목표 상한보다 높음 | 해당 배율 `+0.050` |
| 클리어율이 목표 하한보다 낮고 보스 실패 몫이 더 크며 진입 HP ≥ 0.70 | 해당 배율 `-0.050` |
| 클리어율이 목표 구간 안 | 해당 위험도 잠금 |
| 보스 전 실패 몫이 더 크거나 진입 HP < 0.70 | 수치 변경 중단, 일반 구간 후속 설계 보고 |

변경값은 `0.20~1.20`과 `0.025` 격자를 벗어나지 않는다. 한 번에 한 위험도만
바꾸고 `campaign-balance.test.ts`의 기대값도 같은 변경으로 갱신한다.

- [ ] **Step 3: 각 후보를 50시드로 재측정한다**

Run: `pnpm backtest:structure`

Expected: 고정 무결성 gate PASS. 목표를 지나치면 직전 값과 현재 값 사이에서
`0.025` 단위로 되돌려 재실행한다. 같은 위험도가 목표 구간에 들어오면 잠그고 다음
위험도로 이동한다.

- [ ] **Step 4: 다섯 위험도의 50시드 후보를 100시드로 확인한다**

Run: `pnpm backtest:tune`

Expected: 실행 오류 0건. 100시드 결과가 목표 밖이면 Step 2의 같은 결정표를
`0.025` 단위로 적용하고 다시 `pnpm backtest:tune`을 실행한다.

- [ ] **Step 5: 100시드 후보를 코드 revision으로 고정하고 커밋한다**

`CAMPAIGN_BALANCE.revision`을 `b1b-risk-curve-v1`로 바꾸고 선택된 다섯 값과 테스트
기대값을 일치시킨다.

```bash
git add lib/balance/campaign-balance.ts lib/balance/campaign-balance.test.ts
git commit -m "밸런스: 위험도별 보스 난이도 곡선을 조정한다" -m "동일 calibration 시드의 첫 시도 클리어율을 기준으로 다섯 위험도의 공통 보스 배율을 고정한다. 일반 구간과 다른 밸런스 축은 유지한다."
```

- [ ] **Step 6: 커밋 revision으로 200시드 최종 calibration을 실행한다**

Run: `pnpm backtest:quick`

Expected: 위험도별 첫 시도 표본이 각각 30 이상이고 새 위험도 gate, 기존 B1-B
완주율·전멸 gate, 고정 무결성 gate가 모두 PASS.

실패하면 holdout으로 진행하지 않는다. 위험도 곡선만 실패했고 보스 조정 조건을
만족하면 Step 2로 돌아간다. 기존 완주율·전멸 gate 또는 일반 구간 중단 조건이
실패하면 측정 결과와 대표 시드를 사용자에게 보고하고 이 spec의 범위를 넓히지
않는다.

- [ ] **Step 7: 최종 calibration 보고서를 커밋한다**

```bash
git add docs/technical/BACKTEST_REPORT.md
git commit -m "문서: 위험도별 최종 calibration 결과를 기록한다" -m "200시드 기준 첫 시도 던전 funnel과 기존 캠페인 gate 결과를 고정된 balance revision과 함께 남긴다."
```

---

### Task 8: 공식 문서를 동결값과 맞추고 전체 검증한다

**Files:**
- Modify: `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`
- Modify: `docs/systems/PROGRESSION_AND_ENDINGS.md`
- Modify: `docs/README.md`
- Read: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

**Interfaces:**
- Consumes: Task 7의 최종 다섯 배율과 200시드 보고서
- Produces: holdout 전에 사용자가 검토할 동결된 공식 기준

- [ ] **Step 1: 보스 공식 문서에 목표 곡선과 적용 축을 기록한다**

`DUNGEON_EVENTS_AND_BOSSES.md`의 보스 규칙에 다음 표를 추가한다.

```markdown
| 초기 위험도 | ★1 | ★2 | ★3 | ★4 | ★5 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 균형·정확도 0.7 첫 시도 클리어율 | 80~90% | 65~75% | 50~60% | 35~45% | 20~30% |
```

이 목표가 보스 단독 승률이 아니라 첫 시도 던전 시작 전체를 분모로 하며, 보스
원형은 초기 위험도 공통 배율을 한 번만 받는다고 설명한다. Task 7에서 확정된 다섯
배율도 보고서 revision과 함께 기록한다.

- [ ] **Step 2: 진행·엔딩 공식 문서에 동시 gate를 기록한다**

`PROGRESSION_AND_ENDINGS.md`의 B1-B 백테스트 기준에 다음을 추가한다.

- 위험도 곡선은 기존 전략별 완주율·전멸 기준을 대체하지 않는다.
- 200시드 calibration 최소 30, 2,000시드 holdout 최소 300을 요구한다.
- 50·100시드는 관찰 전용이다.
- holdout 뒤 수치나 gate를 바꾸면 namespace를 폐기한다.

- [ ] **Step 3: README에 spec과 plan 링크가 모두 있는지 확인한다**

`docs/README.md`의 B1 목록에 다음 두 링크가 함께 있어야 한다.

```markdown
- [B1 위험도별 던전 클리어율 보정 설계](superpowers/specs/2026-08-25-lattebun-b1-risk-clearance-calibration-design.md)
- [B1 위험도별 던전 클리어율 보정 구현 계획](superpowers/plans/2026-08-25-lattebun-b1-risk-clearance-calibration.md)
```

배정표는 holdout 전이므로 B1 완료로 바꾸지 않는다.

- [ ] **Step 4: 문서 정합성을 검사한다**

Run: `rg -n "80~90|65~75|50~60|35~45|20~30|b1b-risk-curve-v1" docs/systems docs/technical/BACKTEST_REPORT.md docs/README.md`

Expected: 목표 곡선과 실제 revision이 공식 문서·보고서에서 일치한다.

- [ ] **Step 5: 전체 정적·단위 검증을 실행한다**

Run: `pnpm lint`

Expected: exit 0. 기존 경고는 개수와 종류를 기록하되 새 오류가 없어야 한다.

Run: `pnpm typecheck`

Expected: PASS

Run: `pnpm test`

Expected: PASS

Run: `pnpm build`

Expected: PASS

- [ ] **Step 6: 문서를 커밋한다**

```bash
git add docs/README.md docs/systems/DUNGEON_EVENTS_AND_BOSSES.md docs/systems/PROGRESSION_AND_ENDINGS.md
git commit -m "문서: 위험도별 던전 난이도 곡선을 동결한다" -m "첫 시도 클리어율 목표와 최종 보스 배율을 공식 규칙에 반영한다. 기존 캠페인 gate와 holdout 경계도 함께 명시한다."
```

- [ ] **Step 7: 사용자에게 calibration 승인을 요청하고 멈춘다**

다음을 함께 보고한다.

- 위험도별 첫 시도 표본·클리어율·Wilson 95% 구간
- 보스 전 실패 몫·보스 실패 몫·보스 진입 HP
- 기존 전략별 완주율·전멸 gate
- 최종 다섯 보스 배율과 revision
- lint·typecheck·test·build 결과

사용자가 명시적으로 승인하기 전에는 `B1B_HOLDOUT_APPROVED`를 바꾸거나
`pnpm backtest`를 실행하지 않는다.

---

### Task 9: 승인된 설정을 독립 holdout으로 한 번 검증한다

**Prerequisite:** Task 8의 calibration 결과와 설정 revision에 대한 사용자의 명시적 승인

**Files:**
- Modify: `lib/backtest/acceptance.ts`
- Modify: `lib/backtest/acceptance.test.ts`
- Modify: `lib/backtest/backtest.run.test.ts`
- Regenerate: `docs/technical/BACKTEST_REPORT.md`
- Modify on PASS only: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`
- Modify on PASS only: `docs/README.md`

**Interfaces:**
- Consumes: 동결된 `b1b-risk-curve-v1`, `b1b-holdout-v1`, 조합당 2,000시드
- Produces: B1 최종 판정

- [ ] **Step 1: 승인 상태의 실패 테스트를 먼저 바꾼다**

```ts
it("승인된 B1-B holdout 옵션을 연다", () => {
  expect(optionsFromEnvironment({
    B1_BACKTEST_MODE: "holdout",
    B1_BACKTEST_SEEDS: "2000",
  })).toMatchObject({
    mode: "holdout",
    seedsPerCombination: 2000,
    namespace: "b1b-holdout-v1",
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run lib/backtest/backtest.run.test.ts`

Expected: FAIL — holdout 승인 전 오류.

- [ ] **Step 3: 사용자 승인 사실을 주석에 기록하고 holdout을 연다**

`B1B_HOLDOUT_APPROVED = true`로 바꾸고 주석에 승인된 balance revision
`b1b-risk-curve-v1`과 승인 날짜를 기록한다. namespace와 gate는 바꾸지 않는다.

- [ ] **Step 4: 승인 테스트와 전체 백테스트 단위 테스트를 통과시킨다**

Run: `pnpm vitest run lib/backtest/backtest.run.test.ts lib/backtest/acceptance.test.ts`

Expected: PASS

- [ ] **Step 5: 승인 변경을 먼저 커밋한다**

```bash
git add lib/backtest/acceptance.ts lib/backtest/acceptance.test.ts lib/backtest/backtest.run.test.ts
git commit -m "백테스트: 승인된 B1-B holdout을 연다" -m "동결된 위험도 곡선과 balance revision을 b1b-holdout-v1에서 한 번 검증하도록 승인 상태를 기록한다."
```

- [ ] **Step 6: 독립 holdout을 한 번 실행한다**

Run: `pnpm backtest`

Expected: 조합당 2,000시드, 총 12,000캠페인이 실행되고 모든 고정·기존 B1-B·위험도
gate가 PASS. 위험도별 첫 시도 표본은 각각 300 이상이어야 한다.

실패하면 수치를 조정하거나 같은 namespace를 다시 사용하지 않는다. 실패 보고서와
대표 시드를 보존하고 `b1b-holdout-v1` 폐기 및 새 calibration 설계를 사용자에게
제안한다.

- [ ] **Step 7: PASS일 때만 B1 완료 문서를 갱신한다**

`CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`에서 B1을 완료 처리하고 실제 holdout 결과와
커밋을 기록한다. `docs/README.md`에도 최종 보고서와 Q1 선행 해제를 반영한다.

- [ ] **Step 8: 전체 검증을 다시 실행한다**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`

Expected: 모두 PASS. lint 기존 경고 외 새 오류 없음.

- [ ] **Step 9: holdout 보고서와 완료 상태를 커밋한다**

```bash
git add docs/technical/BACKTEST_REPORT.md docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md docs/README.md
git commit -m "문서: B1 위험도별 holdout 결과를 확정한다" -m "독립 12,000캠페인에서 위험도 곡선과 기존 B1-B gate 통과를 기록하고 B1을 완료 처리한다."
```

- [ ] **Step 10: 최종 변경 범위와 상태를 확인한다**

Run: `git status --short`

Expected: 사용자 소유 미추적 에셋 두 파일 외 이번 작업의 미커밋 변경 없음.

Run: `git log --oneline --decorate -12`

Expected: spec·plan·계측·집계·gate·보고서·설정·문서·holdout 커밋이 한글 제목과
본문으로 순서대로 남아 있다.
