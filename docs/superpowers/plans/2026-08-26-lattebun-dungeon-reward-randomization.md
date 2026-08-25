# 던전 계약 보상 랜덤화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 위험도별 기존 기대값을 유지하면서 공고마다 명성과 골드를 독립 균등 추첨하고, 계약 당시 확정값을 게시판부터 정산까지 일관되게 사용한다.

**Architecture:** 보상 범위·생존 비율 계산은 새 순수 도메인 모듈이 소유하고, `createBoardOffers`가 공고별 결정적 RNG 키로 `BoardOffer.reward`를 만든다. 계약된 보상은 `ActiveExpeditionContext.offer`에서 `SettlementSnapshot.contractReward`로 복사해 검증하며, U3와 백테스트는 공고의 확정값을 읽고 U6은 미래 보상을 더 이상 표현하지 않는다.

**Tech Stack:** TypeScript 5, Next.js 16.3.0, React 19.2.8, Zustand 5.0.14, Vitest 4.1.10, Playwright 1.62.1, pnpm 11.21.0

**Spec:** `docs/superpowers/specs/2026-08-26-lattebun-dungeon-reward-randomization-design.md`

## Global Constraints

- `BoardOffer.reward`와 `SettlementSnapshot.contractReward`는 모두 3명 생존 기준 `ContractReward`다.
- 위험도별 명성/골드 범위는 ★1 `5~7/10~14`, ★2 `9~11/16~24`, ★3 `13~17/27~37`, ★4 `19~23/40~50`, ★5 `25~31/54~66`이며 양끝을 포함한다.
- 명성과 골드는 같은 백분위로 묶지 않고 RNG 정수 추첨을 각각 한 번씩 수행한다.
- 공고 RNG 기본 키는 `${campaign.seed}/offer-reward/${campaign.worldTurn}/${dungeon.id}/risk-${dungeon.riskLevel}`다.
- 생존 비율은 3명 `100%`, 2명 `60%`, 1명 `30%`, 0명 `0%`이고 명성·골드별로 `Math.floor`한다.
- 전멸 명성 손실은 `contractReward.reputation`, 계약 골드는 0이며 유품·명성 하한·위험도 상승/★5 상한은 유지한다.
- 게시판은 확정 보상만 보여주고 범위·확률을 표시하지 않는다. U6은 다음 공고 보상·범위·예상값을 표시하지 않는다.
- 잠금 공고에도 보상을 생성한다. 서로 다른 입력이 우연히 같은 보상을 내는 것은 정상이다.
- 잘못된 snapshot 보상을 평균값이나 위험도 표로 대체하지 않고 `INVALID_SETTLEMENT` 또는 `INVALID_TRANSITION`으로 거부한다.
- 보상 범위·비율·승급 문턱은 백테스트 결과를 보고 자동 조정하지 않는다. 2,000시드 holdout은 실행하지 않는다.
- 기존 미추적 `.omo/`, `dungeon-schemer-handoff.md`, `public/assets/characters/dungeon_schemer_characters_20_transparent/`를 수정·추가·삭제하거나 커밋하지 않는다.
- 모든 커밋은 제목과 본문을 한글로 작성한다.
- Windows PowerShell 실행 정책을 피하기 위해 검증 명령은 `pnpm.cmd`를 사용한다.
- UI 작업 전에 `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`, 테스트 작업 전에 `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`와 `playwright.md`를 읽는다. 이번 변경은 라우팅·데이터 패칭·서버/클라이언트 경계를 바꾸지 않는다.

---

### Task 1: 백테스트 자원·승급 관측치와 변경 전 기준선

**Files:**
- Modify: `lib/backtest/metrics.ts:682-692`
- Modify: `lib/backtest/metrics.test.ts:148-166`
- Modify: `lib/backtest/report.ts:188-263, 327-390`
- Modify: `lib/backtest/report.test.ts:130-166`
- Generate: `docs/technical/BACKTEST_REPORT.md`
- Runtime artifacts outside repository: `%TEMP%/dungeon-schemer-reward-randomization/baseline-{50,100,200}.md`

**Interfaces:**
- Consumes: 기존 `CampaignRunMetrics.finalReputation`, `finalGold`, `contractGold`, `relicGold`, `cumulativeGold`, `reputationPromotions`, `goldPromotions`.
- Produces: `CombinationAggregate.means`의 `finalReputation`, `finalGold`, `contractGold`, `relicGold`, `cumulativeGold`, `reputationPromotions`, `goldPromotions`; 보고서의 `자원과 승급 방식` 표; 보상 변경 전 50·100·200시드 기준선.

- [ ] **Step 1: 집계 누락을 드러내는 실패 테스트 작성**

`lib/backtest/metrics.test.ts`의 fixture 두 개를 값이 다른 run으로 만들고 다음 검사를 추가한다.

```ts
const aggregate = aggregateRuns([
  metric({ finalReputation: 40, finalGold: 20, contractGold: 10, relicGold: 5, cumulativeGold: 15, reputationPromotions: 1, goldPromotions: 0 }),
  metric({ finalReputation: 60, finalGold: 40, contractGold: 30, relicGold: 15, cumulativeGold: 45, reputationPromotions: 0, goldPromotions: 2 }),
]).combinations["survival@0.7"]!;

expect(aggregate.means).toMatchObject({
  finalReputation: 50,
  finalGold: 30,
  contractGold: 20,
  relicGold: 10,
  cumulativeGold: 30,
  reputationPromotions: 0.5,
  goldPromotions: 1,
});
```

fixture helper의 전략·정확도는 두 run 모두 `survival@0.7`로 고정한다.

- [ ] **Step 2: 집계 테스트가 실패하는지 확인**

Run:

```powershell
pnpm.cmd exec vitest run lib/backtest/metrics.test.ts
```

Expected: FAIL. `means.finalReputation` 또는 새 평균 필드가 `undefined`다.

- [ ] **Step 3: 자원·승급 평균을 최소 구현**

`aggregateCombination`의 `means`를 다음 필드까지 확장한다.

```ts
means: {
  totalExpeditions: sum((run) => run.totalExpeditions),
  totalDeaths: sum((run) => run.totalDeaths),
  aliveCount: sum((run) => run.aliveCount),
  deployableCount: sum((run) => run.deployableCount),
  zeroTrustCount: sum((run) => run.zeroTrustCount),
  gravelyWoundedCount: sum((run) => run.gravelyWoundedCount),
  finalReputation: sum((run) => run.finalReputation),
  finalGold: sum((run) => run.finalGold),
  contractGold: sum((run) => run.contractGold),
  relicGold: sum((run) => run.relicGold),
  cumulativeGold: sum((run) => run.cumulativeGold),
  reputationPromotions: sum((run) => run.reputationPromotions),
  goldPromotions: sum((run) => run.goldPromotions),
  betrayalAttempts: sum((run) => run.betrayalAttempts),
},
```

- [ ] **Step 4: 보고서 실패 테스트 작성**

`lib/backtest/report.test.ts`에서 `renderBacktestReport` 결과에 다음 표제와 열이 있는지 검사한다.

```ts
expect(report).toContain("## 자원과 승급 방식");
expect(report).toContain("평균 최종 명성");
expect(report).toContain("평균 계약 골드");
expect(report).toContain("평균 명성 승급");
expect(report).toContain("평균 골드 승급");
expect(report).toMatch(/\| survival \| 0\.7 \|/);
```

- [ ] **Step 5: 보고서 테스트가 실패하는지 확인**

Run:

```powershell
pnpm.cmd exec vitest run lib/backtest/report.test.ts
```

Expected: FAIL. `자원과 승급 방식` 절이 없다.

- [ ] **Step 6: 보고서 자원·승급 표 구현**

`renderBacktestReport`에 `resourceRows`를 만들고 각 조합을 소수점 네 자리로 기록한다.

```ts
resourceRows.push(
  `| ${strategy} | ${accuracy} | ${combination.means.finalReputation.toFixed(4)} | ${combination.means.finalGold.toFixed(4)} | ${combination.means.contractGold.toFixed(4)} | ${combination.means.relicGold.toFixed(4)} | ${combination.means.cumulativeGold.toFixed(4)} | ${combination.means.reputationPromotions.toFixed(4)} | ${combination.means.goldPromotions.toFixed(4)} |`,
);
```

`승급 도달과 평균 최초 도달 원정` 바로 앞에 다음 절을 삽입한다.

```ts
"## 자원과 승급 방식",
"",
"| 전략 | 정확도 | 평균 최종 명성 | 평균 최종 골드 | 평균 계약 골드 | 평균 유품 골드 | 평균 누적 골드 | 평균 명성 승급 | 평균 골드 승급 |",
"| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
...resourceRows,
"",
```

- [ ] **Step 7: 관측치 테스트 통과 확인**

Run:

```powershell
pnpm.cmd exec vitest run lib/backtest/metrics.test.ts lib/backtest/report.test.ts
```

Expected: PASS.

- [ ] **Step 8: 임시 artifact 경로를 검증해 생성**

Run:

```powershell
$rewardArtifacts = Join-Path ([System.IO.Path]::GetTempPath()) 'dungeon-schemer-reward-randomization'
$resolvedArtifacts = [System.IO.Path]::GetFullPath($rewardArtifacts)
$resolvedTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
if (-not $resolvedArtifacts.StartsWith($resolvedTemp, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'artifact 경로가 임시 디렉터리 밖이다' }
New-Item -ItemType Directory -Force -Path $resolvedArtifacts | Out-Null
```

Expected: `%TEMP%/dungeon-schemer-reward-randomization`이 존재한다.

- [ ] **Step 9: 변경 전 50·100·200시드 risk-curve 기준선 생성**

아래 반복문으로 세 표본을 실행하고 각각의 보고서를 별도 artifact로 보존한다.

```powershell
$rewardArtifacts = Join-Path ([System.IO.Path]::GetTempPath()) 'dungeon-schemer-reward-randomization'
try {
  $env:B1_SOURCE_REVISION = 'reward-randomization-baseline'
  $env:B1_BACKTEST_MODE = 'calibration'
  $env:B1_BACKTEST_FOCUS = 'risk-curve'
  foreach ($seedCount in 50, 100, 200) {
    $env:B1_BACKTEST_SEEDS = [string]$seedCount
    pnpm.cmd exec vitest run --config vitest.backtest.config.ts
    if ($LASTEXITCODE -ne 0) { throw "baseline $seedCount 시드 백테스트 실패" }
    Copy-Item -LiteralPath 'docs/technical/BACKTEST_REPORT.md' -Destination (Join-Path $rewardArtifacts "baseline-$seedCount.md") -Force
  }
} finally {
  Remove-Item Env:B1_SOURCE_REVISION, Env:B1_BACKTEST_MODE, Env:B1_BACKTEST_FOCUS, Env:B1_BACKTEST_SEEDS -ErrorAction SilentlyContinue
}
```

Expected: 세 실행 모두 강제 risk-curve gate를 통과하고 세 baseline 파일이 생성된다. 관측(`OBSERVE`) gate 실패는 보고서에 그대로 남는다.

- [ ] **Step 10: 기준선과 관측 코드 커밋**

Run:

```powershell
git add lib/backtest/metrics.ts lib/backtest/metrics.test.ts lib/backtest/report.ts lib/backtest/report.test.ts docs/technical/BACKTEST_REPORT.md
git commit -m "백테스트: 보상 자원과 승급 기준선을 남긴다" -m "전략별 최종 자원과 계약·유품 골드, 명성·골드 승급 평균을 보고서에 추가한다. 랜덤 보상 적용 전 50·100·200시드 기준선을 보존한다."
```

Expected: 사용자 미추적 파일을 포함하지 않는 새 커밋이 생성된다.

### Task 2: 계약 보상 도메인 원형

**Files:**
- Create: `lib/domain/contract-reward.ts`
- Modify: `lib/domain/index.ts:68-84`
- Modify: `lib/domain/contract.test.ts:1-176`

**Interfaces:**
- Consumes: `RiskLevel`, 생존 인원 `0 | 1 | 2 | 3`.
- Produces: `ContractReward`, `IntegerRange`, `ContractRewardRange`, `CONTRACT_REWARD_RANGES`, `contractRewardForSurvivors(fullReward, survivors)`, `isContractRewardInRange(riskLevel, reward)`.

- [ ] **Step 1: 범위·기대값·생존 비율 실패 테스트 작성**

`lib/domain/contract.test.ts`에 다음 검사를 추가한다.

```ts
it("위험도별 보상 범위의 중심은 기존 기대값이다", () => {
  const expected = [
    [1, 6, 12], [2, 10, 20], [3, 15, 32], [4, 21, 45], [5, 28, 60],
  ] as const;
  for (const [risk, reputation, gold] of expected) {
    const range = CONTRACT_REWARD_RANGES[risk];
    expect((range.reputation.min + range.reputation.max) / 2).toBe(reputation);
    expect((range.gold.min + range.gold.max) / 2).toBe(gold);
  }
});

it("확정 보상에 100%·60%·30%를 자원별로 버림 적용한다", () => {
  const full = { reputation: 16, gold: 35 };
  expect(contractRewardForSurvivors(full, 3)).toEqual({ reputation: 16, gold: 35 });
  expect(contractRewardForSurvivors(full, 2)).toEqual({ reputation: 9, gold: 21 });
  expect(contractRewardForSurvivors(full, 1)).toEqual({ reputation: 4, gold: 10 });
  expect(contractRewardForSurvivors(full, 0)).toEqual({ reputation: 0, gold: 0 });
});

it("정수이고 해당 위험도 양끝 안인 확정 보상만 허용한다", () => {
  expect(isContractRewardInRange(3, { reputation: 13, gold: 37 })).toBe(true);
  expect(isContractRewardInRange(3, { reputation: 12, gold: 37 })).toBe(false);
  expect(isContractRewardInRange(3, { reputation: 13.5, gold: 32 })).toBe(false);
});
```

기존 `rewardForSurvivors(3, survivors)` 테스트는 아직 삭제하지 않는다. Task 5까지 기존 정산 경로의 호환성을 유지한다.

- [ ] **Step 2: 새 도메인 테스트 실패 확인**

Run:

```powershell
pnpm.cmd exec vitest run lib/domain/contract.test.ts
```

Expected: FAIL. 새 모듈의 export가 없다.

- [ ] **Step 3: `contract-reward.ts` 최소 구현**

```ts
import type { RiskLevel } from "./dungeon";

export interface ContractReward {
  readonly reputation: number;
  readonly gold: number;
}

export interface IntegerRange {
  readonly min: number;
  readonly max: number;
}

export interface ContractRewardRange {
  readonly reputation: IntegerRange;
  readonly gold: IntegerRange;
}

export const CONTRACT_REWARD_RANGES: Readonly<Record<RiskLevel, ContractRewardRange>> = {
  1: { reputation: { min: 5, max: 7 }, gold: { min: 10, max: 14 } },
  2: { reputation: { min: 9, max: 11 }, gold: { min: 16, max: 24 } },
  3: { reputation: { min: 13, max: 17 }, gold: { min: 27, max: 37 } },
  4: { reputation: { min: 19, max: 23 }, gold: { min: 40, max: 50 } },
  5: { reputation: { min: 25, max: 31 }, gold: { min: 54, max: 66 } },
};

const SURVIVOR_FACTORS = [0, 0.3, 0.6, 1] as const;

export function contractRewardForSurvivors(
  fullReward: ContractReward,
  survivors: 0 | 1 | 2 | 3,
): ContractReward {
  const factor = SURVIVOR_FACTORS[survivors];
  return {
    reputation: Math.floor(fullReward.reputation * factor),
    gold: Math.floor(fullReward.gold * factor),
  };
}

export function isContractRewardInRange(
  riskLevel: RiskLevel,
  reward: ContractReward,
): boolean {
  const range = CONTRACT_REWARD_RANGES[riskLevel];
  return Number.isSafeInteger(reward.reputation)
    && Number.isSafeInteger(reward.gold)
    && reward.reputation >= range.reputation.min
    && reward.reputation <= range.reputation.max
    && reward.gold >= range.gold.min
    && reward.gold <= range.gold.max;
}
```

`lib/domain/index.ts`에서 상수·함수와 세 타입을 export한다.

- [ ] **Step 4: 도메인 테스트와 타입 검사**

Run:

```powershell
pnpm.cmd exec vitest run lib/domain/contract.test.ts
pnpm.cmd typecheck
```

Expected: PASS. 기존 고정 보상 API도 아직 존재한다.

- [ ] **Step 5: 도메인 원형 커밋**

Run:

```powershell
git add lib/domain/contract-reward.ts lib/domain/index.ts lib/domain/contract.test.ts
git commit -m "도메인: 계약 보상 범위와 생존 비율을 정의한다" -m "위험도별 독립 추첨 범위와 기존 기대값을 명시한다. 확정 보상의 100·60·30퍼센트 계산과 범위 검증을 순수 함수로 제공한다."
```

### Task 3: 결정적 공고 보상 생성

**Files:**
- Modify: `lib/domain/campaign.ts:124-136`
- Modify: `lib/domain/contract.test.ts:177-190`
- Modify: `lib/rules/board.ts:1-17, 218-234`
- Modify: `lib/rules/board.test.ts:65-200`
- Modify: `lib/rules/ending.test.ts:190-206`

**Interfaces:**
- Consumes: Task 2의 `ContractReward`, `CONTRACT_REWARD_RANGES`와 기존 `Rng.int(min, max)`.
- Produces: 필수 `BoardOffer.reward`; `rollContractReward(riskLevel, rng)`; `createOfferReward(campaign, dungeon)`; 모든 생성 공고의 결정적 확정 보상.

- [ ] **Step 1: RNG 두 번 호출과 공고 보상 실패 테스트 작성**

`lib/rules/board.test.ts`에 다음 테스트를 추가한다.

테스트 import에는 `rollContractReward`, `isContractRewardInRange`를 추가한다.

```ts
it("명성과 골드를 각자의 범위에서 한 번씩 독립 추첨한다", () => {
  const calls: Array<readonly [number, number]> = [];
  const rng = {
    int(min: number, max: number) {
      calls.push([min, max]);
      return calls.length === 1 ? max : min;
    },
  };
  expect(rollContractReward(3, rng)).toEqual({ reputation: 17, gold: 27 });
  expect(calls).toEqual([[13, 17], [27, 37]]);
});

it("모든 공고 보상은 범위 안이고 같은 입력에서 재현된다", () => {
  const state = initializeCampaign("offer-reward-repro");
  const first = createBoardOffers(state);
  const second = createBoardOffers(state);
  expect(second.map((offer) => offer.reward)).toEqual(first.map((offer) => offer.reward));
  for (const offer of first) {
    expect(isContractRewardInRange(offer.riskLevel, offer.reward)).toBe(true);
  }
});

it("잠금 공고도 확정 보상을 가진다", () => {
  const initial = initializeCampaign("offer-reward-locked");
  const state = {
    ...initial,
    dungeons: initial.dungeons.map((dungeon) => dungeon.riskLevel <= 2
      ? { ...dungeon, status: "cleared" as const }
      : dungeon),
  };
  const offers = createBoardOffers(state);
  expect(offers.every((offer) => offer.lockReason === "rankTooLow")).toBe(true);
  expect(offers.every((offer) => isContractRewardInRange(offer.riskLevel, offer.reward))).toBe(true);
});
```

- [ ] **Step 2: 게시판 테스트 실패 확인**

Run:

```powershell
pnpm.cmd exec vitest run lib/rules/board.test.ts lib/domain/contract.test.ts
```

Expected: FAIL. `BoardOffer.reward`, `rollContractReward`, `createOfferReward`가 없다.

- [ ] **Step 3: 공고 보상 생성 함수 구현**

`lib/rules/board.ts`에 다음 경계를 추가한다.

```ts
export function rollContractReward(
  riskLevel: RiskLevel,
  rng: Pick<Rng, "int">,
): ContractReward {
  const range = CONTRACT_REWARD_RANGES[riskLevel];
  return {
    reputation: rng.int(range.reputation.min, range.reputation.max),
    gold: rng.int(range.gold.min, range.gold.max),
  };
}

export function createOfferReward(
  campaign: Pick<CampaignState, "seed" | "worldTurn">,
  dungeon: Pick<CampaignDungeon, "id" | "riskLevel">,
): ContractReward {
  const key = `${campaign.seed}/offer-reward/${campaign.worldTurn}/${dungeon.id}/risk-${dungeon.riskLevel}`;
  return rollContractReward(dungeon.riskLevel, createRng(key));
}
```

`createBoardOffers`의 반환 객체에 다음 필드를 넣는다.

```ts
reward: createOfferReward(state, dungeon),
```

`lib/domain/campaign.ts`의 `BoardOffer`에 `reward: ContractReward`를 추가하고 타입 import를 연결한다.

- [ ] **Step 4: 직접 만든 BoardOffer fixture 갱신**

`lib/domain/contract.test.ts`의 공고 fixture에는 위험도 1 범위 안의 다음 값을 추가한다.

```ts
reward: { reputation: 6, gold: 12 },
```

`lib/rules/ending.test.ts`의 `BoardOffer[]` fixture에는 각 dungeon에 대해 다음을 사용한다.

```ts
reward: createOfferReward(campaign, dungeon),
```

`lib/rules/campaign-transition.test.ts`의 잠금 공고는 기존 생성 공고를 spread하므로 추가 수정 없이 필드를 보존하는지 확인한다.

- [ ] **Step 5: 참조 독립성과 승급 재생성 회귀 보강**

기존 재현성 테스트에 다음을 추가한다.

```ts
expect(second[0]?.reward).not.toBe(first[0]?.reward);
```

같은 월드턴에 등급만 바꾼 두 게시판의 공통 던전을 찾아 보상이 같은지 검사한다.

```ts
const promoted = createBoardOffers({ ...state, rank: "B" });
let commonDungeonCount = 0;
for (const offer of first) {
  const sameDungeon = promoted.find((candidate) => candidate.dungeonId === offer.dungeonId);
  if (sameDungeon !== undefined) {
    commonDungeonCount += 1;
    expect(sameDungeon.reward).toEqual(offer.reward);
  }
}
expect(commonDungeonCount).toBeGreaterThan(0);
```

월드턴과 위험도가 오른 다음 게시판은 새 위험도 범위의 보상을 생성하는지도 검사한다. 위험도 2와 3의 범위가 겹치지 않으므로 이 fixture에서는 값도 반드시 달라진다.

```ts
const target = state.dungeons.find((dungeon) => dungeon.riskLevel === 2)!;
const currentState = {
  ...state,
  dungeons: state.dungeons.map((dungeon) => dungeon.id === target.id
    ? { ...dungeon, status: "unexplored" as const, riskLevel: 2 as const }
    : { ...dungeon, status: "cleared" as const }),
};
const currentOffer = createBoardOffers(currentState)[0]!;
const nextState = {
  ...currentState,
  worldTurn: currentState.worldTurn + 1,
  dungeons: currentState.dungeons.map((dungeon) => dungeon.id === target.id
    ? { ...dungeon, riskLevel: 3 as const }
    : dungeon),
};
const nextOffer = createBoardOffers(nextState)[0]!;
expect(isContractRewardInRange(2, currentOffer.reward)).toBe(true);
expect(isContractRewardInRange(3, nextOffer.reward)).toBe(true);
expect(nextOffer.reward).not.toEqual(currentOffer.reward);
```

- [ ] **Step 6: 게시판·엔딩·타입 검사 통과 확인**

Run:

```powershell
pnpm.cmd exec vitest run lib/domain/contract.test.ts lib/rules/board.test.ts lib/rules/ending.test.ts lib/rules/campaign-transition.test.ts
pnpm.cmd typecheck
```

Expected: PASS.

- [ ] **Step 7: 공고 생성 커밋**

Run:

```powershell
git add lib/domain/campaign.ts lib/domain/contract.test.ts lib/rules/board.ts lib/rules/board.test.ts lib/rules/ending.test.ts
git commit -m "기능: 공고마다 확정 보상을 생성한다" -m "던전과 월드턴에 묶인 결정적 키로 명성과 골드를 독립 추첨한다. 잠금 공고와 승급 재생성도 같은 확정 보상 계약을 따른다."
```

### Task 4: 게시판 UI와 백테스트 공개 상태의 확정 보상 소비

**Files:**
- Modify: `components/game/u3-board-model.ts:1-96, 145-188`
- Modify: `components/game/u3-board-model.test.ts:1-58`
- Modify: `lib/backtest/public-state.ts:1-60, 125-145`
- Modify: `lib/backtest/public-state.test.ts:27-43`
- Test: `components/game/U3BoardScreen.test.tsx`
- Test: `lib/backtest/strategies.test.ts`

**Interfaces:**
- Consumes: Task 3의 `BoardOffer.reward`, Task 2의 `contractRewardForSurvivors`.
- Produces: `contractOutcomesForReward(fullReward)`; U3 카드·상세의 확정값; `PublicOfferView.fullSurvivorReward`에 복사된 실제 공고 보상.

- [ ] **Step 1: U3가 위험도 대신 확정 보상을 쓰는 실패 테스트 작성**

`components/game/u3-board-model.test.ts`의 첫 두 테스트를 다음 계약으로 교체한다.

```ts
it("확정 보상으로 생존 인원별 계약 결과를 계산한다", () => {
  expect(contractOutcomesForReward({ reputation: 16, gold: 35 })).toEqual([
    { survivors: 3, label: "전원 생존 시", reputation: 16, gold: 35, reputationLoss: 0 },
    { survivors: 2, label: "2명 생존 시", reputation: 9, gold: 21, reputationLoss: 0 },
    { survivors: 1, label: "1명 생존 시", reputation: 4, gold: 10, reputationLoss: 0 },
    { survivors: 0, label: "전원 사망 시", reputation: 0, gold: 0, reputationLoss: 16 },
  ]);
});

it("게시판 카드와 상세가 공고의 확정 보상을 그대로 쓴다", () => {
  const campaign = initializeCampaign("u3-confirmed-reward");
  const source = createBoardOffers(campaign)[0]!;
  const offer = { ...source, reward: { reputation: 11, gold: 23 } };
  const board = createU3BoardView(campaign, [offer]);
  expect(board.notices[0]).toMatchObject({ reputationReward: 11, goldReward: 23 });
  expect(board.detailsByOfferId[offer.id]?.contractOutcomes[0]).toMatchObject({ reputation: 11, gold: 23 });
});
```

- [ ] **Step 2: 백테스트 projection 실패 테스트 작성**

`lib/backtest/public-state.test.ts`의 게시판 테스트에 다음을 추가한다.

```ts
const source = store.getState().campaign.offers[0]!;
expect(view.offers[0]?.fullSurvivorReward).toEqual(source.reward);
expect(view.offers[0]?.fullSurvivorReward).not.toBe(source.reward);
```

- [ ] **Step 3: U3와 projection 테스트 실패 확인**

Run:

```powershell
pnpm.cmd exec vitest run components/game/u3-board-model.test.ts lib/backtest/public-state.test.ts
```

Expected: FAIL. 두 소비자가 아직 위험도로 고정 보상을 재계산한다.

- [ ] **Step 4: U3 계산 경계 변경**

`contractOutcomesForRisk(riskLevel)`을 다음 함수로 교체한다.

```ts
export function contractOutcomesForReward(
  fullReward: ContractReward,
): readonly U3ContractOutcomeView[] {
  const full = contractRewardForSurvivors(fullReward, 3);
  const two = contractRewardForSurvivors(fullReward, 2);
  const one = contractRewardForSurvivors(fullReward, 1);
  return [
    { survivors: 3, label: "전원 생존 시", reputation: full.reputation, gold: full.gold, reputationLoss: 0 },
    { survivors: 2, label: "2명 생존 시", reputation: two.reputation, gold: two.gold, reputationLoss: 0 },
    { survivors: 1, label: "1명 생존 시", reputation: one.reputation, gold: one.gold, reputationLoss: 0 },
    { survivors: 0, label: "전원 사망 시", reputation: 0, gold: 0, reputationLoss: full.reputation },
  ];
}
```

`createU3BoardView`에서는 `fullReward` 재계산을 제거하고 `offer.reward`를 카드와 `contractOutcomesForReward(offer.reward)`에 전달한다.

- [ ] **Step 5: 백테스트 공개 상태 변경**

`PublicOfferView.fullSurvivorReward` 타입을 `ContractReward`로 바꾸고 `publicOffer`에서 다음처럼 복사한다.

```ts
fullSurvivorReward: { ...offer.reward },
```

전략 비교기 `lib/backtest/strategies.ts`는 이미 `fullSurvivorReward.reputation`과 `.gold`를 읽으므로 계산 로직은 변경하지 않는다.

- [ ] **Step 6: U3·공개 상태·전략 회귀 확인**

Run:

```powershell
pnpm.cmd exec vitest run components/game/u3-board-model.test.ts components/game/U3BoardScreen.test.tsx lib/backtest/public-state.test.ts lib/backtest/strategies.test.ts
pnpm.cmd typecheck
```

Expected: PASS. 위험도만 같은 두 공고도 공개 보상으로 비교된다.

- [ ] **Step 7: 소비자 전환 커밋**

Run:

```powershell
git add components/game/u3-board-model.ts components/game/u3-board-model.test.ts lib/backtest/public-state.ts lib/backtest/public-state.test.ts
git commit -m "기능: 게시판과 전략이 확정 보상을 읽는다" -m "U3 생존 결과표와 백테스트 공개 상태가 위험도 재계산을 중단한다. 공고에 기록된 명성과 골드를 그대로 표시하고 비교한다."
```

### Task 5: 계약 보상 snapshot과 정산 검증

**Files:**
- Modify: `lib/domain/settlement.ts:1-50`
- Modify: `lib/rules/campaign-transition.ts:238-260, 748-784, 837-850`
- Modify: `lib/rules/campaign-transition.test.ts:41-58, 180-275`
- Modify: `lib/rules/settlement.ts:1-70, 112-170`
- Modify: `lib/rules/settlement.test.ts:1-130`
- Modify: `lib/rules/campaign-history.test.ts:390-425`
- Modify: `lib/rules/campaign-statistics.test.ts:100-126`
- Modify: `components/game/u6-preview-data.ts:220-270`
- Modify: `components/game/u6-preview-data.test.ts:1-80`

**Interfaces:**
- Consumes: `ActiveExpeditionContext.offer.reward`, `contractRewardForSurvivors`, `isContractRewardInRange`, `createOfferReward`.
- Produces: 필수 `SettlementSnapshot.contractReward`; snapshot/활성 공고 일치 검증; 확정 보상 기반 `reputationDelta`와 `goldDelta`.

- [ ] **Step 1: 확정 보상 정산 실패 테스트 작성**

`lib/rules/settlement.test.ts`의 `snapshotFixture`가 기본 `contractReward`를 받게 하고, 기존 위험도 3 지급 테스트를 `{ reputation: 16, gold: 35 }` 기준으로 바꾼다.

```ts
const contractReward = over.contractReward ?? createOfferReward(campaign, dungeon);
return {
  expeditionId: "expedition-settlement-test",
  dungeonId: dungeon.id,
  contractRisk: dungeon.riskLevel,
  contractReward,
  party: { memberIds: members.map((member) => member.id) },
  finalMembers: members,
  status: "cleared",
  causeInputs: { choice: "선택", reactions: "반응", damage: "피해" },
  ...over,
};
```

```ts
it.each([
  [3, 16, 35], [2, 9, 21], [1, 4, 10],
] as const)("%i명 생존은 계약 확정 보상 비율을 적용한다", (survivors, reputation, gold) => {
  const snapshot = snapshotFixture(campaign, {
    contractRisk: 3,
    contractReward: { reputation: 16, gold: 35 },
    finalMembers,
  });
  expect(settleExpedition(campaign, snapshot).result).toMatchObject({ reputationDelta: reputation, goldDelta: gold });
});
```

전멸 테스트는 `contractReward: { reputation: 11, gold: 23 }`을 넣고 `reputationDelta: -11`을 기대한다.

- [ ] **Step 2: 변조·범위 밖 snapshot 실패 테스트 작성**

```ts
it("계약 위험도 범위 밖 보상은 INVALID_SETTLEMENT로 거부한다", () => {
  const campaign = campaignFixture();
  expect(() => settleExpedition(campaign, snapshotFixture(campaign, {
    contractRisk: 2,
    contractReward: { reputation: 15, gold: 20 },
  }))).toThrowError(expect.objectContaining({ code: "INVALID_SETTLEMENT" }));
});
```

`lib/rules/campaign-transition.test.ts`에는 활성 공고 보상을 1 올린 snapshot이 `INVALID_TRANSITION`인지 검사한다.

```ts
const snapshot = snapshotFor(expedition.campaign, expedition.context);
expect(() => transitionCampaign(expedition.campaign, expedition.context, {
  type: "COMPLETE_EXPEDITION",
  snapshot: {
    ...snapshot,
    contractReward: { ...snapshot.contractReward, reputation: snapshot.contractReward.reputation + 1 },
  },
})).toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }));
```

- [ ] **Step 3: 정산·전이 테스트 실패 확인**

Run:

```powershell
pnpm.cmd exec vitest run lib/rules/settlement.test.ts lib/rules/campaign-transition.test.ts
```

Expected: FAIL. snapshot 필드와 검증이 없고 정산이 위험도로 재계산한다.

- [ ] **Step 4: snapshot 타입·복사·전이 검증 구현**

`SettlementSnapshot`에 다음 필드를 추가한다.

```ts
readonly contractReward: ContractReward;
```

`createSettlementSnapshotFor`는 다음처럼 활성 공고 보상을 복사한다.

```ts
contractReward: { ...active.offer.reward },
```

`copyActiveExpedition`도 공고를 복사할 때 다음 필드를 추가한다.

```ts
reward: { ...offer.reward },
```

`validateSnapshot`은 위험도·파티 검사와 함께 두 숫자를 비교한다.

```ts
const rewardMatches = snapshot.contractReward.reputation === active.offer.reward.reputation
  && snapshot.contractReward.gold === active.offer.reward.gold;
if (!rewardMatches) invalidTransition("정산 계약 보상이 활성 공고와 다르다");
```

- [ ] **Step 5: 정산 범위 검증과 확정값 계산 구현**

`validateSettlement`에 다음 검사를 추가한다.

```ts
if (!isContractRewardInRange(snapshot.contractRisk, snapshot.contractReward)) {
  invalid("계약 보상이 위험도 범위를 벗어났다", {
    contractRisk: snapshot.contractRisk,
    contractReward: snapshot.contractReward,
  });
}
```

`settleExpedition`의 보상 계산을 다음으로 교체한다.

```ts
const fullReward = contractRewardForSurvivors(snapshot.contractReward, 3);
const clearReward = contractRewardForSurvivors(snapshot.contractReward, survivorCount);
```

이 Task에서는 `nextReward`와 기존 고정 보상 API를 아직 제거하지 않는다. Task 6에서 UI와 동시에 제거해 중간 커밋의 타입·테스트를 통과시킨다.

- [ ] **Step 6: 모든 직접 snapshot fixture에 계약 보상 연결**

- `lib/rules/campaign-transition.test.ts`, `campaign-history.test.ts`, `campaign-statistics.test.ts`: `contractReward: { ...active.offer.reward }`.
- `components/game/u6-preview-data.ts`의 `playedThrough`: `contractReward: createOfferReward(current, target)`.
- 같은 파일의 `settlementFor`: 현재 dungeon을 찾고 `contractReward: createOfferReward(input.campaign, contractDungeon)`.
- 직접 보상을 쓰는 테스트 fixture는 해당 `contractRisk` 범위 안의 값을 사용한다.

- [ ] **Step 7: snapshot 생성 참조 독립성 검사**

`createSettlementSnapshotFor`를 사용하는 전이 테스트에 다음을 추가한다.

```ts
const snapshot = createSettlementSnapshotFor(campaign, active);
expect(snapshot.contractReward).toEqual(active.offer.reward);
expect(snapshot.contractReward).not.toBe(active.offer.reward);
```

- [ ] **Step 8: 정산·전이·프리뷰 회귀 확인**

Run:

```powershell
pnpm.cmd exec vitest run lib/rules/settlement.test.ts lib/rules/campaign-transition.test.ts lib/rules/campaign-transition-expedition.test.ts lib/rules/campaign-history.test.ts lib/rules/campaign-statistics.test.ts components/game/u6-preview-data.test.ts
pnpm.cmd typecheck
```

Expected: PASS. 실제 증감은 snapshot의 확정 보상과 일치한다.

- [ ] **Step 9: 정산 snapshot 커밋**

Run:

```powershell
git add lib/domain/settlement.ts lib/rules/campaign-transition.ts lib/rules/campaign-transition.test.ts lib/rules/settlement.ts lib/rules/settlement.test.ts lib/rules/campaign-history.test.ts lib/rules/campaign-statistics.test.ts components/game/u6-preview-data.ts components/game/u6-preview-data.test.ts
git commit -m "기능: 계약 보상을 정산 스냅샷에 고정한다" -m "활성 공고 보상을 스냅샷으로 복사하고 변조와 범위 밖 값을 거부한다. 생존 보상과 전멸 명성 손실을 계약 당시 확정값으로 계산한다."
```

### Task 6: 미래 보상 계약과 U6 표시 제거

**Files:**
- Modify: `lib/domain/settlement.ts:1-28, 65-80`
- Modify: `lib/domain/index.ts:68-84`
- Modify: `lib/domain/contract.test.ts:155-176`
- Modify: `lib/rules/settlement.ts:1-18, 154-170`
- Modify: `lib/rules/settlement.test.ts:50-120`
- Modify: `lib/rules/campaign-history.test.ts:66-90`
- Modify: `lib/rules/campaign-statistics.test.ts:56-85, 170-190`
- Modify: `components/game/u6-settlement-model.ts:1-48, 95-108`
- Modify: `components/game/u6-settlement-model.test.ts:10-90`
- Modify: `components/game/U6SettlementScreen.tsx:125-145`
- Modify: `components/game/U6SettlementScreen.test.ts:17-80`
- Modify: `components/game/u6-preview-data.test.ts:25-44`
- Modify: `app/u6-result.css:165-220`

**Interfaces:**
- Consumes: Task 5의 실제 `reputationDelta`, `goldDelta`, `riskBefore`, `riskAfter`.
- Produces: `SettlementResult`와 `U6SettlementView`에서 `nextReward`가 제거된 최종 계약; 미래 보상 문구·전용 CSS가 없는 U6.

- [ ] **Step 1: 미래 보상 부재 실패 테스트 작성**

`components/game/U6SettlementScreen.test.ts`의 재도전 보상 테스트를 다음으로 교체한다.

```ts
it("전멸 정산은 아직 생성되지 않은 다음 보상을 보여주지 않는다", () => {
  const html = render({ survivors: 0, riskBefore: 2, riskAfter: 3 });
  expect(html).not.toContain("이 던전을 다시 맡으면");
  expect(html).not.toContain("3명 생환 기준");
  expect(html).not.toContain("다음 계약 보상");
});
```

`components/game/u6-settlement-model.test.ts`와 `u6-preview-data.test.ts`에는 다음 검사를 둔다.

```ts
expect(createU6SettlementView(result(), "묘지 1", "graveyard")).not.toHaveProperty("nextReward");
expect(wipe).not.toHaveProperty("nextReward");
```

- [ ] **Step 2: U6 테스트 실패 확인**

Run:

```powershell
pnpm.cmd exec vitest run components/game/u6-settlement-model.test.ts components/game/U6SettlementScreen.test.ts components/game/u6-preview-data.test.ts
```

Expected: FAIL. 모델과 화면이 아직 `nextReward`를 보존한다.

- [ ] **Step 3: 도메인·정산의 미래 보상 제거**

- `SettlementResult.nextReward` 필드를 삭제한다.
- `settleExpedition` 결과 객체의 `nextReward` 계산을 삭제한다.
- `Reward`, `FULL_SURVIVOR_REWARDS`, 기존 `rewardForSurvivors(risk, survivors)`를 `lib/domain/settlement.ts`와 `lib/domain/index.ts`에서 삭제한다.
- 기존 도메인 테스트는 Task 2의 `contractRewardForSurvivors` 테스트만 남긴다.
- `campaign-history.test.ts`, `campaign-statistics.test.ts`, `settlement.test.ts`의 `SettlementResult` fixture에서 `nextReward`를 삭제한다.

- [ ] **Step 4: U6 모델·화면·스타일 제거**

- `U6SettlementView.nextReward`와 adapter 복사를 삭제한다.
- U6 fixture의 `nextReward`를 삭제한다.
- `U6SettlementScreen.tsx`의 `u6-next-reward` 문단과 그 설명 주석을 삭제한다.
- `app/u6-result.css`의 `.u6-next-reward` 세 규칙을 삭제한다.
- 위험도 변화, 이번 계약 증감, 유품, 원인 사슬은 그대로 둔다.

- [ ] **Step 5: 레거시 검색과 집중 테스트**

Run:

```powershell
rg -n "nextReward|FULL_SURVIVOR_REWARDS|rewardForSurvivors|u6-next-reward|이 던전을 다시 맡으면" lib components app
pnpm.cmd exec vitest run lib/domain/contract.test.ts lib/rules/settlement.test.ts lib/rules/campaign-history.test.ts lib/rules/campaign-statistics.test.ts components/game/u6-settlement-model.test.ts components/game/U6SettlementScreen.test.ts components/game/u6-preview-data.test.ts
pnpm.cmd typecheck
```

Expected: `rg` 결과 0건, 모든 테스트와 타입 검사 PASS.

- [ ] **Step 6: 미래 보상 제거 커밋**

Run:

```powershell
git add lib/domain/settlement.ts lib/domain/index.ts lib/domain/contract.test.ts lib/rules/settlement.ts lib/rules/settlement.test.ts lib/rules/campaign-history.test.ts lib/rules/campaign-statistics.test.ts components/game/u6-settlement-model.ts components/game/u6-settlement-model.test.ts components/game/U6SettlementScreen.tsx components/game/U6SettlementScreen.test.ts components/game/u6-preview-data.test.ts app/u6-result.css
git commit -m "변경: 정산의 미래 보상 표시를 제거한다" -m "다음 공고가 생성되기 전에는 보상이 존재하지 않는 계약을 반영한다. 정산 결과와 U6 화면에서 nextReward와 관련 문구·스타일을 삭제한다."
```

### Task 7: 계약부터 정산까지 통합·재현성 회귀

**Files:**
- Modify: `components/game/campaign-render.test.tsx:155-185`
- Modify: `lib/store/campaign-reproducibility.test.ts:1-90`
- Modify: `lib/rules/campaign-transition.test.ts:175-310`
- Test: `lib/store/campaign-store.test.ts`
- Test: `lib/store/campaign-full-run.test.ts`

**Interfaces:**
- Consumes: Task 3~6의 최종 `BoardOffer.reward → SettlementSnapshot.contractReward → SettlementResult` 흐름.
- Produces: 실제 화면·Store 한 바퀴·동일 시드 재실행에서 확정 보상이 유지된다는 회귀 증거.

- [ ] **Step 1: 실제 게시판 렌더 확정값 테스트 작성**

`components/game/campaign-render.test.tsx`의 게시판 테스트에서 view를 한 번 만들고 실제 공고 보상이 markup에 있는지 검사한다.

```ts
const board = createU3BoardView(campaign, campaign.offers);
const notice = board.notices[0]!;
const markup = renderToStaticMarkup(createElement(U3BoardScreen, {
  status: statusFor(campaign, null),
  board,
  selectedOfferId: notice.offerId,
  promotion: createU3PromotionView(getGuidePromotionEligibility(campaign), campaign.phase, last?.promotion ?? null),
  onSelectOffer: noop,
  onContract: noop,
  onOpenPromotion: noop,
  onCancelPromotion: noop,
  onConfirmPromotion: noop,
  onDismissPromotionResult: noop,
}));
expect(markup).toContain(String(notice.reputationReward));
expect(markup).toContain(String(notice.goldReward));
```

- [ ] **Step 2: 계약 snapshot 일치와 변조 거부 통합 테스트 보강**

`lib/rules/campaign-transition.test.ts`의 정상 정산 흐름에서 다음을 검사한다.

```ts
const snapshot = snapshotFor(expedition.campaign, expedition.context);
expect(snapshot.contractReward).toEqual(expedition.context.activeExpedition?.offer.reward);
const result = transitionCampaign(
  expedition.campaign,
  expedition.context,
  { type: "COMPLETE_EXPEDITION", snapshot },
);
expect(result.settlement?.reputationDelta).toBe(snapshot.contractReward.reputation);
expect(result.settlement?.goldDelta).toBe(snapshot.contractReward.gold);
```

fixture의 `finalMembers`는 세 명 모두 생존한 상태를 유지한다.

- [ ] **Step 3: 동일 시드 전체 흐름의 공고·정산 재현성 명시**

`lib/store/campaign-reproducibility.test.ts`에서 동일 seed 두 실행의 기존 전체 비교에 다음 명시 검사를 추가한다.

```ts
expect(first.store.getState().campaign.offers.map((offer) => offer.reward))
  .toEqual(second.store.getState().campaign.offers.map((offer) => offer.reward));
expect(first.settlement).toEqual(second.settlement);
```

- [ ] **Step 4: 통합 테스트 실행**

Run:

```powershell
pnpm.cmd exec vitest run components/game/campaign-render.test.tsx lib/rules/campaign-transition.test.ts lib/store/campaign-store.test.ts lib/store/campaign-reproducibility.test.ts lib/store/campaign-full-run.test.ts
```

Expected: PASS. 게시판 재렌더링과 전체 Store 순회가 보상을 바꾸지 않는다.

- [ ] **Step 5: 통합 회귀 커밋**

Run:

```powershell
git add components/game/campaign-render.test.tsx lib/rules/campaign-transition.test.ts lib/store/campaign-reproducibility.test.ts
git commit -m "테스트: 확정 보상의 전체 흐름을 검증한다" -m "실제 게시판 렌더와 계약 스냅샷, 정산, 다음 Store 상태가 같은 확정 보상을 사용하는지 확인한다. 동일 시드 전체 흐름의 재현성을 명시한다."
```

### Task 8: 전체 검증과 변경 후 백테스트

**Files:**
- Generate: `docs/technical/BACKTEST_REPORT.md`
- Verify: `docs/superpowers/specs/2026-08-26-lattebun-dungeon-reward-randomization-design.md`
- Verify: `docs/design/CORE_GAME_LOOP.md`
- Verify: `docs/systems/PROGRESSION_AND_ENDINGS.md`
- Verify: `docs/experience/SCREEN_LAYOUT.md`
- Verify: `docs/experience/ONBOARDING_AND_INTERFACE.md`
- Verify: `docs/technical/SCREEN_ADAPTER_CONTRACT.md`
- Verify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`
- Runtime artifacts outside repository: `%TEMP%/dungeon-schemer-reward-randomization/after-{50,100,200}.md`

**Interfaces:**
- Consumes: Task 1의 baseline 보고서 세 개와 Task 2~7의 최종 구현.
- Produces: 전체 자동 검증 결과, 변경 후 50·100·200시드 보고서, 기준선 diff, 최종 `BACKTEST_REPORT.md`.

- [ ] **Step 1: 레거시와 문서 계약 정적 검사**

Run:

```powershell
rg -n "nextReward|FULL_SURVIVOR_REWARDS|rewardForSurvivors|u6-next-reward|이 던전을 다시 맡으면" lib components app
rg -n "5~7|9~11|13~17|19~23|25~31|10~14|16~24|27~37|40~50|54~66" docs/superpowers/specs/2026-08-26-lattebun-dungeon-reward-randomization-design.md docs/systems/PROGRESSION_AND_ENDINGS.md
git diff --check
```

Expected: 첫 `rg` 결과 0건, 두 번째 `rg`는 spec과 공식 성장 문서의 동일 범위를 찾고 `git diff --check`는 오류가 없다.

- [ ] **Step 2: 집중 테스트 실행**

Run:

```powershell
pnpm.cmd exec vitest run lib/domain/contract.test.ts lib/rules/board.test.ts lib/rules/settlement.test.ts lib/rules/campaign-transition.test.ts components/game/u3-board-model.test.ts components/game/u6-settlement-model.test.ts components/game/U6SettlementScreen.test.ts lib/backtest/public-state.test.ts lib/backtest/strategies.test.ts lib/store/campaign-reproducibility.test.ts lib/store/campaign-full-run.test.ts
```

Expected: PASS.

- [ ] **Step 3: 전체 정적·단위·빌드 검증**

Run:

```powershell
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
```

Expected: 네 명령 모두 exit code 0.

- [ ] **Step 4: 실제 브라우저 회귀 실행**

Run:

```powershell
pnpm.cmd test:e2e
```

Expected: Playwright의 공개 경로·캠페인 스모크 테스트가 모두 PASS. 브라우저 바이너리가 없다는 오류만 발생하면 `pnpm.cmd test:e2e:install` 후 정확히 한 번 다시 실행한다.

- [ ] **Step 5: 변경 후 50·100·200시드 risk-curve 실행**

아래 반복문으로 세 표본을 실행하고 각 결과를 `after-50.md`, `after-100.md`, `after-200.md`로 복사한다.

```powershell
$rewardArtifacts = Join-Path ([System.IO.Path]::GetTempPath()) 'dungeon-schemer-reward-randomization'
try {
  $env:B1_SOURCE_REVISION = 'reward-randomization-after'
  $env:B1_BACKTEST_MODE = 'calibration'
  $env:B1_BACKTEST_FOCUS = 'risk-curve'
  foreach ($seedCount in 50, 100, 200) {
    $env:B1_BACKTEST_SEEDS = [string]$seedCount
    pnpm.cmd exec vitest run --config vitest.backtest.config.ts
    if ($LASTEXITCODE -ne 0) { throw "after $seedCount 시드 백테스트 실패" }
    Copy-Item -LiteralPath 'docs/technical/BACKTEST_REPORT.md' -Destination (Join-Path $rewardArtifacts "after-$seedCount.md") -Force
  }
} finally {
  Remove-Item Env:B1_SOURCE_REVISION, Env:B1_BACKTEST_MODE, Env:B1_BACKTEST_FOCUS, Env:B1_BACKTEST_SEEDS -ErrorAction SilentlyContinue
}
```

Expected: 실행 오류·비결정성 0건, `no-run-errors`와 `not-all-rank-s` PASS, 200시드 위험도 곡선 강제 gate PASS. 전체 캠페인 gate는 기존 정책대로 `OBSERVE`일 수 있다.

- [ ] **Step 6: 기준선과 변경 후 보고서 비교**

Run:

```powershell
$rewardArtifacts = Join-Path ([System.IO.Path]::GetTempPath()) 'dungeon-schemer-reward-randomization'
git diff --no-index -- (Join-Path $rewardArtifacts 'baseline-50.md') (Join-Path $rewardArtifacts 'after-50.md')
git diff --no-index -- (Join-Path $rewardArtifacts 'baseline-100.md') (Join-Path $rewardArtifacts 'after-100.md')
git diff --no-index -- (Join-Path $rewardArtifacts 'baseline-200.md') (Join-Path $rewardArtifacts 'after-200.md')
```

Expected: 차이가 있으면 exit code 1이 정상이다. 다음 항목의 전후 수치를 구현 handoff에 기록한다.

- B/A/S 도달률과 평균 최초 도달 원정
- 평균 최종 명성·골드, 계약 골드·유품 골드·누적 골드
- 평균 명성 승급·골드 승급 횟수
- 정상 완주·소진·실직·고발·불신 분포
- 생존·기회주의·선별적 배신 조합별 완주율과 전멸

숫자 변화만으로 범위나 비율을 조정하지 않는다. 강제 gate가 PASS에서 FAIL로 바뀌거나 오류·비결정성이 발생하면 이 Task를 중단하고 결과를 사용자에게 제시해 새 승인을 받는다.

- [ ] **Step 7: 공식 문서와 최종 보고서 일치 확인**

다음을 눈으로 대조한다.

- `PROGRESSION_AND_ENDINGS.md`의 범위·기대값과 `CONTRACT_REWARD_RANGES`.
- `CORE_GAME_LOOP.md`의 생성 시점과 `createOfferReward` 키.
- U3 문서의 확정값 표시와 `createU3BoardView`.
- U6 문서의 미래 보상 부재와 `SettlementResult`/`U6SettlementView`.
- `BACKTEST_REPORT.md`의 source revision이 `reward-randomization-after`이고 표본이 200인지.

Expected: 불일치 0건. 회의 기록과 과거 spec은 수정하지 않는다.

- [ ] **Step 8: 최종 보고서 커밋**

Run:

```powershell
git add docs/technical/BACKTEST_REPORT.md
git commit -m "검증: 랜덤 보상 백테스트를 갱신한다" -m "확정 보상 구현 뒤 50·100·200시드 결과를 기존 기준선과 비교한다. 최종 200시드 자원·승급·엔딩 분포와 강제 gate 결과를 공식 보고서에 남긴다."
```

- [ ] **Step 9: 최종 상태 확인**

Run:

```powershell
git status --short
git log -8 --format="%h %s%n%b"
```

Expected: 이 작업의 추적 파일은 모두 커밋돼 있고, 기존 사용자 미추적 파일만 남는다. 최근 커밋마다 한글 제목과 한글 본문이 있다.
