# U1 공통 게임 셸·프리뷰 하네스 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 모든 주요 화면이 재사용할 3:1 게임 셸과 다섯 화면을 전환해 검증하는 `/u1-test` 프리뷰 하네스를 만든다.

**Architecture:** `GameShell`은 게임 규칙을 모르는 표시 컴포넌트로 상단 상태 바와 항상 유지되는 3:1 두 열을 렌더링한다. `U1Preview`는 클라이언트 컴포넌트에서 프리뷰 화면 선택만 관리하고, 순수 화면 정의와 fixture를 셸 슬롯에 주입한다. 실제 캠페인 상태·스토어·전이는 U1 범위에 넣지 않는다.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript strict, Tailwind CSS 4, Vitest 4 Node 환경, `react-dom/server` 정적 렌더 검증, 실제 브라우저 자동화.

**Spec:** `docs/superpowers/specs/2026-08-20-sanghwan-yoo-u1-game-shell-design.md`

## Global Constraints

- 본문 grid는 모든 화면·상태·viewport에서 `minmax(0, 3fr) minmax(0, 1fr)`을 유지한다.
- 인트로도 우측 25% 구조적 레일을 렌더링하며 MainContent를 전체 폭으로 확장하지 않는다.
- breakpoint에서 `1fr`, `display: block`, `grid-column: 1 / -1`로 바꾸거나 두 열을 세로로 쌓지 않는다.
- 1280×720 기준과 1024×640 최소 지원에서 가로 스크롤을 만들지 않는다.
- 셸과 두 열 내부에는 `min-width: 0`을 적용하고 긴 문자열은 줄바꿈한다.
- `GameShell`은 도메인 상태·규칙·Zustand·난수·영속화를 직접 읽지 않는다.
- `components/ui/**`의 게임 비의존 경계를 깨지 않고 기존 `Panel`을 재사용한다.
- 색상만으로 상태를 전달하지 않고 텍스트·기호·형태·`aria-*` 속성을 함께 사용한다.
- 화면 선택은 네이티브 button과 `aria-pressed`로 구현한다.
- 새 테스트 의존성은 추가하지 않는다. DOM 상호작용은 실제 브라우저에서 검증한다.
- 작업은 `feature/u1-game-shell`에서 수행하고 `main`에 직접 커밋하지 않는다.
- 모든 커밋 메시지는 제목과 본문을 포함한 한글로 작성한다.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`를 모두 실행한다.

---

## 파일 구조

| 파일 | 책임 |
| --- | --- |
| `components/game/u1-preview-data.ts` | 다섯 프리뷰 화면 ID·레이블·문구·상태 fixture |
| `components/game/u1-preview-data.test.ts` | 프리뷰 화면 수·중복·필수 표시값 계약 |
| `components/game/TopStatusBar.tsx` | 등급·명성·골드·승급·남은 던전 표시 |
| `components/game/GameShell.tsx` | 상태 바, 3:1 grid, MainContent·RightPanel landmark |
| `components/game/GameShell.test.ts` | 정적 HTML로 셸 구조와 상태 문구 검증 |
| `components/game/U1Preview.tsx` | 화면 선택 버튼과 셸 슬롯 연결 |
| `app/u1-test/page.tsx` | `/u1-test` 프리뷰 진입점 |
| `app/globals.css` | 고정 3:1 grid와 overflow 방지 |
| `docs/experience/SCREEN_LAYOUT.md` | 인트로의 우측 레일 규격 |
| `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md` | U1 완료 상태와 후속 선행 |

`app/page.tsx`는 기존 자리 표시 화면으로 유지한다. U1은 별도 프리뷰 라우트만 추가하고 실제 홈 흐름은 U2 또는 통합 작업에서 연결한다.

---

### Task 1: 실행 기준과 Next.js 16 가이드 확인

**Files:**

- Read: `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
- Read: `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- Read: `node_modules/next/dist/docs/03-architecture/accessibility.md`
- Read: `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`

**Interfaces:**

- Consumes: 승인된 spec과 현재 `app/`, `components/ui/`, `app/globals.css`
- Produces: 작업 브랜치와 U1 변경 전 baseline 결과

- [ ] **Step 1: 작업 격리를 준비한다.**

실행 세션 시작 시 `superpowers:using-git-worktrees` 지침을 적용하고 `feature/u1-game-shell` 브랜치를 준비한다. 기존 변경사항은 덮어쓰지 않고 먼저 기록한다.

- [ ] **Step 2: Next.js 16 로컬 가이드를 읽는다.**

위 문서에서 App Router page, Server/Client Component 경계, 접근성, Vitest 설정을 끝까지 읽는다. `app/u1-test/page.tsx`는 서버 컴포넌트로 두고 상호작용이 필요한 `U1Preview.tsx`에만 `"use client"`를 붙인다.

- [ ] **Step 3: baseline을 기록한다.**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: 네 명령의 현재 결과를 기록한다. 기존 실패가 있으면 U1 원인과 섞이지 않도록 별도로 남긴다.

---

### Task 2: 프리뷰 화면 정의를 테스트 우선으로 만든다

**Files:**

- Create: `components/game/u1-preview-data.test.ts`
- Create: `components/game/u1-preview-data.ts`

**Interfaces:**

- Produces: `U1_PREVIEW_SCREENS`, `U1_PREVIEW_SCREEN_IDS`, `U1PreviewScreen`, `U1_PREVIEW_STATUS`, `U1PreviewScreenDefinition`

- [ ] **Step 1: 실패하는 순수 계약 테스트를 작성한다.**

`u1-preview-data.test.ts`에 다음 계약을 작성한다.

```ts
import { describe, expect, it } from "vitest";
import {
  U1_PREVIEW_SCREEN_IDS,
  U1_PREVIEW_SCREENS,
  U1_PREVIEW_STATUS,
} from "./u1-preview-data";

describe("U1 프리뷰 정의", () => {
  it("다섯 화면을 고정된 순서로 제공한다", () => {
    expect(U1_PREVIEW_SCREEN_IDS).toEqual([
      "intro", "board", "map", "progress", "settlement",
    ]);
    expect(new Set(U1_PREVIEW_SCREEN_IDS).size).toBe(5);
    expect(U1_PREVIEW_SCREENS).toHaveLength(5);
  });

  it("인트로 외 화면은 우측 패널 문구를 가진다", () => {
    const violations = U1_PREVIEW_SCREENS.flatMap((screen) => [
      screen.label.length === 0 ? `${screen.id}:label` : null,
      screen.mainTitle.length === 0 ? `${screen.id}:mainTitle` : null,
      screen.mainDescription.length === 0 ? `${screen.id}:mainDescription` : null,
      screen.id !== "intro" && screen.rightTitle === null
        ? `${screen.id}:rightTitle`
        : null,
    ].filter((value): value is string => value !== null));
    expect(violations).toEqual([]);
  });

  it("상태 fixture는 공통 상태 표시값을 제공한다", () => {
    expect(U1_PREVIEW_STATUS).toMatchObject({
      rank: "B",
      reputation: expect.any(Number),
      gold: expect.any(Number),
      canPromote: expect.any(Boolean),
      remainingDungeons: expect.any(Number),
    });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다.**

Run: `pnpm test components/game/u1-preview-data.test.ts`

Expected: FAIL — `./u1-preview-data` 모듈과 export가 아직 없다.

- [ ] **Step 3: 순수 프리뷰 정의를 최소 구현한다.**

`u1-preview-data.ts`에 다음 타입과 값을 구현한다. 화면 문구는 프리뷰 검증용으로 충분히 읽을 수 있게 작성하되 실제 U2~U6 콘텐츠를 선점하지 않는다.

```ts
export const U1_PREVIEW_SCREEN_IDS = [
  "intro", "board", "map", "progress", "settlement",
] as const;
export type U1PreviewScreen = (typeof U1_PREVIEW_SCREEN_IDS)[number];

export interface U1PreviewScreenDefinition {
  id: U1PreviewScreen;
  label: string;
  mainTitle: string;
  mainDescription: string;
  rightTitle: string | null;
  rightDescription: string | null;
}

export const U1_PREVIEW_SCREENS: readonly U1PreviewScreenDefinition[] = [
  { id: "intro", label: "인트로", mainTitle: "길잡이의 시작", mainDescription: "직접 싸우지 않고 정보와 선택으로 원정을 이끕니다.", rightTitle: null, rightDescription: null },
  { id: "board", label: "게시판", mainTitle: "길드 게시판", mainDescription: "진입 가능한 공고와 잠긴 공고를 함께 확인합니다.", rightTitle: "계약 상세", rightDescription: "선택한 던전과 출전 파티를 확인합니다." },
  { id: "map", label: "지도", mainTitle: "던전 지도", mainDescription: "현재 위치와 다음 선택지를 확인합니다.", rightTitle: "파티 상태", rightDescription: "현재 파티와 이동 정보를 확인합니다." },
  { id: "progress", label: "진행", mainTitle: "원정 진행", mainDescription: "상황 설명과 카드 선택 영역입니다.", rightTitle: "최근 반응", rightDescription: "파티원의 반응과 상태 변화를 확인합니다." },
  { id: "settlement", label: "정산·엔딩", mainTitle: "원정 정산", mainDescription: "생존·보상·위험도 변화의 원인을 확인합니다.", rightTitle: "보상과 승급", rightDescription: "변경된 보상과 승급 상태를 확인합니다." },
];

export const U1_PREVIEW_STATUS = {
  rank: "B",
  reputation: 74,
  gold: 186,
  canPromote: true,
  remainingDungeons: 11,
  currentDungeon: { name: "거미굴 3번", riskLevel: 2 },
} as const;
```

- [ ] **Step 4: 단위 테스트가 통과하는지 확인한다.**

Run: `pnpm test components/game/u1-preview-data.test.ts`

Expected: PASS.

- [ ] **Step 5: 커밋한다.**

```bash
git add components/game/u1-preview-data.ts components/game/u1-preview-data.test.ts
git commit -m "테스트: U1 프리뷰 화면 계약을 정의한다" -m "인트로·게시판·지도·진행·정산 다섯 화면의 순서와 필수 표시 문구, 공통 상태 fixture를 고정한다."
```

---

### Task 3: TopStatusBar와 GameShell을 테스트 우선으로 구현한다

**Files:**

- Create: `components/game/TopStatusBar.tsx`
- Create: `components/game/GameShell.tsx`
- Create: `components/game/GameShell.test.ts`

**Interfaces:**

- `TopStatusView`: `rank`, `reputation`, `gold`, `canPromote`, `remainingDungeons`, optional `currentDungeon: { name; riskLevel }`
- `GameShellProps`: `status: TopStatusView`, `screenTitle: string`, `main: ReactNode`, optional `rightPanel: ReactNode`, optional `rightPanelLabel: string`
- Produces: `GameShell`, `TopStatusBar`, `TopStatusView`, `GameShellProps`

- [ ] **Step 1: 정적 렌더 테스트를 먼저 작성한다.**

`react-dom/server`를 사용해 DOM 환경을 추가하지 않고 landmark·상태·빈 레일을 검증한다.

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameShell } from "./GameShell";

const status = {
  rank: "B", reputation: 74, gold: 186, canPromote: true,
  remainingDungeons: 11,
  currentDungeon: { name: "거미굴 3번", riskLevel: 2 },
};

describe("GameShell", () => {
  it("상태 바·본문·우측 레일 landmark를 렌더링한다", () => {
    const html = renderToStaticMarkup(
      <GameShell status={status} screenTitle="게시판"
        main={<p>공고 본문</p>}
        rightPanel={<p>계약 상세</p>} rightPanelLabel="계약 상세" />,
    );
    expect(html).toContain('data-testid="game-shell"');
    expect(html).toContain('data-testid="game-shell-body"');
    expect(html).toContain('data-testid="game-shell-main"');
    expect(html).toContain('data-testid="game-shell-right-panel"');
    expect(html).toContain('aria-label="계약 상세"');
    expect(html).toContain("게시판");
    expect(html).toContain("공고 본문");
    expect(html).toContain("계약 상세");
  });

  it("우측 콘텐츠가 없어도 구조적 레일을 제거하지 않는다", () => {
    const html = renderToStaticMarkup(
      <GameShell status={status} screenTitle="인트로" main={<p>인트로 본문</p>} />,
    );
    expect(html).toContain('data-testid="game-shell-right-panel"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('class="game-shell__body"');
  });

  it("승급 가능 여부를 색상 외 문구로 표시한다", () => {
    const html = renderToStaticMarkup(
      <GameShell status={status} screenTitle="게시판" main={<p>본문</p>} />,
    );
    expect(html).toContain("등급");
    expect(html).toContain("명성");
    expect(html).toContain("골드");
    expect(html).toContain("승급 가능");
    expect(html).toContain("남은 던전");
    expect(html).toContain("거미굴 3번");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다.**

Run: `pnpm test components/game/GameShell.test.ts`

Expected: FAIL — `./GameShell` 모듈이 아직 없다.

- [ ] **Step 3: TopStatusBar를 구현한다.**

`header`와 `dl`로 라벨·값 쌍을 렌더링한다. `canPromote`가 true면 `✓ 승급 가능`, false면 `— 승급 조건 미달`을 텍스트로 출력한다. 현재 던전이 있으면 이름과 `★${riskLevel}`을 표시한다.

- [ ] **Step 4: 항상 두 열을 렌더링하는 GameShell을 구현한다.**

핵심 markup은 아래를 따른다. `hasRightPanel`은 `rightPanel !== undefined && rightPanel !== null`이며, aside는 콘텐츠 유무와 관계없이 렌더링한다.

```tsx
<div className="game-shell" data-testid="game-shell">
  <TopStatusBar status={status} />
  <main className="game-shell__body" data-testid="game-shell-body">
    <section className="game-shell__main" data-testid="game-shell-main">
      <h1 id="game-shell-screen-title">{screenTitle}</h1>
      {main}
    </section>
    <aside
      className="game-shell__right-panel"
      data-testid="game-shell-right-panel"
      aria-label={hasRightPanel ? rightPanelLabel ?? "우측 정보 패널" : undefined}
      aria-hidden={hasRightPanel ? undefined : true}
    >
      {rightPanel}
    </aside>
  </main>
</div>
```

- [ ] **Step 5: 정적 렌더 테스트와 타입 검사를 통과시킨다.**

Run: `pnpm test components/game/GameShell.test.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: 커밋한다.**

```bash
git add components/game/TopStatusBar.tsx components/game/GameShell.tsx components/game/GameShell.test.tsx
git commit -m "화면: 3대1 공통 게임 셸과 상태 바를 추가한다" -m "상단 상태 바와 항상 유지되는 MainContent·RightPanel landmark를 구현하고 인트로의 빈 우측 레일을 정적 렌더 테스트로 고정한다."
```

---

### Task 4: 셸 CSS와 U1 프리뷰 라우트를 연결한다

**Files:**

- Create: `components/game/U1Preview.tsx`
- Create: `app/u1-test/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**

- Consumes: `GameShell`, `U1_PREVIEW_SCREENS`, `U1_PREVIEW_SCREEN_IDS`, `U1PreviewScreen`, `Panel`
- Produces: 클릭·키보드로 전환 가능한 다섯 화면 `/u1-test`

- [ ] **Step 1: U1Preview를 구현한다.**

`U1Preview.tsx`의 첫 줄에 `"use client"`를 두고 `useState<U1PreviewScreen>("intro")`만 보유한다. 각 선택 button은 다음 계약을 따른다.

```tsx
<button
  type="button"
  aria-pressed={screen.id === selectedScreen}
  onClick={() => setSelectedScreen(screen.id)}
>
  {screen.label}
</button>
```

선택된 정의로 MainContent에는 `Panel title={mainTitle}`과 본문·상태 기호를, 우측에는 `rightTitle`이 있을 때만 `Panel`을 넣는다. `GameShell`에 rightPanel을 생략해도 구조적 aside가 남는다. `@/lib/mock`과 실제 도메인 객체는 import하지 않는다.

- [ ] **Step 2: 프리뷰 라우트를 추가한다.**

`app/u1-test/page.tsx`는 서버 컴포넌트로 유지한다.

```tsx
import { U1Preview } from "@/components/game/U1Preview";

export default function U1TestPage() {
  return <U1Preview />;
}
```

- [ ] **Step 3: 3:1을 바꾸지 않는 CSS를 추가한다.**

`app/globals.css`에 다음을 추가한다. `@media`로 columns를 변경하거나 `overflow-x: hidden`으로 문제를 숨기지 않는다.

```css
.game-shell,
.game-shell__body,
.game-shell__main,
.game-shell__right-panel {
  min-width: 0;
}

.game-shell {
  min-height: 100vh;
  width: 100%;
  overflow-wrap: anywhere;
}

.game-shell__body {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 1fr);
  width: 100%;
}

.game-shell__main,
.game-shell__right-panel {
  min-width: 0;
  overflow-wrap: anywhere;
}

.game-shell__right-panel {
  border-left: 1px solid var(--color-edge);
}

.u1-preview__navigation {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  min-width: 0;
}

.u1-preview__navigation button:focus-visible {
  outline: 2px solid var(--color-parchment);
  outline-offset: 2px;
}
```

- [ ] **Step 4: 자동 검사를 실행한다.**

Run: `pnpm typecheck && pnpm test && pnpm lint && pnpm build`

Expected: PASS. build가 `/u1-test`를 생성하는지 확인한다.

- [ ] **Step 5: 커밋한다.**

```bash
git add components/game/U1Preview.tsx app/u1-test/page.tsx app/globals.css
git commit -m "화면: U1 프리뷰 라우트와 고정 3대1 셸을 연결한다" -m "다섯 화면 선택 버튼을 공통 GameShell 슬롯에 연결하고 모든 viewport에서 3대1 grid와 overflow 방지 규칙을 적용한다."
```

---

### Task 5: 자동 검증과 실제 브라우저 검증

**Files:**

- Read: `r5/agent-browser/SKILL.md`
- Read: `r5/agent-browser-verify/SKILL.md`
- Verify: Task 2~4의 소스와 `/u1-test`

**Interfaces:**

- Consumes: `/u1-test` 개발 서버
- Produces: 3:1 비율·overflow·화면 전환·접근성 검증 결과와 실제 스크린샷

- [ ] **Step 1: 네 가지 자동 검사를 실행한다.**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: 네 명령 모두 exit code 0. 실패하면 수정 뒤 네 명령을 다시 실행한다.

- [ ] **Step 2: 브라우저 스킬을 읽고 개발 서버를 시작한다.**

개발 서버를 시작하기 전에 `vercel:agent-browser`와 `vercel:agent-browser-verify`의 `SKILL.md`를 끝까지 읽는다. 지침에 따라 `pnpm dev`를 실행하고 실제 브라우저에서 `http://localhost:3000/u1-test`를 연다.

- [ ] **Step 3: 1280×720에서 다섯 화면을 검증한다.**

모든 선택 button을 클릭하고 각 화면의 `h1`, MainContent, RightPanel 문구 교체와 현재 button의 `aria-pressed`를 확인한다. Tab으로 button에 도달하고 Enter로 전환한다. 콘솔 오류가 없어야 한다.

브라우저 평가식으로 실제 track을 측정한다.

```js
const body = document.querySelector('[data-testid="game-shell-body"]');
const [left, right] = getComputedStyle(body).gridTemplateColumns
  .split(" ")
  .map(Number);
({ left, right, ratio: left / right,
  width: window.innerWidth,
  scrollWidth: document.documentElement.scrollWidth });
```

Expected: `Math.abs(ratio - 3) < 0.01`, `scrollWidth <= innerWidth`. 인트로에서도 `.game-shell__right-panel`이 존재해야 한다. 실제 스크린샷을 저장·육안 확인한다.

- [ ] **Step 4: 1024×640에서 같은 검증을 반복한다.**

Expected: computed grid track 비율 3:1, `scrollWidth <= innerWidth`, 가로 잘림 없음. 세로로 길어지는 것은 허용하지만 두 열이 한 열로 쌓이면 실패다.

- [ ] **Step 5: 실패 시 전체 브라우저 검증을 반복한다.**

비율·overflow·focus·console 중 하나라도 실패하면 원인을 수정하고 Task 5 Step 1~4를 처음부터 다시 실행한다. 성공 전에는 U1 완료 문서를 갱신하지 않는다.

---

### Task 6: 공식 문서와 작업 배정표 동기화

**Files:**

- Modify: `docs/experience/SCREEN_LAYOUT.md`
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

**Interfaces:**

- Consumes: 구현된 셸과 Task 5의 실제 검증 결과
- Produces: 다른 개발자가 재사용할 공식 규격과 U1 완료 기록

- [ ] **Step 1: 화면 규격의 인트로 내용을 갱신한다.**

화면별 표의 인트로 RightPanel을 `우측 레일 유지 · 콘텐츠 없음`으로 바꾼다. “본문이 전체 폭을 쓴다” 문단은 다음 뜻으로 교체한다.

```md
우측 패널에 담을 캠페인 상태가 아직 없으므로 콘텐츠는 비워 둔다. 다만
공통 셸의 3:1 구조와 우측 레일은 유지하며, 인트로도 다른 화면과 같은
열 비율을 사용한다. 화면별 콘텐츠만 교체하고 셸의 두 열을 합치지 않는다.
```

- [ ] **Step 2: U1 행과 후속 직접 선행을 갱신한다.**

U1 담당을 `SangHwan Yoo`, 상태를 `✅`로 바꾼다. 다음 행에서는 완료된 직접 선행 `U1`만 제거한다.

- U2: `U1` → `—`
- U3: `U1 C2` → `C2`
- U4: `U1 E1` → `E1`
- U5: `U1 E2 E3` → `E2 E3`
- U6: `U1 C4 C5 C6 C8` → `C4 C5 C6 C8`

의존성 그래프의 `U1 --> U2 & U3 & U4 & U5 & U6`와 각 행의 `풀리는 것`은 전체 그래프 표현이므로 유지한다.

- [ ] **Step 3: U1 완료 기록을 추가한다.**

`D8 완료 기록` 뒤에 `U1 완료 기록`을 추가하고 완료일, `GameShell`·`TopStatusBar`·`U1Preview` 파일, `/u1-test` 경로, 고정 3:1, 1280×720·1024×640 browser verification 결과, 네 가지 pnpm 명령 결과, U2~U6 재사용 API를 기록한다.

- [ ] **Step 4: 무결성 검사를 실행한다.**

Run: `pnpm test docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.test.ts`

Expected: PASS. 실패하면 직접 선행·상태·담당·그래프 표현을 무결성 모듈 규칙에 맞춰 고친다.

- [ ] **Step 5: 문서 변경을 커밋한다.**

```bash
git add docs/experience/SCREEN_LAYOUT.md docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md
git commit -m "문서: U1 공통 셸 완료와 재사용 규약을 기록한다" -m "인트로에서도 3대1 우측 레일을 유지하도록 화면 규격을 맞추고 U1 완료 상태, 후속 선행, 프리뷰 경로와 검증 결과를 작업 배정표에 남긴다."
```

---

### Task 7: 최종 회귀 검증과 인계

**Files:**

- Verify: Tasks 2~6의 모든 변경 파일

- [ ] **Step 1: 전체 자동 검사를 다시 실행한다.**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: 네 명령 모두 PASS이며 문서 무결성 검사도 포함된다.

- [ ] **Step 2: diff와 3:1 선언을 확인한다.**

```bash
git diff --check
git status --short
git diff --stat
rg -n "grid-template-columns|3:1|U1 완료 기록|우측 레일" components app docs/experience/SCREEN_LAYOUT.md docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md
```

Expected: 의도한 U1 파일과 문서만 변경되고, 3:1을 벗어나는 columns 선언이나 임의의 `overflow-x: hidden`이 없다.

- [ ] **Step 3: 최종 브라우저 상태를 재현한다.**

`/u1-test`에서 두 viewport의 ratio, scrollWidth, console, keyboard, screenshot 결과를 다시 확인하고 실제 결과를 인계 메시지에 기록한다.

- [ ] **Step 4: 사용자에게 결과를 인계한다.**

변경 파일, 자동 검증 결과, 실제 브라우저 viewport별 결과, work assignment 갱신 위치와 U2~U6 재사용 API를 요약한다. 확인하지 않은 성공은 주장하지 않는다.
