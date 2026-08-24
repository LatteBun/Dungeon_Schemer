# U6 정산 복귀 CTA 크기 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 던전 결과 정산 화면의 `길드로 돌아간다` CTA를 공통 다음 단계 버튼과 같은 크기 체계의 내용 폭 버튼으로 줄이고 우측 하단에 유지한다.

**Architecture:** React 구조와 공통 CTA 선언은 바꾸지 않는다. `app/u6-result.css`의 정산 화면 전용 배치 규칙만 `stretch`에서 `end`로 바꾸며, `components/game/U6FixedCanvas.test.ts`가 그 화면별 CSS 계약을 고정한다.

**Tech Stack:** Next.js 16.3.0 App Router, React 19.2.8, TypeScript 5.9, CSS Grid, Vitest 4.1.10, Playwright 1.62.1

**Spec:** `docs/superpowers/specs/2026-08-25-lattebun-u6-settlement-continue-size-design.md`

## Global Constraints

- 문구는 `길드로 돌아간다`를 유지한다.
- 버튼은 정산 우측 패널 최하단의 우측 정렬을 유지한다.
- 폭은 고정 px 또는 패널 전체 폭이 아니라 문구와 공통 좌우 padding으로 정한다.
- 공통 최소 높이, 글자 크기, 테두리, 배경, hover, `focus-visible`을 바꾸지 않는다.
- callback, 캠페인 전환, 도메인 모델, 정산 계산, 이미지 에셋을 바꾸지 않는다.
- 캔버스 내부에는 `vw`, `vh`, 화면별 미디어 쿼리를 추가하지 않는다.
- 구현 전에 `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`를 끝까지 읽고 현재 Next.js 16의 전역 CSS 규칙을 확인한다.

---

## Execution Preflight: 최신 main 통합

계획 작성 중 `origin/main`에 새 변경이 병합되었으므로 구현을 시작하기 전에 최신
기준을 먼저 통합한다.

Run:

```bash
git fetch origin main
git merge origin/main -m "병합: 최신 main 변경을 반영한다" -m "정산 복귀 CTA 설계와 계획을 유지하면서 선행 변경을 통합한다."
pnpm test
```

Expected: 최신 main과 설계·계획 문서가 함께 남고 전체 단위 테스트가 PASS한다.
`docs/README.md`가 충돌하면 main의 모든 최신 색인과 U6 CTA 설계·계획 링크를
함께 보존한다. `docs/experience/SCREEN_LAYOUT.md`가 충돌하면 정산 CTA의 내용 폭
우측 정렬 문단과 main의 최신 화면 규칙을 함께 보존한다.

---

### Task 1: 정산 CTA의 내용 폭·우측 정렬 계약

**Files:**
- Modify: `components/game/U6FixedCanvas.test.ts`
- Modify: `app/u6-result.css:156`

**Interfaces:**
- Consumes: `app/globals.css`의 `.u6-settlement-continue` 공통 최소 높이, padding, 글자 크기와 상태 스타일
- Produces: `.u6-settlement-side .u6-settlement-continue { grid-row: 3; justify-self: end; text-align: center; }`

- [ ] **Step 1: 현재 Next.js CSS 공식 문서를 읽는다**

Run:

```bash
sed -n '1,260p' node_modules/next/dist/docs/01-app/01-getting-started/11-css.md
```

Expected: 전역 CSS를 root layout에서 가져오는 현재 프로젝트 구성이 지원되는지 확인한다. 이번 변경은 import 구조가 아니라 기존 전역 스타일시트의 선택자 하나만 수정한다.

- [ ] **Step 2: 실패하는 CSS 계약 테스트를 작성한다**

`components/game/U6FixedCanvas.test.ts`의 `U6 고정 캔버스 계약` describe 안에 다음 테스트를 추가한다.

```ts
it("정산 복귀 버튼은 내용 폭으로 우측 정렬한다", () => {
  const rule = css.match(
    /\.u6-settlement-side \.u6-settlement-continue\s*\{([^}]*)\}/,
  )?.[1] ?? "";

  expect(rule).toMatch(/justify-self:\s*end/);
  expect(rule).not.toMatch(/justify-self:\s*stretch/);
  expect(rule).not.toMatch(/width:\s*100%/);
});
```

이 테스트를 깨뜨릴 생산 변경은 정산 화면 전용 규칙을 `justify-self: stretch`로 되돌리는 것이다. 공통 CTA의 높이와 padding은 별도 선언을 추가하지 않음으로써 그대로 물려받는다.

- [ ] **Step 3: 테스트가 올바른 이유로 실패하는지 확인한다**

Run:

```bash
pnpm vitest run components/game/U6FixedCanvas.test.ts
```

Expected: 새 테스트만 FAIL하며, `.u6-settlement-side .u6-settlement-continue`에 `justify-self: end`가 없다는 메시지가 나온다.

- [ ] **Step 4: 최소 CSS 변경으로 내용 폭과 우측 정렬을 적용한다**

`app/u6-result.css`의 정산 전용 규칙을 다음과 같이 바꾼다.

```css
.u6-settlement-side .u6-settlement-continue {
  grid-row: 3;
  justify-self: end;
  text-align: center;
}
```

`width`, `min-height`, `padding`, `font-size`는 이 선택자에 추가하지 않는다. 해당 값은 `app/globals.css`의 공통 CTA 규칙이 계속 소유한다.

- [ ] **Step 5: 대상 테스트가 통과하는지 확인한다**

Run:

```bash
pnpm vitest run components/game/U6FixedCanvas.test.ts
```

Expected: `U6FixedCanvas.test.ts`의 모든 테스트 PASS.

- [ ] **Step 6: 구현 변경을 커밋한다**

```bash
git add components/game/U6FixedCanvas.test.ts app/u6-result.css
git commit -m "화면: 정산 복귀 버튼 폭을 줄인다" -m "공통 CTA 크기를 유지하면서 길드 복귀 버튼을 내용 폭으로 우측 정렬한다."
```

---

### Task 2: 전체 회귀와 실제 정산 화면 검증

**Files:**
- Verify: `app/u6-result.css`
- Verify: `components/game/U6FixedCanvas.test.ts`
- Verify: `docs/experience/SCREEN_LAYOUT.md`

**Interfaces:**
- Consumes: Task 1의 내용 폭 우측 정렬 CSS 계약
- Produces: 자동 검사와 실제 브라우저에서 확인된 U6 정산 CTA 배치

- [ ] **Step 1: 전체 자동 검사를 실행한다**

Run:

```bash
pnpm test
pnpm lint
pnpm typecheck
git diff --check origin/main...HEAD
```

Expected: 모든 단위 테스트 PASS, lint 오류 0개, typecheck 성공, diff 공백 오류 없음. 기존 lint 경고는 별도로 기록하되 이번 변경 범위에서 수정하지 않는다.

- [ ] **Step 2: 개발 서버를 실행한다**

Run:

```bash
pnpm dev
```

Expected: Next.js 개발 서버가 로컬 주소를 출력하고 `/u6-test`를 제공한다.

- [ ] **Step 3: 프리뷰 정산 화면을 브라우저에서 확인한다**

Open: `http://localhost:3000/u6-test`

Verify:

- `길드로 돌아간다` 버튼이 우측 패널 전체 폭을 차지하지 않는다.
- 버튼이 우측 패널의 최하단·우측에 놓인다.
- 문구가 한 줄로 온전히 보이고 테두리와 포커스 표시가 잘리지 않는다.
- 우측의 캠페인 변화와 다녀온 사람 영역을 가리거나 겹치지 않는다.
- 브라우저 콘솔 오류와 Next.js 오류 오버레이가 없다.

- [ ] **Step 4: 실제 캠페인 정산 경로를 확인한다**

Open: `http://localhost:3000/campaign`

플레이 가능한 캠페인을 정산까지 진행한 뒤, 프리뷰와 같은 내용 폭·우측 하단 배치인지 확인한다. `길드로 돌아간다`를 눌렀을 때 게시판 흐름으로 돌아가는 기존 동작도 확인한다.

- [ ] **Step 5: 브랜치 상태와 커밋 범위를 확인한다**

Run:

```bash
git status --short --branch
git log --oneline origin/main..HEAD
```

Expected: 의도하지 않은 파일이 없고, 설계·계획·구현 커밋만 브랜치에 존재한다.
