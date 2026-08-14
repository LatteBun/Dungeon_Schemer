# C1·F1·F2 통합 검증 하네스 설계

> 상태: 사용자 검토 요청
> 작성일: 2026-08-14
> 작성자: SangHwan Yoo
> 작성 도구: Codex

## 목적

현재 `/integration-test`는 기존 R1~R4 규칙과 F2 `RunState` fixture를 같은
seed로 확인하지만, C1의 실제 `initializeCampaign`과 초기 게시판은 표시하지
않는다. 이 설계는 기존 통합 하네스를 유지하면서 C1 초기 상태와 게시판을 같은
개발용 화면에 추가해 F1 계약·F2 콘텐츠·C1 초기화를 한 번에 확인할 수 있게 한다.

이 화면은 제품 플레이 화면이 아니라 순수 규칙을 사람이 확인하는 개발용 검증
도구다. `pnpm dev`로 실행하고 `/integration-test`에서 seed를 바꿔 재현성을
확인한다.

## 근거와 범위

다음 문서를 기준으로 한다.

1. [게임 원칙](../../GAME_PRINCIPLES.md)
2. [문서 안내](../../README.md)
3. [핵심 게임 루프](../../design/CORE_GAME_LOOP.md)
4. [C1 초기화·게시판 설계](2026-08-14-sanghwan-yoo-c1-campaign-initialization-board-design.md)
5. 기존 `/integration-test` 구현과 `lib/dev-tools/test-snapshots.ts`

### 포함

- 기존 `createIntegrationSnapshot`에 C1 초기 캠페인 snapshot 추가
- 입력 seed 하나로 기존 R1~R4/F2 검증 결과와 C1 검증 결과를 함께 생성
- `/integration-test`에 C1 상태 요약과 초기 게시판 공고 목록 표시
- C1 던전 등급 수량, 파티·예비 인원 수, 전체 인원 수, 초기 자원 표시
- 공고별 던전·파티 연결, 지원 명성, 보상, 잠금 상태 표시
- 같은 seed 재실행 결과가 동일하다는 자동 테스트
- 브라우저에서 C1 핵심 요소를 확인할 수 있는 `data-testid` 부여
- F1/F2 단독 화면으로 이동할 수 있는 링크 보강

### 제외

- F1 fixture를 C1 초기 상태로 교체
- F2 콘텐츠 검증 snapshot의 구조 변경 또는 콘텐츠 효과 계산
- C2 충원·재편, C3 계약·정산·승급·엔딩, E1~E3 탐험 전이
- 공고 클릭에 따른 상태 변경이나 Zustand store 연결
- 실제 플레이 화면 `/play`와 제품용 캠페인 HUD
- 저장·복원, 서버·로그인·외부 데이터 연동

기존 F1/F2 검증은 현재 계약을 그대로 보존한다. C1은 기존 fixture를 덮어쓰지
않고 별도 필드와 별도 UI 섹션으로 추가한다.

## 설계 선택

### 통합 snapshot을 확장한다

`IntegrationSnapshot`에 다음 형태의 읽기 전용 요약을 추가한다.

```ts
interface CampaignIntegrationSnapshot {
  seed: string;
  phase: string;
  rank: string;
  currentReputation: number;
  currentGold: number;
  cumulativeGold: number;
  dungeonCounts: Record<Grade, number>;
  dungeonCount: number;
  partyCount: number;
  completePartyCount: number;
  memberCount: number;
  reserveMemberCount: number;
  board: Array<{
    id: string;
    dungeonId: string;
    dungeonGrade: Grade;
    partyId: string;
    partyMemberNames: string[];
    requiredReputation: number;
    baseReputationReward: number;
    baseGoldReward: number;
    nodeCount: number;
    locked: boolean;
    lockReason: string | null;
  }>;
  reproducible: boolean;
}
```

`createIntegrationSnapshot(options)`는 기존 R1~R4/F2 계산을 유지하고,
`initializeCampaign(options.seed)`를 한 번 호출해 C1 요약을 만든다. 같은
snapshot 안에서 C1 파티와 기존 R1 파티를 동일한 배열로 취급하지 않는다.
기존 R1 파티는 기존 규칙 회귀를 위해 유지하고, C1 파티는 15팀 캠페인 초기
상태의 실제 결과로 표시한다.

`reproducible`는 같은 seed로 생성한 C1 요약을 다시 만들어 deep equal인지
확인한다. UI는 실패 시 원인을 숨기지 않고 `실패` 상태로 표시한다.

### C1 패널을 기존 통합 화면에 병렬 배치한다

`app/integration-test/integration-test-panel.tsx`에 `C1CampaignSection`을
추가한다. 기존 R1/R2/R3/R4/F2 섹션의 의미와 표시를 변경하지 않는다.

C1 패널은 다음 순서로 표시한다.

1. 캠페인 seed, phase, rank, 명성, 현재 골드, 누적 골드
2. 던전 총량과 C/B/A/S 등급별 수량
3. 완성 파티 15팀, 예비 인원 6명, 전체 인원 51명
4. 초기 게시판 최대 5개 공고
5. 공고별 던전 등급·지점 수, 파티 ID·파티원 이름, 보상, 필요 명성
6. `지원 가능` 또는 `명성 부족` 잠금 상태
7. 같은 seed 재현성 결과

잠금 상태는 색상만으로 구분하지 않고 텍스트와 `aria-label`도 제공한다.
공고가 없는 경우와 snapshot 생성 오류도 패널 내부에 명시한다.

기존 화면 상단 navigation에는 `/f1-test`, `/f2-test` 링크를 추가하고,
`/integration-test` 자체가 세 규칙을 함께 보여주는 진입점임을 설명한다.

## 데이터 흐름

```text
seed 입력
  ├─ 기존 createIntegrationSnapshot: R1/R2/R3/R4 + F2 RunState
  └─ initializeCampaign(seed): F1 CampaignState + C1 BoardOffer
                                      ↓
                         CampaignIntegrationSnapshot
                                      ↓
                         /integration-test C1 패널
```

모든 계산은 기존 순수 규칙을 호출한다. UI에서 `Math.random()`이나 별도
fixture를 만들지 않는다. C1 게시판은 `initializeCampaign`이 materialize한
초기 board를 표시하고, UI 렌더링 때문에 `generateBoard`를 다시 호출하지
않는다.

## 오류와 불변성

- seed가 빈 문자열이면 기존 입력 오류 처리를 사용한다.
- C1 초기화가 `RuleError` 또는 일반 오류를 던지면 snapshot 생성 경계를
  삼키지 않고 테스트에서 실패시킨다. UI에서만 개발자 확인 가능한 오류
  메시지로 표시한다.
- snapshot 요약은 UI가 수정해도 다음 seed 실행에 영향을 주지 않는 새 배열과
  객체로 만든다.
- 기존 F1 fixture와 F2 콘텐츠 snapshot의 값·형태·재현성 계약은 변경하지
  않는다.

## 테스트 설계

### snapshot 단위 테스트

`lib/dev-tools/test-snapshots.test.ts` 또는 해당 모듈의 기존 테스트 경계에
다음 테스트를 추가한다.

- C1 요약이 phase `board`, rank `C`, 명성 0, 현재 골드 10을 표시한다.
- 던전 수량이 C/B/A/S = 6/4/3/2이고 총 15개다.
- 완성 파티 15팀, 예비 6명, 전체 인원 51명이다.
- 초기 board가 5개이며 각 공고의 던전·파티 연결 ID가 존재한다.
- 초기 명성 0에서 필요한 명성이 있는 공고가 잠금 상태로 표시된다.
- 같은 seed의 전체 C1 요약이 deep equal이다.
- 다른 seed가 C1 결과를 바꾼다.
- 기존 R1/R2/R3/R4/F2 snapshot 핵심 값은 이전 테스트와 동일하다.

### 브라우저 검증

`pnpm dev` 실행 후 `http://localhost:3000/integration-test`에서 다음을
확인한다.

- 기본 seed로 C1 패널과 기존 R1~R4/F2 패널이 함께 렌더링된다.
- seed를 바꾸고 `전체 판정 실행`을 누르면 C1 seed와 파티·게시판 결과가
  함께 바뀐다.
- C1 게시판에서 잠긴 공고가 숨겨지지 않고 잠금 문구가 표시된다.
- `/f1-test`와 `/f2-test` 링크가 동작한다.
- 브라우저 콘솔에 오류가 없다.

자동 검증 명령은 다음과 같다.

```bash
pnpm test lib/dev-tools/test-snapshots.test.ts
pnpm typecheck
pnpm lint
pnpm build
```

## 변경 파일 경계

### 수정

- `lib/dev-tools/test-snapshots.ts` — C1 snapshot 계약과 생성 연결
- `lib/dev-tools/test-snapshots.test.ts` — F1/F2 기존 회귀와 C1 통합 검증
- `app/integration-test/integration-test-panel.tsx` — C1 패널과 navigation
- `docs/README.md` — 통합 하네스 spec·plan 링크

### 생성 가능

- 필요하면 `app/integration-test/integration-test-panel.test.tsx` 대신
  기존 프로젝트 테스트 환경에 맞는 순수 snapshot 테스트만 추가한다.

### 변경하지 않음

- `lib/rules/campaign-init.ts`, `lib/rules/board.ts`의 C1 규칙
- 기존 `app/f1-test/page.tsx`, `app/f2-test/page.tsx`의 검증 내용
- `/play` 제품 화면과 C3·C2·E1~E3 규칙

## 완료 기준

1. 기존 통합 하네스의 R1~R4/F2 표시와 테스트가 유지된다.
2. C1 실제 초기 상태가 같은 seed로 통합 snapshot과 웹 화면에 표시된다.
3. C1 던전·파티·예비 인원·자원·게시판 잠금 상태를 화면에서 확인할 수
   있다.
4. seed 변경으로 기존 결과와 C1 결과를 함께 재현·비교할 수 있다.
5. `/f1-test`, `/f2-test` 단독 검증 화면으로 이동할 수 있다.
6. 테스트·타입 검사·lint·build가 통과하고 개발 서버에서 브라우저 검증이
   가능하다.
