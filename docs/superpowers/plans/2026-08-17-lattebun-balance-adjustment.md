# 밸런스 조정 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 첫 백테스트가 드러낸 세 밸런스 문제(배신 불성립, S 조기 도달, 보스 무해)를 상수 조정으로 해소하고 10,000 시드 백테스트로 재측정한다.

**Architecture:** 규칙 함수의 구조는 그대로 두고 상수값과 선언적 시나리오 데이터만 바꾼다. 손잡이 넷(승급 곡선, 요구 명성, 유품 골드, 보스 피해)을 Task 1~4로 나누어 각각 커밋하고, Task 6에서 전체를 한 번에 측정한다. 화면 컴포넌트는 건드리지 않는다.

**Tech Stack:** TypeScript 5 strict, Vitest 4.1.10 (environment: node), pnpm 11.21.0

**Spec:** `docs/superpowers/specs/2026-08-17-lattebun-balance-adjustment-design.md`

## Global Constraints

- 커밋 메시지는 제목과 본문을 모두 한글로 쓴다. 본문에는 "왜"를 적는다. (`AGENTS.md`)
- 작업 브랜치는 `feature/b1-balance-adjustment`이며 `main`에 직접 push하지 않는다.
- **규칙 함수의 구조를 바꾸지 않는다.** 이 작업이 바꾸는 것은 상수값과 `BASELINE_CLEARS` 시나리오 데이터뿐이다. `if` 분기 추가, 새 함수, 새 필드는 이 계획의 범위 밖이다.
- **화면 컴포넌트 파일을 수정하지 않는다.** `components/**/*.tsx`와 `app/**/*.tsx`는 손대지 않는다. 화면 관련 변경은 view-model 테스트의 기대값뿐이다.
- `docs/technical/BACKTEST_REPORT.md`는 `pnpm backtest`의 산출물이다. **직접 편집하지 않는다.**
- 배정표의 밸런스 조정 절차가 말하는 `상수만 바꾸는 커밋`은 규칙 구조 변경과 섞지 말라는 뜻이다. 손잡이별로 나눈 Task 1~4의 커밋들도 이를 만족한다. 갱신된 백테스트 보고서는 전체 상수가 확정된 뒤인 Task 6 커밋에 넣는다.
- 각 Task는 `pnpm test`가 전부 통과하는 상태로 끝난다.

---

## File Structure

| 파일 | 책임 | 변경 |
| --- | --- | --- |
| `lib/backtest/fixtures.ts` | 난수 없는 기준 승급 시나리오 | `BASELINE_CLEARS`를 15단계로 교체 |
| `lib/rules/promotion.ts` | 승급 점수식과 등급 기준 | `PROMOTION_THRESHOLDS` 값 |
| `lib/content/dungeons.ts` | 등급별 캠페인 상수 | `requiredReputation`, `baseReputationReward`, `baseGoldReward` |
| `lib/rules/campaign-init.ts` | 캠페인 초기 상태 생성 | `INITIAL_MEMBER_GOLD_MIN`·`MAX` 값과 `export` |
| `lib/content/bosses.ts` | 등급별 보스 데이터 | `baseDamage` |
| `docs/systems/PROGRESSION_AND_ENDINGS.md` | 성장·승급·엔딩의 단일 출처 | 보상표, 승급 점수표, 승급 속도 기준, 소지 골드 범위 |
| `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md` | 배정표와 밸런스 절차 | 상수 목록, 백테스트 보고서 절, `B1` 상태 |
| `docs/technical/BACKTEST_REPORT.md` | 백테스트 산출물 | `pnpm backtest`가 재생성 |

테스트 파일은 각 Task에서 함께 고친다.

---

## Task 1: 승급 곡선을 캠페인 길이로 재정의한다

**Files:**
- Modify: `lib/backtest/fixtures.ts:29-37` (`BASELINE_CLEARS`)
- Modify: `lib/rules/promotion.ts:4-9` (`PROMOTION_THRESHOLDS`)
- Modify: `lib/content/dungeons.ts:25-28` (`baseReputationReward`, `baseGoldReward`만)
- Test: `lib/rules/promotion.test.ts`, `lib/backtest/campaign-simulator.test.ts`, `lib/backtest/report.test.ts`, `lib/rules/settlement.test.ts`, `components/game/campaign-view-model.test.ts`

**Interfaces:**
- Consumes: 없음. 첫 Task다.
- Produces: 새 승급 기준 `PROMOTION_THRESHOLDS = { C: 0, B: 120, A: 261, S: 489 }`. 이후 Task는 이 값을 전제한다. 등급별 3명 생존 보상은 명성 `C 6 / B 9 / A 15 / S 24`, 골드 `C 12 / B 21 / A 33 / S 48`이다.

**배경:** `S 도달률 100%`는 결함이 아니라 사양대로 동작한 결과다. `BASELINE_CLEARS`가 승급을 클리어 7번으로 상정하는데 캠페인은 던전 15개다. 기준 시나리오를 캠페인 길이로 다시 쓰고, 승급 점수는 그 시나리오에서 파생한다. 수치를 먼저 정하고 의도를 나중에 맞추는 순서를 뒤집는다.

- [ ] **Step 1: 기준 시나리오를 15단계로 교체한다**

`lib/backtest/fixtures.ts`의 `BASELINE_CLEARS`를 아래로 바꾼다. 주석도 함께 고친다.

```ts
/**
 * 던전 15개를 등급 순으로 완주하는 기준 진행이다. 캠페인 길이가 승급 속도의
 * 기준이므로 클리어 횟수를 캠페인 전체로 잡는다.
 * docs/systems/PROGRESSION_AND_ENDINGS.md
 */
const BASELINE_CLEARS: readonly ClearStep[] = [
  { grade: "C", survivors: 3 },
  { grade: "C", survivors: 3 },
  { grade: "C", survivors: 3 },
  { grade: "C", survivors: 3 },
  { grade: "C", survivors: 3, reaches: "B" },
  { grade: "C", survivors: 3 },
  { grade: "B", survivors: 3 },
  { grade: "B", survivors: 3 },
  { grade: "B", survivors: 3, reaches: "A" },
  { grade: "B", survivors: 3 },
  { grade: "A", survivors: 3 },
  { grade: "A", survivors: 3 },
  { grade: "A", survivors: 3, reaches: "S" },
  { grade: "S", survivors: 3 },
  { grade: "S", survivors: 3 },
];
```

- [ ] **Step 2: 보상 상수를 60%로 내린다**

`lib/content/dungeons.ts`의 `CAMPAIGN_GRADE_CONFIG`에서 **`baseReputationReward`와 `baseGoldReward`만** 바꾼다. `requiredReputation`은 Task 2에서 다루므로 이번에는 손대지 않는다.

```ts
export const CAMPAIGN_GRADE_CONFIG: Readonly<Record<Grade, CampaignGradeConfig>> = {
  C: { requiredReputation: 0, baseReputationReward: 6, baseGoldReward: 12, nodeCount: 7, branchLength: 2, infoOpportunityCount: 2, bossRelatedInfoCount: 1 },
  B: { requiredReputation: 30, baseReputationReward: 9, baseGoldReward: 21, nodeCount: 9, branchLength: 3, infoOpportunityCount: 3, bossRelatedInfoCount: 1 },
  A: { requiredReputation: 60, baseReputationReward: 15, baseGoldReward: 33, nodeCount: 11, branchLength: 4, infoOpportunityCount: 4, bossRelatedInfoCount: 2 },
  S: { requiredReputation: 100, baseReputationReward: 24, baseGoldReward: 48, nodeCount: 13, branchLength: 5, infoOpportunityCount: 5, bossRelatedInfoCount: 2 },
};
```

- [ ] **Step 3: 새 기준 점수를 확인한다**

`simulateBaseline()`이 만드는 checkpoint를 직접 계산해 둔다. 다음 단계의 기대값이 여기서 나온다.

| 클리어 | 등급 | 명성 | 누적 골드 | 점수 | 승급 |
| ---: | --- | ---: | ---: | ---: | --- |
| 5 | C | 30 | 60 | 120 | **B** |
| 9 | B | 63 | 135 | 261 | **A** |
| 13 | A | 117 | 255 | 489 | **S** |
| 15 | S | 165 | 351 | 681 | — |

- [ ] **Step 4: 승급 기준 상수를 새 checkpoint로 바꾼다**

`lib/rules/promotion.ts`:

```ts
/** 승급 점수 기준. 기준 시나리오(lib/backtest/fixtures.ts)에서 파생한 값이다. */
export const PROMOTION_THRESHOLDS: Readonly<Record<Grade, number>> = {
  C: 0,
  B: 120,
  A: 261,
  S: 489,
};
```

- [ ] **Step 5: 테스트를 돌려 무엇이 깨지는지 본다**

Run: `pnpm test`
Expected: FAIL. `promotion.test.ts` 4건, `campaign-simulator.test.ts` 2건, `report.test.ts` 1건, `settlement.test.ts` 4건, `campaign-view-model.test.ts` 1건이 깨진다.

**깨지는 것이 정상이다.** 깨지지 않으면 그 상수가 어디에도 쓰이지 않는다는 뜻이다. 아래 단계에서 하나씩 새 값으로 고친다.

- [ ] **Step 6: `promotion.test.ts`의 기대값을 고친다**

세 곳을 바꾼다.

```ts
  it("등급 기준 상수는 확정값이다", () => {
    expect(PROMOTION_THRESHOLDS).toEqual({ C: 0, B: 120, A: 261, S: 489 });
  });

  it("다음 등급은 현재 영구 등급 바로 위이며 S면 null이다", () => {
    expect(nextGradeTarget("C")).toEqual({ grade: "B", threshold: 120 });
    expect(nextGradeTarget("B")).toEqual({ grade: "A", threshold: 261 });
    expect(nextGradeTarget("A")).toEqual({ grade: "S", threshold: 489 });
    expect(nextGradeTarget("S")).toBeNull();
  });

  it("기준 진행의 승급 checkpoint를 정확히 재현한다", () => {
    // docs/systems/PROGRESSION_AND_ENDINGS.md의 프로토타입 승급 속도 기준
    expect(calculatePromotionScore(30, 60)).toBe(120);
    expect(promote("C", 120)).toBe("B");
    expect(calculatePromotionScore(63, 135)).toBe(261);
    expect(promote("B", 261)).toBe("A");
    expect(calculatePromotionScore(117, 255)).toBe(489);
    expect(promote("A", 489)).toBe("S");
    expect(calculatePromotionScore(165, 351)).toBe(681);
  });

  it("조건을 만족하는 가장 높은 등급으로 한 번에 올린다", () => {
    expect(promote("C", 119)).toBe("C");
    expect(promote("C", 260)).toBe("B");
    expect(promote("C", 489)).toBe("S");
  });
```

`승급 점수는 현재 명성 2배와 누적 골드를 합산한다`와 `점수가 낮아져도 강등하지 않는다`는 고치지 않는다. 점수식과 무강등 규칙은 바뀌지 않았고 이 두 테스트는 새 상수에서도 통과한다.

- [ ] **Step 7: `campaign-simulator.test.ts`의 checkpoint를 고친다**

```ts
    expect(report.checkpoints).toEqual({
      B: { reputation: 30, cumulativeGold: 60, score: 120 },
      A: { reputation: 63, cumulativeGold: 135, score: 261 },
      S: { reputation: 117, cumulativeGold: 255, score: 489 },
    });
    expect(report.finalRank).toBe("S");
```

- [ ] **Step 8: `report.test.ts`의 표 문자열을 고친다**

`lib/backtest/report.test.ts:17-18`:

```ts
    expect(document).toContain("| B | 30 | 60 | 120 |");
    expect(document).toContain("| S | 117 | 255 | 489 |");
```

`B` 줄은 값이 그대로다. `S` 줄만 달라진다.

- [ ] **Step 9: `settlement.test.ts`의 보상 수치를 고친다**

네 곳이다. 파라미터화된 `생존 %i명은 보상의 %i번째 비율을 받고 버림한다`는 `config`에서 값을 읽으므로 고치지 않는다.

```ts
  it("A급 1명 생존은 소수점을 버려 명성 4와 골드 9를 준다", () => {
    const { state } = settle({ grade: "A", survivors: [1], casualties: [2, 3] });

    // 15 × 0.3 = 4.5 → 4, 33 × 0.3 = 9.9 → 9
    expect(state.currentReputation).toBe(104);
    expect(state.currentGold).toBe(59);
  });
```

```ts
  it("부분 생존은 사망자의 소지 골드를 얻지 않는다", () => {
    const { state } = settle({
      survivors: [1, 2],
      casualties: [3],
      carriedGold: 30,
      currentGold: 50,
    });

    // C급 2명 생존 골드는 floor(12 × 0.6) = 7. 유품 30은 더하지 않는다.
    expect(state.currentGold).toBe(57);
    expect(state.members.find((entry) => entry.id === "member-003")?.carriedGold).toBe(30);
  });
```

```ts
  it("명성은 음수가 될 수 있고 그 순간 모든 공고가 잠긴다", () => {
    const { state } = settle({
      survivors: [],
      casualties: [1, 2, 3],
      currentReputation: 0,
    });

    expect(state.currentReputation).toBe(-6);
    expect(state.ending?.id).toBe("partyExhausted");
  });
```

이 테스트의 이름과 주석은 Task 2에서 다시 손댄다. 지금은 숫자만 맞춘다.

```ts
  it("정산 뒤 점수가 기준을 넘으면 즉시 승급한다", () => {
    const { state } = settle({
      survivors: [1, 2, 3],
      casualties: [],
      currentReputation: 30,
      cumulativeGold: 50,
    });

    // 명성 36 × 2 + 누적 62 = 134 ≥ 120
    expect(state.currentReputation).toBe(36);
    expect(state.cumulativeGold).toBe(62);
    expect(state.rank).toBe("B");
  });
```

- [ ] **Step 10: `campaign-view-model.test.ts`의 다음 등급 기준을 고친다**

`components/game/campaign-view-model.test.ts:54`:

```ts
    expect(view.nextGrade).toEqual({ grade: "A", threshold: 261 });
```

컴포넌트 파일은 건드리지 않는다. 화면은 규칙이 준 값을 그대로 쓰므로 자동으로 따라간다.

- [ ] **Step 11: 전체 테스트가 통과하는지 확인한다**

Run: `pnpm test`
Expected: PASS. 43 파일 439 테스트 전부 통과.

통과하지 않으면 남은 실패의 기대값을 Step 3의 표에서 다시 계산한다.

- [ ] **Step 12: 커밋**

```bash
git add lib/backtest/fixtures.ts lib/rules/promotion.ts lib/content/dungeons.ts \
  lib/rules/promotion.test.ts lib/backtest/campaign-simulator.test.ts \
  lib/backtest/report.test.ts lib/rules/settlement.test.ts \
  components/game/campaign-view-model.test.ts
git commit -F - <<'MSG'
밸런스: 승급 속도를 캠페인 길이에 맞춘다

기준 시나리오가 클리어 7번에 S 도달을 상정했는데 캠페인은 던전 15개다.
그래서 백테스트에서 S 최초 도달 중앙값이 7~8회차로 나왔고 후반 절반이
등급상 무의미했다. 결함이 아니라 사양대로 동작한 결과였다.

기준 시나리오를 15개 완주로 다시 쓰고 승급 점수를 거기서 파생한다.
승급 지점은 5·9·13번째 클리어다. 보상을 60%로 내린 것은 점수 총량을
줄이는 동시에 전멸 명성 손실도 함께 줄이기 위해서다. 두 값이 같은
상수를 쓰므로 분리해서 조절할 수 없다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

## Task 2: 명성 절벽을 해소한다

**Files:**
- Modify: `lib/content/dungeons.ts:25-28` (`requiredReputation`만)
- Test: `lib/rules/board.test.ts`, `lib/rules/ending.test.ts`, `lib/flow/campaign-machine.test.ts`, `lib/rules/settlement.test.ts`, `app/integration-test/integration-test-snapshot.test.ts`

**Interfaces:**
- Consumes: Task 1의 보상 상수. 명성 수입이 60%로 줄어든 상태를 전제한다.
- Produces: 요구 명성 `C −30 / B −10 / A 10 / S 30`. 음수 명성이 곧 전면 잠금은 아니게 된다.

**배경:** 전멸하면 두 가지가 동시에 일어난다. 내 명성이 내려가고, `settleDungeon()`이 그 던전의 등급을 올려 요구 명성이 올라간다. 양쪽에서 벌어지므로 한쪽만 손대면 상쇄된다. 기존 요구 명성 `0 / 30 / 60 / 100`은 간격이 `30 / 30 / 40`으로 넓어, C급에서 한 번 전멸하면 그 던전이 사실상 잠긴다.

간격을 균등한 `20 / 20 / 20`으로 펴고 전체를 아래로 내린다. 사전 측정에서 이 변경 하나로 생존 전략의 자격 박탈이 43.6% → 0.1%로 떨어졌다.

- [ ] **Step 1: 요구 명성을 바꾼다**

`lib/content/dungeons.ts`. 보상값은 Task 1에서 이미 바꿨으므로 그대로 둔다.

```ts
export const CAMPAIGN_GRADE_CONFIG: Readonly<Record<Grade, CampaignGradeConfig>> = {
  C: { requiredReputation: -30, baseReputationReward: 6, baseGoldReward: 12, nodeCount: 7, branchLength: 2, infoOpportunityCount: 2, bossRelatedInfoCount: 1 },
  B: { requiredReputation: -10, baseReputationReward: 9, baseGoldReward: 21, nodeCount: 9, branchLength: 3, infoOpportunityCount: 3, bossRelatedInfoCount: 1 },
  A: { requiredReputation: 10, baseReputationReward: 15, baseGoldReward: 33, nodeCount: 11, branchLength: 4, infoOpportunityCount: 4, bossRelatedInfoCount: 2 },
  S: { requiredReputation: 30, baseReputationReward: 24, baseGoldReward: 48, nodeCount: 13, branchLength: 5, infoOpportunityCount: 5, bossRelatedInfoCount: 2 },
};
```

- [ ] **Step 2: 테스트를 돌려 깨지는 것을 확인한다**

Run: `pnpm test`
Expected: FAIL. `board.test.ts` 3건, `ending.test.ts` 1건, `campaign-machine.test.ts` 1건, `integration-test-snapshot.test.ts` 1건이 깨진다.

전부 **명성이 요구치보다 낮아 잠긴다**를 단정하던 테스트다. 요구치가 내려갔으니 같은 명성으로는 더 이상 잠기지 않는다. 잠김 자체를 없애는 것이 목적이 아니므로, 고칠 때는 **명성을 새 요구치 아래로 내려** 잠김을 그대로 검증한다.

- [ ] **Step 3: `board.test.ts`의 세 테스트를 고친다**

`stateWithCungeonsCleared`의 두 번째 인자가 `currentReputation`이다. C급이 모두 클리어된 상태이므로 남은 최저 등급은 B(요구 −10)다. 명성을 −20으로 내려 잠김을 유지한다.

```ts
  it("명성 부족 공고를 숨기지 않고 잠근다", () => {
    const board = generateBoard(stateWithCungeonsCleared(5, -20));
    const firstBOffer = board.find((offer) => offer.dungeonId === "dungeon-007");

    expect(firstBOffer).toMatchObject({
      requiredReputation: -10,
      locked: true,
      lockReason: "insufficientReputation",
    });
  });
```

```ts
  it("지원 가능한 공고는 수락하고 명성 부족 공고는 잠근다", () => {
    const availableState = stateWithBoardInputs(5, 0);
    const availableBoard = generateBoard(availableState);
    const stateWithAvailableBoard = { ...availableState, board: availableBoard };

    expect(canAcceptOffer(stateWithAvailableBoard, availableBoard[0])).toEqual({
      accepted: true,
    });

    const lockedState = stateWithCungeonsCleared(5, -20);
    const lockedBoard = generateBoard(lockedState);
    const stateWithLockedBoard = { ...lockedState, board: lockedBoard };

    expect(canAcceptOffer(stateWithLockedBoard, lockedBoard[0])).toEqual({
      accepted: false,
      reason: "insufficientReputation",
    });
  });
```

```ts
  it("모든 공고가 잠기면 supportUnavailable을 반환한다", () => {
    expect(createBoardEnding(stateWithCungeonsCleared(5, -20))).toBe(
      "supportUnavailable",
    );
  });
```

- [ ] **Step 4: `ending.test.ts`의 자격 박탈 테스트를 고친다**

`stateAfterSettlement`의 던전은 전부 C급(요구 −30)이다. 명성을 −40으로 내린다.

```ts
  it("공고가 모두 명성에 막히면 길잡이 자격 박탈이다", () => {
    const state = stateAfterSettlement({ currentReputation: -40 });

    expect(resolveEnding(state, SURVIVORS)?.id).toBe("supportUnavailable");
  });
```

같은 파일의 `완성 파티가 없으면 공고를 만들 수 없어 용사들의 시대가 끝난다`는 `currentReputation: -10`을 쓰지만 파티가 불완전해 `partyExhausted`가 먼저 성립하므로 고치지 않아도 통과한다. Step 6에서 실제로 통과하는지 확인한다.

- [ ] **Step 5: `campaign-machine.test.ts`의 잠긴 공고 테스트를 고친다**

`boardState()`의 던전은 C급이므로 요구 명성이 −30이다. −1로는 더 이상 잠기지 않는다.

```ts
    const locked = { ...state, currentReputation: -40 };
```

- [ ] **Step 6: `integration-test-snapshot.test.ts`의 요구 명성을 고친다**

`app/integration-test/integration-test-snapshot.test.ts:37`:

```ts
    expect(snapshot.c1.board.every((offer) =>
      offer.requiredReputation === -30
      && !offer.locked
      && offer.lockReason === null,
    )).toBe(true);
```

- [ ] **Step 7: 동작 계약이 바뀐 settlement 테스트를 다시 쓴다**

Task 1 Step 9에서 숫자만 맞춰 둔 테스트다. 이제 이름과 주석이 사실과 다르다. **음수 명성이 곧 전면 잠금은 아니게 되었다.**

```ts
  it("명성은 음수가 될 수 있고 요구치 아래로 내려가면 공고가 잠긴다", () => {
    const { state } = settle({
      survivors: [],
      casualties: [1, 2, 3],
      currentReputation: 0,
    });

    // 문서가 현재 명성의 최솟값을 제한하지 않는다. 다만 요구 명성이 음수
    // 구간까지 내려가므로 음수가 되는 것 자체는 잠금을 뜻하지 않는다.
    // 이 fixture는 출전 파티가 전멸해 완성 파티가 남지 않은 경우다.
    expect(state.currentReputation).toBe(-6);
    expect(state.ending?.id).toBe("partyExhausted");
  });
```

- [ ] **Step 8: 자격 박탈 엔딩이 여전히 도달 가능한지 확인한다**

Step 4의 테스트가 통과하면 `supportUnavailable`이 살아 있다는 뜻이다. 이 엔딩을 없애는 것은 목적이 아니다.

Run: `pnpm test lib/rules/ending.test.ts`
Expected: PASS. 특히 `공고가 모두 명성에 막히면 길잡이 자격 박탈이다`가 통과해야 한다.

- [ ] **Step 9: 전체 테스트가 통과하는지 확인한다**

Run: `pnpm test`
Expected: PASS. 43 파일 439 테스트 전부 통과.

- [ ] **Step 10: 커밋**

```bash
git add lib/content/dungeons.ts lib/rules/board.test.ts lib/rules/ending.test.ts \
  lib/flow/campaign-machine.test.ts lib/rules/settlement.test.ts \
  app/integration-test/integration-test-snapshot.test.ts
git commit -F - <<'MSG'
밸런스: 등급 간 요구 명성 간격을 균등하게 편다

배신 전략의 69.8%가 첫 전멸 뒤 명성 붕괴로 끝났다. 처음에는 명성에
하한이 없는 것이 원인이라고 보았으나, C급 요구 명성만 내려 측정하니
절벽이 오히려 깊어졌다.

실제 기전은 전멸이 던전 등급을 올려 요구 명성을 함께 올리는 것이었다.
내 명성은 내려가고 그 던전의 문턱은 올라가 양쪽에서 벌어진다. 기존
간격 30/30/40에서는 C급 전멸 한 번이 그 던전을 사실상 잠갔다.

간격을 20/20/20으로 펴고 전체를 아래로 내린다. 사전 측정에서 생존
전략의 자격 박탈이 43.6%에서 0.1%로 떨어졌다.

음수 명성이 곧 전면 잠금은 아니게 되었으므로 그것을 단정하던 테스트의
이름과 주석을 함께 고친다. 자격 박탈 엔딩은 여전히 도달 가능하다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

## Task 3: 유품 골드를 올린다

**Files:**
- Modify: `lib/rules/campaign-init.ts:19-20`
- Test: `lib/rules/campaign-init.test.ts`

**Interfaces:**
- Consumes: 없음. 다른 Task와 독립이다.
- Produces: `export const INITIAL_MEMBER_GOLD_MIN = 20` / `INITIAL_MEMBER_GOLD_MAX = 45`. 테스트가 이 상수를 import해 범위를 검증한다.

**배경:** 승급 점수식이 `현재 명성 × 2 + 누적 획득 골드`이므로 배신은 ×2가 붙는 명성을 버리고 배수 없는 유품 골드를 택하는 거래다. 구조적으로 불리하다. 유품 공급원인 파티원 소지 골드를 올려 격차를 좁힌다.

이 값은 캠페인 시작 때 한 번 정해지고 이후 변하지 않으며 오직 전멸 유품으로만 회수된다. 아이템은 길잡이의 `currentGold`로 사므로 파티원 소지 골드와 무관하다. 부작용이 없는 단일 목적 손잡이다.

**왜 20~45인가:** 사전 측정에서 30~60까지 올리면 점수비가 85%로 좋아지지만 배신이 7회차에 S를 찍어 승급 속도 문제가 배신 쪽에서 재발했다. 20~45가 점수비 72%와 배신 S 도달 9회차를 함께 만족하는 지점이다.

- [ ] **Step 1: 상수를 바꾸고 export한다**

`lib/rules/campaign-init.ts:19-20`. 테스트가 값을 단정하는 대신 상수를 참조하도록 `export`를 붙인다.

```ts
/** 파티원 소지 골드의 시드 범위. 전멸 유품으로만 회수되는 값이다. */
export const INITIAL_MEMBER_GOLD_MIN = 20;
export const INITIAL_MEMBER_GOLD_MAX = 45;
```

- [ ] **Step 2: 테스트를 돌려 깨지는 것을 확인한다**

Run: `pnpm test lib/rules/campaign-init.test.ts`
Expected: FAIL. `초기 등급·자원·개인 상태 불변식을 지킨다`가 `carriedGold >= 10 && carriedGold <= 30`을 단정한다.

- [ ] **Step 3: 테스트가 상수를 참조하게 고친다**

`lib/rules/campaign-init.test.ts:3`의 import 문을 바꾼다.

찾을 문자열:

```ts
import { initializeCampaign } from "@/lib/rules/campaign-init";
```

바꿀 문자열:

```ts
import {
  INITIAL_MEMBER_GOLD_MAX,
  INITIAL_MEMBER_GOLD_MIN,
  initializeCampaign,
} from "@/lib/rules/campaign-init";
```

불변식의 두 줄(51~52행)을 바꾼다.

```ts
      && member.carriedGold >= INITIAL_MEMBER_GOLD_MIN
      && member.carriedGold <= INITIAL_MEMBER_GOLD_MAX
```

상수를 참조하면 다음 조정에서 이 테스트가 다시 깨지지 않고, 범위를 벗어난 값이 생기는 진짜 결함만 잡는다.

- [ ] **Step 4: 검사가 실제로 발동하는지 확인한다**

테스트가 이제 상수를 참조하므로 **상수를 바꾸면 단정하는 쪽과 생성하는 쪽이 함께 움직여 검사가 순환한다.** 그래서 상수가 아니라 **생성 지점**을 흔든다. 이 테스트가 지키는 불변식은 "생성값이 선언된 범위를 지킨다"이므로 생성을 어긋나게 해야 발동한다.

`lib/rules/campaign-init.ts:112`의 호출을 일시적으로 바꾼다.

찾을 문자열:

```ts
      carriedGoldRng.int(INITIAL_MEMBER_GOLD_MIN, INITIAL_MEMBER_GOLD_MAX),
```

일시적으로 바꿀 문자열:

```ts
      carriedGoldRng.int(1, 5),
```

Run: `pnpm test lib/rules/campaign-init.test.ts`
Expected: FAIL. `초기 등급·자원·개인 상태 불변식을 지킨다`가 실패한다. 실패하지 않으면 테스트가 아무것도 검사하지 않는다는 뜻이므로 Step 3을 다시 본다.

확인한 뒤 **반드시 원래 호출로 되돌리고** 복원을 확인한다.

```bash
git diff lib/rules/campaign-init.ts
```

Expected: `INITIAL_MEMBER_GOLD_MIN`이 20, `INITIAL_MEMBER_GOLD_MAX`가 45가 되고 `export`가 붙은 변경만 보인다. `carriedGoldRng.int(1, 5)`가 남아 있으면 안 된다.

- [ ] **Step 5: 전체 테스트가 통과하는지 확인한다**

Run: `pnpm test`
Expected: PASS. 43 파일 439 테스트 전부 통과.

- [ ] **Step 6: 커밋**

```bash
git add lib/rules/campaign-init.ts lib/rules/campaign-init.test.ts
git commit -F - <<'MSG'
밸런스: 파티원 소지 골드를 20~45로 올린다

승급 점수식이 명성에 2배를 주므로 배신은 배수 없는 유품 골드로만
점수를 쌓는다. 구조적으로 불리해서 최종 점수가 생존 전략의 29%였다.

소지 골드는 캠페인 시작 때 한 번 정해지고 전멸 유품으로만 회수된다.
아이템은 길잡이의 현재 골드로 사므로 이 값과 무관하다. 부작용 없이
배신 수입만 움직이는 손잡이다.

30~60까지 올리면 점수비는 85%가 되지만 배신이 7회차에 S를 찍어
승급 속도 문제가 배신 쪽에서 재발한다. 20~45가 두 지표를 함께
만족하는 지점이다.

테스트가 값을 직접 단정하는 대신 상수를 참조하게 바꾼다. 다음 조정에서
이 테스트가 또 깨지지 않고 범위를 벗어난 값만 잡는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

## Task 4: 보스를 위협으로 되돌린다

**Files:**
- Modify: `lib/content/bosses.ts:13-18`
- Test: `lib/rules/boss.test.ts`

**Interfaces:**
- Consumes: 없음. 다른 Task와 독립이다.
- Produces: 등급별 보스 기본 피해 `C 26 / B 34 / A 44 / S 52`.

**배경:** `resolveBossFight()`는 파티원마다 한 번만 때린다. 보정은 `BOSS_MODIFIER_MIN`/`MAX`로 −30%~+50%에 잘린다. 기존 S 보스는 최대 피해가 `24 × 1.5 = 36`인데 보스방 도착 평균 HP가 56이라 **수학적으로 죽을 수 없었다.** 정보 시스템의 최종 정산 지점이 무력화된 상태였다.

**등급마다 성격이 다른 이유:** `bossRelatedInfoCount`가 C·B는 1, A·S는 2다. 카드 보정이 진실 −20% / 중립 −10% / 거짓 +25%이므로 실제 보정 폭이 갈린다.

| 등급 | 보스 카드 | 실제 보정 범위 | 기본 피해 | 최대 피해 | 도착 평균 HP | 성격 |
| --- | ---: | --- | ---: | ---: | ---: | --- |
| C | 1장 | ×0.80 ~ ×1.25 | 26 | 32.5 | 66.1 | HP 부실자만 사망 |
| B | 1장 | ×0.80 ~ ×1.25 | 34 | 42.5 | 65.3 | HP 부실자만 사망 |
| A | 2장 | ×0.70 ~ ×1.50 | 44 | 66.0 | 56.4 | **정보가 생사를 가름** |
| S | 2장 | ×0.70 ~ ×1.50 | 52 | 78.0 | 58.4 | **정보가 생사를 가름** |

C·B에서도 정보로 생사를 가르려면 보정 폭이 좁고 도착 HP가 높아 기본 피해가 A·S보다 오히려 높아야 한다. 그래서 모든 등급에서 같은 성격을 만들지 않고, 등급이 오를수록 보스전이 진짜 정산 지점이 되도록 나눈다.

- [ ] **Step 1: 보스 기본 피해를 바꾼다**

`lib/content/bosses.ts`:

```ts
export const BOSSES: readonly BossDef[] = [
  boss("boss-c", "C", "동굴의 수문장", "낮은 등급 던전의 입구를 지키는 보스다.", 26),
  boss("boss-b", "B", "검은 뿔의 사냥꾼", "흔적을 따라 파티를 추적하는 보스다.", 34),
  boss("boss-a", "A", "심연의 감시자", "정보를 숨긴 채 길목을 통제하는 보스다.", 44),
  boss("boss-s", "S", "무너뜨리는 군주", "가장 깊은 층에서 모든 경로를 압박하는 보스다.", 52),
];
```

- [ ] **Step 2: 테스트를 돌려 깨지는 것을 확인한다**

Run: `pnpm test lib/rules/boss.test.ts`
Expected: FAIL. `보정은 기본 피해에 한 번만 적용되고 파티원마다 독립이다`가 기본 피해 24를 단정한다.

- [ ] **Step 3: 테스트의 기대값을 고친다**

`lib/rules/boss.test.ts:103-114`. `BOSS_S`의 기본 피해가 52가 되었다. 진실 카드 하나를 수용하면 −20%이므로 `round(52 × 0.8) = 42`다.

```ts
  it("보정은 기본 피해에 한 번만 적용되고 파티원마다 독립이다", () => {
    const result = fight({
      boss: BOSS_S,
      members: [member("member-001"), member("member-002")],
      infoRecords: [record("member-001", "truth", "accepted")],
    });

    expect(resultFor(result, "member-001").damage).toBe(Math.round(52 * 0.8));
    expect(resultFor(result, "member-002").damage).toBe(52);
    expect(resultFor(result, "member-001").member.currentHp).toBe(100 - 42);
    expect(resultFor(result, "member-002").member.currentHp).toBe(48);
  });
```

`BOSS_S`는 `lib/rules/boss.test.ts:21`에서 `BOSSES.find((boss) => boss.grade === "S")!`로 파생하므로 별도 정의를 고칠 필요가 없다. Step 1의 변경이 자동으로 반영된다.

같은 파일에서 `BOSS_S`를 쓰는 다른 테스트(134·146·225행)는 피해 수치를 직접 단정하지 않고 보정 규칙만 검증하므로 고치지 않는다.

- [ ] **Step 4: A·S에서 최대 피해가 도착 HP를 넘는지 계산으로 확인한다**

이 Task의 목적이 달성됐는지 보는 계산이다. 코드 변경은 없다.

```text
A: 44 × 1.5 = 66.0  vs 도착 평균 HP 56.4  →  1.17 > 1.0  ✓
S: 52 × 1.5 = 78.0  vs 도착 평균 HP 58.4  →  1.34 > 1.0  ✓
C: 26 × 1.25 = 32.5 vs 도착 평균 HP 66.1  →  0.49 < 1.0  (의도대로 관대)
B: 34 × 1.25 = 42.5 vs 도착 평균 HP 65.3  →  0.65 < 1.0  (의도대로 관대)
```

도착 평균 HP는 Task 6의 백테스트가 실제 값을 다시 준다. 그때 A·S의 비율이 1.0을 넘는지 다시 확인한다.

- [ ] **Step 5: 전체 테스트가 통과하는지 확인한다**

Run: `pnpm test`
Expected: PASS. 43 파일 439 테스트 전부 통과.

- [ ] **Step 6: 커밋**

```bash
git add lib/content/bosses.ts lib/rules/boss.test.ts
git commit -F - <<'MSG'
밸런스: 보스 기본 피해를 도착 HP 구간으로 올린다

보스는 파티원마다 한 번만 때리고 보정 상한이 +50%다. S 보스의 최대
피해가 36인데 보스방 도착 평균 HP가 56이라 나쁜 정보를 줘도 수학적으로
죽지 않았다. 정보 시스템의 최종 정산 지점이 무력했다.

등급마다 성격을 다르게 잡는다. 보스 정보 보장이 C·B는 1회, A·S는
2회라 실제 보정 폭이 갈리기 때문이다. C·B는 보정 폭이 좁고 도착 HP가
높아 그 구간에서 정보로 생사를 가르려면 기본 피해가 A·S보다 오히려
높아야 한다.

그래서 C·B는 HP 관리가 부실했던 사람만 죽고, A·S는 정보 품질이 직접
생사를 가르도록 나눈다. 등급이 오를수록 보스전이 진짜 정산 지점이 된다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

## Task 5: 공식 문서의 수치를 맞춘다

**Files:**
- Modify: `docs/systems/PROGRESSION_AND_ENDINGS.md`
- Modify: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`

**Interfaces:**
- Consumes: Task 1~4가 확정한 상수 전부.
- Produces: 없음. 마지막 문서 변경이다.

**배경:** 상수의 근거는 코드가 아니라 문서에 먼저 적혀 있다. 문서가 단일 출처이므로 코드와 어긋난 채로 두지 않는다.

- [ ] **Step 1: 등급별 보상표를 고친다**

`docs/systems/PROGRESSION_AND_ENDINGS.md`의 `## 등급별 공고와 기본 보상` 표:

```markdown
| 던전 등급 | 지원 최소 명성 | 3명 생존 명성 | 3명 생존 골드 | 전체 지도 지점 |
| --- | ---: | ---: | ---: | ---: |
| C | -30 | 6 | 12 | 7 |
| B | -10 | 9 | 21 | 9 |
| A | 10 | 15 | 33 | 11 |
| S | 30 | 24 | 48 | 13 |
```

표 아래에 요구 명성이 음수인 이유를 한 문단 더한다.

```markdown
지원 최소 명성이 음수인 것은 전멸의 대가를 없애기 위해서가 아니다. 전멸은 명성을 깎는 동시에 그 던전의 등급을 올려 지원 문턱을 함께 올린다. 두 효과가 같은 방향으로 겹치므로 문턱을 0에서 시작하면 첫 전멸이 곧 캠페인 종료가 된다. 등급 간 간격을 20으로 균등하게 두고 전체를 아래로 내려, 전멸이 회복 가능한 손실이 되게 한다. 명성이 계속 내려가면 결국 모든 공고가 잠기고 길잡이 자격 박탈로 끝난다.
```

- [ ] **Step 2: 파티원 소지 골드 범위를 고친다**

같은 문서의 해당 문장을 바꾼다.

```markdown
파티원의 소지 골드는 캠페인 시작 시 시드로 20~45 사이에서 정하고 계약 전에 정확히 보여준다. 이 값은 전멸 유품으로만 회수되며, 배신 경로의 주 수입원이다.
```

- [ ] **Step 3: 승급 점수표를 고친다**

같은 문서의 `## 승급 점수` 표:

```markdown
| 길잡이 등급 | 필요한 점수 |
| --- | ---: |
| C | 0 |
| B | 120 |
| A | 261 |
| S | 489 |
```

- [ ] **Step 4: 승급 속도 기준을 캠페인 길이로 다시 쓴다**

`## 프로토타입 승급 속도 기준` 절 전체를 아래로 교체한다. 이 절이 이번 조정의 핵심 근거다.

```markdown
## 프로토타입 승급 속도 기준

클리어 횟수는 별도의 승급 조건이 아니라 점수표를 조정하기 위한 기준 진행이다. 캠페인이 던전 15개이므로 기준 진행도 15개 완주로 잡는다.

- C→B: C급 5개를 각각 3명 생존으로 클리어
- B→A: C급 6개와 B급 3개를 각각 3명 생존으로 클리어
- A→S: 위에 더해 B급 1개와 A급 3개를 각각 3명 생존으로 클리어

현재 보상표에서 기준 상태는 다음과 같다.

- B: 5번째 클리어 · 현재 명성 30, 누적 골드 60, 120점
- A: 9번째 클리어 · 현재 명성 63, 누적 골드 135, 261점
- S: 13번째 클리어 · 현재 명성 117, 누적 골드 255, 489점
- 15개 완주: 현재 명성 165, 누적 골드 351, 681점

최고 등급을 캠페인 후반에 두는 것이 의도다. 이전 기준은 클리어 7번에 S 도달을 상정해 후반 절반이 등급상 무의미했다.
```

- [ ] **Step 5: 자원 모델 표의 명성 설명을 확인한다**

같은 문서 `## 자원 모델` 표에서 `현재 명성`의 최솟값이 `제한 없음`인지 확인한다. 이 조정은 하한을 도입하지 않았으므로 **그대로 둔다.** 값이 다르게 적혀 있다면 `제한 없음`으로 맞춘다.

```bash
grep -n "현재 명성" docs/systems/PROGRESSION_AND_ENDINGS.md
```

- [ ] **Step 6: 배정표의 조정 가능한 상수 목록에 소지 골드를 더한다**

`docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`의 `### 조정할 수 있는 상수` 표에 한 줄을 더한다.

```markdown
| `lib/rules/campaign-init.ts` | `INITIAL_MEMBER_GOLD_MIN` · `MAX` | 파티원 소지 골드 범위. 전멸 유품의 크기 |
```

- [ ] **Step 7: 배정표의 첫 백테스트 보고서 절에 후속 표시를 단다**

같은 문서의 `## 첫 백테스트 보고서` 절 맨 앞에 한 줄을 더해, 그 표가 역사 기록임을 밝힌다. 표 자체는 지우지 않는다. 조정의 출발점이 무엇이었는지가 근거이기 때문이다.

```markdown
> 이 절은 `C4` 시점의 기록이다. `B1` 조정 뒤의 현재 수치는 [BACKTEST_REPORT.md](BACKTEST_REPORT.md)를 본다.
```

- [ ] **Step 8: 문서 정합성을 확인한다**

옛 수치가 문서에 남아 있지 않은지 훑는다.

```bash
grep -rn "274\|370\|10~30\|지원 최소 명성" docs/systems/PROGRESSION_AND_ENDINGS.md
```

Expected: 새 값만 나온다. `274`나 `370`이 남아 있으면 Step 3·4에서 놓친 곳이다.

- [ ] **Step 9: 배정표 무결성 검사를 돌린다**

Run: `pnpm test docs/technical/PROTOTYPE_WORK_ASSIGNMENT.test.ts`
Expected: PASS. 배정표 표와 의존성 그래프의 규약이 유지된다.

- [ ] **Step 10: 커밋**

```bash
git add docs/systems/PROGRESSION_AND_ENDINGS.md docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md
git commit -F - <<'MSG'
문서: 밸런스 조정을 설정집에 반영한다

상수의 근거는 코드가 아니라 문서에 먼저 적혀 있다. 보상표, 승급 점수표,
승급 속도 기준, 소지 골드 범위를 조정한 값으로 맞춘다.

승급 속도 기준은 숫자만 바꾸지 않고 의도를 다시 쓴다. 이전 기준이
클리어 7번을 상정한 것이 S 조기 도달의 원인이었으므로, 캠페인 길이인
15개 완주를 기준 진행으로 삼는다.

지원 최소 명성이 음수인 이유를 문서에 적는다. 전멸의 대가를 없애는
것이 아니라, 명성 하락과 던전 등급 상승이 같은 방향으로 겹치는 것을
완화하는 조치다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

## Task 6: 10,000 시드로 재측정하고 완료를 판정한다

**Files:**
- Modify: `docs/technical/BACKTEST_REPORT.md` (`pnpm backtest`가 재생성. 직접 편집하지 않는다)

**Interfaces:**
- Consumes: Task 1~4가 확정한 상수 전부.
- Produces: 갱신된 백테스트 보고서와 완료 판정 결과.

**배경:** 사전 측정은 1,000 시드였다. 10,000 시드에서 수치가 소폭 달라질 수 있으므로 목표에 여유를 두었다. 이 Task가 `B1`의 완료 여부를 결정한다.

- [ ] **Step 1: 작업 트리가 깨끗한지 확인한다**

보고서의 diff를 읽으려면 다른 변경이 섞여 있으면 안 된다. 별도 사본은 만들지 않는다 — `git`이 조정 전 보고서를 이미 갖고 있고 Step 3의 `git diff`가 전후를 보여준다.

```bash
git status --short
```

Expected: 추적 중인 파일에 변경이 없다. `.omo/`와 `dungeon-schemer-handoff.md`는 추적하지 않는 개인 파일이므로 나와도 된다.

- [ ] **Step 2: 10,000 시드 백테스트를 돌린다**

```bash
pnpm backtest
```

Expected: `생성 오류 0건`, `진행 불가 0건`. 약 60~90초 걸린다.

**생성 오류나 진행 불가가 1건이라도 나오면 여기서 멈춘다.** 이는 밸런스가 아니라 강제 조건 위반이므로, 어느 상수가 지도·게시판 생성을 불가능하게 만들었는지 찾아야 한다.

- [ ] **Step 3: 무엇이 얼마나 달라졌는지 본다**

```bash
git diff docs/technical/BACKTEST_REPORT.md
```

보고서를 파일로 떨어뜨리는 이유가 이 단계다. 콘솔로만 보면 패치 전후를 사람이 눈으로 맞춰야 한다.

- [ ] **Step 4: 완료 판정 기준과 대조한다**

보고서의 값을 아래 표에 채워 넣고 판정한다.

| 지표 | 조정 전 | 목표 | 측정값 | 판정 |
| --- | ---: | ---: | ---: | --- |
| survivalFirst S 최초 도달 중앙값 | 7~8회차 | 12회차 이상 | | |
| wipeGoldFirst S 도달률 | 33.6% | 70% 이상 | | |
| 최종 점수 비율 (wipeGoldFirst ÷ survivalFirst) | 29% | 70% 이상 | | |
| survivalFirst 길잡이 자격 박탈 | 0% | 5% 이하 | | |
| A 보스 최대 피해 ÷ A 보스방 도착 평균 HP | 0.42 | 1.0 초과 | | |
| S 보스 최대 피해 ÷ S 보스방 도착 평균 HP | 0.64 | 1.0 초과 | | |
| survivalFirst 평균 전멸 | 0.5 | 1.5 이상 | | |

보스 비율은 보고서의 `보스방 도착 평균 HP`와 기본 피해로 계산한다. A는 `44 × 1.5 = 66`, S는 `52 × 1.5 = 78`을 쓴다. `balanced` 전략의 값으로 판정한다.

- [ ] **Step 5: 네 엔딩이 모두 도달 가능한지 확인한다**

보고서의 엔딩 분포에서 `불신의 대가`, `원정 종료`, `길잡이 자격 박탈` 셋이 세 전략을 통틀어 0%가 아닌지 본다.

`용사들의 시대가 끝나다`(`partyExhausted`)는 사전 측정에서 세 전략 모두 0.0%였다. 이는 백테스트 전략이 파티를 전부 소진할 만큼 극단적으로 굴지 않기 때문이며 조정 전에도 같았다. **이번 조정이 만든 회귀가 아니므로 여기서 막지 않는다.** 도달 가능성은 `lib/rules/ending.test.ts`의 단위 테스트가 보장한다.

- [ ] **Step 6: 목표에 미달한 지표가 있으면 판단한다**

미달 지표가 있으면 상수를 다시 조정하고 Step 2부터 반복한다. 어느 손잡이를 움직일지는 아래를 참고한다.

| 미달 지표 | 움직일 손잡이 | 방향 |
| --- | --- | --- |
| 배신 S 도달률이 낮다 | `INITIAL_MEMBER_GOLD_MAX` | 올린다. 단 배신 S 도달 중앙값이 9회차보다 빨라지면 되돌린다 |
| 배신 자격 박탈이 너무 높다 | `requiredReputation` | 전체를 더 내린다. 간격 20은 유지한다 |
| 생존 S 도달이 이르다 | `PROMOTION_THRESHOLDS.S` | 올린다. 기준 시나리오와 어긋나므로 `BASELINE_CLEARS`도 함께 본다 |
| 보스 비율이 1.0 미만이다 | `BOSSES[].baseDamage` | A·S만 올린다. C·B는 관대한 것이 의도다 |

한 번에 하나씩 움직인다. 둘을 동시에 바꾸면 어느 쪽 효과인지 읽을 수 없다.

- [ ] **Step 7: 보고서를 커밋한다**

목표를 모두 충족했을 때만 실행한다.

```bash
git add docs/technical/BACKTEST_REPORT.md
git commit -F - <<'MSG'
검증: 조정한 상수로 백테스트 보고서를 다시 만든다

10,000 시드 × 3전략을 다시 돌린 결과다. 생성 오류 0건과 진행 불가
0건은 그대로 유지된다.

배신 전략이 캠페인을 끝까지 끌고 갈 수 있게 되었고 최종 점수가 생존
전략에 견줄 만해졌다. S 최초 도달은 캠페인 후반으로 옮겨갔다. A·S
보스는 최대 피해가 보스방 도착 평균 HP를 넘어 정보 품질이 생사를
가른다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

## Task 7: 전체 검증과 Pull Request

**Files:** 없음 (git 작업만)

**Interfaces:**
- Consumes: Task 1~6의 커밋 전부.
- Produces: `main`을 대상으로 하는 Pull Request.

- [ ] **Step 1: 네 검증 명령을 모두 돌린다**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: 전부 통과. `pnpm test`는 43 파일 439 테스트다.

- [ ] **Step 2: 규칙 구조를 건드리지 않았는지 확인한다**

```bash
git diff main..HEAD --stat
```

Expected: 변경된 `lib/**` 파일이 `fixtures.ts`, `promotion.ts`, `dungeons.ts`, `campaign-init.ts`, `bosses.ts`와 각 테스트뿐이다. `settlement.ts`, `board.ts`, `boss.ts`, `ending.ts`, `campaign-machine.ts`의 **구현 파일**이 나오면 범위를 벗어난 것이므로 되돌린다.

`components/**/*.tsx`와 `app/**/*.tsx`가 나오면 안 된다. 테스트 파일(`.test.ts`)만 허용된다.

- [ ] **Step 3: 배정표에서 B1을 완료로 바꾼다**

`docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`의 배정표에서 `B1` 행의 담당과 상태를 갱신한다. 이 파일은 여러 PR이 건드리므로 **작업 마지막에 main과 동기화한 뒤** 고친다.

```bash
git fetch origin && git merge origin/main
```

`B1` 행의 `담당`에 구현자 식별자를 적고 `상태`를 `✅`로 바꾼다. 다른 행의 `선행`에 `B1`이 남아 있으면 지운다.

```bash
pnpm test docs/technical/PROTOTYPE_WORK_ASSIGNMENT.test.ts
```

Expected: PASS.

```bash
git add docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md
git commit -F - <<'MSG'
문서: 배정표에서 B1 완료를 반영한다

밸런스 조정을 완료로 바꾸고 담당을 적는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

- [ ] **Step 4: 브랜치를 push한다**

```bash
git push -u origin feature/b1-balance-adjustment
```

- [ ] **Step 5: Pull Request를 만든다**

본문의 `측정값` 자리에는 Task 6 Step 4에서 채운 실제 수치를 넣는다.

```bash
gh pr create --base main --title "B1: 밸런스를 조정하고 백테스트로 재측정한다" --body "$(cat <<'PRBODY'
## 배경

첫 백테스트가 밸런스 문제 셋을 드러냈다. 배신 전략의 69.8%가 명성 붕괴로 조기 종료했고, 생존·균형 전략은 S 도달률 100%에 최초 도달이 7~8회차였으며, S 보스 최대 피해 36이 보스방 도착 평균 HP 56에 미치지 못했다.

## 변경

규칙 함수의 구조는 그대로 두고 상수와 기준 시나리오 데이터만 바꿨다.

| 상수 | 이전 (C/B/A/S) | 이후 |
| --- | --- | --- |
| `requiredReputation` | 0 / 30 / 60 / 100 | −30 / −10 / 10 / 30 |
| `baseReputationReward` | 10 / 15 / 25 / 40 | 6 / 9 / 15 / 24 |
| `baseGoldReward` | 20 / 35 / 55 / 80 | 12 / 21 / 33 / 48 |
| `PROMOTION_THRESHOLDS` | 120 / 274 / 370 | 120 / 261 / 489 |
| `INITIAL_MEMBER_GOLD` | 10~30 | 20~45 |
| `BOSSES.baseDamage` | 8 / 12 / 17 / 24 | 26 / 34 / 44 / 52 |
| `BASELINE_CLEARS` | 7단계 | 15단계 완주 |

## 설계에서 뒤집힌 가설

명성 절벽의 원인을 처음에는 `현재 명성에 하한이 없어서`로 보았다. 그 가설대로 C급 요구 명성만 내려 측정하니 자격 박탈이 0% → 43.6%로 **오히려 나빠졌다.**

실제 기전은 `settleDungeon()`의 던전 등급 상승이었다. 전멸하면 내 명성이 내려가는 동시에 그 던전의 요구 명성이 올라가 양쪽에서 벌어진다. 등급 간 간격을 균등하게 편 뒤에야 0.1%로 떨어졌다.

`S 도달률 100%` 또한 결함이 아니라 사양대로 동작한 결과였다. 승급 속도 기준이 클리어 7번을 상정하는데 캠페인은 던전 15개다. 기준 시나리오를 캠페인 길이로 다시 쓰고 승급 점수를 거기서 파생했다.

## 측정 결과

| 지표 | 이전 | 목표 | 이후 |
| --- | ---: | ---: | ---: |
| survivalFirst S 최초 도달 중앙값 | 7~8회차 | 12회차 이상 | 측정값 |
| wipeGoldFirst S 도달률 | 33.6% | 70% 이상 | 측정값 |
| 최종 점수 비율 (배신÷생존) | 29% | 70% 이상 | 측정값 |
| survivalFirst 길잡이 자격 박탈 | 0% | 5% 이하 | 측정값 |
| survivalFirst 평균 전멸 | 0.5 | 1.5 이상 | 측정값 |

생성 오류 0건과 진행 불가 시드 0건은 유지된다.

## 확인 방법

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` 전부 통과
- `pnpm backtest` 10,000 시드 재측정, 보고서를 커밋에 동봉
- `git diff main..HEAD --stat`으로 규칙 구현 파일과 화면 컴포넌트가 변경되지 않았음을 확인

## 리뷰 요청 사항

- 요구 명성을 음수 구간까지 내린 것이 `명성` 자원의 의미를 해치지 않는지
- 보스전의 성격을 등급별로 나눈 것(C·B는 HP 관리, A·S는 정보 품질)에 동의하는지
- 최종 점수 비율 목표를 80%에서 70%로 내린 판단 — 85%를 만들면 배신이 7회차에 S를 찍어 승급 속도 문제가 배신 쪽에서 재발한다

## 관련 문서

- spec: `docs/superpowers/specs/2026-08-17-lattebun-balance-adjustment-design.md`
- plan: `docs/superpowers/plans/2026-08-17-lattebun-balance-adjustment.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
PRBODY
)"
```

- [ ] **Step 6: PR URL을 사용자에게 전달한다**

```bash
gh pr view --json url,title,number
```

출력된 URL을 사용자에게 알린다. `main`은 팀원 승인 1개가 필요하고 본인은 자기 PR을 승인할 수 없다는 점, 승인받은 뒤 그 브랜치에 push하면 승인이 날아간다는 점을 함께 전달한다.

---

## 완료 조건

- 배정표 `B1`의 완료 기준을 충족한다 — 배신 전략이 성립하고, S 도달이 캠페인 후반으로 옮겨갔으며, A·S 보스가 위협이 된다.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`가 모두 통과한다.
- 갱신된 `BACKTEST_REPORT.md`가 커밋에 들어 있고 생성 오류·진행 불가가 0건이다.
- `lib/**`의 규칙 **구현** 파일과 `components/**`·`app/**`의 화면 파일이 변경되지 않았다.
- `docs/systems/PROGRESSION_AND_ENDINGS.md`의 수치가 코드와 일치한다.
- `main`을 대상으로 하는 Pull Request가 열려 있고 URL을 사용자가 받았다.
