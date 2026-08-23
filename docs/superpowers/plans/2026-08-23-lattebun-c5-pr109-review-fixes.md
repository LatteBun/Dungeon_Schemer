# C5 PR109 리뷰 수정 구현 계획

- 작성자: LatteBun
- 작성 도구: Codex

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** C·B·A 등급이 조건 미달이어도 게시판에서 승급 목표와 부족량을 확인할 수 있게 하고, 승급 결과 오버레이의 닫기 lifecycle을 회귀 테스트로 고정한다.

**Architecture:** C5 순수 규칙은 그대로 유지한다. U3은 `PromotionEligibility`의 존재 여부로 C·B·A와 S를 구분하고, `canPromoteByReputation`/`canPromoteByGold`는 상단 버튼의 강조와 각 경로 버튼의 활성화에만 사용한다. `PromotionResult`는 이미 `CampaignState.phase`와 분리된 UI 상태이므로 결과를 닫으면 결과 상태만 지우고 갱신된 `board`를 유지한다.

**Tech Stack:** Next.js 16.3, React 19, TypeScript, Vitest 4, CSS.

**Spec:** [C5 길잡이 승급 설계](../specs/2026-08-23-lattebun-c5-guide-promotion-design.md) §4.2, §4.3, §6, §7, §8, §11.

## 리뷰 판단

1. **조건 미달에서 상단 등급 버튼이 비활성화되는 문제 — 수정한다.** 현재 `TopStatusBar`가 `disabled={!available}`를 적용해 C·B·A의 조건 미달 상태에서 선택 화면을 열지 못한다. 이는 Spec §7의 “조건 미달이어도 다음 목표를 확인”과 직접 충돌한다.
2. **결과 dialog lifecycle — 구조 변경 없이 회귀 테스트를 보강한다.** 현재 `promoteGuide`는 즉시 `board` phase를 반환하고, `U3Preview`의 별도 `promotionResult`가 결과 dialog만 제어한다. `onDismissPromotionResult`는 그 값만 `null`로 만들어 갱신된 게시판을 유지하므로 Spec §8과 일치한다. 다만 이 우선순위와 닫은 뒤의 board 표시 계약을 테스트로 명시한다.
3. **동시에 발견한 접근성 보정 — 함께 수정한다.** 두 경로 모두 조건 미달일 때 현재 구현은 비활성화된 명성 버튼에 `autoFocus`를 준다. Spec §7은 가능한 첫 경로가 없으면 `취소`에 포커스를 두도록 요구하므로, 같은 선택 화면 변경에서 바로잡는다.

## Global Constraints

- C·B·A에서 `getGuidePromotionEligibility(campaign)`은 항상 값이 있으므로 상단 등급 버튼은 클릭 가능해야 한다.
- S에서 eligibility는 `null`이며 승급 진입 버튼·선택 화면을 제공하지 않는다.
- `canPromoteByReputation`과 `canPromoteByGold`는 상단 버튼의 강조와 각 경로 버튼의 disabled 상태만 결정한다. UI가 비용·다음 등급·부족량을 재계산하지 않는다.
- `openGuidePromotion`/`cancelGuidePromotion`/`promoteGuide`의 순수 전이, 자원 변화, 공고 무효화·C2 재생성 책임은 바꾸지 않는다.
- 결과 dialog는 `PromotionResult`만 표시하고 닫기 전에도 CampaignState는 `board` phase여야 한다. 닫기는 결과 UI 상태만 제거한다.
- 선택 dialog는 가능한 첫 경로에, 가능한 경로가 없으면 취소 버튼에 `autoFocus`를 둔다.
- 기존 `public/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/ASSET_MANIFEST.json`과 `README.txt`는 사용자 작업물이므로 수정하거나 커밋하지 않는다.
- 커밋 제목과 본문은 한국어로 작성한다.

---

## 파일 구조와 책임

| 파일 | 변경 | 책임 |
| --- | --- | --- |
| `components/game/TopStatusBar.tsx` | 수정 | 게시판에서 C·B·A 등급의 상단 진입 버튼은 항상 활성화하고, `canPromote`는 강조로만 사용 |
| `components/game/TopStatusBar.test.ts` | 수정 | 조건 미달 C등급은 클릭 가능하고, 일반 화면·S등급은 승급 진입 버튼이 아님을 검증 |
| `components/game/U3PromotionDialog.tsx` | 수정 | 두 경로 모두 미달일 때 취소 버튼으로 초기 포커스를 이동 |
| `components/game/U3BoardScreen.test.ts` | 수정 | 조건 미달 선택 화면의 부족 사유·비활성 경로·취소 포커스와 S 진입 불가를 검증 |
| `components/game/u3-promotion-model.test.ts` | 수정 | 결과 표시 상태와 결과 닫기 뒤 board 표시 상태를 명시적으로 검증 |
| `docs/experience/SCREEN_LAYOUT.md` | 수정 | 조건 미달이어도 목표·부족량을 열어볼 수 있고, 강조만 조건 충족 시 적용된다고 공식화 |
| `docs/experience/ONBOARDING_AND_INTERFACE.md` | 수정 | 게시판이 조건 미달 사용자에게 두 경로의 현재값·요구값을 보여준다고 명시 |
| `docs/technical/SCREEN_ADAPTER_CONTRACT.md` | 수정 | U3 상단 버튼의 진입 가능 조건과 경로별 활성화 조건을 분리 |
| `docs/DOCUMENT_TERMINOLOGY.test.ts` | 수정 | 화면 규격 문서에 조건 미달 목표 확인 문구가 유지되는지 감시 |

### Task 1: 조건 미달 승급 선택과 포커스 계약을 고친다

**Files:**
- Modify: `components/game/TopStatusBar.test.ts`
- Modify: `components/game/U3BoardScreen.test.ts`
- Modify: `components/game/TopStatusBar.tsx`
- Modify: `components/game/U3PromotionDialog.tsx`

**Interfaces:**
- Consumes: `TopStatusView.canPromote`, `TopStatusView.nextPromotion`, `U3PromotionView.eligibility`
- Produces: C·B·A의 `data-testid="u3-promotion-trigger"`는 조건 미달에도 enabled button이고, S 또는 비게시판 상태는 정적 상태 칩이며, 두 경로가 모두 미달이면 취소 버튼에 `autoFocus`

- [ ] **Step 1: 조건 미달 선택 화면의 실패 테스트를 작성한다.**

`TopStatusBar.test.ts`에 `nextPromotion: { rank: "B", reputationRequired: 60 }`, `canPromote: false`, `onOpenPromotion`을 넘기는 테스트를 추가한다. 결과에 `data-testid="u3-promotion-trigger"`, `data-promotion-available="false"`가 있고 `disabled=""`가 없음을 고정한다. `onOpenPromotion`을 넘기지 않은 기존 상태 바는 button이 아닌 상태 칩으로 남는 기대도 유지한다.

`U3BoardScreen.test.ts`에는 아래처럼 두 자원이 모두 부족한 C등급 selection fixture를 추가한다.

```ts
const unavailablePromotion: U3PromotionView = {
  eligibility: {
    ...promotion.eligibility,
    currentReputation: 30,
    currentGold: 10,
    canPromoteByReputation: false,
    canPromoteByGold: false,
  },
  isOpen: true,
  result: null,
};

expect(html).toContain("명성 60 / 현재 30");
expect(html).toContain("골드 150 / 현재 10");
expect(html).toContain("명성 부족");
expect(html).toContain("골드 부족");
expect(html.match(/disabled=""/g)).toHaveLength(2);
expect(html).toContain("취소");
```

같은 테스트에서 첫 `autofocus`가 취소 버튼에 붙는지 확인한다. 별도 S fixture는 `rank: "S"`, `nextPromotion: undefined`, `eligibility: null`로 만들고 `u3-promotion-trigger`와 `u3-promotion-dialog`가 없음을 확인한다.

- [ ] **Step 2: 새 UI 테스트가 현재 구현에서 실패하는지 확인한다.**

Run:

```bash
pnpm vitest run components/game/TopStatusBar.test.ts components/game/U3BoardScreen.test.ts
```

Expected: FAIL — 조건 미달 상단 버튼에 `disabled`가 있고, 두 경로가 모두 부족할 때 disabled 명성 버튼에 `autofocus`가 붙는다.

- [ ] **Step 3: 상단 버튼의 진입 가능 여부와 강조를 분리한다.**

`TopStatusBar.tsx`에서 `StatusItem`의 `disabled={!available}`를 제거한다. 다만 `onOpenPromotion`만으로 S를 열 수 없게, `status.nextPromotion !== undefined`일 때만 rank chip에 `onOpenPromotion`과 `data-testid="u3-promotion-trigger"`를 전달한다.

```tsx
const canOpenPromotion = onOpenPromotion !== undefined && status.nextPromotion !== undefined;

<StatusItem
  label="영구 등급"
  value={status.rank}
  iconSrc="/assets/u2/status-rank.svg"
  onClick={canOpenPromotion ? onOpenPromotion : undefined}
  testId={canOpenPromotion ? "u3-promotion-trigger" : undefined}
  available={status.canPromote}
/>
```

이렇게 C·B·A의 `nextPromotion`은 클릭 가능 상태를 유지하고, `canPromote`는 `.is-available` 강조와 `data-promotion-available` 값만 제어한다. U2·U6처럼 callback 또는 next promotion이 없는 화면은 기존 정적 칩을 유지한다.

- [ ] **Step 4: dialog 초기 포커스를 고친다.**

`U3PromotionDialog.tsx`에서 두 경로의 가능 여부를 한 번 계산한다. 가능한 첫 경로만 `autoFocus`로 두고, 둘 다 불가능하면 취소 버튼에 `autoFocus`를 준다.

```tsx
const firstAvailable = eligibility.canPromoteByReputation
  ? "reputation"
  : eligibility.canPromoteByGold
    ? "gold"
    : null;

<PromotionPath
  method="reputation"
  label="명성"
  required={eligibility.reputationRequired}
  current={eligibility.currentReputation}
  available={eligibility.canPromoteByReputation}
  autoFocus={firstAvailable === "reputation"}
  onConfirm={onConfirm}
/>
<PromotionPath
  method="gold"
  label="골드"
  required={eligibility.goldRequired}
  current={eligibility.currentGold}
  available={eligibility.canPromoteByGold}
  autoFocus={firstAvailable === "gold"}
  onConfirm={onConfirm}
/>
<button type="button" className="u3-promotion-dialog__cancel" autoFocus={firstAvailable === null} onClick={onCancel}>
  취소
</button>
```

`available`과 `disabled` 계산은 `PromotionEligibility`의 두 boolean을 그대로 사용한다.

- [ ] **Step 5: UI 회귀 테스트와 타입 검사를 통과시킨다.**

Run:

```bash
pnpm vitest run components/game/TopStatusBar.test.ts components/game/U3BoardScreen.test.ts components/game/u3-promotion-model.test.ts
pnpm typecheck
```

Expected: PASS — C·B·A 조건 미달 사용자는 목표를 열어 보고 두 경로의 부족량을 읽을 수 있으며, S·비게시판 상태는 승급 진입을 제공하지 않는다.

- [ ] **Step 6: 첫 수정 커밋을 만든다.**

```bash
git add components/game/TopStatusBar.tsx components/game/TopStatusBar.test.ts components/game/U3PromotionDialog.tsx components/game/U3BoardScreen.test.ts components/game/u3-promotion-model.test.ts
git commit -m "fix: 조건 미달 승급 목표 확인 허용" -m "게시판에서 두 승급 경로의 부족량을 확인하고 취소 버튼의 초기 포커스를 보정한다."
```

### Task 2: 결과 오버레이 lifecycle을 회귀 테스트로 고정한다

**Files:**
- Modify: `components/game/u3-promotion-model.test.ts`
- Modify: `components/game/U3BoardScreen.test.ts`

**Interfaces:**
- Consumes: `createU3PromotionView(eligibility, phase, result)`, `U3PromotionView.result`, `U3PromotionView.isOpen`
- Produces: `result !== null`이면 board phase에서도 결과 dialog가 우선 렌더링되고, `result: null`로 바꾸면 같은 board phase에서 dialog 없이 갱신 게시판이 유지된다는 테스트 계약

- [ ] **Step 1: 결과 닫기 상태의 실패 테스트를 작성한다.**

`u3-promotion-model.test.ts`에 B등급의 새 eligibility와 C→B `PromotionResult`를 준비한다. `createU3PromotionView(nextEligibility, "board", result)`는 `isOpen: false`이면서 result를 보존하고, `createU3PromotionView(nextEligibility, "board", null)`는 `isOpen: false`, `result: null`을 반환해야 한다고 고정한다.

`U3BoardScreen.test.ts`에서는 같은 갱신 board fixture에 대해 다음 두 markup을 확인한다.

```ts
expect(withResult).toContain("승급 완료!");
expect(withResult).toContain("게시판으로 돌아가기");
expect(afterDismiss).not.toContain('data-testid="u3-promotion-dialog"');
expect(afterDismiss).toContain("길드 게시판");
```

- [ ] **Step 2: lifecycle 테스트가 현재 상태 표현을 검증하는지 확인한다.**

Run:

```bash
pnpm vitest run components/game/u3-promotion-model.test.ts components/game/U3BoardScreen.test.ts
```

Expected: PASS — 현재 프리뷰의 `promotionResult` 분리와 같은 presentation contract가 이미 성립한다. 실패하면 `U3Preview`의 `onDismissPromotionResult`가 CampaignState를 바꾸지 않고 result만 `null`로 만들도록 최소 수정한다.


- [ ] **Step 3: 기존 결과 lifecycle 구현을 유지한다.**

`U3Preview.tsx`의 닫기 콜백은 이미 아래처럼 result만 제거하므로 변경하지 않는다.

```tsx
onDismissPromotionResult={() => {
  setPromotionResult(null);
}}
```

이 콜백에서 `setCampaign`을 호출하거나 `offers`·자원·등급을 되돌리지 않는다는 점을 Task 2의 regression test와 함께 확인한다.

- [ ] **Step 4: lifecycle 회귀 테스트를 다시 통과시킨다.**

Run:

```bash
pnpm vitest run components/game/U3Preview.test.ts components/game/u3-promotion-model.test.ts components/game/U3BoardScreen.test.ts
```

Expected: PASS — 결과 dialog는 닫기 전 갱신 board 위에 표시되고, 닫은 뒤에는 dialog만 사라진다.

### Task 3: 공식 UI 문서와 문서 감시를 동기화한다

**Files:**
- Modify: `docs/experience/SCREEN_LAYOUT.md`
- Modify: `docs/experience/ONBOARDING_AND_INTERFACE.md`
- Modify: `docs/technical/SCREEN_ADAPTER_CONTRACT.md`
- Modify: `docs/DOCUMENT_TERMINOLOGY.test.ts`

**Interfaces:**
- Consumes: C5 Spec §6·§7, U3 `PromotionEligibility`
- Produces: 공식 문서가 “조건 충족 시 강조”와 “C·B·A는 조건 미달에도 목표 확인 가능”을 분리해 설명하고, 문서 테스트가 화면 규격의 핵심 문구를 감시

- [ ] **Step 1: 문서 감시 테스트에 조건 미달 목표 확인 앵커를 추가한다.**

`docs/DOCUMENT_TERMINOLOGY.test.ts`의 `REQUIRED_ANCHORS["experience/SCREEN_LAYOUT.md"]`에 `"조건 미달이어도"`를 추가한다.

- [ ] **Step 2: 문서 테스트가 현재 문서에서 실패하는지 확인한다.**

Run:

```bash
pnpm vitest run docs/DOCUMENT_TERMINOLOGY.test.ts docs/DOCUMENT_LINKS.test.ts
```

Expected: FAIL — 현재 화면 규격은 조건 충족 시 강조만 설명하고 조건 미달 목표 확인을 명시하지 않는다.

- [ ] **Step 3: 세 공식 문서를 같은 책임 경계로 고친다.**

`SCREEN_LAYOUT.md`의 게시판 절에 다음 문장을 추가한다.

```text
C·B·A 등급은 조건 미달이어도 같은 버튼으로 다음 등급, 현재값, 요구값과 부족 사유를 확인한다. 명성 또는 골드 조건을 만족했을 때만 버튼을 강조하고 해당 경로를 활성화한다. S급은 승급 선택을 열지 않는다.
```

`ONBOARDING_AND_INTERFACE.md`의 상단 등급 버튼 설명은 “조건을 만족하면” 이후에 조건 미달에서도 두 경로의 비용·현재 보유량·부족 사유를 확인한다는 문장을 붙인다. `SCREEN_ADAPTER_CONTRACT.md`는 “상단 등급 버튼은 가능한 경우에만 활성화”를 “C·B·A에서는 항상 선택 화면을 열고, 가능 여부는 강조와 경로 버튼 활성화에만 사용”으로 교체한다.

- [ ] **Step 4: 문서 테스트를 통과시킨다.**

Run:

```bash
pnpm vitest run docs/DOCUMENT_TERMINOLOGY.test.ts docs/DOCUMENT_LINKS.test.ts docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.test.ts
```

Expected: PASS — 링크, 용어 감시, 배정표 무결성이 유지되고 공식 UI 문서가 Spec §7과 일치한다.

- [ ] **Step 5: 문서와 lifecycle 검증을 커밋한다.**

```bash
git add docs/experience/SCREEN_LAYOUT.md docs/experience/ONBOARDING_AND_INTERFACE.md docs/technical/SCREEN_ADAPTER_CONTRACT.md docs/DOCUMENT_TERMINOLOGY.test.ts docs/superpowers/plans/2026-08-23-lattebun-c5-pr109-review-fixes.md
git commit -m "docs: 조건 미달 승급 안내 보완" -m "게시판 승급 진입과 경로별 활성화 조건을 C5 명세와 일치시킨다."
```

### Task 4: 전체 검증과 PR109 후속 확인을 한다

**Files:**
- Modify: 없음 — Task 1~3의 변경만 검증한다.

**Interfaces:**
- Consumes: C5 순수 규칙, U3 dialog, U6 정산 화면, 공식 문서
- Produces: PR109 수정사항의 테스트·타입·lint·프로덕션 빌드·브라우저 증거

- [ ] **Step 1: C5/U3/U6 및 문서 관련 테스트를 실행한다.**

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
  components/game/U6SettlementScreen.test.ts \
  docs/DOCUMENT_TERMINOLOGY.test.ts \
  docs/DOCUMENT_LINKS.test.ts \
  docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.test.ts
```

Expected: PASS — 조건 미달 C등급은 dialog를 열 수 있고 두 방식만 disabled이며, S·U6에는 승급 진입 제어가 없다.

- [ ] **Step 2: 정적 검사와 프로덕션 빌드를 실행한다.**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm exec next build --webpack
```

Expected: PASS — lint 오류가 없고, 타입 검사와 Webpack 프로덕션 빌드가 통과한다. 기존 `<img>` 경고는 새 경고가 아닌지 출력으로 구분한다.

- [ ] **Step 3: 브라우저와 단위 테스트의 검증 경계를 확인한다.**

`pnpm dev`로 서버를 실행하고 `/u3-test`의 초기 C등급·명성 30·골드 10 상태에서 상단 등급 버튼을 누른다. selection dialog가 열리고 명성·골드 버튼이 모두 disabled이며 취소가 초기 포커스인지 확인한다. `/u6-test`에서는 정산 정보는 남고 승급 버튼·선택·결과가 없는지 확인한다.

현재 `/u3-test`에는 초기 자원을 바꾸는 URL fixture나 Store 연결이 없으므로 C등급·명성 60의 승급 결과와 S등급 경계는 Task 1·2의 단위 테스트로 검증한다. 이 PR 수정 범위에 테스트 전용 자원 변경 UI나 URL 상태를 추가하지 않는다.

- [ ] **Step 4: 작업 트리를 확인하고 PR109에 후속 커밋을 올린다.**

Run:

```bash
git diff --check
git status --short
git push
```

Expected: C5 수정 파일만 원격 `spec/c5-guide-promotion`에 반영되고, 사용자 소유 U6 asset manifest/README는 여전히 untracked·unstaged다.

---

## Plan Self-Review

- **Spec coverage:** 조건 미달 진입·경로별 비활성·S 거부·포커스는 Task 1, 결과 닫기와 갱신 board 유지 계약은 Task 2, 공식 문서의 동일한 UX 설명은 Task 3, 전체 회귀·브라우저 확인은 Task 4가 담당한다.
- **Placeholder scan:** 각 Task는 정확한 파일, fixture, 기대 markup 또는 상태, 실행 명령과 완료 기준을 포함한다.
- **Type consistency:** 기존 `TopStatusView`, `U3PromotionView`, `PromotionEligibility`, `PromotionResult`만 사용한다. 새로운 C5 도메인 타입·규칙 API·Store 상태를 만들지 않는다.
