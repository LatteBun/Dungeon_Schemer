# 캠페인 누적 통계 설계

- 작성일: 2026-08-16
- 작성자: sanghwan-yoo
- 작성 도구: Claude Code (Opus 5)
- 대상 action ID: `C6`
- 분기 기준: `main` = `1a08e73`

## 1. 배경

엔딩 화면은 캠페인의 마지막 화면이면서 **캠페인 전체를 되짚는 유일한 자리**다.
[대표 화면 와이어프레임](../../diagram/screen-wireframes.md)의 05번은 여기서
`생존·전멸 파티, 최종 명성·골드와 대표 정보 선택을 요약한다`고 규정한다.

지금 화면이 보여주는 것은 마지막 상태의 스냅숏뿐이다. 클리어한 던전 수, 살아
있는 사람 수, 현재 자원은
[settlement-view-model.ts:161-187](../../../components/game/settlement-view-model.ts)이
`CampaignState`를 그 자리에서 세어 만든다. **지나온 15번의 원정에서 무슨 일이
있었는지는 어디에도 남지 않는다.**

가장 크게 비는 것이 정보 기록이다. 기만이 핵심 루프인데 캠페인이 끝나고 나면
몇 번 거짓말했는지, 몇 번 들켰는지를 알 방법이 없다. 원정마다 만들어진
`InfoRecord`는 다음 계약을 수락하는 순간 `expedition`과 함께 버려진다.

`U3`가 화면을 만들 때 이 항목들을 데이터 부족으로 제외했고, `I1`도
`CampaignState` 확장이 필요하다며 미뤘고, `U4`도 같은 이유로 세 번째 열을 비운
채 남겼다.

> `대표 정보 선택` 열은 데이터가 없어 넣지 않는다.
> — [U4 설계 4-4](2026-08-16-lattebun-wireframe-screen-fidelity-design.md)

세 작업이 같은 곳에서 멈춘 이유가 하나다. 상태에 쌓이는 것이 없기 때문이다.

## 2. 목표와 비목표

### 목표

- 카드 진위별 전달·반응·적발 횟수를 `CampaignState`에 누적한다.
- 생환·전멸 원정 수를 누적한다.
- 가장 큰 전환점을 규칙이 결정론적으로 고른다.
- 원정마다 원인 사슬을 남겨 엔딩에서 되짚을 수 있게 한다.
- 엔딩 화면과 정산 화면이 그 값을 **그대로** 표시한다.

### 비목표

- 파티원 소지 아이템. 지금 아이템은
  [event.ts:71-94](../../../lib/rules/event.ts)에서 구매 즉시 효과가 적용되고
  사라진다. 보유 개념을 만들려면 사건 해결 규칙을 바꿔야 하고 백테스트 수치가
  움직인다. `B1` 밸런스 조정과 뒤엉키므로 분리한다.
- 게임 규칙의 수치·확률·판정 변경. 이번 작업은 **이미 일어난 일을 기록할 뿐**
  새로운 무작위를 만들지 않는다.
- 백테스트 수치 변경. `docs/technical/BACKTEST_REPORT.md`가 그대로여야 한다.
- 저장·복원과 `같은 시드 기록 보기`. 캠페인 간 비교는 저장 기능이 필요하며
  프로토타입 범위 밖이다.
- 백테스트 시뮬레이터의 자체 집계 교체.
  [campaign-simulator.ts:289](../../../lib/backtest/campaign-simulator.ts)의
  `cardUsage`는 전략별 카드 노출을 재는 다른 목적의 값이다.

## 3. 확정한 결정

### 3-1. 전달은 장수로, 반응은 판정 건수로 센다

카드 한 장은 **살아 있는 파티원 각자에게 따로 판정**된다
([info.ts:189-200](../../../lib/rules/info.ts)). 그래서 `제시 1회`와 `적발 1회`의
단위가 자동으로 정해지지 않는다.

두 단위를 목적에 맞게 나눠 쓴다.

| 값 | 단위 | 답하는 질문 |
| --- | --- | --- |
| `delivered` | 카드 장수 | 나는 몇 번 거짓말했나 |
| `accepted`·`suspected`·`exposed` | 카드 × 파티원 판정 | 몇 명이 넘어갔나 |

한 단위로 통일하지 않는 이유는 두 질문이 다르기 때문이다. 판정 건수로만 세면
플레이어가 내린 결정의 수가 사라지고, 장수로만 세면 세 명 중 한 명이 의심한
것과 전원이 의심한 것이 같은 수치가 된다.

**`delivered`는 서로 다른 카드 id의 수가 아니라 전달 횟수다.** 한 캠페인에서 같은
카드가 두 지점에 다시 나올 수 있으므로 id를 집합으로 세면 두 번째 거짓말이
사라진다. `applyInfoRecord`가 기록을 전달 순서대로 덧붙이므로
([info.ts:305-321](../../../lib/rules/info.ts)) 한 번의 전달은 같은 `cardId`가
연속으로 놓인 구간 하나다. 그 구간의 개수를 센다.

**화면은 두 단위를 한 줄에 섞지 않는다.** `거짓 12장 · 수용 19 / 의심 8 / 즉시
적발 7`처럼 장수를 앞에 두고 판정 건수를 뒤에 묶는다.

### 3-2. 전환점은 우선순위 사슬로 고른다

단위가 다른 값을 억지로 하나의 축에 더하지 않는다. 먼저 성립한 것을 고르고, 왜
골랐는지를 규칙이 문장으로 남긴다.

| 순위 | 종류 | 고르는 법 |
| --- | --- | --- |
| 1 | `firstWipe` | `status === "failed"`인 가장 이른 기록 |
| 2 | `promotion` | 등급이 오른 기록 중 가장 높은 등급에 도달한 것. 동률이면 이른 쪽 |
| 3 | `scoreSwing` | `abs(scoreAfter - scoreBefore)`가 최대인 기록. 동률이면 이른 쪽 |
| — | `null` | 기록이 없을 때 |

**첫 전멸을 승급 위에 두는 근거는 첫 백테스트다.** `wipeGoldFirst` 전략의
**77.4%가 첫 전멸 뒤 지원 불가로 끝났다**
([배정표 「확인된 밸런스 문제」](../../technical/PROTOTYPE_WORK_ASSIGNMENT.md)).
전멸이 있었던 캠페인에서 궤적을 꺾은 지점은 실제로 그 원정이었다.

승급을 `가장 높은 등급 도달`로 고르는 것은 강등이 없기 때문이다
([promotion.ts:45-50](../../../lib/rules/promotion.ts)). 마지막 승급이 곧 가장
높은 등급이며, 한 정산에서 두 등급을 건너뛴 경우도 같은 기준으로 잡힌다.

점수 변화폭을 3순위로 미룬 것도 근거가 있다. 승급 점수는 `명성 × 2 + 누적 골드`라
등급이 높은 던전일수록 보상도 손실도 커진다. 이것만으로 고르면 S급 원정이 거의
항상 뽑혀 전환점이 등급의 다른 이름이 된다.

### 3-3. 사후 발각은 보스전 생존자에게만 성립한다

수용된 거짓은 보스전 뒤 `deceptionExposed`로 드러난다. 그런데 그 검증은
**살아남은 사람에게만** 일어난다
([boss.ts:112-131](../../../lib/rules/boss.ts)). 죽은 사람의 신뢰는 움직여도 갈
곳이 없기 때문이다. 사건 도중 전멸하면 보스전 자체가 없어
([campaign-machine.ts:417-429](../../../lib/flow/campaign-machine.ts)) 아무도
검증되지 않는다.

따라서 `lateExposed`는 다음을 모두 만족하는 기록만 센다.

```ts
record.pendingVerification                              // = 거짓을 수용했다
&& expedition.bossResult !== null                       // 보스전을 치렀다
&& expedition.bossResult.survivorIds.includes(record.memberId)  // 그 사람이 살아남았다
```

`pendingVerification`을 다시 계산하지 않고 규칙이 세운 깃발을 그대로 읽는다. 그
값이 `card.truthType === "lie" && reaction === "accepted"`와 같다는 사실은
[info.ts:197](../../../lib/rules/info.ts)에 한 벌로 있고, 여기서 다시 판정하면
두 벌이 되어 나중에 한쪽만 바뀐다.

**이 조건이 통계에서 가장 틀리기 쉬운 곳이다.** 세 조건 중 하나라도 빠지면
`들키지 않고 넘어간 거짓말`이 실제보다 적게 나오고, 그 수치가 이 게임에서 가장
읽고 싶은 값이다.

## 4. 왜 정산이 갱신하는가

전이마다 증분 갱신하는 방법을 먼저 검토했고 **버렸다.**
`chooseInfoCard`에서 카드를 세고, `resolveBoss`에서 사후 발각을 세고,
`applySettlement`에서 파티 결과를 세는 구조다.

버린 이유는 통계에 필요한 원재료가 **정산 시점에 이미 `expedition` 안에 전부
있기** 때문이다.

| 필요한 값 | 이미 있는 곳 |
| --- | --- |
| 카드 전달·반응 | `expedition.infoRecords` — 진위·반응·수신자가 기록마다 있다 |
| 사후 발각 | `pendingVerification` 깃발과 `bossResult.survivorIds` |
| 보스 피해 | `bossResult.damageByMember` |
| 생환·전멸 | `expedition.result.status` |
| 자원·등급 변화 | `settleExpedition`이 before와 after를 둘 다 안다 |
| 원인 사슬 | `settleExpedition`이 만드는 `SettlementStep[]` 그 자체 |

`settleExpedition` 한 곳에서 원정 하나를 접어 넣으면 **`campaign-machine`을 한
줄도 고치지 않는다.** 갱신 지점이 하나이므로 누락된 경로도 생기지 않는다.
사건 도중 전멸해 보스전을 건너뛴 원정도 정산은 반드시 거친다.

정산이 통계를 아는 것이 층위를 넘지 않는지 확인했다. 정산은 이미 원정 하나의
결과를 캠페인에 반영하는 자리이고, 자원·던전·등급·파티를 모두 갱신한다. 누적
통계는 그 목록에 하나 더 붙는 항목이지 새로운 책임이 아니다.

## 5. 설계

### 5-1. `SettlementStep` 타입을 도메인으로 옮긴다

연대기가 원인 사슬을 품으려면 도메인이 `SettlementStep`을 참조해야 하는데, 그
타입은 지금 `lib/rules/settlement.ts`에 있다. 도메인이 규칙을 import하면 의존
방향이 뒤집힌다.

`SettlementStepKind`와 `SettlementStep`을 `lib/domain/campaign.ts`로 옮기고
`settlement.ts`가 재export한다. `SETTLEMENT_STEP_ORDER` 상수는 규칙에 남는다.
순서는 규칙의 결정이지 타입의 일부가 아니다.

**타입만 옮기는 순수 이동이며 동작은 바뀌지 않는다.** 재export로 기존 import 네
곳(`campaign-machine`, `campaign-store`, `settlement-view-model`, `u3-fixtures`)이
그대로 컴파일된다. C5가 `expeditionKey`를 옮길 때와 같은 형태다.

### 5-2. 도메인 타입 — `lib/domain/campaign.ts`

```ts
/** 진위 한 종류의 전달·반응 누적. 두 단위를 섞지 않는다(3-1). */
export interface CardTruthStat {
  /** 용사에게 전달한 카드 장수. 플레이어 결정 단위다. */
  delivered: number;
  /** 아래 셋은 카드 × 파티원 판정 단위다. */
  accepted: number;
  suspected: number;
  exposed: number;
  /** 수용됐다가 보스전 뒤 드러난 거짓. lie 외에는 항상 0이다(3-3). */
  lateExposed: number;
}

export type TurningPointKind = "firstWipe" | "promotion" | "scoreSwing";

export interface TurningPoint {
  kind: TurningPointKind;
  /** 가리키는 ExpeditionRecord.order */
  expeditionOrder: number;
  /** 왜 이 원정이 전환점인지. 규칙이 쓴 문장을 화면이 그대로 쓴다. */
  summary: string;
}

/** 원정 하나가 캠페인에 남긴 것. 최대 15+건이므로 통째로 들고 있어도 된다. */
export interface ExpeditionRecord {
  /** 1부터. 몇 번째 원정인가 */
  order: number;
  dungeonId: DungeonId;
  /** 출전 당시 등급. 실패로 등급이 오르기 전 값이다. */
  grade: Grade;
  partyId: PartyId;
  status: ExpeditionResultStatus;
  survivorCount: number;
  casualtyCount: number;
  cards: Record<TruthType, CardTruthStat>;
  /** 보스전에서 파티가 입은 피해 합. 보스전이 없었으면 0이다. */
  bossDamageTotal: number;
  reputationDelta: number;
  goldDelta: number;
  scoreBefore: number;
  scoreAfter: number;
  rankBefore: Grade;
  rankAfter: Grade;
  /** 정산이 만든 원인 사슬 그대로. */
  steps: SettlementStep[];
}

export interface CampaignStatistics {
  /** 캠페인 전체 누적. expeditions의 합과 항상 같다. */
  cards: Record<TruthType, CardTruthStat>;
  clearedExpeditions: number;
  wipedExpeditions: number;
  expeditions: ExpeditionRecord[];
  /** 정산마다 연대기 전체에서 다시 고른다. */
  turningPoint: TurningPoint | null;
}
```

`CampaignState`에 `statistics: CampaignStatistics`를 더한다.

**누적값과 연대기를 둘 다 두는 것은 의도적인 중복이다.** 엔딩 화면이 15건을 매
렌더마다 접지 않아도 되고, 6절의 불변식이 두 벌의 일치를 검사한다. 어긋나면
테스트가 먼저 깨진다.

`steps`를 기록에 그대로 보존하는 것은 이 저장소의 원칙을 따른 것이다.

> `summary`를 가공하지 않는 이유는 원인 설명이 규칙의 소유이기 때문이다.
> 화면이 문장을 다시 쓰면 규칙과 화면이 서로 다른 말을 하기 시작한다.
> — [settlement-view-model.ts:110-115](../../../components/game/settlement-view-model.ts)

### 5-3. 통계 규칙 — `lib/rules/statistics.ts` (신설)

```ts
export function emptyStatistics(): CampaignStatistics;

export function recordExpedition(
  statistics: CampaignStatistics,
  record: ExpeditionRecord,
): CampaignStatistics;

export function summarizeExpeditionCards(
  expedition: ExpeditionState,
): Record<TruthType, CardTruthStat>;

export function findTurningPoint(
  records: readonly ExpeditionRecord[],
): TurningPoint | null;
```

전부 난수를 쓰지 않는 순수 함수다. `recordExpedition`이 누적값을 더하고
`findTurningPoint`를 다시 돌려 새 통계를 만든다. 연대기가 최대 15+건이라 매번
전체를 훑어도 비용이 없고, 증분으로 유지하면 우선순위가 바뀔 때 되돌릴 수 없다.
전멸이 3번째에 일어나면 1·2번째에서 고른 전환점을 물러야 한다.

`summarizeExpeditionCards`가 3-3의 세 조건을 담는 유일한 자리다.

### 5-4. 정산 배선 — `lib/rules/settlement.ts`

`settleExpedition`이 `steps`를 만든 직후, 반환 직전에 기록 하나를 만들어 붙인다.

```ts
const record: ExpeditionRecord = {
  order: input.state.statistics.expeditions.length + 1,
  grade: dungeon.grade,              // settleDungeon 이전 값
  rankBefore: afterPayout.rank,      // promote 이전 값
  rankAfter: rank,
  scoreBefore: calculatePromotionScore(
    input.state.currentReputation,
    input.state.cumulativeGold,
  ),
  scoreAfter: score,
  reputationDelta: payout.reputation,
  goldDelta: payout.gold + payout.loot,
  cards: summarizeExpeditionCards(input.expedition),
  steps,
  // …
};
```

**before 값을 어디서 읽는지가 중요하다.** `dungeon`은 `settleDungeon`이 등급을
올리기 전 값이어야 하고, `rankBefore`는 `promote` 이전 값이어야 한다. 두 값 모두
함수 안에 이미 별도 이름으로 남아 있어 새 스냅숏이 필요 없다.

`initializeCampaign`은 `statistics: emptyStatistics()`로 시작한다. 전체 리터럴로
`CampaignState`를 만드는 곳은 세 군데
([campaign-init.ts:114](../../../lib/rules/campaign-init.ts),
[fixtures.ts:92](../../../lib/rules/fixtures.ts), `campaign-init.test.ts`)이며
필드가 필수이므로 빠뜨리면 컴파일이 막는다.

### 5-5. 화면

view-model이 통계를 화면 값으로 옮기고, 컴포넌트는 그리기만 한다.

**05 엔딩** — `U4`가 비워 둔 세 번째 열이 채워진다.

```
                        불신의 대가
        살아 돌아온 용사들이 모두 당신을 완전히 불신한다.

  ┌ 최종 등급 ─┐ ┌ 캠페인 요약 ──┐ ┌ 정보 전달 기록 ──────────┐
  │     A      │ │ 클리어 9/15   │ │ 진실 18장 · 수용 41/의심 10│
  │  점수 291  │ │ 생환 11·전멸 4│ │ 거짓 12장 · 수용 19/의심 8 │
  │ 다음 S 370 │ │ 생존 38명 62% │ │        · 즉시 적발 7      │
  └───────────┘ │ 명성 47·골드…  │ │ 중립  9장 · 수용 20/의심 5 │
                └──────────────┘ │ 수용된 거짓 19건 중 11건이 │
                                 │ 보스전 뒤 드러났다         │
                                 └─────────────────────────┘
  ┌ 가장 큰 전환점 ──────────────────────────────────────┐
  │ 7번째 원정 · B급 3번 — 출전한 4팀이 전멸했다          │
  │ 명성 -6 · 승급 점수 274 → 262                        │
  └────────────────────────────────────────────────────┘
  ┌ 원정 연대기 (15건) ──────────────────────────────────┐
  │ 01 C급 1번 · 생환 3명 · 명성 +3 골드 +120 · 0→126    │
  │ 07 B급 3번 · 전멸    · 명성 -6 유품 +31  · 274→262   │
  └────────────────────────────────────────────────────┘
```

**04 보스·정산** — 와이어프레임이 요구하는 `선택 → 개인 반응 → 피해 → 보상·손실
→ 캠페인 변화` 원인 사슬 띠를 정산 타임라인 아래에 놓는다. 방금 붙은 기록
하나에서 전부 파생된다.

```
전달 거짓 2·진실 1 → 수용 5·의심 3·적발 1 → 보스 피해 47 · 2명 생환
  → 명성 +8 · 골드 +72 → 승급 점수 274 → 358 · 등급 A 유지
```

띠가 상태에서 나오는 것이 요점이다. 지금 정산 화면은 스토어의
`lastSettlementSteps`에 의존해 **새로고침하면 사라지는데**, 연대기를 읽으면
남는다.

**접근성.** `✓`·`×` 같은 기호만으로 생환·전멸을 구분하지 않고 `생환`·`전멸`
글자를 함께 적는다. C5가 사건 분류 기호에 분류명을 붙인 것과 같은 이유이고
`Q1` 기준이다.

## 6. 불변식과 테스트

`lib/rules/statistics.test.ts`:

| 불변식 | 왜 |
| --- | --- |
| 누적 카드 통계 = 연대기 각 원정의 합 | 두 벌이 어긋나면 화면이 서로 다른 말을 한다 |
| `accepted + suspected + exposed` = `infoRecords.length` | 판정 단위가 새지 않는다 |
| 같은 카드를 두 번 전달하면 `delivered`가 2 | id 집합으로 세지 않는다(3-1) |
| `lateExposed <= lie.accepted` | 수용되지 않은 거짓은 사후 발각될 수 없다 |
| 보스전 없이 끝난 원정은 `lateExposed === 0` | 사건 중 전멸 시 검증이 없다(3-3) |
| 보스전에서 죽은 사람의 미검증 거짓은 세지 않는다 | 생존자만 검증한다(3-3) |
| `truth`·`neutral`의 `lateExposed`는 항상 0 | 거짓만 사후 검증 대상이다 |
| `cleared + wiped === expeditions.length` | 누락 없음 |
| 전멸이 하나라도 있으면 전환점은 항상 `firstWipe` | 우선순위 사슬(3-2) |
| 전멸이 없고 승급이 있으면 가장 높은 등급에 도달한 원정 | 같음 |
| 셋 다 없으면 점수 변화폭 최대, 동률이면 이른 쪽 | 결정론 |
| `order`가 1부터 빈틈없이 증가한다 | 연대기가 원정과 1:1이다 |

`lib/rules/settlement.test.ts`에 배선 검사를 더한다. 정산 한 번이 기록 하나를
남기고, `grade`·`rankBefore`가 **정산 이전** 값인지 확인한다. 실패 정산에서
`grade`가 오른 뒤 값으로 새면 연대기가 캠페인을 다르게 기술한다.

view-model 테스트는 통계가 화면 문자열로 옮겨지는 부분만 본다. Vitest가
`environment: node`이고 `@testing-library`가 없으므로 컴포넌트는
typecheck·lint·build와 브라우저로 게이트한다. `U1`~`U4`가 정한 결정을 유지한다.

**판별력을 확인한다.** `findTurningPoint`에서 `firstWipe`와 `promotion`의 순위를
서로 바꿔 테스트가 실제로 깨지는지 보고, 확인 내용을 PR 본문에 적은 뒤 되돌린다.
`git diff --stat`으로 복원을 확인한다.

## 7. 검증 게이트

통계 갱신은 난수를 쓰지 않는 순수 계산이므로 게임 결과가 바뀔 수 없다. 그것을
증명하는 게이트를 필수로 둔다.

```bash
pnpm backtest
git diff --stat docs/technical/BACKTEST_REPORT.md   # 출력이 없어야 한다
```

보고서가 달라지면 규칙을 건드린 것이므로 멈추고 원인을 찾는다.

**실행 시간도 함께 본다.** 백테스트는 30,000 캠페인을 돌고 캠페인마다 15건이
쌓인다. 현재 92.9초에서 눈에 띄게 늘면 그 자체가 보고 대상이다.

여기에 `pnpm lint && pnpm typecheck && pnpm test && pnpm build`와, 브라우저에서 한
캠페인을 엔딩까지 끝내 화면의 수치가 실제 진행과 맞는지 대조하는 절차를 더한다.
정보 전달 기록은 거짓 카드를 일부러 골라 즉시 적발과 사후 발각을 모두 만들어
확인한다.

## 8. 영향 범위

| 파일 | 변경 |
| --- | --- |
| `lib/domain/campaign.ts` | 타입 5개 추가, `SettlementStep` 이동, `CampaignState` 확장 |
| `lib/rules/settlement.ts` | 기록 생성과 통계 갱신, 타입 재export |
| `lib/rules/statistics.ts` | 신설 |
| `lib/rules/statistics.test.ts` | 신설 |
| `lib/rules/campaign-init.ts` | 초기 통계 |
| `lib/rules/fixtures.ts` | 초기 통계 |
| `lib/rules/settlement.test.ts` | 배선 검사 추가 |
| `lib/rules/campaign-init.test.ts` | 필드 추종 |
| `components/game/settlement-view-model.ts` | `toEndingView` 확장, 연대기·원인 사슬 변환 |
| `components/game/EndingPanel.tsx` | 3열, 전환점, 연대기 |
| `components/game/ExpeditionChronicle.tsx` | 신설 |
| `components/game/CauseChainBand.tsx` | 신설 |
| `app/play/result/page.tsx` | 원인 사슬 띠 배치 |
| `app/u3-test/u3-fixtures.ts` | 통계가 채워진 상태 |
| `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md` | `C6` 완료 표시 |

**트랙 소유권:** `lib/rules`는 규칙 트랙(sbh3821) 영역이다. 이번에
`settlement.ts`를 건드리지만 계산을 바꾸지 않고 반환 직전에 기록을 붙일 뿐이며,
백테스트 보고서 무변경이 그것을 증명한다.

## 9. 후속 작업

- 소지 아이템. 사건 규칙 변경이라 `B1` 밸런스 조정과 함께 보는 것이 맞다.
- `같은 시드 기록 보기`. 저장·복원이 프로토타입 범위에 들어온 뒤에 본다.
- 백테스트 보고서가 `CampaignStatistics`를 읽어 전략별 기만 성공률을 내는 것.
  `B1`이 상수를 조정한 뒤 지표가 안정되면 다시 본다.

## 10. 관련 문서

- [작업 배정표](../../technical/PROTOTYPE_WORK_ASSIGNMENT.md)
- [정보와 기만](../../systems/INFORMATION_AND_DECEPTION.md)
- [성장과 엔딩](../../systems/PROGRESSION_AND_ENDINGS.md)
- [대표 화면 와이어프레임](../../diagram/screen-wireframes.md)
- [U4 와이어프레임 화면 충실도 설계](2026-08-16-lattebun-wireframe-screen-fidelity-design.md)
- [C5 공고·계약 위험 요약 설계](2026-08-16-sanghwan-yoo-offer-contract-risk-summary-design.md)
