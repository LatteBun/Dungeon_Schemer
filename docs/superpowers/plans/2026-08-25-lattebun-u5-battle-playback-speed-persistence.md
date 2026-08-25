# U5 원정 단위 전투 재생 속도 유지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 선택한 ×1 / ×2 전투 재생 속도를 같은 원정의 일반전과 보스전 사이에 유지하고, 새 원정에서는 ×1로 시작한다.

**Architecture:** useU5BattlePlayback은 전달받은 speed로 frame timer만 제어한다. ExpeditionScreens와 U5BattlePreview가 mount 범위마다 useU5BattlePlaybackRate를 한 번 호출해 U5ProgressScreen을 controlled component로 만든다. Store·저장 상태는 그대로 둔다.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Playwright

**Spec:** docs/superpowers/specs/2026-08-25-lattebun-u5-battle-playback-speed-persistence-design.md

## Global Constraints

- 새 원정·새 문서는 ×1, 원정 중 일반전·보스전·다시 보기·건너뛰기는 현재 속도를 유지한다.
- speed preference는 ExpeditionScreens와 U5BattlePreview의 화면 로컬 상태이며 Store, URL, localStorage, 저장 데이터에 넣지 않는다.
- replay signature 변경은 frame index만 초기화한다. speed는 useU5BattlePlayback의 입력값으로 받는다.
- E3/E4 결과, RNG, HP, 신뢰, 승패, 순서, CTA gate, reduced-motion, 고정 캔버스와 접근성 계약을 변경하지 않는다.
- 구현 전 현재 checkout의 Next.js 16.3 공식 문서를 확인하고 deprecated API를 추가하지 않는다.

## File Structure

- components/game/use-u5-battle-playback.ts: speed-control hook과 frame-only playback hook interface.
- components/game/use-u5-battle-playback.test.ts: signature와 speed-control state contract.
- components/game/U5ProgressScreen.tsx: controlled speed props를 timer와 scene에 전달.
- components/game/U5ProgressScreen.test.tsx: supplied ×2 render contract.
- components/game/CampaignScreen.tsx: 활성 원정 mount 범위의 rate control.
- components/game/U5BattlePreview.tsx: E3/E4 selector가 공유하는 rate control.
- components/game/U5Preview.tsx: 독립 진행 프리뷰 mount 범위의 rate control.
- e2e/u5-battle-preview.spec.ts: E3→E4 ×2 유지 Chromium regression.
- docs/experience/SCREEN_LAYOUT.md, docs/experience/UI_IMPLEMENTATION_GUIDE.md: new expedition reset wording.

---

### Task 1: frame 재생과 원정 speed preference의 소유를 분리한다

**Files:**
- Modify: components/game/use-u5-battle-playback.ts:1-145
- Modify: components/game/use-u5-battle-playback.test.ts:1-150

**Interfaces:**
- Produces: U5BattlePlaybackRateControl { playbackRate: U5BattlePlaybackRate; togglePlaybackRate(): void }.
- Produces: useU5BattlePlaybackRate(): U5BattlePlaybackRateControl.
- Changes: useU5BattlePlayback(replay, playbackRate): U5BattlePlayback.
- Changes: U5BattlePlaybackState owns only signature and frameIndex.

- [ ] **Step 1: Write the failing pure state tests**

~~~ts
it("새 replay signature는 frame만 처음으로 돌린다", () => {
  expect(u5BattlePlaybackForSignature(
    { signature: "before", frameIndex: 4 },
    "after",
  )).toEqual({ signature: "after", frameIndex: 0 });
});

it("속도 control hook을 제공한다", () => {
  expect(useU5BattlePlaybackRate).toBeTypeOf("function");
});
~~~

Delete the old assertion that a signature change returns playbackRate 1. The new spec reverses that behavior.

- [ ] **Step 2: Run test to verify it fails**

Run: pnpm vitest run components/game/use-u5-battle-playback.test.ts

Expected: FAIL because useU5BattlePlaybackRate is absent and the state helper still owns playbackRate.

- [ ] **Step 3: Implement the separated state contract**

~~~ts
export interface U5BattlePlaybackRateControl {
  readonly playbackRate: U5BattlePlaybackRate;
  readonly togglePlaybackRate: () => void;
}

export function useU5BattlePlaybackRate(): U5BattlePlaybackRateControl {
  const [playbackRate, setPlaybackRate] = useState<U5BattlePlaybackRate>(1);
  return {
    playbackRate,
    togglePlaybackRate: () => setPlaybackRate((current) => current === 1 ? 2 : 1),
  };
}
~~~

Remove playbackRate from U5BattlePlaybackState and U5BattlePlayback. Add playbackRate as the second argument to useU5BattlePlayback and use it for the phase timeout. Keep stable primitive effect dependencies: frame count, frame index, frame phase, rate, and signature.

- [ ] **Step 4: Run focused tests and typecheck**

Run: pnpm vitest run components/game/use-u5-battle-playback.test.ts && pnpm typecheck

Expected: PASS; replay identity cannot overwrite the parent preference and the timer only accepts 1 | 2.

- [ ] **Step 5: Commit**

~~~bash
git add components/game/use-u5-battle-playback.ts components/game/use-u5-battle-playback.test.ts
git commit -m "수정: 전투 속도 상태를 재생 기록에서 분리한다" -m "원정 화면이 속도를 유지하도록 frame 재생 책임을 좁힌다."
~~~

### Task 2: 원정과 프리뷰 mount 범위에서 같은 speed control을 전달한다

**Files:**
- Modify: components/game/U5ProgressScreen.tsx:20-275
- Modify: components/game/U5ProgressScreen.test.tsx:1-320
- Modify: components/game/CampaignScreen.tsx:190-285
- Modify: components/game/U5BattlePreview.tsx:1-48
- Modify: components/game/U5Preview.tsx:1-48

**Interfaces:**
- Consumes: useU5BattlePlaybackRate and U5BattlePlaybackRateControl from Task 1.
- Changes: U5ProgressScreenProps has mandatory playbackRate and onTogglePlaybackRate.
- Produces: one rate-control instance per ExpeditionScreens, U5BattlePreview, and U5Preview mount.

- [ ] **Step 1: Write failing U5ProgressScreen forwarding test**

~~~ts
it("부모가 준 ×2를 장면과 playback timer에 그대로 전달한다", () => {
  const html = render({}, {
    battleReplay,
    playbackRate: 2,
    onTogglePlaybackRate: () => undefined,
  });

  expect(html).toContain('data-playback-rate="2"');
  expect(html).toContain('aria-pressed="true"');
});
~~~

Update the existing static render helper to provide playbackRate 1 and a no-op onTogglePlaybackRate for every old call.

- [ ] **Step 2: Run test to verify it fails**

Run: pnpm vitest run components/game/U5ProgressScreen.test.tsx

Expected: FAIL because U5ProgressScreen still reads speed from its own playback hook.

- [ ] **Step 3: Make U5ProgressScreen controlled**

~~~tsx
const battlePlayback = useU5BattlePlayback(battleReplay, playbackRate);

<U5BattleScene
  replay={battleReplay}
  frame={battlePlayback.frame}
  playbackRate={playbackRate}
  onTogglePlaybackRate={onTogglePlaybackRate}
  onReplayFromStart={battlePlayback.replayFromStart}
/>
~~~

Do not add useState to U5ProgressScreen.

- [ ] **Step 4: Lift the control into each mount boundary**

~~~tsx
function ExpeditionScreens() {
  const playbackRateControl = useU5BattlePlaybackRate();
  // Pass its two fields to every U5ProgressScreen branch.
}
~~~

~~~tsx
export function U5BattlePreview() {
  const playbackRateControl = useU5BattlePlaybackRate();
  // Pass its two fields to the selected E3/E4 entry.
}
~~~

Apply the same local control to U5Preview, which also calls U5ProgressScreen directly. Call every hook before component conditional returns. Do not put it in CampaignScreen or Zustand: both scopes survive an active expedition and would violate new-expedition reset.

- [ ] **Step 5: Run focused UI suites and typecheck**

Run: pnpm vitest run components/game/U5ProgressScreen.test.tsx components/game/U5BattleScene.test.tsx && pnpm typecheck

Expected: PASS; supplied ×2 markup is correct and all callers meet the controlled props interface.

- [ ] **Step 6: Commit**

~~~bash
git add components/game/U5ProgressScreen.tsx components/game/U5ProgressScreen.test.tsx components/game/CampaignScreen.tsx components/game/U5BattlePreview.tsx components/game/U5Preview.tsx
git commit -m "기능: 원정 사이 전투 속도를 유지한다" -m "일반전과 보스전이 같은 원정 재생 속도를 공유한다."
~~~

### Task 3: 브라우저 회귀와 공식 UI 계약을 원정 범위로 갱신한다

**Files:**
- Modify: e2e/u5-battle-preview.spec.ts:1-90
- Modify: docs/experience/SCREEN_LAYOUT.md:159-164
- Modify: docs/experience/UI_IMPLEMENTATION_GUIDE.md:63-75

**Interfaces:**
- Consumes: Task 2 preview-level rate control.
- Produces: E3→E4 persistence E2E and official new-expedition reset wording.

- [ ] **Step 1: Write failing browser assertion for next-battle persistence**

~~~ts
await speed.click();
await expect(speed).toHaveText("×2");

await page.getByRole("button", { name: "E4 실제 보스전" }).click();
await expect(speed).toHaveText("×2");
await expect(speed).toHaveAttribute("aria-pressed", "true");
await expect(page.getByTestId("u5-battle-scene")).toHaveAttribute("data-playback-rate", "2");
~~~

Keep the existing 다시 보기 retention assertion and expectNoBrowserErrors call.

- [ ] **Step 2: Run browser test to verify it fails**

Run: pnpm playwright test e2e/u5-battle-preview.spec.ts --project=chromium

Expected: FAIL at E4 because the current implementation resets a new replay signature to ×1.

- [ ] **Step 3: Update official wording**

In SCREEN_LAYOUT.md, replace the next battle ×1 sentence with:

~~~md
모든 일반전과 보스전은 새 원정에서 ×1로 시작하고, 같은 원정의 다음 전투와 다시 보기는 선택한 속도를 유지한다. 원정 정산 뒤 새 계약을 시작하거나 새 브라우저 문서를 열면 ×1로 돌아간다.
~~~

In UI_IMPLEMENTATION_GUIDE.md, state that speed is owned by the active-expedition screen mount, never replay identity or the campaign Store.

- [ ] **Step 4: Run browser and complete regression checks**

Run: pnpm playwright test e2e/u5-battle-preview.spec.ts --project=chromium && pnpm test && pnpm typecheck && pnpm lint && pnpm build

Expected: E3→E4 reports ×2 after the selector change; every command exits 0. If build or full E2E has an environment-only failure, preserve its output and distinguish it from the focused speed test result.

- [ ] **Step 5: Commit**

~~~bash
git add e2e/u5-battle-preview.spec.ts docs/experience/SCREEN_LAYOUT.md docs/experience/UI_IMPLEMENTATION_GUIDE.md
git commit -m "문서: 원정 단위 전투 속도 유지 계약을 기록한다" -m "다음 전투 유지와 새 원정 초기화를 검증에 반영한다."
git status --short
~~~
