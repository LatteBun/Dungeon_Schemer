# U5 전투 재생 2배속 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 일반 몬스터전과 보스전의 확정된 U5 전투 replay를 결과 변경 없이 `×1 / ×2`로 재생한다.

**Architecture:** `useU5BattlePlayback`이 replay signature에 묶인 `playbackRate`와 frame 예약을 소유한다. `U5ProgressScreen`은 그 상태와 토글을 공통 전투 장면으로 전달하고, `U5BattleScene`은 모든 유한 motion과 HP transition을 같은 배율로 표시한다. 속도는 화면 로컬 상태이며 E3/E4 규칙 결과, Store, 저장 데이터에는 닿지 않는다.

**Tech Stack:** Next.js App Router, React, TypeScript, Framer Motion, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-08-25-lattebun-u5-battle-playback-speed-design.md`

## Global Constraints

- 일반전과 보스전 모두 `U5ProgressScreen → useU5BattlePlayback → U5BattleScene` 공통 경로만 사용하며 전투 종류별 속도 분기를 만들지 않는다.
- 기본 속도는 `×1`; 다른 replay signature는 frame 0과 `×1`로 초기화하고, 같은 replay의 다시 보기와 건너뛰기는 현재 속도를 보존한다.
- phase 기본 시간은 idle 500ms, attack 360ms, impact 420ms, settle 520ms, complete 0ms이며 `×2`는 각각 절반이다.
- 모든 유한 scene animation과 HP bar transition은 `playbackRate`로 나눈다. reduced-motion의 0 duration은 그대로 0이다.
- 속도 버튼의 visible text는 `×1` 또는 `×2`, accessible name은 `전투 재생 속도`, `aria-pressed`는 `×2`일 때만 `true`다.
- speed control은 전투 장면 우측 상단에 재생 중과 complete frame 모두 둔다. 우측 패널 CTA, 전투 완료 판정, 건너뛰기·다음 단계 게이트는 바꾸지 않는다.
- BattleEngine/E3/E4 재계산, RNG 소비, Store·저장 데이터 변경, 새 이미지 에셋 추가는 금지한다.
- 고정 캔버스 규칙을 유지하고 새 `vw`, `vh`, 미디어 쿼리를 추가하지 않는다.
- 구현 전 현재 checkout의 Next.js 버전에 맞는 `node_modules/next/dist/docs/` 관련 가이드를 읽고 deprecated API를 쓰지 않는다.

## File Structure

- `components/game/use-u5-battle-playback.ts`: replay signature별 speed/frame 상태, phase duration 계산, timeout 예약을 소유한다.
- `components/game/use-u5-battle-playback.test.ts`: 순수 duration·signature state 계약과 hook timer 동작을 고정한다.
- `components/game/U5BattleScene.tsx`: speed toggle UI와 Framer Motion duration 배율을 장면에 적용한다.
- `components/game/U5BattleScene.test.tsx`: control 접근성·complete 조합·motion/HP duration 계약을 검사한다.
- `components/game/U5ProgressScreen.tsx`: hook의 speed state와 toggle callback을 scene에 전달한다.
- `components/game/U5ProgressScreen.test.tsx`: replay 호출부가 공통 control을 전달하고 CTA 정책을 보존하는지 확인한다.
- `app/u5-battle.css`: control group 및 `×2` 활성 상태와 CSS variable 기반 HP transition을 정의한다.
- `e2e/u5-battle-preview.spec.ts`: Chromium에서 일반전/보스전 speed selection, replay 유지, 다음 replay 초기화를 확인한다.
- `docs/experience/SCREEN_LAYOUT.md`, `docs/experience/UI_IMPLEMENTATION_GUIDE.md`: 화면 위치와 결과 불변 구현 계약을 기록한다.

---

### Task 1: replay 속도 상태와 frame timer를 순수 계약으로 만든다

**Files:**
- Create: `components/game/use-u5-battle-playback.test.ts`
- Modify: `components/game/use-u5-battle-playback.ts:1-91`

**Interfaces:**
- Produces: `export type U5BattlePlaybackRate = 1 | 2`.
- Produces: `export interface U5BattlePlaybackState { signature: string; frameIndex: number; playbackRate: U5BattlePlaybackRate }`.
- Produces: `u5BattleFrameDurationMs(phase: U5BattleReplayPhase, playbackRate: U5BattlePlaybackRate): number`.
- Produces: `u5BattlePlaybackForSignature(playback: U5BattlePlaybackState, signature: string): U5BattlePlaybackState`.
- Produces: `U5BattlePlayback.playbackRate` and `U5BattlePlayback.togglePlaybackRate()`.

- [ ] **Step 1: Write the failing duration and signature-reset tests**

~~~ts
it.each([
  ["idle", 500, 250], ["attack", 360, 180], ["impact", 420, 210],
  ["settle", 520, 260], ["complete", 0, 0],
] as const)("%s phase는 ×1/×2에서 정해진 wait를 쓴다", (phase, atOne, atTwo) => {
  expect(u5BattleFrameDurationMs(phase, 1)).toBe(atOne);
  expect(u5BattleFrameDurationMs(phase, 2)).toBe(atTwo);
});

it("새 replay signature는 frame과 속도를 초기화한다", () => {
  expect(u5BattlePlaybackForSignature(
    { signature: "before", frameIndex: 4, playbackRate: 2 }, "after",
  )).toEqual({ signature: "after", frameIndex: 0, playbackRate: 1 });
});
~~~

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run components/game/use-u5-battle-playback.test.ts`

Expected: FAIL because the duration and signature-state helpers do not exist.

- [ ] **Step 3: Implement the typed state helpers**

~~~ts
export type U5BattlePlaybackRate = 1 | 2;

export function u5BattleFrameDurationMs(
  phase: U5BattleReplayPhase, playbackRate: U5BattlePlaybackRate,
): number {
  return FRAME_DURATION_MS[phase] / playbackRate;
}

export function u5BattlePlaybackForSignature(
  playback: U5BattlePlaybackState, signature: string,
): U5BattlePlaybackState {
  return playback.signature === signature ? playback : { signature, frameIndex: 0, playbackRate: 1 };
}
~~~

Use the helper to derive active state before deriving the frame. Therefore an unfamiliar signature immediately reads frame 0 and `×1`.

- [ ] **Step 4: Add the failing hook lifecycle test**

~~~ts
it("×2 전환은 같은 attack frame을 180ms wait로 다시 예약하고 replay/skip은 속도를 보존한다", () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useU5BattlePlayback(replay));
  act(() => vi.advanceTimersByTime(500));
  expect(result.current.frameIndex).toBe(1);
  act(() => result.current.togglePlaybackRate());
  act(() => vi.advanceTimersByTime(179));
  expect(result.current.frameIndex).toBe(1);
  act(() => vi.advanceTimersByTime(1));
  expect(result.current.frameIndex).toBe(2);
  act(() => result.current.skipToComplete());
  act(() => result.current.replayFromStart());
  expect(result.current).toMatchObject({ frameIndex: 0, playbackRate: 2 });
});
~~~

Use the project’s existing React hook helper. If none is installed, make a small test component exposing the hook through buttons/text; do not add a dependency.

- [ ] **Step 5: Implement the timer and actions**

~~~ts
const active = u5BattlePlaybackForSignature(playback, signature);
const timeout = window.setTimeout(
  () => setPlayback((current) => {
    const next = u5BattlePlaybackForSignature(current, signature);
    return { ...next, frameIndex: nextU5BattleFrameIndex(replay, next.frameIndex) };
  }),
  u5BattleFrameDurationMs(frame.phase, active.playbackRate),
);

togglePlaybackRate: () => setPlayback((current) => {
  const currentActive = u5BattlePlaybackForSignature(current, signature);
  return { ...currentActive, playbackRate: currentActive.playbackRate === 1 ? 2 : 1 };
}),
~~~

Add `playbackRate` to the effect dependencies so the cleanup cancels the old timeout and the same frame receives the new speed’s full duration. `replayFromStart` and `skipToComplete` must spread active state and replace only `frameIndex`. Do not schedule when replay/frame is absent or phase is `complete`.

- [ ] **Step 6: Run the hook suite to verify it passes**

Run: `pnpm vitest run components/game/use-u5-battle-playback.test.ts`

Expected: PASS for the exact table, signature reset, timeout replacement, and replay/skip retention.

- [ ] **Step 7: Commit**

~~~bash
git add components/game/use-u5-battle-playback.ts components/game/use-u5-battle-playback.test.ts
git commit -m "기능: 전투 재생 속도 상태를 추가한다" -m "리플레이별 2배속 전환과 프레임 대기 시간을 관리한다."
~~~

### Task 2: 전투 장면에 접근 가능한 speed control과 animation 배율을 적용한다

**Files:**
- Modify: `components/game/U5BattleScene.tsx:1-330`
- Modify: `components/game/U5BattleScene.test.tsx:1-260`
- Modify: `app/u5-battle.css:120-175, 330-355`

**Interfaces:**
- Consumes: `U5BattlePlaybackRate` from `./use-u5-battle-playback`.
- Consumes: `playbackRate: U5BattlePlaybackRate`, `onTogglePlaybackRate: () => void` in `U5BattleSceneProps`.
- Produces: `u5BattleMotionDuration(seconds: number, playbackRate: U5BattlePlaybackRate): number`.
- Produces: scene root `data-playback-rate="1" | "2"` and CSS variable `--u5-battle-hp-transition-duration`.

- [ ] **Step 1: Write the failing scene markup and duration tests**

~~~ts
function render(frame: U5BattleReplayFrame, playbackRate: U5BattlePlaybackRate = 1): string {
  return renderToStaticMarkup(createElement(U5BattleScene, {
    replay, frame, playbackRate, onReplayFromStart: () => {}, onTogglePlaybackRate: () => {},
  }));
}

it("재생 중에도 ×1 속도 토글을 제공한다", () => {
  const html = render(replay.frames[0]!);
  expect(html).toContain('data-playback-rate="1"');
  expect(html).toMatch(/aria-label="전투 재생 속도" aria-pressed="false"[^>]*>×1<\/button>/);
});

it("complete frame은 ×2 토글과 다시 보기를 함께 제공한다", () => {
  const html = render(replay.frames.at(-1)!, 2);
  expect(html).toMatch(/aria-label="전투 재생 속도" aria-pressed="true"[^>]*>×2<\/button>/);
  expect(html).toContain("다시 보기");
});

expect(u5BattleMotionDuration(0.24, 2)).toBe(0.12);
~~~

Also assert the CSS uses `transition: width var(--u5-battle-hp-transition-duration, 0.28s) ease` and `×2` markup carries `--u5-battle-hp-transition-duration:0.14s`.

- [ ] **Step 2: Run the scene suite to verify it fails**

Run: `pnpm vitest run components/game/U5BattleScene.test.tsx`

Expected: FAIL because current props, helper, control, and HP variable are absent.

- [ ] **Step 3: Add props, control markup, and a shared duration helper**

~~~tsx
export function u5BattleMotionDuration(seconds: number, playbackRate: U5BattlePlaybackRate): number {
  return seconds / playbackRate;
}

<section
  className="u5-battle-scene"
  data-testid="u5-battle-scene"
  data-playback-rate={playbackRate}
  style={{ "--u5-battle-hp-transition-duration": playbackRate === 2 ? "0.14s" : "0.28s" } as CSSProperties}
>
  <div className="u5-battle-controls">
    <button type="button" aria-label="전투 재생 속도" aria-pressed={playbackRate === 2} onClick={onTogglePlaybackRate}>
      ×{playbackRate}
    </button>
    {complete ? <button type="button" onClick={onReplayFromStart}>다시 보기</button> : null}
  </div>
</section>
~~~

Keep this group in the current scene top-right region, render it for every supplied frame, and never put `전투 건너뛰기` in this component.

- [ ] **Step 4: Scale every finite motion and the HP transition**

Thread `playbackRate` through `Participant` and `motionForParticipant`, and call the helper for defeat 0.24, attack 0.18, impact 0.24, idle y 1.8, and idle x 0.24. Give damage-number and cue enter/exit explicit transitions too.

~~~tsx
transition: reducedMotion
  ? { duration: 0 }
  : { duration: u5BattleMotionDuration(0.24, playbackRate) }
~~~

~~~css
.u5-battle-hp__fill {
  transition: width var(--u5-battle-hp-transition-duration, 0.28s) ease;
}

.u5-battle-controls {
  display: flex;
  gap: clamp(0.2rem, 0.4cqw, 0.4rem);
}

.u5-battle-controls button[aria-pressed="true"] {
  border-color: #f4c96a;
  background: #493112;
}
~~~

Keep reduced-motion’s existing zero-duration branch unchanged. Do not add `vw`, `vh`, or a media query.

- [ ] **Step 5: Run the scene suite to verify it passes**

Run: `pnpm vitest run components/game/U5BattleScene.test.tsx`

Expected: PASS; old rendering calls provide `playbackRate: 1` and a no-op toggle, while new checks prove the control, active state, complete pairing, motion helper, and HP variable.

- [ ] **Step 6: Commit**

~~~bash
git add components/game/U5BattleScene.tsx components/game/U5BattleScene.test.tsx app/u5-battle.css
git commit -m "기능: 전투 장면에 2배속 조작을 표시한다" -m "장면 애니메이션과 HP 전환을 재생 속도에 맞춘다."
~~~

### Task 3: 진행 화면과 실제 일반전·보스전에서 공통 speed state를 연결한다

**Files:**
- Modify: `components/game/U5ProgressScreen.tsx:210-275`
- Modify: `components/game/U5ProgressScreen.test.tsx`
- Modify: `e2e/u5-battle-preview.spec.ts:1-23`

**Interfaces:**
- Consumes: `U5BattlePlayback.playbackRate`, `U5BattlePlayback.togglePlaybackRate`, and Task 2 scene props.
- Produces: both `E3 실제 일반전` and `E4 실제 보스전` preview scenes expose the identical speed control.

- [ ] **Step 1: Write the failing progress-screen tests**

~~~ts
it("일반전 replay는 속도 control과 기존 건너뛰기 CTA를 함께 렌더링한다", () => {
  const html = render({ battleReplay: U5_TEST_BATTLE_REPLAY, battleExitPolicy: "after-playback" });
  expect(html).toContain('aria-label="전투 재생 속도"');
  expect(html).toContain('aria-pressed="false"');
  expect(html).toContain("전투 건너뛰기");
});

it("보스 replay도 같은 ×1 speed control을 받는다", () => {
  const html = render({ battleReplay: U5_BOSS_TEST_BATTLE_REPLAY });
  expect(html).toContain('aria-label="전투 재생 속도"');
  expect(html).toContain('data-playback-rate="1"');
});
~~~

Use existing normal/boss fixtures; do not author a replacement battle result.

- [ ] **Step 2: Run the focused integration test to verify it fails**

Run: `pnpm vitest run components/game/U5ProgressScreen.test.tsx`

Expected: FAIL because speed props are not yet passed to `U5BattleScene`.

- [ ] **Step 3: Pass hook-owned props without changing CTA policy**

~~~tsx
<U5BattleScene
  replay={battleReplay}
  frame={battlePlayback.frame}
  playbackRate={battlePlayback.playbackRate}
  onTogglePlaybackRate={battlePlayback.togglePlaybackRate}
  onReplayFromStart={battlePlayback.replayFromStart}
/>
~~~

Do not alter `replayingBattle`, `gateMapExit`, `showPreviewSkip`, or `rightAction`. Right-panel `전투 건너뛰기`, `지도로 돌아간다`, and the separate boss settlement policy remain unchanged.

- [ ] **Step 4: Extend Chromium coverage for the speed lifecycle**

~~~ts
test("U5-2 프리뷰에서 속도는 다시 보기에는 남고 다른 전투에는 초기화된다", async ({ page }) => {
  await page.goto("/u5-2-test");
  const speed = page.getByRole("button", { name: "전투 재생 속도" });
  await expect(speed).toHaveText("×1");
  await speed.click();
  await expect(speed).toHaveText("×2");
  await expect(speed).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "전투 건너뛰기" }).click();
  await page.getByRole("button", { name: "다시 보기" }).click();
  await expect(speed).toHaveText("×2");

  await page.getByRole("button", { name: "E4 실제 보스전" }).click();
  await expect(speed).toHaveText("×1");
  await expect(page.getByTestId("u5-battle-scene")).toHaveAttribute("data-playback-rate", "1");
  expectNoBrowserErrors(failures, "/u5-2-test");
});
~~~

Create `failures` with the existing `watchBrowserErrors(page)` at the top of this test. Keep the existing skip/replay test unchanged.

- [ ] **Step 5: Run focused unit and Chromium checks**

Run: `pnpm vitest run components/game/U5ProgressScreen.test.tsx && pnpm playwright test e2e/u5-battle-preview.spec.ts --project=chromium`

Expected: PASS; both battle types use the common control, ×2 persists through replay, the selected boss replay starts at ×1, and skip CTA behavior is unchanged.

- [ ] **Step 6: Commit**

~~~bash
git add components/game/U5ProgressScreen.tsx components/game/U5ProgressScreen.test.tsx e2e/u5-battle-preview.spec.ts
git commit -m "검증: 일반전과 보스전 2배속 흐름을 확인한다" -m "다시 보기 유지와 다음 전투 초기화를 브라우저에서 검증한다."
~~~

### Task 4: 공식 UI 문서와 전체 품질 게이트를 갱신한다

**Files:**
- Modify: `docs/experience/SCREEN_LAYOUT.md:150-168`
- Modify: `docs/experience/UI_IMPLEMENTATION_GUIDE.md:50-78`

**Interfaces:**
- Consumes: Tasks 1–3의 shipped speed lifecycle.
- Produces: code and tests와 일치하는 공식 layout·implementation guidance.

- [ ] **Step 1: Add the layout contract**

Add this sentence after the existing shared right-bottom battle CTA policy:

~~~md
전투 장면 우측 상단에는 결과 이동과 분리된 로컬 `×1 / ×2` 재생 속도 토글을 둔다. 모든 일반전과 보스전은 `×1`로 시작하고, 같은 기록의 `다시 보기`는 선택한 속도를 유지한다. 다른 전투 기록으로 바뀌면 `×1`로 돌아간다. 속도 토글은 재생 중과 complete frame 모두 남으며, 우측 하단 `전투 건너뛰기`·다음 단계 CTA의 자리나 잠금 정책을 바꾸지 않는다.
~~~

- [ ] **Step 2: Add the implementation contract**

Add this paragraph after the automatic-battle rule-result/skip invariant bullets:

~~~md
재생 속도는 장면 로컬 상태다. `×2`는 phase별 frame 대기 시간뿐 아니라 Attack Lunge, Hit Shake, 쓰러짐, 피해 숫자, 보스 cue, HP Bar와 idle의 모든 유한 animation 시간을 같은 비율로 줄인다. `prefers-reduced-motion`에서 0인 duration은 그대로 유지한다. 속도 전환, 다시 보기, 건너뛰기는 확정된 기록의 표시 순서와 시간만 바꾸며 E3/E4 결과, RNG, HP, 신뢰, 승패를 다시 계산하거나 변경하지 않는다.
~~~

- [ ] **Step 3: Run source/document consistency checks**

Run: `rg -n "전투 재생 속도|×1 / ×2|data-playback-rate|u5BattleFrameDurationMs" components/game app/u5-battle.css docs/experience && git diff --check`

Expected: every shipped UI contract is discoverable and `git diff --check` reports no whitespace errors.

- [ ] **Step 4: Run the complete regression suite**

Run: `pnpm test && pnpm playwright test --project=chromium && pnpm tsc --noEmit && pnpm lint && pnpm build`

Expected: every command exits 0. Report pre-existing lint warnings only when the command succeeds and they are unrelated.

- [ ] **Step 5: Commit and inspect the worktree**

~~~bash
git add docs/experience/SCREEN_LAYOUT.md docs/experience/UI_IMPLEMENTATION_GUIDE.md
git commit -m "문서: 전투 재생 속도 계약을 기록한다" -m "장면 속도와 전투 결과 불변 조건을 공식 UI 문서에 반영한다."
git status --short
git log -3 --oneline
~~~

Expected: only known user-owned untracked files, if any, remain outside these commits; no implementation file is left unstaged.
