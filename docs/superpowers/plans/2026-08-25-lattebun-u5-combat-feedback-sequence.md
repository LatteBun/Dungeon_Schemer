# U5 전투 피드백 시퀀스 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 일반전과 보스전에서 결과를 인과 순서대로 공개하고, 확인한 HP·신뢰 변화량을 같은 크기의 우측 파티 카드에 유지하며 결과 단계와 다시보기에서는 최종 HP를 보존한다.

**Architecture:** 규칙 결과를 바꾸지 않는 순수 `U5CombatFeedbackView` adapter와 표시 전용 phase reducer를 사용한다. `U5ProgressScreen`은 최초 전투 중에만 같은 replay frame을 장면과 우측 카드 HP에 투영하고, 전투 이후에는 replay participant의 `finalHp`를 party view보다 우선하며 완료 뒤 다시보기에서는 장면만 frame을 소비하게 한다. `PartyMemberCard`는 모든 카드에 한 줄 높이의 결과 슬롯을 기본으로 두고, 사후 확인 뒤 이번 결과의 0이 아닌 HP·신뢰 변화량만 그 슬롯에 지속 표시한다.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript, Framer Motion 13, Zustand 5, Vitest 4, Playwright

**Spec:** `docs/superpowers/specs/2026-08-25-lattebun-u5-combat-feedback-sequence-design.md`

**작성 도구:** Codex

## Global Constraints

- 일반전과 보스전은 동일한 `U5CombatFeedbackView`와 phase 계약을 사용한다. 전투 종류별 별도 UI 흐름을 만들지 않는다.
- 공개 순서는 `카드 선택 → 핵심 반응 → 사건 결과 → 전투 → HP 정리 → 사후 대사 → 신뢰 변화 → 다음 단계`다. 노출된 거짓말만 전투 전 즉시 신뢰 단계를 허용한다.
- 전투 건너뛰기는 battle frame만 complete로 이동시킨다. `postBattleHp`, `postBattleDialogue`, `postBattleTrust`는 생략하지 않는다.
- 자동 beat 시간은 핵심 반응 1100ms, 사건 결과 1100ms, 즉시/사후 신뢰 강조 650ms, 사후 HP 강조 500ms다. 사후 대사는 `반응 확인` 클릭 전까지 유지한다.
- 최초 battle playback의 현재 frame 하나를 전투 장면과 우측 파티 카드가 함께 소비한다. HP가 0이 되는 frame에서 카드의 전투 불능 표시도 동시에 바뀐다. 완료 뒤 다시보기에서는 우측 카드가 frame을 소비하지 않는다.
- battle 이후 우측 카드 HP는 같은 id의 replay participant `finalHp`를 `progress.party[].hp`보다 우선한다. participant가 없을 때만 party view 값을 fallback으로 쓴다.
- 사후 대사 확인 전에는 우측 카드 신뢰가 이전 값이다. 확인 뒤 trust phase에서만 최종값과 증감 effect를 표시한다.
- 좌측 하단은 현재 beat 하나만 표시한다. 전체 반응·결과·수치 세 묶음을 동시에 노출하지 않는다.
- HP·신뢰 수치 변화 effect는 우측 카드에 둔다. 전체 이력은 해당 phase가 지난 뒤 로그와 카드 뒷면에서만 공개한다.
- U5의 모든 파티 카드는 변화량 badge 한 줄의 최소 높이를 기본으로 확보한다. 변화량이 0인 항목은 output과 장식을 만들지 않지만 빈 결과 슬롯은 유지한다. U3·U4는 이 슬롯을 요청하지 않는다.
- 핵심 인물은 spec의 stable seat order와 절댓값 tie-break 규칙으로 정한다. 내부 kind/key 값은 DOM text, accessible name, `data-*`에 출력하지 않는다.
- `accepted`, `suspected`, `exposed`, `adviceHelped`, `adviceHarmed`, `suspicionWasCorrect`, `suspicionWasCostly` 문구는 spec에 승인된 고정 한국어 문구를 그대로 사용한다. 성격별 문구나 새 에셋을 추가하지 않는다.
- replay control은 전체 feedback sequence가 complete일 때만 보인다. 다시 보기는 중앙 장면만 되감고 우측 카드의 최종 HP·신뢰·변화량을 유지하며 대사·신뢰 phase를 반복하지 않는다.
- 전투 `×1 / ×2`는 frame과 장면 motion에만 적용하고 feedback beat timer 및 우측 카드의 완료 결과에는 연결하지 않는다.
- BattleEngine, E2/E3/E4 판정, RNG 소비, damage·trust 계산, Store·저장 데이터 형식은 변경하지 않는다.
- 기존 비전투 `Outcome` 표시는 유지한다. 인접한 `U5 콘솔 상황 가독성` spec이 먼저 구현되면 `data-testid="u5-situation"`와 `.u5-situation-panel` 구조를 보존한다.
- 1920×1080 고정 캔버스, 60:40 화면 분할, 좌측 40:60 내부 분할, `rem/cqw/cqh` 단위를 유지한다. 새 `vw`, `vh`, 미디어 쿼리를 추가하지 않는다.
- reduced motion은 CSS motion duration만 제거한다. beat 체류 시간과 `반응 확인`은 유지한다.
- 현재 Next.js의 `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`와 `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md` 계약을 따른다. 순수 model/adapter에 `use client`를 붙이지 않는다.
- `.pnpm-store/`와 `public/assets/u6/**/ASSET_MANIFEST.json`, `README.txt`는 사용자 소유의 별도 변경이므로 stage하거나 수정하지 않는다.
- 커밋 제목과 본문은 모두 한국어로 작성한다.

## File Structure

- `components/game/u5-combat-feedback.ts`: feedback view, phase reducer, 공개 상태와 파티 카드 값 투영을 소유한다.
- `components/game/u5-combat-feedback.test.ts`: phase 전이, 값 공개, HP frame 동기화의 순수 계약을 고정한다.
- `components/game/u5-combat-feedback-adapter.ts`: 일반전·보스전 결과를 공통 feedback view로 변환하고 핵심 인물을 안정적으로 고른다.
- `components/game/u5-combat-feedback-adapter.test.ts`: 고정 대사, 노출 즉시 신뢰, tie-break, 일반전·보스전 공통 계약을 검증한다.
- `components/game/use-u5-combat-feedback.ts`: signature별 phase와 자동 timer, 확인 동작을 관리한다.
- `components/game/use-u5-battle-playback.ts`: pre-battle beat 동안 replay frame 진행을 멈추는 `playing` 입력을 받는다.
- `components/game/u5-log.ts`: feedback phase에 따른 로그 공개 경계를 정의한다.
- `components/game/campaign-adapters.ts`: 실제 pending outcome/record와 boss result에서 feedback와 단계별 로그를 만든다.
- `components/game/PartyMemberCard.tsx`, `app/party-card.css`: 카드의 HP·신뢰 증감 effect를 접근 가능한 output으로 표시하고 모든 카드에 같은 결과 슬롯 높이를 확보한다.
- `components/game/U5BattleScene.tsx`: 전체 시퀀스 완료 전 replay control과 완료 검증 목록을 숨긴다.
- `components/game/U5ProgressScreen.tsx`, `app/u5-progress.css`, `app/u5-battle.css`: current beat, 하단 대사 ribbon, CTA gate, 카드 값 투영을 통합한다.
- `components/game/CampaignScreen.tsx`: 실제 일반전·보스전에 feedback view를 전달한다.
- `components/game/u5-battle-preview-data.ts`, `components/game/U5BattlePreview.tsx`: 결정론적 일반전·보스전 feedback fixture를 제공한다.
- `e2e/u5-battle-preview.spec.ts`: 자연 재생, 건너뛰기, 확인, replay, reduced motion을 브라우저에서 검증한다.
- `docs/README.md`: 이 구현 plan을 문서 색인에 연결한다.

---

### Task 1: 표시 전용 feedback phase와 값 공개 계약을 만든다

**Files:**
- Create: `components/game/u5-combat-feedback.ts`
- Create: `components/game/u5-combat-feedback.test.ts`

**Interfaces:**
- Produces: `U5CombatFeedbackPhase`, `U5CombatFeedbackView`, `U5FeedbackValueChange`, `U5FeedbackLine`.
- Produces: `initialU5CombatFeedbackPhase`, `reduceU5CombatFeedbackPhase`, `u5FeedbackPhaseDurationMs`.
- Produces: `u5VisibleTrust`, `u5FeedbackIsComplete`, `u5FeedbackCanAcknowledge`.

- [ ] **Step 1: Write the failing phase-order tests**

~~~ts
const ordinary: U5CombatFeedbackView = {
  signature: "event-1:record-3",
  kind: "event",
  consequenceText: "거미들이 천장에서 쏟아진다.",
  preBattleReaction: { memberId: "brigston", memberName: "브릭스턴", text: "알겠어. 네 말대로 하지." },
  immediateTrustChanges: [],
  postBattleReaction: { memberId: "brigston", memberName: "브릭스턴", text: "네 말을 믿은 게 실수였군." },
  postBattleTrustChanges: [{ memberId: "brigston", before: 4, after: 2 }],
};

it("일반전은 반응부터 complete까지 승인된 순서로만 전이한다", () => {
  let phase = initialU5CombatFeedbackPhase(ordinary);
  expect(phase).toBe("preBattleReaction");
  phase = reduceU5CombatFeedbackPhase(ordinary, phase, "AUTO_ADVANCE");
  expect(phase).toBe("preBattleConsequence");
  phase = reduceU5CombatFeedbackPhase(ordinary, phase, "AUTO_ADVANCE");
  expect(phase).toBe("battle");
  phase = reduceU5CombatFeedbackPhase(ordinary, phase, "BATTLE_COMPLETE");
  expect(phase).toBe("postBattleHp");
  phase = reduceU5CombatFeedbackPhase(ordinary, phase, "AUTO_ADVANCE");
  expect(phase).toBe("postBattleDialogue");
  expect(reduceU5CombatFeedbackPhase(ordinary, phase, "AUTO_ADVANCE")).toBe(phase);
  phase = reduceU5CombatFeedbackPhase(ordinary, phase, "ACKNOWLEDGE_REACTION");
  expect(phase).toBe("postBattleTrust");
  expect(reduceU5CombatFeedbackPhase(ordinary, phase, "AUTO_ADVANCE")).toBe("complete");
});
~~~

Add table cases for: exposed deception inserts `preBattleImmediateTrust`; missing consequence skips it; no post trust skips dialogue/trust; boss without pre-reaction begins at `battle`; `BATTLE_COMPLETE` outside battle and `ACKNOWLEDGE_REACTION` outside dialogue are no-ops.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run components/game/u5-combat-feedback.test.ts`

Expected: FAIL because the module and phase reducer do not exist.

- [ ] **Step 3: Implement the exhaustive types and reducer**

~~~ts
export type U5CombatFeedbackPhase =
  | "preBattleReaction"
  | "preBattleImmediateTrust"
  | "preBattleConsequence"
  | "battle"
  | "postBattleHp"
  | "postBattleDialogue"
  | "postBattleTrust"
  | "complete";

export interface U5FeedbackValueChange {
  readonly memberId: string;
  readonly before: number;
  readonly after: number;
}

export interface U5FeedbackLine {
  readonly memberId: string;
  readonly memberName: string;
  readonly text: string;
}

export interface U5CombatFeedbackView {
  readonly signature: string;
  readonly kind: "event" | "boss";
  readonly consequenceText: string | null;
  readonly preBattleReaction: U5FeedbackLine | null;
  readonly immediateTrustChanges: readonly U5FeedbackValueChange[];
  readonly postBattleReaction: U5FeedbackLine | null;
  readonly postBattleTrustChanges: readonly U5FeedbackValueChange[];
}

export type U5CombatFeedbackEvent =
  | "AUTO_ADVANCE"
  | "BATTLE_COMPLETE"
  | "ACKNOWLEDGE_REACTION";

export const U5_FEEDBACK_PHASE_DURATION_MS = {
  preBattleReaction: 1_100,
  preBattleImmediateTrust: 650,
  preBattleConsequence: 1_100,
  postBattleHp: 500,
  postBattleTrust: 650,
} as const;
~~~

Implement phase candidates as a single ordered list filtered by the view, then accept only the event valid for the current phase. Use an exhaustive `switch` with a `never` guard; never infer ordering from strings.

- [ ] **Step 4: Write the failing trust visibility tests**

~~~ts
it("사후 대사 확인 전에는 이전 신뢰를, trust phase부터 최종 신뢰를 보인다", () => {
  expect(u5VisibleTrust(ordinary, "postBattleDialogue", "brigston", 2)).toBe(4);
  expect(u5VisibleTrust(ordinary, "postBattleTrust", "brigston", 2)).toBe(2);
  expect(u5VisibleTrust(ordinary, "complete", "brigston", 2)).toBe(2);
});

it("노출된 거짓말의 즉시 신뢰는 전투 전에 반영한다", () => {
  expect(u5VisibleTrust(exposed, "preBattleReaction", "brigston", 1)).toBe(3);
  expect(u5VisibleTrust(exposed, "preBattleImmediateTrust", "brigston", 1)).toBe(1);
  expect(u5VisibleTrust(exposed, "battle", "brigston", 1)).toBe(1);
});
~~~

- [ ] **Step 5: Implement value visibility without mutating party/domain objects**

`u5VisibleTrust` must first check post-battle changes, then immediate changes. A phase before a change returns `before`; the change phase and later phases return `after`; an unrelated member returns the supplied final trust. Do not clone or patch campaign state here.

- [ ] **Step 6: Run the focused suite**

Run: `pnpm vitest run components/game/u5-combat-feedback.test.ts`

Expected: PASS for all phase, duration, acknowledgement, and trust visibility cases.

- [ ] **Step 7: Commit**

~~~bash
git add components/game/u5-combat-feedback.ts components/game/u5-combat-feedback.test.ts
git commit -m "기능: 전투 피드백 단계를 정의한다" -m "일반전과 보스전의 표시 순서와 신뢰 공개 시점을 순수 상태로 고정한다."
~~~

### Task 2: 실제 일반전·보스전 결과를 공통 feedback view로 변환한다

**Files:**
- Create: `components/game/u5-combat-feedback-adapter.ts`
- Create: `components/game/u5-combat-feedback-adapter.test.ts`
- Modify: `components/game/campaign-adapters.ts`
- Modify: `components/game/campaign-adapters.test.ts`
- Modify: `components/game/u5-log.ts`
- Modify: `components/game/u5-log-filter.test.ts`

**Interfaces:**
- Consumes: `ExpeditionOutcome`, `ExpeditionRecord`, active party seat order, `BossBattleResult.verifications`.
- Produces: `eventCombatFeedbackFor(campaign, active)` and `bossCombatFeedbackFor(campaign, active)`.
- Produces: `U5LogRevealAt = "reaction" | "consequence" | "hp" | "trust" | "complete"` and `visibleU5LogEntries(entries, phase)`.

- [ ] **Step 1: Write failing fixed-copy and key-member tests**

~~~ts
it.each([
  ["accepted", -2, "네 말을 믿은 게 실수였군."],
  ["accepted", 2, "이번에는 네 조언이 맞았어."],
  ["suspected", -2, "역시 그대로 따르지 않길 잘했어."],
  ["suspected", 2, "의심하느라 기회를 놓쳤군."],
] as const)("%s 반응과 trust 부호를 고정 대사로 바꾼다", (kind, delta, text) => {
  expect(u5PostBattleLine({ kind, delta })).toBe(text);
});

it("동률이면 현재 파티 seat order가 빠른 인물을 고른다", () => {
  expect(selectU5FeedbackMember([
    { memberId: "second", before: 3, after: 1 },
    { memberId: "first", before: 5, after: 7 },
  ], ["first", "second"])?.memberId).toBe("first");
});
~~~

Also cover these exact rules:

- executed general choice: first `accepted`; when none accepted, first `suspected` that caused the default.
- exposed: largest absolute immediate trust delta, then seat order.
- post-battle: largest absolute not-yet-visible trust delta, then seat order.
- no post trust delta: `postBattleReaction` is `null`.
- exposed pre-line is `처음부터 우릴 속이려 했군.` and accepted/suspected pre-lines match the spec verbatim.

- [ ] **Step 2: Run the adapter suite to verify it fails**

Run: `pnpm vitest run components/game/u5-combat-feedback-adapter.test.ts`

Expected: FAIL because the adapter and copy map do not exist.

- [ ] **Step 3: Implement the copy map, stable selector, and signature**

~~~ts
const PRE_BATTLE_COPY = {
  accepted: "알겠어. 네 말대로 하지.",
  suspected: "잠깐, 그대로 따르기엔 수상한데.",
  exposed: "처음부터 우릴 속이려 했군.",
} as const;

const POST_BATTLE_COPY = {
  adviceHelped: "이번에는 네 조언이 맞았어.",
  adviceHarmed: "네 말을 믿은 게 실수였군.",
  suspicionWasCorrect: "역시 그대로 따르지 않길 잘했어.",
  suspicionWasCostly: "의심하느라 기회를 놓쳤군.",
} as const;
~~~

Keep these keys inside TypeScript only. The signature must include expedition id, record count, event or boss identity, and sorted `memberId:before:after` tuples so a new outcome resets the UI while a re-render does not.

- [ ] **Step 4: Write failing real-fixture adapter tests**

Use the existing seeded campaign builders rather than hand-writing domain-shaped casts. Assert:

~~~ts
expect(eventFeedback.kind).toBe("event");
expect(eventFeedback.consequenceText).toBe(pendingOutcome.resultText);
expect(eventFeedback.immediateTrustChanges.every((change) => exposedIds.has(change.memberId))).toBe(true);
expect(bossFeedback.kind).toBe("boss");
expect(bossFeedback.preBattleReaction).toBeNull();
expect(bossFeedback.postBattleReaction?.memberId).toBe(expectedVerificationMemberId);
~~~

For boss copy selection, consume the applied verification action already present in E4 output. Never rerun verification or battle rules in the adapter.

- [ ] **Step 5: Implement staged log visibility and prevent future leaks**

Extend entries with optional `revealAt`. Mark only the active unresolved combat record; historical records remain immediately visible. Add current result text at `consequence`, HP summaries at `hp`, trust summaries at `trust`, and full reaction detail at `complete`.

~~~ts
export function visibleU5LogEntries(
  entries: readonly U5LogEntry[], phase: U5CombatFeedbackPhase,
): readonly U5LogEntry[] {
  return entries.filter((entry) => entry.revealAt === undefined ||
    U5_LOG_REVEAL_ORDER[entry.revealAt] <= U5_PHASE_REVEAL_ORDER[phase]);
}
~~~

Do not place unrevealed strings in hidden DOM nodes. Filter the data before rendering `LogPanel`.

- [ ] **Step 6: Run adapter and log suites**

Run: `pnpm vitest run components/game/u5-combat-feedback-adapter.test.ts components/game/campaign-adapters.test.ts components/game/u5-log-filter.test.ts`

Expected: PASS for both event/boss views, stable actor selection, immediate/post split, and phased log filtering.

- [ ] **Step 7: Commit**

~~~bash
git add components/game/u5-combat-feedback-adapter.ts components/game/u5-combat-feedback-adapter.test.ts components/game/campaign-adapters.ts components/game/campaign-adapters.test.ts components/game/u5-log.ts components/game/u5-log-filter.test.ts
git commit -m "기능: 전투 결과를 피드백 화면으로 변환한다" -m "실제 일반전과 보스전 결과에서 핵심 반응과 단계별 로그를 안정적으로 구성한다."
~~~

### Task 3: feedback timer와 battle playback의 시작 gate를 연결한다

**Files:**
- Create: `components/game/use-u5-combat-feedback.ts`
- Create: `components/game/use-u5-combat-feedback.test.ts`
- Modify: `components/game/use-u5-battle-playback.ts`
- Modify: `components/game/use-u5-battle-playback.test.ts`

**Interfaces:**
- Consumes: `U5CombatFeedbackView`, `U5CombatFeedbackPhase`, replay complete 여부.
- Produces: `useU5CombatFeedback(feedback, battleComplete)` with `phase`, `acknowledgeReaction`.
- Produces: `useU5BattlePlayback(replay, playing?: boolean)`; default `playing = true` preserves all existing callers.

- [ ] **Step 1: Write the failing playback pause contract test**

~~~ts
it("playing이 false면 다음 frame을 예약하지 않는다", () => {
  expect(shouldAdvanceU5BattleFrame(replay.frames[0], false)).toBe(false);
  expect(shouldAdvanceU5BattleFrame(replay.frames[0], true)).toBe(true);
  expect(shouldAdvanceU5BattleFrame(replay.frames.at(-1)!, true)).toBe(false);
});
~~~

- [ ] **Step 2: Run the playback suite to verify it fails**

Run: `pnpm vitest run components/game/use-u5-battle-playback.test.ts`

Expected: FAIL because `playing` and the helper do not exist.

- [ ] **Step 3: Add the backward-compatible playback gate**

~~~ts
export function useU5BattlePlayback(
  replay: U5BattleReplay | undefined,
  playing = true,
): U5BattlePlayback {
  // existing signature reset remains unchanged
}
~~~

The effect must return before `setTimeout` when `playing` is false. Add `playing` to dependencies so entering `battle` starts the existing idle-frame clock exactly once. `skipToComplete` remains callable only from the UI’s battle phase; do not change its calculation.

- [ ] **Step 4: Write the failing feedback lifecycle tests**

Test exported pure lifecycle helpers with fake time inputs, without adding jsdom or a new test dependency:

~~~ts
it("signature가 바뀌면 새 view의 첫 phase로 초기화한다", () => {
  const before = { signature: "old", phase: "complete" } as const;
  expect(u5FeedbackForSignature(before, ordinary)).toEqual({
    signature: ordinary.signature,
    phase: "preBattleReaction",
  });
});

it("자동 phase만 duration을 가지고 dialogue와 battle은 timer가 없다", () => {
  expect(u5FeedbackTimerMs("preBattleReaction")).toBe(1100);
  expect(u5FeedbackTimerMs("battle")).toBeNull();
  expect(u5FeedbackTimerMs("postBattleDialogue")).toBeNull();
});
~~~

- [ ] **Step 5: Implement the hook around the pure reducer**

The hook derives active state through `u5FeedbackForSignature`, schedules only phases with a duration, dispatches `BATTLE_COMPLETE` when playback reaches complete, and exposes one callback that dispatches `ACKNOWLEDGE_REACTION`. Clear the prior timeout on signature/phase changes and unmount. Do not use the battle playback phase duration or future playback rate.

- [ ] **Step 6: Run both controller suites**

Run: `pnpm vitest run components/game/use-u5-combat-feedback.test.ts components/game/use-u5-battle-playback.test.ts`

Expected: PASS; existing playback behavior remains unchanged when the second argument is omitted.

- [ ] **Step 7: Commit**

~~~bash
git add components/game/use-u5-combat-feedback.ts components/game/use-u5-combat-feedback.test.ts components/game/use-u5-battle-playback.ts components/game/use-u5-battle-playback.test.ts
git commit -m "기능: 전투 피드백 재생 순서를 제어한다" -m "피드백 타이머와 전투 시작 게이트를 분리하고 시그니처별 초기화를 보장한다."
~~~

### Task 4: battle frame HP와 신뢰 공개 값을 우측 파티 카드에 투영한다

**Files:**
- Modify: `components/game/u5-combat-feedback.ts`
- Modify: `components/game/u5-combat-feedback.test.ts`
- Modify: `components/game/PartyMemberCard.tsx`
- Modify: `components/game/PartyMemberCard.test.tsx`
- Modify: `app/party-card.css`

**Interfaces:**
- Consumes: final `U5ProgressView.party`, current `U5BattleReplayFrame`, feedback phase.
- Produces: `u5PartyForFeedback(party, replay, frame, feedback, phase)`.
- Produces: `U5PartyCardEffect { kind: "hp" | "trust"; delta: number; token: string }` and `u5PartyCardEffects(...)`.
- Consumes: optional `effect` prop in `PartyMemberCard`; existing U3/U4 callers need no change.

- [ ] **Step 1: Write failing HP projection tests**

~~~ts
it("battle 중 카드 HP는 scene과 같은 replay frame 값을 쓴다", () => {
  const projected = u5PartyForFeedback(finalParty, replay, settleFrame, ordinary, "battle");
  expect(projected.find((member) => member.id === "brigston")?.hp)
    .toBe(settleFrame.hpByParticipantId.brigston);
});

it("HP가 0인 frame에서 같은 카드가 즉시 전투 불능이 된다", () => {
  const projected = u5PartyForFeedback(finalParty, replay, lethalFrame, ordinary, "battle");
  expect(projected.find((member) => member.id === "brigston")).toMatchObject({ hp: 0, alive: false });
});
~~~

Also assert pre-battle uses participant initial HP, post-battle uses final HP, post-dialogue still uses old trust, post-trust uses final trust, and replay from frame 0 rewinds only HP while phase `complete` preserves final trust.

- [ ] **Step 2: Run the pure suite to verify it fails**

Run: `pnpm vitest run components/game/u5-combat-feedback.test.ts`

Expected: FAIL because party projection and effect helpers do not exist.

- [ ] **Step 3: Implement immutable projection and exact-frame effects**

Build participant lookup maps once per helper call. During `battle`, read HP from `frame.hpByParticipantId`; before battle read replay participant `initialHp`; after battle read `finalHp`. Preserve all other party fields and replace only `hp`, `alive`, and visible `trust`.

An HP effect is emitted only when the current frame first differs from the preceding frame for that member. Its token includes replay signature, frame index, member id, and kind. Trust effect tokens include feedback signature and trust phase. Zero deltas produce no effect.

- [ ] **Step 4: Write failing accessible card-effect tests**

~~~tsx
it("HP 감소를 카드 안의 접근 가능한 output으로 표시한다", () => {
  const html = renderToStaticMarkup(createElement(PartyMemberCard, {
    member, effect: { kind: "hp", delta: -3, token: "battle:4:member-1:hp" },
  }));
  expect(html).toContain('<output class="party-card__effect party-card__effect--hp"');
  expect(html).toContain("HP −3");
  expect(html).not.toContain("battle:4:member-1:hp");
});
~~~

Add trust increase/decrease cases and confirm that the internal token is used only as the React `key`, never rendered as a DOM attribute.

- [ ] **Step 5: Add the optional visual effect**

Render `<output aria-live="polite">` near the matching stat. Format positive values with `+`, negative values with Unicode minus `−`. Add a short translate/fade keyframe using existing card colors. Under `prefers-reduced-motion: reduce`, remove animation while keeping the output text visible for the phase.

- [ ] **Step 6: Run card and projection suites**

Run: `pnpm vitest run components/game/u5-combat-feedback.test.ts components/game/PartyMemberCard.test.tsx`

Expected: PASS for synchronized HP, death frame, gated trust, accessible effect text, and no internal token leak.

- [ ] **Step 7: Commit**

~~~bash
git add components/game/u5-combat-feedback.ts components/game/u5-combat-feedback.test.ts components/game/PartyMemberCard.tsx components/game/PartyMemberCard.test.tsx app/party-card.css
git commit -m "기능: 파티 카드에 전투 수치 변화를 동기화한다" -m "전투 프레임 HP와 확인 후 신뢰 변화를 우측 카드에 같은 시점으로 표시한다."
~~~

### Task 5: U5 화면에 current beat, 대사 ribbon, CTA gate를 통합한다

**Files:**
- Modify: `components/game/U5ProgressScreen.tsx`
- Modify: `components/game/U5ProgressScreen.test.tsx`
- Modify: `components/game/U5BattleScene.tsx`
- Modify: `components/game/U5BattleScene.test.tsx`
- Modify: `app/u5-progress.css`
- Modify: `app/u5-battle.css`

**Interfaces:**
- Consumes: optional `combatFeedback?: U5CombatFeedbackView` in `U5ProgressScreenProps`.
- Produces: exported pure `U5CombatFeedbackContent` phase-driven presentational component for SSR tests.
- Consumes: `showReplayControl: boolean` in `U5BattleSceneProps`.
- Produces: CTA matrix fixed by phase and `battleExitPolicy`.

- [ ] **Step 1: Write failing phase-render tests before changing production markup**

Use the pure presentational component with an explicit phase; do not add an `initialFeedbackPhase` escape hatch to production props.

~~~ts
it("전투 전에는 현재 반응 하나만 보이고 미래 결과는 DOM에 없다", () => {
  const html = renderFeedback("preBattleReaction");
  expect(html).toContain("알겠어. 네 말대로 하지.");
  expect(html).not.toContain("거미들이 천장에서 쏟아진다.");
  expect(html).not.toContain("네 말을 믿은 게 실수였군.");
  expect(html).not.toContain("신뢰 −2");
});

it("사후 대사는 확인 CTA만 보인다", () => {
  const html = renderFeedback("postBattleDialogue");
  expect(html).toContain("네 말을 믿은 게 실수였군.");
  expect(html).toContain("반응 확인");
  expect(html).not.toContain("지도로 돌아간다");
  expect(html).not.toContain("다시 보기");
});
~~~

Add a table for the exact CTA contract:

| Phase | CTA |
|---|---|
| pre automatic phases | none |
| battle | `전투 건너뛰기` |
| postBattleHp | none |
| postBattleDialogue | `반응 확인` |
| postBattleTrust | none |
| complete event | `지도로 돌아간다` |
| complete boss | `정산으로` |

- [ ] **Step 2: Run the screen and scene suites to verify they fail**

Run: `pnpm vitest run components/game/U5ProgressScreen.test.tsx components/game/U5BattleScene.test.tsx`

Expected: FAIL because combat feedback rendering, CTA phases, and replay visibility input do not exist.

- [ ] **Step 3: Integrate the two controllers and one current-beat renderer**

Call `useU5CombatFeedback(combatFeedback, playback.complete)`, and call `useU5BattlePlayback(battleReplay, phase === "battle")`. Project party values/effects before mapping `PartyMemberCard`. Filter log entries before `LogPanel`.

For feedback-enabled combat only, replace the eager `Outcome` block with a current-beat region. Preserve the existing `Outcome` component and behavior for noncombat results and preview callers without `combatFeedback`.

~~~tsx
<section className="u5-feedback-beat" aria-live="polite" aria-atomic="true">
  {currentBeat}
</section>
{line ? (
  <aside className="u5-feedback-ribbon" aria-label="파티원 반응">
    <strong>{line.memberName}</strong>
    <p>{line.text}</p>
  </aside>
) : null}
~~~

Keep exactly one visible beat. Do not render future strings with CSS hiding.

- [ ] **Step 4: Gate completion content and replay**

Add `showReplayControl` to `U5BattleScene`. Render `다시 보기` only when the replay frame is complete and `showReplayControl` is true. Remove the eager complete-frame verification list from the battle scene; the selected verification appears in the post-battle ribbon and all verification history appears in the phase-filtered log.

When replay is clicked after sequence completion, reset only `frameIndex`; keep feedback phase `complete`, right-card final HP/trust/result deltas, and logs. The central scene may replay while the right cards remain settled. Do not feed replay frames back into the right-card projection after sequence completion.

- [ ] **Step 5: Add fixed-canvas styling and reduced-motion behavior**

Place the ribbon at the bottom of the left scene column without changing the 60:40 shell or 40:60 left split. Use `clamp()` with `rem/cqw/cqh`. Give HP/trust effects and ribbon entry a CSS transition; disable their motion under the existing reduced-motion block without hiding content or altering timer durations.

- [ ] **Step 6: Preserve existing contracts in tests**

Keep assertions for `data-testid="u5-situation"`, noncombat advice/outcome rendering, party-card flip behavior after complete, and the existing `battleExitPolicy="after-playback"` behavior when `combatFeedback` is absent.

- [ ] **Step 7: Run the focused UI suites**

Run: `pnpm vitest run components/game/U5ProgressScreen.test.tsx components/game/U5BattleScene.test.tsx components/game/PartyMemberCard.test.tsx`

Expected: PASS for every phase, CTA, replay gate, noncombat fallback, and accessible live-region contract.

- [ ] **Step 8: Commit**

~~~bash
git add components/game/U5ProgressScreen.tsx components/game/U5ProgressScreen.test.tsx components/game/U5BattleScene.tsx components/game/U5BattleScene.test.tsx app/u5-progress.css app/u5-battle.css
git commit -m "기능: 전투 결과를 장면 순서대로 공개한다" -m "현재 반응과 대사 리본을 표시하고 확인 전 결과와 다음 이동을 차단한다."
~~~

### Task 6: 실제 캠페인과 전투 프리뷰에 feedback contract를 연결한다

**Files:**
- Modify: `components/game/CampaignScreen.tsx`
- Modify: `components/game/campaign-render.test.tsx`
- Modify: `components/game/u5-battle-preview-data.ts`
- Modify: `components/game/U5BattlePreview.tsx`
- Modify: `e2e/u5-battle-preview.spec.ts`

**Interfaces:**
- Consumes: `eventCombatFeedbackFor`, `bossCombatFeedbackFor`.
- Produces: deterministic event/boss preview entries with `feedback: U5CombatFeedbackView`.
- Produces: browser-observable sequence using visible Korean copy and accessible CTA names only.

- [ ] **Step 1: Write failing campaign render tests**

For a seeded pending monster outcome, render `CampaignScreen` and assert the initial HTML contains the pre-battle reaction but not the final result, final trust effect, card back history, or `지도로 돌아간다`. For a finished boss battle, assert it enters the common boss feedback contract and does not expose `정산으로` in initial HTML.

~~~ts
expect(eventHtml).toContain("파티원 반응");
expect(eventHtml).not.toContain("지도로 돌아간다");
expect(eventHtml).not.toContain("신뢰 −");
expect(bossHtml).not.toContain("정산으로");
~~~

- [ ] **Step 2: Run the campaign render suite to verify it fails**

Run: `pnpm vitest run components/game/campaign-render.test.tsx`

Expected: FAIL because `CampaignScreen` does not pass a feedback view.

- [ ] **Step 3: Wire event and boss paths without changing rules**

In the pending event/outcome branch, build and pass `eventCombatFeedbackFor(campaign, active)`. In the completed boss branch, build and pass `bossCombatFeedbackFor(campaign, active)`. If either adapter returns `undefined` for a noncombat outcome, keep the existing noncombat rendering path.

Update preview data to derive feedback from its existing deterministic E3/E4 outputs. Do not call rules from `U5ProgressScreen` and do not create UI-only damage or trust values.

- [ ] **Step 4: Replace the old playback-only E2E with full sequence tests**

~~~ts
test("일반전 건너뛰기도 HP·대사·신뢰 단계를 보존한다", async ({ page }) => {
  await page.goto("/u5-2-test");
  await page.getByRole("button", { name: "E3 실제 일반전" }).click();
  await expect(page.getByRole("button", { name: "전투 건너뛰기" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "전투 건너뛰기" }).click();
  await expect(page.getByRole("button", { name: "반응 확인" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "반응 확인" }).click();
  await expect(page.getByRole("button", { name: "다시 보기" })).toBeVisible({ timeout: 10_000 });
});
~~~

Add these browser cases:

- natural general playback: a right-card HP value changes no later than the matching battle scene HP frame.
- skipped general playback: post HP → confirmation → trust → final CTA remains ordered.
- boss playback: uses the same confirmation gate and ends with `정산으로`.
- replay after complete: only the central scene HP rewinds; right-card final HP, final trust, persistent deltas, and dialogue phase stay unchanged.
- reduced motion (`page.emulateMedia({ reducedMotion: "reduce" })`): sequence still waits/asks confirmation and reaches complete.
- all cases call `watchBrowserErrors` / `expectNoBrowserErrors`.

Use locators scoped by `data-member-id` only if the existing card already exposes a public member id. Otherwise add a semantic card label such as `aria-label="브릭스턴 파티 상태"`; never expose feedback keys or effect tokens.

- [ ] **Step 5: Run integration and browser tests**

Run: `pnpm vitest run components/game/campaign-render.test.tsx components/game/u5-battle-preview-data.test.ts components/game/U5ProgressScreen.test.tsx`

Expected: PASS for actual campaign event/boss integration and deterministic preview fixtures.

Run: `pnpm test:e2e -- e2e/u5-battle-preview.spec.ts`

Expected: PASS in Chromium for natural, skip, boss, replay, and reduced-motion sequences with no browser errors.

- [ ] **Step 6: Commit**

~~~bash
git add components/game/CampaignScreen.tsx components/game/campaign-render.test.tsx components/game/u5-battle-preview-data.ts components/game/U5BattlePreview.tsx e2e/u5-battle-preview.spec.ts
git commit -m "기능: 캠페인 전투 피드백을 연결한다" -m "실제 일반전과 보스전에서 같은 결과 공개 순서와 카드 HP 동기화를 사용한다."
~~~

### Task 7: 완료 결과를 카드에 남기고 다시보기 projection을 분리한다

**Files:**
- Modify: `components/game/PartyMemberCard.tsx`
- Modify: `components/game/PartyMemberCard.test.tsx`
- Modify: `components/game/U5ProgressScreen.tsx`
- Modify: `components/game/U5ProgressScreen.test.tsx`
- Modify: `components/game/u5-combat-feedback.ts`
- Modify: `components/game/u5-combat-feedback.test.ts`
- Modify: `app/party-card.css`
- Modify: `e2e/u5-battle-preview.spec.ts`

**Interfaces:**
- Produces: `PartyMemberSettledResult` with optional signed `hpDelta` and `trustDelta`.
- Produces: `u5SettledTrustDelta(view, memberId)` using the first before and last after across immediate and post-battle trust changes.
- Consumes: replay participant `initialHp`/`finalHp`, feedback phase, and manual replay state.

- [ ] **Step 1: Write failing settled-result card tests**

~~~tsx
const html = render({}, {
  settledResult: { hpDelta: -3, trustDelta: -2 },
});
expect(html).toContain("HP −3");
expect(html).toContain("신뢰 −2");
expect(html).toContain("party-card__settled-results");
~~~

Add cases for positive signs, one changed stat, and `{ hpDelta: 0, trustDelta: 0 }` producing no settled-result container. The persistent result must not include the transient effect token.

- [ ] **Step 2: Run the card test and verify RED**

Run: `pnpm vitest run components/game/PartyMemberCard.test.tsx`

Expected: FAIL because `settledResult` and persistent result markup do not exist.

- [ ] **Step 3: Add the card result contract and persistent markup**

~~~ts
export interface PartyMemberSettledResult {
  readonly hpDelta?: number;
  readonly trustDelta?: number;
}
~~~

Render both non-zero values on the card front. Use `output` elements with `HP ±N` and `신뢰 ±N`; wrap them in `.party-card__settled-results`. Keep the result mounted without an exit timer. The existing transient battle-hit effect remains separate.

- [ ] **Step 4: Write failing projection tests**

Add pure tests proving the trust chain uses the first `before` and last `after` across immediate and post-battle changes. Add U5 render/source contract tests proving:

~~~ts
expect(source).toMatch(/feedback\.phase === "battle"/);
expect(source).not.toMatch(/feedback\.phase === "battle" \|\| battlePlayback\.isReplaying/);
expect(source).toContain("settledResult=");
~~~

Also assert persistent results are gated to `postBattleTrust` and `complete`, and a member with no HP/trust delta receives no result.

- [ ] **Step 5: Run focused projection tests and verify RED**

Run: `pnpm vitest run components/game/u5-combat-feedback.test.ts components/game/U5ProgressScreen.test.tsx`

Expected: FAIL because trust aggregation and settled result projection do not exist, and manual replay still drives right-card HP.

- [ ] **Step 6: Implement final-card projection**

In `U5ProgressScreen`, use replay frame HP for the right cards only when `feedback.phase === "battle"`. During manual replay, keep `progress.party` final HP/alive/trust. Build `settledResult` only in `postBattleTrust` or `complete`:

~~~tsx
const hpDelta = participant.finalHp - participant.initialHp;
const trustDelta = u5SettledTrustDelta(combatFeedback, member.id);

<PartyMemberCard
  settledResult={showSettledResults ? { hpDelta, trustDelta } : undefined}
/>
~~~

Return `undefined` when both values are zero. Do not derive values from animation state, DOM, or card history. Remove the duplicate transient trust output in `postBattleTrust`; the persistent result entry animation is the one trust-change feedback.

- [ ] **Step 7: Style the persistent pair**

Lay out settled HP/trust results inside the existing card grid using `rem/cqw/cqh`. Both values must fit simultaneously, remain visible during replay, and retain text labels and signs. Under reduced motion, remove entry movement but not the output text.

- [ ] **Step 8: Strengthen browser replay coverage**

After `반응 확인`, capture the right-card HP, trust, `HP ±N`, and `신뢰 ±N`. Click `다시 보기`, wait until a non-complete central battle frame is visible, and assert all four right-card values remain unchanged. Wait for replay completion and assert the persistent results still exist and the post-battle dialogue did not reappear.

Run: `pnpm test:e2e -- e2e/u5-battle-preview.spec.ts`

Expected: PASS for ordinary and boss previews with no browser errors.

- [ ] **Step 9: Commit**

~~~bash
git add components/game/PartyMemberCard.tsx components/game/PartyMemberCard.test.tsx components/game/U5ProgressScreen.tsx components/game/U5ProgressScreen.test.tsx components/game/u5-combat-feedback.ts components/game/u5-combat-feedback.test.ts app/party-card.css e2e/u5-battle-preview.spec.ts
git commit -m "수정: 전투 결과를 파티 카드에 유지한다" -m "반응 확인 뒤 HP와 신뢰 변화량을 남기고 다시보기 중 우측 파티 상태는 최종 결과를 유지한다."
~~~

### Task 8: 전체 회귀와 고정 캔버스 화면을 검증한다

**Files:**
- Modify if required by verified behavior only: `docs/experience/SCREEN_LAYOUT.md`
- Modify if required by verified behavior only: `docs/experience/ONBOARDING_AND_INTERFACE.md`
- Modify if required by verified behavior only: `docs/experience/UI_IMPLEMENTATION_GUIDE.md`
- Verify: `docs/README.md`
- Verify: all files changed in Tasks 1–7

**Interfaces:**
- Consumes: all feedback, replay, campaign, CSS, and E2E contracts above.
- Produces: a clean verified implementation with no placeholders, future-result leaks, or unrelated staged files.

- [ ] **Step 1: Run formatting and placeholder scans**

Run: `rg -n "TODO|TBD|FIXME|similar to|나중에 구현" components/game app e2e`

Expected: no new placeholder in changed files. Existing unrelated matches must be identified and excluded explicitly.

Run: `rg -n "accepted|suspected|exposed|adviceHelped|adviceHarmed|suspicionWasCorrect|suspicionWasCostly" components/game/*.tsx e2e`

Expected: no internal feedback key appears in rendered JSX text, accessible labels, or browser assertions.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 2: Run all automated verification**

Run: `pnpm test`

Expected: PASS for the full Vitest suite.

Run: `pnpm typecheck`

Expected: exit 0 with no TypeScript errors.

Run: `pnpm lint`

Expected: exit 0 with no ESLint errors.

Run: `pnpm build`

Expected: successful Next.js production build.

Run: `pnpm test:e2e`

Expected: all Chromium specs pass with no uncaught browser errors.

Do not run B1 backtests: this task changes no rules, RNG, damage, trust, or campaign transitions.

- [ ] **Step 3: Inspect four fixed-canvas viewports**

Use the existing `/u5-2-test` preview and inspect general and boss flows at 1920×1080, 1440×900, 1280×720, and 1024×768. At each viewport verify:

- no canvas overflow or clipped CTA;
- the bottom ribbon does not cover combatants, current beat, or right cards;
- right-card HP changes during battle and death state appears on the lethal frame;
- trust stays old before confirmation and changes afterward;
- skip and natural playback reach the same final values;
- replay rewinds the central scene only while right-card final HP, trust, and deltas stay fixed;
- reduced motion removes movement but not content or gate timing.

Capture screenshots only for review evidence; do not add generated screenshots to the repository.

- [ ] **Step 4: Reconcile docs with the verified implementation**

Compare the implemented UI against `SCREEN_LAYOUT.md`, `ONBOARDING_AND_INTERFACE.md`, and `UI_IMPLEMENTATION_GUIDE.md`, which were updated with the approved spec. Edit only concrete mismatches discovered during implementation; do not restate implementation details in the setting/rule documents.

- [ ] **Step 5: Review scope and staged files**

Run: `git status --short`

Expected: only Task 1–8 files plus the pre-existing user-owned `.pnpm-store/` and `public/assets/u6/**/{ASSET_MANIFEST.json,README.txt}` entries. Never stage those unrelated paths.

Run: `git diff --stat HEAD`

Expected: no BattleEngine, rule, Store, save-format, asset binary, or unrelated U3/U4 changes.

- [ ] **Step 6: Commit verified documentation adjustments if any**

If Step 4 changed official docs:

~~~bash
git add docs/README.md docs/experience/SCREEN_LAYOUT.md docs/experience/ONBOARDING_AND_INTERFACE.md docs/experience/UI_IMPLEMENTATION_GUIDE.md
git commit -m "문서: 전투 피드백 구현 계약을 동기화한다" -m "검증된 화면 순서와 접근성 동작을 공식 UI 문서에 반영한다."
~~~

If no official doc changed, do not create an empty commit.

- [ ] **Step 7: Apply verification-before-completion**

Use `superpowers:verification-before-completion`, rerun every command whose output will be cited, and report exact pass counts plus any intentionally untracked user files. Do not claim completion from an earlier or partial run.

### Task 9: 결과 단계 HP 회귀와 카드 기본 높이를 고친다

**Files:**
- Modify: `components/game/u5-combat-feedback.ts`
- Modify: `components/game/u5-combat-feedback.test.ts`
- Modify: `components/game/U5ProgressScreen.tsx`
- Modify: `components/game/PartyMemberCard.tsx`
- Modify: `components/game/PartyMemberCard.test.tsx`
- Modify: `app/party-card.css`
- Modify: `e2e/u5-battle-preview.spec.ts`
- Modify: `docs/experience/SCREEN_LAYOUT.md`
- Modify: `docs/experience/ONBOARDING_AND_INTERFACE.md`
- Modify: `docs/experience/UI_IMPLEMENTATION_GUIDE.md`

**Interfaces:**
- Changes: `u5VisibleHp({ phase, frameHp, replayFinalHp, fallbackHp })` selects the frame only in `battle`, then replay final HP, then party-view fallback.
- Preserves: `PartyMemberSettledResult` and its non-zero `HP ±N` / `신뢰 ±N` outputs.
- Adds: `reserveSettledResultSpace?: boolean` lets U5 mount `.party-card__settled-results` as a one-line layout slot without changing U3·U4.

- [x] **Step 1: Write the failing final-HP projection test**

Add literal assertions that reproduce the boss preview mismatch:

~~~ts
expect(u5VisibleHp({ phase: "battle", frameHp: 11, replayFinalHp: 5, fallbackHp: 32 })).toBe(11);
expect(u5VisibleHp({ phase: "postBattleDialogue", frameHp: 11, replayFinalHp: 5, fallbackHp: 32 })).toBe(5);
expect(u5VisibleHp({ phase: "postBattleTrust", frameHp: 11, replayFinalHp: 5, fallbackHp: 32 })).toBe(5);
expect(u5VisibleHp({ phase: "complete", frameHp: 11, replayFinalHp: 5, fallbackHp: 32 })).toBe(5);
expect(u5VisibleHp({ phase: "complete", frameHp: 11, replayFinalHp: undefined, fallbackHp: 32 })).toBe(32);
~~~

The production mutation this catches is passing stale `progress.party[].hp` as the final HP or choosing it before replay `finalHp`.

- [x] **Step 2: Run the focused HP test and verify RED**

Run: `npx vitest run components/game/u5-combat-feedback.test.ts`

Expected: FAIL because the current three-argument helper cannot distinguish replay final HP `5` from party fallback HP `32`.

- [x] **Step 3: Implement replay-final HP precedence**

Change the helper to:

~~~ts
export function u5VisibleHp({ phase, frameHp, replayFinalHp, fallbackHp }: {
  readonly phase: U5CombatFeedbackPhase;
  readonly frameHp: number | undefined;
  readonly replayFinalHp: number | undefined;
  readonly fallbackHp: number;
}): number {
  const finalHp = replayFinalHp ?? fallbackHp;
  return phase === "battle" ? frameHp ?? finalHp : finalHp;
}
~~~

In `U5ProgressScreen`, resolve the member's replay participant once and pass
`participant?.finalHp` before `member.hp`. Use that same participant for the settled-result delta.

- [x] **Step 4: Run the focused HP tests and verify GREEN**

Run: `npx vitest run components/game/u5-combat-feedback.test.ts components/game/U5ProgressScreen.test.tsx`

Expected: PASS, including replay fallback and existing initial-playback frame behavior.

- [x] **Step 5: Write the failing default result-slot tests**

Change the zero-delta card expectation so the wrapper remains but outputs do not:

~~~tsx
const html = render({}, { settledResult: { hpDelta: 0, trustDelta: 0 } });
expect(html).toContain('class="party-card__settled-results"');
expect(html).not.toContain('party-card__settled-result--hp');
expect(html).not.toContain('party-card__settled-result--trust');
~~~

Add a CSS contract assertion for a concrete `min-height` on
`.party-card__settled-results`. The production mutation this catches is conditionally removing
the wrapper, which makes only cards with results grow.

- [x] **Step 6: Run the card test and verify RED**

Run: `npx vitest run components/game/PartyMemberCard.test.tsx`

Expected: FAIL because the current wrapper is conditional and has no reserved minimum height.

- [x] **Step 7: Mount the result slot for every card and reserve one row**

Add `reserveSettledResultSpace?: boolean` to `PartyMemberCard` and pass it from
`U5ProgressScreen`. Render `.party-card__settled-results` when U5 reserves the slot or a
non-zero result exists. Keep the existing conditional `output` children, set
`aria-live="polite"`, and add `aria-hidden="true"` only while the slot has no outputs.
Give the wrapper a `min-height` sized for one badge row using existing `rem/cqw` units. Do not
render placeholder copy, a border, or an invisible output. Do not add an empty slot to U3·U4.

- [x] **Step 8: Run focused component tests and verify GREEN**

Run: `npx vitest run components/game/PartyMemberCard.test.tsx components/game/U5ProgressScreen.test.tsx components/game/u5-combat-feedback.test.ts`

Expected: PASS for final HP precedence, zero-output omission, signed deltas, reduced motion, and always-mounted layout slots.

- [x] **Step 9: Strengthen the boss browser regression**

In `e2e/u5-battle-preview.spec.ts`, select the damaged boss participant from its persistent
HP result. Record its HP immediately when `반응 확인` appears, click confirmation, and assert
the HP is unchanged. Record all `.party-card` heights before confirmation and assert the same
height array after the results appear; also assert the three final card heights differ by less
than one CSS pixel.

Run: `npx playwright test e2e/u5-battle-preview.spec.ts --reporter=line`

Expected: PASS for general, boss, natural playback, skip, speed, replay, final HP continuity,
and equal card size with no browser errors.

- [x] **Step 10: Run full verification and commit**

Run:

~~~bash
npm test
npm run typecheck
npx eslint . --ignore-pattern 'playwright-report/**' --ignore-pattern 'test-results/**'
npm run build -- --webpack
npx playwright test e2e/u5-battle-preview.spec.ts --reporter=line
git diff --check
~~~

Expected: all tests, typecheck, lint, production build, focused Chromium E2E, and whitespace
verification pass. Then commit and push to the existing PR branch:

~~~bash
git add app/party-card.css components/game/PartyMemberCard.test.tsx components/game/PartyMemberCard.tsx components/game/U5ProgressScreen.tsx components/game/u5-combat-feedback.test.ts components/game/u5-combat-feedback.ts docs/experience/ONBOARDING_AND_INTERFACE.md docs/experience/SCREEN_LAYOUT.md docs/experience/UI_IMPLEMENTATION_GUIDE.md docs/superpowers/plans/2026-08-25-lattebun-u5-combat-feedback-sequence.md docs/superpowers/specs/2026-08-25-lattebun-u5-combat-feedback-sequence-design.md e2e/u5-battle-preview.spec.ts
git commit -m "수정: 전투 결과 카드의 HP와 높이를 고정한다" -m "결과 단계에서는 replay 최종 HP를 우선하고 모든 파티 카드가 변화량 슬롯 높이를 기본으로 확보한다."
git push origin feature/u5-combat-feedback-sequence
~~~
