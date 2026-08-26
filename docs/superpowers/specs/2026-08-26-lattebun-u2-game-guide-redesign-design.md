# U2 이미지 게임 가이드 재설계

## 문서 정보

- 작성일: 2026-08-26
- 개정일: 2026-08-26
- 작성자: LatteBun
- 작성 도구: Codex
- 작업 항목: `U2`
- 대상 브랜치: `spec/u2-game-guide-redesign`
- 목적: U2의 가이드 정보를 승인된 단일 이미지로 보여 주고, 상단 상태 바와 실제 게시판 진입 CTA만 기존 애플리케이션 계약으로 유지한다.
- 근거 문서: `docs/README.md`, `docs/GAME_PRINCIPLES.md`, `docs/experience/ONBOARDING_AND_INTERFACE.md`, `docs/experience/SCREEN_LAYOUT.md`
- 주요 구현 위치: `components/game/IntroScreen.tsx`, `app/u2-intro.css`, `public/assets/u2/game-guide-bg.png`
- 관련 회귀 위치: `components/game/IntroScreen.test.ts`, `components/game/U2Preview.test.ts`, `e2e/routes.spec.ts`, `e2e/canvas-layout.spec.ts`, `e2e/campaign-smoke.spec.ts`

## 1. 개정 배경

초기 설계는 역할 소개, 도움/배신 전략 카드, 승급·목표·조기 종료 패널을 React 마크업과 CSS로 각각 구성했다. 최종 시각 자산인 `game-guide-bg.png`가 같은 정보를 하나의 완성된 게임 가이드 화면으로 제공하므로, U2 본문을 중복해서 다시 조립하지 않는다.

이번 개정은 다음 원칙을 따른다.

- 화면에 보이는 U2 본문은 승인된 이미지 한 장이다.
- 이미지에 그려진 하단 붉은 빈 프레임 위에 실제 `길드 게시판으로` CTA만 겹친다.
- 공용 `TopStatusBar`는 기존 값과 상호작용을 그대로 유지한다.
- 프리뷰의 링크와 실제 캠페인의 `OPEN_BOARD` 버튼이라는 CTA 계약을 유지한다.
- 이미지 속 글자가 늘어나거나 잘리지 않도록 원본 비율을 보존한다.
- 시각적 중복은 제거하되 스크린 리더용 역할·전략 요약은 유지한다.

## 2. 사용자 경험

U2는 1920×1080 고정 캔버스에서 다음 두 영역으로 끝난다.

1. 상단 공용 상태 바
2. 상태 바 아래의 이미지 게임 가이드와 하단 CTA

별도의 도움/배신 카드, 정보 패널, 설명 문단, 선택 상태, 펼쳐보기, tooltip은 화면에 추가하지 않는다. 플레이어는 이미지의 역할 설명, 도움과 배신의 차이, 승급 경로, 15개 던전 목표, 조기 종료 위험을 읽고 이미지 하단의 `길드 게시판으로`를 누른다.

## 3. 이미지 자산 계약

### 3.1 자산

- 경로: `/assets/u2/game-guide-bg.png`
- 저장소 파일: `public/assets/u2/game-guide-bg.png`
- 원본 크기: 1672×941
- 원본 비율: 약 1.777:1
- 자산 자체를 CSS 배경과 여러 DOM 카드로 분해하지 않는다.
- 새 파생 이미지나 별도 모바일 이미지를 만들지 않는다.

### 3.2 맞춤 방식

이미지는 상단 상태 바를 제외한 U2 stage 안에서 `contain` 방식으로 표시한다.

- 원본 종횡비를 유지한다.
- 이미지의 모든 가장자리와 글자가 보여야 한다.
- 가로나 세로로 늘이지 않는다.
- stage를 채우기 위해 이미지를 자르지 않는다.
- 남는 좌우 공간은 기존 U2의 어두운 무대색으로 처리한다.
- 이미지 내부에 스크롤을 만들지 않는다.
- 브라우저 크기가 바뀌면 1920×1080 캔버스 전체가 기존 규칙대로 균일 축척되며, U2 내부만 별도로 재배치하지 않는다.

### 3.3 DOM 구조

이미지와 CTA의 좌표가 함께 축척되도록 원본과 같은 `1672 / 941` 비율의 guide wrapper를 둔다. 이미지는 wrapper 전체를 채우고, CTA는 wrapper 기준 백분율 좌표로 붉은 프레임 안에 배치한다.

개념 구조는 다음과 같다.

```tsx
<main className="u2-intro-stage" aria-labelledby="u2-intro-title">
  <div className="u2-intro__guide">
    <img className="u2-intro__guide-image" src="/assets/u2/game-guide-bg.png" alt="" aria-hidden="true" />
    <div className="sr-only">
      <h1 id="u2-intro-title">당신은 용사들을 던전으로 안내하는 고블린 길잡이입니다.</h1>
      <p>도움과 배신의 전략, 승급 경로, 원정 목표와 조기 종료 위험을 안내합니다.</p>
    </div>
    {preview ? <a className="u2-intro__cta">길드 게시판으로</a> : <button className="u2-intro__cta">길드 게시판으로</button>}
  </div>
</main>
```

정확한 wrapper 크기 계산은 CSS가 소유하되, `contain` 결과와 CTA의 이미지 상대 좌표가 깨지지 않아야 한다.

## 4. CTA 계약

### 4.1 위치와 크기

`길드 게시판으로` CTA는 이미지 아래쪽에 이미 그려진 붉은 빈 프레임의 안쪽을 채운다.

- CTA의 기준 좌표는 stage가 아니라 이미지 wrapper다.
- 이미지가 축소되면 CTA 위치·너비·높이도 같은 비율로 축소된다.
- CTA 테두리는 붉은 프레임의 안쪽 금색 선을 침범하지 않는다.
- CTA 텍스트는 프레임의 수평·수직 중앙에 놓인다.
- 기존 계약 인장과 화살표 이미지는 제거하고 텍스트만 표시한다.
- hover, active, `:focus-visible`은 유지하되 이미지 원본을 가리는 과도한 효과는 사용하지 않는다.

초기 보정 기준은 원본 이미지 좌표의 약 `left 28.2%`, `top 91.75%`, `width 43.5%`, `height 6.9%`다. 구현 시 실제 붉은 프레임 안쪽을 기준으로 광학 보정할 수 있으며, 최종 값은 1920×1080 브라우저 확인으로 확정한다.

### 4.2 동작

- `onEnterBoard`가 없으면 `boardHref`를 사용하는 링크다.
- `onEnterBoard`가 있으면 `type="button"`이며 기존 콜백을 호출한다.
- 실제 `/campaign`에서는 기존 `OPEN_BOARD` 전이가 유지된다.
- accessible name은 두 경로 모두 `길드 게시판으로`다.

## 5. 상단 상태 바와 아키텍처 경계

다음 기존 계약은 수정하지 않는다.

- `TopStatusBar`
- `TopStatusView`
- `campaign-adapters.ts`의 `statusFor()`
- Store, domain 타입, 게임 규칙, 엔딩·승급 계산
- U2 preview의 시작 상태 fixture
- 게시판 이후 U3~U6의 60:40 `GameShell`

U2는 계속 `IntroScreenProps { status, boardHref, onEnterBoard? }`만 소비한다. 이미지 표시를 위해 새 Store 필드, selector, service, 상태 타입을 만들지 않는다.

## 6. 정보 비노출 경계

이미지는 캠페인 전략을 설명하지만 실제 던전 조언의 내부 유형이나 정답을 알려 주지 않는다.

- `help / harm / neutral` 유형 라벨을 실제 조언 UI에 추가하지 않는다.
- 정답 색, 정합·모순 관계를 노출하지 않는다.
- 구체적인 승급 요구치나 엔딩 판정식을 별도 DOM으로 추가하지 않는다.
- 공용 상태 바의 기존 `의심 인원 0 / 5`, 남은 용사, 남은 던전과 정보 팝오버는 그대로 둔다.

## 7. 접근성

이미지 속 긴 글자를 하나의 장황한 `alt`로 반복하지 않는다.

- 가이드 이미지는 장식 이미지로 처리해 `alt=""`와 `aria-hidden="true"`를 사용한다.
- `main`에는 기존과 같은 안정적인 접근성 이름을 제공한다.
- `sr-only` 제목과 간결한 요약 목록으로 길잡이 역할, 도움/배신 전략, 두 승급 경로, 15개 던전 목표, 조기 종료 위험을 전달한다.
- 숨은 요약에는 실제 조언의 내부 정답 유형이나 정확한 엔딩 임계값을 넣지 않는다.
- CTA는 네이티브 링크 또는 버튼이고 키보드 focus가 명확해야 한다.

## 8. 구현 범위

### 변경

- `public/assets/u2/game-guide-bg.png`: 승인된 원본 자산 추가
- `components/game/IntroScreen.tsx`: 기존 가시적 카드·패널을 이미지 wrapper, 숨은 요약, CTA로 교체
- `app/u2-intro.css`: 기존 카드 grid를 제거하고 contain image stage 및 frame-aligned CTA 구현
- `components/game/IntroScreen.test.ts`: 이미지, 접근성 요약, CTA 이중 계약, 금지 구조 검증
- `components/game/U2Preview.test.ts`: 이미지 경로와 기존 `/u3-test` 링크 검증
- 필요할 경우 `e2e/routes.spec.ts`: 기존 안정적인 main accessible name 유지 여부 검증
- `docs/experience/ONBOARDING_AND_INTERFACE.md`, `docs/experience/SCREEN_LAYOUT.md`: 이미지 중심 계약 동기화

### 변경하지 않음

- `components/game/TopStatusBar.tsx`
- `components/game/campaign-adapters.ts`
- Store와 domain/rules
- 게시판 이후 화면
- 이미지 생성·편집

## 9. 테스트와 검증

### 정적 렌더 테스트

최소 다음을 검증한다.

- `/assets/u2/game-guide-bg.png`가 렌더링된다.
- 가이드 이미지가 `alt=""`와 `aria-hidden="true"`를 사용한다.
- 기존 가시적 `.u2-intro__strategy`, `.u2-intro__strategy-card`, `.u2-intro__facts` 구조가 제거된다.
- `sr-only` 제목과 전략 요약이 존재한다.
- 프리뷰 CTA는 기존 `boardHref` 링크다.
- 실제 캠페인 CTA는 버튼이며 기존 callback을 호출할 수 있다.
- CTA에는 계약 인장과 화살표 이미지가 없다.
- `TopStatusBar`는 계속 렌더링된다.

### CSS 계약 테스트

- guide wrapper가 `aspect-ratio: 1672 / 941`을 사용한다.
- 이미지가 wrapper를 왜곡 없이 채운다.
- stage는 `overflow: hidden`이고 내부 스크롤을 만들지 않는다.
- CTA는 guide wrapper 기준 absolute percentage 좌표다.
- CTA `:focus-visible`이 유지된다.
- 새 `@media`, `vw`, `vh`, 공용 상태 바 토큰 재정의를 추가하지 않는다.

### 브라우저 회귀

- `/campaign`과 `/u2-test`가 기존 main accessible name으로 발견된다.
- 1920×1080에서 상단 상태 바와 이미지가 겹치지 않는다.
- 이미지 전체가 잘림·왜곡 없이 보인다.
- 좌우 여백이 균등하다.
- CTA가 붉은 프레임 안에 들어가며 텍스트가 중앙 정렬된다.
- CTA 클릭 후 게시판으로 전이한다.
- 2560×1440, 1440×900, 1280×1024에서도 문서 스크롤과 캔버스 밖 이미지가 없다.
- 새 브라우저 오류와 Next 오류 overlay가 없다.

검증 명령:

```bash
pnpm test components/game/IntroScreen.test.ts components/game/U2Preview.test.ts components/game/campaign-render.test.tsx
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e e2e/routes.spec.ts e2e/canvas-layout.spec.ts e2e/campaign-smoke.spec.ts
pnpm build
```

## 10. 완료 조건

- U2에서 상단 상태 바 아래에 `game-guide-bg.png` 전체가 원본 비율로 표시된다.
- 이미지가 늘어나거나 잘리지 않는다.
- 남는 좌우 공간은 어두운 배경으로 자연스럽게 처리된다.
- `길드 게시판으로` CTA가 이미지의 붉은 프레임 안에 정확히 놓인다.
- 화면에 별도의 카드·패널·설명 텍스트가 중복 표시되지 않는다.
- 스크린 리더는 U2의 역할과 핵심 전략을 이해할 수 있다.
- 프리뷰 링크와 실제 캠페인 버튼 전이가 모두 유지된다.
- 공용 상태 바, Store, adapter, domain/rules, 게시판 이후 화면은 바뀌지 않는다.
- 관련 문서와 회귀 테스트가 이미지 중심 계약을 반영한다.

## 11. 범위 밖

- 가이드 이미지의 내용 수정 또는 재생성
- 반응형 모바일용 별도 이미지
- U2 다중 페이지·확대·pan·zoom
- 이미지 속 개별 영역을 클릭 가능한 전략 선택지로 만드는 기능
- 실제 던전 조언에 도움/배신 또는 정답 라벨 추가
- 게임 규칙·밸런스 변경
