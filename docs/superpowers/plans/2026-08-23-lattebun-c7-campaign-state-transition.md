# C7 캠페인 상태 전이 Implementation Plan

- 작성일: 2026-08-23
- 작성자: LatteBun
- 작성 도구: Codex

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** C2~C6의 순수 결과를 한 번씩 적용하고, 8개 캠페인 phase의 허용 전이와 활성 원정 컨텍스트를 단일 순수 API로 제공한다.

**Architecture:** `lib/domain/campaign-transition.ts`는 저장하지 않는 전이 컨텍스트와 action/result 계약만 소유한다. `lib/rules/campaign-transition.ts`의 `transitionCampaign`은 C2 게시판, C3 월드턴, C4 정산, C5 승급 계산, C6 엔딩 평가를 호출하고 결과를 새 CampaignState와 컨텍스트에 원자적으로 적용한다. C8 통계는 반환 SettlementResult를 나중에 소비하므로 C7은 `statistics.settlements`를 쓰지 않는다.

**Tech Stack:** Next.js 16.3, React 19.2, TypeScript 5, Vitest 4.1, Zustand 5(이번 작업에서는 사용하지 않음).

**Spec:** [C7 캠페인 상태 전이 설계](../specs/2026-08-23-lattebun-c7-campaign-state-transition-design.md)

## Global Constraints

- 구현 시작 전 `rg --files node_modules/next/dist/docs`로 Next.js 16.3 가이드 위치를 확인하고 관련 TypeScript/테스트 가이드를 읽는다. C7 규칙은 React/Next 런타임을 호출하지 않는다.
- C6 PR #110이 병합된 main을 기반으로 한다. C6 엔딩의 조건·제목·사유·trigger ID를 C7에서 재구현하지 않는다.
- CampaignState.phase를 바꾸는 새 공개 규칙 API는 transitionCampaign 하나다. C5는 승급 가능 여부와 자원·등급 계산만 제공하고 phase나 offers를 바꾸지 않는다.
- CampaignTransitionContext는 persistent CampaignState에 넣지 않는다. I1 Store가 세션 동안 보관하며 새 캠페인은 selectedOffer와 activeExpedition이 모두 null이다.
- 잘못된 phase, 없는/잠긴 공고, 계약과 다른 원정·정산 파티, 중복 원정 ID, 종료 뒤 진행 action은 RuleError("INVALID_TRANSITION")으로 거부하고 입력을 변경하지 않는다.
- OPEN_BOARD와 COMPLETE_WORLD_TURN만 C2 createBoardOffers를 호출한다. COMPLETE_WORLD_TURN은 campaign seed와 현재 turn에서 파생한 "worldturn" RNG로 C3을 실행한 뒤 새 공고, C6 정상 엔딩 순서를 지킨다.
- COMPLETE_EXPEDITION은 C4 settleExpedition을 정확히 한 번 호출하고 settledExpeditionIds만 기록한다. statistics.settlements append는 C8의 책임이다.
- APPLY_TRUST_BATCH는 계약 파티와 일치하는 최신 3명을 검증해 pool/context에 함께 반영하고 C6 즉시 불신을 한 번 평가한다. distrust면 C4/C3/C8·보상·유품·위험도 변경 없이 ended를 기록한다.
- 이번 C7은 Zustand Store, 저장·복원, 서버 동기화, U3/U5/U6 화면 기능을 추가하지 않는다. 기존 U3 프리뷰는 제거되는 C5 phase API 대신 C7 action을 호출하도록만 바꿔 동작을 보존한다.
- 모든 규칙 함수는 입력 객체와 중첩 배열·맵을 변경하지 않는다. 성공과 RuleError 테스트는 structuredClone 비교를 수행한다.
- 커밋 제목과 본문은 한국어로 작성한다.

---

## File Map

| File | Change | Responsibility |
| --- | --- | --- |
| lib/domain/campaign-transition.ts | Create | 전이 action, 세션 컨텍스트, result 계약과 빈 컨텍스트 factory |
| lib/domain/index.ts | Modify | C7 계약의 단일 공개 export |
| lib/rules/campaign-transition.ts | Replace | 8개 phase 검증, C2~C6 호출 순서, 결과 적용 |
| lib/rules/campaign-transition.test.ts | Replace | 전이표, C4 중복 차단, C3/C6 순서, 불신·불변성 회귀 |
| lib/rules/promotion.ts | Modify | phase-free 승급 계산/실행 API |
| lib/rules/promotion.test.ts | Modify | C5가 phase·공고를 변경하지 않는 회귀 |
| components/game/U3Preview.tsx | Modify | 프리뷰 승급 열기/취소/확정을 C7 action으로 위임 |
| components/game/U3Preview.test.ts | Modify | 프리뷰 승급 결과가 C7을 거친다는 회귀 |
| docs/README.md | Modify | C7 구현 계획 링크 |
| docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md | Modify | C7 완료 및 I1/C8 후속 책임 정렬 |
| docs/DOCUMENT_TERMINOLOGY.test.ts | Verify/modify only if needed | 새 문서 링크·용어 계약 검사 |

---

### Task 1: C5를 phase-free 승급 계산 API로 분리한다

**Files:**
- Modify: lib/rules/promotion.ts
- Modify: lib/rules/promotion.test.ts

**Interfaces:**
- Consumes: CampaignState, PromotionMethod, PromotionEligibility, PromotionExecution, RuleError
- Produces:

```ts
export function getGuidePromotionEligibility(
  campaign: CampaignState,
): PromotionEligibility | null;

export function executeGuidePromotion(
  campaign: CampaignState,
  method: PromotionMethod,
): PromotionExecution;
```

executeGuidePromotion은 rank와 현재 gold만 변경한 campaign 및 기존 PromotionResult를 반환한다. 입력 phase, offers, worldTurn, cumulativeGold는 보존한다. 기존 openGuidePromotion, cancelGuidePromotion, promoteGuide는 Task 4에서 호출자를 옮긴 뒤 제거한다.

- [ ] **Step 1: phase-free C5의 실패 테스트를 작성한다.**

promotion phase와 기존 공고를 가진 fixture에서 실행 결과를 고정한다.

```ts
it("승급 계산은 phase와 현재 공고를 바꾸지 않는다", () => {
  const campaign = {
    ...boardState({ reputation: PROMOTION_REPUTATION.B }),
    phase: "promotion" as const,
    offers: createBoardOffers(boardState()),
  };
  const before = structuredClone(campaign);

  const execution = executeGuidePromotion(campaign, "reputation");

  expect(execution.campaign).toMatchObject({
    phase: "promotion", rank: "B", offers: campaign.offers,
    reputation: PROMOTION_REPUTATION.B, gold: campaign.gold,
    cumulativeGold: campaign.cumulativeGold,
  });
  expect(campaign).toEqual(before);
});
```

명성 문턱 미달은 INVALID_PROMOTION, 골드 문턱 미달은 INSUFFICIENT_GOLD, S급은 INVALID_PROMOTION으로 유지한다. board, expedition, ended phase에서도 실행 결과의 phase가 보존되는 test를 추가한다.

- [ ] **Step 2: 새 API가 아직 없음을 확인한다.**

Run: `pnpm vitest run lib/rules/promotion.test.ts`

Expected: FAIL — executeGuidePromotion export가 없다는 TypeScript 오류.

- [ ] **Step 3: phase를 읽지 않는 최소 실행 함수를 구현한다.**

현재 promoteGuide 본문에서 phase 검사와 phase: board/offers 초기화를 분리한다. executeGuidePromotion은 기존 getGuidePromotionEligibility와 비용·오류 코드를 재사용하고 아래 형태를 반환한다.

```ts
return {
  campaign: { ...campaign, rank: eligibility.toRank, gold: goldAfter },
  result: {
    fromRank: eligibility.fromRank, toRank: eligibility.toRank, method,
    reputationBefore: campaign.reputation, reputationAfter: campaign.reputation,
    goldBefore: campaign.gold, goldAfter,
    newlyUnlockedRiskLevel: eligibility.newlyUnlockedRiskLevel,
  },
};
```

여기서는 기존 phase-changing export를 보존해 U3 프리뷰와 C7을 순차 전환한다.

- [ ] **Step 4: C5 계산 회귀를 통과시킨다.**

Run: `pnpm vitest run lib/rules/promotion.test.ts lib/rules/board.test.ts && pnpm typecheck`

Expected: PASS — 비용·등급 계산은 유지되고 새 API는 phase와 offers를 보존한다.

- [ ] **Step 5: 첫 번째 커밋을 만든다.**

```bash
git add lib/rules/promotion.ts lib/rules/promotion.test.ts
git commit -m "기능: 승급 계산에서 단계 전이를 분리한다" -m "C7이 캠페인 단계와 공고를 소유하도록 C5 승급 실행을 순수 계산 API로 제공한다."
```

### Task 2: C7 세션 컨텍스트와 전이 계약을 도메인에 추가한다

**Files:**
- Create: lib/domain/campaign-transition.ts
- Modify: lib/domain/index.ts
- Modify: lib/domain/contract.test.ts

**Interfaces:**
- Consumes: BoardOffer, CampaignEnding, CampaignState, Character, ExpeditionState, OfferId, PromotionMethod, PromotionResult, SettlementResult, SettlementSnapshot, WorldTurnResult
- Produces:

```ts
export interface ActiveExpeditionContext {
  readonly expeditionId: string;
  readonly offer: BoardOffer;
  readonly expedition: ExpeditionState;
  readonly partyMembers: readonly Character[];
}
export interface CampaignTransitionContext {
  readonly selectedOffer: BoardOffer | null;
  readonly activeExpedition: ActiveExpeditionContext | null;
}
export function createCampaignTransitionContext(): CampaignTransitionContext;

export type CampaignTransition =
  | { readonly type: "OPEN_BOARD" }
  | { readonly type: "SELECT_CONTRACT"; readonly offerId: OfferId }
  | { readonly type: "CANCEL_CONTRACT" }
  | { readonly type: "START_EXPEDITION"; readonly expeditionId: string; readonly expedition: ExpeditionState; readonly partyMembers: readonly Character[] }
  | { readonly type: "COMPLETE_EXPEDITION"; readonly snapshot: SettlementSnapshot }
  | { readonly type: "START_WORLD_TURN" }
  | { readonly type: "COMPLETE_WORLD_TURN" }
  | { readonly type: "OPEN_PROMOTION" }
  | { readonly type: "CANCEL_PROMOTION" }
  | { readonly type: "PROMOTE_GUIDE"; readonly method: PromotionMethod }
  | { readonly type: "APPLY_TRUST_BATCH"; readonly partyMembers: readonly Character[] };

export interface CampaignTransitionResult {
  readonly campaign: CampaignState;
  readonly context: CampaignTransitionContext;
  readonly settlement: SettlementResult | null;
  readonly worldTurn: WorldTurnResult | null;
  readonly promotion: PromotionResult | null;
  readonly ending: CampaignEnding | null;
}
```

- [ ] **Step 1: 공개 계약의 실패 테스트를 작성한다.**

contract.test.ts에 새 type을 @/lib/domain에서 import하는 fixture와 factory test를 추가한다.

```ts
it("새 캠페인 전이 컨텍스트는 선택 공고와 활성 원정이 없다", () => {
  expect(createCampaignTransitionContext()).toEqual({
    selectedOffer: null, activeExpedition: null,
  });
});
```

CampaignTransition 변수에 OPEN_BOARD, offerId가 있는 SELECT_CONTRACT, method가 있는 PROMOTE_GUIDE를 대입해 discriminated union export도 TypeScript가 확인하게 한다.

- [ ] **Step 2: 계약 테스트가 실패하는지 확인한다.**

Run: `pnpm vitest run lib/domain/contract.test.ts`

Expected: FAIL — C7 context factory와 transition type export가 없다.

- [ ] **Step 3: 저장 상태와 분리된 타입 모듈을 구현한다.**

새 모듈에는 interface/union/factory만 둔다. CampaignState에는 field를 추가하지 않는다.

```ts
export function createCampaignTransitionContext(): CampaignTransitionContext {
  return { selectedOffer: null, activeExpedition: null };
}
```

domain index에서 모든 C7 type과 factory를 export한다. 런타임 규칙 함수는 domain barrel에서 export하지 않는다.

- [ ] **Step 4: 도메인 계약과 타입 검사를 통과시킨다.**

Run: `pnpm vitest run lib/domain/contract.test.ts && pnpm typecheck`

Expected: PASS — C7 contract는 CampaignState를 확장하지 않고 단일 barrel import로 사용할 수 있다.

- [ ] **Step 5: 두 번째 커밋을 만든다.**

```bash
git add lib/domain/campaign-transition.ts lib/domain/index.ts lib/domain/contract.test.ts
git commit -m "기능: 캠페인 전이 컨텍스트 계약을 추가한다" -m "활성 원정과 선택 공고를 저장 상태에서 분리하고 C7 action과 결과 타입을 공개한다."
```

### Task 3: 게시판부터 정산까지의 C7 전이와 중복 차단을 구현한다

**Files:**
- Replace: lib/rules/campaign-transition.ts
- Replace: lib/rules/campaign-transition.test.ts

**Interfaces:**
- Consumes: Task 2 CampaignTransition, CampaignTransitionContext, CampaignTransitionResult; createBoardOffers; settleExpedition; RuleError
- Produces:

```ts
export function transitionCampaign(
  campaign: CampaignState,
  context: CampaignTransitionContext,
  action: CampaignTransition,
): CampaignTransitionResult;
```

- [ ] **Step 1: board/contract/expedition/settlement의 실패 테스트를 작성한다.**

initializeCampaign("c7-transition"), createCampaignTransitionContext(), 선택 공고와 동일한 ExpeditionState fixture로 정상 경로를 고정한다.

```ts
const board = transitionCampaign(initial, empty, { type: "OPEN_BOARD" });
const contract = transitionCampaign(board.campaign, board.context, {
  type: "SELECT_CONTRACT", offerId: board.campaign.offers[0]!.id,
});
const expedition = transitionCampaign(contract.campaign, contract.context, startAction(contract));
const settled = transitionCampaign(expedition.campaign, expedition.context, {
  type: "COMPLETE_EXPEDITION", snapshot: snapshotFor(expedition.context.activeExpedition!),
});

expect(board.campaign.phase).toBe("board");
expect(contract.context.selectedOffer?.id).toBe(board.campaign.offers[0]!.id);
expect(expedition.campaign.phase).toBe("expedition");
expect(settled.campaign).toMatchObject({ phase: "settlement", settledExpeditionIds: ["exp-c7-01"] });
expect(settled.campaign.statistics.settlements).toEqual([]);
expect(settled.settlement?.expeditionId).toBe("exp-c7-01");
```

structuredClone 전후 initial/context/action 불변성도 확인한다. 잠긴·없는 offer, contract 밖 시작, 선택 공고와 다른 dungeon/risk/party, active와 다른 snapshot ID/dungeon/risk/party, 이미 기록된 ID는 모두 code INVALID_TRANSITION 오류와 입력 보존을 기대한다.

- [ ] **Step 2: 새 전이 테스트가 실패하는지 확인한다.**

Run: `pnpm vitest run lib/rules/campaign-transition.test.ts`

Expected: FAIL — transitionCampaign export가 없고 기존 settleCampaignExpedition 계약만 존재한다.

- [ ] **Step 3: 공통 결과·phase·계약 검증 helper를 구현한다.**

기존 settleCampaignExpedition과 CampaignSettlementTransition을 제거하고 private helper를 둔다.

```ts
function emptyResult(campaign: CampaignState, context: CampaignTransitionContext): CampaignTransitionResult {
  return { campaign, context, settlement: null, worldTurn: null, promotion: null, ending: null };
}
function requirePhase(campaign: CampaignState, expected: CampaignState["phase"]): void {
  if (campaign.phase !== expected) {
    throw new RuleError("INVALID_TRANSITION", "허용되지 않은 캠페인 전이다", {
      phase: campaign.phase, expectedPhase: expected,
    });
  }
}
```

sameIds는 길이와 Set을 함께 확인한다. SELECT_CONTRACT는 현재 offers 중 같은 ID와 lockReason null인 값만 저장한다. START_EXPEDITION은 선택 공고의 dungeonId/riskLevel/party ID 집합과 action expedition을 대조한 뒤 selectedOffer를 null로 바꾼다.

- [ ] **Step 4: C4 정산을 한 번만 적용한다.**

COMPLETE_EXPEDITION에서 phase와 active context, snapshot expeditionId/dungeonId/contractRisk/party를 먼저 검사한다. 중복 ID는 C4 호출보다 앞에서 거부하고, 성공 시 통계에는 쓰지 않는다.

```ts
const execution = settleExpedition(campaign, action.snapshot);
return {
  ...emptyResult(
    {
      ...execution.campaign,
      phase: "settlement",
      settledExpeditionIds: [...campaign.settledExpeditionIds, action.snapshot.expeditionId],
    },
    context,
  ),
  settlement: execution.result,
};
```

정산 뒤 active expedition은 C3에 계약 파티를 넘길 때까지 context에 유지한다.

- [ ] **Step 5: 전이표 앞부분과 C4 회귀를 통과시킨다.**

Run: `pnpm vitest run lib/rules/campaign-transition.test.ts lib/rules/settlement.test.ts lib/rules/board.test.ts && pnpm typecheck`

Expected: PASS — C4는 한 번만 적용되고 C7은 통계 append나 별도 정산 래퍼를 남기지 않는다.

- [ ] **Step 6: 세 번째 커밋을 만든다.**

```bash
git add lib/rules/campaign-transition.ts lib/rules/campaign-transition.test.ts
git commit -m "기능: 캠페인 계약과 정산 전이를 추가한다" -m "게시판·계약·원정·정산의 허용 단계를 검증하고 중복 정산을 C4 호출 전에 차단한다."
```

### Task 4: 월드턴·정상 엔딩·즉시 불신·승급 전이를 완성한다

**Files:**
- Modify: lib/rules/campaign-transition.ts
- Modify: lib/rules/campaign-transition.test.ts
- Modify: lib/rules/promotion.ts
- Modify: lib/rules/promotion.test.ts
- Modify: components/game/U3Preview.tsx
- Modify: components/game/U3Preview.test.ts

**Interfaces:**
- Consumes: runWorldTurn, createRng, createBoardOffers, evaluateCampaignEnding, evaluateImmediateDistrustEnding, executeGuidePromotion, transitionCampaign
- Produces: 모든 C7 action의 완결된 CampaignTransitionResult; C5에서는 getGuidePromotionEligibility와 executeGuidePromotion만 공개한다.

- [ ] **Step 1: C3/C6 순서와 promotion의 실패 테스트를 작성한다.**

정상 정산 fixture에서 START_WORLD_TURN과 COMPLETE_WORLD_TURN을 이어 호출한다.

```ts
expect(worldStart.campaign.phase).toBe("worldTurn");
expect(worldComplete.worldTurn?.worldTurn).toBe(settled.campaign.worldTurn + 1);
expect(worldComplete.campaign.worldTurn).toBe(settled.campaign.worldTurn + 1);
expect(worldComplete.campaign.offers).toEqual(createBoardOffers(worldComplete.campaign));
expect(worldComplete.context.activeExpedition).toBeNull();
```

고정 seed/turn에서 C3 결과가 createRng(seed/turn).derive("worldturn") 직접 호출과 같음을 검사한다. C6 fixture 네 개는 denounced/completed/exhausted/unemployed를 만들고 각각 ended 및 ending 전체를 result와 campaign에 동일하게 기대한다. ended campaign의 11개 action은 모두 INVALID_TRANSITION, campaign/context/ending 보존을 기대한다.

OPEN_PROMOTION → CANCEL_PROMOTION은 pool·경제·offers 무변경을, OPEN_PROMOTION → PROMOTE_GUIDE는 C5 PromotionResult, board phase, 새 rank/turn 기준 공고 생성을 검증한다. promotion 밖 확정과 S급 열기는 INVALID_TRANSITION이다.

- [ ] **Step 2: 즉시 불신과 최신 파티 검증의 실패 테스트를 작성한다.**

활성 원정 party 3명을 만들고 APPLY_TRUST_BATCH에 중복 ID, 계약과 다른 ID 집합, classId/maxHp 불일치, HP 범위 밖, alive/HP 모순, trust/gold 범위 밖을 넣어 C6 호출 전 INVALID_TRANSITION을 기대한다.

```ts
const updated = transitionCampaign(campaign, context, {
  type: "APPLY_TRUST_BATCH",
  partyMembers: party.map((member) => ({ ...member, trust: 1 })),
});
expect(updated.campaign.phase).toBe("expedition");
expect(updated.context.activeExpedition?.partyMembers).toEqual(updatedParty);

const distrust = transitionCampaign(campaign, context, {
  type: "APPLY_TRUST_BATCH",
  partyMembers: party.map((member) => ({ ...member, trust: 0 })),
});
expect(distrust.campaign).toMatchObject({ phase: "ended", ending: { kind: "distrust" } });
expect(distrust.ending).toEqual(distrust.campaign.ending);
```

distrust 전후 dungeons, worldTurn, offers, statistics, settledExpeditionIds, reputation, gold, cumulativeGold가 같음을 검사한다.

- [ ] **Step 3: C3 완료와 정상 엔딩을 구현한다.**

START_WORLD_TURN은 settlement phase와 active context만 검증해 phase만 worldTurn으로 바꾼다. COMPLETE_WORLD_TURN은 호출자 RNG를 받지 않고 C3 → C2 → C6 순서를 구현한다.

```ts
const active = requireActiveExpedition(context);
const rng = createRng(campaign.seed + "/" + campaign.worldTurn).derive("worldturn");
const worldTurn = runWorldTurn(campaign.pool, active.offer.party, campaign.worldTurn, rng);
const afterWorldTurn = {
  ...campaign, pool: worldTurn.pool, worldTurn: worldTurn.result.worldTurn, phase: "board" as const,
};
const withOffers = { ...afterWorldTurn, offers: createBoardOffers(afterWorldTurn) };
const ending = evaluateCampaignEnding(withOffers);
const nextCampaign = ending === null
  ? withOffers
  : { ...withOffers, phase: "ended" as const, ending };
```

result에는 worldTurn.result/ending을 넣고 context의 active expedition은 null로 비운다.

- [ ] **Step 4: C5 호출을 C7에 넣고 이전 phase API를 제거한다.**

OPEN_PROMOTION은 board phase 및 getGuidePromotionEligibility가 null이 아님을 검사한 뒤 promotion으로 바꾼다. CANCEL_PROMOTION은 promotion → board만 허용한다. PROMOTE_GUIDE는 executeGuidePromotion 결과의 rank/gold를 받아 C2를 한 번 호출하고 offers/board phase를 C7에서 적용한다.

```ts
const execution = executeGuidePromotion(campaign, action.method);
const promoted = { ...execution.campaign, phase: "board" as const };
return {
  ...emptyResult({ ...promoted, offers: createBoardOffers(promoted) }, context),
  promotion: execution.result,
};
```

promotion.ts의 requirePhase, openGuidePromotion, cancelGuidePromotion, promoteGuide와 old test를 제거한다. U3Preview는 useState로 CampaignTransitionContext를 함께 갖고 열기/취소/확정마다 transitionCampaign result의 campaign/context/promotion만 저장한다. applyPreviewPromotion도 C7 action을 쓰도록 바꿔 화면 문구와 레이아웃은 변경하지 않는다.

- [ ] **Step 5: 최신 파티 검증과 즉시 불신을 구현한다.**

APPLY_TRUST_BATCH는 expedition phase에서만 허용한다. action 멤버를 map으로 만들기 전에 정확히 3명·중복 없음·active offer와 같은 ID 집합을 확인한다. 각 멤버는 pool의 같은 ID와 classId/maxHp가 같고, hp는 0 이상 maxHp 이하 정수, trust는 TRUST_MIN~TRUST_MAX 정수, gold는 0 이상 정수, alive는 hp > 0과 같아야 한다. 검사 뒤에만 pool.byId와 active partyMembers를 새 객체로 바꾼다.

```ts
const pool = { ...campaign.pool, byId: { ...campaign.pool.byId, ...membersById } };
const withLatestParty = { ...campaign, pool };
const ending = evaluateImmediateDistrustEnding(withLatestParty, action.partyMembers);
const nextCampaign = ending === null
  ? withLatestParty
  : { ...withLatestParty, phase: "ended" as const, ending };
```

이 action은 settleExpedition, runWorldTurn, createBoardOffers, executeGuidePromotion을 호출하지 않는다. distrust여도 C4/C3/C8 데이터는 삭제하거나 초기화하지 않는다.

- [ ] **Step 6: C7 및 프리뷰 회귀를 통과시킨다.**

Run: `pnpm vitest run lib/rules/campaign-transition.test.ts lib/rules/promotion.test.ts lib/rules/ending.test.ts components/game/U3Preview.test.ts && pnpm typecheck`

Expected: PASS — C2/C3/C4/C5/C6은 C7에서 한 번씩만 소비되고 U3 프리뷰의 승급 결과는 전이 API를 거친다.

- [ ] **Step 7: 네 번째 커밋을 만든다.**

```bash
git add lib/rules/campaign-transition.ts lib/rules/campaign-transition.test.ts lib/rules/promotion.ts lib/rules/promotion.test.ts components/game/U3Preview.tsx components/game/U3Preview.test.ts
git commit -m "기능: 캠페인 월드턴과 종료 전이를 완성한다" -m "승급과 신뢰 변화, 월드턴 뒤 엔딩을 C7 단일 전이 API에서 원자적으로 적용한다."
```

### Task 5: 문서 인수인계와 전체 검증을 마무리한다

**Files:**
- Modify: docs/README.md
- Modify: docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md
- Verify: docs/DOCUMENT_TERMINOLOGY.test.ts

**Interfaces:**
- Consumes: C7 Spec, transitionCampaign contract
- Produces: C7 완료 상태, I1의 context Store 소유, C8의 SettlementResult 기록 책임을 명시한 문서.

- [ ] **Step 1: 문서 링크와 작업 배정의 실패 검사를 먼저 실행한다.**

Run: `pnpm vitest run docs/DOCUMENT_TERMINOLOGY.test.ts`

Expected: PASS 또는 FAIL. PASS여도 다음 단계에서 새 계획 링크와 배정표 경계를 갱신한다. FAIL이면 실패한 용어/링크를 먼저 읽고, 이 작업이 만든 경로와 충돌하는 부분만 수정한다.

- [ ] **Step 2: C7의 구현 경계를 문서에 반영한다.**

README의 “이번 개편 설계”에서 C7 Spec 바로 아래에 다음 링크를 넣는다.

```md
- [C7 캠페인 상태 전이 구현 계획](superpowers/plans/2026-08-23-lattebun-c7-campaign-state-transition.md): C2~C6 결과를 단일 순수 전이로 적용하는 테스트 우선 구현 순서
```

CAMPAIGN_REWORK_WORK_ASSIGNMENT의 C7 행은 “캠페인 전이”로 정리하고 ✅로 바꾼다. 설명에는 8개 phase, ephemeral context, 중복 정산 거부, C3 뒤 정상 엔딩 및 즉시 불신 원자 기록만 남긴다. C8 행에는 SettlementResult를 C7 result에서 소비해 statistics를 기록한다는 책임을, I1 행에는 CampaignTransitionContext를 persistent campaign과 분리해 Store에서 소유한다는 인수인계 문장을 넣는다. C7 행에 B1 백테스트를 포함하지 않는다.

- [ ] **Step 3: 문서·규칙 전체 검증을 실행한다.**

Run: `pnpm vitest run docs/DOCUMENT_TERMINOLOGY.test.ts lib/domain/contract.test.ts lib/rules/campaign-transition.test.ts lib/rules/promotion.test.ts lib/rules/ending.test.ts && pnpm lint && pnpm typecheck && pnpm test`

Expected: PASS — 문서 링크와 용어가 유효하고, 전체 Vitest suite·lint·typecheck가 모두 통과한다.

- [ ] **Step 4: 최종 diff를 검사한다.**

Run: `git diff --check && git status --short`

Expected: git diff --check 출력 없음. status에는 이 계획의 도메인·규칙·테스트·문서 파일만 나타난다.

- [ ] **Step 5: 문서와 검증 커밋을 만든다.**

```bash
git add docs/README.md docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md docs/DOCUMENT_TERMINOLOGY.test.ts
git commit -m "문서: C7 전이 완료 상태를 반영한다" -m "전이 컨텍스트와 C8·I1의 후속 경계를 작업 배정표와 문서 인덱스에 기록한다."
```

## Self-Review

### Spec coverage

| Spec requirement | Plan task |
| --- | --- |
| 저장 상태와 ephemeral context 분리 | Task 2 |
| 8개 phase와 payload union | Tasks 2–4 |
| C2 board/contract/expedition 검증 | Task 3 |
| C4 정산 1회·중복 차단·C8 통계 분리 | Task 3 |
| C3 RNG·새 공고·C6 정상 엔딩 순서 | Task 4 |
| C5 phase-free migration | Tasks 1 and 4 |
| 최신 파티 검증과 즉시 distrust 원자 처리 | Task 4 |
| ended 보존·진행 재진입 거부·입력 불변성 | Tasks 3 and 4 |
| Store/UI/저장 범위 제외와 I1/C8 handoff | Tasks 4 and 5 |
| 공식 문서·작업 배정 갱신과 전체 검증 | Task 5 |

### Placeholder scan

금지된 placeholder 표현을 검색해 결과가 없는 것을 확인한다. 각 테스트·구현 단계에는 대상 함수, 입력, 기대 오류 또는 결과를 명시했다.

### Type consistency

모든 후속 task는 Task 2의 CampaignTransition, CampaignTransitionContext, CampaignTransitionResult와 Task 1의 executeGuidePromotion 이름을 사용한다. C3 결과는 기존 WorldTurnResult, C4 결과는 기존 SettlementResult, C6 결과는 기존 CampaignEnding으로 유지해 중복 타입을 만들지 않는다.
