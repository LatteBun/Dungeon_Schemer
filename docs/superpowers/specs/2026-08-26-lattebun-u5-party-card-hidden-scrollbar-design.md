# U5 파티 카드 기록 스크롤바 숨김 설계

## 문서 정보

- 작성자: LatteBun
- 작성 도구: ChatGPT (GPT-5.6 Pro) · Superpowers Brainstorming
- 작성일: 2026-08-26
- 작업 대상: 던전 진행 화면 우측 `파티 상태` 카드 뒷면의 원정 기록 스크롤 표시
- 최초 작성 기준: `main` (`bc07a750`, PR #190 병합 지점)
- 재검토 기준: `main` (`8d72bd0`, PR #200 병합 지점)
- 관련 공식 문서:
  - [화면 규격](../../experience/SCREEN_LAYOUT.md)
  - [UI 구현 가이드](../../experience/UI_IMPLEMENTATION_GUIDE.md)
- 관련 구현:
  - `components/game/U5ProgressScreen.tsx`
  - `components/game/PartyMemberCard.tsx`
  - `app/party-card.css`
  - `app/u5-progress.css`
  - `components/game/PartyMemberCard.test.tsx`
  - `components/game/U5ProgressScreen.test.tsx`
  - `components/game/U5FixedCanvas.test.ts`
  - `e2e/u5-console-situation-readability.spec.ts`

## 1. 작업 분류와 사용자 결정

이 작업은 이미 구현된 U5 던전 진행 화면에서 네이티브 스크롤바의 시각 표현만 조정하는 **범위가 제한된 UI 변경**이다. 새로운 화면 흐름, 상태, 데이터 계약, 게임 규칙을 추가하지 않는다.

사용자가 승인한 결정은 다음과 같다.

1. 카드 뒷면의 원정 기록이 카드 높이를 넘을 때 스크롤 기능은 유지한다.
2. 브라우저가 그리는 밝은 기본 스크롤바의 트랙과 손잡이는 화면에 보이지 않게 한다.
3. 기록을 자르거나 일부만 남기는 방식으로 스크롤을 제거하지 않는다.
4. 이번 작업에서는 카드 전체가 하나의 뒤집기 버튼인 기존 포커스 구조를 바꾸지 않는다.
5. 제품 코드에 테스트 전용 기록이나 경로를 추가하지 않고, 브라우저 검증은 기존 U5 카드 DOM에 극단적 넘침을 합성한다.

## 2. 저장소의 현재 상태

### `components/game/U5ProgressScreen.tsx`

- U5 우측 `파티 상태`는 공용 `PartyMemberCard` 세 장을 사용한다.
- 원정 변화 기록은 `changesByMemberId`에서 파티원별로 전달된다.
- 전투 피드백이 완료된 뒤 `changes`가 전달되면 카드가 뒤집힐 수 있다.
- 화면은 고정 캔버스 안에서 우측 패널과 카드 크기를 유지하며, 기록 길이에 따라 카드 자체를 늘리지 않는다.

### `components/game/PartyMemberCard.tsx`

- `changes`가 있으면 카드 전체를 실제 `button`으로 감싸고 클릭 시 앞면과 뒷면을 전환한다.
- 뒷면은 `.party-card__back`으로 렌더링되며 이름, 원정 총 변화, 원인별 변화 기록을 모두 표시한다.
- 기록은 `changes.map(...)`으로 전체 렌더링되므로 원정이 길어질수록 카드 높이를 넘을 수 있다.
- 키보드 포커스는 바깥 `.party-card__flip` 버튼이 받으며, 내부 `.party-card__back`은 독립 포커스 영역이 아니다.
- 따라서 현재 구조가 보장하는 입력은 버튼의 키보드 뒤집기와 카드 위의 포인터·터치 스크롤이다. 내부 기록을 별도 키보드 스크롤 영역으로 만드는 계약은 현재 없다.

### `app/party-card.css`

- `.party-card__back`은 `position: absolute`와 `inset: 0`으로 앞면과 같은 카드 영역을 덮는다.
- `overflow-y: auto`가 선언되어 있어 내용이 넘칠 때 네이티브 세로 스크롤이 생긴다.
- 이 파일은 U3, U4, U5가 함께 사용하는 공용 파티 카드의 소유자다.

### `app/u5-progress.css`

- U5 고정 캔버스, 진행 장면, 콘솔, 우측 패널 배치를 소유한다.
- 현재 U5 카드 뒷면의 스크롤바 표현을 덮어쓰는 규칙은 없다.
- 재검토 기준의 U5 진행 기록과 생태 영역은 별도의 스크롤 계약을 가진다. 두 영역은 독립 포커스를 받고, 스크롤바를 평소 투명하게 두되 hover와 `focus-visible`에서 얇게 드러낸다.
- 파티 카드 뒷면은 독립 포커스 영역이 아니고 사용자가 요청한 결과도 "항상 밝은 기본 스크롤바가 보이지 않음"이므로, 진행 기록의 hover·focus 노출 규칙을 그대로 공유하지 않는다.

### 현재 브라우저 검증 fixture

- `/u5-test`의 `U5Preview`와 `/u5-2-test`의 `U5BattlePreview`는 `changesByMemberId`를 전달하지 않는다.
- 따라서 두 프리뷰에는 실제로 뒤집을 수 있는 카드 뒷면이 없으며, 제품 React 코드 변경 없이 넘침을 검증하려면 Playwright가 기존 U5 카드 안에 테스트 수명 동안만 뒷면 DOM을 합성해야 한다.
- 저장소에는 긴 상황 문구와 긴 진행 기록을 브라우저에서 DOM으로 대입해 containment를 확인하는 기존 E2E 패턴이 있다. 같은 패턴을 파티 카드의 극단적 기록 fixture에 재사용할 수 있다.

따라서 밝은 회색 스크롤바는 별도 컴포넌트나 자산이 아니라, 공용 카드의 `overflow-y: auto`에 브라우저 기본 UI가 표시된 결과다.

## 3. 문제 정의

원정 기록이 카드 높이를 넘으면 스크롤 자체는 필요하지만, 운영체제와 브라우저가 그리는 기본 스크롤바는 현재 다크 판타지 카드 표면과 어울리지 않는다. 특히 밝은 트랙과 손잡이가 카드 우측 테두리 안에 별도의 현대식 컨트롤처럼 나타나 카드의 금속·양피지 계열 시각 언어를 끊는다.

반대로 `overflow: hidden`이나 `overflow-y: clip`으로 넘친 내용을 막으면 이전 조언과 변화 원인을 읽을 수 없게 된다. 이는 선택 후 변화와 원인을 확인할 수 있어야 한다는 게임 원칙에 어긋난다.

이번 변경은 다음 세 조건을 동시에 만족해야 한다.

- 스크롤바의 시각 요소는 보이지 않는다.
- 모든 원정 기록은 기존처럼 끝까지 스크롤해 읽을 수 있다.
- 진행 기록 탭의 포커스형 스크롤 계약이나 공용 파티 카드 구조를 이번 변경으로 확장하지 않는다.

## 4. 목표

1. U5 진행 화면에서 뒤집힌 파티 카드의 네이티브 세로 스크롤바를 보이지 않게 한다.
2. 마우스 휠, 트랙패드, 터치 스크롤 등 브라우저의 네이티브 스크롤 동작은 유지한다.
3. 카드 높이, 폭, 내부 padding, 기록 순서와 데이터는 바꾸지 않는다.
4. 공용 `PartyMemberCard`를 사용하는 다른 화면에 불필요한 시각 변경을 전파하지 않는다.
5. JavaScript 스크롤 상태나 별도 커스텀 스크롤 컴포넌트를 추가하지 않는다.
6. 최신 U5 진행 기록의 독립 포커스형 스크롤과 파티 카드의 포인터·터치형 내부 스크롤을 서로 다른 입력 계약으로 명시한다.

## 5. 범위 밖

이번 작업에서는 다음을 하지 않는다.

- `overflow: hidden`, `clip`, 말줄임표 또는 최근 N건 제한으로 기록을 자르기
- 카드 높이를 기록 길이에 따라 늘리기
- 카드 클릭 시 별도 모달이나 전체 패널 상세 화면 열기
- 금속 재질의 커스텀 스크롤바 만들기
- 하단 그라데이션, `더 보기`, `아래에 기록 있음` 같은 새 스크롤 안내 추가
- 기록별 접기·펼치기 또는 필터 추가
- U3·U4 파티 카드의 표현 변경
- 원정 기록 생성, 정렬, 누적 방식 변경
- 카드 뒤집기 DOM, 버튼 역할, ARIA 문구 또는 포커스 구조 재설계
- 카드 뒷면을 독립 키보드 스크롤 영역으로 만드는 작업
- hover 또는 키보드 focus에서 파티 카드 스크롤바를 다시 표시하는 작업
- U5 진행 기록과 생태 영역의 기존 스크롤바·포커스 표현 변경

추가 스크롤 안내가 필요하다는 사용성 근거가 생기면 별도 UI 작업으로 검토한다.

## 6. 검토한 접근

### 접근 A. 넘친 내용을 숨긴다

`.party-card__back`에 `overflow-y: hidden` 또는 `clip`을 적용한다.

- 장점: 스크롤바가 즉시 사라진다.
- 단점: 카드 아래쪽 기록이 영구적으로 잘린다.
- 단점: 사용자가 승인한 스크롤 유지 조건을 위반한다.

**기각한다.**

### 접근 B. 공용 카드 CSS에서 모든 스크롤바를 숨긴다

`app/party-card.css`의 `.party-card__back`에 브라우저별 스크롤바 숨김 규칙을 직접 추가한다.

- 장점: 선언 위치가 스크롤 소유 규칙과 가깝다.
- 단점: U3·U4를 포함한 공용 카드의 미래 사용처까지 같은 표현으로 고정한다.
- 단점: 이번 요청은 U5 진행 화면에서 확인된 문제인데 공유 범위를 필요 이상으로 넓힌다.

**기각한다.**

### 접근 C. U5 화면에서만 스크롤바의 시각 요소를 숨긴다 - 채택

`app/u5-progress.css`에 `.u5-progress-screen .party-card__back` 범위의 브라우저별 규칙을 둔다. 공용 카드가 가진 `overflow-y: auto`는 그대로 사용한다.

- 장점: 스크롤 기능과 전체 기록을 보존한다.
- 장점: U5에서만 네이티브 스크롤바가 보이지 않는다.
- 장점: DOM, 상태와 데이터 흐름을 건드리지 않는다.
- 장점: 변경과 회귀 검증 범위가 작고 명확하다.

**접근 C를 사용한다.**

### 접근 D. U5 진행 기록의 hover·focus 스크롤바 패턴을 재사용한다

카드 뒷면도 기본 상태에서는 투명하게 두고 hover 또는 `focus-visible`에서 얇은 스크롤바를 표시한다.

- 장점: 같은 화면의 진행 기록과 유사한 시각 언어를 사용한다.
- 장점: 독립 포커스 영역까지 함께 설계하면 키보드 스크롤과 시각 단서를 제공할 수 있다.
- 단점: 현재 카드의 포커스 대상은 전체 뒤집기 버튼이라 내부 뒷면에는 `focus-visible`이 들어오지 않는다.
- 단점: 제대로 적용하려면 DOM, 포커스와 버튼 상호작용을 함께 재설계해야 한다.
- 단점: 카드에서 기본 스크롤 트랙과 손잡이를 보이지 않게 해 달라는 이번 사용자 결정과 범위를 넘는다.

**이번 작업에서는 기각한다.** 카드 내부 키보드 스크롤의 필요성이 확인되면 버튼과 스크롤 영역의 의미 구조를 함께 다루는 별도 접근성 Spec으로 검토한다.

## 7. 승인된 설계

### 7.1 CSS 소유권과 격리 경계

스크롤 기능의 공용 계약은 계속 `app/party-card.css`가 소유한다.

```text
app/party-card.css
└─ .party-card__back
   └─ overflow-y: auto          기록 스크롤 기능

app/u5-progress.css
└─ .u5-progress-screen .party-card__back
   └─ scrollbar visual hidden  U5 전용 표현
```

- `app/party-card.css`의 `overflow-y: auto`를 제거하거나 다른 값으로 바꾸지 않는다.
- U5 전용 규칙은 `.u5-progress-screen` 아래로 범위를 제한한다.
- `components/game/U5ProgressScreen.tsx`와 `components/game/PartyMemberCard.tsx`의 마크업은 변경하지 않는다.
- 새 공용 컴포넌트, 새 CSS 파일과 새 이미지 자산을 만들지 않는다.

### 7.2 브라우저별 표현 계약

U5 카드 뒷면은 다음 두 계열의 규칙을 함께 사용한다.

- Firefox 계열: `.u5-progress-screen .party-card__back`에 `scrollbar-width: none`
- Chromium·WebKit 계열: `.u5-progress-screen .party-card__back::-webkit-scrollbar`에 `display: none`

구현은 트랙과 손잡이만 비시각화해야 한다. 다음 속성은 사용하지 않는다.

- `overflow: hidden`
- `overflow-y: hidden`
- `overflow: clip`
- `overflow-y: clip`
- 내용 높이를 제한하는 새 `max-height`

가로 스크롤을 새로 만들거나 기록 본문 폭을 줄이지 않는다. 기존 줄바꿈과 padding을 그대로 사용한다.

### 7.3 스크롤 동작 계약

- 기록이 카드 높이를 넘지 않으면 기존과 동일하게 정적인 뒷면으로 보인다.
- 기록이 카드 높이를 넘으면 `.party-card__back.scrollHeight > .party-card__back.clientHeight`가 된다.
- 사용자가 카드 위에서 마우스 휠이나 트랙패드를 사용하면 `scrollTop`이 증가해야 한다.
- 터치 입력을 제공하는 브라우저에서는 기존 네이티브 터치 스크롤을 막지 않는다.
- 마지막 기록까지 도달할 수 있어야 한다.
- 카드 뒷면에 새 `tabIndex`, `onKeyDown`, wheel 또는 touch 이벤트 핸들러를 추가하지 않는다.
- 바깥 뒤집기 버튼의 Space·Enter 동작은 계속 카드 앞뒤 전환에만 사용한다.
- 카드 뒤집기 상태, 초기 스크롤 위치와 다시 덮었을 때의 기존 브라우저 동작을 JavaScript로 재설정하지 않는다.
- 스크롤 이벤트를 React 상태나 캠페인 Store에 저장하지 않는다.

### 7.4 시각 계약

기록이 넘치는 상태에서도 다음이 유지되어야 한다.

- 카드 우측에 밝은 기본 스크롤 트랙이나 손잡이가 보이지 않는다.
- 스크롤바 자리 때문에 카드 본문의 오른쪽 여백이 비정상적으로 넓어지지 않는다.
- 카드 테두리, 배경, 이름, 총 변화, 원인별 기록의 위치와 크기는 변경 전과 같다.
- 세 파티 카드의 외곽 높이와 정렬은 그대로다.
- 우측 패널과 1920×1080 고정 캔버스 전체에 가로·세로 페이지 스크롤이 생기지 않는다.

이번 작업은 스크롤 가능 여부를 알리는 새 문구나 장식을 추가하지 않는다.

### 7.5 접근성과 의미 구조

- 스크롤바 숨김은 시각 CSS에만 적용한다.
- 기록 항목은 DOM에서 제거하거나 `aria-hidden` 처리하지 않는다.
- 카드 뒤집기 버튼의 `aria-pressed`, `aria-label`, `focus-visible` 계약은 유지한다.
- 새 포커스 가능한 내부 영역이나 키보드 이벤트 핸들러를 추가하지 않는다.
- 이번 설계가 보장하는 키보드 계약은 바깥 버튼을 포커스하고 Space·Enter로 카드를 뒤집는 기존 동작까지다.
- `.party-card__back`은 독립 포커스 영역이 아니므로 방향키, Page Up·Page Down, Home·End로 내부 기록을 끝까지 스크롤할 수 있다고 완료 조건에 포함하지 않는다.
- 이 한계는 스크롤바 숨김 CSS가 새로 만든 회귀가 아니라 기존 의미 구조의 범위다. 키보드만으로 시각적 기록을 탐색해야 한다는 요구가 생기면 숨김 규칙만 되돌리는 것이 아니라, 중첩 interactive 구조를 만들지 않는 별도 DOM·포커스 설계를 먼저 승인받는다.
- 스크린 리더는 뒷면 기록이 DOM에 전체 존재하므로 기존 순서대로 내용을 읽을 수 있어야 한다.

## 8. 데이터와 상태 흐름

데이터와 상태 흐름은 변경하지 않는다.

```text
ActiveExpeditionContext.records
→ memberChangesFor(...)
→ changesByMemberId
→ U5ProgressScreen
→ PartyMemberCard changes
→ 카드 뒷면 전체 기록
```

스크롤바 숨김은 위 흐름의 어떤 값도 추가, 제거, 정렬 또는 변환하지 않는다. 규칙 계층, 캠페인 Store, 전투 피드백 단계와 무관한 표현 변경이다.

## 9. 예상 구현 범위

### 변경 예상

- `app/u5-progress.css`
  - U5 카드 뒷면의 브라우저별 스크롤바 비시각화 규칙
- `components/game/U5ProgressScreen.test.tsx`
  - U5 범위 제한과 스크롤 유지 속성의 회귀 고정
- `e2e/u5-party-card-scroll.spec.ts`
  - 기존 U5 카드 DOM에 테스트 수명 동안만 넘치는 뒷면 fixture를 합성하고 실제 wheel·끝 도달·containment를 검증

### 변경하지 않음

- `components/game/U5ProgressScreen.tsx`
- `components/game/PartyMemberCard.tsx`
- `app/party-card.css`의 공용 카드 스크롤 계약
- `components/game/U5Preview.tsx`와 `components/game/u5-preview-data.ts`
- `components/game/U5BattlePreview.tsx`와 전투 프리뷰 데이터
- 원정 기록 adapter와 domain/rules 코드
- 공식 게임·시스템·화면 문서
- 이미지 에셋

공식 문서의 화면 구조나 게임 규칙이 바뀌지 않으므로 이번 Spec 단계에서는 기존 공식 문서를 수정하지 않는다.

## 10. 검증 설계

### 10.1 정적 CSS 계약

기존 CSS 계약 테스트에 다음을 고정한다.

1. 공용 `.party-card__back`에는 계속 `overflow-y: auto`가 존재한다.
2. U5 범위의 카드 뒷면에는 `scrollbar-width: none`이 존재한다.
3. U5 범위의 `::-webkit-scrollbar` 규칙에는 `display: none`이 존재한다.
4. U5 전용 규칙에 `overflow: hidden`, `overflow-y: hidden`, `clip`이 들어가지 않는다.
5. 공용 `.party-card__back` 전체를 대상으로 스크롤바를 숨기는 전역 규칙을 추가하지 않는다.

정적 CSS 계약은 `components/game/U5ProgressScreen.test.tsx`가 소유한다. 이 파일은 이미 `app/u5-progress.css`를 읽어 U5 진행 기록의 Firefox·WebKit scrollbar 계약과 U5 내부 overflow를 검증한다. 여기서 `app/party-card.css`도 함께 읽어 공용 `overflow-y: auto`가 유지되는지 확인한다. `PartyMemberCard.test.tsx`는 공용 카드 DOM·버튼·ARIA·전체 기록 렌더링 책임을 유지하고, `U5FixedCanvas.test.ts`는 고정 캔버스와 우측 패널 배치 책임만 유지한다. 같은 CSS 파싱 검사를 여러 파일에 중복하지 않는다.

### 10.2 브라우저 동작 검증

1920×1080 고정 캔버스의 `/u5-test`에서 기존 카드 한 장을 사용한다. 현재 프리뷰는 `changesByMemberId`를 전달하지 않으므로 제품 컴포넌트와 프리뷰 데이터를 바꾸지 않고, Playwright `evaluate`가 테스트 수명 동안 해당 `.party-card` 안에 실제 뒷면과 같은 클래스·목록 구조를 합성한다. fixture에는 마지막 항목을 식별할 수 있는 충분한 수의 결정적 기록을 넣고 `.is-flipped`를 적용한다.

이 fixture의 책임은 실제 U5 카드 크기, CSS cascade, overflow와 브라우저 입력 동작을 검증하는 것이다. `changesByMemberId → PartyMemberCard` 렌더링과 클릭 뒤집기는 기존 컴포넌트·캠페인 렌더 테스트가 이미 소유하므로, 합성 fixture가 데이터 adapter나 React 상태 흐름을 검증한다고 주장하지 않는다.

1. 기존 U5 카드에 충분한 기록을 가진 뒷면 fixture를 합성하고 뒤집힌 표시를 적용한다.
2. 카드 뒷면의 `scrollHeight`가 `clientHeight`보다 큰지 확인한다.
3. 카드 위에서 세로 wheel 입력을 보낸다.
4. `scrollTop`이 0보다 커지는지 확인한다.
5. 마지막 기록까지 스크롤해 해당 문구가 카드 안에서 읽히는지 확인한다.
6. computed style에서 `scrollbar-width: none`과 WebKit scrollbar `display: none` 계약이 적용됐는지 확인한다.
7. 카드 우측에 네이티브 스크롤 트랙과 손잡이가 보이지 않는지 Chromium 화면으로 확인한다.
8. 카드 외곽 높이, 세 카드 정렬과 우측 패널 containment가 유지되는지 확인한다.
9. document와 고정 캔버스에 새 페이지 스크롤이 생기지 않았는지 확인한다.

fixture는 테스트 종료와 페이지 종료 때 함께 사라지며 소스, Store, storage와 네트워크 상태를 바꾸지 않는다. 브라우저 자동화가 네이티브 스크롤바 픽셀을 안정적으로 판정하지 못하면, 동작과 computed style은 Playwright로 고정하고 시각 부재는 Chromium 화면 확인으로 보완한다.

카드 클릭 전환과 다른 카드 전환은 이번 E2E fixture에서 다시 검사하지 않는다. 해당 동작의 React 구현을 변경하지 않으며 `PartyMemberCard.test.tsx`의 기존 버튼·ARIA·전체 기록 렌더링 계약이 회귀를 맡는다.

### 10.3 구현 단계 전체 검증

구현 PR에서는 프로젝트 공통 검증을 실행한다.

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `git diff --check`

## 11. 완료 조건

다음 조건을 모두 만족하면 구현이 완료된 것으로 본다.

1. U5 진행 화면에서 기록이 넘치는 뒤집힌 파티 카드에 기본 스크롤바가 보이지 않는다.
2. 마우스 휠과 트랙패드로 카드 기록을 기존처럼 스크롤할 수 있다.
3. 마지막 원정 기록까지 읽을 수 있다.
4. `overflow-y: auto`와 전체 기록 렌더링이 유지된다.
5. 카드 크기, 세 카드 정렬, 우측 패널과 고정 캔버스 배치가 바뀌지 않는다.
6. U3·U4 공용 카드에는 이번 U5 전용 표현 변경이 전파되지 않는다.
7. DOM, ARIA, 캠페인 상태와 게임 규칙이 변경되지 않는다.
8. 정적 CSS 계약과 브라우저 스크롤 검증이 통과한다.
9. 프로젝트 공통 lint, typecheck, test, build가 통과한다.
10. 바깥 카드 버튼의 키보드 뒤집기 계약은 유지되며, 내부 기록의 독립 키보드 스크롤은 이번 완료 조건으로 오인하지 않는다.

## 12. 후속 단계

이 문서가 승인되면 다음 단계에서 Superpowers Plan을 작성한다. Plan과 승인된 Spec이 모두 준비되기 전에는 CSS나 테스트 구현을 시작하지 않는다.
