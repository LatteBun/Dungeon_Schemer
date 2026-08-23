# C4 원정 정산 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 원정 최종 파티를 검증해 캠페인에 한 번만 정산하고, 보상·유품·위험도·중상·응급 편성·인력 소진·통계·U6 표시를 같은 계약으로 연결한다.

**Architecture:** C4는 도메인 정산 타입과 순수 규칙으로 나눈다. C7 전이만 원정 ID 이력을 검사한 뒤 C4를 호출하고 C8은 반환된 SettlementResult를 그대로 기록한다. U6은 캠페인을 계산하지 않고 결과를 화면 View로 변환한다.

**Tech Stack:** Next.js 16.3, React 19.2, TypeScript 5, Vitest 4.1

**Spec:** docs/superpowers/specs/2026-08-23-lattebun-c4-expedition-settlement-design.md

## Global Constraints

- 모든 규칙 함수는 입력을 변경하지 않고 새 값만 반환한다.
- 파티는 정확히 3명이며 직업이 서로 다르다.
- goldDelta는 계약 보상만, relicGold는 전멸 유품만 뜻한다. 현재·누적 골드에는 둘의 합만 적용한다.
- 클리어 계약금과 전멸 유품만 cumulativeGold를 올린다.
- 전멸 명성 손실은 contractRisk의 3명 생존 명성 보상이며 명성 하한은 0이다.
- 실패만 attempts와 위험도를 올리고 위험도는 ★5에서 멈춘다.
- HP가 최대 HP의 정확히 20%면 중상이 아니다.
- C7만 settledExpeditionIds를 검사·추가하고 phase를 바꾼다.
- 정상 후보로 완전 파티 하나라도 만들 수 있으면 중상자를 쓰지 않는다. 응급 시 중상 수 최소, 완전 파티 수 최대, 시드 순서로 선택한다.
- U6은 정산 수치·원인 사슬을 재계산하지 않는다.
- 커밋 제목과 본문은 모두 한글로 작성한다.

---

## File Map

- lib/domain/settlement.ts (신규): 정산 입력·결과·원인 사슬과 위험도 보상표.
- lib/domain/statistics.ts (신규): C8 정산 기록 컨테이너.
- lib/domain/campaign.ts, character.ts, index.ts: 정산 이력·통계·응급 후보 계약.
- lib/rules/settlement.ts (신규): C4 검증과 불변 정산.
- lib/rules/board.ts: 정상 우선 응급 편성.
- lib/rules/ending.ts (신규): C6 인력 소진 판정.
- lib/rules/campaign-transition.ts (신규): C7 중복 차단, C4 호출, C8 기록.
- components/game/u3-board-model.ts: 화면 내부 보상표 제거.
- components/game/u6-settlement-model.ts: SettlementResult → U6SettlementView 어댑터.
- 공식 문서 네 개와 문서 테스트: 응급 편성·인력 소진·C4 링크를 코드와 맞춘다.

### Task 1: 정산 도메인 계약과 공유 보상표

**Files:**
- Create: lib/domain/settlement.ts
- Create: lib/domain/statistics.ts
- Modify: lib/domain/campaign.ts, lib/domain/character.ts, lib/domain/index.ts
- Test: lib/domain/contract.test.ts

**Interfaces:**
- Produces: FULL_SURVIVOR_REWARDS, rewardForSurvivors, SettlementSnapshot, SettlementResult, SettlementCauseChain, CampaignStatistics, canDeployEmergency.

- [ ] **Step 1: 실패하는 계약 테스트를 쓴다**

~~~ts
it("위험도와 생존 인원으로 계약 보상을 계산한다", () => {
  expect(rewardForSurvivors(3, 3)).toEqual({ reputation: 15, gold: 32 });
  expect(rewardForSurvivors(3, 2)).toEqual({ reputation: 9, gold: 19 });
  expect(rewardForSurvivors(3, 1)).toEqual({ reputation: 4, gold: 9 });
});
it("응급 후보는 중상을 포함하지만 사망자와 신뢰 0은 제외한다", () => {
  expect(canDeployEmergency(character({ gravelyWounded: true }))).toBe(true);
  expect(canDeployEmergency(character({ alive: false }))).toBe(false);
});
~~~

SettlementSnapshot fixture에는 expeditionId, dungeonId, contractRisk, 3명 party, 같은 순서 finalMembers, 상태, 선택·반응·피해 causeInputs를 모두 채운다.

- [ ] **Step 2: 실패를 확인한다**

Run: pnpm vitest run lib/domain/contract.test.ts

Expected: FAIL — 새 export가 없다.

- [ ] **Step 3: 최소 계약을 구현한다**

~~~ts
export const FULL_SURVIVOR_REWARDS: Readonly<Record<RiskLevel, Reward>> = {
  1: { reputation: 6, gold: 12 }, 2: { reputation: 10, gold: 20 },
  3: { reputation: 15, gold: 32 }, 4: { reputation: 21, gold: 45 },
  5: { reputation: 28, gold: 60 },
};
export function rewardForSurvivors(risk: RiskLevel, survivors: 0 | 1 | 2 | 3): Reward {
  const full = FULL_SURVIVOR_REWARDS[risk];
  const factor = ([0, 0.3, 0.6, 1] as const)[survivors];
  return { reputation: Math.floor(full.reputation * factor), gold: Math.floor(full.gold * factor) };
}
~~~

SettlementResult에는 생존자·멤버 before/after·분리 델타·위험도·다섯 원인 단계가 들어간다. CampaignState에는 settledExpeditionIds와 statistics.settlements를 추가한다. canDeployEmergency은 alive와 trust만 판정한다.

- [ ] **Step 4: 통과를 확인한다**

Run: pnpm vitest run lib/domain/contract.test.ts && pnpm typecheck

Expected: PASS.

- [ ] **Step 5: 커밋한다**

~~~bash
git add lib/domain/settlement.ts lib/domain/statistics.ts lib/domain/campaign.ts lib/domain/character.ts lib/domain/index.ts lib/domain/contract.test.ts
git commit -m "기능: 원정 정산의 도메인 계약을 추가한다" -m "위험도 보상표와 정산 결과를 한 계약으로 두고 응급 후보와 정산 이력·통계의 상태 자리를 만든다."
~~~

### Task 2: C4 순수 정산 규칙

**Files:**
- Create: lib/rules/settlement.ts
- Create: lib/rules/settlement.test.ts

**Interfaces:**
- Produces: settleExpedition(campaign: CampaignState, snapshot: SettlementSnapshot): SettlementExecution.

- [ ] **Step 1: 실패하는 정산 테스트를 쓴다**

~~~ts
it.each([[3, 15, 32], [2, 9, 19], [1, 4, 9]] as const)(
  "%i명 생존 클리어는 계약금을 현재·누적 골드에 더한다", (survivors, reputation, gold) => {
    const { campaign, result } = settleExpedition(campaignFixture(), snapshotFixture({ survivors }));
    expect(result).toMatchObject({ survivorCount: survivors, reputationDelta: reputation, goldDelta: gold, relicGold: 0 });
    expect(campaign).toMatchObject({ reputation: 30 + reputation, gold: 10 + gold, cumulativeGold: gold });
  },
);
it("전멸은 계약 위험도 명성을 잃고 유품만 회수한다", () => {
  const { campaign, result } = settleExpedition(campaignFixture({ reputation: 6 }), snapshotFixture({ status: "wiped", contractRisk: 2 }));
  expect(result).toMatchObject({ reputationDelta: -10, goldDelta: 0, relicGold: 90, riskBefore: 2, riskAfter: 3 });
  expect(campaign.reputation).toBe(0);
});
~~~

★5 전멸 상한, 부분 생존 사망자 골드 보존, 전멸 사망자 골드 0, 정확히 20%·20% 미만 HP, 입력 불변성도 검사한다. 누락/중복 ID, 파티 밖 멤버, 생존자 불일치, 범위 밖 값, 사망자 양수 HP는 INVALID_SETTLEMENT를 단정한다.

- [ ] **Step 2: 실패를 확인한다**

Run: pnpm vitest run lib/rules/settlement.test.ts

Expected: FAIL — 모듈이 없다.

- [ ] **Step 3: 검증 후 계산을 구현한다**

~~~ts
export function settleExpedition(campaign: CampaignState, snapshot: SettlementSnapshot): SettlementExecution {
  validateSettlement(campaign, snapshot);
  const outcome = calculateSettlementOutcome(campaign, snapshot);
  return { campaign: applySettlement(campaign, snapshot, outcome), result: outcome.result };
}
~~~

검증을 전부 끝낸 뒤 새 pool.byId와 dungeons만 만든다. 클리어는 대상만 cleared로 바꾸고 attempts를 보존한다. 전멸은 대상 현재 위험도가 contractRisk와 같은지 검증한 뒤 attempts + 1과 min(5, risk + 1)을 적용한다. 앞 세 원인 단계는 snapshot, 뒤 둘은 계산 결과에서 만든다.

- [ ] **Step 4: 통과를 확인한다**

Run: pnpm vitest run lib/rules/settlement.test.ts && pnpm typecheck

Expected: PASS.

- [ ] **Step 5: 커밋한다**

~~~bash
git add lib/rules/settlement.ts lib/rules/settlement.test.ts
git commit -m "기능: 원정 결과를 캠페인에 정산한다" -m "생존 보상과 전멸 유품·명성 손실·위험도 상승을 불변 상태 전이로 계산하고 잘못된 원정 스냅샷을 거부한다."
~~~

### Task 3: C2 정상 우선 응급 편성

**Files:**
- Modify: lib/rules/board.ts
- Modify: lib/rules/board.test.ts

**Interfaces:**
- Produces: 기존 createBoardOffers의 정상 우선 결과와 canCreateEmergencyParty(pool).

- [ ] **Step 1: 실패하는 응급 편성 테스트를 쓴다**

~~~ts
it("정상 파티가 하나라도 가능하면 중상자를 써서 공고 수를 늘리지 않는다", () => {
  const offers = createBoardOffers(stateWithMembers([
    member("warrior"), member("rogue"), member("mage"),
    member("cleric", { gravelyWounded: true }),
  ]));
  expect(offers).toHaveLength(1);
  expect(allMemberIds(offers)).not.toContain("wounded-cleric");
});
it("응급 편성은 전체 게시판의 중상 수를 먼저 최소화한다", () => {
  expect(countWounded(createBoardOffers(emergencyFixtureWithAlternatives()))).toBe(1);
});
~~~

사망·신뢰 0 중상자의 배제, 같은 입력 재현성, worldTurn에 따른 동률 해소, canCreateEmergencyParty의 true/false를 함께 검사한다.

- [ ] **Step 2: 실패를 확인한다**

Run: pnpm vitest run lib/rules/board.test.ts

Expected: FAIL — 현재 중상자는 항상 제외한다.

- [ ] **Step 3: 후보 풀과 점수 비교를 분리한다**

정상 후보로 한 파티라도 가능하면 기존 계획만 쓴다. 아니라면 응급 후보를 사용하고 중상 수, 음수 파티 수 순으로 비교한다. 동점은 기존 rng.shuffle 뒤 먼저 만난 계획을 유지한다.

~~~ts
type EmergencyScore = readonly [woundedCount: number, negativePartyCount: number];
const better = (left: EmergencyScore, right: EmergencyScore) =>
  left[0] < right[0] || (left[0] === right[0] && left[1] < right[1]);
~~~

- [ ] **Step 4: 통과를 확인한다**

Run: pnpm vitest run lib/rules/board.test.ts && pnpm typecheck

Expected: PASS.

- [ ] **Step 5: 커밋한다**

~~~bash
git add lib/rules/board.ts lib/rules/board.test.ts
git commit -m "기능: 인력 부족 시 중상자를 응급 편성한다" -m "정상 파티가 가능하면 기존 후보만 사용하고 불가능할 때만 중상 수 최소와 완전 파티 수 최대 순서로 결정한다."
~~~

### Task 4: C6 인력 소진을 응급 편성 뒤에 판정한다

**Files:**
- Create: lib/rules/ending.ts
- Create: lib/rules/ending.test.ts

**Interfaces:**
- Produces: isPersonnelExhausted(campaign: CampaignState): boolean.

- [ ] **Step 1: 실패하는 인력 소진 테스트를 쓴다**

~~~ts
it("중상자를 포함해 세 직업을 만들 수 있으면 인력 소진이 아니다", () => {
  expect(isPersonnelExhausted(campaignWith([
    member("warrior"), member("rogue"), member("cleric", { gravelyWounded: true }),
  ]))).toBe(false);
});
it("사망자와 신뢰 0을 뺀 뒤 세 직업을 못 만들면 인력 소진이다", () => {
  expect(isPersonnelExhausted(campaignWith([
    member("warrior"), member("rogue"), member("mage", { alive: false }), member("cleric", { trust: 0 }),
  ]))).toBe(true);
});
~~~

- [ ] **Step 2: 실패를 확인한다**

Run: pnpm vitest run lib/rules/ending.test.ts

Expected: FAIL — 모듈이 없다.

- [ ] **Step 3: 판정을 구현한다**

~~~ts
export function isPersonnelExhausted(campaign: CampaignState): boolean {
  return !canCreateEmergencyParty(campaign.pool);
}
~~~

월드턴 뒤 pool을 받는다고 주석에 명시한다. C7 전체 상태 머신은 completed 뒤, unemployed 앞에 이 함수를 호출한다.

- [ ] **Step 4: 통과를 확인한다**

Run: pnpm vitest run lib/rules/ending.test.ts && pnpm typecheck

Expected: PASS.

- [ ] **Step 5: 커밋한다**

~~~bash
git add lib/rules/ending.ts lib/rules/ending.test.ts
git commit -m "기능: 인력 소진을 응급 편성 뒤에 판정한다" -m "중상자는 응급 후보로 포함하고 사망자와 신뢰 0 인원은 제외해 실제로 세 직업 파티를 만들 수 없는 경우만 인력 소진으로 본다."
~~~

### Task 5: C7 전이와 C8 정산 기록을 한 번만 적용한다

**Files:**
- Create: lib/rules/campaign-transition.ts
- Create: lib/rules/campaign-transition.test.ts
- Modify: lib/rules/campaign-init.ts
- Modify: lib/rules/campaign-init.test.ts

**Interfaces:**
- Produces: settleCampaignExpedition(campaign, snapshot): { campaign: CampaignState; settlement: SettlementResult }.

- [ ] **Step 1: 실패하는 전이 테스트를 쓴다**

~~~ts
it("새 expeditionId는 C4 결과를 한 번 적용하고 통계에 같은 결과를 기록한다", () => {
  const transition = settleCampaignExpedition(campaignFixture(), snapshotFixture({ expeditionId: "exp-01" }));
  expect(transition.campaign.settledExpeditionIds).toEqual(["exp-01"]);
  expect(transition.campaign.statistics.settlements).toEqual([transition.settlement]);
  expect(transition.campaign.phase).toBe("settlement");
});
it("이미 처리한 expeditionId는 C4 호출 전에 거부한다", () => {
  expect(() => settleCampaignExpedition(
    { ...campaignFixture(), settledExpeditionIds: ["exp-01"] }, snapshotFixture({ expeditionId: "exp-01" }),
  )).toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }));
});
~~~

성공·실패 입력 불변성, 기존 통계 append, 초기 이력·통계 빈 배열도 검사한다.

- [ ] **Step 2: 실패를 확인한다**

Run: pnpm vitest run lib/rules/campaign-transition.test.ts lib/rules/campaign-init.test.ts

Expected: FAIL — 전이 함수가 없다.

- [ ] **Step 3: C7 경계를 구현한다**

이미 처리한 ID는 INVALID_TRANSITION으로 거부한 뒤에만 C4를 호출한다. 성공 시 같은 SettlementResult 값을 통계에 append하고 phase를 settlement로 둔다. 승급·월드턴·최종 엔딩 전이는 여기 넣지 않는다. initializeCampaign은 빈 이력과 통계를 넣는다.

- [ ] **Step 4: 통과를 확인한다**

Run: pnpm vitest run lib/rules/campaign-transition.test.ts lib/rules/campaign-init.test.ts && pnpm typecheck

Expected: PASS.

- [ ] **Step 5: 커밋한다**

~~~bash
git add lib/rules/campaign-transition.ts lib/rules/campaign-transition.test.ts lib/rules/campaign-init.ts lib/rules/campaign-init.test.ts
git commit -m "기능: 원정 정산 전이와 기록을 한 번만 적용한다" -m "C7 경계에서 원정 ID 중복을 막고 C4 결과를 캠페인 상태와 C8 정산 통계에 같은 값으로 추가한다."
~~~

### Task 6: U3·U6을 공유 정산 계약의 소비자로 연결한다

**Files:**
- Modify: components/game/u3-board-model.ts, components/game/u3-board-model.test.ts
- Modify: components/game/u6-settlement-model.ts, components/game/u6-settlement-model.test.ts
- Modify: components/game/u6-preview-data.ts, components/game/u6-preview-data.test.ts

**Interfaces:**
- Produces: createU6SettlementView(campaign, settlement, dungeonName, themeId).

- [ ] **Step 1: 실패하는 어댑터 테스트를 쓴다**

~~~ts
it("정산 결과의 계약금과 유품을 재계산 없이 U6으로 옮긴다", () => {
  const view = createU6SettlementView(campaignFixture(), settlementFixture({ goldDelta: 0, relicGold: 84 }), "묘지 1", "graveyard");
  expect(view).toMatchObject({ survivors: 0, goldDelta: 0, relicGold: 84, riskBefore: 2, riskAfter: 3 });
  expect(view.causeChain.map((step) => step.order)).toEqual([1, 2, 3, 4, 5]);
});
it("★5 클리어는 위험도 상한에 막힌 실패가 아니다", () => {
  expect(createU6SettlementView(campaignFixture(), settlementFixture({ status: "cleared", riskBefore: 5, riskAfter: 5, riskCapped: false }), "사막 5", "desert").riskCapped).toBe(false);
});
~~~

U3 contractOutcomesForRisk가 도메인 rewardForSurvivors와 같은 값도 검사한다.

- [ ] **Step 2: 실패를 확인한다**

Run: pnpm vitest run components/game/u3-board-model.test.ts components/game/u6-settlement-model.test.ts components/game/u6-preview-data.test.ts

Expected: FAIL — 화면 내부 보상표와 U6 어댑터가 있다.

- [ ] **Step 3: 재계산을 제거하고 어댑터를 구현한다**

U3의 화면 전용 보상표를 지우고 도메인 함수를 사용한다. U6은 구조화 원인 사슬을 1~5 번호와 label로 변환하며 economy에는 계약금·유품을 따로 표시한다. riskCapped는 ★5 전멸일 때만 참이다. ★5 클리어 fixture도 false로 수정한다.

- [ ] **Step 4: 통과를 확인한다**

Run: pnpm vitest run components/game/u3-board-model.test.ts components/game/u6-settlement-model.test.ts components/game/u6-preview-data.test.ts components/game/U6SettlementScreen.test.ts && pnpm typecheck

Expected: PASS.

- [ ] **Step 5: 커밋한다**

~~~bash
git add components/game/u3-board-model.ts components/game/u3-board-model.test.ts components/game/u6-settlement-model.ts components/game/u6-settlement-model.test.ts components/game/u6-preview-data.ts components/game/u6-preview-data.test.ts
git commit -m "기능: 화면이 정산 계약을 재계산 없이 표시한다" -m "게시판과 정산 화면이 같은 위험도 보상표를 사용하고 U6은 C4 결과를 View 모델로 변환만 하도록 연결한다."
~~~

### Task 7: 공식 문서와 작업 배정표를 갱신한다

**Files:**
- Modify: docs/systems/CHARACTER_POOL_AND_WORLDTURN.md
- Modify: docs/systems/PROGRESSION_AND_ENDINGS.md
- Modify: docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md
- Modify: docs/README.md
- Test: docs/DOCUMENT_TERMINOLOGY.test.ts, docs/DOCUMENT_LINKS.test.ts

- [ ] **Step 1: 실패하는 문서 테스트를 쓴다**

문서 테스트에 응급 편성·중상·서로 다른 직업 3명이 공식 문서 두 곳에 있고 README가 새 Spec·Plan 링크를 갖는지 검사한다.

- [ ] **Step 2: 실패를 확인한다**

Run: pnpm vitest run docs/DOCUMENT_TERMINOLOGY.test.ts docs/DOCUMENT_LINKS.test.ts

Expected: FAIL — 응급 편성과 새 C4 링크가 없다.

- [ ] **Step 3: 코드와 같은 문장으로 고친다**

풀 문서에는 정상 파티 가능 시 중상 배제, 응급 시 중상 최소·파티 최대·시드 순서를 적는다. 성장 문서에는 응급 후보까지 포함해 세 직업 파티가 불가능할 때 인력 소진이라고 적는다. 배정표에는 C2 응급 편성, C4 정산 계약, C6 응급 뒤 판정, C7 ID 이력, C8 결과 기록을 명시한다. README에는 Spec·Plan 링크를 추가한다.

- [ ] **Step 4: 통과를 확인한다**

Run: pnpm vitest run docs/DOCUMENT_TERMINOLOGY.test.ts docs/DOCUMENT_LINKS.test.ts

Expected: PASS.

- [ ] **Step 5: 커밋한다**

~~~bash
git add docs/systems/CHARACTER_POOL_AND_WORLDTURN.md docs/systems/PROGRESSION_AND_ENDINGS.md docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md docs/README.md docs/DOCUMENT_TERMINOLOGY.test.ts docs/DOCUMENT_LINKS.test.ts
git commit -m "문서: 원정 정산과 응급 편성 규칙을 반영한다" -m "정상 우선 응급 편성, 인력 소진, 정산 결과와 관련 작업 의존성을 공식 규칙과 색인에 같은 의미로 기록한다."
~~~

### Task 8: 통합 회귀 검증과 완료 기록

**Files:**
- Modify: docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md

- [ ] **Step 1: 관련 테스트 묶음을 실행한다**

Run: pnpm vitest run lib/domain/contract.test.ts lib/rules/settlement.test.ts lib/rules/board.test.ts lib/rules/ending.test.ts lib/rules/campaign-transition.test.ts lib/rules/campaign-init.test.ts components/game/u3-board-model.test.ts components/game/u6-settlement-model.test.ts components/game/U6SettlementScreen.test.ts docs/DOCUMENT_TERMINOLOGY.test.ts docs/DOCUMENT_LINKS.test.ts

Expected: PASS.

- [ ] **Step 2: 전체 검증을 실행한다**

Run: pnpm lint && pnpm typecheck && pnpm test && pnpm build

Expected: PASS.

- [ ] **Step 3: 검증 후에만 배정표를 완료 처리한다**

Task 1~7과 Step 1~2가 모두 통과한 경우에만 C4 행의 담당을 LatteBun, 상태를 ✅로 바꾼다. C2·C6·C7·C8은 하위 계약만 구현하므로 기존 작업 상태를 바꾸지 않는다.

- [ ] **Step 4: 마지막 검증을 다시 실행한다**

Run: pnpm vitest run docs/DOCUMENT_TERMINOLOGY.test.ts docs/DOCUMENT_LINKS.test.ts && pnpm lint && pnpm typecheck && pnpm test && pnpm build

Expected: PASS.

- [ ] **Step 5: 커밋한다**

~~~bash
git add docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md
git commit -m "문서: C4 원정 정산 작업을 완료 처리한다" -m "정산·응급 편성·중복 방지·통계·화면 어댑터의 회귀 검증 결과를 작업 배정표에 기록한다."
~~~

## Self-Review

- Spec의 정산 스냅샷, 단일 유품 계산, 3·2·1명 보상, 전멸 손실·위험도·시도, 중상 경계, 누적 골드, 응급 편성, 인력 소진, C7 중복 차단, C8 기록, U6 어댑터, 문서 갱신을 Task 1~7에 배정했다.
- Task 1에서 정의한 타입을 Task 2·5·6이 같은 이름으로 소비한다.
- U3의 중복 보상표와 U6의 ★5 클리어 riskCapped fixture를 Task 6에서 교정한다.
- 문서를 고친 뒤에도 Task 8에서 전체 검증을 다시 실행한다.
