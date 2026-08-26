# 성직자 응급 치유 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 성직자가 HP 50% 이하의 생존자를 공격 대신 자동 치유하고, 원정당 2회인 잔여 횟수를 일반전부터 보스전까지 이어 가며, 확정된 치유 행동을 U5와 백테스트가 동일하게 관측한다.

**Architecture:** 직업 콘텐츠는 선택적 단일 `battleAbility` 정의를 소유하고, 순수 전투 엔진은 런타임 능력 상태만 받아 공격·치유의 판정과 기록을 결정한다. `ExpeditionState`가 캐릭터별 잔여 횟수를 소유하며 일반전·보스전 어댑터는 하나의 좁은 변환 helper로 이를 전투 입력과 결과 사이에 운반한다. U5와 백테스트는 규칙을 다시 계산하지 않고 `BattleActionRecord`를 소비한다.

**Tech Stack:** TypeScript 5, Next.js 16.3.0, React 19.2.8, Zustand 5.0.14, Vitest 4.1.10, Playwright 1.62.1, pnpm 11.21.0

**Spec:** `docs/superpowers/specs/2026-08-26-lattebun-cleric-emergency-heal-design.md`

- 작성자: LatteBun
- 작성 도구: Codex

## Global Constraints

- 표시 이름은 `치유 기도`, 안정 식별자는 `emergencyHeal`, 회복량은 5, 원정당 2회, 한 전투당 한 성직자당 최대 1회다.
- 성직자의 기존 최대 HP 28, 공격력 5, 피격 가중치 1과 다른 직업·몬스터·보스·휴식 수치는 바꾸지 않는다.
- 생존 적이 남은 성직자의 행동 차례에 생존 파티원 중 `hp * 100 <= maxHp * 50`인 대상이 있을 때만 공격을 포기하고 치유한다.
- 대상은 HP 비율이 가장 낮은 생존자다. 교차 곱으로 비교하고 동률이면 `BattleInput.party` 순서를 유지한다. 자신은 후보이며 HP 0인 사망자는 제외한다.
- 실제 회복량이 1 이상인 치유 행동이 기록될 때만 횟수를 소비한다. 치유 대상 선정은 RNG를 소비하지 않으며, 성직자가 없거나 조건이 없으면 기존 대상 RNG와 피해 결과를 보존한다.
- 횟수는 `Character`가 아니라 `ExpeditionState`에 둔다. 일반전에서 소비한 값이 보스전까지 이어지고 새 원정·재도전에서 초기화되며 사망한 능력 보유자의 키도 원정 종료까지 보존한다.
- 직업 ID 직접 분기와 범용 스킬 프레임워크를 만들지 않는다. `ClassBattleAbilityDef`는 이번에는 `emergencyHeal` 한 종류만 표현한다.
- 잘못된 콘텐츠·직접 전투 입력·원정 자원을 기본값으로 대체하지 않고 기존 `RuleError` 경계에서 거부한다.
- U5는 전투 결과를 재계산하지 않는다. 치유 프레임은 돌진·피격 흔들림 없이 `+N`과 잔여 횟수를 보여 준다.
- 완료 replay에서 우측 카드 HP·신뢰는 기존처럼 최종 상태를 유지하되 능력 잔여 횟수만 완료 프레임까지 되감기 값에 맞춘다.
- U3는 원정 시작값, U4는 활성 원정값, U5는 replay 프레임값을 공통 카드 prop으로 표시한다. U6에는 표시하지 않는다.
- 전투 전체 기록을 캠페인 history나 영구 state에 새로 저장하지 않는다. 백테스트 driver가 일반전 `pendingOutcome.battle`과 보스전 `bossResult.battle`을 전이 직후 캡처한다.
- 백테스트 전후 비교 키는 `seed × strategy × accuracy`로 고정한다. `b1-risk-curve-v2` calibration을 50→100→200시드 순서로 실행하고 2,000시드 holdout은 실행하지 않는다.
- 구현 중 밸런스 문턱이 벗어나도 치유 외 수치를 같은 변경에서 조정하지 않는다. 관측 결과와 후속 보정 필요성만 보고한다.
- UI 작업 전에 `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`, 테스트 작업 전에 `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`와 `playwright.md`를 읽는다.
- 모든 커밋은 제목과 본문을 한글로 작성한다.

## File Structure

### 새 파일

- `lib/content/class-validation.ts`: 직업·능력 콘텐츠의 단일 검증기.
- `lib/content/class-validation.test.ts`: 실제 콘텐츠와 주입 정의의 실패 계약.
- `lib/rules/battle-ability-state.ts`: 원정 잔여 횟수의 초기화·검증·전투 입출력 변환.
- `lib/rules/battle-ability-state.test.ts`: 능력 보유자 키, 사망자 키 보존, 범위 검증.
- `components/game/party-member-ability-view.ts`: U3/U4/U5가 공유하는 카드 표시 모델 변환.
- `components/game/party-member-ability-view.test.ts`: 화면별 source 선택과 무능력 직업 생략.
- `lib/backtest/battle-ability-comparison.ts`: 안정 키 snapshot과 전후 paired delta 계산.
- `lib/backtest/battle-ability-comparison.test.ts`: 키 정렬·누락 쌍·delta 계산 계약.

### 수정 파일

- `lib/domain/character.ts`, `lib/content/classes.ts`, `lib/content/classes.test.ts`: 능력 타입·성직자 콘텐츠·모듈 로드 검증.
- `lib/domain/battle.ts`, `lib/rules/battle-engine.ts`, `lib/rules/battle-engine.test.ts`: 런타임 능력과 공격/치유 판별 union.
- `lib/domain/expedition.ts`, `lib/domain/index.ts`, `lib/rules/campaign-transition.ts`, 관련 transition/store 테스트: 원정 자원 생명주기와 전이 보존.
- `lib/rules/expedition-events.ts`, `lib/rules/expedition-events.test.ts`: 일반전 능력 hydrate/extract.
- `lib/rules/boss-battle-adapter.ts`, `lib/rules/boss-battle-adapter.test.ts`: 보스전 능력 hydrate/extract와 공격 전용 cue 연결.
- `components/game/u5-battle-replay.ts`, `components/game/u5-battle-replay.test.ts`: 치유 프레임과 잔여 횟수 replay.
- `components/game/use-u5-battle-playback.ts`, `components/game/use-u5-battle-playback.test.ts`: 새 프레임 필드 signature.
- `components/game/U5BattleScene.tsx`, `components/game/U5BattleScene.test.tsx`, `app/globals.css`: 치유 연출·문장·접근성.
- `components/game/PartyMemberCard.tsx`, `components/game/PartyMemberCard.test.tsx`: 선택적 능력 상태 행.
- `components/game/u3-board-model.ts`, `components/game/U3BoardScreen.tsx`, 관련 테스트: 편성 카드 2회 표시.
- `components/game/u4-dungeon-map-model.ts`, `components/game/U4DungeonMapScreen.tsx`, 관련 테스트: 활성 원정 잔여 표시.
- `components/game/campaign-adapters.ts`, `components/game/CampaignScreen.tsx`, `components/game/u5-progress-model.ts`, 관련 테스트: U5 replay 잔여 상태 연결.
- `components/game/u4-preview-data.ts`, `components/game/u5-preview-data.ts`, `components/game/u5-battle-preview-data.ts`, `components/game/u5-battle-test-fixture.ts`, `components/game/u6-preview-data.ts`와 관련 테스트: 새 필수 원정 필드와 치유 fixture 정합성.
- `lib/backtest/campaign-driver.ts`, `lib/backtest/campaign-driver.test.ts`, `lib/backtest/metrics.ts`, `lib/backtest/metrics.test.ts`: 전투 직후 trace와 치유 지표.
- `lib/backtest/report.ts`, `lib/backtest/report.test.ts`, `lib/backtest/backtest.run.ts`, `lib/backtest/backtest.run.test.ts`, `lib/backtest/acceptance.ts`, `lib/backtest/acceptance.test.ts`: paired 비교·보고서·관측 gate.
- `docs/systems/CHARACTERS_AND_TRUST.md`, `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`, `docs/technical/BACKTEST_REPORT.md`, `docs/README.md`: 공식 규칙과 검증 결과.
- `e2e/u5-battle-preview.spec.ts`, 필요 시 `e2e/canvas-layout.spec.ts`: 치유 장면과 공식 viewport 회귀.

---

### Task 1: 전투 관측 trace와 변경 전 50·100·200 기준선

**Files:**
- Modify: `lib/backtest/campaign-driver.ts`
- Modify: `lib/backtest/campaign-driver.test.ts`
- Modify: `lib/backtest/metrics.ts`
- Modify: `lib/backtest/metrics.test.ts`
- Create: `lib/backtest/battle-ability-comparison.ts`
- Create: `lib/backtest/battle-ability-comparison.test.ts`
- Modify: `lib/backtest/backtest.run.ts`
- Modify: `lib/backtest/backtest.run.test.ts`
- Runtime artifacts outside repository: `/private/tmp/dungeon-schemer-cleric-heal/baseline-{50,100,200}.json`

**Interfaces:**

```ts
interface BattleTraceEntry {
  readonly kind: "general" | "boss";
  readonly expeditionId: string;
  readonly party: readonly {
    readonly characterId: CharacterId;
    readonly classId: ClassId;
    readonly hpBefore: number;
    readonly hpAfter: number;
    readonly maxHp: number;
  }[];
  readonly battle: BattleResolution;
}

interface BacktestPairKey {
  readonly seed: string;
  readonly strategyId: StrategyPolicy["id"];
  readonly accuracy: Accuracy;
}
```

- [ ] 전투 규칙을 바꾸지 않은 채 `CHOOSE_ADVICE` 직후의 `pendingOutcome.battle`과 `ENTER_BOSS` 직후의 `bossResult.battle`이 trace에 한 번씩 저장되는 실패 테스트를 작성한다. 회피 일반전은 저장하지 않고 같은 전투를 두 번 세지 않는 경우도 포함한다.
- [ ] `pnpm exec vitest run lib/backtest/campaign-driver.test.ts`를 실행해 새 trace 검사가 실패하는지 확인한다.
- [ ] driver가 transition 직전·직후의 파티 상태와 확정 결과를 결합해 `BattleTraceEntry`를 append한다. 전투 종류·라운드·종료 사유·전후 HP·직업 구성을 보존하되 캠페인 domain/history에는 필드를 추가하지 않는다.
- [ ] `CampaignRunMetrics`에 pair snapshot을 만들 수 있는 run 단위 전투 요약을 추가하고 `BacktestAggregate.runs`까지 손실 없이 전달한다. Task 10은 같은 요약에 치유 action 파생값만 확장한다.
- [ ] 안정 키를 `${seed}\u0000${strategyId}\u0000${accuracy}`로 직렬화하고 snapshot의 정렬·중복·누락 쌍을 검증하는 실패 테스트를 작성한다.
- [ ] `writeBattleAbilitySnapshot(path, aggregate.runs)`와 `compareBattleAbilitySnapshots(before, after)`를 최소 구현한다. snapshot은 안정 키와 직업 구성, 전투 수, 라운드, 종료 사유, 생존·HP처럼 변경 전에도 존재하는 원시 관측치만 담는다.
- [ ] `B1_BACKTEST_SNAPSHOT_PATH`가 지정됐을 때만 JSON을 기록하도록 runner를 연결하고 경로 미지정 시 기존 동작이 동일한지 테스트한다.
- [ ] 관련 테스트를 통과시킨 뒤 안전한 임시 디렉터리를 만들고 아래 순서로 기준선을 생성한다.

```bash
mkdir -p /private/tmp/dungeon-schemer-cleric-heal
B1_SOURCE_REVISION=cleric-heal-baseline B1_BACKTEST_MODE=calibration B1_BACKTEST_FOCUS=risk-curve B1_BACKTEST_SEEDS=50 B1_BACKTEST_SNAPSHOT_PATH=/private/tmp/dungeon-schemer-cleric-heal/baseline-50.json pnpm exec vitest run --config vitest.backtest.config.ts
B1_SOURCE_REVISION=cleric-heal-baseline B1_BACKTEST_MODE=calibration B1_BACKTEST_FOCUS=risk-curve B1_BACKTEST_SEEDS=100 B1_BACKTEST_SNAPSHOT_PATH=/private/tmp/dungeon-schemer-cleric-heal/baseline-100.json pnpm exec vitest run --config vitest.backtest.config.ts
B1_SOURCE_REVISION=cleric-heal-baseline B1_BACKTEST_MODE=calibration B1_BACKTEST_FOCUS=risk-curve B1_BACKTEST_SEEDS=200 B1_BACKTEST_SNAPSHOT_PATH=/private/tmp/dungeon-schemer-cleric-heal/baseline-200.json pnpm exec vitest run --config vitest.backtest.config.ts
```

- [ ] 세 artifact가 각각 기대한 pair 수와 중복 없는 키를 갖는지 테스트 또는 runner 출력으로 확인한다.
- [ ] 커밋한다.

```bash
git add lib/backtest/campaign-driver.ts lib/backtest/campaign-driver.test.ts lib/backtest/metrics.ts lib/backtest/metrics.test.ts lib/backtest/battle-ability-comparison.ts lib/backtest/battle-ability-comparison.test.ts lib/backtest/backtest.run.ts lib/backtest/backtest.run.test.ts
git commit -m "테스트: 성직자 치유 전 기준선을 보존한다" -m "일반전과 보스전 결과를 전이 직후 관측하고 안정 키 snapshot으로 50·100·200시드 비교 기반을 마련한다."
```

### Task 2: 직업 능력 콘텐츠 계약과 검증

**Files:**
- Modify: `lib/domain/character.ts`
- Modify: `lib/domain/index.ts`
- Create: `lib/content/class-validation.ts`
- Create: `lib/content/class-validation.test.ts`
- Modify: `lib/content/classes.ts`
- Modify: `lib/content/classes.test.ts`

**Interfaces:**

```ts
export interface EmergencyHealAbilityDef {
  readonly kind: "emergencyHeal";
  readonly name: string;
  readonly healAmount: number;
  readonly usesPerExpedition: number;
  readonly maxUsesPerBattle: number;
  readonly triggerAtOrBelowHpPercent: number;
}
export type ClassBattleAbilityDef = EmergencyHealAbilityDef;
export function validateClasses(classes: readonly ClassDef[]): void;
```

- [ ] 성직자만 정확한 능력 정의를 갖고 다른 네 직업은 능력이 없다는 테스트, 빈 이름·비안전 정수·0 이하·100 초과·전투 횟수 초과·중복 직업 ID가 `INVALID_GENERATION`으로 실패한다는 table test를 작성한다.
- [ ] `pnpm exec vitest run lib/content/class-validation.test.ts lib/content/classes.test.ts`를 실행해 실패를 확인한다.
- [ ] 타입과 단일 검증기를 구현하고 `classes.ts`에서 `validateClasses(CLASSES)`를 모듈 로드 시 호출한다. 성직자 설명도 Spec 문구로 갱신한다.
- [ ] 테스트를 통과시키고 커밋한다.

```bash
git add lib/domain/character.ts lib/domain/index.ts lib/content/class-validation.ts lib/content/class-validation.test.ts lib/content/classes.ts lib/content/classes.test.ts
git commit -m "기능: 성직자 치유 콘텐츠를 정의한다" -m "직업의 선택적 단일 전투 능력과 엄격한 콘텐츠 검증을 추가하고 성직자 설명을 실제 동작에 맞춘다."
```

### Task 3: 순수 전투 엔진의 치유 선택과 행동 기록

**Files:**
- Modify: `lib/domain/battle.ts`
- Modify: `lib/rules/battle-engine.ts`
- Modify: `lib/rules/battle-engine.test.ts`

**Interfaces:**

```ts
interface BattlePartyMemberAbilityState {
  readonly kind: "emergencyHeal";
  readonly name: string;
  readonly healAmount: number;
  readonly usesPerExpedition: number;
  readonly maxUsesPerBattle: number;
  readonly triggerAtOrBelowHpPercent: number;
  readonly remainingUses: number;
}

interface BattleActionRecordBase {
  readonly round: number;
  readonly actorId: string;
  readonly targetId: string;
  readonly targetHpBefore: number;
  readonly targetHpAfter: number;
}

type BattleActionRecord =
  | (BattleActionRecordBase & {
      readonly kind: "attack";
      readonly actorSide: "party" | "enemy";
      readonly damage: number;
      readonly defeated: boolean;
    })
  | (BattleActionRecordBase & {
      readonly kind: "heal";
      readonly actorSide: "party";
      readonly abilityKind: "emergencyHeal";
      readonly healing: number;
    });
```

- [ ] 정확히 50%와 50% 초과, 홀수 max HP, 자신 대상, 낮은 HP 비율, 입력 순서 동률, 사망자 제외, max HP clamp, 횟수 0, 한 전투 1회, 마지막 적 사망 뒤 미사용을 각각 고정하는 실패 테스트를 작성한다.
- [ ] 서로 다른 두 능력 보유자가 전투당 한도를 독립적으로 지키고, 사건·상인·조언 압력·보스 `outgoingDamage` 배율이 고정 회복량을 바꾸지 않는 테스트를 작성한다.
- [ ] 성직자·조건이 없는 기존 fixture에 `kind: "attack"`만 추가하면 기존 action 순서·target·damage·최종 HP가 같고 같은 seed 재현성이 유지되는 회귀 테스트를 작성한다.
- [ ] `pnpm exec vitest run lib/rules/battle-engine.test.ts`로 실패를 확인한다.
- [ ] 전투 시작 시 직접 입력된 능력 정의와 `remainingUses`를 검증한다. 잘못된 값은 조용히 clamp하지 않고 `INVALID_GENERATION`으로 실패시킨다.
- [ ] 파티 행동 루프에서 적 생존 확인 후 정수 비교와 교차 곱으로 대상을 고르고, 실제 회복 시 공격 대신 `heal` action을 기록하며 런타임 잔여 횟수를 1 감소시킨다. 중첩 능력 입력을 복사하고 `BattleResolution.party`에 최종 `remainingUses`를 반환하며 대상 선정 전후에 RNG 호출을 추가하지 않는다.
- [ ] 테스트를 통과시키고 커밋한다.

```bash
git add lib/domain/battle.ts lib/rules/battle-engine.ts lib/rules/battle-engine.test.ts
git commit -m "기능: 전투 엔진에 응급 치유를 추가한다" -m "성직자가 결정적으로 부상자를 골라 공격 대신 치유하고 공격과 치유를 판별 가능한 행동 기록으로 남긴다."
```

### Task 4: 원정 자원의 초기화·검증·공유 변환

**Files:**
- Modify: `lib/domain/expedition.ts`
- Create: `lib/rules/battle-ability-state.ts`
- Create: `lib/rules/battle-ability-state.test.ts`
- Modify: `lib/rules/campaign-transition.ts`
- Modify: `lib/rules/campaign-transition-expedition.test.ts`
- Modify: `lib/rules/campaign-transition.test.ts`
- Modify: `lib/store/campaign-store-flow.test.ts`

**Interfaces:**

```ts
type BattleAbilityUsesRemaining = Readonly<Partial<Record<CharacterId, number>>>;
function createBattleAbilityUsesForParty(input: {
  readonly members: readonly Character[];
  readonly classDefs: readonly ClassDef[];
}): BattleAbilityUsesRemaining;
function hydrateBattlePartyAbility(input: {
  readonly member: Character;
  readonly classDef: ClassDef;
  readonly usesRemaining: BattleAbilityUsesRemaining;
}): BattlePartyMemberAbilityState | undefined;
function extractBattleAbilityUsesAfterBattle(input: {
  readonly before: BattleAbilityUsesRemaining;
  readonly members: readonly Character[];
  readonly classDefs: readonly ClassDef[];
  readonly battleParty: readonly BattlePartyMember[];
}): BattleAbilityUsesRemaining;
function validateBattleAbilityUses(input: {
  readonly members: readonly Character[];
  readonly classDefs: readonly ClassDef[];
  readonly usesRemaining: BattleAbilityUsesRemaining;
  readonly phase: "start" | "active";
  readonly errorCode: "INVALID_GENERATION" | "INVALID_TRANSITION";
}): void;
```

- [ ] 새 원정과 재도전은 능력 보유자만 2로 초기화하고, 시작 전이는 정확한 초기값을 요구하며, 활성 전이는 0~초기값만 허용하는 실패 테스트를 작성한다.
- [ ] 무능력 키·누락 능력 키·음수·초기값 초과·비정수·알 수 없는 캐릭터 키를 거부하고 사망한 능력 보유자의 0/잔여 키는 보존하는 helper 테스트를 작성한다.
- [ ] `pnpm exec vitest run lib/rules/battle-ability-state.test.ts lib/rules/campaign-transition-expedition.test.ts lib/rules/campaign-transition.test.ts`로 실패를 확인한다.
- [ ] `ExpeditionState.battleAbilityUsesRemainingByCharacterId`와 좁은 helper를 구현한다. `createExpeditionForOffer`, `copyActiveExpedition`, `START_EXPEDITION` 검증 경계를 연결한다.
- [ ] 모든 수동 expedition fixture를 의미에 맞게 `{}` 또는 능력 초기 맵으로 갱신한다. 호환 기본값은 넣지 않는다.
- [ ] 테스트를 통과시키고 커밋한다.

```bash
git add lib/domain/expedition.ts lib/rules/battle-ability-state.ts lib/rules/battle-ability-state.test.ts lib/rules/campaign-transition.ts lib/rules/campaign-transition-expedition.test.ts lib/rules/campaign-transition.test.ts lib/store/campaign-store-flow.test.ts
git commit -m "기능: 치유 횟수를 원정 자원으로 관리한다" -m "새 원정 초기화와 활성 원정 검증을 한곳에 두고 사망자 키를 포함한 캐릭터별 잔여 횟수를 보존한다."
```

### Task 5: 일반전과 보스전의 잔여 횟수 전파

**Files:**
- Modify: `lib/rules/expedition-events.ts`
- Modify: `lib/rules/expedition-events.test.ts`
- Modify: `lib/rules/boss-battle-adapter.ts`
- Modify: `lib/rules/boss-battle-adapter.test.ts`
- Modify: `lib/rules/campaign-transition.ts`
- Modify: `lib/rules/campaign-transition-expedition.test.ts`
- Modify: `lib/store/campaign-full-run.test.ts`
- Modify: `lib/store/campaign-reproducibility.test.ts`

**Interfaces:** 일반전·보스전 resolution 반환값에 `battleAbilityUsesRemainingByCharacterId`를 추가하고 두 어댑터 모두 Task 4 helper를 호출한다.

- [ ] 일반전에서 치유 1회가 2→1로 반영되고 회피·미발동·사망자는 유지되며, 주입 `classDefs` 오류가 전투 전 실패하는 테스트를 작성한다.
- [ ] 일반전 이후 값 1이 보스 입력으로 전달되고 보스 치유 뒤 0이 되며 새 재도전은 2라는 campaign 통합 테스트를 작성한다.
- [ ] 보스 cue가 `kind === "attack"`인 행동에만 연결되고 치유 action에는 공격 축 cue가 붙지 않는 테스트를 작성한다.
- [ ] `pnpm exec vitest run lib/rules/expedition-events.test.ts lib/rules/boss-battle-adapter.test.ts lib/rules/campaign-transition-expedition.test.ts`로 실패를 확인한다.
- [ ] 두 어댑터에서 주입 콘텐츠를 검증하고 helper로 hydrate/extract한다. 캠페인 전이는 일반전과 보스전 반환 맵을 다음 immutable expedition에 복사한다.
- [ ] 일반전 정산의 `SettlementCauseInputs.damage` 모양은 유지하되 HP 증가도 `HP 이전 → 이후`로 표현하고, 최종 전후가 같으면 `최종 HP 변화 없음`이라고 기록해 전투 중 피해와 치유의 상쇄를 오인하지 않게 한다.
- [ ] 전체 run 재현성 테스트까지 통과시키고 커밋한다.

```bash
git add lib/rules/expedition-events.ts lib/rules/expedition-events.test.ts lib/rules/boss-battle-adapter.ts lib/rules/boss-battle-adapter.test.ts lib/rules/campaign-transition.ts lib/rules/campaign-transition-expedition.test.ts lib/store/campaign-full-run.test.ts lib/store/campaign-reproducibility.test.ts
git commit -m "기능: 일반전과 보스전에 치유 횟수를 잇는다" -m "공유 변환 경계로 전투 전후 원정 자원을 운반하고 공격 전용 보스 표시 신호와 정산 문장을 보존한다."
```

### Task 6: U5 replay의 치유 프레임과 잔여 횟수

**Files:**
- Modify: `components/game/u5-battle-replay.ts`
- Modify: `components/game/u5-battle-replay.test.ts`
- Modify: `components/game/use-u5-battle-playback.ts`
- Modify: `components/game/use-u5-battle-playback.test.ts`
- Modify: `components/game/u5-progress-model.ts`
- Modify: `components/game/campaign-adapters.ts`
- Modify: `components/game/campaign-adapters.test.ts`

**Interfaces:**

```ts
interface U5BattleReplayFrame {
  readonly actionKind: BattleActionRecord["kind"] | null;
  readonly damage: number | null;
  readonly healing: number | null;
  readonly battleAbilityUsesRemainingByParticipantId: Readonly<Record<string, number>>;
}
```

- [ ] 공격 프레임은 기존 HP 감소를, 치유 프레임은 HP 증가·`healing`·잔여 1 감소를 재생한다는 실패 테스트를 작성한다.
- [ ] 공격의 피해/defeated 사슬, 치유의 실제 회복량/max HP, 이미 쓰러진 actor·target, 파티가 아닌 치유 actor·target, 승리 뒤 치유, 최종 HP, 시작·프레임·최종 잔여 횟수 불일치를 모두 거부하는 table test를 작성한다.
- [ ] 최종 battle party의 잔여 값에 각 성직자의 heal action 수를 더해 시작값을 복원하고, 매 heal settle 시 한 번 감소시키는 replay 테스트를 작성한다.
- [ ] 완료 프레임에서도 잔여 횟수는 되감기 frame 값을 유지하되 기존 완료 화면 HP·신뢰는 최종값을 유지한다는 adapter 테스트를 작성한다.
- [ ] `pnpm exec vitest run components/game/u5-battle-replay.test.ts components/game/use-u5-battle-playback.test.ts components/game/campaign-adapters.test.ts`로 실패를 확인한다.
- [ ] replay snapshot과 playback signature에 `actionKind`, `healing`, 정렬된 잔여 맵을 포함한다. 객체 키 순서 차이로 재생이 재시작되지 않게 canonicalize한다.
- [ ] 테스트를 통과시키고 커밋한다.

```bash
git add components/game/u5-battle-replay.ts components/game/u5-battle-replay.test.ts components/game/use-u5-battle-playback.ts components/game/use-u5-battle-playback.test.ts components/game/u5-progress-model.ts components/game/campaign-adapters.ts components/game/campaign-adapters.test.ts
git commit -m "기능: U5가 치유 행동을 순서대로 재생한다" -m "치유량과 원정 잔여 횟수를 프레임에 포함하고 완료 화면의 기존 HP·신뢰 표시 계약을 유지한다."
```

### Task 7: U5 치유 연출과 접근성

**Files:**
- Modify: `components/game/U5BattleScene.tsx`
- Modify: `components/game/U5BattleScene.test.tsx`
- Modify: `components/game/U5ProgressScreen.tsx`
- Modify: `components/game/U5ProgressScreen.test.tsx`
- Modify: `app/globals.css`
- Modify: `components/game/u5-battle-test-fixture.ts`
- Modify: `components/game/u5-battle-preview-data.ts`
- Modify: `components/game/u5-battle-preview-data.test.ts`
- Modify: `e2e/u5-battle-preview.spec.ts`

- [ ] 치유 action에서 `치유 기도`, 대상 이름, `+5`, 남은 횟수가 노출되고 공격 피해 문구는 나오지 않는 component 테스트를 작성한다.
- [ ] 치유자는 돌진 class, 대상은 피격 흔들림 class를 받지 않으며 회복 강조 class만 받는 테스트를 작성한다.
- [ ] `aria-live` 전투 설명이 공격과 치유를 구분하고 색만으로 의미를 전달하지 않는지 검사한다.
- [ ] `prefers-reduced-motion`에서는 기도·회복 이동을 줄여도 `+N`, HP, 잔여 횟수 변화가 남는 CSS/브라우저 회귀를 추가한다.
- [ ] Next `use client`와 Vitest/Playwright 공식 문서를 읽고 현재 컴포넌트 경계를 유지한다.
- [ ] `pnpm exec vitest run components/game/U5BattleScene.test.tsx components/game/U5ProgressScreen.test.tsx components/game/u5-battle-preview-data.test.ts`로 실패를 확인한다.
- [ ] scene과 CSS를 최소 구현하고 결정적 preview fixture에 한 번의 치유 장면을 추가한다.
- [ ] `pnpm exec playwright test e2e/u5-battle-preview.spec.ts --project=chromium`으로 preview에서 치유 텍스트·완료 전환·overflow를 확인한다.
- [ ] 커밋한다.

```bash
git add components/game/U5BattleScene.tsx components/game/U5BattleScene.test.tsx components/game/U5ProgressScreen.tsx components/game/U5ProgressScreen.test.tsx app/globals.css components/game/u5-battle-test-fixture.ts components/game/u5-battle-preview-data.ts components/game/u5-battle-preview-data.test.ts e2e/u5-battle-preview.spec.ts
git commit -m "기능: U5에 치유 기도 연출을 표시한다" -m "공격과 구분되는 회복 수치·문장·강조를 추가하고 동작과 접근성 회귀를 고정한다."
```

### Task 8: U3·U4·U5 파티 카드의 공통 능력 상태

**Files:**
- Create: `components/game/party-member-ability-view.ts`
- Create: `components/game/party-member-ability-view.test.ts`
- Modify: `components/game/PartyMemberCard.tsx`
- Modify: `components/game/PartyMemberCard.test.tsx`
- Modify: `components/game/u3-board-model.ts`
- Modify: `components/game/u3-board-model.test.ts`
- Modify: `components/game/U3BoardScreen.tsx`
- Modify: `components/game/U3BoardScreen.test.ts`
- Modify: `components/game/u4-dungeon-map-model.ts`
- Modify: `components/game/u4-dungeon-map-model.test.ts`
- Modify: `components/game/U4DungeonMapScreen.tsx`
- Modify: `components/game/U4DungeonMapScreen.test.tsx`
- Modify: `components/game/CampaignScreen.tsx`

**Interfaces:**

```ts
interface PartyMemberBattleAbilityStatus {
  readonly label: string;
  readonly remaining: number;
  readonly total: number;
}
```

- [ ] 공통 변환기가 무능력 직업은 `undefined`, 성직자는 label/remaining/total을 만들고 범위를 벗어난 source를 거부하는 테스트를 작성한다.
- [ ] 공통 변환기는 `emergencyHeal`을 시각 라벨 `치유`로 한 번만 해석한다. U3 형식은 `치유 2회`, U4/U5 형식은 `치유 2/2`, `치유 1/2`, `치유 0/2`가 되게 하고 범위 밖 source를 거부한다. 긴 이름 `치유 기도`는 U5 행동 설명과 직업 상세에서 유지한다.
- [ ] 카드에 선택적 상태가 직업 라벨 옆 인라인으로 렌더되고 prop이 없으면 기존 DOM이 유지되며 카드 높이·3열 배치를 늘리지 않는 테스트를 작성한다.
- [ ] U3는 계약 전 `usesPerExpedition`, U4는 활성 expedition map, U5는 현재 replay frame을 source로 사용한다는 model/component 테스트를 작성한다. 작은 게시판 공고지와 U6에는 넣지 않고 화면 좌석 순서가 전투 동률 우선순위를 바꾸지 않는지도 확인한다.
- [ ] `pnpm exec vitest run components/game/party-member-ability-view.test.ts components/game/PartyMemberCard.test.tsx components/game/u3-board-model.test.ts components/game/U3BoardScreen.test.ts components/game/u4-dungeon-map-model.test.ts components/game/U4DungeonMapScreen.test.tsx components/game/campaign-adapters.test.ts`로 실패를 확인한다.
- [ ] view helper와 optional card prop을 구현하고 U3/U4/U5 호출부에 연결한다. U6 호출부에는 prop을 전달하지 않는다.
- [ ] 테스트를 통과시키고 커밋한다.

```bash
git add components/game/party-member-ability-view.ts components/game/party-member-ability-view.test.ts components/game/PartyMemberCard.tsx components/game/PartyMemberCard.test.tsx components/game/u3-board-model.ts components/game/u3-board-model.test.ts components/game/U3BoardScreen.tsx components/game/U3BoardScreen.test.ts components/game/u4-dungeon-map-model.ts components/game/u4-dungeon-map-model.test.ts components/game/U4DungeonMapScreen.tsx components/game/U4DungeonMapScreen.test.tsx components/game/CampaignScreen.tsx
git commit -m "기능: 파티 카드에 치유 잔여 횟수를 표시한다" -m "공통 표시 모델로 U3 시작값과 U4·U5 현재값을 보여 주고 U6 정산 화면은 변경하지 않는다."
```

### Task 9: preview·fixture·통합 경계 정리

**Files:**
- Modify: `components/game/u4-preview-data.ts`
- Modify: `components/game/u4-preview-data.test.ts`
- Modify: `components/game/u5-preview-data.ts`
- Modify: `components/game/u5-preview-data.test.ts`
- Modify: `components/game/u6-preview-data.ts`
- Modify: `components/game/u6-preview-data.test.ts`
- Modify: `components/game/campaign-render.test.tsx`
- Modify: `lib/store/campaign-store.test.ts`
- Modify: `lib/store/campaign-store-flow.test.ts`

- [ ] 수동 `ExpeditionState` fixture 누락을 TypeScript와 테스트로 드러내고 각 fixture가 능력 보유자와 맞는 맵을 갖도록 갱신한다.
- [ ] 실제 캠페인에서 U3 2/2 → 일반전 치유 뒤 U5 1/2 → U4 1/2 → 보스 치유 뒤 U5 0/2의 흐름을 고정하는 render 통합 테스트를 작성한다.
- [ ] U6 preview와 정산 카드에 능력 잔여 행이 없고 새 원정 진입 시 다시 2/2라는 회귀 테스트를 작성한다.
- [ ] `pnpm exec vitest run components/game/u4-preview-data.test.ts components/game/u5-preview-data.test.ts components/game/u6-preview-data.test.ts components/game/campaign-render.test.tsx lib/store/campaign-store.test.ts lib/store/campaign-store-flow.test.ts`를 실행해 실패 후 구현하고 통과시킨다.
- [ ] 커밋한다.

```bash
git add components/game/u4-preview-data.ts components/game/u4-preview-data.test.ts components/game/u5-preview-data.ts components/game/u5-preview-data.test.ts components/game/u6-preview-data.ts components/game/u6-preview-data.test.ts components/game/campaign-render.test.tsx lib/store/campaign-store.test.ts lib/store/campaign-store-flow.test.ts
git commit -m "테스트: 치유 자원의 화면 간 흐름을 고정한다" -m "실제 캠페인과 preview fixture에서 일반전·지도·보스전·정산·새 원정의 잔여 횟수 경계를 검증한다."
```

### Task 10: 백테스트 치유 지표와 paired 비교 보고서

**Files:**
- Modify: `lib/backtest/campaign-driver.ts`
- Modify: `lib/backtest/campaign-driver.test.ts`
- Modify: `lib/backtest/metrics.ts`
- Modify: `lib/backtest/metrics.test.ts`
- Modify: `lib/backtest/battle-ability-comparison.ts`
- Modify: `lib/backtest/battle-ability-comparison.test.ts`
- Modify: `lib/backtest/acceptance.ts`
- Modify: `lib/backtest/acceptance.test.ts`
- Modify: `lib/backtest/report.ts`
- Modify: `lib/backtest/report.test.ts`
- Modify: `lib/backtest/backtest.run.ts`
- Modify: `lib/backtest/backtest.run.test.ts`
- Generate: `docs/technical/BACKTEST_REPORT.md`
- Runtime artifacts outside repository: `/private/tmp/dungeon-schemer-cleric-heal/after-{50,100,200}.json`

**Metrics:** 성직자 포함/미포함 원정 수, 성직자 포함 일반전/보스전 수, 원정당 0·1·2회와 전투당 0·1회 사용 분포, 총 치유 행동·실제 회복량, 성직자 유무별 첫 시도 및 위험도별 클리어율, 보스 진입 HP 비율·보스 사망자·전체 사망자, 평균 라운드·`roundLimit`, 정상 완주율·엔딩, 전략·정확도 상대 결과를 trace의 확정 action으로 집계한다.

- [ ] `heal` action만 치유량과 사용 횟수로 집계하고 attack은 제외하며, 클래스 구성이 없는 trace·회피 전투·0 회복은 분모를 왜곡하지 않는 실패 테스트를 작성한다.
- [ ] baseline과 after를 안정 키로 join해 paired delta를 계산하고 누락·중복 키는 보고서 생성 전에 실패하는 테스트를 작성한다.
- [ ] acceptance는 기존 `b1-risk-curve-v2` gate를 유지하면서 원정당 같은 actor 2회 이하, 전투당 같은 actor 1회 이하, 실제 회복 1~5와 max HP 준수, 승리 뒤·사망자 치유 없음, 같은 차례 공격 중복 없음, 잔여 횟수 비증가와 action 감소 일치, 미보유·미발동 fixture 불변, 재현성·상태 오류·`roundLimit` 0을 강제 구조 gate로 추가한다.
- [ ] `pnpm exec vitest run lib/backtest/campaign-driver.test.ts lib/backtest/metrics.test.ts lib/backtest/battle-ability-comparison.test.ts lib/backtest/acceptance.test.ts lib/backtest/report.test.ts lib/backtest/backtest.run.test.ts`로 실패를 확인한다.
- [ ] 집계·gate·보고서 절을 구현한다. 보고서는 표본 수, source revision, 전후 snapshot, paired key 수, 성직자 유무별 delta를 명시한다.
- [ ] 아래 순서로 기능 적용 후 표본을 생성하고 같은 크기의 baseline과 paired 비교한다.

```bash
B1_SOURCE_REVISION=cleric-heal-after B1_BACKTEST_MODE=calibration B1_BACKTEST_FOCUS=risk-curve B1_BACKTEST_SEEDS=50 B1_BACKTEST_BASELINE_PATH=/private/tmp/dungeon-schemer-cleric-heal/baseline-50.json B1_BACKTEST_SNAPSHOT_PATH=/private/tmp/dungeon-schemer-cleric-heal/after-50.json pnpm exec vitest run --config vitest.backtest.config.ts
B1_SOURCE_REVISION=cleric-heal-after B1_BACKTEST_MODE=calibration B1_BACKTEST_FOCUS=risk-curve B1_BACKTEST_SEEDS=100 B1_BACKTEST_BASELINE_PATH=/private/tmp/dungeon-schemer-cleric-heal/baseline-100.json B1_BACKTEST_SNAPSHOT_PATH=/private/tmp/dungeon-schemer-cleric-heal/after-100.json pnpm exec vitest run --config vitest.backtest.config.ts
B1_SOURCE_REVISION=cleric-heal-after B1_BACKTEST_MODE=calibration B1_BACKTEST_FOCUS=risk-curve B1_BACKTEST_SEEDS=200 B1_BACKTEST_BASELINE_PATH=/private/tmp/dungeon-schemer-cleric-heal/baseline-200.json B1_BACKTEST_SNAPSHOT_PATH=/private/tmp/dungeon-schemer-cleric-heal/after-200.json pnpm exec vitest run --config vitest.backtest.config.ts
```

- [ ] 200시드 실행이 생성한 `docs/technical/BACKTEST_REPORT.md`에 전후 paired 결과와 기존 risk gate 결과가 모두 있는지 확인한다. 실패 gate가 있으면 수치를 조정하지 말고 결과를 문서화한다.
- [ ] 커밋한다.

```bash
git add lib/backtest/campaign-driver.ts lib/backtest/campaign-driver.test.ts lib/backtest/metrics.ts lib/backtest/metrics.test.ts lib/backtest/battle-ability-comparison.ts lib/backtest/battle-ability-comparison.test.ts lib/backtest/acceptance.ts lib/backtest/acceptance.test.ts lib/backtest/report.ts lib/backtest/report.test.ts lib/backtest/backtest.run.ts lib/backtest/backtest.run.test.ts docs/technical/BACKTEST_REPORT.md
git commit -m "검증: 성직자 치유의 밸런스 영향을 측정한다" -m "확정 전투 행동에서 치유 지표를 집계하고 같은 시드·전략·정확도의 50·100·200시드 paired 결과를 보고한다."
```

### Task 11: 공식 문서와 전체 회귀 검증

**Files:**
- Modify: `docs/systems/CHARACTERS_AND_TRUST.md`
- Modify: `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`
- Modify: `docs/README.md`
- Verify: all changed source and test files

- [ ] `CHARACTERS_AND_TRUST.md`에 성직자 콘텐츠 값, 자동 발동 조건, 대상 동률, 공격 포기, 원정당/전투당 제한, 초기화를 기록한다.
- [ ] `DUNGEON_EVENTS_AND_BOSSES.md`에 일반전부터 보스전까지 이어지는 원정 자원과 공격/치유 action 기록, 보스 cue의 공격 전용 경계를 기록한다.
- [ ] `docs/README.md`의 Spec·Plan 색인을 최종 파일 책임과 맞춰 확인하고 `BACKTEST_REPORT.md` 설명에 치유 지표·paired calibration을 반영한다. `GAME_PRINCIPLES.md`는 원칙이 바뀌지 않았으므로 수정하지 않는다.
- [ ] 미확정 표식과 문서 링크를 검사한다.

```bash
rg -n 'TO''DO|TB''D|FIX''ME|추후 ''결정' docs/superpowers/plans/2026-08-26-lattebun-cleric-emergency-heal.md docs/systems/CHARACTERS_AND_TRUST.md docs/systems/DUNGEON_EVENTS_AND_BOSSES.md
rg -n "cleric-emergency-heal|치유 기도|emergencyHeal" docs/README.md docs/systems/CHARACTERS_AND_TRUST.md docs/systems/DUNGEON_EVENTS_AND_BOSSES.md
```

- [ ] 정적 검사와 전체 단위·컴포넌트 테스트를 실행한다.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

- [ ] Chromium 회귀를 실행한다.

```bash
pnpm exec playwright test e2e/u5-battle-preview.spec.ts e2e/canvas-layout.spec.ts --project=chromium
```

- [ ] `git diff --check`, `git status --short`, `git diff --stat`으로 whitespace와 의도하지 않은 파일을 확인한다.
- [ ] 공식 문서 변경을 커밋한다.

```bash
git add docs/systems/CHARACTERS_AND_TRUST.md docs/systems/DUNGEON_EVENTS_AND_BOSSES.md docs/README.md
git commit -m "문서: 성직자 치유 규칙과 검증 결과를 반영한다" -m "직업·전투·원정 자원 계약과 paired 백테스트 색인을 공식 문서에 동기화한다."
```

- [ ] `superpowers:requesting-code-review`로 Spec 대비 누락, 중복 규칙, 기존 공격 회귀, U5 완료 프레임 예외, 백테스트 비교 키를 검토받고 지적을 반영한다.
- [ ] 수정이 생겼다면 해당 범위 테스트와 전체 검증을 다시 실행하고 별도 한글 제목·본문 커밋으로 남긴다.

## 완료 판정

- 성직자의 자동 치유 규칙과 원정 자원이 일반전·보스전에서 동일하게 작동한다.
- 성직자가 없거나 발동 조건이 없는 기존 전투는 `kind` 추가 외에 action·RNG·피해·최종 HP가 변하지 않는다.
- U3/U4/U5는 각자 올바른 시점의 잔여 횟수를 표시하고 U6은 표시하지 않는다.
- U5가 공격과 치유를 재계산 없이 구분해 재생하며 완료 프레임 예외가 테스트로 고정된다.
- 50·100·200시드 paired calibration 결과와 구조 gate가 보고서에 남고 2,000시드 holdout은 실행되지 않는다.
- 공식 문서, lint, typecheck, 전체 Vitest, 대상 Playwright, diff 검사가 모두 확인되거나 실패가 명시적으로 보고된다.
