# U5 파티 카드 기록 스크롤바 숨김 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** U5 진행 화면의 뒤집힌 파티 카드에서 브라우저 기본 세로 스크롤바만 숨기고, 네이티브 스크롤과 마지막 원정 기록 접근은 유지한다.

**Architecture:** 공용 카드의 스크롤 기능은 `app/party-card.css`의 `.party-card__back { overflow-y: auto; }`에 그대로 둔다. `app/u5-progress.css`가 `.u5-progress-screen` 아래에서 Firefox와 Chromium·WebKit의 스크롤바 시각 요소만 숨기며, 정적 CSS 계약과 실제 Chromium wheel 동작을 서로 다른 테스트 층에서 검증한다.

**Tech Stack:** Next.js 16.3.0, React 19.2.8, TypeScript 5, CSS, Vitest 4.1.10, Playwright 1.62.1

**Spec:** `docs/superpowers/specs/2026-08-26-lattebun-u5-party-card-hidden-scrollbar-design.md`

**작성자:** LatteBun

**작성 도구:** Codex · Superpowers Writing Plans

## Global Constraints

- `app/party-card.css`의 `.party-card__back { overflow-y: auto; }`를 제거하거나 다른 값으로 바꾸지 않는다.
- 스크롤바 비시각화 selector는 반드시 `.u5-progress-screen` 아래로 제한하고 U3·U4에 전파하지 않는다.
- Firefox는 `scrollbar-width: none`, Chromium·WebKit은 `::-webkit-scrollbar { display: none; }`을 함께 사용한다.
- `overflow: hidden`, `overflow-y: hidden`, `overflow: clip`, `overflow-y: clip`, 새 `max-height`를 카드 뒷면에 추가하지 않는다.
- `U5ProgressScreen.tsx`, `PartyMemberCard.tsx`, 프리뷰 데이터, Store, domain/rules, ARIA와 포커스 구조를 변경하지 않는다.
- 새 스크롤 상태, ref, effect, wheel·touch·keyboard 이벤트 핸들러와 커스텀 스크롤 컴포넌트를 만들지 않는다.
- 내부 기록의 독립 키보드 스크롤은 이번 완료 조건이 아니다. 바깥 카드 버튼의 기존 Space·Enter 뒤집기 계약만 보존한다.
- 브라우저 fixture는 `/u5-test`의 실제 U5 카드 크기와 CSS cascade를 사용하되, 합성 DOM은 Playwright 페이지 수명 안에서만 존재해야 한다.
- 공식 게임·시스템·화면 문서와 이미지 에셋은 변경하지 않는다.
- 커밋 메시지는 제목과 본문을 모두 한글로 작성한다.

---

## 실행 전 준비

- [ ] **Step 1: 구현 브랜치를 최신 main과 동기화한다**

```bash
git fetch origin
git merge-base --is-ancestor origin/main HEAD
```

두 번째 명령이 exit code 1이면 다음과 같이 한글 제목·본문을 가진 merge commit으로 최신 main을 반영한다.

```bash
git merge origin/main -m "병합: 최신 main을 U5 파티 카드 브랜치에 반영한다" -m "최신 U5 진행 기록 스크롤 계약과 프로젝트 검증 기준 위에서 파티 카드 스크롤바 숨김을 구현한다."
```

Run again:

```bash
git merge-base --is-ancestor origin/main HEAD
```

Expected: exit code 0. `components/game/U5ProgressScreen.test.tsx`에 진행 기록·생태 영역의 `scrollbar-width: thin` 계약이 존재해야 한다.

- [ ] **Step 2: 의존성과 관련 기준 테스트를 확인한다**

```bash
pnpm install --frozen-lockfile
pnpm exec vitest run components/game/U5ProgressScreen.test.tsx components/game/PartyMemberCard.test.tsx components/game/U5FixedCanvas.test.ts
```

Expected: 관련 Vitest 파일 3개가 모두 PASS한다. 기준 실패가 있으면 기능 파일을 수정하지 말고 정확한 실패를 먼저 보고한다.

---

## 파일 구조

- `components/game/U5ProgressScreen.test.tsx`
  - `app/u5-progress.css`와 `app/party-card.css`의 책임 경계를 정적으로 검증한다.
  - U5 selector가 Firefox와 WebKit 계약을 모두 가지며, 공용 selector는 숨김 규칙을 갖지 않는지 고정한다.
- `app/u5-progress.css`
  - U5 파티 카드 뒷면의 scrollbar 시각 비시각화만 소유한다.
- `e2e/u5-party-card-scroll.spec.ts`
  - 제품 컴포넌트를 바꾸지 않고 기존 U5 카드 안에 결정적 overflow fixture를 합성한다.
  - 실제 wheel 이동, 마지막 항목 도달, computed style, 카드 정렬과 캔버스 containment를 검증한다.
- 변경하지 않는 소유자
  - `components/game/PartyMemberCard.test.tsx`: 공용 카드 DOM·버튼·ARIA·전체 기록 렌더링
  - `components/game/U5FixedCanvas.test.ts`: 고정 캔버스와 우측 패널 배치
  - `app/party-card.css`: 공용 카드의 `overflow-y: auto`

### Task 1: U5 전용 scrollbar 계약과 브라우저 회귀를 테스트 우선으로 구현

**Files:**
- Modify: `components/game/U5ProgressScreen.test.tsx` — `cssRule` helper 근처와 U5 스크롤 계약 테스트 구역
- Create: `e2e/u5-party-card-scroll.spec.ts`
- Modify: `app/u5-progress.css` — `/* ── 우측 파티 상태 ── */` 구역의 `.u5-party` 규칙 뒤

**Interfaces:**
- Consumes: `.party-card__back`, `.party-card.is-flipped .party-card__back`, `.u5-progress-screen`, `[data-testid="u5-party-member"]`, `.game-canvas`, `.game-shell__right-panel`
- Produces: 새 TypeScript export 없음. CSS 계약 `.u5-progress-screen .party-card__back { scrollbar-width: none; }`와 `.u5-progress-screen .party-card__back::-webkit-scrollbar { display: none; }`

- [ ] **Step 1: 정적 CSS 규칙을 정확히 찾는 helper를 추가한다**

`components/game/U5ProgressScreen.test.tsx`의 기존 `cssRule` helper 아래에 selector가 다른 selector의 접미사로 포함된 경우를 제외하는 helper를 추가한다.

```ts
const standaloneCssRule = (sheet: string, selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return sheet.match(new RegExp(`(?:^|})\\s*${escaped}\\s*\\{[^}]*\\}`, "m"))?.[0] ?? "";
};
```

이 helper를 쓰는 이유는 기존 `cssRule(sheet, ".party-card__back")`가 `.u5-progress-screen .party-card__back`의 접미사까지 잘못 잡을 수 있기 때문이다.

- [ ] **Step 2: U5 전용 숨김과 공용 overflow 보존의 실패 테스트를 작성한다**

`components/game/U5ProgressScreen.test.tsx`의 진행 기록 scrollbar 테스트 뒤에 다음 계약을 추가한다.

```ts
it("파티 카드 뒷면은 U5에서만 scrollbar를 숨기고 공용 스크롤은 유지한다", () => {
  const progressSheet = readFileSync("app/u5-progress.css", "utf8");
  const partySheet = readFileSync("app/party-card.css", "utf8");
  const sharedBack = standaloneCssRule(partySheet, ".party-card__back");
  const scopedBack = standaloneCssRule(
    progressSheet,
    ".u5-progress-screen .party-card__back",
  );
  const scopedWebkit = standaloneCssRule(
    progressSheet,
    ".u5-progress-screen .party-card__back::-webkit-scrollbar",
  );

  expect(sharedBack).toMatch(/overflow-y:\s*auto/);
  expect(sharedBack).not.toMatch(/scrollbar-width:\s*none/);
  expect(scopedBack).toMatch(/scrollbar-width:\s*none/);
  expect(scopedWebkit).toMatch(/display:\s*none/);
  expect(standaloneCssRule(progressSheet, ".party-card__back")).toBe("");
  expect(standaloneCssRule(progressSheet, ".party-card__back::-webkit-scrollbar")).toBe("");

  for (const rule of [scopedBack, scopedWebkit]) {
    expect(rule).not.toMatch(/overflow(?:-y)?:\s*(?:hidden|clip)/);
    expect(rule).not.toMatch(/max-height\s*:/);
  }
});
```

- [ ] **Step 3: 정적 테스트가 CSS 계약 부재로 실패하는지 확인한다**

Run:

```bash
pnpm exec vitest run components/game/U5ProgressScreen.test.tsx
```

Expected: FAIL. 새 테스트의 `scopedBack` 또는 `scopedWebkit`이 빈 문자열이라 `scrollbar-width: none` 또는 `display: none` assertion이 실패해야 한다. 기존 테스트 실패가 먼저 나오면 최신 `main`과 동기화한 뒤 같은 명령으로 새 실패 원인을 다시 확인한다.

- [ ] **Step 4: Playwright overflow fixture helper를 작성한다**

`e2e/u5-party-card-scroll.spec.ts`를 만들고 다음 helper와 상수를 작성한다. DOM 문자열을 `innerHTML`로 넣지 말고 실제 요소를 만들어 제품 카드의 class 구조를 그대로 사용한다.

```ts
import { expect, test, type Page } from "@playwright/test";
import { expectNoBrowserErrors, watchBrowserErrors } from "./browser-errors";

const RECORD_COUNT = 18;
const LAST_RECORD = `합성 원정 기록 ${RECORD_COUNT}`;
const TOLERANCE = 1.5;

interface CardBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

async function mountOverflowingBack(page: Page): Promise<readonly CardBox[]> {
  const party = page.getByTestId("u5-party");
  const before = await party.locator("[data-testid='u5-party-member']").evaluateAll((cards) =>
    cards.map((card) => {
      const box = card.getBoundingClientRect();
      return { left: box.left, top: box.top, width: box.width, height: box.height };
    }),
  );

  await page.getByTestId("u5-party-member").first().evaluate((card, count) => {
    const back = document.createElement("div");
    back.className = "party-card__back";
    back.dataset.testid = "party-member-changes";

    const heading = document.createElement("h4");
    const name = document.createElement("strong");
    name.textContent = "로자린드";
    heading.append(name);
    back.append(heading);

    const list = document.createElement("ol");
    list.className = "party-card__changes";
    for (let position = 1; position <= count; position += 1) {
      const item = document.createElement("li");
      const cause = document.createElement("strong");
      cause.textContent = `합성 원정 기록 ${position}`;
      const detail = document.createElement("span");
      detail.className = "party-card__change-detail";
      detail.textContent = `신뢰 ${40 + position} → ${39 + position}`;
      item.append(cause, detail);
      list.append(item);
    }
    back.append(list);
    card.append(back);
    card.classList.add("is-flipped");
  }, RECORD_COUNT);

  return before;
}
```

- [ ] **Step 5: wheel·끝 도달·style·containment 브라우저 테스트를 작성한다**

같은 파일에 다음 테스트를 추가한다.

```ts
test("U5 파티 카드 기록은 scrollbar 없이 마지막 항목까지 스크롤된다", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const failures = watchBrowserErrors(page);
  await page.goto("/u5-test");

  const before = await mountOverflowingBack(page);
  const back = page.getByTestId("party-member-changes");
  await expect(back).toBeVisible();

  const initial = await back.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
    overflowY: getComputedStyle(element).overflowY,
    scrollbarWidth: getComputedStyle(element).scrollbarWidth,
    webkitDisplay: getComputedStyle(element, "::-webkit-scrollbar").display,
  }));
  expect(initial.scrollHeight).toBeGreaterThan(initial.clientHeight);
  expect(initial.scrollTop).toBe(0);
  expect(initial.overflowY).toBe("auto");
  expect(initial.scrollbarWidth).toBe("none");
  expect(initial.webkitDisplay).toBe("none");

  const backBox = await back.boundingBox();
  expect(backBox).not.toBeNull();
  if (backBox === null) throw new Error("합성한 카드 뒷면의 위치를 측정할 수 없다");
  await page.mouse.move(backBox.x + backBox.width / 2, backBox.y + backBox.height / 2);
  await page.mouse.wheel(0, backBox.height);
  await expect.poll(() => back.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  const final = await back.evaluate((element, lastText) => {
    element.scrollTop = element.scrollHeight;
    const last = [...element.querySelectorAll<HTMLElement>(".party-card__changes > li")]
      .find((item) => item.textContent?.includes(lastText));
    if (last === undefined) throw new Error("마지막 합성 기록이 없다");
    const area = element.getBoundingClientRect();
    const item = last.getBoundingClientRect();
    return {
      scrollTop: element.scrollTop,
      maximum: element.scrollHeight - element.clientHeight,
      lastText: last.textContent,
      lastTop: item.top,
      lastBottom: item.bottom,
      areaTop: area.top,
      areaBottom: area.bottom,
    };
  }, LAST_RECORD);
  expect(final.scrollTop).toBeGreaterThanOrEqual(final.maximum - 1);
  expect(final.lastText).toContain(LAST_RECORD);
  expect(final.lastTop).toBeGreaterThanOrEqual(final.areaTop - TOLERANCE);
  expect(final.lastBottom).toBeLessThanOrEqual(final.areaBottom + TOLERANCE);

  const after = await page.getByTestId("u5-party-member").evaluateAll((cards) =>
    cards.map((card) => {
      const box = card.getBoundingClientRect();
      return { left: box.left, top: box.top, width: box.width, height: box.height };
    }),
  );
  expect(after).toHaveLength(before.length);
  for (let index = 0; index < before.length; index += 1) {
    expect(Math.abs(after[index].left - before[index].left)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(after[index].top - before[index].top)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(after[index].width - before[index].width)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(after[index].height - before[index].height)).toBeLessThanOrEqual(TOLERANCE);
  }

  const containment = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>(".u5-progress-screen .game-shell__right-panel");
    const party = document.querySelector<HTMLElement>("[data-testid='u5-party']");
    if (panel === null || party === null) throw new Error("U5 우측 패널을 찾을 수 없다");
    const panelBox = panel.getBoundingClientRect();
    const partyBox = party.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      partyLeft: partyBox.left,
      partyRight: partyBox.right,
      partyTop: partyBox.top,
      partyBottom: partyBox.bottom,
      panelLeft: panelBox.left,
      panelRight: panelBox.right,
      panelTop: panelBox.top,
      panelBottom: panelBox.bottom,
    };
  });
  expect(containment.documentWidth).toBeLessThanOrEqual(containment.innerWidth + 1);
  expect(containment.documentHeight).toBeLessThanOrEqual(containment.innerHeight + 1);
  expect(containment.partyLeft).toBeGreaterThanOrEqual(containment.panelLeft - TOLERANCE);
  expect(containment.partyRight).toBeLessThanOrEqual(containment.panelRight + TOLERANCE);
  expect(containment.partyTop).toBeGreaterThanOrEqual(containment.panelTop - TOLERANCE);
  expect(containment.partyBottom).toBeLessThanOrEqual(containment.panelBottom + TOLERANCE);
  expectNoBrowserErrors(failures, "U5 파티 카드 숨김 scrollbar");
});
```

- [ ] **Step 6: 브라우저 테스트가 숨김 CSS 부재로 실패하는지 확인한다**

Run:

```bash
pnpm exec playwright test e2e/u5-party-card-scroll.spec.ts --project=chromium
```

Expected: FAIL. `initial.scrollbarWidth`와 `initial.webkitDisplay` 중 숨김 규칙이 없는 값이 `none` assertion을 실패시켜야 한다. 운영체제·Chromium 버전에 따라 기본 display 문자열은 달라도 되지만, 새 CSS 전에는 두 숨김 계약이 동시에 통과해서는 안 된다. `scrollHeight > clientHeight`와 wheel 이동이 먼저 실패하면 fixture의 기록 개수나 pointer 위치를 바로잡고, 숨김 style assertion이 실패 원인이 될 때까지 다시 실행한다.

- [ ] **Step 7: U5 전용 CSS 최소 구현을 추가한다**

`app/u5-progress.css`의 U5 우측 파티 상태 구역에서 `.u5-party` 규칙 뒤에 다음만 추가한다.

```css
/* 공용 카드의 native 스크롤은 유지하고 U5에서만 밝은 기본 막대를 감춘다. */
.u5-progress-screen .party-card__back {
  scrollbar-width: none;
}

.u5-progress-screen .party-card__back::-webkit-scrollbar {
  display: none;
}
```

`app/party-card.css`, 카드 DOM, padding, width, height와 `overflow-y`는 수정하지 않는다.

- [ ] **Step 8: 정적 계약과 브라우저 동작이 모두 통과하는지 확인한다**

Run:

```bash
pnpm exec vitest run components/game/U5ProgressScreen.test.tsx components/game/PartyMemberCard.test.tsx components/game/U5FixedCanvas.test.ts
pnpm exec playwright test e2e/u5-party-card-scroll.spec.ts --project=chromium
```

Expected: Vitest 관련 파일 3개와 Chromium E2E 1개가 모두 PASS한다. E2E는 wheel 뒤 `scrollTop > 0`, 마지막 기록 containment, `scrollbarWidth === "none"`, WebKit pseudo-element `display === "none"`을 함께 증명해야 한다.

- [ ] **Step 9: Chromium에서 시각 부재를 확인한다**

Run:

```bash
pnpm exec playwright test e2e/u5-party-card-scroll.spec.ts --project=chromium --debug
```

Playwright Inspector에서 fixture가 합성된 뒤 멈춘 화면을 확인한다. 첫 번째 카드 뒷면에 밝은 scrollbar track·thumb이 없어야 하며, 카드 폭·높이와 나머지 두 카드의 정렬이 유지되어야 한다. 이 단계는 픽셀 golden을 만들거나 스크린샷을 커밋하지 않는다.

- [ ] **Step 10: 구현 단위를 커밋한다**

```bash
git add app/u5-progress.css components/game/U5ProgressScreen.test.tsx e2e/u5-party-card-scroll.spec.ts
git commit -m "기능: U5 파티 카드 스크롤바를 숨긴다" -m "공용 네이티브 스크롤은 유지하고 U5 카드 뒷면의 기본 스크롤바만 비시각화한다. 정적 CSS 계약과 Chromium wheel·끝 도달 회귀 검증을 함께 추가한다."
```

### Task 2: 전체 품질 게이트와 변경 범위 검증

**Files:**
- Verify only: `app/u5-progress.css`
- Verify only: `components/game/U5ProgressScreen.test.tsx`
- Verify only: `e2e/u5-party-card-scroll.spec.ts`
- Verify unchanged: `components/game/U5ProgressScreen.tsx`, `components/game/PartyMemberCard.tsx`, `app/party-card.css`

**Interfaces:**
- Consumes: Task 1의 CSS와 테스트 계약
- Produces: lint, typecheck, Vitest, build, Playwright와 diff 무결성 증거

- [ ] **Step 1: 정적 분석과 전체 단위 테스트를 실행한다**

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Expected: 세 명령이 모두 exit code 0으로 끝난다. 실패가 나면 이번 세 파일의 변경과 직접 관련된 원인만 수정하고 각 실패 명령을 다시 전체 실행한다. 범위 밖 기존 실패가 있으면 임의 수정하지 말고 정확한 명령과 오류를 보고한다.

- [ ] **Step 2: 프로덕션 build를 실행한다**

```bash
pnpm build
```

Expected: Next.js production build가 exit code 0으로 끝난다. 이 작업은 React나 Next API를 바꾸지 않으므로 Next 문서 기반의 별도 마이그레이션은 없어야 한다.

- [ ] **Step 3: 전체 Playwright 회귀를 실행한다**

```bash
pnpm test:e2e
```

Expected: 새 `u5-party-card-scroll.spec.ts`를 포함한 전체 Chromium suite가 PASS하고 브라우저 page error·console error가 없다.

- [ ] **Step 4: whitespace와 실제 변경 파일을 검증한다**

```bash
git diff --check HEAD^..HEAD
git diff --name-only HEAD^..HEAD
git status --short
```

Expected:

```text
app/u5-progress.css
components/game/U5ProgressScreen.test.tsx
e2e/u5-party-card-scroll.spec.ts
```

작업 트리는 clean이어야 한다. `U5ProgressScreen.tsx`, `PartyMemberCard.tsx`, `party-card.css`, Store, domain/rules, 프리뷰 데이터, 공식 문서와 이미지 에셋이 구현 커밋에 나타나면 범위 위반이므로 커밋을 완료로 처리하지 않는다.

- [ ] **Step 5: 완료 증거를 요약한다**

최종 보고에는 다음을 포함한다.

- 추가된 U5 전용 Firefox·WebKit selector
- 공용 `overflow-y: auto`가 유지됐다는 정적 테스트 결과
- Chromium에서 `scrollHeight > clientHeight`, wheel 뒤 `scrollTop > 0`, 마지막 기록 도달이 확인된 결과
- 카드 정렬·우측 패널·document containment 결과
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, `git diff --check`의 실제 통과 결과
- 내부 기록의 독립 키보드 스크롤은 이번 범위가 아니며 카드 버튼의 기존 키보드 뒤집기만 유지했다는 범위 설명
