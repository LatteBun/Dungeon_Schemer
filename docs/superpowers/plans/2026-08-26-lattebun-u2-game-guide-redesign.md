# U2 게임 가이드 재설계 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** U2 인트로를 도움과 배신의 전략, 승급 경로, 원정 목표, 조기 종료 위험을 한 화면에 설명하는 전체 폭 게임 가이드로 바꾼다.

**Architecture:** `IntroScreen`은 기존처럼 공용 `TopStatusBar`와 CTA 링크/버튼 계약만 소비하고, U2 고유의 정적 정보 구조를 같은 파일의 작은 표현 컴포넌트로 렌더링한다. 규칙·Store·상태 adapter는 변경하지 않으며 실제 캠페인은 기존 `statusFor()`가 만든 `TopStatusView`를 계속 사용한다. CSS는 1920×1080 고정 캔버스 안의 U2 전용 grid만 다시 배치하고, 공용 상태 바 토큰과 게시판 이후의 60:40 셸은 건드리지 않는다.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript, CSS, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-08-26-lattebun-u2-game-guide-redesign-design.md`

## Global Constraints

- U2는 1920×1080 고정 캔버스 안에서 스크롤 없이 완결되며, 창 크기마다 재배치하지 않고 균일 축척한다.
- U2만 상단 상태 바 아래 전체 폭을 쓰는 예외다. U3~U6의 60:40 `GameShell` 구조는 바꾸지 않는다.
- 공용 `TopStatusBar`, `TopStatusView`, `campaign-adapters.ts`의 `statusFor()`, Store, domain 타입, 규칙·밸런스는 수정하지 않는다.
- 도움/배신 카드는 비상호작용 전략 가이드다. 실제 던전 조언의 `help / harm / neutral`, 정답 색, 정합·모순 관계는 선택 전후 노출하지 않는다.
- 본문에서 정확한 엔딩 식·임계값을 반복하지 않는다. 상태 바의 기존 `의심 인원 0 / 5`, 남은 용사 수, 정보 팝오버는 유지한다.
- 기존 `/assets/u2/intro-background-full.png`, 상태 아이콘, CTA 인장과 화살표를 재사용하며 새 배경 이미지를 만들지 않는다.
- `길드 게시판으로`는 프리뷰에서는 링크, 실제 `/campaign`에서는 `OPEN_BOARD`를 dispatch하는 버튼이라는 기존 계약을 유지한다.
- 구현 전에 `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`와 `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`를 읽는다.
- 기존 미추적 `.pnpm-store/`와 `public/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/`은 수정하거나 커밋하지 않는다.

---

## 파일 책임 지도

- `components/game/IntroScreen.tsx`: U2 본문 구조와 CTA의 링크/버튼 이중 계약을 소유한다.
- `components/game/IntroScreen.test.ts`: 본문 카피, 비상호작용 전략 카드, CTA, 공용 상태 바 비침범을 정적 렌더로 보호한다.
- `components/game/U2Preview.tsx`, `components/game/U2Preview.test.ts`: 시작 fixture와 `/u3-test` 링크 계약을 유지한다.
- `app/u2-intro.css`: U2 전체 폭 배경, 도움/배신 중심 grid, 3개 정보 패널, CTA의 무스크롤 레이아웃을 소유한다.
- `e2e/routes.spec.ts`: 바뀐 U2 접근성 제목으로 `/campaign`·`/u2-test` route smoke를 계속 찾는다.
- `e2e/canvas-layout.spec.ts`, `e2e/campaign-smoke.spec.ts`: 고정 캔버스와 CTA→게시판 실제 전이를 회귀 검증한다.
- `docs/experience/ONBOARDING_AND_INTERFACE.md`, `docs/experience/SCREEN_LAYOUT.md`: 새 온보딩 정보와 U2 전체 폭 예외를 공식화한다.
- `docs/README.md`: spec과 이 Plan의 문서 색인만 추가한다.

### Task 1: U2의 정적 전략 가이드 구조와 컴포넌트 계약

**Files:**
- Modify: `components/game/IntroScreen.tsx:17-82`
- Modify: `components/game/IntroScreen.test.ts:20-104`
- Modify: `components/game/U2Preview.test.ts:6-24`

**Interfaces:**
- Consumes: `IntroScreenProps { status: TopStatusView; boardHref: string; onEnterBoard?: () => void }`, 기존 `CtaBody`, 기존 `TopStatusBar`
- Produces: 도움/배신 `article` 2개, 승급·목표·조기 종료 정보 패널 3개, 변경되지 않은 CTA DOM 계약

- [ ] **Step 1: 현재 Next.js CSS·Vitest 공식 문서를 읽는다**

Run:

```bash
sed -n '1,260p' node_modules/next/dist/docs/01-app/01-getting-started/11-css.md
sed -n '1,260p' node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md
```

Expected: 전역 CSS import와 Vitest 실행에 이번 변경을 막는 폐기 안내가 없다.

- [ ] **Step 2: 새 본문 계약을 먼저 테스트에 쓴다**

`IntroScreen.test.ts`의 기존 역할·수단·목표 단언을 아래 계약으로 교체한다. `data-testid="u2-intro"` 안의 마크업만 검사해 상태 바의 `0 / 5`가 본문 임계값 부정 단언을 오염시키지 않게 한다.

```ts
expect(html).toContain("당신은 용사들을 던전으로 안내하는 고블린 길잡이입니다.");
expect(html).toContain("직접 싸우지 않습니다. 길을 읽고, 어떤 조언을 건넬지 결정하십시오.");
expect(html).toContain("용사를 돕는다");
expect(html).toContain("안전 · 꾸준한 보상");
expect(html).toContain("용사를 배신한다");
expect(html).toContain("위험 · 막대한 보상");
expect(html).toContain("명성으로 인정받아 정식 승급");
expect(html).toContain("골드로 뒷거래 승급");
expect(html).toContain("C → B → A → S");
expect(html).toContain("15개의 던전을 돌파하십시오.");
expect(html).toContain("최고의 목표는 S급 길잡이");
expect(html).toContain("길잡이에게도 끝은 찾아옵니다");
```

같은 테스트에서 도움/배신 카드가 `<article>`이고 버튼·링크가 아니며, 기존 CTA만 `<a class="u2-intro__cta" href="/u3-test">` 또는 통합 경로의 button이라는 점을 검사한다. `IntroScreen` 전체가 아닌 `u2-intro` 부분 문자열에는 `신뢰 0 생존자 5명`, `서로 다른 직업 3명`, `60 / 120 / 200`, `150G / 320G / 600G`가 없음을 단언한다.

- [ ] **Step 3: 새 테스트가 현재 3카드 구조에서 실패하는지 확인한다**

Run:

```bash
pnpm test components/game/IntroScreen.test.ts components/game/U2Preview.test.ts
```

Expected: 새 역할 설명과 도움/배신 카피가 없어 `IntroScreen` 테스트가 FAIL하고, fixture·링크 계약은 기존대로 PASS한다.

- [ ] **Step 4: `IntroScreen.tsx`를 정적 가이드 계층으로 최소 교체한다**

기존 `introCards` 반복을 제거한다. 같은 파일 안에 작은 표현 컴포넌트 또는 `as const` 데이터만 두고 다음 순서로 렌더링한다.

```tsx
<div className="u2-intro__copy">
  <p className="u2-intro__eyebrow">길잡이의 첫 기록</p>
  <h1 id="u2-intro-title">당신은 용사들을 던전으로 안내하는 고블린 길잡이입니다.</h1>
  <p className="u2-intro__lead">직접 싸우지 않습니다. 길을 읽고, 어떤 조언을 건넬지 결정하십시오.</p>
</div>
<section className="u2-intro__strategy" aria-labelledby="u2-strategy-title">
  <p id="u2-strategy-title">당신의 선택</p>
  <article className="u2-intro__strategy-card u2-intro__strategy-card--help">
    <h2>용사를 돕는다</h2><p>안전 · 꾸준한 보상</p>
    <p>올바른 길과 조언으로 용사들이 살아 돌아오도록 돕습니다.</p>
    <ul><li>명성 ↑</li><li>계약금 ↑</li><li>신뢰 유지</li></ul>
  </article>
  <article className="u2-intro__strategy-card u2-intro__strategy-card--betray">
    <h2>용사를 배신한다</h2><p>위험 · 막대한 보상</p>
    <p>거짓된 조언으로 용사들을 위험에 빠뜨리고 전멸을 노릴 수도 있습니다.</p>
    <ul><li>대량 골드 ↑↑</li><li>명성 ↓</li><li>신뢰 ↓</li><li>남은 인력 ↓</li></ul>
  </article>
  <p>안전하게 명성을 쌓을 것인가, 위험을 감수하고 큰돈을 노릴 것인가.</p>
</section>
<section className="u2-intro__facts" aria-label="원정 안내">
  <article><h2>S급으로 가는 두 길</h2><p>명성으로 인정받아 정식 승급</p><p>골드로 뒷거래 승급</p><p>C → B → A → S</p></article>
  <article><h2>원정의 목표</h2><p>15개의 던전을 돌파하십시오.</p><p>최고의 목표는 S급 길잡이</p></article>
  <article><h2>길잡이에게도 끝은 찾아옵니다</h2><p>신뢰, 인력, 승급을 관리하지 못하면 원정은 일찍 끝날 수 있습니다.</p></article>
</section>
```

각 strategy card에는 제목·전략 라벨·설명·결과 목록·보조 문구를, 배신 카드에는 경고 문구를 넣는다. facts에는 `S급으로 가는 두 길`, `원정의 목표`, `길잡이에게도 끝은 찾아옵니다` 패널을 넣는다. `button`, `a`, `onClick`, 선택 상태를 strategy/facts에 추가하지 않는다. `TopStatusBar`, `IntroScreenProps`, `CtaBody`, `IntroMainContent`의 CTA 분기는 그대로 유지한다.

- [ ] **Step 5: 정적 렌더 테스트를 통과시킨다**

Run:

```bash
pnpm test components/game/IntroScreen.test.ts components/game/U2Preview.test.ts components/game/campaign-render.test.tsx
```

Expected: 새 본문 계약과 기존 캠페인 CTA 전이가 모두 PASS한다.

- [ ] **Step 6: 첫 구현 단위를 커밋한다**

```bash
git add components/game/IntroScreen.tsx components/game/IntroScreen.test.ts components/game/U2Preview.test.ts
git commit -m "화면: U2를 전략 게임 가이드로 재구성한다" -m "도움과 배신을 비상호작용 전략 카드로 설명하고 승급, 완주, 조기 종료 정보를 한 화면에 배치한다. 기존 상태 바와 게시판 진입 계약은 유지한다."
```

### Task 2: 고정 캔버스 안의 도움/배신 중심 레이아웃

**Files:**
- Modify: `app/u2-intro.css:1-272`
- Modify: `components/game/IntroScreen.test.ts:88-104`

**Interfaces:**
- Consumes: Task 1의 `.u2-intro__copy`, `.u2-intro__strategy`, `.u2-intro__strategy-card`, `.u2-intro__facts`, `.u2-intro__cta`
- Produces: 전체 폭·무스크롤 U2 grid와 색 이외의 카드 구분 수단

- [ ] **Step 1: 새 CSS 구조 계약을 테스트에 쓴다**

`IntroScreen.test.ts`에 CSS source를 읽는 테스트를 추가한다. 다음을 검사한다.

```ts
expect(css).toMatch(/\.u2-intro\s*\{[\s\S]*?grid-template-rows:/);
expect(css).toMatch(/\.u2-intro__strategy\s*\{[\s\S]*?grid-template-columns:/);
expect(css).toMatch(/\.u2-intro__facts\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,/);
expect(css).toMatch(/\.u2-intro__strategy-card--help/);
expect(css).toMatch(/\.u2-intro__strategy-card--betray/);
expect(css).not.toMatch(/@media/);
expect(css).not.toMatch(/--status-(?:bar|label|value)/);
```

기존 배경 asset, CTA 광학 정렬, `.u2-intro-stage { overflow: hidden; }`와 CTA `:focus-visible` 단언은 유지한다.

- [ ] **Step 2: 테스트가 새 selector 부재로 실패하는지 확인한다**

Run:

```bash
pnpm test components/game/IntroScreen.test.ts
```

Expected: strategy/facts selector와 3열 facts grid가 없어 새 CSS 계약이 FAIL한다.

- [ ] **Step 3: U2 전용 CSS를 새 계층에 맞춰 구현한다**

`u2-intro.css`에서 기존 3열 `.u2-intro__cards`와 `.u2-intro__card*` 규칙을 제거하고, 배경·shell·CTA 규칙은 재사용한다.

```css
.u2-intro {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  height: 100%;
  min-height: 0;
}

.u2-intro__strategy {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  min-height: 0;
}

.u2-intro__facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
```

도움/배신은 동일한 기본 폭·높이·테두리 밀도를 사용한다. 도움에는 안정·신뢰를, 배신에는 위험·금전·경고를 아이콘·제목·전략 라벨·결과 문구로 함께 표현해 색만으로 구분하지 않는다. 본문 길이가 고정 캔버스를 넘기지 않도록 `minmax(0, 1fr)`, U2 전용 `clamp()` 간격·글자 크기, `word-break: keep-all`, `overflow-wrap: anywhere`를 적용한다. 새 `vw`/`vh`, media query, 공용 상태 바 재정의, 내부 스크롤을 추가하지 않는다.

- [ ] **Step 4: 컴포넌트·CSS 계약을 통과시킨다**

Run:

```bash
pnpm test components/game/IntroScreen.test.ts components/game/U2Preview.test.ts
pnpm typecheck
pnpm lint
```

Expected: U2 마크업·CSS 계약, TypeScript, ESLint가 모두 PASS한다.

- [ ] **Step 5: 두 번째 구현 단위를 커밋한다**

```bash
git add app/u2-intro.css components/game/IntroScreen.test.ts
git commit -m "화면: U2 한 화면 가이드 레이아웃을 적용한다" -m "도움과 배신을 가장 큰 정보 영역으로 두고 승급, 목표, 조기 종료 패널을 고정 캔버스 안에 배치한다."
```

### Task 3: 공식 문서와 브라우저 회귀 계약 동기화

**Files:**
- Modify: `docs/experience/ONBOARDING_AND_INTERFACE.md:9-20, 88-111`
- Modify: `docs/experience/SCREEN_LAYOUT.md:78-86, 115-121`
- Modify: `docs/README.md`
- Modify: `e2e/routes.spec.ts:9-17`
- Test: `e2e/routes.spec.ts`, `e2e/canvas-layout.spec.ts`, `e2e/campaign-smoke.spec.ts`

**Interfaces:**
- Consumes: Task 1의 새 U2 제목과 CTA accessible name, Task 2의 전체 폭·고정 캔버스 계약
- Produces: 문서와 route smoke가 같은 U2 계약을 가리킴

- [ ] **Step 1: 문서와 route marker의 실패 지점을 먼저 기록한다**

`e2e/routes.spec.ts`에서 두 U2 marker가 이전 제목 `던전은 검보다 먼저 말을 건넨다`를 사용한다는 점을 확인한다. `ONBOARDING_AND_INTERFACE.md`의 “세 가지만 전달”과 `SCREEN_LAYOUT.md`의 인트로 60:40 설명도 새 spec과 반대임을 확인한다.

Run:

```bash
rg -n "던전은 검보다 먼저 말을 건넨다|세 가지만 전달|우측 레일 유지" e2e/routes.spec.ts docs/experience/ONBOARDING_AND_INTERFACE.md docs/experience/SCREEN_LAYOUT.md
```

Expected: 세 이전 계약이 모두 발견된다.

- [ ] **Step 2: 공식 문서를 새 계약으로 바꾼다**

`ONBOARDING_AND_INTERFACE.md`의 U2 설명을 다음 정보로 바꾼다: 길잡이 역할, 조언 개입, 도움/배신의 전략적 차이, 명성/골드 두 승급 경로, 등급 위험도 해금, 15개 던전 정상 완주와 S급 최고 목표, 신뢰·인력·승급 실패 조기 종료 힌트. 도움/배신이 실제 조언 유형 라벨이 아니라 전략 설명이라는 경계도 한 문장으로 넣는다.

`SCREEN_LAYOUT.md`에서는 인트로 행을 “상단 상태 바 아래 전체 폭 가이드”로 바꾸고, 인트로 절에서 U2만 60:40 예외이며 게시판 이후 화면은 기존 60:40이라는 점을 명시한다.

`docs/README.md`에는 spec과 이 plan의 상대 링크만 추가한다.

- [ ] **Step 3: route smoke marker를 새 접근성 이름으로 바꾼다**

`e2e/routes.spec.ts`의 `/campaign`과 `/u2-test` marker를 다음으로 교체한다.

```ts
page.getByRole("main", { name: /당신은 용사들을 던전으로 안내하는 고블린 길잡이입니다/ })
```

CTA 이름 `길드 게시판으로`는 바꾸지 않는다. 이로써 `campaign-smoke.spec.ts`의 시작 전이는 그대로 재사용한다.

- [ ] **Step 4: 문서·route·캔버스 회귀를 실행한다**

Run:

```bash
pnpm test:e2e e2e/routes.spec.ts e2e/canvas-layout.spec.ts e2e/campaign-smoke.spec.ts
```

Expected: `/campaign`과 `/u2-test`가 새 main accessible name으로 렌더링되고, 1920×1080·2560×1440·1440×900·1280×1024에서 문서 스크롤과 캔버스 밖 이미지가 없으며 CTA가 게시판으로 전이한다.

- [ ] **Step 5: 세 번째 구현 단위를 커밋한다**

```bash
git add docs/experience/ONBOARDING_AND_INTERFACE.md docs/experience/SCREEN_LAYOUT.md docs/README.md e2e/routes.spec.ts
git commit -m "문서: U2 게임 가이드 계약을 동기화한다" -m "온보딩과 화면 규격에 전체 폭 U2 예외와 전략 정보를 기록하고 바뀐 인트로 제목에 맞춰 route smoke를 갱신한다."
```

### Task 4: 전체 검증과 변경 경계 확인

**Files:**
- Verify only: `components/game/IntroScreen.tsx`, `components/game/IntroScreen.test.ts`, `components/game/U2Preview.test.ts`, `app/u2-intro.css`, `docs/experience/ONBOARDING_AND_INTERFACE.md`, `docs/experience/SCREEN_LAYOUT.md`, `docs/README.md`, `e2e/routes.spec.ts`

**Interfaces:**
- Consumes: Tasks 1~3의 UI·문서·E2E 계약
- Produces: 검증된 U2 redesign 변경 집합

- [ ] **Step 1: 정적 품질 명령을 실행한다**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: 네 명령 모두 exit code 0이다. 실패하면 실패 파일과 원인을 기록하고, U2 변경과 무관한 기존 실패인지 먼저 분리한다.

- [ ] **Step 2: 실제 브라우저에서 U2 시각 요구를 확인한다**

Run:

```bash
pnpm dev
```

브라우저에서 `/campaign?seed=u2-game-guide-redesign`을 1920×1080으로 열어 다음을 확인한다.

- 상단 상태 바와 본문이 겹치지 않는다.
- 도움/배신 카드가 가장 큰 동등한 정보 영역이며 버튼처럼 보이지 않는다.
- 3개 하단 패널과 CTA가 한 화면에 있고 가로·세로 스크롤이 없다.
- 배신은 위험·막대한 보상, 도움은 안전·꾸준한 보상으로 색 외의 문구·아이콘·결과를 통해 구분된다.
- 공용 상태 바의 의심 인원·남은 용사·남은 던전이 유지되고 본문과 의미적으로 연결된다.
- 새 브라우저 오류와 Next 오류 overlay가 없다.

- [ ] **Step 3: 최종 diff를 검토하고 통합 커밋을 만든다**

Run:

```bash
git diff --check
git status --short
git log --oneline origin/main..HEAD
```

Expected: U2 화면·테스트·문서·route smoke만 변경되고, 미추적 자산·공용 rules/store·도메인 타입은 포함되지 않는다.

변경이 앞선 Task별 커밋으로 모두 기록됐다면 추가 빈 커밋을 만들지 않는다. 검증에서 수정한 파일이 있으면 그 파일만 stage하고 다음 메시지로 커밋한다: `검증: U2 게임 가이드 회귀를 정리한다` — 본문은 `고정 캔버스와 게시판 진입 계약을 최종 검증해 구현 문서와 회귀 범위를 일치시킨다.`

## Plan Self-Review

- Spec coverage: Task 1은 역할·도움/배신·승급·목표·조기 종료 본문과 CTA를, Task 2는 전체 폭·무스크롤·접근성 시각 구분을, Task 3은 공식 문서와 E2E 회귀를, Task 4는 전체 품질·브라우저 확인을 담당한다.
- Hidden advice boundary: Task 1과 Global Constraints가 전략 가이드와 실제 조언의 숨은 유형을 분리하고, Task 3의 온보딩 문서에도 같은 경계를 기록한다.
- State-bar threshold boundary: Task 1의 본문 substring 검사와 Task 2의 공용 토큰 비침범 단언이 기존 `0 / 5` 상태 바를 보존한다.
- Placeholder scan: 계획의 모든 파일, 명령, 카피, 테스트 조건, 커밋 메시지를 구체적으로 적었다.
- Type consistency: 새 타입·Store·service는 만들지 않으며 기존 `IntroScreenProps`, `TopStatusView`, `statusFor()` 계약을 그대로 소비한다.
