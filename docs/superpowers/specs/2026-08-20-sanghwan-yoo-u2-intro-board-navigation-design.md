# U2 인트로에서 게시판 프리뷰로 진입하는 연결 설계

## 문서 정보

- 작성자: SangHwan Yoo
- 작성 도구: Codex
- 최초 작성일: 2026-08-20
- 개정일: 2026-08-20
- 작업 항목: `U2`
- 근거 문서: [게임 원칙](../../GAME_PRINCIPLES.md), [온보딩과 인터페이스](../../experience/ONBOARDING_AND_INTERFACE.md), [화면 규격](../../experience/SCREEN_LAYOUT.md), [캠페인 개편 작업 배정표](../../technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md)

## 1. 목적

현재 U2 인트로는 역할·개입 수단·캠페인 목표를 보여주지만, `길드 게시판으로` CTA를 클릭해도 실제 화면으로 이동하지 않고 숨김 피드백만 갱신한다. U2 완료 조건인 “게시판으로 진입”을 충족하도록 CTA를 기존 게시판 프리뷰 화면에 연결한다.

이번 변경은 실제 캠페인 상태 머신이나 게시판 규칙을 새로 구현하지 않는다. 이미 존재하는 `/u1-test`의 정적 게시판 프리뷰를 다음 화면의 시각·정보 구조를 확인하는 목적지로 재사용한다. U3가 실제 게시판·계약 화면을 구현할 때는 이 프리뷰 목적지를 대체할 수 있다.

## 2. 현재 구현에서 확인한 사실

- `app/u2-test/page.tsx`는 `U2Preview`를 렌더링한다.
- `U2Preview`는 `IntroScreen`에 시작 상태를 전달하고, CTA 콜백에서는 `entryRequested` 상태와 숨김 문구만 갱신한다.
- `IntroScreen`의 CTA는 `button`이며 목적지 URL을 표현하지 않는다.
- `app/u1-test/page.tsx`는 `U1Preview`를 렌더링한다.
- `U1Preview`는 `intro`, `board`, `map`, `progress`, `settlement`를 한 페이지에서 선택하며, 초기 화면은 `intro`로 고정되어 있다.
- `U1PreviewContent`에는 이미 `길드 공고`, 공고 카드, 계약 상세, 출전 파티, 계약 버튼을 포함한 게시판 프리뷰가 있다.
- 공식 온보딩 문서는 인트로의 다음 화면을 공고 게시판으로 정의하고, 다이어그램도 `인트로 → 게시판` 전이를 정의한다.

따라서 누락된 것은 U2의 안내 내용이나 U3의 게시판 정보 구조가 아니라, 인트로 CTA와 기존 게시판 프리뷰 사이의 라우팅 계약이다.

## 3. 사용자 승인으로 확정한 접근

### 3.1 기존 U1 프리뷰에 query parameter로 진입한다

CTA의 목적지는 다음 URL로 고정한다.

```text
/u1-test?screen=board
```

`/u1-test` 자체는 기존처럼 인트로 프리뷰를 기본 화면으로 유지한다. `screen=board`가 정확히 전달된 경우에만 게시판 프리뷰를 초기 화면으로 선택한다. 알 수 없는 값이나 누락된 값은 안전하게 `intro`로 처리한다.

이 방식은 새 `/board-test` 경로를 만들거나 게시판 마크업을 복제하지 않고, 이미 U1에서 검증한 게시판 프리뷰를 U2 다음 화면으로 연결한다. URL에 화면 의도가 남으므로 브라우저 새로고침·직접 진입·공유에도 같은 게시판 화면이 열린다.

### 3.2 CTA는 탐색 링크로 표현한다

화면을 바꾸는 CTA는 상태 피드백용 버튼이 아니라 네이티브 링크로 렌더링한다. `IntroScreen`은 `boardHref`를 받아 `<a href={boardHref}>`를 렌더링하고 기존 버튼의 시각 class와 포커스 스타일을 재사용한다.

`U2Preview`는 `/u1-test?screen=board`를 전달하며, 이동 전용 `entryRequested` 상태와 숨김 피드백은 제거한다. 링크를 사용하면 Next Router 컨텍스트가 없는 정적 렌더 테스트에서도 URL 계약을 직접 검사할 수 있고, 브라우저의 기본 키보드·새 탭 동작도 보존된다.

### 3.3 U1 프리뷰는 선택 가능한 초기 화면을 받는다

`U1Preview`에 다음 선택적 props를 추가한다.

```ts
interface U1PreviewProps {
  initialScreen?: U1PreviewScreen;
}
```

기본값은 `intro`다. `app/u1-test/page.tsx`는 Next.js App Router의 `searchParams`를 읽어 `screen=board`일 때만 `initialScreen="board"`를 전달한다. 화면 전환 버튼, `aria-pressed`, 기본 프리뷰 동작은 기존처럼 유지한다.

## 4. 컴포넌트·라우트 계약

### 4.1 `IntroScreen`

위치: `components/game/IntroScreen.tsx`

```ts
export interface IntroScreenProps {
  status: TopStatusView;
  boardHref: string;
}
```

책임:

- 역할·수단·목표와 상단 상태 바를 렌더링한다.
- CTA를 `boardHref`로 이동하는 링크로 렌더링한다.
- 캠페인 상태를 생성하거나 게시판 데이터를 소유하지 않는다.

### 4.2 `U2Preview`

위치: `components/game/U2Preview.tsx`

- U2 시작 상태 fixture를 계속 소유한다.
- `IntroScreen`에 `boardHref="/u1-test?screen=board"`를 전달한다.
- 게시판 진입 여부를 별도 React 상태로 추적하지 않는다.

### 4.3 `U1Preview`

위치: `components/game/U1Preview.tsx`

- `initialScreen`이 있으면 해당 화면을 초기 선택한다.
- `initialScreen`이 없으면 기존 기본값인 `intro`를 사용한다.
- 실제 캠페인 상태, URL 변경, 게시판 규칙은 소유하지 않는다.

### 4.4 `/u1-test`

위치: `app/u1-test/page.tsx`

- `searchParams.screen`을 서버 페이지에서 읽는다.
- 값이 `board`인 경우에만 게시판 초기 화면을 선택한다.
- 그 밖의 값은 인트로로 정규화한다.
- 검색 파라미터 외의 캠페인 데이터나 전이는 구현하지 않는다.

## 5. 데이터 흐름

```text
U2Preview
  └─ IntroScreen(boardHref="/u1-test?screen=board")
       └─ 사용자가 CTA 클릭
            └─ 브라우저가 /u1-test?screen=board 요청
                 └─ u1-test page가 screen=board를 정규화
                      └─ U1Preview(initialScreen="board")
                           └─ 게시판 좌측 프리뷰 + 계약 상세 우측 패널
```

이 흐름은 U2의 온보딩 전이와 U1 프리뷰의 화면 선택을 연결할 뿐이며, 아직 `I1` 상태 머신이나 `I2` 캠페인 전체 통합을 선행 구현으로 끌어오지 않는다.

## 6. 대안 검토

### 대안 A — `/u1-test?screen=board` query로 기존 프리뷰를 재사용한다 (채택)

- 장점: 게시판 프리뷰 중복이 없고 기존 `/u1-test` 진입을 보존한다.
- 장점: URL만으로 목적 화면을 재현할 수 있고 테스트가 단순하다.
- 장점: 실제 U3 구현 전까지 U2의 다음 화면을 즉시 확인할 수 있다.
- 단점: `/u1-test`가 실제 게시판 라우트가 아니라 프리뷰 하네스라는 사실은 유지된다.

### 대안 B — 별도 `/board-test` 라우트를 만든다

- 장점: 목적지 이름이 게시판 프리뷰임을 URL에 직접 드러낸다.
- 단점: 같은 U1 게시판 프리뷰를 새 페이지에서 다시 연결해야 하고 라우트가 늘어난다.
- 단점: 사용자가 이미 확인 중인 `/u1-test` 흐름과 분리되어 관리 지점이 두 개가 된다.

### 대안 C — `/u2-test` 안에서 클릭 후 게시판 컴포넌트를 교체한다

- 장점: 라우트 파일을 추가로 해석하지 않아도 된다.
- 단점: 사용자가 요청한 “사이트가 게시판으로 넘어가는” URL 탐색이 발생하지 않는다.
- 단점: U2가 다음 화면의 렌더링 책임까지 가지게 되어 U1 프리뷰 경계가 흐려진다.

대안 A가 현재 코드의 재사용 경계, U2의 완료 기준, 향후 U3 대체 가능성을 함께 만족한다.

## 7. 테스트와 검증

### 7.1 자동 테스트

- `IntroScreen.test.ts`: CTA가 게시판 목적지 링크를 렌더링하고 기존 역할·수단·목표 문구를 유지하는지 검사한다.
- `U2Preview.test.ts`: 시작 상태가 유지되고 `/u1-test?screen=board` 링크가 렌더링되는지 검사한다.
- `U1Preview.test.ts`: 기본 렌더는 인트로이고 `initialScreen="board"`를 전달하면 게시판 버튼이 `aria-pressed="true"`이며 게시판 콘텐츠가 보이는지 검사한다.
- 기존 U1/U2 정적 렌더 계약과 전체 테스트를 회귀 검사한다.

### 7.2 브라우저 검증

개발 서버에서 `/u2-test`를 열고 다음을 확인한다.

1. U2 인트로와 상단 시작 상태가 렌더링된다.
2. `길드 게시판으로` CTA가 링크로 포커스된다.
3. 클릭하면 주소가 `/u1-test?screen=board`로 바뀐다.
4. 도착 화면에서 `게시판` 화면 버튼이 선택 상태가 된다.
5. 좌측에 `길드 공고`, 우측에 `계약 상세`와 `출전 파티`가 보인다.
6. console/page error와 Next 오류 overlay가 없다.

### 7.3 명령

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 8. 범위 밖

- 실제 캠페인 시작·상태 머신·스토어 연결 (`I1`, `I2`)
- 실제 게시판 공고 생성·임시 파티 규칙 (`C2`와 `U3`의 통합)
- 계약 버튼 활성화와 지도 전이
- 저장·복원·로그인·서버 연동
- U2 인트로의 시각 자산·문구 재설계
- `main` 직접 화면을 인트로로 바꾸는 작업

## 9. 문서 동기화

구현과 같은 변경 단위에서 다음을 갱신한다.

- `docs/README.md`: 이번 개편 설계 색인에 이 U2 spec과 plan 링크를 추가한다.
- `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`: U2 담당자·상태를 완료로 갱신하고, 실제 연결 방식과 검증 결과를 완료 기록에 남긴다.

`GAME_PRINCIPLES.md`, `ONBOARDING_AND_INTERFACE.md`, `CORE_GAME_LOOP.md`, `campaign-sequence.md`는 이미 인트로 다음에 게시판으로 진입하는 규칙을 설명하므로 이번 구현 URL을 중복 기록하지 않는다. 게임 방향이나 규칙 수치가 바뀌지 않으므로 최상위 원칙과 시스템 설정집은 수정하지 않는다.

## 10. 완료 기준

- U2 CTA 클릭이 `/u1-test?screen=board`로 실제 이동한다.
- 해당 URL을 직접 열어도 U1 게시판 프리뷰가 초기 선택된다.
- 기존 `/u1-test` 기본 진입은 인트로 프리뷰를 유지한다.
- U2와 U1의 정적 렌더 테스트가 URL·선택 상태·콘텐츠 계약을 검증한다.
- lint, typecheck, 전체 test, build가 통과한다.
- 브라우저에서 U2 → 게시판 프리뷰 흐름과 오류 부재를 확인한다.
- 작업 배정표와 README 색인이 구현·spec·plan과 일치한다.
