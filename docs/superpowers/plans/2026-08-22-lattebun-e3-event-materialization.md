# E3 사건 물질화·단서 연계·공통 자동전투 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** E1 논리 지도와 E2 조언 판정을 소비해 category/숨은 역할/사건 물질화/단서/일반전 결과를 결정적으로 만들고, E4가 재사용할 공통 BattleEngine을 제공한다.

**Architecture:** E3는 순수 규칙 모듈로 구성한다. `expedition-events`는 지도 준비·역할 계획·방문 물질화·사건 효과를 소유하고, `encounter`는 콘텐츠 encounter의 검증·수정·전개를, `battle-engine`은 일반전과 보스전이 공유하는 전투 계산과 action record를 소유한다. 화면과 향후 store는 `ExpeditionState`에 보관된 확정 결과만 소비하며 RNG·피해를 재계산하지 않는다.

**Tech Stack:** TypeScript, Vitest 4, Next.js 16 프로젝트의 순수 `lib/` 도메인 규칙, 기존 결정적 `lib/rng`.

**작성 정보:** 작성자 LatteBun · 작성 도구 Codex

**Spec:**
- `docs/superpowers/specs/2026-08-22-lattebun-e3-event-materialization-design.md`
- `docs/superpowers/specs/2026-08-22-lattebun-e3-event-materialization-correction-design.md`
- `docs/superpowers/specs/2026-08-22-lattebun-e3-event-materialization-correction-2-design.md`

## Global Constraints

- EventId는 node role/category를 준비할 때가 아니라 실제 node 방문 순간에만 선택한다.
- category/role의 hard reservation은 지도 공개 전 최초 assignment이며, 공개 후 category는 절대 바꾸지 않는다.
- 정상 shipped profile과 유효 E1 map은 category RNG 결과만으로 `INVALID_GENERATION`이 되어서는 안 된다.
- 한 attempt 안에서 EventId는 중복될 수 없고, 새 attempt에서는 재사용될 수 있다.
- strong 수는 초기 위험도(★1~2=0, ★3~4=1, ★5=2), bossInfo 수는 현재 위험도(★1~2=1, ★3~5=2)를 사용한다.
- 모든 오류는 대체·재추첨·clamp가 아니라 `RuleError("INVALID_GENERATION", details)`로 진단한다. 단, HP clamp와 50-round `roundLimit → wipe`는 명시된 예외다.
- E2는 eligibility/조언 셔플/반응/`executed`/신뢰를 계속 소유한다. E3는 `BossInfoDepthPlan`을 제거하고 exact-once cut을 소유한다.
- `battle` RNG stream을 추가하고 event/battle stream의 소비 순서를 서로 의존시키지 않는다.
- 커밋 제목과 본문은 모두 한글로 작성한다.

---

## Planned File Structure

- `lib/domain/content.ts`: kind별 immediate effect/encounter/modifier의 discriminated event 계약.
- `lib/domain/expedition.ts`: prepared E3 상태, materialized event, battle result를 원정 상태에 보관하는 DTO.
- `lib/domain/dungeon.ts`: 일반 몬스터 전투 스탯 및 보스 target 성향.
- `lib/domain/seeds.ts`, `lib/rng/index.ts`: `battle` stream 선언과 허용 stream 동기화.
- `lib/content/event-registry.ts` (new): shared/themed 이벤트를 theme별로 일관되게 공급.
- `lib/content/situation-validation.ts`: concrete effect, encounter, strong pool, profile capacity의 정적 검증.
- `lib/content/themes.ts` 및 기존 event/builders 파일: profile과 모든 shipped payload를 새 도메인 계약으로 이관.
- `lib/rules/encounter.ts` (new): encounter modifier 적용 및 stable combatant 전개.
- `lib/rules/battle-engine.ts` (new): 공통 round loop 및 `BattleResolution` 생성.
- `lib/rules/boss-battle-adapter.ts` (new): E4 보스 입력을 공통 BattleEngine으로 변환.
- `lib/rules/expedition-events.ts` (new): category/cut/strong plan/event materialization/clue/effect/일반전 연결.
- `lib/rules/advice-evaluation.ts`: legacy boss-info depth planning 삭제, E2 책임 유지.
- `lib/rules/*.{test.ts}` 및 `lib/content/*.{test.ts}`: 각 pure rule의 TDD 테스트.
- 관련 공식 문서 및 작업 배정표: E3 계약으로 갱신.

---

### Task 1: 전투·사건 도메인 계약을 추가한다

**Files:**
- Modify: `lib/domain/content.ts`
- Modify: `lib/domain/dungeon.ts`
- Modify: `lib/domain/expedition.ts`
- Modify: `lib/domain/seeds.ts`
- Modify: `lib/rng/index.ts`
- Modify: `lib/domain/index.ts`
- Test: `lib/domain/contract.test.ts`
- Test: `lib/rng/streams.test.ts`

**Interfaces:**
- Produces `ImmediateEventEffect`, `EncounterDefinition`, `EncounterModifier`, kind별 `SituationEvent`, `BattleActionRecord`, `BattleResolution`, `PreparedExpeditionEvents`.
- Produces `MonsterDef.maxHp/baseDamage/targetWeightMultipliers` 및 optional `BossDef.targetWeightMultipliers`.
- Produces `SeedStream | RngStream`에 포함된 `"battle"`.

- [ ] **Step 1: 실패하는 타입·런타임 계약 테스트를 작성한다.**

  `contract.test.ts`에 monster event가 `encounter`와 각 advice/default modifier 없이는 유효하지 않고, rest/general special이 `defaultEffect`와 advice effect를 갖는 fixture를 통과하도록 테스트를 추가한다. `streams.test.ts`에는 `createRng(seed).derive("battle")`가 event stream과 독립·결정적인 값을 내는 테스트를 추가한다.

- [ ] **Step 2: 새 테스트가 현재 계약에서 실패함을 확인한다.**

  Run: `pnpm test lib/domain/contract.test.ts lib/rng/streams.test.ts`

  Expected: `battle` stream 및 concrete event/battle DTO가 아직 없어 실패한다.

- [ ] **Step 3: discriminated domain 타입을 구현한다.**

  ```ts
  export interface EncounterEnemyGroup { readonly monsterId: MonsterId; readonly count: number; }
  export interface EncounterDefinition { readonly enemies: readonly EncounterEnemyGroup[]; }
  export type EncounterModifier =
    | { readonly avoidCombat: true }
    | { readonly avoidCombat?: false; readonly addEnemies?: readonly EncounterEnemyGroup[];
        readonly removeEnemies?: readonly EncounterEnemyGroup[];
        readonly partyDamageMultiplier?: number; readonly incomingDamageMultiplier?: number };

  export interface BattleResolution {
    readonly outcome: "victory" | "wipe";
    readonly rounds: number;
    readonly actions: readonly BattleActionRecord[];
    readonly partyHpAfter: Readonly<Record<CharacterId, number>>;
    readonly enemyHpAfter: Readonly<Record<string, number>>;
    readonly termination: "defeatedEnemies" | "partyWipe" | "roundLimit";
  }
  ```

  `targetWeightMultipliers`의 명시 값은 양수, `maxHp/baseDamage`는 양의 정수로 이후 theme validator가 검사할 수 있는 타입으로 노출한다. 기존 `BossResult`는 E4 호환 DTO로 남기되 battle record를 중복 계산하는 새 타입을 만들지 않는다.

- [ ] **Step 4: domain/RNG 테스트와 typecheck를 통과시킨다.**

  Run: `pnpm test lib/domain/contract.test.ts lib/rng/streams.test.ts && pnpm typecheck`

- [ ] **Step 5: 커밋한다.**

  ```bash
  git add lib/domain lib/rng
  git commit -m "도메인: E3 사건과 공통 전투 계약 추가" -m "구체 사건 효과, encounter, 전투 기록과 battle RNG 스트림을 도입한다."
  ```

### Task 2: 콘텐츠 registry·검증기와 ecology profile 용량을 정비한다

**Files:**
- Create: `lib/content/event-registry.ts`
- Modify: `lib/content/situation-validation.ts`
- Modify: `lib/content/theme-validation.ts`
- Modify: `lib/content/themes.ts`
- Modify: `lib/content/shared-event-builders.ts`
- Modify: `lib/content/shared-rest-events.ts`
- Modify: `lib/content/shared-special-events.ts`
- Modify: `lib/content/events/spider-events.ts`
- Modify: `lib/content/events/desert-events.ts`
- Modify: `lib/content/events/graveyard-events.ts`
- Test: `lib/content/situation-validation.test.ts`
- Test: `lib/content/theme-validation.test.ts`
- Test: `lib/content/themed-events.test.ts`

**Interfaces:**
- Produces `eventsForTheme(themeId): readonly SituationEvent[]` and `allSituationEvents()`.
- Produces `validateEncounterDefinition`, `validateEncounterModifier`, `validateProfileStrongCapacity` as exported validation helpers or an equivalent single public validator invoked by theme/content tests.

- [ ] **Step 1: profile capacity와 encounter validation의 failing tests를 작성한다.**

  Fixture로 duplicate base MonsterId, duplicate add/remove entries, add/remove overlap, unknown remove target, remove underflow를 모두 `INVALID_GENERATION`으로 검증한다. 모든 shipped `EcologyProfile`을 순회해 ★3~4는 distinct eligible strong clue 1개 이상, ★5는 2개 이상인지 검증한다.

- [ ] **Step 2: 테스트가 기존 콘텐츠/validator에서 실패함을 확인한다.**

  Run: `pnpm test lib/content/situation-validation.test.ts lib/content/theme-validation.test.ts`

- [ ] **Step 3: profile 데이터와 event payload를 이관한다.**

  다음 profile을 정정 Spec의 정확한 배열로 교체한다.

  ```ts
  // desert-burning-waste
  ["desert-spirit-dry", "desert-mummy-silent", "desert-wind-track"]
  ["desert-spirit", "desert-mummy"]
  // graveyard-grave-robber
  ["graveyard-light", "graveyard-guard", "graveyard-desecration"]
  ["graveyard-mage", "graveyard-soldier"]
  // graveyard-hunters
  ["graveyard-archer-light", "graveyard-guard", "graveyard-desecration"]
  ["graveyard-archer", "graveyard-soldier"]
  // graveyard-blighted-tomb
  ["graveyard-light", "graveyard-archer-light", "graveyard-desecration"]
  ["graveyard-mage", "graveyard-archer"]
  ```

  모든 rest/general special의 help/harm/neutral/default에 `ImmediateEventEffect`를, 모든 monster의 help/harm/neutral/default에 `EncounterDefinition`/`EncounterModifier`를 넣는다. effect tag가 아니라 사건 문구와 일치하는 payload를 소유하게 하며, 보스 정보와 merchant는 각각 기존 지연/merchant 계약을 유지한다. 모든 monster의 base/add MonsterId는 해당 event가 eligible할 수 있는 profile의 `activeMonsterIds`와 호환되게 한다.

- [ ] **Step 4: validator와 registry를 구현한다.**

  encounter는 base/add/remove 배열별 MonsterId 중복을 거부하고, modifier는 remove 후 add 순서가 적용 가능하도록 검사한다. strong capacity는 `isEventEligible()`와 profile monster compatibility를 실제 registry event에 적용해 계산한다. 기존 `SHARED_EVENTS_PER_KIND_MIN`의 구 경로 보장 주석을 capacity 설명으로 교체한다.

- [ ] **Step 5: 콘텐츠 전체 검증을 통과시킨다.**

  Run: `pnpm test lib/content/situation-validation.test.ts lib/content/theme-validation.test.ts lib/content/shared-events.test.ts lib/content/themed-events.test.ts`

- [ ] **Step 6: 커밋한다.**

  ```bash
  git add lib/content
  git commit -m "콘텐츠: E3 encounter와 strong 용량 검증 추가" -m "프로필 정정과 concrete event payload를 함께 적용한다."
  ```

### Task 3: encounter 수정과 stable combatant 전개를 구현한다

**Files:**
- Create: `lib/rules/encounter.ts`
- Test: `lib/rules/encounter.test.ts`

**Interfaces:**
- Consumes `EncounterDefinition`, `EncounterModifier`, `MonsterDef`.
- Produces `resolveEncounter(base, modifier): ResolvedEncounter` and `expandEncounter(resolved): readonly BattleEnemy[]`.

- [ ] **Step 1: modifier 순서의 failing test를 작성한다.**

  Base `[mage×2, archer×1]`에서 mage remove 2는 mage group을 제거하고, archer add는 기존 위치 count를 올리고, 새 monster add는 선언 순서대로 뒤에 붙는지 검사한다. `avoidCombat`은 empty combat result를 반환하고 modifier와 공존하면 실패해야 한다.

- [ ] **Step 2: 테스트가 실패함을 확인한다.**

  Run: `pnpm test lib/rules/encounter.test.ts`

- [ ] **Step 3: immutable encounter resolver를 구현한다.**

  ```ts
  export function resolveEncounter(input: {
    base: EncounterDefinition;
    modifier: EncounterModifier;
    activeMonsterIds: readonly MonsterId[];
  }): ResolvedEncounter;

  export function expandEncounter(input: ResolvedEncounter): readonly BattleEnemy;
  ```

  remove는 base group에서만 차감하고 0 group을 제거한 뒤 add를 적용한다. `mage#1`, `mage#2`처럼 최종 group 순서와 group 내부 index만으로 stable id를 만든다.

- [ ] **Step 4: resolver 테스트와 typecheck를 통과시킨다.**

  Run: `pnpm test lib/rules/encounter.test.ts && pnpm typecheck`

- [ ] **Step 5: 커밋한다.**

  ```bash
  git add lib/rules/encounter.ts lib/rules/encounter.test.ts
  git commit -m "규칙: encounter 수정과 적 전개 구현" -m "remove-add 순서와 결정적 적 instance ID를 보장한다."
  ```

### Task 4: 공통 BattleEngine을 TDD로 구현한다

**Files:**
- Create: `lib/rules/battle-engine.ts`
- Test: `lib/rules/battle-engine.test.ts`

**Interfaces:**
- Consumes alive party members, class definitions, expanded enemies, risk-scaled stats, event/merchant/boss multipliers, deterministic battle identity.
- Produces `resolveBattle(input): BattleResolution`.

- [ ] **Step 1: round order와 action record의 failing tests를 작성한다.**

  party가 입력 순서로 front enemy를 공격하고 전 적 사망 시 enemy phase가 생략되는지, target weight가 `ClassDef.hitWeight × targetWeightMultipliers[classId]`인지, dead combatant가 재행동하지 않는지, 동일 seed가 동일 record를 만드는지, 50 round가 `wipe/roundLimit`인지 각각 fixture로 검증한다.

- [ ] **Step 2: tests가 실패함을 확인한다.**

  Run: `pnpm test lib/rules/battle-engine.test.ts`

- [ ] **Step 3: BattleEngine을 구현한다.**

  ```ts
  export function resolveBattle(input: BattleInput): BattleResolution {
    // round 1..50: party phase, victory short-circuit, enemy weighted phase
  }
  ```

  party damage는 `round(class.attack * partyMultiplier)`, enemy damage는 `round(scaledBaseDamage * incomingMultiplier * memberBossMultiplier)`로 계산한다. negative damage를 만들지 않고 every action에 before/after/defeated를 기록한다. target 선택은 battle identity로 파생한 RNG를 적 공격마다 정확히 한 번 소비한다.

- [ ] **Step 4: battle tests를 통과시킨다.**

  Run: `pnpm test lib/rules/battle-engine.test.ts`

- [ ] **Step 5: 커밋한다.**

  ```bash
  git add lib/rules/battle-engine.ts lib/rules/battle-engine.test.ts
  git commit -m "규칙: 공통 자동전투 엔진 추가" -m "일반전과 보스전이 공유할 action record 기반 전투 코어를 구현한다."
  ```

### Task 5: exact-once boss cut과 category/strong 구조 예약을 구현한다

**Files:**
- Create: `lib/rules/expedition-events.ts`
- Test: `lib/rules/expedition-events.test.ts`
- Test: `lib/rules/dungeon-map.test.ts`

**Interfaces:**
- Consumes `GeneratedMap`, `CampaignDungeon`, `ThemeContent`, event registry, campaign identity.
- Produces `prepareExpeditionEvents(input): PreparedExpeditionEvents` with immutable category map, bossInfo cuts, strong plans, and preflight diagnostics.

- [ ] **Step 1: preparation 실패 테스트를 작성한다.**

  All E1 templates/seeds에서 current-risk boss cut path min/max가 1인지, ★1~2는 one cut·★3~5는 ordered two cuts인지 검증한다. ★5 두 strong plans의 clueId/node roles가 distinct인지, synthetic impossible map은 `INVALID_GENERATION`인지, shipped profile/map은 category RNG 부족으로 실패하지 않는지 검증한다.

- [ ] **Step 2: tests가 실패함을 확인한다.**

  Run: `pnpm test lib/rules/expedition-events.test.ts lib/rules/dungeon-map.test.ts`

- [ ] **Step 3: 준비 알고리즘을 구현한다.**

  1. profile에서 eligible strong clue를 선택한다.
  2. cut 후보를 DAG DP로 평가하고, mixed/partial 우선 후 full-depth fallback을 선택한다.
  3. predecessor와 이후 follower-compatible node를 boss cut 및 다른 reservation과 겹치지 않게 확보한다.
  4. reserved strong node에 event kind category, cut node에 `special`을 최초 assignment한다.
  5. 남은 normal nodes만 base `40/20/15/25`와 route/depth/global soft penalties로 채운다.
  6. event capacity, profile eligibility, path cut, role disjointness, follower reachability를 검증한다.

- [ ] **Step 4: category/cut/strong 테스트를 통과시킨다.**

  Run: `pnpm test lib/rules/expedition-events.test.ts lib/rules/dungeon-map.test.ts`

- [ ] **Step 5: 커밋한다.**

  ```bash
  git add lib/rules/expedition-events.ts lib/rules/expedition-events.test.ts lib/rules/dungeon-map.test.ts
  git commit -m "규칙: E3 지도 역할과 사건 category 준비" -m "exact-once 보스 정보 cut과 strong 구조 예약을 결정적으로 생성한다."
  ```

### Task 6: 방문 물질화·단서·즉시 효과를 구현한다

**Files:**
- Modify: `lib/rules/expedition-events.ts`
- Modify: `lib/domain/expedition.ts`
- Test: `lib/rules/expedition-events.test.ts`

**Interfaces:**
- Produces `materializeNodeEvent(input)`, `applyEventChoice(input)`, `activateStrongFollower(input)`.
- Consumes pre-visit held clues and E2 `AdviceDecision`; returns updated prepared state, materialized event, updated party, clue log, optional `BattleResolution`.

- [ ] **Step 1: materialization timing의 failing tests를 추가한다.**

  Unvisited branch가 EventId를 소비하지 않는지, role precedence가 bossInfo→follower→predecessor→normal인지, EventId가 attempt 내 중복되지 않고 new attempt에서 가능해지는지, pre-visit clue만 첫 matching upgrade 하나를 바꾸는지, revealed clue가 description 직후 추가되는지 검증한다.

- [ ] **Step 2: tests가 실패함을 확인한다.**

  Run: `pnpm test lib/rules/expedition-events.test.ts`

- [ ] **Step 3: deterministic event selection과 effect application을 구현한다.**

  Stable EventId sort 후 `campaignSeed/dungeonId/attempt/nodeId/hiddenRole` event RNG로 균등 선택한다. normal pool은 targetBoss/requiresClue/strong-predecessor를 제외한다. `executed`이면 chosen option effect를 단 한 번, 아니면 default effect를 적용한다. immediate HP는 alive member만 `0..maxHp` clamp하고 0이면 사망시킨다.

- [ ] **Step 4: follower activation과 missed semantics를 구현한다.**

  predecessor 방문 때만 사전 확보 후보 중 현재 위치에서 reachable한 하나를 선택한다. predecessor를 건너뛰면 후보는 normal event로 남고, 선택된 follower를 지나치면 `missed`이며 재배치하지 않는다.

- [ ] **Step 5: materialization/effect tests를 통과시킨다.**

  Run: `pnpm test lib/rules/expedition-events.test.ts`

- [ ] **Step 6: 커밋한다.**

  ```bash
  git add lib/rules/expedition-events.ts lib/rules/expedition-events.test.ts lib/domain/expedition.ts
  git commit -m "규칙: 방문 사건 물질화와 단서 효과 구현" -m "방문 시점 EventId 선택, upgrade, strong follower와 HP 효과를 연결한다."
  ```

### Task 7: 일반 monster battle·merchant pending·retry scaling을 연결한다

**Files:**
- Modify: `lib/rules/expedition-events.ts`
- Modify: `lib/rules/merchant.ts`
- Test: `lib/rules/expedition-events.test.ts`
- Test: `lib/rules/merchant.test.ts`

**Interfaces:**
- Consumes materialized monster event, resolved encounter, pending merchant effect, `retrySteps = riskLevel - initialRiskLevel`.
- Produces battle-or-avoid result and the correct next pending state.

- [ ] **Step 1: 전투 연결 failing tests를 추가한다.**

  `avoidCombat`은 BattleEngine을 호출하지도 pending을 소비하지도 않아야 한다. 실제 다음 monster battle은 pending을 한 번 소비하며 event/merchant multipliers를 곱한다. monster battle이 없으면 E4 boss adapter가 소비할 pending을 그대로 남긴다. retry multiplier는 enemy HP와 damage에 함께 적용하지만 group count는 바꾸지 않아야 한다.

- [ ] **Step 2: tests가 실패함을 확인한다.**

  Run: `pnpm test lib/rules/expedition-events.test.ts lib/rules/merchant.test.ts`

- [ ] **Step 3: encounter-to-battle adapter를 구현한다.**

  `retryCombatMultiplier(0) === 1` 및 이후 단조 증가를 이름 있는 table/function으로 둔다. resolved encounter와 `MonsterDef`를 BattleEngine input으로 변환하고, battle 후 party HP와 `BattleResolution`만 저장한다. `consumePendingMerchantEffect()`는 BattleEngine을 실제 호출하기 직전에만 사용한다.

- [ ] **Step 4: 일반전/merchant/retry tests를 통과시킨다.**

  Run: `pnpm test lib/rules/expedition-events.test.ts lib/rules/merchant.test.ts lib/rules/battle-engine.test.ts`

- [ ] **Step 5: 커밋한다.**

  ```bash
  git add lib/rules/expedition-events.ts lib/rules/merchant.ts lib/rules/expedition-events.test.ts lib/rules/merchant.test.ts
  git commit -m "규칙: 일반전과 상인 전투 효과 연결" -m "monster encounter, 재도전 강화, pending 소비를 실제 BattleEngine에 연결한다."
  ```

### Task 8: E2 경계를 정리하고 E4 adapter 입력을 고정한다

**Files:**
- Modify: `lib/rules/advice-evaluation.ts`
- Modify: `lib/rules/advice-evaluation.test.ts`
- Modify: `lib/domain/expedition.ts`
- Test: `lib/rules/expedition-events.test.ts`

**Interfaces:**
- Removes `BossInfoDepthPlan` and `planBossInfoDepths`.
- Retains `resolveBossInfoAdvice` and exposes battle-ready pending merchant/BossInfo record data without a second combat loop.

- [ ] **Step 1: legacy depth API removal 및 retained E2 behavior tests를 작성한다.**

  E2 tests에서 bossInfo targetBoss validation, delayed records, exposed harmful immediate trust는 계속 통과하고 depth-plan import는 없어야 한다. E3 preparation이 E2 depth input 없이 bossInfo cut을 만든다는 테스트를 추가한다.

- [ ] **Step 2: tests가 old API에 의존해 실패함을 확인한다.**

  Run: `pnpm test lib/rules/advice-evaluation.test.ts lib/rules/expedition-events.test.ts`

- [ ] **Step 3: depth planning을 제거하고 adapter DTO를 정리한다.**

  `resolveBossInfoAdvice()`는 target boss·delayed trust 책임만 유지한다. E4가 `BattleResolution`, pending merchant effect, member별 boss info modifier를 BattleEngine input으로 변환할 수 있도록 expedition DTO에 필요한 readonly result fields만 추가한다.

- [ ] **Step 4: E2/E3 경계 tests를 통과시킨다.**

  Run: `pnpm test lib/rules/advice-evaluation.test.ts lib/rules/expedition-events.test.ts && pnpm typecheck`

- [ ] **Step 5: 커밋한다.**

  ```bash
  git add lib/rules/advice-evaluation.ts lib/rules/advice-evaluation.test.ts lib/domain/expedition.ts lib/rules/expedition-events.test.ts
  git commit -m "규칙: E2 보스 정보 Depth 책임 제거" -m "E3 cut과 E4 공통 전투 adapter 경계를 분리한다."
  ```

### Task 9: 공식 문서와 작업 배정표를 E3 계약으로 갱신한다

**Files:**
- Modify: `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`
- Modify: `docs/systems/INFORMATION_AND_DECEPTION.md`
- Modify: `docs/systems/DUNGEON_THEMES_AND_ECOLOGY.md`
- Modify: `docs/design/CORE_GAME_LOOP.md`
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`
- Modify: `docs/README.md`
- Modify: `lib/domain/content.ts`
- Test: `docs/DOCUMENT_TERMINOLOGY.test.ts`
- Test: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.test.ts`

- [ ] **Step 1: 문서 contract tests와 legacy-search test를 먼저 추가한다.**

  Active docs/comments에서 `BossInfoDepthPlan`, `planBossInfoDepths`, 보스 정보 Depth 예약, 강한 연계 Depth 보장, 모든 경로 네 category 보장 문구가 남지 않음을 검사한다. 작업 배정표는 E3=category/cut/materialization/clue/effect/common BattleEngine, E4=boss adapter/delayed trust, U5-2=common action replay를 나타내게 한다.

- [ ] **Step 2: tests가 old contract 때문에 실패함을 확인한다.**

  Run: `pnpm test docs/DOCUMENT_TERMINOLOGY.test.ts docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.test.ts`

- [ ] **Step 3: 공식 문서를 갱신한다.**

  Map은 category만 선공개하고, E3 exact-once `special` cut, strong opportunity activation, pre-visit clue upgrade, immediate effect/monster battle/common action record의 순서를 설명한다. 네 profile의 확정 ecology 변경도 theme 공식 표에 반영한다. 이전 PR 88의 Mermaid ID 정규화와 `방문한 사건` 앵커를 유지한다.

- [ ] **Step 4: 문서 검증을 통과시킨다.**

  Run: `pnpm test docs/DOCUMENT_TERMINOLOGY.test.ts docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.test.ts`

- [ ] **Step 5: 커밋한다.**

  ```bash
  git add docs lib/domain/content.ts
  git commit -m "문서: E3 사건과 공통 전투 계약 반영" -m "구 Depth 예약과 경로별 category 보장 문구를 새 E3 책임으로 교체한다."
  ```

### Task 10: 전 범위 결정성·회귀 검증을 수행한다

**Files:**
- Modify: `lib/rules/expedition-events.test.ts`
- Modify: `lib/rules/battle-engine.test.ts`
- Modify: `lib/content/theme-validation.test.ts`
- Modify: `docs/technical/BACKTEST_REPORT.md` (only if B1/Q1 backtest runner requires an E3 fixture/report update)

- [ ] **Step 1: cross-module regression fixtures를 추가한다.**

  모든 E1 template와 representative seeds/profile을 준비해 prepared category map, cuts, strong plan, materialized event, battle record가 같은 input에서 완전히 동일한지 검증한다. invalid content/map fixture는 실패 사유가 있는 `INVALID_GENERATION`을 내야 한다.

- [ ] **Step 2: focused suite를 실행한다.**

  Run: `pnpm test lib/content lib/rules docs/DOCUMENT_TERMINOLOGY.test.ts docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.test.ts`

- [ ] **Step 3: 전체 품질 게이트를 실행한다.**

  Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`

  Expected: lint/typecheck/test/build가 모두 성공한다. E3 이전에 실패하던 문서 정합성 테스트도 성공해야 한다.

- [ ] **Step 4: 구현 상태와 문서 검색 결과를 점검한다.**

  Run:

  ```bash
  rg -n 'BossInfoDepthPlan|planBossInfoDepths|보스 정보 Depth|강한 연계 Depth|모든 가능한 실제 경로에는 네 분류|모든 경로에 각각 한 번 이상' docs lib
  ```

  Expected: 역사적 Superpowers 설계 외 active code/official docs에는 폐기 계약이 없다.

- [ ] **Step 5: 최종 커밋한다.**

  ```bash
  git add lib docs
  git commit -m "검증: E3 사건 물질화 회귀 범위 보강" -m "결정성, 용량, 문서 정합성 검증을 완료한다."
  ```

---

## Plan Self-Review

- 원본 E3의 category/cut/materialization/clue/effect/merchant/common battle/retry/document acceptance를 Tasks 1~10에 매핑했다.
- 1차 정정의 encounter uniqueness·add/remove semantics·profile capacity는 Tasks 2~3에 매핑했다.
- 2차 정정의 네 profile 수정과 hard category reservation은 Tasks 2와 5에 매핑했다.
- E2/E3/E4 책임 분리는 Task 8, 공식 계약 교체는 Task 9, 전체 검증은 Task 10에 매핑했다.
- 계획 본문에서 `TBD`, `TODO`, `implement later`, 모호한 "적절한 검증" 문구를 사용하지 않았다.
