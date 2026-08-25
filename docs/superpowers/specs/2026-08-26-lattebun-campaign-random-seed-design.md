# 캠페인 기본 진입 무작위 시드 설계

## 문서 정보

- 작성자: LatteBun
- 작성 도구: Codex
- 작성일: 2026-08-26
- 대상 작업: `/campaign` 주소를 유지하는 새 캠페인 무작위 시드 생성
- 기준 브랜치: `main`
- 기준 커밋: `719664a`

## 1. 문제와 목표

PR #184는 게시판 후보를 캠페인 시드와 월드턴으로 위험도 가중 추첨하도록
바꿨다. 규칙 함수는 서로 다른 시드에서 여러 던전 조합을 만들지만, 실제 메인
메뉴는 항상 검색 파라미터 없는 `/campaign`으로 이동하고 캠페인 페이지는 이를
고정 문자열 `dungeon-schemer`로 해석한다. 사용자가 새 캠페인을 반복해도 같은
시드가 들어가므로 첫 게시판도 계속 같은 다섯 던전으로 보인다.

완료 목표는 다음과 같다.

- 사용자가 메인 메뉴에서 캠페인을 새로 시작할 때마다 새 캠페인 시드를 만든다.
- 브라우저 주소는 검색 파라미터 없는 `/campaign`으로 유지한다.
- 한 캠페인 안에서는 처음 만든 시드를 계속 사용해 모든 난수 스트림의 재현성을
  보존한다.
- `/campaign?seed=<값>`은 자동 테스트와 결함 재현을 위한 고정 시드 진입으로
  유지한다.
- PR #184의 위험도 제곱 가중 추첨, 진입 가능 후보 우선, 최대 5개 및 파티 수에
  따른 공고 상한은 변경하지 않는다.

새 시드는 독립적인 무작위 입력이다. 두 캠페인이 우연히 같은 다섯 던전 조합을
낼 수는 있으며, 직전 조합을 저장해 강제로 배제하는 anti-repeat 상태는 만들지
않는다.

## 2. 근거와 범위

근거 문서는 다음과 같다.

- `docs/README.md`
- `docs/GAME_PRINCIPLES.md`의 시드 재현성 원칙
- `docs/design/CORE_GAME_LOOP.md`의 캠페인 생성과 게시판 규칙
- `docs/experience/ONBOARDING_AND_INTERFACE.md`의 메인 메뉴 진입 계약
- `docs/technical/SESSION_PERSISTENCE_REVIEW.md`의 세션 전용 캠페인 상태 계약
- Next.js 16.3 저장소 내 `searchParams`, random values, `connection()`, `Link`
  prefetch 및 Client Cache 공식 가이드

캠페인은 현재 탭 메모리에만 있고 이어하기는 범위 밖이다. 따라서 새로고침이
현재 캠페인을 초기화하는 기존 정책은 유지하되, 초기화된 판이 다시 고정 시드가
아니라 새 시드를 받게 한다. 업적 프로필과 엔딩 기록 저장은 건드리지 않는다.

## 3. 시드 결정 설계

### 3.1 명시적 시드

`searchParams.seed`가 비어 있지 않은 단일 문자열이면 그 값을 그대로 사용한다.
같은 URL은 기존과 같이 같은 캐릭터 풀, 던전 생태 배정, 게시판, 지도와 사건을
재현한다. 배열 값과 빈 문자열은 공개 고정 시드 계약으로 인정하지 않고 기본
진입과 같이 새 시드를 만든다.

### 3.2 기본 진입

검색 파라미터에 유효한 시드가 없으면 `@/lib/rng`의 기존 `createSeed()`를 한 번
호출한다. 이 함수는 `crypto.randomUUID()`를 사용하며 `Math.random()` 금지와
캠페인 재현성 규약을 모두 지킨다. 생성된 값은 `CampaignStoreProvider`의 `seed`
prop으로 전달하고, Provider는 기존처럼 해당 인스턴스를 한 번만 만든다.

캠페인 페이지는 `searchParams`를 await한 뒤 시드를 결정한다. Next.js 16.3에서
`searchParams`는 request-time API이므로 새 값 생성은 요청 시점에 일어난다.
`crypto.randomUUID()`만을 위해 별도의 `connection()`을 중복 호출하지 않는다.

### 3.3 주소와 탐색

메인 메뉴의 `캠페인 시작` 링크는 계속 `href="/campaign"`을 사용한다. 링크에는
`prefetch={false}`를 지정한다. 캠페인 시드는 실제 새 탐색 요청에서 만들어야 하며,
사용자가 링크를 보기만 했을 때 백그라운드 prefetch가 미리 판을 만들게 하지
않는다.

Next.js 16.3 Client Cache는 페이지를 기본적으로 일반 재방문용으로 캐시하지 않고
뒤로/앞으로 탐색에서는 복원한다. 따라서 다음 경계를 사용한다.

- 메인 메뉴에서 새 `캠페인 시작` 탐색: 새 요청과 새 시드
- `/campaign` 새로고침: 현재 메모리 캠페인을 버리고 새 요청과 새 시드
- 브라우저 뒤로/앞으로: 기존 bfcache·Client Cache 복원 정책 유지
- 명시적 `?seed=` 탐색: 전달한 고정 시드 사용

## 4. 게시판 동작

게시판 규칙 자체는 수정하지 않는다. 초기 C급에는 진입 가능한 미클리어 던전이
일곱 개 있고, `createBoardOffers`가 위험도 제곱을 가중치로 최대 다섯 개를
비복원 추첨한다. 새 캠페인마다 입력 시드가 달라져 이 기존 다양성 로직이 실제
사용자 진입에서도 작동한다.

진입 가능한 던전이나 완전한 3인 파티가 다섯보다 적으면 기존 규칙에 따라 공고가
다섯보다 적거나 잠긴 공고가 채워질 수 있다. 이번 변경은 모든 캠페인 상태에서
무조건 진입 가능한 공고 다섯 개를 보장하는 규칙 변경이 아니다.

## 5. 오류와 안전 경계

`crypto.randomUUID()` 실패를 고정 문자열로 조용히 대체하지 않는다. 콘텐츠 부족과
불가능한 상태를 재추첨으로 숨기지 않는 게임 원칙과 마찬가지로 시드 생성 실패는
렌더 오류로 드러나게 한다. UUID를 URL, 저장소 또는 로그에 추가로 기록하지 않는다.

시드는 비밀이 아니지만 사용자 주소에 자동 노출하지 않는다. 명시적 시드는 이미
지원하는 진단 입력이므로 그대로 허용하며 별도 형식 제한이나 길이 제한은 이번
범위에 추가하지 않는다.

## 6. 테스트와 검증

TDD 순서는 다음과 같다.

1. 캠페인 시드 결정 테스트에서 유효한 명시적 시드는 generator를 호출하지 않고
   그대로 유지되며, 누락·빈 문자열·배열은 generator 결과를 사용함을 RED로
   고정한다.
2. 메인 메뉴 렌더 테스트에서 캠페인 링크가 `/campaign`을 유지하고 prefetch를
   끔을 RED로 고정한다.
3. 시드 결정 경계와 페이지 연결을 최소 변경으로 구현해 관련 테스트를 GREEN으로
   만든다.
4. 기존 `board.test.ts`로 서로 다른 시드의 조합 다양성과 같은 시드 재현성이
   유지되는지 확인한다.
5. 전체 Vitest, ESLint, TypeScript, Next.js build와 `git diff --check`를 실행한다.
6. 실제 브라우저에서 메인 메뉴 → 캠페인 시작을 두 번 새로 수행해 주소가 모두
   `/campaign`이고 각 캠페인이 정상적으로 게시판까지 진행되는지 확인한다. 생성
   시드는 직접 노출하지 않으므로 두 게시판이 우연히 같을 가능성을 실패 조건으로
   삼지 않는다.

완료 조건:

- 기본 진입은 호출마다 generator에서 받은 새 시드를 Provider에 전달한다.
- 명시적 시드 진입은 generator를 호출하지 않고 기존 재현성을 유지한다.
- 메인 메뉴 링크의 최종 주소는 `/campaign`이며 자동 prefetch를 하지 않는다.
- `createBoardOffers`의 위험도 가중 및 최대 5개 계약은 변하지 않는다.
- 관련 테스트와 전체 검증이 통과한다.

## 7. 문서 갱신

- `docs/design/CORE_GAME_LOOP.md`: 기본 진입의 새 시드와 현행 위험도 가중 게시판
  규칙을 기록한다.
- `docs/experience/ONBOARDING_AND_INTERFACE.md`: 주소를 유지하는 새 캠페인 진입과
  고정 시드 진단 경계를 기록한다.
- `docs/technical/SESSION_PERSISTENCE_REVIEW.md`: 새로고침 뒤 새 무작위 캠페인이
  시작되는 현재 세션 정책을 명시한다.
- `docs/README.md`: 승인된 설계와 구현 계획을 문서 색인에 연결한다.
- `docs/GAME_PRINCIPLES.md`: 같은 시드 재현성 원칙이 유지되므로 수정하지 않는다.

## 8. 예상 변경 파일

- Modify: `app/campaign/page.tsx`
- Add: `app/campaign/page.test.ts`
- Modify: `components/game/MainMenuScreen.tsx`
- Modify: `components/game/MainMenuScreen.test.tsx`
- Modify: `docs/design/CORE_GAME_LOOP.md`
- Modify: `docs/experience/ONBOARDING_AND_INTERFACE.md`
- Modify: `docs/technical/SESSION_PERSISTENCE_REVIEW.md`
- Modify: `docs/README.md`
- Add: `docs/superpowers/specs/2026-08-26-lattebun-campaign-random-seed-design.md`
- Add: `docs/superpowers/plans/2026-08-26-lattebun-campaign-random-seed.md`

## 9. 변경하지 않는 것

- `lib/rules/board.ts`의 위험도 제곱 가중 추첨과 잠금 공고 규칙
- `CampaignState`와 `CampaignStoreProvider` 공개 타입
- 캠페인 이어하기, `localStorage`, `sessionStorage`, 쿠키 또는 서버 저장
- URL 자동 변경, seed query 자동 삽입 또는 사용자용 시드 입력 UI
- 직전 게시판과 같은 조합을 강제로 피하는 anti-repeat 상태
- 캐릭터 풀, 던전 생태, 지도, 사건과 전투 난수 스트림
- 업적 프로필과 엔딩 기록
