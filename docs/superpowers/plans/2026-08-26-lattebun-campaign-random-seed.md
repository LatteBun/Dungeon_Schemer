# 캠페인 기본 진입 무작위 시드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/campaign` 주소를 바꾸지 않고도 새 캠페인 시작마다 새 시드를 만들어 PR #184의 게시판 다양성이 실제 사용자 흐름에서 작동하게 한다.

**Architecture:** 캠페인 페이지가 `searchParams.seed`를 해석한다. 유효한 단일 문자열은 그대로 보존하고, 누락·빈 문자열·배열은 기존 `createSeed()`로 새 UUID를 만든다. 메인 메뉴 링크는 `/campaign`을 그대로 가리키되 prefetch를 끄며, Provider와 게시판 규칙은 기존 시드를 한 번 받아 결정적으로 동작한다.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript, Vitest 4, Zustand 5

**Spec:** `docs/superpowers/specs/2026-08-26-lattebun-campaign-random-seed-design.md`

## Global Constraints

- 브라우저 사용자 주소는 검색 파라미터 없는 `/campaign`으로 유지한다.
- `?seed=<값>`의 유효한 단일 문자열은 기존처럼 고정 시드 재현에 사용한다.
- 무작위 시드는 `@/lib/rng`의 `createSeed()`만 사용하며 `Math.random()`을 추가하지 않는다.
- `CampaignStoreProvider`는 한 mount에서 하나의 시드로 한 Store를 만드는 현재 계약을 유지한다.
- `lib/rules/board.ts`의 위험도 제곱 가중 추첨, 진입 가능 우선, 최대 5개 및 파티 상한은 수정하지 않는다.
- 새로고침은 캠페인을 복원하지 않고 새 시드로 새 판을 만든다. 뒤로/앞으로의 기존 bfcache 정책은 변경하지 않는다.
- 모든 커밋 메시지는 제목과 본문을 포함해 한글로 작성한다.
- 사용자 작업물인 `.pnpm-store/`, `public/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/ASSET_MANIFEST.json`, `public/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/README.txt`는 수정하거나 스테이징하지 않는다.

---

### Task 1: 캠페인 페이지의 시드 결정 경계

**Files:**
- Modify: `app/campaign/page.tsx:1-26`
- Create: `app/campaign/page.test.ts`

**Interfaces:**
- Consumes: `createSeed(): string` from `@/lib/rng` and `seed?: string | string[]` from the existing page search parameters.
- Produces: `resolveCampaignSeed(seed: string | string[] | undefined, generateSeed?: () => string): string` exported from `app/campaign/page.tsx`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";
import { resolveCampaignSeed } from "./page";

describe("resolveCampaignSeed", () => {
  it("유효한 명시적 시드는 새 시드를 만들지 않고 보존한다", () => {
    const generateSeed = vi.fn(() => "generated-seed");
    expect(resolveCampaignSeed("replay-184", generateSeed)).toBe("replay-184");
    expect(generateSeed).not.toHaveBeenCalled();
  });
  it.each([undefined, "", ["replay-184"]])("기본 진입 값 %j은 새 시드를 만든다", (seed) => {
    const generateSeed = vi.fn(() => "generated-seed");
    expect(resolveCampaignSeed(seed, generateSeed)).toBe("generated-seed");
    expect(generateSeed).toHaveBeenCalledTimes(1);
  });
  it("각 기본 진입은 호출자가 만든 새 시드를 그대로 사용한다", () => {
    const generateSeed = vi.fn().mockReturnValueOnce("generated-seed-one").mockReturnValueOnce("generated-seed-two");
    expect(resolveCampaignSeed(undefined, generateSeed)).toBe("generated-seed-one");
    expect(resolveCampaignSeed(undefined, generateSeed)).toBe("generated-seed-two");
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run app/campaign/page.test.ts`

Expected: FAIL because `resolveCampaignSeed` is not exported.

- [ ] **Step 3: Implement the minimum**

```ts
import { createSeed } from "@/lib/rng";

export function resolveCampaignSeed(
  seed: string | string[] | undefined,
  generateSeed: () => string = createSeed,
): string {
  return typeof seed === "string" && seed.length > 0 ? seed : generateSeed();
}
```

After awaiting `searchParams`, call `resolveCampaignSeed(seed)` and pass it to `CampaignStoreProvider`. Do not add `connection()`, URL rewriting, storage, or fallback fixed seed.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm vitest run app/campaign/page.test.ts lib/rules/board.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/campaign/page.tsx app/campaign/page.test.ts
git commit -m "수정: 새 캠페인마다 시드를 생성한다" -m "고정 기본 시드 대신 요청 시 새 UUID를 사용하고 명시적 재현 시드는 유지한다."
```

### Task 2: 메인 메뉴에서 새 요청으로 캠페인 시작

**Files:**
- Modify: `components/game/MainMenuScreen.tsx:22-25`
- Modify: `components/game/MainMenuScreen.test.tsx:1-26`

**Interfaces:**
- Consumes: Next.js `Link` prop `prefetch?: boolean | null`.
- Produces: the existing `캠페인 시작` link with `href="/campaign"` and `prefetch={false}`.

- [ ] **Step 1: Write the failing test**

Mock `next/link` in `MainMenuScreen.test.tsx` before importing the screen so the rendered anchor exposes its `prefetch` prop:

```ts
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ prefetch, href, className, children }: { prefetch?: boolean; href: string; className?: string; children: ReactNode }) =>
    createElement("a", { href, className, "data-prefetch": String(prefetch) }, children),
}));
```

In the existing campaign-link test add:

```ts
expect(html).toContain('href="/campaign"');
expect(html).toContain('data-prefetch="false"');
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run components/game/MainMenuScreen.test.tsx`

Expected: FAIL because the link has no `prefetch` prop.

- [ ] **Step 3: Implement the minimum**

```tsx
<Link
  className="shell-cta shell-cta--primary main-menu-screen__start"
  href="/campaign"
  prefetch={false}
>
  캠페인 시작
</Link>
```

Do not modify the label, classes, achievements Link, or global prefetch configuration.

- [ ] **Step 4: Verify GREEN and commit**

Run: `pnpm vitest run components/game/MainMenuScreen.test.tsx app/campaign/page.test.ts`

Expected: PASS.

```bash
git add components/game/MainMenuScreen.tsx components/game/MainMenuScreen.test.tsx
git commit -m "수정: 새 캠페인 링크의 사전 생성을 막는다" -m "메인 메뉴에서 실제 캠페인 진입 시점에만 새 시드가 만들어지도록 prefetch를 끈다."
```

### Task 3: 공식 문서와 전체 회귀 검증

**Files:**
- Modify: `docs/design/CORE_GAME_LOOP.md:18-42`
- Modify: `docs/experience/ONBOARDING_AND_INTERFACE.md:23-30`
- Modify: `docs/technical/SESSION_PERSISTENCE_REVIEW.md:45-52`
- Modify: `docs/README.md:101-104`
- Create: `docs/superpowers/plans/2026-08-26-lattebun-campaign-random-seed.md`

**Interfaces:**
- Consumes: Tasks 1–2 default-seed resolver and campaign-start Link policy.
- Produces: official docs distinguishing random default entry from explicit fixed-seed diagnostics.

- [ ] **Step 1: Update docs**

Keep the approved wording in the listed design, onboarding, session review, and README files. `GAME_PRINCIPLES.md` stays unchanged because same-seed reproducibility is unchanged. The README must list this plan directly after the spec.

- [ ] **Step 2: Run focused and whole-project verification**

```bash
pnpm vitest run app/campaign/page.test.ts components/game/MainMenuScreen.test.tsx lib/rules/board.test.ts
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 3: Browser smoke check**

Run: `pnpm test:e2e -- e2e/routes.spec.ts e2e/campaign-smoke.spec.ts`

Expected: PASS. Do not assert two random boards differ: equal combinations are valid.

- [ ] **Step 4: Commit**

```bash
git add docs/README.md docs/design/CORE_GAME_LOOP.md docs/experience/ONBOARDING_AND_INTERFACE.md docs/technical/SESSION_PERSISTENCE_REVIEW.md docs/superpowers/specs/2026-08-26-lattebun-campaign-random-seed-design.md docs/superpowers/plans/2026-08-26-lattebun-campaign-random-seed.md
git commit -m "문서: 캠페인 기본 시드 정책을 기록한다" -m "새 진입의 무작위 시드와 명시적 재현 시드 경계를 공식 문서와 실행 계획에 반영한다."
```
