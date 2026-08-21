# U3 길드 게시판·계약 화면 설계

## 문서 정보

- 작성자: SangHwan Yoo
- 작성 도구: ChatGPT
- 작성일: 2026-08-21
- 대상 작업: `U3` 게시판·계약 화면
- 기준 브랜치: `feature/u3-guild-board`

## 1. 목적

U2 인트로의 `길드 게시판으로` CTA 다음에 자연스럽게 이어지는 U3 게시판·계약 화면을 만든다. U1의 3:2 `GameShell`을 그대로 사용하고, C2가 만든 `BoardOffer`와 임시 파티를 화면에서 임의로 다시 생성하지 않고 표시한다.

U3에서 플레이어는 한 화면 안에서 다음을 확인한다.

1. 최대 5개의 공고를 훑는다.
2. 공고 하나를 선택한다.
3. 우측에서 던전 정보와 출전 3인의 실제 상태를 확인한다.
4. 전원/2명/1명 생존과 전멸 시 계약 결과를 확인한다.
5. 진입 가능한 공고만 계약한다.

## 2. 근거 문서

- `docs/GAME_PRINCIPLES.md`
- `docs/systems/DUNGEON_THEMES_AND_ECOLOGY.md`
- `docs/systems/PROGRESSION_AND_ENDINGS.md`
- `docs/experience/SCREEN_LAYOUT.md`
- `docs/experience/ONBOARDING_AND_INTERFACE.md`
- `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`
- `lib/rules/board.ts`

C2의 `publicEnvironmentTag` 계약을 공고의 공식 `환경 특성`으로 사용한다. 별도 위험 태그 모델을 추가하지 않는다.

## 3. 시각 기준

레퍼런스 이미지는 다음 경로에 기록한다.

- `docs/diagram/u3/u3-guild-board-concept.webp`
- `docs/diagram/u3/u3-guild-board-assets.webp`

레퍼런스 이미지는 구현 배경으로 임베드하지 않고 정보 위계·재질·명도·배치만 참고한다. 이미지 안에 남은 `함정`, `모래폭풍`, `독`, `저주`, `보스` 등의 복수 태그는 구현 계약이 아니다.

U2와 이어지는 시각 언어는 다음과 같다.

- 검은 배경과 짙은 목재
- 금속 모서리와 양피지
- 금색 선과 장식
- 초록: 선택·진행 가능
- 붉은색: 진입 불가
- U2 `TopStatusBar`와 `/assets/u2/status-*.svg` 재사용
- U2 녹색/금색 CTA 조형 재사용

## 4. 60:40 화면 계약

U3는 U1 `GameShell`의 본문 비율을 변경하지 않는다.

- 좌측 MainContent: 60%
- 우측 RightPanel: 40%
- 기준 해상도: `1280x720`
- 최소 지원: `1024x640`
- 가로 스크롤 금지

U2 인트로에서 U3로 넘어오면 전체 폭 인트로에서 캠페인 공통 60:40 셸로 전환되지만, 상태바·색·재질·CTA 조형은 이어져 이질감을 줄인다.

## 5. 좌측 길드 게시판

### 5.1 공고 수와 배치

- C2가 제공하는 공고를 최대 5장 표시한다.
- 모든 공고 카드는 가로·세로 크기가 동일하다.
- 3장 위 / 2장 아래를 기본 구도로 한다.
- 카드마다 작은 `translate`와 약 1도 안팎의 회전만 다르게 주어 손으로 붙인 듯한 비대칭을 만든다.
- 비대칭은 장식일 뿐 읽기 순서와 클릭 영역을 바꾸지 않는다.
- `의뢰 갱신` UI는 만들지 않는다.

### 5.2 공고 한 장의 정보

공고에는 다음만 표시한다.

- 던전 이름
- 현재 위험도 ★1~5
- 3명 생존 기준 명성·골드 보상
- `환경 특성` 정확히 1개: `offer.publicEnvironmentTag.label`
- `진입 가능`, `선택 중`, `진입 불가` 상태
- 던전 테마 비네트

환경 특성 예시는 공식 C2 데이터에서만 온다.

- 거미굴: `진동 경계`, `시체 흔적`, `어둠 잠복`
- 사막: `열기 노출`, `수분 지대`, `발자국 소실`
- 묘지: `소리 경계`, `빛 노출`, `매장물 수호`

다음은 표시하지 않는다.

- 임의 복수 위험 태그
- `위험: 인간 적대 세력` 같은 별도 위험 문장
- 의뢰 갱신
- 소요 시간
- 정찰 보고
- 답사 기록

### 5.3 상태 표현

- 기본: 양피지 카드
- 선택: 초록 외곽광 + `선택 중` + `aria-pressed`
- 진입 불가: 붉은 테두리 + 봉인 SVG + `진입 불가` + 등급 부족 사유
- 진입 불가 공고도 선택하여 우측 상세는 확인할 수 있다.

## 6. 던전 테마 이미지

공고와 우측 상세에는 `CampaignDungeon.theme`에 따라 고정 SVG를 매핑한다.

```ts
const THEME_ICON = {
  spider: "/assets/u3/theme-spider.svg",
  desert: "/assets/u3/theme-desert.svg",
  graveyard: "/assets/u3/theme-graveyard.svg",
} as const;
```

이 SVG는 테마 비네트다. 개별 던전 고유 일러스트 15장은 이번 범위 밖이며, 향후 준비되면 같은 슬롯의 매핑만 확장한다.

## 7. 우측 계약 상세

우측은 별도 화면이 아니라 같은 `GameShell`의 RightPanel이다.

### 7.1 던전 정보

표시한다.

- 테마 비네트
- 던전 이름
- 현재 위험도
- 환경 특성 1개
- 3명 생존 기준 명성·골드 보상
- 진입 불가라면 구체적 등급 제한 사유

표시하지 않는다.

- 정찰 보고/답사 기록
- 소요 시간
- 계약 기간
- 중도 포기
- 임의 실패 패널티 블록

### 7.2 탐험대 구성

`offer.party.memberIds`와 `campaign.pool.byId`를 사용해 실제 캐릭터 3명을 표시한다.

각 카드 데이터:

- 이름
- 직업
- 성격
- HP `현재 / 최대`
- 신뢰
- 소지 골드
- 선택적 `portraitSrc`

HP·신뢰·소지 골드는 숫자 데이터로 렌더링하며 값 전용 SVG를 만들지 않는다. 소지 골드에는 기존 `/assets/u2/status-gold.svg`를 재사용한다.

캐릭터 고유 초상은 이번 작업에서 만들지 않는다. `u3-board-model`은 선택적인 `characterId -> portraitSrc` 매핑을 받을 수 있고, 경로가 없으면 중립 실루엣 placeholder를 표시한다. 나중에 캐릭터 이미지가 준비되면 이 매핑만 채운다.

### 7.3 계약 결과

위험도별 3명 생존 기준 보상에서 아래 네 줄을 계산한다.

- `전원 생존 시`: 명성·골드 100%
- `2명 생존 시`: 명성·골드 60%, 소수점 버림
- `1명 생존 시`: 명성·골드 30%, 소수점 버림
- `전원 사망 시`: 계약 보상 없음 + 계약 시 위험도의 3명 생존 명성만큼 명성 감소

전멸 시 사망자 유품 골드 회수는 보조 설명으로 표시할 수 있다. 현재 C4 규칙 구현 전이므로 U3 화면 모델의 보상표는 `PROGRESSION_AND_ENDINGS.md`의 확정 표를 표시용 상수로 사용하고, C4가 단일 규칙 상수를 제공하면 교체한다.

### 7.4 계약 버튼

- 진입 가능: `이 공고 계약하기`
- 진입 불가: disabled, `진입 불가`
- 기존 `/assets/u2/intro-contract.svg` 재사용
- U3 프리뷰에서는 `onContract(offerId)` 콜백까지만 담당한다.
- 실제 phase 변경과 지도 진입은 `I1`/`I2` 범위다.

## 8. 화면 모델

`components/game/u3-board-model.ts`가 `CampaignState`와 `BoardOffer[]`를 화면 모델로 투영한다.

책임:

- C2 공고 순서를 보존하고 최대 5개만 렌더링 대상으로 제한
- `publicEnvironmentTag.label`을 환경 특성 한 개로 전달
- 던전 이름·테마·위험도·잠금 사유 전달
- 파티원 실제 HP·신뢰·소지 골드 전달
- 생존 인원별 보상 계산
- 선택적 초상 매핑 전달

하지 않는 일:

- 생태 규칙/답사 기록 파생
- 공고 재정렬
- 파티 재편성
- 임의 태그 생성

## 9. 고정 SVG 자산

새 U3 SVG:

- `public/assets/u3/board-pin.svg`
- `public/assets/u3/risk-star.svg`
- `public/assets/u3/environment.svg`
- `public/assets/u3/notice-lock.svg`
- `public/assets/u3/theme-spider.svg`
- `public/assets/u3/theme-desert.svg`
- `public/assets/u3/theme-graveyard.svg`

재사용:

- `/assets/u2/status-gold.svg`
- `/assets/u2/status-reputation.svg`
- `/assets/u2/intro-contract.svg`
- U2 상단 상태 아이콘 전체

새로 만들지 않음:

- 캐릭터 초상화
- HP 값 SVG
- 신뢰 값 SVG
- 소지 골드 값 SVG
- 새 골드 아이콘

## 10. 컴포넌트 구조

```text
app/u3-test/page.tsx
└─ U3Preview
   └─ U3BoardScreen
      └─ GameShell
         ├─ TopStatusBar
         ├─ 좌 60% NoticeCard × 최대 5
         └─ 우 40%
            ├─ DungeonSummary
            ├─ PartyCard × 3
            ├─ ContractOutcomes
            └─ ContractButton
```

`U3Preview`는 고정 seed로 `initializeCampaign`과 `createBoardOffers`를 호출해 실제 C1/C2 데이터를 사용한다. 기본 선택은 첫 번째 공고이며 사용자가 공고를 고르면 우측 상세 전체가 함께 바뀐다.

## 11. U2 연결

U3 프리뷰가 존재하므로 `U2Preview.tsx`의 `boardHref`는 `/u3-test`다. U2 인트로 CTA는 임시 U1 게시판 프리뷰가 아니라 실제 U3 디자인으로 이동한다.

## 12. 접근성

- 공고는 실제 `<button>`으로 선택한다.
- 현재 선택은 `aria-pressed`로 노출한다.
- 위험도는 별 장식과 `위험도 N` aria-label을 함께 사용한다.
- 선택/잠금은 색상뿐 아니라 `선택 중`, `진입 불가`, 봉인 모양, 사유 문구로 구분한다.
- 계약 버튼의 disabled 상태를 보조기술에 전달한다.
- 1024×640에서도 가로 스크롤을 만들지 않는다.

## 13. 테스트·완료 기준

자동 테스트는 다음을 고정한다.

- 위험도별 3/2/1/0 생존 결과 계산
- 공고당 환경 특성 1개
- 실제 파티 3인의 HP·신뢰·소지 골드
- 선택적 캐릭터 초상 매핑 전달
- `답사 기록`, `정찰 보고`, `의뢰 갱신`, `소요 시간` 미노출
- 잠금 사유와 계약 버튼 disabled
- 기존 골드 SVG 재사용
- U2 `/u3-test` 연결
- U3 SVG 자산 존재와 `viewBox`

최종 검증 명령:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

브라우저 검증:

- `/u2-test` → `길드 게시판으로` → `/u3-test`
- 1280×720 / 1024×640
- 좌우 track 3:2
- horizontal scroll 없음
- 키보드 공고 선택
- 잠긴 공고 상세와 disabled 계약 버튼

## 14. 범위 밖

- I1/I2 상태 머신과 실제 원정 전이
- 캐릭터 고유 초상 이미지 제작
- 개별 던전 고유 일러스트 15장
- 의뢰 갱신
- 정찰/답사 보고
- 소요 시간
- 다중 위험 태그
- C4 정산 규칙 자체 구현
