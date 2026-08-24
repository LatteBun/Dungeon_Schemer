# B1 현행 캠페인 백테스트 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실제 캠페인 Store를 3전략 × 2정확도로 재현 가능하게 실행하고, calibration 승인 뒤 별도 holdout으로 B1-A 통과 여부를 판정한다.

**Architecture:** 공개 정보 projection이 전략을 게임의 숨은 상태와 격리하고, 전략은 좁은 의도만 반환한다. 정확도 선택기가 조언 의도를 실제 선택지 ID로 바꾸며, headless driver가 그 결정을 실제 `CampaignTransition`으로 dispatch한다. 한 판 결과는 순수 집계기와 Markdown renderer를 거쳐 보고서가 된다.

**Tech Stack:** TypeScript 5, Zustand 5, Vitest 4, pnpm 11, 기존 `lib/domain`·`lib/rules`·`lib/store` API

**Spec:** `docs/superpowers/specs/2026-08-24-lattebun-b1-current-campaign-backtest-design.md`

## Global Constraints

- B1-A에서는 게임 규칙·상수·콘텐츠·화면 동작을 변경하지 않는다.
- 모든 캠페인은 `createCampaignStore`와 실제 프로덕션 액션으로 진행한다.
- 전략에는 공개 projection만 전달한다. `PreparedExpeditionEvents`, 조언 `outcome`, `relation`, effect, 미래 난수는 넘기지 않는다.
- calibration은 `b1-calibration-v1`, holdout은 `b1-holdout-v1` 시드 namespace를 쓴다.
- calibration은 조합당 200시드, holdout은 조합당 2,000시드다.
- 고정 hard gate만 코드에 먼저 넣는다. 조정 가능한 수치 기준은 calibration 결과를 보고 사용자가 승인하기 전까지 holdout config에 넣지 않는다.
- 실행 오류를 재시도하거나 제외하지 않는다. 생성 오류·전이 거부·잘못된 전략 결정·정체·800-step 초과·비결정성을 모두 실패로 기록한다.
- 원시 12,000판 상태나 전체 행동 로그는 커밋하지 않는다. 집계 보고서와 실패 재현 시드만 남긴다.
- 각 태스크의 커밋 제목과 본문은 한글로 작성한다.

## File Map

### 새 파일

- `lib/backtest/public-state.ts`: 전략 입력 타입, 공개 projection, merchant 최대 비용
- `lib/backtest/public-state.test.ts`: 숨은 정보 누출과 공개 값 projection 검사
- `lib/backtest/accuracy-selector.ts`: 정확도별 조언 ID 선택과 hit 기록
- `lib/backtest/accuracy-selector.test.ts`: 결정성·격리·실측 hit 검사
- `lib/backtest/strategies.ts`: 3전략, 파티 capacity, 배신 원정 잠금
- `lib/backtest/strategies.test.ts`: 공고·경로·조언·승급 정책 검사
- `lib/backtest/campaign-driver.ts`: 실제 Store 기반 단일 캠페인 실행기
- `lib/backtest/campaign-driver.test.ts`: 정상 종료·오류 분류·재현성 검사
- `lib/backtest/metrics.ts`: 한 판 결과, 조합 집계, Wilson·paired 통계, gate 판정
- `lib/backtest/metrics.test.ts`: 통계 공식·gate·실패 보존 검사
- `lib/backtest/report.ts`: 결정적 Markdown renderer
- `lib/backtest/report.test.ts`: 정렬·재현성·필수 절 검사
- `lib/backtest/backtest.run.ts`: quick/holdout 실행 entrypoint

### 변경 파일

- `lib/store/campaign-full-run.test.ts`: 자체 순회 루프를 공용 driver smoke test로 교체
- `vitest.backtest.config.ts`: timeout과 run 파일 실행 환경 고정
- `package.json`: `backtest:quick`, `backtest` 명령 분리
- `docs/technical/BACKTEST_REPORT.md`: calibration과 holdout 집계 보고서
- `docs/superpowers/specs/2026-08-24-lattebun-b1-current-campaign-backtest-design.md`: 승인된 수치 기준과 calibration 근거 추가
- `docs/systems/PROGRESSION_AND_ENDINGS.md`: 승인된 B1 기준 반영
- `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`: 최종 B1 판정과 다음 작업 기록
- `docs/README.md`: 보고서/계획 링크 확인 및 필요 시 설명 갱신

---

## Task 1: 공개 상태 계약과 projection을 만든다

**Files:**

- Create: `lib/backtest/public-state.ts`
- Create: `lib/backtest/public-state.test.ts`
- Read: `components/game/campaign-adapters.ts`
- Read: `lib/content/shared-merchant-events.ts`

**Interfaces:**

```ts
export type StrategyId = "survival" | "opportunist" | "selective-betrayal";
export type Accuracy = 0.4 | 0.7;
export type PublicNodeCategory = "rest" | "merchant" | "special" | "monster" | "boss";

export interface PublicMemberView {
  readonly id: CharacterId;
  readonly classId: ClassId;
  readonly personality: Personality;
  readonly hp: number;
  readonly maxHp: number;
  readonly trust: number;
  readonly gold: number;
  readonly alive: boolean;
  readonly gravelyWounded: boolean;
}

export interface PublicOfferView {
  readonly id: OfferId;
  readonly dungeonId: DungeonId;
  readonly dungeonName: string;
  readonly theme: ThemeId;
  readonly riskLevel: RiskLevel;
  readonly fullSurvivorReward: Reward;
  readonly lockReason: OfferLockReason | null;
  readonly party: readonly PublicMemberView[];
}

export interface BoardDecisionView {
  readonly rank: GuideRank;
  readonly reputation: number;
  readonly gold: number;
  readonly cumulativeGold: number;
  readonly remainingDungeonCount: number;
  readonly offers: readonly PublicOfferView[];
  readonly pool: readonly PublicMemberView[];
  readonly promotion: PromotionEligibility | null;
}

export interface MapDecisionView {
  readonly expeditionId: string;
  readonly betrayed: boolean;
  readonly currentNodeId: NodeId;
  readonly nextNodes: readonly { readonly id: NodeId; readonly category: PublicNodeCategory }[];
  readonly visitedNodeIds: readonly NodeId[];
  readonly bossNodeId: NodeId;
  readonly party: readonly PublicMemberView[];
  readonly campaignGold: number;
  readonly hasPendingMerchantEffect: boolean;
  readonly disclosedRuleIds: readonly RuleId[];
  readonly observations: readonly string[];
}

export interface AdviceDecisionView {
  readonly expeditionId: string;
  readonly betrayed: boolean;
  readonly category: PublicNodeCategory;
  readonly title: string;
  readonly description: string;
  readonly options: readonly PresentedAdviceOption[];
  readonly party: readonly PublicMemberView[];
  readonly campaignGold: number;
  readonly hasPendingMerchantEffect: boolean;
  readonly disclosedRuleIds: readonly RuleId[];
  readonly observations: readonly string[];
}

export function projectBoardDecision(campaign: CampaignState): BoardDecisionView;
export function projectMapDecision(campaign: CampaignState, active: ActiveExpeditionContext, betrayed: boolean): MapDecisionView;
export function projectAdviceDecision(campaign: CampaignState, active: ActiveExpeditionContext, betrayed: boolean): AdviceDecisionView;
export function maxMerchantGoldCost(): number;
```

- [ ] **Step 1: 숨은 정보가 공개 view에 없다는 실패 테스트를 작성한다**

```ts
it("조언 view에는 내부 판정 필드가 없다", () => {
  const { campaign, active } = campaignAtPendingEvent("public-boundary");
  const view = projectAdviceDecision(campaign, active, false);
  expect(view.options).toHaveLength(3);
  for (const option of view.options) {
    expect(Object.keys(option).sort()).toEqual(
      option.goldCost === undefined ? ["id", "label", "line"] : ["goldCost", "id", "label", "line"],
    );
    expect(option).not.toHaveProperty("outcome");
    expect(option).not.toHaveProperty("relation");
    expect(option).not.toHaveProperty("immediateEffect");
  }
  expect(view).not.toHaveProperty("preparedEvents");
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `pnpm vitest run lib/backtest/public-state.test.ts`

Expected: FAIL — `@/lib/backtest/public-state` 모듈이 없다.

- [ ] **Step 3: 공개 타입과 projection을 최소 구현한다**

```ts
function publicMember(member: Character): PublicMemberView {
  const { id, classId, personality, hp, maxHp, trust, gold, alive, gravelyWounded } = member;
  return { id, classId, personality, hp, maxHp, trust, gold, alive, gravelyWounded };
}

function presentedOption(option: BaseAdviceOption): PresentedAdviceOption {
  return "goldCost" in option
    ? { id: option.id, label: option.label, line: option.line, goldCost: option.goldCost }
    : { id: option.id, label: option.label, line: option.line };
}

export function maxMerchantGoldCost(): number {
  return Math.max(...SHARED_MERCHANT_EVENTS.flatMap((event) =>
    event.advice.map((advice) => advice.goldCost),
  ));
}
```

`projectMapDecision`은 trusted adapter로서 `active.preparedEvents`에서 UI가 공개하는 category만 꺼낸다. 역할 필드나 미방문 사건 내용은 반환하지 않는다. category 변환 규칙은 `campaign-adapters.ts`의 실제 UI 분류와 동일한 테스트 fixture로 고정한다.

- [ ] **Step 4: board·map·merchant 공개 값 테스트를 추가해 통과시킨다**

Run: `pnpm vitest run lib/backtest/public-state.test.ts`

Expected: PASS

- [ ] **Step 5: 타입검사를 실행한다**

Run: `pnpm typecheck`

Expected: PASS

- [ ] **Step 6: 커밋한다**

```bash
git add lib/backtest/public-state.ts lib/backtest/public-state.test.ts
git commit -m "백테스트: 전략 공개 정보 경계를 만든다" -m "게시판·지도·조언 projection에서 숨은 결과와 사건 계획을 제거한다. 공식 상인 콘텐츠에서 최대 비용도 계산한다."
```

---

## Task 2: 정확도 선택기를 게임 RNG와 분리한다

**Files:**

- Create: `lib/backtest/accuracy-selector.ts`
- Create: `lib/backtest/accuracy-selector.test.ts`

**Interfaces:**

```ts
export interface AccuracySelectionInput {
  readonly campaignSeed: string;
  readonly strategyId: StrategyId;
  readonly accuracy: Accuracy;
  readonly expeditionId: string;
  readonly decisionIndex: number;
  readonly intendedOutcome: AdviceOutcome;
  readonly options: readonly BaseAdviceOption[];
}

export interface AccuracySelection {
  readonly adviceId: ChoiceId;
  readonly intendedOutcome: AdviceOutcome;
  readonly selectedOutcome: AdviceOutcome;
  readonly hit: boolean;
}

export class InvalidStrategyDecisionError extends Error {}
export function selectAdviceByAccuracy(input: AccuracySelectionInput): AccuracySelection;
```

- [ ] **Step 1: 같은 입력의 결정성과 정확도 분리를 검사하는 실패 테스트를 쓴다**

```ts
it("정확도 선택은 순서와 게임 RNG 소비에 영향받지 않는다", () => {
  const input = selectionInput({ campaignSeed: "same", decisionIndex: 4 });
  const first = selectAdviceByAccuracy(input);
  createRng("same").derive("event").float();
  expect(selectAdviceByAccuracy(input)).toEqual(first);
  expect(selectAdviceByAccuracy({ ...input, decisionIndex: 5 })).not.toEqual(first);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run lib/backtest/accuracy-selector.test.ts`

Expected: FAIL — 함수가 없다.

- [ ] **Step 3: 전용 seed와 hit/miss 선택을 구현한다**

```ts
const BACKTEST_STREAM = "backtest-advice";

export function selectAdviceByAccuracy(input: AccuracySelectionInput): AccuracySelection {
  const rng = createRng([
    input.campaignSeed,
    BACKTEST_STREAM,
    input.strategyId,
    String(input.accuracy),
    input.expeditionId,
    String(input.decisionIndex),
  ].join("/"));
  const hit = rng.float() < input.accuracy;
  const intended = input.options.filter((one) => one.outcome === input.intendedOutcome);
  const missed = input.options.filter((one) => one.outcome !== input.intendedOutcome);
  const candidates = hit ? intended : missed;
  if (candidates.length === 0) throw new InvalidStrategyDecisionError("선택 가능한 조언 결과가 없다");
  const chosen = candidates[rng.int(0, candidates.length - 1)]!;
  return {
    adviceId: chosen.id,
    intendedOutcome: input.intendedOutcome,
    selectedOutcome: chosen.outcome,
    hit: chosen.outcome === input.intendedOutcome,
  };
}
```

- [ ] **Step 4: 10,000개 결정에서 0.4·0.7 실측률과 seed 재현성을 검사한다**

검사는 임의 허용 오차 대신 `wilsonInterval(hits, total, 3.2905267314919255)`가 목표 정확도를 포함하는지 확인한다. 이 상수는 99.9% 양측 신뢰구간의 z 값이다.

Run: `pnpm vitest run lib/backtest/accuracy-selector.test.ts`

Expected: PASS

- [ ] **Step 5: 커밋한다**

```bash
git add lib/backtest/accuracy-selector.ts lib/backtest/accuracy-selector.test.ts
git commit -m "백테스트: 조언 정확도 선택기를 분리한다" -m "전략·정확도·원정·결정 번호 전용 시드로 의도 적중과 실패 선택을 재현한다."
```

---

## Task 3: 세 전략과 선별적 배신 guard를 구현한다

**Files:**

- Create: `lib/backtest/strategies.ts`
- Create: `lib/backtest/strategies.test.ts`
- Read: `lib/rules/promotion.ts`
- Read: `lib/rules/settlement.ts`

**Interfaces:**

```ts
export interface StrategyPolicy {
  readonly id: StrategyId;
  chooseOffer(view: BoardDecisionView): OfferDecision;
  choosePromotion(view: BoardDecisionView): PromotionMethod | null;
  chooseNode(view: MapDecisionView): NodeId;
  chooseAdviceIntent(view: AdviceDecisionView): AdviceOutcome;
}

export interface OfferDecision {
  readonly offerId: OfferId;
  readonly betrayal: boolean;
}

export interface PartyCapacity {
  readonly normal: number;
  readonly emergency: number;
}

export function partyCapacityAfterHypotheticalWipe(
  pool: readonly PublicMemberView[],
  wipedIds: readonly CharacterId[],
): PartyCapacity;

export function createStrategy(id: StrategyId): StrategyPolicy;
export const STRATEGY_IDS: readonly StrategyId[];
```

- [ ] **Step 1: disjoint 3직업 파티 capacity의 실패 테스트를 쓴다**

```ts
it("같은 사람을 중복 사용하지 않고 정상·응급 파티 수를 센다", () => {
  const pool = capacityFixture();
  expect(partyCapacityAfterHypotheticalWipe(pool, ["warrior-1" as CharacterId])).toEqual({
    normal: 1,
    emergency: 2,
  });
});
```

- [ ] **Step 2: 실패를 확인하고 capacity를 구현한다**

Run: `pnpm vitest run lib/backtest/strategies.test.ts`

Expected: FAIL

구현은 후보 인원을 직업별 count로 만들고 가능한 서로 다른 3직업 조합을 하나씩 차감하는 완전 탐색을 사용한다. 풀은 30명이므로 memoized DFS면 충분하며 greedy로 근삿값을 내지 않는다.

```ts
function maximumDisjointParties(counts: ReadonlyMap<ClassId, number>): number {
  const classes = [...counts.keys()].sort();
  const triples = allClassTriples(classes);
  const visit = (remaining: readonly number[]): number => {
    const key = remaining.join(",");
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let best = 0;
    for (const triple of triples) {
      if (triple.every((index) => remaining[index]! > 0)) {
        const next = remaining.map((count, index) => count - (triple.includes(index) ? 1 : 0));
        best = Math.max(best, 1 + visit(next));
      }
    }
    memo.set(key, best);
    return best;
  };
  const memo = new Map<string, number>();
  return visit(classes.map((id) => counts.get(id) ?? 0));
}
```

- [ ] **Step 3: 생존형과 기회주의형 comparator·경로·승급 테스트를 쓴다**

```ts
it("생존형은 저위험·건강·신뢰 순으로 공고를 고른다", () => {
  expect(createStrategy("survival").chooseOffer(boardFixture())).toEqual({
    offerId: "safe-healthy" as OfferId,
    betrayal: false,
  });
});

it("기회주의형은 고위험·명성·골드 순으로 공고를 고른다", () => {
  expect(createStrategy("opportunist").chooseOffer(boardFixture())).toEqual({
    offerId: "rich-risky" as OfferId,
    betrayal: false,
  });
});
```

구현 우선순위:

```ts
const PATH_PRIORITY = {
  survival: ["rest", "merchant", "special", "monster", "boss"],
  opportunist: ["special", "merchant", "rest", "monster", "boss"],
  "selective-betrayal": ["monster", "special", "merchant", "rest", "boss"],
} as const;
```

기회주의형 merchant 의도는 다음 승급 비용과 `maxMerchantGoldCost()`를 함께 남길 수 없을 때 `neutral`, 그 외 `help`다. S 등급이면 승급 reserve를 적용하지 않는다.

- [ ] **Step 4: 선별적 배신 후보와 원정 단위 잠금 테스트를 쓴다**

```ts
it("전멸 뒤 응급 1파티와 장기 정상 2파티를 남기고 중앙값 이상 유품일 때만 잠근다", () => {
  const strategy = createStrategy("selective-betrayal");
  expect(strategy.chooseOffer(betrayalFixture({ emergency: 1, normal: 2, carriedGold: 90 })))
    .toEqual({ offerId: "betray-high-gold" as OfferId, betrayal: true });
  expect(strategy.chooseAdviceIntent(adviceFixture({ betrayed: true }))).toBe("harm");
  expect(strategy.chooseAdviceIntent(adviceFixture({ betrayed: false }))).toBe("help");
});
```

`remainingDungeonCount > 3`이면 `normal >= 2`, 아니면 정상 capacity 제한을 풀되 `emergency >= 1`은 항상 유지한다. 후보 공고의 파티 소지 골드는 접근 가능한 공고 파티 소지 골드 합의 중앙값 이상이어야 한다. 후보 중 골드 내림차순, 위험도 내림차순, ID 오름차순으로 고른다.

- [ ] **Step 5: 전체 전략 테스트와 타입검사를 통과시킨다**

Run: `pnpm vitest run lib/backtest/strategies.test.ts && pnpm typecheck`

Expected: PASS

- [ ] **Step 6: 커밋한다**

```bash
git add lib/backtest/strategies.ts lib/backtest/strategies.test.ts
git commit -m "백테스트: 세 가지 공개 정보 전략을 구현한다" -m "생존·기회주의·선별적 배신 정책과 전멸 뒤 파티 capacity guard를 고정한다."
```

---

## Task 4: 실제 Store 기반 단일 캠페인 driver를 만든다

**Files:**

- Create: `lib/backtest/campaign-driver.ts`
- Create: `lib/backtest/campaign-driver.test.ts`
- Modify: `lib/store/campaign-full-run.test.ts`

**Interfaces:**

```ts
export type RunErrorKind =
  | "generation"
  | "rejected-transition"
  | "invalid-strategy-decision"
  | "stall"
  | "step-limit"
  | "nondeterminism";

export interface CampaignRunTrace {
  readonly seed: string;
  readonly strategyId: StrategyId;
  readonly accuracy: Accuracy;
  readonly actionTypes: readonly CampaignTransition["type"][];
  readonly adviceSelections: readonly AccuracySelection[];
  readonly betrayalExpeditionIds: readonly string[];
  readonly betrayalCandidateCount: number;
  readonly nodeCategoryChoices: Readonly<Record<PublicNodeCategory, number>>;
  readonly intendedAdviceCounts: Readonly<Record<AdviceOutcome, number>>;
  readonly selectedAdviceCounts: Readonly<Record<AdviceOutcome, number>>;
  readonly reactionCounts: Readonly<Record<InfoReaction, number>>;
  readonly merchantGoldSpent: number;
  readonly merchantEffectsConsumed: number;
  readonly steps: number;
}

export interface CampaignRunSuccess {
  readonly ok: true;
  readonly campaign: CampaignState;
  readonly trace: CampaignRunTrace;
}

export interface CampaignRunFailure {
  readonly ok: false;
  readonly errorKind: RunErrorKind;
  readonly message: string;
  readonly phase: CampaignState["phase"];
  readonly trace: CampaignRunTrace;
}

export type CampaignRun = CampaignRunSuccess | CampaignRunFailure;

export interface CampaignRunOptions {
  readonly seed: string;
  readonly strategy: StrategyPolicy;
  readonly accuracy: Accuracy;
  readonly stepLimit?: number;
}

export function runCampaign(options: CampaignRunOptions): CampaignRun;
```

- [ ] **Step 1: 실제 액션을 밟아 엔딩에 도달하는 실패 테스트를 쓴다**

```ts
it("실제 Store 액션으로 캠페인을 끝낸다", () => {
  const result = runCampaign({
    seed: "driver-smoke",
    strategy: createStrategy("survival"),
    accuracy: 0.7,
  });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.campaign.phase).toBe("ended");
  expect(result.trace.actionTypes).toContain("COMPLETE_EXPEDITION");
  expect(result.trace.steps).toBeLessThanOrEqual(800);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run lib/backtest/campaign-driver.test.ts`

Expected: FAIL

- [ ] **Step 3: phase별 adapter를 구현한다**

핵심 dispatch 경계:

```ts
const act = (action: CampaignTransition): boolean => {
  store.getState().dispatch(action);
  const rejected = store.getState().rejected;
  if (rejected !== null) {
    failure = fail("rejected-transition", `${rejected.type}: ${rejected.reason}`);
    return false;
  }
  actionTypes.push(action.type);
  return true;
};
```

phase 처리 순서는 다음으로 고정한다.

```text
intro       → OPEN_BOARD
board       → 승급 결정 또는 SELECT_CONTRACT
promotion   → PROMOTE_GUIDE
contract    → createExpeditionForOffer + START_EXPEDITION
expedition  → CHOOSE_ADVICE / VISIT_NODE / ENTER_BOSS / COMPLETE_EXPEDITION
settlement  → START_WORLD_TURN
worldTurn   → COMPLETE_WORLD_TURN
ended       → 결과 반환
```

배신 여부는 공고 선택 순간 `Set<expeditionId>`에 잠그고 원정 도중 다시 평가하지 않는다. 조언마다 `decisionIndex`를 증가시킨다. 같은 phase·캠페인 snapshot·active 위치가 연속 반복되면 stall로 기록한다.

- [ ] **Step 4: 여섯 조합 smoke·step-limit·잘못된 전략·거부 분류 테스트를 통과시킨다**

Run: `pnpm vitest run lib/backtest/campaign-driver.test.ts`

Expected: PASS

- [ ] **Step 5: 기존 full-run 검사를 공용 driver로 옮긴다**

```ts
const runToEnd = (seed: string) => runCampaign({
  seed,
  strategy: createStrategy("survival"),
  accuracy: 0.7,
});
```

기존 검사의 의미인 엔딩 도달, 거부 없음, 여러 정산, 승급, 동일 시드 결정성, 40시드 막힘 없음은 유지한다. UI ending adapter 검사는 성공 결과의 `campaign`을 그대로 사용한다.

- [ ] **Step 6: 관련 회귀를 실행한다**

Run: `pnpm vitest run lib/backtest/campaign-driver.test.ts lib/store/campaign-full-run.test.ts`

Expected: PASS

- [ ] **Step 7: 커밋한다**

```bash
git add lib/backtest/campaign-driver.ts lib/backtest/campaign-driver.test.ts lib/store/campaign-full-run.test.ts
git commit -m "백테스트: 실제 캠페인 Store 실행기를 만든다" -m "전략 결정을 프로덕션 전이로 변환하고 오류·정체·step 제한을 재현 가능한 결과로 남긴다."
```

---

## Task 5: 한 판 지표와 통계 집계기를 만든다

**Files:**

- Create: `lib/backtest/metrics.ts`
- Create: `lib/backtest/metrics.test.ts`

**Interfaces:**

```ts
export interface CampaignRunMetrics {
  readonly seed: string;
  readonly strategyId: StrategyId;
  readonly accuracy: Accuracy;
  readonly ending: EndingKind | "run-error";
  readonly completed: boolean;
  readonly finalRank: GuideRank;
  readonly reachedRankS: boolean;
  readonly totalExpeditions: number;
  readonly clearedExpeditions: number;
  readonly wipedExpeditions: number;
  readonly totalDeaths: number;
  readonly aliveCount: number;
  readonly deployableCount: number;
  readonly zeroTrustCount: number;
  readonly gravelyWoundedCount: number;
  readonly finalReputation: number;
  readonly finalGold: number;
  readonly contractGold: number;
  readonly relicGold: number;
  readonly cumulativeGold: number;
  readonly meanTrust: number;
  readonly medianTrust: number;
  readonly meanHpRatio: number;
  readonly medianHpRatio: number;
  readonly reputationPromotions: number;
  readonly goldPromotions: number;
  readonly firstRankAtExpedition: Readonly<Partial<Record<Exclude<GuideRank, "C">, number>>>;
  readonly nodeCategoryChoices: Readonly<Record<PublicNodeCategory, number>>;
  readonly intendedAdviceCounts: Readonly<Record<AdviceOutcome, number>>;
  readonly selectedAdviceCounts: Readonly<Record<AdviceOutcome, number>>;
  readonly reactionCounts: Readonly<Record<InfoReaction, number>>;
  readonly betrayalAttempts: number;
  readonly betrayalWipes: number;
  readonly betrayalCompletions: number;
  readonly merchantGoldSpent: number;
  readonly merchantEffectsConsumed: number;
  readonly adviceHits: number;
  readonly adviceTotal: number;
  readonly errorKind: RunErrorKind | null;
}

export interface WilsonInterval {
  readonly low: number;
  readonly high: number;
}

export interface PairedDifference {
  readonly mean: number;
  readonly standardError: number;
  readonly low95: number;
  readonly high95: number;
}

export function metricsForRun(run: CampaignRun): CampaignRunMetrics;
export function wilsonInterval(successes: number, total: number, z?: number): WilsonInterval;
export function pairedMeanDifference(left: readonly number[], right: readonly number[]): PairedDifference;
export function aggregateRuns(runs: readonly CampaignRunMetrics[]): BacktestAggregate;
export class AggregationError extends Error {}
```

- [ ] **Step 1: settlement에서 계약 골드와 유품 골드를 분리하는 실패 테스트를 쓴다**

```ts
it("정산 원본에서 계약 보상과 전멸 유품을 따로 센다", () => {
  const run = successfulRunFixture([
    settlementFixture({ goldDelta: 12, relicGold: 0 }),
    settlementFixture({ goldDelta: 0, relicGold: 87 }),
  ]);
  expect(metricsForRun(run)).toMatchObject({ contractGold: 12, relicGold: 87 });
});
```

- [ ] **Step 2: 실패를 확인하고 한 판 지표를 구현한다**

Run: `pnpm vitest run lib/backtest/metrics.test.ts`

Expected: FAIL

```ts
const settlements = run.ok ? run.campaign.statistics.settlements : [];
const contractGold = settlements.reduce((sum, one) => sum + one.goldDelta, 0);
const relicGold = settlements.reduce((sum, one) => sum + one.relicGold, 0);
```

- [ ] **Step 3: Wilson과 paired mean 차이 공식의 실패 테스트를 쓴다**

```ts
it("Wilson 95% 구간의 알려진 값을 계산한다", () => {
  expect(wilsonInterval(50, 100)).toEqual({
    low: expect.closeTo(0.4038315304, 9),
    high: expect.closeTo(0.5961684696, 9),
  });
});

it("같은 seed 순서의 paired 차이와 95% CI를 계산한다", () => {
  expect(pairedMeanDifference([1, 3, 8], [0, 1, 5])).toMatchObject({ mean: 2 });
});
```

- [ ] **Step 4: 순수 통계 함수와 조합별 집계를 구현한다**

```ts
export function wilsonInterval(successes: number, total: number, z = 1.959963984540054): WilsonInterval {
  if (total <= 0 || successes < 0 || successes > total) throw new RangeError("유효하지 않은 비율 표본");
  const p = successes / total;
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total) / denominator;
  return { low: center - margin, high: center + margin };
}
```

paired 비교는 seed로 정렬·교집합 검증 후 차이 배열의 표본 표준편차를 사용한다. 표본 1개 이하는 명시적 RangeError로 거부한다.

- [ ] **Step 5: 집계·통계 테스트를 통과시킨다**

Run: `pnpm vitest run lib/backtest/metrics.test.ts`

Expected: PASS

- [ ] **Step 6: 커밋한다**

```bash
git add lib/backtest/metrics.ts lib/backtest/metrics.test.ts
git commit -m "백테스트: 캠페인 결과와 통계 집계를 만든다" -m "계약 보상·유품·엔딩·배신·정확도를 분리하고 Wilson 및 paired 차이를 계산한다."
```

---

## Task 6: 고정 gate와 결정적 보고서를 만든다

**Files:**

- Modify: `lib/backtest/metrics.ts`
- Modify: `lib/backtest/metrics.test.ts`
- Create: `lib/backtest/report.ts`
- Create: `lib/backtest/report.test.ts`

**Interfaces:**

```ts
export interface FixedGateResult {
  readonly id:
    | "no-run-errors"
    | "accuracy-interval"
    | "not-all-rank-s"
    | "betrayal-can-complete"
    | "accuracy-has-effect";
  readonly passed: boolean;
  readonly evidence: string;
}

export interface AdjustableAcceptanceCriteria {
  readonly completionRateByCombination: Readonly<Record<CombinationId, readonly [number, number]>>;
  readonly minimumAccuracyEffect: number;
  readonly maximumEndingConcentration: number;
  readonly minimumStrategySeparation: number;
  readonly betrayalAttemptRate: readonly [number, number];
}

export interface BacktestReportInput {
  readonly mode: "calibration" | "holdout";
  readonly namespace: "b1-calibration-v1" | "b1-holdout-v1";
  readonly sourceRevision: string;
  readonly aggregate: BacktestAggregate;
  readonly fixedGates: readonly FixedGateResult[];
  readonly adjustableCriteria: AdjustableAcceptanceCriteria | null;
}

export function evaluateFixedGates(aggregate: BacktestAggregate): readonly FixedGateResult[];
export function renderBacktestReport(input: BacktestReportInput): string;
```

- [ ] **Step 1: 다섯 hard gate의 실패 테스트를 쓴다**

고정 gate:

1. 생성·전이 거부·잘못된 전략·정체·step 초과·비결정성 합계 0
2. 각 조합의 실측 hit Wilson 99.9% CI가 목표 0.4/0.7 포함
3. 각 조합 S 도달률 `< 100%`
4. `selective-betrayal × 0.7`에서 정상 완료 1건 이상
5. 같은 전략의 0.4↔0.7 paired 비교가 통계적 차이와 승인 전 임시 practical-difference 후보를 보고

```ts
it("오류 하나도 no-run-errors gate를 실패시킨다", () => {
  const result = evaluateFixedGates(aggregateFixture({ runErrors: 1 }));
  expect(result.find((gate) => gate.id === "no-run-errors")?.passed).toBe(false);
});
```

`accuracy-has-effect`는 calibration 단계에서는 효과 크기와 CI를 evidence에 기록하되 조정 가능한 practical threshold가 없으므로 최종 판정을 `false`로 위장하지 않는다. 통계적 차이(95% CI가 0을 제외)는 고정 부분, 최소 practical difference는 Task 8 승인 뒤 판정한다.

- [ ] **Step 2: 실패를 확인하고 gate를 구현한다**

Run: `pnpm vitest run lib/backtest/metrics.test.ts`

Expected: FAIL

- [ ] **Step 3: 보고서 byte 재현성 실패 테스트를 쓴다**

```ts
it("같은 집계는 입력 순서와 실행 시간 없이 같은 Markdown을 만든다", () => {
  const first = renderBacktestReport(reportFixture());
  const second = renderBacktestReport(reportFixture({ reverseRuns: true }));
  expect(second).toBe(first);
  expect(first).not.toMatch(/duration|elapsed|실행 시간/i);
  expect(first).toContain("## 고정 gate");
  expect(first).toContain("## 조합별 결과");
  expect(first).toContain("## paired 비교");
});
```

- [ ] **Step 4: 고정 정렬과 숫자 formatting으로 renderer를 구현한다**

정렬 순서는 `survival`, `opportunist`, `selective-betrayal`, 각 전략 안에서 `0.4`, `0.7`이다. 비율은 소수점 4자리, 평균은 소수점 3자리로 고정하고 `-0.000`은 `0.000`으로 정규화한다. 보고서에 현재 시각과 wall-clock duration을 넣지 않는다.

- [ ] **Step 5: 관련 테스트를 통과시킨다**

Run: `pnpm vitest run lib/backtest/metrics.test.ts lib/backtest/report.test.ts`

Expected: PASS

- [ ] **Step 6: 커밋한다**

```bash
git add lib/backtest/metrics.ts lib/backtest/metrics.test.ts lib/backtest/report.ts lib/backtest/report.test.ts
git commit -m "백테스트: 고정 gate와 결정적 보고서를 만든다" -m "오류·정확도·S 쏠림·배신 완주·정확도 효과를 판정하고 같은 집계를 같은 Markdown으로 렌더링한다."
```

---

## Task 7: quick/holdout 실행 entrypoint와 명령을 연결한다

**Files:**

- Create: `lib/backtest/backtest.run.ts`
- Modify: `vitest.backtest.config.ts`
- Modify: `package.json`

**Interfaces:**

```ts
export interface BacktestSuiteOptions {
  readonly mode: "calibration" | "holdout";
  readonly seedsPerCombination: 200 | 2000;
  readonly namespace: "b1-calibration-v1" | "b1-holdout-v1";
  readonly criteria: AdjustableAcceptanceCriteria | null;
}

export function campaignSeed(namespace: BacktestSuiteOptions["namespace"], index: number): string;
export function runBacktestSuite(options: BacktestSuiteOptions): BacktestAggregate;
```

- [ ] **Step 1: namespace와 동일 seed pairing 실패 테스트를 entrypoint에 쓴다**

```ts
describe("B1 backtest seed 계약", () => {
  it("여섯 조합이 같은 번호의 캠페인 seed를 공유한다", () => {
    expect(campaignSeed("b1-calibration-v1", 17)).toBe("b1-calibration-v1/000017");
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run --config vitest.backtest.config.ts -t "seed 계약"`

Expected: FAIL

- [ ] **Step 3: mode별 suite와 이중 실행 비결정성 검사를 구현한다**

각 seed/조합은 두 번 실행해 구조화된 `CampaignRunMetrics`를 비교한다. 다르면 원본 한 판을 `nondeterminism` 실패로 바꾸고 재현 seed를 집계에 남긴다. 두 번째 실행은 표본 수에 더하지 않는다.

```ts
for (let index = 0; index < options.seedsPerCombination; index += 1) {
  const seed = campaignSeed(options.namespace, index);
  for (const strategyId of STRATEGY_IDS) {
    for (const accuracy of [0.4, 0.7] as const) {
      const input = { seed, strategy: createStrategy(strategyId), accuracy };
      const first = metricsForRun(runCampaign(input));
      const second = metricsForRun(runCampaign(input));
      runs.push(equalRunMetrics(first, second) ? first : nondeterministicMetrics(first));
    }
  }
}
```

- [ ] **Step 4: 환경 변수로 mode를 고정하고 보고서를 쓴다**

`B1_BACKTEST_MODE=calibration|holdout`만 허용한다. calibration은 criteria `null`, holdout은 Task 8에서 승인되어 spec에 기록된 상수를 import한다. 보고서 출력 경로는 두 mode 모두 `docs/technical/BACKTEST_REPORT.md`이며 holdout이 calibration을 덮을 때 calibration 근거 절을 유지한다.

- [ ] **Step 5: 명령을 추가한다**

```json
{
  "scripts": {
    "backtest:quick": "B1_BACKTEST_MODE=calibration vitest run --config vitest.backtest.config.ts",
    "backtest": "B1_BACKTEST_MODE=holdout vitest run --config vitest.backtest.config.ts"
  }
}
```

`vitest.backtest.config.ts`에는 `testTimeout: 0`, `hookTimeout: 0`, `maxWorkers: 1`을 지정한다. 결과 정렬이 worker scheduling에 영향받지 않게 한다.

- [ ] **Step 6: 작은 test override로 wiring을 검증한다**

테스트 전용 `B1_BACKTEST_SEEDS=2`는 `NODE_ENV === "test"`일 때만 허용하고, 실제 `backtest:quick`/`backtest`에서는 각각 200/2000을 강제한다.

Run: `B1_BACKTEST_MODE=calibration B1_BACKTEST_SEEDS=2 pnpm vitest run --config vitest.backtest.config.ts`

Expected: PASS, 6조합 × 2시드 집계

- [ ] **Step 7: 전체 단위 회귀를 실행한다**

Run: `pnpm test && pnpm typecheck && git diff --check`

Expected: PASS

- [ ] **Step 8: 커밋한다**

```bash
git add lib/backtest/backtest.run.ts vitest.backtest.config.ts package.json
git commit -m "백테스트: calibration과 holdout 명령을 연결한다" -m "공유 seed 조합 실행과 비결정성 검사를 추가하고 quick 200·holdout 2000 표본을 분리한다."
```

---

## Task 8: calibration을 실행하고 수치 기준 승인을 받는다

**Files:**

- Modify: `docs/technical/BACKTEST_REPORT.md`
- Modify after approval: `docs/superpowers/specs/2026-08-24-lattebun-b1-current-campaign-backtest-design.md`
- Modify after approval: `docs/systems/PROGRESSION_AND_ENDINGS.md`
- Modify after approval: `lib/backtest/metrics.ts`
- Modify after approval: `lib/backtest/metrics.test.ts`

- [ ] **Step 1: 깨끗한 작업 트리와 source revision을 확인한다**

Run: `git status --short && git rev-parse --short HEAD`

Expected: 계획 밖 추적 파일 변경 없음. 기존 untracked `docs/technical/PROJECT_STATUS_2026-08-24.md`는 수정·추가하지 않는다.

- [ ] **Step 2: calibration 1,200판을 실행한다**

Run: `pnpm backtest:quick`

Expected: 3전략 × 2정확도 × 200시드 완료, `docs/technical/BACKTEST_REPORT.md` 생성/갱신

- [ ] **Step 3: 실패 seed가 있으면 재현하고 원인을 분류한다**

고정 gate 오류가 있으면 수치 협의로 넘어가지 않는다. 해당 seed/조합 한 판을 단독 재실행하고 `superpowers:systematic-debugging`으로 백테스트 harness 결함인지 현행 게임 결함인지 판별한다. B1-A에서 게임 규칙을 고치지 않는다.

- [ ] **Step 4: calibration 결과에서 조정 가능한 기준 후보를 계산한다**

반드시 다음 다섯 항목에 구체적인 숫자와 근거를 제시한다.

1. 조합별 정상 완료율 허용 구간
2. 정확도 0.4→0.7 최소 practical effect
3. 한 ending의 최대 집중률
4. 전략 간 최소 분리도
5. 선별적 배신 시도율 허용 구간

각 후보는 관측값을 그대로 반올림해 경계로 쓰지 않는다. calibration Wilson 95% CI, paired 95% CI, 게임적으로 의미 있는 최소 차이를 함께 표로 제시한다.

- [ ] **Step 5: 사용자에게 calibration 보고서와 기준 후보 승인을 요청하고 작업을 중단한다**

이 단계는 필수 승인 checkpoint다. 사용자 승인 전에는 `b1-holdout-v1`을 한 seed도 실행하지 않는다.

- [ ] **Step 6: 승인된 숫자를 spec·공식 설정집·코드에 같은 값으로 반영한다**

`lib/backtest/metrics.ts`에 `B1_ACCEPTANCE_CRITERIA: AdjustableAcceptanceCriteria`를
추가한다. 여섯 `completionRateByCombination` 구간, `minimumAccuracyEffect`,
`maximumEndingConcentration`, `minimumStrategySeparation`, `betrayalAttemptRate`에는
Step 5에서 사용자가 승인한 숫자 literal을 그대로 입력한다. 같은 표를 spec과
`PROGRESSION_AND_ENDINGS.md`에 복제하고, 테스트에서 코드 상수와 문서 표를 대조한다.

- [ ] **Step 7: 승인 기준의 경계 테스트를 추가한다**

각 기준마다 경계 바로 아래/같음/바로 위 fixture를 두고 포함·배제 방향을 고정한다.

Run: `pnpm vitest run lib/backtest/metrics.test.ts docs/DOCUMENT_TERMINOLOGY.test.ts docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.test.ts`

Expected: PASS

- [ ] **Step 8: calibration 보고서와 승인 기준을 커밋한다**

```bash
git add docs/technical/BACKTEST_REPORT.md docs/superpowers/specs/2026-08-24-lattebun-b1-current-campaign-backtest-design.md docs/systems/PROGRESSION_AND_ENDINGS.md lib/backtest/metrics.ts lib/backtest/metrics.test.ts
git commit -m "백테스트: calibration 기준을 확정한다" -m "200시드 조합별 관측과 사용자 승인 수치를 기록하고 holdout 판정 상수를 고정한다."
```

---

## Task 9: holdout을 실행하고 B1-A를 판정한다

**Files:**

- Modify: `docs/technical/BACKTEST_REPORT.md`
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`
- Modify if needed: `docs/README.md`

- [ ] **Step 1: holdout namespace와 승인 기준이 calibration과 분리되었는지 검사한다**

Run: `grep -R -n "b1-calibration-v1\|b1-holdout-v1\|B1_ACCEPTANCE_CRITERIA" lib/backtest docs/superpowers/specs/2026-08-24-lattebun-b1-current-campaign-backtest-design.md docs/systems/PROGRESSION_AND_ENDINGS.md`

Expected: 두 namespace가 다르고 승인 기준이 세 위치에서 같은 숫자다.

- [ ] **Step 2: holdout 12,000판을 한 번 실행한다**

Run: `pnpm backtest`

Expected: 3전략 × 2정확도 × 2,000시드 완료, 승인 기준별 PASS/FAIL 보고서 생성

- [ ] **Step 3: 보고서 무결성을 검사한다**

```ts
expect(report).toContain("b1-holdout-v1");
expect(report).toContain("조합당 2,000");
expect(report).toContain("실패 재현 시드");
expect(report).not.toMatch(/기준 미승인|수치 미정/);
expect(report).not.toMatch(/NaN|Infinity|undefined/);
```

Run: `pnpm vitest run lib/backtest/report.test.ts lib/backtest/metrics.test.ts`

Expected: PASS

- [ ] **Step 4: PASS이면 B1 완료를 배정표에 기록한다**

`CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`에서 B1을 완료 처리하고 근거로 holdout 보고서, namespace, source revision을 링크한다. 다음 순서를 `Q1 → Q2`로 기록한다.

- [ ] **Step 5: FAIL이면 B1을 열린 상태로 유지하고 B1-B 진입 근거를 기록한다**

실패 gate, 효과 크기, 재현 seed를 배정표에 기록한다. 게임 숫자를 즉시 바꾸지 않고 다음 작업을 `B1-B brainstorming → 새 spec → 새 plan`으로 적는다. holdout을 보고 합격 수치를 이동하지 않는다. 기준 변경을 제안한다면 새 사용자 승인과 새 holdout namespace가 필요하다고 명시한다.

- [ ] **Step 6: 전체 검증을 실행한다**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build && git diff --check`

Expected: 모두 exit 0

- [ ] **Step 7: `superpowers:requesting-code-review`로 spec·plan·diff·보고서를 검토한다**

검토 범위는 공개 정보 누출, 실제 Store 사용, seed 격리, 통계 공식, 승인 전 holdout 미실행, 보고서와 배정표 일치다. 지적이 있으면 수정 후 Step 6을 다시 실행한다.

- [ ] **Step 8: 최종 결과를 커밋한다**

PASS:

```bash
git add docs/technical/BACKTEST_REPORT.md docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md docs/README.md
git commit -m "백테스트: B1 현행 캠페인 검증을 완료한다" -m "독립 holdout 12000판의 합격 결과를 보고하고 다음 작업을 Q1로 넘긴다."
```

FAIL:

```bash
git add docs/technical/BACKTEST_REPORT.md docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md docs/README.md
git commit -m "백테스트: B1 재설계 필요성을 기록한다" -m "독립 holdout의 실패 지표와 재현 시드를 남기고 B1-B 설계 진입 조건을 확정한다."
```

---

## Final Self-Review Checklist

- [ ] spec의 목표·비목표·3전략·2정확도·오류 분류·표본 수·통계 공식·승인 경계를 모두 태스크에 매핑했다.
- [ ] 새 모듈의 public interface와 소비 방향이 순환 의존을 만들지 않는다.
- [ ] 전략 타입에는 숨은 `outcome`, `relation`, effect, prepared role이 없다.
- [ ] 구현 placeholder나 미정 수치 표기가 최종 코드와 승인 뒤 문서에 남지 않는다.
- [ ] calibration과 holdout seed가 겹치지 않는다.
- [ ] holdout 결과를 본 뒤 기준을 이동하지 않는다.
- [ ] 모든 테스트·typecheck·lint·build·`git diff --check`의 최신 출력이 성공이다.
- [ ] 기존 untracked `docs/technical/PROJECT_STATUS_2026-08-24.md`를 B1 커밋에 섞지 않았다.
