# 사용자 노출 게임 제목 변경 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 화면·브라우저 탭·설치형 웹 앱에서 보이는 게임 제목을 `용사님, 이쪽입니다`로 통일한다.

**Architecture:** 게임 제목 문자열을 사용하는 네 개의 사용자 노출 경계만 직접 교체한다. 저장 키·에셋 경로·규칙·프로젝트 내부 식별자는 건드리지 않고 정적 렌더와 Next metadata/manifest를 테스트한다.

**Tech Stack:** TypeScript, React 19, Next.js 16 App Router Metadata API, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-08-26-sbh3821-visible-game-title-design.md`

## Global Constraints

- 사용자 노출 제목은 따옴표 없이 정확히 `용사님, 이쪽입니다`이다.
- 표어 `그들은 당신의 말을 믿는다`는 유지한다.
- `dungeon-schemer.*` 저장 키와 `DUNGEON_SCHEMER_*` 에셋 경로는 변경하지 않는다.
- 저장소·패키지·폴더·TypeScript 식별자와 과거 문서는 변경하지 않는다.
- SEO 설명과 manifest 설명은 변경하지 않는다.

---

### Task 1: UI와 앱 메타데이터 제목 계약

**Files:**
- Modify: `components/game/MainMenuScreen.test.tsx`
- Modify: `app/achievements/page.test.ts`
- Create: `app/visible-game-title.test.tsx`
- Modify: `components/game/MainMenuScreen.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/manifest.ts`
- Modify: `app/achievements/page.tsx`
- Create: `e2e/visible-game-title.spec.ts`

**Interfaces:**
- Consumes: Next `Metadata`, `MetadataRoute.Manifest`, `MainMenuScreen`
- Produces: 모든 사용자 노출 경계의 제목 `용사님, 이쪽입니다`

- [ ] **Step 1: 메인 메뉴 제목 실패 테스트 작성**

```ts
it("새 게임 제목을 표시한다", () => {
  const html = renderToStaticMarkup(
    createElement(MainMenuScreen, { unlockedCount: 0, loading: false }),
  );
  expect(html).toContain("용사님, 이쪽입니다");
  expect(html).not.toContain("Dungeon Schemer");
  expect(html).toContain("그들은 당신의 말을 믿는다");
});
```

- [ ] **Step 2: metadata와 manifest 실패 테스트 작성**

```ts
import { metadata } from "./layout";
import manifest from "./manifest";

it("브라우저와 설치형 웹 앱에 새 제목을 제공한다", () => {
  expect(metadata.title).toBe("용사님, 이쪽입니다");
  expect(metadata.appleWebApp).toMatchObject({ title: "용사님, 이쪽입니다" });
  expect(manifest()).toMatchObject({
    name: "용사님, 이쪽입니다",
    short_name: "용사님, 이쪽입니다",
  });
});
```

업적 metadata 기대값은 아래처럼 바꾼다.

```ts
expect(metadata).toEqual({
  title: "길잡이 업적 기록 | 용사님, 이쪽입니다",
  description: "캠페인 엔딩과 누적 통계로 해금한 길잡이 업적을 확인합니다.",
});
```

- [ ] **Step 3: RED 확인**

Run: `pnpm exec vitest run components/game/MainMenuScreen.test.tsx app/visible-game-title.test.tsx app/achievements/page.test.ts`
Expected: FAIL — 기존 `Dungeon Schemer` 제목이 반환된다.

- [ ] **Step 4: 사용자 노출 문자열만 교체**

```tsx
// components/game/MainMenuScreen.tsx
<h1>용사님, 이쪽입니다</h1>
```

```ts
// app/layout.tsx
title: "용사님, 이쪽입니다",
appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "용사님, 이쪽입니다" },

// app/manifest.ts
name: "용사님, 이쪽입니다",
short_name: "용사님, 이쪽입니다",

// app/achievements/page.tsx
title: "길잡이 업적 기록 | 용사님, 이쪽입니다",
```

- [ ] **Step 5: GREEN과 내부 식별자 보존 확인**

Run: `pnpm exec vitest run components/game/MainMenuScreen.test.tsx app/visible-game-title.test.tsx app/achievements/page.test.ts components/game/MobileFullscreen.test.ts`
Expected: PASS

Run: `rg -n 'Dungeon Schemer' app components`
Expected: 사용자 노출 production 파일에는 결과가 없고, 필요하면 과거 부정 단언 테스트만 남는다.

Run: `rg -n 'dungeon-schemer\.|DUNGEON_SCHEMER_' app components lib`
Expected: 기존 저장 키와 에셋 경로가 유지된다.

- [ ] **Step 6: 정적 검증과 프로덕션 빌드**

Run: `pnpm typecheck && pnpm lint && pnpm build --webpack`
Expected: 모두 exit 0

- [ ] **Step 7: 실제 브라우저 제목과 메인 UI 확인**

```ts
test("메인과 업적 문서가 새 게임 제목을 노출한다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("용사님, 이쪽입니다");
  await expect(page).toHaveTitle("용사님, 이쪽입니다");
  await page.goto("/achievements");
  await expect(page).toHaveTitle("길잡이 업적 기록 | 용사님, 이쪽입니다");
});
```

Run: `pnpm exec playwright test e2e/visible-game-title.spec.ts --project=chromium`
Expected: PASS

- [ ] **Step 8: 커밋**

```bash
git add components/game/MainMenuScreen.test.tsx app/visible-game-title.test.tsx app/achievements/page.test.ts components/game/MainMenuScreen.tsx app/layout.tsx app/manifest.ts app/achievements/page.tsx e2e/visible-game-title.spec.ts
git commit -m "화면: 게임 제목을 용사님 이쪽입니다로 바꾼다" -m "메인 메뉴와 브라우저·업적·설치형 웹 앱 제목을 통일하고 저장 키와 에셋 경로는 유지한다."
```
