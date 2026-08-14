# F1·F2·C1 통합 검증 하네스 설계

> 상태: 사용자 검토 요청
> 작성일: 2026-08-14
> 작성자: SangHwan Yoo
> 작성 도구: Codex

## 목적

현재 `/integration-test`는 이전 요구사항의 R1~R4 규칙과 F2 `RunState`를
확인하는 오래된 하네스다. 새로운 요구사항 기준의 통합 검증 화면은 이전
화면을 유지하거나 섞지 않고, 현재 완료·진행 범위인 F1·F2·C1만 보여줘야
한다.

따라서 `/integration-test` 전용 snapshot과 패널을 F1·F2·C1 검증 화면으로
교체한다. R1~R4 규칙 구현과 별도 `/r3-test` 화면은 다른 소비자이므로
삭제하지 않는다. 이 작업의 결과는 제품 플레이 화면이 아닌 개발용 검증
도구이며 `pnpm dev`로 실행한다.

## 근거와 범위

다음 문서를 기준으로 한다.

1. [게임 원칙](../../GAME_PRINCIPLES.md)
2. [문서 안내](../../README.md)
3. [핵심 게임 루프](../../design/CORE_GAME_LOOP.md)
4. [C1 초기화·게시판 설계](2026-08-14-sanghwan-yoo-c1-campaign-initialization-board-design.md)
5. 기존 F1 `/f1-test`, F2 `/f2-test`, C1 규칙과 통합 라우트 구현

### 포함

- `/integration-test`의 기존 R1~R4·F2 RunState 화면 제거
- F1 fixture/탐험 계약 요약 표시
- F2 콘텐츠 계약 검증 요약 표시
- C1 실제 `initializeCampaign(seed)` 초기 상태와 게시판 표시
- 하나의 seed 입력으로 F1·F2·C1 결과를 함께 재생성
- C1 던전 등급 수량, 파티·예비 인원, 자원, 게시판 잠금 상태 표시
- F1·F2·C1 통합 snapshot의 결정론·핵심 불변식 테스트
- 브라우저에서 확인할 수 있는 `data-testid`와 상태 문구
- `/f1-test`, `/f2-test`, `/r3-test` 단독 검증 화면 링크

### 제외

- R1~R4 규칙 파일 삭제
- `/r3-test` 화면 또는 `createR3HarnessResult` 삭제
- F1·F2 단독 검증 화면의 내용 변경
- F1 fixture를 C1 실제 초기 상태로 대체
- C2 충원·재편, C3 계약·정산·승급·엔딩, E1~E3 탐험 전이
- 공고 클릭에 따른 상태 변경, Zustand store, 실제 플레이 화면 연결
- 저장·복원, 서버·로그인·외부 데이터 연동

이 작업에서 “이전 것을 없앤다”는 의미는 `/integration-test`에 남아 있는
이전 화면과 그 화면 전용 snapshot을 제거한다는 뜻이다. 규칙 구현과
별도 단독 검증 화면까지 지우지 않는다.

## 설계 선택

### 통합 snapshot을 F1·F2·C1 전용으로 재구성한다

새 통합 snapshot은 기존 F2 snapshot의 F1 요약을 재사용하고, F2 콘텐츠
검증과 C1 초기화를 같은 seed로 계산한다.

```ts
interface IntegrationSnapshot {
  seed: string;
  f1: F2Snapshot["f1"];
  f2: {
    contentStatus: F2Snapshot["contentStatus"];
    events: F2Snapshot["events"];
    cards: F2Snapshot["cards"];
    items: F2Snapshot["items"];
    bosses: F2Snapshot["bosses"];
    capacity: F2Snapshot["capacity"];
    negativeCases: F2Snapshot["negativeCases"];
    reproducibility: F2Snapshot["reproducibility"];
  };
  c1: CampaignIntegrationSnapshot;
}

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

`createIntegrationSnapshot(seed)`는 `createF2TestSnapshot(seed)`에서 F1·F2
요약을 읽고 `initializeCampaign(seed)`에서 C1 상태를 만든다. 기존
`createIntegrationSnapshot(options)`의 R1 파티·R2 신뢰·R3 카드·R4 던전·F2
RunState 계약은 제거한다. R3 단독 검증은 `createR3HarnessResult`와
`/r3-test`에서 계속 제공한다.

C1 요약은 UI가 전체 도메인 객체를 직접 다루지 않도록 표시 필드만 새 객체로
복사한다. 게시판의 파티원 이름은 C1 `members`와 `parties`를 ID로 연결해
만든다. `reproducible`는 같은 seed의 C1 요약을 다시 계산해 deep equal인지
확인한다.

### `/integration-test`를 세 섹션으로 교체한다

`app/integration-test/integration-test-panel.tsx`는 다음 세 섹션만 렌더링한다.

1. **F1 · 도메인 계약**
   - campaign seed, phase, rank, 던전·파티 수
   - expedition dungeon/party ID, 지도 지점·경로 수
2. **F2 · 콘텐츠 계약**
   - 검증 상태와 오류
   - 사건·정보 카드·아이템·보스 수량
   - 등급별 사건 용량과 의도적 실패 fixture 통과 여부
   - seed 재현성
3. **C1 · 캠페인 초기화·게시판**
   - seed, phase, rank, 명성, 현재 골드, 누적 골드
   - C/B/A/S 던전 수량과 총 15개
   - 완성 파티 15팀, 예비 인원 6명, 전체 인원 51명
   - 초기 게시판 최대 5개 공고
   - 공고별 던전 등급·지점 수, 파티 ID·파티원 이름, 보상·필요 명성
   - `지원 가능` 또는 `명성 부족` 잠금 상태
   - 같은 seed 재현성

이 화면에는 R1 파티 카드, R2 신뢰 판정, R3 정보 카드 결과, R4 노드 목록,
기존 F2 `RunState` 세션을 렌더링하지 않는다. 잠금 상태는 색상만으로
구분하지 않고 텍스트와 `aria-label`도 제공한다. F1·F2·C1 단독 화면으로
이동할 수 있는 navigation을 제공하며, R3 단독 링크는 `/r3-test`로 둔다.

## 데이터 흐름

```text
seed 입력
  ├─ createF2TestSnapshot(seed)
  │    └─ F1 fixture 요약 + F2 콘텐츠 검증
  └─ initializeCampaign(seed)
       └─ C1 CampaignState + 초기 BoardOffer
                    ↓
          F1·F2·C1 IntegrationSnapshot
                    ↓
          /integration-test 세 섹션
```

UI나 snapshot 모듈에서 `Math.random()`이나 별도 fixture를 만들지 않는다.
C1 게시판은 `initializeCampaign`이 materialize한 초기 board를 표시하며,
렌더링 과정에서 `generateBoard`를 다시 호출하지 않는다.

## 코드 정리 경계

- `lib/dev-tools/test-snapshots.ts`에서 `/integration-test` 전용
  `IntegrationSnapshotOptions`, `IntegrationSnapshot`, `createRunState`,
  `createIntegrationSnapshot`을 제거한다.
- 같은 파일의 `R3HarnessOptions`, `R3HarnessResult`,
  `createR3HarnessResult`는 `/r3-test`가 사용하므로 유지한다.
- `lib/dev-tools/test-snapshots.test.ts`에서는 통합 전용 R1~R4/F2 RunState
  테스트를 제거하고 R3 단독 테스트만 유지한다.
- 새 F1·F2·C1 통합 snapshot은 `app/integration-test`에 두거나 별도
  `lib/dev-tools` 모듈로 두되, 기존 R3 helper와 책임을 섞지 않는다.
- `app/integration-test/page.tsx`의 route는 유지하고 패널 구현만 교체한다.

## 오류와 불변성

- seed 입력이 비어 있으면 기존 form 오류 문구를 표시하고 계산하지 않는다.
- C1 초기화 또는 F2 검증이 오류를 던지면 화면 전체에서 조용히 성공 처리하지
  않고 개발용 오류 상태를 표시한다.
- snapshot 요약은 UI가 수정해도 다음 seed 실행에 영향을 주지 않는 새 배열과
  객체로 만든다.
- F1·F2 단독 페이지와 C1 순수 규칙의 입력·출력 계약은 변경하지 않는다.

## 테스트 설계

### F1·F2·C1 snapshot 단위 테스트

새 통합 snapshot 테스트에서 다음을 확인한다.

- F1 campaign phase/rank와 expedition 핵심 값이 표시된다.
- F2 content status가 `pass`이고 사건·카드·아이템·보스·negative case
  요약이 기존 F2 기준과 일치한다.
- C1 phase `board`, rank `C`, 명성 0, 현재 골드 10이 표시된다.
- C1 던전 수량이 C/B/A/S = 6/4/3/2이고 총 15개다.
- C1 완성 파티 15팀, 예비 6명, 전체 인원 51명이다.
- C1 초기 board가 5개이며 각 공고의 던전·파티 연결 ID가 존재한다.
- 초기 명성 0에서 필요한 명성이 있는 공고가 잠금 상태로 표시된다.
- 같은 seed의 F1·F2·C1 통합 snapshot이 deep equal이다.
- 다른 seed가 C1 결과를 바꾼다.
- 기존 R3 단독 helper 테스트가 그대로 통과한다.

### 브라우저 검증

`pnpm dev` 실행 후 `http://localhost:3000/integration-test`에서 다음을
확인한다.

- 화면에 F1·F2·C1 섹션만 있고 이전 R1~R4 섹션이 없다.
- 기본 seed로 세 섹션의 핵심 값이 표시된다.
- seed를 바꾸고 실행하면 F1·F2·C1 결과가 함께 재생성된다.
- C1 게시판에서 잠긴 공고가 숨겨지지 않고 잠금 문구가 표시된다.
- `/f1-test`, `/f2-test`, `/r3-test` 링크가 동작한다.
- 브라우저 콘솔에 오류가 없다.

자동 검증 명령은 다음과 같다.

```bash
pnpm test lib/dev-tools/test-snapshots.test.ts app/integration-test/integration-test-snapshot.test.ts
pnpm typecheck
pnpm lint
pnpm build
```

## 변경 파일 경계

### 수정

- `lib/dev-tools/test-snapshots.ts` — 기존 integration 전용 R1~R4/F2 helper 제거
- `lib/dev-tools/test-snapshots.test.ts` — 제거한 integration 테스트 정리
- `app/integration-test/integration-test-panel.tsx` — F1·F2·C1 전용 화면으로 교체
- `docs/README.md` — 수정된 spec·plan 링크

### 생성

- `app/integration-test/integration-test-snapshot.ts` — F1·F2·C1 통합 snapshot
- `app/integration-test/integration-test-snapshot.test.ts` — 통합 snapshot 테스트

### 변경하지 않음

- `app/f1-test/page.tsx`, `app/f2-test/page.tsx`, `app/r3-test/*`
- `lib/rules/campaign-init.ts`, `lib/rules/board.ts`
- R1~R4 규칙 파일과 `/play` 제품 화면
- C2·C3·E1~E3 규칙

## 완료 기준

1. `/integration-test`에 이전 R1~R4·F2 RunState 화면이 남아 있지 않다.
2. `/integration-test`에서 F1·F2·C1만 확인할 수 있다.
3. F1 fixture와 F2 콘텐츠 검증 결과가 기존 계약을 유지한다.
4. C1 실제 초기 상태와 게시판 잠금 상태가 같은 seed로 표시된다.
5. seed 변경으로 F1·F2·C1 결과를 함께 재현·비교할 수 있다.
6. `/f1-test`, `/f2-test`, `/r3-test` 단독 검증 화면이 계속 동작한다.
7. 테스트·타입 검사·lint·build가 통과하고 `pnpm dev`에서 브라우저 검증이
   가능하다.
