# B1 생존형 진행 정책 교정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 등급 잠금이 공개된 구간에서 생존형 백테스트가 현재 접근 가능한 최고 위험도를 먼저 공략하게 하고, 같은 시드의 교정 전후 종료·승급·잔여 던전 분포를 진단한다.

**Architecture:** 기존 `BoardDecisionView`의 공개 `promotion`과 공고 `lockReason`만 사용해 진행 잠금을 판정하고, `survivalOffer`의 위험도 정렬 방향만 조건부로 바꾼다. 먼저 metrics와 Markdown 보고서에 승급 도달 시점 및 종료 시 남은 위험도 분포를 추가해 현행 정책의 50·200시드 기준선을 보존한 다음, 전략 교정 후 동일한 calibration namespace로 재실행해 차이를 비교한다. 프로덕션 Store·전이·보상·승급·전투 설정과 acceptance 목표는 변경하지 않는다.

**Tech Stack:** TypeScript 5, Vitest 4, Zustand Campaign Store, pnpm 11, Markdown

**Spec:** `docs/superpowers/specs/2026-08-25-lattebun-b1-survival-progression-policy-design.md`

## Global Constraints

- 구현 시작 시 `superpowers:using-git-worktrees`로 격리된 feature branch와 worktree를 만든다.
- 진행 잠금은 `promotion !== null`이고, `lockReason === "rankTooLow"`이며 위험도가 `promotion.newlyUnlockedRiskLevel` 이상인 공개 공고가 있을 때만 성립한다.
- 진행 잠금 중에는 위험도 내림차순 → 파티 최소 HP 비율 내림차순 → 파티 최소 신뢰 내림차순 → 공고 ID 오름차순으로 고른다.
- 진행 잠금이 없거나 S등급이면 기존 위험도 오름차순 정렬을 유지한다.
- 명성·골드 보상은 생존형의 공고 비교 항목에 추가하지 않는다.
- 생존형 승급 결정은 공고 선택보다 먼저 적용하며 기존 명성·골드 승급 조건을 바꾸지 않는다.
- 선별적 배신형은 배신 후보가 없을 때만 교정된 생존형 정책을 재사용한다.
- `BoardDecisionView`에 필드를 추가하지 않고 숨은 미래 공고·조언 정답·전투 결과를 읽지 않는다.
- 보스·일반 몬스터·월드턴·보상·승급 요구치·던전 분포와 `B1B_RISK_CLEARANCE_TARGETS`를 변경하지 않는다.
- ★1 `85~90%`, ★2 `78~85%`, ★3 `70~78%`, ★4 `62~70%`, ★5 `55~65%`는 후속 밸런스 spec 전까지 코드에 적용하지 않는다.
- calibration은 기존 `b1b-calibration-v1` namespace의 동일한 50·200시드를 교정 전후에 사용한다.
- 이번 backtest는 기존 B1 gate 실패 때문에 비정상 종료할 수 있다. 보고서가 생성되고 `no-run-errors`가 통과하면 알려진 밸런스 gate 실패를 구현 오류로 오인하지 말고 실패 ID를 그대로 기록한다.
- holdout과 `pnpm backtest`는 실행하지 않는다.
- 생성되는 `docs/technical/BACKTEST_REPORT.md`는 비교용 결과물이며 직접 편집하거나 구현 커밋에 포함하지 않는다.
- 커밋 메시지는 제목과 본문을 모두 한글로 작성한다.
- `.pnpm-store/`와 `public/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/ASSET_MANIFEST.json`, `README.txt`를 수정하거나 스테이징하지 않는다.

## File Structure

| 파일 | 책임 |
| --- | --- |
| `lib/backtest/metrics.ts` | run 종료 시 남은 현재 위험도별 던전 수를 수집하고, 조합별 승급 도달·시점·잔여 던전 평균을 집계한다. |
| `lib/backtest/metrics.test.ts` | 남은 던전 분류와 조합 집계의 손계산 계약을 검증한다. |
| `lib/backtest/acceptance.test.ts` | 필수 `CampaignRunMetrics` fixture를 새 진단 필드와 동기화한다. |
| `lib/backtest/report.ts` | 조합별 승급 도달률·평균 도달 원정과 종료 시 평균 잔여 위험도 표를 생성한다. |
| `lib/backtest/report.test.ts` | 새 표의 내용과 입력 순서 무관 결정성을 검증한다. |
| `lib/backtest/strategies.ts` | 공개 등급 잠금 여부에 따라 생존형 위험도 정렬 방향을 선택한다. |
| `lib/backtest/strategies.test.ts` | 진행 잠금, 안전성 동률, S등급, 승급 우선, 배신 fallback 경계를 검증한다. |
| `docs/technical/BACKTEST_REPORT.md` | 실행으로 재생성되는 교정 후 보고서다. 커밋하지 않는다. |

---

### Task 1: 승급·잔여 던전 진단을 추가하고 교정 전 기준선을 보존한다

**Files:**
- Modify: `lib/backtest/metrics.ts`
- Modify: `lib/backtest/metrics.test.ts`
- Modify: `lib/backtest/acceptance.test.ts`
- Modify: `lib/backtest/report.ts`
- Modify: `lib/backtest/report.test.ts`
- Generated, do not commit: `docs/technical/BACKTEST_REPORT.md`

**Interfaces:**
- Consumes: `CampaignState.dungeons`, `CampaignDungeon.status`, `CampaignDungeon.riskLevel`, 기존 `CampaignRunMetrics.firstRankAtExpedition`
- Produces:

```ts
export interface CampaignRunMetrics {
  // 기존 필드 유지
  readonly remainingDungeonsByRisk: Readonly<Record<RiskLevel, number>>;
}

export interface CombinationAggregate {
  // 기존 필드 유지
  readonly rankReachedCounts: Readonly<Record<Exclude<GuideRank, "C">, number>>;
  readonly meanFirstRankAtExpedition: Readonly<Record<Exclude<GuideRank, "C">, number | null>>;
  readonly meanRemainingDungeonsByRisk: Readonly<Record<RiskLevel, number>>;
}
```

- [ ] **Step 1: run의 남은 던전 위험도 분류를 요구하는 실패 테스트를 쓴다**

`lib/backtest/metrics.test.ts`에 완료되지 않은 던전만 현재 `riskLevel`로 세는 테스트를 추가한다. 실제 캠페인 결과를 사용해 합계가 남은 던전 수와 같고, 완료 엔딩은 전부 0인지 검증한다.

```ts
it("종료 시 미클리어 던전을 현재 위험도별로 센다", () => {
  const run = runCampaign({
    seed: "metrics-remaining-risk",
    strategy: createStrategy("survival"),
    accuracy: 0.7,
  });
  const metrics = metricsForRun(run);
  const remaining = Object.values(metrics.remainingDungeonsByRisk)
    .reduce((sum, count) => sum + count, 0);

  if (run.ok) {
    expect(remaining).toBe(run.campaign.dungeons.filter((dungeon) => dungeon.status !== "cleared").length);
    for (const risk of [1, 2, 3, 4, 5] as const) {
      expect(metrics.remainingDungeonsByRisk[risk]).toBe(
        run.campaign.dungeons.filter((dungeon) => dungeon.status !== "cleared" && dungeon.riskLevel === risk).length,
      );
    }
  }
});
```

`metric()` fixture와 `lib/backtest/acceptance.test.ts`의 run fixture에는 기본값을 추가한다.

```ts
remainingDungeonsByRisk: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
```

- [ ] **Step 2: metrics 테스트가 새 필드 부재로 실패하는지 확인한다**

Run:

```bash
pnpm vitest run lib/backtest/metrics.test.ts lib/backtest/acceptance.test.ts
```

Expected: `remainingDungeonsByRisk`가 없거나 기대값과 달라 FAIL한다.

- [ ] **Step 3: run 단위 잔여 위험도 집계를 최소 구현한다**

`lib/backtest/metrics.ts`에 순수 helper를 추가하고 성공·실패 run 모두 실제 마지막 campaign을 사용한다.

```ts
function remainingDungeonsByRisk(campaign: CampaignState): Record<RiskLevel, number> {
  const counts: Record<RiskLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const dungeon of campaign.dungeons) {
    if (dungeon.status !== "cleared") counts[dungeon.riskLevel] += 1;
  }
  return counts;
}
```

`CampaignRunMetrics`에 필드를 선언하고 `baseFailure`와 `successfulMetrics` 반환값에 다음을 넣는다.

```ts
remainingDungeonsByRisk: remainingDungeonsByRisk(run.campaign),
```

성공 경로에서 지역 변수 `campaign`을 쓰는 경우에는 같은 helper에 그 값을 넘긴다.

- [ ] **Step 4: run 단위 테스트를 통과시킨다**

Run:

```bash
pnpm vitest run lib/backtest/metrics.test.ts lib/backtest/acceptance.test.ts
```

Expected: PASS.

- [ ] **Step 5: 조합별 승급·잔여 위험도 집계를 요구하는 실패 테스트를 쓴다**

`lib/backtest/metrics.test.ts`에 두 개의 손계산 run을 집계하는 테스트를 추가한다.

```ts
it("조합별 승급 도달과 종료 시 잔여 위험도 평균을 집계한다", () => {
  const aggregate = aggregateRuns([
    metric({
      seed: "progression/a",
      finalRank: "A",
      firstRankAtExpedition: { B: 3, A: 8 },
      remainingDungeonsByRisk: { 1: 0, 2: 1, 3: 2, 4: 3, 5: 1 },
    }),
    metric({
      seed: "progression/b",
      finalRank: "B",
      firstRankAtExpedition: { B: 5 },
      remainingDungeonsByRisk: { 1: 2, 2: 3, 3: 4, 4: 3, 5: 1 },
    }),
  ]).combinations["survival@0.7"]!;

  expect(aggregate.rankReachedCounts).toEqual({ B: 2, A: 1, S: 0 });
  expect(aggregate.meanFirstRankAtExpedition).toEqual({ B: 4, A: 8, S: null });
  expect(aggregate.meanRemainingDungeonsByRisk).toEqual({ 1: 1, 2: 2, 3: 3, 4: 3, 5: 1 });
});
```

- [ ] **Step 6: 집계 테스트가 새 aggregate 필드 부재로 실패하는지 확인한다**

Run:

```bash
pnpm vitest run lib/backtest/metrics.test.ts
```

Expected: `rankReachedCounts`, `meanFirstRankAtExpedition` 또는 `meanRemainingDungeonsByRisk`가 없어 FAIL한다.

- [ ] **Step 7: 조합 집계를 최소 구현한다**

`CombinationAggregate`에 세 필드를 추가하고 `aggregateCombination`에서 다음 규칙으로 계산한다.

```ts
const ranks = ["B", "A", "S"] as const;
const rankReachedCounts = Object.fromEntries(ranks.map((rank) => [
  rank,
  runs.filter((run) => run.firstRankAtExpedition[rank] !== undefined).length,
])) as Record<Exclude<GuideRank, "C">, number>;

const meanFirstRankAtExpedition = Object.fromEntries(ranks.map((rank) => {
  const values = runs.flatMap((run) => {
    const value = run.firstRankAtExpedition[rank];
    return value === undefined ? [] : [value];
  });
  return [rank, values.length === 0 ? null : values.reduce((total, value) => total + value, 0) / values.length];
})) as Record<Exclude<GuideRank, "C">, number | null>;

const meanRemainingDungeonsByRisk = Object.fromEntries(RISK_LEVELS.map((risk) => [
  risk,
  runs.reduce((total, run) => total + run.remainingDungeonsByRisk[risk], 0) / runs.length,
])) as Record<RiskLevel, number>;
```

세 값을 `CombinationAggregate` 반환 객체에 넣는다. 평균 승급 시점의 분모는 해당
등급에 실제 도달한 run만 사용한다.

- [ ] **Step 8: 집계 테스트를 통과시킨다**

Run:

```bash
pnpm vitest run lib/backtest/metrics.test.ts lib/backtest/acceptance.test.ts
```

Expected: PASS.

- [ ] **Step 9: 보고서 표를 요구하는 실패 테스트를 쓴다**

`lib/backtest/report.test.ts`의 결정성 테스트에서 생성된 Markdown에 새 절과 실제
조합 값이 있는지 추가 검증한다.

```ts
expect(report).toContain("## 승급 도달과 평균 최초 도달 원정");
expect(report).toContain("## 종료 시 평균 잔여 던전 위험도");
expect(report).toMatch(/\| survival \| 0\.7 \|/);
```

같은 테스트가 기존처럼 run 입력 순서를 뒤집어도 Markdown 전체가 동일한지 계속
비교하게 둔다.

- [ ] **Step 10: 보고서 테스트가 새 절 부재로 실패하는지 확인한다**

Run:

```bash
pnpm vitest run lib/backtest/report.test.ts
```

Expected: 새 Markdown heading을 찾지 못해 FAIL한다.

- [ ] **Step 11: 승급과 잔여 위험도 표를 최소 구현한다**

`lib/backtest/report.ts`에서 전략·정확도 고정 순회 중 다음 행을 만든다.

```ts
progressionRows.push(`| ${strategy} | ${accuracy} | ${rate(combination.rankReachedCounts.B, combination.count)} | ${nullable(combination.meanFirstRankAtExpedition.B)} | ${rate(combination.rankReachedCounts.A, combination.count)} | ${nullable(combination.meanFirstRankAtExpedition.A)} | ${rate(combination.rankReachedCounts.S, combination.count)} | ${nullable(combination.meanFirstRankAtExpedition.S)} |`);

remainingRiskRows.push(`| ${strategy} | ${accuracy} | ${([1, 2, 3, 4, 5] as const).map((risk) => combination.meanRemainingDungeonsByRisk[risk].toFixed(4)).join(" | ")} |`);
```

`renderBacktestReport`의 종료 사유 표 다음에 아래 두 절을 넣는다.

```md
## 승급 도달과 평균 최초 도달 원정

| 전략 | 정확도 | B 도달률 | B 평균 원정 | A 도달률 | A 평균 원정 | S 도달률 | S 평균 원정 |

## 종료 시 평균 잔여 던전 위험도

| 전략 | 정확도 | ★1 | ★2 | ★3 | ★4 | ★5 |
```

- [ ] **Step 12: 관련 테스트와 정적 검증을 통과시킨다**

Run:

```bash
pnpm vitest run lib/backtest/metrics.test.ts lib/backtest/acceptance.test.ts lib/backtest/report.test.ts
pnpm typecheck
```

Expected: 모두 PASS.

- [ ] **Step 13: 진단 지표 구현을 커밋한다**

```bash
git add lib/backtest/metrics.ts lib/backtest/metrics.test.ts lib/backtest/acceptance.test.ts lib/backtest/report.ts lib/backtest/report.test.ts
git commit -m "진단: 생존형 진행 지표를 보강한다" -m "승급 도달 시점과 종료 시 남은 위험도별 던전 수를 집계해 정책 교정 전후를 같은 기준으로 비교할 수 있게 한다."
```

- [ ] **Step 14: 교정 전 50시드 기준선을 생성하고 보존한다**

Run:

```bash
pnpm backtest:structure
```

Expected: `docs/technical/BACKTEST_REPORT.md`가 생성된다. 기존 강제 gate 때문에 명령은
FAIL할 수 있지만 보고서의 `no-run-errors`가 PASS이고 표본이 조합당 50인지 확인한다.

```bash
cp docs/technical/BACKTEST_REPORT.md /private/tmp/dungeon-schemer-b1-survival-before-50.md
```

- [ ] **Step 15: 교정 전 200시드 기준선을 생성하고 보존한다**

Run:

```bash
pnpm backtest:quick
```

Expected: 보고서가 조합당 200시드로 갱신된다. 명령의 gate 실패 여부와 실패 ID를
기록하고 `no-run-errors`가 PASS인지 확인한다.

```bash
cp docs/technical/BACKTEST_REPORT.md /private/tmp/dungeon-schemer-b1-survival-before-200.md
```

---

### Task 2: 생존형의 공개 진행 잠금 정책을 테스트 우선으로 교정한다

**Files:**
- Modify: `lib/backtest/strategies.ts`
- Modify: `lib/backtest/strategies.test.ts`

**Interfaces:**
- Consumes: 기존 `BoardDecisionView`, `PromotionEligibility.newlyUnlockedRiskLevel`, `PublicOfferView.lockReason`
- Produces: 기존 `StrategyPolicy.chooseOffer(view): OfferDecision` 시그니처를 유지하는 조건부 생존형 정렬

- [ ] **Step 1: 테스트 fixture가 승급·잠금 view를 간결하게 만들도록 확장한다**

`lib/backtest/strategies.test.ts`의 `board` helper에 선택적 override를 받게 한다.

```ts
const board = (
  offers: BoardDecisionView["offers"],
  overrides: Partial<BoardDecisionView> = {},
): BoardDecisionView => ({
  rank: "C",
  reputation: 30,
  gold: 100,
  cumulativeGold: 100,
  remainingDungeonCount: 5,
  offers,
  pool: [],
  promotion: null,
  ...overrides,
});
```

진행 잠금 fixture는 다음 값을 사용한다.

```ts
const cToBPromotion: NonNullable<BoardDecisionView["promotion"]> = {
  fromRank: "C",
  toRank: "B",
  newlyUnlockedRiskLevel: 3,
  reputationRequired: 60,
  goldRequired: 150,
  currentReputation: 30,
  currentGold: 100,
  canPromoteByReputation: false,
  canPromoteByGold: false,
};
```

- [ ] **Step 2: 진행 잠금 중 최고 위험도를 요구하는 실패 테스트를 쓴다**

```ts
it("생존형은 등급 잠금이 보이면 접근 가능한 최고 위험도를 먼저 고른다", () => {
  const locked = {
    ...offer("locked", 3, [member("locked-member", "mage")], 15, 32),
    lockReason: "rankTooLow" as const,
  };
  const chosen = createStrategy("survival").chooseOffer(board([
    offer("safe", 1, [member("safe-member", "warrior")], 6, 12),
    offer("frontier", 2, [member("frontier-member", "rogue")], 10, 20),
    locked,
  ], { promotion: cToBPromotion }));

  expect(chosen).toEqual({ offerId: "frontier", betrayal: false });
});
```

- [ ] **Step 3: 테스트가 기존 최저 위험도 선택으로 실패하는지 확인한다**

Run:

```bash
pnpm vitest run lib/backtest/strategies.test.ts
```

Expected: `safe`를 반환해 FAIL한다.

- [ ] **Step 4: 공개 진행 잠금 판정과 조건부 위험도 정렬을 최소 구현한다**

`lib/backtest/strategies.ts`에 다음 helper를 추가한다.

```ts
function hasProgressionLock(view: BoardDecisionView): boolean {
  const promotion = view.promotion;
  return promotion !== null && view.offers.some((offer) =>
    offer.lockReason === "rankTooLow"
    && offer.riskLevel >= promotion.newlyUnlockedRiskLevel,
  );
}
```

`survivalOffer`는 위험도 비교만 조건부로 바꾸고 나머지 비교기를 그대로 둔다.

```ts
function survivalOffer(view: BoardDecisionView): OfferDecision {
  const riskDirection = hasProgressionLock(view) ? -1 : 1;
  const chosen = [...accessibleOffers(view)].sort((left, right) =>
    riskDirection * (left.riskLevel - right.riskLevel)
    || minimumHpRatio(right.party) - minimumHpRatio(left.party)
    || minimumTrust(right.party) - minimumTrust(left.party)
    || String(left.id).localeCompare(String(right.id)),
  )[0];
  if (chosen === undefined) throw new Error("생존형이 고를 수 있는 공고가 없다");
  return { offerId: chosen.id, betrayal: false };
}
```

- [ ] **Step 5: 최고 위험도 테스트를 통과시킨다**

Run:

```bash
pnpm vitest run lib/backtest/strategies.test.ts
```

Expected: PASS.

- [ ] **Step 6: 같은 위험도의 안전성과 보상 비우선을 고정하는 테스트를 쓴다**

한 테스트에서 최고 위험도가 같은 후보들의 최소 HP 비율 → 최소 신뢰 → ID 순서를
각각 검증한다. 별도 후보에는 더 큰 명성·골드 보상을 주되 더 약한 파티이므로
선택되지 않게 한다.

```ts
it("진행 잠금 중 같은 위험도에서는 보상보다 최소 HP와 신뢰를 우선한다", () => {
  const locked = { ...offer("locked", 3, [member("l", "mage")], 15, 32), lockReason: "rankTooLow" as const };
  const chosen = createStrategy("survival").chooseOffer(board([
    offer("rich-hurt", 2, [member("a", "warrior", { hp: 8, maxHp: 20, trust: 90 })], 99, 99),
    offer("healthy-low-trust", 2, [member("b", "rogue", { trust: 20 })], 10, 20),
    offer("healthy-trusted", 2, [member("c", "mage", { trust: 70 })], 10, 20),
    locked,
  ], { promotion: cToBPromotion }));

  expect(chosen).toEqual({ offerId: "healthy-trusted", betrayal: false });
});
```

ID 동률은 모든 앞선 값이 같은 `a-offer`, `b-offer` fixture로 `a-offer`가 선택됨을
별도 assertion으로 고정한다.

- [ ] **Step 7: 잠금 없음과 S등급의 기존 최저 위험도 경계를 고정한다**

기존 “생존형은 저위험·건강·신뢰 순” 테스트를 유지하고 다음 S등급 사례를 추가한다.

```ts
it("S등급 생존형은 기존처럼 최저 위험도를 고른다", () => {
  const chosen = createStrategy("survival").chooseOffer(board([
    offer("safe", 1, [member("a", "warrior")], 6, 12),
    offer("dangerous", 5, [member("b", "mage")], 28, 60),
  ], { rank: "S", promotion: null }));

  expect(chosen).toEqual({ offerId: "safe", betrayal: false });
});
```

`promotion.newlyUnlockedRiskLevel`보다 낮은 인위적 rank 잠금 공고는 진행 잠금으로
취급하지 않아 최저 위험도를 유지하는 assertion도 추가한다. 같은 view에
`chooseOffer`를 두 번 호출한 결과를 비교해 결정성도 단위 수준에서 고정한다.

```ts
const policy = createStrategy("survival");
const irrelevantLocked = {
  ...offer("irrelevant-locked", 2, [member("c", "rogue")], 10, 20),
  lockReason: "rankTooLow" as const,
};
const view = board([
  offer("safe", 1, [member("a", "warrior")], 6, 12),
  offer("higher", 2, [member("b", "mage")], 10, 20),
  irrelevantLocked,
], { promotion: cToBPromotion });
expect(policy.chooseOffer(view)).toEqual({ offerId: "safe", betrayal: false });
expect(policy.chooseOffer(view)).toEqual(policy.chooseOffer(view));
```

- [ ] **Step 8: 승급 우선과 골드 조건이 유지되는지 검증한다**

명성 승급 가능한 fixture에서 `choosePromotion(view)`가 `"reputation"`을 반환하는
assertion을 추가한다. 기존 두 골드 승급 테스트는 수정 없이 통과시켜 진입 가능한
공고 수와 merchant reserve 계약이 바뀌지 않았음을 확인한다.

```ts
const view = board([
  offer("accessible", 2, [member("a", "warrior")], 10, 20),
], {
  reputation: 60,
  promotion: {
    ...cToBPromotion,
    currentReputation: 60,
    canPromoteByReputation: true,
  },
});
expect(createStrategy("survival").choosePromotion(view)).toBe("reputation");
```

- [ ] **Step 9: 선별적 배신형 fallback과 배신 후보 경계를 검증한다**

배신 capacity가 부족한 pool과 진행 잠금 공고를 만들어 `selective-betrayal`이
최고 접근 위험도를 `betrayal: false`로 고르는 테스트를 추가한다. 기존 “배신은
capacity와 중앙값 골드 조건을 모두 만족할 때만 잠근다” 테스트는 그대로 유지해
후보가 있을 때 `betrayal: true` 선택이 바뀌지 않음을 고정한다.

```ts
const safe = offer("safe", 1, [member("safe-party", "warrior")], 6, 12);
const frontier = offer("frontier", 2, [member("frontier-party", "mage")], 10, 20);
const locked = {
  ...offer("locked", 3, [member("locked-party", "rogue")], 15, 32),
  lockReason: "rankTooLow" as const,
};
expect(createStrategy("selective-betrayal").chooseOffer({
  ...board([safe, frontier, locked], { promotion: cToBPromotion }),
  pool: [member("only-warrior", "warrior")],
})).toEqual({ offerId: "frontier", betrayal: false });
```

- [ ] **Step 10: 전략 테스트와 전체 단위 검증을 통과시킨다**

Run:

```bash
pnpm vitest run lib/backtest/strategies.test.ts
pnpm test
pnpm typecheck
pnpm lint
```

Expected: 모두 PASS.

- [ ] **Step 11: 전략 교정을 커밋한다**

```bash
git add lib/backtest/strategies.ts lib/backtest/strategies.test.ts
git commit -m "수정: 생존형의 진행 잠금을 반영한다" -m "상위 위험도 공고가 등급에 잠긴 동안 현재 접근 가능한 최고 위험도를 먼저 선택하고, 같은 위험도에서는 파티 안전성을 우선하도록 백테스트 정책을 교정한다."
```

---

### Task 3: 같은 시드의 교정 후 결과를 재생성하고 완료 경계를 검증한다

**Files:**
- Verify: `lib/backtest/strategies.ts`
- Verify: `lib/backtest/metrics.ts`
- Verify: `lib/backtest/report.ts`
- Generated, do not commit: `docs/technical/BACKTEST_REPORT.md`
- Verify: `docs/README.md`
- Verify: `docs/superpowers/specs/2026-08-25-lattebun-b1-survival-progression-policy-design.md`

**Interfaces:**
- Consumes: `/private/tmp/dungeon-schemer-b1-survival-before-50.md`, `/private/tmp/dungeon-schemer-b1-survival-before-200.md`
- Produces: 동일 namespace의 교정 후 50·200시드 보고서와 PR 본문에 옮길 교정 전후 비교 요약

- [ ] **Step 1: 교정 후 50시드 구조 진단을 실행한다**

Run:

```bash
pnpm backtest:structure
```

Expected: 보고서가 생성되고 조합당 50시드, `no-run-errors` PASS다. 기존 밸런스
gate로 명령이 FAIL하면 실패 ID를 그대로 기록한다.

```bash
cp docs/technical/BACKTEST_REPORT.md /private/tmp/dungeon-schemer-b1-survival-after-50.md
```

- [ ] **Step 2: 50시드 교정 전후의 핵심 절을 비교한다**

Run:

```bash
diff -u /private/tmp/dungeon-schemer-b1-survival-before-50.md /private/tmp/dungeon-schemer-b1-survival-after-50.md
```

Expected: 명령은 차이가 있으면 exit 1이다. `종료 사유와 최종 풀 상태`, `승급
도달과 평균 최초 도달 원정`, `종료 시 평균 잔여 던전 위험도`, `엔딩·최종 등급
분포`의 `survival`과 `selective-betrayal` 행을 비교 메모에 기록한다. `opportunist`
행이 바뀌면 이번 변경의 범위 누수로 보고 원인을 조사한다.

- [ ] **Step 3: 교정 후 200시드 calibration을 실행한다**

Run:

```bash
pnpm backtest:quick
```

Expected: 보고서가 조합당 200시드로 갱신되고 `no-run-errors` PASS다. 기존 B1-B와
위험도별 gate의 PASS/FAIL을 그대로 보존한다.

```bash
cp docs/technical/BACKTEST_REPORT.md /private/tmp/dungeon-schemer-b1-survival-after-200.md
```

- [ ] **Step 4: 200시드 교정 전후를 비교하고 판정한다**

Run:

```bash
diff -u /private/tmp/dungeon-schemer-b1-survival-before-200.md /private/tmp/dungeon-schemer-b1-survival-after-200.md
```

Expected: 다음 항목을 정확한 건수·비율로 PR 본문에 정리한다.

- `survival@0.4`, `survival@0.7`: 완료·실직·인력 소진, B/A/S 도달률과 평균 도달 원정, 위험도별 평균 잔여 던전
- `selective-betrayal@0.4`, `selective-betrayal@0.7`: 같은 항목과 비배신 fallback 영향
- `opportunist@0.4`, `opportunist@0.7`: byte-for-byte 동일 여부 또는 차이가 있다면 원인
- 3전략 모두: run error와 결정성 gate
- 기존 B1-B·위험도별 gate의 남은 실패 ID

개선 폭을 맞추려고 전략 조건이나 프로덕션 수치를 추가 변경하지 않는다.

- [ ] **Step 5: 전체 검증을 새 출력으로 다시 실행한다**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
git diff --check
git status --short
```

Expected: 단위 테스트·typecheck·lint·diff check가 PASS한다. status에는 의도한
커밋 외에 `docs/technical/BACKTEST_REPORT.md` 생성 차이만 있을 수 있고 사용자 소유
미추적 파일은 그대로다.

- [ ] **Step 6: 생성 보고서를 커밋 대상에서 제외하고 변경 범위를 확인한다**

먼저 최종 보고서가 `/private/tmp/dungeon-schemer-b1-survival-after-200.md`에 보존됐는지
확인한 뒤, 이번 실행으로 생긴 tracked 보고서 변경만 되돌린다.

```bash
git restore docs/technical/BACKTEST_REPORT.md
git status --short
git diff --stat main...HEAD
git log --oneline main..HEAD
```

Expected: feature branch에는 진단 지표와 전략 교정 커밋만 남고
`docs/technical/BACKTEST_REPORT.md`는 없다. 사용자 소유 미추적 파일은 스테이징되지
않는다.

- [ ] **Step 7: 완료 전 독립 리뷰와 PR 준비로 넘긴다**

`superpowers:requesting-code-review`로 spec 충족·범위 누수·테스트 적절성을 검토받고,
수정이 생기면 관련 테스트부터 다시 실행한다. 이어서
`superpowers:verification-before-completion`으로 Step 5의 명령과 200시드 보고서의
`no-run-errors`를 새로 확인한다. 모두 확인된 뒤
`superpowers:finishing-a-development-branch`로 PR을 만들며, PR 본문에는 Step 4의
교정 전후 수치와 아직 실패하는 B1 gate, 새 목표 곡선이 후속 spec 범위라는 점을
명시한다.
