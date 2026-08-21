# U3 길드 게시판·계약 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** C2의 실제 게시판 공고와 임시 파티 데이터를 사용해 U2 다음에 자연스럽게 이어지는 60:40 길드 게시판·계약 화면을 구현한다.

**Architecture:** `U3Preview`가 `initializeCampaign`과 `createBoardOffers`로 재현 가능한 프리뷰 상태를 만들고, 순수 `u3-board-model.ts`가 던전·환경 특성·답사 기록·캐릭터·보상 데이터를 화면용 모델로 변환한다. `U3BoardScreen`은 U1 `GameShell`의 3:2 레이아웃을 재사용하고 선택 상태만 클라이언트에서 관리하며 실제 캠페인 전이는 I1/I2에 남긴다.

**Tech Stack:** Next.js 16.3, React 19.2, TypeScript 5, Vitest 4.1, Tailwind 4 + 전역 CSS, 기존 C1/C2 순수 규칙

**Spec:** `docs/superpowers/specs/2026-08-21-sanghwan-yoo-u3-guild-board-design.md`

## Global Constraints

- U3 본문은 U1 `GameShell`의 `minmax(0, 3fr) minmax(0, 2fr)` 계약을 유지한다.
- 기준 해상도 `1280x720`, 최소 `1024x640`, 가로 스크롤 금지.
- 공고는 최대 5장, 모두 같은 크기이며 위치와 1도 안팎 회전만 약간 다르게 한다.
- 공고의 태그성 정보는 `환경 특성` 정확히 1개, `offer.publicEnvironmentTag.label`만 사용한다.
- `함정`, `모래폭풍`, `독`, `저주`, `보스` 같은 다중 태그 묶음과 `의뢰 갱신`, 소요 시간은 만들지 않는다.
- 우측 계약 상세의 `답사 기록`은 유지하고 활성 생태 규칙을 ★1~2 3개, ★3 2개, ★4~5 1개 공개한다.
- 우측 파티 카드는 실제 캐릭터의 이름·직업·성격·HP·신뢰·소지 골드를 데이터로 표시한다.
- 파티원 이미지, HP, 신뢰, 소지 골드 전용 SVG를 만들지 않는다.
- 골드·명성·계약 아이콘은 U2 자산을 재사용한다.
- 새 U3 SVG는 고정 UI/테마 모티프만 담당한다.
- 전멸 계약 조건은 계약 보상 없음과 계약 당시 위험도의 3명 생존 명성만큼 명성 감소를 표시한다.

---

### Task 1: U3 화면용 뷰 모델과 계약 보상·답사 기록

**Files:**
- Create: `components/game/u3-board-model.ts`
- Test: `components/game/u3-board-model.test.ts`

**Interfaces:**
- Consumes: `CampaignState`, `BoardOffer`, `RiskLevel`, `CLASSES`, `THEMES`
- Produces:
  - `U3BoardNoticeView`
  - `U3PartyMemberView`
  - `U3ContractOutcomeView`
  - `scoutedRuleCountForRisk(riskLevel: RiskLevel): 1 | 2 | 3`
  - `createU3BoardView(campaign: CampaignState, offers: readonly BoardOffer[]): U3BoardView`

- [x] **Step 1: Write contract tests first**

Tests cover official reward rows, one `environmentLabel` per notice, real party projection, and ★1~5 scouting disclosure counts `3/3/2/1/1`.

- [ ] **Step 2: Run RED**

```bash
pnpm test components/game/u3-board-model.test.ts
```

Expected before implementation: missing module/API failure. This execution environment cannot clone/run the repository, so RED execution must be confirmed in Codespaces.

- [x] **Step 3: Implement minimal pure view model**

Use the official full-survivor table:

```ts
const FULL_SURVIVOR_REWARD = {
  1: { reputation: 6, gold: 12 },
  2: { reputation: 10, gold: 20 },
  3: { reputation: 15, gold: 32 },
  4: { reputation: 21, gold: 45 },
  5: { reputation: 28, gold: 60 },
} as const;
```

Use `Math.floor(full * 0.6)` and `Math.floor(full * 0.3)` for partial survival. Resolve class labels from `CLASSES`, personality labels locally, and active rule texts from `THEMES`.

- [ ] **Step 4: Run GREEN**

```bash
pnpm test components/game/u3-board-model.test.ts
```

Expected: PASS in Codespaces.

### Task 2: 고정 U3 SVG 자산과 60:40 게시판 화면

**Files:**
- Create: `public/assets/u3/board-pin.svg`
- Create: `public/assets/u3/risk-star.svg`
- Create: `public/assets/u3/environment.svg`
- Create: `public/assets/u3/notice-lock.svg`
- Create: `public/assets/u3/theme-spider.svg`
- Create: `public/assets/u3/theme-desert.svg`
- Create: `public/assets/u3/theme-graveyard.svg`
- Create: `components/game/U3Assets.test.ts`
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

- [x] **Step 1: Write screen behavior tests first**

Tests assert maximum five notices, one environment characteristic row per notice, selected `aria-pressed`, scouting record sentences, three party members, four contract outcomes, and disabled locked contract.

- [x] **Step 2: Add fixed SVG assets**

All seven assets use `viewBox="0 0 24 24"`, transparent backgrounds and no embedded text. Theme assets are motifs only.

- [x] **Step 3: Implement `U3BoardScreen`**

Use `GameShell` directly and keep notice dimensions equal. Only index-specific transform changes position/rotation. Reuse U2 reputation/gold/contract SVGs.

- [x] **Step 4: Implement `app/u3-board.css` and import it from layout**

All overrides are scoped under `.u3-board-screen`; `GameShell` grid columns are not replaced.

- [ ] **Step 5: Run focused GREEN tests**

```bash
pnpm test components/game/U3Assets.test.ts components/game/U3BoardScreen.test.ts components/game/u3-board-model.test.ts
```

Expected: PASS in Codespaces.

### Task 3: 실제 C2 데이터 프리뷰와 U2→U3 연결

**Files:**
- Create: `components/game/U3Preview.tsx`
- Create: `components/game/U3Preview.test.ts`
- Create: `app/u3-test/page.tsx`
- Modify: `components/game/U2Preview.tsx`
- Modify: `components/game/U2Preview.test.ts`

- [x] **Step 1: Add integration tests**

U3 preview test renders actual C2 output and U2 test expects `/u3-test`.

- [x] **Step 2: Implement U3 preview**

```ts
const campaign = initializeCampaign("u3-guild-board-preview");
const offers = createBoardOffers(campaign);
const board = createU3BoardView(campaign, offers);
```

Manage selected offer with React state. `onContract` updates only an `aria-live` preview message; I1/I2 transition is out of scope.

- [x] **Step 3: Add `/u3-test` and change U2 href**

U2 CTA points to `/u3-test`.

- [ ] **Step 4: Run integration GREEN tests**

```bash
pnpm test components/game/U3Preview.test.ts components/game/U2Preview.test.ts components/game/U3BoardScreen.test.ts components/game/u3-board-model.test.ts
```

Expected: PASS in Codespaces.

### Task 4: 공식 UX 문서 정합성과 최종 검증

**Files:**
- Modify: `docs/experience/SCREEN_LAYOUT.md`
- Modify: `docs/experience/ONBOARDING_AND_INTERFACE.md`
- Modify: `docs/diagram/screen-wireframes.md`
- Modify after verification only: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

- [ ] **Step 1: Update stale U3 wording**

Change U3-specific `공개 위험 태그` to `공개 환경 특성 1개`. Keep contract-detail `답사 기록` and clarify it is a sentence list of disclosed active ecology rules, not a tag group.

- [ ] **Step 2: Run focused and full tests**

```bash
pnpm test components/game/u3-board-model.test.ts components/game/U3Assets.test.ts components/game/U3BoardScreen.test.ts components/game/U3Preview.test.ts components/game/U2Preview.test.ts
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all exit 0.

- [ ] **Step 3: Browser verification**

Run `pnpm dev` and verify `/u3-test` at `1280x720` and `1024x640`:

- left/right measured ratio is 1.5
- `scrollWidth === innerWidth`
- all notice cards are equal dimensions
- selected notice changes right detail, scouting record and party together
- locked notice exposes a textual reason and disables contract
- keyboard Tab/Enter selects a notice and activates an available contract
- U2 `/u2-test` CTA opens `/u3-test`

- [ ] **Step 4: Update U3 completion record only after verification**

Only after all commands and browser checks pass, mark U3 `✅` and append a dated completion record. Until then do not claim verification success.
