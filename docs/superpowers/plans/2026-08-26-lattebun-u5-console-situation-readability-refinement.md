# U5 콘솔 금속 명패 통일과 조언 카드 하단 정렬 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PR #180의 U5 콘솔에서 조언 카드 세 장을 하단에 정렬하고, 확대된 현재 상황과 모드 탭을 리벳 없는 금속 명패 계열로 통일한다.

**Architecture:** 기존 `U5ProgressScreen` DOM, 로컬 mode state와 `progress.situation` 데이터 흐름은 그대로 둔다. `app/u5-progress.css`의 U5 전용 selector 네 곳만 조정하고, source-level CSS 계약과 FHD Playwright 계산 스타일·bounding box 검증을 먼저 실패시킨 뒤 최소 CSS로 통과시킨다.

**Tech Stack:** Next.js 16.3.0 App Router, React 19.2.8, TypeScript 5, Vitest 4.1.10, Playwright 1.62.1, CSS container units

**Spec:** `docs/superpowers/specs/2026-08-25-lattebun-u5-console-situation-readability-design.md`

## Global Constraints

- 이 Plan은 PR #180의 커밋 `f7b33be` 이후 후속 단계다. 기존 Task 1~3을 다시 구현하지 않는다.
- `components/game/U5ProgressScreen.tsx`의 DOM, 실제 button, click handler, `is-active`, `aria-pressed`와 `data-testid`를 변경하지 않는다.
- `.u5-advice-list`의 정렬만 바꾸고 `AdviceOption`, `.u5-advice__button` 이하 카드 높이·실루엣·리벳·구분선·내부 간격을 변경하지 않는다.
- `.u5-outcome*`, `.u5-log__filters*`, Store, adapter, 타입, 서비스와 공식 콘텐츠를 변경하지 않는다.
- 카드 아래에는 `.u5-console`의 기존 padding만 남긴다. 새 하단 padding, 고정 위치, transform 또는 absolute positioning을 추가하지 않는다.
- 탭과 상황 패널은 CSS `clip-path`, border, gradient와 inset shadow로 그린다. 리벳 DOM, bitmap, SVG, 아이콘, 공용 컴포넌트와 새 의존성을 추가하지 않는다.
- 상황 제목은 `clamp(0.78rem, 0.82cqw, 1.04rem)`, 본문은 `clamp(0.86rem, 0.92cqw, 1.30rem)`, 본문 line-height는 `1.45`를 사용한다.
- 상황 패널에 고정·최대 높이, 말줄임, `overflow: hidden` 또는 자체 세로 스크롤을 추가하지 않는다.
- 1920×1080 고정 캔버스, GameShell 60:40, U5 장면 40%·콘솔 60%, `rem`·`cqw`·`cqh` 계약을 유지한다.
- 공식 최장 상황 문구는 선택 전·선택 후 모두 콘솔 안에 남아야 한다.
- 커밋 제목과 본문은 모두 한글로 작성한다.

---

## File Structure

| 파일 | 역할 | 변경 |
| --- | --- | --- |
| `app/u5-progress.css` | U5 콘솔의 배치와 표면을 소유한다. | 카드 목록 하단 정렬, 탭·상황 패널 금속 표면, 제목·본문 확대 |
| `components/game/U5ProgressScreen.test.tsx` | U5 DOM·source CSS 계약을 고정한다. | 변경 허용 selector와 금지 경계를 실패 테스트로 추가 |
| `e2e/u5-console-situation-readability.spec.ts` | FHD 실제 계산 스타일과 containment를 검증한다. | 카드 하단 간격, 금속 표면, 확대 typography 측정 추가 |

공식 문서와 Spec 갱신은 선행 커밋 `f7b33be`에서 완료됐다. 이번 구현 커밋에는 위 세 파일만 포함한다.

### Task 1: 하단 카드 배치와 금속 명패 계열 콘솔 표면

**Files:**

- Modify: `components/game/U5ProgressScreen.test.tsx:199-225`
- Modify: `e2e/u5-console-situation-readability.spec.ts:1-122`
- Modify: `app/u5-progress.css:105-191`
- Test: `components/game/U5ProgressScreen.test.tsx`
- Test: `e2e/u5-console-situation-readability.spec.ts`

**Interfaces:**

- Consumes: 기존 `.u5-console`, `.u5-console__tabs button`, `.u5-situation-panel`, `.u5-situation-panel__title`, `.u5-situation`, `.u5-advice-list`, `.u5-advice__button`
- Produces: `align-content: end`, 리벳 없는 금속 표면, 확대 typography, FHD 카드 하단 간격·computed style 회귀 계약

- [ ] **Step 1: source-level CSS 실패 계약을 작성한다.**

`U5ProgressScreen.test.tsx`의 CSS 계약 근처에 rule 추출 helper를 추가한다.

```ts
const cssRule = (sheet: string, selector: string) =>
  sheet.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{[^}]*\\}`))?.[0] ?? "";
```

아래 테스트를 추가한다. `inset`을 두 번 요구해 단일 안쪽 highlight만으로 통과하지 못하게 한다.

```ts
it("조언 카드는 콘솔 아래쪽에 정렬하고 별도 하단 여백을 만들지 않는다", () => {
  const sheet = readFileSync("app/u5-progress.css", "utf8");
  const list = cssRule(sheet, ".u5-advice-list");

  expect(list).toMatch(/align-content:\s*end/);
  expect(list).toMatch(/padding:\s*0/);
  expect(list).not.toMatch(/padding-bottom\s*:/);
  expect(list).not.toMatch(/position:\s*(?:absolute|fixed)/);
  expect(list).not.toMatch(/transform\s*:/);
});

it("모드 탭과 현재 상황 패널은 리벳 없는 금속 명패 표면을 쓴다", () => {
  const sheet = readFileSync("app/u5-progress.css", "utf8");
  const tabs = cssRule(sheet, ".u5-console__tabs button");
  const panel = cssRule(sheet, ".u5-situation-panel");

  for (const rule of [tabs, panel]) {
    expect(rule).toMatch(/clip-path:\s*polygon\(/);
    expect(rule).toMatch(/border:\s*0\.125rem solid/);
    expect(rule).toMatch(/background:\s*linear-gradient\(/);
    expect(rule.match(/\binset\b/g)).toHaveLength(2);
  }
  const html = render();
  const tabsMarkup = html.match(/<nav class="u5-console__tabs"[\s\S]*?<\/nav>/)?.[0] ?? "";
  const panelMarkup = html.match(/<section class="u5-situation-panel"[\s\S]*?<\/section>/)?.[0] ?? "";
  expect(tabsMarkup).not.toContain("u5-advice__rivet");
  expect(panelMarkup).not.toContain("u5-advice__rivet");
});

it("현재 상황 제목과 본문을 승인 크기로 함께 키운다", () => {
  const sheet = readFileSync("app/u5-progress.css", "utf8");
  const title = cssRule(sheet, ".u5-situation-panel__title");
  const body = cssRule(sheet, ".u5-situation");

  expect(title).toMatch(/font-size:\s*clamp\(0\.78rem,\s*0\.82cqw,\s*1\.04rem\)/);
  expect(body).toMatch(/font-size:\s*clamp\(0\.86rem,\s*0\.92cqw,\s*1\.3(?:0)?rem\)/);
  expect(body).toMatch(/line-height:\s*1\.45/);
});
```

- [ ] **Step 2: FHD 계산 스타일·하단 간격 실패 계약을 작성한다.**

`e2e/u5-console-situation-readability.spec.ts`에 다음 테스트를 추가한다.

```ts
test("조언 카드는 FHD 콘솔의 기존 안쪽 여백만 남기고 하단에 정렬된다", async ({ page }) => {
  const failures = watchBrowserErrors(page);
  await useFhd(page);
  const metrics = await page.getByTestId("u5-console").evaluate((console) => {
    const cards = [...console.querySelectorAll<HTMLElement>(".u5-advice__button")];
    if (cards.length !== 3) throw new Error("조언 카드 세 장이 없다");
    const consoleBox = console.getBoundingClientRect();
    const style = getComputedStyle(console);
    const cardBottom = Math.max(...cards.map((card) => card.getBoundingClientRect().bottom));
    return {
      bottomGap: consoleBox.bottom - cardBottom,
      expectedGap: parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth),
    };
  });

  expect(metrics.bottomGap).toBeGreaterThan(0);
  expect(Math.abs(metrics.bottomGap - metrics.expectedGap)).toBeLessThanOrEqual(1.5);
  expectNoBrowserErrors(failures, "U5 조언 카드 하단 정렬");
});

test("탭과 현재 상황은 FHD에서 금속 표면과 확대된 글자를 사용한다", async ({ page }) => {
  const failures = watchBrowserErrors(page);
  await useFhd(page);
  const styles = await page.evaluate(() => {
    const tab = document.querySelector<HTMLElement>(".u5-console__tabs button:not(.is-active)");
    const panel = document.querySelector<HTMLElement>(".u5-situation-panel");
    const title = document.querySelector<HTMLElement>(".u5-situation-panel__title");
    const body = document.querySelector<HTMLElement>(".u5-situation");
    if (tab === null || panel === null || title === null || body === null) {
      throw new Error("U5 금속 표면 fixture가 없다");
    }
    const surface = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      return { clipPath: style.clipPath, backgroundImage: style.backgroundImage, boxShadow: style.boxShadow };
    };
    return {
      tab: surface(tab),
      panel: surface(panel),
      titleSize: parseFloat(getComputedStyle(title).fontSize),
      bodySize: parseFloat(getComputedStyle(body).fontSize),
    };
  });

  for (const surface of [styles.tab, styles.panel]) {
    expect(surface.clipPath).not.toBe("none");
    expect(surface.backgroundImage).toContain("linear-gradient");
    expect(surface.boxShadow.match(/inset/g)).toHaveLength(2);
  }
  expect(styles.titleSize).toBeGreaterThanOrEqual(15.7);
  expect(styles.bodySize).toBeGreaterThanOrEqual(17.6);
  expect(styles.bodySize).toBeGreaterThan(styles.titleSize);
  expectNoBrowserErrors(failures, "U5 금속 표면과 상황 typography");
});
```

- [ ] **Step 3: 새 단위 테스트와 E2E가 현재 구현에서 실패하는지 확인한다.**

Run:

```bash
pnpm vitest run components/game/U5ProgressScreen.test.tsx
pnpm playwright test e2e/u5-console-situation-readability.spec.ts --project=chromium --workers=1
```

Expected: Vitest는 `align-content: center`, 단일 inset shadow, 작은 typography 때문에 실패한다. Playwright는 카드가 중앙에 남고 탭·패널에 clip-path와 이중 inset shadow가 없어 실패한다. 기존 모드 전환·로그 필터·최장 문구 테스트는 통과해야 한다.

- [ ] **Step 4: U5 전용 CSS를 최소 변경한다.**

`app/u5-progress.css`에서 다음 네 책임만 바꾼다.

```css
.u5-console__tabs button {
  border: 0.125rem solid color-mix(in srgb, var(--color-shell-metal) 72%, var(--color-edge));
  clip-path: polygon(0.32rem 0, calc(100% - 0.32rem) 0, 100% 0.32rem, 100% calc(100% - 0.32rem), calc(100% - 0.32rem) 100%, 0.32rem 100%, 0 calc(100% - 0.32rem), 0 0.32rem);
  background: linear-gradient(145deg, rgb(40 27 16 / 96%), rgb(20 14 9 / 98%));
  box-shadow: inset 0 0 0 0.1rem #120c07, inset 0 0 0 0.16rem #87673c;
}

.u5-console__tabs button.is-active {
  background: linear-gradient(145deg, #5a3f1d, #2c1c0d);
}

.u5-console__tabs button:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 0.1rem #120c07, inset 0 0 0 0.16rem #87673c, inset 0 0 0 0.3rem var(--color-parchment);
}

.u5-situation-panel {
  border: 0.125rem solid color-mix(in srgb, var(--color-shell-metal) 64%, var(--color-edge));
  clip-path: polygon(0.45rem 0, calc(100% - 0.45rem) 0, 100% 0.45rem, 100% calc(100% - 0.45rem), calc(100% - 0.45rem) 100%, 0.45rem 100%, 0 calc(100% - 0.45rem), 0 0.45rem);
  background: linear-gradient(145deg, rgb(34 24 16 / 94%), rgb(16 11 8 / 97%));
  box-shadow: inset 0 0 0 0.1rem #120c07, inset 0 0 0 0.16rem #765a36;
}

.u5-situation-panel__title {
  font-size: clamp(0.78rem, 0.82cqw, 1.04rem);
}

.u5-situation {
  font-size: clamp(0.86rem, 0.92cqw, 1.3rem);
  line-height: 1.45;
}

.u5-advice-list {
  align-content: end;
}
```

기존 padding, cursor, hover, 활성 색상, panel margin·min-width와 카드 내부 selector는
유지한다. `focus-visible`은 사선 clip-path에 바깥 outline이 잘리지 않도록 카드와 같은
방식의 세 번째 inset parchment 선으로 바꾸며, 색 외의 키보드 초점 표시를 유지한다.

- [ ] **Step 5: 단위·브라우저 계약을 통과시키고 containment를 재확인한다.**

Run:

```bash
pnpm vitest run components/game/U5ProgressScreen.test.tsx components/game/U5FixedCanvas.test.ts components/game/u5-advice-presentation.test.ts components/game/u5-log-filter.test.ts
pnpm playwright test e2e/u5-console-situation-readability.spec.ts e2e/u5-advice-containment.spec.ts e2e/canvas-layout.spec.ts --project=chromium --workers=1
git diff --check
```

Expected: 관련 Vitest와 Playwright가 모두 통과한다. 최장 공식 상황 문구는 확대 뒤에도 선택 전·선택 후 콘솔 안에 있고, 로그 필터 계산 스타일은 기존 값 그대로다.

- [ ] **Step 6: 허용 범위와 전체 품질 게이트를 확인한다.**

Run:

```bash
git diff -- app/u5-progress.css components/game/U5ProgressScreen.test.tsx e2e/u5-console-situation-readability.spec.ts
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm playwright test --project=chromium --workers=1
```

Expected: 구현 diff는 위 세 파일뿐이고 `.u5-advice__button` 이하, `.u5-outcome*`, `.u5-log__filters*`에는 변경이 없다. 모든 명령이 종료 코드 0으로 끝난다. `pnpm backtest`는 실행하지 않는다.

- [ ] **Step 7: 후속 구현을 한글 커밋으로 남긴다.**

```bash
git add app/u5-progress.css components/game/U5ProgressScreen.test.tsx e2e/u5-console-situation-readability.spec.ts
git commit -m "스타일: U5 콘솔 금속 명패 표현을 통일한다" -m "조언 카드 묶음을 콘솔 하단에 정렬하고 현재 상황 제목과 본문을 키운다. 모드 탭과 상황 패널은 리벳 없는 금속 명패 계열로 맞춘다."
```

## Spec Coverage Review

| Spec 계약 | Plan step |
| --- | --- |
| 카드 묶음 하단 정렬, 기존 console padding만 유지 | Step 1, Step 2, Step 4, Step 5 |
| 탭·상황 패널의 얕은 사선, 금속 border, gradient, 이중 inset shadow | Step 1, Step 2, Step 4 |
| 탭·패널에 리벳·이미지·아이콘 미추가 | Global Constraints, Step 1, Step 4, Step 6 |
| 제목·본문 동시 확대와 본문 우위 | Step 1, Step 2, Step 4 |
| 조언 카드 자체·결과·로그 필터 비변경 | Global Constraints, Step 5, Step 6 |
| 공식 최장 문구의 선택 전·후 containment | Step 3, Step 5 |
| 고정 캔버스와 접근성 동작 보존 | Global Constraints, Step 5, Step 6 |

Self-review completed: every amended Spec requirement maps to a step; all selectors and test paths match PR #180; no placeholders or unresolved implementation choices remain.
