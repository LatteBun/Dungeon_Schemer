# U3 길드 게시판·계약 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** C2의 실제 게시판 공고와 임시 파티 데이터를 사용해 U2 다음에 자연스럽게 이어지는 60:40 길드 게시판·계약 화면을 구현한다.

**Architecture:** `U3Preview`가 `initializeCampaign`과 `createBoardOffers`로 재현 가능한 프리뷰 상태를 만들고, 순수 `u3-board-model.ts`가 던전·캐릭터·보상 데이터를 화면용 모델로 변환한다. `U3BoardScreen`은 U1 `GameShell`의 3:2 레이아웃을 재사용하고, 선택 상태만 클라이언트에서 관리하며 실제 캠페인 전이는 I1/I2에 남긴다.

**Tech Stack:** Next.js 16.3, React 19.2, TypeScript 5, Vitest 4.1, Tailwind 4 + 전역 CSS, 기존 C1/C2 순수 규칙

**Spec:** `docs/superpowers/specs/2026-08-21-sanghwan-yoo-u3-guild-board-design.md`

## Global Constraints

- U3 본문은 U1 `GameShell`의 `minmax(0, 3fr) minmax(0, 2fr)` 계약을 유지한다.
- 기준 해상도 `1280x720`, 최소 `1024x640`, 가로 스크롤 금지.
- 공고는 최대 5장, 모두 같은 크기이며 위치와 1도 안팎 회전만 약간 다르게 한다.
- 공고의 태그성 정보는 `환경 특성` 정확히 1개, `offer.publicEnvironmentTag.label`만 사용한다.
- `의뢰 갱신`, 소요 시간, 정찰 보고, 다중 위험 태그를 만들지 않는다.
- 우측 파티 카드는 실제 캐릭터의 이름·직업·성격·HP·신뢰·소지 골드를 데이터로 표시한다.
- 파티원 이미지, HP, 신뢰, 소지 골드 전용 SVG를 만들지 않는다.
- 골드·명성·계약 아이콘은 U2 자산을 재사용한다.
- 새 U3 SVG는 고정 UI/테마 모티프만 담당한다.
- 전멸 계약 조건은 계약 보상 없음과 계약 당시 위험도의 3명 생존 명성만큼 명성 감소를 표시한다.

---

### Task 1: U3 화면용 뷰 모델과 계약 보상 계산

**Files:**
- Create: `components/game/u3-board-model.ts`
- Test: `components/game/u3-board-model.test.ts`

**Interfaces:**
- Consumes: `CampaignState`, `BoardOffer`, `CampaignDungeon`, `Character`, `RiskLevel`, `CLASSES`
- Produces:
  - `U3BoardNoticeView`
  - `U3PartyMemberView`
  - `U3ContractOutcomeView`
  - `createU3BoardView(campaign: CampaignState, offers: readonly BoardOffer[]): U3BoardView`

- [ ] **Step 1: Write failing reward/view-model tests**

Test exact official rewards for risk 1~5 and survival rows. For risk ★3 assert:

```ts
expect(view.selected?.contractOutcomes).toEqual([
  { survivors: 3, label: "전원 생존 시", reputation: 15, gold: 32, reputationLoss: 0 },
  { survivors: 2, label: "2명 생존 시", reputation: 9, gold: 19, reputationLoss: 0 },
  { survivors: 1, label: "1명 생존 시", reputation: 4, gold: 9, reputationLoss: 0 },
  { survivors: 0, label: "전원 사망 시", reputation: 0, gold: 0, reputationLoss: 15 },
]);
```

Also assert each notice exposes exactly one `environmentLabel` from `publicEnvironmentTag.label`, and party members resolve from `campaign.pool.byId`.

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm test components/game/u3-board-model.test.ts
```

Expected: FAIL because `u3-board-model.ts` does not exist.

- [ ] **Step 3: Implement minimal pure view model**

Use this official reward table inside the projection module until C4 introduces a shared settlement reward helper:

```ts
const FULL_SURVIVOR_REWARD = {
  1: { reputation: 6, gold: 12 },
  2: { reputation: 10, gold: 20 },
  3: { reputation: 15, gold: 32 },
  4: { reputation: 21, gold: 45 },
  5: { reputation: 28, gold: 60 },
} as const;
```

Use `Math.floor(full * 0.6)` and `Math.floor(full * 0.3)` for partial survival. Resolve class labels from `CLASSES`. Map personalities locally to Korean display labels without changing domain IDs.

- [ ] **Step 4: Run GREEN**

```bash
pnpm test components/game/u3-board-model.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/game/u3-board-model.ts components/game/u3-board-model.test.ts
git commit -m "U3 게시판 뷰 모델 구현

공고와 파티 상태를 화면 모델로 투영하고 생존 인원별 계약 결과를 계산한다."
```

### Task 2: 고정 U3 SVG 자산과 60:40 게시판 화면

**Files:**
- Create: `public/assets/u3/board-pin.svg`
- Create: `public/assets/u3/risk-star.svg`
- Create: `public/assets/u3/environment.svg`
- Create: `public/assets/u3/notice-lock.svg`
- Create: `public/assets/u3/theme-spider.svg`
- Create: `public/assets/u3/theme-desert.svg`
- Create: `public/assets/u3/theme-graveyard.svg`
- Create: `components/game/U3BoardScreen.tsx`
- Create: `components/game/U3BoardScreen.test.ts`
- Create: `app/u3-board.css`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `U3BoardView`, `TopStatusView`, `GameShell`
- Produces:

```ts
export interface U3BoardScreenProps {
  status: TopStatusView;
  board: U3BoardView;
  selectedOfferId: string;
  onSelectOffer: (offerId: string) => void;
  onContract: (offerId: string) => void;
}
```

- [ ] **Step 1: Write failing screen tests**

Assert rendered static markup includes:

- `길드 게시판`
- maximum five notices
- selected `aria-pressed="true"`
- exactly one `환경 특성` row per notice
- no `의뢰 갱신`, `소요 시간`, `정찰 보고`, `계약 기간`, `중도 포기`, `실패 패널티`
- three party member cards
- four contract outcome labels
- locked notice includes `진입 불가` and contract button `disabled`

- [ ] **Step 2: Run RED**

```bash
pnpm test components/game/U3BoardScreen.test.ts
```

Expected: FAIL because `U3BoardScreen.tsx` does not exist.

- [ ] **Step 3: Implement fixed SVG assets**

All SVGs use `viewBox="0 0 24 24"`, `currentColor` where practical, transparent backgrounds, and no embedded text. Theme SVGs are symbolic motifs only: spider web, desert sun/dune, grave marker.

- [ ] **Step 4: Implement `U3BoardScreen`**

Use `GameShell` directly:

```tsx
<GameShell
  status={status}
  screenTitle="길드 게시판"
  main={<GuildNoticeBoard />}
  rightPanel={<ContractDetailPanel />}
  rightPanelLabel="계약 상세"
/>
```

Render equal-size notice buttons with index classes `u3-notice--0` through `u3-notice--4`; CSS may change transform only, not width/height. Reuse `/assets/u2/status-gold.svg`, `/assets/u2/status-reputation.svg`, `/assets/u2/intro-contract.svg`.

- [ ] **Step 5: Implement `app/u3-board.css` and import it from layout**

Keep `GameShell`'s grid untouched. Scope visual overrides under `.u3-board-screen` so U1/U2 styles do not regress. At `1024x640`, reduce internal spacing/font sizes while preserving `3fr 2fr`.

- [ ] **Step 6: Run GREEN**

```bash
pnpm test components/game/U3BoardScreen.test.ts components/game/u3-board-model.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/u3-board.css app/layout.tsx components/game/U3BoardScreen.tsx components/game/U3BoardScreen.test.ts public/assets/u3
git commit -m "U3 게시판 계약 화면 구현

60:40 게시판과 계약 상세를 구현하고 고정 UI 모티프를 SVG 자산으로 분리한다."
```

### Task 3: 실제 C2 데이터 프리뷰와 U2→U3 연결

**Files:**
- Create: `components/game/U3Preview.tsx`
- Create: `components/game/U3Preview.test.ts`
- Create: `app/u3-test/page.tsx`
- Modify: `components/game/U2Preview.tsx`
- Modify: `components/game/U2Preview.test.ts`

**Interfaces:**
- Consumes: `initializeCampaign(seed)`, `createBoardOffers(state)`, `createU3BoardView`
- Produces: `/u3-test`, U2 CTA `/u3-test`

- [ ] **Step 1: Write failing integration tests**

Assert U3 preview source calls both `initializeCampaign` and `createBoardOffers`, stores selected offer ID, and renders `U3BoardScreen`. Update U2 test expectation from `/u1-test?screen=board` to `/u3-test`.

- [ ] **Step 2: Run RED**

```bash
pnpm test components/game/U3Preview.test.ts components/game/U2Preview.test.ts
```

Expected: U3 import/file failure and old U2 href failure.

- [ ] **Step 3: Implement U3 preview**

Use a stable preview seed:

```ts
const campaign = initializeCampaign("u3-guild-board-preview");
const offers = createBoardOffers(campaign);
const board = createU3BoardView(campaign, offers);
```

Manage `selectedOfferId` with React state. `onContract` updates an `aria-live` preview message only; do not implement I1/I2 campaign transitions.

- [ ] **Step 4: Add `/u3-test` and change U2 href**

`app/u3-test/page.tsx` renders only `<U3Preview />`. Change U2 `boardHref` to `/u3-test`.

- [ ] **Step 5: Run GREEN**

```bash
pnpm test components/game/U3Preview.test.ts components/game/U2Preview.test.ts components/game/U3BoardScreen.test.ts components/game/u3-board-model.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/u3-test components/game/U3Preview.tsx components/game/U3Preview.test.ts components/game/U2Preview.tsx components/game/U2Preview.test.ts
git commit -m "U2에서 U3 게시판 프리뷰 연결

C2 실제 공고를 사용하는 U3 테스트 경로를 만들고 인트로 CTA 목적지를 교체한다."
```

### Task 4: 공식 UX 문서 정합성과 최종 검증

**Files:**
- Modify: `docs/experience/SCREEN_LAYOUT.md`
- Modify: `docs/experience/ONBOARDING_AND_INTERFACE.md`
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

**Interfaces:**
- Consumes: verified U3 implementation
- Produces: current U3 terminology (`환경 특성`, no scouting-report section) reflected in official docs

- [ ] **Step 1: Update stale U3 wording**

Change U3-specific `공개 위험 태그` to `공개 환경 특성 1개`. Remove U3 contract-detail `답사 기록` requirement. Keep ecology information itself; it is shown through the single environment characteristic.

- [ ] **Step 2: Run focused and full tests**

```bash
pnpm test components/game/u3-board-model.test.ts components/game/U3BoardScreen.test.ts components/game/U3Preview.test.ts components/game/U2Preview.test.ts
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all exit 0.

- [ ] **Step 3: Browser verification**

Run:

```bash
pnpm dev
```

Verify `/u3-test` at `1280x720` and `1024x640`:

- left/right measured ratio is 1.5
- `scrollWidth === innerWidth`
- notices are equal dimensions
- selected notice changes right detail
- locked notice exposes a textual reason and disables contract
- keyboard Tab/Enter selects a notice and activates an available contract
- U2 `/u2-test` CTA opens `/u3-test`

- [ ] **Step 4: Update U3 completion record only after verification**

If and only if all commands and browser checks pass, mark U3 `✅` and append a dated completion record. If this execution environment cannot run full project verification, leave U3 `🟡` or `⬜` and record only implemented scope without claiming completion.

- [ ] **Step 5: Commit**

```bash
git add docs/experience/SCREEN_LAYOUT.md docs/experience/ONBOARDING_AND_INTERFACE.md docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md
git commit -m "U3 게시판 문서 정합성 갱신

공개 환경 특성 단일 노출과 계약 상세 구조를 실제 구현 기준으로 맞춘다."
```
