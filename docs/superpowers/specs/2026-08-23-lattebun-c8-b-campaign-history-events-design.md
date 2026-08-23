# C8-B 캠페인 이력 이벤트 설계

- 작성일: 2026-08-23
- 작성자: LatteBun
- 작성 도구: Codex
- 영역: Campaign Rework
- 선행: C8-A 캠페인 정산 통계, C7 캠페인 상태 전이

## 1. 결정과 범위

C8-B는 C8-A의 정산 통계와 별개로, 게임에서 이미 확정된 사실을 순서 있는
캠페인 이력으로 보관한다. 이력은 Chronicle, U6 엔딩 어댑터, B1 밸런스 측정이
공유하는 입력이며, 게임 결과를 계산하거나 바꾸지 않는다.

```text
E2/E4/C4/C5/C7의 확정 결과
             ↓ (I1이 성공한 적용 뒤 사실로 변환)
      CampaignEventDraft
             ↓ C8-B appendCampaignEvent
      CampaignHistory
       ├─ events
       └─ turningPoints (events에서 결정적으로 파생)
             ↓
        I2 Chronicle · U6 어댑터 · B1 telemetry
```

`E3`는 사건을 물질화하고 E2의 조언 입력을 공급하지만, C8-B가 기록하는 조언
결과는 E2의 `AdviceDecision`이다. 일반 몬스터 전투는 이번 이력의 독립 이벤트로
넣지 않는다. 보스전은 E4 `BossResult`, 사망은 C4 `SettlementResult`에서만
기록한다. 이 선택으로 같은 사망·승패를 E3/E4/C4가 중복 기록하지 않는다.

### 목표

- 조언의 실행 여부와 실제 개인 반응, 보스 결과, 정산 사망, 승급, 신뢰 붕괴,
  엔딩을 타입 안전하고 결정적인 순서로 보관한다.
- C8-A의 집계값·정산 원본과 중복되는 카운터나 보상 계산을 넣지 않는다.
- 같은 시드와 같은 사용자 선택을 재실행하면 같은 이력 ID·순서·전환점을 만든다.
- I1이 성공한 상태 전이와 이력 기록을 하나의 Store 갱신에서 조합할 수 있게 한다.

### 비목표

C8-B는 다음을 하지 않는다.

- 조언 반응, 보스전, 정산 보상, 신뢰, 엔딩을 판정하거나 다시 계산하지 않는다.
- C7 `phase`, 풀, 던전, `CampaignTransitionContext`를 변경하거나 확장하지 않는다.
- Chronicle 문장·U6 ViewModel·React UI를 렌더링하지 않는다.
- Zustand, 브라우저 저장, 서버 저장·복원을 구현하지 않는다. I1이 영속 시점을
  소유한다.
- 일반 몬스터 전투의 상세 턴 로그, 모든 UI 표시 문구, 골드 지출 총계를 별도
  telemetry로 만들지 않는다.

## 2. 상태 소유권과 저장 위치

`CampaignHistory`는 `CampaignStatistics`와 독립된 필드지만, 둘 다 캠페인을
복원하는 persistent 상태다. C8-B 구현 때 `CampaignState`에 아래 필드를 추가하고,
C1 초기화가 빈값을 한 번 만든다.

```ts
interface CampaignState {
  // 기존 필드 …
  readonly statistics: CampaignStatistics; // C8-A
  readonly history: CampaignHistory;       // C8-B
}

interface CampaignHistory {
  /** 이력의 유일한 source of truth다. */
  readonly events: readonly CampaignEvent[];
  /** events에서 reducer가 재생성하는 cache다. 외부 입력으로 직접 수정하지 않는다. */
  readonly turningPoints: readonly TurningPoint[];
}

function createCampaignHistory(): CampaignHistory;
```

초기값은 `{ events: [], turningPoints: [] }`다. `CampaignTransitionContext`는 활성
원정 같은 세션 전용 상태만 유지하며 이력을 넣지 않는다. 이력은 gameplay state를
판정하는 입력이 아니지만, 저장·복원과 같은 시드 재현에 필요한 캠페인 기록이므로
`CampaignState`와 함께 I1이 보관한다.

| 데이터 또는 판단 | 소유 계층 | C8-B의 처리 |
| --- | --- | --- |
| 조언 유형·개인 반응·실행 여부 | E2 `AdviceDecision` | 확정 결과를 한 개의 조언 이벤트로 보관 |
| 사건 ID와 보스 정보 사건 여부 | E3 `SituationEvent` | E2 결과의 source ID로만 보관 |
| 보스 승패·생존자·검증 | E4 `BossResult` | 결과 요약을 보관 |
| 새 사망·정산 상태 | C4 `SettlementResult` | 새 사망 ID와 정산 참조를 보관, 수치 재집계 금지 |
| 승급 성공·비용 결과 | C5 `PromotionResult` | 성공 결과만 보관 |
| 즉시 불신·정상 4종 엔딩 | C6 판정, C7 적용 | C7 성공 결과를 한 번 보관 |
| 이력 append·무결성·전환점 파생 | C8-B | 새 불변 `CampaignHistory` 반환 |
| 이력과 전이 결과의 원자적 Store 적용 | I1 | C8-B API를 성공 뒤 호출 |
| 문장화·표시용 단일 전환점 선택 | I2/U6 어댑터 | 이력을 소비만 함 |

## 3. 결정적 식별자와 순서

벽시계 시간(`Date.now()` 등)을 기록하지 않는다. `createdAt` 필드도 두지 않는다.
시간은 게임 내 논리 순서인 `campaignTurn`과 `sequence`로만 표현한다.

```ts
type CampaignEventId = Brand<string, "CampaignEventId">;
type CampaignEventSourceKey = Brand<string, "CampaignEventSourceKey">;

interface CampaignEventIdentity {
  /** `campaign:${campaignTurn}:event:${sequence}`. append가 만든다. */
  readonly id: CampaignEventId;
  /** 성공한 전이 뒤 CampaignState.worldTurn 값. 0부터 시작한다. */
  readonly campaignTurn: number;
  /** history.events 전체에서 0부터 증가하는 빈틈 없는 순번. */
  readonly sequence: number;
}

interface CampaignEventSource {
  /** 원천 사실을 캠페인 안에서 한 번만 기록하게 하는 안정적인 key. */
  readonly sourceKey: CampaignEventSourceKey;
}
```

`appendCampaignEvent`는 기존 `events.length`를 새 `sequence`로 사용하고 위 형식의
ID를 만든다. 따라서 같은 캠페인·같은 전이·같은 이벤트 배출 순서에서는 재실행해도
ID가 같다. append 실패·C7 전이 실패·종료 캠페인 재진입은 순번을 소비하지 않는다.
`campaignTurn`은 이벤트를 낳은 **성공한 C7 전이 후**의 `campaign.worldTurn`이다.
E2/E4 결과처럼 전이 전 원정 안에서 완료된 사실은, 해당 결과를 I1이 성공적으로
적용한 시점의 현재 `campaign.worldTurn`을 쓴다.

## 4. 이벤트 타입 계약

이벤트는 공통 `actors: string[]`이나 임의 `payload`를 쓰지 않는다. 각 variant가
필요한 branded ID와 사실만 가진다. 배열은 모두 읽기 전용이며, 캐릭터 ID 배열은
중복을 허용하지 않는다.

```ts
type CampaignEvent =
  | AdviceResolvedEvent
  | BossBattleResolvedEvent
  | ExpeditionSettledEvent
  | GuidePromotedEvent
  | TrustCollapsedEvent
  | CampaignEndedEvent;

interface AdviceResolvedEvent extends CampaignEventIdentity, CampaignEventSource {
  readonly type: "ADVICE_RESOLVED";
  readonly expeditionId: string;
  readonly dungeonId: DungeonId;
  readonly sourceEventId: EventId;
  readonly adviceId: ChoiceId;
  readonly outcome: AdviceOutcome;
  readonly executed: boolean;
  readonly reactions: readonly MemberReaction[];
}

interface BossBattleResolvedEvent extends CampaignEventIdentity, CampaignEventSource {
  readonly type: "BOSS_BATTLE_RESOLVED";
  readonly expeditionId: string;
  readonly dungeonId: DungeonId;
  readonly bossId: BossId;
  readonly status: ExpeditionStatus;
  readonly survivorIds: readonly CharacterId[];
  readonly verificationCount: number;
}

interface ExpeditionSettledEvent extends CampaignEventIdentity, CampaignEventSource {
  readonly type: "EXPEDITION_SETTLED";
  readonly expeditionId: string;
  readonly dungeonId: DungeonId;
  readonly status: ExpeditionStatus;
  /** C4 SettlementResult의 before.alive && !after.alive만 옮긴다. */
  readonly deceasedCharacterIds: readonly CharacterId[];
}

interface GuidePromotedEvent extends CampaignEventIdentity, CampaignEventSource {
  readonly type: "GUIDE_PROMOTED";
  readonly fromRank: GuideRank;
  readonly toRank: GuideRank;
  readonly method: PromotionMethod;
}

interface TrustCollapsedEvent extends CampaignEventIdentity, CampaignEventSource {
  readonly type: "TRUST_COLLAPSED";
  readonly expeditionId: string;
  /** C6/C7의 distrust 엔딩 triggerCharacterIds와 정확히 같다. */
  readonly triggerCharacterIds: readonly CharacterId[];
}

interface CampaignEndedEvent extends CampaignEventIdentity, CampaignEventSource {
  readonly type: "CAMPAIGN_ENDED";
  readonly ending: CampaignEnding;
}
```

`ADVICE_REJECTED`는 만들지 않는다. 기존 반응 모델에는 `accepted | suspected |
exposed`만 있고, 전원 미수용은 `executed: false`로 이미 표현된다. 따라서 한
`ADVICE_RESOLVED` 이벤트가 E2의 원본 반응 배열을 그대로 가진다. `exposed` 역시
누락 없이 보관한다.

`EXPEDITION_SETTLED`는 C8-A의 `SettlementResult` 원본을 복제하지 않는다. 정산
ID·상태와 새 사망 ID만 둔다. 총 사망·보상·생존 수·원인 사슬은 여전히
`CampaignStatistics.settlements`의 C4 원본이 유일한 기준이다.

이벤트를 append 전 만들기 위한 입력은 identity 없는 동일한 discriminated union
`CampaignEventDraft`다. 아래 조건부 타입은 union 각 variant의 discriminator와
payload를 유지하면서 `id`·`campaignTurn`·`sequence`만 뺀다. source adapter는 오직
이미 확정된 결과에서 draft를 만들며, C8-B는 draft의 결과를 추론하지 않는다.

```ts
type WithoutCampaignEventIdentity<T extends CampaignEvent> =
  T extends CampaignEventIdentity
    ? Omit<T, keyof CampaignEventIdentity>
    : never;

type CampaignEventDraft = WithoutCampaignEventIdentity<CampaignEvent>;

function appendCampaignEvent(
  history: CampaignHistory,
  input: { readonly campaignTurn: number; readonly event: CampaignEventDraft },
): CampaignHistory;
```

## 5. append·cache와 무결성 규칙

`appendCampaignEvent`와 `deriveTurningPoints`는 순수 함수다. `CampaignState`,
`CampaignStatistics`, 원본 결과 객체, 입력 `CampaignHistory`를 변경하지 않고 새
history를 반환한다. C8-A의 `recordSettlementStatistics`와 같은 방식으로 기존
이력의 무결성을 먼저 검증한다.

```ts
function deriveTurningPoints(events: readonly CampaignEvent[]): readonly TurningPoint[];
function assertCampaignHistoryIntegrity(history: CampaignHistory): void;
```

`events`만 source of truth다. append는 유효한 기존 `events`에서
`deriveTurningPoints(events)`를 재계산해 기존 `turningPoints`와 일치하는지 검사하고,
새 이벤트를 붙인 뒤 다시 계산한 결과를 cache로 넣는다. 저장 데이터를 I1이 load할
때도 같은 무결성 검사를 수행한다. events와 cache가 다르면 조용히 고치지 않고
`RuleError("INVALID_STATE")`로 거부한다. 이 규칙은 손상된 저장본이 Chronicle이나
U6에 서로 다른 전환점을 보이는 일을 막는다.

- 모든 기존 이벤트의 `sequence`는 배열 index와 같고, `id`는 정해진 문자열과
  같아야 한다. `sourceKey`도 이력 전체에서 유일해야 한다. 손상된 기존 이력은
  `RuleError("INVALID_STATE")`다.
- 새 `campaignTurn`은 음수가 아닌 안전한 정수여야 하며, 마지막 이벤트보다
  작을 수 없다.
- `ADVICE_RESOLVED.reactions`의 캐릭터 ID는 유일해야 한다. `executed`는 하나
  이상의 `accepted` 반응이 있을 때만 `true`다.
- `EXPEDITION_SETTLED.deceasedCharacterIds`, 보스 생존자, 신뢰 붕괴 trigger ID는
  각각 유일해야 한다. `verificationCount`는 음수가 아닌 안전한 정수다.
- `GUIDE_PROMOTED`는 실제로 한 단계 상승한 `PromotionResult`만 source adapter가
  전달한다. `CampaignEndedEvent.ending`과 `TrustCollapsedEvent.triggerCharacterIds`는
  C6/C7 반환값을 변형하지 않고 쓴다.
- 검사할 수 없는 원천 진실성(예: bossId가 해당 던전에 속하는지)은 E2/E4/C4/C5/C7의
  기존 검증이 소유한다. C8-B가 게임 규칙을 재검증하지 않는다.

새 draft의 `sourceKey`가 기존 이력에 있으면 `RuleError("DUPLICATE_ID")`로 거부하고
입력을 바꾸지 않는다. TypeScript의 union은 컴파일 시 잘못된 variant를 막고, 위
런타임 검증은 복원 데이터나 우회 호출의 잘못된 payload를 막는다.

## 6. 정확히 한 번 기록하는 통합·원자성 경계

C8-B는 source rule이 실행됐다는 사실만으로 기록하지 않는다. I1은 source 결과를
`CampaignTransition`에 성공적으로 적용한 뒤, 같은 동기 Store 갱신에서 draft를
append한다. 전이가 예외를 던지거나 C7이 거부하면 draft를 버린다.

C7과 C8 reducer는 모두 외부 상태를 바꾸지 않는 순수 함수이므로 rollback action을
따로 만들지 않는다. I1은 아래 순서를 지킨다.

1. 현재 Store 값을 읽고 `transitionCampaign`의 반환값을 지역 변수로 얻는다.
2. 필요한 C8-A 통계와 C8-B history를 모두 지역 변수로 계산한다.
3. 전이·통계·이력 계산이 모두 성공했을 때만 `campaign`, `context`를 한 번의
   `store(...)` 호출로 교체한다.

어느 단계에서든 예외가 나면 `store(...)`를 호출하지 않는다. 따라서 C7 전이만,
history만, statistics만 반영된 부분 상태는 생기지 않는다. `COMPLETE_EXPEDITION`은
아래 예시처럼 C8-A와 C8-B를 함께 계산하고, 조언·보스·승급·엔딩 흐름도 같은
원칙으로 history draft를 조합한다.

| 성공한 I1 흐름 | source fact | append 순서 | 기록하지 않는 경우 |
| --- | --- | --- | --- |
| E2 조언 반응·신뢰 적용 | `AdviceDecision`과 E3 `SituationEvent.id` | `ADVICE_RESOLVED`, 즉시 불신이면 `TRUST_COLLAPSED`, `CAMPAIGN_ENDED` | 조언 선택/신뢰 batch/C7 적용 실패 |
| E4 보스전·신뢰 적용 | `BossResult` | `BOSS_BATTLE_RESOLVED`, 즉시 불신이면 `TRUST_COLLAPSED`, `CAMPAIGN_ENDED` | 보스 결과 또는 C7 적용 실패 |
| C7 `COMPLETE_EXPEDITION` | C4 `SettlementResult` | `EXPEDITION_SETTLED` | 중복 정산·snapshot 검증 실패·즉시 distrust 경로 |
| C7 `PROMOTE_GUIDE` | C5 `PromotionResult` | `GUIDE_PROMOTED` | 승급 불가·골드 부족·전이 실패 |
| C7 `COMPLETE_WORLD_TURN` | C6/C7 `ending` | `CAMPAIGN_ENDED` | 엔딩 없음·월드턴 전이 실패 |

각 source adapter는 아래 안정 key를 draft에 넣는다. append는 이 key를 유일하게
검증하므로 Store 재시도나 이중 dispatch가 같은 사실을 다시 기록할 수 없다.

| 이벤트 | `sourceKey` 형식 |
| --- | --- |
| `ADVICE_RESOLVED` | `${expeditionId}:advice:${sourceEventId}:${adviceId}` |
| `BOSS_BATTLE_RESOLVED` | `${expeditionId}:boss-result` |
| `EXPEDITION_SETTLED` | `${expeditionId}:settlement` |
| `GUIDE_PROMOTED` | `promotion:${fromRank}:${toRank}` |
| `TRUST_COLLAPSED` | `${expeditionId}:trust-collapse` |
| `CAMPAIGN_ENDED` | `campaign-ended:${ending.kind}` |

`APPLY_TRUST_BATCH` 뒤 `ending?.kind === "distrust"`인 경우만
`TRUST_COLLAPSED`를 만든다. 이어지는 `CAMPAIGN_ENDED`는 같은 C7 반환의 `ending`을
그대로 쓴다. `denounced`, `completed`, `exhausted`, `unemployed`는
`COMPLETE_WORLD_TURN`의 `CAMPAIGN_ENDED` 하나만 만든다. 따라서 C6은 이벤트를
직접 append하지 않으며, 같은 엔딩이 E2/E4/C6/C7에서 중복되지 않는다.

C8-A 정산 통계와 C8-B 정산 이벤트는 한 Store 갱신에 함께 조합할 수 있지만 서로의
값을 읽어 계산하지 않는다.

```ts
const transition = transitionCampaign(campaign, context, action);
const statistics = transition.settlement === null
  ? transition.campaign.statistics
  : recordSettlementStatistics(/* C8-A의 기존 계약 */);
const history = transition.settlement === null
  ? transition.campaign.history
  : appendCampaignEvent(transition.campaign.history, settlementDraft);

store({ campaign: { ...transition.campaign, statistics, history }, context: transition.context });
```

## 7. 전환점 파생

`turningPoints`는 source가 쓰는 별도 로그가 아니다. 매 append 뒤 전체 `events`에서
다시 파생하며, 이벤트가 참조하는 `eventId`는 한 번만 전환점이 될 수 있다.

```ts
type TurningPointKind =
  | "firstCharacterDeath"
  | "bossBreakthrough"
  | "trustCollapse"
  | "campaignEnded";

interface TurningPoint {
  readonly eventId: CampaignEventId;
  readonly kind: TurningPointKind;
  readonly campaignTurn: number;
  readonly sequence: number;
}
```

다음 규칙을 배열 순서대로 적용한다.

1. `deceasedCharacterIds`가 비어 있지 않은 첫 `EXPEDITION_SETTLED`는
   `firstCharacterDeath`다.
2. `status: "cleared"`인 각 `BOSS_BATTLE_RESOLVED`는 `bossBreakthrough`다.
3. 각 `TRUST_COLLAPSED`는 `trustCollapse`다.
4. 각 `CAMPAIGN_ENDED`는 `campaignEnded`다.

전환점 배열은 원 이벤트의 `sequence` 오름차순으로 정렬하고 중복하지 않는다.
`importance`라는 별도 가변 필드는 두지 않는다. Chronicle은 전체 전환점을 쓸 수
있으며, U6 어댑터는 엔딩 자체를 다시 보여 주지 않도록 `campaignEnded`를 제외한
전환점 중 `trustCollapse > firstCharacterDeath > bossBreakthrough`, 동률이면 더 늦은
`sequence`를 단일 강조 전환점으로 선택한다. 후보가 없으면 `null`이다.

## 8. U6·I2·B1 소비 경계

U6은 `CampaignHistory`를 직접 렌더링하지 않는다. I2의 Chronicle/U6 어댑터가
`CampaignEnding`, C8-A 통계, 최종 풀, C8-B history를 각각 읽어 현행
`U6EndingView`로 변환한다. `chronicleSummary`의 문장 규칙과 ViewModel 변경은
C8-B 구현의 범위 밖이며 I2/U6 작업에서 확정한다.

B1은 이력에서 조언 수용·의심·적발 비율, 보스 돌파·전멸, 첫 사망 시점, 신뢰 붕괴와
엔딩 종류를 관측할 수 있다. 이 지표는 **나중의 밸런스 검토**에서 생존·배신·추론
전략이 한쪽으로 기울었는지 확인하는 용도다. C8-B는 관측만 하며, 보상·확률·신뢰
상수를 변경하거나 전략별로 이력 정의를 바꾸지 않는다.

## 9. 구현 검증 항목

- C1이 `createCampaignHistory()`의 빈 불변값을 만들고 `CampaignState.history`에
  보관한다.
- 각 draft variant가 타입에 없는 필드를 허용하지 않으며, 복원 데이터의 잘못된
  reaction/executed 관계·중복 source key·음수 순번·깨진 identity는 `INVALID_STATE`다.
- append는 입력 history와 이벤트를 변경하지 않고, 결정적 ID·연속 `sequence`와
  시간순 배열을 만든다. 같은 입력 replay는 같은 결과여야 한다.
- E2의 `accepted`·`suspected`·`exposed`와 `executed: false`가 하나의
  `ADVICE_RESOLVED`에 보존된다. 가짜 `ADVICE_REJECTED`는 만들지 않는다.
- 보스 결과, C4 새 사망, C5 승급, C7 즉시 distrust와 월드턴 후 네 엔딩이 각각
  위 표의 성공 경계에서 한 번만 기록된다. 실패한 전이·중복 정산·종료 재진입에는
  이력이 추가되지 않으며, 같은 source key 재시도는 `DUPLICATE_ID`다.
- `EXPEDITION_SETTLED`가 C8-A 카운터·골드·`SettlementResult`를 재계산하거나
  복제하지 않으며, statistics와 history의 한쪽만 갱신해도 다른 쪽의 무결성은
  바뀌지 않는다.
- 첫 사망, 보스 클리어, 즉시 불신, 캠페인 엔딩의 전환점이 결정적으로 파생되고,
  U6 단일 강조 선택의 우선순위·동률 규칙을 검증한다.
- C8-B reducer는 `phase`, 엔딩 판정, 풀, 던전, 활성 원정 context를 바꾸지 않는다.
