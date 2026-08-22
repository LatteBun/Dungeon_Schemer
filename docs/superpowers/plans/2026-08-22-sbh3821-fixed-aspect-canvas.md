# 16:9 고정 캔버스와 레터박스 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 화면을 1920×1080 고정 캔버스 안에 넣고, 창에 맞춰 균일하게 확대·축소하며, 남는 공간은 가운데 정렬된 레터박스로 남긴다.

**Architecture:** 루트 글꼴 크기를 `min(100vw / 120, 100vh / 67.5)`로 두어 축척을 만들고, 캔버스를 `120rem × 67.5rem` 크기 컨테이너로 선언한다. `rem`으로 쓴 기존 값은 자동으로 함께 축척되고, `vw`·`vh`는 `cqw`·`cqh`로 치환해 캔버스 기준이 된다. 1920×1080에서 참인 미디어 쿼리는 감싸개만 벗겨 제자리에 남기고, 거짓인 블록은 삭제한다. 결과 화면은 오늘 1920×1080 창에서 보이는 화면과 같다.

**Tech Stack:** Next.js 16.3, React 19.2, TypeScript 5, Tailwind CSS 4, Vitest 4.1, 전역 CSS, agent-browser

**Spec:** `docs/superpowers/specs/2026-08-22-sbh3821-fixed-aspect-canvas-design.md`

## Global Constraints

- 캔버스는 정확히 `120rem × 67.5rem`(기준 상태 1920×1080)이고 16:9를 벗어나지 않는다.
- `vw`·`vh` → `cqw`·`cqh` 치환은 숫자를 바꾸지 않는다. 값을 손으로 계산해 상수로 바꾸지 않는다.
- 참인 미디어 쿼리는 규칙 순서를 유지한 채 감싸개만 제거한다. 블록을 다른 위치로 옮기지 않는다.
- 작업 후 `app/*.css`에 `@media`가 남지 않는다.
- `1px` 테두리·구분선·링 장식, `border-radius: 999px`, `outline: 3px` 포커스 링은 픽셀로 남긴다. 선명함이 배율보다 중요하다.
- GameShell의 3:2 열 비율, 각 화면의 DOM 구조, 접근성 속성은 그대로 둔다.
- 캠페인 규칙, 보상 수치, 상태 머신, `lib/backtest`는 변경하지 않는다. `pnpm backtest`는 실행하지 않는다.
- 새 의존성을 추가하지 않는다.
- 커밋 메시지는 제목과 본문을 포함한 한글로 작성한다.

## File Map

- `docs/experience/SCREEN_LAYOUT.md`: 기준 해상도 표를 고정 캔버스 규격으로 바꾼다.
- `app/globals.css`: 루트 축척, 레터박스 본문, 캔버스 상자를 정의하고 구조 높이의 `100vh`를 캔버스 기준으로 바꾼다. 항상 거짓인 `max-width: 40rem` 블록 두 개를 지운다.
- `app/layout.tsx`: `<body>` 안에 캔버스 엘리먼트를 추가한다.
- `app/page.tsx`: `min-h-screen`을 캔버스 높이 기준으로 바꾼다.
- `app/u2-intro.css`, `app/u3-board.css`, `app/u3-card-theme.css`, `app/u3-u2-status-sync.css`: `100vh`와 `vw`·`vh`를 캔버스 기준으로 바꾸고 항상 거짓인 미디어 쿼리를 지운다.
- `app/u3-large-screen.css`, `app/u3-responsive-layout.css`: 참인 블록의 감싸개를 벗기고 거짓인 블록을 지운 뒤 단위를 치환한다.
- `app/u3-board.css`, `app/u2-intro.css`, `app/u3-u2-status-sync.css`: 나뭇결 주기와 번짐 12px 이상인 그림자 층을 `rem` 으로 옮긴다.
- `components/game/U3Assets.test.ts`: 창 반응형 CSS 계약 기대값을 고정 캔버스 계약으로 바꾼다.
- `components/game/FixedCanvas.test.ts` (신규): 고정 캔버스 계약을 고정한다.

## Task 1: Document the fixed-canvas resolution

**Files:**
- Modify: `docs/experience/SCREEN_LAYOUT.md`

**Interfaces:**
- Consumes: 없음
- Produces: 이후 모든 화면 작업이 참조할 1920×1080 고정 캔버스 규격

- [ ] **Step 1: Replace the reference-resolution section**

`docs/experience/SCREEN_LAYOUT.md`의 「기준 해상도」 절에서 표를 다음으로 바꾼다.

```markdown
| 기준 | 값 |
| --- | --- |
| 고정 캔버스 | 1920×1080 (16:9) |
| 창 대응 | 캔버스를 균일 확대·축소하고 남는 공간은 레터박스 |
```

이어지는 「최소 지원 아래에서는 세로 스크롤을 허용하되 가로 스크롤은 만들지 않는다」 문단을 다음 취지의 문단으로 교체한다. 화면은 창 크기와 무관하게 늘 같은 1920×1080 그림이고, 창이 작으면 배치를 재구성하는 대신 그림 전체가 작아지며, 창 비율이 16:9가 아니면 남는 공간은 검은 레터박스로 남고 캔버스는 가운데 정렬된다. 가로·세로 스크롤은 어떤 창 크기에서도 만들지 않는다.

- [ ] **Step 2: Verify the document checks still pass**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && pnpm test docs/`

Expected: `DOCUMENT_LINKS.test.ts`와 `DOCUMENT_TERMINOLOGY.test.ts`가 통과한다. 링크를 새로 추가하지 않았고 폐기 용어를 쓰지 않았으므로 통과해야 한다.

- [ ] **Step 3: Commit the document change**

```bash
git add docs/experience/SCREEN_LAYOUT.md docs/superpowers/specs/2026-08-22-sbh3821-fixed-aspect-canvas-design.md docs/superpowers/plans/2026-08-22-sbh3821-fixed-aspect-canvas.md
git commit -m "문서: 화면 규격을 16:9 고정 캔버스로 정의한다" -m "기준 해상도와 최소 지원 대신 1920×1080 고정 캔버스와 레터박스 규격을 기록하고, 설계와 구현 계획 문서를 추가한다."
```

## Task 2: Build the canvas and letterbox shell

**Files:**
- Create: `components/game/FixedCanvas.test.ts`
- Modify: `app/globals.css:30-40,80-95`
- Modify: `app/layout.tsx:18-24`
- Modify: `app/page.tsx:11`

**Interfaces:**
- Consumes: `app/layout.tsx`의 `<body>` 트리
- Produces: `.game-canvas` 크기 컨테이너(`container-name: game`)와 그 안에서 `100%`로 해석되는 캔버스 높이

- [ ] **Step 1: Add the failing fixed-canvas contract test**

`components/game/FixedCanvas.test.ts`를 만든다.

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function css(name: string): string {
  return readFileSync(join(process.cwd(), "app", name), "utf8");
}

describe("16:9 고정 캔버스", () => {
  it("루트 글꼴 크기가 창에 맞춘 축척을 만든다", () => {
    expect(css("globals.css")).toContain("min(100vw / 120, 100vh / 67.5)");
  });

  it("캔버스는 1920x1080 비율의 크기 컨테이너다", () => {
    const sheet = css("globals.css");

    expect(sheet).toContain(".game-canvas");
    expect(sheet).toContain("width: 120rem");
    expect(sheet).toContain("height: 67.5rem");
    expect(sheet).toContain("container-type: size");
    expect(sheet).toContain("container-name: game");
  });

  it("남는 공간은 가운데 정렬된 레터박스로 남는다", () => {
    const sheet = css("globals.css");

    expect(sheet).toContain("place-content: center");
    expect(sheet).toContain("overflow: hidden");
  });

  it("레이아웃이 모든 화면을 캔버스로 감싼다", () => {
    const layout = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8");

    expect(layout).toContain('className="game-canvas"');
  });
});
```

- [ ] **Step 2: Run the new test to confirm it fails**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && pnpm test components/game/FixedCanvas.test.ts`

Expected: FAIL. `.game-canvas`도 축척 규칙도 아직 없다.

- [ ] **Step 3: Define the scale, letterbox, and canvas in globals.css**

`app/globals.css`의 `@theme` 블록 바로 뒤, 기존 `.game-shell` 규칙 앞에 넣는다.

```css
/*
 * 16:9 고정 캔버스.
 *
 * 루트 글꼴 크기가 축척이다. 120 × 16px = 1920, 67.5 × 16px = 1080 이므로
 * 창이 1920×1080 일 때 16px 이 되고, 그보다 작거나 크면 rem 으로 쓴 모든
 * 값이 같은 비율로 함께 움직인다. 비트맵을 늘리는 것이 아니라 레이아웃을
 * 다시 계산하므로 어떤 배율에서도 글자가 선명하다.
 */
html {
  font-size: min(100vw / 120, 100vh / 67.5);
}

body {
  display: grid;
  place-content: center;
  overflow: hidden;
  background: #000;
}

.game-canvas {
  width: 120rem;
  height: 67.5rem;
  overflow: hidden;
  container-type: size;
  container-name: game;
}
```

`<body>`의 Tailwind 클래스가 `min-h-screen`으로 최소 높이를 이미 주므로 `min-height`를 CSS에서 다시 쓰지 않는다.

- [ ] **Step 4: Convert structural viewport heights to canvas heights**

`app/globals.css`에서 두 곳을 바꾼다.

```css
.game-shell {
  min-height: 100%;   /* was: 100vh */
}

.game-shell__body {
  min-height: calc(100% - 4.75rem);   /* was: calc(100vh - 4.75rem) */
}
```

- [ ] **Step 5: Wrap every screen in the canvas**

`app/layout.tsx`의 `<body>` 내부를 바꾼다.

```tsx
<body className="min-h-screen bg-ink font-sans text-parchment antialiased">
  <div className="game-canvas">{children}</div>
</body>
```

- [ ] **Step 6: Make the placeholder page follow the canvas height**

`app/page.tsx`의 `<main>` 클래스에서 `min-h-screen`을 `min-h-full`로 바꾼다. 캔버스가 높이를 정하므로 창 높이를 참조하면 안 된다.

- [ ] **Step 7: Run the focused checks**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && pnpm test components/game/FixedCanvas.test.ts && pnpm typecheck`

Expected: 새 테스트 4개가 모두 통과하고 타입 검사가 통과한다.

- [ ] **Step 8: Commit the canvas shell**

```bash
git add app/globals.css app/layout.tsx app/page.tsx components/game/FixedCanvas.test.ts
git commit -m "기능: 화면을 16:9 고정 캔버스에 담는다" -m "루트 글꼴 크기로 축척을 만들고 1920×1080 캔버스를 가운데 정렬한다. 남는 공간은 검은 레터박스로 남긴다."
```

## Task 3: Collapse the window-responsive media queries

**Files:**
- Modify: `app/globals.css:132,341`
- Modify: `app/u2-intro.css:312`
- Modify: `app/u3-board.css:645`
- Modify: `app/u3-card-theme.css:262`
- Modify: `app/u3-large-screen.css:15,282`
- Modify: `app/u3-responsive-layout.css:253,262,408`
- Modify: `components/game/FixedCanvas.test.ts`
- Modify: `components/game/U3Assets.test.ts:50-58,72-79,105-116`

**Interfaces:**
- Consumes: Task 2의 고정 캔버스
- Produces: 미디어 쿼리가 없는 CSS. 1920×1080에서 켜지던 규칙만 남는다.

- [ ] **Step 1: Add the failing no-media-query assertion**

`components/game/FixedCanvas.test.ts`에 추가한다.

```ts
import { readdirSync } from "node:fs";

it("고정 비율 화면에는 창 반응형 미디어 쿼리가 없다", () => {
  const offenders = readdirSync(join(process.cwd(), "app"))
    .filter((name) => name.endsWith(".css"))
    .filter((name) => css(name).includes("@media"));

  expect(offenders).toEqual([]);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && pnpm test components/game/FixedCanvas.test.ts`

Expected: FAIL. 미디어 쿼리 10개가 남아 있다고 보고한다.

- [ ] **Step 3: Delete the always-false blocks**

1920×1080 캔버스에서 조건이 거짓인 블록을 통째로 지운다. 중괄호 짝과 뒤따르는 빈 줄까지 함께 지운다.

| 파일 | 조건 |
| --- | --- |
| `app/globals.css` | `@media (max-width: 40rem)` 두 곳 |
| `app/u2-intro.css` | `@media (max-width: 68rem)` |
| `app/u3-board.css` | `@media (max-width: 64rem)` |
| `app/u3-card-theme.css` | `@media (max-width: 64rem)` |
| `app/u3-responsive-layout.css` | `@media (max-height: 54rem)`, `@media (max-height: 46rem)` |

- [ ] **Step 4: Unwrap the always-true blocks in place**

`app/u3-large-screen.css`의 `@media (min-width: 90rem)`과 `@media (min-width: 120rem)`, `app/u3-responsive-layout.css`의 `@media (min-width: 90rem)`에서 감싸개 한 줄과 닫는 중괄호만 제거하고 내부 규칙은 **자리를 옮기지 않는다.** 들여쓰기를 한 단계 줄인다. 각 자리에 왜 그 규칙이 거기 있는지 남기는 주석을 붙인다.

```css
/* 1920×1080 캔버스에서 항상 적용되던 대화면 고밀도 규칙. 고정 비율이 되면서 기본값이 되었다. */
```

- [ ] **Step 5: Update the U3 CSS-contract expectations**

`components/game/U3Assets.test.ts`에서 사라진 문자열을 단정하는 곳을 고친다.

- `1440px 이상에서는 던전 장면과 계약 CTA가 함께 확대된다` → 제목을 `던전 장면과 계약 CTA 크기는 캔버스 기준으로 고정한다`로 바꾸고 `expect(css).toContain("@media (min-width: 90rem)")` 줄을 지운다. 나머지 선택자와 `clamp()` 기대값은 그대로 둔다.
- `노트북처럼 세로가 짧은 화면에서는 높이 기준으로 공고와 계약 패널을 압축한다` → 제목을 `공고와 계약 패널의 행 분배를 캔버스 기준으로 고정한다`로 바꾸고, `@media (max-height: 54rem)`·`@media (max-height: 46rem)`·`width: min(100%, clamp(7.5rem, 17vh, 10.5rem))` 기대값을 지운다. `import "./u3-responsive-layout.css"`, `grid-template-rows: auto minmax(0, 1fr) auto auto`, `min-height: 0` 기대값은 남긴다.

- [ ] **Step 6: Run the focused checks**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && pnpm test components/game/FixedCanvas.test.ts components/game/U3Assets.test.ts`

Expected: 두 파일의 모든 테스트가 통과한다.

- [ ] **Step 7: Commit the media-query cleanup**

```bash
git add app/globals.css app/u2-intro.css app/u3-board.css app/u3-card-theme.css app/u3-large-screen.css app/u3-responsive-layout.css components/game/FixedCanvas.test.ts components/game/U3Assets.test.ts
git commit -m "정리: 창 반응형 미디어 쿼리를 걷어낸다" -m "1920×1080 캔버스에서 켜지던 대화면 규칙을 제자리에서 기본값으로 남기고, 켜질 수 없게 된 폭·높이 압축 블록을 지운다."
```

## Task 4: Move sizing units onto the canvas

**Files:**
- Modify: `app/u2-intro.css:3`
- Modify: `app/u3-board.css:3,13`
- Modify: `app/u2-intro.css`, `app/u3-board.css`, `app/u3-card-theme.css`, `app/u3-u2-status-sync.css`, `app/u3-large-screen.css`, `app/u3-responsive-layout.css` 의 모든 `vw`·`vh`
- Modify: `components/game/FixedCanvas.test.ts`
- Modify: `components/game/U3Assets.test.ts:79,121`

**Interfaces:**
- Consumes: Task 2의 `container-name: game` 크기 컨테이너
- Produces: 창이 아니라 캔버스를 기준으로 계산되는 모든 크기 값

- [ ] **Step 1: Add the failing unit assertion**

`components/game/FixedCanvas.test.ts`에 추가한다.

```ts
it("크기 계산은 창이 아니라 캔버스를 기준으로 한다", () => {
  const offenders = readdirSync(join(process.cwd(), "app"))
    .filter((name) => name.endsWith(".css"))
    .filter((name) => /\d(vw|vh)\b/.test(css(name).replace(/min\(100vw \/ 120, 100vh \/ 67\.5\)/, "")));

  expect(offenders).toEqual([]);
});
```

루트 축척 한 줄만 예외다. 그 값이 창 크기를 읽어야 캔버스가 창에 맞춰 커진다.

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && pnpm test components/game/FixedCanvas.test.ts`

Expected: FAIL. `vw`·`vh`가 남은 CSS 파일 목록을 보고한다.

- [ ] **Step 3: Convert structural heights**

`app/u2-intro.css:3`의 `height: 100vh`, `app/u3-board.css:3`과 `:13`의 `height: 100vh`를 `height: 100%`로 바꾼다.

- [ ] **Step 4: Replace the sizing units**

Task 3에서 미디어 쿼리를 정리한 뒤, 남은 `vw` → `cqw`, `vh` → `cqh` 로 치환한다. `app/globals.css`의 루트 축척 한 줄은 제외한다.

```bash
cd /Users/semin/Develop/Dungeon_Schemer
for f in app/u2-intro.css app/u3-board.css app/u3-card-theme.css app/u3-u2-status-sync.css app/u3-large-screen.css app/u3-responsive-layout.css; do
  perl -pi -e 's/(?<=[\d.])vw\b/cqw/g; s/(?<=[\d.])vh\b/cqh/g' "$f"
done
```

`app/globals.css`는 스크립트로 건드리지 않는다. 루트 축척 줄을 깨뜨릴 수 있고, 이 파일에는 치환 대상 `vh`가 없다.

숫자는 바꾸지 않는다. 캔버스가 `120rem × 67.5rem`이라 `1cqw = 1.2rem`, `1cqh = 0.675rem`이고, 이는 1920×1080 창에서의 `1vw`·`1vh`와 같다.

- [ ] **Step 5: Update the remaining U3 unit expectations**

`components/game/U3Assets.test.ts`에서 단위가 바뀐 두 기대값을 고친다.

- `공고의 남는 공간은 장면 행에만 배분한다`: `font-size: clamp(0.78rem, 0.68vw, 1rem);` → `font-size: clamp(0.78rem, 0.68cqw, 1rem);`
- `반응형 텍스트는 vw와 vh를 함께 사용하고 명성·골드 라벨을 크게 유지한다`: 제목을 `크기 계산은 캔버스 가로·세로를 함께 사용하고 명성·골드 라벨을 크게 유지한다`로 바꾸고 `calc(0.68rem + 0.18vw + 0.12vh)` → `calc(0.68rem + 0.18cqw + 0.12cqh)`.

`1440px 이상에서는...`을 고친 테스트의 `clamp(13rem, 15vw, 24rem)` 등 세 기대값도 `cqw`로 바꾼다.

- [ ] **Step 6: Run the focused checks**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && pnpm test components/game/FixedCanvas.test.ts components/game/U3Assets.test.ts && pnpm lint`

Expected: 두 파일의 모든 테스트와 lint가 통과한다.

- [ ] **Step 7: Commit the unit conversion**

```bash
git add app/u2-intro.css app/u3-board.css app/u3-card-theme.css app/u3-u2-status-sync.css app/u3-large-screen.css app/u3-responsive-layout.css components/game/FixedCanvas.test.ts components/game/U3Assets.test.ts
git commit -m "수정: 크기 계산 기준을 창에서 캔버스로 옮긴다" -m "vw·vh 를 캔버스 컨테이너 단위 cqw·cqh 로 치환하고 화면 높이를 캔버스 높이로 바꾼다. 캔버스가 1920×1080 이므로 계산 결과값은 바뀌지 않는다."
```

## Task 5: Scale the density-bearing px values

**Files:**
- Modify: `app/u3-board.css:131,135,136,177,195,214,587`
- Modify: `app/u2-intro.css:21,107`
- Modify: `app/u3-u2-status-sync.css:9`
- Modify: `components/game/FixedCanvas.test.ts`

**Interfaces:**
- Consumes: Task 2의 `rem` 축척
- Produces: 판 크기에 비례하는 나뭇결 밀도와 그림자 번짐

- [ ] **Step 1: Add the failing density assertions**

`components/game/FixedCanvas.test.ts`에 추가한다.

```ts
it("게시판 나뭇결은 판과 함께 커진다", () => {
  const sheet = css("u3-board.css");

  expect(sheet).toContain("#321d10 0.5rem 0.8125rem");
  expect(sheet).not.toContain("#321d10 8px 13px");
});

it("번짐이 큰 그림자는 축척을 따른다", () => {
  const offenders = readdirSync(join(process.cwd(), "app"))
    .filter((name) => name.endsWith(".css"))
    .flatMap((name) =>
      (css(name).match(/box-shadow:[^;]+;/g) ?? [])
        .flatMap((rule) => rule.match(/\d+px/g) ?? [])
        .filter((value) => Number.parseInt(value, 10) >= 12)
        .map((value) => `${name}: ${value}`),
    );

  expect(offenders).toEqual([]);
});
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && pnpm test components/game/FixedCanvas.test.ts`

Expected: FAIL. 나뭇결이 아직 `8px 13px`이고, `12px` 이상 번짐 10곳이 보고된다.

- [ ] **Step 3: Convert the wood grain period**

`app/u3-board.css:131`을 바꾼다. 게시판 목재 질감이라 주기가 고정되면 판이 커질수록 결이 촘촘해 보인다.

```css
repeating-linear-gradient(0deg, #382313 0 0.25rem, #2b190f 0.25rem 0.5rem, #321d10 0.5rem 0.8125rem);
```

- [ ] **Step 4: Convert the wide shadow layers**

번짐 반경이 `12px` 이상인 그림자 층만 바꾼다. **`inset 0 0 0 Npx` 형태의 링(번짐 0)은 건드리지 않는다.** 같은 선언 안에 링과 번짐이 섞여 있으므로 층 단위로 본다.

| 위치 | 현재 | 변경 |
| --- | --- | --- |
| `app/u2-intro.css:21` | `0 2px 12px` | `0 0.125rem 0.75rem` |
| `app/u2-intro.css:107` | `inset 0 0 80px` | `inset 0 0 5rem` |
| `app/u3-board.css:27` | `0 2px 12px` | `0 0.125rem 0.75rem` |
| `app/u3-board.css:135` | `inset 0 0 38px` | `inset 0 0 2.375rem` |
| `app/u3-board.css:136` | `0 4px 18px` | `0 0.25rem 1.125rem` |
| `app/u3-board.css:177` | `inset 0 0 20px` | `inset 0 0 1.25rem` |
| `app/u3-board.css:195` | `0 5px 14px` | `0 0.3125rem 0.875rem` |
| `app/u3-board.css:214` | `0 0 14px` | `0 0 0.875rem` |
| `app/u3-board.css:587` | `0 0 12px` | `0 0 0.75rem` |
| `app/u3-u2-status-sync.css:9` | `0 2px 12px` | `0 0.125rem 0.75rem` |

`app/u3-board.css:195`·`:214`·`:587`은 한 줄에 링 두 개와 번짐 한 개가 함께 있다. 마지막 층만 바꾼다.

- [ ] **Step 5: Run the focused checks**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && pnpm test components/game/FixedCanvas.test.ts components/game/U3Assets.test.ts`

Expected: 두 파일의 모든 테스트가 통과한다.

- [ ] **Step 6: Commit the density fix**

```bash
git add app/u3-board.css app/u2-intro.css app/u3-u2-status-sync.css components/game/FixedCanvas.test.ts
git commit -m "수정: 나뭇결과 큰 그림자를 축척에 맞춘다" -m "게시판 목재 결 주기와 번짐 12px 이상인 그림자 층을 rem 으로 옮겨 판 크기에 비례하게 한다. 1px 테두리와 링 장식은 선명함을 위해 픽셀로 남긴다."
```

## Task 6: Verify the fixed canvas in a browser

**Files:**
- Verify: `app/globals.css`
- Verify: `app/layout.tsx`
- Verify: `app/u3-large-screen.css`
- Verify: `app/u3-responsive-layout.css`

**Interfaces:**
- Consumes: Task 1~5의 커밋
- Produces: 네 가지 창 비율에서 동일한 화면임을 확인한 기록

- [ ] **Step 1: Run the full automated checks**

```bash
cd /Users/semin/Develop/Dungeon_Schemer
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Expected: 네 명령이 모두 종료 코드 0이다. `pnpm backtest`는 실행하지 않는다. 이번 변경은 캠페인 규칙, 전이 로직, 밸런스 상수, `lib/backtest`를 건드리지 않는다.

- [ ] **Step 2: Start the dev server**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && pnpm dev`

Expected: Next.js가 `http://localhost:3000`에서 계속 실행된다.

- [ ] **Step 3: Check each screen inside the canvas**

```bash
agent-browser open http://127.0.0.1:3000/u3-test
agent-browser wait 3000
agent-browser screenshot --annotate
agent-browser eval 'JSON.stringify({canvas: (() => { const c = document.querySelector(".game-canvas"); if (!c) return null; const r = c.getBoundingClientRect(); return {w: Math.round(r.width), h: Math.round(r.height), ratio: +(r.width / r.height).toFixed(4), left: Math.round(r.left), top: Math.round(r.top)}; })(), overflowX: document.documentElement.scrollWidth > window.innerWidth, overflowY: document.documentElement.scrollHeight > window.innerHeight, errorOverlay: Boolean(document.querySelector("[data-nextjs-dialog]"))})'
agent-browser snapshot -i
```

Expected: `ratio`가 `1.7778`이고, 캔버스가 창 안에 들어가며, `overflowX`와 `overflowY`가 모두 false, 오류 overlay가 없다. `/u1-test`, `/u2-test`, `/`에 대해 같은 확인을 반복한다.

- [ ] **Step 4: Compare the four window ratios**

1920×1080, 2560×1440, 1440×900, 1280×1024에서 `/u3-test`를 각각 확인한다.

Expected:
- 1920×1080과 2560×1440(둘 다 16:9)에서 레터박스 띠가 없고 캔버스가 창을 정확히 채운다.
- 1440×900(16:10)에서 위아래에 검은 띠가 생기고 캔버스의 `left`가 0이다.
- 1280×1024(5:4)에서 위아래 띠가 더 두껍고 캔버스가 세로 가운데에 온다.
- 네 크기의 스크린샷에서 공고 5장·우측 상세·상단 상태 바의 줄바꿈과 상대 배치가 서로 같다. 배율만 다르다.
- 어느 크기에서도 가로·세로 스크롤바가 없다.

- [ ] **Step 5: Close only the browser session**

Run: `agent-browser close`

Expected: 브라우저만 닫히고 `pnpm dev`는 3000 포트에서 계속 실행된다.

- [ ] **Step 6: Confirm repository state**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && git status --short --branch && git log -5 --oneline --decorate`

Expected: 작업 트리가 깨끗하고 문서·캔버스·미디어 쿼리 정리·단위 치환·밀도 보정 커밋이 순서대로 있다.
