# C8-B 캠페인 이력 이벤트 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** C8-A 정산 통계와 분리된 결정적 캠페인 이벤트 이력·전환점 cache를 제공하고, C1 초기 상태와 C7 결과 조합 경계까지 검증한다.

**Architecture:** `lib/domain/history.ts`가 이벤트 union과 history 상태를 소유하고, `lib/rules/campaign-history.ts`가 source 결과를 draft로 옮기는 순수 factory와 append·무결성·전환점 reducer를 소유한다. `CampaignState.history`는 persistent 상태이며, C7은 이력을 직접 변경하지 않는다. I1은 아직 없으므로 Store commit은 구현하지 않고, C7 결과와 C8-A/C8-B 반환값을 함께 조합하는 규칙 테스트로 원자성 경계를 검증한다.

**Tech Stack:** TypeScript, Vitest 4, 기존 `RuleError`, Next.js 16 프로젝트의 `@/` alias.

**Spec:** [C8-B 캠페인 이력 이벤트 설계](../specs/2026-08-23-lattebun-c8-b-campaign-history-events-design.md)

## Global Constraints

- `events`가 유일한 source of truth이고 `turningPoints`는 `deriveTurningPoints(events)`의 검증 가능한 cache다.
- `Date.now()`, `createdAt`, 임의 `payload`, 공통 `actors: string[]`를 추가하지 않는다.
- 이벤트 ID는 `campaign:${campaignTurn}:event:${sequence}`이고, sequence는 history 전체에서 0부터 빈틈 없이 증가한다.
- source key는 이력 전체에서 유일하다. 재기록은 `RuleError("DUPLICATE_ID")`, 손상된 기존 이력·payload는 `RuleError("INVALID_STATE")`다.
- reducer와 factory는 입력 객체·배열·`CampaignState`를 변경하지 않는다. C7 `phase`, pool, dungeon, context와 C8-A 통계를 변경하지 않는다.
- 실제 I1/Zustand Store, 저장·복원 UI, I2 Chronicle 문장, U6 ViewModel은 이번 구현 범위 밖이다.
- 구현 전 [게임 원칙](../../GAME_PRINCIPLES.md), [C8-B Spec](../specs/2026-08-23-lattebun-c8-b-campaign-history-events-design.md), [C8-A Spec](../specs/2026-08-23-lattebun-c8-campaign-statistics-design.md)을 다시 읽는다.
- 모든 커밋 메시지는 제목과 본문을 한국어로 작성한다.

---

## File Structure

| 파일 | 역할 |
| --- | --- |
| `lib/domain/ids.ts` | `CampaignEventId`, `CampaignEventSourceKey` 브랜드 ID 추가 |
| `lib/domain/history.ts` | 이벤트 union, identity 없는 draft union, history·turning point 타입과 빈 history factory |
| `lib/domain/campaign.ts` | persistent `CampaignState.history` 필드 추가 |
| `lib/domain/index.ts` | 새 ID·history 타입·factory 공개 |
| `lib/rules/campaign-init.ts` | 새 캠페인에 `createCampaignHistory()` 추가 |
| `lib/rules/campaign-init.test.ts` | 초기 history와 seed별 독립 참조 확인 |
| `lib/rules/campaign-history.ts` | source 결과→draft factory, append, integrity, turning point reducer |
| `lib/rules/campaign-history.test.ts` | factory·무결성·중복·전환점·C7/C8-A 조합 회귀 |

## Task 1: 도메인 이력 계약과 C1 초기 상태

**Files:**

- Create: `lib/domain/history.ts`
- Modify: `lib/domain/ids.ts`
- Modify: `lib/domain/campaign.ts:1-168`
- Modify: `lib/domain/index.ts:1-200`
- Modify: `lib/rules/campaign-init.ts:5-140`
- Modify: `lib/rules/campaign-init.test.ts:4-36,64-78`

**Interfaces:**

- Produces `CampaignEventId`, `CampaignEventSourceKey`, `CampaignHistory`, `CampaignEvent`, `CampaignEventDraft`, `TurningPoint`, `createCampaignHistory()`.
- Produces `CampaignState.history: CampaignHistory`; later reducer work consumes this exact field.

- [ ] **Step 1: Write the failing C1 history tests**

  In `lib/rules/campaign-init.test.ts`, import `createCampaignHistory` and add these assertions to the initial-state test and same-seed independence test:

  ```ts
  expect(state.history).toEqual(createCampaignHistory());
  expect(state.history.events).toEqual([]);
  expect(state.history.turningPoints).toEqual([]);

  expect(second.history).not.toBe(first.history);
  expect(second.history.events).not.toBe(first.history.events);
  expect(second.history.turningPoints).not.toBe(first.history.turningPoints);
  ```

- [ ] **Step 2: Run the focused test to verify it fails**

  Run:

  ```bash
  pnpm test -- lib/rules/campaign-init.test.ts
  ```

  Expected: TypeScript or assertion failure because `CampaignState` has no `history` and `createCampaignHistory` is not exported.

- [ ] **Step 3: Add branded IDs and the complete history union**

  Add the two IDs in `lib/domain/ids.ts`:

  ```ts
  export type CampaignEventId = Brand<string, "CampaignEventId">;
  export type CampaignEventSourceKey = Brand<string, "CampaignEventSourceKey">;
  ```

  Create `lib/domain/history.ts`. Define readonly `CampaignEventIdentity` (`id`, `campaignTurn`, `sequence`) and `CampaignEventSource` (`sourceKey`), then the six Spec variants:

  ```ts
  export type CampaignEvent =
    | AdviceResolvedEvent
    | BossBattleResolvedEvent
    | ExpeditionSettledEvent
    | GuidePromotedEvent
    | TrustCollapsedEvent
    | CampaignEndedEvent;

  export type CampaignEventDraft = WithoutCampaignEventIdentity<CampaignEvent>;

  export interface CampaignHistory {
    readonly events: readonly CampaignEvent[];
    readonly turningPoints: readonly TurningPoint[];
  }

  export function createCampaignHistory(): CampaignHistory {
    return { events: [], turningPoints: [] };
  }
  ```

  Import actual domain types rather than replacing them with strings: `AdviceOutcome`, `MemberReaction`, `CampaignEnding`, `GuideRank`, `PromotionMethod`, `BossId`, `CharacterId`, `ChoiceId`, `DungeonId`, `EventId`, and `ExpeditionStatus`. Define `TurningPointKind` as `firstCharacterDeath | bossBreakthrough | trustCollapse | campaignEnded` and keep `TurningPoint.eventId`, `campaignTurn`, and `sequence` readonly.

- [ ] **Step 4: Thread the new state through C1 and public exports**

  In `lib/domain/campaign.ts`, import `CampaignHistory` and add:

  ```ts
  /** C8-B가 확정 사실을 순서 있게 보관하는 persistent 이력이다. */
  history: CampaignHistory;
  ```

  In `lib/rules/campaign-init.ts`, import `createCampaignHistory` from `@/lib/domain` and set:

  ```ts
  statistics: createCampaignStatistics(),
  history: createCampaignHistory(),
  ```

  Re-export both new brands from the ID export block in `lib/domain/index.ts`; export `createCampaignHistory`; and export every public history type (`CampaignEvent`, `CampaignEventDraft`, all six event interfaces, `CampaignHistory`, `TurningPoint`, `TurningPointKind`).

- [ ] **Step 5: Run the focused test to verify it passes**

  Run:

  ```bash
  pnpm test -- lib/rules/campaign-init.test.ts
  ```

  Expected: PASS. A same-seed campaign has equal empty history values without shared history object or array references.

- [ ] **Step 6: Commit the completed contract task**

  ```bash
  git add lib/domain/ids.ts lib/domain/history.ts lib/domain/campaign.ts lib/domain/index.ts lib/rules/campaign-init.ts lib/rules/campaign-init.test.ts
  git commit -m "feat: C8-B 이력 도메인 계약 추가" -m "캠페인 이벤트 타입과 초기 빈 이력을 CampaignState에 추가한다."
  ```

## Task 2: source 결과를 결정적 이벤트 draft로 변환

**Files:**

- Create: `lib/rules/campaign-history.ts`
- Create: `lib/rules/campaign-history.test.ts`

**Interfaces:**

- Consumes Task 1의 `CampaignEventDraft`와 E2 `AdviceDecision`, E4 `BossResult`, C4 `SettlementResult`, C5 `PromotionResult`, C6 `CampaignEnding`.
- Produces `toAdviceResolvedEventDraft`, `toBossBattleResolvedEventDraft`, `toExpeditionSettledEventDraft`, `toGuidePromotedEventDraft`, `toTrustCollapsedEventDraft`, `toCampaignEndedEventDraft`.
- Task 3가 이 factory 반환값을 `appendCampaignEvent` 입력으로 사용한다.

- [ ] **Step 1: Write failing factory tests with real source types**

  Create `lib/rules/campaign-history.test.ts`. Use branded fixture IDs and assert these facts:

  ```ts
  expect(toAdviceResolvedEventDraft({
    expeditionId: "exp-1",
    dungeonId,
    sourceEventId: eventId,
    decision: {
      adviceId,
      outcome: "harm",
      executed: true,
      reactions: [
        { characterId: firstId, reaction: "accepted" },
        { characterId: secondId, reaction: "suspected" },
        { characterId: thirdId, reaction: "exposed" },
      ],
      delayedRecords: [],
    },
  })).toMatchObject({
    type: "ADVICE_RESOLVED",
    sourceKey: `exp-1:advice:${eventId}:${adviceId}`,
    executed: true,
  });
  ```

  Add a second advice fixture with only `suspected` and `exposed` reactions and assert `executed: false`; do not invent `ADVICE_REJECTED`. For settlement, include an already-dead `false → false` member and one `true → false` member, then expect only the latter in `deceasedCharacterIds`. Assert the BossResult factory copies status/survivor IDs and uses `verifications.length`; assert the promotion, distrust, and campaign-ending factories use the six exact source-key formats from the Spec.

- [ ] **Step 2: Run the focused factory tests to verify they fail**

  Run:

  ```bash
  pnpm test -- lib/rules/campaign-history.test.ts
  ```

  Expected: FAIL because `lib/rules/campaign-history.ts` and the six factory exports do not exist.

- [ ] **Step 3: Implement snapshotting factories and source-key builders**

  In `lib/rules/campaign-history.ts`, create a local `invalidState()` that throws `new RuleError("INVALID_STATE", message, details)`. Implement the six exports. Each factory must return a fresh draft object and fresh arrays; it must not return source arrays by reference.

  The required source keys are:

  ```ts
  `${expeditionId}:advice:${sourceEventId}:${decision.adviceId}`;
  `${expeditionId}:boss-result`;
  `${settlement.expeditionId}:settlement`;
  `promotion:${result.fromRank}:${result.toRank}`;
  `${expeditionId}:trust-collapse`;
  `campaign-ended:${ending.kind}`;
  ```

  Implement settlement deaths only as:

  ```ts
  const deceasedCharacterIds = settlement.memberChanges
    .filter(({ before, after }) => before.alive && !after.alive)
    .map(({ characterId }) => characterId);
  ```

  `toTrustCollapsedEventDraft` must reject an ending whose `kind !== "distrust"` with `INVALID_STATE`. Clone `CampaignEnding.triggerCharacterIds` when creating an ended draft; never add a clock value, aggregate counter, reward, or battle action log.

- [ ] **Step 4: Run the focused factory tests to verify they pass**

  Run:

  ```bash
  pnpm test -- lib/rules/campaign-history.test.ts
  ```

  Expected: PASS. The test demonstrates all E2 reactions are retained, C4 deaths are not double-counted, and every source key is stable.

- [ ] **Step 5: Commit the factory task**

  ```bash
  git add lib/rules/campaign-history.ts lib/rules/campaign-history.test.ts
  git commit -m "feat: C8-B 이벤트 draft 변환 추가" -m "확정된 도메인 결과를 결정적 이력 입력으로 변환한다."
  ```

## Task 3: 불변 append·cache 무결성·전환점 reducer

**Files:**

- Modify: `lib/rules/campaign-history.ts`
- Modify: `lib/rules/campaign-history.test.ts`

**Interfaces:**

- Consumes Task 1 `CampaignHistory`, Task 2 draft factories.
- Produces `appendCampaignEvent(history, { campaignTurn, event })`, `deriveTurningPoints(events)`, `assertCampaignHistoryIntegrity(history)`.
- Task 4 consumes these functions to compose C7 results without changing C7.

- [ ] **Step 1: Write failing reducer and integrity tests**

  Add tests that append a valid advice draft at turn `0` and then a boss draft at turn `1`. Assert exact identity:

  ```ts
  expect(history.events.map(({ id, campaignTurn, sequence }) => ({ id, campaignTurn, sequence }))).toEqual([
    { id: "campaign:0:event:0", campaignTurn: 0, sequence: 0 },
    { id: "campaign:1:event:1", campaignTurn: 1, sequence: 1 },
  ]);
  ```

  Capture `structuredClone(history)` before all rejection tests. Assert each case throws the stated `RuleError` and leaves the input equal to its clone:

  ```ts
  expect(() => appendCampaignEvent(history, duplicateSourceKeyInput))
    .toThrowError(expect.objectContaining({ code: "DUPLICATE_ID" }));
  expect(() => appendCampaignEvent(history, { campaignTurn: -1, event: validDraft }))
    .toThrowError(expect.objectContaining({ code: "INVALID_STATE" }));
  expect(() => assertCampaignHistoryIntegrity({ ...history, turningPoints: [] }))
    .toThrowError(expect.objectContaining({ code: "INVALID_STATE" }));
  ```

  Add turn-point tests for: first settlement containing a new death, two cleared boss results, distrust collapse, campaign ending, a later settlement death that does not create a second `firstCharacterDeath`, and a cache produced in ascending source event sequence.

- [ ] **Step 2: Run the focused reducer tests to verify they fail**

  Run:

  ```bash
  pnpm test -- lib/rules/campaign-history.test.ts
  ```

  Expected: FAIL because append, integrity, and turning-point exports are absent.

- [ ] **Step 3: Implement integrity before append and deterministic cache derivation**

  Implement these rules in `lib/rules/campaign-history.ts`:

  ```ts
  export function appendCampaignEvent(
    history: CampaignHistory,
    input: { readonly campaignTurn: number; readonly event: CampaignEventDraft },
  ): CampaignHistory {
    assertCampaignHistoryIntegrity(history);
    // validate turn and draft; reject duplicate sourceKey
    const sequence = history.events.length;
    const event = { ...input.event, id: `campaign:${input.campaignTurn}:event:${sequence}` as CampaignEventId, campaignTurn: input.campaignTurn, sequence } as CampaignEvent;
    const events = [...history.events, event];
    return { events, turningPoints: deriveTurningPoints(events) };
  }
  ```

  `assertCampaignHistoryIntegrity` must verify sequence equals index, ID matches the specified format, source keys are unique, campaign turns are non-negative safe integers and non-decreasing, every variant’s IDs and arrays are valid, and `turningPoints` deep-equals `deriveTurningPoints(events)`. Do not silently repair cache corruption.

  `deriveTurningPoints` must scan events in sequence order and emit exactly one `firstCharacterDeath` for the first non-empty settled death list, one `bossBreakthrough` for every cleared boss event, one `trustCollapse` per trust event, and one `campaignEnded` per ending event. Each result must copy the source event’s ID, turn, and sequence.

- [ ] **Step 4: Run the focused reducer tests to verify they pass**

  Run:

  ```bash
  pnpm test -- lib/rules/campaign-history.test.ts
  ```

  Expected: PASS. Valid replay yields identical history; malformed cache and duplicate source facts are rejected without mutation.

- [ ] **Step 5: Write the failing U6 highlight-selector tests**

  Add tests for this non-UI helper:

  ```ts
  expect(selectHighlightedTurningPoint([
    campaignEndedPoint,
    firstDeathPoint,
    laterBossPoint,
    trustCollapsePoint,
  ])).toEqual(trustCollapsePoint);

  expect(selectHighlightedTurningPoint([campaignEndedPoint])).toBeNull();
  expect(selectHighlightedTurningPoint([firstBossPoint, laterBossPoint])).toEqual(laterBossPoint);
  ```

  The expected policy is: exclude `campaignEnded`; choose `trustCollapse` over `firstCharacterDeath` over `bossBreakthrough`; for the same kind choose the larger `sequence`.

- [ ] **Step 6: Run the selector tests to verify they fail**

  Run:

  ```bash
  pnpm test -- lib/rules/campaign-history.test.ts
  ```

  Expected: FAIL because `selectHighlightedTurningPoint` is not exported.

- [ ] **Step 7: Implement the pure selector**

  Add this export to `lib/rules/campaign-history.ts`:

  ```ts
  export function selectHighlightedTurningPoint(
    turningPoints: readonly TurningPoint[],
  ): TurningPoint | null {
    const rank: Readonly<Record<Exclude<TurningPointKind, "campaignEnded">, number>> = {
      trustCollapse: 3,
      firstCharacterDeath: 2,
      bossBreakthrough: 1,
    };
    return turningPoints.reduce<TurningPoint | null>((selected, point) => {
      if (point.kind === "campaignEnded") return selected;
      if (selected === null || selected.kind === "campaignEnded") return point;
      return rank[point.kind] > rank[selected.kind]
        || (rank[point.kind] === rank[selected.kind] && point.sequence > selected.sequence)
        ? point
        : selected;
    }, null);
  }
  ```

- [ ] **Step 8: Run all C8-B reducer tests to verify they pass**

  Run:

  ```bash
  pnpm test -- lib/rules/campaign-history.test.ts
  ```

  Expected: PASS. Valid replay yields identical history; malformed cache and duplicate source facts are rejected without mutation; the highlight selector follows its priority policy.

- [ ] **Step 9: Commit the reducer task**

  ```bash
  git add lib/rules/campaign-history.ts lib/rules/campaign-history.test.ts
  git commit -m "feat: C8-B 이력 reducer 추가" -m "결정적 append와 전환점 cache 무결성을 구현한다."
  ```

## Task 4: C7·C8-A 조합 경계 회귀 검증과 전체 확인

**Files:**

- Modify: `lib/rules/campaign-history.test.ts`

**Interfaces:**

- Consumes C7 `transitionCampaign`의 `CampaignTransitionResult.settlement`, C8-A `recordSettlementStatistics`, Task 2 `toExpeditionSettledEventDraft`, Task 3 `appendCampaignEvent`.
- Produces a regression test only. Task 1에서 공개한 domain 계약 외에 C7 또는 domain API를 추가하지 않는다.

- [ ] **Step 1: Write the C7 composition regression test**

  Reuse the existing C7 flow pattern from `lib/rules/campaign-statistics.test.ts`: initialize, open board, select an unlocked offer, start expedition, and dispatch `COMPLETE_EXPEDITION`. In the new history test, calculate both local values before assembling a replacement campaign:

  ```ts
  const transition = transitionCampaign(campaign, context, completeAction);
  const settlement = transition.settlement;
  if (settlement === null) throw new Error("settlement fixture is missing");

  const statistics = recordSettlementStatistics(transition.campaign.statistics, settlement, dungeon);
  const history = appendCampaignEvent(transition.campaign.history, {
    campaignTurn: transition.campaign.worldTurn,
    event: toExpeditionSettledEventDraft(settlement),
  });
  const committed = { ...transition.campaign, statistics, history };
  ```

  Assert `committed.phase === "settlement"`, C7’s `settledExpeditionIds` is unchanged, one C8-A settlement and one `EXPEDITION_SETTLED` event exist, and the original `transition.campaign.statistics` and `.history` remain empty. Add a duplicate append assertion proving no partial replacement is created when the history reducer throws.

- [ ] **Step 2: Run the regression test to verify the composed result**

  Run:

  ```bash
  pnpm test -- lib/rules/campaign-history.test.ts
  ```

  Expected: PASS. 앞선 Task에서 구현한 순수 API만으로 C7 결과, C8-A 통계, C8-B history를 단일 replacement object로 조합한다.

- [ ] **Step 3: Verify the architectural boundary without production changes**

  Inspect the regression diff and keep the production boundary as follows:

  ```ts
  // 허용: I1이 나중에 수행할 지역 계산의 모형
  const committed = { ...transition.campaign, statistics, history };

  // 금지: C7 context/result에 history를 넣거나 transitionCampaign에서 append 호출
  ```

  Do **not** add `history` to `CampaignTransitionContext`, do **not** change `CampaignTransitionResult`, and do **not** call the reducer inside `transitionCampaign`. C8-B rule functions remain direct imports from `@/lib/rules/campaign-history`, matching `campaign-statistics.ts` usage.

- [ ] **Step 4: Run focused C8 and C7 regressions**

  Run:

  ```bash
  pnpm test -- lib/rules/campaign-history.test.ts lib/rules/campaign-statistics.test.ts lib/rules/campaign-transition.test.ts lib/rules/campaign-init.test.ts
  ```

  Expected: PASS. C8-A still owns numerical settlement aggregation, C7 still owns phase transitions, and C8-B history can be atomically composed only after all local computations succeed.

- [ ] **Step 5: Run repository verification**

  Run:

  ```bash
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm build
  git diff --check
  ```

  Expected: every command exits `0`; no unrelated file changes; no `Date.now`, `createdAt`, `actors: string[]`, or `ADVICE_REJECTED` appears in C8-B production code.

- [ ] **Step 6: Commit the integration verification task**

  ```bash
  git add lib/rules/campaign-history.test.ts
  git commit -m "test: C8-B 이력 조합 경계 검증" -m "C7 전이와 C8-A 통계를 바꾸지 않는 이력 조합을 회귀 검증한다."
  ```

## Plan Self-Review

- [x] **Spec coverage:** Task 1 covers persistent history and initial state; Task 2 covers six typed source facts and stable keys; Task 3 covers deterministic IDs, integrity, cache, turning points, and U6 highlight selection; Task 4 covers C7/C8-A atomic composition and full verification. I1 persistence, I2 Chronicle prose, and U6 rendering remain deliberately out of scope.
- [x] **No-placeholder scan:** Every task lists concrete files, exports, test assertions, expected command outcome, and Korean commit command.
- [x] **Type consistency:** `CampaignEventDraft` is introduced before all factories; factories precede append; append precedes the C7 composition test; C7 itself remains unchanged throughout.
