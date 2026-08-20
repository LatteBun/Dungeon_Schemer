# U1 공통 게임 셸·프리뷰 하네스 설계

## 문서 정보

- 작성자: SangHwan Yoo
- 작성 도구: Codex
- 작성일: 2026-08-20
- 작업 항목: `U1`
- 근거 문서: [캠페인 개편 설계](2026-08-19-lattebun-campaign-rework-design.md), [화면 규격](../../experience/SCREEN_LAYOUT.md), [온보딩과 인터페이스](../../experience/ONBOARDING_AND_INTERFACE.md)

## 1. 목적

U1은 인트로부터 정산·엔딩까지 모든 주요 화면이 공유할 게임 셸을 만든다. 셸은 화면별 게임 규칙이나 캠페인 상태를 소유하지 않고, 상단 상태 바와 본문 두 영역의 위치를 고정한다. 이후 `U2`~`U6`는 같은 셸에 콘텐츠만 주입한다.

구현 결과는 실제 캠페인 규칙을 연결하지 않은 `/u1-test` 프리뷰에서 확인한다. 프리뷰는 다섯 화면의 콘텐츠 교체, 접근성 상태, 반응형 동작을 검증하기 위한 하네스이며 실제 게임 흐름이 아니다.

## 2. 사용자 승인으로 확정한 핵심 불변 조건

### 2.1 셸은 항상 3:1이다

셸 본문은 어떤 화면·상태·해상도에서도 두 열을 유지한다.

```text
GameShell
├─ TopStatusBar  전체 폭
└─ Body
   ├─ MainContent  3fr
   └─ RightPanel   1fr
```

- 본문 grid track은 항상 `minmax(0, 3fr) minmax(0, 1fr)`이다.
- 인트로처럼 우측에 콘텐츠가 없어도 우측 25% 레일을 구조적으로 렌더링한다. 두 열을 합쳐 MainContent를 전체 폭으로 확장하지 않는다.
- 최소 지원 해상도 아래에서도 두 열을 세로로 쌓거나 breakpoint로 비율을 바꾸지 않는다.
- 좁은 화면에서는 각 열의 내부 콘텐츠가 줄바꿈되고 세로 스크롤만 생긴다.
- `min-width: 0`, 줄바꿈, 유연한 상태 바를 사용해 콘텐츠가 열의 폭을 밀어내지 않도록 한다.
- 브라우저 검증에서 실제 두 grid track의 너비 비율이 3:1인지 확인한다. 단순히 화면이 잘 보이는지만 확인하지 않는다.

이 결정으로 기존 `SCREEN_LAYOUT.md`의 “인트로 MainContent 전체 폭” 설명은 셸 불변 조건과 충돌한다. 구현 변경 단위에서 해당 문서를 “우측 레일은 유지하고 콘텐츠만 비움”으로 갱신한다.

### 2.2 셸과 콘텐츠를 분리한다

- `GameShell`은 레이아웃·랜드마크·공통 상태 표시만 책임진다.
- `TopStatusBar`는 전달받은 표시값만 렌더링한다.
- `U1Preview`는 다섯 화면 중 현재 선택과 프리뷰용 표시 데이터를 보유한다.
- 캠페인 규칙, 도메인 상태, 난수, Zustand, 영속화는 U1에 넣지 않는다.
- 프리뷰 fixture는 `app/u1-test` 경계에서 만들고 게임 컴포넌트에 props로 전달한다.

## 3. 대안 검토

### 대안 A — 슬롯 기반 공통 셸과 프리뷰 하네스 (채택)

`GameShell`이 `main`과 `rightPanel` 슬롯을 받고 `/u1-test`의 클라이언트 프리뷰가 화면별 콘텐츠를 교체한다.

- 장점: U2~U6가 셸 API를 재사용하고 실제 상태를 나중에 주입하기 쉽다.
- 장점: 브라우저에서 다섯 화면을 같은 viewport로 비교할 수 있다.
- 단점: U1 자체는 실제 캠페인을 진행하지 않는다.

### 대안 B — App Router 중첩 layout 기반 셸

라우트 layout이 셸을 소유하고 각 하위 route가 콘텐츠를 제공한다.

- 장점: 최종 화면 URL 구조와 가깝다.
- 단점: U1 프리뷰의 화면 전환과 레이아웃 검증이 라우팅 구조에 결합된다.
- 단점: 아직 확정되지 않은 `I1` 전이·스토어 설계를 앞당긴다.

### 대안 C — 단일 프리뷰 페이지에 셸과 모든 콘텐츠를 함께 작성

- 장점: 초기 작성량이 가장 적다.
- 단점: 셸과 화면 콘텐츠가 섞여 U2~U6에서 재사용하기 어렵다.
- 단점: 3:1 불변 조건을 검증하는 단위가 분리되지 않는다.

대안 A가 현재 의존성 그래프와 가장 잘 맞고, 이후 구현의 결합도를 가장 낮춘다.

## 4. 컴포넌트 계약

### 4.1 `GameShell`

위치: `components/game/GameShell.tsx`

책임:

- 전체 게임 화면의 `header`와 `main` landmark를 제공한다.
- 상단 상태 바 아래에 항상 3:1 두 열을 렌더링한다.
- MainContent와 RightPanel의 콘텐츠를 전달받아 표시한다.
- 우측 콘텐츠가 없어도 구조적 RightPanel을 유지한다.

개념적 props:

```ts
interface GameShellProps {
  status: TopStatusView;
  screenTitle: string;
  main: ReactNode;
  rightPanel?: ReactNode;
  rightPanelLabel?: string;
}
```

`main`과 `rightPanel`은 게임 도메인 타입이 아닌 `ReactNode` 슬롯이다. 셸은 슬롯 내부를 해석하지 않는다.

### 4.2 `TopStatusBar`

위치: `components/game/TopStatusBar.tsx`

표시 항목:

- 길잡이 등급
- 현재 명성
- 현재 골드
- 승급 가능 여부
- 남은 던전 수
- 선택적 현재 던전명·위험도

각 값은 라벨과 값이 함께 보이며, 승급 가능 여부는 색상만으로 표현하지 않는다. 예를 들어 `승급 가능` 또는 `승급 조건 미달` 문구를 함께 표시한다.

### 4.3 `U1Preview`

위치: `components/game/U1Preview.tsx`

프리뷰 화면 ID는 다음 다섯 개로 고정한다.

```ts
type U1PreviewScreen =
  | "intro"
  | "board"
  | "map"
  | "progress"
  | "settlement";
```

화면 선택은 버튼으로 구현하고 현재 버튼에 `aria-pressed="true"`를 준다. 화면별 더미 콘텐츠는 셸의 폭과 상태 표현을 확인할 수 있을 정도로만 제공한다.

### 4.4 프리뷰 라우트

위치: `app/u1-test/page.tsx`

라우트는 `U1Preview`를 렌더링하는 진입점만 담당한다. 실제 캠페인 시작·전이·저장은 제공하지 않는다.

## 5. 레이아웃과 스타일

### 5.1 본문 grid

셸 본문은 전 viewport에서 동일한 grid 선언을 사용한다.

```css
.game-shell__body {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 1fr);
}
```

열 사이의 구분은 별도 열을 추가하지 않고 RightPanel의 border와 내부 padding으로 표현한다. 따라서 두 track의 너비 비율은 3:1로 직접 측정할 수 있다.

새 breakpoint에서 `grid-template-columns: 1fr`, `display: block`, `grid-column: 1 / -1`을 사용하지 않는다. 이는 3:1 불변 조건을 깨므로 금지한다.

### 5.2 overflow 방지

- 셸, 본문, 두 열, 상태 바에 `min-width: 0`을 적용한다.
- 긴 텍스트는 `overflow-wrap: anywhere` 또는 동등한 유틸리티로 줄바꿈한다.
- 고정 폭 카드·패널·버튼을 만들지 않는다.
- 가로 overflow를 숨겨 검증을 우회하지 않는다. 콘텐츠 자체가 줄어들도록 만든다.
- 기준 해상도는 1280×720, 최소 지원은 1024×640이다.
- 최소 지원 아래에서도 3:1은 유지하고 세로 방향으로만 콘텐츠가 늘어날 수 있다.

### 5.3 시각·상태 단서

기존 디자인 토큰을 우선 사용한다. 필요한 색상은 `app/globals.css`의 `@theme`에 추가한다. 활성·위험·선택·잠금 상태는 색상과 함께 텍스트, 기호, 테두리, `aria-*` 속성 중 하나 이상을 사용한다.

## 6. 접근성

- 화면 전환 컨트롤은 네이티브 button이다.
- 버튼 이름에 화면 목적을 명시한다.
- 현재 화면은 `aria-pressed`와 시각적 상태 문구를 함께 가진다.
- `header`, `main`, `aside` landmark를 의미에 맞게 사용한다.
- 우측 레일이 비어 있는 인트로에서도 구조적 레일은 유지하되 빈 상태가 보조기술에 불필요한 내용을 만들지 않도록 한다.
- 키보드 Tab 순서가 화면 선택 컨트롤에서 셸 콘텐츠로 자연스럽게 이어진다.
- 포커스 표시를 제거하지 않는다.

## 7. 테스트와 검증

### 7.1 자동 검사

- 프리뷰 화면 ID가 정확히 다섯 개이고 중복이 없는지 검사한다.
- 화면별 셸 입력이 MainContent와 RightPanel 슬롯을 제공하는지 검사한다.
- 상태 바 표시값과 화면 제목의 fixture 계약을 검사한다.
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

React DOM 동작의 핵심은 Node 단위 테스트로 흉내 내지 않고 실제 브라우저 검증으로 확인한다. 현재 저장소에는 `jsdom`과 React Testing Library가 없으므로 U1에서 별도 테스트 환경을 추가하지 않는다.

### 7.2 브라우저 검증

개발 서버를 실행한 뒤 실제 브라우저 자동화로 `/u1-test`를 확인한다.

검증 항목:

1. 페이지 진입 성공과 콘솔 오류 0건
2. 다섯 화면 선택 버튼 노출
3. 마우스 클릭과 키보드 Enter에 의한 화면 전환
4. 현재 버튼의 `aria-pressed` 변경
5. 화면별 제목·본문·우측 패널 콘텐츠 교체
6. 인트로에서도 우측 25% 구조적 레일 유지
7. 1280×720에서 두 grid track 비율 3:1
8. 1024×640에서 두 grid track 비율 3:1
9. 두 해상도에서 `scrollWidth <= innerWidth`
10. 두 해상도에서 가로로 잘린 셸 콘텐츠가 없고 세로 스크롤만 허용됨
11. 두 해상도의 실제 스크린샷 확인

브라우저 검증이 실패하면 U1 완료 표시와 문서 갱신을 하지 않는다. 수정 뒤 전체 자동 검사와 브라우저 검증을 다시 실행한다.

## 8. 범위 밖

- 실제 캠페인 상태와 Zustand 스토어 연결
- 인트로의 실제 온보딩 문구와 캠페인 시작 전이
- 게시판·지도·진행·정산의 실제 게임 규칙과 콘텐츠
- 저장·복원, 로그인, Supabase
- 애니메이션과 자동 전투 연출
- U2~U6의 완료 기준

## 9. 변경 파일과 문서 동기화

구현 시 다음 파일을 추가·수정한다.

- `components/game/GameShell.tsx`
- `components/game/TopStatusBar.tsx`
- `components/game/U1Preview.tsx`
- `components/game/u1-preview.test.ts`
- `app/u1-test/page.tsx`
- `app/globals.css`
- `docs/experience/SCREEN_LAYOUT.md`
- `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

`SCREEN_LAYOUT.md`에는 인트로에서도 우측 레일을 유지한다는 U1 불변 조건을 반영한다. `CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`에는 U1 상태, 완료 기록, 재사용 파일·프리뷰 경로·검증 명령을 기록하고 U2~U6의 완료된 직접 선행 `U1`을 제거한다.

## 10. 완료 기준

- `GameShell`이 모든 프리뷰 화면에서 같은 구조를 렌더링한다.
- 모든 화면과 모든 지원 viewport에서 MainContent:RightPanel grid track 비율이 3:1이다.
- 인트로에도 우측 레일이 유지된다.
- 1280×720 및 1024×640에서 가로 스크롤이 없다.
- 다섯 화면이 버튼과 키보드로 전환된다.
- 상태·포커스·선택 여부가 색상 외 단서와 접근성 속성으로 전달된다.
- 자동 검증 네 명령과 실제 브라우저 검증이 모두 통과한다.
- 화면 규격 문서와 작업 배정표가 구현과 같은 변경 단위로 갱신된다.

