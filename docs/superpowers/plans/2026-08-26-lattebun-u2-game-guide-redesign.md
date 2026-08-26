# U2 이미지 게임 가이드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** U2의 상단 상태 바 아래를 원본 비율의 단일 게임 가이드 이미지로 교체하고, 이미지 하단 붉은 프레임 안에 기존 게시판 진입 CTA를 배치한다.

**Architecture:** `IntroScreen`은 기존 `TopStatusBar`와 `IntroScreenProps`의 링크/버튼 분기를 유지하되 가시적 카드·패널 대신 1672×941 비율의 guide wrapper, 승인 이미지, 숨은 접근성 요약, 텍스트 CTA만 렌더링한다. `u2-intro.css`는 고정 stage 안에서 wrapper를 `contain`으로 중앙 배치하고 CTA를 wrapper 상대 좌표로 겹친다. Store, adapter, domain/rules와 게시판 이후 화면은 변경하지 않는다.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript, CSS, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-08-26-lattebun-u2-game-guide-redesign-design.md`

## Global Constraints

- `/assets/u2/game-guide-bg.png`의 원본 크기 1672×941과 종횡비를 보존한다.
- 이미지는 상단 상태 바 아래 stage에서 `contain`으로 표시하며 자르거나 늘이지 않는다.
- 남는 좌우 공간은 어두운 U2 stage 배경으로 처리하고 내부 스크롤을 만들지 않는다.
- CTA는 이미지 wrapper 기준 약 `left 28.2%`, `top 91.75%`, `width 43.5%`, `height 6.9%`의 붉은 프레임 안에서 보정한다.
- CTA는 텍스트만 표시한다. 기존 인장과 화살표 이미지는 제거한다.
- 프리뷰에서는 `boardHref` 링크, 실제 `/campaign`에서는 기존 `OPEN_BOARD` callback 버튼 계약을 유지한다.
- 공용 `TopStatusBar`, `TopStatusView`, `campaign-adapters.ts`의 `statusFor()`, Store, domain 타입, 규칙·밸런스는 수정하지 않는다.
- 실제 던전 조언의 `help / harm / neutral`, 정답 색, 정합·모순 관계와 정확한 엔딩 임계값을 새 DOM에 추가하지 않는다.
- 가이드 이미지는 `alt=""`, `aria-hidden="true"`로 처리하고 `sr-only` 제목·요약으로 접근성 정보를 제공한다.
- U2만 전체 폭 예외로 유지하며 U3~U6의 60:40 `GameShell`을 바꾸지 않는다.
- 새 `@media`, `vw`, `vh`, 공용 상태 바 CSS 토큰 재정의를 추가하지 않는다.
- 구현 전에 `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`, `node_modules/next/dist/docs/01-app/01-getting-started/12-images.md`, `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`, `node_modules/next/dist/docs/03-architecture/accessibility.md`를 읽는다.
- 기존 미추적 `.pnpm-store/`와 `public/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/`은 수정하거나 커밋하지 않는다.

---

## 파일 책임 지도

- `public/assets/u2/game-guide-bg.png`: 사용자가 승인한 1672×941 원본 게임 가이드 이미지다.
- `components/game/IntroScreen.tsx`: 이미지 wrapper, 숨은 접근성 요약, CTA의 링크/버튼 이중 계약을 소유한다.
- `components/game/IntroScreen.test.ts`: 이미지·접근성·CTA·CSS contain 계약과 기존 카드 제거를 보호한다.
- `components/game/U2Preview.test.ts`: 시작 fixture, 이미지 경로, `/u3-test` 링크를 보호한다.
- `app/u2-intro.css`: 상단 상태 바 아래 contain 배치, 좌우 여백, 이미지 상대 CTA 좌표와 focus를 소유한다.
- `e2e/routes.spec.ts`: 기존 U2 main 접근성 이름으로 `/campaign`과 `/u2-test`를 찾는다.
- `e2e/canvas-layout.spec.ts`: 고정 캔버스의 무스크롤·이미지 경계를 검증한다.
- `e2e/campaign-smoke.spec.ts`: `길드 게시판으로` CTA의 실제 게시판 전이를 검증한다.

### Task 1: 승인 이미지와 단일 가이드 컴포넌트 계약

**Files:**
- Create: `public/assets/u2/game-guide-bg.png`
- Modify: `components/game/IntroScreen.tsx:16-97`
- Modify: `components/game/IntroScreen.test.ts:21-84`
- Modify: `components/game/U2Preview.test.ts:7-19`

**Interfaces:**
- Consumes: `IntroScreenProps { status: TopStatusView; boardHref: string; onEnterBoard?: () => void }`, `TopStatusBar`, 전역 `.sr-only`
- Produces: `.u2-intro__guide`, `.u2-intro__guide-image`, `.u2-intro__cta`, 기존 main accessible name `u2-intro-title`

- [ ] **Step 1: 관련 Next.js 공식 문서를 읽는다**

Run:

```bash
sed -n '1,260p' node_modules/next/dist/docs/01-app/01-getting-started/11-css.md
sed -n '1,260p' node_modules/next/dist/docs/01-app/01-getting-started/12-images.md
sed -n '1,260p' node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md
sed -n '1,220p' node_modules/next/dist/docs/03-architecture/accessibility.md
```

Expected: 정적 public asset의 `/assets/...` 경로, 명시적 이미지 크기, 동기 React 컴포넌트의 Vitest 정적 렌더, 고유 `h1` 접근성 이름을 현재 구조에서 사용할 수 있다.

- [ ] **Step 2: 승인 이미지를 PR worktree에 복사하고 원본을 검증한다**

Run:

```bash
cp /Users/danny/MakeBun/Dungeon_Schemer/public/assets/u2/game-guide-bg.png public/assets/u2/game-guide-bg.png
shasum -a 256 public/assets/u2/game-guide-bg.png
sips -g pixelWidth -g pixelHeight public/assets/u2/game-guide-bg.png
```

Expected:

```text
8b610cf513c535fabe9339477ebd9d9a5769e381751c63ec91e476d801ed47b8  public/assets/u2/game-guide-bg.png
pixelWidth: 1672
pixelHeight: 941
```

- [ ] **Step 3: 새 이미지·접근성·CTA 계약을 테스트에 먼저 쓴다**

`IntroScreen.test.ts`의 기존 카드 카피 테스트를 다음 정적 렌더 계약으로 교체한다.

```ts
expect(html).toContain('class="u2-intro__guide"');
expect(html).toContain('class="u2-intro__guide-image"');
expect(html).toContain('src="/assets/u2/game-guide-bg.png"');
expect(html).toContain('width="1672"');
expect(html).toContain('height="941"');
expect(html).toContain('alt=""');
expect(html).toContain('aria-hidden="true"');
expect(html).toContain('<div class="sr-only">');
expect(html).toContain('<h1 id="u2-intro-title">당신은 용사들을 던전으로 안내하는 고블린 길잡이입니다.</h1>');
expect(html).toContain("도움과 배신의 전략");
expect(html).toContain("명성과 골드의 두 승급 경로");
expect(html).toContain("15개 던전 완주");
expect(html).toContain("조기 종료 위험");
expect(html).not.toContain('class="u2-intro__strategy"');
expect(html).not.toContain('class="u2-intro__strategy-card');
expect(html).not.toContain('class="u2-intro__facts"');
expect(html).not.toContain("/assets/u3/extracted/contract-emblem.png");
expect(html).not.toContain("/assets/u3/extracted/arrow-right.png");
```

링크 경로 테스트는 다음 계약을 유지한다.

```ts
expect(html).toContain('<a class="u2-intro__cta" href="/u1-test?screen=board"><strong>길드 게시판으로</strong></a>');
expect(html).not.toContain('<button class="u2-intro__cta"');
```

버튼 경로는 callback 실행까지 실제로 검증할 수 있도록 기존 정적 마크업 단언에 더해 React test renderer를 새로 도입하지 않는다. 현재 `campaign-render.test.tsx`와 `campaign-smoke.spec.ts`가 실제 `OPEN_BOARD` 전이를 소유하므로 `IntroScreen.test.ts`에서는 다음 DOM 계약만 유지한다.

```ts
expect(html).toContain('<button class="u2-intro__cta" type="button"><strong>길드 게시판으로</strong></button>');
expect(html).not.toContain('<a class="u2-intro__cta"');
```

`U2Preview.test.ts`에도 다음 단언을 추가한다.

```ts
expect(html).toContain('src="/assets/u2/game-guide-bg.png"');
expect(html).toContain('<a class="u2-intro__cta" href="/u3-test">');
```

- [ ] **Step 4: 새 테스트가 기존 카드 DOM에서 실패하는지 확인한다**

Run:

```bash
pnpm test components/game/IntroScreen.test.ts components/game/U2Preview.test.ts
```

Expected: `/assets/u2/game-guide-bg.png`와 `.u2-intro__guide`가 없고 기존 strategy/facts 구조가 남아 있어 FAIL한다.

- [ ] **Step 5: `IntroScreen`을 이미지 중심 최소 구조로 교체한다**

`CtaBody`는 텍스트만 반환하고 `IntroMainContent`는 다음 구조를 렌더링한다.

```tsx
function CtaBody() {
  return <strong>길드 게시판으로</strong>;
}

function IntroMainContent({ boardHref, onEnterBoard }: { boardHref: string; onEnterBoard?: () => void }) {
  return (
    <main className="u2-intro-stage" aria-labelledby="u2-intro-title">
      <div className="u2-intro__guide" data-testid="u2-intro">
        <img
          className="u2-intro__guide-image"
          src="/assets/u2/game-guide-bg.png"
          alt=""
          aria-hidden="true"
          width={1672}
          height={941}
        />
        <div className="sr-only">
          <h1 id="u2-intro-title">당신은 용사들을 던전으로 안내하는 고블린 길잡이입니다.</h1>
          <p>도움과 배신의 전략, 명성과 골드의 두 승급 경로, 15개 던전 완주 목표와 조기 종료 위험을 안내합니다.</p>
        </div>
        {onEnterBoard === undefined ? (
          <a className="u2-intro__cta" href={boardHref}><CtaBody /></a>
        ) : (
          <button className="u2-intro__cta" type="button" onClick={onEnterBoard}><CtaBody /></button>
        )}
      </div>
    </main>
  );
}
```

`IntroScreenProps`, `TopStatusBar`, `IntroScreen`의 바깥 shell은 수정하지 않는다.

- [ ] **Step 6: 컴포넌트와 실제 캠페인 계약 테스트를 통과시킨다**

Run:

```bash
pnpm test components/game/IntroScreen.test.ts components/game/U2Preview.test.ts components/game/campaign-render.test.tsx
```

Expected: 이미지·접근성·프리뷰 링크와 기존 캠페인 CTA 전이 테스트가 모두 PASS한다.

- [ ] **Step 7: 첫 구현 단위를 커밋한다**

```bash
git add public/assets/u2/game-guide-bg.png components/game/IntroScreen.tsx components/game/IntroScreen.test.ts components/game/U2Preview.test.ts
git commit -m "화면: U2를 단일 이미지 가이드로 교체한다" -m "승인된 가이드 이미지를 추가하고 상단 상태 바와 게시판 진입의 링크·버튼 계약, 숨은 접근성 요약을 유지한다."
```

### Task 2: 원본 비율 contain 배치와 프레임 정렬 CTA

**Files:**
- Modify: `app/u2-intro.css:1-369`
- Modify: `components/game/IntroScreen.test.ts:86-96`

**Interfaces:**
- Consumes: Task 1의 `.u2-intro__guide`, `.u2-intro__guide-image`, `.u2-intro__cta`
- Produces: 1672/941 contain wrapper, 균등 좌우 여백, 붉은 프레임 상대 CTA 좌표

- [ ] **Step 1: CSS source 계약을 테스트에 먼저 쓴다**

기존 strategy/facts grid 단언을 다음 계약으로 교체한다.

```ts
expect(css).toMatch(/\.u2-intro-stage\s*\{[\s\S]*?container-type:\s*size/);
expect(css).toMatch(/\.u2-intro-stage\s*\{[\s\S]*?place-items:\s*center/);
expect(css).toMatch(/\.u2-intro-stage\s*\{[\s\S]*?overflow:\s*hidden/);
expect(css).toMatch(/\.u2-intro__guide\s*\{[\s\S]*?aspect-ratio:\s*1672\s*\/\s*941/);
expect(css).toMatch(/\.u2-intro__guide\s*\{[\s\S]*?100cqh/);
expect(css).toMatch(/\.u2-intro__guide-image\s*\{[\s\S]*?object-fit:\s*contain/);
expect(css).toMatch(/\.u2-intro__cta\s*\{[\s\S]*?position:\s*absolute/);
expect(css).toMatch(/\.u2-intro__cta\s*\{[\s\S]*?left:\s*28\.2%/);
expect(css).toMatch(/\.u2-intro__cta\s*\{[\s\S]*?top:\s*91\.75%/);
expect(css).toMatch(/\.u2-intro__cta\s*\{[\s\S]*?width:\s*43\.5%/);
expect(css).toMatch(/\.u2-intro__cta\s*\{[\s\S]*?height:\s*6\.9%/);
expect(css).toMatch(/\.u2-intro__cta:focus-visible\s*\{/);
expect(css).not.toMatch(/u2-intro__(?:copy|strategy|facts)/);
expect(css).not.toMatch(/intro-background-full\.png/);
expect(css).not.toMatch(/@media|\b(?:vw|vh)\b/);
expect(css).not.toMatch(/--status-(?:bar|label|value)/);
```

- [ ] **Step 2: CSS 테스트가 기존 grid에서 실패하는지 확인한다**

Run:

```bash
pnpm test components/game/IntroScreen.test.ts
```

Expected: `.u2-intro__guide`, `aspect-ratio`, `container-type`, CTA absolute percentage 좌표가 없어 FAIL한다.

- [ ] **Step 3: 기존 카드 CSS를 contain 이미지 stage로 교체한다**

`u2-intro.css`는 다음 최소 구조를 기준으로 작성한다.

```css
.u2-intro-shell {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background: #080604;
  color: var(--color-parchment);
}

.u2-intro-stage {
  container-type: size;
  display: grid;
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  place-items: center;
  overflow: hidden;
  background: #080604;
}

.u2-intro__guide {
  position: relative;
  width: min(100%, calc(100cqh * 1672 / 941));
  aspect-ratio: 1672 / 941;
  max-height: 100%;
}

.u2-intro__guide-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.u2-intro__cta {
  position: absolute;
  left: 28.2%;
  top: 91.75%;
  display: grid;
  width: 43.5%;
  height: 6.9%;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: #f4dfb4;
  cursor: pointer;
  text-align: center;
  text-decoration: none;
}
```

CTA의 `strong`은 기존 Georgia 계열과 금색을 사용하되 붉은 프레임의 안쪽을 넘지 않는다. hover는 투명한 밝기/배경 변화, `:focus-visible`은 프레임 안쪽에서 명확한 outline을 제공한다. 기존 `.u2-intro__copy`, `.u2-intro__strategy*`, `.u2-intro__facts*`, 배경 pseudo-element, CTA emblem/arrow 규칙은 모두 제거한다.

- [ ] **Step 4: 컴포넌트·CSS 정적 검증을 통과시킨다**

Run:

```bash
pnpm test components/game/IntroScreen.test.ts components/game/U2Preview.test.ts components/game/campaign-render.test.tsx
pnpm typecheck
pnpm exec eslint components/game/IntroScreen.tsx components/game/IntroScreen.test.ts components/game/U2Preview.test.ts
```

Expected: U2 관련 테스트와 TypeScript가 PASS하고, 변경한 TypeScript 파일에 ESLint error가 없다. 기존 `<img>` 사용에 대한 `@next/next/no-img-element` warning은 정적 public asset과 정확한 크기를 쓰는 이 설계에서 허용하되 보고한다.

- [ ] **Step 5: 브라우저에서 CTA 광학 좌표를 보정한다**

Run:

```bash
pnpm dev
```

`/campaign?seed=u2-game-guide-redesign`을 1920×1080에서 열고 다음을 확인한다.

- 이미지의 위·아래·좌·우 가장자리가 모두 보이고 글자가 늘어나지 않는다.
- 좌우 어두운 여백의 폭이 같다.
- 상단 상태 바와 이미지가 겹치지 않는다.
- CTA의 클릭 영역과 텍스트가 붉은 프레임의 안쪽에 있다.
- CTA hover/focus가 프레임 밖의 이미지 내용을 가리지 않는다.
- 문서 가로·세로 스크롤과 Next 오류 overlay가 없다.

초기 `28.2 / 91.75 / 43.5 / 6.9%` 값이 실제 프레임 안쪽에서 벗어나면 원본 이미지 픽셀 좌표를 기준으로 같은 네 percentage만 최소 보정하고 CSS 테스트의 값도 함께 갱신한다.

- [ ] **Step 6: 레이아웃 단위를 커밋한다**

```bash
git add app/u2-intro.css components/game/IntroScreen.test.ts
git commit -m "화면: U2 이미지와 게시판 CTA를 프레임에 맞춘다" -m "가이드 원본 비율을 보존해 중앙 배치하고 게시판 진입 영역을 이미지 하단 붉은 프레임의 상대 좌표에 정렬한다."
```

### Task 3: E2E와 전체 회귀 검증

**Files:**
- Verify: `e2e/routes.spec.ts`
- Verify: `e2e/canvas-layout.spec.ts`
- Verify: `e2e/campaign-smoke.spec.ts`
- Verify: `docs/experience/ONBOARDING_AND_INTERFACE.md`
- Verify: `docs/experience/SCREEN_LAYOUT.md`

**Interfaces:**
- Consumes: Task 1의 main accessible name과 CTA 계약, Task 2의 contain layout
- Produces: 검증된 U2 이미지 가이드 변경 집합

- [ ] **Step 1: 문서와 route marker가 새 계약과 일치하는지 확인한다**

Run:

```bash
rg -n "game-guide-bg.png|contain|붉은.*프레임|당신은 용사들을 던전으로 안내하는 고블린 길잡이입니다" docs/experience/ONBOARDING_AND_INTERFACE.md docs/experience/SCREEN_LAYOUT.md e2e/routes.spec.ts
```

Expected: 공식 문서에는 이미지 경로·contain·프레임 CTA가, `/campaign`과 `/u2-test` marker에는 기존 main accessible name이 발견된다.

- [ ] **Step 2: 브라우저 회귀를 실행한다**

Run:

```bash
pnpm test:e2e e2e/routes.spec.ts e2e/canvas-layout.spec.ts e2e/campaign-smoke.spec.ts
```

Expected: `/campaign`과 `/u2-test`가 새 이미지 U2를 렌더링하고, 1920×1080·2560×1440·1440×900·1280×1024에서 문서 스크롤과 캔버스 밖 이미지가 없으며 CTA가 게시판으로 전이한다.

- [ ] **Step 3: 전체 정적 검증을 실행한다**

Run:

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build
git diff --check
```

Expected: 모든 명령이 exit code 0이다. `playwright-report/` 같은 생성 산출물이 lint에 포함되면 해당 산출물이 Git 무시 대상인지 확인해 별도로 기록하고, U2 변경 파일의 lint 결과를 함께 제시한다. build가 완료되지 않으면 성공으로 간주하지 않고 정확한 마지막 출력과 대기 시간을 보고한다.

- [ ] **Step 4: 변경 경계를 확인한다**

Run:

```bash
git status --short
git diff --name-only origin/main...HEAD
git log --oneline origin/main..HEAD
```

Expected: 승인 이미지, U2 컴포넌트·CSS·테스트, spec/plan과 관련 공식 문서만 포함된다. 공용 status, adapter, Store, domain/rules와 U6 미추적 자산은 포함되지 않는다.

검증에서 코드 수정이 없으면 빈 커밋을 만들지 않는다. 검증으로 U2 범위 파일을 수정했다면 해당 파일만 stage하고 다음 메시지로 커밋한다.

```bash
git commit -m "검증: U2 이미지 가이드 회귀를 정리한다" -m "원본 비율, 프레임 CTA, 게시판 전이와 고정 캔버스 회귀를 최종 확인한다."
```

## Plan Self-Review

- Spec coverage: Task 1은 승인 자산·이미지 DOM·접근성·CTA 계약을, Task 2는 contain·좌우 여백·프레임 좌표를, Task 3은 문서·E2E·전체 품질과 변경 경계를 검증한다.
- Architecture boundary: 모든 작업은 `IntroScreen`, U2 CSS, U2 테스트와 자산에 한정되며 `TopStatusBar`, `TopStatusView`, adapter, Store, domain/rules는 수정하지 않는다.
- CTA consistency: Task 1이 링크/버튼 DOM을 보존하고 기존 campaign render/smoke가 실제 전이를 검증한다.
- Accessibility: 가시적 중복 DOM은 제거하지만 `sr-only` 제목과 요약, native link/button focus를 유지한다.
- Placeholder scan: 모든 파일, 카피, selector, 좌표, hash, 명령, 기대 결과와 커밋 메시지를 구체적으로 적었다.
- Type consistency: 새 타입·Store·service는 없으며 기존 `IntroScreenProps`와 `TopStatusView`만 소비한다.
