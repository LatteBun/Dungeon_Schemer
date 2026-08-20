# U1 공통 3:2 게임 셸·레퍼런스 프리뷰 하네스 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 세 레퍼런스의 다크 판타지 정보 위계를 반영하고, 모든 상태에서 좌 60%·우 40%를 유지하는 재사용 가능한 U1 게임 셸과 프리뷰 하네스를 만든다.

**Architecture:** `GameShell`과 `TopStatusBar`는 슬롯 API를 유지하되 게임 전용 CSS 크롬과 상태 칩을 제공한다. `U1PreviewContent`를 별도 프레젠테이션 모듈로 분리해 게시판·지도·진행·정산의 정적 모형을 만들고, `U1Preview`는 화면 선택과 슬롯 주입만 맡긴다. 실제 캠페인 규칙·스토어·난수는 연결하지 않는다.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript strict, Tailwind CSS 4, Vitest 4 Node 환경, `react-dom/server` 정적 렌더 검증, agent-browser 실제 브라우저 검증.

**Spec:** `docs/superpowers/specs/2026-08-20-sanghwan-yoo-u1-game-shell-design.md`

## Global Constraints

- 본문 grid는 모든 화면·상태·지원 viewport에서 `minmax(0, 3fr) minmax(0, 2fr)`을 유지한다.
- 인트로도 우측 40% 구조적 레일을 렌더링하며 MainContent를 전체 폭으로 확장하지 않는다.
- breakpoint에서 `1fr`, `display: block`, `grid-column: 1 / -1`로 바꾸거나 두 열을 세로로 쌓지 않는다.
- 1280×720과 1024×640에서 가로 스크롤을 만들지 않는다. `overflow-x: hidden`으로 문제를 숨기지 않는다.
- `GameShell`은 도메인 상태·규칙·Zustand·난수·영속화를 직접 읽지 않는다.
- 세 `REFERENCE_UI_*.png`는 시각 언어·정보 위계의 근거이며 앱에 임베드하거나 복제하지 않는다.
- 게임 전용 외관은 `components/game/`과 `app/globals.css`에 한정한다. `components/ui/Panel.tsx`는 도메인을 모르는 구조 계약을 유지한다.
- 새 런타임·테스트 의존성을 추가하지 않는다.
- 과거 회의록과 D8이 소유한 SVG·PNG는 수정하지 않는다.
- 커밋 제목과 본문은 한국어로 작성한다.

## 파일 구조

| 파일 | 책임 |
| --- | --- |
| `app/globals.css` | 게임 셸 3:2 grid, 다크 판타지 토큰·프레임·상태 칩·프리뷰 스타일 |
| `components/game/GameShell.tsx` | 전체 폭 상태 바와 3:2 main/right landmark, 게임 셸 크롬 class |
| `components/game/TopStatusBar.tsx` | 라벨·값·상태 기호를 가진 상태 칩 |
| `components/game/U1PreviewContent.tsx` | 규칙 없는 다섯 화면의 좌·우 정적 프리뷰 모형 |
| `components/game/u1-preview-data.ts` | 화면 정의, 공고·파티·지도·카드·정산 프리뷰 fixture |
| `components/game/U1Preview.tsx` | 화면 선택 상태와 `GameShell` 슬롯 연결 |
| `components/game/*test.ts` | 셸, fixture, 정적 프리뷰, 선택 초기 상태 계약 |
| `docs/experience/SCREEN_LAYOUT.md` | 현재 공식 3:2·60:40 셸과 레퍼런스의 역할 |
| `docs/README.md` | 현재 화면 규격 3:2와 과거 회의록의 당시 3:1 기록을 구분 |
| `docs/diagram/README.md` | 세 레퍼런스 PNG의 용도와 비공식 시각 참고 지위 |
| `docs/diagram/screen-wireframes.md` | 공통 셸 좌 60%·우 40% 설명 |
| `docs/superpowers/specs/2026-08-19-lattebun-campaign-rework-design.md` | 현재 개편 설계의 공통 셸 수치 |
| `docs/DOCUMENT_TERMINOLOGY.test.ts` | 화면 규격의 필수 앵커를 `3:2`로 변경하고 레퍼런스 색인을 확인 |
| `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md` | U1·D5·개편 범위와 실제 3:2 브라우저 검증 기록 |

---

### Task 1: 3:2 셸·공통 크롬 계약을 테스트로 고정한다

**Files:**

- Modify: `components/game/GameShell.test.ts`
- Modify: `components/game/GameShell.tsx`
- Modify: `components/game/TopStatusBar.tsx`
- Modify: `app/globals.css`

**Interfaces:**

- Consumes: `GameShellProps`, `TopStatusView`
- Produces: `game-shell--reference`, `game-shell__body`, `game-shell__status-chip`, `game-shell__main`, `game-shell__right-panel` CSS/markup 계약
- Invariant: `game-shell__body`는 `minmax(0, 3fr) minmax(0, 2fr)`만 사용하고 두 열을 합치지 않는다.

- [ ] **Step 1: 셸 markup과 실제 grid 비율의 실패하는 검증을 준비한다.**

`GameShell.test.ts`의 첫 렌더 계약에는 `game-shell--reference`, `game-shell__surface`, `game-shell__status-chip` class가 나오는지 추가 단정한다. 인트로 테스트에는 우측 레일이 `game-shell__surface`를 함께 갖고 `aria-hidden="true"`인지를 단정한다.

Run: `pnpm test components/game/GameShell.test.ts`

Expected: FAIL. 새 게임 셸 크롬 class가 아직 없어서 실패한다.

실제 CSS 동작은 소스 텍스트가 아니라 현재 브라우저 computed grid로 RED를 남긴다.

```bash
agent-browser open http://127.0.0.1:3000/u1-test
agent-browser set viewport 1280 720
agent-browser eval 'JSON.stringify((()=>{const body=document.querySelector("[data-testid=game-shell-body]");const tracks=getComputedStyle(body).gridTemplateColumns.split(" ").map(parseFloat);return {tracks,ratio:tracks[0]/tracks[1]}})())'
```

Expected: 기존 구현은 ratio 약 `3.00`으로, 목표 `1.50 ± 0.01` 검증에 실패한다.

- [ ] **Step 3: 최소 셸·상태 바 구현으로 3:2와 공통 크롬을 만든다.**

`GameShell.tsx`의 최상위 div, main section, aside에 다음 class를 추가한다.

```tsx
<div className="game-shell game-shell--reference" data-testid="game-shell">
  <TopStatusBar status={status} />
  <main className="game-shell__body" data-testid="game-shell-body">
    <section className="game-shell__main game-shell__surface" /* existing attributes */>
      {/* existing title and main slot */}
    </section>
    <aside className="game-shell__right-panel game-shell__surface" /* existing attributes */>
      {rightPanel}
    </aside>
  </main>
</div>
```

`TopStatusBar.tsx`의 `StatusItem` root class를 `game-shell__status-item game-shell__status-chip`으로 바꾸고, 라벨·값 markup과 승급 문구는 유지한다.

`globals.css`에는 게임 셸 전용 토큰과 아래 핵심 규칙을 추가한다. `url(...)`, reference PNG 파일명, 고정 폭, 열을 합치는 breakpoint는 넣지 않는다.

```css
.game-shell__body {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  width: 100%;
}

.game-shell--reference {
  background: var(--color-shell-ink);
  border: 1px solid var(--color-shell-metal);
  box-shadow: inset 0 0 0 1px var(--color-shell-shadow);
}

.game-shell__surface {
  background: var(--color-shell-surface);
  box-shadow: inset 0 0 0 1px var(--color-shell-edge);
}

.game-shell__status-chip {
  border: 1px solid var(--color-shell-metal);
  background: var(--color-shell-chip);
}
```

기존 `min-width: 0`, 줄바꿈, 전체 폭 상태 바, 우측 border는 보존하고 목재·금속·양피지의 명도 차를 토큰으로만 보강한다.

- [ ] **Step 4: 셸 계약 테스트와 타입 검사를 통과시킨다.**

Run: `pnpm test components/game/GameShell.test.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: 첫 구현 단위를 커밋한다.**

```bash
git add app/globals.css components/game/GameShell.tsx components/game/GameShell.test.ts components/game/TopStatusBar.tsx
git commit -m "화면: 3대2 공통 셸과 상태 바 크롬을 적용한다" -m "모든 상태에서 좌 60%·우 40%를 유지하고 게임 전용 프레임과 상태 칩을 추가한다."
```

### Task 2: 레퍼런스형 정적 프리뷰 콘텐츠를 데이터와 표시 모듈로 분리한다

**Files:**

- Create: `components/game/U1PreviewContent.tsx`
- Create: `components/game/U1PreviewContent.test.ts`
- Modify: `components/game/u1-preview-data.ts`
- Modify: `components/game/u1-preview-data.test.ts`

**Interfaces:**

- Consumes: `U1PreviewScreen`, `U1_PREVIEW_SCREENS`, `Panel`
- Produces: `U1PreviewMainContent({ screenId })` and `U1PreviewRightPanelContent({ screenId })`
- Fixture exports: `U1_PREVIEW_NOTICES`, `U1_PREVIEW_PARTY`, `U1_PREVIEW_PATH_NODES`, `U1_PREVIEW_CHOICES`, `U1_PREVIEW_SETTLEMENT_STEPS`
- Rule: `intro`의 right content는 `null`을 반환하고, 구조적 aside는 `GameShell`이 계속 렌더링한다.

- [ ] **Step 1: 화면별 모형의 실패하는 정적 렌더 테스트를 작성한다.**

`U1PreviewContent.test.ts`에서 `renderToStaticMarkup`으로 두 표시 컴포넌트를 렌더링하고 다음 anchor를 단정한다.

```ts
const expected = {
  board: ["길드 공고", "거미굴 3번", "계약 상세", "출전 파티", "계약하기"],
  map: ["던전 경로", "입구", "보스방", "선택 지점 입장", "에다 · 전사"],
  progress: ["정찰 장면", "상황 설명", "오래된 통로로 향한다", "최근 반응"],
  settlement: ["원정 정산", "보상과 승급", "승급하기"],
} as const;
```

각 화면은 main/right HTML을 합쳐 모든 anchor가 있는지 검사한다. `intro`는 main에 `길잡이의 시작`이 있고 right HTML이 빈 문자열인지를 검사한다.

`u1-preview-data.test.ts`에는 fixture 배열마다 빈 문자열·중복 id·비양수 HP/위험도·없는 파티 참조를 위반 배열에 수집해 `expect(violations).toEqual([])`로 단정한다.

- [ ] **Step 2: 모듈이 아직 없어 테스트가 실패하는지 확인한다.**

Run: `pnpm test components/game/U1PreviewContent.test.ts components/game/u1-preview-data.test.ts`

Expected: FAIL. `U1PreviewContent`를 찾을 수 없고 새 fixture export가 없다.

- [ ] **Step 3: 프리뷰 fixture와 순수 표시 컴포넌트를 구현한다.**

`u1-preview-data.ts`에 다음 고정 fixture를 추가한다.

```ts
export const U1_PREVIEW_PARTY = [
  { id: "eda", name: "에다", role: "전사", hp: "10 / 12", trust: "수용", reaction: "선택을 따른다" },
  { id: "nio", name: "니오", role: "도적", hp: "7 / 9", trust: "의심", reaction: "길을 살핀다" },
  { id: "rasha", name: "라샤", role: "성직자", hp: "8 / 8", trust: "적발", reaction: "위험을 경계한다" },
] as const;
```

공고는 거미굴 3번·폐광 4번·묘지 2번, 지도는 입구·휴식·상인·정보·보스방, 선택 카드는 `왼쪽 통로로 빠져나간다`·`중앙 문로가 열려 있다`·`바람이 부는 복도다`, 정산은 생존·보상·승급의 세 원인 단계로 고정한다.

`U1PreviewContent.tsx`에는 아래 두 named export를 작성한다.

```tsx
export function U1PreviewMainContent({ screenId }: { screenId: U1PreviewScreen }) {
  switch (screenId) {
    case "board":
      return <BoardPreview />;
    case "map":
      return <MapPreview />;
    case "progress":
      return <ProgressPreview />;
    case "settlement":
      return <SettlementPreview />;
    case "intro":
      return <IntroPreview />;
  }
}

export function U1PreviewRightPanelContent({ screenId }: { screenId: U1PreviewScreen }) {
  if (screenId === "intro") return null;
  return <ReferenceRightPanel screenId={screenId} />;
}
```

모든 모형은 기존 `Panel`에 `u1-reference-panel` class를 전달한다. 공고에는 활성·잠금·위험을 텍스트와 기호로, 지도에는 노드 이름·상태 문자열로, 진행에는 세 같은 디자인의 disabled 선택 button과 보조 문구로, 우측에는 파티원별 HP·신뢰·반응과 disabled 행동 button으로 표시한다. disabled button에는 행동이 프리뷰임을 이름에 포함한다.

- [ ] **Step 4: 화면 모형과 fixture 무결성 검사를 통과시킨다.**

Run: `pnpm test components/game/U1PreviewContent.test.ts components/game/u1-preview-data.test.ts`

Expected: PASS.

- [ ] **Step 5: 프리뷰 콘텐츠 단위를 커밋한다.**

```bash
git add components/game/U1PreviewContent.tsx components/game/U1PreviewContent.test.ts components/game/u1-preview-data.ts components/game/u1-preview-data.test.ts
git commit -m "화면: U1 레퍼런스 프리뷰 모형을 추가한다" -m "게시판·지도·진행·정산의 좌 조작과 우 상세 정보 위계를 정적 fixture로 분리한다."
```

### Task 3: 화면 선택과 레퍼런스 슬롯을 연결하고 시각 상태를 고정한다

**Files:**

- Modify: `components/game/U1Preview.tsx`
- Modify: `components/game/U1Preview.test.ts`
- Modify: `app/globals.css`

**Interfaces:**

- Consumes: `U1PreviewMainContent`, `U1PreviewRightPanelContent`, `U1_PREVIEW_SCREEN_IDS`, `U1_PREVIEW_SCREENS`
- Produces: `/u1-test`에서 클릭·키보드로 바뀌는 5개 3:2 프리뷰 상태
- Selection class: `u1-preview__screen-button is-active`
- Rule: 선택 nav 외의 계약·입장·카드·승급 button은 프리뷰 disabled 상태로 실제 전이를 만들지 않는다.

- [ ] **Step 1: 선택된 인트로와 레퍼런스 슬롯의 실패하는 테스트를 작성한다.**

`U1Preview.test.ts`에 다음 단정을 추가한다.

```ts
expect(html).toContain('class="u1-preview__screen-button is-active"');
expect(html).toContain("u1-preview__reference-frame");
expect(html).toContain("게임 셸 프리뷰");
expect(html).toContain('data-testid="game-shell-right-panel"');
```

초기 렌더에서 `길잡이의 시작`과 빈 right rail은 남아야 하며, 기존 5개 nav button과 `aria-pressed="true"` 계약도 보존한다.

- [ ] **Step 2: 변경 전 프리뷰 테스트가 실패하는지 확인한다.**

Run: `pnpm test components/game/U1Preview.test.ts`

Expected: FAIL. 새 selection/frame class와 레퍼런스 슬롯 연결이 아직 없다.

- [ ] **Step 3: U1Preview를 순수 콘텐츠 모듈에 연결한다.**

`U1Preview.tsx`의 기존 `PreviewMainContent`·`PreviewRightPanel` 내부 컴포넌트를 제거하고, 선택된 `definition.id`로 새 named export를 호출한다.

```tsx
<div className="u1-preview u1-preview__reference-frame min-h-screen p-4 sm:p-6">
  <nav className="u1-preview__navigation mb-4" aria-label="U1 프리뷰 화면">
    {U1_PREVIEW_SCREEN_IDS.map((screenId) => (
      <button
        key={screenId}
        type="button"
        className={
          "u1-preview__screen-button" +
          (screenId === selectedScreen ? " is-active" : "")
        }
        aria-pressed={screenId === selectedScreen}
        onClick={() => setSelectedScreen(screenId)}
      >
        {screen.label}
      </button>
    ))}
  </nav>
  <p className="u1-preview__eyebrow">게임 셸 프리뷰</p>
  <GameShell
    status={U1_PREVIEW_STATUS}
    screenTitle={definition.label}
    main={<U1PreviewMainContent screenId={definition.id} />}
    rightPanel={
      definition.id === "intro" ? undefined : <U1PreviewRightPanelContent screenId={definition.id} />
    }
    rightPanelLabel={definition.rightTitle ?? undefined}
  />
</div>
```

`rightPanel`에는 `intro`에서 `undefined`를 넘기고, 나머지 화면에서만 `<U1PreviewRightPanelContent screenId={definition.id} />`를 전달한다. 따라서 빈 인트로 aside는 `GameShell`이 구조적으로 유지한다.

`globals.css`에는 `u1-preview__reference-frame`, `u1-preview__screen-button`, `.is-active`, `u1-reference-panel`, 공고·노드·파티 카드·선택 카드·disabled action class를 추가한다. 금색 선택, 녹색 활성, 붉은 위험은 각각 텍스트/기호/테두리를 병행하고 `:focus-visible` outline을 유지한다.

- [ ] **Step 4: 프리뷰 정적 테스트와 전체 타입 검사를 통과시킨다.**

Run: `pnpm test components/game/U1Preview.test.ts components/game/U1PreviewContent.test.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: 선택·슬롯 연결 단위를 커밋한다.**

```bash
git add components/game/U1Preview.tsx components/game/U1Preview.test.ts app/globals.css
git commit -m "화면: U1 프리뷰 전환을 레퍼런스 슬롯에 연결한다" -m "선택 상태와 다섯 정적 모형을 공통 3대2 게임 셸에 연결하고 색 외 상태 단서를 적용한다."
```

### Task 4: 현재 공식 문서와 문서 검사를 3:2·레퍼런스 기준으로 동기화한다

**Files:**

- Modify: `docs/DOCUMENT_TERMINOLOGY.test.ts`
- Modify: `docs/experience/SCREEN_LAYOUT.md`
- Modify: `docs/README.md`
- Modify: `docs/diagram/README.md`
- Modify: `docs/diagram/screen-wireframes.md`
- Modify: `docs/superpowers/specs/2026-08-19-lattebun-campaign-rework-design.md`

**Interfaces:**

- Consumes: 승인된 U1 spec의 3:2·60:40·레퍼런스 범위
- Produces: 현재 공식 문서의 일관된 공통 셸 수치와 레퍼런스 PNG 색인
- Preserves: `docs/meetings/`의 당시 3:1 기록과 D8 소유 SVG·PNG

- [ ] **Step 1: 문서 앵커 검사의 실패 조건을 3:2로 바꾼다.**

`DOCUMENT_TERMINOLOGY.test.ts`의 `experience/SCREEN_LAYOUT.md` required anchor를 `["3:2", "1280×720", "색만으로"]`로 바꾼다. `diagram/README.md`의 required anchor에는 `"REFERENCE_UI_01_CAMPAIGN_BOARD.png"`를 추가한다.

- [ ] **Step 2: 현재 문서가 아직 3:1이어서 실패하는지 확인한다.**

Run: `pnpm test docs/DOCUMENT_TERMINOLOGY.test.ts`

Expected: FAIL. `SCREEN_LAYOUT.md`에는 아직 `3:1`만 있고 `diagram/README.md`에는 레퍼런스 파일명이 없다.

- [ ] **Step 3: 공식 문서를 같은 변경 단위로 갱신한다.**

다음의 정확한 수치를 쓴다.

- `SCREEN_LAYOUT.md`: MainContent `좌측 약 60%`, RightPanel `우측 약 40%`, 비율 `3:2`; 인트로 설명도 우측 40% 레일을 유지한다고 고친다. 시각 방향에 세 레퍼런스를 정보 위계 근거로 추가하고 PNG는 구현 자산이 아니라고 명시한다.
- `docs/README.md`: 화면 규격 설명을 `3:2 게임 셸`로 바꾼다. 회의 기록 링크 설명은 `당시 3:1 셸 논의 기록`으로 고쳐 현재 규칙과 구분한다.
- `diagram/README.md`: `## 시각 레퍼런스` 절을 추가해 세 PNG 링크, 게시판·지도·진행의 참고 역할, 공식 규칙보다 낮은 파생 자료 지위, 앱 임베드 금지를 적는다.
- `screen-wireframes.md`: 공통 게임 셸을 좌 60%·우 40%로 고친다. D8 재작업 대기 표시는 유지한다.
- 캠페인 개편 설계: `MainContent 좌측 약 60%`, `RightPanel 우측 약 40%`로 고친다.
- 과거 회의록과 SVG·PNG 파일은 수정하지 않는다.

- [ ] **Step 4: 문서 앵커 검사와 전체 문서 검사 묶음을 통과시킨다.**

Run: `pnpm test docs/DOCUMENT_TERMINOLOGY.test.ts`

Expected: PASS.

- [ ] **Step 5: 현재 규칙 문서 변경을 커밋한다.**

```bash
git add docs/DOCUMENT_TERMINOLOGY.test.ts docs/experience/SCREEN_LAYOUT.md docs/README.md docs/diagram/README.md docs/diagram/screen-wireframes.md docs/superpowers/specs/2026-08-19-lattebun-campaign-rework-design.md
git commit -m "문서: 공통 게임 셸의 3대2 기준을 동기화한다" -m "현재 화면 규격과 시각 자료에 좌 60%·우 40% 및 세 레퍼런스의 사용 범위를 반영한다."
```

### Task 5: 실제 브라우저에서 3:2·레퍼런스 프리뷰를 검증하고 배정표 기록을 정정한다

**Files:**

- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`
- Verify: `/u1-test`, 모든 U1 구현 파일, `CAMPAIGN_REWORK_WORK_ASSIGNMENT.test.ts`

**Interfaces:**

- Consumes: 완성된 3:2 셸, 다섯 정적 프리뷰, 현재 공식 문서
- Produces: 실제 viewport별 레이아웃 증거와 U2~U6이 재사용할 3:2 셸 완료 기록

- [ ] **Step 1: 네 가지 자동 검사를 실행한다.**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: 네 명령 모두 exit code 0이고 `/u1-test`가 production build route로 생성된다.

- [ ] **Step 2: 개발 서버와 실제 브라우저를 준비한다.**

`vercel:agent-browser`과 `vercel:agent-browser-verify`의 현재 `SKILL.md`를 읽는다. 실행 중인 같은 작업 디렉터리 서버가 없으면 `pnpm dev --hostname 127.0.0.1`을 실행하고, 있으면 기존 `http://127.0.0.1:3000/u1-test`를 사용한다.

```bash
agent-browser open http://127.0.0.1:3000/u1-test
agent-browser wait --load networkidle
agent-browser snapshot -i
agent-browser eval 'document.querySelector("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay") ? "ERROR_OVERLAY" : "OK"'
agent-browser errors
agent-browser console
```

Expected: 5개 nav button, 상태 바, 인트로 main, 구조적 right rail이 보이고 error overlay·page error는 없다.

- [ ] **Step 3: 1280×720에서 다섯 화면과 실제 3:2 track을 검증한다.**

```bash
agent-browser set viewport 1280 720
agent-browser find role button click --name "인트로"
agent-browser find role button click --name "게시판"
agent-browser find role button click --name "지도"
agent-browser find role button click --name "진행"
agent-browser find role button click --name "정산·엔딩"
agent-browser eval 'JSON.stringify((()=>{const body=document.querySelector("[data-testid=game-shell-body]");const tracks=getComputedStyle(body).gridTemplateColumns.split(" ").map(parseFloat);return {tracks,ratio:tracks[0]/tracks[1],scrollWidth:document.documentElement.scrollWidth,innerWidth}})())'
```

각 click 뒤에는 새 `agent-browser snapshot -i`로 화면 제목·좌 조작 모형·우 상세 구획과 `aria-pressed="true"`를 확인한다. 다섯 화면의 screenshot을 `/tmp/u1-3-2-<screen>-1280x720.png`에 저장해 실제 레퍼런스의 상태 칩·패널 구획·좌 조작/우 상세 역할과 비교한다.

Expected: 각 화면의 left/right track 비율은 `1.50 ± 0.01`, `scrollWidth <= innerWidth`, 인트로에도 aside가 존재한다.

- [ ] **Step 4: 1024×640에서 같은 불변 조건과 키보드를 검증한다.**

```bash
agent-browser set viewport 1024 640
agent-browser find role button click --name "게시판"
agent-browser press Enter
agent-browser eval 'JSON.stringify({selected:document.querySelector("[aria-pressed=true]")?.textContent,focused:document.activeElement?.textContent})'
agent-browser eval 'JSON.stringify((()=>{const body=document.querySelector("[data-testid=game-shell-body]");const tracks=getComputedStyle(body).gridTemplateColumns.split(" ").map(parseFloat);return {tracks,ratio:tracks[0]/tracks[1],scrollWidth:document.documentElement.scrollWidth,innerWidth}})())'
agent-browser errors
agent-browser console
```

Expected: selected/focused는 `게시판`, ratio는 `1.50 ± 0.01`, 가로 overflow·overlay·page error가 없다. `인트로`·`지도`·`진행`·`정산·엔딩`도 클릭해 같은 비율과 우측 레일을 재확인한다.

- [ ] **Step 5: 실제 결과를 배정표에 반영하고 무결성 검사를 실행한다.**

`CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`의 개편 범위, D5 완료 기준, U1 행을 `3:2 게임 셸`·`좌 60%·우 40%`로 바꾼다. `U1 완료 기록`은 다음을 사실대로 정정한다.

- 세 `REFERENCE_UI_*.png`를 정보 위계·시각 언어의 근거로 사용했고 앱에 임베드하지 않았음
- `GameShell`·`TopStatusBar`·`U1PreviewContent`·`U1Preview`의 재사용 계약
- 1280×720와 1024×640의 실제 track 값, 1.50 ratio, scrollWidth 결과
- 다섯 화면 클릭, Enter, `aria-pressed`, console/page error, screenshot 비교 결과
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` 결과

Run: `pnpm test docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.test.ts`

Expected: PASS. U1은 완료 상태를 유지하고 U2~U6의 직접 선행에는 완료된 U1이 다시 들어가지 않는다.

- [ ] **Step 6: 검증 기록을 커밋한다.**

```bash
git add docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md
git commit -m "문서: U1 3대2 레퍼런스 검증 기록을 남긴다" -m "실제 브라우저의 고정 60대40 셸, 다섯 프리뷰 상태, 접근성 및 회귀 검증 결과를 작업 배정표에 기록한다."
```

### Task 6: 최종 회귀 검증과 인계를 수행한다

**Files:**

- Verify: Tasks 1~5의 모든 변경 파일

**Interfaces:**

- Consumes: 커밋된 코드·공식 문서·배정표
- Produces: 구현과 문서가 같은 3:2 계약을 말한다는 최종 증거

- [ ] **Step 1: 전체 자동 검사를 다시 실행한다.**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

Expected: 모든 명령이 PASS이고 whitespace 오류가 없다.

- [ ] **Step 2: 현재 규칙의 3:2 선언과 금지된 구현을 확인한다.**

```bash
rg -n "minmax\(0, 3fr\) minmax\(0, 2fr\)|3:2|60%|40%|REFERENCE_UI_" app components docs/experience/SCREEN_LAYOUT.md docs/README.md docs/diagram/README.md docs/diagram/screen-wireframes.md docs/superpowers/specs/2026-08-19-lattebun-campaign-rework-design.md docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md
rg -n "grid-template-columns:\s*minmax\(0, 3fr\) minmax\(0, 1fr\)|overflow-x:\s*hidden|REFERENCE_UI_.*(png|svg)" app components
git status --short
```

Expected: 첫 명령은 U1 코드와 현재 문서의 3:2 근거를 보인다. 두 번째 명령은 출력이 없다. status에는 이 계획·spec 외의 의도하지 않은 변경이 없다.

- [ ] **Step 3: 인계에 정확한 결과를 기록한다.**

최종 보고에는 변경 파일, U2~U6이 재사용할 `GameShellProps` 슬롯·상태 칩·3:2 CSS 계약, 자동 검사 결과, 두 viewport의 실제 grid track·ratio·scrollWidth, 레퍼런스 PNG를 CSS 시각 언어로만 반영한 사실, 수정하지 않은 회의록·D8 자산 범위를 포함한다.
