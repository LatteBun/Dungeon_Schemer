# C4 PR 리뷰 수정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전멸 뒤의 다음 계약 보상만 남기고, 중상 판정을 정수 비교로 명확히 해 C4 정산 계약·U6 표시·공식 문서를 PR 리뷰 결정과 일치시킨다.

**Architecture:** `SettlementResult.nextReward`를 `Reward | null`로 바꿔 클리어에서는 값을 만들지 않는다. C4가 전멸에서만 다음 보상을 계산하고, U6 어댑터는 그 nullable 값을 그대로 전달하며 화면은 값이 있을 때만 표시한다. 중상 상태는 동일한 규칙을 부동소수점 비율 대신 `hp * 5 < maxHp` 정수 비교로 계산한다.

**Tech Stack:** Next.js 16.3, React 19.2, TypeScript 5, Vitest 4.1

**Spec:** `docs/superpowers/specs/2026-08-23-lattebun-c4-expedition-settlement-design.md`

## Review Decisions

- `nextReward`는 전멸에서 위험도 상승 뒤의 다음 계약 보상만 뜻한다. 클리어는 던전이 종료되므로 `null`이다.
- U6은 `nextReward`가 `null`이면 다음 계약 보상 영역을 렌더링하지 않는다.
- 중상은 생존자만 대상이며, 정확히 최대 HP의 20%면 중상이 아니다. 구현식은 `member.hp * 5 < member.maxHp`로 고정한다.
- 정산 계산과 화면 변환은 계속 분리한다. U6은 보상이나 중상 여부를 재계산하지 않는다.
- 커밋 제목과 본문은 모두 한글로 작성한다.

---

## File Map

- `lib/domain/settlement.ts`: `SettlementResult.nextReward`의 nullable 계약.
- `lib/rules/settlement.ts`: 전멸 전용 다음 보상 계산과 정수식 중상 정규화.
- `lib/rules/settlement.test.ts`: 클리어/전멸 다음 보상과 20% 경계 회귀 테스트.
- `components/game/u6-settlement-model.ts`: nullable 다음 보상을 재계산 없이 U6 View로 전달.
- `components/game/U6SettlementScreen.tsx`: 클리어에서는 다음 계약 보상 문구를 숨김.
- `components/game/u6-settlement-model.test.ts`, `components/game/U6SettlementScreen.test.ts`: U6 nullable 계약과 조건부 렌더링 테스트.
- `components/game/u6-preview-data.ts`, `components/game/u6-preview-data.test.ts`: 클리어 프리뷰는 `nextReward: null`, 전멸 프리뷰만 다음 보상 보유.
- `docs/superpowers/specs/2026-08-23-lattebun-c4-expedition-settlement-design.md`: C4 다음 보상 조건을 nullable 계약으로 명시.
- `docs/superpowers/specs/2026-08-22-sbh3821-u6-settlement-ending-design.md`, `docs/technical/SCREEN_ADAPTER_CONTRACT.md`: U6의 전멸 전용 표시 계약을 동기화.
- `docs/README.md`: 이 PR 리뷰 수정 계획 링크.

### Task 1: 전멸 전용 다음 보상 계약을 C4·U6 전체에 전파한다

**Files:**
- Modify: `lib/domain/settlement.ts:SettlementResult`
- Modify: `lib/rules/settlement.ts:settleExpedition`
- Modify: `lib/rules/settlement.test.ts`
- Modify: `components/game/u6-settlement-model.ts:U6SettlementView,createU6SettlementView`
- Modify: `components/game/U6SettlementScreen.tsx:Changes`
- Modify: `components/game/u6-settlement-model.test.ts`
- Modify: `components/game/U6SettlementScreen.test.ts`
- Modify: `components/game/u6-preview-data.ts`
- Modify: `components/game/u6-preview-data.test.ts`
- Modify: `docs/superpowers/specs/2026-08-23-lattebun-c4-expedition-settlement-design.md`
- Modify: `docs/superpowers/specs/2026-08-22-sbh3821-u6-settlement-ending-design.md`
- Modify: `docs/technical/SCREEN_ADAPTER_CONTRACT.md`
- Modify: `docs/README.md`

**Interfaces:**
- Consumes: `rewardForSurvivors(risk: RiskLevel, survivors: 0 | 1 | 2 | 3): Reward` and `SettlementSnapshot.status`.
- Produces: `SettlementResult.nextReward: Reward | null` and `U6SettlementView.nextReward: Reward | null`.

- [ ] **Step 1: C4 정산과 U6의 실패하는 nullable 계약 테스트를 쓴다**

`lib/rules/settlement.test.ts`의 3/2/1명 클리어 테스트에 `nextReward: null`을 단정하고, 전멸 테스트에는 상승한 위험도 보상을 단정한다.

```ts
expect(result).toMatchObject({
  survivorCount: survivors,
  nextReward: null,
});

expect(result).toMatchObject({
  status: "wiped",
  riskAfter: 3,
  nextReward: { reputation: 15, gold: 32 },
});
```

`components/game/u6-settlement-model.test.ts`에는 `nextReward: null`인 클리어 결과를 어댑터가 그대로 보존하는 테스트를 추가한다.

```ts
const view = createU6SettlementView(campaign, result({
  status: "cleared",
  survivorCount: 3,
  nextReward: null,
}), "사막 5", "desert");

expect(view.nextReward).toBeNull();
```

`components/game/U6SettlementScreen.test.ts`에는 클리어 View에서 다음 계약 보상 문구가 없고, 전멸 View에서만 보이는 테스트를 추가한다.

```ts
expect(render({ nextReward: null })).not.toContain("다음 계약 보상");
expect(render({ survivors: 0 })).toContain("다음 계약 보상");
```

- [ ] **Step 2: 변경 전 테스트가 현재 계약 때문에 실패하는지 확인한다**

Run: `pnpm vitest run lib/rules/settlement.test.ts components/game/u6-settlement-model.test.ts components/game/U6SettlementScreen.test.ts`

Expected: FAIL — 현재 클리어도 보상 객체를 만들고 화면이 무조건 `nextReward.reputation`을 읽는다.

- [ ] **Step 3: nullable 타입·C4 계산·U6 조건부 표시를 최소 변경으로 구현한다**

`lib/domain/settlement.ts`와 `components/game/u6-settlement-model.ts`에서 다음 필드를 nullable로 바꾼다.

```ts
readonly nextReward: Reward | null;
```

`settleExpedition`은 전멸일 때만 위험도 상승 뒤의 3인 생존 보상을 계산한다.

```ts
nextReward: wiped ? rewardForSurvivors(riskAfter, 3) : null,
```

`Changes`는 null을 역참조하지 않고 다음 보상 값이 있을 때만 기존 문구를 렌더링한다.

```tsx
{settlement.nextReward === null ? null : (
  <p className="u6-next-reward">
    다음 계약 보상 <strong>명성 {settlement.nextReward.reputation}</strong>
    <strong>골드 {settlement.nextReward.gold}</strong>
  </p>
)}
```

프리뷰의 `settlementPartial`과 `settlementPromotion`은 `nextReward: null`로 바꾸고, 전멸 프리뷰 `settlementWipe`의 값은 유지한다. TypeScript 오류가 남지 않도록 모든 fixture의 필드를 갱신한다.

공식 문서는 다음 표현으로 동기화한다.

- C4 Spec: 결과의 `nextReward`는 전멸에서만 `Reward`, 클리어에서는 `null`; 정산 순서의 다음 보상 계산도 전멸 분기로 한정.
- U6 Spec과 기술 계약: `nextReward: Reward | null`, 전멸에서만 “다음 계약 보상”을 표시.
- `docs/README.md`: 이 계획 문서를 C4 구현 계획 다음에 링크.

- [ ] **Step 4: 관련 단위 테스트와 타입 검사를 통과시킨다**

Run: `pnpm vitest run lib/rules/settlement.test.ts components/game/u6-settlement-model.test.ts components/game/U6SettlementScreen.test.ts components/game/u6-preview-data.test.ts && pnpm typecheck`

Expected: PASS — 클리어는 `nextReward: null`, 전멸만 보상 객체를 유지하고 U6은 null을 안전하게 렌더링한다.

- [ ] **Step 5: 첫 번째 리뷰 수정을 커밋한다**

```bash
git add lib/domain/settlement.ts lib/rules/settlement.ts lib/rules/settlement.test.ts \
  components/game/u6-settlement-model.ts components/game/u6-settlement-model.test.ts \
  components/game/U6SettlementScreen.tsx components/game/U6SettlementScreen.test.ts \
  components/game/u6-preview-data.ts components/game/u6-preview-data.test.ts \
  docs/superpowers/specs/2026-08-23-lattebun-c4-expedition-settlement-design.md \
  docs/superpowers/specs/2026-08-22-sbh3821-u6-settlement-ending-design.md \
  docs/technical/SCREEN_ADAPTER_CONTRACT.md docs/README.md \
  docs/superpowers/plans/2026-08-23-lattebun-c4-pr-review-fixes.md
git commit -m "수정: 클리어 정산의 다음 보상을 비운다" \
  -m "전멸 뒤 상승한 위험도의 다음 계약 보상만 결과와 U6에 전달하고, 클리어에서는 화면과 계약 모두 null로 처리한다."
```

### Task 2: 중상 경계 판정을 정수 비교로 고정한다

**Files:**
- Modify: `lib/rules/settlement.ts:normalizedMember`
- Modify: `lib/rules/settlement.test.ts`

**Interfaces:**
- Consumes: 유효성 검사를 통과한 `Character`의 정수 `hp`와 `maxHp`.
- Produces: `gravelyWounded === member.alive && member.hp * 5 < member.maxHp`.


- [ ] **Step 1: 20% 경계 회귀 테스트를 정수 값으로 보강한다**

기존 중상 테스트를 정수 경계가 드러나도록 보강한다. `maxHp`가 15일 때 HP 3은 정확히 20%라 중상이 아니고, HP 2는 중상이다. 캠페인 풀의 원본과 최종 상태 모두 같은 `maxHp`를 갖도록 fixture를 조정해 C4 고정 캐릭터 검증을 통과시킨다.

```ts
const initial = campaignFixture();
const members = partyMembers(initial);
const exact = { ...members[0], maxHp: 15, hp: 3 };
const below = { ...members[1], maxHp: 15, hp: 2 };
const campaign = withMembers([exact, below], initial);
const finalMembers = [exact, below, members[2]];
const { campaign: resultCampaign } = settleExpedition(
  campaign,
  snapshotFixture(campaign, { finalMembers }),
);

expect(resultCampaign.pool.byId[exact.id].gravelyWounded).toBe(false);
expect(resultCampaign.pool.byId[below.id].gravelyWounded).toBe(true);
```

- [ ] **Step 2: 기존 비율 구현에서 경계 동작을 기준선으로 확인한다**

Run: `pnpm vitest run lib/rules/settlement.test.ts`

Expected: PASS — 이 변경은 동일한 게임 규칙을 더 직접적인 정수식으로 표현하는 정밀도 리팩터링이므로, 기존 비율식과 경계 결과가 같아야 한다. 실패를 인위적으로 만들지 않고 Step 3 뒤 같은 테스트를 회귀 보장으로 사용한다.

- [ ] **Step 3: 중상 정규화를 정수 비교로 바꾼다**

`normalizedMember`의 비율식을 아래 식으로 교체한다. `alive` 조건은 유지하므로 사망자는 중상으로 표시되지 않는다.

```ts
gravelyWounded: member.alive && member.hp * 5 < member.maxHp,
```

- [ ] **Step 4: C4 테스트와 타입 검사를 통과시킨다**

Run: `pnpm vitest run lib/rules/settlement.test.ts && pnpm typecheck`

Expected: PASS — 정확히 20%는 false, 그보다 낮은 정수 HP는 true이며 기존 정산 동작은 유지된다.

- [ ] **Step 5: 두 번째 리뷰 수정을 커밋한다**

```bash
git add lib/rules/settlement.ts lib/rules/settlement.test.ts
git commit -m "수정: 중상 판정을 정수식으로 고정한다" \
  -m "HP가 최대치의 정확히 20%일 때 중상이 아님을 hp 곱셈 비교로 명확히 보장한다."
```

### Task 3: PR 회귀 검증과 리뷰 응답을 마무리한다

**Files:**
- Modify: 없음

**Interfaces:**
- Consumes: Task 1~2의 커밋된 `spec/c4-expedition-settlement` 브랜치.
- Produces: 최신 커밋을 가리키는 PR #107과 두 리뷰 항목에 대한 근거 있는 응답.

- [ ] **Step 1: 전체 검증을 실행한다**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm exec next build --webpack`

Expected: 테스트·타입체크·Webpack 프로덕션 빌드 통과. 린트는 기존 `<img>` 경고가 남을 수 있으나 오류는 0개여야 한다.

- [ ] **Step 2: 변경 범위와 사용자 자산 제외를 확인한다**

Run: `git status --short && git diff main...HEAD --check`

Expected: C4 리뷰 수정 파일만 커밋되어 있고, `public/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/ASSET_MANIFEST.json` 및 `README.txt`는 계속 미추적 상태로 남아 커밋되지 않는다.

- [ ] **Step 3: PR 브랜치를 푸시하고 리뷰에 응답한다**

```bash
git push origin spec/c4-expedition-settlement
gh pr comment 107 --body "리뷰 두 항목을 반영했습니다. 클리어 정산은 nextReward: null로 만들고 U6에서도 다음 계약 보상 영역을 숨깁니다. 중상 판정은 hp * 5 < maxHp 정수식으로 교체했습니다. 전체 테스트·타입체크·Webpack 빌드를 다시 확인했습니다."
```

GitHub 인라인 코멘트가 생기면 일반 PR 코멘트가 아니라 해당 스레드에 답한다. 현재 리뷰는 본문 코멘트이므로 PR 일반 코멘트로 결과를 남긴다.

- [ ] **Step 4: 푸시된 커밋과 PR 상태를 확인한다**

Run: `gh pr view 107 --json url,state,headRefName,commits,statusCheckRollup`

Expected: PR #107이 `spec/c4-expedition-settlement`의 최신 두 수정 커밋을 가리키고, 필수 상태 검사가 완료되었음을 확인한다.

## Self-Review

- 리뷰 1의 nullable 계약은 C4 도메인, C4 계산, U6 어댑터, 화면, fixture, 테스트와 세 문서에 Task 1로 모두 반영한다.
- 리뷰 2의 정수식 중상 경계는 Task 2의 경계 fixture와 구현식으로 다룬다.
- 기존 U6 프리뷰의 전멸 보상은 유지하고 클리어 데이터만 null로 바꿔 화면 시연의 의미를 보존한다.
- 모든 단계에 대상 파일, 코드 형태, 실행 명령과 기대 결과를 적어 구현자가 추가 해석 없이 진행할 수 있게 한다.
- `SettlementResult`와 `U6SettlementView`의 `nextReward` 타입은 모두 `Reward | null`로 일치한다.
