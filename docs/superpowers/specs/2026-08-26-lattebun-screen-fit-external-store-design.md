# ScreenFit 전체 화면 외부 상태 구독 설계

## 문서 정보

- 작성자: LatteBun
- 작성 도구: Codex
- 작성일: 2026-08-26
- 대상 작업: 모바일 세로 안내의 전체 화면 가능 여부를 React 외부 상태로 구독
- 기준 브랜치: `fix/screen-fit-external-store`
- 기준 커밋: `2f33e0d`

## 1. 문제와 목표

`components/game/ScreenFit.tsx`는 mount 직후 `useEffect` 안에서
`setFullscreenAvailable(...)`을 동기 호출한다. 현재 Next.js 16.3의 React Hooks
ESLint 규칙은 이 호출을 `react-hooks/set-state-in-effect` 오류로 판정한다.

현재 동작은 대부분 한 번의 추가 렌더링으로 끝나며 런타임 크래시를 일으키지는
않지만, 저장소 전체 ESLint를 실패시키고 전체 화면 상태를 React 상태에 수동으로
복사한다. 브라우저의 `document.fullscreenElement`는 React 밖에서 변하는 값이므로
이중 상태를 만들지 않고 브라우저 이벤트를 직접 구독한다.

완료 목표는 다음과 같다.

- Effect 본문에서 `fullscreenAvailable` 상태를 동기 갱신하지 않는다.
- 전체 화면 가능 여부는 `useSyncExternalStore`로 읽는다.
- 브라우저의 `fullscreenchange`가 발생하면 현재 snapshot을 다시 읽는다.
- 서버 렌더와 hydration은 모두 `false` snapshot으로 시작해 HTML 불일치를 만들지
  않는다.
- 안드로이드 계열의 `전체 화면으로 열기` 버튼과 전체 화면 API가 없는 기기의
  `홈 화면에 추가` 안내 분기는 현재와 동일하게 유지한다.
- 캔버스 축척, 세로 회전 안내, 전체 화면 진입과 가로 잠금 순서는 변경하지 않는다.

## 2. 근거와 범위

근거 문서는 다음과 같다.

- `docs/README.md`
- `docs/GAME_PRINCIPLES.md`
- `docs/experience/SCREEN_LAYOUT.md`
- Next.js 16.3 `use client`와 ESLint 공식 가이드
- React `useSyncExternalStore` 공식 API 문서

`ScreenFit`은 브라우저 API와 이벤트를 사용하는 기존 Client Component이므로
`"use client"` 경계는 유지한다. React 공식 계약에 따라 `subscribe`는 변경
callback을 등록하고 cleanup을 반환하며, `getSnapshot`은 반복 호출 사이 값이
변하지 않으면 같은 primitive boolean을 반환한다. SSR을 사용하는 Next.js App
Router에서는 세 번째 인수 `getServerSnapshot`을 명시한다.

이번 변경은 모바일 전체 화면 기능의 상태 소유 방식과 lint 회귀만 다룬다. 게임
규칙, 고정 캔버스 비율, CSS, manifest, 안내 문구와 시각 디자인은 바꾸지 않는다.
사용자가 보는 계약이 변하지 않으므로 `GAME_PRINCIPLES.md`와
`SCREEN_LAYOUT.md`의 공식 규칙은 갱신하지 않는다.

## 3. 상태 구독 설계

### 3.1 Snapshot

컴포넌트 바깥에 다음 책임을 둔다.

- `fullscreenEntryAvailable(target, fullscreenElement)`는 전체 화면 API 지원과 현재
  전체 화면 진입 여부를 입력으로 받아 boolean을 반환한다. 브라우저 snapshot은
  이 순수 경계를 사용한다.
- 클라이언트 snapshot은 `document.documentElement`가 표준 또는 WebKit 전체 화면
  진입 API를 제공하고, 현재 `document.fullscreenElement`가 `null`일 때만 `true`다.
- 서버 snapshot은 항상 `false`다. 서버에는 `document`가 없고, 초기 HTML에서는
  세로 안내 자체가 렌더링되지 않으므로 안전한 공통 초기값이다.

snapshot은 boolean만 반환한다. 매 호출마다 새 객체를 만들지 않아
`useSyncExternalStore`의 안정성 조건을 만족한다.

### 3.2 Subscription

`subscribeToFullscreenChanges(target, callback)`은 전달받은 `EventTarget`의
`fullscreenchange`에 callback을 등록하고 cleanup에서 같은 listener를 제거한다.
프로덕션의 `subscribeFullscreenAvailability(callback)`은 이 함수에 `document`를
전달한다. 구독 함수는 컴포넌트 밖에 선언해 렌더마다 함수 identity가 달라져
재구독되는 일을 막는다.

전체 화면 요청이 성공하거나 사용자가 전체 화면에서 나오면 브라우저가 이벤트를
발행하고 React가 snapshot을 다시 읽는다. snapshot이 바뀐 경우에만 컴포넌트를
다시 렌더링한다.

### 3.3 기존 Effect 경계

현재 `useEffect`는 다음 책임만 유지한다.

- 실제 visible viewport로 루트 font size를 동기화한다.
- 세로·가로 및 coarse pointer 변화에 따라 회전 안내 여부를 갱신한다.
- resize, orientationchange, visual viewport listener를 등록하고 해제한다.

`fullscreenAvailable`용 `useState`와 setter, Effect 안의 즉시 setter 호출은
제거한다. 캔버스 축척과 `needsTurn` 흐름은 이번 lint 수정 범위에서 재설계하지
않는다.

## 4. UI와 오류 처리

렌더링 분기는 기존과 같다.

```text
세로 + coarse pointer가 아님 → ScreenFit 미표시
세로 + coarse pointer + 전체 화면 가능 → 전체 화면으로 열기 버튼
세로 + coarse pointer + 전체 화면 불가 → 홈 화면에 추가 안내
```

전체 화면 요청 거부와 가로 잠금 미지원은 기존 `enterLandscapeFullscreen`이
조용히 처리한다. 구독 listener 등록과 해제에는 별도 예외를 만들지 않는다.
브라우저가 전체 화면 이벤트를 지원하지 않아도 표준 `addEventListener` 호출과
cleanup은 안전하며, 기존 분기보다 기능을 축소하지 않는다.

## 5. 테스트 및 검증

TDD 순서는 다음과 같다.

1. `MobileFullscreen.test.ts`에 실제 동작 테스트를 추가한다.
   - 전체 화면 API가 있고 활성 전체 화면이 없을 때만 진입 가능하다.
   - 실제 `EventTarget`의 `fullscreenchange`가 callback을 호출한다.
   - cleanup 뒤 같은 이벤트는 callback을 다시 호출하지 않는다.
2. 테스트를 실행해 기존 구현에서 RED를 확인한다.
3. `ScreenFit.tsx`를 외부 상태 구독 구조로 변경한다.
4. 관련 단위 테스트와 `ScreenFit.tsx` 단독 ESLint를 GREEN으로 만든다.
5. 전체 Vitest, ESLint, TypeScript, Next.js Webpack build를 실행한다.
6. 모바일 세로 viewport에서 안내가 렌더링되고 브라우저 콘솔 오류가 없는지
   Chromium으로 확인한다.

완료 조건:

- `npx vitest run components/game/MobileFullscreen.test.ts` 통과
- `npx eslint components/game/ScreenFit.tsx` 오류 0개
- `npm test` 통과
- `npm run typecheck` 통과
- `npx eslint . --ignore-pattern 'playwright-report/**' --ignore-pattern 'test-results/**'`
  오류 0개
- `npm run build -- --webpack` 통과
- `git diff --check` 통과

## 6. 변경 파일

- Modify: `components/game/ScreenFit.tsx`
- Modify: `components/game/MobileFullscreen.test.ts`
- Modify: `docs/README.md`
- Add: `docs/superpowers/specs/2026-08-26-lattebun-screen-fit-external-store-design.md`
- Add: `docs/superpowers/plans/2026-08-26-lattebun-screen-fit-external-store.md`

## 7. 변경하지 않는 것

- `needsTurn`과 캔버스 font size 동기화 구조
- `canGoFullscreen`과 `enterLandscapeFullscreen`의 공개 인터페이스
- 전체 화면 진입 후 가로 잠금 순서와 실패 처리
- manifest와 iOS 홈 화면 설치 안내
- 1920×1080 고정 캔버스와 레터박스
- CSS, 자산, 문구, 게임 규칙, 캠페인 상태
