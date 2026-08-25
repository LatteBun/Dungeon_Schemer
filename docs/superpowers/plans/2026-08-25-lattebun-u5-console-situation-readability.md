# U5 행동/조언 헤더와 현재 상황 패널 가독성 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** U5 하단 콘솔의 모드 탭을 진행 기록 필터와 시각적으로 분리하고, 공식 상황 문구를 제목 있는 얕은 패널로 표시한다.

**Architecture:** `U5ProgressScreen`의 기존 화면 로컬 `mode` state와 `progress.situation` 흐름을 그대로 사용한다. JSX에는 U5 전용 상황 section만 추가하고, `app/u5-progress.css`에서 모드 탭과 로그 필터 selector를 분리한다. Store·도메인·콘텐츠 생성 규칙은 바꾸지 않으며, `allSituationEvents()`의 현재 공식 corpus를 렌더와 브라우저 containment 기준으로 사용한다.

**Tech Stack:** Next.js 16.3.0 App Router, React 19.2.8, TypeScript 5, Vitest 4.1.10, Playwright 1.62.1, CSS container units

**Spec:** `docs/superpowers/specs/2026-08-25-lattebun-u5-console-situation-readability-design.md`

## Global Constraints

- 실행 시작 전에 `origin/main`으로 rebase하고, main에 있는 `playbackRate`·`onTogglePlaybackRate` props를 보존한다.
- 현재 작업 트리에 다른 사람이 만든 수정이 있으면 그것을 stash·reset·checkout하지 않는다. 깨끗한 linked worktree에서 이 브랜치를 rebase하고 Plan을 실행한다.
- 구현 전 `docs/README.md`, `docs/GAME_PRINCIPLES.md`, `docs/experience/SCREEN_LAYOUT.md`, `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`, `node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md`, `node_modules/next/dist/docs/03-architecture/accessibility.md`를 읽는다.
- `progress.situation`의 adapter·Store·도메인 타입·서비스·콘텐츠 생성 규칙은 변경하지 않는다.
- 탭은 실제 `button`, click handler, `is-active`, `aria-pressed`를 유지하고 완전한 ARIA tabs 구현 없이 `role="tab"`을 추가하지 않는다.
- 1920×1080 고정 캔버스, GameShell 60:40, U5 장면 40%·콘솔 60%, `rem`·`cqw`·`cqh`를 유지한다. `vw`, `vh`, 화면별 `@media`, 새 의존성을 추가하지 않는다.
- 상황 패널에는 고정/최대 높이, 말줄임, `overflow: hidden`, 자체 세로 스크롤을 추가하지 않는다. 제목과 본문 margin은 명시적으로 0으로 둔다.
- 조언 카드의 JSX와 `.u5-advice*`, 결과의 JSX와 `.u5-outcome*`, 진행 기록의 데이터/필터 기능은 변경하지 않는다.
- 긴 문구의 지원 경계는 `allSituationEvents()`가 반환하는 공식 `SituationEvent` corpus다. 범위를 넘는 콘텐츠를 UI 스크롤이나 절단으로 숨기지 않는다.
- 커밋 제목과 본문은 모두 한글로 작성한다.

---

## File Structure

| 파일 | 역할 | 변경 |
| --- | --- | --- |
| `components/game/U5ProgressScreen.tsx` | 콘솔 모드와 U5 선택 전/후 화면을 렌더한다. | 기존 상황 문단을 제목 있는 section으로 감싼다. |
| `app/u5-progress.css` | U5 namespace CSS와 고정 캔버스 내부 배치를 소유한다. | 모드 탭 selector를 로그 필터에서 분리하고 panel 규칙을 추가한다. |
| `components/game/U5ProgressScreen.test.tsx` | U5 화면 SSR DOM·CSS 계약을 고정한다. | panel, 초기 모드, 최장 공식 문구, CSS 경계를 검증한다. |
| `e2e/u5-console-situation-readability.spec.ts` | 실제 클릭과 FHD containment를 검증한다. | 신규: 모드 전환, 로그 필터 계산 스타일, 선택 전/후 최장 문구를 검증한다. |
| `docs/README.md` | 승인 설계와 계획의 탐색 색인이다. | 이번 Spec과 Plan 링크를 추가한다. |

`CampaignStoreProvider`, `campaign-adapters.ts`, `u5-progress-model.ts`, `u5-log.ts`, `AdviceOption`, `Outcome`, `/u5-test` 공개 프리뷰 데이터는 변경하지 않는다.

### Task 1: U5 상황 패널과 분리된 탭 CSS 계약

**Files:**

- Modify: `components/game/U5ProgressScreen.tsx:268-302`
- Modify: `app/u5-progress.css:105-149`
- Modify: `components/game/U5ProgressScreen.test.tsx:1-261`
- Test: `components/game/U5ProgressScreen.test.tsx`

**Interfaces:**

- Consumes: `U5ProgressView["situation"]: string`, `U5ConsoleMode = "advice" | "log"`, `allSituationEvents(): readonly SituationEvent[]`
- Produces: `.u5-situation-panel`, `.u5-situation-panel__title`, 유지된 `data-testid="u5-situation"`, 독립된 `.u5-console__tabs` 및 `.u5-log__filters` 규칙

- [ ] **Step 1: 최신 main을 반영하고 U5 호출부의 필수 props를 보존한다.**

```bash
git fetch origin
git rebase origin/main
rg -n "<U5ProgressScreen|playbackRate|onTogglePlaybackRate" components/game
```

Expected: 모든 실제 호출부와 테스트 helper가 main의 `playbackRate`·`onTogglePlaybackRate` 계약을 유지한다. rebase 충돌은 U5 재생 속도 기능을 되돌리지 않는 방향으로만 해소한다.

- [ ] **Step 2: panel·초기 모드·최장 공식 문구의 실패 테스트를 작성한다.**

`U5ProgressScreen.test.tsx`에 registry import와 helper를 추가한다.

```ts
import { allSituationEvents } from "@/lib/content/event-registry";

const longestSituation = allSituationEvents().reduce(
  (longest, event) => event.description.length > longest.length ? event.description : longest,
  "",
);
```

아래 계약을 추가한다.

```ts
it("현재 상황 제목과 본문을 같은 패널에 둔다", () => {
  const html = render();
  const panel = html.match(/<section class="u5-situation-panel"[\s\S]*?<\/section>/)?.[0] ?? "";

  expect(panel).toContain('aria-labelledby="u5-situation-title"');
  expect(panel).toContain('<h3 id="u5-situation-title" class="u5-situation-panel__title">현재 상황</h3>');
  expect(panel).toContain('data-testid="u5-situation"');
});

it.each([
  ["advice", "행동 / 조언", "진행 기록"],
  ["log", "진행 기록", "행동 / 조언"],
] as const)("initialMode=%s는 %s만 활성화한다", (initialMode, activeLabel, inactiveLabel) => {
  const html = render({}, { initialMode });

  expect(html).toMatch(new RegExp(`<button[^>]*class="is-active"[^>]*aria-pressed="true"[^>]*>${activeLabel}</button>`));
  expect(html).toMatch(new RegExp(`<button[^>]*aria-pressed="false"[^>]*>${inactiveLabel}</button>`));
});

it("최장 공식 상황 문구를 선택 전과 선택 후에 그대로 둔다", () => {
  const before = render({ situation: longestSituation });
  const after = render({
    situation: longestSituation,
    outcome: { reactions: [], resultText: "결과", changes: [{ label: "변화", detail: "그대로다." }] },
  });

  expect(before).toContain(`data-testid="u5-situation">${longestSituation}</p>`);
  expect(after).toContain(`data-testid="u5-situation">${longestSituation}</p>`);
  expect(after.indexOf('class="u5-situation-panel"')).toBeLessThan(after.indexOf('data-testid="u5-outcome"'));
});
```

CSS source test에는 panel rule을 추출해 `box-sizing`, `min-width`, border, background, padding과 title `margin: 0`을 요구하고, panel에 `height`, `max-height`, `overflow`가 없음을 확인한다. 분리 후 `.u5-log__filters button`에 현재의 `border: 1px solid var(--color-edge)`, `background: rgb(12 9 6 / 80%)`, `color: var(--color-muted)`가 남는지도 검사한다.

- [ ] **Step 3: 새 테스트가 실패함을 확인한다.**

```bash
pnpm vitest run components/game/U5ProgressScreen.test.tsx
```

Expected: `u5-situation-panel`이 없고 탭/로그 필터 selector가 결합되어 있어 새 계약이 실패한다. 기존 재생 테스트가 실패하면 rebase에서 필수 props를 잃었는지 먼저 고친다.

- [ ] **Step 4: JSX를 얕은 section으로 교체한다.**

`U5ProgressScreen.tsx`의 기존 단독 문단을 정확히 아래 구조로 교체한다. `progress.situation`, test id, 조언/결과 조건문, 모든 탭 handler는 유지한다.

```tsx
<section className="u5-situation-panel" aria-labelledby="u5-situation-title">
  <h3 id="u5-situation-title" className="u5-situation-panel__title">
    현재 상황
  </h3>
  <p className="u5-situation" data-testid="u5-situation">
    {progress.situation}
  </p>
</section>
```

- [ ] **Step 5: 탭과 상황 패널 CSS를 최소한으로 분리한다.**

현재 공유 selector를 아래 책임으로 나눈다. 로그 필터에는 기존 공유 선언을 그대로 복사한다.

```css
.u5-console__tabs {
  display: flex;
  gap: clamp(0.25rem, 0.35cqw, 0.55rem);
}

.u5-console__tabs button {
  border: 1px solid var(--color-edge);
  border-radius: 0.2rem;
  background: rgb(12 9 6 / 80%);
  color: var(--color-muted);
  padding: clamp(0.22rem, 0.3cqw, 0.45rem) clamp(0.5rem, 0.7cqw, 1rem);
  font-size: clamp(0.76rem, 0.8cqw, 1.1rem);
  cursor: pointer;
}

.u5-console__tabs button.is-active {
  border-color: var(--color-shell-gold);
  background: #3b2a14;
  color: #fff3cc;
}

.u5-console__tabs button:hover:not(.is-active) {
  border-color: color-mix(in srgb, var(--color-shell-gold) 55%, var(--color-edge));
  color: var(--color-parchment);
}

.u5-console__tabs button:focus-visible {
  outline: 2px solid var(--color-parchment);
  outline-offset: 2px;
}
```

상황 panel에는 아래 선언만 추가한다. `.u5-advice-mode`, `.u5-advice*`, `.u5-outcome*`에는 선언을 추가하거나 변경하지 않는다.

```css
.u5-situation-panel {
  box-sizing: border-box;
  min-width: 0;
  padding: clamp(0.35rem, 0.48cqw, 0.75rem);
  border: 1px solid color-mix(in srgb, var(--color-shell-metal) 34%, var(--color-edge));
  border-radius: 0.2rem;
  background: rgb(10 8 6 / 55%);
  box-shadow: inset 0 1px 0 rgb(244 214 145 / 6%);
}

.u5-situation-panel__title {
  margin: 0 0 clamp(0.16rem, 0.22cqw, 0.34rem);
  color: var(--color-shell-gold);
  font-size: clamp(0.68rem, 0.70cqw, 0.92rem);
  line-height: 1.2;
}

.u5-situation {
  margin: 0;
  color: #e7d7ae;
  font-size: clamp(0.74rem, 0.78cqw, 1.05rem);
  line-height: 1.45;
}
```

- [ ] **Step 6: 단위·CSS 계약을 통과시키고 범위 밖 selector가 바뀌지 않았는지 확인한다.**

```bash
pnpm vitest run components/game/U5ProgressScreen.test.tsx components/game/U5FixedCanvas.test.ts components/game/u5-advice-presentation.test.ts components/game/u5-log-filter.test.ts
git diff --check
git diff -- app/u5-progress.css components/game/U5ProgressScreen.tsx
```

Expected: 관련 Vitest 테스트가 통과하며 diff에 `.u5-advice*`, `.u5-outcome*`, adapter, Store, 도메인 타입 변경이 없다.

- [ ] **Step 7: 첫 번째 변경 단위를 커밋한다.**

```bash
git add components/game/U5ProgressScreen.tsx app/u5-progress.css components/game/U5ProgressScreen.test.tsx
git commit -m "기능: U5 현재 상황 패널을 분리한다" -m "행동·조언 모드 탭을 진행 기록 필터와 분리하고, 상황 지문을 제목 있는 독립 section으로 렌더한다. 조언 카드와 결과 영역의 구조는 유지한다."
```

### Task 2: 실제 모드 전환과 공식 콘텐츠 containment 회귀

**Files:**

- Create: `e2e/u5-console-situation-readability.spec.ts`
- Modify: `app/u5-progress.css` only when Task 1 selectors need containment-safe spacing
- Test: `e2e/u5-console-situation-readability.spec.ts`

**Interfaces:**

- Consumes: `/u5-test`의 preview 버튼, `data-testid="u5-console"`, `u5-situation`, `u5-log`, `u5-outcome`, `allSituationEvents()`
- Produces: FHD에서 실제 탭 클릭, 로그 필터 계산 스타일, 선택 전/후 최장 공식 문구 containment를 고정하는 Playwright 회귀 계약

- [ ] **Step 1: FHD 모드 전환 실패 E2E를 작성한다.**

```ts
import { expect, test, type Page } from "@playwright/test";
import { allSituationEvents } from "@/lib/content/event-registry";
import { expectNoBrowserErrors, watchBrowserErrors } from "./browser-errors";

const longestSituation = allSituationEvents().reduce(
  (longest, event) => event.description.length > longest.length ? event.description : longest,
  "",
);

async function useFhd(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/u5-test");
}
```

```ts
test("행동/조언과 진행 기록은 실제 클릭으로 aria-pressed와 표시 영역을 함께 전환한다", async ({ page }) => {
  const failures = watchBrowserErrors(page);
  await useFhd(page);
  const advice = page.getByRole("button", { name: "행동 / 조언", exact: true });
  const log = page.getByRole("button", { name: "진행 기록", exact: true });

  await expect(advice).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("u5-situation")).toBeVisible();
  await log.click();
  await expect(log).toHaveAttribute("aria-pressed", "true");
  await expect(advice).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("u5-log")).toBeVisible();
  await expect(page.getByTestId("u5-situation")).toHaveCount(0);
  await advice.click();
  await expect(page.getByTestId("u5-situation")).toBeVisible();
  expectNoBrowserErrors(failures, "U5 콘솔 모드 전환");
});
```

- [ ] **Step 2: 로그 필터와 최장 문구 containment의 실패 E2E를 추가한다.**

진행 기록으로 전환한 뒤 `.u5-log__filters button` 네 개의 FHD computed style에서 다음 기존 값을 확인한다.

```ts
expect(style).toMatchObject({
  borderTopWidth: "1px",
  borderTopColor: "rgb(58, 46, 35)",
  backgroundColor: "rgba(12, 9, 6, 0.8)",
  color: "rgb(203, 188, 165)",
  paddingTop: "5.76px",
  paddingRight: "13.44px",
  fontSize: "15.36px",
});
```

선택 전과 `일반 사건 · 선택 후` preview에서 각각 `data-testid="u5-situation"`의 `textContent`를 `longestSituation`으로 바꾼다. 기존 `u5-advice-containment.spec.ts`처럼 DOM 주입만 사용하며 preview 항목이나 제품 props를 추가하지 않는다. `u5-console` 안에서 panel, advice list 또는 outcome, 각 `.u5-outcome__step`의 bounding box가 console rect를 벗어나지 않고 각 요소의 `scrollHeight <= clientHeight`인지 확인한다.

- [ ] **Step 3: 새 E2E가 실패함을 확인한다.**

```bash
pnpm playwright test e2e/u5-console-situation-readability.spec.ts --project=chromium
```

Expected: Task 1에서 구현한 panel·분리 selector가 실제 브라우저에서 발견된다. 실패가 남으면 U5 전용 panel/tabs CSS 또는 fixed-canvas containment에만 문제가 있어야 한다.

- [ ] **Step 4: 허용된 U5 전용 selector만 조정해 브라우저 계약을 통과시킨다.**

조정 대상은 `.u5-console__tabs*`, `.u5-situation-panel*`, `.u5-situation`뿐이다. `scrollHeight > clientHeight`가 남으면 스크롤·절단을 추가하지 않고 spec 재검토를 요청한다.

- [ ] **Step 5: 새 E2E와 기존 고정 캔버스/카드 회귀를 통과시킨다.**

```bash
pnpm playwright test e2e/u5-console-situation-readability.spec.ts e2e/u5-advice-containment.spec.ts e2e/canvas-layout.spec.ts --project=chromium
```

Expected: 새 U5 콘솔 테스트, 긴 상인 카드 containment, FHD·QHD·16:10·5:4 고정 캔버스 테스트가 통과한다.

- [ ] **Step 6: 두 번째 변경 단위를 커밋한다.**

```bash
git add e2e/u5-console-situation-readability.spec.ts app/u5-progress.css components/game/U5ProgressScreen.test.tsx
git commit -m "검증: U5 상황 패널 회귀를 고정한다" -m "실제 모드 전환과 진행 기록 필터 스타일, 공식 상황 문구의 선택 전후 containment를 Chromium에서 검증한다."
```

### Task 3: 문서 색인과 전체 검증

**Files:**

- Modify: `docs/README.md:100-115`
- Test: `docs/DOCUMENT_TERMINOLOGY.test.ts`
- Test: `components/game/U5ProgressScreen.test.tsx`
- Test: `e2e/u5-console-situation-readability.spec.ts`

**Interfaces:**

- Consumes: 승인된 Spec과 이 Plan의 상대 경로
- Produces: `docs/README.md`에서 찾을 수 있는 U5 설계·계획 링크와 최종 검증 가능한 변경 단위

- [ ] **Step 1: README 색인에 설계와 계획 링크를 추가한다.**

`docs/README.md`의 “이번 개편 설계”에서 U5 조언 카드 문서와 진행 화면 UX 문서 사이에 아래 항목을 넣는다.

```md
- [U5 현재 상황 패널 가독성 개선 설계](superpowers/specs/2026-08-25-lattebun-u5-console-situation-readability-design.md): 행동/조언 탭의 시각 분리와 공식 상황 문구를 수용하는 독립 패널의 DOM·CSS·접근성 계약
- [U5 현재 상황 패널 가독성 개선 구현 계획](superpowers/plans/2026-08-25-lattebun-u5-console-situation-readability.md): 상황 패널·분리된 탭·공식 콘텐츠 containment의 테스트 우선 구현 순서
```

- [ ] **Step 2: 문서 색인 테스트를 통과시킨다.**

```bash
pnpm vitest run docs/DOCUMENT_TERMINOLOGY.test.ts
```

Expected: 문서 용어와 링크 관련 테스트가 통과한다.

- [ ] **Step 3: 전체 품질 게이트를 실행한다.**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm playwright test e2e/u5-console-situation-readability.spec.ts e2e/u5-advice-containment.spec.ts e2e/canvas-layout.spec.ts --project=chromium
git diff --check
```

Expected: 모든 명령이 종료 코드 0으로 끝난다. `pnpm backtest`는 실행하지 않는다. 이 작업으로 stage한 diff에는 구현 파일 다섯 개와 이번 Spec·Plan 문서, 총 일곱 파일만 있으며 Store·도메인·adapter·콘텐츠 데이터·조언 카드·결과 영역 변경은 없다.

- [ ] **Step 4: 문서 변경을 커밋한다.**

```bash
git add docs/README.md docs/superpowers/specs/2026-08-25-lattebun-u5-console-situation-readability-design.md docs/superpowers/plans/2026-08-25-lattebun-u5-console-situation-readability.md
git commit -m "문서: U5 상황 패널 설계와 계획을 색인한다" -m "현재 상황 패널의 콘텐츠 경계와 검증 계획을 README에서 찾을 수 있게 연결한다."
```

## Spec Coverage Review

| Spec 계약 | Plan task |
| --- | --- |
| 실제 button·`is-active`·`aria-pressed` 유지, 부분 ARIA tabs 금지 | Task 1, Task 2 |
| 제목 있는 section, 기존 test id, 선택 후 유지 | Task 1 |
| 제목/본문 typography, dark frame, margin/overflow 경계 | Task 1 |
| 모드 탭과 로그 필터 CSS 분리, 로그 외형 보존 | Task 1, Task 2 |
| 카드/결과/Store/adapter/type/service 비변경 | Global Constraints, Task 1, Task 2, Task 3 |
| `allSituationEvents()` 최장 문구의 선택 전·후 수용 | Task 1, Task 2 |
| 1920×1080 고정 캔버스와 축소 회귀 | Global Constraints, Task 2 |
| README 색인, 공식 게임 문서 본문 비변경 | Task 3 |

Self-review completed: all Spec requirements map to a task; identifiers and file paths match the current repository; no unresolved placeholders remain.
