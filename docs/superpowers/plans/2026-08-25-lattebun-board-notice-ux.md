# 게시판 수배지 UX·던전 명칭 개선 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 캠페인 게시판의 수배지와 내부 콘텐츠를 약 80% 크기로 줄여 결정적인 불규칙 배치로 만들고, 던전 15개의 표시 이름을 보스 전설형 이름으로 교체하며, 우측 계약 상세의 장면 배경을 제거한다.

**Architecture:** 안정 ID와 규칙 데이터는 유지하고 `INITIAL_DUNGEON_SLOTS`의 표시 이름만 교체한다. 게시판은 15열×12행 CSS grid 위에 동일한 4열×5행 카드를 명시적으로 배치해 기존 셀 대비 약 80%의 실제 점유 크기와 안정적인 읽기 순서를 동시에 만든다. 우측 계약 카드는 배경 전용 마크업과 테마별 CSS만 제거해 기존 공통 상세 카드 배경으로 되돌린다.

**Tech Stack:** Next.js 16.3.0 App Router, React 19.2.8, TypeScript 5, 전역 CSS, Vitest 4.1.10, pnpm 11.21.0

**Spec:** `docs/superpowers/specs/2026-08-25-lattebun-board-notice-ux-design.md`

## Global Constraints

- 구현 시작 시 `superpowers:using-git-worktrees`로 별도 작업 트리와 기능 브랜치를 만들고, 기준 브랜치는 현재 승인된 spec·plan 커밋을 포함해야 한다.
- 코드 작성 전 `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`와 `node_modules/next/dist/docs/03-architecture/accessibility.md`를 읽는다.
- 수배지는 모두 같은 실제 크기이며 현재 3열×2행 셀 대비 가로·세로 약 80%를 점유한다. `transform: scale()`은 사용하지 않는다.
- 다섯 위치는 고정되어야 하며 렌더·시드마다 무작위로 바꾸지 않는다. DOM·탭 순서는 공고 데이터 순서를 유지한다.
- 고정 1920×1080 캔버스를 사용하므로 viewport 미디어 쿼리와 `vw`·`vh` 기반 크기를 추가하지 않는다.
- 카드끼리 겹치지 않고 회전각은 `-2.5deg`에서 `2.5deg` 안에 둔다.
- 수배지 안 작은 테마 장면은 유지하고 우측 계약 상세 뒤의 큰 테마 장면만 제거한다. 대체 이미지나 신규 자산은 추가하지 않는다.
- 던전 ID, 테마, 초기 위험도, 캠페인 순서, 생태 패키지, 보스 배정과 계약 동작은 변경하지 않는다.
- 사용자가 `/campaign` 로컬 화면을 승인하기 전에는 기준 브랜치나 `main`에 병합하거나 PR을 만들지 않는다.
- 커밋 제목과 본문은 모두 한글로 작성한다.

---

## 실행 전 준비

- `superpowers:using-git-worktrees`를 읽고 현재 저장소가 주 작업 트리인지 연결 작업 트리인지 판별한다.
- 새 브랜치는 `codex/board-notice-ux`를 사용한다. 같은 이름이 이미 있으면 충돌 원인을 확인하고 임의 삭제하지 않는다.
- 작업 트리의 기준 테스트로 아래 명령을 먼저 실행한다.

```bash
pnpm exec vitest run lib/content/campaign-dungeons.test.ts components/game/U3BoardScreen.test.ts components/game/U3Assets.test.ts components/game/FixedCanvas.test.ts components/game/campaign-render.test.tsx
```

- 실패가 있으면 구현을 시작하지 않고 `superpowers:systematic-debugging`으로 기존 실패인지 환경 실패인지 확인한다.

### Task 1: 던전 15개 표시 이름 확정

**Files:**
- Modify: `lib/content/campaign-dungeons.test.ts`
- Modify: `lib/content/campaign-dungeons.ts`

**Interfaces:**
- Consumes: 기존 `CampaignDungeonSlot`의 `id`, `name`, `theme`, `initialRiskLevel`, `campaignOrder`
- Produces: 안정 ID별로 고정된 보스 전설형 `name` 15개. 타입과 배열 순서는 그대로 유지한다.

- [ ] **Step 1: 정확한 ID·이름 매핑을 검증하는 실패 테스트 작성**

기존 번호형 이름 생성 assertion을 다음 고정 매핑 assertion으로 교체한다. 위험도와 ID 검증은 그대로 둔다.

```ts
const EXPECTED_NAME_BY_ID = {
  "dungeon-spider-01": "라그나의 산란굴",
  "dungeon-spider-02": "라그나의 검은실굴",
  "dungeon-spider-03": "모르칸의 사체길",
  "dungeon-spider-04": "세리나의 그림자굴",
  "dungeon-spider-05": "아라크샤의 왕좌",
  "dungeon-desert-01": "자카르의 불탄 우물",
  "dungeon-desert-02": "카르둠의 바람길",
  "dungeon-desert-03": "카르둠의 매장로",
  "dungeon-desert-04": "오벨론의 순례길",
  "dungeon-desert-05": "네프리스의 황무지",
  "dungeon-graveyard-01": "모르비안의 묘문",
  "dungeon-graveyard-02": "아즈라엘의 납골당",
  "dungeon-graveyard-03": "아즈라엘의 묘역",
  "dungeon-graveyard-04": "발드라크의 사냥터",
  "dungeon-graveyard-05": "발드라크의 왕묘",
} as const;

expect(
  Object.fromEntries(INITIAL_DUNGEON_SLOTS.map(({ id, name }) => [id, name])),
).toEqual(EXPECTED_NAME_BY_ID);
```

- [ ] **Step 2: 새 이름 테스트가 기존 번호형 데이터 때문에 실패하는지 확인**

Run:

```bash
pnpm exec vitest run lib/content/campaign-dungeons.test.ts
```

Expected: FAIL. 실제 값 `거미굴 1`, `사막 1`, `묘지 1` 등이 새 고정 매핑과 다르다고 출력한다.

- [ ] **Step 3: 표시 이름만 최소 변경**

`INITIAL_DUNGEON_SLOTS`의 각 객체에서 `name`만 아래 값으로 교체한다. `id`, `theme`, `initialRiskLevel`, `campaignOrder`는 수정하지 않는다.

```ts
export const INITIAL_DUNGEON_SLOTS: readonly CampaignDungeonSlot[] = [
  { id: "dungeon-spider-01" as DungeonId, name: "라그나의 산란굴", theme: "spider", initialRiskLevel: 1, campaignOrder: 1 },
  { id: "dungeon-spider-02" as DungeonId, name: "라그나의 검은실굴", theme: "spider", initialRiskLevel: 1, campaignOrder: 2 },
  { id: "dungeon-spider-03" as DungeonId, name: "모르칸의 사체길", theme: "spider", initialRiskLevel: 2, campaignOrder: 3 },
  { id: "dungeon-spider-04" as DungeonId, name: "세리나의 그림자굴", theme: "spider", initialRiskLevel: 3, campaignOrder: 4 },
  { id: "dungeon-spider-05" as DungeonId, name: "아라크샤의 왕좌", theme: "spider", initialRiskLevel: 4, campaignOrder: 5 },
  { id: "dungeon-desert-01" as DungeonId, name: "자카르의 불탄 우물", theme: "desert", initialRiskLevel: 1, campaignOrder: 6 },
  { id: "dungeon-desert-02" as DungeonId, name: "카르둠의 바람길", theme: "desert", initialRiskLevel: 2, campaignOrder: 7 },
  { id: "dungeon-desert-03" as DungeonId, name: "카르둠의 매장로", theme: "desert", initialRiskLevel: 2, campaignOrder: 8 },
  { id: "dungeon-desert-04" as DungeonId, name: "오벨론의 순례길", theme: "desert", initialRiskLevel: 3, campaignOrder: 9 },
  { id: "dungeon-desert-05" as DungeonId, name: "네프리스의 황무지", theme: "desert", initialRiskLevel: 4, campaignOrder: 10 },
  { id: "dungeon-graveyard-01" as DungeonId, name: "모르비안의 묘문", theme: "graveyard", initialRiskLevel: 2, campaignOrder: 11 },
  { id: "dungeon-graveyard-02" as DungeonId, name: "아즈라엘의 납골당", theme: "graveyard", initialRiskLevel: 3, campaignOrder: 12 },
  { id: "dungeon-graveyard-03" as DungeonId, name: "아즈라엘의 묘역", theme: "graveyard", initialRiskLevel: 3, campaignOrder: 13 },
  { id: "dungeon-graveyard-04" as DungeonId, name: "발드라크의 사냥터", theme: "graveyard", initialRiskLevel: 4, campaignOrder: 14 },
  { id: "dungeon-graveyard-05" as DungeonId, name: "발드라크의 왕묘", theme: "graveyard", initialRiskLevel: 5, campaignOrder: 15 },
];
```

- [ ] **Step 4: 콘텐츠 테스트 통과 확인**

Run:

```bash
pnpm exec vitest run lib/content/campaign-dungeons.test.ts
```

Expected: PASS. 15개 이름과 기존 위험도 빈도 검증이 모두 통과한다.

- [ ] **Step 5: 한글 커밋 작성**

```bash
git add lib/content/campaign-dungeons.ts lib/content/campaign-dungeons.test.ts
git commit -m "콘텐츠: 던전에 보스 전설 이름을 붙인다" -m "안정 ID와 위험도 순서는 유지하고 번호형 표시 이름 15개만 정식 보스 설정에 맞춰 교체한다."
```

### Task 2: 우측 계약 상세의 장면 배경 제거

**Files:**
- Modify: `components/game/U3BoardScreen.test.ts`
- Modify: `components/game/U3Assets.test.ts`
- Modify: `components/game/U3BoardScreen.tsx`
- Modify: `app/u3-board.css`
- Modify: `app/u3-card-theme.css`

**Interfaces:**
- Consumes: `U3OfferDetailView.theme`는 공고의 작은 `ThemeScene` 렌더링에 계속 사용한다.
- Produces: `section.u3-detail-section.u3-contract-card`는 공통 상세 카드 배경만 가지며, 배경용 theme modifier와 scrim 자식이 없다.

- [ ] **Step 1: 계약 상세 마크업과 CSS 경계를 고정하는 실패 테스트 작성**

`U3BoardScreen.test.ts`에 다음 테스트를 추가한다.

```ts
it("계약 상세는 테마 배경 modifier와 scrim 없이 정보만 렌더링한다", () => {
  const html = render("offer-1");

  expect(html).toContain('class="u3-detail-section u3-contract-card"');
  expect(html).not.toContain("u3-contract-card--desert");
  expect(html).not.toContain("u3-contract-card--spider");
  expect(html).not.toContain("u3-contract-card__scrim");
  expect(html).toContain("모래 협곡");
  expect(html).toContain("전원 생존 시");
});
```

`U3Assets.test.ts`에 다음 테스트를 추가한다. 작은 공고 장면은 `u3-large-screen.css`에 남아 있어야 하므로 `theme-scenes-wide.avif` 전체 사용을 금지하지 않는다.

```ts
it("계약 상세는 장면 배경과 전용 scrim 스타일을 사용하지 않는다", () => {
  const boardCss = readFileSync(join(process.cwd(), "app", "u3-board.css"), "utf8");
  const themeCss = readFileSync(join(process.cwd(), "app", "u3-card-theme.css"), "utf8");

  expect(boardCss).not.toContain(".u3-contract-card__scrim");
  expect(themeCss).not.toContain(".u3-detail-section.u3-contract-card");
  expect(themeCss).not.toContain(".u3-contract-card--desert");
  expect(themeCss).not.toContain(".u3-contract-card--spider");
  expect(themeCss).not.toContain(".u3-contract-card--graveyard");
});
```

- [ ] **Step 2: 새 테스트가 기존 배경 마크업과 CSS 때문에 실패하는지 확인**

Run:

```bash
pnpm exec vitest run components/game/U3BoardScreen.test.ts components/game/U3Assets.test.ts
```

Expected: FAIL. HTML에 `u3-contract-card--desert`와 `u3-contract-card__scrim`이 있고 CSS에 배경 전용 선택자가 남아 있다고 출력한다.

- [ ] **Step 3: 배경 전용 마크업 제거**

`U3BoardScreen.tsx`의 계약 카드 설명 주석, theme modifier, scrim을 제거하고 다음 구조로 만든다.

```diff
<section
-  className={`u3-detail-section u3-contract-card u3-contract-card--${detail.theme}`}
+  className="u3-detail-section u3-contract-card"
  aria-labelledby="u3-dungeon-title"
>
-  <div className="u3-contract-card__scrim" aria-hidden="true" />
  <div className="u3-contract-card__body">
```

위 여는 태그 아래의 기존 `u3-contract-card__head`, `ContractOutcomes`, 닫는 태그는 이동하거나 수정하지 않는다.

- [ ] **Step 4: 배경 전용 CSS 제거와 단색 바탕 가독성 정리**

`u3-card-theme.css`에서 다음 선택자와 관련 설명 주석·변수를 모두 삭제한다.

```css
.u3-detail-section.u3-contract-card { /* 전체 삭제 */ }
.u3-contract-card--desert { /* 전체 삭제 */ }
.u3-contract-card--spider { /* 전체 삭제 */ }
.u3-contract-card--graveyard { /* 전체 삭제 */ }
```

`u3-board.css`에서 `.u3-contract-card__scrim` 블록을 삭제하고, `.u3-contract-card`의 과거 배경 설명을 다음처럼 정리한다.

```css
.u3-contract-card {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.u3-contract-card__body > *,
.u3-contract-card__head * {
  text-shadow: 0 1px 2px rgb(0 0 0 / 72%);
}
```

`.u3-detail-section`의 기존 어두운 gradient 배경은 유지하며 새 이미지나 새 자산을 추가하지 않는다.

- [ ] **Step 5: 계약 상세와 기존 공고 장면 테스트 통과 확인**

Run:

```bash
pnpm exec vitest run components/game/U3BoardScreen.test.ts components/game/U3Assets.test.ts
```

Expected: PASS. 계약 상세 배경 전용 계약은 사라지고, 기존 공고의 `u3-notice-theme-scene`과 장면 스프라이트 테스트는 계속 통과한다.

- [ ] **Step 6: 한글 커밋 작성**

```bash
git add components/game/U3BoardScreen.tsx components/game/U3BoardScreen.test.ts components/game/U3Assets.test.ts app/u3-board.css app/u3-card-theme.css
git commit -m "화면: 계약 상세의 장면 배경을 제거한다" -m "우측 던전 정보 뒤의 테마 배경과 scrim만 제거하고 공고 안의 작은 테마 장면과 계약 정보 구조는 유지한다."
```

### Task 3: 수배지 실제 크기 축소와 결정적 불규칙 배치

**Files:**
- Modify: `components/game/U3Assets.test.ts`
- Modify: `app/u3-board.css`
- Modify: `app/u3-card-theme.css`
- Modify: `app/u3-large-screen.css`
- Modify: `app/u3-responsive-layout.css`

**Interfaces:**
- Consumes: `NoticeCard`가 제공하는 `u3-notice--0`부터 `u3-notice--4`까지의 안정적인 인덱스 클래스
- Produces: 15열×12행 보드 위의 동일한 4열×5행 카드 다섯 장, 카드별 고정 위치·회전, 축소된 notice 전용 내부 크기

- [ ] **Step 1: 실제 크기와 다섯 배치 계약을 검증하는 실패 테스트 작성**

`U3Assets.test.ts`에 다음 테스트를 추가한다.

```ts
it("수배지 다섯 장을 같은 작은 크기로 불규칙하게 배치한다", () => {
  const boardCss = readFileSync(join(process.cwd(), "app", "u3-board.css"), "utf8");
  const themeCss = readFileSync(join(process.cwd(), "app", "u3-card-theme.css"), "utf8");

  expect(boardCss).toContain("grid-template-columns: repeat(15, minmax(0, 1fr));");
  expect(boardCss).toContain("grid-template-rows: repeat(12, minmax(0, 1fr));");
  expect(boardCss).not.toContain("grid-template-columns: repeat(3, minmax(0, 1fr));");
  expect(boardCss).not.toMatch(/transform:\s*scale\(/);

  const placements = [
    [".u3-notice--0", "grid-column: 1 / span 4", "grid-row: 1 / span 5", "rotate(-2.1deg)"],
    [".u3-notice--1", "grid-column: 6 / span 4", "grid-row: 2 / span 5", "rotate(1.4deg)"],
    [".u3-notice--2", "grid-column: 11 / span 4", "grid-row: 1 / span 5", "rotate(-1.2deg)"],
    [".u3-notice--3", "grid-column: 3 / span 4", "grid-row: 7 / span 5", "rotate(2.2deg)"],
    [".u3-notice--4", "grid-column: 10 / span 4", "grid-row: 7 / span 5", "rotate(-1.8deg)"],
  ] as const;

  for (const fragments of placements) {
    for (const fragment of fragments) expect(boardCss).toContain(fragment);
  }

  expect(themeCss).not.toMatch(/\.u3-notice--[34]/);
});
```

같은 파일에 내부 콘텐츠가 notice 범위 안에서 줄어드는 계약을 추가한다.

```ts
it("작아진 수배지 안에서 제목·핀·별·장면·보상도 함께 줄인다", () => {
  const largeCss = readFileSync(join(process.cwd(), "app", "u3-large-screen.css"), "utf8");
  const responsiveCss = readFileSync(join(process.cwd(), "app", "u3-responsive-layout.css"), "utf8");

  expect(largeCss).toContain("minmax(5.8rem, 1fr)");
  expect(largeCss).toContain("clamp(1.5rem, 1.15cqw, 2.15rem)");
  expect(largeCss).toContain("clamp(10rem, 12cqw, 19rem)");
  expect(responsiveCss).toContain(".u3-notice .u3-reward__label");
  expect(responsiveCss).toContain(".u3-notice .u3-reward--compact");
  expect(responsiveCss).toContain(".u3-notice .u3-reward img");
  expect(responsiveCss).toContain("word-break: keep-all");
});
```

- [ ] **Step 2: 새 배치 테스트가 기존 균등 그리드 때문에 실패하는지 확인**

Run:

```bash
pnpm exec vitest run components/game/U3Assets.test.ts components/game/FixedCanvas.test.ts
```

Expected: FAIL. 기존 `repeat(3)`와 큰 내부 크기가 남아 있고 15열 배치 규칙이 없다고 출력한다. `FixedCanvas.test.ts`는 계속 PASS여야 한다.

- [ ] **Step 3: 15열×12행 동일 크기 배치 구현**

`u3-board.css`의 notices grid와 다섯 transform을 다음 계약으로 교체한다.

```css
.u3-guild-board__notices {
  display: grid;
  grid-template-columns: repeat(15, minmax(0, 1fr));
  grid-template-rows: repeat(12, minmax(0, 1fr));
  gap: 0;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: clamp(0.35rem, 0.45cqw, 0.7rem);
}

.u3-notice--0 {
  grid-column: 1 / span 4;
  grid-row: 1 / span 5;
  transform: translate(0.25rem, 0.35rem) rotate(-2.1deg);
}

.u3-notice--1 {
  grid-column: 6 / span 4;
  grid-row: 2 / span 5;
  transform: translate(-0.15rem, 0.1rem) rotate(1.4deg);
}

.u3-notice--2 {
  grid-column: 11 / span 4;
  grid-row: 1 / span 5;
  transform: translate(0.12rem, 0.45rem) rotate(-1.2deg);
}

.u3-notice--3 {
  grid-column: 3 / span 4;
  grid-row: 7 / span 5;
  transform: translate(0.45rem, -0.18rem) rotate(2.2deg);
}

.u3-notice--4 {
  grid-column: 10 / span 4;
  grid-row: 7 / span 5;
  transform: translate(-0.35rem, 0.18rem) rotate(-1.8deg);
}
```

`u3-card-theme.css`의 `.u3-notice--3`, `.u3-notice--4` override를 삭제한다. `u3-large-screen.css`의 `.u3-guild-board__notices`에서는 15개 track마다 간격이 생기지 않도록 `gap` override를 제거하고 padding만 유지한다.

- [ ] **Step 4: 수배지 내부 콘텐츠를 notice 범위에서 함께 축소**

`u3-large-screen.css`의 수배지 전용 값을 다음처럼 조정한다. 우측 계약 패널 선택자는 변경하지 않는다.

```css
.u3-notice {
  grid-template-rows: auto auto minmax(5.8rem, 1fr) auto auto auto;
  padding: clamp(0.62rem, 0.64cqw, 1rem) clamp(0.58rem, 0.62cqw, 0.98rem) clamp(0.55rem, 0.56cqw, 0.88rem);
  background-size: 100% 100%, clamp(7.2rem, 8cqw, 14.4rem) auto;
}

.u3-notice__pin {
  top: -0.5rem;
  width: clamp(1.5rem, 1.15cqw, 2.15rem);
  height: auto;
}

.u3-notice__heading strong {
  font-size: clamp(0.92rem, 0.9cqw, 1.35rem);
}

.u3-notice__heading small,
.u3-notice__label {
  font-size: clamp(0.62rem, 0.56cqw, 0.84rem);
}

.u3-risk-stars img {
  width: clamp(0.84rem, 0.76cqw, 1.25rem);
  height: clamp(0.84rem, 0.76cqw, 1.25rem);
}

.u3-notice .u3-theme-scene {
  width: min(100%, clamp(10rem, 12cqw, 19rem));
}

.u3-notice .u3-reward,
.u3-notice__state {
  font-size: clamp(0.72rem, 0.62cqw, 0.96rem);
}
```

`u3-responsive-layout.css`의 뒤쪽 override도 같은 축소 방향으로 맞춘다. 보상 선택자를 `.u3-notice` 아래로 제한해 우측 계약 보상은 줄이지 않는다.

```css
.u3-notice__heading strong {
  overflow: visible;
  font-size: clamp(0.82rem, calc(0.67rem + 0.2cqw + 0.13cqh), 1.24rem);
  line-height: 1.12;
  text-overflow: clip;
  white-space: normal;
  overflow-wrap: normal;
  word-break: keep-all;
}

.u3-notice__heading small,
.u3-notice__label {
  font-size: clamp(0.62rem, calc(0.5rem + 0.14cqw + 0.1cqh), 0.84rem);
}

.u3-notice .u3-reward,
.u3-notice__state {
  font-size: clamp(0.68rem, calc(0.55rem + 0.18cqw + 0.11cqh), 0.94rem);
}

.u3-risk-stars img {
  width: clamp(0.8rem, calc(0.62rem + 0.17cqw + 0.06cqh), 1.25rem);
  height: clamp(0.8rem, calc(0.62rem + 0.17cqw + 0.06cqh), 1.25rem);
}

.u3-notice .u3-reward__label {
  font-size: clamp(0.62rem, calc(0.5rem + 0.14cqw + 0.1cqh), 0.84rem);
}

.u3-notice .u3-reward--compact {
  font-size: clamp(0.68rem, calc(0.55rem + 0.18cqw + 0.11cqh), 0.94rem);
}

.u3-notice .u3-reward img {
  width: clamp(0.84rem, calc(0.65rem + 0.16cqw + 0.06cqh), 1.25rem);
  height: clamp(0.84rem, calc(0.65rem + 0.16cqw + 0.06cqh), 1.25rem);
}
```

기존 `.u3-board-screen .u3-reward__label`, `.u3-board-screen .u3-reward--compact`, `.u3-board-screen .u3-reward img` 규칙은 위 notice 전용 규칙으로 교체한다. 파일 끝의 중복 notice 글자 크기 override도 제거해 새 값이 다시 커지지 않게 한다.

- [ ] **Step 5: 배치·고정 캔버스·기존 화면 계약 테스트 통과 확인**

Run:

```bash
pnpm exec vitest run components/game/U3Assets.test.ts components/game/FixedCanvas.test.ts components/game/U3BoardScreen.test.ts components/game/campaign-render.test.tsx
```

Expected: PASS. 15열 배치와 축소 계약, 미디어 쿼리·viewport 단위 금지, 공고 선택·계약 렌더링이 모두 통과한다.

- [ ] **Step 6: 한글 커밋 작성**

```bash
git add components/game/U3Assets.test.ts app/u3-board.css app/u3-card-theme.css app/u3-large-screen.css app/u3-responsive-layout.css
git commit -m "화면: 수배지를 작고 불규칙하게 배치한다" -m "동일 크기 수배지 다섯 장을 고정된 비대칭 위치에 두고 제목과 핀, 별, 장면, 보상을 함께 축소한다."
```

### Task 4: 전체 회귀와 실제 캠페인 화면 검증

**Files:**
- Verify: `app/campaign/page.tsx`
- Verify: `components/game/CampaignScreen.tsx`
- Verify: Tasks 1~3의 모든 변경 파일
- Create outside repository: `/private/tmp/u3-board-notice-ux-1920.png`
- Create outside repository: `/private/tmp/u3-board-notice-ux-1024.png`

**Interfaces:**
- Consumes: Tasks 1~3의 콘텐츠·마크업·스타일 결과
- Produces: 사용자 확인용 `/campaign` 로컬 서버와 두 viewport의 검증 스크린샷. 저장소 파일은 추가하지 않는다.

- [ ] **Step 1: 관련 테스트와 전체 정적 검증 실행**

Run:

```bash
pnpm exec vitest run lib/content/campaign-dungeons.test.ts components/game/U3BoardScreen.test.ts components/game/U3Assets.test.ts components/game/FixedCanvas.test.ts components/game/campaign-render.test.tsx
pnpm typecheck
pnpm lint
```

Expected: 관련 테스트와 typecheck는 0 exit. lint는 새 오류가 없어야 하며 기존 warning이 있으면 개수와 파일을 기록한다.

- [ ] **Step 2: 전체 테스트 실행**

Run:

```bash
pnpm test
```

Expected: 전체 Vitest suite가 0 exit로 통과한다.

- [ ] **Step 3: 별도 포트로 실제 앱 실행**

기존 인트로 확인 서버와 충돌하지 않도록 작업 트리에서 3001 포트를 사용한다.

```bash
pnpm exec next dev -p 3001
```

Expected: `http://localhost:3001`이 준비되고 Next 오류 없이 `/campaign`을 제공한다. 서버는 검증이 끝날 때까지 유지한다.

- [ ] **Step 4: 1920×1080 실제 캠페인 흐름 검증**

`vercel:agent-browser-verify` 또는 `vercel:agent-browser`로 `http://localhost:3001/campaign`을 열고 인트로 CTA를 눌러 게시판으로 이동한다.

확인 항목:

- 수배지 다섯 장의 크기가 모두 같고 기존보다 작아 게시판의 나뭇결 빈 공간이 보인다.
- 카드 위치·회전 차이가 뚜렷하지만 서로 겹치거나 판 밖으로 나가지 않는다.
- 현재 보이는 보스 전설형 던전 이름이 두 줄 이내에서 생략 없이 읽힌다.
- 각 공고를 선택하면 선택 외곽선, 우측 이름·위험도·보상·계약 조건이 갱신된다.
- 우측 계약 카드 뒤에는 테마 장면이 없고 어두운 공통 배경만 보인다.
- 공고 안의 작은 테마 장면은 유지된다.
- 페이지 스크롤, 오류 오버레이, 브라우저 콘솔 오류가 없다.

스크린샷을 `/private/tmp/u3-board-notice-ux-1920.png`에 저장한다.

- [ ] **Step 5: 1024×640 축척 검증**

같은 `/campaign` 게시판을 1024×640 viewport에서 확인한다.

확인 항목:

- 고정 캔버스 전체가 비례 축소되고 카드끼리 겹치거나 잘리지 않는다.
- 이름·보상·상태가 카드 경계 안에 남는다.
- 마우스 클릭과 키보드 Tab focus가 DOM 순서대로 다섯 공고를 이동한다.
- 가로·세로 스크롤과 콘솔 오류가 없다.

스크린샷을 `/private/tmp/u3-board-notice-ux-1024.png`에 저장한다.

- [ ] **Step 6: 시각 검증에서 조정이 필요하면 같은 테스트 순환 반복**

겹침·잘림 또는 가독성 문제가 있으면 Task 3의 허용 범위 안에서 grid 위치, `clamp()` 값, 오프셋, 회전만 최소 조정한다. 조정 전 실패하는 CSS 계약 테스트를 새 기대값으로 먼저 갱신하고 관련 테스트·typecheck·lint·두 viewport 검증을 다시 실행한다. 범위를 벗어나는 변경은 구현하지 않고 사용자에게 알린다.

- [ ] **Step 7: 검증 결과와 작업 트리 상태 기록**

Run:

```bash
git status --short
git log --oneline -4
```

Expected: 계획된 파일 외 변경이 없고 Tasks 1~3의 한글 커밋 세 개가 보인다. 자동 생성 파일이나 사용자 소유 미추적 파일은 커밋하지 않는다.

- [ ] **Step 8: 사용자에게 화면 제시 후 승인 대기**

두 스크린샷과 로컬 URL `http://localhost:3001/campaign`을 사용자에게 제공한다. 이 단계에서는 merge, push, PR을 수행하지 않는다. 사용자가 시각 결과를 승인하면 별도 요청에 따라 `superpowers:finishing-a-development-branch`로 통합 방식을 결정한다.
