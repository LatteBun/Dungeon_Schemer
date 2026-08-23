# C7 캠페인 상태 전이 설계

- 작성일: 2026-08-23
- 작성자: LatteBun
- 작성 도구: Codex
- 영역: Campaign Rework

## 1. Overview

C7은 Campaign Rework의 순수 캠페인 전이 계층이다. C2~C6이 각각 만든
공고·원정 결과·월드턴 결과·승급 결과·엔딩 결과를 한 번씩 소비해
`CampaignState.phase`와 다음 진행 상태를 바꾼다.

핵심 원칙은 다음과 같다.

> `CampaignState.phase`를 바꾸는 공개 함수는 C7뿐이다.

C7은 보상·신뢰·엔딩 조건을 직접 계산하지 않는다. 해당 규칙 함수를 호출하고
반환값을 전이 계약에 맞춰 적용할 뿐이다.

## 2. Prerequisites and Scope

이 설계는 다음 C6 공개 계약이 존재하는 브랜치에서 구현한다.

```ts
evaluateImmediateDistrustEnding(campaign, partyMembers): CampaignEnding | null;
evaluateCampaignEnding(campaign): CampaignEnding | null;
```

따라서 C7 구현 브랜치는 C6 PR이 `main`에 병합된 뒤 시작하거나 C6 브랜치를
기반으로 만든다. C7이 C6의 제목·사유·trigger ID·조건을 다시 구현하지 않는다.

### C7 responsibilities

- `intro`, `board`, `contract`, `expedition`, `settlement`, `promotion`,
  `worldTurn`, `ended`의 허용 전이 검증
- 현재 계약과 활성 원정의 임시 컨텍스트 보관·검증
- C2/C3/C4/C5/C6 순수 결과의 한 번 적용
- 즉시 `distrust`와 C3 뒤 정상 엔딩의 서로 다른 진입 시점 보장
- 중복 정산 ID 및 ended 뒤 게임 진행 재진입 거부
- 다음 게시판 공고 생성 시점 보장

### Non-goals

- C6 엔딩 조건·신뢰 확률 계산
- E2/E4 조언·전투·보스 결과 계산
- C4 보상·유품·위험도 계산
- C3의 휴식·백그라운드 배정 계산
- C8 통계·연대기·전환점 기록 계산
- Zustand Store, React 화면, 저장·복원, Supabase·서버 동기화

## 3. State Ownership

### 3.1 Persistent campaign state

`CampaignState`는 캠페인에 남아야 하는 값만 가진다. `phase`, `offers`, `pool`,
`dungeons`, `ending`, `settledExpeditionIds`, C8 통계가 이에 속한다.

활성 파티나 선택 중인 공고를 `CampaignState`에 새 필드로 넣지 않는다.
`ExpeditionParty`는 한 원정짜리 편성이며, 원정이 끝나면 폐기한다는 풀 계약을
유지한다.

### 3.2 Ephemeral transition context

I1 Store가 아래 컨텍스트를 캠페인 상태와 함께 한 세션 동안만 보관한다. 저장·복원
대상이 아니며, 새 캠페인을 시작하면 모두 `null`이다.

```ts
interface ActiveExpeditionContext {
  readonly expeditionId: string;
  readonly offer: BoardOffer;
  readonly expedition: ExpeditionState;
  /** E2/E4 신뢰 변화 묶음 뒤의 최신 파티 상태. */
  readonly partyMembers: readonly Character[];
}

interface CampaignTransitionContext {
  readonly selectedOffer: BoardOffer | null;
  readonly activeExpedition: ActiveExpeditionContext | null;
}
```

`partyMembers`가 즉시 불신 판정의 source of truth다. 활성 원정 중에는 E2/E4의
결과가 캠페인 풀보다 먼저 이 배열에 반영될 수 있다. C7은 이를 캠페인 풀에
적용하기 전에 다음을 검증한다.

- 활성 원정의 `offer.party.memberIds`는 서로 다른 정확히 3명이다.
- `partyMembers`도 서로 다른 정확히 3명이며 ID 집합이 계약 파티와 같다.
- 각 멤버의 고정 ID·직업·최대 HP는 캠페인 풀의 같은 멤버와 일치한다.
- 최신 HP·alive·trust·gold 값은 E2/E4가 만든 유효한 최종 상태여야 한다.

검증 실패는 `RuleError("INVALID_TRANSITION")`이며, 캠페인과 컨텍스트를
변경하지 않는다. C7은 중복·누락·오래된 파티 데이터를 추측하거나 보정하지
않는다.

## 4. Campaign Phase and Transition Table

현재 도메인의 8개 phase를 그대로 사용한다.

```ts
type CampaignPhase =
  | "intro"
  | "board"
  | "contract"
  | "expedition"
  | "settlement"
  | "promotion"
  | "worldTurn"
  | "ended";
```

| Action | From | To | C7 effect |
| --- | --- | --- | --- |
| `OPEN_BOARD` | `intro` | `board` | C2로 첫 공고를 생성하고 `offers`에 기록 |
| `SELECT_CONTRACT` | `board` | `contract` | 잠기지 않은 현재 공고 하나를 `selectedOffer`로 보관 |
| `CANCEL_CONTRACT` | `contract` | `board` | `selectedOffer`를 비움 |
| `START_EXPEDITION` | `contract` | `expedition` | 선택 공고와 일치하는 활성 원정을 보관 |
| `COMPLETE_EXPEDITION` | `expedition` | `settlement` | C4 정산을 한 번 적용하고 `settledExpeditionIds`만 기록 |
| `START_WORLD_TURN` | `settlement` | `worldTurn` | 정산 결과를 변경하지 않고 C3 입력 준비 |
| `COMPLETE_WORLD_TURN` | `worldTurn` | `board` 또는 `ended` | C3 실행, 다음 공고 생성, C6 정상 엔딩 판정 |
| `OPEN_PROMOTION` | `board` | `promotion` | C5 승급 가능 여부를 검증 |
| `CANCEL_PROMOTION` | `promotion` | `board` | 승급 화면만 닫음 |
| `PROMOTE_GUIDE` | `promotion` | `board` | C5 승급 결과 적용 후 현재 턴 공고를 재생성 |
| `APPLY_TRUST_BATCH` | `expedition` | `expedition` 또는 `ended` | 최신 파티를 적용하고 C6 즉시 불신을 판정 |

`ended`에서는 게임 진행 action을 하나도 허용하지 않는다. 결과·기록 조회는 UI의
읽기 동작이며 C7 action이 아니다.

## 5. Public Contract

문자열만 받는 전이는 payload가 없어 계약·정산·엔딩을 안전하게 적용할 수 없다.
C7은 discriminated union을 사용한다.

```ts
type CampaignTransition =
  | { readonly type: "OPEN_BOARD" }
  | { readonly type: "SELECT_CONTRACT"; readonly offerId: OfferId }
  | { readonly type: "CANCEL_CONTRACT" }
  | {
      readonly type: "START_EXPEDITION";
      readonly expeditionId: string;
      readonly expedition: ExpeditionState;
      readonly partyMembers: readonly Character[];
    }
  | { readonly type: "COMPLETE_EXPEDITION"; readonly snapshot: SettlementSnapshot }
  | { readonly type: "START_WORLD_TURN" }
  | { readonly type: "COMPLETE_WORLD_TURN" }
  | { readonly type: "OPEN_PROMOTION" }
  | { readonly type: "CANCEL_PROMOTION" }
  | { readonly type: "PROMOTE_GUIDE"; readonly method: PromotionMethod }
  | {
      readonly type: "APPLY_TRUST_BATCH";
      readonly partyMembers: readonly Character[];
    };

interface CampaignTransitionResult {
  readonly campaign: CampaignState;
  readonly context: CampaignTransitionContext;
  readonly settlement: SettlementResult | null;
  readonly worldTurn: WorldTurnResult | null;
  readonly promotion: PromotionResult | null;
  readonly ending: CampaignEnding | null;
}

function transitionCampaign(
  campaign: CampaignState,
  context: CampaignTransitionContext,
  action: CampaignTransition,
): CampaignTransitionResult;
```

`transitionCampaign`은 입력을 변경하지 않는 순수 함수다. 허용되지 않은 phase,
없는 공고, 잠긴 공고, 계약과 다른 원정·정산 파티, 중복 원정 ID, ended 상태의
진행 action은 모두 `RuleError("INVALID_TRANSITION")`으로 거부한다. 따라서
`changed: false`와 임의 `reason` 반환은 사용하지 않는다. 기존 규칙 계층의
잘못된 상태·중복 정산 거부 패턴과 같다.

## 6. Integration Rules

### 6.1 Board, contract, and expedition

`OPEN_BOARD`와 `COMPLETE_WORLD_TURN`에서만 C2 `createBoardOffers`를 호출한다.
생성한 공고는 해당 `worldTurn`의 `offers`로 기록한다. `SELECT_CONTRACT`는
현재 `offers`에 존재하고 `lockReason === null`인 공고만 선택할 수 있다.

`START_EXPEDITION`은 `selectedOffer`가 있을 때만 허용한다. 입력 `expedition`의
`dungeonId`, `riskLevel`, `party.memberIds`는 선택 공고의 `dungeonId`,
`riskLevel`, `party.memberIds`와 정확히 같아야 한다. 성공하면
`selectedOffer`는 비우고 `activeExpedition`을 기록한다.

### 6.2 Settlement and C8 boundary

`COMPLETE_EXPEDITION`은 `activeExpedition.expeditionId`와 같은 snapshot만 받고,
그 파티·던전·계약 위험도를 활성 원정과 대조한 뒤 C4 `settleExpedition`을 한 번
호출한다. 그 결과 캠페인에는 C4가 만든 pool·dungeon·경제 변화와
`phase: "settlement"`, `settledExpeditionIds`만 적용한다.

C7은 `SettlementResult`를 `CampaignTransitionResult.settlement`으로 반환하지만
`CampaignState.statistics`에는 기록하지 않는다. C8은 이 반환값을 재계산 없이
소비해 통계·연대기·전환점을 기록한다. 현재의
`settleCampaignExpedition`은 C7 구현에서 흡수하고, 그 안의 통계 append는 C8
경계로 옮긴다. 같은 settlement를 C7과 C8이 각각 기록하지 않는다.

### 6.3 World turn and normal ending

`START_WORLD_TURN`은 `settlement → worldTurn` phase 전이만 한다.

`COMPLETE_WORLD_TURN`은 활성 원정의 계약 파티와 아래처럼 campaign seed·현재
worldTurn에서 파생한 RNG로 C3 `runWorldTurn`을 한 번 호출한다. 호출자는 RNG를
주입하지 않는다.

```ts
const worldturnRng = createRng(`${campaign.seed}/${campaign.worldTurn}`).derive("worldTurn");
```

C3 결과의
pool과 증가한 worldTurn을 캠페인에 적용하고, 이어서 C2로 다음 공고를 생성해
`offers`에 적용한다. **그 다음** C6
`evaluateCampaignEnding`을 한 번 호출한다.

이 순서는 `unemployed`가 이전 턴의 공고가 아니라 새 턴의 공고를 읽게 한다.
결과가 있으면 C7은 `phase: "ended"`와 `ending`을 같은 새 CampaignState에 함께
기록하고, 없으면 `phase: "board"`로 전환한다. 성공한 뒤
`activeExpedition`은 `null`로 비운다.

### 6.4 Promotion

C5의 등급·비용·가능 여부 계산은 계속 C5가 소유한다. 다만 C5의 현재
`openGuidePromotion`, `cancelGuidePromotion`, `promoteGuide`는 phase를 직접
바꾸므로 C7 구현 시 phase-free C5 계산/실행 API로 분리한다.

- `OPEN_PROMOTION`은 C5의 승급 가능 여부를 검증한 뒤 `promotion`으로 전이한다.
- `CANCEL_PROMOTION`은 `board`로 돌아가며 경제·등급·공고를 바꾸지 않는다.
- `PROMOTE_GUIDE`는 C5가 만든 rank·gold 결과를 적용한 뒤 C2로 현재 worldTurn의
  공고를 새로 만들고 `board`로 전이한다.

### 6.5 Immediate distrust and ended state

E2의 조언 결과 또는 E4의 보스 정보 검증에서 나온 신뢰 변화 묶음이 모두
적용된 직후, 호출자는 `APPLY_TRUST_BATCH`에 최신 `partyMembers`를 전달한다.
C7은 3.2의 계약 파티 검증을 통과한 최신 멤버를 `activeExpedition.partyMembers`와
캠페인 풀에 함께 반영하고, C6 `evaluateImmediateDistrustEnding`을 한 번 호출한다.

반환값이 `null`이면 C7은 `expedition` phase를 유지한다. 결과가 `distrust`면
C7은 그 `CampaignEnding`과 `phase: "ended"`를 같은 새 CampaignState에 원자적으로
기록한다. 따라서 신뢰 변화 묶음이 반영됐지만 즉시 엔딩이 아닌 경우도 버려지지
않는다. ended 결과에서는 C4 정산, C3 월드턴, C8 settlement 통계, 보상·유품·위험도·던전
클리어·승급 가능 여부 계산을 호출하지 않는다.

`ended` 전이는 이미 CampaignState에 있는 pool, dungeons, offers, 누적 골드,
settled expedition IDs, C8 통계를 삭제하거나 초기화하지 않는다. C7은 별도의
캠페인 history나 마지막 원정 기록을 만들지 않으며, 그 장기 기록 계약은 C8이
정의한다. ended 뒤 두 번째 엔딩 적용도 진행 action으로 거부한다.

## 7. Reuse and Migration Boundaries

- 재사용: C1 `initializeCampaign`, C2 `createBoardOffers`, C3 `runWorldTurn`,
  C4 `settleExpedition`, C5 승급 계산, C6 두 엔딩 evaluator, 기존 `RuleError`.
- 흡수: `lib/rules/campaign-transition.ts`의 `settleCampaignExpedition`은 C7의
  `COMPLETE_EXPEDITION`으로 대체한다. C4 정산을 두 번 감싸는 새 래퍼를 만들지
  않는다.
- 이관: C5의 phase 변경은 C7으로, C4 전이 래퍼의 statistics append는 C8로
  옮긴다. C4/C5/C6 계산 규칙은 이동하지 않는다.
- 제외: C7은 Zustand Store나 U3/U5/U6을 수정하지 않는다. I1이
  `CampaignTransitionContext`와 결과 객체를 Store에 연결하고, I2가 화면을
  연결한다.

## 8. Required Tests

`lib/rules/campaign-transition.test.ts`를 C7의 전이표 테스트로 확장한다.

1. `intro → board`에서 C2 공고가 현재 seed/worldTurn으로 생성되고 입력은 불변이다.
2. 잠긴·없는 공고 선택, contract 밖 원정 시작, contract와 다른 dungeon/risk/party는
   `INVALID_TRANSITION`이다.
3. 정상 `board → contract → expedition → settlement → worldTurn → board`에서
   C4와 C3가 각각 한 번만 적용되고 다음 공고가 새 worldTurn 기준으로 생성된다.
4. 같은 `expeditionId`의 두 번째 정산은 C4 호출 전에 거부된다.
5. 정산 snapshot의 party·dungeon·risk가 활성 원정과 다르면 거부되고 campaign과
   context가 변하지 않는다.
6. 월드턴 뒤 `denounced → completed → exhausted → unemployed` 순서의 C6 결과는
   `ended`에 그대로 기록되고, 엔딩이 없을 때만 `board`로 돌아간다.
7. `unemployed` fixture는 월드턴 뒤 새로 만든 offers가 모두 `rankTooLow`일 때만
   성립함을 확인한다.
8. 최신 활성 파티의 ID 중복·계약 불일치·고정 값 불일치는 `APPLY_TRUST_BATCH`의
   C6 판정 전에 거부한다. 유효하지만 전원 trust-0이 아닌 파티는 pool·context를
   갱신하고 expedition을 유지하며, 전원 trust-0 생존 파티는 pool 반영과
   `distrust` ended 기록을 한 결과로 만든다.
9. 즉시 불신 경로는 C4 결과, worldTurn 증가, statistics settlement, dungeon clear,
   risk/economy/offer 변경을 만들지 않는다.
10. promotion 열기·취소·등급 승급은 C5 계산을 재사용하며 phase 변경은 C7 결과에만
    나타난다.
11. 모든 ended phase 진행 action과 두 번째 엔딩 적용은 `INVALID_TRANSITION`이고
    캠페인·컨텍스트·기존 ending을 보존한다.
12. 모든 성공·실패 전이는 `structuredClone` 전후 입력 campaign/context/action을
    변경하지 않는다.

## Decision Summary

| 항목 | 결정 |
| --- | --- |
| phase 변경 | C7 `transitionCampaign` 전용 |
| 활성 원정 | 저장하지 않는 `CampaignTransitionContext`가 소유 |
| 무효 전이 | `RuleError("INVALID_TRANSITION")`으로 거부 |
| 정상 엔딩 | C3 완료 → 새 공고 생성 → C6 평가 뒤 적용 |
| 즉시 불신 | `APPLY_TRUST_BATCH`에서 최신 파티 검증·pool 반영·C6 결과 적용을 원자 처리 |
| 정산 | C4를 한 번 호출하고 중복 ID는 C7이 차단 |
| 통계 | C7 결과를 C8이 소비하며 C7은 재계산·append하지 않음 |
| 승급 | C5 계산은 유지, phase 전이는 C7으로 이관 |
| ended | 기존 CampaignState 데이터를 보존하고 게임 진행 재진입을 거부 |
| Store/UI/저장 | I1/I2와 별도 지속성 설계의 책임 |
