# C6 PR #110 리뷰 수정 Implementation Plan

- 작성자: LatteBun
- 작성 도구: Codex

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `trust === 0`의 영구 불신을 C4 정산까지 보장하고, 즉시 `distrust`의 C7 호출 계약과 정상 엔딩 4종의 경계를 명확히 한다.

**Architecture:** E2 `evaluateTrust`는 일반 신뢰 변화에서 이미 0 회복을 막는다. C4는 외부 `SettlementSnapshot.finalMembers`를 받으므로, 이전 신뢰가 0인데 최종 상태가 양수인 입력도 거부해야 한다. C6은 순수 판정을 유지하고, 활성 원정 파티의 최신 상태·중복 ID 검증·원자적 ended 전이는 C7 호출자 계약으로 문서화한다.

**Tech Stack:** Next.js 16.3, TypeScript 5, Vitest 4.1. 새 런타임 의존성 없음.

**Spec:** [C6 엔딩·신뢰 붕괴 설계](../specs/2026-08-23-lattebun-c6-ending-trust-collapse-design.md), [C4 원정 정산 설계](../specs/2026-08-23-lattebun-c4-expedition-settlement-design.md)

## Review Decisions

- `trust === 0`은 영구 불신의 유일한 상태다. 이력 플래그를 추가하지 않는다.
- E2 `evaluateTrust`와 C4 `validateCharacter`가 각 입력 경로에서 0→양수 회복을 막는다. 이후 다른 상태 전이가 trust를 직접 받으면 같은 불변식을 검증한다.
- `evaluateImmediateDistrustEnding`은 신뢰 변화 묶음이 모두 반영된 현재 활성 파티 상태를 C7에서 받는다. 활성 원정 상태가 캠페인 풀보다 최신이므로, 전달 파티의 `alive`·`trust`를 판정에 사용한다.
- C7은 활성 파티가 계약 파티의 서로 다른 3명이고 전달 멤버가 그 ID와 정확히 일치함을 검증한다. C6은 중복·누락·오래된 파티 상태를 보정하거나 추측하지 않는다.
- `distrust`는 원정 중 즉시 전이이고, C3 뒤 정상 경로는 `denounced → completed → exhausted → unemployed` 네 종이다. `ENDING_ORDER`는 모든 엔딩 kind의 표시/완전성 순서이지 단일 호출의 실행 순서가 아니다.
- 문서의 수용·적발 보정과 신뢰 0 조기 엔딩 분포는 B1 밸런스 재측정에서 다시 확인한다.
- 커밋 제목과 본문은 한국어로 작성한다.

---

## File Map

- `lib/rules/settlement.ts`: C4 final member 검증에서 trust 0의 회복을 거부한다.
- `lib/rules/settlement.test.ts`: 0→양수 회복 시도와 입력 불변성 회귀를 고정한다.
- `lib/domain/campaign.ts`: `ENDING_ORDER`의 책임을 kind 순서/완전성으로 정정한다.
- `docs/superpowers/specs/2026-08-23-lattebun-c6-ending-trust-collapse-design.md`: E2·C4 영구 불신 책임과 C7 활성 파티 호출 계약을 명시한다.
- `docs/superpowers/specs/2026-08-23-lattebun-c4-expedition-settlement-design.md`: C4가 거부할 0→양수 trust 입력을 validation 계약에 추가한다.
- `docs/systems/CHARACTERS_AND_TRUST.md`, `docs/systems/PROGRESSION_AND_ENDINGS.md`: 불변식 책임과 즉시/정상 판정 단계를 동기화한다.
- `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`, `docs/README.md`: C7 인수인계와 C6 링크 설명을 갱신한다.

### Task 1: 문서와 도메인 계약에서 불변식·C7 경계를 고정한다

**Files:**
- Modify: `lib/domain/campaign.ts:EndingKind, ENDING_ORDER`
- Modify: `docs/superpowers/specs/2026-08-23-lattebun-c6-ending-trust-collapse-design.md:Trust State, Immediate Distrust Ending, Ending Evaluation, Integration Notes`
- Modify: `docs/superpowers/specs/2026-08-23-lattebun-c4-expedition-settlement-design.md:Settlement Order, Character State`
- Modify: `docs/systems/CHARACTERS_AND_TRUST.md:신뢰 0`
- Modify: `docs/systems/PROGRESSION_AND_ENDINGS.md:엔딩`
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md:C6, C7`
- Modify: `docs/README.md:이번 개편 설계`

**Interfaces:**

```ts
export function evaluateImmediateDistrustEnding(
  campaign: CampaignState,
  partyMembers: readonly Character[],
): CampaignEnding | null;
```

C7은 한 조언 결과 또는 보스 정보 검증의 신뢰 변화 묶음을 전부 적용한 뒤, 활성 원정의 서로 다른 계약 파티원 3명과 정확히 일치하는 최신 `partyMembers`를 이 함수에 넘긴다. 결과가 있으면 C4/C3/C8을 호출하지 않고 `phase: "ended"`와 `ending`을 한 번에 기록한다.

- [ ] **Step 1: 문서 계약을 먼저 갱신하고 Spec 검토를 요청한다**

각 문서 책임 위치에 아래 계약을 추가한다.

```text
E2 evaluateTrust는 trust가 0인 입력을 같은 0으로 반환한다.
C4 validateCharacter는 캠페인 풀의 이전 trust가 0인데 finalMembers의 trust가 양수인 정산 snapshot을 INVALID_SETTLEMENT로 거부한다.
```

즉시 불신 설명에는 아래 C7 경계를 넣는다.

```text
활성 원정 상태가 캠페인 풀보다 최신이다. C7은 신뢰 변화 묶음 적용 뒤 그 최신 파티 상태를 전달하고,
계약 파티와 동일한 서로 다른 3명인지 검증한다. C6은 전달된 파티의 alive와 trust만 판정한다.
```

`PROGRESSION_AND_ENDINGS.md`에서는 즉시 `distrust`를 표 위 예외로 두고, 표는 C3 뒤 정상 4종만 `1..4`로 둔다. `ENDING_ORDER` 주석은 아래로 교체한다.

```ts
/** 모든 엔딩 kind의 표시·완전성 순서다. 실제 전이는 즉시 distrust와 C3 뒤 정상 4종으로 나뉜다. */
```

`docs/README.md`의 C6 링크는 `신뢰 0 누적 보정, 원정 중 즉시 불신 전이, 정상 경로 4종 엔딩 판정과 C7 경계`로 바꾼다. Spec 갱신 뒤 사용자의 검토·승인을 받으며, 승인 전에는 Task 2 코드 변경을 시작하지 않는다.

- [ ] **Step 2: 문서 용어 검사를 통과시킨다**

Run: `pnpm vitest run docs/DOCUMENT_TERMINOLOGY.test.ts`

Expected: PASS — 폐기 용어를 다시 들이지 않고 기존 공식 문서 앵커를 유지한다.

- [ ] **Step 3: 문서 계약 변경을 커밋한다**

```bash
git add lib/domain/campaign.ts docs/superpowers/specs/2026-08-23-lattebun-c6-ending-trust-collapse-design.md docs/superpowers/specs/2026-08-23-lattebun-c4-expedition-settlement-design.md docs/systems/CHARACTERS_AND_TRUST.md docs/systems/PROGRESSION_AND_ENDINGS.md docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md docs/README.md docs/superpowers/plans/2026-08-23-lattebun-c6-pr110-review-fixes.md
git commit -m "문서: C6 불신 전이 계약을 명확히 한다" -m "신뢰 0 영구화의 E2·C4 책임과 C7 활성 파티 전달 경계를 명시한다."
```

### Task 2: C4 정산에서 신뢰 0 회복을 거부한다

**Files:**
- Modify: `lib/rules/settlement.test.ts:잘못된 파티와 상태는 적용 전에 INVALID_SETTLEMENT로 거부한다`
- Modify: `lib/rules/settlement.ts:validateCharacter`

**Interfaces:**

```ts
function validateCharacter(member: Character, before: Character | undefined): void;
```

`before.trust === TRUST_MIN && member.trust > TRUST_MIN`이면 `RuleError("INVALID_SETTLEMENT", ...)`를 던진다. 입력 `campaign`과 `snapshot`은 그대로여야 한다.

- [ ] **Step 1: 실패하는 0→양수 정산 회귀 테스트를 작성한다**

`settlement.test.ts`에 풀의 첫 계약 파티원을 `trust: 0`으로 바꾼 캠페인을 만들고, 같은 멤버를 `trust: 1`로 둔 `finalMembers` snapshot을 전달하는 테스트를 추가한다. 정산 전 `campaign`과 `snapshot`의 deep clone을 보관한다.

```ts
const initial = campaignFixture();
const members = partyMembers(initial);
const zeroTrustMember = { ...members[0], trust: 0 };
const campaign = withMembers([zeroTrustMember], initial);
const finalMembers = [
  { ...zeroTrustMember, trust: 1 },
  campaign.pool.byId[members[1].id]!,
  campaign.pool.byId[members[2].id]!,
];
const snapshot = snapshotFixture(campaign, { finalMembers });
const beforeCampaign = structuredClone(campaign);
const beforeSnapshot = structuredClone(snapshot);

expect(() => settleExpedition(campaign, snapshot)).toThrowError(
  expect.objectContaining({ code: "INVALID_SETTLEMENT" }),
);
expect(campaign).toEqual(beforeCampaign);
expect(snapshot).toEqual(beforeSnapshot);
```

이 테스트는 현재 구현에서 잘못된 snapshot이 통과하므로 먼저 실패해야 한다.

- [ ] **Step 2: 테스트가 현재 누락을 재현하는지 확인한다**

Run: `pnpm vitest run lib/rules/settlement.test.ts`

Expected: FAIL — 현재 C4는 trust 범위만 검사하므로 0→1 snapshot을 적용한다.

- [ ] **Step 3: C4 검증에 영구 불신 불변식을 추가한다**

`validateCharacter`의 trust 범위 검사 직후 아래 최소 조건을 넣는다. HP·gold·생존 상태와 기존 C4 결과 계산은 바꾸지 않는다.

```ts
if (before.trust === TRUST_MIN && member.trust > TRUST_MIN) {
  invalid("정산으로 신뢰 0을 회복할 수 없다", { characterId: member.id });
}
```

- [ ] **Step 4: C4 단위 테스트와 타입 검사를 통과시킨다**

Run: `pnpm vitest run lib/rules/settlement.test.ts lib/rules/trust.test.ts && pnpm typecheck`

Expected: PASS — E2와 C4 어느 경로에서도 0이 양수로 회복되지 않으며 유효한 정산 결과는 유지된다.

- [ ] **Step 5: C4 불변식 수정을 커밋한다**

```bash
git add lib/rules/settlement.ts lib/rules/settlement.test.ts
git commit -m "수정: 정산에서 신뢰 0 회복을 거부한다" -m "정산 snapshot이 영구 불신 상태를 양수 신뢰로 되돌리지 못하게 검증한다."
```

### Task 3: 전체 회귀를 확인하고 PR 리뷰에 근거를 남긴다

**Files:**
- Modify: 없음

**Interfaces:**
- Consumes: Task 1의 승인·문서 커밋과 Task 2의 C4 검증 커밋.
- Produces: 신뢰 0 불변식과 C7 호출 계약이 반영된 PR #110 리뷰 응답.

- [ ] **Step 1: 전체 검증을 실행한다**

Run: `pnpm vitest run && pnpm typecheck && pnpm build && pnpm lint`

Expected: 모든 테스트·타입 검사·프로덕션 빌드가 통과한다. lint는 기존 `<img>` 경고만 남고 오류는 없다.

- [ ] **Step 2: 변경 범위를 확인한다**

Run: `git diff main...HEAD --check && git status --short && git log --oneline main..HEAD`

Expected: 공백 오류가 없고 Task 1~2에 기록한 파일만 의도적으로 변경되며 커밋 제목·본문은 한국어다.

- [ ] **Step 3: PR #110의 종합 리뷰에 응답한다**

아래 사실과 실제 검증 결과·커밋 SHA를 남긴다.

```text
1. E2 evaluateTrust와 C4 validateCharacter가 각각 trust 0 회복을 막도록 계약·테스트를 추가했다.
2. C7은 신뢰 변화 묶음 직후의 활성 원정 파티를 source of truth로 사용하고, 계약 파티와의 ID 일치·중복 없음 검증 뒤 C6을 호출한다고 명시했다.
3. distrust는 즉시 전이, denounced→completed→exhausted→unemployed는 정상 경로 4종으로 문서·ENDING_ORDER 주석을 정리했다.
```

PR push나 merge는 사용자가 별도로 요청할 때만 한다.

## Self-Review

- Spec coverage: 영구 불신 책임은 Task 1~2, C7 활성 파티 계약은 Task 1, 즉시/정상 엔딩 용어는 Task 1, 회귀 검증과 리뷰 응답은 Task 3이 담당한다.
- Placeholder scan: `TBD`, `TODO`, `implement later`, `fill in details`가 없다.
- Type consistency: C4는 기존 `validateCharacter(member, before)` 내부에서만 검증을 추가하고 C6 공개 함수 서명·`CampaignEnding` 계약은 바꾸지 않는다.
