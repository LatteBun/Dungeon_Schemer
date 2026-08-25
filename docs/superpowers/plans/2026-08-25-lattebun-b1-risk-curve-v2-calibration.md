# B1 위험도 곡선 v2 보정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `opportunist@0.7`의 초기 위험도별 첫 시도 클리어율을 ★1 85~90%에서 ★5 55~65%까지 엄격하게 감소하도록 보정하면서, 미해결 전체 캠페인 gate는 실제 실패값을 `OBSERVE`로 보존한다.

**Architecture:** `acceptance`가 `full-campaign`과 `risk-curve` focus별 강제 범위를 단일 gate 모델로 계산하고, `report`와 runner가 그 결과를 재판정 없이 전달한다. 새 runner namespace와 50·100·200 seed 명령으로 기존 calibration을 격리하며, production에서는 `CAMPAIGN_BALANCE.bossBaseStatMultiplierByInitialRisk`만 낮은 위험도부터 한 값씩 조정한다. 최종 200 seed 통과 뒤에만 balance revision과 공식 문서를 같은 변경 단위로 확정한다.

**Tech Stack:** TypeScript 5, Vitest 4, Zustand Campaign Store, pnpm 11, Markdown

**Spec:** `docs/superpowers/specs/2026-08-25-lattebun-b1-risk-curve-v2-calibration-design.md`

## Global Constraints

- 구현 전에 미커밋 상태인 B1 생존형 진행 정책 변경과 해당 spec·plan을 별도 한글 커밋으로 보존한다. 그 변경 없이 이 plan을 다른 worktree에서 시작하지 않는다.
- 구현 시작 시 `superpowers:using-git-worktrees`로 격리된 feature branch와 worktree를 만든다. 현재 세션처럼 `.git`이 읽기 전용이면 권한이 있는 세션으로 전환하기 전에는 구현을 시작하지 않는다.
- 주지표는 `opportunist@0.7`의 `attemptNumber === 1` 원정을 `initialRiskLevel`별로 집계한 클리어율이다.
- 목표 구간은 ★1 `0.85~0.90`, ★2 `0.78~0.85`, ★3 `0.70~0.78`, ★4 `0.62~0.70`, ★5 `0.55~0.65`이며 경계를 포함한다.
- 최종 200 seed에서 각 위험도 표본 30개 이상과 `★1 > ★2 > ★3 > ★4 > ★5`를 함께 요구한다.
- `risk-curve` focus는 `no-run-errors`와 `not-all-rank-s`를 모든 단계에서 강제하고, 위험도 곡선은 200 seed에서만 강제한다. 나머지 전체 캠페인 gate는 실제 성공·실패를 보존한 `OBSERVE`다.
- `full-campaign`은 기존 명령과 holdout 의미를 유지한다. `risk-curve` holdout은 입력 오류로 거부하고 이번 작업에서 holdout을 실행하지 않는다.
- 새 calibration namespace는 `b1-risk-curve-v2-calibration`이다. 기존 `b1b-calibration-v1`, `b1b-holdout-v1` seed와 섞지 않는다.
- 보스 배율 후보는 `0.20~1.20` 범위의 `0.025` 격자만 사용한다.
- production 수치는 `bossBaseStatMultiplierByInitialRisk`만 바꾼다. 일반 몬스터, 월드턴, 조언 압력, 회복·보상·신뢰·승급·전략은 바꾸지 않는다.
- 특정 위험도에서 `preBossFailures > bossFailures`이거나 `meanBossEntryHpRatio < 0.70`이면 보스 완화를 중단하고 해당 목표 미달을 보고한다.
- 최종 후보 우선순위는 목표 구간 중심과의 거리, 동률이면 현재 production 배율과의 거리다.
- 공식 Vitest 설정은 `.worktrees/**`, `.pnpm-store/**`, `node_modules/**`, `.next/**`를 수집하지 않는다.
- `docs/GAME_PRINCIPLES.md`는 원칙 변경이 아니므로 수정하지 않는다.
- 생성되는 `docs/technical/BACKTEST_REPORT.md`는 최종 200 seed 보고서만 커밋 대상으로 검토한다. 중간 후보 보고서는 덮어써도 커밋하지 않는다.
- 커밋 메시지는 제목과 본문을 모두 한글로 작성한다.
- `.pnpm-store/`와 `public/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/ASSET_MANIFEST.json`, `README.txt`를 수정하거나 스테이징하지 않는다.

## File Structure

| 파일 | 책임 |
| --- | --- |
| `lib/backtest/acceptance.ts` | v2 목표, focus별 캠페인·위험도 gate 정책, 최소 표본·엄격 감소·보스 축 중단 조건을 계산한다. |
| `lib/backtest/acceptance.test.ts` | 새 목표 경계, 역전·동률, 표본 29/30, focus별 강제 범위와 보스 축 중단 조건을 검증한다. |
| `lib/backtest/report.ts` | 고정 gate에도 `enforced`를 부여하고 acceptance와 같은 객체에서 `PASS`·`FAIL`·`OBSERVE`를 렌더링한다. |
| `lib/backtest/report.test.ts` | 실패한 관측 gate의 근거 보존, focus·namespace 출력과 결정성을 검증한다. |
| `lib/backtest/backtest.run.ts` | focus·namespace·mode 조합 검증, 단계별 gate 상태, CLI 실패 판정을 전달한다. |
| `lib/backtest/backtest.run.test.ts` | 기본 focus, 새 namespace, 잘못된 입력, risk holdout 거부, enforced-only 종료 판정을 검증한다. |
| `vitest.config.mts` | 기본 테스트에서 worktree와 pnpm store를 제외한다. |
| `vitest.backtest.config.ts` | backtest runner 수집에서도 worktree와 pnpm store를 제외한다. |
| `vitest-config.test.ts` | 두 Vitest 설정의 명시적 제외 목록을 고정한다. |
| `package.json` | risk-curve 전용 50·100·200 seed 명령을 제공한다. |
| `lib/balance/campaign-balance.ts` | 최종 선택된 초기 위험도별 보스 배율과 `b1-risk-curve-v2` revision을 소유한다. |
| `lib/balance/campaign-balance.test.ts` | 최종 보스 배율, 보존 축, 격자 계약과 calibration before/after를 검증한다. |
| `docs/technical/BACKTEST_REPORT.md` | 최종 200 seed의 focus, gate 상태, funnel, 잔여 캠페인 실패를 기록한다. |
| `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md` | 위험도별 첫 시도 목표와 최종 보스 배율을 공식화한다. |
| `docs/systems/PROGRESSION_AND_ENDINGS.md` | risk-curve 보정과 전체 캠페인 acceptance의 분리, holdout 미실행 상태를 기록한다. |
| `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md` | B1의 완료·잔여 조건을 최신 상태로 갱신한다. |
| `docs/technical/PROJECT_STATUS_2026-08-24.md` | 날짜가 박힌 상태 스냅샷에 후속 진행 기록을 추가하되 기존 기록을 덮어쓰지 않는다. |
| `docs/README.md` | 이 구현 plan과 최종 실행 명령을 색인한다. |

---

### Task 1: 위험도 곡선 v2 acceptance 계약을 테스트 우선으로 교체한다

**Files:**
- Modify: `lib/backtest/acceptance.ts:28-120`
- Modify: `lib/backtest/acceptance.test.ts:112-176`

**Interfaces:**
- Consumes: `BacktestAggregate.combinations["opportunist@0.7"].firstAttemptByInitialRisk`
- Produces:

```ts
export type BacktestFocus = "full-campaign" | "risk-curve";

export const B1_RISK_CURVE_V2_TARGETS = {
  1: [0.85, 0.90],
  2: [0.78, 0.85],
  3: [0.70, 0.78],
  4: [0.62, 0.70],
  5: [0.55, 0.65],
} as const satisfies Readonly<Record<RiskLevel, readonly [number, number]>>;

export interface B1BAcceptanceContext {
  readonly mode: "calibration" | "holdout";
  readonly seedsPerCombination: 2 | 50 | 100 | 200 | 2000;
  readonly focus?: BacktestFocus;
}
```

- [ ] **Step 1: 새 목표와 focus별 강제 범위를 요구하는 실패 테스트를 쓴다**

기존 `B1B_RISK_CLEARANCE_TARGETS` 기대를 제거하고 다음 계약을 추가한다. 위험도 fixture의 실패 원정도 `bossEntry`를 채워 보스 실패로 집계되게 하며 진입 HP 비율은 1로 둔다.

```ts
expect(B1_RISK_CURVE_V2_TARGETS).toEqual({
  1: [0.85, 0.90],
  2: [0.78, 0.85],
  3: [0.70, 0.78],
  4: [0.62, 0.70],
  5: [0.55, 0.65],
});

for (const rates of [
  [0.85, 0.78, 0.70, 0.62, 0.55],
  [0.90, 0.85, 0.78, 0.70, 0.65],
] as const) {
  const gates = evaluateB1BAcceptance(aggregateAtRiskRates(rates), {
    mode: "calibration",
    seedsPerCombination: 200,
    focus: "risk-curve",
  });
  expect(gates.filter(isRiskGate).every((gate) => gate.enforced && gate.passed)).toBe(true);
}
```

완주율·완주 전멸 gate가 `risk-curve` 200에서는 `enforced: false`, `full-campaign` 200에서는 `enforced: true`인지 함께 검증한다.

- [ ] **Step 2: acceptance 테스트가 과거 목표와 focus 미지원 때문에 실패하는지 확인한다**

Run:

```bash
pnpm exec vitest run lib/backtest/acceptance.test.ts
```

Expected: 새 상수 export 또는 focus별 `enforced` 기대가 맞지 않아 FAIL한다.

- [ ] **Step 3: 캠페인 gate와 위험도 gate 정책을 분리해 최소 구현한다**

```ts
function acceptancePolicy(context: B1BAcceptanceContext) {
  const focus = context.focus ?? "full-campaign";
  const finalCalibration = context.mode === "calibration" && context.seedsPerCombination === 200;
  const holdout = context.mode === "holdout";
  return {
    campaignEnforced: focus === "full-campaign" && (finalCalibration || holdout),
    riskEnforced: finalCalibration || holdout,
    minimumRiskSamples: holdout ? 300 : finalCalibration ? 30 : 0,
  } as const;
}
```

완주율·전멸 gate에는 `campaignEnforced`, 위험도 구간·엄격 감소 gate에는 `riskEnforced`를 사용한다. 목표 상수 참조를 전부 `B1_RISK_CURVE_V2_TARGETS`로 바꾼다.

- [ ] **Step 4: 보스 배율 축 중단 조건의 실패 테스트를 쓴다**

gate ID를 `boss-axis-guard:opportunist@0.7:risk-${RiskLevel}`로 확장하고 다음 두 경우를 각각 실패시킨다.

```ts
expect(guardFor({ preBossFailures: 11, bossFailures: 10, meanBossEntryHpRatio: 0.80 }))
  .toMatchObject({ passed: false });
expect(guardFor({ preBossFailures: 10, bossFailures: 10, meanBossEntryHpRatio: 0.6999 }))
  .toMatchObject({ passed: false });
expect(guardFor({ preBossFailures: 10, bossFailures: 10, meanBossEntryHpRatio: 0.70 }))
  .toMatchObject({ passed: true });
```

fixture helper가 실제 `evaluateB1BAcceptance()` 결과를 반환하게 만들고, 50·100 seed에서는 관측, 200 seed에서는 위험도 gate와 같은 강제 정책을 적용한다.

- [ ] **Step 5: 보스 축 중단 gate를 최소 구현한다**

```ts
const guardPassed = funnel.preBossFailures <= funnel.bossFailures
  && funnel.meanBossEntryHpRatio !== null
  && funnel.meanBossEntryHpRatio >= 0.70;
```

evidence에는 보스 전 실패, 보스 실패, 평균 진입 HP 비율, 기준 `0.70`을 모두 기록한다.

- [ ] **Step 6: 경계·역전·동률·표본·focus 테스트를 통과시킨다**

Run:

```bash
pnpm exec vitest run lib/backtest/acceptance.test.ts
```

Expected: 새 목표 양 경계 PASS, 구간 밖·역전·동률·표본 29 FAIL, 표본 30 PASS, focus별 `enforced` 검증 PASS.

- [ ] **Step 7: acceptance 계약을 커밋한다**

```bash
git add lib/backtest/acceptance.ts lib/backtest/acceptance.test.ts
git commit -m "테스트: 위험도 곡선 v2 승인 계약 추가" -m "새 목표 구간과 엄격 감소, 최소 표본 및 보스 축 중단 조건을 focus별 강제 범위로 검증한다."
```

---

### Task 2: 고정 gate와 보고서를 단일 enforced 모델로 통합한다

**Files:**
- Modify: `lib/backtest/report.ts:15-29,71-141,180-187,278-321`
- Modify: `lib/backtest/report.test.ts:41-170`

**Interfaces:**
- Consumes: Task 1의 `BacktestFocus`, `evaluateB1BAcceptance(aggregate, context)`
- Produces:

```ts
export interface FixedGateResult {
  readonly id: "no-run-errors" | "accuracy-interval" | "not-all-rank-s" | "betrayal-can-complete" | "accuracy-has-effect";
  readonly passed: boolean;
  readonly enforced: boolean;
  readonly evidence: string;
}

export function evaluateFixedGates(
  aggregate: BacktestAggregate,
  focus?: BacktestFocus,
): readonly FixedGateResult[];
```

- [ ] **Step 1: 실패한 관측 gate가 OBSERVE와 실제 근거를 함께 출력하는 테스트를 쓴다**

```ts
const riskFixedGates = evaluateFixedGates(aggregate, "risk-curve");
expect(riskFixedGates.find((gate) => gate.id === "no-run-errors"))
  .toMatchObject({ enforced: true });
expect(riskFixedGates.find((gate) => gate.id === "not-all-rank-s"))
  .toMatchObject({ enforced: true });
expect(riskFixedGates.find((gate) => gate.id === "betrayal-can-complete"))
  .toMatchObject({ passed: false, enforced: false });
```

`renderBacktestReport()` 입력에 `focus: "risk-curve"`를 주고 `| betrayal-can-complete | OBSERVE | 캠페인 정상 완주 0건 |`과 `- focus: risk-curve`를 기대한다.

- [ ] **Step 2: report 테스트가 `enforced`와 focus 미지원으로 실패하는지 확인한다**

Run:

```bash
pnpm exec vitest run lib/backtest/report.test.ts
```

Expected: `FixedGateResult.enforced` 또는 `BacktestReportInput.focus` 부재로 FAIL한다.

- [ ] **Step 3: 고정 gate의 강제 여부를 focus에서 계산한다**

```ts
function fixedGateEnforced(id: FixedGateResult["id"], focus: BacktestFocus): boolean {
  return focus === "full-campaign" || id === "no-run-errors" || id === "not-all-rank-s";
}
```

`evaluateFixedGates()`의 기본 focus는 `full-campaign`으로 두고 모든 반환 객체에 `enforced`를 넣는다.

- [ ] **Step 4: 모든 gate 행을 같은 상태 함수로 렌더링한다**

```ts
type GateWithStatus = { readonly passed: boolean; readonly enforced: boolean };

function gateStatus(gate: GateWithStatus): "PASS" | "FAIL" | "OBSERVE" {
  if (!gate.enforced) return "OBSERVE";
  return gate.passed ? "PASS" : "FAIL";
}
```

`lineForGate`와 `lineForB1BGate`가 이 함수만 사용하게 하고, `BacktestReportInput`에 `focus` 및 세 namespace union을 추가한다. 보고서 metadata에 focus를 출력하고 acceptance 호출에도 전달한다.

- [ ] **Step 5: 보고서 결정성과 관측 실패 보존 테스트를 통과시킨다**

Run:

```bash
pnpm exec vitest run lib/backtest/report.test.ts lib/backtest/acceptance.test.ts
```

Expected: 입력 run 순서를 뒤집어도 Markdown이 같고, 관측 실패는 `OBSERVE`이면서 기존 evidence를 유지한다.

- [ ] **Step 6: report 계약을 커밋한다**

```bash
git add lib/backtest/report.ts lib/backtest/report.test.ts
git commit -m "기능: 백테스트 gate 관측 상태 통합" -m "고정 gate와 위험도 gate가 같은 enforced 모델에서 PASS, FAIL, OBSERVE를 렌더링하도록 정리한다."
```

---

### Task 3: runner에 focus와 새 namespace를 연결한다

**Files:**
- Modify: `lib/backtest/backtest.run.ts:12-19,47-178`
- Modify: `lib/backtest/backtest.run.test.ts:1-90`
- Modify: `package.json:13-16`

**Interfaces:**
- Consumes: Task 1의 `BacktestFocus`, Task 2의 `FixedGateResult.enforced`
- Produces:

```ts
export type BacktestNamespace =
  | "b1b-calibration-v1"
  | "b1-risk-curve-v2-calibration"
  | "b1b-holdout-v1";

export interface BacktestSuiteOptions {
  readonly mode: "calibration" | "holdout";
  readonly focus: BacktestFocus;
  readonly seedsPerCombination: 2 | 50 | 100 | 200 | 2000;
  readonly namespace: BacktestNamespace;
}
```

- [ ] **Step 1: 기본 focus와 새 namespace, 잘못된 조합의 실패 테스트를 쓴다**

```ts
expect(optionsFromEnvironment({
  B1_BACKTEST_MODE: "calibration",
  B1_BACKTEST_SEEDS: "50",
})).toMatchObject({ focus: "full-campaign", namespace: "b1b-calibration-v1" });

expect(optionsFromEnvironment({
  B1_BACKTEST_MODE: "calibration",
  B1_BACKTEST_FOCUS: "risk-curve",
  B1_BACKTEST_SEEDS: "50",
})).toMatchObject({ focus: "risk-curve", namespace: "b1-risk-curve-v2-calibration" });

expect(() => optionsFromEnvironment({
  B1_BACKTEST_MODE: "holdout",
  B1_BACKTEST_FOCUS: "risk-curve",
  B1_BACKTEST_SEEDS: "2000",
})).toThrow("risk-curve focus는 holdout을 실행할 수 없다");
```

`B1_BACKTEST_FOCUS=unknown`과, 선택된 focus에 맞지 않는 `B1_BACKTEST_NAMESPACE`도 명시적으로 거부하는 테스트를 추가한다.

- [ ] **Step 2: runner 옵션 테스트가 새 환경 입력 미지원으로 실패하는지 확인한다**

Run:

```bash
pnpm exec vitest run lib/backtest/backtest.run.test.ts
```

Expected: focus 또는 새 namespace 기대가 맞지 않아 FAIL한다.

- [ ] **Step 3: 환경 입력을 검증하고 namespace를 결정한다**

`BacktestEnvironment`에 `B1_BACKTEST_FOCUS`, `B1_BACKTEST_NAMESPACE`를 추가한다. focus 기본값은 `full-campaign`이고 namespace 기본값은 다음 함수로 정한다.

```ts
function expectedNamespace(mode: BacktestSuiteOptions["mode"], focus: BacktestFocus): BacktestNamespace {
  if (mode === "holdout") return "b1b-holdout-v1";
  return focus === "risk-curve" ? "b1-risk-curve-v2-calibration" : "b1b-calibration-v1";
}
```

명시된 namespace가 기대값과 다르면 오류를 내고, risk-curve holdout은 `B1B_HOLDOUT_APPROVED` 검사보다 먼저 거부한다.

- [ ] **Step 4: 단계별 evidence와 종료 판정을 enforced-only로 바꾼다**

```ts
const failedFixed = fixedGates.filter((gate) => !gate.passed);
const enforcedFixed = fixedGates.filter((gate) => gate.enforced);
const enforcedFailure = failedFixed.some((gate) => gate.enforced)
  || failedAcceptance.some((gate) => gate.enforced);
const hasEnforced = enforcedFixed.length > 0 || enforcedAcceptance.length > 0;
```

`calibrationStageEvidence()`가 focus를 받아 `evaluateFixedGates(stageAggregate, focus)`와 `evaluateB1BAcceptance(..., { focus })`에 전달한다. `shouldFailBacktest()`와 `assertBacktestPasses()`도 fixed/acceptance 모두 `enforced && !passed`만 실패로 취급한다. `failureIds`에는 관측 실패도 남긴다.

- [ ] **Step 5: CLI에서 같은 focus를 평가·보고·종료에 전달한다**

```ts
const gates = evaluateFixedGates(aggregate, options.focus);
const acceptanceGates = evaluateB1BAcceptance(aggregate, {
  mode: options.mode,
  seedsPerCombination: options.seedsPerCombination,
  focus: options.focus,
});
```

report input과 `buildCalibrationEvidence()`에도 `options.focus`를 전달해 재판정 차이를 없앤다.

- [ ] **Step 6: risk-curve 전용 명령을 추가한다**

`package.json` scripts에 다음 세 항목을 추가한다. 기존 네 backtest 명령은 수정하지 않는다.

```json
"backtest:risk-structure": "B1_SOURCE_REVISION=$(git rev-parse --short HEAD) B1_BACKTEST_MODE=calibration B1_BACKTEST_FOCUS=risk-curve B1_BACKTEST_SEEDS=50 vitest run --config vitest.backtest.config.ts",
"backtest:risk-tune": "B1_SOURCE_REVISION=$(git rev-parse --short HEAD) B1_BACKTEST_MODE=calibration B1_BACKTEST_FOCUS=risk-curve B1_BACKTEST_SEEDS=100 vitest run --config vitest.backtest.config.ts",
"backtest:risk-quick": "B1_SOURCE_REVISION=$(git rev-parse --short HEAD) B1_BACKTEST_MODE=calibration B1_BACKTEST_FOCUS=risk-curve B1_BACKTEST_SEEDS=200 vitest run --config vitest.backtest.config.ts"
```

- [ ] **Step 7: runner와 package script 계약을 검증한다**

Run:

```bash
pnpm exec vitest run lib/backtest/backtest.run.test.ts lib/backtest/report.test.ts lib/backtest/acceptance.test.ts
node -e 'const p=require("./package.json"); for (const n of ["backtest:risk-structure","backtest:risk-tune","backtest:risk-quick"]) { if (!p.scripts[n]?.includes("B1_BACKTEST_FOCUS=risk-curve")) process.exit(1) }'
```

Expected: 모든 테스트와 script 검증이 exit 0이다.

- [ ] **Step 8: runner 계약을 커밋한다**

```bash
git add lib/backtest/backtest.run.ts lib/backtest/backtest.run.test.ts package.json
git commit -m "기능: 위험도 곡선 전용 백테스트 실행 경로 추가" -m "risk-curve focus와 독립 namespace를 검증하고 50, 100, 200시드 명령에 연결한다."
```

---

### Task 4: Vitest의 worktree·pnpm store 수집을 차단한다

**Files:**
- Create: `vitest-config.test.ts`
- Modify: `vitest.config.mts:3-12`
- Modify: `vitest.backtest.config.ts:11-20`

**Interfaces:**
- Consumes: Vitest `UserConfig.test.exclude`
- Produces: 두 공식 설정에 동일한 격리 exclude 목록

- [ ] **Step 1: 두 설정의 제외 목록을 요구하는 실패 테스트를 쓴다**

```ts
import { describe, expect, it } from "vitest";
import baseConfig from "./vitest.config.mts";
import backtestConfig from "./vitest.backtest.config";

const REQUIRED_EXCLUDES = [".worktrees/**", ".pnpm-store/**", "node_modules/**", ".next/**"];

describe("Vitest 수집 경계", () => {
  it.each([
    ["기본", baseConfig],
    ["백테스트", backtestConfig],
  ] as const)("%s 설정이 저장소 내부 생성 디렉터리를 제외한다", (_name, config) => {
    expect(config.test?.exclude).toEqual(expect.arrayContaining(REQUIRED_EXCLUDES));
  });
});
```

- [ ] **Step 2: 설정 테스트가 `.pnpm-store/**` 또는 backtest exclude 부재로 실패하는지 확인한다**

Run:

```bash
pnpm exec vitest run vitest-config.test.ts
```

Expected: 두 설정 중 하나 이상이 필수 제외 목록을 만족하지 않아 FAIL한다.

- [ ] **Step 3: 두 설정에 같은 exclude 목록을 명시한다**

```ts
exclude: [".worktrees/**", ".pnpm-store/**", "node_modules/**", ".next/**"],
```

기본 설정의 기존 include와 backtest 설정의 `**/*.run.ts`, worker·timeout 설정은 유지한다.

- [ ] **Step 4: 설정 테스트와 기본 전체 테스트 수집을 검증한다**

Run:

```bash
pnpm exec vitest run vitest-config.test.ts
pnpm test
```

Expected: `.worktrees`와 `.pnpm-store` 아래 테스트를 수집하지 않고 저장소의 현재 공식 test suite만 실행한다.

- [ ] **Step 5: 테스트 수집 경계를 커밋한다**

```bash
git add vitest-config.test.ts vitest.config.mts vitest.backtest.config.ts
git commit -m "수정: Vitest 생성 디렉터리 수집 차단" -m "기본 테스트와 백테스트가 worktree 및 pnpm store의 중복 파일을 실행하지 않도록 제외 목록을 통일한다."
```

---

### Task 5: 보스 배율을 50→100→200 seed로 한 위험도씩 보정한다

**Files:**
- Modify during calibration: `lib/balance/campaign-balance.ts:45-85`
- Modify: `lib/balance/campaign-balance.test.ts:59-85`
- Generated: `docs/technical/BACKTEST_REPORT.md`

**Interfaces:**
- Consumes: Tasks 1~4의 `backtest:risk-structure`, `backtest:risk-tune`, `backtest:risk-quick`
- Produces: `CAMPAIGN_BALANCE.revision === "b1-risk-curve-v2"`, 최종 보스 배율, 새 calibration before/after evidence

- [ ] **Step 1: 현재 production 기준선을 새 namespace 50 seed로 재확인한다**

Run:

```bash
pnpm backtest:risk-structure
```

Expected: 실행 오류 0, `no-run-errors`와 `not-all-rank-s`가 PASS다. 위험도 곡선과 전체 캠페인 실패는 `OBSERVE`로 보고된다.

- [ ] **Step 2: 첫 50 seed 후보를 방향성 근거에서 시작한다**

`CAMPAIGN_BALANCE.bossBaseStatMultiplierByInitialRisk`만 다음 값으로 바꾸고 다른 balance 필드의 diff가 없는지 확인한다.

```ts
bossBaseStatMultiplierByInitialRisk: {
  1: 1.10,
  2: 0.80,
  3: 0.60,
  4: 0.45,
  5: 0.475,
},
```

Run:

```bash
pnpm backtest:risk-structure
git diff -- lib/balance/campaign-balance.ts
```

Expected: 이전 throwaway 결과의 방향을 재현하되 이 값을 최종 후보로 자동 채택하지 않는다.

- [ ] **Step 3: ★1부터 ★5까지 0.025 한 칸씩 목표 중심을 향해 이동한다**

각 위험도 `r`에서 현재 50 seed 클리어율 `p`와 목표 중심 `m = [0.875, 0.815, 0.74, 0.66, 0.60][r - 1]`을 비교한다.

- `p < m`이면 해당 위험도의 보스 배율만 `0.025` 낮춘다.
- `p > m`이면 해당 위험도의 보스 배율만 `0.025` 높인다.
- 각 변경 뒤 `pnpm backtest:risk-structure`를 다시 실행한다.
- 목표 중심을 처음 지나면 양쪽 격자 후보 중 `abs(p - m)`이 작은 값을 남긴다.
- 거리가 같으면 최초 production 배율 `{1:1.10, 2:0.825, 3:0.65, 4:0.55, 5:0.60}`과 가까운 값을 남긴다.
- `preBossFailures > bossFailures` 또는 평균 보스 진입 HP 비율 `< 0.70`이 되면 해당 위험도 변경을 중단하고 최종 실패로 기록한다.
- 한 위험도를 확정하기 전에는 다음 위험도를 움직이지 않는다.

모든 후보는 `0.20~1.20` 안의 `0.025` 격자인지 `validateCampaignBalance()`로 검증한다.

- [ ] **Step 4: 선택된 50 seed 후보를 100 seed로 재평가한다**

Run:

```bash
pnpm backtest:risk-tune
```

Expected: 각 위험도 표본과 funnel이 생성되고, 곡선 gate 및 전체 캠페인 gate는 `OBSERVE`다. 100 seed에서 목표 중심 반대편으로 이동한 위험도만 Step 3의 양쪽 격자 후보를 각각 다시 실행하고 같은 우선순위로 하나를 선택한다.

- [ ] **Step 5: 최종 후보의 balance 계약 테스트를 먼저 실패시킨다**

실제로 선택된 다섯 배율을 `campaign-balance.test.ts`에 숫자 literal로 고정한다. 다음 보존 축도 함께 검증한다.

```ts
expect(CAMPAIGN_BALANCE.revision).toBe("b1-risk-curve-v2");
expect(CAMPAIGN_BALANCE.generalMonsterBaseStatMultiplier).toBe(1.00);
expect(CAMPAIGN_BALANCE.worldTurn).toEqual({
  restRecoveryRatio: 0.20,
  backgroundLossPercent: { min: 5, max: 10 },
});
```

Run:

```bash
pnpm exec vitest run lib/balance/campaign-balance.test.ts
```

Expected: 아직 revision과 calibration evidence가 이전 값을 가리켜 FAIL한다.

- [ ] **Step 6: 최종 revision과 calibration evidence를 구현한다**

`CAMPAIGN_BALANCE.revision`을 `b1-risk-curve-v2`로 바꾸고, `B1C_CALIBRATION_SELECTION`을 `B1_RISK_CURVE_V2_CALIBRATION_SELECTION`으로 교체한다.

```ts
export const B1_RISK_CURVE_V2_CALIBRATION_SELECTION = {
  selectedAxis: "bossBaseStatMultiplierByInitialRisk",
  before: {
    revision: "b1c-boss-depletion-v1",
    generalMonsterBaseStatMultiplier: 1.00,
    restRecoveryRatio: 0.20,
    bossBaseStatMultiplierByInitialRisk: { 1: 1.10, 2: 0.825, 3: 0.65, 4: 0.55, 5: 0.60 },
  },
  after: {
    revision: CAMPAIGN_BALANCE.revision,
    generalMonsterBaseStatMultiplier: CAMPAIGN_BALANCE.generalMonsterBaseStatMultiplier,
    restRecoveryRatio: CAMPAIGN_BALANCE.worldTurn.restRecoveryRatio,
    bossBaseStatMultiplierByInitialRisk: CAMPAIGN_BALANCE.bossBaseStatMultiplierByInitialRisk,
  },
} as const;
```

runner와 report의 import·fixture도 새 이름과 revision으로 바꾼다.

- [ ] **Step 7: 200 seed 최종 판정을 실행한다**

Run:

```bash
pnpm backtest:risk-quick
```

Expected: 다섯 위험도 구간, 최소 표본 30, 엄격 감소, 다섯 보스 축 guard, `no-run-errors`, `not-all-rank-s`가 모두 PASS다. 캠페인 완주율·전멸·정확도·배신 gate는 실제 수치와 함께 OBSERVE다.

200 seed가 강제 gate를 실패하면 결과를 숨기거나 목표를 바꾸지 않는다. ★1부터 다시 Step 3의 인접 격자 한 칸만 조정하고 50→100→200 순서를 반복한다. 보스 축 guard가 실패하면 보스 배율 조정을 중단하고 구현 결과를 미달로 보고한다.

- [ ] **Step 8: 최종 balance와 report 회귀를 통과시킨다**

Run:

```bash
pnpm exec vitest run lib/balance/campaign-balance.test.ts lib/backtest/backtest.run.test.ts lib/backtest/report.test.ts lib/backtest/acceptance.test.ts
```

Expected: 최종 숫자 literal, before/after revision, report 행이 모두 일치한다.

- [ ] **Step 9: 최종 보스 배율을 커밋한다**

```bash
git add lib/balance/campaign-balance.ts lib/balance/campaign-balance.test.ts lib/backtest/backtest.run.ts lib/backtest/backtest.run.test.ts lib/backtest/report.test.ts docs/technical/BACKTEST_REPORT.md
git commit -m "밸런스: 위험도 곡선 v2 보스 배율 확정" -m "50, 100, 200시드 순차 보정으로 첫 시도 목표 곡선을 맞추고 전체 캠페인 미달 gate는 관측 결과로 보존한다."
```

---

### Task 6: 공식 문서와 B1 상태를 최종 결과에 맞춘다

**Files:**
- Modify: `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`
- Modify: `docs/systems/PROGRESSION_AND_ENDINGS.md`
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`
- Modify: `docs/technical/PROJECT_STATUS_2026-08-24.md`
- Modify: `docs/README.md`
- Verify unchanged: `docs/GAME_PRINCIPLES.md`

**Interfaces:**
- Consumes: Task 5의 최종 다섯 배율, 200 seed 클리어율·표본·gate 결과
- Produces: 코드 revision과 같은 공식 수치 및 명시적인 B1 잔여 과제

- [ ] **Step 1: 던전·보스 공식 문서에 v2 목표와 최종 수치를 기록한다**

`DUNGEON_EVENTS_AND_BOSSES.md`의 보스전 절에 다음 내용을 추가한다.

- `opportunist@0.7`, 초기 위험도, 첫 시도 기준
- ★1 85~90%, ★2 78~85%, ★3 70~78%, ★4 62~70%, ★5 55~65%
- 실제 최종 다섯 배율과 `b1-risk-curve-v2` revision
- 보스 이전 실패 우세 또는 평균 진입 HP 0.70 미만에서는 보스 배율로 숨기지 않는다는 경계

- [ ] **Step 2: 진행·엔딩 문서에 focus 분리와 미해결 gate를 기록한다**

`PROGRESSION_AND_ENDINGS.md`에서 기존 B1 acceptance를 삭제하지 않는다. risk-curve 200 seed는 위험도 곡선만 확정했으며, 완주율·전멸·정확도·배신 gate는 관측 결과이고 holdout은 아직 열지 않았다고 최종 숫자와 함께 기록한다.

- [ ] **Step 3: 작업 배정표와 상태 스냅샷을 갱신한다**

`CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`의 B1 설명을 다음 상태로 바꾼다.

- 위험도 곡선 v2 calibration 완료 여부
- 전체 캠페인 acceptance와 holdout이 남았으므로 B1 자체는 완료 처리하지 않음
- 다음 작업은 보고서에 남은 지배 실패 원인을 별도 spec으로 다루는 것

`PROJECT_STATUS_2026-08-24.md`에는 2026-08-25 후속 기록 절을 추가해 과거 스냅샷을 덮어쓰지 않는다.

- [ ] **Step 4: README에 구현 plan과 새 명령을 연결한다**

spec 바로 아래에 이 plan 링크를 추가하고 `backtest:risk-structure`, `backtest:risk-tune`, `backtest:risk-quick`의 seed 수와 holdout 미실행을 한 줄로 적는다.

- [ ] **Step 5: 문서 링크·용어·원칙 불변을 검증한다**

Run:

```bash
pnpm exec vitest run docs/DOCUMENT_LINKS.test.ts docs/DOCUMENT_TERMINOLOGY.test.ts docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.test.ts
git diff --exit-code -- docs/GAME_PRINCIPLES.md
```

Expected: 문서 테스트 PASS, `GAME_PRINCIPLES.md` diff 없음.

- [ ] **Step 6: 공식 문서를 커밋한다**

```bash
git add docs/README.md docs/systems/DUNGEON_EVENTS_AND_BOSSES.md docs/systems/PROGRESSION_AND_ENDINGS.md docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md docs/technical/PROJECT_STATUS_2026-08-24.md docs/superpowers/specs/2026-08-25-lattebun-b1-risk-curve-v2-calibration-design.md docs/superpowers/plans/2026-08-25-lattebun-b1-risk-curve-v2-calibration.md
git commit -m "문서: 위험도 곡선 v2 보정 결과 반영" -m "새 첫 시도 목표와 최종 보스 배율, risk-curve 판정 범위 및 남은 전체 캠페인 과제를 공식 문서에 동기화한다."
```

---

### Task 7: 전체 검증과 리뷰 준비를 수행한다

**Files:**
- Verify: 이번 plan의 모든 변경 파일
- Preserve untracked: `.pnpm-store/`, `public/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/ASSET_MANIFEST.json`, `public/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/README.txt`

**Interfaces:**
- Consumes: Tasks 1~6 전체 결과
- Produces: 재현 가능한 최종 검증 증거와 리뷰 가능한 branch

- [ ] **Step 1: risk-curve 최종 판정을 새로 실행한다**

Run:

```bash
pnpm backtest:risk-quick
```

Expected: 강제 조건 13개가 모두 PASS다: 위험도 구간 5개, 엄격 감소 1개, 보스 축 guard 5개, `no-run-errors` 1개, `not-all-rank-s` 1개. 실제 구현에서 guard를 위험도 gate 행에 통합했다면 중복 없이 같은 13개 조건이 근거로 확인되어야 한다.

- [ ] **Step 2: 전체 자동 검증을 실행한다**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
git diff --check
```

Expected: tests와 typecheck exit 0, lint 오류 0, whitespace 오류 0. 기존 lint warning이 있으면 개수와 이번 diff 관련 여부를 기록한다.

- [ ] **Step 3: 변경 축과 사용자 파일 보존을 확인한다**

Run:

```bash
git diff --stat
git diff -- lib/balance/campaign-balance.ts
git status --short
```

Expected: production balance diff는 revision과 위험도별 보스 배율, calibration evidence뿐이다. 사용자 미추적 파일은 untracked 상태 그대로이며 커밋에 포함되지 않는다.

- [ ] **Step 4: 전체 캠페인 관측 실패를 최종 요약에 기록한다**

`BACKTEST_REPORT.md`에서 `OBSERVE`인 완주율·전멸·정확도·배신 gate의 ID와 실제 수치를 추출한다. 위험도 곡선 통과를 B1 전체 완료나 holdout 통과로 표현하지 않는다.

- [ ] **Step 5: code review를 요청한다**

`superpowers:requesting-code-review`를 사용해 spec 대비 누락, focus별 강제 범위, namespace 격리, 보스 단일 축, 문서·revision 동기화를 검토한다. 지적 사항이 있으면 `superpowers:receiving-code-review`로 재현·검증한 뒤 수정한다.

- [ ] **Step 6: branch 마감을 준비한다**

`superpowers:verification-before-completion`으로 Step 1~3을 새로 확인한 뒤 `superpowers:finishing-a-development-branch`를 사용한다. 사용자 승인 없이 holdout을 실행하거나 B1을 완료 처리하지 않는다.
