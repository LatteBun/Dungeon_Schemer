# U4 거미굴 양피지 지도 배경 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** U4 거미굴에서 기존 장면형 배경 대신 슬롯 비율에 맞는 전용 양피지 지도를 렌더링하면서, 모든 기존 지도 선택 동작과 다른 테마의 배경을 보존한다.

**Architecture:** 배경 선택은 `U4DungeonMapScreen` 표현 계층의 닫힌 테마 매핑으로만 처리한다. `spider`는 전용 PNG와 `.is-parchment`를 사용하고 분위기 장식 DOM을 생략하며, 나머지 테마와 `undefined` fallback은 기존 계약을 유지한다. `/u4-test?theme=spider`는 Store를 건드리지 않는 결정적 검토 fixture이고, production 흐름은 기존 `CampaignScreen → dungeon.theme → U4DungeonMapScreen` 전달을 그대로 쓴다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Playwright, CSS, PNG public asset

**Spec:** `docs/superpowers/specs/2026-08-26-lattebun-u4-spider-parchment-map-background-design.md`

## Global Constraints

- `ThemeId` 전체를 `satisfies Readonly<Record<ThemeId, string>>`로 매핑한다.
- `undefined`는 `/assets/u4/map/map_background_base.png`로 fallback한다.
- `spider`는 `/assets/u4/map/map_background_spider_parchment.png` 및 `.is-parchment`만 사용하며 `.is-themed`, blur, ruins atmosphere DOM을 사용하지 않는다.
- `desert`와 `graveyard`는 기존 U5 entry PNG 및 `.is-themed` 동작을 보존한다.
- 최종 PNG는 1.22:1~1.24:1, 최소 1500×1220이며 `object-fit: cover; object-position: 50% 50%`로 표시한다.
- `GeneratedMap`, Store, domain, rules, U4 layout/model, U5 ViewModel, 우측 패널과 `u4-dungeon-map-fixes.css`는 수정하지 않는다.
- 장식 레이어는 `pointer-events: none`을 유지하고, 최종 z-index는 vignette < corridor < room이다.
- 테스트 없는 production code를 먼저 작성하지 않으며, 각 RED/GREEN 단계의 실제 명령 결과를 확인한다.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `public/assets/u4/map/map_background_spider_parchment.png` | U4 지도 슬롯용 1672×1360 양피지 배경 최종 PNG |
| `components/game/U4DungeonMapScreen.tsx` | 닫힌 테마 source/class 선택과 spider atmosphere DOM 생략 |
| `app/u4-dungeon-map.css` | parchment modifier의 object position/filter 및 기존 레이어 순서 소유 |
| `components/game/U4DungeonMapScreen.test.tsx` | source, modifier, atmosphere DOM의 정적 계약 |
| `components/game/U4Assets.test.ts` | PNG signature, 해상도, aspect ratio 회귀 계약 |
| `components/game/U4FixedCanvas.test.ts` | CSS 단일 소유, pointer events, layer-order 회귀 계약 |
| `components/game/U4Preview.tsx`, `app/u4-test/page.tsx` | query 기반 spider 결정적 preview fixture |
| `app/u4-test/page.test.ts` | base fallback/spider query preview 계약 |
| `e2e/u4-spider-parchment.spec.ts` | 네 viewport 시각·키보드·production campaign 흐름 검증 |
| `docs/experience/U4_DUNGEON_MAP.md`, `docs/README.md` | 확정된 U4 배경 계약과 설계/계획 색인 |

### Task 1: 슬롯 규격 양피지 PNG와 자산 회귀 계약

**Files:**
- Modify: `components/game/U4Assets.test.ts`
- Modify: `public/assets/u4/map/map_background_spider_parchment.png`

**Interfaces:**
- Produces: public 경로 `/assets/u4/map/map_background_spider_parchment.png`, PNG IHDR가 `width >= 1500`, `height >= 1220`, `1.22 <= width / height <= 1.24`를 만족한다.

- [ ] **Step 1: 실패하는 자산 테스트를 작성한다.**

```ts
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const parchment = readFileSync("public/assets/u4/map/map_background_spider_parchment.png");
expect(parchment.subarray(0, 8)).toEqual(PNG_SIGNATURE);
expect(parchment.readUInt32BE(16)).toBeGreaterThanOrEqual(1500);
expect(parchment.readUInt32BE(20)).toBeGreaterThanOrEqual(1220);
expect(parchment.readUInt32BE(16) / parchment.readUInt32BE(20)).toBeGreaterThanOrEqual(1.22);
expect(parchment.readUInt32BE(16) / parchment.readUInt32BE(20)).toBeLessThanOrEqual(1.24);
```

- [ ] **Step 2: RED를 확인한다.**

Run: `pnpm exec vitest run components/game/U4Assets.test.ts`

Expected: 기존 `1672×941` 기준본이 높이와 aspect ratio assertion에서 실패한다.

- [ ] **Step 3: 기준본을 세로로 확장한 최종 PNG로 교체한다.**

`imagegen` edit를 사용한다. 기준본의 좌우 구도와 촛불/석벽/거미줄을 보존하고, 1672×1360 캔버스의 상하를 동굴과 찢긴 양피지 질감으로 outpaint한다. 중앙 10~90% × 12~88%에는 강한 소품·가짜 경로·텍스트를 넣지 않는다. 생성 결과를 검사한 뒤 위 public 경로로 복사한다.

- [ ] **Step 4: GREEN와 이미지 규격을 확인한다.**

Run: `pnpm exec vitest run components/game/U4Assets.test.ts`

Expected: PASS; PNG signature, 최소 해상도, 1.22~1.24 aspect ratio가 모두 통과한다.

- [ ] **Step 5: 자산과 테스트를 커밋한다.**

```bash
git add public/assets/u4/map/map_background_spider_parchment.png components/game/U4Assets.test.ts
git commit -m "자산: U4 거미굴 양피지 지도 비율 적용" -m "지도 슬롯에 맞춘 세로 확장 PNG와 규격 회귀 테스트를 추가한다."
```

### Task 2: U4 테마 매핑과 양피지 레이어 계약

**Files:**
- Modify: `components/game/U4DungeonMapScreen.test.tsx`
- Modify: `components/game/U4FixedCanvas.test.ts`
- Modify: `components/game/U4DungeonMapScreen.tsx`
- Modify: `app/u4-dungeon-map.css`

**Interfaces:**
- Consumes: Task 1의 public PNG.
- Produces: `U4_MAP_BACKGROUND_BY_THEME`가 모든 `ThemeId`를 정확한 source로 매핑하고, `DungeonMap`이 `themeId`에 맞는 background class와 atmosphere DOM만 렌더링한다.

- [ ] **Step 1: 실패하는 component/CSS 테스트를 작성한다.**

```ts
expect(htmlFor("spider")).toContain('src="/assets/u4/map/map_background_spider_parchment.png"');
expect(htmlFor("spider")).toContain("u4-map-surface__background is-parchment");
expect(htmlFor("spider")).not.toContain("u4-map-surface__background is-themed");
expect(htmlFor("spider")).not.toContain("map_atmosphere_ruins_props.png");
expect(htmlFor("desert")).toContain('src="/assets/u5/dungeon-progress-scenes/desert/entry.png"');
expect(htmlFor("graveyard")).toContain('src="/assets/u5/dungeon-progress-scenes/graveyard/entry.png"');
expect(htmlFor()).toContain('src="/assets/u4/map/map_background_base.png"');
```

```ts
expect(css).toMatch(/\.u4-map-surface__background\.is-parchment[\s\S]*object-position:\s*50%\s+50%/);
expect(css).toMatch(/\.u4-map-surface__background\.is-parchment[\s\S]*filter:\s*none/);
expect(fixesCss).not.toContain(".u4-map-surface__background.is-parchment");
```

- [ ] **Step 2: RED를 확인한다.**

Run: `pnpm exec vitest run components/game/U4DungeonMapScreen.test.tsx components/game/U4FixedCanvas.test.ts`

Expected: spider source/class와 atmosphere 부재 assertion이 현 구현에서 실패한다.

- [ ] **Step 3: 가장 작은 표현 계층 변경을 구현한다.**

```ts
const U4_MAP_BACKGROUND_BY_THEME = {
  spider: "/assets/u4/map/map_background_spider_parchment.png",
  desert: "/assets/u5/dungeon-progress-scenes/desert/entry.png",
  graveyard: "/assets/u5/dungeon-progress-scenes/graveyard/entry.png",
} as const satisfies Readonly<Record<ThemeId, string>>;

const backgroundClassName = themeId === "spider"
  ? "u4-map-surface__background is-parchment"
  : themeId === undefined
    ? "u4-map-surface__background"
    : "u4-map-surface__background is-themed";
```

Render the atmosphere image only when `themeId !== "spider"`. In `app/u4-dungeon-map.css`, add only the parchment modifier with `filter: none` and `object-position: 50% 50%`; preserve the existing generic `object-fit: cover`, pointer-events and z-index values. Do not import U5 code or edit correction CSS.

- [ ] **Step 4: GREEN과 focused regression을 확인한다.**

Run: `pnpm exec vitest run components/game/U4DungeonMapScreen.test.tsx components/game/U4FixedCanvas.test.ts components/game/u4-dungeon-map-model.test.ts components/game/u4-dungeon-map-layout.test.ts components/game/u4-dungeon-map-order.test.ts`

Expected: PASS; source/class/DOM/CSS ownership and unchanged model/layout/order all pass.

- [ ] **Step 5: 화면 계층 변경을 커밋한다.**

```bash
git add components/game/U4DungeonMapScreen.tsx app/u4-dungeon-map.css components/game/U4DungeonMapScreen.test.tsx components/game/U4FixedCanvas.test.ts
git commit -m "기능: U4 거미굴 양피지 지도 배경 적용" -m "테마별 지도 배경 계약과 거미굴 전용 장식 레이어를 적용한다."
```

### Task 3: 결정적 spider preview query와 문서 색인

**Files:**
- Modify: `components/game/U4Preview.tsx`
- Modify: `app/u4-test/page.tsx`
- Modify: `app/u4-test/page.test.ts`
- Modify: `docs/experience/U4_DUNGEON_MAP.md`
- Modify: `docs/README.md`

**Interfaces:**
- Consumes: `U4DungeonMapScreen`의 기존 optional `themeId?: ThemeId`.
- Produces: `/u4-test`는 base fallback, `/u4-test?theme=spider`는 spider 테마 preview를 표시한다.

- [ ] **Step 1: 실패하는 preview 테스트를 작성한다.**

```ts
const spiderPage = await U4TestPage({ searchParams: Promise.resolve({ theme: "spider" }) });
const spiderHtml = renderToStaticMarkup(spiderPage);
expect(spiderHtml).toContain("/assets/u4/map/map_background_spider_parchment.png");
expect(spiderHtml).not.toContain("map_atmosphere_ruins_props.png");

const basePage = await U4TestPage({ searchParams: Promise.resolve({}) });
expect(renderToStaticMarkup(basePage)).toContain("/assets/u4/map/map_background_base.png");
```

- [ ] **Step 2: RED를 확인한다.**

Run: `pnpm exec vitest run app/u4-test/page.test.ts`

Expected: `theme=spider` preview가 base source를 렌더링하여 실패한다.

- [ ] **Step 3: preview 경계를 구현하고 공식 문서를 갱신한다.**

Add `themeId?: ThemeId` to `U4PreviewProps` and pass it to `U4DungeonMapScreen`. Parse only the literal `theme=spider` in the page; missing or other query values remain `undefined`. Document the four-theme source contract, 1.23:1 asset contract, DOM-owned gameplay information and deterministic review URL in `U4_DUNGEON_MAP.md`; link Spec and this Plan from `docs/README.md`.

- [ ] **Step 4: GREEN과 문서 링크를 확인한다.**

Run: `pnpm exec vitest run app/u4-test/page.test.ts components/game/U4DungeonMapScreen.test.tsx`

Expected: PASS; no-query fallback and spider query both render exactly their intended layers.

- [ ] **Step 5: preview와 문서를 커밋한다.**

```bash
git add components/game/U4Preview.tsx app/u4-test/page.tsx app/u4-test/page.test.ts docs/experience/U4_DUNGEON_MAP.md docs/README.md
git commit -m "문서: U4 거미굴 지도 배경 검토 경로 추가" -m "결정적 프리뷰와 공식 지도 배경 계약을 기록한다."
```

### Task 4: 실제 브라우저와 production 흐름 검증

**Files:**
- Create: `e2e/u4-spider-parchment.spec.ts`

**Interfaces:**
- Consumes: `/u4-test?theme=spider`, `/campaign?seed=<fixed-seed>`, existing selectable room buttons.
- Produces: 네 viewport 렌더링 및 mouse/keyboard/accessibility, 실제 campaign spider `themeId` 전달을 검증하는 Playwright suite.

- [ ] **Step 1: 실패하는 browser spec을 작성한다.**

```ts
for (const viewport of [
  { width: 1920, height: 1080 }, { width: 2560, height: 1440 },
  { width: 1440, height: 900 }, { width: 1280, height: 1024 },
]) {
  test(`spider preview remains readable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/u4-test?theme=spider");
    await expect(page.locator(".u4-map-surface__background.is-parchment")).toHaveAttribute("src", "/assets/u4/map/map_background_spider_parchment.png");
    await expect(page.locator(".u4-map-surface__atmosphere")).toHaveCount(0);
  });
}
```

Add a separate test that clicks a selectable room, reloads the fixture, then uses real Tab, Enter, Space and ArrowRight to assert `aria-pressed` and focused selectable room movement. Add a campaign test using a fixed seed, entering an available spider notice, and asserting the same parchment source.

- [ ] **Step 2: RED를 확인한다.**

Run: `pnpm exec playwright test e2e/u4-spider-parchment.spec.ts`

Expected: before Task 2/3 the preview source and atmosphere assertions fail; after Tasks 2/3, any remaining interaction selector issue must be corrected in the spec to target existing accessible UI rather than adding behavior.

- [ ] **Step 3: production UI behavior is already supplied by Tasks 2/3; keep the e2e test minimal.**

Do not modify interaction production code unless a real regression is demonstrated. Use existing `data-testid="u4-selectable-room"`, `aria-pressed`, and browser focus assertions so the test proves user-visible behavior rather than implementation calls.

- [ ] **Step 4: GREEN과 visual evidence를 확인한다.**

Run: `pnpm exec playwright test e2e/u4-spider-parchment.spec.ts`

Expected: PASS at all four viewports, keyboard/mouse regression passes, and fixed-seed campaign flow renders the parchment source.

- [ ] **Step 5: browser contract를 커밋한다.**

```bash
git add e2e/u4-spider-parchment.spec.ts
git commit -m "테스트: U4 거미굴 양피지 브라우저 회귀 추가" -m "네 고정 viewport와 실제 선택·캠페인 테마 흐름을 검증한다."
```

### Task 5: 통합 검증과 PR 갱신

**Files:**
- Modify only if verification reveals an in-scope defect from Tasks 1–4.

**Interfaces:**
- Consumes: Tasks 1–4 and existing U4/campaign suites.
- Produces: fully verified branch pushed to PR #206.

- [ ] **Step 1: 전체 관련 검사와 production build를 실행한다.**

Run: `pnpm exec vitest run components/game/U4DungeonMapScreen.test.tsx components/game/U4Assets.test.ts components/game/U4FixedCanvas.test.ts components/game/u4-dungeon-map-model.test.ts components/game/u4-dungeon-map-layout.test.ts components/game/u4-dungeon-map-order.test.ts components/game/campaign-adapters.test.ts components/game/campaign-render.test.tsx app/u4-test/page.test.ts && pnpm run lint && pnpm run build && pnpm exec playwright test e2e/u4-spider-parchment.spec.ts`

Expected: all commands exit 0.

- [ ] **Step 2: final diff and repository boundary를 확인한다.**

Run: `git diff --check origin/main...HEAD && git status --short && git diff --name-only origin/main...HEAD`

Expected: only Spec/Plan, listed in-scope implementation/docs/tests/assets; unrelated untracked U6 files and `.pnpm-store/` are unstaged.

- [ ] **Step 3: 마지막 수정이 있으면 검증 후 Korean commit을 남긴다.**

```bash
git add <in-scope-files>
git commit -m "수정: U4 거미굴 지도 배경 검증 보완" -m "통합 검증에서 확인된 범위 내 회귀를 바로잡는다."
```

- [ ] **Step 4: PR #206 head branch를 push하고 상태를 확인한다.**

Run: `git push origin spec/u4-spider-parchment-map-background && gh pr view 206 --json url,state,mergeable,headRefName,statusCheckRollup`

Expected: PR #206이 open, mergeable이며 head가 현재 branch를 가리킨다.

## Self-Review

- Spec의 theme mapping, base fallback, spider modifier/atmosphere, PNG slot ratio, CSS ownership, no-store boundary, preview, docs, four viewport and production campaign checks가 각각 Task 1–5에 있다.
- `TBD`, `TODO`, “appropriate”, “similar to” 같은 실행 불가능한 placeholder가 없다.
- `ThemeId`, `U4_MAP_BACKGROUND_BY_THEME`, `themeId?: ThemeId`와 public source paths가 모든 task에서 일관된다.
