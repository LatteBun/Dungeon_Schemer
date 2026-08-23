# C5 길잡이 승급 구현 계획

- 작성자: LatteBun
- 작성 도구: Codex

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 게시판에서 명성 또는 골드로 길잡이를 한 단계 승급하고, 갱신된 공고와 결과 피드백을 제공한다.

**Architecture:** C5는 `lib/domain`의 공개 계약과 `lib/rules/promotion.ts`의 순수 상태 전이로 구현한다. U3은 C5가 제공하는 `PromotionEligibility`과 `PromotionResult`만 소비해 게시판 셸 안의 선택·결과 오버레이를 표시하고, U6은 정산 결과와 승급 가능 여부만 표시한다. 실제 Store 전체 연결은 I1/I2의 범위이므로, 이 작업에서는 `/u3-test` 프리뷰에서만 C5 전이를 직접 연결한다.

**Tech Stack:** Next.js 16.3, React 19, TypeScript, Vitest 4, CSS, Framer Motion 의존성은 추가하지 않음.

**Spec:** [C5 길잡이 승급 설계](../specs/2026-08-23-lattebun-c5-guide-promotion-design.md)

## Global Constraints

- 구현을 시작하기 전에 현재 설치된 Next.js 가이드 위치를 `rg --files node_modules/next/dist/docs`로 찾고, 클라이언트 컴포넌트와 CSS 관련 문서를 읽는다.
- `openGuidePromotion`: `board → promotion`, `cancelGuidePromotion`: `promotion → board`, `promoteGuide`: `promotion → board`만 허용한다.
- 한 번의 확정은 정확히 한 등급만 올린다. 명성 경로는 아무 자원도 차감하지 않고, 골드 경로는 `gold`만 차감하며 `cumulativeGold`는 절대 변경하지 않는다.
- 성공한 승급은 `offers`를 빈 배열로 무효화한다. C2 `createBoardOffers`가 같은 `seed`·`worldTurn`과 새 `rank`로 즉시 다시 생성한다. 승급은 난수와 월드턴을 소비하지 않는다.
- U3만 승급 진입·선택·결과를 제공한다. U6에는 승급 버튼, 선택, 결과 컴포넌트 또는 승급 ViewModel을 남기지 않는다.
- UI는 규칙 상수·다음 등급·가능 여부를 재계산하지 않고 `PromotionEligibility`/`PromotionResult`를 사용한다. `prefers-reduced-motion`에서 애니메이션을 정지한 비색상 강조로 바꾼다.
- 기존의 `public/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/ASSET_MANIFEST.json`과 `README.txt`는 사용자 작업물이므로 수정하거나 커밋하지 않는다.
- `docs/superpowers/`의 이전 설계·계획은 역사 기록이므로 수정하지 않는다. 현재 C5 Spec, 공식 문서, 배정표, 화면 인수인계 계약만 갱신한다.
- 커밋 제목과 본문은 한국어로 작성한다.

---

## 파일 구조와 책임

| 파일 | 변경 | 책임 |
| --- | --- | --- |
| `lib/domain/campaign.ts` | 수정 | `PromotionMethod`, `PromotionEligibility`, `PromotionResult`, `PromotionExecution` 공개 도메인 계약 |
| `lib/domain/errors.ts`, `lib/domain/index.ts` | 수정 | `INVALID_PROMOTION`과 C5 타입/상수의 공개 export |
| `lib/rules/promotion.ts` | 생성 | 승급 조회·열기·취소·확정의 불변 순수 규칙 |
| `lib/rules/promotion.test.ts` | 생성 | 비용 경계, 단계, 오류, 공고 무효화, 불변성 검증 |
| `components/game/u3-promotion-model.ts` | 생성 | C5 결과를 U3 문구·아이콘 입력으로만 변환 |
| `components/game/U3PromotionDialog.tsx` | 생성 | 선택 및 완료 오버레이의 접근 가능한 렌더링 |
| `components/game/U3BoardScreen.tsx`, `GameShell.tsx`, `TopStatusBar.tsx` | 수정 | 게시판에서만 상단 등급 버튼과 오버레이 콜백 연결 |
| `components/game/U3Preview.tsx` | 수정 | `/u3-test`에서 C5 순수 전이와 C2 공고 재생성을 연결 |
| `components/game/U3BoardScreen.test.ts`, `U3Preview.test.ts`, `TopStatusBar.test.ts`, `u3-promotion-model.test.ts` | 수정/생성 | U3의 렌더·어댑터·프리뷰 경계 검증 |
| `app/globals.css`, `app/u3-board.css`, `app/layout.tsx` | 수정 | 상단 승급 버튼과 게시판 오버레이, 감소된 모션 스타일을 등록 |
| `components/game/u6-settlement-model.ts`, `U6SettlementScreen.tsx`, `U6Preview.tsx`, `u6-preview-data.ts` | 수정 | U6의 승급 모델·제어를 제거하고 정산 전용으로 축소 |
| `components/game/u6-settlement-model.test.ts`, `U6SettlementScreen.test.ts`, `u6-preview-data.test.ts` | 수정 | U6에 승급 UI 계약이 남지 않음을 검증 |
| `docs/technical/SCREEN_ADAPTER_CONTRACT.md`, `docs/diagram/campaign-sequence.md`, `docs/diagram/screens.md`, `docs/DOCUMENT_TERMINOLOGY.test.ts`, `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md` | 수정 | 게시판 승급의 공식 인수인계·시퀀스·배정 완료 상태를 일치 |

---

### Task 1: C5 도메인 계약과 순수 승급 규칙

**Files:**
- Modify: `lib/domain/campaign.ts`
- Modify: `lib/domain/errors.ts`
- Modify: `lib/domain/index.ts`
- Create: `lib/rules/promotion.ts`
- Create: `lib/rules/promotion.test.ts`

**Interfaces:**
- Consumes: `CampaignState`, `GuideRank`, `RiskLevel`, `PROMOTION_REPUTATION`, `PROMOTION_GOLD`, `RANK_RISK_LIMIT`, `RuleError`
- Produces:

```ts
export type PromotionMethod = "reputation" | "gold";
export interface PromotionEligibility {
  fromRank: GuideRank;
  toRank: Exclude<GuideRank, "C">;
  newlyUnlockedRiskLevel: RiskLevel;
  reputationRequired: number;
  goldRequired: number;
  currentReputation: number;
  currentGold: number;
  canPromoteByReputation: boolean;
  canPromoteByGold: boolean;
}
export interface PromotionResult {
  fromRank: GuideRank;
  toRank: GuideRank;
  method: PromotionMethod;
  reputationBefore: number;
  reputationAfter: number;
  goldBefore: number;
  goldAfter: number;
  newlyUnlockedRiskLevel: RiskLevel;
}
export interface PromotionExecution { campaign: CampaignState; result: PromotionResult; }
export function getGuidePromotionEligibility(campaign: CampaignState): PromotionEligibility | null;
export function openGuidePromotion(campaign: CampaignState): CampaignState;
export function cancelGuidePromotion(campaign: CampaignState): CampaignState;
export function promoteGuide(campaign: CampaignState, method: PromotionMethod): PromotionExecution;
```

- [ ] **Step 1: 실패하는 C5 규칙 테스트를 작성한다.**

`promotion.test.ts`에 `initializeCampaign("c5-promotion")`을 `phase: "board"`로 바꾼 fixture를 만들고, 다음의 실제 호출을 테스트로 고정한다.

```ts
const board = { ...initializeCampaign("c5-promotion"), phase: "board" as const, reputation: 60 };
const opened = openGuidePromotion(board);
const execution = promoteGuide(opened, "reputation");

expect(execution.result).toMatchObject({
  fromRank: "C", toRank: "B", method: "reputation",
  reputationBefore: 60, reputationAfter: 60,
  goldBefore: 10, goldAfter: 10, newlyUnlockedRiskLevel: 3,
});
expect(execution.campaign).toMatchObject({ phase: "board", rank: "B", offers: [] });
```

별도 테스트로 C/B/A의 정확한 명성·골드 문턱 성공과 `문턱 - 1` 실패, 골드 차감과 `cumulativeGold` 보존, `S`의 `null` eligibility·열기 거부, 잘못된 phase의 `INVALID_STATE`, 명성 미달의 `INVALID_PROMOTION`, 골드 미달의 `INSUFFICIENT_GOLD`, 취소 무변경, `structuredClone` 비교 불변성을 작성한다. 승급 뒤 `createBoardOffers(execution.campaign)`가 ★3을 잠금이 아닌 공고로 만들 수 있음을 C등급 공고와 비교한다.

- [ ] **Step 2: 새 테스트가 실패하는지 확인한다.**

Run: `pnpm vitest run lib/rules/promotion.test.ts`

Expected: FAIL — `promotion` 모듈 또는 export가 아직 없다는 오류.

- [ ] **Step 3: 도메인 타입과 오류 코드를 추가한다.**

`campaign.ts`에 Spec §4.1과 정확히 같은 필드의 네 타입을 선언하고, `errors.ts`의 `RuleErrorCode`에 `"INVALID_PROMOTION"`을 추가한다. `index.ts`에서 이 타입과 기존 `RuleError`를 소비자가 `@/lib/domain`으로 가져올 수 있게 export한다.

```ts
export interface PromotionEligibility {
  fromRank: GuideRank;
  toRank: Exclude<GuideRank, "C">;
  newlyUnlockedRiskLevel: RiskLevel;
  reputationRequired: number;
  goldRequired: number;
  currentReputation: number;
  currentGold: number;
  canPromoteByReputation: boolean;
  canPromoteByGold: boolean;
}
```

- [ ] **Step 4: 가장 작은 순수 규칙을 구현한다.**

`promotion.ts` 내부에서만 `GUIDE_RANKS` 인덱스로 다음 등급을 계산한다. `getGuidePromotionEligibility`는 S에서 `null`, 나머지에서 두 독립 경로를 모두 담은 값을 반환한다. `openGuidePromotion`과 `cancelGuidePromotion`은 허용 phase만 얕은 복사로 교체한다. `promoteGuide`는 모든 검증 후에만 아래처럼 새 객체를 반환한다.

```ts
return {
  campaign: {
    ...campaign,
    phase: "board",
    rank: eligibility.toRank,
    gold: method === "gold" ? campaign.gold - eligibility.goldRequired : campaign.gold,
    offers: [],
  },
  result: {
    fromRank: eligibility.fromRank,
    toRank: eligibility.toRank,
    method,
    reputationBefore: campaign.reputation,
    reputationAfter: campaign.reputation,
    goldBefore: campaign.gold,
    goldAfter: method === "gold" ? campaign.gold - eligibility.goldRequired : campaign.gold,
    newlyUnlockedRiskLevel: eligibility.newlyUnlockedRiskLevel,
  },
};
```

오류에는 `rank`, 해당 `method`, `required`, `actual`을 넣고, 호출자의 `campaign`·중첩 `offers` 배열을 수정하지 않는다.

- [ ] **Step 5: C5 단위 테스트와 도메인 계약 테스트를 통과시킨다.**

Run: `pnpm vitest run lib/domain/contract.test.ts lib/rules/promotion.test.ts lib/rules/board.test.ts`

Expected: PASS — 모든 C5 문턱·오류·불변성 검사가 통과하고 C2 공고 생성 회귀가 없다.

- [ ] **Step 6: 첫 번째 구현 커밋을 만든다.**

```bash
git add lib/domain/campaign.ts lib/domain/errors.ts lib/domain/index.ts lib/rules/promotion.ts lib/rules/promotion.test.ts
git commit -m "feat: 길잡이 승급 규칙 추가" -m "게시판 승급의 자원 조건과 상태 전이를 순수 규칙으로 구현한다."
```

### Task 2: U6에서 승급 소유권을 제거한다

**Files:**
- Modify: `components/game/u6-settlement-model.ts`
- Modify: `components/game/U6SettlementScreen.tsx`
- Modify: `components/game/U6Preview.tsx`
- Modify: `components/game/u6-preview-data.ts`
- Modify: `components/game/u6-settlement-model.test.ts`
- Modify: `components/game/U6SettlementScreen.test.ts`
- Modify: `components/game/u6-preview-data.test.ts`
- Modify: `app/u6-result.css`

**Interfaces:**
- Consumes: 기존 `SettlementResult`와 `U6SettlementView`의 정산 필드
- Produces: `U6SettlementView`는 `promotion` 필드 없이 정산 원인·위험도·자원 변화만 포함하고, `U6SettlementScreen`은 `onPromote` prop을 받지 않는다.

- [ ] **Step 1: U6에 승급 계약이 없어야 한다는 실패 테스트로 바꾼다.**

`U6SettlementScreen.test.ts`에서 두 승급 버튼·`data-testid="u6-promotion"`·최고 등급 문구를 기대하는 테스트를 삭제하고, 아래처럼 정산 화면의 금지된 제어를 검사한다. `u6-settlement-model.test.ts`와 `u6-preview-data.test.ts`에서도 `promotion` fixture/도우미 기대를 제거한다.

```ts
const html = render();
expect(html).not.toContain("명성으로 승급하기");
expect(html).not.toContain("골드로 승급하기");
expect(html).not.toContain('data-testid="u6-promotion"');
expect(html).toContain("캠페인 변화");
```

- [ ] **Step 2: 테스트가 현재 구현에서 실패하는지 확인한다.**

Run: `pnpm vitest run components/game/u6-settlement-model.test.ts components/game/U6SettlementScreen.test.ts components/game/u6-preview-data.test.ts`

Expected: FAIL — 현재 U6 markup과 fixture가 승급 영역을 계속 제공한다.

- [ ] **Step 3: U6 모델·화면·프리뷰에서 승급 코드를 제거한다.**

`U6SettlementView`의 `promotion`을 제거하고 `createU6SettlementView`가 C5 정보를 계산하지 않게 한다. `nextRank`, `createU6PromotionView`, `rankCrestSrc`, `Promotion` 컴포넌트, `onPromote`, `u6-promotion*` CSS selector와 fixture의 `promotion` 속성을 제거한다. `settlement-promotion` 프리뷰 ID는 ★5 클리어 상태를 설명하는 이름으로 바꾸지 말고, 기존 프리뷰 탐색 링크를 보존하기 위해 ID는 유지하되 승급 관련 설명만 삭제한다.

- [ ] **Step 4: U6 축소 테스트를 통과시킨다.**

Run: `pnpm vitest run components/game/u6-settlement-model.test.ts components/game/U6SettlementScreen.test.ts components/game/u6-preview-data.test.ts && pnpm typecheck`

Expected: PASS — U6의 정산·엔딩 프리뷰는 유지되고 C5 export를 더 이상 가져오지 않는다.

- [ ] **Step 5: U6 소유권 변경을 커밋한다.**

```bash
git add components/game/u6-settlement-model.ts components/game/U6SettlementScreen.tsx components/game/U6Preview.tsx components/game/u6-preview-data.ts components/game/u6-settlement-model.test.ts components/game/U6SettlementScreen.test.ts components/game/u6-preview-data.test.ts app/u6-result.css
git commit -m "refactor: 정산 화면에서 승급 UI 분리" -m "승급 선택과 결과를 게시판 화면의 책임으로 옮긴다."
```

### Task 3: U3 승급 ViewModel과 게시판 오버레이를 만든다

**Files:**
- Create: `components/game/u3-promotion-model.ts`
- Create: `components/game/u3-promotion-model.test.ts`
- Create: `components/game/U3PromotionDialog.tsx`
- Modify: `components/game/U3BoardScreen.tsx`
- Modify: `components/game/U3BoardScreen.test.ts`
- Modify: `components/game/GameShell.tsx`
- Modify: `components/game/TopStatusBar.tsx`
- Modify: `components/game/TopStatusBar.test.ts`
- Modify: `app/globals.css`
- Modify: `app/u3-board.css`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `PromotionEligibility`, `PromotionResult`, `PromotionMethod` from `@/lib/domain`
- Produces:

```ts
export interface U3PromotionView {
  eligibility: PromotionEligibility | null;
  result: PromotionResult | null;
  isOpen: boolean;
}

export interface U3BoardScreenProps {
  // 기존 board/contract props
  promotion: U3PromotionView;
  onOpenPromotion: () => void;
  onCancelPromotion: () => void;
  onConfirmPromotion: (method: PromotionMethod) => void;
  onDismissPromotionResult: () => void;
}
```

- [ ] **Step 1: U3의 실패하는 모델·정적 렌더 테스트를 작성한다.**

`u3-promotion-model.test.ts`는 C5가 제공한 `PromotionEligibility`을 그대로 보존해 양 경로·부족 수치·S `null`을 ViewModel으로 옮기는지 검사한다. `U3BoardScreen.test.ts`에는 다음 markup 검증을 추가한다.

```ts
expect(html).toContain('data-testid="u3-promotion-trigger"');
expect(html).toContain('data-testid="u3-promotion-dialog"');
expect(html).toContain("명성으로 승급");
expect(html).toContain("골드로 승급");
expect(html).toContain("★3 던전 계약이 해금되었습니다.");
expect(html).toContain('aria-modal="true"');
```

별도 fixture로 조건 미달 버튼의 `disabled`, S등급의 트리거 비활성화, 결과 상태에서 `PromotionResult`의 방법·실제 골드 차감 표시를 확인한다. `TopStatusBar.test.ts`는 `onOpenPromotion`이 전달된 경우에만 등급 칩이 `<button>` 및 `data-testid="u3-promotion-trigger"`가 되고, 다른 화면은 정적 상태 칩으로 남는 것을 검증한다.

- [ ] **Step 2: 새 U3 테스트가 실패하는지 확인한다.**

Run: `pnpm vitest run components/game/u3-promotion-model.test.ts components/game/U3BoardScreen.test.ts components/game/TopStatusBar.test.ts`

Expected: FAIL — U3 promotion 모델, dialog, interactive rank action이 없다.

- [ ] **Step 3: 규칙 결과를 옮기는 얇은 U3 모델을 구현한다.**

`u3-promotion-model.ts`는 `PromotionEligibility | null`, 현재 `phase === "promotion"`, `PromotionResult | null`을 받아 화면용 label·부족량·`isOpen`만 만든다. 비용·다음 등급·가능 여부는 `PROMOTION_*`이나 `GUIDE_RANKS`를 import해 재계산하지 않는다.

```ts
export function createU3PromotionView(
  eligibility: PromotionEligibility | null,
  phase: CampaignPhase,
  result: PromotionResult | null,
): U3PromotionView {
  return { eligibility, isOpen: phase === "promotion", result };
}
```

- [ ] **Step 4: U3 dialog와 게시판 상단 트리거를 구현한다.**

`TopStatusBar`에 선택적인 `onOpenPromotion?: () => void`을 추가하고, 전달됐을 때만 등급 칩을 네이티브 `button`으로 렌더링한다. `GameShell`은 이 prop을 그대로 전달하며, U3만 콜백을 준다. `U3PromotionDialog`는 선택 상태에서 `role="dialog"`, `aria-modal="true"`, 제목 연결, 두 방식의 disabled 사유, 취소 버튼을 렌더링한다. 결과 상태는 `PromotionResult`의 `fromRank`, `toRank`, `method`, before/after 값, `newlyUnlockedRiskLevel`만 사용한다.

```tsx
<button
  type="button"
  disabled={!eligibility.canPromoteByGold}
  onClick={() => onConfirm("gold")}
>
  골드로 승급
</button>
```

`Escape`는 document listener가 아니라 dialog root의 `onKeyDown`에서 `onCancel`을 호출한다. 오버레이가 열렸을 때 첫 번째 가능한 승급 버튼, 없으면 취소 버튼에 `autoFocus`를 둔다. 결과는 닫기 버튼에 `autoFocus`를 둔다.

- [ ] **Step 5: CSS와 전역 import를 추가한다.**

`app/u3-board.css`에 고정된 반투명 backdrop, 게시판 안의 dialog panel, 두 경로 버튼, 결과 panel을 추가한다. `app/globals.css`에는 interactive rank chip의 focus-visible outline과 `data-promotion-available="true"`의 색 외 테두리·아이콘/문구 강조를 둔다. `@keyframes` 광택은 `@media (prefers-reduced-motion: reduce)`에서 `animation: none`으로 바꾸고 정적 outline을 유지한다. 새 스타일 파일을 만들면 `app/layout.tsx`에 명시적으로 import한다.

- [ ] **Step 6: U3 모델·markup 테스트를 통과시킨다.**

Run: `pnpm vitest run components/game/u3-promotion-model.test.ts components/game/U3BoardScreen.test.ts components/game/TopStatusBar.test.ts && pnpm typecheck`

Expected: PASS — U3은 C5 데이터만 표시하고, 다른 화면의 TopStatusBar는 클릭 가능해지지 않는다.

- [ ] **Step 7: 게시판 승급 UI를 커밋한다.**

```bash
git add components/game/u3-promotion-model.ts components/game/u3-promotion-model.test.ts components/game/U3PromotionDialog.tsx components/game/U3BoardScreen.tsx components/game/U3BoardScreen.test.ts components/game/GameShell.tsx components/game/TopStatusBar.tsx components/game/TopStatusBar.test.ts app/globals.css app/u3-board.css app/layout.tsx
git commit -m "feat: 게시판 승급 선택 화면 추가" -m "상단 등급 버튼과 승급 결과를 U3 게시판에 연결한다."
```

### Task 4: U3 프리뷰에서 C5 전이와 C2 공고 재생성을 연결한다

**Files:**
- Modify: `components/game/U3Preview.tsx`
- Modify: `components/game/U3Preview.test.ts`

**Interfaces:**
- Consumes: Task 1의 네 C5 함수, C2 `createBoardOffers`, Task 3의 `U3BoardScreen` callbacks
- Produces: `/u3-test`에서 등급 버튼 → 선택 → C5 확정 → 새 등급 공고 → 결과 닫기 흐름

- [ ] **Step 1: 프리뷰 연결의 실패 테스트를 작성한다.**

`U3Preview.test.ts`에 초기 상태가 C등급·승급 조건 미달임을 유지하는 테스트와, `reputation: 60`인 별도 프리뷰 fixture를 통해 결과에 다음 값이 전달되는 작은 순수 helper 테스트를 추가한다. 프리뷰가 client interaction을 server static markup으로 실행할 수 없으므로, 상태 갱신 코드를 `applyPreviewPromotion(campaign, method)`라는 파일-비공개가 아닌 export된 작은 helper로 분리한다.

```ts
const next = applyPreviewPromotion({ ...campaign, phase: "promotion", reputation: 60 }, "reputation");
expect(next.campaign.rank).toBe("B");
expect(next.campaign.offers.some((offer) => offer.riskLevel === 3 && offer.lockReason === null)).toBe(true);
expect(next.result.newlyUnlockedRiskLevel).toBe(3);
```

- [ ] **Step 2: 프리뷰 연결 테스트가 실패하는지 확인한다.**

Run: `pnpm vitest run components/game/U3Preview.test.ts`

Expected: FAIL — `applyPreviewPromotion`과 승급 props가 아직 없다.

- [ ] **Step 3: 프리뷰 상태를 실제 C5 함수로 갱신한다.**

초기 프리뷰 CampaignState는 `phase: "board"`, `offers: createBoardOffers(initialCampaign)`로 만든다. 등급 버튼은 `openGuidePromotion`, 취소는 `cancelGuidePromotion`, 확정은 `promoteGuide`를 호출한다. 확정 직후에만 C2를 호출해 새 공고를 넣는다.

```ts
export function applyPreviewPromotion(campaign: CampaignState, method: PromotionMethod) {
  const execution = promoteGuide(campaign, method);
  return {
    campaign: { ...execution.campaign, offers: createBoardOffers(execution.campaign) },
    result: execution.result,
  };
}
```

선택한 공고 ID는 새 `offers`의 첫 항목으로 바꾸고, 결과 닫기는 `PromotionResult`만 `null`로 만든다. 계약 callback의 기존 feedback은 유지한다. C5 오류는 프리뷰의 `role="status"` feedback에 사람이 읽는 문장으로 표시하고, 오류가 나면 CampaignState·선택 공고·결과를 바꾸지 않는다.

- [ ] **Step 4: 프리뷰 단위 테스트와 U3 회귀 테스트를 통과시킨다.**

Run: `pnpm vitest run components/game/U3Preview.test.ts components/game/U3BoardScreen.test.ts components/game/u3-board-model.test.ts lib/rules/promotion.test.ts && pnpm typecheck`

Expected: PASS — 프리뷰가 C5를 우회해 rank/비용을 직접 변경하지 않고, 승급 후 ★3 공고를 새로 만든다.

- [ ] **Step 5: 프리뷰 통합을 커밋한다.**

```bash
git add components/game/U3Preview.tsx components/game/U3Preview.test.ts
git commit -m "feat: 게시판 프리뷰에 승급 전이 연결" -m "C5 결과 뒤 C2 공고를 새 등급으로 다시 생성한다."
```

### Task 5: 공식 인수인계 문서와 다이어그램 원본을 동기화한다

**Files:**
- Modify: `docs/technical/SCREEN_ADAPTER_CONTRACT.md`
- Modify: `docs/diagram/campaign-sequence.md`
- Modify: `docs/diagram/screens.md`
- Modify: `docs/DOCUMENT_TERMINOLOGY.test.ts`
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

**Interfaces:**
- Consumes: C5 Spec §4, U3 `PromotionEligibility`/`PromotionResult`, U6에서 제거된 승급 계약
- Produces: 문서가 게시판의 `board → promotion → board`와 U3/U6 책임을 같은 용어로 설명한다.

- [ ] **Step 1: 문서 용어 테스트에 게시판 승급 앵커를 추가한다.**

`docs/DOCUMENT_TERMINOLOGY.test.ts`의 `campaign-sequence.md` 필수 앵커에서 낡은 `"승급하기"`를 `"게시판 상단"`으로 교체한다. `screens.md`의 필수 앵커에도 `"게시판"`과 `"정산"`을 넣어 두 화면의 책임이 사라지지 않게 한다.

- [ ] **Step 2: 문서 테스트가 실패하는지 확인한다.**

Run: `pnpm vitest run docs/DOCUMENT_TERMINOLOGY.test.ts docs/DOCUMENT_LINKS.test.ts`

Expected: FAIL — 현재 캠페인 시퀀스와 대표 화면 문서가 정산의 `승급하기`를 말한다.

- [ ] **Step 3: 공식 인수인계와 Mermaid 원본을 고친다.**

`SCREEN_ADAPTER_CONTRACT.md`에서 U6 제목을 `정산·엔딩 ← C4 · C6 · C8`으로 바꾸고 `promotion`/`U6PromotionView` 행을 제거한다. 새 U3 절에는 C5의 `PromotionEligibility`와 `PromotionResult`, U3이 C5를 직접 재계산하지 않는다는 경계를 기록한다.

`campaign-sequence.md`의 Mermaid는 `공고 게시판` 뒤에 `승급 선택 (선택)`과 `명성 또는 골드 승급`을 두고, 정산 뒤에는 `월드턴 처리`만 둔다. 본문은 “게시판 상단 길잡이 등급 버튼”을 유일한 경로로 설명한다. `screens.md`의 U3 절에는 승급 선택·결과를 추가하고, U6 절 제목과 설명에서 승급 두 경로를 제거한다. 이미지 링크는 현재 D8 파생 캡처이므로 경로나 과거 이미지 파일을 바꾸지 않는다.

배정표의 C5 상태는 모든 Task 1~4 검증이 통과한 뒤에만 `✅`로 바꾸고, U3은 승급 UI 완료 시 `✅`로 바꾼다. U6은 C6/C8의 미완료 의존성이 남아 있으므로 `🟡`를 유지한다. 담당자·의존성은 이미 정한 C5→U3, C6/C8→U6을 보존한다.

- [ ] **Step 4: 문서 테스트를 통과시킨다.**

Run: `pnpm vitest run docs/DOCUMENT_TERMINOLOGY.test.ts docs/DOCUMENT_LINKS.test.ts`

Expected: PASS — 공식 문서에 정산 승급 경로가 남지 않고 모든 링크와 필수 앵커가 유효하다.

- [ ] **Step 5: 문서 동기화를 커밋한다.**

```bash
git add docs/technical/SCREEN_ADAPTER_CONTRACT.md docs/diagram/campaign-sequence.md docs/diagram/screens.md docs/DOCUMENT_TERMINOLOGY.test.ts docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md docs/README.md docs/design/CORE_GAME_LOOP.md docs/experience/ONBOARDING_AND_INTERFACE.md docs/experience/SCREEN_LAYOUT.md docs/systems/PROGRESSION_AND_ENDINGS.md docs/superpowers/specs/2026-08-23-lattebun-c5-guide-promotion-design.md
git add -u docs/superpowers/specs/2026-08-23-c5-guide-promotion-design.md
git commit -m "docs: 게시판 승급 흐름 확정" -m "정산 승급 경로를 제거하고 C5와 U3의 책임을 문서에 맞춘다."
```

### Task 6: 전체 검증과 브라우저 흐름 확인

**Files:**
- Modify: 없음 — Task 1~5의 수정만 검증한다.

**Interfaces:**
- Consumes: C5 순수 규칙, U3 프리뷰, U6 정산 화면, 공식 문서
- Produces: 구현 완료를 주장할 수 있는 테스트·타입·lint·build·브라우저 증거

- [ ] **Step 1: 관련 테스트 묶음을 실행한다.**

Run:

```bash
pnpm vitest run \
  lib/domain/contract.test.ts \
  lib/rules/promotion.test.ts \
  lib/rules/board.test.ts \
  components/game/TopStatusBar.test.ts \
  components/game/u3-promotion-model.test.ts \
  components/game/U3BoardScreen.test.ts \
  components/game/U3Preview.test.ts \
  components/game/u6-settlement-model.test.ts \
  components/game/U6SettlementScreen.test.ts \
  components/game/u6-preview-data.test.ts \
  docs/DOCUMENT_TERMINOLOGY.test.ts \
  docs/DOCUMENT_LINKS.test.ts
```

Expected: PASS — 모든 관련 규칙·화면·문서 검사가 통과한다.

- [ ] **Step 2: 정적 검사와 프로덕션 빌드를 실행한다.**

Run: `pnpm lint && pnpm typecheck && pnpm build`

Expected: PASS — ESLint, TypeScript, Next.js production build가 모두 성공한다.

- [ ] **Step 3: 실제 브라우저에서 두 화면을 확인한다.**

`pnpm dev`로 서버를 실행한 뒤 `/u3-test`에서 C등급의 조건 미달 선택 화면을 확인하고, 테스트용 60 명성 상태에서 명성 승급을 확정해 결과 화면과 ★3 이상 공고 갱신을 확인한다. 등급 버튼이 게시판에서만 동작하고, `Escape` 취소가 자원을 바꾸지 않는지 확인한다. B/A 및 골드 경계는 Task 1 단위 테스트로 검증한다. `/u6-test`에서는 정산 원인·위험도·자원 변화가 남고 승급 버튼이 없는지 확인한다. `prefers-reduced-motion: reduce`에서도 강조가 애니메이션 없이 식별되는지 확인한다.

- [ ] **Step 4: 최종 작업 트리를 확인하고 완료 커밋을 만든다.**

Run: `git diff --check && git status --short`

Expected: 의도한 C5 파일만 남거나, Task 1~5 커밋 뒤에는 사용자 소유 U6 asset manifest/README 두 파일만 untracked로 남는다.

```bash
git add -u
git add docs/superpowers/plans/2026-08-23-lattebun-c5-guide-promotion.md
git commit -m "test: 길잡이 승급 전체 검증" -m "게시판 승급 규칙과 화면 분리를 전체 검사로 확인한다."
```

커밋 전 `git status --short`에서 `public/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/ASSET_MANIFEST.json`과 `README.txt`를 staging 하지 않았음을 다시 확인한다.

---

## Plan Self-Review

- **Spec coverage:** 등급·비용·단계·오류·불변성·공고 재생성은 Task 1과 4, 게시판 전용 UI·결과·접근성은 Task 3과 4, U6 분리는 Task 2, 문서/배정표는 Task 5, 전체 검증은 Task 6이 담당한다.
- **Placeholder scan:** 각 Task는 정확한 파일, API, 실패 조건, 구현 방향, 명령과 기대 결과를 포함한다.
- **Type consistency:** `PromotionMethod`, `PromotionEligibility`, `PromotionResult`, `PromotionExecution`은 Task 1에서 정의하고 Task 3·4가 같은 이름으로 소비한다. U6은 이 타입을 소비하지 않는다.
