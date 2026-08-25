# B1-B 캠페인 생존 밸런스 재설계 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 재도전 죽음의 나선을 제거하고 월드턴·보스·조언 누적을 조정해 3전략×2정확도가 승인된 완주율과 전멸 분포를 만족하도록 실제 캠페인 규칙과 백테스트를 개선한다.

**Architecture:** 숫자는 의존성 없는 `campaign-balance`에 모으고, `advice-pressure`가 원정 단위 0~3 상태 전이를 소유한다. 일반전·보스전 어댑터는 사건·상인·보스 정보와 압력 배율을 합성하며, 실제 Store driver가 압력·보스 진입·전멸을 계측한다. calibration에서만 설정을 조정하고 승인 뒤 동결한 별도 namespace holdout으로 최종 판정한다.

**Tech Stack:** TypeScript 5, Zustand 5, Vitest 4, pnpm 11, 기존 `lib/domain`·`lib/content`·`lib/rules`·`lib/store`·`lib/backtest` API

**Spec:** `docs/superpowers/specs/2026-08-24-lattebun-b1-balance-redesign-design.md`

## Global Constraints

- 초기 캐릭터 30명, 캠페인 중 영입 없음, 서로 다른 직업 3인 파티를 유지한다.
- 전투 결과는 `cleared | wiped`뿐이며 후퇴·부활을 추가하지 않는다.
- 전멸 뒤 위험도·보상 증가와 공개 생태 감소는 유지하되 일반 몬스터·보스 전투력은 재도전 때문에 오르지 않는다.
- 첫 calibration에서 승급 요구치, 보상표, 신뢰 반응 확률, 엔딩 판정 순서를 바꾸지 않는다.
- 월드턴은 휴식 0.20으로 시작해 승인 범위 0.20~0.25만 사용하고, 백그라운드 피해는 5~10%다.
- 보스 HP·피해는 초기 위험도 공통 배율 0.80으로 시작해 단계별 0.75~0.85만 사용한다. 테마별 별도 배율은 두지 않는다.
- 조언 압력은 정수 0~3이며 executed harm +1, executed help -1, neutral·미실행 0이다. 원정마다 0으로 시작하고 캠페인의 다음 원정으로 이월하지 않는다.
- 압력은 전략 공개 projection과 UI에 직접 노출하지 않는다.
- 구조 검증은 조합당 50시드, 1차 보정은 100시드, 최종 calibration은 200시드, holdout은 2,000시드다.
- calibration namespace는 `b1b-calibration-v1`, holdout namespace는 `b1b-holdout-v1`이다.
- holdout 결과를 본 뒤 설정이나 합격선을 조정하지 않는다. 조정이 필요하면 해당 namespace를 폐기하고 새 버전을 설계한다.
- 실행 오류를 재시도하거나 제외하지 않는다. 오류·거부·정지·800-step 초과·비결정성은 모두 실패다.
- 원시 12,000판 상태는 커밋하지 않고 집계 보고서와 대표 재현 시드만 남긴다.
- 각 태스크는 테스트 실패를 먼저 확인한 뒤 최소 구현으로 통과시킨다.
- 모든 커밋의 제목과 본문은 한글로 작성한다.

## File Map

### 새 파일

- `lib/balance/campaign-balance.ts`: 월드턴·보스·보스 정보·조언 압력 초기값과 revision
- `lib/balance/campaign-balance.test.ts`: 설정 키·범위·단조성 검사
- `lib/rules/balance-validation.ts`: 설정 런타임 검증과 `INVALID_GENERATION`
- `lib/rules/balance-validation.test.ts`: 잘못된 설정의 진단 계약
- `lib/rules/advice-pressure.ts`: 압력 검증·상태 전이·전투 배율 조회
- `lib/rules/advice-pressure.test.ts`: 0~3 clamp, help/harm/neutral, 잘못된 상태 검사
- `lib/backtest/acceptance.ts`: B1-B 완주율·완주 전멸 gate와 holdout 승인 잠금
- `lib/backtest/acceptance.test.ts`: 여섯 조합 경계 포함 판정과 분모 오류 검사

### 주요 변경 파일

- `lib/domain/expedition.ts`, `lib/domain/index.ts`: `AdvicePressure`와 원정 상태 계약
- `lib/domain/worldturn.ts`, `lib/domain/worldturn.test.ts`: 휴식 20%, 백그라운드 5~10%
- `lib/content/boss-traits.ts`, `lib/content/boss-traits.test.ts`: 보스 정보 배율의 공통 설정 소비
- `lib/rules/campaign-init.ts`, `lib/rules/campaign-init.test.ts`: 캠페인 시작 설정 검증
- `lib/rules/expedition-events.ts`, `lib/rules/expedition-events.test.ts`: retry scaling 제거와 압력 합성
- `lib/rules/boss-battle-adapter.ts`, `lib/rules/boss-battle-adapter.test.ts`: 초기 위험도 공통 보정과 압력 합성
- `lib/rules/campaign-transition.ts`, `lib/rules/campaign-transition-expedition.test.ts`: 압력 초기화·갱신·전달
- `lib/domain/advice.test.ts`, `lib/store/campaign-store-flow.test.ts`: `ExpeditionState` fixture 갱신
- `components/game/u5-battle-preview-data.ts`, `components/game/u5-preview-data.ts`, `components/game/u6-preview-data.ts`: 실제 어댑터 호출에 압력 0 전달
- `lib/backtest/public-state.test.ts`: 압력 비공개 회귀
- `lib/backtest/campaign-driver.ts`, `lib/backtest/campaign-driver.test.ts`: 원정별 압력·보스 진입 trace
- `lib/backtest/metrics.ts`, `lib/backtest/metrics.test.ts`: 완주 전멸·5회 이상·압력·보스 병목 집계
- `lib/backtest/report.ts`, `lib/backtest/report.test.ts`: B1-B gate와 결정적 보고서
- `lib/backtest/backtest.run.ts`, `lib/backtest/backtest.run.test.ts`: 50/100/200/2,000 실행과 새 namespace
- `package.json`: structure·tune·calibration·holdout 명령
- `docs/technical/BACKTEST_REPORT.md`: 생성된 calibration 또는 holdout 보고서
- `docs/systems/*.md`, `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`, `docs/README.md`: 최종 고정값과 B1 판정

---

## Task 1: 공통 밸런스 설정과 검증 경계를 만든다

**Files:**

- Create: `lib/balance/campaign-balance.ts`
- Create: `lib/balance/campaign-balance.test.ts`
- Create: `lib/rules/balance-validation.ts`
- Create: `lib/rules/balance-validation.test.ts`
- Modify: `lib/content/boss-traits.ts:21-30,72-87`
- Modify: `lib/content/boss-traits.test.ts`
- Modify: `lib/rules/campaign-init.ts:98-101`
- Modify: `lib/rules/campaign-init.test.ts`

**Interfaces:**

```ts
export type AdvicePressure = 0 | 1 | 2 | 3;

export interface CampaignBalance {
  readonly revision: string;
  readonly worldTurn: {
    readonly restRecoveryRatio: number;
    readonly backgroundLossPercent: { readonly min: number; readonly max: number };
  };
  readonly bossBaseStatMultiplierByInitialRisk: Readonly<Record<1 | 2 | 3 | 4 | 5, number>>;
  readonly advicePressure: Readonly<Record<AdvicePressure, {
    readonly incomingDamageMultiplier: number;
    readonly outgoingDamageMultiplier: number;
  }>>;
  readonly bossInfo: {
    readonly multipliers: Readonly<Record<"targetWeight" | "incomingDamage" | "outgoingDamage", Readonly<Record<"help" | "harm", number>>>>;
    readonly limits: { readonly min: number; readonly max: number };
  };
}

export const CAMPAIGN_BALANCE: CampaignBalance;
export function validateCampaignBalance(profile?: CampaignBalance): void;
```

- Consumes: 기존 E4 보스 정보 배율 `0.80/1.25`, clamp `0.70..1.50`.
- Produces: 이후 모든 규칙이 읽는 유일한 수치 원본과 캠페인 시작 검증.

- [ ] **Step 1: 초기값·키·단조성과 오류 코드를 고정하는 실패 테스트를 작성한다**

```ts
expect(CAMPAIGN_BALANCE.worldTurn).toEqual({
  restRecoveryRatio: 0.20,
  backgroundLossPercent: { min: 5, max: 10 },
});
expect(Object.keys(CAMPAIGN_BALANCE.bossBaseStatMultiplierByInitialRisk)).toEqual(["1", "2", "3", "4", "5"]);
expect(Object.values(CAMPAIGN_BALANCE.bossBaseStatMultiplierByInitialRisk)).toEqual([0.8, 0.8, 0.8, 0.8, 0.8]);
expect(CAMPAIGN_BALANCE.advicePressure[3].incomingDamageMultiplier)
  .toBeGreaterThan(CAMPAIGN_BALANCE.advicePressure[2].incomingDamageMultiplier);

const invalid: CampaignBalance = {
  ...CAMPAIGN_BALANCE,
  advicePressure: {
    ...CAMPAIGN_BALANCE.advicePressure,
    2: { ...CAMPAIGN_BALANCE.advicePressure[2], incomingDamageMultiplier: Number.NaN },
  },
};
expect(() => validateCampaignBalance(invalid)).toThrowError(
  expect.objectContaining({ code: "INVALID_GENERATION" }),
);
```

- [ ] **Step 2: 새 테스트가 import 실패로 RED인지 확인한다**

Run: `pnpm vitest run lib/balance/campaign-balance.test.ts lib/rules/balance-validation.test.ts`

Expected: FAIL because `campaign-balance` and `balance-validation` do not exist.

- [ ] **Step 3: 의존성 없는 설정과 RuleError 검증기를 최소 구현한다**

```ts
export const CAMPAIGN_BALANCE = {
  revision: "b1b-initial-v1",
  worldTurn: { restRecoveryRatio: 0.20, backgroundLossPercent: { min: 5, max: 10 } },
  bossBaseStatMultiplierByInitialRisk: { 1: 0.80, 2: 0.80, 3: 0.80, 4: 0.80, 5: 0.80 },
  advicePressure: {
    0: { incomingDamageMultiplier: 1.00, outgoingDamageMultiplier: 1.00 },
    1: { incomingDamageMultiplier: 1.05, outgoingDamageMultiplier: 1.00 },
    2: { incomingDamageMultiplier: 1.15, outgoingDamageMultiplier: 0.90 },
    3: { incomingDamageMultiplier: 1.30, outgoingDamageMultiplier: 0.80 },
  },
  bossInfo: {
    multipliers: {
      targetWeight: { help: 0.80, harm: 1.25 },
      incomingDamage: { help: 0.80, harm: 1.25 },
      outgoingDamage: { help: 1.25, harm: 0.80 },
    },
    limits: { min: 0.70, max: 1.50 },
  },
} as const satisfies CampaignBalance;
```

`validateCampaignBalance`는 위험도 키 1~5, 휴식 0.20~0.25, 백그라운드 5~10,
보스 단계 0.75~0.85, 유한·양수 multiplier, min≤max, 압력 incoming 비감소·
outgoing 비증가를 확인한다. `initializeCampaign` 첫 줄에서 검증기를 호출한다.
`boss-traits.ts`의 기존 export 이름은 공통 설정 alias로 유지해 기존 소비자를 깨지
않는다.

- [ ] **Step 4: 설정·콘텐츠·캠페인 초기화 테스트를 통과시킨다**

Run: `pnpm vitest run lib/balance/campaign-balance.test.ts lib/rules/balance-validation.test.ts lib/content/boss-traits.test.ts lib/rules/campaign-init.test.ts`

Expected: PASS, invalid profile만 `INVALID_GENERATION`.

- [ ] **Step 5: 타입 검사로 순환 의존성과 key 누락을 확인한다**

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: 공통 설정 단위를 커밋한다**

```bash
git add lib/balance lib/rules/balance-validation.ts lib/rules/balance-validation.test.ts lib/content/boss-traits.ts lib/content/boss-traits.test.ts lib/rules/campaign-init.ts lib/rules/campaign-init.test.ts
git commit -m "밸런스: 공통 캠페인 설정을 만든다" -m "월드턴, 위험도별 보스, 보스 정보와 조언 압력 초기값을 한 모듈에 모으고 캠페인 시작 시 설정 불변식을 검증한다."
```

## Task 2: 월드턴 소모와 회복을 조정한다

**Files:**

- Modify: `lib/domain/worldturn.ts:17-25,203-225`
- Modify: `lib/domain/worldturn.test.ts:163-227`
- Modify: `lib/domain/index.ts:126-134`

**Interfaces:**

- Consumes: `CAMPAIGN_BALANCE.worldTurn`.
- Produces: 휴식 20%, 백그라운드 5~10%, 기존 HP 하한·중상·골드 계약.

- [ ] **Step 1: 새 회복량과 피해 양 끝을 기대하는 실패 테스트로 바꾼다**

```ts
it("휴식은 최대 HP의 20%를 회복한다", () => {
  const result = runWorldTurn(makePool([character({ hp: 40, maxHp: 100 })]), emptyParty, 0, fixedRng);
  expect(result.pool.byId[memberId].hp).toBe(60);
});

it.each([[5, 45], [10, 40]])("백그라운드 %s%% 손실 경계를 적용한다", (percent, hp) => {
  const edgeRng = { ...fixedRng, int: (min: number, max: number) => percent === 5 ? min : max };
  const members = [character({ id: "rest" as CharacterId }), character({ id: "background" as CharacterId, hp: 50 })];
  expect(runWorldTurn(makePool(members), emptyParty, 0, edgeRng).pool.byId["background" as CharacterId].hp).toBe(hp);
});
```

- [ ] **Step 2: 기존 15%·10% 기대와 충돌해 RED인지 확인한다**

Run: `pnpm vitest run lib/domain/worldturn.test.ts`

Expected: FAIL with expected 60/45 but received 55/40 for the minimum RNG path.

- [ ] **Step 3: 숫자 원본을 공통 설정으로 교체한다**

```ts
export const REST_RECOVERY_RATIO = CAMPAIGN_BALANCE.worldTurn.restRecoveryRatio;

const lossPercent = worldturnRng.int(
  CAMPAIGN_BALANCE.worldTurn.backgroundLossPercent.min,
  CAMPAIGN_BALANCE.worldTurn.backgroundLossPercent.max,
);
```

강제 휴식 50%, 중상 20%, 최소 회복 2, HP 하한 1과 골드 5~15 코드는 바꾸지 않는다.

- [ ] **Step 4: 월드턴 전체 테스트와 타입 검사를 통과시킨다**

Run: `pnpm vitest run lib/domain/worldturn.test.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: 월드턴 변경을 커밋한다**

```bash
git add lib/domain/worldturn.ts lib/domain/worldturn.test.ts lib/domain/index.ts
git commit -m "밸런스: 월드턴 인력 소모를 완화한다" -m "휴식 회복을 최대 HP의 20%로 높이고 백그라운드 원정 피해를 5~10%로 낮추면서 기존 중상과 HP 하한 계약을 유지한다."
```

## Task 3: 원정 조언 압력 상태와 순수 전이를 만든다

**Files:**

- Create: `lib/rules/advice-pressure.ts`
- Create: `lib/rules/advice-pressure.test.ts`
- Modify: `lib/domain/expedition.ts:67-91`
- Modify: `lib/domain/index.ts:143-162`
- Modify: `lib/rules/campaign-transition.ts:623-699`
- Modify: `lib/rules/campaign-transition-expedition.test.ts:31-68,237-276`
- Modify: `lib/domain/advice.test.ts:190-226`
- Modify: `lib/store/campaign-store-flow.test.ts:44-57`

**Interfaces:**

```ts
export function assertAdvicePressure(value: unknown): asserts value is AdvicePressure;
export function advanceAdvicePressure(current: AdvicePressure, decision: Pick<AdviceDecision, "executed" | "outcome">): AdvicePressure;
export function combatMultipliersForAdvicePressure(pressure: AdvicePressure): {
  readonly incomingDamageMultiplier: number;
  readonly outgoingDamageMultiplier: number;
};
```

- Consumes: `AdvicePressure`, `CAMPAIGN_BALANCE.advicePressure`, `AdviceDecision`.
- Produces: `ExpeditionState.advicePressure`와 어댑터가 재사용할 검증된 multiplier.

- [ ] **Step 1: 압력 경계와 판정표를 실패 테스트로 작성한다**

```ts
expect(advanceAdvicePressure(0, { executed: true, outcome: "harm" })).toBe(1);
expect(advanceAdvicePressure(3, { executed: true, outcome: "harm" })).toBe(3);
expect(advanceAdvicePressure(2, { executed: true, outcome: "help" })).toBe(1);
expect(advanceAdvicePressure(0, { executed: true, outcome: "help" })).toBe(0);
expect(advanceAdvicePressure(2, { executed: true, outcome: "neutral" })).toBe(2);
expect(advanceAdvicePressure(2, { executed: false, outcome: "harm" })).toBe(2);
expect(() => assertAdvicePressure(4)).toThrowError(expect.objectContaining({ code: "INVALID_STATE" }));
```

`createExpeditionForOffer` 테스트에는 `expect(built.expedition.advicePressure).toBe(0)`를
추가하고, 잘못된 압력으로 `START_EXPEDITION`하면 `INVALID_STATE`인지 검사한다.

- [ ] **Step 2: 새 모듈과 필드 부재로 RED인지 확인한다**

Run: `pnpm vitest run lib/rules/advice-pressure.test.ts lib/rules/campaign-transition-expedition.test.ts`

Expected: FAIL because the functions/property do not exist.

- [ ] **Step 3: 압력 타입·순수 함수·원정 초기화를 최소 구현한다**

```ts
// Add to ExpeditionState after visitedNodeIds.
readonly advicePressure: AdvicePressure;

export function advanceAdvicePressure(
  current: AdvicePressure,
  decision: Pick<AdviceDecision, "executed" | "outcome">,
): AdvicePressure {
  assertAdvicePressure(current);
  if (!decision.executed || decision.outcome === "neutral") return current;
  if (decision.outcome === "help") return Math.max(0, current - 1) as AdvicePressure;
  return Math.min(3, current + 1) as AdvicePressure;
}
```

`createExpeditionForOffer`는 0을 넣고 `copyActiveExpedition`은 전달받은 값을
`assertAdvicePressure`로 검증한다. 손으로 만든 모든 `ExpeditionState` fixture에도
명시적으로 `advicePressure: 0`을 추가한다.

`lib/domain/index.ts`는 소비자가 balance 내부 경로를 알 필요 없도록 다음 type을
다시 export한다.

```ts
export type { AdvicePressure } from "@/lib/balance/campaign-balance";
```

- [ ] **Step 4: 압력·도메인·Store 흐름과 타입 검사를 통과시킨다**

Run: `pnpm vitest run lib/rules/advice-pressure.test.ts lib/rules/campaign-transition-expedition.test.ts lib/domain/advice.test.ts lib/store/campaign-store-flow.test.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: 상태 계약을 커밋한다**

```bash
git add lib/rules/advice-pressure.ts lib/rules/advice-pressure.test.ts lib/domain/expedition.ts lib/domain/index.ts lib/rules/campaign-transition.ts lib/rules/campaign-transition-expedition.test.ts lib/domain/advice.test.ts lib/store/campaign-store-flow.test.ts
git commit -m "밸런스: 원정 조언 압력 상태를 추가한다" -m "원정마다 0에서 시작하는 0~3 조언 압력과 도움·방해·중립의 순수 전이를 만들고 잘못된 상태를 명시적으로 거부한다."
```

## Task 4: 일반 전투의 재도전 강화 제거와 압력 합성을 연결한다

**Files:**

- Modify: `lib/rules/expedition-events.ts:17-22,390-428`
- Modify: `lib/rules/expedition-events.test.ts:1-96`
- Modify: `lib/rules/campaign-transition.ts:368-382`
- Modify: `components/game/u5-battle-preview-data.ts:130-148`
- Modify: `components/game/u5-preview-data.ts:370-405`
- Modify: `components/game/u6-preview-data.ts:130-165`

**Interfaces:**

```ts
export function resolveMonsterEventBattle(input: {
  readonly event: SituationEvent & { readonly kind: "monster" };
  readonly modifier: EncounterModifier;
  readonly activeMonsterIds: readonly MonsterId[];
  readonly monsterDefs: readonly MonsterDef[];
  readonly members: readonly Character[];
  readonly classDefs: readonly ClassDef[];
  readonly seed: string;
  readonly advicePressure: AdvicePressure;
  readonly pendingMerchantEffect: PendingMerchantEffect | null;
}): { readonly battle: BattleResolution | null; readonly pendingMerchantEffect: PendingMerchantEffect | null };
```

- Consumes: `combatMultipliersForAdvicePressure`.
- Produces: retry 입력 없이 사건×상인×압력을 합성하는 일반 전투.

- [ ] **Step 1: retry 제거와 압력 단계별 피해 차이를 실패 테스트로 쓴다**

```ts
const safe = resolveMonsterEventBattle({ ...base, advicePressure: 0, pendingMerchantEffect: null });
const pressured = resolveMonsterEventBattle({ ...base, advicePressure: 3, pendingMerchantEffect: null });
const firstPartyDamage = (result: typeof safe) => result.battle!.actions.find((action) => action.actorSide === "party")!.damage;
const firstEnemyDamage = (result: typeof safe) => result.battle!.actions.find((action) => action.actorSide === "enemy")!.damage;

expect(firstPartyDamage(pressured)).toBeLessThan(firstPartyDamage(safe));
expect(firstEnemyDamage(pressured)).toBeGreaterThan(firstEnemyDamage(safe));
```

기존 `retryCombatMultiplier` 단조 증가 테스트와 import는 삭제하고 모든 호출 fixture가
`advicePressure: 0`을 요구하게 만든다. 비교 fixture는 파티 HP 999·공격 10,
적 HP 999·기본 피해 10으로 고정해 반올림 뒤에도 피해 차이와 양쪽 첫 행동이 모두
존재하게 한다.

- [ ] **Step 2: 새 필수 입력과 기존 retry 구현 때문에 RED인지 확인한다**

Run: `pnpm vitest run lib/rules/expedition-events.test.ts`

Expected: FAIL because pressure is ignored or the new input is absent.

- [ ] **Step 3: retry multiplier를 제거하고 세 배율을 곱한다**

```ts
const pressure = combatMultipliersForAdvicePressure(input.advicePressure);

const battle = resolveBattle({
  // party and enemies unchanged
  partyDamageMultiplier:
    (input.modifier.partyDamageMultiplier ?? 1)
    * (partyDamageMultiplier ?? 1)
    * pressure.outgoingDamageMultiplier,
  incomingDamageMultiplier:
    (input.modifier.incomingDamageMultiplier ?? 1)
    * (incomingDamageMultiplier ?? 1)
    * pressure.incomingDamageMultiplier,
});
```

`retryCombatMultiplier`, `retrySteps`, `enemyHpMultiplier`, `enemyDamageMultiplier`를
일반 전투 경계에서 제거한다. attempt는 지도·사건·전투 RNG seed에는 계속 남긴다.
프로덕션 전이는 현재 원정 압력을 전달하고 UI preview 호출은 0을 전달한다.

- [ ] **Step 4: 일반전과 세 preview 데이터 검사를 통과시킨다**

Run: `pnpm vitest run lib/rules/expedition-events.test.ts components/game/u5-battle-preview-data.test.ts components/game/u5-preview-data.test.ts components/game/u6-preview-data.test.ts`

Expected: PASS.

- [ ] **Step 5: 타입 검사로 모든 호출부 갱신을 확인한다**

Run: `pnpm typecheck`

Expected: PASS with no remaining `retrySteps` argument to `resolveMonsterEventBattle`.

- [ ] **Step 6: 일반전 변경을 커밋한다**

```bash
git add lib/rules/expedition-events.ts lib/rules/expedition-events.test.ts lib/rules/campaign-transition.ts components/game/u5-battle-preview-data.ts components/game/u5-preview-data.ts components/game/u6-preview-data.ts
git commit -m "밸런스: 일반전 재도전 강화를 제거한다" -m "일반 몬스터 HP와 피해의 재도전 배율을 없애고 사건, 상인, 원정 조언 압력의 피해 배율만 공통 전투 엔진에 합성한다."
```

## Task 5: 보스 공통 위험도 보정과 압력 합성을 연결한다

**Files:**

- Modify: `lib/rules/boss-battle-adapter.ts:21-69,185-225`
- Modify: `lib/rules/boss-battle-adapter.test.ts:94-286`
- Modify: `lib/rules/campaign-transition.ts:469-507`
- Modify: `components/game/u5-battle-preview-data.ts:102-111`

**Interfaces:**

```ts
export function balancedBossStats(
  boss: BossDef,
  initialRiskLevel: RiskLevel,
): { readonly maxHp: number; readonly baseDamage: number };

export interface BossBattleInput {
  readonly dungeon: CampaignDungeon;
  readonly theme: ThemeContent;
  readonly members: readonly Character[];
  readonly classDefs: readonly ClassDef[];
  readonly infoRecords: readonly InfoRecord[];
  readonly seed: string;
  readonly pendingMerchantEffect: PendingMerchantEffect | null;
  readonly advicePressure: AdvicePressure;
}
```

- Consumes: 초기 위험도 공통 보스 배율, pressure multiplier, 보스 정보·merchant modifier.
- Produces: 현재 위험도 차이에 무관하고 테마 공통 단계만 쓰는 보스전.

- [ ] **Step 1: 초기 위험도 보정과 압력 합성을 실패 테스트로 고정한다**

```ts
expect(balancedBossStats(SPIDER_BOSSES[0], 1)).toEqual({
  maxHp: Math.max(1, Math.round(SPIDER_BOSSES[0].maxHp * 0.8)),
  baseDamage: Math.max(1, Math.round(SPIDER_BOSSES[0].baseDamage * 0.8)),
});

const safe = resolve({ advicePressure: 0, classDefs: classesWithWarriorAttack(20) });
const pressured = resolve({ advicePressure: 3, classDefs: classesWithWarriorAttack(20) });
expect(firstPartyAction(pressured).damage).toBeLessThan(firstPartyAction(safe).damage);
```

같은 BossDef·initialRiskLevel에 대해 dungeon current risk 1과 5의 결과가 같은지도
검사한다. 기존 `+20%` 기대 테스트는 삭제하지 않고 새 불변식으로 교체한다.

- [ ] **Step 2: 현행 `retryBossStats`와 압력 미지원으로 RED인지 확인한다**

Run: `pnpm vitest run lib/rules/boss-battle-adapter.test.ts`

Expected: FAIL on 0.80 stats or pressure damage comparison.

- [ ] **Step 3: 공통 단계 보정과 per-member 배율 합성을 최소 구현한다**

```ts
export function balancedBossStats(boss: BossDef, initialRiskLevel: RiskLevel) {
  const multiplier = CAMPAIGN_BALANCE.bossBaseStatMultiplierByInitialRisk[initialRiskLevel];
  return {
    maxHp: Math.max(1, Math.round(boss.maxHp * multiplier)),
    baseDamage: Math.max(1, Math.round(boss.baseDamage * multiplier)),
  };
}

const pressure = combatMultipliersForAdvicePressure(input.advicePressure);
for (const member of aliveMembers) {
  multiplyRawAxis(axisMultipliers, member.id, "incomingDamage", pressure.incomingDamageMultiplier);
  multiplyRawAxis(axisMultipliers, member.id, "outgoingDamage", pressure.outgoingDamageMultiplier);
  if (merchantIncoming !== undefined) multiplyRawAxis(axisMultipliers, member.id, "incomingDamage", merchantIncoming);
  if (merchantOutgoing !== undefined) multiplyRawAxis(axisMultipliers, member.id, "outgoingDamage", merchantOutgoing);
}
```

`retryBossStats`를 제거하고 `dungeon.riskLevel`은 보스 능력치 계산에서 읽지 않는다.
보스 원본 규칙·표적 성향·cue와 지연 신뢰 검증은 바꾸지 않는다. 모든 호출부는
실제 원정 압력 또는 preview용 0을 전달한다.

- [ ] **Step 4: 보스·전이·preview 테스트와 타입 검사를 통과시킨다**

Run: `pnpm vitest run lib/rules/boss-battle-adapter.test.ts lib/rules/campaign-transition-expedition.test.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: 보스 변경을 커밋한다**

```bash
git add lib/rules/boss-battle-adapter.ts lib/rules/boss-battle-adapter.test.ts lib/rules/campaign-transition.ts components/game/u5-battle-preview-data.ts
git commit -m "밸런스: 보스 전투를 공통 위험도 단계로 조정한다" -m "재도전 위험도 차이 배율을 제거하고 초기 위험도 공통 80% 보정과 원정 조언 압력을 보스 정보 및 상인 효과에 합성한다."
```

## Task 6: 조언 판정과 현재 전투 사이에 압력 갱신을 연결한다

**Files:**

- Modify: `lib/rules/campaign-transition.ts:326-406,469-507`
- Modify: `lib/rules/campaign-transition-expedition.test.ts:77-235`
- Modify: `lib/backtest/public-state.test.ts`

**Interfaces:**

- Consumes: `advanceAdvicePressure`, 일반전·보스전의 `advicePressure` 입력.
- Produces: `판정 → 압력 갱신 → 현재 효과/전투` 순서와 비공개 회귀.

- [ ] **Step 1: 실제 transition에서 executed 결과가 압력을 바꾸는 실패 테스트를 쓴다**

```ts
function resolveExecutedPressure(outcome: "help" | "harm", initial: AdvicePressure): AdvicePressure {
  for (let index = 0; index < 100; index += 1) {
    const begun = started(`pressure-${outcome}-${index}`);
    const event = eventsForTheme("spider").find((candidate) =>
      candidate.kind === "rest" && candidate.advice.some((option) => option.outcome === outcome));
    if (event === undefined) throw new Error("rest 조언 fixture가 없다");
    const option = event.advice.find((candidate) => candidate.outcome === outcome)!;
    const active = begun.context.activeExpedition!;
    const context = {
      ...begun.context,
      activeExpedition: {
        ...active,
        expedition: { ...active.expedition, advicePressure: initial },
        pendingEvent: event,
      },
    };
    const next = transitionCampaign(begun.campaign, context, { type: "CHOOSE_ADVICE", adviceId: option.id });
    const pressure = next.context.activeExpedition!.expedition.advicePressure;
    if (pressure !== initial) return pressure;
  }
  throw new Error(`${outcome} executed 시드를 찾지 못했다`);
}

expect(resolveExecutedPressure("harm", 0)).toBe(1);
expect(resolveExecutedPressure("help", 2)).toBe(1);
```

이 테스트를 위해 `boardedCampaign(seed = SEED)`와 `started(seed = SEED)`가 받은
seed를 `initializeCampaign`까지 전달하도록 fixture helper만 매개변수화한다.

neutral과 전원 미수용은 순수 함수 테스트가 맡는다. 공개 projection 테스트는
`JSON.stringify(view)`가 `advicePressure`를 포함하지 않는지 확인한다.

- [ ] **Step 2: 원정 상태가 계속 0이라 RED인지 확인한다**

Run: `pnpm vitest run lib/rules/campaign-transition-expedition.test.ts lib/backtest/public-state.test.ts`

Expected: FAIL because executed help/harm does not update the expedition.

- [ ] **Step 3: 판정 직후 압력을 계산해 현재 전투와 상태에 동일하게 전달한다**

```ts
const advicePressure = advanceAdvicePressure(
  active.expedition.advicePressure,
  resolution.decision,
);

const battle = !isMonster(event) ? null : resolveMonsterEventBattle({
  event,
  modifier: applied.encounterModifier ?? {},
  activeMonsterIds: dungeon.activeMonsterIds,
  monsterDefs: theme.monsters,
  members: applied.members,
  classDefs: CLASSES,
  seed: `${campaign.seed}/${dungeon.id}/${dungeon.attempts}/${active.expedition.currentNodeId}`,
  pendingMerchantEffect: active.expedition.pendingMerchantEffect,
  advicePressure,
});

const nextExpedition: ExpeditionState = {
  ...active.expedition,
  advicePressure,
  infoRecords: [...active.expedition.infoRecords, ...resolution.decision.delayedRecords],
  pendingMerchantEffect: battle?.pendingMerchantEffect ?? active.expedition.pendingMerchantEffect,
  result: wiped ? { status: "wiped", survivorIds: [] } : active.expedition.result,
};
```

`transitionEnterBoss`는 이미 저장된 `expedition.advicePressure`를 전달한다. 압력은
history payload나 화면 adapter에 새 필드로 추가하지 않는다.

- [ ] **Step 4: 전이·공개 경계·Store 전체 흐름을 통과시킨다**

Run: `pnpm vitest run lib/rules/campaign-transition-expedition.test.ts lib/backtest/public-state.test.ts lib/store/campaign-store-flow.test.ts lib/store/campaign-full-run.test.ts`

Expected: PASS with deterministic campaigns and no rejected transition.

- [ ] **Step 5: 전체 타입 검사를 통과시킨다**

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: 압력 연결을 커밋한다**

```bash
git add lib/rules/campaign-transition.ts lib/rules/campaign-transition-expedition.test.ts lib/backtest/public-state.test.ts
git commit -m "밸런스: 조언 압력을 원정 전투에 연결한다" -m "수용된 도움과 방해 뒤 압력을 먼저 갱신해 현재 일반전과 이후 보스전에 적용하고 공개 전략 상태에는 내부 누적값을 노출하지 않는다."
```

## Task 7: 백테스트 driver에 원정 밸런스 trace를 추가한다

**Files:**

- Modify: `lib/backtest/campaign-driver.ts:24-117,135-278`
- Modify: `lib/backtest/campaign-driver.test.ts`

**Interfaces:**

```ts
export interface ExpeditionBalanceTrace {
  readonly expeditionId: string;
  readonly dungeonId: DungeonId;
  readonly theme: ThemeId;
  readonly initialRiskLevel: RiskLevel;
  readonly startAdvicePressure: 0;
  readonly maxAdvicePressure: AdvicePressure;
  readonly bossEntry: null | {
    readonly advicePressure: AdvicePressure;
    readonly aliveCount: number;
    readonly hp: number;
    readonly maxHp: number;
  };
  readonly endAdvicePressure: AdvicePressure | null;
  readonly result: ExpeditionStatus | null;
}

// Add to CampaignRunTrace and MutableTrace.
readonly balanceExpeditions: readonly ExpeditionBalanceTrace[];

type MutableExpeditionBalanceTrace = {
  -readonly [Key in keyof ExpeditionBalanceTrace]: ExpeditionBalanceTrace[Key];
};

// MutableTrace uses this mutable array; freezeTrace copies it to the public readonly shape.
balanceExpeditions: MutableExpeditionBalanceTrace[];
```

- Consumes: Store의 실제 active expedition과 party members.
- Produces: metrics가 규칙을 재계산하지 않고 소비할 원정별 진단 자료.

- [ ] **Step 1: 실제 한 판 trace의 불변식을 실패 테스트로 작성한다**

```ts
expect(result.ok).toBe(true);
if (!result.ok) return;
expect(result.trace.balanceExpeditions.length).toBeGreaterThanOrEqual(result.campaign.statistics.totalExpeditions);
expect(result.trace.balanceExpeditions.filter((one) => one.result !== null)).toHaveLength(
  result.campaign.statistics.totalExpeditions,
);
expect(result.trace.balanceExpeditions.every((one) => one.startAdvicePressure === 0)).toBe(true);
expect(result.trace.balanceExpeditions.every((one) => one.maxAdvicePressure >= 0 && one.maxAdvicePressure <= 3)).toBe(true);
expect(result.trace.balanceExpeditions.filter((one) => one.bossEntry !== null)
  .every((one) => one.bossEntry!.hp <= one.bossEntry!.maxHp)).toBe(true);
```

같은 seed·전략·정확도의 trace 동일성도 기존 결정성 테스트에 포함한다.

- [ ] **Step 2: `balanceExpeditions` 부재로 RED인지 확인한다**

Run: `pnpm vitest run lib/backtest/campaign-driver.test.ts`

Expected: FAIL because the trace field does not exist.

- [ ] **Step 3: action 경계에서 규칙 결과만 복사해 trace를 채운다**

```ts
// START_EXPEDITION after dispatch
trace.balanceExpeditions.push({
  expeditionId,
  dungeonId: active.expedition.dungeonId,
  theme: dungeon.theme,
  initialRiskLevel: dungeon.initialRiskLevel,
  startAdvicePressure: 0,
  maxAdvicePressure: active.expedition.advicePressure,
  bossEntry: null,
  endAdvicePressure: null,
  result: null,
});

// immediately before ENTER_BOSS
entry.bossEntry = {
  advicePressure: active.expedition.advicePressure,
  aliveCount: living.length,
  hp: living.reduce((sum, member) => sum + member.hp, 0),
  maxHp: living.reduce((sum, member) => sum + member.maxHp, 0),
};
```

CHOOSE_ADVICE 뒤에는 `maxAdvicePressure`, COMPLETE_EXPEDITION 직전에는
`endAdvicePressure`와 `result`를 갱신한다. 실패 run의 열린 원정은 result null로
보존한다. freeze 시 배열과 중첩 객체를 복사해 입력 변이를 막는다.

- [ ] **Step 4: driver와 full-run 회귀를 통과시킨다**

Run: `pnpm vitest run lib/backtest/campaign-driver.test.ts lib/store/campaign-full-run.test.ts`

Expected: PASS.

- [ ] **Step 5: trace 변경을 커밋한다**

```bash
git add lib/backtest/campaign-driver.ts lib/backtest/campaign-driver.test.ts
git commit -m "백테스트: 원정 밸런스 추적값을 수집한다" -m "실제 Store 액션 경계에서 조언 압력 최고치와 보스 진입 생존 인원 및 HP, 원정 종료 상태를 재계산 없이 기록한다."
```

## Task 8: 완주 전멸·압력·보스 병목 지표와 B1-B gate를 만든다

**Files:**

- Modify: `lib/backtest/metrics.ts:7-81,107-241`
- Modify: `lib/backtest/metrics.test.ts`
- Create: `lib/backtest/acceptance.ts`
- Create: `lib/backtest/acceptance.test.ts`
- Modify: `lib/backtest/report.ts`
- Modify: `lib/backtest/report.test.ts`

**Interfaces:**

```ts
// Add these properties to CombinationAggregate.
readonly completionRate: number;
readonly completedWipeMean: number | null;
readonly fivePlusWipeCount: number;
readonly fivePlusWipeRate: number | null;
readonly meanMaxAdvicePressure: number;
readonly meanBossEntryHpRatio: number | null;
readonly bossByThemeRisk: Readonly<Record<string, {
  readonly entries: number;
  readonly clears: number;
  readonly wipes: number;
  readonly meanEntryHpRatio: number;
}>>;

export const B1B_ACCEPTANCE = {
  completionRateByCombination: {
    "survival@0.7": [0.60, 0.80],
    "survival@0.4": [0.30, 0.40],
    "opportunist@0.7": [0.40, 0.60],
    "opportunist@0.4": [0.20, 0.30],
    "selective-betrayal@0.7": [0.20, 0.40],
    "selective-betrayal@0.4": [0.05, 0.15],
  },
  completedWipeMeanByCombination: {
    "survival@0.7": [2, 3],
    "survival@0.4": [3, 4],
    "selective-betrayal@0.7": [3, 4],
    "selective-betrayal@0.4": [3, 4],
  },
} as const;
```

- Consumes: `CampaignRunTrace.balanceExpeditions`, campaign statistics/history.
- Produces: inclusive band gate, 5+ wipe diagnostic, pressure·보스 병목 표.

- [ ] **Step 1: 손계산 fixture로 nullable 분모와 경계 포함 gate를 실패 테스트한다**

```ts
expect(combination.completedWipeMean).toBe(2.5);
expect(combination.fivePlusWipeCount).toBe(1);
expect(combination.meanBossEntryHpRatio).toBeCloseTo(0.5);

const gates = evaluateB1BAcceptance(aggregateAtExactBandEdges());
expect(gates.every((gate) => gate.passed)).toBe(true);
expect(() => evaluateB1BAcceptance(aggregateMissingCombination()))
  .toThrow("B1-B 조합 표본이 없다");
```

완주가 0건인 조합은 `completedWipeMean`과 `fivePlusWipeRate`가 null이며 wipe gate는
FAIL이다. 0으로 위장하지 않는다.

- [ ] **Step 2: 새 필드와 acceptance 모듈 부재로 RED인지 확인한다**

Run: `pnpm vitest run lib/backtest/metrics.test.ts lib/backtest/acceptance.test.ts lib/backtest/report.test.ts`

Expected: FAIL.

- [ ] **Step 3: 지표와 gate를 순수 집계로 최소 구현한다**

```ts
const completed = runs.filter((run) => run.completed);
const completedWipeMean = completed.length === 0
  ? null
  : completed.reduce((sum, run) => sum + run.wipedExpeditions, 0) / completed.length;
const fivePlusWipeCount = completed.filter((run) => run.wipedExpeditions >= 5).length;
const fivePlusWipeRate = completed.length === 0 ? null : fivePlusWipeCount / completed.length;
```

완주율·완주 전멸은 표의 양 끝을 포함해 판정한다. 기회주의 전멸과 5+ 비율,
엔딩·등급은 관찰 지표로만 렌더링한다. 기존 오류·accuracy interval·S 100% 미만·
배신 완주 gate는 유지하되 B1-A의 승인 대기 필드는 제거한다.

- [ ] **Step 4: 보고서에 설정과 진단 표를 추가한다**

보고서에 다음 절을 고정 순서로 렌더링한다.

```text
설정 revision과 현재 수치
고정 무결성 gate
B1-B 완주율·완주 전멸 gate
조합별 완주율·완주 전멸 평균·5+ 비율·압력·보스 진입 HP
위험도·테마별 보스 진입/클리어/전멸
엔딩·최종 등급 분포
paired 정확도 비교
오류와 대표 재현 seed
```

정렬되지 않은 같은 aggregate가 byte-for-byte 같은 Markdown을 내는 기존 테스트를
새 절까지 확장한다.

- [ ] **Step 5: 지표·gate·보고서 테스트를 통과시킨다**

Run: `pnpm vitest run lib/backtest/metrics.test.ts lib/backtest/acceptance.test.ts lib/backtest/report.test.ts`

Expected: PASS.

- [ ] **Step 6: 지표와 gate를 커밋한다**

```bash
git add lib/backtest/metrics.ts lib/backtest/metrics.test.ts lib/backtest/acceptance.ts lib/backtest/acceptance.test.ts lib/backtest/report.ts lib/backtest/report.test.ts
git commit -m "백테스트: B1-B 생존 기준과 진단 지표를 만든다" -m "전략별 완주율과 완주 전멸 평균을 승인 구간으로 판정하고 5회 이상 전멸, 조언 압력, 보스 진입 HP와 위험도별 병목을 결정적으로 보고한다."
```

## Task 9: 단계별 calibration runner와 holdout 잠금을 연결한다

**Files:**

- Modify: `lib/backtest/acceptance.ts`
- Modify: `lib/backtest/backtest.run.ts:10-82`
- Modify: `lib/backtest/backtest.run.test.ts`
- Modify: `package.json`
- Modify: `docs/README.md`

**Interfaces:**

```ts
export const B1B_HOLDOUT_APPROVED = false;

export interface BacktestSuiteOptions {
  readonly mode: "calibration" | "holdout";
  readonly seedsPerCombination: 2 | 50 | 100 | 200 | 2000;
  readonly namespace: "b1b-calibration-v1" | "b1b-holdout-v1";
}

export function optionsFromEnvironment(env?: NodeJS.ProcessEnv): BacktestSuiteOptions;
```

- Consumes: `B1B_ACCEPTANCE`, `CAMPAIGN_BALANCE.revision`, B1-A runner.
- Produces: structure/tune/quick/holdout 명령과 승인 전 holdout 거부.

- [ ] **Step 1: 새 namespace·표본·잠금을 실패 테스트로 쓴다**

```ts
expect(campaignSeed("b1b-calibration-v1", 17)).toBe("b1b-calibration-v1/000017");
expect(optionsFromEnvironment({ B1_BACKTEST_MODE: "calibration", B1_BACKTEST_SEEDS: "50" }).seedsPerCombination).toBe(50);
expect(optionsFromEnvironment({ B1_BACKTEST_MODE: "calibration", B1_BACKTEST_SEEDS: "100" }).seedsPerCombination).toBe(100);
expect(optionsFromEnvironment({ B1_BACKTEST_MODE: "calibration" }).seedsPerCombination).toBe(200);
expect(() => optionsFromEnvironment({ B1_BACKTEST_MODE: "holdout" })).toThrow("B1-B holdout은 calibration 승인 전이다");
```

2시드는 단위 테스트에서만 허용하고 50/100/200은 calibration, 2,000은 holdout에만
허용한다. 다른 숫자와 mode는 명시적으로 거부한다.

- [ ] **Step 2: 기존 B1 namespace와 승인 대기 오류 때문에 RED인지 확인한다**

Run: `pnpm vitest run lib/backtest/backtest.run.test.ts`

Expected: FAIL on namespace and 50/100 parsing.

- [ ] **Step 3: runner 옵션과 새 스크립트를 구현한다**

```json
{
  "backtest:structure": "B1_SOURCE_REVISION=$(git rev-parse --short HEAD) B1_BACKTEST_MODE=calibration B1_BACKTEST_SEEDS=50 vitest run --config vitest.backtest.config.ts",
  "backtest:tune": "B1_SOURCE_REVISION=$(git rev-parse --short HEAD) B1_BACKTEST_MODE=calibration B1_BACKTEST_SEEDS=100 vitest run --config vitest.backtest.config.ts",
  "backtest:quick": "B1_SOURCE_REVISION=$(git rev-parse --short HEAD) B1_BACKTEST_MODE=calibration B1_BACKTEST_SEEDS=200 vitest run --config vitest.backtest.config.ts",
  "backtest": "B1_SOURCE_REVISION=$(git rev-parse --short HEAD) B1_BACKTEST_MODE=holdout B1_BACKTEST_SEEDS=2000 vitest run --config vitest.backtest.config.ts"
}
```

calibration도 승인 gate를 진단 표시하지만 exit code 1로 만들지 않는다. holdout만
승인 잠금이 열려 있어야 실행하고 gate 하나라도 실패하면 exit code 1이다.
README의 B1-B 항목 아래에 새 plan 링크와 네 명령의 용도를 한 줄로 추가한다.

- [ ] **Step 4: runner·보고서·package script 정적 검사를 통과시킨다**

Run: `B1_BACKTEST_MODE=calibration B1_BACKTEST_SEEDS=2 pnpm vitest run --config vitest.backtest.config.ts && pnpm vitest run lib/backtest/backtest.run.test.ts lib/backtest/report.test.ts`

Expected: PASS and a 12-run deterministic calibration report is generated. 이 2시드 보고서는 커밋하지 않고 calibration Task에서 덮어쓴다.

- [ ] **Step 5: 타입 검사와 diff 형식을 확인한다**

Run: `pnpm typecheck && git diff --check`

Expected: PASS.

- [ ] **Step 6: runner를 커밋하되 생성된 2시드 보고서는 제외한다**

```bash
git add lib/backtest/acceptance.ts lib/backtest/backtest.run.ts lib/backtest/backtest.run.test.ts package.json docs/README.md
git commit -m "백테스트: B1-B 단계별 실행기를 연결한다" -m "50·100·200시드 calibration과 2,000시드 holdout 명령을 새 namespace로 분리하고 사용자 승인 전에는 holdout 실행을 거부한다."
```

## Task 10: calibration으로 수치를 맞추고 승인 뒤 독립 holdout을 판정한다

**Files:**

- Modify during calibration: `lib/balance/campaign-balance.ts`
- Modify after approval: `lib/backtest/acceptance.ts`
- Generate: `docs/technical/BACKTEST_REPORT.md`
- Modify after final values: `docs/systems/CHARACTER_POOL_AND_WORLDTURN.md`
- Modify after final values: `docs/systems/INFORMATION_AND_DECEPTION.md`
- Modify after final values: `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`
- Modify after final result: `docs/systems/PROGRESSION_AND_ENDINGS.md`
- Modify after final result: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`
- Modify after final result: `docs/README.md`

**Interfaces:**

- Consumes: 모든 프로덕션 변경, B1-B 지표·gate·runner.
- Produces: 승인된 최종 설정 revision, calibration 보고서, 오염되지 않은 holdout 판정.

- [ ] **Step 1: calibration 전 전체 회귀를 확인한다**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`

Expected: all commands exit 0. 실패하면 calibration을 시작하지 않고 원인을 수정한 뒤
관련 태스크의 테스트부터 다시 실행한다.

- [ ] **Step 2: 조합당 50시드 구조 검증을 실행한다**

Run: `pnpm backtest:structure`

Expected: 300 runs × deterministic duplicate가 끝나고 오류·거부·정지·비결정성 0건.
완주율이 아직 목표 밖인 것은 이 단계의 명령 실패가 아니다.

- [ ] **Step 3: 구조 보고서로 한 축씩 조정한다**

다음 순서를 지키고 한 번에 한 종류의 설정만 바꾼다.

```text
1. 특정 초기 위험도에서 보스 진입 HP는 충분하지만 보스 전멸이 몰림
   → 그 위험도 boss multiplier를 0.025 낮춤, 하한 0.75
2. 보스 전보다 캠페인 후반 deployable/alive가 먼저 마름
   → rest 0.20 → 0.225 → 0.25 순서로 한 단계씩 올림
3. 0.4와 0.7 완주율 간격이 목표보다 좁음
   → pressure 2·3 incoming을 0.05 올리거나 outgoing을 0.05 낮춤
4. 정확도 0.4가 하한 아래이고 0.7이 목표 안
   → pressure 2·3 incoming을 0.05 낮추거나 outgoing을 0.05 올림
5. 같은 전략의 두 정확도가 모두 상한 위
   → 병목 위험도 boss multiplier를 0.025 올림, 상한 0.85
6. 정확도 0.7만 상한 위이고 0.4는 목표 안
   → pressure 1 incoming을 최대 0.05 올리거나 outgoing을 최대 0.05 낮춤
```

압력 1단계는 incoming 1.00~1.10, outgoing 0.95~1.00 안에서 경미하게 유지한다.
항상 incoming `0≤1≤2≤3`, outgoing `0≥1≥2≥3` 단조성을 지킨다. 한 조정마다 해당
단위 테스트와 `pnpm backtest:structure`를 다시 실행하고 아래 형식으로 별도 커밋한다.

```bash
git add lib/balance/campaign-balance.ts docs/technical/BACKTEST_REPORT.md
git commit -m "밸런스: B1-B 구조 측정값을 조정한다" -m "대표 병목 지표와 재현 시드를 근거로 승인 범위 안의 단일 설정 축을 조정하고 50시드 구조 검증을 다시 실행한다."
```

- [ ] **Step 4: 조합당 100시드 1차 보정을 실행한다**

Run: `pnpm backtest:tune`

Expected: 600 runs × deterministic duplicate, 무결성 오류 0건. 목표 구간 밖이면 Step 3
규칙으로 한 축만 조정하고 100시드를 다시 실행한다. 보스 배율 0.75~0.85와 휴식
0.20~0.25 밖의 값이 필요하면 구현을 멈추고 spec 변경 승인을 요청한다.

- [ ] **Step 5: 조합당 200시드 최종 calibration을 실행한다**

Run: `pnpm backtest:quick`

Expected: 1,200 runs × deterministic duplicate, 여섯 완주율과 네 완주 전멸 평균 gate
PASS, 무결성 gate 전부 PASS. 실패하면 holdout으로 넘어가지 않고 Step 3 규칙으로
돌아간다.

- [ ] **Step 6: calibration 보고서를 커밋하고 사용자 검토에서 멈춘다**

Run: `git diff --check && pnpm vitest run docs/DOCUMENT_LINKS.test.ts docs/DOCUMENT_TERMINOLOGY.test.ts docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.test.ts`

Expected: PASS.

```bash
git add lib/balance/campaign-balance.ts docs/technical/BACKTEST_REPORT.md
git commit -m "백테스트: B1-B calibration 결과를 기록한다" -m "승인된 완주율과 전멸 구간을 만족한 200시드 결과, 5회 이상 전멸 분포와 최종 밸런스 revision을 재현 보고서로 남긴다."
```

사용자에게 여섯 완주율, 네 완주 전멸 평균, 5회 이상 비율, 엔딩·등급 분포와 대표
경계 시드를 제시한다. 사용자가 calibration과 5회 이상 분포를 명시적으로 승인하기
전에는 다음 step을 실행하지 않는다.

- [ ] **Step 7: 승인된 설정과 관찰 정책을 동결한다**

사용자가 현재 spec대로 5회 이상 비율을 관찰 지표로 승인하면 다음처럼 고정한다.

```ts
export const B1B_HOLDOUT_APPROVED = true;
export const B1B_HIGH_WIPE_POLICY = { kind: "observe" } as const;
```

`CAMPAIGN_BALANCE.revision`을 `b1b-final-v1`로 바꾸고, 그 객체의 실제 literal 값을
월드턴·정보와 기만·던전 이벤트와 보스 공식 문서에 그대로 옮긴다. 사용자가 수치
상한을 새로 요구하면 이 step을 실행하지 말고 spec과 plan을 먼저 개정한다.

Run: `pnpm vitest run lib/balance/campaign-balance.test.ts lib/backtest/acceptance.test.ts lib/backtest/backtest.run.test.ts && git diff --check`

Expected: PASS.

```bash
git add lib/balance/campaign-balance.ts lib/backtest/acceptance.ts lib/backtest/acceptance.test.ts lib/backtest/backtest.run.test.ts docs/systems/CHARACTER_POOL_AND_WORLDTURN.md docs/systems/INFORMATION_AND_DECEPTION.md docs/systems/DUNGEON_EVENTS_AND_BOSSES.md docs/superpowers/specs/2026-08-24-lattebun-b1-balance-redesign-design.md
git commit -m "밸런스: B1-B holdout 기준을 동결한다" -m "승인된 최종 수치와 5회 이상 전멸 관찰 정책을 코드와 공식 설정집에 고정하고 독립 holdout 잠금을 연다."
```

- [ ] **Step 8: 사용하지 않은 2,000시드 holdout을 한 번 실행한다**

Run: `pnpm backtest`

Expected on pass: 12,000 runs × deterministic duplicate, 모든 고정·완주율·완주 전멸
gate PASS, exit 0. FAIL이면 같은 결과에 맞춰 수치를 바꾸지 않고 보고서와 대표
시드를 보존하며 B1을 진행 중으로 둔다.

- [ ] **Step 9: holdout 결과에 따라 작업 상태를 정확히 갱신한다**

PASS일 때만 다음을 적용한다.

```text
CAMPAIGN_REWORK_WORK_ASSIGNMENT: 41개 완료, 2개 남음
B1 상태: ✅
현재 임계 경로: Q1 → Q2
PROGRESSION_AND_ENDINGS: 최종 holdout namespace·표본·PASS 근거
README: 최종 보고서와 plan 링크
```

FAIL이면 B1 `🟡`, `B1 → Q1 → Q2`, 40개 완료·3개 남음을 유지하고 실패 gate와 새
설계 필요 여부만 문서에 기록한다.

- [ ] **Step 10: 최종 전체 검증을 새로 실행한다**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && git diff --check`

Expected: all commands exit 0.

Run: `pnpm vitest run docs/DOCUMENT_LINKS.test.ts docs/DOCUMENT_TERMINOLOGY.test.ts docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.test.ts`

Expected: 3 test files PASS.

- [ ] **Step 11: 최종 보고서와 작업 상태를 커밋한다**

PASS:

```bash
git add docs/technical/BACKTEST_REPORT.md docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md docs/systems/PROGRESSION_AND_ENDINGS.md docs/README.md
git commit -m "백테스트: B1-B 독립 holdout을 통과한다" -m "동결한 수치와 승인 기준으로 새 12,000캠페인을 실행해 모든 gate를 통과하고 B1을 완료해 Q1 선행을 해제한다."
```

FAIL:

```bash
git add docs/technical/BACKTEST_REPORT.md docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md docs/systems/PROGRESSION_AND_ENDINGS.md docs/README.md
git commit -m "백테스트: B1-B holdout 실패를 기록한다" -m "동결한 기준을 옮기지 않고 실패 gate와 대표 재현 시드를 보존하며 B1을 진행 중으로 유지한다."
```

## Execution Checkpoints

1. Task 1~3 뒤: 설정·월드턴·상태 계약 검토
2. Task 4~6 뒤: 일반전·보스전·캠페인 전이 검토
3. Task 7~9 뒤: 계측·gate·runner 검토
4. Task 10 Step 6 뒤: calibration 사용자 승인 대기
5. Task 10 Step 8 뒤: holdout은 수치 변경 없이 최종 판정

## Final Acceptance

- `ExpeditionState.advicePressure`가 0~3이고 새 원정마다 0이다.
- executed harm/help만 압력을 ±1 바꾸며 현재 전투부터 적용한다.
- 일반전과 보스전은 재도전 횟수·현재 위험도 차이로 강화되지 않는다.
- 보스는 초기 위험도 공통 단계 배율을 받고 테마 특징과 표적 성향을 유지한다.
- 월드턴은 최종 승인된 0.20~0.25 휴식과 5~10% 백그라운드 피해를 사용한다.
- 전략 projection은 압력과 조언 outcome을 노출하지 않는다.
- calibration 1,200판과 holdout 12,000판은 서로 다른 승인된 namespace를 쓴다.
- 여섯 완주율과 네 완주 전멸 평균이 승인 범위를 만족한다.
- 오류·거부·정지·step 초과·비결정성은 0건이다.
- holdout 결과 뒤 같은 namespace에 맞춘 수치 조정은 없다.
- lint·typecheck·전체 test·build와 문서 검사가 통과한다.
