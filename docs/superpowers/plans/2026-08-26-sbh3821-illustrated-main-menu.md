# 일러스트 통합 메인 메뉴 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 승인된 「용사님, 이쪽입니다」 일러스트를 16:9 메인 화면으로 적용하고, 이미지 속 중앙 명패를 캠페인·업적·설정 실제 컨트롤로 교체한다.

**Architecture:** `MainMenuScreen`은 세 메뉴의 정적 구조와 접근 가능한 제목을 담당하고, `MainMenu` wrapper만 전역 퀵 메뉴 context를 소비한다. `AppFrame`이 계속 퀵 메뉴 상태를 소유하되 작은 `AppQuickMenuContext`로 `openQuickMenu(trigger)`를 제공하여 메인 설정 버튼에서 열고 같은 버튼으로 포커스를 복귀시킨다. 배경과 버튼은 공통 16:9 `.main-menu-screen__canvas` 좌표계를 사용한다.

**Tech Stack:** Next.js 16.3 App Router, React 19.2, TypeScript 5, CSS container units, Vitest 4, Playwright 1.62, imagegen 이미지 편집

**Spec:** `docs/superpowers/specs/2026-08-26-sbh3821-illustrated-main-menu-design.md`

## Global Constraints

- Node.js `24.19.0`과 pnpm `11.21.0`을 사용한다.
- 원본 1536 × 1024 이미지의 좌·우·상단은 유지하고 하단 160px만 제거해 1536 × 864로 만든다.
- 생성형 보정, 새 오브젝트 추가, 제목 재작성, 인물·조명·색감 변경을 하지 않는다.
- 캠페인 링크는 `/campaign`, `prefetch={false}`를 유지한다.
- 업적 링크는 `/achievements?returnTo=/`를 유지한다.
- 캠페인·업적·오디오 저장 데이터와 내부 식별자를 변경하지 않는다.
- 메인 화면에서는 우상단 퀵 메뉴 trigger를 숨기고, 캠페인에서는 유지한다.
- 실제 컨트롤은 키보드 Tab, 명시적 focus-visible, 최소 44 CSS px 터치 높이를 제공한다.
- 이미지 편집은 `imagegen`을 사용하고 결과를 시각적으로 검사한다.

---

## 파일 구조

| 파일 | 책임 |
| --- | --- |
| `public/assets/main-menu/hero-this-way-main-menu.webp` | 하단 UI가 제거된 1536 × 864 런타임 배경 |
| `components/game/AppQuickMenuContext.tsx` | 메인 메뉴가 AppFrame의 퀵 메뉴를 여는 최소 context |
| `components/game/AppQuickMenuContext.test.tsx` | provider 유무와 open callback 계약 |
| `components/game/AppFrame.tsx` | 퀵 메뉴 open 상태·focus 복귀 대상·route별 trigger 표시 소유 |
| `components/game/GlobalQuickMenu.tsx` | trigger 표시 여부와 외부 focus 복귀 ref 수용 |
| `components/game/MainMenuScreen.tsx` | 이미지 캔버스, 접근 가능한 제목, 세 실제 메뉴 컨트롤 |
| `components/game/MainMenuScreen.test.tsx` | 링크·설정 버튼·제목·이미지 계약 |
| `app/main-menu.css` | 16:9 캔버스와 이미지 명패를 덮는 반응형 버튼 |
| `app/app-frame.css` | route별 숨김 대신 prop 기반 trigger 숨김 스타일 |
| `e2e/illustrated-main-menu.spec.ts` | 데스크톱·모바일 좌표와 세 메뉴 동작 검증 |
| `docs/experience/ONBOARDING_AND_INTERFACE.md` | 세 갈래 메인 진입과 메인 설정 버튼 계약 |
| `docs/experience/UI_IMPLEMENTATION_GUIDE.md` | 승인 일러스트의 16:9 고정 좌표계 기록 |
| `docs/diagram/png/screen-main-menu.png` | 구현 후 실제 대표 캡처 |

---

### Task 1: 승인 일러스트를 16:9 런타임 자산으로 준비

**Files:**
- Create: `public/assets/main-menu/hero-this-way-main-menu.webp`
- Create: `components/game/MainMenuAsset.test.ts`

**Interfaces:**
- Consumes: 대화에 첨부된 1536 × 1024 승인 이미지
- Produces: `/assets/main-menu/hero-this-way-main-menu.webp`, 정확한 크기 `1536 × 864`

- [ ] **Step 1: 자산 계약 실패 테스트 작성**

`components/game/MainMenuAsset.test.ts`에 WebP RIFF 헤더와 VP8X canvas 크기를 읽는 작은 순수 parser를 넣고 파일 존재와 크기를 고정한다.

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function uint24le(bytes: Buffer, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function vp8xSize(bytes: Buffer) {
  expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
  expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
  expect(bytes.toString("ascii", 12, 16)).toBe("VP8X");
  return { width: uint24le(bytes, 24) + 1, height: uint24le(bytes, 27) + 1 };
}

describe("메인 메뉴 일러스트", () => {
  it("하단 보조 메뉴가 제거된 1536 × 864 WebP다", () => {
    const bytes = readFileSync(join(process.cwd(), "public/assets/main-menu/hero-this-way-main-menu.webp"));
    expect(vp8xSize(bytes)).toEqual({ width: 1536, height: 864 });
  });
});
```

- [ ] **Step 2: 테스트를 실행해 자산 부재로 실패 확인**

Run: `pnpm exec vitest run components/game/MainMenuAsset.test.ts`

Expected: FAIL with `ENOENT ... hero-this-way-main-menu.webp`.

- [ ] **Step 3: imagegen으로 하단만 제거한 이미지 생성**

대화의 최근 승인 이미지를 입력으로 포함하고 다음 편집 프롬프트를 사용한다.

```text
이 이미지는 게임 메인 메뉴의 승인 원본이다. 새 그림을 생성하거나 내용을 다시
그리지 말고 크롭만 수행한다. 원본 1536×1024의 x=0, y=0, width=1536,
height=864 영역만 남겨 정확히 1536×864로 출력한다. 좌우와 상단 픽셀, 고블린,
한글 제목, 중앙 버튼, 조명, 색감은 변경하지 않는다. 아래 160px에 있던 좌하단
아이콘과 우하단 버전 문구만 프레임 밖으로 제거한다.
```

imagegen 결과를 먼저 직접 보고 제목 철자와 얼굴·손·지도·중앙 버튼이 바뀌지
않았는지 확인한다. 결과를 `public/assets/main-menu/hero-this-way-main-menu.webp`로
저장하고 필요하면 이미지 도구로 포맷만 WebP lossless로 변환한다. 생성형 내용
변화가 있으면 채택하지 않고 같은 입력으로 crop-only 편집을 다시 요청한다.

- [ ] **Step 4: 자산 크기 테스트와 육안 검사 통과 확인**

Run: `pnpm exec vitest run components/game/MainMenuAsset.test.ts`

Expected: PASS, `1536 × 864`.

이미지를 열어 좌하단 아이콘·버전 문구가 없고 중앙 세 버튼이 모두 남았음을 확인한다.

- [ ] **Step 5: 자산과 테스트 커밋**

```bash
git add public/assets/main-menu/hero-this-way-main-menu.webp components/game/MainMenuAsset.test.ts
git commit -m "화면: 메인 메뉴 일러스트 자산을 추가한다" -m "승인 원본의 하단 보조 UI만 제거한 1536대864 배경과 크기 회귀 테스트를 추가한다."
```

---

### Task 2: 메인 설정 버튼과 전역 퀵 메뉴 상태를 연결

**Files:**
- Create: `components/game/AppQuickMenuContext.tsx`
- Create: `components/game/AppQuickMenuContext.test.tsx`
- Modify: `components/game/AppFrame.tsx`
- Modify: `components/game/GlobalQuickMenu.tsx`
- Modify: `components/game/GlobalQuickMenu.test.tsx`

**Interfaces:**
- Produces: `useAppQuickMenu(): { openQuickMenu(trigger: HTMLElement): void }`
- Produces: `GlobalQuickMenuProps.triggerVisible: boolean`
- Produces: `GlobalQuickMenuProps.restoreFocusRef: RefObject<HTMLElement | null>`
- Consumes: 기존 `GlobalQuickMenu` open/close callback과 AppFrame state

- [ ] **Step 0: 현재 Next.js 16의 client navigation 계약 확인**

다음 저장소 내 공식 문서를 끝까지 읽고 `usePathname()`이 Client Component에서만
호출된다는 점과 `Link prefetch={false}` 계약을 확인한다.

```text
node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-pathname.md
node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md
node_modules/next/dist/docs/01-app/01-getting-started/12-images.md
```

- [ ] **Step 1: context와 trigger 표시 계약의 실패 테스트 작성**

`AppQuickMenuContext.test.tsx`는 provider 없이 hook을 쓰면 명시적 오류가 나고,
provider callback이 전달되는지 테스트한다. `GlobalQuickMenu.test.tsx`의 helper에
`triggerVisible`을 추가하고 다음 계약을 넣는다.

```tsx
it("메인 화면에서는 trigger를 숨겨도 열린 panel은 유지한다", () => {
  const html = renderMenu({
    open: true,
    bgmEnabled: false,
    sfxEnabled: false,
    triggerVisible: false,
  });
  expect(html).toContain('class="global-quick-menu__trigger global-quick-menu__trigger--hidden"');
  expect(html).toContain('id="global-quick-menu-panel"');
});
```

- [ ] **Step 2: 테스트를 실행해 새 API 부재로 실패 확인**

Run: `pnpm exec vitest run components/game/AppQuickMenuContext.test.tsx components/game/GlobalQuickMenu.test.tsx`

Expected: FAIL because `AppQuickMenuContext` and `triggerVisible` do not exist.

- [ ] **Step 3: 최소 context 구현**

`AppQuickMenuContext.tsx`에 다음 공개 경계를 구현한다.

```tsx
"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface AppQuickMenuValue {
  readonly openQuickMenu: (trigger: HTMLElement) => void;
}

const AppQuickMenuContext = createContext<AppQuickMenuValue | null>(null);

export function AppQuickMenuProvider({ value, children }: {
  readonly value: AppQuickMenuValue;
  readonly children: ReactNode;
}) {
  return <AppQuickMenuContext value={value}>{children}</AppQuickMenuContext>;
}

export function useAppQuickMenu() {
  const value = useContext(AppQuickMenuContext);
  if (value === null) throw new Error("useAppQuickMenu must be used inside AppQuickMenuProvider");
  return value;
}
```

`AppFrame`은 `usePathname()`으로 `/` 여부를 계산하고 `restoreFocusRef`를
`useRef<HTMLElement | null>(null)`로 둔다. `openQuickMenu(trigger)`는 해당 ref에
trigger를 저장하고 `setMenuOpen(true)`를 호출한다. `children`은 provider로 감싼다.
`GlobalQuickMenu`에는 `triggerVisible={pathname !== "/"}`와 restore ref를 넘긴다.

`GlobalQuickMenu`의 Escape·바깥 클릭 focus 복귀는 기존 trigger ref 대신
`restoreFocusRef.current ?? buttonRef.current`를 사용한다. trigger는 DOM과 기존
`aria-controls` 계약을 유지하되 hidden modifier class와 `tabIndex={-1}`을 받는다.

- [ ] **Step 4: context와 기존 메뉴 테스트 통과 확인**

Run: `pnpm exec vitest run components/game/AppQuickMenuContext.test.tsx components/game/GlobalQuickMenu.test.tsx`

Expected: PASS.

- [ ] **Step 5: 전역 퀵 메뉴 연결 커밋**

```bash
git add components/game/AppQuickMenuContext.tsx components/game/AppQuickMenuContext.test.tsx components/game/AppFrame.tsx components/game/GlobalQuickMenu.tsx components/game/GlobalQuickMenu.test.tsx
git commit -m "기능: 메인 설정 버튼에서 전역 메뉴를 연다" -m "AppFrame의 퀵 메뉴 상태를 최소 context로 공개하고 열린 출발점으로 포커스를 복귀시킨다."
```

---

### Task 3: 일러스트 위에 실제 메인 메뉴 버튼 배치

**Files:**
- Modify: `components/game/MainMenuScreen.tsx`
- Modify: `components/game/MainMenuScreen.test.tsx`
- Modify: `app/main-menu.css`
- Modify: `app/app-frame.css`

**Interfaces:**
- Consumes: `useAppQuickMenu().openQuickMenu(trigger)`
- Produces: `MainMenuScreenProps.onOpenSettings(event: React.MouseEvent<HTMLButtonElement>): void`
- Produces: `.main-menu-screen__canvas` 16:9 공통 좌표계

- [ ] **Step 1: 새 화면 구조의 실패 테스트 작성**

기존 달성 수 표시 테스트는 삭제한다. 데이터는 계속 store에 남지만 새 메인 구도에
표시하지 않는 것이 승인 계약이다. `MainMenuScreen.test.tsx`에서 순수 화면을 다음
props로 렌더한다.

```tsx
const onOpenSettings = vi.fn();
const html = renderToStaticMarkup(createElement(MainMenuScreen, { onOpenSettings }));

expect(html).toContain('src="/assets/main-menu/hero-this-way-main-menu.webp"');
expect(html).toContain('class="main-menu-screen__accessible-title"');
expect(html).toContain("용사님, 이쪽입니다");
expect(html).toContain('href="/campaign"');
expect(html).toContain('data-prefetch="false"');
expect(html).toContain('href="/achievements?returnTo=%2F"');
expect(html).toContain('aria-haspopup="menu"');
expect(html).toContain(">설정</button>");
expect(html).not.toContain("3 / 12");
```

별도 client interaction 테스트에서는 설정 버튼 click event의 `currentTarget`이
`openQuickMenu`에 전달되는 것을 확인한다.

- [ ] **Step 2: 테스트를 실행해 기존 화면 구조 때문에 실패 확인**

Run: `pnpm exec vitest run components/game/MainMenuScreen.test.tsx`

Expected: FAIL because the image, settings button and new props are absent.

- [ ] **Step 3: 최소 화면 마크업 구현**

`MainMenuScreen`에서 `unlockedCount`, `loading`을 제거하고
`onOpenSettings`만 받는다. 구조는 다음 계약을 따른다.

```tsx
<main className="main-menu-screen">
  <div className="main-menu-screen__canvas">
    <img
      className="main-menu-screen__art"
      src="/assets/main-menu/hero-this-way-main-menu.webp"
      alt=""
    />
    <h1 className="main-menu-screen__accessible-title">용사님, 이쪽입니다</h1>
    <nav className="main-menu-screen__actions" aria-label="메인 메뉴">
      <Link className="main-menu-screen__action main-menu-screen__start" href="/campaign" prefetch={false}>캠페인 시작</Link>
      <Link className="main-menu-screen__action" href={{ pathname: "/achievements", query: { returnTo: "/" } }}>업적</Link>
      <button className="main-menu-screen__action" type="button" aria-haspopup="menu" onClick={onOpenSettings}>설정</button>
    </nav>
  </div>
</main>
```

`MainMenu`은 `useAppQuickMenu`를 읽고 `event.currentTarget`을 넘긴다. 더 이상
`PlayerProgressProvider`를 구독하지 않는다.

- [ ] **Step 4: 16:9 배치 CSS 구현**

`main-menu.css`의 기존 제목·shade·달성 수 규칙을 제거하고 다음 좌표 계약을
구현한다.

```css
.main-menu-screen {
  display: grid;
  width: 100%;
  height: 100%;
  overflow: hidden;
  place-items: center;
  background: #050403;
}

.main-menu-screen__canvas {
  position: relative;
  width: min(100%, calc(100vh * 16 / 9));
  aspect-ratio: 16 / 9;
  max-height: 100%;
}

.main-menu-screen__art {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.main-menu-screen__accessible-title {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

.main-menu-screen__actions {
  position: absolute;
  left: 35.15%;
  top: 52.55%;
  display: grid;
  width: 29.95%;
  gap: 2.15%;
}

.main-menu-screen__action {
  display: grid;
  min-height: max(44px, 7.2cqh);
  place-items: center;
  border: 1px solid #a98445;
  color: #e7c98b;
  background: linear-gradient(180deg, #171315 0%, #090708 100%);
}
```

실제 캡처에서 원본 명패 테두리가 삐져나오면 `left`, `top`, `width`, row height를
0.1% 단위로 조정하되 세 viewport에서 같은 상수만 사용한다.

`app-frame.css`에는 `.global-quick-menu__trigger--hidden { visibility: hidden; }`를
추가한다. 열린 panel은 `visibility`를 상속하지 않도록 trigger 자체에만 적용한다.

- [ ] **Step 5: 메인 메뉴 테스트와 타입 검사 통과 확인**

Run: `pnpm exec vitest run components/game/MainMenuScreen.test.tsx components/game/GlobalQuickMenu.test.tsx && pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: 화면 구현 커밋**

```bash
git add components/game/MainMenuScreen.tsx components/game/MainMenuScreen.test.tsx app/main-menu.css app/app-frame.css
git commit -m "화면: 일러스트 위에 메인 메뉴를 배치한다" -m "16대9 장면 좌표계에서 캠페인·업적·설정 실제 컨트롤이 원본 명패를 덮도록 구성한다."
```

---

### Task 4: 실제 이동·반응형 좌표와 공식 문서 검증

**Files:**
- Create: `e2e/illustrated-main-menu.spec.ts`
- Modify: `docs/experience/ONBOARDING_AND_INTERFACE.md`
- Modify: `docs/experience/UI_IMPLEMENTATION_GUIDE.md`
- Modify: `docs/diagram/png/screen-main-menu.png`
- Modify: `docs/diagram/screens.md`

**Interfaces:**
- Consumes: 메인 메뉴의 `campaign`, `achievements`, `settings` 컨트롤
- Produces: 데스크톱·모바일 가로 브라우저 회귀와 최신 대표 캡처

- [ ] **Step 1: 브라우저 실패 테스트 작성**

`e2e/illustrated-main-menu.spec.ts`에서 두 viewport를 반복한다.

```ts
for (const viewport of [
  { name: "desktop", width: 1536, height: 864 },
  { name: "mobile-landscape", width: 844, height: 390 },
]) {
  test(`${viewport.name} 메인 메뉴의 세 실제 버튼이 이미지 안에 정렬된다`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const canvas = page.locator(".main-menu-screen__canvas");
    const actions = page.getByRole("navigation", { name: "메인 메뉴" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("용사님, 이쪽입니다");
    await expect(actions.getByRole("link", { name: "캠페인 시작" })).toBeVisible();
    await expect(actions.getByRole("link", { name: "업적" })).toBeVisible();
    await expect(actions.getByRole("button", { name: "설정" })).toBeVisible();
    await expect(page.getByRole("button", { name: "빠른 메뉴 열기" })).toBeHidden();

    const canvasBox = await canvas.boundingBox();
    const actionsBox = await actions.boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(actionsBox).not.toBeNull();
    expect(actionsBox!.x).toBeGreaterThan(canvasBox!.x);
    expect(actionsBox!.x + actionsBox!.width).toBeLessThan(canvasBox!.x + canvasBox!.width);
    expect(actionsBox!.y + actionsBox!.height).toBeLessThan(canvasBox!.y + canvasBox!.height);
  });
}

test("설정은 기존 전역 메뉴를 열고 업적과 캠페인은 실제 route로 이동한다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "설정" }).click();
  await expect(page.getByRole("region", { name: "빠른 메뉴" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "설정" })).toBeFocused();

  await page.getByRole("link", { name: "업적" }).click();
  await expect(page).toHaveURL(/\/achievements\?returnTo=%2F$/);
  await page.goto("/");
  await page.getByRole("link", { name: "캠페인 시작" }).click();
  await expect(page).toHaveURL(/\/campaign$/);
});
```

- [ ] **Step 2: 브라우저 테스트를 실행해 미구현 동작 또는 좌표 실패 확인**

Run: `pnpm exec playwright test e2e/illustrated-main-menu.spec.ts --project=chromium`

Expected: FAIL before final browser/layout adjustments.

- [ ] **Step 3: 프로덕션 빌드에서 두 viewport를 캡처하고 좌표 조정**

Run:

```bash
pnpm build --webpack
pnpm start --hostname 0.0.0.0 --port 3015
pnpm exec playwright test e2e/illustrated-main-menu.spec.ts --project=chromium
```

1536 × 864와 844 × 390 스크린샷을 Git 밖의
`/Users/semin/Develop/Dungeon_Schemer-main-menu-preview-2026-08-26/`에도 저장한다.
원본 버튼 테두리가 보이면 Task 3의 백분율 상수만 조정하고 테스트를 재실행한다.

- [ ] **Step 4: 공식 문서와 대표 캡처 갱신**

`ONBOARDING_AND_INTERFACE.md`의 첫 화면을 캠페인·업적·설정 세 진입으로 고치고,
전역 퀵 메뉴 절에는 메인에서 중앙 설정 버튼이 같은 메뉴를 연다고 기록한다.
`UI_IMPLEMENTATION_GUIDE.md`에는 승인된 메인 이미지는 16:9 전체 캔버스와 공통
좌표계를 사용하며 crop/cover로 내부 좌표를 어긋나게 하지 않는다고 기록한다.

1536 × 864 실제 캡처를 `docs/diagram/png/screen-main-menu.png`에 저장하고
`docs/diagram/screens.md`의 설명을 실제 세 버튼과 일치시킨다.

- [ ] **Step 5: 전체 검증 실행**

Run:

```bash
pnpm exec vitest run --testTimeout=15000
pnpm typecheck
pnpm lint
pnpm build --webpack
pnpm exec playwright test e2e/illustrated-main-menu.spec.ts e2e/visible-game-title.spec.ts --project=chromium
git diff --check
```

Expected: Vitest 0 failures, TypeScript 0 errors, ESLint 0 errors, production build success, Playwright 0 failures, `git diff --check` 0 output. 기존 경고가 있으면 개수와 이번 변경과의 관련 여부를 기록한다.

- [ ] **Step 6: 브라우저·문서 변경 커밋**

```bash
git add e2e/illustrated-main-menu.spec.ts docs/experience/ONBOARDING_AND_INTERFACE.md docs/experience/UI_IMPLEMENTATION_GUIDE.md docs/diagram/png/screen-main-menu.png docs/diagram/screens.md
git commit -m "검증: 일러스트 메인 메뉴 동선을 고정한다" -m "데스크톱과 모바일 가로 화면에서 세 메뉴의 좌표·이동·설정 포커스를 검증하고 공식 화면 문서를 갱신한다."
```

---

## 최종 확인

- [ ] `git status -sb`가 예상 커밋만 포함하고 작업 트리가 깨끗하다.
- [ ] `/`, `/campaign`, `/achievements`가 production server에서 HTTP 200이다.
- [ ] 메인 화면의 하단 아이콘과 버전 문구가 보이지 않는다.
- [ ] 이미지 제목은 `용사님, 이쪽입니다`로 읽히며 접근 가능한 `<h1>`도 같은 문구다.
- [ ] 캠페인·업적·설정 버튼을 마우스, 키보드, 모바일 터치로 각각 사용할 수 있다.
- [ ] Git 밖 스크린샷 폴더와 로컬·LAN 확인 링크를 사용자에게 제공한다.
