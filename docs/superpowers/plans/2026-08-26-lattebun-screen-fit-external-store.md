# ScreenFit External Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모바일 세로 안내의 전체 화면 가능 여부를 React 외부 상태로 구독해 `react-hooks/set-state-in-effect` 오류를 제거하면서 기존 버튼·안내 동작을 유지한다.

**Architecture:** `ScreenFit`의 캔버스 축척·회전 안내 Effect는 그대로 두고, `fullscreenAvailable`만 컴포넌트 밖의 stable subscribe/getSnapshot/getServerSnapshot 함수와 `useSyncExternalStore`로 읽는다. 브라우저 `fullscreenchange`가 발생하면 boolean snapshot을 다시 읽고, SSR과 hydration은 `false`로 시작한다.

**Tech Stack:** Next.js 16.3 App Router, React 19 `useSyncExternalStore`, TypeScript, ESLint 9 React Hooks rules, Vitest 4, Playwright Chromium

**Spec:** `docs/superpowers/specs/2026-08-26-lattebun-screen-fit-external-store-design.md`

## Global Constraints

- 기준 브랜치는 `fix/screen-fit-external-store`, 기준 커밋은 `2f33e0d`다.
- `ScreenFit.tsx`는 브라우저 API를 사용하는 기존 Client Component이며 `"use client"` 경계를 유지한다.
- 클라이언트 snapshot은 전체 화면 진입 API가 있고 `document.fullscreenElement === null`일 때만 `true`다.
- 서버 snapshot은 항상 `false`다.
- subscribe/getSnapshot/getServerSnapshot 함수는 컴포넌트 밖에 선언한다.
- `needsTurn`, visible viewport 기반 root font size 동기화, resize/orientation/visual viewport listener는 변경하지 않는다.
- `canGoFullscreen`, `enterLandscapeFullscreen`, manifest, CSS, 문구, 게임 규칙은 변경하지 않는다.
- 새 의존성을 추가하지 않는다.

---

### Task 1: 전체 화면 외부 상태 계약을 RED로 고정한다

**Files:**
- Modify: `components/game/MobileFullscreen.test.ts`
- Test: `components/game/MobileFullscreen.test.ts`

**Interfaces:**
- Consumes: existing `components/game/ScreenFit.tsx` source and `readFileSync`
- Produces: source-level regression contract for `useSyncExternalStore`, `fullscreenchange`, cleanup, server snapshot, and removed setter

- [ ] **Step 1: Write the failing source contract test**

Append this case inside `describe("전체 화면 들어가기", ...)`:

```ts
it("전체 화면 가능 여부는 Effect 상태 복사 대신 브라우저 상태를 구독한다", () => {
  const source = read("components", "game", "ScreenFit.tsx");

  expect(source).toContain("useSyncExternalStore");
  expect(source).toContain('document.addEventListener("fullscreenchange", onStoreChange)');
  expect(source).toContain('document.removeEventListener("fullscreenchange", onStoreChange)');
  expect(source).toMatch(/function fullscreenAvailabilityServerSnapshot\(\)[^{]*\{\s*return false;/);
  expect(source).not.toContain("setFullscreenAvailable");
});
```

Use the file's existing `read(...parts)` helper rather than adding another filesystem helper.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run components/game/MobileFullscreen.test.ts
```

Expected: FAIL because the source does not contain `useSyncExternalStore` or the fullscreen
subscription and still contains `setFullscreenAvailable`.

- [ ] **Step 3: Confirm the baseline lint failure remains the same**

Run:

```bash
npx eslint components/game/ScreenFit.tsx
```

Expected: exit 1 with exactly one `react-hooks/set-state-in-effect` error at the synchronous
`setFullscreenAvailable(...)` call. Do not change ESLint configuration or disable the rule.

### Task 2: `fullscreenAvailable`을 `useSyncExternalStore`로 전환한다

**Files:**
- Modify: `components/game/ScreenFit.tsx`
- Test: `components/game/MobileFullscreen.test.ts`

**Interfaces:**
- Consumes: `canGoFullscreen(target: unknown): boolean`, DOM `fullscreenchange`, `document.fullscreenElement`
- Produces: `subscribeFullscreenAvailability(onStoreChange: () => void): () => void`, `fullscreenAvailabilitySnapshot(): boolean`, `fullscreenAvailabilityServerSnapshot(): false`

- [ ] **Step 1: Import `useSyncExternalStore`**

Replace the React import with:

```ts
import { useEffect, useState, useSyncExternalStore } from "react";
```

Do not remove `useState`; `needsTurn` still uses it.

- [ ] **Step 2: Add stable browser-store functions outside the component**

Place these functions after `hasCoarsePointer` and before `ScreenFit`:

```ts
function subscribeFullscreenAvailability(onStoreChange: () => void): () => void {
  document.addEventListener("fullscreenchange", onStoreChange);
  return () => document.removeEventListener("fullscreenchange", onStoreChange);
}

function fullscreenAvailabilitySnapshot(): boolean {
  return canGoFullscreen(document.documentElement) && document.fullscreenElement === null;
}

function fullscreenAvailabilityServerSnapshot(): false {
  return false;
}
```

The functions stay outside `ScreenFit` so their identity is stable and React does not
re-subscribe after every render. The primitive boolean snapshot requires no cache object.

- [ ] **Step 3: Replace copied state with the external-store hook**

In `ScreenFit`, replace:

```ts
const [fullscreenAvailable, setFullscreenAvailable] = useState(false);
```

with:

```ts
const fullscreenAvailable = useSyncExternalStore(
  subscribeFullscreenAvailability,
  fullscreenAvailabilitySnapshot,
  fullscreenAvailabilityServerSnapshot,
);
```

Delete only this line from the existing Effect:

```ts
setFullscreenAvailable(canGoFullscreen(document.documentElement) && document.fullscreenElement === null);
```

Leave `sync()`, all viewport listeners, their cleanup, JSX branches, and click handler unchanged.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npx vitest run components/game/MobileFullscreen.test.ts
```

Expected: all mobile fullscreen tests PASS, including the new source contract.

- [ ] **Step 5: Run the target lint and verify GREEN**

Run:

```bash
npx eslint components/game/ScreenFit.tsx
```

Expected: exit 0 with no warnings or errors. If another rule reports reading a browser API or
subscription identity, fix the external-store boundary; do not suppress the rule.

- [ ] **Step 6: Commit the tested implementation**

```bash
git add components/game/ScreenFit.tsx components/game/MobileFullscreen.test.ts
git commit -m "수정: ScreenFit 전체 화면 상태를 구독한다" -m "전체 화면 가능 여부를 브라우저 외부 상태로 읽어 Effect의 동기 상태 갱신과 React Hooks 린트 오류를 제거한다."
```

### Task 3: 전체 회귀와 실제 모바일 화면을 검증한다

**Files:**
- Verify: `components/game/ScreenFit.tsx`
- Verify: `components/game/MobileFullscreen.test.ts`
- Verify: `docs/README.md`
- Verify: `docs/superpowers/specs/2026-08-26-lattebun-screen-fit-external-store-design.md`
- Verify: `docs/superpowers/plans/2026-08-26-lattebun-screen-fit-external-store.md`

**Interfaces:**
- Consumes: completed external-store implementation and existing application routes
- Produces: clean branch ready for a PR into `main`

- [ ] **Step 1: Run the complete automated verification**

Run each command after the previous one finishes so Next build does not race with TypeScript's
`.next/types` input:

```bash
npm test
npm run typecheck
npx eslint . --ignore-pattern 'playwright-report/**' --ignore-pattern 'test-results/**'
npm run build -- --webpack
git diff --check
```

Expected:

- all Vitest files and tests pass;
- TypeScript exits 0;
- ESLint has 0 errors; existing unrelated warnings may remain;
- Next.js 16.3 Webpack production build completes;
- whitespace verification exits 0.

- [ ] **Step 2: Start the isolated local server**

Run on a free port that is not used by another worktree:

```bash
npm run dev -- --webpack -p 3002
```

Expected: Next.js reports ready at `http://localhost:3002`.

- [ ] **Step 3: Verify the mobile portrait branch in Chromium**

Open `http://localhost:3002/` with a touch-capable portrait viewport such as 390×844. Confirm:

- the `가로로 돌려 주세요` alert is visible;
- exactly one of `전체 화면으로 열기` and `홈 화면에 추가` is shown according to API support;
- rotating or resizing to landscape removes the alert;
- no console error or hydration warning occurs.

- [ ] **Step 4: Verify branch scope and commit completed plan tracking**

Run:

```bash
git status --short --branch
git log --oneline --decorate -3
git diff origin/main...HEAD --stat
```

Expected: only the spec, plan, README index, ScreenFit implementation, and its regression test
differ from `origin/main`; no generated report or temporary file is tracked.

Mark every completed checkbox in this plan, then commit the plan and README index:

```bash
git add docs/README.md docs/superpowers/plans/2026-08-26-lattebun-screen-fit-external-store.md
git commit -m "문서: ScreenFit 구현 검증을 기록한다" -m "외부 상태 구독 구현과 전체 자동·모바일 브라우저 검증의 완료 상태를 계획에 반영한다."
```

- [ ] **Step 5: Push and create the PR**

```bash
git push -u origin fix/screen-fit-external-store
gh pr create --base main --head fix/screen-fit-external-store \
  --title "수정: ScreenFit 전체 화면 상태 구독" \
  --body "## 변경 사항
- 전체 화면 가능 여부를 useSyncExternalStore로 구독합니다.
- fullscreenchange에서 snapshot을 갱신하고 SSR snapshot은 false로 유지합니다.
- 모바일 안내·전체 화면 진입·캔버스 축척 동작은 변경하지 않습니다.

## 검증
- Vitest 전체 통과
- TypeScript 통과
- ESLint 오류 0개
- Next.js Webpack production build 통과
- 모바일 세로 Chromium 확인"
```

The PR body must summarize the external-store conversion, behavior-preservation boundary, and
fresh Vitest/typecheck/ESLint/build/mobile Chromium evidence. Confirm the PR base is `main`.
