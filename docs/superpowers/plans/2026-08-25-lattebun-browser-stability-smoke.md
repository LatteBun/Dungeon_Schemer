# 브라우저 안정성 스모크 테스트 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 최신 `main`의 공개 화면, 첫 사건 결과까지의 캠페인 흐름, 공식 고정 캔버스 viewport 계약을 Chromium에서 `pnpm test:e2e` 한 명령으로 검증한다.

**Architecture:** `@playwright/test`가 별도 포트의 Next.js 개발 서버를 자동으로 기동하고, `e2e/`의 세 spec이 경로 렌더링·캠페인 클릭·캔버스 배치를 각각 소유한다. 공통 helper는 브라우저 예외 수집만 담당하며 게임 규칙이나 랜덤 결과를 복제하지 않는다.

**Tech Stack:** Node.js 24.19.0, pnpm 11.21.0, Next.js 16.3.0 App Router, TypeScript, Playwright Test, Chromium

**Spec:** `docs/superpowers/specs/2026-08-25-lattebun-browser-stability-smoke-design.md`

## Global Constraints

- 구현 기준은 실행 시점의 최신 `origin/main`이며, 기존 B1 브랜치와 사용자 미추적 에셋을 건드리지 않는다.
- 시작할 때 `superpowers:using-git-worktrees`로 `test/browser-stability-smoke` 작업 공간을 확인하고, 이미 존재하면 재사용한다.
- 구현은 `superpowers:test-driven-development`를 따라 실패 확인 뒤 최소 코드를 작성한다.
- 완료 주장 전 `superpowers:verification-before-completion`, PR 전 `superpowers:requesting-code-review`, 통합 선택 시 `superpowers:finishing-a-development-branch`를 사용한다.
- Playwright는 `devDependency`와 `pnpm-lock.yaml`에 고정하고, 전역 `agent-browser`에 의존하지 않는다.
- 브라우저는 Chromium 하나만 사용한다. GitHub Actions, Firefox, WebKit, 픽셀 골든 비교는 범위 밖이다.
- 공식 viewport는 1920×1080, 2560×1440, 1440×900, 1280×1024다. 모바일 재배치 계약을 새로 만들지 않는다.
- 고정 시간 `sleep`과 랜덤 실패 시 재시도·새로고침을 사용하지 않는다.
- 새 커밋은 제목과 본문을 모두 한글로 작성한다.
- 실제 Next.js 코드를 변경해야 하는 상황이 발견되면 현재 계획을 멈추고 관련 `node_modules/next/dist/docs/` 문서를 다시 확인한 뒤 별도 버그 범위로 분리한다.

---

## 파일 구조

- `playwright.config.ts`: Chromium 프로젝트, baseURL, Next.js webServer, 실패 산출물 정책만 소유한다.
- `e2e/browser-errors.ts`: `pageerror`와 `console.error`를 수집하고 문맥 있는 assertion으로 변환한다.
- `e2e/routes.spec.ts`: 아홉 공개 경로의 응답·고유 표식·빈 화면·Next 오류 회귀를 소유한다.
- `e2e/campaign-smoke.spec.ts`: 기본 고정 seed 캠페인의 첫 사건 결과까지 사용자 클릭 전이를 소유한다.
- `e2e/canvas-layout.spec.ts`: 세 대표 화면×네 공식 viewport의 고정 캔버스 치수와 overflow를 소유한다.
- `package.json`, `pnpm-lock.yaml`: 설치·실행 명령과 Playwright 버전을 고정한다.
- `.gitignore`: Playwright 리포트와 실행 결과를 제외한다.
- `docs/technical/DEVELOPMENT_ENVIRONMENT.md`: E2E 설치·실행·Vitest와의 책임 경계를 공식화한다.
- `docs/README.md`: 승인된 spec과 plan의 탐색 링크를 추가한다.

### Task 1: Playwright 실행 기반

**Files:**
- Create: `playwright.config.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: 기존 `pnpm dev`, Next.js 16.3.0, 비어 있는 `e2e/` 테스트 경계
- Produces: `pnpm test:e2e:install`, `pnpm test:e2e`, `baseURL=http://127.0.0.1:3100`, Chromium 프로젝트

- [ ] **Step 1: 작업 기준과 격리를 확인한다**

Run:

```bash
git status --short
git rev-parse --abbrev-ref HEAD
git log -1 --oneline
```

Expected: 브랜치는 `test/browser-stability-smoke`, spec 커밋 외 작업 변경은 없고 사용자 소유 파일이 이 worktree에 섞이지 않는다.

- [ ] **Step 2: Playwright가 아직 프로젝트 명령이 아님을 확인한다**

Run:

```bash
pnpm exec playwright test --list
```

Expected: FAIL. 로컬 `playwright` 실행 파일 또는 설정이 없다는 메시지가 나온다.

- [ ] **Step 3: Playwright Test를 개발 의존성으로 고정한다**

Run:

```bash
pnpm add --save-dev @playwright/test
```

Expected: `package.json`의 `devDependencies`와 `pnpm-lock.yaml`만 의존성 설치 때문에 변경된다. npm이 아니라 저장소 표준인 pnpm을 사용한다.

- [ ] **Step 4: 실행 스크립트를 추가한다**

`package.json`의 `scripts`에 다음 두 항목을 추가한다.

```json
"test:e2e:install": "playwright install chromium",
"test:e2e": "playwright test"
```

- [ ] **Step 5: Playwright 설정을 작성한다**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: [
    ["line"],
    ["html", { open: "never" }],
  ],
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm exec next dev --webpack -p ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

- [ ] **Step 6: 실행 산출물을 Git에서 제외한다**

Append to `.gitignore`:

```gitignore

# Playwright
/playwright-report/
/test-results/
```

- [ ] **Step 7: Chromium을 설치하고 설정이 테스트를 발견할 준비가 됐는지 확인한다**

Run:

```bash
pnpm test:e2e:install
pnpm exec playwright test --list
```

Expected: Chromium 설치가 성공한다. 아직 spec이 없으므로 목록은 0 tests이며 설정 구문 오류가 없어야 한다.

- [ ] **Step 8: 정적 검증을 실행한다**

Run:

```bash
pnpm lint
pnpm typecheck
```

Expected: 둘 다 PASS.

- [ ] **Step 9: 실행 기반을 커밋한다**

```bash
git add package.json pnpm-lock.yaml playwright.config.ts .gitignore
git commit -m "테스트: Playwright 실행 기반을 추가한다" -m "Chromium 설치와 로컬 E2E 실행 명령, Next.js 자동 서버, 실패 산출물 정책을 고정한다."
```

### Task 2: 공개 경로와 브라우저 오류 회귀

**Files:**
- Create: `e2e/browser-errors.ts`
- Create: `e2e/routes.spec.ts`

**Interfaces:**
- Consumes: Playwright `Page`, `expect`, Task 1의 `baseURL`과 Chromium 프로젝트
- Produces: `watchBrowserErrors(page): BrowserFailure[]`, `expectNoBrowserErrors(failures, context): void`, 아홉 경로 스모크

- [ ] **Step 1: 공개 경로 테스트를 먼저 작성한다**

Create `e2e/routes.spec.ts`:

```ts
import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectNoBrowserErrors, watchBrowserErrors } from "./browser-errors";

interface RouteCase {
  readonly path: string;
  readonly marker: (page: Page) => Locator;
}

const ROUTES: readonly RouteCase[] = [
  { path: "/", marker: (page) => page.getByRole("heading", { level: 1, name: "Dungeon Schemer" }) },
  { path: "/campaign", marker: (page) => page.getByRole("main", { name: /던전은 검보다 먼저 말을 건넨다/ }) },
  { path: "/u1-test", marker: (page) => page.getByRole("heading", { level: 1, name: "인트로" }) },
  { path: "/u2-test", marker: (page) => page.getByRole("main", { name: /던전은 검보다 먼저 말을 건넨다/ }) },
  { path: "/u3-test", marker: (page) => page.getByRole("heading", { level: 1, name: "길드 게시판" }) },
  { path: "/u4-test", marker: (page) => page.getByRole("region", { name: "던전 지도" }) },
  { path: "/u5-test", marker: (page) => page.getByTestId("u5-progress") },
  { path: "/u5-2-test", marker: (page) => page.getByTestId("u5-progress") },
  { path: "/u6-test", marker: (page) => page.getByRole("heading", { level: 1, name: /정산 · 거미굴 3/ }) },
];

for (const route of ROUTES) {
  test(`${route.path} 공개 화면이 브라우저 오류 없이 렌더링된다`, async ({ page }) => {
    const failures = watchBrowserErrors(page);
    const response = await page.goto(route.path);

    expect(response?.ok(), `${route.path} document response`).toBe(true);
    await expect(route.marker(page)).toBeVisible();
    await expect(page.locator("body")).not.toHaveText("");
    await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
    expectNoBrowserErrors(failures, route.path);
  });
}
```

- [ ] **Step 2: helper가 없어서 수집 단계가 실패하는지 확인한다**

Run:

```bash
pnpm exec playwright test e2e/routes.spec.ts
```

Expected: FAIL with module resolution error for `./browser-errors`.

- [ ] **Step 3: 좁은 브라우저 오류 수집 helper를 구현한다**

Create `e2e/browser-errors.ts`:

```ts
import { expect, type Page } from "@playwright/test";

export interface BrowserFailure {
  readonly kind: "pageerror" | "console.error";
  readonly message: string;
}

export function watchBrowserErrors(page: Page): BrowserFailure[] {
  const failures: BrowserFailure[] = [];

  page.on("pageerror", (error) => {
    failures.push({ kind: "pageerror", message: error.stack ?? error.message });
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push({ kind: "console.error", message: message.text() });
    }
  });

  return failures;
}

export function expectNoBrowserErrors(
  failures: readonly BrowserFailure[],
  context: string,
): void {
  expect(failures, `${context} 브라우저 오류`).toEqual([]);
}
```

광범위한 오류 무시 목록은 만들지 않는다. 실제 Next.js 개발 로그가 `console.error`로
확인될 경우에만 메시지와 출처가 정확히 일치하는 좁은 예외를 별도 승인받는다.

- [ ] **Step 4: 경로 회귀를 실행한다**

Run:

```bash
pnpm exec playwright test e2e/routes.spec.ts
```

Expected: Chromium에서 9 tests PASS. 실패하면 고유 표식이 실제 접근성 이름과 다른지 snapshot으로 확인하고, 랜덤 수치가 아닌 안정된 사용자 문구로만 selector를 조정한다.

- [ ] **Step 5: 기존 테스트 러너와 타입 경계를 확인한다**

Run:

```bash
pnpm test
pnpm typecheck
```

Expected: Vitest가 `e2e/*.spec.ts`를 수집하지 않고 기존 테스트와 TypeScript가 PASS.

- [ ] **Step 6: 공개 경로 회귀를 커밋한다**

```bash
git add e2e/browser-errors.ts e2e/routes.spec.ts
git commit -m "테스트: 공개 화면 브라우저 오류를 검증한다" -m "아홉 경로의 응답과 고유 화면 표식, 빈 화면, Next 오류 오버레이, pageerror와 console.error를 회귀 검사한다."
```

### Task 3: 첫 사건 결과까지 캠페인 클릭 흐름

**Files:**
- Create: `e2e/campaign-smoke.spec.ts`

**Interfaces:**
- Consumes: `watchBrowserErrors`, 기본 고정 seed `dungeon-schemer`, 화면의 접근 가능 이름과 `data-testid`
- Produces: 인트로→게시판→계약→지도→조언→사건 결과 UI 연결 회귀

- [ ] **Step 1: 실패하는 캠페인 흐름 테스트를 작성한다**

Create `e2e/campaign-smoke.spec.ts`:

```ts
import { expect, test, type TestInfo } from "@playwright/test";
import { expectNoBrowserErrors, watchBrowserErrors } from "./browser-errors";

async function attachSelection(testInfo: TestInfo, name: string, value: string): Promise<void> {
  await testInfo.attach(name, { body: value, contentType: "text/plain" });
}

test("캠페인이 인트로에서 첫 사건 결과까지 진행된다", async ({ page }, testInfo) => {
  const failures = watchBrowserErrors(page);
  await page.goto("/campaign?seed=dungeon-schemer");

  await page.getByRole("button", { name: "길드 게시판으로" }).click();
  const board = page.getByRole("region", { name: "길드 게시판" });
  await expect(board).toBeVisible();

  const offer = board.getByRole("button").filter({ hasText: "진입 가능" }).first();
  const offerName = (await offer.innerText()).trim();
  await attachSelection(testInfo, "selected-offer", offerName);
  await offer.click();

  await page.getByRole("button", { name: "이 공고 계약하기" }).click();
  const map = page.getByRole("region", { name: "던전 지도" });
  await expect(map).toBeVisible();

  const battleNode = map.getByRole("button", { name: "전투 지점 선택" }).first();
  await expect(battleNode).toBeVisible();
  await attachSelection(testInfo, "selected-node", await battleNode.getAttribute("aria-label") ?? "전투 지점 선택");
  await battleNode.click();

  const move = page.getByRole("button", { name: "이 지점으로 이동" });
  await expect(move).toBeEnabled();
  await move.click();

  const adviceList = page.getByTestId("u5-advice-list");
  await expect(adviceList).toBeVisible();
  const advice = adviceList.getByRole("button").filter({ visible: true }).first();
  await expect(advice).toBeEnabled();
  await attachSelection(testInfo, "selected-advice", (await advice.innerText()).trim());
  await advice.click();

  const outcome = page.getByTestId("u5-outcome");
  await expect(outcome).toBeVisible();
  await expect(outcome.getByRole("heading", { name: "사건 결과" })).toBeVisible();
  await expect(outcome.getByRole("heading", { name: "수치·신뢰 변화" })).toBeVisible();
  await expect(page.getByRole("button", { name: "지도로 돌아간다" })).toBeEnabled();
  await expect(page.getByTestId("campaign-rejection")).toHaveCount(0);
  expectNoBrowserErrors(failures, `campaign ${page.url()}`);
});
```

`Locator.filter({ visible: true })`가 설치된 Playwright 타입에서 지원되지 않으면
`adviceList.getByRole("button").and(page.locator(":visible")).first()`가 아니라,
`adviceList.getByRole("button").first()`를 사용한다. 목록 자체가 현재 모드에서만
렌더링되고 비활성 조언은 `toBeEnabled`가 잡으므로 CSS selector를 추가하지 않는다.

- [ ] **Step 2: 아직 확정하지 않은 selector 또는 흐름 지점이 실패하는지 실행한다**

Run:

```bash
pnpm exec playwright test e2e/campaign-smoke.spec.ts --trace on
```

Expected: 최초 실행은 selector API 또는 실제 접근 가능 이름 차이를 드러낼 수 있다. 실패 trace에서 마지막 정상 단계와 접근성 tree를 확인하며, 앱 코드를 바꾸지 않는다.

- [ ] **Step 3: 실제 사용자 계약에 맞춘 최소 selector 수정만 한다**

허용되는 수정은 다음뿐이다.

- 같은 사용자 문구의 정확한 `role` 또는 scope 조정
- `visible` filter가 타입 오류일 때 위 설명대로 첫 button 사용
- 기본 seed에서 첫 selectable 전투 노드가 없다면 seed를 재추첨하지 말고, 지도 fixture를 조사해 첫 depth에 전투가 있는 하나의 고정 문자열 seed로 교체하고 파일 상단 주석에 그 이유를 기록

앱의 production 컴포넌트나 게임 수치를 테스트 편의를 위해 변경하지 않는다.

- [ ] **Step 4: 캠페인 흐름을 두 번 연속 실행해 결정성을 확인한다**

Run:

```bash
pnpm exec playwright test e2e/campaign-smoke.spec.ts --repeat-each=2
```

Expected: 2 tests PASS, rejection alert와 브라우저 오류 0건. 재시도 옵션 없이 두 번 모두 같은 단계로 진행한다.

- [ ] **Step 5: 캠페인 흐름을 커밋한다**

```bash
git add e2e/campaign-smoke.spec.ts
git commit -m "테스트: 캠페인 첫 사건 흐름을 자동 검증한다" -m "인트로부터 공고 계약과 지도 이동, 조언 선택, 사건 결과까지 실제 Chromium 클릭 전이를 고정한다."
```

### Task 4: 공식 viewport 고정 캔버스 계약

**Files:**
- Create: `e2e/canvas-layout.spec.ts`

**Interfaces:**
- Consumes: `.game-canvas`, 일반 화면 루트, 공식 네 viewport, `watchBrowserErrors`
- Produces: 3 representative routes × 4 viewport의 비율·중앙 정렬·무스크롤·이미지 경계 회귀

- [ ] **Step 1: 캔버스 측정 테스트를 작성한다**

Create `e2e/canvas-layout.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { expectNoBrowserErrors, watchBrowserErrors } from "./browser-errors";

const VIEWPORTS = [
  { name: "FHD", width: 1920, height: 1080 },
  { name: "QHD", width: 2560, height: 1440 },
  { name: "16:10", width: 1440, height: 900 },
  { name: "5:4", width: 1280, height: 1024 },
] as const;

const ROUTES = ["/campaign", "/u5-test", "/u6-test"] as const;
const tolerance = 1.5;

for (const viewport of VIEWPORTS) {
  for (const route of ROUTES) {
    test(`${route} ${viewport.name} 고정 캔버스 계약을 지킨다`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const failures = watchBrowserErrors(page);
      await page.goto(route);

      const canvas = page.locator(".game-canvas");
      await expect(canvas).toBeVisible();
      const canvasBox = await canvas.boundingBox();
      expect(canvasBox).not.toBeNull();
      if (canvasBox === null) return;

      expect(Math.abs(canvasBox.width / canvasBox.height - 16 / 9)).toBeLessThan(0.01);
      expect(Math.abs(canvasBox.x - (viewport.width - canvasBox.width) / 2)).toBeLessThan(tolerance);
      expect(Math.abs(canvasBox.y - (viewport.height - canvasBox.height) / 2)).toBeLessThan(tolerance);

      const documentSize = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      }));
      expect(documentSize.scrollWidth).toBeLessThanOrEqual(documentSize.innerWidth + 1);
      expect(documentSize.scrollHeight).toBeLessThanOrEqual(documentSize.innerHeight + 1);

      const root = canvas.locator(":scope > :not([data-canvas-layout='intrinsic'])").first();
      const rootBox = await root.boundingBox();
      expect(rootBox).not.toBeNull();
      if (rootBox !== null) {
        expect(Math.abs(rootBox.width - canvasBox.width)).toBeLessThan(tolerance);
        expect(Math.abs(rootBox.height - canvasBox.height)).toBeLessThan(tolerance);
      }

      const overflowingImages = await canvas.locator("img:visible").evaluateAll((images, box) =>
        images.flatMap((image) => {
          const rect = image.getBoundingClientRect();
          const outside = rect.left < box.x - 1.5
            || rect.top < box.y - 1.5
            || rect.right > box.x + box.width + 1.5
            || rect.bottom > box.y + box.height + 1.5;
          return outside ? [image.getAttribute("src") ?? "<inline image>"] : [];
        }), canvasBox);
      expect(overflowingImages, `${route} ${viewport.name} canvas 밖 이미지`).toEqual([]);

      await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
      expectNoBrowserErrors(failures, `${route} ${viewport.name}`);
    });
  }
}
```

- [ ] **Step 2: 실제 브라우저 치수에서 실패 지점을 확인한다**

Run:

```bash
pnpm exec playwright test e2e/canvas-layout.spec.ts
```

Expected: 12 tests를 실행한다. subpixel 오차만 있다면 `tolerance=1.5` 안에서 통과해야 한다. 실제 overflow나 캔버스 비율 위반은 tolerance를 키워 숨기지 않는다.

- [ ] **Step 3: 레터박스 방향도 명시적으로 검증한다**

`canvasBox` assertion 다음에 다음 코드를 추가한다.

```ts
if (viewport.name === "FHD" || viewport.name === "QHD") {
  expect(canvasBox.x).toBeLessThan(tolerance);
  expect(canvasBox.y).toBeLessThan(tolerance);
} else {
  expect(canvasBox.x).toBeLessThan(tolerance);
  expect(canvasBox.y).toBeGreaterThan(tolerance);
}
```

현재 공식 네 viewport는 모두 16:9 이하로 세로가 남으므로 16:10과 5:4의 검은 띠는 위아래에 있어야 한다.

- [ ] **Step 4: 캔버스 회귀와 전체 E2E를 실행한다**

Run:

```bash
pnpm exec playwright test e2e/canvas-layout.spec.ts
pnpm test:e2e
```

Expected: 캔버스 12 tests와 전체 22 tests(경로 9 + 캠페인 1 + 캔버스 12) PASS.

- [ ] **Step 5: 캔버스 계약을 커밋한다**

```bash
git add e2e/canvas-layout.spec.ts
git commit -m "테스트: 공식 viewport 캔버스 계약을 검증한다" -m "세 대표 화면에서 16대9 비율과 중앙 정렬, 레터박스, 무스크롤, 이미지 경계를 Chromium으로 확인한다."
```

### Task 5: 공식 문서와 최종 검증

**Files:**
- Modify: `docs/technical/DEVELOPMENT_ENVIRONMENT.md`
- Modify: `docs/README.md`

**Interfaces:**
- Consumes: Tasks 1~4의 설치·실행 명령과 22-test 책임 범위
- Produces: 새 checkout과 PR에서 재현 가능한 공식 실행 안내, 최종 검증 증거

- [ ] **Step 1: 개발 환경 문서가 아직 E2E 명령을 설명하지 않는지 확인한다**

Run:

```bash
rg -n "test:e2e|Playwright|브라우저 스모크" docs/technical/DEVELOPMENT_ENVIRONMENT.md
```

Expected: FAIL 또는 일치 0건.

- [ ] **Step 2: 표준 명령과 테스트 책임 경계를 문서화한다**

`docs/technical/DEVELOPMENT_ENVIRONMENT.md`의 Bash 공통 명령과 공통 검증 명령 표에 다음 명령을 추가한다.

```bash
pnpm test:e2e:install
pnpm test:e2e
```

테스트 작성 규약 뒤에 `브라우저 E2E 테스트` 절을 추가해 다음 내용을 정확히 기록한다.

```markdown
## 브라우저 E2E 테스트

Playwright Test와 Chromium은 실제 Next.js 라우트 렌더링, 브라우저 예외,
사용자 클릭 화면 전이, 고정 캔버스 viewport 계약을 검증한다. 최초 한 번
`pnpm test:e2e:install`로 Chromium을 설치하고, 이후 `pnpm test:e2e`로 서버
기동부터 종료까지 한 번에 실행한다.

Vitest의 `*.test.ts(x)`는 Node 환경의 규칙·Store·문서 회귀를 소유한다.
Playwright의 `e2e/*.spec.ts`는 실제 브라우저가 필요한 회귀만 소유하며 서로의
내부 구현을 복제하지 않는다. 실패 trace와 screenshot은 `test-results/`, HTML
리포트는 `playwright-report/`에 생성되고 Git에는 포함하지 않는다.

UI 관련 PR은 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`에 더해
`pnpm test:e2e`를 실행한다. 현재 자동 범위는 Chromium 로컬 실행이며 CI와
Firefox·WebKit은 별도 승인 뒤 추가한다.
```

기존 `테스트 작성 규약`의 별도 `tests/` 디렉터리 금지 문구는 Vitest에만 적용됨을 명시하고, Playwright 예외 경로가 `e2e/*.spec.ts`임을 덧붙인다.

- [ ] **Step 3: 문서 인덱스에 spec과 plan을 연결한다**

`docs/README.md`의 기술 또는 이번 개편 설계 목록에 다음 두 링크를 추가한다.

```markdown
- [브라우저 안정성 스모크 테스트 설계](superpowers/specs/2026-08-25-lattebun-browser-stability-smoke-design.md): 공개 경로·첫 사건 클릭 흐름·공식 viewport의 Chromium 회귀 계약
- [브라우저 안정성 스모크 테스트 구현 계획](superpowers/plans/2026-08-25-lattebun-browser-stability-smoke.md): Playwright 실행 기반부터 경로·캠페인·캔버스·문서 검증까지의 테스트 우선 순서
```

- [ ] **Step 4: 문서와 diff 무결성을 확인한다**

Run:

```bash
rg -n "test:e2e|Playwright|브라우저 안정성" docs/README.md docs/technical/DEVELOPMENT_ENVIRONMENT.md
git diff --check
```

Expected: 명령, 책임 경계, spec·plan 링크가 모두 발견되고 whitespace 오류가 없다.

- [ ] **Step 5: 전체 검증을 새 출력으로 실행한다**

Run in this order:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Expected: 모든 명령 PASS. E2E는 22 tests PASS, `pageerror`, `console.error`, Next 오류 오버레이, campaign rejection 0건이다. 이전 실행 로그가 아니라 이 단계의 새 출력을 완료 증거로 사용한다.

- [ ] **Step 6: 작업 트리와 산출물 제외를 확인한다**

Run:

```bash
git status --short
git check-ignore playwright-report test-results
```

Expected: source와 문서 변경만 보이고 Playwright 산출물은 ignored다. 사용자 파일과 무관한 변경은 포함하지 않는다.

- [ ] **Step 7: 문서를 커밋한다**

```bash
git add docs/README.md docs/technical/DEVELOPMENT_ENVIRONMENT.md
git commit -m "문서: 브라우저 E2E 실행 기준을 추가한다" -m "Chromium 최초 설치와 일상 실행 명령, Vitest와 Playwright의 책임 경계, 실패 산출물과 PR 검증 순서를 공식화한다."
```

- [ ] **Step 8: 완료 전 리뷰와 PR 인수인계를 준비한다**

`superpowers:requesting-code-review`로 spec 대비 누락과 테스트 취약성을 검토한다. 지적을 반영한 뒤 `superpowers:verification-before-completion`으로 Step 5의 명령을 다시 실행하고, 다음 내용을 PR 본문에 기록한다.

```markdown
## 변경 내용
- Playwright Chromium 로컬 실행 기반
- 공개 경로 9개 브라우저 오류 회귀
- 첫 사건 결과까지 캠페인 클릭 스모크
- 공식 viewport 4종 고정 캔버스 회귀

## 검증
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm build
- pnpm test:e2e (22 tests)

## 범위 밖
- GitHub Actions
- Firefox·WebKit
- 픽셀 골든 스크린샷
```

PR을 만들기 전 모든 커밋 제목과 본문이 한글인지, 브랜치가 최신 `main`과 충돌하지 않는지 확인한다.
