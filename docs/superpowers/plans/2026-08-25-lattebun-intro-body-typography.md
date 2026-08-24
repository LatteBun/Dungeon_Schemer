# 인트로 본문 글자 크기 개선 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실제 `/campaign` 인트로에서 공용 상단 상태 바를 제외한 본문 텍스트 여섯 종류를 약 15% 확대한다.

**Architecture:** 기존 `IntroScreen` 마크업과 인트로 전용 `clamp()` 기반 반응형 체계를 유지한다. `app/u2-intro.css`의 여섯 값만 변경하고 `IntroScreen.test.ts`가 정확한 크기와 공용 상태 바 비침범을 계약으로 고정하며, 통합 캠페인 화면에서 시각 회귀를 확인한다.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript, CSS, Vitest

**Spec:** `docs/superpowers/specs/2026-08-25-lattebun-intro-body-typography-design.md`

## Global Constraints

- 확대 대상은 눈썹 문구, 메인 제목, 소개문, 카드 제목, 카드 본문, CTA 문구다.
- `app/globals.css`의 공용 상단 상태 바 토큰과 다른 캠페인 화면은 수정하지 않는다.
- 문구, DOM 구조, 아이콘, 배경, 카드와 CTA의 기본 크기는 유지한다.
- 1920×1080 고정 캔버스에서 제목 한 줄과 소개문 의미 단위 두 줄을 유지한다.
- 구현 전 `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`와 `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`를 읽고 현재 Next.js 16.3 규약을 따른다.
- 기존 미추적 `.pnpm-store/`와 `public/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/` 파일은 수정하거나 커밋하지 않는다.

---

## 파일 책임 지도

- `components/game/IntroScreen.test.ts`: 인트로 본문의 정확한 여섯 글자 크기와 공용 상태 바 비침범 계약을 검증한다.
- `app/u2-intro.css`: 인트로 전용 타이포그래피 값만 소유한다.
- `components/game/IntroScreen.tsx`: 기존 문구와 DOM 구조를 제공하며 이번 작업에서는 수정하지 않는다.
- `app/globals.css`: 공용 상단 상태 바 토큰을 소유하며 이번 작업에서는 수정하지 않는다.

### Task 1: 인트로 본문 타이포그래피 확대

**Files:**
- Modify: `components/game/IntroScreen.test.ts:74`
- Modify: `app/u2-intro.css:67-253`

**Interfaces:**
- Consumes: `IntroScreen`의 기존 `.u2-intro__*` class와 `app/globals.css`의 공용 `--status-*` 토큰 경계
- Produces: 여섯 개의 확정된 `clamp()` 값과 이를 보호하는 Vitest CSS 계약

- [ ] **Step 1: Next.js의 현재 CSS·Vitest 공식 문서를 읽는다**

Run:

```bash
sed -n '1,260p' node_modules/next/dist/docs/01-app/01-getting-started/11-css.md
sed -n '1,260p' node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md
```

Expected: 전역 CSS import와 Vitest 실행 방식에서 이번 변경을 막는 새 제약이나 폐기 안내가 없다.

- [ ] **Step 2: 확대값을 고정하는 실패 테스트를 작성한다**

`components/game/IntroScreen.test.ts`의 마지막 레이아웃 테스트 앞에 다음 테스트를 추가한다.

```ts
it("공용 상태 바를 건드리지 않고 인트로 본문 글자를 확대한다", () => {
  const css = readFileSync(join(process.cwd(), "app", "u2-intro.css"), "utf8");

  expect(css).toMatch(/\.u2-intro__eyebrow\s*\{[^}]*font-size:\s*clamp\(0\.86rem, 1\.15cqw, 1\.06rem\)/);
  expect(css).toMatch(/\.u2-intro__copy h1\s*\{[^}]*font-size:\s*clamp\(2\.18rem, 3\.45cqw, 3\.55rem\)/);
  expect(css).toMatch(/\.u2-intro__lead\s*\{[^}]*font-size:\s*clamp\(0\.9rem, 1\.29cqw, 1\.1rem\)/);
  expect(css).toMatch(/\.u2-intro__card h2\s*\{[^}]*font-size:\s*clamp\(1\.2rem, 1\.67cqw, 1\.55rem\)/);
  expect(css).toMatch(/\.u2-intro__card p\s*\{[^}]*font-size:\s*clamp\(0\.81rem, 1\.09cqw, 0\.97rem\)/);
  expect(css).toMatch(/\.u2-intro__cta\s*\{[^}]*--cta-text-size:\s*clamp\(1\.36rem, 2\.3cqw, 1\.9rem\)/);
  expect(css).not.toMatch(/--status-(?:bar|label|value)/);
});
```

- [ ] **Step 3: 테스트가 기존 작은 값 때문에 실패하는지 확인한다**

Run:

```bash
pnpm test components/game/IntroScreen.test.ts
```

Expected: 새 테스트의 첫 번째 확대값 assertion이 실패하고 기존 테스트는 통과한다.

- [ ] **Step 4: 여섯 타이포그래피 값을 최소 변경한다**

`app/u2-intro.css`에서 다음 선언만 교체한다.

```css
.u2-intro__eyebrow {
  font-size: clamp(0.86rem, 1.15cqw, 1.06rem);
}

.u2-intro__copy h1 {
  font-size: clamp(2.18rem, 3.45cqw, 3.55rem);
}

.u2-intro__lead {
  font-size: clamp(0.9rem, 1.29cqw, 1.1rem);
}

.u2-intro__card h2 {
  font-size: clamp(1.2rem, 1.67cqw, 1.55rem);
}

.u2-intro__card p {
  font-size: clamp(0.81rem, 1.09cqw, 0.97rem);
}

.u2-intro__cta {
  --cta-text-size: clamp(1.36rem, 2.3cqw, 1.9rem);
}
```

각 블록의 나머지 선언은 그대로 둔다.

- [ ] **Step 5: 관련 자동 테스트를 통과시킨다**

Run:

```bash
pnpm test components/game/IntroScreen.test.ts components/game/campaign-render.test.tsx
```

Expected: 두 테스트 파일이 모두 PASS하며 `IntroScreen` 문구와 캠페인 `intro` 렌더 계약이 유지된다.

- [ ] **Step 6: 정적 품질 검사를 통과시킨다**

Run:

```bash
pnpm typecheck
pnpm lint
```

Expected: 두 명령 모두 exit code 0이며 새 타입 오류와 lint 오류가 없다.

- [ ] **Step 7: 실제 캠페인 인트로를 브라우저에서 검증한다**

Run:

```bash
pnpm dev
```

브라우저 검증 대상은 `http://localhost:3000/campaign`이다. 1920×1080 viewport에서 다음을 확인하고 사용자 확인용 스크린샷을 남긴다.

- 눈썹 문구, 메인 제목, 소개문, 카드 제목·본문, CTA가 확대됐다.
- 공용 상단 상태 바는 기존 크기를 유지한다.
- 제목은 한 줄, 소개문은 의미 단위 두 줄을 유지한다.
- 카드 본문과 CTA 문구가 잘리거나 겹치지 않는다.
- 문서와 body에 가로·세로 스크롤이 없다.
- 브라우저 console error와 Next 오류 overlay가 없다.

Expected: 여섯 조건이 모두 충족되며 추가 레이아웃 조정이 필요하지 않다. 잘림이나 겹침이 있으면 사용자 승인 범위 안에서 해당 인트로 전용 간격만 조정하고 Step 5~7을 다시 실행한다.

- [ ] **Step 8: 변경 범위와 diff를 확인한다**

Run:

```bash
git diff --check
git diff -- components/game/IntroScreen.test.ts app/u2-intro.css
git status --short
```

Expected: 구현 변경은 `IntroScreen.test.ts`와 `u2-intro.css`뿐이며 기존 미추적 파일은 그대로 남는다.

- [ ] **Step 9: 구현을 한글 제목과 본문으로 커밋한다**

```bash
git add components/game/IntroScreen.test.ts app/u2-intro.css
git commit -m "수정: 인트로 본문 글자를 키운다" -m "상단 상태 바는 유지하고 제목과 소개문, 안내 카드, 게시판 CTA의 글자 크기를 약 15퍼센트 확대한다."
```

- [ ] **Step 10: 사용자에게 실제 캠페인 화면 확인을 요청한다**

사용자에게 `/campaign` 검증 결과와 스크린샷을 전달하고, 글자 크기를 더 키우거나 줄일지 확인받는다. 추가 조정 요청은 같은 여섯 `clamp()` 값 범위에서 처리하고 자동·브라우저 검증을 반복한다.
