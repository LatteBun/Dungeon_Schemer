# 상단 상태 바 신뢰 0 인원 표시 설계

## 문서 정보

- 작성자: LatteBun
- 작성 도구: ChatGPT + Superpowers Brainstorming
- 작성일: 2026-08-26
- 대상 작업: 누적 고발 엔딩에 사용되는 생존 신뢰 0 인원을 공통 상단 상태 바에 표시
- 기준 브랜치: `spec/top-status-zero-trust-count`
- 기준 커밋: `bc07a75`
- 최신 `main` 구조 재검토 커밋: `6b019ad`

## 1. 문제와 목표

현재 공통 상단 상태 바는 길잡이 등급, 현재 명성, 골드, 승급 상태, 남은 던전과
원정 중 현재 던전만 보여 준다. 그러나 캠페인 규칙은 살아 있고 신뢰가 0인
캐릭터 수를 계속 사용한다.

이 수치는 다음 두 역할을 가진다.

- 2명부터 남은 인물들의 조언 수용과 거짓 적발 판정에 캠페인 보정이 적용된다.
- 5명에 도달하면 정상 엔딩 판정에서 `누적 고발`이 가장 먼저 성립한다.

플레이어는 파티 카드에서 개별 신뢰를 볼 수 있지만, 캠페인 전체 캐릭터 풀에서
현재 몇 명이 신뢰 0인지 알 수 없다. 그 결과 실제 판정에 들어가는 캠페인 상태와
플레이어가 화면에서 읽을 수 있는 근거 사이에 빈칸이 생긴다.

이번 설계의 목표는 다음과 같다.

- 모든 캠페인 화면의 공통 상단 상태 바에 생존 신뢰 0 인원을 표시한다.
- 현재 인원과 누적 고발 기준 5명을 한눈에 비교할 수 있게 한다.
- 기존 C6 규칙 계산을 재사용하고 UI에서 조건을 다시 구현하지 않는다.
- 새 저장 필드 없이 현재 `CampaignState`에서 값을 계산한다.
- 고정 1920×1080 캔버스와 공통 상태 바의 단일 정의 원칙을 유지한다.

## 2. 근거와 범위

근거 문서와 구현은 다음과 같다.

- `docs/GAME_PRINCIPLES.md`
  - 감추는 것은 결론이지 근거가 아니어야 한다.
  - 캠페인 판정에 실제로 들어가는 신뢰 0 인원은 플레이어가 확인할 수 있어야 한다.
- `docs/systems/CHARACTERS_AND_TRUST.md`
  - 현재 살아 있고 `trust === 0`인 캐릭터만 센다.
  - 사망자는 제외되므로 숫자는 감소할 수 있다.
  - 2명, 3명, 4명에서 캠페인 보정이 달라지고 5명에서 누적 고발 엔딩이 성립한다.
- `docs/systems/PROGRESSION_AND_ENDINGS.md`
  - 누적 고발은 정산과 월드턴 뒤 정상 엔딩 판정의 최우선 조건이다.
- `docs/experience/SCREEN_LAYOUT.md`
  - 상단 상태 바는 모든 캠페인 화면이 공유한다.
  - 공통 요소는 `TopStatusBar`와 `app/globals.css` 한 곳에서만 정의한다.
  - 화면별 상태 바 CSS 재정의와 가로 스크롤은 허용하지 않는다.
- `components/game/TopStatusBar.tsx`
  - `TopStatusView`와 공통 상태 칩 렌더링을 소유한다.
- `components/game/campaign-adapters.ts`
  - `CampaignState`를 `TopStatusView`로 변환하는 단일 경계인 `statusFor()`를 소유한다.
- `components/game/AppFrame.tsx`, `app/app-frame.css`
  - 최신 `main`은 모든 route 위에 전역 퀵 메뉴를 합성한다.
  - 우측 상단 트리거와 열린 패널이 최대 7개 상태 칩을 가리지 않아야 한다.
- `lib/rules/ending.ts`
  - `countLivingZeroTrust(campaign)`가 생존 신뢰 0 인원을 계산한다.
- `lib/domain/campaign.ts`
  - `DENOUNCE_THRESHOLD`가 누적 고발 기준값 5를 소유한다.

이번 변경은 정보 노출과 화면 어댑터 계약만 다룬다. 신뢰, 엔딩, 월드턴,
정산의 규칙과 전이 시점은 변경하지 않는다.

## 3. 검토한 접근

### 3.1 캠페인 상태에 별도 누적 카운터 저장

`CampaignState`에 `zeroTrustCount` 같은 필드를 추가하고 신뢰 변화와 사망 때마다
증감시키는 방식이다.

채택하지 않는다.

- `trust === 0`과 `alive`가 이미 유일한 원본 상태다.
- 사망한 신뢰 0 캐릭터는 집계에서 빠져야 하므로 단조 증가하는 누적값이 아니다.
- 캐릭터 상태와 별도 카운터가 어긋날 동기화 실패 지점을 만든다.
- C6 설계가 별도 이력 필드를 두지 않기로 한 결정과 충돌한다.

### 3.2 `TopStatusBar`에서 캐릭터 풀 직접 계산

상태 바에 `CampaignState`를 넘기고 컴포넌트가 생존 여부와 신뢰를 순회하는
방식이다.

채택하지 않는다.

- 화면이 규칙 조건을 소유하게 된다.
- `TopStatusBar`가 현재의 작은 View 계약을 벗어나 캠페인 도메인 전체에 결합된다.
- C6의 `TRUST_MIN`, 생존 조건, 기준값이 UI에 복제된다.

### 3.3 C6 선택자에서 계산하고 상태 어댑터를 통해 전달

`statusFor()`가 C6의 `countLivingZeroTrust(campaign)`와 도메인의
`DENOUNCE_THRESHOLD`를 사용해 표시용 View를 만든다. `TopStatusBar`는 받은 숫자를
그대로 렌더링한다.

이 방식을 채택한다.

- 규칙의 단일 원본을 유지한다.
- 기존 `CampaignState → statusFor() → TopStatusView → TopStatusBar` 흐름을 확장한다.
- 저장 상태와 전이 계약을 건드리지 않는다.
- 프리뷰와 테스트도 같은 View 계약을 사용한다.

## 4. 표시 용어와 정보 계약

### 4.1 표시 문구

상태 칩의 고정 문구는 다음과 같다.

```text
신뢰 0    2 / 5
```

- 레이블: `신뢰 0`
- 값: `{현재 생존 신뢰 0 인원} / {누적 고발 기준 인원}`
- 숫자는 기존 상태 값과 같은 tabular number 서식을 사용한다.

`누적 고발 2 / 5`는 사용하지 않는다. 현재 집계는 역사적으로 한 번이라도 신뢰
0이 된 총인원이 아니라, 현재 살아 있으면서 신뢰 0인 인원이다. 신뢰 0 캐릭터가
사망하면 3에서 2로 줄 수 있으므로 `누적`이라는 레이블은 실제 규칙과 어긋난다.

`불신 인원`도 사용하지 않는다. 규칙의 정확한 조건은 추상적인 불신 상태가 아니라
`trust === 0`이며, 파티 카드에서 이미 사용하는 `신뢰` 용어와 직접 연결하는 편이
플레이어가 원인을 추적하기 쉽다.

### 4.2 항상 표시

신뢰 0 인원이 0명이어도 칩을 숨기지 않고 `0 / 5`로 표시한다.

- 캠페인 시작부터 종료 조건의 존재를 알 수 있다.
- 숫자가 처음 생길 때 상태 바의 칩 수와 간격이 바뀌지 않는다.
- 모든 `GameShell` 화면에서 같은 정보 구조를 유지한다.

### 4.3 배치 순서

기본 상태 칩 순서는 다음과 같다.

```text
길잡이 등급 → 현재 명성 → 골드 → 승급 → 신뢰 0 → 남은 던전
```

원정 중에는 기존처럼 마지막에 현재 던전을 덧붙인다.

```text
길잡이 등급 → 현재 명성 → 골드 → 승급 → 신뢰 0 → 남은 던전 → 현재 던전
```

`신뢰 0`은 읽기 전용 상태다. 버튼, 상세 모달, 툴팁 진입점으로 만들지 않는다.
승급 칩만 현재와 동일하게 상태 바의 유일한 조작 칩으로 남는다.

### 4.4 시각 강조

이번 범위에서는 신뢰 0 인원에 따른 조건부 색상, 점멸, 애니메이션을 추가하지
않는다. 새 칩은 다른 읽기 전용 상태 칩과 같은 테두리, 배경, 글자 서식을 쓴다.

2명, 3명, 4명의 보정 단계까지 색으로 구분하는 일은 별도의 위험 피드백 설계로
분리한다. 이번 작업은 먼저 누락된 숫자와 기준을 정확하게 제공하는 데 집중한다.

## 5. View와 데이터 흐름

### 5.1 `TopStatusView` 확장

관련 값을 하나의 표시 단위로 묶은 필수 필드를 추가한다.

```ts
export interface TopStatusView {
  rank: string;
  reputation: number;
  gold: number;
  canPromote: boolean;
  remainingDungeons: number;
  zeroTrust: {
    livingCount: number;
    threshold: number;
  };
  // 기존 nextPromotion, currentDungeon 유지
}
```

필드를 선택 사항으로 만들지 않는다. 모든 캠페인 화면에서 항상 보여야 하고,
프리뷰가 값을 빠뜨렸을 때 조용히 칩이 사라지는 것보다 타입 오류로 드러나는 편이
안전하다.

`livingCount`라는 이름은 사망자 제외 규칙을 View 계약에도 남긴다.
`threshold`는 현재 5지만 화면에서 숫자를 하드코딩하지 않는다.

### 5.2 `statusFor()` 책임

`statusFor(campaign, active)`는 다음 값을 추가한다.

```ts
zeroTrust: {
  livingCount: countLivingZeroTrust(campaign),
  threshold: DENOUNCE_THRESHOLD,
}
```

- 집계 조건을 어댑터 안에서 다시 작성하지 않는다.
- `TRUST_MIN`을 어댑터나 화면에서 직접 비교하지 않는다.
- `TopStatusBar`는 `CampaignState`, 캐릭터 풀, C6 규칙을 import하지 않는다.
- `DENOUNCE_THRESHOLD`도 화면 컴포넌트에서 import하지 않는다.

`campaign-adapters.ts`의 기존 주석은 selector 호출까지 규칙 재계산으로 읽힐 수
있다. `statusFor()`는 이미 승급 selector를 호출하고 있으므로, 구현에서는 이
경계를 "규칙을 화면에서 다시 구현하지 않고 규칙 selector 결과를 View로 옮긴다"로
정확히 설명한다. 새 집계 조건을 어댑터에 작성하는 것은 계속 금지한다.

상단바의 숫자는 캠페인 풀에 반영된 확정 상태를 표시한다. 활성 원정의 임시
파티 상태를 별도로 합성해 두 번째 계산 경로를 만들지 않는다. 신뢰 변화와 사망을
캠페인 풀에 반영하는 기존 전이 및 정산 시점은 이번 작업에서 변경하지 않는다.

즉시 `불신의 대가` 엔딩은 현재 원정 생존자 전원이 신뢰 0인지 보는 별도 조건이다.
이 칩은 그 즉시 엔딩 조건을 게이지로 표현하지 않고, 누적 고발 경로에 사용되는
캠페인 전체 생존 신뢰 0 인원만 표시한다.

### 5.3 U6 정산과의 경계

U6 정산의 `trustPressure`는 한 원정 전후의 변화와 이후 보정을 설명하는 화면 전용
View다. 공통 상단바는 U6 모델을 재사용하거나 의존하지 않는다.

두 화면은 같은 C6 선택자와 같은 도메인 기준값을 사용하되 목적을 나눈다.

- 상단바: 현재 캠페인 상태를 지속적으로 표시
- U6 정산: 방금 원정이 그 상태를 어떻게 바꿨는지 설명

## 6. 렌더링, 자산, 레이아웃

### 6.1 상태 칩

`TopStatusBar`의 기존 `StatusItem`을 그대로 사용한다.

```tsx
<StatusItem
  label="신뢰 0"
  value={`${status.zeroTrust.livingCount} / ${status.zeroTrust.threshold}`}
  iconSrc="/assets/u2/status-trust.svg"
/>
```

별도 컴포넌트나 화면별 분기를 만들지 않는다.

### 6.2 아이콘 자산

상단 상태 바 전용 자산 `public/assets/u2/status-trust.svg`를 추가한다.

- 기존 U2 상태 아이콘의 단색 금빛 계열과 선 굵기에 맞춘다.
- 신뢰 또는 관계의 붕괴를 읽을 수 있는 간결한 문양을 사용한다.
- 투명 여백을 남기지 않는다.
- CSS에서 개별 크기를 지정하지 않고 공통 `--status-icon-size`를 따른다.
- U6 결과 화면의 큰 통계 PNG를 직접 재사용하지 않는다. 화면 역할과 시각 밀도가
  다르고, 공통 상태 바 자산 경로를 U6 결과 자산 묶음에 결합하지 않기 위함이다.

### 6.3 고정 캔버스 검증

기본 화면은 6개, 원정 중에는 최대 7개의 상태 칩을 한 줄에 표시한다.
`flex-wrap: nowrap`과 가로 스크롤 금지 계약을 유지한다.

구현 전에 현재 공통 토큰으로 최대 7개 칩이 1920×1080 기준 캔버스 안에 들어가는지
확인한다. 넘침이 발견되면 특정 화면 CSS에 덧쓰지 않고 `app/globals.css`의 공통
`--status-*` 토큰만 조정한다. 다만 이번 기능을 위해 글자 크기를 임의로 줄이거나
레이블을 축약하지 않는다.

확인 대상은 다음과 같다.

- 인트로와 게시판: 기본 6개 칩
- 지도와 진행 화면: 현재 던전을 포함한 최대 7개 칩
- 16:9보다 넓거나 좁은 창: 레터박스 안의 고정 캔버스에서 동일한 한 줄 유지
- 작은 창: 캔버스 전체 축소 뒤에도 텍스트 잘림과 상태 바 내부 스크롤 없음
- 최신 `main`의 전역 퀵 메뉴가 닫힌 상태와 열린 상태: 트리거·패널이 상태 칩과
  겹치거나 칩의 조작을 가리지 않음

기존 `e2e/canvas-layout.spec.ts`는 문서 전체 스크롤과 캔버스 경계만 확인하며,
상태 바 내부의 넘침이나 같은 행 배치를 직접 증명하지 않는다. 구현에서는 현재
던전을 포함한 7개 칩 fixture로 다음 브라우저 계약을 추가한다.

- `.game-shell__status-list`의 `scrollWidth <= clientWidth`
- 모든 상태 칩의 상단 좌표가 허용 오차 안에서 동일
- 가장 긴 실제 던전 이름과 `신뢰 0 7 / 5`에서도 값 잘림과 칩 간 겹침 없음
- 전역 퀵 메뉴 트리거 및 열린 패널과 상태 칩의 bounding box가 겹치지 않음

## 7. 경계 사례

### 7.1 시작 상태

생존 신뢰 0 인원이 없으면 `0 / 5`를 표시한다. 빈 값, 대시, 칩 숨김을 사용하지
않는다.

### 7.2 사망한 신뢰 0 캐릭터

사망자는 집계하지 않는다. 살아 있는 신뢰 0 캐릭터가 사망하면 숫자가 감소할 수
있다. 화면은 별도 누적 이력을 보존하지 않고 C6 선택자의 결과를 그대로 따른다.

### 7.3 기준 도달

`livingCount >= threshold`가 되면 정상 캠페인 경로에서 누적 고발 엔딩이 성립한다.
판정은 정산과 월드턴 뒤에 실행되므로, 한 원정에서 여러 명이 동시에 신뢰 0이 되면
정산 화면의 상단 상태 바는 잠시 `6 / 5` 또는 `7 / 5`를 표시할 수 있다.

화면은 `livingCount`를 5로 제한하지 않고 selector 결과를 그대로 표시한다. 이는
현재 실제 인원을 보여 준다는 정보 계약과 `n은 countLivingZeroTrust(campaign)의
결과와 같다`는 완료 조건을 지킨다. 종료 전이가 완료되면 상단 상태 바가 없는
캠페인 엔딩 화면으로 넘어간다.

화면은 `>= 5`를 다시 판정하거나 엔딩을 발생시키지 않는다.

### 7.4 최고 등급과 현재 던전

S급의 `승급: 최고`, 현재 던전의 이름과 위험도, 신뢰 0 칩은 서로 독립적이다.
신뢰 0 칩 추가로 기존 승급 버튼 조건이나 현재 던전 표시 조건을 바꾸지 않는다.

### 7.5 프리뷰와 테스트 경로

프리뷰와 테스트 경로는 데이터 원본에 따라 나눈다.

- U1·U2 정적 프리뷰와 순수 화면 테스트 fixture는 실제 캠페인 규칙을 실행하지
  않으므로 `livingCount`를 명시한다. `threshold`는 이 경로에서도 숫자 5를
  하드코딩하지 않고 `DENOUNCE_THRESHOLD`를 사용한다. 기본 표시는 `0 / 5`를
  사용하고, 상단바 상태 확인용 fixture 한 곳은 `2 / 5` 이상을 사용한다.
- U3~U6의 캠페인 기반 프리뷰는 실제 초기화·전이·정산·엔딩 규칙으로 캠페인을
  만든다. 이 경로는 `livingCount`나 기준값을 리터럴로 복제하지 않고
  `statusFor()` 또는 C6 selector와 도메인 상수에서 값을 만든다.

필수 필드 추가를 이유로 모든 프리뷰에 `livingCount: 0`, `threshold: 5`를 일괄
하드코딩하지 않는다. 실제 캠페인과 프리뷰 상태 바가 다시 어긋나는 중복 구현을
막기 위함이다.

## 8. 테스트와 검증

TDD 순서는 다음과 같다.

1. `campaign-adapters.test.ts`에 실패하는 어댑터 테스트를 추가한다.
   - 초기 캠페인은 `livingCount: 0`, `threshold: DENOUNCE_THRESHOLD`를 반환한다.
   - 살아 있는 신뢰 0 캐릭터만 센다.
   - 사망한 신뢰 0 캐릭터는 제외한다.
   - 기준 초과 상태에서도 selector 결과를 제한하지 않는다.
2. `TopStatusBar.test.ts`에 실패하는 렌더링 테스트를 추가한다.
   - `신뢰 0`과 `2 / 5`를 렌더링한다.
   - 기준 초과 값은 `7 / 5`로 그대로 렌더링한다.
   - `/assets/u2/status-trust.svg`를 사용한다.
   - 새 SVG 파일이 실제로 존재하며 공통 24×24 viewBox 계약을 따른다.
   - 승급 뒤, 남은 던전 앞에 놓인다.
   - 버튼이 아니며 승급 진입 test id를 갖지 않는다.
3. `TopStatusView`와 `statusFor()`를 구현한다.
4. 프리뷰와 테스트 경로를 데이터 원본에 맞춰 갱신한다.
   - 정적 fixture는 `livingCount`와 `DENOUNCE_THRESHOLD`로 필수 View를 채운다.
   - 캠페인 기반 프리뷰는 `statusFor()` 또는 C6 selector 결과를 사용한다.
5. `TopStatusBar`와 자산을 구현한다.
6. 공통 상태 바 및 고정 캔버스 회귀 테스트를 실행한다.
   - 7개 칩의 내부 overflow와 같은 행 배치를 브라우저에서 수치로 검증한다.
   - 최신 `main`의 전역 퀵 메뉴 닫힘·열림 상태와 겹치지 않는지 검증한다.
7. 실제 캠페인에서 신뢰 0 인원이 반영된 뒤 상단 숫자가 갱신되는지 브라우저로
   확인한다.

필수 자동 검증:

- `pnpm vitest run components/game/TopStatusBar.test.ts`
- `pnpm vitest run components/game/campaign-adapters.test.ts`
- `pnpm vitest run components/game/StatusBarConsistency.test.ts`
- 관련 U2, U3, U4, U5, U6 화면 및 프리뷰 테스트 통과
- `pnpm test` 통과
- `pnpm typecheck` 통과
- `pnpm exec eslint . --ignore-pattern 'playwright-report/**' --ignore-pattern 'test-results/**'`
  오류 0개
- `pnpm exec next build --webpack` 통과
- 상태 바 최대 7개 칩을 포함한 관련 `pnpm test:e2e` 시나리오 통과
- `git diff --check` 통과

필수 시각 검증:

- 기본 상태 `신뢰 0 0 / 5`
- 진행 상태 `신뢰 0 2 / 5`
- 기준 초과 정산 상태 `신뢰 0 6 / 5` 또는 `7 / 5`
- 원정 중 현재 던전까지 포함한 7개 칩
- 1920×1080, 1280×720, 비16:9 창의 레터박스 상태
- 가로 잘림, 줄바꿈, 스크롤, 아이콘 투명 여백 없음
- 전역 퀵 메뉴 닫힘·열림 상태에서 트리거·패널과 상태 칩 겹침 없음

## 9. 공식 문서 반영

구현 PR은 다음 공식 문서를 함께 갱신한다.

- `docs/README.md`
  - 이 Spec과 후속 구현 Plan을 `이번 개편 설계` 색인에 추가
- `docs/experience/SCREEN_LAYOUT.md`
  - `GameShell` 상단 상태 바 목록에 `신뢰 0 인원 / 누적 고발 기준` 추가
  - 최대 7개 칩 레이아웃 계약 기록
  - 전역 퀵 메뉴와 최대 7개 칩의 비겹침 계약 기록
- `docs/experience/ONBOARDING_AND_INTERFACE.md`
  - 캠페인 공통 정보에 신뢰 0 인원 추가
  - 사망자는 집계에서 빠지고 5명에서 누적 고발이 성립한다는 연결 명시
- `docs/technical/SCREEN_ADAPTER_CONTRACT.md`
  - `statusFor()`가 C6 선택자를 통해 `TopStatusView.zeroTrust`를 만든다는 경계 기록

다음 공식 규칙 문서는 이미 집계 조건과 기준값을 정의하므로 규칙 내용은 바꾸지
않는다. 구현 PR에서는 링크와 용어가 어긋난 경우에만 최소 수정한다.

- `docs/systems/CHARACTERS_AND_TRUST.md`
- `docs/systems/PROGRESSION_AND_ENDINGS.md`

## 10. 예상 구현 파일

- Modify: `components/game/TopStatusBar.tsx`
- Modify: `components/game/campaign-adapters.ts`
- Modify: `components/game/TopStatusBar.test.ts`
- Modify: `components/game/campaign-adapters.test.ts`
- Modify: 정적 상태 fixture를 가진 `components/game/u1-preview-data.ts`,
  `components/game/U2Preview.tsx`와 `GameShell`, `IntroScreen`, U3, U4, U5, U6 화면 테스트
- Modify: 캠페인 기반 상태 생성 경로인 `components/game/U3Preview.tsx`,
  `components/game/u4-preview-data.ts`, `components/game/u5-preview-data.ts`,
  `components/game/u6-preview-data.ts`
- Add: `public/assets/u2/status-trust.svg`
- Modify if needed after visual validation: `app/globals.css`
- Modify: `e2e/canvas-layout.spec.ts` 또는 같은 계약을 소유하는 상태 바 전용 E2E
- Modify: `docs/README.md`
- Modify: `docs/experience/SCREEN_LAYOUT.md`
- Modify: `docs/experience/ONBOARDING_AND_INTERFACE.md`
- Modify: `docs/technical/SCREEN_ADAPTER_CONTRACT.md`
- Add: 후속 구현 Plan 문서

이번 Spec PR의 실제 변경 파일은 이 설계 문서 한 개뿐이다.

## 11. 변경하지 않는 것

- `CampaignState`와 캐릭터 상태에 새 카운터 또는 이력 필드 추가
- `countLivingZeroTrust`의 집계 조건
- `DENOUNCE_THRESHOLD = 5`
- 누적 고발, 불신의 대가 및 다른 엔딩의 판정 순서
- 신뢰 0의 회복 불가 규칙과 출전 후보 제외 규칙
- 신뢰 변화 또는 사망을 캠페인 풀에 반영하는 전이 시점
- 2명, 3명, 4명 보정값의 밸런스
- 경고 색상, 점멸, 애니메이션, 툴팁, 상세 모달
- 신뢰 0 캐릭터의 이름 목록 공개
- U6 정산과 엔딩 화면의 정보 위계
- 1920×1080 고정 캔버스와 레터박스 원칙

## 12. 완료 조건

구현은 다음 조건을 모두 만족할 때 완료로 본다.

- 모든 `GameShell` 화면 상단에 `신뢰 0 n / 5`가 항상 표시된다.
- `n`은 C6의 `countLivingZeroTrust(campaign)` 결과와 같다.
- `n > 5`여도 5로 제한하지 않고 실제 selector 결과를 표시한다.
- 사망한 신뢰 0 캐릭터는 숫자에 포함되지 않는다.
- 기준값 5를 화면이나 fixture에서 별도 하드코딩하지 않고 도메인 상수를 전달한다.
- `TopStatusBar`는 캠페인 도메인과 엔딩 규칙을 직접 import하지 않는다.
- 새 상태 칩은 읽기 전용이며 기존 승급 버튼 동작을 바꾸지 않는다.
- 최대 7개 칩에서도 줄바꿈, 잘림, 상태 바 스크롤이 없다.
- 최대 7개 칩은 전역 퀵 메뉴가 닫히거나 열려도 트리거·패널과 겹치지 않는다.
- 화면별 상태 바 CSS 재정의가 생기지 않는다.
- 관련 공식 문서, 단위 테스트, 통합 테스트와 빌드가 모두 갱신되고 통과한다.
