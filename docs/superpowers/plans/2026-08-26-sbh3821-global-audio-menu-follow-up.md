# 전역 오디오·퀵 메뉴 후속 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 승인된 `어두운 길드의 밤 1B` BGM, 낮춘 UI 효과음, 상단 설정 묶음과 독립 업적 CTA, 앱 실행 동안 공유되는 전투 속도를 전역 퀵 메뉴에 완성한다.

**Architecture:** 루트 layout의 기존 `AppAudioProvider` 아래에 메모리 전용 `AppBattlePlaybackRateProvider`를 두고 `AppFrame`과 U5 계열 화면이 같은 context를 소비한다. 퀵 메뉴는 세 설정 행과 독립 업적 CTA로 표현하며, 결정적 WAV 생성기는 승인된 음색을 64초 seamless loop로 재현한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, HTMLAudioElement, Node.js PCM WAV 생성, Vitest, Playwright Chromium

**Spec:** `docs/superpowers/specs/2026-08-26-sbh3821-global-audio-menu-design.md`

## Global Constraints

- 기존 고립 worktree `Dungeon_Schemer-codex-achievements`와 branch `feature/global-audio-menu`에서만 작업한다.
- BGM·효과음의 최초 ON/OFF와 V1 localStorage 계약은 바꾸지 않는다.
- 전투 속도는 `1 | 2`이며 React 메모리에만 두고 localStorage·sessionStorage에 쓰지 않는다.
- 메뉴·U5·U5-2는 같은 전투 속도를 읽고 어느 쪽에서 바꿔도 즉시 동기화한다.
- 퀵 메뉴 trigger는 세로 점 3개이며 보이는 panel 제목은 두지 않는다.
- 상단 BGM·효과음·전투 속도 세 행은 같은 grid를 사용하고 업적 CTA는 구분선 아래에 둔다.
- BGM은 64초, stereo, 44,100Hz, signed PCM16이고 UI 효과음 재생 음량은 `0.28`이다.
- 새 `vw`·`vh`와 미디어 쿼리를 추가하지 않는다.
- Node 명령은 Node.js `24.19.0`, Corepack pnpm `11.21.0`으로 실행한다.

---

### Task 1: 앱 실행 동안 공유되는 전투 속도 Provider

**Files:**
- Create: `components/game/AppBattlePlaybackRateProvider.tsx`
- Modify: `components/game/use-u5-battle-playback.ts`
- Modify: `components/game/CampaignScreen.tsx`
- Modify: `components/game/U5Preview.tsx`
- Modify: `components/game/U5BattlePreview.tsx`
- Modify: `components/game/GlobalQuickMenu.test.tsx`
- Modify: `e2e/audio-menu.spec.ts`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `U5BattlePlaybackRate`, `nextU5BattlePlaybackRate(current)` from `use-u5-battle-playback.ts`
- Produces: `AppBattlePlaybackRateProvider({ children })` and `useAppBattlePlaybackRate(): U5BattlePlaybackRateControl`

- [x] **Step 1: Write failing consumer-visible shared-state tests**

```ts
expect(html).toContain("전투 속도");
expect(html).toContain("×1");

await page.goto("/u5-2-test");
const sceneSpeed = page.getByRole("button", { name: "전투 재생 속도" });
await sceneSpeed.click();
await page.getByRole("button", { name: "빠른 메뉴 열기" }).click();
await expect(page.getByRole("button", { name: "전투 속도 ×2, 누르면 ×1" })).toBeVisible();
```

Provider 내부 구조를 다시 주장하는 별도 단위 테스트 대신 실제 메뉴와 U5-2 소비자가
같은 값을 보는 통합 경계를 먼저 실패시킨다.

- [x] **Step 2: Run the focused tests and verify failure**

Run:

```bash
source /Users/semin/.nvm/nvm.sh && export pnpm_config_verify_deps_before_run=error && nvm exec 24.19.0 corepack pnpm exec vitest run components/game/GlobalQuickMenu.test.tsx
source /Users/semin/.nvm/nvm.sh && export pnpm_config_verify_deps_before_run=error && nvm exec 24.19.0 corepack pnpm exec playwright test e2e/audio-menu.spec.ts --grep "전투 속도|U5-2"
```

Expected: FAIL because the menu has no speed control and the U5-2 scene owns a local rate.

- [x] **Step 3: Implement the root memory context**

```tsx
"use client";

const PlaybackRateContext = createContext<U5BattlePlaybackRateControl | null>(null);

export function AppBattlePlaybackRateProvider({ children }: { readonly children: ReactNode }) {
  const [playbackRate, setPlaybackRate] = useState<U5BattlePlaybackRate>(1);
  const value = useMemo(() => ({
    playbackRate,
    togglePlaybackRate: () => setPlaybackRate(nextU5BattlePlaybackRate),
  }), [playbackRate]);
  return <PlaybackRateContext.Provider value={value}>{children}</PlaybackRateContext.Provider>;
}

export function useAppBattlePlaybackRate(): U5BattlePlaybackRateControl {
  const control = useContext(PlaybackRateContext);
  if (control === null) throw new Error("AppBattlePlaybackRateProvider 안에서만 쓸 수 있다");
  return control;
}
```

Remove the local-state `useU5BattlePlaybackRate` hook, wrap `AppFrame` in the new Provider in `app/layout.tsx`, and update the three U5 consumers to call `useAppBattlePlaybackRate()`.

- [x] **Step 4: Run focused tests and typecheck**

Run:

```bash
source /Users/semin/.nvm/nvm.sh && export pnpm_config_verify_deps_before_run=error && nvm exec 24.19.0 corepack pnpm exec vitest run components/game/GlobalQuickMenu.test.tsx components/game/use-u5-battle-playback.test.ts components/game/U5BattleScene.test.tsx components/game/U5ProgressScreen.test.tsx
source /Users/semin/.nvm/nvm.sh && export pnpm_config_verify_deps_before_run=error && nvm exec 24.19.0 corepack pnpm typecheck
source /Users/semin/.nvm/nvm.sh && export pnpm_config_verify_deps_before_run=error && nvm exec 24.19.0 corepack pnpm exec playwright test e2e/audio-menu.spec.ts --grep "전투 속도|U5-2"
```

Expected: all focused tests and typecheck PASS.

- [x] **Step 5: Commit Task 1**

```bash
git add app/layout.tsx components/game/AppBattlePlaybackRateProvider.tsx components/game/use-u5-battle-playback.ts components/game/CampaignScreen.tsx components/game/U5Preview.tsx components/game/U5BattlePreview.tsx components/game/GlobalQuickMenu.test.tsx e2e/audio-menu.spec.ts
git commit -m "개선: 퀵 메뉴에서 전투 속도를 공유한다" -m "루트 메모리 Provider를 추가해 퀵 메뉴와 U5 전투 화면이 같은 배속 상태를 사용한다. 저장소에는 쓰지 않아 새로고침 시 기본 배속으로 돌아간다."
```

### Task 2: 퀵 메뉴 정보 구조와 세로 점 trigger

**Files:**
- Modify: `components/game/GlobalQuickMenu.test.tsx`
- Modify: `components/game/GlobalQuickMenu.tsx`
- Modify: `components/game/AppFrame.tsx`
- Modify: `app/app-frame.css`

**Interfaces:**
- Consumes: `useAppBattlePlaybackRate()` from Task 1
- Produces: `GlobalQuickMenuProps.playbackRate: 1 | 2` and `GlobalQuickMenuProps.onTogglePlaybackRate(): void`

- [x] **Step 1: Extend the static markup test with the approved hierarchy**

```ts
expect(html).toContain("전투 속도");
expect(html).toContain("×1");
expect(html).not.toContain("길드 장부");
expect(html).toContain('class="global-quick-menu__settings"');
expect(html).toContain('class="global-quick-menu__divider"');
expect(html).toContain('class="global-quick-menu__achievements"');
expect(html.match(/class="global-quick-menu__dot"/g)).toHaveLength(3);
```

- [x] **Step 2: Run the menu test and verify failure**

Run:

```bash
source /Users/semin/.nvm/nvm.sh && export pnpm_config_verify_deps_before_run=error && nvm exec 24.19.0 corepack pnpm exec vitest run components/game/GlobalQuickMenu.test.tsx
```

Expected: FAIL because the old shield, visible header, and three-item panel remain.

- [x] **Step 3: Implement the approved menu markup and wiring**

```tsx
<span className="global-quick-menu__dots" aria-hidden="true">
  <span className="global-quick-menu__dot" />
  <span className="global-quick-menu__dot" />
  <span className="global-quick-menu__dot" />
</span>

<div className="global-quick-menu__settings">
  <button type="button" role="switch" aria-checked={bgmEnabled} className="global-quick-menu__item" onClick={onToggleBgm}>
    <span>BGM</span><strong>{bgmEnabled ? "ON" : "OFF"}</strong>
  </button>
  <button type="button" role="switch" aria-checked={sfxEnabled} className="global-quick-menu__item" onClick={onToggleSfx}>
    <span>효과음</span><strong>{sfxEnabled ? "ON" : "OFF"}</strong>
  </button>
  <button type="button" className="global-quick-menu__item" onClick={onTogglePlaybackRate}>
    <span>전투 속도</span><strong>×{playbackRate}</strong>
  </button>
</div>
<div className="global-quick-menu__divider" aria-hidden="true" />
<button className="global-quick-menu__achievements" type="button" onClick={onOpenAchievements}>
  <span>업적 기록</span><strong aria-hidden="true">›</strong>
</button>
```

`AppFrame` reads the root playback-rate context and passes the current value and toggle callback. Menu trigger, speed toggle, and achievement CTA keep `data-ui-sound="none"` because `AppFrame` plays their menu sound explicitly.

- [x] **Step 4: Replace shield/header CSS with the grouped panel CSS**

Use a three-row `.global-quick-menu__settings` grid, fixed right value column, a subtle metal divider, and a full-width but non-oversized achievement CTA. Keep `rem`, `cqw`, and `cqh` units and existing focus-visible treatment.

- [x] **Step 5: Run the focused menu and canvas tests**

Run:

```bash
source /Users/semin/.nvm/nvm.sh && export pnpm_config_verify_deps_before_run=error && nvm exec 24.19.0 corepack pnpm exec vitest run components/game/GlobalQuickMenu.test.tsx components/game/OutOfCampaignScreenConsistency.test.ts components/game/U4FixedCanvas.test.ts
```

Expected: all focused tests PASS.

- [x] **Step 6: Commit Task 2**

```bash
git add components/game/GlobalQuickMenu.test.tsx components/game/GlobalQuickMenu.tsx components/game/AppFrame.tsx app/app-frame.css
git commit -m "개선: 전역 퀵 메뉴의 설정 계층을 정돈한다" -m "세로 점 trigger와 제목 없는 패널을 적용하고 오디오·전투 속도를 같은 설정 묶음으로 정렬한다. 업적 기록은 구분선 아래의 독립 CTA로 분리한다."
```

### Task 3: 승인된 BGM과 낮춘 UI 효과음 믹스

**Files:**
- Modify: `lib/audio/audio-playback.test.ts`
- Modify: `lib/audio/audio-playback.ts`
- Modify: `lib/audio/audio-assets.test.ts`
- Modify: `scripts/generate-audio-assets.mjs`
- Regenerate: `public/assets/audio/dungeon-schemer-guild-loop.wav`
- Regenerate: `public/assets/audio/ui-select.wav`
- Regenerate: `public/assets/audio/ui-menu.wav`

**Interfaces:**
- Consumes: existing `pnpm audio:generate` command and `AudioPlaybackController`
- Produces: deterministic 64-second `어두운 길드의 밤 1B` loop and fixed UI volume `0.28`

- [x] **Step 1: Change the tests to the approved audio contract**

```ts
expect(select.volume).toBe(0.28);
expect(menu.volume).toBe(0.28);
expect(wav.sampleRate).toBe(44_100);
```

Keep the existing duration, peak, DC offset, loop seam, and SFX tail assertions.

- [x] **Step 2: Run audio tests and verify failure**

Run:

```bash
source /Users/semin/.nvm/nvm.sh && export pnpm_config_verify_deps_before_run=error && nvm exec 24.19.0 corepack pnpm exec vitest run lib/audio/audio-playback.test.ts lib/audio/audio-assets.test.ts
```

Expected: FAIL at old `0.45` UI volume and old 22,050Hz generated assets.

- [x] **Step 3: Update playback mix and deterministic generator**

Set `UI_VOLUME = 0.28` and `SAMPLE_RATE = 44_100`. Replace the simple sine pluck arrangement with deterministic bowed drones, seeded Karplus-Strong lute, dulcimer partials, low frame drum, sparse breathy pipe, and circular room reflections. Quantize sustained frequencies to the 64-second loop and avoid transient starts close enough to the seam to leave a clipped tail.

- [x] **Step 4: Regenerate the three committed WAV assets**

Run:

```bash
source /Users/semin/.nvm/nvm.sh && export pnpm_config_verify_deps_before_run=error && nvm exec 24.19.0 corepack pnpm audio:generate
```

Expected: exactly the three canonical WAV filenames are regenerated.

- [x] **Step 5: Run audio contract tests twice around regeneration**

Run:

```bash
source /Users/semin/.nvm/nvm.sh && export pnpm_config_verify_deps_before_run=error && nvm exec 24.19.0 corepack pnpm exec vitest run lib/audio/audio-playback.test.ts lib/audio/audio-assets.test.ts
source /Users/semin/.nvm/nvm.sh && export pnpm_config_verify_deps_before_run=error && nvm exec 24.19.0 corepack pnpm audio:generate
git diff --exit-code -- public/assets/audio/dungeon-schemer-guild-loop.wav public/assets/audio/ui-select.wav public/assets/audio/ui-menu.wav
```

Expected: tests PASS and the second deterministic generation creates no diff.

- [x] **Step 6: Commit Task 3**

```bash
git add lib/audio/audio-playback.test.ts lib/audio/audio-playback.ts lib/audio/audio-assets.test.ts scripts/generate-audio-assets.mjs public/assets/audio/dungeon-schemer-guild-loop.wav public/assets/audio/ui-select.wav public/assets/audio/ui-menu.wav
git commit -m "개선: 길드 BGM과 조작음 믹스를 다듬는다" -m "승인된 어두운 길드의 밤 음색을 64초 결정적 루프로 확장하고 UI 효과음 재생 음량을 낮춰 화면 조작을 가리지 않게 한다."
```

### Task 4: 실제 브라우저 동기화와 회귀 검증

**Files:**
- Modify: `e2e/audio-menu.spec.ts`
- Modify: `e2e/campaign-smoke.spec.ts`
- Modify: `components/game/campaign-render.test.tsx`
- Modify: `docs/README.md`
- Modify: `docs/experience/SCREEN_LAYOUT.md`
- Modify: `docs/experience/ONBOARDING_AND_INTERFACE.md`
- Modify: `docs/experience/UI_IMPLEMENTATION_GUIDE.md`
- Modify: `docs/technical/DEVELOPMENT_ENVIRONMENT.md`
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`
- Modify: `docs/technical/SESSION_PERSISTENCE_REVIEW.md`
- Modify: `docs/diagram/png/screen-global-menu.png`

**Interfaces:**
- Consumes: global menu and playback-rate context from Tasks 1–2
- Produces: browser proof that route transitions preserve `×2`, reload resets to `×1`, and U5 scene/menu controls stay synchronized

- [x] **Step 1: Add failing Playwright coverage**

```ts
await page.goto("/");
await page.getByRole("button", { name: "빠른 메뉴 열기" }).click();
await page.getByRole("button", { name: /전투 속도 ×1/ }).click();
await expect(page.getByRole("button", { name: /전투 속도 ×2/ })).toBeVisible();
await page.getByRole("link", { name: /캠페인 시작/ }).click();
await page.getByRole("button", { name: "빠른 메뉴 열기" }).click();
await expect(page.getByRole("button", { name: /전투 속도 ×2/ })).toBeVisible();
await page.reload();
await page.getByRole("button", { name: "빠른 메뉴 열기" }).click();
await expect(page.getByRole("button", { name: /전투 속도 ×1/ })).toBeVisible();
```

Add a `/u5-2-test` assertion that toggling the scene control updates the menu and toggling the menu updates the scene control.

- [x] **Step 2: Run the focused E2E test and resolve selector-only mismatches**

Run:

```bash
source /Users/semin/.nvm/nvm.sh && export pnpm_config_verify_deps_before_run=error && nvm exec 24.19.0 corepack pnpm exec playwright test e2e/audio-menu.spec.ts
```

Expected: all audio-menu scenarios PASS without changing product behavior to satisfy a brittle selector.

- [x] **Step 3: Synchronize official docs and remove preview-only assets from `public`**

Document the grouped menu, session-only speed, 1B BGM, 44,100Hz generation, and UI volume `0.28`. Move `public/assets/audio/previews/` out of the worktree because previews are review artifacts rather than shipped assets.

- [x] **Step 4: Run full verification**

Run:

```bash
source /Users/semin/.nvm/nvm.sh && export pnpm_config_verify_deps_before_run=error && nvm exec 24.19.0 corepack pnpm lint
source /Users/semin/.nvm/nvm.sh && export pnpm_config_verify_deps_before_run=error && nvm exec 24.19.0 corepack pnpm typecheck
source /Users/semin/.nvm/nvm.sh && export pnpm_config_verify_deps_before_run=error && nvm exec 24.19.0 corepack pnpm exec vitest run --maxWorkers=1
source /Users/semin/.nvm/nvm.sh && export pnpm_config_verify_deps_before_run=error && nvm exec 24.19.0 corepack pnpm test:e2e
source /Users/semin/.nvm/nvm.sh && export pnpm_config_verify_deps_before_run=error && nvm exec 24.19.0 corepack pnpm build --webpack
```

Expected: typecheck, unit, E2E, and build PASS. If full lint still reports only the documented pre-existing `components/game/ScreenFit.tsx:118 react-hooks/set-state-in-effect`, run ESLint on every changed TS/TSX file and record that clean result separately.

- [x] **Step 5: Commit Task 4**

```bash
git add e2e/audio-menu.spec.ts docs
git commit -m "문서: 전역 메뉴와 오디오 검증 계약을 동기화한다" -m "세션 전투 속도와 새 메뉴 계층, 승인된 BGM 믹스의 브라우저 회귀 및 재현 절차를 공식 문서에 반영한다."
```
