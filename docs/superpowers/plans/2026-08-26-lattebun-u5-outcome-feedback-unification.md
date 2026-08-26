# U5 전투·비전투 결과 피드백 통합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 일반 사건과 보스 결과를 하나의 인과형 U5 피드백 상태 머신으로 보여주면서 골드·HP·신뢰·개인 보스 정보·상인 예약 효과와 진행 기록을 현재 phase까지만 공개한다.

**Architecture:** rules는 결과 계산 순간 `OutcomePresentationSnapshot`과 개별 `OutcomeTrustChangeStep`을 기록하고 Store에는 계속 최종 상태를 보관한다. adapter는 도메인 식별자와 내부 정답을 제거한 `U5OutcomeFeedbackView`, 공용 원정 HUD View, 단계별 로그 projection을 만들며, `U5ProgressScreen`의 로컬 reducer가 현재 phase와 replay frame에 맞는 값만 선택한다. U3·U6과 Campaign Store에는 원정 전용 HUD나 피드백 phase를 추가하지 않는다.

**Tech Stack:** TypeScript 5, React 19, Next.js 16.3, Zustand 5, Vitest 4, Playwright 1.62, CSS fixed-canvas layout

**Spec:** [U5 전투·비전투 결과 피드백 통합 설계](../specs/2026-08-26-lattebun-u5-outcome-feedback-unification-design.md)

## Global Constraints

- 구현 브랜치는 PR #202와 PR #203이 반영된 최신 `main`에서 시작한다.
- 코드를 쓰기 전에 `node_modules/next/dist/docs/`에서 변경할 React·Next API의 현재 가이드를 읽는다.
- phase 순서는 `preReaction → immediateTrust? → consequence → stateApply? → battle? → postBattleHp? → postDialogue? → postTrust? → complete`다.
- 자동 유지 시간은 `preReaction 1,100ms`, `immediateTrust 650ms`, `consequence 1,100ms`, `stateApply 800ms`, `postBattleHp 500ms`, `postTrust 650ms`다.
- 전투 `×1 / ×2`는 feedback 유지 시간을 바꾸지 않고 `prefers-reduced-motion`도 phase 순서·시간·수동 확인을 제거하지 않는다.
- Store·RNG·전투 결과를 UI에서 재계산하지 않는다. feedback phase, replay frame, 대사 확인 여부는 Campaign Store에 저장하지 않는다.
- 최신 `TopStatusView.zeroTrust`를 포함한 상단 상태 shape를 보존하고 phase projection은 `gold`만 교체한다.
- 대표 인물 동률은 `party-formation-order.ts`의 `inFormationOrder()`를 사용한다. 제거된 `party-seat-order`를 되살리지 않는다.
- 상인 badge는 받는 피해 감소·증가, 주는 피해 증가·감소 네 방향을 실제 multiplier와 일치시킨다. multiplier `1`과 양쪽 축 동시 존재는 rules 오류다.
- `eventId`, `adviceId`, `bossRuleId`, 도움·방해 정답, multiplier 숫자와 log `recordIdentity`를 DOM에 출력하지 않는다.
- 결과 완료 전에는 카드 뒤집기와 다음 단계 CTA를 DOM에 만들지 않는다. 우측 하단 주요 CTA는 항상 하나 이하다.
- 전멸은 `원정 결과로 / ACKNOWLEDGE_OUTCOME → 기존 원정 종료 화면 → 정산으로 / COMPLETE_EXPEDITION`을 따른다.
- U3·U6에는 개인 보스 정보 footer 공간, 상인 badge와 결과 시퀀스를 추가하지 않는다.
- 커밋 제목과 본문은 모두 한글로 작성한다.

## File Structure

### Create

- `lib/domain/outcome.ts`: 일반 사건과 보스 결과가 공유하는 presentation snapshot과 trust step 타입.
- `components/game/expedition-party-status.ts`: 개인 보스 정보와 상인 효과를 U4·U5 공용 HUD View로 변환.
- `components/game/ExpeditionPartyHeader.tsx`: 파티 상태 제목과 상인 효과 badge.
- 위 파일과 같은 이름의 focused Vitest 파일.

### Replace

- `components/game/u5-combat-feedback.ts` → `components/game/u5-outcome-feedback.ts`
- `components/game/use-u5-combat-feedback.ts` → `components/game/use-u5-outcome-feedback.ts`
- `components/game/u5-combat-feedback-adapter.ts` → `components/game/u5-outcome-feedback-adapter.ts`
- 대응 테스트 파일도 같은 커밋에서 rename한다. 장기 compatibility wrapper는 남기지 않는다.

### Reuse without modification

- `components/game/party-formation-order.ts`: 대표 인물 동률과 화면 대열에 기존 `inFormationOrder()`를 그대로 사용한다.

### Modify

- `lib/domain/campaign-transition.ts`, `lib/domain/expedition.ts`, `lib/domain/index.ts`
- `lib/rules/campaign-transition.ts`, `lib/rules/boss-battle-adapter.ts`, `lib/rules/merchant.ts`
- `components/game/campaign-adapters.ts`, `components/game/u5-log.ts`, `components/game/u5-progress-model.ts`
- `components/game/CampaignScreen.tsx`, `components/game/U5ProgressScreen.tsx`, `components/game/U5NonBattlePartyScene.tsx`
- `components/game/PartyMemberCard.tsx`, `components/game/U4DungeonMapScreen.tsx`
- `app/party-card.css`, `app/u4-dungeon-map.css`, `app/u5-progress.css`
- 관련 unit·render·campaign integration·Playwright 테스트와 공식 문서 여섯 개.

---

### Task 1: 공통 결과 표시 도메인 계약

**Files:**
- Create: `lib/domain/outcome.ts`
- Create: `lib/domain/outcome.test.ts`
- Modify: `lib/domain/campaign-transition.ts`
- Modify: `lib/domain/expedition.ts`
- Modify: `lib/domain/index.ts`

**Interfaces:**
- Produces: `OutcomePresentationSnapshot`, `OutcomeTrustChangeStep`.
- Consumes: `CharacterId`, `PendingMerchantEffect`.

- [ ] **Step 1: 공유 타입 export를 요구하는 실패 테스트 작성**

```ts
import { describe, expect, it } from "vitest";
import type { OutcomePresentationSnapshot, OutcomeTrustChangeStep } from "./index";

describe("outcome presentation domain", () => {
  it("snapshot과 개별 신뢰 step을 공용 도메인에서 export한다", () => {
    const presentation = {
      preBattleHpChanges: [],
      goldChange: null,
      infoRecordCountBefore: 0,
      bossInfoAdded: [],
      merchantEffectBefore: null,
      merchantEffectAfter: null,
    } satisfies OutcomePresentationSnapshot;
    const step = {
      characterId: "member-1",
      before: 50,
      after: 42,
      reason: "검증된 신뢰 사유",
      revealPhase: "postTrust",
    } as OutcomeTrustChangeStep;
    expect(presentation.infoRecordCountBefore).toBe(0);
    expect(step.after).toBe(42);
  });
});
```

- [ ] **Step 2: 테스트가 export 부재로 실패하는지 확인**

Run: `pnpm exec vitest run lib/domain/outcome.test.ts`

Expected: FAIL because `OutcomePresentationSnapshot` and `OutcomeTrustChangeStep` are not exported.

- [ ] **Step 3: 공유 타입과 결과 소유권 구현**

```ts
export interface OutcomeTrustChangeStep {
  readonly characterId: CharacterId;
  readonly before: number;
  readonly after: number;
  readonly reason: string;
  readonly revealPhase: "immediateTrust" | "postTrust";
}

export interface OutcomePresentationSnapshot {
  readonly preBattleHpChanges: readonly {
    readonly characterId: CharacterId;
    readonly before: number;
    readonly after: number;
  }[];
  readonly goldChange: { readonly before: number; readonly after: number } | null;
  readonly infoRecordCountBefore: number;
  readonly bossInfoAdded: readonly {
    readonly characterId: CharacterId;
    readonly reaction: "accepted" | "suspected";
  }[];
  readonly merchantEffectBefore: PendingMerchantEffect | null;
  readonly merchantEffectAfter: PendingMerchantEffect | null;
}
```

Add `presentation: OutcomePresentationSnapshot` to `ExpeditionOutcome` and `BossResult`. Change both `ExpeditionOutcome.trustChanges` and `ExpeditionRecord.trustChanges` to `readonly OutcomeTrustChangeStep[]`. Export the two shared types through `lib/domain/index.ts`; do not import `campaign-transition.ts` from `expedition.ts`.

- [ ] **Step 4: 도메인 테스트와 typecheck 실행**

Run: `pnpm exec vitest run lib/domain/outcome.test.ts lib/domain/advice.test.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: 도메인 계약 커밋**

```bash
git add lib/domain/outcome.ts lib/domain/outcome.test.ts lib/domain/campaign-transition.ts lib/domain/expedition.ts lib/domain/index.ts
git commit -m "도메인: 결과 표시 스냅샷 계약을 추가한다" -m "일반 사건과 보스 결과가 공유하는 상태 전후 값과 개별 신뢰 변화 단계를 공용 타입으로 정의한다."
```

### Task 2: 상인 예약 효과 유효성 및 네 방향 표시 입력

**Files:**
- Modify: `lib/rules/merchant.ts`
- Test: `lib/rules/merchant.test.ts`

**Interfaces:**
- Consumes: `NextBattleMerchantEffect`.
- Produces: rules가 보장하는 단일 축·non-no-op 예약 효과.

- [ ] **Step 1: multiplier 1과 양쪽 축을 거부하는 실패 테스트 작성**

```ts
it.each([
  { incomingDamageMultiplier: 1 },
  { partyDamageMultiplier: 1 },
  { incomingDamageMultiplier: 0.8, partyDamageMultiplier: 1.2 },
])("표시할 실제 방향이 없는 예약 효과를 거부한다", (nextBattle) => {
  expect(() => consumePendingMerchantEffect({
    adviceId: "merchant-invalid" as ChoiceId,
    nextBattle: nextBattle as NextBattleMerchantEffect,
  })).toThrowError(RuleError);
});
```

- [ ] **Step 2: 현재 검증이 multiplier 1을 통과시켜 실패하는지 확인**

Run: `pnpm exec vitest run lib/rules/merchant.test.ts`

Expected: FAIL for the two multiplier `1` cases.

- [ ] **Step 3: `assertValidNextBattleEffect` 강화**

Keep the existing exactly-one-axis and positive finite checks, and add `values[0] === 1` to the invalid condition. Preserve `RuleError("INVALID_STATE", ...)` and include both multiplier fields in details.

- [ ] **Step 4: merchant rules와 Store 구매 회귀 실행**

Run: `pnpm exec vitest run lib/rules/merchant.test.ts lib/store/merchant-purchase.test.ts`

Expected: PASS with purchase, retention and one-time consumption behavior unchanged.

- [ ] **Step 5: 상인 검증 커밋**

```bash
git add lib/rules/merchant.ts lib/rules/merchant.test.ts
git commit -m "규칙: 무효한 상인 예약 효과를 거부한다" -m "배율 1과 양쪽 전투 축을 함께 가진 예약 효과가 표시 계층까지 도달하지 않게 검증한다."
```

### Task 3: 일반 사건 presentation과 신뢰 chain 기록

**Files:**
- Modify: `lib/rules/campaign-transition.ts`
- Test: `lib/rules/campaign-transition-expedition.test.ts`
- Test: `lib/store/merchant-purchase.test.ts`

**Interfaces:**
- Consumes: `OutcomePresentationSnapshot`, `OutcomeTrustChangeStep`, `AdviceResolution.trustChanges`.
- Produces: 모든 `pendingOutcome`의 완전한 `presentation`과 시간 순 trust steps.

- [ ] **Step 1: 비전투·상인·보스 정보·전투 회피 snapshot 실패 테스트 작성**

Add helper-driven cases to the existing expedition transition suite and assert:

```ts
expect(outcome.presentation.goldChange).toEqual({ before: goldBefore, after: goldAfter });
expect(outcome.presentation.preBattleHpChanges).toEqual(expectedImmediateHp);
expect(outcome.presentation.infoRecordCountBefore).toBe(infoCountBefore);
expect(outcome.presentation.bossInfoAdded).toEqual(expectedBossInfoAdded);
expect(outcome.presentation.merchantEffectBefore).toEqual(effectBefore);
expect(outcome.presentation.merchantEffectAfter).toEqual(effectAfter);
expect(outcome.trustChanges.map((step) => step.reason)).toEqual(expectedReasons);
expect(outcome.trustChanges.every((step) => step.revealPhase === expectedPhase)).toBe(true);
```

Include one avoided monster battle with `merchantEffectBefore === merchantEffectAfter`, and one exposed harm case with two continuous `immediateTrust` steps.

- [ ] **Step 2: 새 필드가 생성되지 않아 실패하는지 확인**

Run: `pnpm exec vitest run lib/rules/campaign-transition-expedition.test.ts lib/store/merchant-purchase.test.ts`

Expected: FAIL on missing presentation and aggregate-only trust changes.

- [ ] **Step 3: 일반 사건 snapshot과 step builder 구현**

Add a private pure builder with this contract:

```ts
function trustStepsFor(input: {
  readonly membersBefore: readonly Character[];
  readonly changes: readonly TrustChange[];
  readonly immediateCharacterIds: ReadonlySet<CharacterId>;
}): readonly OutcomeTrustChangeStep[];
```

Track each member's current trust through the ordered `TrustChange[]`; emit `before`, clamped `after`, original `reason`, and explicit phase. Build `preBattleHpChanges` by comparing `active.partyMembers` to `membersAfterPurchase`, before battle results are overlaid. Build `goldChange`, `infoRecordCountBefore`, `bossInfoAdded`, and merchant before/after directly from rule inputs and outputs. Use the same trust step array in `pendingOutcome` and the appended `ExpeditionRecord`.

- [ ] **Step 4: event rules·Store·determinism 회귀 실행**

Run: `pnpm exec vitest run lib/rules/campaign-transition-expedition.test.ts lib/store/merchant-purchase.test.ts lib/store/campaign-reproducibility.test.ts`

Expected: PASS and identical seeds produce identical snapshots and reasons.

- [ ] **Step 5: 일반 사건 기록 커밋**

```bash
git add lib/rules/campaign-transition.ts lib/rules/campaign-transition-expedition.test.ts lib/store/merchant-purchase.test.ts
git commit -m "규칙: 일반 사건 표시 스냅샷을 기록한다" -m "골드와 전투 전 HP, 보스 정보, 상인 효과 전후 및 개별 신뢰 사유를 결과 확정 시점에 보존한다."
```

### Task 4: 보스 결과 presentation과 HP·신뢰 연속성

**Files:**
- Modify: `lib/rules/boss-battle-adapter.ts`
- Modify: `lib/rules/campaign-transition.ts`
- Test: `lib/rules/boss-battle-adapter.test.ts`
- Test: `lib/rules/campaign-transition-expedition.test.ts`

**Interfaces:**
- Consumes: boss input `infoRecords`, `pendingMerchantEffect`, resolved battle and trust changes.
- Produces: `BossResult.presentation` and `postTrust` steps in the final `ExpeditionRecord`.

- [ ] **Step 1: 보스 snapshot과 chain 실패 테스트 작성**

```ts
expect(result.bossResult.presentation).toEqual({
  preBattleHpChanges: [],
  goldChange: null,
  infoRecordCountBefore: input.infoRecords.length,
  bossInfoAdded: [],
  merchantEffectBefore: input.pendingMerchantEffect,
  merchantEffectAfter: null,
});
expect(record.trustChanges.every((step) => step.revealPhase === "postTrust")).toBe(true);
expect(record.damage.map((change) => change.after)).toEqual(
  result.bossResult.battle.party.map((member) => member.hp),
);
```

- [ ] **Step 2: 보스 결과의 presentation 부재로 실패하는지 확인**

Run: `pnpm exec vitest run lib/rules/boss-battle-adapter.test.ts lib/rules/campaign-transition-expedition.test.ts`

Expected: FAIL on `bossResult.presentation` and trust step shape.

- [ ] **Step 3: 보스 snapshot과 postTrust step 구현**

Build the snapshot from `resolveBossBattle` input and consumed merchant output; do not derive the previous merchant effect from the final expedition. In `transitionEnterBoss`, convert ordered boss trust changes to continuous `postTrust` steps using the same helper contract as Task 3, then store them in `bossRecord`.

- [ ] **Step 4: 보스 rules와 campaign history 회귀 실행**

Run: `pnpm exec vitest run lib/rules/boss-battle-adapter.test.ts lib/rules/campaign-transition-expedition.test.ts lib/rules/campaign-history.test.ts lib/rules/trust-history.test.ts`

Expected: PASS with boss applications, cues, verification and campaign history unchanged.

- [ ] **Step 5: 보스 snapshot 커밋**

```bash
git add lib/rules/boss-battle-adapter.ts lib/rules/boss-battle-adapter.test.ts lib/rules/campaign-transition.ts lib/rules/campaign-transition-expedition.test.ts
git commit -m "규칙: 보스 결과 표시 경계를 보존한다" -m "보스전 전후 상인 효과와 최종 HP, 사후 신뢰 사유를 범용 결과 계약에 연결한다."
```

### Task 5: 전투 상태 머신을 범용 결과 상태 머신으로 이전

**Files:**
- Rename: `components/game/u5-combat-feedback.ts` → `components/game/u5-outcome-feedback.ts`
- Rename: `components/game/u5-combat-feedback.test.ts` → `components/game/u5-outcome-feedback.test.ts`
- Rename: `components/game/use-u5-combat-feedback.ts` → `components/game/use-u5-outcome-feedback.ts`
- Rename: `components/game/use-u5-combat-feedback.test.ts` → `components/game/use-u5-outcome-feedback.test.ts`

**Interfaces:**
- Produces: `U5OutcomeFeedbackPhase`, `OutcomeFeedbackEvent`, `phasesForOutcome()`, `reduceOutcomeFeedback()`, `useU5OutcomeFeedback()`.
- Consumes: 범용 adapter가 제공할 phase 필요 조건과 안정적 signature.

- [ ] **Step 1: 비전투·보스·잘못된 event를 포함하도록 기존 테스트 rename 및 확장**

```ts
it.each([
  [baseView(), ["preReaction", "consequence", "complete"]],
  [baseView({ hasStateApply: true }), ["preReaction", "consequence", "stateApply", "complete"]],
  [baseView({ immediateTrust: trustGroup }), ["preReaction", "immediateTrust", "consequence", "complete"]],
  [baseView({ battle: replay }), ["preReaction", "consequence", "battle", "postBattleHp", "complete"]],
  [bossView({ battle: replay }), ["battle", "postBattleHp", "complete"]],
])("필요한 phase만 만든다", (view, expected) => {
  expect(phasesForOutcome(view)).toEqual(expected);
});

expect(reduceOutcomeFeedback(view, "battle", "AUTO_ADVANCE")).toBe("battle");
expect(reduceOutcomeFeedback(view, "consequence", "BATTLE_COMPLETE")).toBe("consequence");
```

Add a post-trust case that always creates `postDialogue → postTrust`, and a no-trust case that creates neither phase.

- [ ] **Step 2: 범용 이름과 비전투 조건이 없어 실패하는지 확인**

Run: `pnpm exec vitest run components/game/u5-outcome-feedback.test.ts components/game/use-u5-outcome-feedback.test.ts`

Expected: FAIL because the renamed exports and non-combat phase builder do not exist.

- [ ] **Step 3: 순수 phase builder와 reducer 구현**

```ts
export type U5OutcomeFeedbackPhase =
  | "preReaction" | "immediateTrust" | "consequence" | "stateApply"
  | "battle" | "postBattleHp" | "postDialogue" | "postTrust" | "complete";

export type OutcomeFeedbackEvent =
  | "AUTO_ADVANCE"
  | "BATTLE_COMPLETE"
  | "ACKNOWLEDGE_REACTION";
```

Generate only phases backed by data. Accept `AUTO_ADVANCE` only in timed phases, `BATTLE_COMPLETE` only in `battle`, and `ACKNOWLEDGE_REACTION` only in `postDialogue`; return the unchanged phase for invalid events. Preserve the approved durations in a single exhaustive phase-duration map.

- [ ] **Step 4: hook timer·signature·reduced-motion 계약 이전**

Rename the hook and keep phase local to the component. Reset to the first phase when the signature changes, clear the previous timeout before installing the new one, and clear on unmount. Assert with fake timers that an old signature cannot advance a new result and that reduced motion does not shorten durations or bypass `ACKNOWLEDGE_REACTION`.

- [ ] **Step 5: 상태 머신 focused tests 실행**

Run: `pnpm exec vitest run components/game/u5-outcome-feedback.test.ts components/game/use-u5-outcome-feedback.test.ts`

Expected: PASS for combat, non-combat, boss, invalid event, timer cleanup and reduced-motion cases.

- [ ] **Step 6: 범용 상태 머신 커밋**

```bash
git add components/game/u5-outcome-feedback.ts components/game/u5-outcome-feedback.test.ts components/game/use-u5-outcome-feedback.ts components/game/use-u5-outcome-feedback.test.ts
git commit -m "화면: 결과 피드백 상태 머신을 범용화한다" -m "기존 전투 순서를 보존하면서 비전투와 보스 결과가 필요한 단계만 통과하도록 reducer와 타이머를 일반화한다."
```

### Task 6: 일반 사건·보스 결과 범용 adapter

**Files:**
- Rename: `components/game/u5-combat-feedback-adapter.ts` → `components/game/u5-outcome-feedback-adapter.ts`
- Rename: `components/game/u5-combat-feedback-adapter.test.ts` → `components/game/u5-outcome-feedback-adapter.test.ts`
- Reuse: `components/game/party-formation-order.ts`

**Interfaces:**
- Produces: `U5OutcomeFeedbackView`, `outcomeFeedbackFor()`.
- Consumes: event or boss outcome, presentation snapshot, trust steps, replay and `inFormationOrder()`.

- [ ] **Step 1: 모든 outcome과 대표 인물 선택 실패 테스트 작성**

Test rest, merchant, boss-info, avoided-monster, normal combat and boss outcomes. Assert that every valid pending outcome produces a View, the largest absolute phase-group trust delta wins, and ties follow `inFormationOrder()` rather than input or identifier order.

```ts
expect(outcomeFeedbackFor(nonCombatInput)).toMatchObject({
  hasBattle: false,
  consequence: expect.any(Object),
});
expect(outcomeFeedbackFor(avoidedMonsterInput).battle).toBeNull();
expect(outcomeFeedbackFor(tiedInput).postReaction?.characterId).toBe(formation[0].id);
```

Also assert `eventId`, `adviceId`, `bossRuleId` and helpful/harmful keys are absent from display lines and accessibility copy. Raw merchant multipliers remain adapter inputs for the shared badge mapper, but are never formatted into player-facing copy.

- [ ] **Step 2: 현재 adapter가 비전투에서 null을 반환해 실패하는지 확인**

Run: `pnpm exec vitest run components/game/u5-outcome-feedback-adapter.test.ts`

Expected: FAIL for all non-combat outcome cases and the new trust-step shape.

- [ ] **Step 3: 범용 View와 검증 구현**

Define the View with explicit optional beats, sanitized state projections, `immediateTrust`, `postTrust`, `battle`, `wiped`, and caller-owned completion policy. Build its signature from `expeditionId`, node-or-boss identity, result identity, records length, and a stable serialization of the domain presentation boundary. Do not include localized copy in identity or expose the raw snapshot as DOM attributes.

Validate presentation presence, HP continuity, gold after-value, info-record boundary/additions, merchant consumption, replay participants and trust chains. Throw the existing adapter invariant error instead of returning the legacy three-section fallback.

- [ ] **Step 4: formation helper 재사용 확인**

Import `inFormationOrder()` directly for candidate ordering. Add no seeded seat helper and make no behavioral changes inside `party-formation-order.ts` unless an export needed by the adapter is missing.

- [ ] **Step 5: adapter·formation 회귀 실행**

Run: `pnpm exec vitest run components/game/u5-outcome-feedback-adapter.test.ts components/game/party-formation-order.test.ts components/game/u5-battle-replay.test.ts`

Expected: PASS; all valid outcomes receive one View and existing battle replay data remains unchanged.

- [ ] **Step 6: 범용 adapter 커밋**

```bash
git add components/game/u5-outcome-feedback-adapter.ts components/game/u5-outcome-feedback-adapter.test.ts
git commit -m "어댑터: 모든 원정 결과를 피드백 뷰로 변환한다" -m "비전투와 보스 결과를 포함하고 공용 파티 대열로 대표 인물을 고르며 표시 경계 불일치를 명시적으로 거부한다."
```

### Task 7: U4·U5 공용 원정 파티 HUD

**Files:**
- Create: `components/game/expedition-party-status.ts`
- Create: `components/game/expedition-party-status.test.ts`
- Create: `components/game/ExpeditionPartyHeader.tsx`
- Create: `components/game/ExpeditionPartyHeader.test.tsx`
- Modify: `components/game/PartyMemberCard.tsx`
- Modify: `components/game/PartyMemberCard.test.tsx`
- Modify: `components/game/U4DungeonMapScreen.tsx`
- Modify: `components/game/U4DungeonMapScreen.test.tsx`
- Modify: `app/party-card.css`
- Modify: `app/u4-dungeon-map.css`
- Modify: `app/u5-progress.css`

**Interfaces:**
- Produces: `BossInfoIconState`, `ExpeditionMerchantBadgeView`, `bossInfoStatesFor()`, `merchantBadgeFor()`, `ExpeditionPartyHeader`.
- Consumes: visible `InfoRecord[]`, `PendingMerchantEffect`, phase-specific activation state.

- [ ] **Step 1: 개인 정보와 네 방향 badge mapper 실패 테스트 작성**

```ts
expect(bossInfoStatesFor(records, memberId)).toEqual(["accepted", "suspected"]);
expect(merchantBadgeFor({ incomingDamageMultiplier: 0.8 }, "reserved").label)
  .toBe("다음 전투 · 받는 피해 감소");
expect(merchantBadgeFor({ incomingDamageMultiplier: 1.2 }, "active").label)
  .toBe("효과 발동 · 받는 피해 증가");
expect(merchantBadgeFor({ partyDamageMultiplier: 1.2 }, "reserved").label)
  .toBe("다음 전투 · 주는 피해 증가");
expect(merchantBadgeFor({ partyDamageMultiplier: 0.8 }, "reserved").label)
  .toBe("다음 전투 · 주는 피해 감소");
```

Reject exposed/neutral reactions, duplicate `eventId + adviceId + characterId`, multiplier `1`, and both axes. Confirm ordinary clue records never become boss icons.

- [ ] **Step 2: mapper 부재로 실패하는지 확인**

Run: `pnpm exec vitest run components/game/expedition-party-status.test.ts`

Expected: FAIL because the shared mapper does not exist.

- [ ] **Step 3: 하나의 공용 순수 mapper 구현**

Keep identifiers only while validating and grouping; return presentation-only icon states and badge label/icon-axis. The U4 model and campaign adapter must call this mapper rather than implement their own `InfoRecord` or multiplier switches.

- [ ] **Step 4: 공용 header와 카드 footer render 실패 테스트 작성**

Assert one heading row, accessible merchant text, decorative icon behavior, accepted/suspected asset paths, and one card-level summary such as `수용한 보스 정보 2개, 의심 중인 보스 정보 1개`. Verify raw identifiers and multiplier values are absent from rendered HTML. Render a U3 card with `bossInfoStates` omitted and compare its DOM contract to the existing baseline.

- [ ] **Step 5: 공용 header·optional footer와 고정 layout 구현**

Use the two approved 128×128 PNG assets at 16–18 CSS px. Keep U3 markup unchanged when `bossInfoStates` is absent; reserve footer height only in U4/U5 scope. Give the header a fixed row height, bounded badge width and truncation, and keep card outer width/height stable when icons appear or wrap.

- [ ] **Step 6: HUD unit·render·fixed-canvas tests 실행**

Run: `pnpm exec vitest run components/game/expedition-party-status.test.ts components/game/ExpeditionPartyHeader.test.tsx components/game/PartyMemberCard.test.tsx components/game/U4DungeonMapScreen.test.tsx components/game/U5FixedCanvas.test.ts components/game/OutOfCampaignScreenConsistency.test.ts`

Expected: PASS with U4/U5 HUD additions and no U3/U6 DOM regression.

- [ ] **Step 7: 공용 HUD 커밋**

```bash
git add components/game/expedition-party-status.ts components/game/expedition-party-status.test.ts components/game/ExpeditionPartyHeader.tsx components/game/ExpeditionPartyHeader.test.tsx components/game/PartyMemberCard.tsx components/game/PartyMemberCard.test.tsx components/game/U4DungeonMapScreen.tsx components/game/U4DungeonMapScreen.test.tsx app/party-card.css app/u4-dungeon-map.css app/u5-progress.css
git commit -m "화면: 원정 파티 정보와 상인 효과를 함께 표시한다" -m "U4와 U5가 개인 보스 정보 아이콘과 네 방향 상인 예약 배지를 같은 순수 매퍼와 고정 레이아웃으로 공유한다."
```

### Task 8: phase·전투 frame 기반 진행 기록 공개

**Files:**
- Modify: `components/game/u5-log.ts`
- Modify: `components/game/u5-log-filter.test.ts`
- Modify: `components/game/campaign-adapters.ts`
- Modify: `components/game/campaign-adapters.test.ts`

**Interfaces:**
- Produces: `U5OutcomeLogRevealPhase`, `U5OutcomeLogEntry`, `U5OutcomeLogProjection`, `visibleOutcomeLogEntries()`.
- Consumes: current result signature, current feedback phase, replay frame index and existing `U5LogEntry` filters.

- [ ] **Step 1: 미래 정보 누출 실패 테스트 작성**

Build one projection with previous entries plus selection, reaction, consequence, battle action, final HP and post-trust entries. For every phase and two battle frame indices, assert the exact visible labels. Apply every existing log filter after the gate and assert none can reveal an unavailable entry.

```ts
const visible = visibleOutcomeLogEntries(projection, "battle", 1);
expect(visible).toContainEqual(previousEntry);
expect(visible).toContainEqual(selectionEntry);
expect(visible).toContainEqual(firstBattleAction);
expect(visible).not.toContainEqual(thirdBattleAction);
expect(visible).not.toContainEqual(finalBattleSummary);
expect(visible).not.toContainEqual(postTrustEntry);
```

- [ ] **Step 2: 평면 `logFor()`가 전체 기록을 공개해 실패하는지 확인**

Run: `pnpm exec vitest run components/game/u5-log-filter.test.ts components/game/campaign-adapters.test.ts`

Expected: FAIL because entries lack explicit record, phase and frame metadata.

- [ ] **Step 3: 명시적 log projection과 순수 gate 구현**

Create exactly the Spec interfaces. Split fully completed previous records from the current record by identity in `campaign-adapters.ts`. Assign reveal metadata when adapting domain facts; never parse the Korean label. Give battle actions their replay action/frame boundary and defer win/loss and total HP summaries to `postBattleHp`.

In `U5ProgressScreen`, filtering order must be `visibleOutcomeLogEntries(...)` first and the existing kind filter second. Keep `recordIdentity` internal and pass only `entry` objects to render.

- [ ] **Step 4: log adapter·filter 회귀 실행**

Run: `pnpm exec vitest run components/game/u5-log-filter.test.ts components/game/campaign-adapters.test.ts components/game/u5-battle-replay.test.ts`

Expected: PASS; previous records stay visible and current future entries remain unreachable under every filter.

- [ ] **Step 5: 로그 공개 경계 커밋**

```bash
git add components/game/u5-log.ts components/game/u5-log-filter.test.ts components/game/campaign-adapters.ts components/game/campaign-adapters.test.ts
git commit -m "화면: 진행 기록을 결과 단계에 맞춰 공개한다" -m "현재 기록에 명시적 단계와 전투 프레임 경계를 부여하고 필터보다 먼저 미래 항목을 제거한다."
```

### Task 9: U5 범용 결과 흐름과 단계별 값 projection

**Files:**
- Modify: `components/game/U5ProgressScreen.tsx`
- Modify: `components/game/U5ProgressScreen.test.tsx`
- Modify: `components/game/U5NonBattlePartyScene.tsx`
- Modify: `components/game/U5NonBattlePartyScene.test.tsx`
- Modify: `components/game/u5-progress-model.ts`
- Modify: `components/game/U5BattleScene.tsx`
- Modify: `components/game/U5BattleScene.test.tsx`
- Modify: `app/u5-progress.css`

**Interfaces:**
- Consumes: `U5OutcomeFeedbackView`, local phase, replay frame and explicit completion policy.
- Produces: phase-projected top status, cards, scene ribbon, log and the single current CTA.

- [ ] **Step 1: 구형 fallback과 조기 값 공개를 잡는 render 실패 테스트 작성**

Use fake timers to traverse non-combat, merchant, boss-info, exposed-trust, avoided-combat and combat Views. Before each reveal phase, assert the future gold, HP, trust, icon, merchant badge, log entry, card-flip control and completion CTA are absent. At `stateApply`, assert gold/HP/info/effect appear together in their own UI locations.

Also assert the latest status shape retains `zeroTrust` while only `gold` is projected.

- [ ] **Step 2: 현재 `Outcome` fallback과 최종 Store 값 때문에 실패하는지 확인**

Run: `pnpm exec vitest run components/game/U5ProgressScreen.test.tsx components/game/U5NonBattlePartyScene.test.tsx`

Expected: FAIL for non-combat sequencing, phase-projected values and pre-complete controls.

- [ ] **Step 3: 범용 hook과 phase projection 연결**

Remove the legacy three-section `Outcome` component and require a valid feedback View whenever `pendingOutcome` exists. Select gold from `presentation.goldChange` without rebuilding `TopStatusView`; spread the incoming status including `zeroTrust` and replace only `gold`. Project member HP, trust, info records and merchant badge from stored before/after boundaries and the current replay frame.

Keep card flips out of the DOM until `complete`. During replay after completion, hold all non-battle values at final state and rewind only the central battle scene/frame.

- [ ] **Step 4: 비전투 대사 ribbon과 접근성 구현**

Render the representative name and one line only in `preReaction` and `postDialogue`. Keep the party artwork wrapper decorative, but place the ribbon outside an `aria-hidden` ancestor and announce each new line once through `aria-live="polite"`. Reserve ribbon space so the scene and console heights do not move.

- [ ] **Step 5: CTA·skip·replay 회귀 테스트 작성 및 통과**

Assert automatic phases have no primary CTA, `postDialogue` has only `반응 확인`, complete gets only the caller label, and battle gets only `전투 건너뛰기`. Confirm skip enters `postBattleHp`, does not auto-acknowledge, and repeated clicks do not overrun. Confirm replay preserves final cards/status and returns to the original completion CTA.

Run: `pnpm exec vitest run components/game/U5ProgressScreen.test.tsx components/game/U5NonBattlePartyScene.test.tsx components/game/U5BattleScene.test.tsx components/game/U5FixedCanvas.test.ts`

Expected: PASS for every phase, no legacy fallback, a single CTA and synchronized HP.

- [ ] **Step 6: U5 통합 커밋**

```bash
git add components/game/U5ProgressScreen.tsx components/game/U5ProgressScreen.test.tsx components/game/U5NonBattlePartyScene.tsx components/game/U5NonBattlePartyScene.test.tsx components/game/u5-progress-model.ts components/game/U5BattleScene.tsx components/game/U5BattleScene.test.tsx app/u5-progress.css
git commit -m "화면: U5 결과를 단계별로 공개한다" -m "구형 결과 보고서를 제거하고 골드와 파티 상태, 대사, 로그와 단일 CTA를 범용 피드백 단계에 맞춰 투영한다."
```

### Task 10: Campaign 연결과 전멸 2단계 전이

**Files:**
- Modify: `components/game/CampaignScreen.tsx`
- Modify: `components/game/campaign-render.test.tsx`
- Modify: `components/game/campaign-adapters.ts`
- Modify: `components/game/campaign-adapters.test.ts`
- Test: `components/game/U4DungeonMapScreen.test.tsx`
- Test: `lib/rules/campaign-transition-expedition.test.ts`

**Interfaces:**
- Produces: every-pending-outcome feedback input, U4/U5 shared expedition HUD input and explicit CTA policy.
- Consumes: `ACKNOWLEDGE_OUTCOME`, existing ending screen and `COMPLETE_EXPEDITION`.

- [ ] **Step 1: 실제 Campaign 경계 실패 테스트 작성**

Render Campaign states for normal event, avoided combat, wipe and boss completion. Assert `CampaignScreen` always passes feedback for a pending outcome. For a wipe, assert the U5 button is exactly `원정 결과로`, dispatches only `ACKNOWLEDGE_OUTCOME`, immediately renders the existing expedition-ending screen, never renders map node selection, and only that screen's `정산으로` dispatches `COMPLETE_EXPEDITION`.

- [ ] **Step 2: 기존 wipe CTA가 지도 복귀 정책을 사용해 실패하는지 확인**

Run: `pnpm exec vitest run components/game/campaign-render.test.tsx components/game/campaign-adapters.test.ts lib/rules/campaign-transition-expedition.test.ts`

Expected: FAIL for non-combat feedback creation and the wipe completion label/policy.

- [ ] **Step 3: Campaign 호출부 정책과 공용 HUD 연결**

Compute completion labels and callbacks from typed campaign state, not from displayed text. Use `원정 결과로 / ACKNOWLEDGE_OUTCOME` for wiped outcomes, preserve `지도로 돌아간다` for live expeditions, and preserve `정산으로` for boss completion. Feed U4 and U5 the same final/phase-visible info-record and merchant-badge View. Keep Store transitions unchanged unless a test proves the existing transition emits an intermediate map frame.

- [ ] **Step 4: Campaign·U4·전투 회귀 실행**

Run: `pnpm exec vitest run components/game/campaign-render.test.tsx components/game/campaign-adapters.test.ts components/game/U4DungeonMapScreen.test.tsx components/game/U5ProgressScreen.test.tsx lib/rules/campaign-transition-expedition.test.ts`

Expected: PASS with no map frame after wipe, and normal/boss skip, replay and completion routes unchanged.

- [ ] **Step 5: Campaign 연결 커밋**

```bash
git add components/game/CampaignScreen.tsx components/game/campaign-render.test.tsx components/game/campaign-adapters.ts components/game/campaign-adapters.test.ts components/game/U4DungeonMapScreen.test.tsx lib/rules/campaign-transition-expedition.test.ts
git commit -m "캠페인: 모든 원정 결과를 범용 흐름에 연결한다" -m "비전투 결과와 공용 HUD를 연결하고 전멸을 결과 확인 뒤 기존 정산 화면으로 보내는 두 단계 전이를 고정한다."
```

### Task 11: 브라우저 회귀·공식 문서·전체 검증

**Files:**
- Create: `e2e/u5-outcome-feedback.spec.ts`
- Modify: `e2e/campaign-smoke.spec.ts`
- Modify: `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`
- Modify: `docs/systems/INFORMATION_AND_DECEPTION.md`
- Modify: `docs/experience/SCREEN_LAYOUT.md`
- Modify: `docs/experience/ONBOARDING_AND_INTERFACE.md`
- Modify: `docs/experience/UI_IMPLEMENTATION_GUIDE.md`
- Modify: `docs/README.md`

- [ ] **Step 1: 실제 `/campaign` E2E 작성**

Drive deterministic campaigns through rest/special, merchant, boss-info, avoided monster, normal battle, boss battle and wipe outcomes. Assert the approved phase order, no legacy three-section report, accepted/suspected personal ownership, exposed omission, four merchant directions, actual-battle-only consumption, replay/skip behavior and log-filter containment.

Run the layout assertions at `1920×1080`, `2560×1440`, `1440×900` and `1280×1024`; require no overlap, clipping, unexpected scroll, card-height movement, image distortion or console error.

- [ ] **Step 2: 완성된 통합 경로에서 새 E2E 실행**

Run: `pnpm exec playwright test e2e/u5-outcome-feedback.spec.ts e2e/campaign-smoke.spec.ts`

Expected: PASS after Tasks 7–10, at all four viewports. A failure must be fixed in the owning task rather than weakening selectors or skipping the scenario.

- [ ] **Step 3: 공식 문서 여섯 개를 최종 계약으로 갱신**

Document the phase order and wipe CTA in the event/boss guide, individual accepted/suspected information ownership in the deception guide, U4/U5 footer/header and fixed-canvas constraints in the three experience guides, and add/update all links in `docs/README.md`. Do not duplicate the Spec verbatim; keep each rule in its owning official document.

- [ ] **Step 4: focused 및 전체 unit 검증**

Run:

```bash
pnpm exec vitest run components/game lib/domain lib/rules lib/store
pnpm exec vitest run
pnpm typecheck
pnpm lint
pnpm build
```

Expected: every command exits 0 with no snapshot, type, lint or build warning introduced by this feature.

- [ ] **Step 5: 브라우저·결정성·문서·diff 검증**

Run:

```bash
pnpm exec playwright test
pnpm exec vitest run lib/store/campaign-reproducibility.test.ts lib/rules/campaign-history.test.ts lib/rules/trust-history.test.ts
pnpm exec vitest run docs/DOCUMENT_LINKS.test.ts docs/DOCUMENT_TERMINOLOGY.test.ts
git diff --check
git status --short
```

Expected: all tests pass, identical seeds reproduce snapshots and trust reasons, documentation links/terms are valid, the diff has no whitespace errors, and only planned files remain changed.

- [ ] **Step 6: 구현·문서 최종 커밋**

```bash
git add e2e/u5-outcome-feedback.spec.ts e2e/campaign-smoke.spec.ts docs/systems/DUNGEON_EVENTS_AND_BOSSES.md docs/systems/INFORMATION_AND_DECEPTION.md docs/experience/SCREEN_LAYOUT.md docs/experience/ONBOARDING_AND_INTERFACE.md docs/experience/UI_IMPLEMENTATION_GUIDE.md docs/README.md
git commit -m "문서: U5 결과 피드백 운영 계약을 반영한다" -m "브라우저 회귀 시나리오와 공식 시스템·화면 문서를 범용 결과 공개 순서와 원정 HUD, 전멸 전이에 맞춘다."
```

## Spec Coverage

| Spec 계약 | Plan task |
| --- | --- |
| presentation snapshot, HP 연속성, 개별 trust chain | 1, 3, 4 |
| 상인 effect no-op 거부와 네 방향 | 2, 7 |
| 범용 phase, event, timer, signature | 5, 6 |
| 대표 인물과 최신 formation order | 6 |
| 골드·HP·신뢰·정보·상인 phase projection | 7, 9 |
| 명시적 log phase·battle frame 공개 | 8, 9 |
| U4·U5 HUD, U3·U6 격리, 승인 에셋 | 7, 10 |
| 단일 CTA, skip, replay, wipe 2단계 전이 | 9, 10 |
| 네 viewport E2E, 결정성, 공식 문서 | 11 |
