# 성직자 응급 치유 재조정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 성직자의 전투당 치유 제한을 제거하고, 원정당 2회 자원 안에서 대상 최대 HP의 25%를 반올림해 회복하도록 기존 구현을 재조정한다.

**Architecture:** `EmergencyHealAbilityDef`는 고정 회복량과 전투별 횟수 대신 대상 최대 HP 회복 백분율만 소유한다. 순수 전투 엔진은 원정에서 전달된 `remainingUses`만 소비하며 같은 전투에서 조건이 두 번 성립하면 두 번 모두 치유한다. U5와 백테스트는 확정된 `heal` action을 재계산하지 않고 검증·재생하되, 구조 gate는 새 25% 공식과 원정당 2회 계약을 검사한다.

**Tech Stack:** TypeScript 5, Next.js 16.3.0, React 19.2.8, Zustand 5.0.14, Vitest 4.1.10, Playwright 1.62.1, pnpm 11.21.0

**Spec:** `docs/superpowers/specs/2026-08-26-lattebun-cleric-emergency-heal-design.md`

- 작성자: LatteBun
- 작성 도구: Codex

## Global Constraints

- 표시 이름은 `치유 기도`, 안정 식별자는 `emergencyHeal`, 원정당 사용 횟수는 2회, 발동 기준은 HP 50% 이하로 유지한다.
- 전투당 추가 제한은 없다. 같은 전투에서 조건이 다시 성립하고 `remainingUses > 0`이면 두 번째 치유도 수행한다.
- 명목 회복량은 `Math.round(target.maxHp * 25 / 100)`, 실제 회복량은 `Math.min(nominalHealing, target.maxHp - target.hp)`다.
- 성직자의 기존 최대 HP 28, 공격력 5, 피격 가중치 1과 다른 직업·몬스터·보스·휴식 수치는 바꾸지 않는다.
- 치유는 공격 한 번을 대신한다. 사망자·승리 뒤 대상·전투 밖 회복·부활은 허용하지 않는다.
- 대상은 50% 이하 생존자 중 HP 비율이 가장 낮은 인원이며 교차 곱과 파티 입력 순서 동률 규칙을 유지한다.
- 치유 조건·대상·회복량 계산은 RNG를 소비하지 않는다. 능력 미보유·미발동 전투의 기존 결정성을 보존한다.
- 원정 잔여 횟수는 `ExpeditionState`가 소유하고 일반전부터 보스전까지 전달한다. 새 원정·재도전만 2회로 초기화한다.
- `healAmount`와 `maxUsesPerBattle`은 호환 필드로 남기지 않고 타입·검증·fixture에서 제거한다.
- 직업 ID 직접 분기나 범용 스킬 프레임워크를 추가하지 않는다.
- U5는 확정 action의 실제 `healing`과 잔여 횟수를 재생하며 전투 규칙을 다시 계산하지 않는다.
- 50→100→200시드 paired calibration만 실행하고 2,000시드 holdout은 실행하지 않는다. 치유 외 밸런스 수치는 같은 변경에서 조정하지 않는다.
- UI 작업 전에 `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`, 테스트 작업 전에 `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`와 `playwright.md`를 읽는다.
- 모든 커밋은 제목과 본문을 한글로 작성한다.

## File Structure

### 새 파일

- 없음. 기존 능력 계약의 재조정이므로 새 계층이나 범용 추상화를 만들지 않는다.

### 수정 파일

- `lib/domain/character.ts`, `lib/content/classes.ts`, `lib/content/class-validation.ts`와 관련 테스트: `healTargetMaxHpPercent: 25` 계약과 검증.
- `lib/rules/battle-ability-state.ts`와 테스트: 직업 정의와 런타임 능력 정의의 동일성 검사 갱신.
- `lib/rules/battle-engine.ts`와 테스트: 전투당 카운터 제거, 대상 최대 HP 비례 회복, 동일 전투 2회 사용.
- `lib/rules/expedition-events.test.ts`: 주입 능력 fixture를 새 타입으로 갱신하고 일반전 잔여 횟수 전달을 재검증.
- `components/game/u5-battle-replay.ts`, `components/game/u5-battle-replay.test.ts`, `components/game/u5-battle-test-fixture.ts`: 새 회복 상한 검증과 동일 전투 2회 replay.
- `components/game/u5-battle-preview-data.ts`, `components/game/u5-battle-preview-data.test.ts`, `components/game/party-member-ability-view.test.ts`: 실제 프리뷰·카드 fixture의 새 능력 정의와 동적 `+N` 검증.
- `lib/backtest/metrics.ts`, `lib/backtest/acceptance.ts`, `lib/backtest/report.ts`와 관련 테스트: 전투당 0·1·2회 분포와 25% 구조 gate.
- `docs/README.md`, 기존 spec·공식 시스템 문서, `docs/technical/BACKTEST_REPORT.md`: plan 색인, 구현 상태, paired 측정 결과.

---

### Task 1: 변경 전 재조정 기준선 보존

**Files:**
- Verify: `lib/backtest/backtest.run.ts`
- Create outside repository: `.superpowers/sdd/2026-08-26-lattebun-cleric-emergency-heal-rebalance/write-baseline.test.ts`
- Runtime artifacts outside repository: `/private/tmp/dungeon-schemer-cleric-heal-rebalance/baseline-{50,100,200}.json`

**Interfaces:**
- Consumes: 현재 고정 5 HP·전투당 1회 구현과 `seed × strategy × accuracy` paired key.
- Produces: Task 5가 같은 표본 크기로 비교할 읽기 전용 baseline snapshot 세 개.

- [ ] **Step 1: 기준선 저장 경로를 만들고 현재 상태를 확인한다**

Run:

```bash
mkdir -p /private/tmp/dungeon-schemer-cleric-heal-rebalance
git status --short
```

Expected: 구현 파일 변경이 없고, plan/spec 문서 변경만 이미 커밋된 상태다.

- [ ] **Step 2: plan-local 기준선 writer를 만든다**

아래 Vitest 파일은 기존 순수 helper만 호출한다. production CLI는 snapshot 경로 하나만 받을 때도 paired 비교로 해석하고 `BACKTEST_REPORT.md`를 바꾸므로 기준선 생성에 사용하지 않는다.

```ts
import { describe, expect, it } from "vitest";
import {
  runBacktestSuite,
  writeBacktestSnapshotIfRequested,
} from "/Users/danny/MakeBun/Dungeon_Schemer/.worktrees/cleric-emergency-heal/lib/backtest/backtest.run";

const seeds = Number(process.env.CLERIC_REBALANCE_SEEDS) as 50 | 100 | 200;
const snapshotPath = process.env.CLERIC_REBALANCE_SNAPSHOT_PATH;

describe("성직자 치유 재조정 기준선", () => {
  it("현재 규칙의 snapshot을 기록한다", () => {
    const aggregate = runBacktestSuite({
      mode: "calibration",
      focus: "risk-curve",
      seedsPerCombination: seeds,
      namespace: "b1-risk-curve-v2-calibration",
    });
    writeBacktestSnapshotIfRequested(snapshotPath, aggregate);
    expect(snapshotPath).toBeDefined();
  });
});
```

- [ ] **Step 3: 50시드 기준선을 생성한다**

Run:

```bash
CLERIC_REBALANCE_SEEDS=50 CLERIC_REBALANCE_SNAPSHOT_PATH=/private/tmp/dungeon-schemer-cleric-heal-rebalance/baseline-50.json pnpm exec vitest run .superpowers/sdd/2026-08-26-lattebun-cleric-emergency-heal-rebalance/write-baseline.test.ts
```

Expected: PASS, snapshot의 `sourceRevision`이 `cleric-heal-rebalance-baseline`이다.

- [ ] **Step 4: 100·200시드 기준선을 순서대로 생성한다**

Run:

```bash
CLERIC_REBALANCE_SEEDS=100 CLERIC_REBALANCE_SNAPSHOT_PATH=/private/tmp/dungeon-schemer-cleric-heal-rebalance/baseline-100.json pnpm exec vitest run .superpowers/sdd/2026-08-26-lattebun-cleric-emergency-heal-rebalance/write-baseline.test.ts
CLERIC_REBALANCE_SEEDS=200 CLERIC_REBALANCE_SNAPSHOT_PATH=/private/tmp/dungeon-schemer-cleric-heal-rebalance/baseline-200.json pnpm exec vitest run .superpowers/sdd/2026-08-26-lattebun-cleric-emergency-heal-rebalance/write-baseline.test.ts
```

Expected: 두 실행 모두 PASS하고 baseline 파일 세 개가 존재한다. 이 runtime artifact는 Git에 추가하지 않는다.

### Task 2: 직업 능력 타입과 콘텐츠 계약 교체

**Files:**
- Modify: `lib/domain/character.ts`
- Modify: `lib/content/classes.ts`
- Modify: `lib/content/class-validation.ts`
- Modify: `lib/content/classes.test.ts`
- Modify: `lib/content/class-validation.test.ts`
- Modify: `lib/rules/battle-ability-state.ts`
- Modify: `lib/rules/battle-ability-state.test.ts`
- Modify: `lib/rules/expedition-events.test.ts`
- Modify: `components/game/party-member-ability-view.test.ts`

**Interfaces:**
- Consumes: 기존 `EmergencyHealAbilityDef`, `validateClasses`, `hydrateBattlePartyAbility`, `sameAbilityDefinition` 경계.
- Produces:

```ts
export interface EmergencyHealAbilityDef {
  readonly kind: "emergencyHeal";
  readonly name: string;
  readonly healTargetMaxHpPercent: number;
  readonly usesPerExpedition: number;
  readonly triggerAtOrBelowHpPercent: number;
}
```

- [ ] **Step 1: 새 콘텐츠 계약의 실패 테스트를 작성한다**

`lib/content/classes.test.ts`에서 성직자 능력을 다음 값으로 고정한다.

```ts
expect(cleric?.battleAbility).toEqual({
  kind: "emergencyHeal",
  name: "치유 기도",
  healTargetMaxHpPercent: 25,
  usesPerExpedition: 2,
  triggerAtOrBelowHpPercent: 50,
});
```

`lib/content/class-validation.test.ts`에는 `healTargetMaxHpPercent`의 0·음수·비정수·101·안전하지 않은 정수를 거부하고, 제거된 `healAmount`·`maxUsesPerBattle`만으로는 유효한 정의가 되지 않는 사례를 추가한다.

- [ ] **Step 2: 테스트가 이전 필드 때문에 실패하는지 확인한다**

Run:

```bash
pnpm exec vitest run lib/content/classes.test.ts lib/content/class-validation.test.ts lib/rules/battle-ability-state.test.ts
```

Expected: `healTargetMaxHpPercent` 누락 또는 이전 객체 형상 차이로 FAIL.

- [ ] **Step 3: 타입·콘텐츠·검증기를 최소 변경한다**

`EmergencyHealAbilityDef`와 성직자 콘텐츠에서 `healAmount`, `maxUsesPerBattle`을 제거하고 `healTargetMaxHpPercent: 25`를 추가한다. `validateBattleAbility`는 아래 범위를 검증한다.

```ts
requirePositiveSafeInteger(
  candidate.healTargetMaxHpPercent,
  "healTargetMaxHpPercent",
  classId,
);
if ((candidate.healTargetMaxHpPercent as number) > 100) {
  invalid("직업 능력의 대상 최대 HP 회복 백분율이 100을 초과한다", {
    contentType: "classBattleAbility",
    classId,
    field: "healTargetMaxHpPercent",
    value: candidate.healTargetMaxHpPercent,
  });
}
```

전투당 횟수 비교 검증은 삭제한다.

- [ ] **Step 4: 능력 hydrate/extract와 모든 주입 fixture를 새 필드로 맞춘다**

`sameAbilityDefinition`은 `healTargetMaxHpPercent`, `usesPerExpedition`, `triggerAtOrBelowHpPercent`만 비교한다. 테스트 fixture도 동일한 세 수치 필드를 사용하며 잔여 횟수 생명주기는 바꾸지 않는다.

- [ ] **Step 5: 타입·콘텐츠 테스트를 통과시킨다**

Run:

```bash
pnpm exec vitest run lib/content/classes.test.ts lib/content/class-validation.test.ts lib/rules/battle-ability-state.test.ts lib/rules/expedition-events.test.ts components/game/party-member-ability-view.test.ts
pnpm typecheck
```

Expected: 모든 테스트와 typecheck PASS, `rg -n "healAmount|maxUsesPerBattle" lib/domain lib/content lib/rules components/game/party-member-ability-view.test.ts` 결과가 Task 3·4에서 아직 변경할 전투/replay 파일에만 남는다.

- [ ] **Step 6: 커밋한다**

```bash
git add lib/domain/character.ts lib/content/classes.ts lib/content/classes.test.ts lib/content/class-validation.ts lib/content/class-validation.test.ts lib/rules/battle-ability-state.ts lib/rules/battle-ability-state.test.ts lib/rules/expedition-events.test.ts components/game/party-member-ability-view.test.ts
git commit -m "리팩터링: 성직자 치유 능력을 비례 수치로 표현한다" -m "고정 회복량과 전투당 한도 필드를 제거하고 대상 최대 체력 회복 백분율 25를 직업 콘텐츠 계약으로 정의한다."
```

### Task 3: 전투 엔진의 25% 회복과 동일 전투 2회 사용

**Files:**
- Modify: `lib/rules/battle-engine.ts`
- Modify: `lib/rules/battle-engine.test.ts`

**Interfaces:**
- Consumes: Task 2의 `BattlePartyMemberAbilityState.healTargetMaxHpPercent`와 `remainingUses`.
- Produces: 실제 HP 증가량을 기록한 기존 `BattleHealActionRecord`; 같은 전투에서 actor당 0·1·2개의 `heal` action.

- [ ] **Step 1: 대상 최대 HP별 회복량 실패 테스트를 작성한다**

전사·궁수·성직자·마법사·도적 최대 HP에 대해 명목 회복량이 각각 11·8·7·6·8인지 table test로 고정한다. 각 입력은 대상 HP를 1로 두고 `healing`과 `targetHpAfter`를 함께 검증한다.

```ts
it.each([
  [45, 11],
  [30, 8],
  [28, 7],
  [24, 6],
  [32, 8],
])("대상 최대 HP %i의 25%%를 반올림해 %i 회복한다", (maxHp, healing) => {
  const result = resolveBattle(battleWithInjuredTarget({ maxHp, hp: 1 }));
  expect(result.actions.find((action) => action.kind === "heal"))
    .toMatchObject({ healing, targetHpBefore: 1, targetHpAfter: 1 + healing });
});
```

- [ ] **Step 2: 동일 전투 2회 사용 실패 테스트를 작성한다**

HP 1/45 전사, 잔여 2회 성직자, 피해 0·충분한 HP의 적 fixture로 두 라운드 연속 치유를 유도한다. `heal` action의 실제 회복량 `[11, 11]`, 대상 HP 사슬 `1→12→23`, 성직자 최종 `remainingUses: 0`을 검증한다. 세 번째 행동 기회에는 치유가 없고 공격하는지도 확인한다.

- [ ] **Step 3: 기존 엔진에서 실패하는지 확인한다**

Run:

```bash
pnpm exec vitest run lib/rules/battle-engine.test.ts
```

Expected: 기존 고정 5 또는 `maxUsesPerBattle` 조건 때문에 새 테스트 FAIL.

- [ ] **Step 4: 전투별 카운터를 제거하고 회복 공식을 적용한다**

`abilityUsesInBattleByActorId`와 `usesInBattle < ability.maxUsesPerBattle` 조건을 삭제한다. 치유 대상이 있으면 다음 계산만 수행한다.

```ts
const nominalHealing = Math.round(
  healTarget.maxHp * ability.healTargetMaxHpPercent / 100,
);
const healing = Math.min(nominalHealing, healTarget.maxHp - before);
```

`healing > 0`일 때만 `remainingUses`를 1 감소시키고 공격 대신 기존 `heal` action을 기록한다. RNG 호출 위치와 공격 경로는 변경하지 않는다.

- [ ] **Step 5: 엔진 회귀를 통과시킨다**

Run:

```bash
pnpm exec vitest run lib/rules/battle-engine.test.ts lib/rules/expedition-events.test.ts lib/rules/boss-battle-adapter.test.ts
pnpm typecheck
```

Expected: 새 비례 회복·2회 사용과 기존 미발동 결정성 테스트 모두 PASS.

- [ ] **Step 6: 커밋한다**

```bash
git add lib/rules/battle-engine.ts lib/rules/battle-engine.test.ts
git commit -m "기능: 치유를 최대 체력의 25퍼센트로 조정한다" -m "전투당 제한을 제거해 원정 잔여 횟수 안에서 같은 전투에도 두 번 치유하고 실제 회복량을 확정 행동에 기록한다."
```

### Task 4: U5 replay·프리뷰의 새 회복 계약

**Files:**
- Modify: `components/game/u5-battle-replay.ts`
- Modify: `components/game/u5-battle-replay.test.ts`
- Modify: `components/game/u5-battle-test-fixture.ts`
- Modify: `components/game/u5-battle-preview-data.ts`
- Modify: `components/game/u5-battle-preview-data.test.ts`
- Modify: `components/game/U5BattleScene.test.tsx`

**Interfaces:**
- Consumes: Task 3의 확정 `heal` action과 전투 결과의 최종 `remainingUses`.
- Produces: 치유 action마다 `attack → impact → settle` 세 프레임, 실제 `+N`, settle마다 1회 감소하는 replay 잔여 맵.

- [ ] **Step 1: 동일 전투 두 치유의 replay 실패 테스트를 작성한다**

`u5-battle-replay.test.ts` fixture에 같은 actor의 11 HP 치유 두 건과 최종 `remainingUses: 0`을 넣는다. 시작 프레임은 2, 첫 settle은 1, 둘째 settle과 complete는 0인지 확인한다.

- [ ] **Step 2: 비례 회복 상한 실패 테스트를 작성한다**

대상 `maxHp: 45`에는 `healing: 11`을 허용하고 12를 거부한다. 대상 `maxHp: 30`에는 8을 허용하고 9를 거부한다. 검증은 actor의 고정량이 아니라 action 대상의 `maxHp`와 `healTargetMaxHpPercent`를 사용해야 한다.

- [ ] **Step 3: replay 테스트가 이전 전투당 한도 검증 때문에 실패하는지 확인한다**

Run:

```bash
pnpm exec vitest run components/game/u5-battle-replay.test.ts components/game/u5-battle-preview-data.test.ts components/game/U5BattleScene.test.tsx
```

Expected: 같은 actor의 두 치유 또는 새 회복량 상한에서 FAIL.

- [ ] **Step 4: replay 검증과 fixture를 새 계약으로 바꾼다**

`healActionCount > ability.maxUsesPerBattle` 거부를 삭제한다. 각 치유 action은 다음 상한을 검증한다.

```ts
const maximumHealing = Math.round(
  target.maxHp * actorAbility.healTargetMaxHpPercent / 100,
);
if (action.healing > maximumHealing) invalid("치유량이 능력 범위를 벗어난다");
```

시작 잔여 횟수 복원은 `final remainingUses + healActionCount`를 계속 사용하고 `usesPerExpedition`을 넘으면 거부한다. 테스트·프리뷰 fixture의 `+5` 고정 단정은 해당 대상의 실제 25% 값으로 교체한다.

- [ ] **Step 5: U5 관련 회귀를 통과시킨다**

Run:

```bash
pnpm exec vitest run components/game/u5-battle-replay.test.ts components/game/u5-battle-preview-data.test.ts components/game/U5BattleScene.test.tsx components/game/U5ProgressScreen.test.tsx components/game/campaign-adapters.test.ts components/game/campaign-render.test.tsx
pnpm typecheck
```

Expected: 동적 `+N`, HP 사슬, 잔여 횟수 프레임, 완료 상태 테스트 모두 PASS.

- [ ] **Step 6: 커밋한다**

```bash
git add components/game/u5-battle-replay.ts components/game/u5-battle-replay.test.ts components/game/u5-battle-test-fixture.ts components/game/u5-battle-preview-data.ts components/game/u5-battle-preview-data.test.ts components/game/U5BattleScene.test.tsx
git commit -m "수정: U5가 비례 치유를 재생하게 한다" -m "대상 최대 체력 기준 회복 상한과 같은 전투의 두 치유를 검증하고 프레임별 HP와 잔여 횟수를 동기화한다."
```

### Task 5: 백테스트 지표·구조 gate와 paired calibration

**Files:**
- Modify: `lib/backtest/metrics.ts`
- Modify: `lib/backtest/metrics.test.ts`
- Modify: `lib/backtest/acceptance.ts`
- Modify: `lib/backtest/acceptance.test.ts`
- Modify: `lib/backtest/report.ts`
- Modify: `lib/backtest/report.test.ts`
- Modify: `lib/backtest/battle-ability-comparison.test.ts`
- Generate: `docs/technical/BACKTEST_REPORT.md`
- Runtime artifacts outside repository: `/private/tmp/dungeon-schemer-cleric-heal-rebalance/after-{50,100,200}.json`

**Interfaces:**
- Consumes: Task 1 baseline snapshots, Task 3의 확정 action, trace 파티원의 `maxHp`, 전투 전후 잔여 횟수.
- Produces:

```ts
readonly healUsesPerBattle:
  Readonly<Record<0 | 1 | 2, number>> & { readonly overLimit: number };
```

- [ ] **Step 1: 전투당 2회 지표의 실패 테스트를 작성한다**

한 전투에 같은 성직자의 치유 action 두 건이 있으면 `healUsesPerBattle[2]`가 1 증가하고 `overLimit`은 0인지 검증한다. 세 건은 `overLimit`만 증가시킨다.

- [ ] **Step 2: 25% 구조 gate 실패 테스트를 작성한다**

대상 `maxHp: 45`, `targetHpBefore: 1`일 때 11 회복은 통과하고 5와 12는 `healing-amount-and-hp`를 실패시킨다. 한 전투 2회는 더 이상 `healing-battle-use-limit` 실패가 아니며, 한 원정 3회는 `healing-expedition-use-limit`과 잔여 사슬 gate가 실패해야 한다.

- [ ] **Step 3: 보고서 형식 실패 테스트를 작성한다**

전투당 분포 행이 `0·1·2회/초과` 네 값을 출력하고, 구조 gate 목록에서 독립적인 전투당 1회 계약을 제거했는지 검증한다.

- [ ] **Step 4: 백테스트 단위 테스트가 실패하는지 확인한다**

Run:

```bash
pnpm exec vitest run lib/backtest/metrics.test.ts lib/backtest/acceptance.test.ts lib/backtest/report.test.ts lib/backtest/battle-ability-comparison.test.ts
```

Expected: 기존 `0 | 1` 분포와 고정 `1~5` gate 때문에 FAIL.

- [ ] **Step 5: 지표와 구조 gate를 최소 변경한다**

전투당 분포를 0·1·2·초과로 확장한다. `healing-battle-use-limit`은 제거하고 원정당 2회·잔여 횟수 사슬 gate가 실질 한도를 소유하게 한다. 회복량 검증은 target의 `maxHp`를 찾아 아래 값을 요구한다.

```ts
const expectedHealing = Math.min(
  Math.round(target.maxHp * 25 / 100),
  target.maxHp - action.targetHpBefore,
);
if (action.healing !== expectedHealing) fail("healing-amount-and-hp");
```

- [ ] **Step 6: 백테스트 단위 테스트를 통과시킨다**

Run:

```bash
pnpm exec vitest run lib/backtest/metrics.test.ts lib/backtest/acceptance.test.ts lib/backtest/report.test.ts lib/backtest/backtest.run.test.ts lib/backtest/battle-ability-comparison.test.ts
```

Expected: 모든 지표·gate·보고서 테스트 PASS.

- [ ] **Step 7: 50→100→200시드 after snapshot을 생성한다**

Run:

```bash
B1_SOURCE_REVISION=cleric-heal-rebalance-after B1_BACKTEST_MODE=calibration B1_BACKTEST_FOCUS=risk-curve B1_BACKTEST_SEEDS=50 B1_BACKTEST_BASELINE_PATH=/private/tmp/dungeon-schemer-cleric-heal-rebalance/baseline-50.json B1_BACKTEST_SNAPSHOT_PATH=/private/tmp/dungeon-schemer-cleric-heal-rebalance/after-50.json pnpm exec vitest run --config vitest.backtest.config.ts
B1_SOURCE_REVISION=cleric-heal-rebalance-after B1_BACKTEST_MODE=calibration B1_BACKTEST_FOCUS=risk-curve B1_BACKTEST_SEEDS=100 B1_BACKTEST_BASELINE_PATH=/private/tmp/dungeon-schemer-cleric-heal-rebalance/baseline-100.json B1_BACKTEST_SNAPSHOT_PATH=/private/tmp/dungeon-schemer-cleric-heal-rebalance/after-100.json pnpm exec vitest run --config vitest.backtest.config.ts
B1_SOURCE_REVISION=cleric-heal-rebalance-after B1_BACKTEST_MODE=calibration B1_BACKTEST_FOCUS=risk-curve B1_BACKTEST_SEEDS=200 B1_BACKTEST_BASELINE_PATH=/private/tmp/dungeon-schemer-cleric-heal-rebalance/baseline-200.json B1_BACKTEST_SNAPSHOT_PATH=/private/tmp/dungeon-schemer-cleric-heal-rebalance/after-200.json pnpm exec vitest run --config vitest.backtest.config.ts
```

Expected: 구조 gate PASS. 기존 risk gate가 실패하면 치유 외 수치를 조정하지 않고 `BACKTEST_REPORT.md`에 실제 결과를 남긴다.

- [ ] **Step 8: 커밋한다**

```bash
git add lib/backtest/metrics.ts lib/backtest/metrics.test.ts lib/backtest/acceptance.ts lib/backtest/acceptance.test.ts lib/backtest/report.ts lib/backtest/report.test.ts lib/backtest/battle-ability-comparison.test.ts docs/technical/BACKTEST_REPORT.md
git commit -m "검증: 비례 치유의 밸런스 영향을 측정한다" -m "전투당 두 번의 치유와 최대 체력 25퍼센트 회복을 구조 gate로 검증하고 50·100·200시드 paired 결과를 기록한다."
```

### Task 6: 공식 문서 상태와 전체 회귀 검증

**Files:**
- Modify: `docs/superpowers/specs/2026-08-26-lattebun-cleric-emergency-heal-design.md`
- Modify: `docs/README.md`
- Verify: `docs/systems/CHARACTERS_AND_TRUST.md`
- Verify: `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`
- Verify: all changed source and test files

**Interfaces:**
- Consumes: Task 2~5에서 확정된 타입·엔진·replay·측정 결과.
- Produces: 구현 완료 상태의 spec/문서 색인과 검증된 PR 브랜치.

- [ ] **Step 1: spec 상태와 README plan 색인을 갱신한다**

spec의 상태를 `사용자 재설계 승인 및 구현 완료`로 바꾼다. `docs/README.md`에는 이 follow-up plan 링크와 “전투당 제한 제거·대상 최대 HP 25% 회복” 설명을 추가하고 기존 최초 구현 plan은 역사 기록으로 유지한다.

- [ ] **Step 2: 오래된 구현 계약이 남지 않았는지 검사한다**

Run:

```bash
rg -n "healAmount|maxUsesPerBattle|고정 5 HP|전투당 최대 1회|전투당 1회" lib components docs --glob '!docs/superpowers/plans/2026-08-26-lattebun-cleric-emergency-heal.md'
rg -n "healTargetMaxHpPercent|25%|전투당.*제한" lib components docs
```

Expected: 첫 명령은 결과 없음. 두 번째 명령은 타입·콘텐츠·spec·공식 문서와 관련 테스트를 찾는다.

- [ ] **Step 3: 정적 검사와 전체 단위 테스트를 실행한다**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
git diff --check
```

Expected: lint error 0, typecheck PASS, 전체 Vitest PASS, whitespace error 없음. 기존 lint warning은 별도 작업으로 남긴다.

- [ ] **Step 4: U5 브라우저 회귀와 프로덕션 빌드를 실행한다**

Run:

```bash
pnpm exec playwright test e2e/u5-battle-preview.spec.ts e2e/campaign-smoke.spec.ts
pnpm build
```

Expected: U5 치유 프리뷰와 캠페인 smoke PASS, Next production build PASS. 빌드 프로세스 잠금이 남으면 해당 작업 트리의 정확한 PID만 확인·종료하고 한 번 다시 실행한다.

- [ ] **Step 5: 문서와 최종 검증 결과를 커밋한다**

```bash
git add docs/README.md docs/superpowers/specs/2026-08-26-lattebun-cleric-emergency-heal-design.md docs/systems/CHARACTERS_AND_TRUST.md docs/systems/DUNGEON_EVENTS_AND_BOSSES.md
git commit -m "문서: 성직자 치유 재조정 결과를 확정한다" -m "최대 체력 25퍼센트 회복과 전투당 제한 제거의 구현 상태, 검증 명령, 백테스트 결과를 공식 문서와 색인에 동기화한다."
```

- [ ] **Step 6: 브랜치 상태를 확인하고 PR을 갱신한다**

Run:

```bash
git status --short
git log --oneline --decorate -6
git push origin spec/cleric-emergency-heal
```

Expected: push 전 작업 트리가 깨끗하고, 원격 PR 브랜치가 최종 커밋과 일치한다.
