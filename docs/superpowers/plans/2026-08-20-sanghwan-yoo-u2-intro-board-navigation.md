# U2 인트로 게시판 진입 연결 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** U2 인트로의 `길드 게시판으로` CTA가 기존 U1 게시판 프리뷰인 `/u1-test?screen=board`로 이동하고, 해당 URL이 게시판 화면을 초기 선택하도록 만든다.

**Architecture:** U2는 캠페인 상태나 전이를 소유하지 않고 네이티브 링크만 제공한다. `/u1-test` 서버 페이지가 `searchParams.screen`을 `board` 또는 `intro`로 정규화해 `U1Preview`의 선택적 `initialScreen` prop으로 전달하며, 기존 U1 프리뷰의 화면 선택·콘텐츠·접근성 계약은 그대로 재사용한다.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript strict, Vitest 4, 기존 CSS와 정적 렌더 테스트.

**Spec:** `docs/superpowers/specs/2026-08-20-sanghwan-yoo-u2-intro-board-navigation-design.md`

## Global Constraints

- CTA 목적지는 정확히 `/u1-test?screen=board`다.
- `/u1-test`에 query가 없거나 `screen`이 `board`가 아니면 초기 화면은 `intro`다.
- U2 CTA는 상태 피드백 버튼이 아니라 `href`를 가진 네이티브 링크다.
- 실제 캠페인 상태 머신·스토어·게시판 규칙·계약 전이는 구현하지 않는다.
- 기존 `/u1-test`의 다섯 화면 선택 버튼, `aria-pressed`, 게시판 프리뷰 마크업을 보존한다.
- 새 dependency와 새 이미지 자산을 추가하지 않는다.
- 문서의 공식 규칙을 중복 기록하지 않고 작업 배정표·README 색인만 구현과 동기화한다.
- 모든 커밋 제목과 본문은 한글로 작성한다.

## File Structure

| 파일 | 책임 |
| --- | --- |
| `app/u1-test/page.tsx` | `screen` query를 안전하게 읽어 U1 초기 화면을 정한다. |
| `app/u1-test/page.test.ts` | query 누락·게시판 값이 각각 올바른 U1 초기 화면으로 정규화되는지 검사한다. |
| `components/game/U1Preview.tsx` | 기존 다섯 화면 프리뷰와 선택 상태를 유지하고 초기 화면 prop을 받는다. |
| `components/game/U1Preview.test.ts` | 기본 인트로와 `initialScreen="board"` 선택 상태를 검사한다. |
| `components/game/IntroScreen.tsx` | U2 역할·수단·목표와 게시판 진입 링크를 렌더링한다. |
| `components/game/IntroScreen.test.ts` | 역할·수단·목표 문구와 링크 목적지를 검사한다. |
| `components/game/U2Preview.tsx` | U2 시작 상태 fixture와 고정 게시판 목적지를 조합한다. |
| `components/game/U2Preview.test.ts` | 시작 상태와 게시판 href를 검사한다. |
| `app/u2-intro.css` | 링크로 바뀐 CTA가 기존 버튼과 같은 시각·포커스 계약을 유지하게 한다. |
| `docs/README.md` | U2 spec·plan 색인을 추가한다. |
| `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md` | U2 담당자·완료 상태·의존성·완료 기록을 갱신한다. |

---

### Task 1: U1 게시판 프리뷰의 초기 화면을 URL에서 선택한다

**Files:**

- Modify: `components/game/U1Preview.tsx`
- Modify: `components/game/U1Preview.test.ts`
- Modify: `app/u1-test/page.tsx`
- Create: `app/u1-test/page.test.ts`

**Interfaces:**

- Consumes: 기존 `U1PreviewScreen`, `U1_PREVIEW_SCREENS`, `U1_PREVIEW_SCREEN_IDS`와 U1 게시판 프리뷰.
- Produces: `U1Preview({ initialScreen?: U1PreviewScreen })`와 `U1TestPage({ searchParams })`가 `screen=board`를 게시판 초기 선택으로 전달한다.

- [ ] **Step 1: U1 컴포넌트와 route page의 실패 테스트를 작성한다.**

`components/game/U1Preview.test.ts`에 기본 초기 화면과 게시판 초기 화면을 각각 검사한다.

```ts
it("기본 초기 화면은 인트로이고 게시판을 초기 화면으로 선택할 수 있다", () => {
  const defaultHtml = renderToStaticMarkup(createElement(U1Preview));
  expect(defaultHtml).toContain('aria-pressed="true">인트로</button>');
  expect(defaultHtml).toContain("길잡이의 시작");

  const boardHtml = renderToStaticMarkup(
    createElement(U1Preview, { initialScreen: "board" }),
  );
  expect(boardHtml).toContain('aria-pressed="true">게시판</button>');
  expect(boardHtml).toContain("길드 공고");
  expect(boardHtml).toContain("계약 상세");
});
```

`app/u1-test/page.test.ts`에는 Next.js 16의 Promise 기반 `searchParams`를 직접 전달해 query 정규화를 검사한다.

```ts
it("screen=board를 게시판 초기 화면으로 전달한다", async () => {
  const element = await U1TestPage({
    searchParams: Promise.resolve({ screen: "board" }),
  });
  const html = renderToStaticMarkup(element);

  expect(html).toContain('aria-pressed="true">게시판</button>');
  expect(html).toContain("길드 공고");
});

it("screen이 없거나 알 수 없는 값이면 인트로로 돌아간다", async () => {
  const missing = await U1TestPage({ searchParams: Promise.resolve({}) });
  const unknown = await U1TestPage({
    searchParams: Promise.resolve({ screen: "unknown" }),
  });

  expect(renderToStaticMarkup(missing)).toContain(
    'aria-pressed="true">인트로</button>',
  );
  expect(renderToStaticMarkup(unknown)).toContain(
    'aria-pressed="true">인트로</button>',
  );
});
```

`page.tsx`에서 테스트할 수 있도록 named export `U1TestPage`를 제공하고 default export도 같은 함수를 가리키도록 테스트에 필요한 최소한의 공개 경계를 정한다.

- [ ] **Step 2: 실패를 확인한다.**

Run: `pnpm test components/game/U1Preview.test.ts app/u1-test/page.test.ts`

Expected: FAIL. 현재 `U1Preview`는 `initialScreen`을 받지 않고 `/u1-test` 페이지는 `searchParams`를 읽지 않으므로 게시판 초기 선택 계약이 없다.

- [ ] **Step 3: 초기 화면 prop과 query 정규화를 구현한다.**

`components/game/U1Preview.tsx`에 선택적 prop을 추가하고 state 초기값에만 사용한다. 기존 버튼 클릭과 화면 정의는 변경하지 않는다.

```ts
export interface U1PreviewProps {
  initialScreen?: U1PreviewScreen;
}

export function U1Preview({
  initialScreen = "intro",
}: U1PreviewProps) {
  const [selectedScreen, setSelectedScreen] =
    useState<U1PreviewScreen>(initialScreen);
  // 나머지 화면 선택·렌더링은 기존 구현을 유지한다.
}
```

`app/u1-test/page.tsx`는 Next.js 16 규약에 맞춰 Promise를 await하고 `board`만 허용한다.

```ts
import { U1Preview } from "@/components/game/U1Preview";

type U1TestSearchParams = Promise<{
  screen?: string | string[];
}>;

export async function U1TestPage({
  searchParams,
}: {
  searchParams: U1TestSearchParams;
}) {
  const { screen } = await searchParams;
  const initialScreen = screen === "board" ? "board" : "intro";

  return <U1Preview initialScreen={initialScreen} />;
}

export default U1TestPage;
```

- [ ] **Step 4: 단위 테스트와 타입 검사를 통과시킨다.**

Run: `pnpm test components/game/U1Preview.test.ts app/u1-test/page.test.ts && pnpm typecheck`

Expected: PASS. 기본 `/u1-test`는 인트로이고 `?screen=board`는 게시판이며, 알 수 없는 query는 인트로다.

- [ ] **Step 5: 이 단위를 커밋한다.**

```bash
git add components/game/U1Preview.tsx components/game/U1Preview.test.ts app/u1-test/page.tsx app/u1-test/page.test.ts
git commit -m "화면: U1 게시판 프리뷰 초기 진입을 지원한다" -m "u1-test의 screen query를 게시판 초기 선택으로 정규화하고 기존 기본 인트로를 보존한다."
```

### Task 2: U2 CTA를 게시판 링크로 연결한다

**Files:**

- Modify: `components/game/IntroScreen.tsx`
- Modify: `components/game/IntroScreen.test.ts`
- Modify: `components/game/U2Preview.tsx`
- Modify: `components/game/U2Preview.test.ts`
- Modify: `app/u2-intro.css`

**Interfaces:**

- Consumes: Task 1의 `/u1-test?screen=board` 목적지와 기존 U2 시작 상태 fixture.
- Produces: `IntroScreen({ status, boardHref })`가 `href`를 가진 CTA를 렌더링하고 `U2Preview`가 고정 게시판 href를 전달한다.

- [ ] **Step 1: 콜백 계약을 링크 계약으로 바꾸는 실패 테스트를 작성한다.**

`IntroScreen.test.ts`의 모든 fixture를 `boardHref` prop으로 바꾸고, 역할·수단·목표 문구와 목적지 링크를 검사한다.

```ts
const boardHref = "/u1-test?screen=board";

const html = renderToStaticMarkup(
  createElement(IntroScreen, { status, boardHref }),
);

expect(html).toContain("내 역할");
expect(html).toContain("내 수단");
expect(html).toContain("나의 목표");
expect(html).toContain(
  '<a class="u2-intro__cta" href="/u1-test?screen=board">',
);
expect(html).not.toContain("u2-preview__feedback");
```

`U2Preview.test.ts`에는 U2가 실제 목적지를 전달하는지 추가한다.

```ts
const html = renderToStaticMarkup(createElement(U2Preview));
expect(html).toContain('href="/u1-test?screen=board"');
expect(html).toContain("게시판");
```

- [ ] **Step 2: 실패를 확인한다.**

Run: `pnpm test components/game/IntroScreen.test.ts components/game/U2Preview.test.ts`

Expected: FAIL. 현재 `IntroScreen`은 callback을 요구하고 `<button>`을 렌더링하며, `U2Preview`는 href를 출력하지 않는다.

- [ ] **Step 3: `IntroScreen`을 네이티브 링크로 구현한다.**

`IntroScreenProps`를 아래 계약으로 바꾼다.

```ts
export interface IntroScreenProps {
  status: TopStatusView;
  boardHref: string;
}
```

CTA의 기존 `className`, 아이콘, 문구, 화살표를 유지하면서 외부 요소만 `<button type="button" onClick={...}>`에서 `<a href={boardHref}>`로 바꾼다. 이동 상태, `aria-live` 피드백, callback prop은 제거한다.

- [ ] **Step 4: U2 프리뷰에서 숨김 피드백 상태를 제거하고 목적지를 고정한다.**

`components/game/U2Preview.tsx`에서 `useState` import, `entryRequested`, 숨김 `<p>`를 제거하고 다음처럼 렌더링한다.

```tsx
export function U2Preview() {
  return (
    <div className="u2-preview">
      <IntroScreen
        status={U2_START_STATUS}
        boardHref="/u1-test?screen=board"
      />
    </div>
  );
}
```

- [ ] **Step 5: CTA 링크의 기존 시각·포커스 스타일을 보존한다.**

`app/u2-intro.css`의 `.u2-intro__cta`에 `text-decoration: none;`을 추가한다. 기존 `display`, 색상, hover, `focus-visible`, cursor, 내부 아이콘·문구 스타일은 유지한다. 새 breakpoint나 색상 규칙을 만들지 않는다.

- [ ] **Step 6: U2 관련 테스트와 타입 검사를 통과시킨다.**

Run: `pnpm test components/game/IntroScreen.test.ts components/game/U2Preview.test.ts && pnpm typecheck`

Expected: PASS. U2 정적 렌더에는 시작 상태와 `/u1-test?screen=board` 링크가 있고, CTA는 버튼 피드백 상태를 생성하지 않는다.

- [ ] **Step 7: 이 단위를 커밋한다.**

```bash
git add components/game/IntroScreen.tsx components/game/IntroScreen.test.ts components/game/U2Preview.tsx components/game/U2Preview.test.ts app/u2-intro.css
git commit -m "화면: U2 인트로 CTA를 게시판 링크로 연결한다" -m "숨김 피드백 상태를 제거하고 기존 U1 게시판 프리뷰로 이동하는 네이티브 링크를 제공한다."
```

### Task 3: spec·plan 색인과 U2 작업 상태를 동기화한다

**Files:**

- Modify: `docs/README.md`
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

**Interfaces:**

- Consumes: Task 1·2의 실제 URL과 U2 완료 구현, 승인된 spec·이 plan.
- Produces: 공식 문서 색인과 작업 배정표가 U2 구현 상태·담당자·의존성 그래프와 일치한다.

- [ ] **Step 1: README의 이번 개편 색인에 U2 문서를 추가한다.**

`docs/README.md`의 `## 이번 개편 설계` 아래에 다음 두 링크를 추가한다.

```md
- [U2 인트로 게시판 진입 연결 설계](superpowers/specs/2026-08-20-sanghwan-yoo-u2-intro-board-navigation-design.md)
- [U2 인트로 게시판 진입 연결 구현 계획](superpowers/plans/2026-08-20-sanghwan-yoo-u2-intro-board-navigation.md)
```

- [ ] **Step 2: 작업 배정표의 U2 행을 완료 상태로 갱신한다.**

`docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`에서 U2 행을 다음 의미로 갱신한다.

```md
| U2 | 인트로 화면 | 길잡이 역할·개입 수단·캠페인 목표를 전달하고 `/u1-test?screen=board`로 게시판 프리뷰에 진입하며, 캠페인 시작 시 이 화면이 먼저 나옴 | — | **I2** | SangHwan Yoo | ✅ |
```

같은 표의 `I2` 선행에서 완료된 `U2`를 제거해 `U3 U4 U5 U6 I1`만 남긴다. 다른 완료 ID와 의존성은 변경하지 않는다.

- [ ] **Step 3: U2 완료 기록을 추가한다.**

`U1 완료 기록` 다음에 아래 기록을 추가한다.

```md
### U2 완료 기록

- 2026-08-20: U2 인트로 CTA를 네이티브 링크로 바꾸고 `/u1-test?screen=board` 목적지를 연결했다. `screen=board` query는 게시판 프리뷰를 초기 선택하며, query가 없거나 알 수 없는 값이면 기존 인트로 프리뷰를 유지한다.
- U2는 캠페인 상태 머신이나 게시판 규칙을 소유하지 않고, U3 구현 전까지 기존 U1 게시판 프리뷰를 다음 화면으로 재사용한다.
```

- [ ] **Step 4: 문서 링크·무결성 검사를 실행한다.**

Run: `git diff --check && pnpm test docs/DOCUMENT_LINKS.test.ts docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.test.ts`

Expected: PASS. 새 README 링크가 실제 파일을 가리키고, 작업 배정표의 행·의존성·담당자·상태가 무결성 검사를 통과한다.

- [ ] **Step 5: 문서 단위를 커밋한다.**

```bash
git add docs/README.md docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md
git commit -m "문서: U2 게시판 진입 구현과 계획을 색인한다" -m "U2 완료 상태와 의존성을 갱신하고 승인된 spec·plan 및 실제 라우팅 계약을 연결한다."
```

### Task 4: 전체 자동 검사와 실제 브라우저 흐름을 검증한다

**Files:**

- Verify: `app/u2-test/page.tsx`, `app/u1-test/page.tsx`
- Verify: `components/game/IntroScreen.tsx`, `components/game/U2Preview.tsx`, `components/game/U1Preview.tsx`
- Verify: `docs/README.md`, `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

**Interfaces:**

- Consumes: Task 1~3의 구현·테스트·문서.
- Produces: PR에 첨부할 자동 검사와 브라우저 흐름의 재현 가능한 증거.

- [ ] **Step 1: 전체 정적 검사와 테스트를 실행한다.**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: 네 명령 모두 exit code 0이며 Next build가 `/u1-test`와 `/u2-test` route를 오류 없이 생성한다.

- [ ] **Step 2: 개발 서버를 실행하고 브라우저에서 U2를 연다.**

Run: `pnpm dev`

`vercel:agent-browser`로 `http://localhost:3000/u2-test`를 연다. 페이지 오류, console 오류, Next 오류 overlay가 없는지 먼저 확인한다.

- [ ] **Step 3: CTA 클릭과 목적지 내용을 검증한다.**

브라우저에서 다음 순서로 확인한다.

1. `길드 게시판으로` 링크가 보이고 Tab으로 포커스할 수 있다.
2. 링크를 클릭한다.
3. 현재 URL이 `http://localhost:3000/u1-test?screen=board`다.
4. `게시판` 화면 버튼의 `aria-pressed` 값이 `true`다.
5. 좌측에 `길드 공고`, 우측에 `계약 상세`, `출전 파티`가 보인다.
6. 새 페이지에서 page error와 console error가 발생하지 않는다.

- [ ] **Step 4: 기본·잘못된 query의 회귀를 검증한다.**

브라우저에서 다음 두 URL도 확인한다.

- `http://localhost:3000/u1-test`: `인트로` 버튼이 `aria-pressed="true"`다.
- `http://localhost:3000/u1-test?screen=unknown`: `인트로` 버튼이 `aria-pressed="true"`다.

- [ ] **Step 5: 작업 트리와 diff를 최종 확인한다.**

Run:

```bash
git diff --check
git status --short
git diff --stat main...HEAD
```

Expected: 의도한 소스·테스트·문서·spec·plan 파일만 변경되고, 공백 오류·생성물·의존하지 않은 리팩터링이 없다.

### Task 5: 기능 브랜치를 push하고 PR을 생성한다

**Files:**

- Verify: `git log --oneline main..HEAD`
- Publish: GitHub pull request targeting `main`

**Interfaces:**

- Consumes: Task 4의 성공한 검사 결과와 한글 커밋 3개, 승인된 spec·plan.
- Produces: origin에 push된 기능 브랜치와 `main` 대상 PR.

- [ ] **Step 1: 커밋 목록과 브랜치 상태를 확인한다.**

Run:

```bash
git branch --show-current
git status --short --branch
git log --oneline --decorate main..HEAD
```

Expected: `main`이 아닌 기능 브랜치이고, 작업 트리가 깨끗하며, spec·U1 route·U2 CTA·문서 커밋이 모두 보인다.

- [ ] **Step 2: 기능 브랜치를 origin에 push한다.**

```bash
git push -u origin HEAD
```

Expected: 현재 기능 브랜치가 origin에 생성되고 원격 추적이 설정된다.

- [ ] **Step 3: 한글 제목·본문으로 PR을 생성한다.**

PR 제목:

```text
U2 인트로에서 게시판 프리뷰로 진입하도록 연결한다
```

PR 본문:

```md
## 변경 내용

- U2 인트로 CTA를 `/u1-test?screen=board` 네이티브 링크로 연결했습니다.
- U1 프리뷰가 query에 따라 게시판을 초기 선택하도록 했습니다.
- U2 완료 상태와 승인된 spec·plan을 README 및 작업 배정표에 반영했습니다.

## 검증

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- 브라우저: `/u2-test` CTA 클릭 → `/u1-test?screen=board` → 게시판 선택 상태·공고·계약 상세 확인
```

- [ ] **Step 4: PR URL과 검증 결과를 사용자에게 전달한다.**

최종 응답에는 변경 파일의 핵심, 실행한 명령의 결과, 브라우저 흐름 결과, 생성된 PR URL, 현재 브랜치와 커밋을 짧게 기록한다.
