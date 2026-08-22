# 전체 캔버스 화면 루트 계약 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존·신규 UI의 최상위 화면 루트가 특별한 예외가 없는 한 1920×1080 고정 캔버스 전체를 자동으로 점유하게 한다.

**Architecture:** `.game-canvas`의 일반 직계 자식에 폭·높이 100%를 부여해 모든 라우트에 기본 계약을 적용하고, `data-canvas-layout="intrinsic"`만 승인된 예외로 둔다. 기존 U1의 브라우저 높이 의존성과 U2·U4의 중복 루트 크기 선언을 제거하며, 정적 회귀 테스트와 실제 Chromium 치수 측정으로 계약을 검증한다.

**Tech Stack:** Next.js 16.3, React 19, TypeScript, Tailwind CSS 4, Vitest 4, CSS container units, Chromium DevTools Protocol

**Spec:** `docs/superpowers/specs/2026-08-22-sbh3821-full-canvas-screen-root-design.md`

## Global Constraints

- 일반 화면의 최상위 루트는 1920×1080 캔버스의 폭과 높이를 모두 점유한다.
- 화면 내부의 의도적인 여백, 패널 크기, 배경 구도는 유지한다.
- 전체 점유 예외는 `data-canvas-layout="intrinsic"`, 승인된 spec, 화면별 테스트, 회귀 테스트 허용 목록을 모두 요구한다.
- 현재 승인된 예외는 없다.
- `GameShell`의 3:2(60:40) 열 비율과 상태 바 높이는 변경하지 않는다.
- 새 `vw`·`vh`, 미디어 쿼리, 화면별 중복 루트 크기 규칙을 추가하지 않는다.
- 도메인 규칙, 캠페인 상태, 보상 수치, 이미지·아이콘·CTA 디자인을 변경하지 않는다.
- 커밋 제목과 본문은 한글로 작성한다.

---

## 파일 구조

- `app/globals.css`: 모든 캔버스 직계 화면 루트에 적용하는 유일한 전체 점유 규칙과 U1 내부 높이 배분을 소유한다.
- `components/game/U1Preview.tsx`: 브라우저 `100vh`와 폭 미디어 쿼리를 만드는 `min-h-screen`·`sm:` 유틸리티를 제거한다.
- `components/game/U4Preview.tsx`: 공통 계약과 중복되는 인라인 높이 선언을 제거한다.
- `app/u2-intro.css`: 공통 계약과 중복되는 `.u2-preview` 크기 선언을 제거하고 인트로 내부 규칙만 유지한다.
- `app/u4-dungeon-map.css`: U4 피드백의 위치 기준에 필요한 루트 `position`만 소유한다.
- `components/game/FixedCanvas.test.ts`: 공통 직계 자식 규칙, 승인되지 않은 예외, 캔버스 내부 `min-h-screen` 금지를 검사한다.
- `docs/DOCUMENT_TERMINOLOGY.test.ts`: 공식 화면 규격에 전체 점유 계약이 남아 있는지 확인한다.
- `docs/experience/SCREEN_LAYOUT.md`: 전체 점유의 공식 구조 규칙과 예외 조건을 정의한다.
- `docs/experience/UI_IMPLEMENTATION_GUIDE.md`: 새 UI 구현자가 따라야 할 루트 작성·금지·검증 절차를 정의한다.
- `docs/experience/UI_TASK_TEMPLATE.md`: 개별 UI 작업 지시서의 필수 전체 점유 검증 항목을 제공한다.

---

### Task 1: 공식 문서에 화면 루트 전체 점유 계약 고정

**Files:**
- Modify: `docs/DOCUMENT_TERMINOLOGY.test.ts`
- Modify: `docs/experience/SCREEN_LAYOUT.md`
- Modify: `docs/experience/UI_IMPLEMENTATION_GUIDE.md`
- Modify: `docs/experience/UI_TASK_TEMPLATE.md`

**Interfaces:**
- Consumes: 승인된 spec의 일반 화면 전체 점유, 내부 여백 허용, 명시적 예외 조건
- Produces: 구현과 향후 UI 작업이 참조하는 공식 문구 `화면 루트`, `전체 점유`, `data-canvas-layout="intrinsic"`

- [ ] **Step 1: 공식 문서 앵커의 실패 테스트 작성**

`docs/DOCUMENT_TERMINOLOGY.test.ts`의 `experience/SCREEN_LAYOUT.md` 필수 앵커를 다음처럼 확장한다.

```ts
"experience/SCREEN_LAYOUT.md": [
  "3:2",
  "1920×1080",
  "레터박스",
  "화면 루트",
  "전체 점유",
  "data-canvas-layout",
  "색만으로",
],
```

- [ ] **Step 2: 문서 테스트가 새 계약 부재로 실패하는지 확인**

Run: `pnpm test docs/DOCUMENT_TERMINOLOGY.test.ts`

Expected: FAIL. `SCREEN_LAYOUT.md`에 `화면 루트`, `전체 점유`, `data-canvas-layout` 중 하나 이상이 없어 필수 앵커 검사가 실패한다.

- [ ] **Step 3: `SCREEN_LAYOUT.md`에 공식 전체 점유 규칙 추가**

「고정 캔버스」 절의 레터박스 설명 다음에 `### 화면 루트의 캔버스 점유` 하위 절을 추가한다. 다음 내용을 모두 명시한다.

```markdown
### 화면 루트의 캔버스 점유

고정 캔버스를 만드는 것과 그 안의 화면 루트가 캔버스 전체를 쓰는 것은 서로
다른 계약이다. 일반 화면의 최상위 DOM 요소는 `.game-canvas`의 폭과 높이를
전부 점유한다. 내부 패널, 배경, 카드에 의도적인 여백을 두는 것은 허용하지만,
그 여백 때문에 화면 루트 자체의 크기를 줄이지 않는다.

전체 점유가 화면 의도와 충돌하는 승인된 예외만 최상위 요소에
`data-canvas-layout="intrinsic"`을 선언할 수 있다. 예외는 해당 화면 spec에 이유와
기대 크기를 기록하고 화면별 테스트와 고정 캔버스 테스트의 허용 목록에 함께
등록한다. 단순한 내부 여백이나 작은 패널은 예외 사유가 아니다.
```

- [ ] **Step 4: UI 구현 가이드에 신규 화면 작성 규칙 추가**

`docs/experience/UI_IMPLEMENTATION_GUIDE.md`의 「고정 캔버스 규칙」에 다음 항목을 추가한다.

```markdown
- 페이지는 가능한 한 단일 최상위 DOM 요소를 반환한다. 이 화면 루트는 공통
  캔버스 규칙으로 폭·높이 100%를 자동 상속한다.
- 화면 루트에 `min-h-screen`, `100vh`, 화면별 `height: 100%`를 반복해서 쓰지
  않는다. 브라우저가 아니라 `.game-canvas`가 화면 크기의 기준이다.
- 내부의 의도적인 여백은 허용한다. 전체 점유는 내부 요소를 화면 끝까지
  늘리라는 뜻이 아니다.
- 전체 점유가 아닌 화면은 승인된 spec과 테스트를 먼저 마련하고 최상위 요소에
  `data-canvas-layout="intrinsic"`을 명시한다.
```

구현 전 체크리스트에 다음 항목을 추가한다.

```markdown
- [ ] 화면 루트가 공통 1920×1080 전체 점유 계약을 따르며 승인되지 않은 예외가 없다.
```

구현 후 검증 또는 완료 조건에 다음 항목을 추가한다.

```markdown
- [ ] `.game-canvas`와 화면 루트의 실제 폭·높이가 같다.
```

- [ ] **Step 5: UI 작업 템플릿에 전체 점유 검증 추가**

`docs/experience/UI_TASK_TEMPLATE.md`의 「13. 고정 캔버스 요구사항」에 다음 문단을 추가한다.

```markdown
화면의 최상위 DOM 요소는 네 viewport 모두에서 `.game-canvas`와 같은 실제
폭·높이를 가져야 한다. 내부 패널과 배경의 의도적인 여백은 허용하며, 내부
요소를 무조건 화면 끝까지 늘리는 요구가 아니다. 전체 점유 예외가 필요하면
구현 전에 별도 spec과 테스트에서 이유와 기대 크기를 승인받는다.
```

「16. 구현 및 검증」에 다음 체크 항목을 추가한다.

```markdown
- [ ] `.game-canvas`와 최상위 화면 루트의 실제 폭·높이 일치 확인
```

- [ ] **Step 6: 문서 계약 테스트 통과 확인**

Run: `pnpm test docs/DOCUMENT_TERMINOLOGY.test.ts`

Expected: PASS.

- [ ] **Step 7: 문서 변경 커밋**

```bash
git add docs/DOCUMENT_TERMINOLOGY.test.ts docs/experience/SCREEN_LAYOUT.md docs/experience/UI_IMPLEMENTATION_GUIDE.md docs/experience/UI_TASK_TEMPLATE.md
git commit -m "문서: 화면 루트의 전체 캔버스 점유를 규정한다" -m "기존 화면과 앞으로 추가할 UI가 1920×1080 화면 루트를 기본으로 사용하도록 공식 화면 규격, 구현 가이드, 작업 템플릿과 문서 검사를 갱신한다."
```

---

### Task 2: 공통 전체 점유 규칙과 기존 화면 회귀 테스트 구현

**Files:**
- Modify: `components/game/FixedCanvas.test.ts`
- Modify: `app/globals.css`
- Modify: `components/game/U1Preview.tsx`
- Modify: `components/game/U4Preview.tsx`
- Modify: `app/u2-intro.css`
- Modify: `app/u4-dungeon-map.css`

**Interfaces:**
- Consumes: Task 1의 공식 `data-canvas-layout="intrinsic"` 예외 계약
- Produces: `.game-canvas > :not([data-canvas-layout="intrinsic"])` 공통 CSS 계약과 현재 예외 0개 상태

- [ ] **Step 1: 전체 점유와 금지 패턴의 실패 테스트 작성**

`components/game/FixedCanvas.test.ts`에 `app`과 `components/game` 아래의 TSX 소스를
재귀적으로 수집할 다음 helper를 추가한다.

```ts
function uiSources(): Array<{ name: string; source: string }> {
  return ["app", join("components", "game")].flatMap((root) => {
    const absoluteRoot = join(process.cwd(), root);

    return readdirSync(absoluteRoot, { recursive: true })
      .filter((name) => name.endsWith(".tsx"))
      .map((name) => {
        const relativeName = join(root, name);

        return {
          name: relativeName,
          source: readFileSync(join(process.cwd(), relativeName), "utf8"),
        };
      });
  });
}
```

같은 describe 블록에 다음 테스트를 추가한다.

```ts
it("일반 화면 루트는 캔버스 전체를 점유한다", () => {
  const sheet = css("globals.css");

  expect(sheet).toContain(
    '.game-canvas > :not([data-canvas-layout="intrinsic"])',
  );
  expect(sheet).toMatch(
    /\.game-canvas > :not\(\[data-canvas-layout="intrinsic"\]\)\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*min-width:\s*0;[^}]*min-height:\s*0;/s,
  );
});

it("현재 승인된 intrinsic 화면 예외는 없다", () => {
  const offenders = uiSources()
    .filter(({ source }) => source.includes('data-canvas-layout="intrinsic"'))
    .map(({ name }) => name);

  expect(offenders).toEqual([]);
});

it("캔버스 내부 화면은 브라우저 높이를 요구하지 않는다", () => {
  const offenders = uiSources()
    .filter(({ name }) => name !== join("app", "layout.tsx"))
    .filter(({ source }) => source.includes("min-h-screen"))
    .map(({ name }) => name);

  expect(offenders).toEqual([]);
});
```

- [ ] **Step 2: 고정 캔버스 테스트가 현재 U1·U3 문제로 실패하는지 확인**

Run: `pnpm test components/game/FixedCanvas.test.ts`

Expected: FAIL. 공통 직계 자식 선택자가 없고 `U1Preview.tsx`가 `min-h-screen`을 포함한다.

- [ ] **Step 3: 공통 캔버스 직계 자식 규칙 구현**

`app/globals.css`의 `.game-canvas` 블록 바로 다음에 다음 주석과 규칙을 추가한다.

```css
/*
 * 화면 루트는 기본적으로 고정 캔버스 전체를 쓴다.
 * 내부 여백은 각 화면이 정하되 루트 높이를 화면마다 다시 선언하지 않는다.
 * 승인된 intrinsic 예외만 spec과 테스트를 갖춘 뒤 이 기본값에서 빠질 수 있다.
 */
.game-canvas > :not([data-canvas-layout="intrinsic"]) {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}
```

- [ ] **Step 4: U1의 브라우저 높이 의존성과 내부 높이 넘침 제거**

`components/game/U1Preview.tsx`의 최상위 class에서 `min-h-screen`과 `sm:` 미디어
쿼리를 제거하고 1920 기준에서 활성화되던 padding을 고정한다.

```tsx
<div className="u1-preview u1-preview__reference-frame p-6">
```

`app/globals.css`의 U1 프리뷰 규칙 앞에 남은 높이를 `GameShell`에 배분하는 규칙을 추가한다.

```css
.u1-preview {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  min-height: 0;
}

.u1-preview > .game-shell {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
```

기존 탐색 행, eyebrow, `GameShell`의 순서와 내부 3:2 구조는 변경하지 않는다.

- [ ] **Step 5: U2·U4의 중복 루트 크기 선언 제거**

`app/u2-intro.css`에서 `.u2-preview` 전체 블록을 제거한다.

```css
/* 삭제 대상 */
.u2-preview {
  width: 100%;
  height: 100%;
  min-height: 0;
}
```

`.u2-intro-shell`부터 시작하는 인트로 내부 높이와 구도는 그대로 둔다.

`components/game/U4Preview.tsx`의 최상위 인라인 style에서 `height`와 `minHeight`를
제거하고 style prop 자체를 없앤다.

```tsx
<div className="u4-preview">
```

`app/u4-dungeon-map.css` 맨 앞에 피드백의 absolute 위치 기준만 추가한다.

```css
.u4-preview {
  position: relative;
}
```

- [ ] **Step 6: 집중 회귀 테스트 통과 확인**

Run: `pnpm test components/game/FixedCanvas.test.ts components/game/U1Preview.test.ts components/game/U2Preview.test.ts components/game/U3BoardScreen.test.ts components/game/U4Preview.test.ts`

Expected: PASS.

- [ ] **Step 7: 레이아웃 변경 커밋**

```bash
git add components/game/FixedCanvas.test.ts app/globals.css components/game/U1Preview.tsx components/game/U4Preview.tsx app/u2-intro.css app/u4-dungeon-map.css
git commit -m "기능: 모든 화면 루트가 고정 캔버스를 채우게 한다" -m "캔버스 직계 화면에 전체 폭과 높이를 기본 적용하고 U1의 브라우저 높이 의존성 및 U2·U4의 중복 크기 선언을 제거한다. 승인된 intrinsic 예외와 회귀 검사도 함께 고정한다."
```

---

### Task 3: 전체 자동 검증과 실제 Chromium 치수 확인

**Files:**
- Verify: `app/globals.css`
- Verify: `components/game/U1Preview.tsx`
- Verify: `app/u2-intro.css`
- Verify: `components/game/FixedCanvas.test.ts`
- Verify: `docs/experience/SCREEN_LAYOUT.md`
- Verify: `docs/experience/UI_IMPLEMENTATION_GUIDE.md`
- Verify: `docs/experience/UI_TASK_TEMPLATE.md`

**Interfaces:**
- Consumes: Task 1의 공식 문서 계약과 Task 2의 공통 CSS 계약
- Produces: 다섯 기존 라우트의 전체 캔버스 점유 증거, production build, 사용자 확인용 로컬 링크

- [ ] **Step 1: 전체 정적 검증 실행**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`

Expected: lint 오류 0개, TypeScript 오류 0개, 모든 Vitest 테스트 통과, Next.js production build 성공.

- [ ] **Step 2: production 서버 실행**

Run: `pnpm start -- --hostname 127.0.0.1 --port 3100`

Expected: `http://127.0.0.1:3100`에서 Next.js production 서버가 실행된다. 이미 3100 포트를 사용 중이면 실행 중인 이 작업의 서버인지 확인하고, 다른 프로세스라면 3101부터 비어 있는 포트를 사용한다.

- [ ] **Step 3: 네 viewport에서 다섯 라우트의 실제 치수 측정**

Chromium DevTools Protocol로 `/`, `/u1-test`, `/u2-test`, `/u3-test`, `/u4-test`를 각각 1920×1080, 2560×1440, 1440×900, 1280×1024로 연다. 각 조합에서 다음 표현식을 실행한다.

```js
(() => {
  const canvas = document.querySelector(".game-canvas");
  const root = canvas?.firstElementChild;
  const canvasRect = canvas?.getBoundingClientRect();
  const rootRect = root?.getBoundingClientRect();

  return {
    canvas: canvasRect && {
      width: canvasRect.width,
      height: canvasRect.height,
    },
    root: rootRect && {
      width: rootRect.width,
      height: rootRect.height,
    },
    sameWidth:
      canvasRect !== undefined &&
      rootRect !== undefined &&
      Math.abs(canvasRect.width - rootRect.width) < 0.1,
    sameHeight:
      canvasRect !== undefined &&
      rootRect !== undefined &&
      Math.abs(canvasRect.height - rootRect.height) < 0.1,
    pageOverflow: {
      horizontal: document.documentElement.scrollWidth > innerWidth,
      vertical: document.documentElement.scrollHeight > innerHeight,
    },
  };
})()
```

Expected: 20개 조합 모두 `sameWidth: true`, `sameHeight: true`, 두 overflow 값 `false`. 1920×1080의 캔버스와 루트는 각각 약 1920×1080이며 U3의 이전 949.41px 높이가 1080px로 늘어난다.

- [ ] **Step 4: 주요 화면의 시각 회귀 확인**

1920×1080에서 `/u1-test`, `/u2-test`, `/u3-test`, `/u4-test` 스크린샷을 확인한다.

Expected:

- U1의 탐색 버튼, eyebrow, `GameShell`이 캔버스 안에 있고 하단이 잘리지 않는다.
- U2의 상태 바, 인트로 카피, 카드, CTA 위치와 배경 구도가 변경 전과 같다.
- U3의 상태 바 아래 게시판·상세 패널이 화면 하단까지 채워지고 3:2 열 비율이 유지된다.
- U4의 지도·파티·목적지 패널이 변경 전 구도와 3:2 열 비율을 유지한다.
- 콘솔 오류와 Next.js 오류 overlay가 없다.

- [ ] **Step 5: 작업 상태와 커밋 범위 확인**

Run: `git status -sb && git log --oneline --decorate -4`

Expected: 계획 체크 표시 외 코드·문서 변경은 모두 의도한 두 구현 커밋에 포함되고, 추적되지 않은 빌드 산출물이나 스크린샷이 저장소에 없다.

- [ ] **Step 6: 사용자에게 로컬 확인 링크 제공**

실행 중인 production 서버 포트를 기준으로 다음 링크를 제공한다.

```text
홈: http://localhost:3100/
U1: http://localhost:3100/u1-test
U2: http://localhost:3100/u2-test
U3: http://localhost:3100/u3-test
U4: http://localhost:3100/u4-test
```

포트가 달라졌다면 네 링크 모두 실제 포트로 바꾼다. 서버 프로세스는 사용자가 확인할 수 있도록 실행 상태로 유지한다.
