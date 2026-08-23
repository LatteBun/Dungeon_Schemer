# C8-A 캠페인 정산 통계 설계

- 작성일: 2026-08-23
- 작성자: LatteBun
- 작성 도구: Codex
- 영역: Campaign Rework
- 선행: C7 캠페인 상태 전이

## 1. 결정과 범위

C8은 두 단계로 나눈다.

- **C8-A (이번 작업):** C7이 확정한 `SettlementResult`를 한 번만 소비하여 원정·클리어·전멸·사망·정산 획득 골드와 정산 이력을 누적한다.
- **C8-B (후속 작업):** 조언·반응·적발, 승급·전환점, 원정 연대기를 누적한다. 이는 E2/E3/E4의 진행 기록과 I1의 입력 시점이 확정된 뒤 별도 설계로 다룬다.

이번 C8-A는 통계 집계 계층이며 보상·엔딩·phase 전이·UI를 소유하지 않는다.

```text
C4 settleExpedition
        ↓ SettlementResult
C7 COMPLETE_EXPEDITION
        ↓ CampaignTransitionResult.settlement
C8-A recordSettlementStatistics
        ↓
CampaignState.statistics
```

`CampaignTransitionResult.settlement`이 존재하는 C7 브랜치를 기준으로 구현한다. 따라서 C7 PR이 `main`에 병합된 뒤 시작하거나, C8 브랜치를 C7 위로 rebase한다. C8은 C4를 다시 호출하거나 `SettlementResult`의 보상·위험도·생존 여부를 다시 계산하지 않는다.

## 2. 목표와 비목표

### 목표

- 확정 정산마다 정확히 한 개의 불변 이력과 집계값을 남긴다.
- 클리어와 전멸, 실제 사망자 수, 길잡이가 정산으로 얻은 골드를 설명 가능한 단위로 제공한다.
- 15개 고정 던전의 전역 순서로 최고 클리어 던전을 결정적으로 기록한다.
- C7의 정산 ID 방어와 별개로 C8에서도 같은 정산의 이중 기록을 거부한다.
- I1이 C7 결과와 C8 결과를 조합할 수 있는 순수 API를 제공한다.

### 비목표

- C4 보상·유품·위험도·원인 사슬 계산
- C6 엔딩 판정 및 C7의 `CampaignState.phase` 전이
- `totalGoldSpent` 집계. 현재 지출은 C5 승급에만 있고, E3 상인과 이후 경제 행동의 공통 거래 원장이 없다. 이 값을 지금 넣으면 항상 0이거나 일부 지출만 세는 잘못된 통계가 된다.
- 조언·반응·적발, 승급, 전환점, 연대기 요약. 이들은 C8-B 범위다.
- Zustand Store, 저장·복원, React/U6 어댑터 구현

즉, C8-A는 U6이 당장 표시할 수 있는 정산 누계의 기반이다. 현재 U6 fixture의 `adviceTotal`, `turningPoint`, `chronicleSummary`는 C8-B와 I2 연결 전까지 실제 캠페인 값으로 바꾸지 않는다.

## 3. 소유권과 입력 경계

| 데이터 또는 판단 | 소유 계층 | C8-A의 처리 |
| --- | --- | --- |
| 생존·전멸, 보상, 유품, 위험도, 원인 사슬 | C4 `SettlementResult` | 그대로 보관하거나 읽기만 함 |
| 중복 정산 전이, `settlement` phase | C7 | 변경하지 않음 |
| `CampaignStatistics` 갱신 | C8-A | 새 불변 값으로 반환 |
| C7 결과를 Store에 적용하는 시점 | I1 | C8-A를 정확히 한 번 호출 |
| 조언·반응·전환점·연대기 | C8-B | 이번 범위에서 생성하지 않음 |

`CampaignStatistics`의 기존 `settlements: readonly SettlementResult[]`는 삭제하지 않는다. C4가 만든 상세 결과와 `causeChain`은 향후 C8-B/U6 어댑터가 원본으로 사용할 수 있으므로, C8-A의 요약 이력과 나란히 보존한다. `settlementHistory`는 화면 편의를 위한 재계산본이 아니라 원본 정산을 가리키는 고정 요약이다.

## 4. 데이터 계약

### 4.1 고정 던전 순서

테마별 이름이 각각 `1`부터 `5`까지 반복하므로, 이름의 숫자나 현재 위험도로 `highestDungeonCleared`를 만들 수 없다. C1의 고정 슬롯에 캠페인 전체 순서 `campaignOrder: 1..15`를 추가하고 같은 값을 `CampaignDungeon`에 보존한다.

```ts
type CampaignDungeonOrder =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  | 11 | 12 | 13 | 14 | 15;

interface CampaignDungeon {
  // 기존 필드 …
  readonly campaignOrder: CampaignDungeonOrder;
}
```

`INITIAL_DUNGEON_SLOTS`의 선언 순서가 1~15를 결정하며, 초기화는 이를 변경하지 않고 각 `CampaignDungeon`으로 복사한다. 재도전으로 위험도가 오르거나 실제 선택 순서가 달라져도 `campaignOrder`는 변하지 않는다. 이 작은 C1 계약 확장은 과거 정산 이력의 의미를 안정시키기 위한 것이며, C8-A 외의 게임 규칙을 바꾸지 않는다.

### 4.2 통계와 요약 타입

현재 도메인의 실제 상태값을 그대로 쓴다. 성공/실패라는 새 문자열을 만들지 않고 `ExpeditionStatus`의 `"cleared" | "wiped"`를 사용한다. 파티는 정확히 3명이므로 생존·사망 수의 범위도 `0 | 1 | 2 | 3`이다.

```ts
interface SettlementSummary {
  readonly expeditionId: string;
  readonly dungeonId: DungeonId;
  readonly dungeonOrder: CampaignDungeonOrder;
  readonly status: ExpeditionStatus; // "cleared" | "wiped"
  /** C4 계약 보상과 전멸 유품을 합친, 이 정산에서 길잡이가 얻은 골드. */
  readonly goldEarned: number;
  readonly survivorCount: 0 | 1 | 2 | 3;
  /** before.alive && !after.alive 인 파티원의 수. */
  readonly deathCount: 0 | 1 | 2 | 3;
}

interface CampaignStatistics {
  /** C4 결과 원본. `expeditionId`가 유일하다. */
  readonly settlements: readonly SettlementResult[];
  /** 위 원본과 같은 순서의 C8-A 표시·집계용 요약. */
  readonly settlementHistory: readonly SettlementSummary[];
  readonly totalExpeditions: number;
  readonly clearedExpeditions: number;
  readonly wipedExpeditions: number;
  readonly totalDeaths: number;
  readonly totalGoldEarned: number;
  /** 클리어한 던전 중 가장 큰 고정 캠페인 순서. 아직 없으면 0. */
  readonly highestDungeonCleared: CampaignDungeonOrder | 0;
}
```

`goldEarned`와 `totalGoldEarned`는 `settlement.goldDelta + settlement.relicGold`다. 이는 C4가 정의한 정산으로 길잡이에게 실제 더해진 골드이며, 파티원의 백그라운드 골드나 시작 골드, C5 승급 비용은 포함하지 않는다. C4가 두 값을 이미 확정했으므로 C8-A는 이를 추측하거나 `CampaignState.gold`의 전후 차이를 역산하지 않는다.

`deathCount`는 `3 - survivorCount`로 계산하지 않는다. 각 `SettlementMemberChange`의 `before.alive === true && after.alive === false`만 세어 이미 죽어 있던 상태를 새 사망으로 중복 집계하지 않는다.

초기값은 다음과 같으며 C1 `initializeCampaign`이 한 번 만든다.

```ts
{
  settlements: [],
  settlementHistory: [],
  totalExpeditions: 0,
  clearedExpeditions: 0,
  wipedExpeditions: 0,
  totalDeaths: 0,
  totalGoldEarned: 0,
  highestDungeonCleared: 0,
}
```

## 5. 공개 API와 기록 규칙

```ts
function recordSettlementStatistics(
  statistics: CampaignStatistics,
  settlement: SettlementResult,
  dungeon: Pick<CampaignDungeon, "id" | "campaignOrder">,
): CampaignStatistics;
```

이 함수는 순수 함수다. `CampaignState`를 받거나 `phase`를 바꾸지 않으며, 호출자는 반환값을 `campaign.statistics`에 교체해 넣는다.

입력 검증 규칙은 다음과 같다.

1. `dungeon.id`는 `settlement.dungeonId`와 같아야 한다. 다르면 `RuleError("INVALID_STATE")`로 거부한다.
2. `dungeon.campaignOrder`는 고정 범위 `1..15`여야 한다.
3. `settlements`와 `settlementHistory`는 각각 `expeditionId`가 유일하고, 두 이력의 ID 집합과 순서가 같아야 한다. 각 요약은 같은 원본의 `dungeonId`·상태·생존 수와 일치해야 하며, 기존 카운터·사망·골드·최고 클리어도 이력에서 다시 얻은 값과 같아야 한다. 손상된 기존 통계는 `RuleError("INVALID_STATE")`로 거부한다.
4. 새 `settlement.expeditionId`가 어느 이력에라도 있으면 `RuleError("DUPLICATE_ID")`로 거부한다.

성공하면 새 배열과 새 통계 객체를 반환한다. 기존 배열·객체·`SettlementResult`를 변경하지 않는다.

| `settlement.status` | `totalExpeditions` | 결과 카운터 | `highestDungeonCleared` |
| --- | --- | --- | --- |
| `cleared` | +1 | `clearedExpeditions +1` | 기존 값과 `dungeon.campaignOrder` 중 큰 값 |
| `wiped` | +1 | `wipedExpeditions +1` | 변경 없음 |

두 상태 모두 `totalDeaths += deathCount`, `totalGoldEarned += goldEarned`를 적용하고 원본 및 요약 이력의 끝에 같은 순서로 하나를 추가한다. 통계 불변식은 항상 `totalExpeditions === clearedExpeditions + wipedExpeditions === settlements.length === settlementHistory.length`다.

## 6. C7·I1 결합 시점

C7은 C8-A를 호출하지 않는다. `COMPLETE_EXPEDITION` 후 C7이 반환한 settlement만 I1이 소비한다. Store는 하나의 동기적 갱신 안에서 아래 순서를 지킨다.

```ts
const transition = transitionCampaign(campaign, context, completeAction);

const statistics = transition.settlement === null
  ? transition.campaign.statistics
  : recordSettlementStatistics(
      transition.campaign.statistics,
      transition.settlement,
      findDungeon(transition.campaign.dungeons, transition.settlement.dungeonId),
    );

store({
  campaign: { ...transition.campaign, statistics },
  context: transition.context,
});
```

따라서 기록은 C4/C7 정산 성공 **직후**, `START_WORLD_TURN`보다 **앞서** 정확히 한 번 일어난다. C7의 `settledExpeditionIds`는 C4 재실행을 막고, C8-A의 `expeditionId` 검증은 Store 재시도·잘못된 이중 dispatch가 통계를 두 번 더하는 것을 막는 독립 방어선이다.

E2/E4의 `APPLY_TRUST_BATCH`가 C6의 즉시 `distrust` 엔딩으로 끝나면 C7은 `SettlementResult`를 만들지 않는다. 이 경로는 C4 정산과 C8-A 기록을 모두 건너뛴다. `ended` 재진입이나 C7 검증 실패도 같은 이유로 통계에 아무것도 남기지 않는다.

## 7. C8-B 후속 경계

U6 fixture가 기대하는 조언·반응, 전환점, 연대기는 `SettlementResult`만으로 복원할 수 없다. 특히 조언·반응은 원정 중 E2/E3의 `infoRecords`와 E4의 검증 결과를, 승급 전환점은 C5 결과를, 연대기는 여러 원정·월드턴의 순서 있는 이벤트를 필요로 한다.

C8-B는 I1이 다음과 같은 확정 이벤트를 보존할 수 있게 된 뒤 설계한다.

- E2/E3/E4가 만든 조언 제시·반응·적발의 완료 기록
- C5 승급 결과
- C7/C4의 정산 원인 사슬과 C3 월드턴 경계

C8-B가 이 입력 계약을 정하기 전에는 U6의 fixture 모양에 맞추려고 C8-A에 임의의 0값·문장·추측 데이터를 넣지 않는다. 이 분리는 C8-A가 순수 정산 집계라는 작은 책임을 유지하고, 향후 원정 telemetry가 생길 때 C7의 세션 컨텍스트나 C4의 정산 책임을 불필요하게 확장하지 않기 위한 것이다.

## 8. 구현 검증 항목

- 초기화가 전체 통계 기본값과 던전 `campaignOrder: 1..15`를 결정적으로 만든다.
- `cleared` 정산은 원본·요약 이력, 클리어 수, 총 원정 수, 최고 클리어를 갱신한다.
- `wiped` 정산은 전멸 수와 유품을 포함한 `goldEarned`를 갱신하고 최고 클리어는 바꾸지 않는다.
- 3/2/1/0 생존의 실제 파티 크기와 `before.alive → after.alive` 사망 판정을 검증한다. 4인 파티 또는 `success/failure` fixture를 만들지 않는다.
- 같은 `expeditionId`의 두 번째 기록은 `DUPLICATE_ID`이고, 입력 통계는 변하지 않는다.
- 던전 ID 불일치, 범위를 벗어난 순서, 서로 어긋난 원본/요약 이력 또는 이력과 맞지 않는 기존 합계는 `INVALID_STATE`다.
- C7 `COMPLETE_EXPEDITION` 결과와 C8-A를 조합하면 `phase: "settlement"`를 유지하고 통계만 갱신한다. 즉시 `distrust` 결과에는 통계 항목이 생기지 않는다.
- C7은 여전히 `CampaignStatistics`를 직접 append하지 않는다.

## 9. 밸런스 확인 메모

`goldEarned`, 전멸 비율, 사망 수, 클리어 순서는 B1에서 생존 전략과 배신 전략의 경제·인력 손실이 균형을 이루는지 확인하는 관측값으로 사용한다. C8-A는 이를 측정할 뿐 보상 상수나 확률을 조정하지 않는다. B1에서 특정 전략이 압도적이면 C4/C5/E2 등의 규칙 상수를 조정하고, 통계 집계 정의를 전략에 맞춰 바꾸지 않는다.
