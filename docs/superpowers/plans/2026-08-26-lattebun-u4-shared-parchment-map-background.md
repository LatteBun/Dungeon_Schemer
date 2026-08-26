# U4 전 테마 공용 양피지 지도 배경 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** U4의 `spider`, `desert`, `graveyard`가 모두 기존 거미굴 양피지 PNG를 사용하고, 테마 없는 프리뷰만 기존 기본 배경과 atmosphere를 유지하게 한다.

**Architecture:** 배경 선택은 기존처럼 `U4DungeonMapScreen` 표현 계층에만 둔다. 세 `ThemeId`를 하나의 지역 상수로 닫아 매핑하고, `/u4-test`는 도메인의 `THEME_IDS`만 허용하는 얇은 query adapter가 된다. Store, domain, rules, 지도 topology, U5 자산과 CSS는 변경하지 않는다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, React server rendering, Playwright

**Spec:** `docs/superpowers/specs/2026-08-26-lattebun-u4-shared-parchment-map-background-design.md`

## Global Constraints

- 세 테마의 source는 정확히 `/assets/u4/map/map_background_spider_parchment.png`다.
- 세 테마 모두 `.is-parchment`를 사용하고 `.is-themed`와 ruins atmosphere를 사용하지 않는다.
- `themeId === undefined`는 `/assets/u4/map/map_background_base.png`와 기존 ruins atmosphere를 유지한다.
- `U4_MAP_BACKGROUND_BY_THEME`는 `Readonly<Record<ThemeId, string>>`의 닫힌 key 검사를 유지한다.
- `/u4-test`의 유효 query는 `spider`, `desert`, `graveyard`이며 누락·알 수 없는 값·배열은 `undefined`로 처리한다.
- CSS, PNG, Store, domain, rules, service, U5, 지도 topology·선택·접근성 동작은 변경하지 않는다.
- Next.js 코드를 변경하기 전에 `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`의 비동기 `searchParams` 계약을 확인한다.
- 커밋 제목과 본문은 모두 한글로 작성한다.

---

## File Map

- `components/game/U4DungeonMapScreen.tsx`: 테마별 공용 배경 매핑과 배경/atmosphere 렌더링 정책을 소유한다.
- `components/game/U4DungeonMapScreen.test.tsx`: 닫힌 테마 매핑, modifier, atmosphere, 기본 fallback을 정적으로 검증한다.
- `app/u4-test/page.tsx`: query string을 `ThemeId | undefined`로 변환해 결정적 프리뷰에 전달한다.
- `app/u4-test/page.test.ts`: 세 유효 query와 누락·알 수 없는 값·배열 fallback을 server render로 검증한다.
- `e2e/u4-spider-parchment.spec.ts`: 네 viewport 대표 시각 계약, 세 query의 공용 배경 계약, 기존 입력 접근성과 실제 캠페인 전달을 브라우저에서 검증한다.
- `docs/experience/U4_DUNGEON_MAP.md`: U4 공식 테마별 배경 및 프리뷰 계약을 갱신한다.
- `docs/README.md`: 후속 Spec과 이 Plan을 문서 색인에 연결한다.

---

### Task 1: U4 화면의 세 테마 배경 계약

**Files:**
- Modify: `components/game/U4DungeonMapScreen.test.tsx:280-326`
- Modify: `components/game/U4DungeonMapScreen.tsx:22-26,265-330`

**Interfaces:**
- Consumes: `ThemeId`, `THEME_IDS`, 기존 `U4DungeonMapScreenProps.themeId?: ThemeId`
- Produces: `U4_MAP_BACKGROUND_BY_THEME: Readonly<Record<ThemeId, string>>`, 실제 테마의 `.is-parchment`/atmosphere 부재 계약

- [ ] **Step 1: 세 테마 공용 source와 렌더링 계약을 실패 테스트로 고정한다**

`components/game/U4DungeonMapScreen.test.tsx`의 배경 describe를 다음 의미로 바꾼다.

```ts
const expectedBackgroundByTheme: Readonly<Record<ThemeId, string>> = {
  spider: "/assets/u4/map/map_background_spider_parchment.png",
  desert: "/assets/u4/map/map_background_spider_parchment.png",
  graveyard: "/assets/u4/map/map_background_spider_parchment.png",
};

expect(Object.keys(expectedBackgroundByTheme).sort()).toEqual([...THEME_IDS].sort());
expect(U4_MAP_BACKGROUND_BY_THEME).toEqual(expectedBackgroundByTheme);

for (const themeId of THEME_IDS) {
  const html = render(MONSTER, themeId);
  expect(html).toContain(`src="${expectedBackgroundByTheme[themeId]}"`);
  expect(html).toContain('class="u4-map-surface__background is-parchment"');
  expect(html).not.toContain('class="u4-map-surface__background is-themed"');
  expect(html).not.toContain("map_atmosphere_ruins_props.png");
}
```

기본 fallback 테스트에는 다음 두 assertion을 함께 둔다.

```ts
const html = render(MONSTER, undefined);
expect(html).toContain("/assets/u4/map/map_background_base.png");
expect(html).toContain("map_atmosphere_ruins_props.png");
```

- [ ] **Step 2: 컴포넌트 테스트가 기존 사막·묘지 계약 때문에 실패하는지 확인한다**

Run: `pnpm vitest run components/game/U4DungeonMapScreen.test.tsx`

Expected: 사막·묘지 source가 U5 entry이고 `.is-themed`/atmosphere가 남아 있어 FAIL.

- [ ] **Step 3: 공용 상수와 정의된 테마/기본 fallback의 두 갈래만 구현한다**

`components/game/U4DungeonMapScreen.tsx`의 매핑을 다음으로 바꾼다.

```ts
const U4_PARCHMENT_MAP_BACKGROUND =
  "/assets/u4/map/map_background_spider_parchment.png";

export const U4_MAP_BACKGROUND_BY_THEME = {
  spider: U4_PARCHMENT_MAP_BACKGROUND,
  desert: U4_PARCHMENT_MAP_BACKGROUND,
  graveyard: U4_PARCHMENT_MAP_BACKGROUND,
} as const satisfies Readonly<Record<ThemeId, string>>;
```

`DungeonMap`의 렌더링 판단은 다음 형태로 단순화한다.

```ts
const backgroundClassName = themeId === undefined
  ? "u4-map-surface__background"
  : "u4-map-surface__background is-parchment";
const backgroundSrc = themeId === undefined
  ? "/assets/u4/map/map_background_base.png"
  : U4_MAP_BACKGROUND_BY_THEME[themeId];
```

atmosphere는 다음 조건에서만 렌더링한다.

```tsx
{themeId === undefined ? (
  <img
    aria-hidden="true"
    className="u4-map-surface__atmosphere"
    src="/assets/u4/map/map_atmosphere_ruins_props.png"
    alt=""
  />
) : null}
```

- [ ] **Step 4: 컴포넌트 회귀 테스트를 통과시킨다**

Run: `pnpm vitest run components/game/U4DungeonMapScreen.test.tsx`

Expected: PASS.

- [ ] **Step 5: 화면 계약 변경을 커밋한다**

```bash
git add components/game/U4DungeonMapScreen.tsx components/game/U4DungeonMapScreen.test.tsx
git commit -m "화면: U4 전 테마에 공용 양피지 지도를 적용한다" -m "거미굴·사막·묘지를 같은 닫힌 배경 매핑으로 통일하고, 실제 테마에서는 중복 atmosphere를 제거한다. 테마 없는 프리뷰 fallback은 유지한다."
```

---

### Task 2: 세 테마 결정적 프리뷰 query

**Files:**
- Read: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`
- Modify: `app/u4-test/page.test.ts`
- Modify: `app/u4-test/page.tsx`

**Interfaces:**
- Consumes: `THEME_IDS: readonly ThemeId[]`, Next.js `searchParams: Promise<{ theme?: string | string[] }>`
- Produces: `themeIdFrom(value: string | string[] | undefined): ThemeId | undefined`

- [ ] **Step 1: Next.js 16 page의 비동기 query 계약을 확인한다**

Run: `rg -n "searchParams|Promise" node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`

Expected: `searchParams`가 Promise이고 page에서 `await`하는 현재 구조가 공식 계약과 일치함.

- [ ] **Step 2: 세 유효 query와 세 fallback 경우를 실패 테스트로 작성한다**

`app/u4-test/page.test.ts`에 다음 case를 추가한다.

```ts
for (const themeId of ["spider", "desert", "graveyard"] as const) {
  it(`theme=${themeId} renders the shared parchment-map preview`, async () => {
    const page = await U4TestPage({
      searchParams: Promise.resolve({ theme: themeId }),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain(
      "/assets/u4/map/map_background_spider_parchment.png",
    );
    expect(html).toContain("u4-map-surface__background is-parchment");
    expect(html).not.toContain("map_atmosphere_ruins_props.png");
  });
}
```

누락은 기존 첫 테스트에 base source와 atmosphere assertion을 더하고, 알 수 없는 값과 배열은 다음처럼 별도 case로 검증한다.

```ts
for (const theme of ["lava", ["spider", "desert"]] as const) {
  const page = await U4TestPage({
    searchParams: Promise.resolve({ theme }),
  });
  const html = renderToStaticMarkup(page);
  expect(html).toContain("/assets/u4/map/map_background_base.png");
  expect(html).toContain("map_atmosphere_ruins_props.png");
}
```

- [ ] **Step 3: page 테스트가 사막·묘지 query에서 실패하는지 확인한다**

Run: `pnpm vitest run app/u4-test/page.test.ts`

Expected: `desert`, `graveyard`가 `undefined`로 축소되어 base background를 렌더링하므로 FAIL.

- [ ] **Step 4: 도메인 목록만 허용하는 query adapter를 구현한다**

`app/u4-test/page.tsx`에서 도메인 계약을 가져오고 변환 함수를 추가한다.

```ts
import { THEME_IDS, type ThemeId } from "@/lib/domain";

function themeIdFrom(
  value: string | string[] | undefined,
): ThemeId | undefined {
  if (typeof value !== "string") return undefined;
  return THEME_IDS.find((themeId) => themeId === value);
}
```

`U4Preview` 호출은 `themeId={themeIdFrom(params.theme)}`를 사용한다. `deadPreview` 계약은 변경하지 않는다.

- [ ] **Step 5: 프리뷰 page 테스트를 통과시킨다**

Run: `pnpm vitest run app/u4-test/page.test.ts`

Expected: PASS.

- [ ] **Step 6: 결정적 프리뷰 변경을 커밋한다**

```bash
git add app/u4-test/page.tsx app/u4-test/page.test.ts
git commit -m "테스트 화면: U4 세 테마 프리뷰를 연다" -m "공식 ThemeId 목록으로 query를 검증하고 누락·알 수 없는 값·배열에는 기존 기본 지도 fallback을 유지한다."
```

---

### Task 3: 공식 문서와 브라우저 회귀

**Files:**
- Modify: `e2e/u4-spider-parchment.spec.ts`
- Modify: `docs/experience/U4_DUNGEON_MAP.md:117-137`
- Modify: `docs/README.md:102-110`

**Interfaces:**
- Consumes: `/u4-test?theme=spider|desert|graveyard`, `.u4-map-surface__background.is-parchment`
- Produces: 세 query의 브라우저 계약과 공식 U4 배경 정책 문서

- [ ] **Step 1: 세 query의 source·modifier·atmosphere 계약을 E2E에 추가한다**

`e2e/u4-spider-parchment.spec.ts`의 네 viewport 대표 검사는 `spider`로 유지하고, 별도 반복 검사를 추가한다.

```ts
for (const themeId of ["spider", "desert", "graveyard"] as const) {
  test(`${themeId} preview는 공용 양피지 배경 계약을 지킨다`, async ({ page }) => {
    const failures = watchBrowserErrors(page);
    await page.goto(`/u4-test?theme=${themeId}`);

    const map = page.getByTestId("u4-map-surface");
    await expect(map.locator(".u4-map-surface__background.is-parchment")).toHaveAttribute(
      "src",
      "/assets/u4/map/map_background_spider_parchment.png",
    );
    await expect(map.locator(".u4-map-surface__background.is-themed")).toHaveCount(0);
    await expect(map.locator(".u4-map-surface__atmosphere")).toHaveCount(0);
    expectNoBrowserErrors(failures, `U4 ${themeId} shared parchment`);
  });
}
```

- [ ] **Step 2: 공식 U4 테마 표와 프리뷰 문구를 공용 계약으로 갱신한다**

`docs/experience/U4_DUNGEON_MAP.md`의 표에서 세 테마 source를 같은 PNG로 두고 추가 처리를 모두 `.is-parchment`, ruins atmosphere 미렌더링으로 기록한다. 자산 설명은 “거미굴 PNG” 대신 “공용 양피지 PNG”로 바꾸고, `/u4-test?theme=spider|desert|graveyard`가 유효하며 누락·알 수 없는 값·배열은 기본 fallback이라는 문장을 명시한다.

- [ ] **Step 3: 문서 색인에 후속 Spec과 Plan을 연결한다**

`docs/README.md`의 기존 거미굴 전용 두 링크 다음에 아래 두 링크를 추가한다.

```md
- [U4 전 테마 공용 양피지 지도 배경 설계](superpowers/specs/2026-08-26-lattebun-u4-shared-parchment-map-background-design.md): 거미굴·사막·묘지 U4를 같은 양피지 PNG로 통일하고 기본 프리뷰 fallback을 보존하는 후속 계약
- [U4 전 테마 공용 양피지 지도 배경 구현 계획](superpowers/plans/2026-08-26-lattebun-u4-shared-parchment-map-background.md): 닫힌 테마 매핑·query adapter·정적 및 브라우저 회귀의 테스트 우선 실행 순서
```

- [ ] **Step 4: 문서 링크와 정적 계약을 검증한다**

Run: `pnpm vitest run components/game/U4DungeonMapScreen.test.tsx app/u4-test/page.test.ts`

Expected: PASS.

Run: `git diff --check`

Expected: 출력 없이 exit 0.

- [ ] **Step 5: 브라우저 테스트와 문서를 커밋한다**

```bash
git add e2e/u4-spider-parchment.spec.ts docs/experience/U4_DUNGEON_MAP.md docs/README.md
git commit -m "검증: U4 공용 양피지 계약을 문서와 브라우저에 고정한다" -m "세 테마 query의 동일 source와 atmosphere 부재를 검증하고 공식 U4 문서 및 설계 색인을 후속 계약에 맞춘다."
```

---

### Task 4: 전체 검증과 PR 준비

**Files:**
- Verify only: implementation and documentation files from Tasks 1-3

**Interfaces:**
- Consumes: Tasks 1-3의 커밋된 결과
- Produces: 병합 가능한 검증 결과와 새 follow-up PR

- [ ] **Step 1: 관련 단위 테스트를 새 프로세스에서 다시 실행한다**

Run: `pnpm vitest run components/game/U4DungeonMapScreen.test.tsx app/u4-test/page.test.ts`

Expected: PASS.

- [ ] **Step 2: 정적 타입과 lint를 검증한다**

Run: `pnpm typecheck`

Expected: exit 0.

Run: `pnpm lint`

Expected: exit 0.

- [ ] **Step 3: production build를 검증한다**

Run: `pnpm build`

Expected: Next.js production build exit 0.

- [ ] **Step 4: U4 양피지 브라우저 suite를 실행한다**

Run: `pnpm test:e2e -- e2e/u4-spider-parchment.spec.ts`

Expected: 네 viewport, 세 theme query, 입력 접근성, 실제 캠페인 거미굴 흐름이 모두 PASS하고 browser error가 없음.

- [ ] **Step 5: 의도한 파일만 변경됐는지 확인한다**

Run: `git status --short && git diff --check && git log --oneline origin/main..HEAD`

Expected: `.pnpm-store/`와 기존 U6 미추적 파일은 그대로 미추적이며 커밋에 포함되지 않는다. 이 작업의 tracked 변경은 Spec, Plan과 Tasks 1-3의 지정 파일뿐이고 whitespace error가 없다.

- [ ] **Step 6: 브랜치를 push하고 새 follow-up PR을 만든다**

Run: `git push -u origin spec/u4-shared-parchment-map-background`

Expected: 원격 브랜치 생성 또는 fast-forward 성공.

Run: `gh pr create --base main --head spec/u4-shared-parchment-map-background --title "U4 전 테마에 공용 양피지 지도 배경 적용" --body "## 변경 사항

- 거미굴·사막·묘지 U4가 동일한 양피지 지도 PNG를 사용합니다.
- 실제 테마에서는 중복 ruins atmosphere를 제거하고, 테마 없는 프리뷰 fallback은 유지합니다.
- 세 테마 query와 기존 입력·레이아웃 계약을 단위 및 브라우저 테스트로 고정합니다.

## 검증

- pnpm vitest run components/game/U4DungeonMapScreen.test.tsx app/u4-test/page.test.ts
- pnpm typecheck
- pnpm lint
- pnpm build
- pnpm test:e2e -- e2e/u4-spider-parchment.spec.ts"`

Expected: 이미 병합된 PR #206을 수정하지 않고 새 PR URL이 반환됨. PR 본문은 세 테마 공용 적용, 기본 fallback 보존, 테스트·typecheck·lint·build·Playwright 결과를 한국어로 기록한다.
