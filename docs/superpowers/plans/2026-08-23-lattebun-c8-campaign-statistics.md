# C8-A 캠페인 정산 통계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** C7이 확정한 정산 결과를 순수하게 한 번 누적하여, 캠페인 정산 이력과 클리어·전멸·사망·골드 통계를 제공한다.

**Architecture:** `lib/domain`은 15개 고정 던전 순서, 정산 요약, 빈 통계 factory를 소유한다. `lib/rules/campaign-statistics.ts`는 C4 `SettlementResult`와 해당 던전을 받아 기존 통계를 검증하고 새 불변 통계만 반환한다. C7은 reducer를 호출하거나 phase를 바꾸지 않으며, I1이 장차 C7의 `COMPLETE_EXPEDITION` 결과 직후 이 함수를 조합한다.

**Tech Stack:** Next.js 16.3, React 19.2, TypeScript 5, Vitest 4.1, Zustand 5(이번 작업에서는 사용하지 않음).

**Spec:** [C8-A 캠페인 정산 통계 설계](../specs/2026-08-23-lattebun-c8-campaign-statistics-design.md)

## Global Constraints

- 구현 브랜치는 C7 PR #111이 `main`에 병합된 뒤 만들거나, C8 브랜치를 C7 위로 rebase한다. `CampaignTransitionResult.settlement`이 없는 base에서 구현하지 않는다.
- 구현 시작 전 `rg --files node_modules/next/dist/docs | rg '(testing|typescript)'`로 Next.js 16.3의 관련 가이드를 찾아 읽는다. 이번 규칙 함수는 React·Next 런타임을 호출하지 않는다.
- `SettlementResult`의 실제 상태 문자열 `"cleared" | "wiped"`와 정확히 3명인 원정 파티를 사용한다. `success/failure` 또는 4인 fixture를 추가하지 않는다.
- `goldEarned`는 C4가 확정한 `goldDelta + relicGold`다. 현재 골드 차이를 역산하지 않고 `totalGoldSpent`를 추가하지 않는다.
- 사망 수는 `before.alive === true && after.alive === false`인 `SettlementMemberChange`만 센다.
- C8-A는 원본 `settlements`와 요약 `settlementHistory`를 같은 순서로 함께 보존한다. 모든 기존 통계·배열·정산 객체를 변경하지 않는다.
- C8-A의 중복 `expeditionId`는 `RuleError("DUPLICATE_ID")`, 이력·던전·집계의 불일치는 `RuleError("INVALID_STATE")`다.
- C7은 계속 `CampaignState.statistics`에 append하지 않는다. C8-A는 phase, offers, pool, ending, `settledExpeditionIds`를 변경하지 않는다.
- 즉시 `distrust` 엔딩은 `SettlementResult`가 없으므로 통계를 기록하지 않는다.
- C8-B의 조언·반응·전환점·연대기, I1 Store, U6 어댑터, 저장·복원은 구현하지 않는다.
- 모든 커밋 제목과 본문은 한국어로 작성한다.

---

## File Map

| File | Change | Responsibility |
| --- | --- | --- |
| `lib/domain/dungeon.ts` | Modify | `CampaignDungeonOrder` 닫힌 1~15 타입과 순서 상수, `CampaignDungeon.campaignOrder` |
| `lib/content/campaign-dungeons.ts` | Modify | 15개 고정 슬롯의 명시적 `campaignOrder` |
| `lib/domain/statistics.ts` | Replace | `SettlementSummary`, 확장 `CampaignStatistics`, 빈 통계 factory |
| `lib/domain/index.ts` | Modify | 새 던전 순서·통계 타입/factory의 단일 공개 export |
| `lib/rules/campaign-init.ts` | Modify | 슬롯 순서와 빈 통계를 새 CampaignState에 복사 |
| `lib/rules/campaign-init.test.ts` | Modify | 고정 순서와 전체 빈 통계 초기화 회귀 |
| `lib/domain/contract.test.ts` | Modify | 새 domain barrel 계약 회귀 |
| `lib/rules/ending.test.ts` | Modify | 수제 구형 statistics fixture를 빈 통계 factory로 교체 |
| `lib/rules/campaign-transition.test.ts` | Modify | C7이 확장된 빈 통계를 그대로 보존하는 회귀 |
| `lib/rules/campaign-statistics.ts` | Create | C8-A 불변 정산 통계 reducer와 손상 상태 검증 |
| `lib/rules/campaign-statistics.test.ts` | Create | reducer의 clear/wipe/사망/골드/중복/손상 상태와 C7 조합 회귀 |

### Task 1: 고정 던전 순서와 확장 통계 도메인 계약을 만든다

**Files:**
- Modify: `lib/domain/dungeon.ts`
- Modify: `lib/content/campaign-dungeons.ts`
- Replace: `lib/domain/statistics.ts`
- Modify: `lib/domain/index.ts`
- Modify: `lib/rules/campaign-init.ts`
- Modify: `lib/rules/campaign-init.test.ts`
- Modify: `lib/domain/contract.test.ts`
- Modify: `lib/rules/ending.test.ts`
- Modify: `lib/rules/campaign-transition.test.ts`

**Interfaces:**
- Consumes: `CampaignDungeon`, `SettlementResult`, `ExpeditionStatus`, `DungeonId`, C1 `INITIAL_DUNGEON_SLOTS`
- Produces:

```ts
export type CampaignDungeonOrder =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  | 11 | 12 | 13 | 14 | 15;

export const CAMPAIGN_DUNGEON_ORDERS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
] as const satisfies readonly CampaignDungeonOrder[];

export interface SettlementSummary {
  readonly expeditionId: string;
  readonly dungeonId: DungeonId;
  readonly dungeonOrder: CampaignDungeonOrder;
  readonly status: ExpeditionStatus;
  readonly goldEarned: number;
  readonly survivorCount: 0 | 1 | 2 | 3;
  readonly deathCount: 0 | 1 | 2 | 3;
}

export interface CampaignStatistics {
  readonly settlements: readonly SettlementResult[];
  readonly settlementHistory: readonly SettlementSummary[];
  readonly totalExpeditions: number;
  readonly clearedExpeditions: number;
  readonly wipedExpeditions: number;
  readonly totalDeaths: number;
  readonly totalGoldEarned: number;
  readonly highestDungeonCleared: CampaignDungeonOrder | 0;
}

export function createCampaignStatistics(): CampaignStatistics;
```

- [ ] **Step 1: 도메인·초기화의 실패 테스트를 작성한다.**

`campaign-init.test.ts`의 고정 슬롯 순회에 순서 검증을 추가하고, 첫 초기화의
statistics가 모든 0/빈 배열을 가진다고 고정한다. `contract.test.ts`에서는
`CAMPAIGN_DUNGEON_ORDERS`와 factory의 공개 export를 검증한다.

```ts
expect(state.dungeons.map((dungeon) => dungeon.campaignOrder)).toEqual(
  CAMPAIGN_DUNGEON_ORDERS,
);
expect(createCampaignStatistics()).toEqual({
  settlements: [], settlementHistory: [],
  totalExpeditions: 0, clearedExpeditions: 0, wipedExpeditions: 0,
  totalDeaths: 0, totalGoldEarned: 0, highestDungeonCleared: 0,
});
```

`ending.test.ts`의 `{ settlements: [] }`는 `createCampaignStatistics()`로,
`campaign-transition.test.ts`의 C7 정산 뒤 통계 기대값도 같은 factory로
바꾼다. 이 변경은 C7이 C8-A를 호출하지 않는 기존 단언을 유지한다.

- [ ] **Step 2: 계약 테스트가 실패하는지 확인한다.**

Run: `pnpm test -- lib/domain/contract.test.ts lib/rules/campaign-init.test.ts lib/rules/ending.test.ts lib/rules/campaign-transition.test.ts`

Expected: FAIL — 새 순서 상수, `campaignOrder`, 확장 statistics field 또는 factory export가 없다.

- [ ] **Step 3: 최소 도메인·초기화 계약을 구현한다.**

`CampaignDungeonOrder`와 순서 상수를 `lib/domain/dungeon.ts`에 선언하고
`CampaignDungeon.campaignOrder`를 필수 readonly 필드로 추가한다. 슬롯 15개에는
선언 순서대로 `campaignOrder: 1`부터 `campaignOrder: 15`까지 명시한다. 배열 index를
runtime에서 더해 만들지 않아 콘텐츠의 순서 변경이 조용히 데이터 의미를 바꾸지
않게 한다.

`lib/domain/statistics.ts`에는 위 타입과 아래 factory만 둔다.

```ts
export function createCampaignStatistics(): CampaignStatistics {
  return {
    settlements: [], settlementHistory: [],
    totalExpeditions: 0, clearedExpeditions: 0, wipedExpeditions: 0,
    totalDeaths: 0, totalGoldEarned: 0, highestDungeonCleared: 0,
  };
}
```

`initializeCampaign`은 각 슬롯의 `campaignOrder`를 dungeon으로 복사하고
`statistics: createCampaignStatistics()`를 사용한다. domain barrel에서 새 타입·상수·factory를 export한다. 구형 수제 fixture는 factory로 교체해 모든 `CampaignState`가 새 계약을 만족하게 한다.

- [ ] **Step 4: 도메인·초기화 회귀를 통과시킨다.**

Run: `pnpm test -- lib/domain/contract.test.ts lib/rules/campaign-init.test.ts lib/rules/ending.test.ts lib/rules/campaign-transition.test.ts && pnpm typecheck`

Expected: PASS — 15개 던전은 같은 시드에서 같은 전역 순서와 서로 다른 객체를 가지며, C7/C6 회귀는 확장된 빈 통계를 보존한다.

- [ ] **Step 5: 첫 번째 커밋을 만든다.**

```bash
git add lib/domain/dungeon.ts lib/content/campaign-dungeons.ts lib/domain/statistics.ts lib/domain/index.ts lib/rules/campaign-init.ts lib/rules/campaign-init.test.ts lib/domain/contract.test.ts lib/rules/ending.test.ts lib/rules/campaign-transition.test.ts
git commit -m "기능: 캠페인 정산 통계 도메인 계약을 확장한다" -m "고정 던전 순서와 빈 통계 factory를 추가해 C8 정산 집계의 입력 계약을 마련한다."
```

### Task 2: 불변 정산 통계 reducer를 테스트 우선으로 구현한다

**Files:**
- Create: `lib/rules/campaign-statistics.ts`
- Create: `lib/rules/campaign-statistics.test.ts`

**Interfaces:**
- Consumes: Task 1의 `CampaignStatistics`, `SettlementSummary`, `CampaignDungeonOrder`; C4 `SettlementResult`; `CampaignDungeon`; `RuleError`
- Produces:

```ts
export function recordSettlementStatistics(
  statistics: CampaignStatistics,
  settlement: SettlementResult,
  dungeon: Pick<CampaignDungeon, "id" | "campaignOrder">,
): CampaignStatistics;
```

- [ ] **Step 1: clear·wipe의 실패 테스트와 공통 fixture를 작성한다.**

테스트 파일 안에 실제 C4 계약을 모두 채우는 `settlementFixture`를 둔다. 기본값은
`status: "cleared"`, 3명의 살아 있는 `memberChanges`, `goldDelta: 32`,
`relicGold: 0`, `survivorCount: 3`이다. 각 character는 `id`, `classId`, `maxHp`,
`hp`, `trust`, `gold`, `alive`, `gravelyWounded`를 가진 유효한 C4 모양으로 만든다.

```ts
const cleared = recordSettlementStatistics(
  createCampaignStatistics(),
  settlementFixture({ expeditionId: "exp-1", goldDelta: 32 }),
  { id: "dungeon-desert-02" as DungeonId, campaignOrder: 7 },
);

expect(cleared).toMatchObject({
  totalExpeditions: 1, clearedExpeditions: 1, wipedExpeditions: 0,
  totalDeaths: 0, totalGoldEarned: 32, highestDungeonCleared: 7,
});
expect(cleared.settlementHistory[0]).toMatchObject({
  expeditionId: "exp-1", dungeonOrder: 7, status: "cleared",
  goldEarned: 32, survivorCount: 3, deathCount: 0,
});
```

전멸 fixture는 `status: "wiped"`, `goldDelta: 0`, `relicGold: 45`, 세 명의
`alive: true → false` member change로 만든다. 이 결과가 `totalGoldEarned: 45`,
`wipedExpeditions: 1`, `totalDeaths: 3`, `highestDungeonCleared: 0`임을 검증한다.
또한 다음 실패 테스트를 각각 작성한다.

- 두 번째 같은 `expeditionId`는 `DUPLICATE_ID`이고 입력 statistics의
  `structuredClone` 비교가 같다.
- 전달한 dungeon ID가 settlement ID와 다르면 `INVALID_STATE`다.
- `campaignOrder: 16 as CampaignDungeonOrder`은 `INVALID_STATE`다.
- 원본/요약 ID 순서가 다르거나, `totalGoldEarned`가 이력 합계와 다른 statistics는
  `INVALID_STATE`다.
- 이전부터 `alive: false`였던 member의 `false → false` change는 deathCount에 더하지 않는다.
- order 5 clear 뒤 order 2 clear와 wipe를 더해도 최고 클리어는 5이고, order 7 clear 뒤에는 7이 된다.

같은 파일에 C7 조합 회귀도 작성한다. `OPEN_BOARD → SELECT_CONTRACT →
START_EXPEDITION → COMPLETE_EXPEDITION` 결과에서 해당 던전을 찾아 reducer를
호출하고 I1이 할 교체를 명시한다.

```ts
const transition = transitionCampaign(expedition.campaign, expedition.context, {
  type: "COMPLETE_EXPEDITION",
  snapshot: snapshotFor(expedition.campaign, expedition.context),
});
const settlement = transition.settlement!;
const dungeon = transition.campaign.dungeons.find(
  (candidate) => candidate.id === settlement.dungeonId,
)!;
const campaign = {
  ...transition.campaign,
  statistics: recordSettlementStatistics(transition.campaign.statistics, settlement, dungeon),
};

expect(campaign.phase).toBe("settlement");
expect(campaign.settledExpeditionIds).toEqual([settlement.expeditionId]);
expect(campaign.statistics.settlements).toEqual([settlement]);
expect(transition.campaign.statistics).toEqual(createCampaignStatistics());
```

즉시 distrust fixture에서는 세 최신 파티원의 신뢰를 0으로 만들고
`APPLY_TRUST_BATCH`를 보낸다. `ending?.kind === "distrust"`,
`settlement === null`, `statistics === createCampaignStatistics()`를 함께
기대한다. reducer는 이 경로에서 호출하지 않는다.

- [ ] **Step 2: reducer 테스트가 실패하는지 확인한다.**

Run: `pnpm test -- lib/rules/campaign-statistics.test.ts`

Expected: FAIL — `recordSettlementStatistics` 모듈과 export가 없다.

- [ ] **Step 3: 검증 후 새 값을 만드는 reducer를 구현한다.**

먼저 private helper로 기존 history를 검사한다. helper는 원본과 요약의 길이·동일
index `expeditionId`·`dungeonId`·`status`·`survivorCount`, 고유 ID, `goldEarned`,
`deathCount`, 전체 카운터·골드·최고 클리어를 확인한다. 일치하지 않으면
`new RuleError("INVALID_STATE", ..., details)`를 던진다. 새 dungeon의 ID/순서도
`CAMPAIGN_DUNGEON_ORDERS.includes(dungeon.campaignOrder)`로 검사한다.

요약은 C4 결과를 다음처럼 한 번만 읽어 만든다.

```ts
const deathCount = settlement.memberChanges.filter(
  ({ before, after }) => before.alive && !after.alive,
).length as 0 | 1 | 2 | 3;
const goldEarned = settlement.goldDelta + settlement.relicGold;
const summary: SettlementSummary = {
  expeditionId: settlement.expeditionId,
  dungeonId: settlement.dungeonId,
  dungeonOrder: dungeon.campaignOrder,
  status: settlement.status,
  goldEarned,
  survivorCount: settlement.survivorCount,
  deathCount,
};
```

새 ID가 원본 또는 요약에 있으면 `RuleError("DUPLICATE_ID", ..., { expeditionId })`를
던진다. 마지막으로 `settlement.status` switch에서 `clearedExpeditions` 또는
`wipedExpeditions` 하나만 증가시키고, clear일 때만 `Math.max`로 최고 순서를
갱신한다. `[...statistics.settlements, settlement]`와
`[...statistics.settlementHistory, summary]`를 사용해 새 객체를 반환한다.

- [ ] **Step 4: reducer 단위 테스트와 타입 검사를 통과시킨다.**

Run: `pnpm test -- lib/rules/campaign-statistics.test.ts lib/rules/campaign-transition.test.ts && pnpm typecheck && pnpm lint && pnpm test`

Expected: PASS — clear/wipe, 유품 골드, 과거 사망 제외, 최고 순서, 입력 불변성 및 모든 오류 코드가 고정된다. C7 정산 뒤 phase는 그대로이고 즉시 distrust에는 통계 항목이 없으며, 전체 Vitest suite/typecheck/lint에 새 오류가 없다.

- [ ] **Step 5: 두 번째 커밋을 만든다.**

```bash
git add lib/rules/campaign-statistics.ts lib/rules/campaign-statistics.test.ts
git commit -m "기능: 정산 통계 누적 규칙을 추가한다" -m "C4 정산 결과를 중복 없이 누적하고 C7 정산 직후 조합 경계를 검증한다."
```

## Self-Review

### Spec coverage

| Spec requirement | Plan task |
| --- | --- |
| C7 결과를 재계산 없이 단 한 번 소비 | Task 2 reducer와 C7 조합 테스트 |
| `cleared/wiped`, 3인 파티, 실제 사망 판정 | Task 2 fixtures와 deathCount test |
| 원본/요약 이력 및 모든 집계값 | Task 1 contracts, Task 2 reducer |
| 유품을 포함한 정산 획득 골드와 지출 보류 | Task 2 wipe test와 Global Constraints |
| 1~15 고정 던전 순서와 최고 클리어 | Task 1 slot/domain test, Task 2 order test |
| 중복·손상 상태 거부 및 불변성 | Task 2 error/structuredClone tests |
| C7 phase 비소유와 distrust 제외 | Task 1 C7 regression, Task 2 C7 조합 테스트 |
| C8-B·I1·U6 비구현 | Global Constraints와 Task 2의 C7 비수정 조건 |
| B1 관측값의 정의 유지 | Global Constraints: C8-A는 규칙 상수를 변경하지 않음 |

### Placeholder scan

미정 지시어 없이 모든 task에 파일, 공개 인터페이스, 실패 테스트, 실행 명령,
최소 구현, 통과 검증, 커밋을 적었다.

### Type consistency

- Task 1이 `CampaignDungeonOrder`, `CampaignStatistics`, `SettlementSummary`,
  `createCampaignStatistics`를 domain barrel에 export한다.
- Task 2가 이 타입들과 C4 `SettlementResult`를 소비하여
  `recordSettlementStatistics`를 export한다.
- Task 2의 조합 회귀는 기존 C7 `CampaignTransitionResult.settlement`만 소비하며
  C7의 public contract를 변경하지 않는다.
