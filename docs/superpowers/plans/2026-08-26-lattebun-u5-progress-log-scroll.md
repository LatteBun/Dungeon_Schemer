# U5 진행 기록 내부 스크롤 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 던전 진행 화면의 진행 기록과 생태 내용이 콘솔 높이를 넘어도 필터를 고정한 채 끝까지 읽을 수 있게 하고, 스크롤바는 hover·keyboard focus에서만 얇게 드러나게 한다.

**Architecture:** `U5ProgressScreen`은 기존 `LogPanel` 안의 목록과 생태 영역에 키보드 초점 및 accessible name만 부여한다. `app/u5-progress.css`는 두 기존 내용 영역에 native 세로 스크롤과 동일한 cross-browser scrollbar 표현을 적용한다. 기록 데이터, 필터 state, 이벤트 handler, 페이지 스크롤과 새 UI 상태는 만들지 않는다.

**Tech Stack:** Next.js 16.3.0 App Router, React 19.2.8, TypeScript 5, CSS container units, Vitest 4.1.10, Playwright 1.62.1

**Spec:** `docs/superpowers/specs/2026-08-26-lattebun-u5-progress-log-scroll-design.md`

## Global Constraints

- 구현 전에 `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`와 `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`를 읽고 Next.js 16.3.0의 CSS·Client Component 지침을 확인한다.
- 1920×1080 고정 캔버스, `GameShell` 60:40, U5 장면 40%·콘솔 60%의 비율을 바꾸지 않는다.
- 스크롤 대상은 `.u5-log__entries`와 `.u5-ecology`뿐이다. `.u5-log`, `.u5-console`, 페이지와 다른 화면에 `overflow-y`를 추가하지 않는다.
- 필터 행 `.u5-log__filters`는 스크롤되지 않으며 기존 button 외형·`aria-pressed`·click 동작을 바꾸지 않는다.
- 기본 상태에서 scrollbar track과 thumb은 투명하다. 해당 내용 영역의 `:hover` 또는 `:focus-visible`에서만 얇은 어두운 금속색 thumb을 표시한다.
- Firefox에는 `scrollbar-width`·`scrollbar-color`, WebKit에는 `::-webkit-scrollbar`·track·thumb 선택자를 함께 제공한다. 기본·노출 상태 모두 같은 얇은 폭을 유지해 내용 폭을 흔들지 않는다.
- 목록과 생태 영역은 `tabIndex={0}`과 각각의 `aria-label`을 갖는다. wheel·touch·키보드 native 동작을 JavaScript로 가로채지 않는다.
- `vw`, `vh`, 미디어 쿼리, 새 의존성, 전역 scrollbar 규칙, React state/effect/ref, 기록 데이터·정렬·필터 판정 변경을 추가하지 않는다.
- 커밋 제목과 본문은 모두 한글로 작성한다.

---

## File Structure

| 파일 | 역할 | 변경 |
| --- | --- | --- |
| `components/game/U5ProgressScreen.tsx` | U5 진행 기록과 생태 영역의 DOM·접근성 경계 | 두 native scroll container에 `tabIndex`와 설명 이름 추가 |
| `app/u5-progress.css` | U5 전용 콘솔 레이아웃과 표면 | 잘림을 세로 자동 스크롤로 교체하고 cross-browser 얇은 scrollbar 표현 추가 |
| `components/game/U5ProgressScreen.test.tsx` | U5 정적 마크업·CSS 계약 | 키보드 접근성, 세로 overflow, 기본·hover·focus scrollbar 계약 추가 |
| `e2e/u5-console-situation-readability.spec.ts` | `/u5-test` 실제 브라우저 UI 검증 | 긴 기록·생태 내용을 주입해 native 스크롤, 필터 고정, hover·focus scrollbar와 keyboard 도달성 검증 추가 |

공식 화면 규격과 설계 문서는 선행 커밋 `b811d1a`에 이미 반영됐다. 구현 커밋에는 위 네 파일만 포함한다.

### Task 1: 실패하는 U5 스크롤·접근성 계약을 추가한다

**Files:**

- Modify: `components/game/U5ProgressScreen.test.tsx:197-209, 394-409`
- Test: `components/game/U5ProgressScreen.test.tsx`

**Interfaces:**

- Consumes: `LogPanel({ log, ecology, filter, onFilter })`, `.u5-log__entries`, `.u5-ecology`, `cssRule(sheet, selector)`
- Produces: 목록 `aria-label="진행 기록 목록"`, 생태 영역 `aria-label="확인된 생태와 관찰 단서"`, 두 영역의 source-level native scroll 및 scrollbar 시각 계약

- [ ] **Step 1: 진행 기록 DOM과 CSS의 실패 계약을 작성한다.**

기존 `진행 기록 모드에서 네 필터를 제공한다` 테스트 바로 뒤에 다음 테스트를
추가한다.

```ts
it("진행 기록 목록은 키보드로 초점을 받고 콘솔 안에서만 세로 스크롤한다", () => {
  const html = render({}, { initialMode: "log" });
  const sheet = readFileSync("app/u5-progress.css", "utf8");
  const scrollArea = sheet.match(/\.u5-log__entries,\s*\.u5-ecology\s*\{[^}]*\}/)?.[0] ?? "";

  expect(html).toContain('class="u5-log__entries" tabindex="0" aria-label="진행 기록 목록"');
  expect(scrollArea).toMatch(/overflow-y:\s*auto/);
  expect(scrollArea).toMatch(/overscroll-behavior:\s*contain/);
  expect(scrollArea).toMatch(/scrollbar-width:\s*thin/);
  expect(scrollArea).toMatch(/scrollbar-color:\s*transparent transparent/);
  expect(cssRule(sheet, ".u5-log__entries")).not.toMatch(/overflow:\s*hidden/);
});

it("생태 영역은 같은 내부 스크롤과 키보드 접근성을 가진다", () => {
  const html = render({}, { initialMode: "log", initialFilter: "ecology" });
  const sheet = readFileSync("app/u5-progress.css", "utf8");
  const scrollArea = sheet.match(/\.u5-log__entries,\s*\.u5-ecology\s*\{[^}]*\}/)?.[0] ?? "";

  expect(html).toContain('class="u5-ecology" data-testid="u5-ecology" tabindex="0" aria-label="확인된 생태와 관찰 단서"');
  expect(scrollArea).toMatch(/overflow-y:\s*auto/);
  expect(scrollArea).toMatch(/overscroll-behavior:\s*contain/);
  expect(scrollArea).toMatch(/scrollbar-width:\s*thin/);
  expect(scrollArea).toMatch(/scrollbar-color:\s*transparent transparent/);
});
```

- [ ] **Step 2: 기본·hover·focus의 cross-browser scrollbar 실패 계약을 작성한다.**

위 테스트들 뒤에 다음 테스트를 추가한다. `contentSelectors`에는 목록과 생태가
동일한 selector 목록으로 묶였는지, WebKit 규칙에는 투명 기본 thumb과 노출 색이
분리됐는지를 고정한다.

```ts
it("진행 기록 scrollbar는 평소 숨고 hover와 focus에서만 얇은 금속색으로 드러난다", () => {
  const sheet = readFileSync("app/u5-progress.css", "utf8");
  const contentSelectors = ".u5-log__entries,\n.u5-ecology";
  const webkit = sheet.match(/\.u5-log__entries::-webkit-scrollbar,\s*\.u5-ecology::-webkit-scrollbar\s*\{[^}]*\}/)?.[0] ?? "";
  const webkitThumb = sheet.match(/\.u5-log__entries::-webkit-scrollbar-thumb,\s*\.u5-ecology::-webkit-scrollbar-thumb\s*\{[^}]*\}/)?.[0] ?? "";
  const visibleThumb = sheet.match(/\.u5-log__entries:hover::-webkit-scrollbar-thumb,[\s\S]*?\.u5-ecology:focus-visible::-webkit-scrollbar-thumb\s*\{[^}]*\}/)?.[0] ?? "";

  expect(sheet).toContain(contentSelectors);
  expect(webkit).toMatch(/width:\s*0\.28rem/);
  expect(webkitThumb).toMatch(/background:\s*transparent/);
  expect(visibleThumb).toMatch(/background:\s*#5a4630/);
  expect(sheet).toContain(".u5-ecology:hover::-webkit-scrollbar-thumb");
  expect(sheet).toContain(".u5-ecology:focus-visible::-webkit-scrollbar-thumb");
  expect(sheet).toContain(".u5-log__entries:hover,\n.u5-log__entries:focus-visible,");
});
```

- [ ] **Step 3: 새 단위 테스트가 현재 구현에서 실패하는지 확인한다.**

Run:

```bash
pnpm vitest run components/game/U5ProgressScreen.test.tsx
```

Expected: 새 테스트는 목록의 `overflow: hidden`, 생태의 overflow 부재, `tabIndex`·`aria-label` 부재, WebKit scrollbar selector 부재 때문에 실패한다. 기존 U5 테스트는 통과한다.

- [ ] **Step 4: 실패 결과를 유지한 채 테스트 변경만 커밋한다.**

```bash
git add components/game/U5ProgressScreen.test.tsx
git commit -m "테스트: U5 진행 기록 스크롤 계약을 추가한다" -m "진행 기록과 생태 영역의 내부 스크롤, 접근성, 스크롤바 노출 조건을 실패 테스트로 고정한다."
```

### Task 2: native 내부 스크롤과 얇은 scrollbar를 구현한다

**Files:**

- Modify: `components/game/U5ProgressScreen.tsx:201-216`
- Modify: `app/u5-progress.css:443-502`
- Test: `components/game/U5ProgressScreen.test.tsx`

**Interfaces:**

- Consumes: Task 1의 U5 DOM·CSS 계약, `LogPanel`의 기존 `filter` 분기
- Produces: focus 가능한 `.u5-log__entries`·`.u5-ecology`, 서로 같은 native vertical scroll behavior, 기본 투명·hover/focus 금속색 scrollbar

- [ ] **Step 1: `LogPanel`의 두 내용 영역에 접근성 속성을 최소로 추가한다.**

`U5ProgressScreen.tsx`에서 기존 구조와 `data-testid`를 유지한 채 아래처럼 속성만
더한다.

```tsx
<div
  className="u5-ecology"
  data-testid="u5-ecology"
  tabIndex={0}
  aria-label="확인된 생태와 관찰 단서"
>
```

```tsx
<ol className="u5-log__entries" tabIndex={0} aria-label="진행 기록 목록">
```

`nav`, filter button, filter state, list item과 생태 section의 DOM 순서는 바꾸지
않는다.

- [ ] **Step 2: U5 CSS의 content 영역에 공통 native scroll 기반을 추가한다.**

`app/u5-progress.css`에서 `.u5-log__entries`의 `overflow: hidden`을 제거하고,
두 selector의 공통 rule을 `.u5-log` 아래에 추가한다.

```css
.u5-log__entries,
.u5-ecology {
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.u5-log__entries:hover,
.u5-log__entries:focus-visible,
.u5-ecology:hover,
.u5-ecology:focus-visible {
  scrollbar-color: #5a4630 transparent;
}
```

`.u5-log__entries`와 `.u5-ecology`의 기존 `min-height: 0`, grid, gap, padding,
list-style은 유지한다. `.u5-log`와 `.u5-console`에는 새 overflow를 추가하지 않는다.

- [ ] **Step 3: WebKit scrollbar의 기본·노출 표현과 focus outline을 추가한다.**

위 공통 rule 바로 뒤에 목록과 생태에 같은 selector를 나열해 아래 규칙을 추가한다.

```css
.u5-log__entries::-webkit-scrollbar,
.u5-ecology::-webkit-scrollbar {
  width: 0.28rem;
}

.u5-log__entries::-webkit-scrollbar-track,
.u5-ecology::-webkit-scrollbar-track {
  background: transparent;
}

.u5-log__entries::-webkit-scrollbar-thumb,
.u5-ecology::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: transparent;
}

.u5-log__entries:hover::-webkit-scrollbar-thumb,
.u5-log__entries:focus-visible::-webkit-scrollbar-thumb,
.u5-ecology:hover::-webkit-scrollbar-thumb,
.u5-ecology:focus-visible::-webkit-scrollbar-thumb {
  background: #5a4630;
}

.u5-log__entries:focus-visible,
.u5-ecology:focus-visible {
  outline: 1px solid color-mix(in srgb, var(--color-shell-gold) 52%, transparent);
  outline-offset: 0.12rem;
}
```

스크롤 영역의 focus outline은 목록 안의 filter button outline과 별개다. outline을
`none`으로 바꾸거나 scrollbar 색만으로 키보드 초점을 전달하지 않는다.

- [ ] **Step 4: 단위 계약과 인접 U5 회귀를 통과시키는지 확인한다.**

Run:

```bash
pnpm vitest run components/game/U5ProgressScreen.test.tsx components/game/u5-log-filter.test.ts components/game/U5FixedCanvas.test.ts
```

Expected: Task 1의 새 계약과 기존 렌더·필터·고정 캔버스 테스트가 모두 통과한다.

- [ ] **Step 5: 구현과 단위 테스트를 커밋한다.**

```bash
git add app/u5-progress.css components/game/U5ProgressScreen.tsx components/game/U5ProgressScreen.test.tsx
git commit -m "기능: U5 진행 기록을 내부 스크롤한다" -m "긴 기록과 생태 내용을 콘솔 안에서 읽고 hover와 키보드 초점에서만 얇은 스크롤바를 보인다."
```

### Task 3: 실제 브라우저에서 긴 기록과 키보드 도달성을 검증한다

**Files:**

- Modify: `e2e/u5-console-situation-readability.spec.ts:135 이후`
- Test: `e2e/u5-console-situation-readability.spec.ts`

**Interfaces:**

- Consumes: Task 2의 `.u5-log__entries`와 `.u5-ecology` native scroll container, `/u5-test`, `watchBrowserErrors`, `expectNoBrowserErrors`
- Produces: FHD에서 마지막 injected 항목까지 스크롤·키보드로 도달하고 filter 행이 제자리에 남으며 hover/focus scrollbar가 계산 스타일로 드러난다는 회귀 계약

- [ ] **Step 1: 긴 일반 기록의 native scroll·필터 고정 실패 테스트를 작성한다.**

`e2e/u5-console-situation-readability.spec.ts` 끝에 아래 테스트를 추가한다. fixture
데이터를 바꾸지 않고 렌더된 목록에 항목을 주입해 content overflow만 만든다.

```ts
test("긴 진행 기록은 필터를 고정한 채 마지막 항목까지 내부 스크롤된다", async ({ page }) => {
  const failures = watchBrowserErrors(page);
  await useFhd(page);
  await page.getByRole("button", { name: "진행 기록", exact: true }).click();

  const metrics = await page.locator(".u5-log").evaluate((log) => {
    const filters = log.querySelector<HTMLElement>(".u5-log__filters");
    const entries = log.querySelector<HTMLOListElement>(".u5-log__entries");
    if (filters === null || entries === null) throw new Error("진행 기록 fixture가 없다");
    for (let index = 0; index < 80; index += 1) {
      const item = document.createElement("li");
      item.innerHTML = `<span class="u5-log__order">${index + 10}</span><strong>긴 기록 ${index}</strong><span>끝까지 읽어야 하는 관찰 기록 ${index}</span>`;
      entries.append(item);
    }
    const filterTop = filters.getBoundingClientRect().top;
    entries.scrollTop = entries.scrollHeight;
    const last = entries.lastElementChild?.getBoundingClientRect();
    const entriesBox = entries.getBoundingClientRect();
    return {
      overflowY: getComputedStyle(entries).overflowY,
      scrollHeight: entries.scrollHeight,
      clientHeight: entries.clientHeight,
      scrollTop: entries.scrollTop,
      filterTop,
      filterTopAfterScroll: filters.getBoundingClientRect().top,
      lastBottom: last?.bottom ?? 0,
      entriesBottom: entriesBox.bottom,
    };
  });

  expect(metrics.overflowY).toBe("auto");
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  expect(metrics.scrollTop).toBeGreaterThan(0);
  expect(metrics.filterTopAfterScroll).toBeCloseTo(metrics.filterTop, 1);
  expect(metrics.lastBottom).toBeLessThanOrEqual(metrics.entriesBottom + 1);
  expectNoBrowserErrors(failures, "긴 U5 진행 기록 내부 스크롤");
});
```

- [ ] **Step 2: 긴 생태 내용·hover/focus scrollbar·keyboard scroll 실패 테스트를 작성한다.**

위 테스트 뒤에 아래를 추가한다.

```ts
test("생태 기록은 hover와 키보드 초점에서 scrollbar를 드러내고 마지막 단서까지 이동한다", async ({ page }) => {
  const failures = watchBrowserErrors(page);
  await useFhd(page);
  await page.getByRole("button", { name: "진행 기록", exact: true }).click();
  await page.getByRole("button", { name: "생태", exact: true }).click();
  const ecology = page.getByTestId("u5-ecology");

  await ecology.evaluate((element) => {
    const list = element.querySelector("section:last-child ul");
    if (list === null) throw new Error("생태 단서 fixture가 없다");
    for (let index = 0; index < 80; index += 1) {
      const item = document.createElement("li");
      item.textContent = `긴 관찰 단서 ${index}`;
      list.append(item);
    }
  });
  await expect(ecology).toBeFocused({ timeout: 1 }).catch(() => undefined);
  await ecology.focus();
  await ecology.press("End");

  const focusMetrics = await ecology.evaluate((element) => {
    const style = getComputedStyle(element);
    const thumb = getComputedStyle(element, "::-webkit-scrollbar-thumb");
    const last = element.querySelector("section:last-child li:last-child")?.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    return {
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      scrollTop: element.scrollTop,
      scrollbarColor: style.scrollbarColor,
      thumbColor: thumb.backgroundColor,
      lastBottom: last?.bottom ?? 0,
      boxBottom: box.bottom,
    };
  });

  expect(focusMetrics.scrollHeight).toBeGreaterThan(focusMetrics.clientHeight);
  expect(focusMetrics.scrollTop).toBeGreaterThan(0);
  expect(focusMetrics.scrollbarColor).toContain("rgb(90, 70, 48)");
  expect(focusMetrics.thumbColor).toBe("rgb(90, 70, 48)");
  expect(focusMetrics.lastBottom).toBeLessThanOrEqual(focusMetrics.boxBottom + 1);
  await ecology.hover();
  await expect(ecology).toHaveCSS("scrollbar-color", "rgb(90, 70, 48) rgba(0, 0, 0, 0)");
  expectNoBrowserErrors(failures, "긴 U5 생태 기록 내부 스크롤");
});
```

테스트 러너가 pseudo element의 `backgroundColor`를 빈 문자열로 돌려주는 Chromium
버전이면 `thumbColor` assertion만 제거하고 `scrollbarColor`·hover computed style·마지막
항목 containment assertion은 유지한다. 동작 구현을 테스트 환경에 맞춰 바꾸지 않는다.

- [ ] **Step 3: 새 E2E 테스트가 현재 구현에서 실패하는지 확인한다.**

Run:

```bash
pnpm playwright test e2e/u5-console-situation-readability.spec.ts --project=chromium --workers=1
```

Expected: Task 2 전에는 일반 기록이 `overflow: hidden`이라 scrollTop이 0이고, 생태는
focusable하지 않으며 scrollbar 색 계약이 없어 두 새 테스트가 실패한다. 기존 U5
콘솔 테스트는 통과한다.

- [ ] **Step 4: Task 2 구현 뒤 브라우저 계약을 통과시키고 고정 캔버스 회귀를 확인한다.**

Run:

```bash
pnpm playwright test e2e/u5-console-situation-readability.spec.ts e2e/u5-advice-containment.spec.ts e2e/canvas-layout.spec.ts --project=chromium --workers=1
```

Expected: FHD에서 일반 기록·생태 마지막 항목이 해당 내부 영역 안에 보이고 filter
행은 움직이지 않는다. hover·focus에서 scrollbar 색이 금속색이며, 페이지 가로·세로
스크롤과 기존 U5 콘솔·캔버스 회귀가 없다.

- [ ] **Step 5: E2E 회귀 테스트를 커밋한다.**

```bash
git add e2e/u5-console-situation-readability.spec.ts
git commit -m "검증: U5 진행 기록 스크롤을 브라우저에서 확인한다" -m "긴 기록과 생태 항목의 마지막 도달성, 필터 고정, hover와 키보드 초점 표현을 검증한다."
```

### Task 4: 전체 품질 게이트와 변경 범위를 확인한다

**Files:**

- Verify: `app/u5-progress.css`
- Verify: `components/game/U5ProgressScreen.tsx`
- Verify: `components/game/U5ProgressScreen.test.tsx`
- Verify: `e2e/u5-console-situation-readability.spec.ts`

**Interfaces:**

- Consumes: Task 1~3의 테스트·구현·브라우저 회귀 계약
- Produces: 구현 완료를 주장할 수 있는 명령 출력과 제한된 diff 확인

- [ ] **Step 1: TypeScript, lint, 단위 전체와 production build를 실행한다.**

Run:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Expected: 네 명령이 모두 종료 코드 0으로 완료한다. 이 변경은 CSS와 U5 markup만
다루므로 `pnpm backtest`는 실행하지 않는다.

- [ ] **Step 2: whitespace·변경 범위·Git 상태를 확인한다.**

Run:

```bash
git diff --check HEAD~3..HEAD
git show --stat --oneline HEAD~3..HEAD
git status --short
```

Expected: whitespace 오류가 없고 구현 커밋에는 `app/u5-progress.css`,
`components/game/U5ProgressScreen.tsx`, `components/game/U5ProgressScreen.test.tsx`,
`e2e/u5-console-situation-readability.spec.ts`만 포함된다. 기존 미추적 `.pnpm-store`와
`public/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/*` 파일은 stage하거나 수정하지 않는다.

- [ ] **Step 3: 완료 전 실제 검증 출력을 기록한다.**

각 명령의 실행 시각, 종료 코드, 통과한 테스트 수와 build 결과를 작업 인계 메시지에
짧게 기록한다. 실패가 있으면 성공을 주장하지 않고 `superpowers:systematic-debugging`
으로 원인을 재조사한다.
