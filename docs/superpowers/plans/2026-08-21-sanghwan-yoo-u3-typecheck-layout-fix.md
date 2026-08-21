# U3 타입 검증 및 공고 카드 레이아웃 보정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** U3 화면 모델의 `CharacterId` 계약을 복원하고 공고 카드의 이미지·텍스트 행을 반응형으로 안정화해 `typecheck`와 `build`를 통과시킨다.

**Architecture:** 도메인 식별자 타입은 `u3-board-model.ts`의 화면 모델 경계까지 전달하고, 화면 렌더링 구조와 계약은 바꾸지 않는다. 공고 카드의 일곱 DOM 행 중 장면만 유연한 행으로 두고, 마지막 네 정보 행은 고정 높이로 보존한다. 대화면 전용 CSS에서 장면 최대 폭과 카드 보조 텍스트 상한을 낮춘다.

**Tech Stack:** Next.js 16.3, React 19.2, TypeScript 5, Vitest 4.1, 전역 CSS, agent-browser

**Spec:** `docs/superpowers/specs/2026-08-21-sanghwan-yoo-u3-typecheck-layout-fix-design.md`

## Global Constraints

- `U3PartyMemberView.id`는 `CharacterId`를 사용하고 캐릭터 풀의 `Readonly<Record<CharacterId, Character>>` 계약을 보존한다.
- U3의 GameShell 3:2(좌 60%·우 40%)와 1280×720 기준, 1024×640 최소 지원을 유지한다.
- 공고 카드의 일곱 행 순서는 `auto auto minmax(0, 1fr) auto auto auto auto`를 사용한다.
- 장면 비네트는 기존 16:9를 유지하고 대화면 최대 폭은 `clamp(13rem, 15vw, 24rem)`으로 제한한다.
- 캠페인 규칙, 보상 수치, 상태 머신, `lib/backtest`, `pnpm backtest`는 변경하지 않는다.
- 새 의존성을 추가하지 않는다.
- 커밋 메시지는 제목과 본문을 포함한 한글로 작성한다.

## File Map

- `components/game/u3-board-model.ts`: 화면 모델의 캐릭터 식별자와 초상 매핑 타입을 도메인 `CharacterId`에 맞춘다.
- `components/game/u3-board-model.test.ts`: 화면 모델이 `CharacterId` 키로 실제 캐릭터 풀을 조회한다는 컴파일 계약을 고정한다.
- `components/game/U3Assets.test.ts`: 공고 행 분배와 대화면 장면 크기의 CSS 회귀 계약을 고정한다.
- `app/u3-responsive-layout.css`: 장면만 유연하게 줄어들도록 행 분배와 장면 높이 제한을 추가하고 대화면 보조 텍스트를 압축한다.
- `app/u3-large-screen.css`: 1440px 이상 공고 장면의 최대 폭을 낮춘다.

### Task 1: Restore the CharacterId screen-model contract

**Files:**
- Modify: `components/game/u3-board-model.test.ts:1-79`
- Modify: `components/game/u3-board-model.ts:1-84`

**Interfaces:**
- Consumes: `CharacterId` from `@/lib/domain`, `CharacterPool.byId` from `lib/domain/pool.ts`
- Produces: `U3PartyMemberView.id: CharacterId`, `U3PortraitMap: Readonly<Partial<Record<CharacterId, string>>>`

- [ ] **Step 1: Add the compile-level regression assertion**

In `components/game/u3-board-model.test.ts`, import `CharacterId` and make the test lookup use the branded ID:

```ts
import type { CharacterId } from "@/lib/domain";

// inside "공고의 임시 파티 3명을..."
for (const member of detail?.party ?? []) {
  const memberId: CharacterId = member.id;
  const source = campaign.pool.byId[memberId];
  expect(source).toBeDefined();
  expect(member.hp).toBe(source?.hp);
  expect(member.maxHp).toBe(source?.maxHp);
  expect(member.trust).toBe(source?.trust);
  expect(member.gold).toBe(source?.gold);
}
```

- [ ] **Step 2: Run the typecheck to capture the failing contract**

Run: `pnpm typecheck`

Expected: FAIL because the existing `U3PartyMemberView.id: string` cannot be assigned to `CharacterId`, and the existing pool lookup is not safely indexed by a plain string.

- [ ] **Step 3: Change the screen-model types to use the domain ID**

In `components/game/u3-board-model.ts`, import `CharacterId` with the other domain types and update only the identity fields:

```ts
import type {
  BoardOffer,
  CampaignState,
  CharacterId,
  Personality,
  RiskLevel,
  ThemeId,
} from "@/lib/domain";

export interface U3PartyMemberView {
  id: CharacterId;
  // ...existing display fields remain unchanged
}

export type U3PortraitMap = Readonly<Partial<Record<CharacterId, string>>>;
```

Keep `character.id` as the returned value in `createU3BoardView`; do not cast to a plain string and do not change runtime data.

- [ ] **Step 4: Run the focused type and behavior checks**

Run: `pnpm typecheck && pnpm test components/game/u3-board-model.test.ts`

Expected: TypeScript passes and all U3 board-model tests pass.

- [ ] **Step 5: Commit the type-contract change**

```bash
git add components/game/u3-board-model.ts components/game/u3-board-model.test.ts
git commit -m "수정: U3 캐릭터 ID 타입을 도메인 계약에 맞춘다" -m "화면 모델과 초상 매핑이 CharacterId를 보존하도록 바꾸고 캐릭터 풀 조회의 타입 오류를 제거한다."
```

### Task 2: Reserve card space for the scene and compact wide-screen notices

**Files:**
- Modify: `components/game/U3Assets.test.ts:50-71,96-116`
- Modify: `app/u3-responsive-layout.css:19-23,64-67,76-84`
- Modify: `app/u3-large-screen.css:105-117`

**Interfaces:**
- Consumes: the existing seven-child `NoticeCard` DOM order in `components/game/U3BoardScreen.tsx`
- Produces: a CSS contract where the scene is the only flexible row and dense wide-screen notice text remains readable without overlap

- [ ] **Step 1: Add failing CSS-contract assertions**

In `components/game/U3Assets.test.ts`, update the large-screen scene expectation and add a regression test for row ownership:

```ts
it("공고의 남는 공간은 장면 행에만 배분한다", () => {
  const css = readFileSync(join(process.cwd(), "app", "u3-responsive-layout.css"), "utf8");

  expect(css).toContain("grid-template-rows: auto auto minmax(0, 1fr) auto auto auto auto");
  expect(css).toContain(".u3-notice__theme-visual");
  expect(css).toContain("max-height: 100%");
});
```

Change the existing wide-screen expectation from `clamp(15rem, 18vw, 32rem)` to `clamp(13rem, 15vw, 24rem)` and add an expectation for the wide-screen compact text rule.

- [ ] **Step 2: Run the focused asset test to verify it fails before the CSS change**

Run: `pnpm test components/game/U3Assets.test.ts`

Expected: FAIL because the current responsive rule assigns `minmax(0, 1fr)` to the environment row and the current large-screen scene width is `clamp(15rem, 18vw, 32rem)`.

- [ ] **Step 3: Move the flexible grid row to the scene**

In the base responsive rule and both short-height overrides, use the DOM-aligned row contract:

```css
.u3-notice {
  grid-template-rows: auto auto minmax(0, 1fr) auto auto auto auto;
}
```

Keep `.u3-notice__theme-visual` shrinkable and cap its child scene within the row:

```css
.u3-notice__theme-visual {
  min-height: 0;
}

.u3-notice .u3-theme-scene {
  max-height: 100%;
}
```

- [ ] **Step 4: Reduce only the wide-screen scene and dense supporting copy**

In `app/u3-large-screen.css`, change the scene width to:

```css
.u3-theme-scene {
  width: min(100%, clamp(13rem, 15vw, 24rem));
}
```

In a later-loaded `@media (min-width: 90rem)` block in `app/u3-responsive-layout.css`, cap only notice support text:

```css
@media (min-width: 90rem) {
  .u3-notice .u3-reward,
  .u3-notice__environment strong,
  .u3-notice__state {
    font-size: clamp(0.78rem, 0.68vw, 1rem);
  }
}
```

Do not reduce the title or risk-star sizes, and keep the existing 16:9 scene ratio.

- [ ] **Step 5: Run the focused CSS and component tests**

Run: `pnpm test components/game/U3Assets.test.ts components/game/U3BoardScreen.test.ts`

Expected: all focused U3 asset and render tests pass.

- [ ] **Step 6: Commit the layout change**

```bash
git add app/u3-responsive-layout.css app/u3-large-screen.css components/game/U3Assets.test.ts
git commit -m "수정: U3 공고 카드의 이미지와 텍스트를 분리한다" -m "장면만 유연한 grid 행으로 두고 대화면 이미지와 보조 문구를 압축해 공고 겹침을 막는다."
```

### Task 3: Run the full verification and leave dev running

**Files:**
- Verify: `components/game/u3-board-model.ts`
- Verify: `app/u3-responsive-layout.css`
- Verify: `app/u3-large-screen.css`
- Verify: `components/game/U3Assets.test.ts`

**Interfaces:**
- Consumes: the committed type and layout changes from Tasks 1–2
- Produces: passing static checks, a browser-verified U3 page, and a running local dev server

- [ ] **Step 1: Run the full automated checks**

Run:

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Expected: all four commands exit 0. Do not run `pnpm backtest` because this change does not touch campaign rules, transition logic, balance constants, or `lib/backtest`.

- [ ] **Step 2: Start the dev server**

Run: `pnpm dev`

Expected: Next.js serves `http://localhost:3000` and remains running.

- [ ] **Step 3: Verify the U3 page in a browser**

Run:

```bash
agent-browser open http://127.0.0.1:3000/u3-test
agent-browser wait 3000
agent-browser screenshot --annotate
agent-browser eval 'JSON.stringify({bodyHasContent: document.body.innerText.trim().length > 0, errorOverlay: Boolean(document.querySelector("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay")), horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth, consoleErrors: window.__consoleErrors || []})'
agent-browser snapshot -i
```

Expected: the U3 page has content, no error overlay, no horizontal overflow, no console errors, and the notice/detail controls remain interactive. Repeat at 1280×720 and 1024×640 if viewport controls are available; also inspect the wide-screen screenshot for no overlap between scene, reward, environment, and state rows.

- [ ] **Step 4: Close only the browser session and preserve the dev server**

Run: `agent-browser close`

Expected: browser closes while `pnpm dev` continues running at port 3000.

- [ ] **Step 5: Confirm repository state**

Run: `git status --short --branch && git log -3 --oneline --decorate`

Expected: the working tree is clean and contains the spec, plan, type-contract commit, and layout commit.
