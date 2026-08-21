# U3 길드 게시판·계약 화면 설계

- 작성자: SangHwan Yoo
- 작성일: 2026-08-21
- 대상 작업: `U3` 게시판·계약 화면
- 기준 브랜치: `feature/u3-guild-board`

## 1. 목적

U2 인트로의 `길드 게시판으로` 행동 다음에 이어지는 실제 게시판 화면을 만든다. 화면은 U1의 3:2 GameShell 계약을 그대로 사용하고, C2가 만든 `BoardOffer`를 화면이 임의로 재해석하지 않고 표시한다.

U3에서 플레이어는 한 화면 안에서 다음 순서를 끝낸다.

1. 최대 5개의 공고를 훑는다.
2. 공고 하나를 선택한다.
3. 우측에서 던전과 출전 3인의 실제 상태를 확인한다.
4. 생존 인원별 계약 결과를 확인한다.
5. 진입 가능한 공고만 계약한다.

## 2. 근거 문서와 우선순위

- `docs/GAME_PRINCIPLES.md`
- `docs/systems/DUNGEON_THEMES_AND_ECOLOGY.md`
- `docs/systems/PROGRESSION_AND_ENDINGS.md`
- `docs/experience/SCREEN_LAYOUT.md`
- `docs/experience/ONBOARDING_AND_INTERFACE.md`
- `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`
- C2 구현 `lib/rules/board.ts`

최신 C2/생태 문서의 `publicEnvironmentTag` 계약을 U3의 공식 `환경 특성`으로 사용한다. `SCREEN_LAYOUT.md`, `ONBOARDING_AND_INTERFACE.md`, U3 배정표에 남아 있는 `공개 위험 태그`·`답사 기록` 표현은 이번 작업에서 최신 UX 결정에 맞게 고친다.

## 3. 시각 기준

레퍼런스 이미지는 다음 경로에 보관한다.

- `docs/diagram/u3/u3-guild-board-concept.webp`
- `docs/diagram/u3/u3-guild-board-assets.webp`

이미지는 정보 위계·재질·명도·배치의 참고다. 이미지 안에 우연히 남은 `함정`, `모래폭풍`, `독`, `저주`, `보스` 같은 다중 태그는 구현 계약이 아니며 U3 DOM에 넣지 않는다.

U2와 연결되는 공통 시각 언어는 다음과 같다.

- 어두운 판타지 길드 실내
- 검은 배경, 짙은 목재, 금속 모서리, 양피지
- 금색 선과 장식
- 선택은 초록색 빛과 문구를 함께 사용
- 진입 불가는 붉은 테두리·봉인과 `진입 불가` 문구를 함께 사용
- 상단 상태 바는 U2의 `TopStatusBar`와 `/assets/u2/status-*.svg`를 그대로 재사용

## 4. 60:40 화면 계약

U3는 U1 `GameShell`을 사용한다.

- 좌측 MainContent: 정확히 60%
- 우측 RightPanel: 정확히 40%
- 기준 해상도: `1280x720`
- 최소 지원: `1024x640`
- 가로 스크롤 금지

U2 인트로는 별도 전체 폭 화면이지만, U3에 들어온 순간 공통 캠페인 60:40 셸로 돌아온다. 색·상태바·초록 계약 버튼의 조형을 이어서 화면 전환이 이질적으로 보이지 않게 한다.

## 5. 좌측: 길드 공고 게시판

### 5.1 공고 수와 배치

- C2가 제공하는 공고를 최대 5장 표시한다.
- 모든 공고 카드의 가로·세로 크기는 동일하다.
- 카드마다 `translate`와 1도 안팎의 미세한 회전만 다르게 주어 완전히 반듯하지 않은 손으로 붙인 게시판 느낌을 낸다.
- 비대칭은 장식일 뿐 카드 크기·읽기 순서·클릭 영역을 바꾸지 않는다.
- `의뢰 갱신` 버튼은 만들지 않는다.

### 5.2 공고 한 장의 정보

공고는 다음만 표시한다.

- 던전 이름
- 현재 위험도 ★1~5
- 3명 생존 기준 명성·골드 보상
- `환경 특성` 정확히 1개: `offer.publicEnvironmentTag.label`
- `진입 가능` 또는 `진입 불가`
- 진입 불가라면 사유

`환경 특성` 예시는 공식 데이터에서만 온다.

- 거미굴: `진동 경계`, `시체 흔적`, `어둠 잠복`
- 사막: `열기 노출`, `수분 지대`, `발자국 소실`
- 묘지: `소리 경계`, `빛 노출`, `매장물 수호`

별도의 위험/함정/보스 태그 묶음은 없다.

### 5.3 상태

- 기본: 양피지 카드
- 선택: 초록 외곽광 + `선택 중`
- 진입 불가: 붉은 테두리 + 봉인 SVG + `진입 불가` + 등급 부족 설명
- 진입 불가 카드도 선택하여 우측 상세를 볼 수 있다.

## 6. 우측: 계약 상세

우측은 독립 화면이 아니라 같은 `GameShell`의 RightPanel이다.

### 6.1 던전 정보

표시:

- 던전 이름
- 테마 모티프: `spider`, `desert`, `graveyard`에 매핑한 고정 SVG
- 현재 위험도
- `환경 특성` 1개
- 3명 생존 기준 명성·골드 보상

표시하지 않음:

- 소요 시간
- `위험: 인간 적대세력` 같은 임의 위험 문구
- 정찰 보고 별도 섹션
- 다중 위험 태그

### 6.2 탐험대 구성

`offer.party.memberIds`와 `campaign.pool.byId`를 사용하여 실제 캐릭터 3명을 그린다.

각 카드에는 다음 데이터만 동적으로 표시한다.

- 이름
- 직업
- 성격
- HP `현재 / 최대`
- 신뢰
- 소지 골드

캐릭터 초상은 이번 U3에서 새로 만들지 않는다. 향후 캐릭터 이미지 매핑을 받을 수 있는 중립적인 portrait slot만 DOM/CSS로 둔다. HP·신뢰·소지 골드도 별도 SVG 에셋을 만들지 않는다.

### 6.3 계약 조건

기존 `계약 기간`, `중도 포기`, `실패 패널티`는 사용하지 않는다.

위험도별 3명 생존 보상에서 파생한 다음 네 줄을 표시한다.

- `전원 생존 시`: 명성·골드 100%
- `2명 생존 시`: 명성·골드 60%, 소수점 버림
- `1명 생존 시`: 명성·골드 30%, 소수점 버림
- `전원 사망 시`: 계약 보상 없음, 계약 시 위험도의 3명 생존 명성만큼 명성 감소

전멸 시 유품 골드 회수는 공식 규칙이므로 보조 설명으로 표시할 수 있다. 수치는 `riskLevel`에서 계산하며 이미지나 정적 문구에 박지 않는다.

### 6.4 계약 버튼

- U2 CTA의 녹색/금색 조형을 이어간다.
- 기존 `/assets/u2/intro-contract.svg`를 재사용한다.
- 진입 가능한 선택 공고: `이 공고 계약하기`
- 진입 불가 공고: disabled, `진입 불가`
- 키보드 focus-visible을 제공한다.

U3 자체는 I1/I2 상태 머신을 소유하지 않는다. 프리뷰에서는 `onContract(offerId)` 콜백이 호출되는 것까지만 검증한다.

## 7. 고정 SVG 자산

새 SVG는 동적 수치나 캐릭터 데이터를 표현하지 않고 고정 UI 장식만 담당한다.

새로 만든다.

- `public/assets/u3/board-pin.svg`
- `public/assets/u3/risk-star.svg`
- `public/assets/u3/environment.svg`
- `public/assets/u3/notice-lock.svg`
- `public/assets/u3/theme-spider.svg`
- `public/assets/u3/theme-desert.svg`
- `public/assets/u3/theme-graveyard.svg`

재사용한다.

- `/assets/u2/status-gold.svg`
- `/assets/u2/status-reputation.svg`
- `/assets/u2/intro-contract.svg`
- U2 상단 상태 아이콘 전체

만들지 않는다.

- 파티원 전용 SVG/초상
- HP SVG
- 신뢰 SVG
- 소지 골드 SVG

## 8. 데이터 흐름

`U3Preview`는 테스트용 시드로 `initializeCampaign(seed)`를 만들고 `createBoardOffers(state)`의 결과를 사용한다. 임의로 공고나 파티를 하드코딩하지 않는다.

화면용 보상 계산 함수는 `riskLevel`을 받아 공식 보상표와 생존 비율을 적용한다. 화면 컴포넌트는 계산식을 다시 만들지 않고 그 뷰 모델을 소비한다.

선택된 공고가 바뀌면 우측 던전·파티·계약 조건 전체가 같은 공고 기준으로 함께 바뀐다.

## 9. 접근성

- 공고는 실제 `<button>` 또는 동일한 키보드 동작을 가진 요소로 선택한다.
- 현재 선택은 `aria-pressed`로 노출한다.
- 위험도는 별 장식만으로 전달하지 않고 `위험도 N` 텍스트/aria-label을 함께 둔다.
- 선택/잠금은 색상 외에 문구와 봉인 모양으로 함께 구분한다.
- 계약 버튼은 disabled 상태가 보조기술에 전달된다.

## 10. U2 연결

U3 프리뷰가 생기면 `U2Preview.tsx`의 `boardHref`를 `/u1-test?screen=board`에서 `/u3-test`로 바꾼다. 이 변경으로 U2 인트로 CTA가 실제 U3 디자인으로 이어진다.

## 11. 테스트·완료 기준

- 뷰 모델 테스트: 위험도별 3/2/1/0 생존 결과 계산
- 화면 테스트: 최대 5개, 환경 특성 1개, 파티 3인, 잠금 이유, CTA disabled/콜백
- U2 테스트: `/u3-test` 링크 확인
- 자산 테스트: U3 SVG 7개 존재 및 `viewBox` 확인
- 브라우저: `1280x720`, `1024x640`에서 좌/우 3:2, 가로 스크롤 없음
- 키보드: 공고 선택과 계약 버튼 focus/Enter 확인
- 최종 검증: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`

## 12. 범위 밖

- I1/I2 상태 머신과 실제 원정 전이
- 캐릭터 전용 초상 이미지 제작/매핑
- 공고 갱신 기능
- 애니메이션
- C4 정산 규칙 자체의 구현
