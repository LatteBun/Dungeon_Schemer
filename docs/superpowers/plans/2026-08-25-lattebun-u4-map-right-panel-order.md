# U4 지도 우측 패널 순서 개선 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** U4 지도 우측 패널을 `파티 상태 → 계약 전 답사 → 선택한 지점 → 이 지점으로 이동` 순서로 바꾸고 이동 CTA를 패널 최하단에 유지한다.

**Architecture:** `RightPanel`의 DOM section 순서를 실제 읽기 순서대로 바꾸고, CSS Grid의 가운데 행만 남는 높이를 받게 한다. 파티·답사·선택 지점에 명시적인 행을 부여해 답사 데이터가 없는 프리뷰에서도 선택 지점과 CTA가 마지막 행에 남도록 한다.

**Tech Stack:** Next.js 16.3.0 App Router, React 19.2.8, TypeScript 5, CSS Grid, Vitest 4.1.10

**Spec:** `docs/superpowers/specs/2026-08-25-lattebun-u4-map-right-panel-order-design.md`

- 작성자: LatteBun
- 작성 도구: Codex

## Global Constraints

- 우측 패널의 DOM과 시각 순서는 `파티 상태 → 계약 전 답사 → 선택한 지점 → 이 지점으로 이동`이어야 한다.
- `계약 전 답사`만 중앙의 가변 높이를 받고, 내용이 넘치면 기존처럼 그 영역 안에서 세로 스크롤한다.
- `survey`가 없어도 선택 지점과 CTA는 우측 패널의 마지막 행에 남아야 한다.
- 선택·이동 callback, 답사 데이터, 파티 데이터, 문구, 이미지 에셋, 도메인과 Store는 변경하지 않는다.
- 1920×1080 고정 캔버스, `rem`·`cqw`·`cqh` 단위, 미디어 쿼리 금지 규칙을 유지한다.
- Next.js 공식 문서 `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`, `05-server-and-client-components.md`, `02-guides/testing/vitest.md`를 확인한 현재 전역 CSS·Client Component·Vitest 구조를 유지한다.

---

### Task 1: 우측 패널 읽기 순서와 최하단 CTA를 고정한다

**Files:**

- Modify: `components/game/U4DungeonMapScreen.test.tsx:104-189`
- Modify: `components/game/U4FixedCanvas.test.ts:120-149`
- Modify: `components/game/U4DungeonMapScreen.tsx:460-570`
- Modify: `app/u4-dungeon-map.css:365-388,590-594`
- Verify: `app/u4-dungeon-map-fixes.css:77-86`

**Interfaces:**

- Consumes: `U4DungeonMapScreenProps.survey?: U4SurveyView`, 기존 `destination` 파생값, `MoveButton`의 `disabled`와 `onClick` 계약
- Produces: DOM 제목 순서 `계약 전 답사 < 선택한 지점 < 이 지점으로 이동`, CSS 행 계약 `.u4-party = 1`, `.u4-survey = 2`, `.u4-destination = 3`

- [ ] **Step 1: 컴포넌트의 DOM 읽기 순서를 고정하는 실패 테스트를 작성한다**

`components/game/U4DungeonMapScreen.test.tsx`에 공통 답사 fixture를 추가하고 기존 `render()` 호출에 전달한다.

```tsx
const survey = {
  visited: 2,
  total: 12,
  disclosedRules: [
    "거미는 불을 피한다",
    "동굴거미는 발소리와 진동에 민감하게 반응한다",
    "그림자거미는 빛이 없는 곳에서만 모습을 드러낸다",
  ],
} as const;
```

`createElement(U4DungeonMapScreen, { ... })`의 props에 `survey`를 추가하고 다음 테스트를 `U4DungeonMapScreen` describe에 넣는다.

```tsx
it("orders the survey before the selected destination and keeps the move CTA last", () => {
  const html = render(MONSTER);
  const surveyIndex = html.indexOf("계약 전 답사");
  const destinationIndex = html.indexOf("선택한 지점");
  const moveIndex = html.indexOf("이 지점으로 이동");

  expect(surveyIndex).toBeGreaterThan(-1);
  expect(surveyIndex).toBeLessThan(destinationIndex);
  expect(destinationIndex).toBeLessThan(moveIndex);
});
```

- [ ] **Step 2: 컴포넌트 테스트가 기존 역순 DOM을 잡아 실패하는지 확인한다**

Run:

```bash
pnpm vitest run components/game/U4DungeonMapScreen.test.tsx
```

Expected: 새 테스트가 `surveyIndex`가 `destinationIndex`보다 작지 않아 FAIL한다. 기존 테스트는 통과한다.

- [ ] **Step 3: 고정 캔버스 CSS 행 계약의 실패 테스트를 작성한다**

`components/game/U4FixedCanvas.test.ts`의 우측 패널 테스트 이름을 `keeps the survey flexible and the destination in the last row`로 바꾸고 본문을 다음 계약으로 교체한다.

```ts
const base = readFileSync("app/u4-dungeon-map.css", "utf8");
const rightPanel = base.match(/\.u4-right-panel\s*\{([^}]*)\}/)?.[1] ?? "";
const party = base.match(/\.u4-party\s*\{([^}]*)\}/)?.[1] ?? "";
const survey = base.match(/\.u4-survey\s*\{([^}]*)\}/)?.[1] ?? "";
const destination = base.match(/\.u4-destination\s*\{([^}]*)\}/)?.[1] ?? "";

expect(rightPanel).toMatch(
  /grid-template-rows:\s*auto minmax\(0, 1fr\) auto/,
);
expect(party).toMatch(/grid-row:\s*1/);
expect(survey).toMatch(/grid-row:\s*2/);
expect(destination).toMatch(/grid-row:\s*3/);
expect(survey).toMatch(/min-height:\s*0/);
expect(survey).toMatch(/overflow-y:\s*auto/);

const fixes = readFileSync("app/u4-dungeon-map-fixes.css", "utf8");
const override = fixes.match(/\.u4-right-panel\s*\{([^}]*)\}/)?.[1] ?? "";
expect(override).not.toMatch(/grid-template-rows/);
```

- [ ] **Step 4: CSS 계약 테스트도 기존 행 구성을 잡아 실패하는지 확인한다**

Run:

```bash
pnpm vitest run components/game/U4FixedCanvas.test.ts
```

Expected: `grid-template-rows`가 기존 `auto auto minmax(0, 1fr)`이고 명시적 `grid-row`가 없어 FAIL한다.

- [ ] **Step 5: 답사 section을 목적지 section 앞으로 옮긴다**

`components/game/U4DungeonMapScreen.tsx`에서 현재 542-569행의 `survey === undefined ? null : (...)` 블록과 그 설명 주석을 480행의 목적지 section 바로 앞으로 이동한다. 블록 내부 문구·조건·목록·진행 수치는 바꾸지 않는다. 최종 직계 자식 순서는 다음 세 section이다.

```text
.u4-party
.u4-survey (survey가 있을 때)
.u4-destination (내부 마지막 자식은 MoveButton)
```

- [ ] **Step 6: 가운데 답사만 늘어나고 목적지가 마지막 행에 남도록 CSS를 최소 변경한다**

`app/u4-dungeon-map.css`의 관련 규칙을 다음 값으로 맞춘다.

```css
.u4-right-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: clamp(0.55rem, 0.8cqh, 0.7rem);
  height: 100%;
  min-height: 0;
}

.u4-party {
  display: grid;
  grid-row: 1;
  grid-template-rows: auto auto;
  min-height: 0;
}

.u4-destination {
  position: relative;
  display: grid;
  grid-row: 3;
  grid-template-rows: auto auto auto;
}

.u4-survey {
  grid-row: 2;
  min-height: 0;
  overflow-y: auto;
}
```

우측 패널 주석은 `파티 · 답사 · 목적지` 순서와 중앙 답사의 가변 높이 책임을 설명하도록 고친다. `app/u4-dungeon-map-fixes.css`의 우측 패널 override는 행 구성을 추가하지 않고 gap만 유지한다.

- [ ] **Step 7: 대상 테스트가 통과하는지 확인한다**

Run:

```bash
pnpm vitest run components/game/U4DungeonMapScreen.test.tsx components/game/U4FixedCanvas.test.ts
```

Expected: 두 파일의 모든 테스트가 PASS한다.

- [ ] **Step 8: 정적 검증을 실행한다**

Run:

```bash
pnpm test
pnpm lint
pnpm typecheck
git diff --check
```

Expected: 전체 Vitest suite, ESLint, TypeScript가 exit 0이고 `git diff --check` 출력이 없다.

- [ ] **Step 9: 실제 캠페인 지도 화면을 검증한다**

Run:

```bash
pnpm dev
```

브라우저에서 `/play`의 인트로와 게시판을 거쳐 실제 원정 지도에 진입하고 다음을 확인한다.

- 우측 패널이 `파티 상태 → 계약 전 답사 → 선택한 지점 → 이 지점으로 이동` 순서다.
- 이동 가능한 지점을 선택하기 전 CTA는 비활성이고, 선택 후 활성이다.
- 답사 규칙 1개와 3개인 상태 모두에서 CTA가 우측 패널 최하단에 있다.
- 1920×1080, 2560×1440, 1440×900, 1280×1024 viewport에서 패널 겹침·잘림·페이지 스크롤이 없다.
- 브라우저 콘솔 오류가 없다.

- [ ] **Step 10: 구현 변경을 한글 제목과 본문으로 커밋한다**

```bash
git add components/game/U4DungeonMapScreen.test.tsx components/game/U4FixedCanvas.test.ts components/game/U4DungeonMapScreen.tsx app/u4-dungeon-map.css
git commit -m "화면: 지도 이동 버튼을 최하단에 둔다" -m "계약 전 답사를 선택 지점 위로 옮기고 가운데 답사 영역만 남는 높이를 사용하도록 우측 패널 행을 고정한다. DOM 순서와 CSS 행 계약을 회귀 테스트로 보호한다."
```
