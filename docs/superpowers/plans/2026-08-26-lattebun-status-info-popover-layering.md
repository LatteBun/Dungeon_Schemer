# 상단 상태 정보 팝오버 레이어 수정 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** U4 지도 헤더가 `의심 인원`과 `남은 용사` 팝오버를 가리지 않도록 공통 상태 바의 레이어 순서를 바로잡는다.

**Architecture:** 기존 `TopStatusBar` DOM과 팝오버 좌표는 유지한다. Playwright가 팝오버와 U4 지도 헤더의 실제 교차 영역에서 `document.elementFromPoint()`로 최상단 요소를 확인하게 하고, 공통 `.game-shell__status-bar` 스태킹 컨텍스트만 화면 콘텐츠보다 높고 전역 퀵 메뉴보다 낮게 올린다.

**Tech Stack:** Next.js 16.3, React 19, TypeScript, global CSS, Playwright, Vitest

**Spec:** `docs/superpowers/specs/2026-08-26-lattebun-status-info-popover-layering-design.md`

## Global Constraints

- 팝오버는 계속 누른 칩 바로 아래에서 칩의 가로 중심에 맞춰 열린다.
- 팝오버 크기, 문구, 색상, 여백, 비모달 `role="dialog"`, 닫기와 초점 복귀 동작은 바꾸지 않는다.
- 공통 레이어 순서는 `화면 콘텐츠 < 상단 상태 바와 상태 정보 팝오버 < 전역 퀵 메뉴`다.
- 화면별 CSS 재정의나 지도 헤더 레이어 하향은 추가하지 않는다.
- `app/app-frame.css`의 전역 퀵 메뉴 `z-index: 80`은 변경하지 않는다.
- 구현 전에 확인한 기준선은 Vitest `147 files / 1759 tests` 통과다.

---

## 파일 구조

- Modify: `e2e/canvas-layout.spec.ts` — U4 지도와 두 상태 팝오버의 실제 페인팅 순서 회귀를 소유한다.
- Modify: `app/globals.css` — 모든 화면이 공유하는 상태 바 스태킹 컨텍스트를 소유한다.
- Reference only: `app/u4-dungeon-map.css` — 지도 패널 헤더의 기존 `z-index: 20`을 확인하되 변경하지 않는다.
- Reference only: `app/app-frame.css` — 전역 퀵 메뉴의 기존 `z-index: 80`을 확인하되 변경하지 않는다.

### Task 1: U4 팝오버 페인팅 순서 회귀와 최소 CSS 수정

**Files:**

- Modify: `e2e/canvas-layout.spec.ts`
- Modify: `app/globals.css:155-164`
- Test: `e2e/canvas-layout.spec.ts`

**Interfaces:**

- Consumes: `zero-trust-info-trigger`, `remaining-adventurers-info-trigger`, 각 팝오버의 접근 가능한 dialog 이름, `.u4-map-panel__header`.
- Produces: `expectPopoverAboveMapHeader(page, triggerTestId, dialogName): Promise<void>` 테스트 helper와 화면 콘텐츠 위·전역 퀵 메뉴 아래인 공통 상태 바 스태킹 컨텍스트.

- [ ] **Step 1: U4 겹침 지점의 최상단 요소를 검사하는 helper와 회귀를 작성한다**

`e2e/canvas-layout.spec.ts`의 `expectAnchoredPopover` 아래에 다음 helper를 추가한다.

```ts
async function expectPopoverAboveMapHeader(
  page: Page,
  triggerTestId: string,
  dialogName: string,
) {
  await page.getByTestId(triggerTestId).click();
  const dialog = page.getByRole("dialog", { name: dialogName });
  await expect(dialog).toBeVisible();

  const paintOrder = await dialog.evaluate((element) => {
    const mapHeader = document.querySelector(".u4-map-panel__header");
    if (!(mapHeader instanceof HTMLElement)) {
      return { overlaps: false, dialogIsTopmost: false, topmost: "missing map header" };
    }

    const dialogBox = element.getBoundingClientRect();
    const headerBox = mapHeader.getBoundingClientRect();
    const left = Math.max(dialogBox.left, headerBox.left);
    const right = Math.min(dialogBox.right, headerBox.right);
    const top = Math.max(dialogBox.top, headerBox.top);
    const bottom = Math.min(dialogBox.bottom, headerBox.bottom);
    if (left >= right || top >= bottom) {
      return { overlaps: false, dialogIsTopmost: false, topmost: "no overlap" };
    }

    const topmost = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
    return {
      overlaps: true,
      dialogIsTopmost: topmost !== null && element.contains(topmost),
      topmost: topmost?.className || topmost?.tagName || "none",
    };
  });

  expect(paintOrder.overlaps, `${dialogName} 팝오버와 U4 지도 헤더가 겹쳐야 한다`).toBe(true);
  expect(
    paintOrder.dialogIsTopmost,
    `${dialogName} 겹침 지점 최상단 요소: ${paintOrder.topmost}`,
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
}
```

상태 viewport 테스트들 앞에 U4 전용 회귀를 추가한다.

```ts
test("U4 상태 정보 팝오버가 지도 헤더 위에 표시된다", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/u4-test");

  await expectPopoverAboveMapHeader(page, "zero-trust-info-trigger", "의심 인원");
  await expectPopoverAboveMapHeader(page, "remaining-adventurers-info-trigger", "남은 용사");
});
```

- [ ] **Step 2: 새 회귀가 현재 레이어에서 올바른 이유로 실패하는지 확인한다**

Run:

```bash
pnpm exec playwright test e2e/canvas-layout.spec.ts --grep "U4 상태 정보 팝오버가 지도 헤더 위에 표시된다"
```

Expected: FAIL. 두 팝오버 중 첫 검사에서 `overlaps`는 `true`이고 `dialogIsTopmost`는 `false`이며, 실패 메시지는 U4 지도 헤더 또는 그 자식이 겹침 지점의 최상단임을 보여야 한다. 라우트 누락, selector 오류, 서버 오류로 실패하면 테스트를 고친 뒤 이 기대 실패를 다시 확인한다.

- [ ] **Step 3: 공통 상태 바 스태킹 컨텍스트만 최소 변경한다**

`app/globals.css`의 공통 상태 바 규칙에서 `z-index`를 화면 내부 최고 레이어 `50`보다 높고 전역 퀵 메뉴 `80`보다 낮은 `60`으로 변경하고 이유를 남긴다.

```css
.game-shell__status-bar {
  position: relative;
  /* 화면 내부 overlay(최대 50) 위, 전역 퀵 메뉴(80) 아래에 둔다. */
  z-index: 60;
  min-width: 0;
```

팝오버의 `top`, `left`, `translate`, 로컬 `z-index: 20`과 U4 지도 CSS는 변경하지 않는다.

- [ ] **Step 4: 새 U4 회귀가 통과하는지 확인한다**

Run:

```bash
pnpm exec playwright test e2e/canvas-layout.spec.ts --grep "U4 상태 정보 팝오버가 지도 헤더 위에 표시된다"
```

Expected: PASS. `의심 인원`과 `남은 용사` 모두 교차 영역이 존재하고 그 지점의 최상단 요소가 dialog 자신 또는 dialog의 자식이어야 한다.

- [ ] **Step 5: 기존 상태 칩·앵커·퀵 메뉴 회귀를 함께 실행한다**

Run:

```bash
pnpm exec playwright test e2e/canvas-layout.spec.ts
```

Expected: 모든 `canvas-layout.spec.ts` 테스트 PASS. 특히 FHD·HD·5:4의 8칩 한 줄, 팝오버의 트리거 아래 중앙 정렬, Escape/닫기 초점 복귀, 퀵 메뉴 패널 비겹침 계약이 유지되어야 한다.

- [ ] **Step 6: 변경을 커밋한다**

```bash
git add e2e/canvas-layout.spec.ts app/globals.css
git commit -m "수정: 상태 정보 팝오버를 지도 위에 표시한다" -m "U4 지도 헤더와 겹치는 지점의 페인팅 순서를 브라우저 회귀로 고정한다.\n공통 상태 바를 화면 콘텐츠 위, 전역 퀵 메뉴 아래 레이어로 올린다."
```

### Task 2: 전체 회귀와 production 검증

**Files:**

- Verify only: `e2e/canvas-layout.spec.ts`
- Verify only: `app/globals.css`

**Interfaces:**

- Consumes: Task 1의 U4 페인팅 순서 회귀와 `z-index: 60` 공통 상태 바 계약.
- Produces: 단위·타입·정적 분석·production build가 모두 통과한 완료 증거.

- [ ] **Step 1: 전체 Vitest 회귀를 실행한다**

Run:

```bash
pnpm test
```

Expected: 최소 기준선 `147 files / 1759 tests` 이상 PASS, 실패 0.

- [ ] **Step 2: TypeScript 검사를 실행한다**

Run:

```bash
pnpm typecheck
```

Expected: exit code 0, TypeScript 오류 0.

- [ ] **Step 3: ESLint를 실행한다**

Run:

```bash
pnpm lint
```

Expected: exit code 0. 기존 경고가 있다면 새 변경에서 발생한 것이 아님을 확인하고 정확한 경고를 완료 보고에 기록한다.

- [ ] **Step 4: production build를 실행한다**

Run:

```bash
pnpm build
```

Expected: Next.js 16.3 production build PASS.

- [ ] **Step 5: 최종 변경 범위와 작업 트리를 확인한다**

Run:

```bash
git diff main...HEAD -- app/globals.css e2e/canvas-layout.spec.ts docs/README.md docs/experience/SCREEN_LAYOUT.md docs/technical/SCREEN_ADAPTER_CONTRACT.md docs/superpowers/specs/2026-08-26-lattebun-status-info-popover-layering-design.md docs/superpowers/plans/2026-08-26-lattebun-status-info-popover-layering.md
git status --short
```

Expected: 승인된 spec·plan·공식 문서, U4 E2E 회귀, 공통 상태 바 레이어 수정만 포함하며 작업 트리가 깨끗하다.
