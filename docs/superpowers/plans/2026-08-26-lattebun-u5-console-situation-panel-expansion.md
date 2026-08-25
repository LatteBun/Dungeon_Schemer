# U5 현재 상황 패널 확장과 타이포그래피 2차 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** U5 현재 상황 패널이 조언 카드 또는 선택 후 결과 바로 위까지 남는 높이를 채우게 하고, 좌측 상단 정렬을 유지한 채 모드 탭·상황 제목·본문 글자를 한 단계 더 키운다.

**Architecture:** 기존 `U5ProgressScreen` DOM과 데이터 흐름은 유지하고 `progress.outcome`에서 파생한 중립 `data-has-outcome` attribute와 U5 전용 grid·typography 선언만 바꾼다. source-level CSS 계약으로 정확한 행 구조와 `clamp()` 값을 잠그고, Playwright의 FHD bounding box·computed style 검사로 패널 확장, 작은 행 간격, 좌측 상단 배치와 엄격한 최장 공식 문구 containment를 검증한다.

**Tech Stack:** Next.js 16.3.0, React 19, TypeScript, CSS Grid, Vitest 4, Playwright 1.58

**Spec:** `docs/superpowers/specs/2026-08-25-lattebun-u5-console-situation-readability-design.md`

**작성자:** LatteBun

**작성 도구:** ChatGPT (GPT-5.6 Pro) · Superpowers Writing Plans

## Global Constraints

- 구현 전에 `docs/README.md`, `docs/GAME_PRINCIPLES.md`, `docs/experience/SCREEN_LAYOUT.md`, Spec과 `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`를 읽는다.
- `U5ProgressScreen`의 props, `progress.situation`, 선택 callback, 모드 전환과 `aria-pressed` 계약은 바꾸지 않는다. `.u5-advice-mode`에는 기존 outcome에서 파생한 `data-has-outcome="true|false"`만 추가한다.
- `.u5-advice-mode`는 기본 `minmax(0, 1fr) auto` 두 행을 사용한다. 선택 후 `[data-has-outcome="true"]`만 `minmax(min-content, 1fr) auto`를 사용해 결과 내부를 건드리지 않고 긴 상황 문구를 수용한다. `:has()`는 사용하지 않는다.
- 패널과 조언·결과 사이에는 기존 `.u5-advice-mode`의 `gap`만 남기며 별도 spacer, 큰 margin 또는 padding을 추가하지 않는다.
- `현재 상황` 제목과 본문은 늘어난 패널의 좌측 상단에 유지한다.
- 모드 탭은 `clamp(0.88rem, 0.96cqw, 1.30rem)`, 최종 padding `clamp(0.16rem, 0.15cqw, 0.3rem) clamp(0.5rem, 0.7cqw, 1rem)`, 상황 제목은 `clamp(0.90rem, 1.00cqw, 1.25rem)`, 본문은 `clamp(1.00rem, 1.12cqw, 1.50rem)`과 `line-height: 1.45`를 사용한다.
- `.u5-advice__button` 이하 카드 내부, `.u5-outcome*`, `.u5-log__filters`, 고정 1920×1080 캔버스와 GameShell 60:40 계약은 수정하지 않는다.
- 상황 패널과 본문에 고정·최대 높이, 말줄임, `overflow: hidden` 또는 내부 세로 스크롤을 추가하지 않는다.
- 새 컴포넌트, 이미지, SVG, 아이콘, 의존성 또는 반응형 분기를 추가하지 않는다.
- 커밋 제목과 본문은 모두 한글로 작성한다.
- 이 연결 워크트리에서 pnpm이 `ERR_PNPM_UNSAFE_MODULES_DIR`로 거부되면 같은 lockfile로 설치된 `/Users/danny/MakeBun/Dungeon_Schemer/node_modules`의 바이너리를 직접 실행한다.

---

### Task 1: 상황 패널 높이와 세 텍스트 계층을 함께 조정한다

**Files:**
- Modify: `components/game/U5ProgressScreen.test.tsx`
- Modify: `e2e/u5-console-situation-readability.spec.ts`
- Modify: `app/u5-progress.css`

**Interfaces:**
- Consumes: 기존 `.u5-advice-mode`, `.u5-console__tabs button`, `.u5-situation-panel`, `.u5-situation-panel__title`, `.u5-situation`, `.u5-advice-list`, `.u5-outcome` DOM/CSS selector
- Produces: `minmax(0, 1fr) auto` grid 행 계약과 FHD `tabSize >= 18`, `titleSize >= 19`, `bodySize >= 21` 회귀 계약
- Produces no new TypeScript type, prop, component, callback or public API.

- [ ] **Step 1: 관련 공식 계약과 현재 구현을 다시 읽는다.**

```bash
sed -n '1,180p' docs/README.md
sed -n '1,240p' docs/GAME_PRINCIPLES.md
sed -n '115,145p' docs/experience/SCREEN_LAYOUT.md
sed -n '1,430p' docs/superpowers/specs/2026-08-25-lattebun-u5-console-situation-readability-design.md
sed -n '1,220p' node_modules/next/dist/docs/01-app/01-getting-started/11-css.md
sed -n '90,230p' app/u5-progress.css
sed -n '200,305p' components/game/U5ProgressScreen.test.tsx
sed -n '1,260p' e2e/u5-console-situation-readability.spec.ts
```

Expected: Spec의 2차 후속 조정, 공식 화면 문서, 현재 `auto minmax(0, 1fr)` 행과 이전 typography 값이 확인된다.

- [ ] **Step 2: source-level CSS 계약 테스트를 새 요구로 먼저 바꾼다.**

`components/game/U5ProgressScreen.test.tsx`의 기존 typography 테스트를 다음 계약으로 교체하고, 바로 앞에 grid 행 테스트를 추가한다.

```tsx
it("현재 상황 패널은 남는 높이를 채우고 카드나 결과는 내용 높이를 유지한다", () => {
  const sheet = readFileSync("app/u5-progress.css", "utf8");
  const mode = cssRule(sheet, ".u5-advice-mode");

  expect(mode).toMatch(/grid-template-rows:\s*minmax\(0,\s*1fr\)\s+auto/);
  expect(mode).toMatch(/gap:/);
  expect(mode).not.toMatch(/place-(?:content|items)\s*:/);
  expect(mode).not.toMatch(/align-(?:content|items)\s*:\s*(?:center|end)/);
});

it("모드 탭과 현재 상황 글자를 2차 승인 크기로 키운다", () => {
  const sheet = readFileSync("app/u5-progress.css", "utf8");
  const tabs = cssRule(sheet, ".u5-console__tabs button");
  const title = cssRule(sheet, ".u5-situation-panel__title");
  const body = cssRule(sheet, ".u5-situation");

  expect(tabs).toMatch(/font-size:\s*clamp\(0\.88rem,\s*0\.96cqw,\s*1\.3(?:0)?rem\)/);
  expect(title).toMatch(/font-size:\s*clamp\(0\.9(?:0)?rem,\s*1(?:\.00)?cqw,\s*1\.25rem\)/);
  expect(body).toMatch(/font-size:\s*clamp\(1(?:\.00)?rem,\s*1\.12cqw,\s*1\.5(?:0)?rem\)/);
  expect(body).toMatch(/line-height:\s*1\.45/);
});
```

기존 패널의 height·overflow 금지, 카드 하단 정렬, 금속 표면, 필터 분리 테스트는 삭제하거나 약화하지 않는다.

- [ ] **Step 3: FHD 패널 확장과 좌측 상단 배치 E2E 계약을 먼저 추가한다.**

`e2e/u5-console-situation-readability.spec.ts`의 금속 표면 테스트가 `tabSize`도 반환하고 세 글자 크기를 검증하게 바꾼다.

```ts
return {
  tab: surface(tab),
  panel: surface(panel),
  tabSize: parseFloat(getComputedStyle(tab).fontSize),
  titleSize: parseFloat(getComputedStyle(title).fontSize),
  bodySize: parseFloat(getComputedStyle(body).fontSize),
};
```

```ts
expect(styles.tabSize).toBeGreaterThanOrEqual(18);
expect(styles.titleSize).toBeGreaterThanOrEqual(19);
expect(styles.bodySize).toBeGreaterThanOrEqual(21);
expect(styles.bodySize).toBeGreaterThan(styles.titleSize);
```

같은 파일에 다음 테스트를 추가한다.

```ts
test("현재 상황 패널은 FHD에서 카드 바로 위까지 늘어나고 글자는 좌측 상단에 남는다", async ({ page }) => {
  const failures = watchBrowserErrors(page);
  await useFhd(page);

  const metrics = await page.getByTestId("u5-console").evaluate((console) => {
    const mode = console.querySelector<HTMLElement>(".u5-advice-mode");
    const panel = console.querySelector<HTMLElement>(".u5-situation-panel");
    const title = console.querySelector<HTMLElement>(".u5-situation-panel__title");
    const body = console.querySelector<HTMLElement>(".u5-situation");
    const cards = [...console.querySelectorAll<HTMLElement>(".u5-advice__button")];
    if (mode === null || panel === null || title === null || body === null || cards.length !== 3) {
      throw new Error("U5 상황 패널 확장 fixture가 없다");
    }

    const modeStyle = getComputedStyle(mode);
    const panelStyle = getComputedStyle(panel);
    const panelBox = panel.getBoundingClientRect();
    const titleBox = title.getBoundingClientRect();
    const bodyBox = body.getBoundingClientRect();
    const cardTop = Math.min(...cards.map((card) => card.getBoundingClientRect().top));
    return {
      expectedGap: parseFloat(modeStyle.rowGap),
      actualGap: cardTop - panelBox.bottom,
      titleTopInset: titleBox.top - panelBox.top,
      titleLeftInset: titleBox.left - panelBox.left,
      panelPaddingTop: parseFloat(panelStyle.paddingTop),
      panelPaddingLeft: parseFloat(panelStyle.paddingLeft),
      freeSpaceBelowBody: panelBox.bottom - bodyBox.bottom,
    };
  });

  expect(Math.abs(metrics.actualGap - metrics.expectedGap)).toBeLessThanOrEqual(1.5);
  expect(Math.abs(metrics.titleTopInset - metrics.panelPaddingTop)).toBeLessThanOrEqual(3);
  expect(Math.abs(metrics.titleLeftInset - metrics.panelPaddingLeft)).toBeLessThanOrEqual(3);
  expect(metrics.freeSpaceBelowBody).toBeGreaterThan(16);

  await page.getByRole("button", { name: "일반 사건 · 선택 후", exact: true }).click();
  const outcomeGap = await page.getByTestId("u5-console").evaluate((console) => {
    const mode = console.querySelector<HTMLElement>(".u5-advice-mode");
    const panel = console.querySelector<HTMLElement>(".u5-situation-panel");
    const outcome = console.querySelector<HTMLElement>("[data-testid='u5-outcome']");
    if (mode === null || panel === null || outcome === null) {
      throw new Error("U5 선택 후 패널 확장 fixture가 없다");
    }
    return {
      expected: parseFloat(getComputedStyle(mode).rowGap),
      actual: outcome.getBoundingClientRect().top - panel.getBoundingClientRect().bottom,
    };
  });
  expect(Math.abs(outcomeGap.actual - outcomeGap.expected)).toBeLessThanOrEqual(1.5);
  expectNoBrowserErrors(failures, "U5 현재 상황 패널 확장");
});
```

기존 최장 공식 문구 선택 전·선택 후 containment 테스트와 카드 하단 padding 테스트는 그대로 유지한다.

- [ ] **Step 4: 집중 테스트를 실행해 새 계약이 기존 CSS에서 실패하는지 확인한다.**

```bash
pnpm exec vitest run components/game/U5ProgressScreen.test.tsx
pnpm exec playwright test e2e/u5-console-situation-readability.spec.ts --project=chromium --workers=1
```

Expected: Vitest는 기존 `auto minmax(0, 1fr)`과 이전 세 `clamp()` 값 때문에 실패한다. Playwright는 패널 아래 큰 빈 공간, `tabSize < 18`, `titleSize < 19`, `bodySize < 21` 중 새 계약에서 실패한다. 기존 상호작용·containment 테스트는 통과한다.

pnpm이 외부 modules directory를 거부하면 Vitest는 다음 동일 버전 바이너리로 실행한다.

```bash
node /Users/danny/MakeBun/Dungeon_Schemer/node_modules/vitest/vitest.mjs run components/game/U5ProgressScreen.test.tsx
```

Playwright는 `/Users/danny/MakeBun/Dungeon_Schemer/node_modules/.bin/next dev --webpack -p 3100` 서버를 먼저 실행하고 다음 명령을 사용한다.

```bash
node /Users/danny/MakeBun/Dungeon_Schemer/node_modules/@playwright/test/cli.js test e2e/u5-console-situation-readability.spec.ts --project=chromium --workers=1
```

- [ ] **Step 5: U5 전용 CSS를 최소 변경한다.**

`app/u5-progress.css`에서 다음 선언만 교체한다.

```css
.u5-console__tabs button {
  /* 기존 border, clip-path, background, shadow, color는 유지 */
  padding: clamp(0.16rem, 0.15cqw, 0.3rem) clamp(0.5rem, 0.7cqw, 1rem);
  font-size: clamp(0.88rem, 0.96cqw, 1.3rem);
}

.u5-advice-mode {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: clamp(0.4rem, 0.55cqw, 0.85rem);
  min-height: 0;
}

.u5-advice-mode[data-has-outcome="true"] {
  grid-template-rows: minmax(min-content, 1fr) auto;
}

.u5-situation-panel__title {
  /* 기존 margin, color, line-height는 유지 */
  font-size: clamp(0.9rem, 1cqw, 1.25rem);
}

.u5-situation {
  /* 기존 margin과 color는 유지 */
  font-size: clamp(1rem, 1.12cqw, 1.5rem);
  line-height: 1.45;
}
```

`.u5-situation-panel`에 `display`, `place-*`, `align-*`, height 또는 overflow를 추가하지 않는다. Grid item의 기본 stretch와 일반 block 흐름이 각각 패널 확장과 좌측 상단 정렬을 담당하게 한다.

- [ ] **Step 6: 집중 테스트를 다시 실행해 새 계약과 기존 경계가 함께 통과하는지 확인한다.**

```bash
pnpm exec vitest run components/game/U5ProgressScreen.test.tsx
pnpm exec playwright test e2e/u5-console-situation-readability.spec.ts --project=chromium --workers=1
```

Expected: `U5ProgressScreen.test.tsx` 전체와 U5 콘솔 Playwright 전체가 PASS한다. FHD에서 패널·카드 간격은 계산된 row gap과 1.5px 이내로 일치하고, 최장 공식 문구와 선택 후 결과 세 단계가 콘솔 안에 남는다.

- [ ] **Step 7: 전체 회귀·타입·린트·빌드를 검증한다.**

```bash
pnpm exec vitest run
pnpm exec tsc --noEmit
pnpm exec eslint .
pnpm exec next build --webpack
pnpm exec playwright test --project=chromium --workers=1
git diff --check
```

Expected: 전체 Vitest, TypeScript, webpack production build와 Playwright가 PASS한다. ESLint는 error 0이며 기존 warning만 허용한다. `git diff --check` 출력이 없다.

연결 워크트리의 pnpm 제약이 발생하면 Global Constraints에 적은 동일 설치 바이너리를 직접 사용한다. `next build --webpack`은 외부 `node_modules` symlink를 허용하지 않는 Turbopack 대신 이 워크트리에서 검증 가능한 production build 경로다.

- [ ] **Step 8: 변경 범위를 확인하고 한글 커밋으로 기록한다.**

```bash
git diff -- app/u5-progress.css components/game/U5ProgressScreen.test.tsx e2e/u5-console-situation-readability.spec.ts
git status --short
git add app/u5-progress.css components/game/U5ProgressScreen.test.tsx e2e/u5-console-situation-readability.spec.ts
git commit -m "스타일: U5 상황 패널의 높이와 글자를 키운다" -m "현재 상황 패널이 조언 카드와 결과 위까지 남는 높이를 채우도록 조정한다.
모드 탭과 상황 제목·본문을 확대하고 FHD 배치·containment 회귀 테스트를 보강한다."
```

Expected: CSS와 두 테스트 파일만 구현 커밋에 포함되고, 커밋 제목과 본문이 모두 한글이다.

---

## 최종 확인표

- [ ] 상황 패널이 조언 카드 또는 결과 바로 위까지 남는 높이를 채운다.
- [ ] 패널과 다음 영역 사이에는 기존 row gap만 남는다.
- [ ] 제목과 본문이 패널 좌측 상단에 있고 아래쪽이 의도한 여백으로 남는다.
- [ ] FHD에서 탭 `>= 18px`, 제목 `>= 19px`, 본문 `>= 21px`이며 본문이 제목보다 크다.
- [ ] 최장 공식 상황 문구가 선택 전·후 모두 잘리지 않는다.
- [ ] 카드, 결과, 진행 기록 필터, DOM·ARIA·데이터 흐름이 회귀하지 않는다.
- [ ] 전체 테스트·타입·린트·빌드와 `git diff --check`가 통과한다.
