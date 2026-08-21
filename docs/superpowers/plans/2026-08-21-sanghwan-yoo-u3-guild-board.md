# U3 길드 게시판·계약 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** C2의 실제 게시판 공고와 임시 파티 데이터를 사용해 U2 다음에 자연스럽게 이어지는 60:40 길드 게시판·계약 화면을 구현한다.

**Architecture:** `U3Preview`가 `initializeCampaign`과 `createBoardOffers`로 재현 가능한 프리뷰 상태를 만들고, 순수 `u3-board-model.ts`가 던전·환경 특성·캐릭터·보상 데이터를 화면용 모델로 변환한다. `U3BoardScreen`은 U1 `GameShell`의 3:2 레이아웃을 재사용하고 선택 상태만 클라이언트에서 관리하며 실제 캠페인 전이는 I1/I2에 남긴다. 별도의 정찰/답사 보고 모델은 만들지 않는다.

**Tech Stack:** Next.js 16.3, React 19.2, TypeScript 5, Vitest 4.1, Tailwind 4 + 전역 CSS, 기존 C1/C2 순수 규칙

**Spec:** `docs/superpowers/specs/2026-08-21-sanghwan-yoo-u3-guild-board-design.md`

## Global Constraints

- U3 본문은 U1 `GameShell`의 `minmax(0, 3fr) minmax(0, 2fr)` 계약을 유지한다.
- 기준 해상도 `1280x720`, 최소 `1024x640`, 가로 스크롤 금지.
- 공고는 최대 5장, 모두 같은 크기이며 위치와 1도 안팎 회전만 약간 다르게 한다.
- 공고의 태그성 정보는 `환경 특성` 정확히 1개, `offer.publicEnvironmentTag.label`만 사용한다.
- `함정`, `모래폭풍`, `독`, `저주`, `보스` 같은 다중 태그 묶음과 `의뢰 갱신`, `소요 시간`, `정찰 보고`, U3의 별도 `답사 기록`은 만들지 않는다.
- 우측 파티 카드는 실제 캐릭터의 이름·직업·성격·HP·신뢰·소지 골드를 데이터로 표시한다.
- 캐릭터 고유 초상은 선택적 `portraitSrc` 매핑만 지원하고, 이미지가 없으면 중립 실루엣을 쓴다.
- HP·신뢰·소지 골드 값 전용 SVG를 만들지 않는다.
- 골드·명성·계약 아이콘은 U2 자산을 재사용한다.
- 새 U3 SVG는 고정 UI/테마 모티프만 담당한다.
- 전멸 계약 조건은 계약 보상 없음과 계약 당시 위험도의 3명 생존 명성만큼 명성 감소를 표시한다.
- 실제 캠페인 phase 변경과 지도 전이는 I1/I2 범위다.

---

### Task 1: U3 화면용 뷰 모델과 계약 보상

**Files:**
- Create: `components/game/u3-board-model.ts`
- Test: `components/game/u3-board-model.test.ts`

**Interfaces:**
- Consumes: `CampaignState`, `BoardOffer`, `RiskLevel`, `CLASSES`
- Produces:
  - `U3BoardNoticeView`
  - `U3PartyMemberView`
  - `U3ContractOutcomeView`
  - `U3PortraitMap`
  - `contractOutcomesForRisk(riskLevel: RiskLevel): readonly U3ContractOutcomeView[]`
  - `createU3BoardView(campaign, offers, portraitByCharacterId?): U3BoardView`

- [x] **Step 1: Write failing contract tests first**

Tests require:

```ts
expect(contractOutcomesForRisk(3)).toEqual([
  { survivors: 3, label: "전원 생존 시", reputation: 15, gold: 32, reputationLoss: 0 },
  { survivors: 2, label: "2명 생존 시", reputation: 9, gold: 19, reputationLoss: 0 },
  { survivors: 1, label: "1명 생존 시", reputation: 4, gold: 9, reputationLoss: 0 },
  { survivors: 0, label: "전원 사망 시", reputation: 0, gold: 0, reputationLoss: 15 },
]);
```

and verify that every notice receives exactly `offer.publicEnvironmentTag.label`, every detail receives three actual campaign characters, and an optional character portrait mapping reaches `party[].portraitSrc`.

- [ ] **Step 2: Confirm RED in Codespaces**

```bash
pnpm test components/game/u3-board-model.test.ts
```

Expected before the matching implementation commit: failure because optional portrait mapping is unsupported. GitHub connector cannot execute the repository, so this historical RED must be checked from the commit sequence if desired; current branch has already moved to GREEN implementation.

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

Use `Math.floor(full * 0.6)` and `Math.floor(full * 0.3)` for partial survival. Resolve class labels from `CLASSES`, personality labels locally, lock text from `RANK_RISK_LIMIT`, and do not derive scouting/report data.

- [ ] **Step 4: Run focused GREEN**

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

Tests assert:

- notice count equals supplied board count up to five
- exactly one environment-feature row per notice
- selected `aria-pressed`
- no `의뢰 갱신`, `소요 시간`, `계약 기간`, `중도 포기`, `실패 패널티`, `답사 기록`, `정찰 보고`
- three party members and dynamic HP/trust/held gold
- optional portrait image is rendered when supplied
- party held gold reuses `/assets/u2/status-gold.svg`
- four survivor outcome rows
- locked contract is disabled with textual reason

- [x] **Step 2: Add fixed SVG assets**

All seven assets use a transparent background and scalable `viewBox`. Theme assets express only spider/desert/graveyard motifs; they contain no dynamic values.

- [x] **Step 3: Implement `U3BoardScreen`**

Use `GameShell` directly. Notice dimensions remain equal; index-specific transforms alter only position/rotation. Reuse U2 reputation/gold/contract SVGs. Right detail contains only dungeon summary, party three, contract outcomes and CTA.

- [x] **Step 4: Support future character portraits without owning their assets**

`PartyCard` renders `member.portraitSrc` when supplied and otherwise keeps a neutral silhouette. U3 does not create or map final character art itself.

- [x] **Step 5: Implement `app/u3-board.css` and import it from layout**

All overrides are scoped under `.u3-board-screen`; the `GameShell` 3:2 grid columns are not replaced.

- [ ] **Step 6: Run focused GREEN tests**

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

U3 preview test uses actual C1/C2 output and U2 test expects `/u3-test`.

- [x] **Step 2: Implement U3 preview**

```ts
const campaign = initializeCampaign("u3-guild-board-preview");
const offers = createBoardOffers(campaign);
const board = createU3BoardView(campaign, offers);
```

Manage only selected offer and preview feedback with React state. Do not copy C2 board generation or party formation rules into UI code.

- [x] **Step 3: Add `/u3-test` and replace temporary U2 destination**

`U2Preview` now passes `boardHref="/u3-test"` to the approved U2 intro.

- [ ] **Step 4: Run integration GREEN tests**

```bash
pnpm test components/game/U3Preview.test.ts components/game/U2Preview.test.ts components/game/U3BoardScreen.test.ts components/game/u3-board-model.test.ts
```

Expected: PASS in Codespaces.

### Task 4: 레퍼런스 이미지와 공식 UX 문서 정합성

**Files:**
- Add: `docs/diagram/u3/u3-guild-board-concept.webp`
- Add: `docs/diagram/u3/u3-guild-board-assets.webp`
- Modify: `docs/experience/SCREEN_LAYOUT.md`
- Modify: `docs/experience/ONBOARDING_AND_INTERFACE.md`
- Modify: `docs/superpowers/specs/2026-08-21-sanghwan-yoo-u3-guild-board-design.md`
- Modify: `docs/superpowers/plans/2026-08-21-sanghwan-yoo-u3-guild-board.md`

- [x] **Step 1: Store approved image references**

The two WebP files are design records only. Do not embed them as the live U3 UI background.

- [x] **Step 2: Update U3-specific official wording**

`SCREEN_LAYOUT.md` and `ONBOARDING_AND_INTERFACE.md` now define one public environment feature and explicitly omit U3 scouting/report/time blocks. U5 may still use scouting information later; this change is scoped to U3.

- [x] **Step 3: Align spec and plan with final user decisions**

Remove old U3 scouting disclosure APIs and document the optional character portrait mapping and U2 asset reuse.

### Task 5: 최종 자동·브라우저 검증과 작업 배정표 완료 처리

**Files:**
- Modify after successful verification: `docs/README.md`
- Modify after successful verification: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

- [ ] **Step 1: Run focused tests**

```bash
pnpm test components/game/u3-board-model.test.ts components/game/U3Assets.test.ts components/game/U3BoardScreen.test.ts components/game/U3Preview.test.ts components/game/U2Preview.test.ts
```

Expected: all selected tests PASS.

- [ ] **Step 2: Run full repository verification**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all commands exit 0. Do not mark U3 complete if one fails.

- [ ] **Step 3: Browser verification**

```bash
pnpm dev
```

Open `/u2-test`, activate `길드 게시판으로`, and verify it navigates to `/u3-test`. At both `1280x720` and `1024x640`, verify:

- MainContent/RightPanel measured ratio is 1.5
- `document.documentElement.scrollWidth === window.innerWidth`
- all visible notice cards have equal width and height
- notice cards are slightly offset/rotated rather than perfectly aligned
- each notice has exactly one `환경 특성`
- no U3 scouting/report/time section exists
- selecting another notice changes dungeon summary, environment feature, party and outcome values together
- locked notice shows `진입 불가` plus reason and disables contract
- Tab/Enter can select notices and activate an available contract
- console/page error and Next error overlay are absent

- [ ] **Step 4: Update documentation index and U3 completion record**

After Steps 1–3 pass:

1. add U3 spec/plan links to `docs/README.md`
2. change U3 row in `CAMPAIGN_REWORK_WORK_ASSIGNMENT.md` to the final contract:
   - maximum five equal-size slightly asymmetric notices
   - exactly one environment feature per notice
   - locked red state + reason
   - right detail with dungeon summary, party three, survivor outcome rows and CTA
3. set 담당 to `SangHwan Yoo`
4. set status to `✅`
5. append a dated U3 completion record including test counts and browser measurements

Until verification succeeds, leave U3 uncompleted rather than recording unverified success.
