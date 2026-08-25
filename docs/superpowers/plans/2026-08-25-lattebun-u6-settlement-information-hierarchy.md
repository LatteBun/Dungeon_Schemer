# U6 정산 정보 위계 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** U6 정산 화면이 정복과 전멸을 정확히 구분하고, 사망·중상·신뢰 0과 캠페인 누적 효과를 중복 없이 보여주게 한다.

**Architecture:** 정산 규칙은 구조화된 수치·상태와 원정 근거만 반환한다. `createU6SettlementView`가 정산 뒤 `CampaignState`와 `SettlementResult`를 받아 결과 표제, 인물 상태, 던전 결과, 신뢰 0 누적을 화면용 union으로 한 번만 분류하고, `U6SettlementScreen`은 그 View를 좌측 결과·원인·인물과 우측 캠페인 변화로 배치한다.

**Tech Stack:** Next.js 16.3.0 App Router, React 19.2.8, TypeScript 5.x, Zustand 5.0.14, CSS Grid, Vitest 4.1.10, Playwright 1.62.1, Node.js 24.19.0, pnpm 11.21.0

**Spec:** `docs/superpowers/specs/2026-08-25-lattebun-u6-settlement-information-hierarchy-design.md`

## Global Constraints

- 정산 보상, 명성 손실, 위험도 상승, 유품 회수, 신뢰 판정, 신뢰 0 누적 보정 수치는 바꾸지 않는다.
- 클리어는 `정복`과 `게시판에서 제거됨`으로 표시하며 화면 어디에도 `던전 위험도 유지`를 만들지 않는다.
- 전멸에서만 위험도 전후 또는 ★5 상한을 표시한다.
- 살아 있는 신뢰 0 인물은 신뢰 변화량이 0이어도 항상 표시한다.
- 신뢰 0 판정은 `TRUST_MIN`, 누적 기준은 `DENOUNCE_THRESHOLD`, 누적 인원과 보정은 `countLivingZeroTrust`와 `getCampaignTrustModifier`를 재사용한다.
- 사망자의 `trust === TRUST_MIN`은 살아 있는 신뢰 0 누적에 포함하지 않는다.
- `campaignAfterSettlement`와 `settlement`는 같은 정산 실행 또는 `COMPLETE_EXPEDITION` 전이에서 나온 쌍이어야 한다.
- `SettlementResult.memberChanges`는 `SettlementSnapshot.party.memberIds`의 계약 파티 순서를 따른다.
- 계약 골드와 유품 골드를 합쳐 표시하지 않는다.
- 승급 가능 여부는 상단 상태 바가 계속 소유하며 정산 패널에 중복하지 않는다.
- `길드로 돌아간다` 문구, callback, 내용 폭, 우측 최하단 배치를 유지한다.
- 새 패키지와 새 이미지 에셋을 추가하지 않는다.
- 1920×1080 고정 캔버스, 3:2 셸, 공용 상태 바를 유지한다.
- 캔버스 내부에 `vw`, `vh`, 화면별 미디어 쿼리를 추가하지 않는다.
- 컴포넌트와 호출부 작업 전에 `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`를 끝까지 읽는다.
- CSS 작업 전에 `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`를 끝까지 읽는다.
- 커밋 제목과 본문은 모두 한글로 작성한다.

## File Map

| 파일 | 책임 |
| --- | --- |
| `docs/experience/SCREEN_LAYOUT.md` | 정산 좌우 정보 위계의 공식 화면 계약 |
| `docs/experience/ONBOARDING_AND_INTERFACE.md` | 플레이어가 정산에서 읽는 순서와 피드백 계약 |
| `docs/technical/SCREEN_ADAPTER_CONTRACT.md` | C4/C6 결과와 U6 ViewModel의 인수인계 경계 |
| `docs/technical/DEFERRED_WORK.md` | U6가 `memberChanges`를 쓰지 않는다는 폐기된 유예 기록 제거 |
| `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md` | U6의 실제 `memberChanges` 소비 상태 반영 |
| `docs/README.md` | 새 설계와 계획 색인 |
| `components/game/u6-settlement-model.ts` | 정산 뒤 캠페인과 결과를 화면용 구조로 변환 |
| `components/game/u6-settlement-model.test.ts` | 결과 분류, 인물 상태, 신뢰 누적 ViewModel 검증 |
| `components/game/U6SettlementScreen.tsx` | 결과 표제, 원인 요약, 원정대 결과, 캠페인 변화 배치 |
| `components/game/U6SettlementScreen.test.ts` | 화면 문구, 중대 상태, 중복 제거 검증 |
| `components/game/u6-preview-data.ts` | 실제 규칙으로 U6 정산 프리뷰 세 상태 생성 |
| `components/game/u6-preview-data.test.ts` | 프리뷰의 정복·전멸·신뢰 0 상태 검증 |
| `components/game/CampaignScreen.tsx` | 실제 캠페인에서 새 어댑터 시그니처 호출 |
| `components/game/campaign-render.test.tsx` | 실제 캠페인 렌더 경로의 호출 계약 유지 |
| `app/u6-result.css` | 좌측 3구역, 우측 캠페인 변화, 중대 상태 시각 계층 |
| `components/game/U6FixedCanvas.test.ts` | 고정 캔버스와 정산 격자·CTA CSS 계약 |
| `lib/domain/settlement.ts` | UI 문장 없는 정산 결과 타입 |
| `lib/domain/index.ts` | 삭제되는 `SettlementCauseChain` export 정리 |
| `lib/rules/settlement.ts` | 구조화된 정산 계산과 원정 근거 보존 |
| `lib/rules/settlement.test.ts` | 정산 원인 입력 보존과 기존 계산 회귀 |
| `lib/store/campaign-reproducibility.test.ts` | 실제 한 판의 원정 근거가 `causeInputs`로 보존되는지 검증 |
| `lib/rules/campaign-statistics.test.ts` | 변경된 `SettlementResult` fixture 갱신 |
| `lib/rules/campaign-history.test.ts` | 변경된 `SettlementResult` fixture 갱신 |
| `components/game/u6-settlement-integration.test.tsx` | 규칙 → 어댑터 → 화면 전체 경로 검증 |

---

## Execution Preflight: 최신 main 통합

- [ ] **Step 1: 구현용 격리 worktree를 확인한다**

Use: `superpowers:using-git-worktrees`

Expected: 이미 이 브랜치의 격리 worktree에 있으면 그대로 사용하고, 그렇지 않으면 현재 작업 디렉터리와 분리된 worktree에서 `spec/u6-settlement-information-hierarchy` 브랜치를 체크아웃한다.

- [ ] **Step 2: 승인된 spec과 plan 보완을 커밋한다**

Run:

```bash
git add docs/superpowers/specs/2026-08-25-lattebun-u6-settlement-information-hierarchy-design.md docs/superpowers/plans/2026-08-25-lattebun-u6-settlement-information-hierarchy.md
git commit -m "문서: U6 정산 설계와 계획을 보완한다" -m "코드베이스 조사에서 확인한 정산 쌍, 계약 파티 순서, 신뢰 규칙 재사용, 영향 테스트와 공식 문서 범위를 반영한다."
```

Expected: 구현 전 설계와 계획이 한글 제목·본문 커밋으로 보존되고 작업 트리가 깨끗하다.

- [ ] **Step 3: 최신 main을 통합한다**

Run:

```bash
git fetch origin main
git merge origin/main -m "병합: 최신 main 변경을 반영한다" -m "U6 정산 정보 위계 설계와 계획을 유지하면서 선행 변경을 통합한다."
```

Expected: 충돌 없이 병합되거나, U6 관련 충돌에서 main의 최신 기능과 이 설계의 정산 계약을 모두 보존한다.

- [ ] **Step 4: 기준 검사를 실행한다**

Run:

```bash
pnpm test
pnpm lint
pnpm typecheck
```

Expected: 변경 전 기준에서 단위 테스트 PASS, lint 오류 0개, typecheck 성공. 기존 경고가 있으면 수와 내용을 기록하고 이번 범위에서 고치지 않는다.

---

### Task 1: 공식 문서에 새 정산 계약 고정

**Files:**
- Modify: `docs/experience/SCREEN_LAYOUT.md`
- Modify: `docs/experience/ONBOARDING_AND_INTERFACE.md`
- Modify: `docs/technical/SCREEN_ADAPTER_CONTRACT.md`
- Modify: `docs/technical/DEFERRED_WORK.md`
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`
- Modify: `docs/README.md`

**Interfaces:**
- Consumes: 설계 문서의 4질문 정보 위계와 새 어댑터 시그니처
- Produces: 이후 구현 Task가 따르는 공식 화면·어댑터 계약

- [ ] **Step 1: `SCREEN_LAYOUT.md`의 정산 설명을 교체한다**

`### 정산·엔딩`에서 정산 부분을 다음 내용으로 바꾼다. 엔딩 설명은 보존한다.

```markdown
정산 왼쪽은 `원정 결과 표제 → 마지막 조언과 파티의 판단 → 원정대 결과 3인` 순으로 읽힌다. 고정된 다섯 단계와 번호는 사용하지 않는다. 피해 수치와 신뢰 변화는 인물별 결과에, 보상과 던전 변화는 우측 캠페인 변화에 한 번만 둔다.

클리어는 던전 이름과 `정복`, 귀환 인원과 사망자 이름을 표시한다. 클리어한 던전은 게시판에서 제거되므로 위험도 유지 여부를 표시하지 않는다. 전멸에서만 위험도 전후 또는 ★5 상한과 재도전 보상을 보여준다.

정산 오른쪽은 던전 결과, 명성, 계약 골드, 전멸 유품 골드, 살아 있는 신뢰 0 누적과 현재 보정만 보여준다. 살아 있는 신뢰 0 인물은 변화량이 없어도 `정체 발각`과 `원정 출전 불가`를 표시하며, 사망자는 신뢰 0 누적에서 제외한다. 승급 가능 여부는 상단 상태 바가 계속 알리고 정산 패널에 중복하지 않는다.
```

기존 CTA의 내용 폭·우측 최하단 계약은 그대로 둔다.

- [ ] **Step 2: `ONBOARDING_AND_INTERFACE.md`의 정산 표시 순서를 교체한다**

```markdown
정산은 숫자만 나열하지 않고 다음 순서로 보여준다.

1. 던전 정복 또는 원정대 전멸과 귀환·사망 요약
2. 마지막 조언과 파티의 판단
3. 인물별 HP·신뢰 변화와 사망·중상·정체 발각 상태
4. 계약 보상 또는 전멸 명성 손실과 유품
5. 던전 제거 또는 위험도 상승과 재도전 보상
6. 살아 있는 신뢰 0 누적과 현재 조언 수용·거짓 적발 보정

클리어한 던전은 다시 들어갈 수 없으므로 위험도 유지 여부를 보여주지 않는다. 살아 있는 신뢰 0 인물은 신뢰 변화가 없어도 정체 발각과 출전 불가를 표시하고, 사망자는 누적에서 제외한다.
```

기존 `승급은 자동으로 일어나지 않는다` 문단은 유지한다.

- [ ] **Step 3: `SCREEN_ADAPTER_CONTRACT.md`의 U6 정산 경계를 갱신한다**

다음 설명과 시그니처를 기록한다.

````markdown
### `U6SettlementView` — C4 정산과 C6 신뢰 누적

U6 정산은 실제 `SettlementResult`와 정산 뒤 `CampaignState`를 소비한다. 규칙은 보상·유품·위험도·인물 전후 상태와 원정 근거를 구조화된 값으로 내고, 어댑터가 화면용 결과 표제와 상태 union을 만든다.

```ts
createU6SettlementView(
  campaignAfterSettlement: CampaignState,
  settlement: SettlementResult,
  dungeonName: string,
  themeId: ThemeId,
): U6SettlementView
```

화면은 생존자 수로 클리어·전멸을 재판정하지 않는다. `SettlementResult.status`를 보존한 `outcome.kind`와 `dungeonOutcome`을 사용한다. 살아 있는 신뢰 0 정산 전후 인원은 같은 정산에서 나온 캠페인과 `memberChanges.before`로 만들며, 현재 보정은 C6의 `getCampaignTrustModifier`를 그대로 옮긴다. `memberChanges`와 사망자 이름은 계약 파티 순서를 유지한다.
````

- [ ] **Step 4: 폐기된 `memberChanges` 미사용 기록을 갱신한다**

`docs/technical/DEFERRED_WORK.md`에서 `SettlementResult.memberChanges`를 U6가 의도적으로 사용하지 않는다는 항목을 제거한다. `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`의 U6 현재 상태는 다음 의미로 교체한다.

```markdown
`U6`는 `SettlementResult.memberChanges`를 계약 파티 순서대로 소비해 사망·중상·신뢰 0을 인물별로 표시한다. 정산 뒤 `CampaignState`와 같은 정산 결과를 함께 받아 살아 있는 신뢰 0 누적과 현재 보정을 만든다.
```

- [ ] **Step 5: `docs/README.md`에 설계와 계획을 색인한다**

```markdown
- [U6 정산 정보 위계 개선 설계](superpowers/specs/2026-08-25-lattebun-u6-settlement-information-hierarchy-design.md): 정복·전멸, 인물별 영구 상태, 신뢰 0 누적, 캠페인 변화를 중복 없이 보여주는 정산 화면 계약
- [U6 정산 정보 위계 개선 구현 계획](superpowers/plans/2026-08-25-lattebun-u6-settlement-information-hierarchy.md): 공식 문서부터 ViewModel, 화면, 도메인 정리, 통합 검증까지의 테스트 우선 구현 순서
```

- [ ] **Step 6: 문서 검사를 실행한다**

Run:

```bash
pnpm vitest run docs/DOCUMENT_LINKS.test.ts docs/DOCUMENT_TERMINOLOGY.test.ts
```

Expected: 두 파일의 모든 테스트 PASS.

- [ ] **Step 7: 공식 문서 변경을 커밋한다**

```bash
git add docs/README.md docs/experience/SCREEN_LAYOUT.md docs/experience/ONBOARDING_AND_INTERFACE.md docs/technical/SCREEN_ADAPTER_CONTRACT.md docs/technical/DEFERRED_WORK.md docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md
git commit -m "문서: 정산 정보 위계를 개정한다" -m "정복과 전멸, 인물별 영구 상태, 신뢰 0 누적을 정산 화면의 공식 읽기 순서로 고정한다."
```

---

### Task 2: 정산 ViewModel에 구조화된 결과와 신뢰 누적 추가

**Files:**
- Modify: `components/game/u6-settlement-model.ts`
- Modify: `components/game/u6-settlement-model.test.ts`
- Modify: `components/game/CampaignScreen.tsx`
- Modify: `components/game/u6-preview-data.ts`
- Modify: `components/game/campaign-render.test.tsx`

**Interfaces:**
- Consumes: 현재 `SettlementResult`, 같은 정산 직후 `CampaignState`, `TRUST_MIN`, `countLivingZeroTrust`, `getCampaignTrustModifier`, `DENOUNCE_THRESHOLD`
- Produces: `U6SettlementOutcome`, `U6SettlementCause`, `U6DungeonOutcome`, `U6TrustPressureView`, 확장된 `U6SettlementMember`, 새 4인자 `createU6SettlementView`
- Temporary compatibility: Task 3이 화면 전환을 끝낼 때까지 현재 화면용 `causeChain`, `survivors`, `riskBefore`, `riskAfter`, `riskCapped`를 유지한다. 새 `causes`는 Task 5 전까지 `settlement.causeChain.choice`와 `settlement.causeChain.reactions`에서 만들고, Task 5에서 `causeInputs`로 소스만 교체한다.

- [ ] **Step 0: 현재 Next.js 컴포넌트 경계 문서를 읽는다**

Run:

```bash
sed -n '1,320p' node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md
```

Expected: `CampaignScreen`만 기존 Client Component 경계를 유지하고, 직렬화 가능한 View props를 받는 `U6SettlementScreen`에는 불필요한 `"use client"`를 추가하지 않는다.

- [ ] **Step 1: 모델 테스트 helper를 타입 안전하게 확장한다**

`components/game/u6-settlement-model.test.ts`에서 `TRUST_MIN`을 `@/lib/domain`에서 import하고 다음 helper를 추가한다.

```ts
function distinctMembers(campaign: ReturnType<typeof initializeCampaign>) {
  const members = [];
  const classes = new Set<string>();
  for (const id of campaign.pool.order) {
    const member = campaign.pool.byId[id];
    if (member === undefined || classes.has(member.classId)) continue;
    classes.add(member.classId);
    members.push(member);
    if (members.length === 3) break;
  }
  if (members.length !== 3) throw new Error("서로 다른 직업 셋이 없다");
  return members as [typeof members[number], typeof members[number], typeof members[number]];
}

function result(
  campaign: ReturnType<typeof initializeCampaign>,
  over: Partial<SettlementResult> = {},
): SettlementResult {
  const dungeon = campaign.dungeons[0]!;
  const members = distinctMembers(campaign);
  return {
    expeditionId: "exp-u6",
    dungeonId: dungeon.id,
    status: "wiped",
    survivorIds: [],
    survivorCount: 0,
    memberChanges: members.map((member) => ({
      characterId: member.id,
      before: member,
      after: member,
    })),
    reputationDelta: -6,
    goldDelta: 0,
    relicGold: 84,
    riskBefore: 1,
    riskAfter: 2,
    riskCapped: false,
    nextReward: { reputation: 10, gold: 20 },
    causeChain: {
      choice: "선택 내용",
      reactions: "반응 내용",
      damage: "피해 내용",
      economy: "경제 내용",
      campaignChange: "변화 내용",
    },
    ...over,
  };
}
```

- [ ] **Step 2: 클리어 결과 분류의 실패 테스트를 작성한다**

```ts
it("클리어는 위험도 유지가 아니라 정복 결과로 분류한다", () => {
  const campaign = initializeCampaign("u6-cleared-view");
  const [first, second, third] = distinctMembers(campaign);
  const afterMembers = [
    { ...first, hp: Math.max(1, first.hp - 3) },
    { ...second, hp: Math.max(1, second.hp - 4) },
    { ...third, hp: 0, alive: false },
  ];
  const byId = { ...campaign.pool.byId };
  for (const member of afterMembers) byId[member.id] = member;
  const afterCampaign = { ...campaign, pool: { ...campaign.pool, byId } };
  const settlementResult = result(campaign, {
    status: "cleared",
    survivorCount: 2,
    survivorIds: [first.id, second.id],
    memberChanges: afterMembers.map((after, index) => ({
      characterId: after.id,
      before: [first, second, third][index]!,
      after,
    })),
    riskBefore: 2,
    riskAfter: 2,
    riskCapped: false,
    nextReward: null,
  });

  const view = createU6SettlementView(afterCampaign, settlementResult, "거미굴 2", "spider");

  expect(view.outcome).toEqual({
    kind: "cleared",
    title: "거미굴 2 정복",
    summary: `2명 귀환 · ${third.name} 사망`,
  });
  expect(view.dungeonOutcome).toEqual({ kind: "cleared" });
});
```

- [ ] **Step 3: 신뢰 0 누적의 실패 테스트를 작성한다**

```ts
it("살아 있는 신뢰 0의 전후 인원과 현재 보정을 만든다", () => {
  const campaign = initializeCampaign("u6-zero-trust-view");
  const [first, second, third] = distinctMembers(campaign);
  const outsideId = campaign.pool.order.find((id) => ![first.id, second.id, third.id].includes(id));
  if (outsideId === undefined) throw new Error("파티 밖 인물이 없다");
  const outside = campaign.pool.byId[outsideId];
  if (outside === undefined) throw new Error("파티 밖 인물이 없다");
  const existingZero = { ...outside, trust: 0, alive: true };
  const beforeById = { ...campaign.pool.byId, [existingZero.id]: existingZero };
  const beforeCampaign = { ...campaign, pool: { ...campaign.pool, byId: beforeById } };
  const afterFirst = { ...first, trust: 0 };
  const afterById = { ...beforeById, [afterFirst.id]: afterFirst };
  const afterCampaign = { ...beforeCampaign, pool: { ...beforeCampaign.pool, byId: afterById } };
  const settlementResult = result(campaign, {
    status: "cleared",
    survivorCount: 3,
    survivorIds: [first.id, second.id, third.id],
    memberChanges: [
      { characterId: first.id, before: first, after: afterFirst },
      { characterId: second.id, before: second, after: second },
      { characterId: third.id, before: third, after: third },
    ],
    nextReward: null,
  });

  const view = createU6SettlementView(afterCampaign, settlementResult, "묘지 1", "graveyard");

  expect(view.trustPressure).toMatchObject({
    beforeCount: 1,
    afterCount: 2,
    threshold: 5,
    acceptModifier: -5,
    exposeModifier: 0,
    reachedThreshold: false,
  });
  expect(view.members[0]?.trust).toMatchObject({
    changed: true,
    isZero: true,
    becameZero: true,
    countsTowardCampaign: true,
  });
});
```

- [ ] **Step 4: 사망한 신뢰 0 인물의 실패 테스트를 작성한다**

```ts
it("사망한 신뢰 0 인물은 누적에서 제외한다", () => {
  const campaign = initializeCampaign("u6-dead-zero-trust");
  const [first, second, third] = distinctMembers(campaign);
  const beforeFirst = { ...first, trust: 0 };
  const beforeById = { ...campaign.pool.byId, [first.id]: beforeFirst };
  const beforeCampaign = { ...campaign, pool: { ...campaign.pool, byId: beforeById } };
  const deadFirst = { ...beforeFirst, hp: 0, alive: false };
  const afterById = { ...beforeById, [first.id]: deadFirst };
  const afterCampaign = { ...beforeCampaign, pool: { ...beforeCampaign.pool, byId: afterById } };
  const settlementResult = result(campaign, {
    status: "cleared",
    survivorCount: 2,
    survivorIds: [second.id, third.id],
    memberChanges: [
      { characterId: first.id, before: beforeFirst, after: deadFirst },
      { characterId: second.id, before: second, after: second },
      { characterId: third.id, before: third, after: third },
    ],
    nextReward: null,
  });

  const view = createU6SettlementView(afterCampaign, settlementResult, "사막 1", "desert");

  expect(view.trustPressure).toMatchObject({ beforeCount: 1, afterCount: 0 });
  expect(view.members[0]?.trust.countsTowardCampaign).toBe(false);
});
```

- [ ] **Step 4a: 변화 없는 생존 신뢰 0의 실패 테스트를 작성한다**

```ts
it("원정 전부터 신뢰 0인 생존자는 변화가 없어도 발각 상태로 만든다", () => {
  const campaign = initializeCampaign("u6-existing-zero-trust");
  const [first, second, third] = distinctMembers(campaign);
  const zeroFirst = { ...first, trust: TRUST_MIN };
  const afterById = { ...campaign.pool.byId, [first.id]: zeroFirst };
  const afterCampaign = { ...campaign, pool: { ...campaign.pool, byId: afterById } };
  const settlementResult = result(campaign, {
    status: "cleared",
    survivorCount: 3,
    survivorIds: [first.id, second.id, third.id],
    memberChanges: [
      { characterId: first.id, before: zeroFirst, after: zeroFirst },
      { characterId: second.id, before: second, after: second },
      { characterId: third.id, before: third, after: third },
    ],
    nextReward: null,
  });

  const view = createU6SettlementView(afterCampaign, settlementResult, "거미굴 1", "spider");

  expect(view.members[0]?.trust).toMatchObject({
    changed: false,
    isZero: true,
    becameZero: false,
    countsTowardCampaign: true,
  });
});
```

- [ ] **Step 4b: 사망하면서 신뢰가 0이 된 인물의 실패 테스트를 작성한다**

```ts
it("사망하면서 신뢰 0이 된 인물은 변화만 남기고 누적 원인에서 제외한다", () => {
  const campaign = initializeCampaign("u6-died-at-zero-trust");
  const [first, second, third] = distinctMembers(campaign);
  const beforeFirst = { ...first, trust: 8 };
  const deadFirst = { ...beforeFirst, hp: 0, alive: false, trust: TRUST_MIN };
  const afterById = { ...campaign.pool.byId, [first.id]: deadFirst };
  const afterCampaign = { ...campaign, pool: { ...campaign.pool, byId: afterById } };
  const settlementResult = result(campaign, {
    status: "cleared",
    survivorCount: 2,
    survivorIds: [second.id, third.id],
    memberChanges: [
      { characterId: first.id, before: beforeFirst, after: deadFirst },
      { characterId: second.id, before: second, after: second },
      { characterId: third.id, before: third, after: third },
    ],
    nextReward: null,
  });

  const view = createU6SettlementView(afterCampaign, settlementResult, "사막 1", "desert");

  expect(view.members[0]?.trust).toMatchObject({
    changed: true,
    isZero: true,
    becameZero: true,
    countsTowardCampaign: false,
  });
});
```

- [ ] **Step 5: 새 테스트가 올바른 이유로 실패하는지 확인한다**

Run:

```bash
pnpm vitest run components/game/u6-settlement-model.test.ts
```

Expected: 새 4인자 시그니처와 `outcome`, `dungeonOutcome`, `trustPressure`, 인물 신뢰 플래그가 없어서 FAIL.

- [ ] **Step 6: 새 View 타입을 추가한다**

`components/game/u6-settlement-model.ts`에 다음 타입을 추가한다.

```ts
export interface U6SettlementOutcome {
  readonly kind: SettlementResult["status"];
  readonly title: string;
  readonly summary: string;
}

export interface U6SettlementCause {
  readonly kind: "choice" | "reactions";
  readonly label: "마지막 조언" | "파티의 판단";
  readonly detail: string;
}

export type U6DungeonOutcome =
  | { readonly kind: "cleared" }
  | { readonly kind: "riskIncreased"; readonly before: RiskLevel; readonly after: RiskLevel }
  | { readonly kind: "riskCapped"; readonly level: RiskLevel };

export interface U6TrustPressureView {
  readonly beforeCount: number;
  readonly afterCount: number;
  readonly threshold: number;
  readonly acceptModifier: number;
  readonly exposeModifier: number;
  readonly reachedThreshold: boolean;
}
```

`U6SettlementView`에는 다음 필드를 추가한다.

```ts
readonly outcome: U6SettlementOutcome;
readonly causes: readonly U6SettlementCause[];
readonly dungeonOutcome: U6DungeonOutcome;
readonly trustPressure: U6TrustPressureView | null;
```

Task 5 전까지 `causes`는 기존 원인 계약의 앞 두 필드에서 만든다.

```ts
const causes: readonly U6SettlementCause[] = [
  { kind: "choice", label: "마지막 조언", detail: settlement.causeChain.choice },
  { kind: "reactions", label: "파티의 판단", detail: settlement.causeChain.reactions },
];
```

`U6SettlementMember`에 다음 필드를 추가한다.

```ts
readonly diedThisExpedition: boolean;
readonly gravelyWounded: boolean;
readonly trust: {
  readonly before: number;
  readonly after: number;
  readonly changed: boolean;
  readonly isZero: boolean;
  readonly becameZero: boolean;
  readonly countsTowardCampaign: boolean;
};
```

- [ ] **Step 7: 정산 전 신뢰 0 인원을 복원하는 helper를 구현한다**

```ts
function countLivingZeroTrustBefore(
  campaignAfterSettlement: CampaignState,
  settlement: SettlementResult,
): number {
  const beforeById = new Map(
    settlement.memberChanges.map((change) => [String(change.characterId), change.before] as const),
  );

  return campaignAfterSettlement.pool.order.reduce((count, id) => {
    const member = beforeById.get(String(id)) ?? campaignAfterSettlement.pool.byId[id];
    return count + Number(member?.alive === true && member.trust === TRUST_MIN);
  }, 0);
}
```

정산 뒤 인원은 `countLivingZeroTrust(campaignAfterSettlement)`, 현재 보정은 `getCampaignTrustModifier(campaignAfterSettlement)`, 기준은 `DENOUNCE_THRESHOLD`를 사용한다.

- [ ] **Step 8: 결과·던전·인물 helper를 구현한다**

```ts
function outcomeFor(
  settlement: SettlementResult,
  dungeonName: string,
  members: readonly U6SettlementMember[],
): U6SettlementOutcome {
  if (settlement.status === "wiped") {
    return { kind: "wiped", title: "원정대 전멸", summary: "3명 전원 사망 · 계약 실패" };
  }

  const deadNames = members.filter((member) => member.diedThisExpedition).map((member) => member.name);
  return {
    kind: "cleared",
    title: `${dungeonName} 정복`,
    summary: deadNames.length === 0
      ? "전원 귀환"
      : `${settlement.survivorCount}명 귀환 · ${deadNames.join(", ")} 사망`,
  };
}

function dungeonOutcomeFor(settlement: SettlementResult): U6DungeonOutcome {
  if (settlement.status === "cleared") return { kind: "cleared" };
  if (settlement.riskCapped) return { kind: "riskCapped", level: settlement.riskAfter };
  return { kind: "riskIncreased", before: settlement.riskBefore, after: settlement.riskAfter };
}
```

인물 매핑은 `before.alive && !after.alive`, `after.gravelyWounded`, `before.trust !== after.trust`, `after.trust === TRUST_MIN`, `before.trust > TRUST_MIN && after.trust === TRUST_MIN`, `after.alive && after.trust === TRUST_MIN`으로 각 플래그를 만든다.

- [ ] **Step 9: 어댑터 시그니처와 호출부를 확장한다**

함수 시그니처:

```ts
export function createU6SettlementView(
  campaignAfterSettlement: CampaignState,
  settlement: SettlementResult,
  dungeonName: string,
  themeId: ThemeId,
): U6SettlementView
```

신뢰 압력:

```ts
const beforeCount = countLivingZeroTrustBefore(campaignAfterSettlement, settlement);
const afterCount = countLivingZeroTrust(campaignAfterSettlement);
const modifier = getCampaignTrustModifier(campaignAfterSettlement);
const trustPressure = beforeCount === 0 && afterCount === 0 ? null : {
  beforeCount,
  afterCount,
  threshold: DENOUNCE_THRESHOLD,
  acceptModifier: modifier.accept,
  exposeModifier: modifier.expose,
  reachedThreshold: afterCount >= DENOUNCE_THRESHOLD,
};
```

`CampaignScreen.tsx`는 `shownSettlement`을 낸 현재 정산 전이의 `campaign`을 첫 인자로 넘긴다. `worldTurn` 화면의 통계 fallback도 아직 다음 원정이 시작되기 전 같은 정산 직후 상태만 사용한다. `u6-preview-data.ts`는 반드시 같은 `settleExpedition` 호출의 `execution.campaign`과 `execution.result`를 한 쌍으로 넘긴다. `campaign-render.test.tsx`는 `settled()`가 반환한 현재 `campaign`과 `last.settlement`을 함께 전달하고, 기존 모델 테스트도 같은 순서로 바꾼다.

`campaign-render.test.tsx`의 실제 정산 렌더 테스트에 다음 검증을 추가한다.

`countLivingZeroTrust`는 `@/lib/rules/ending`에서 import한다.

```ts
const view = createU6SettlementView(
  campaign,
  settlement,
  dungeon?.name ?? "",
  dungeon?.theme ?? "spider",
);
const markup = renderToStaticMarkup(createElement(U6SettlementScreen, {
  status: statusFor(campaign, null),
  settlement: view,
  onContinue: noop,
}));

expect(view.trustPressure?.afterCount ?? 0).toBe(countLivingZeroTrust(campaign));
expect(markup).toContain(settlement.causeChain.choice);
expect(markup).toContain(settlement.causeChain.reactions);
```

- [ ] **Step 10: 대상 테스트와 타입 검사를 실행한다**

Run:

```bash
pnpm vitest run components/game/u6-settlement-model.test.ts components/game/u6-preview-data.test.ts components/game/campaign-render.test.tsx
pnpm typecheck
```

Expected: 대상 테스트 PASS, typecheck 성공. 기존 U6 화면은 임시 호환 필드로 계속 렌더링된다.

- [ ] **Step 11: ViewModel 변경을 커밋한다**

```bash
git add components/game/u6-settlement-model.ts components/game/u6-settlement-model.test.ts components/game/CampaignScreen.tsx components/game/u6-preview-data.ts components/game/campaign-render.test.tsx
git commit -m "화면: 정산 결과 View를 구조화한다" -m "정복·전멸, 인물별 중대 상태, 신뢰 0 누적을 정산 뒤 캠페인에서 한 번만 분류한다."
```

---

### Task 3: 정산 화면을 결과·원인·인물·캠페인 변화로 재배치

**Files:**
- Modify: `components/game/U6SettlementScreen.tsx`
- Modify: `components/game/U6SettlementScreen.test.ts`
- Modify: `components/game/u6-settlement-model.ts`
- Modify: `components/game/u6-settlement-model.test.ts`

**Interfaces:**
- Consumes: Task 2의 `outcome`, `causes`, `members`, `dungeonOutcome`, `trustPressure`
- Produces: 고정 5단계와 `다녀온 사람`을 제거한 새 U6 정산 DOM

- [ ] **Step 1: 화면 테스트 fixture를 새 View로 교체한다**

```ts
const member = (over: Partial<U6SettlementMember> = {}): U6SettlementMember => ({
  id: "character-1",
  name: "실바나",
  classLabel: "마법사",
  portraitSrc: "/assets/characters/live/mage/mage_a.png",
  alive: true,
  diedThisExpedition: false,
  gravelyWounded: false,
  hp: { before: 24, after: 16, max: 24 },
  trust: {
    before: 53,
    after: 35,
    changed: true,
    isZero: false,
    becameZero: false,
    countsTowardCampaign: false,
  },
  ...over,
});

const BASE_MEMBERS: readonly U6SettlementMember[] = [
  member(),
  member({ id: "character-2", name: "카일" }),
  member({
    id: "character-3",
    name: "오스왈드",
    alive: false,
    diedThisExpedition: true,
    hp: { before: 28, after: 0, max: 28 },
  }),
];

const view = (over: Partial<U6SettlementView> = {}): U6SettlementView => ({
  dungeonName: "거미굴 3",
  themeId: "spider",
  outcome: {
    kind: "cleared",
    title: "거미굴 3 정복",
    summary: "2명 귀환 · 오스왈드 사망",
  },
  causes: [
    { kind: "choice", label: "마지막 조언", detail: "수상한 표식 두 건만 믿으라고 했다" },
    { kind: "reactions", label: "파티의 판단", detail: "실바나 수용 · 오스왈드 의심" },
  ],
  dungeonOutcome: { kind: "cleared" },
  members: BASE_MEMBERS,
  reputationDelta: 9,
  goldDelta: 19,
  relicGold: 0,
  nextReward: null,
  trustPressure: null,
  ...over,
});
```

- [ ] **Step 2: 정복과 중대 상태의 실패 테스트를 작성한다**

```ts
it("클리어는 정복과 사망자를 말하고 위험도 유지를 말하지 않는다", () => {
  const html = render();

  expect(html).toContain("거미굴 3 정복");
  expect(html).toContain("2명 귀환 · 오스왈드 사망");
  expect(html).toContain("게시판에서 제거됨");
  expect(html).not.toContain("위험도 유지");
  expect(html).not.toContain("생존 인원 비율만큼");
});

it("살아 있는 신뢰 0은 변화가 없어도 정체 발각과 출전 불가를 보여준다", () => {
  const html = render({
    members: [
      member({
        trust: {
          before: 0,
          after: 0,
          changed: false,
          isZero: true,
          becameZero: false,
          countsTowardCampaign: true,
        },
      }),
      ...BASE_MEMBERS.slice(1),
    ],
    trustPressure: {
      beforeCount: 1,
      afterCount: 1,
      threshold: 5,
      acceptModifier: 0,
      exposeModifier: 0,
      reachedThreshold: false,
    },
  });

  expect(html).toContain("신뢰 0");
  expect(html).toContain("정체 발각");
  expect(html).toContain("원정 출전 불가");
  expect(html).toContain("1 / 5");
});

it("사망자는 마지막 신뢰를 남기되 누적 원인으로 표시하지 않는다", () => {
  const html = render({
    members: [
      member({
        alive: false,
        diedThisExpedition: true,
        hp: { before: 24, after: 0, max: 24 },
        trust: {
          before: 8,
          after: 0,
          changed: true,
          isZero: true,
          becameZero: true,
          countsTowardCampaign: false,
        },
      }),
      ...BASE_MEMBERS.slice(1),
    ],
  });

  expect(html).toContain("사망 · HP 24 → 0");
  expect(html).toContain("마지막 신뢰 8 → 0");
  expect(html).not.toContain("이후 원정 출전 불가");
});
```

- [ ] **Step 3: 자원 출처 분리의 실패 테스트를 작성한다**

```ts
it("전멸은 계약 보상과 유품 골드를 분리한다", () => {
  const html = render({
    outcome: { kind: "wiped", title: "원정대 전멸", summary: "3명 전원 사망 · 계약 실패" },
    dungeonOutcome: { kind: "riskIncreased", before: 2, after: 3 },
    reputationDelta: -10,
    goldDelta: 0,
    relicGold: 84,
    nextReward: { reputation: 15, gold: 32 },
  });

  expect(html).toContain("계약 보상");
  expect(html).toContain("없음");
  expect(html).toContain("유품 골드");
  expect(html).toContain("+84");
  expect(html).toContain("★2");
  expect(html).toContain("★3");
});
```

- [ ] **Step 4: 새 화면 테스트가 기존 DOM 때문에 실패하는지 확인한다**

Run:

```bash
pnpm vitest run components/game/U6SettlementScreen.test.ts
```

Expected: 새 View 필드를 렌더링하지 않고 기존 `causeChain`, `survivors`를 사용하므로 FAIL.

- [ ] **Step 5: 결과 표제와 두 원인 요약을 구현한다**

```tsx
const CAUSE_ICON = {
  choice: `${ASSET}/stats/icon_advice.png`,
  reactions: `${ASSET}/stats/icon_trust.png`,
} as const;

function Outcome({ settlement }: { settlement: U6SettlementView }) {
  return (
    <header className="u6-outcome" data-testid="u6-outcome">
      <strong>{settlement.outcome.title}</strong>
      <small>{settlement.outcome.summary}</small>
    </header>
  );
}

function CauseSummary({ settlement }: { settlement: U6SettlementView }) {
  return (
    <section className="u6-cause-summary" aria-labelledby="u6-cause-summary-title">
      <h3 id="u6-cause-summary-title">선택과 판단</h3>
      <ul>
        {settlement.causes.map((cause) => (
          <li key={cause.kind}>
            <img src={CAUSE_ICON[cause.kind]} alt="" aria-hidden="true" />
            <span><strong>{cause.label}</strong><small>{cause.detail}</small></span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 6: 좌측 `원정대 결과`를 구현한다**

각 인물 행은 다음 문구 규칙을 지킨다.

```tsx
{member.diedThisExpedition ? (
  <strong>사망 · HP {member.hp.before} → {member.hp.after}</strong>
) : (
  <strong>
    {member.hp.before === member.hp.after
      ? `HP ${member.hp.after} / ${member.hp.max}`
      : `HP ${member.hp.before} → ${member.hp.after} / ${member.hp.max}`}
  </strong>
)}

{member.diedThisExpedition && member.trust.changed ? (
  <small>마지막 신뢰 {member.trust.before} → {member.trust.after}</small>
) : !member.diedThisExpedition && member.trust.isZero ? (
  <small>{member.trust.changed ? `신뢰 ${member.trust.before} → 0` : "신뢰 0"}</small>
) : !member.diedThisExpedition && member.trust.changed ? (
  <small>신뢰 {member.trust.before} → {member.trust.after}</small>
) : null}
```

별도 텍스트 배지는 다음 조건으로 만든다.

```tsx
{member.diedThisExpedition ? <em>사망</em> : null}
{member.gravelyWounded ? <em>중상</em> : null}
{member.trust.countsTowardCampaign ? <em>정체 발각 · 원정 출전 불가</em> : null}
```

- [ ] **Step 7: 우측 던전·자원·신뢰 누적을 구현한다**

던전 결과는 union을 완전 분기한다.

```tsx
function DungeonChange({ outcome }: { outcome: U6DungeonOutcome }) {
  if (outcome.kind === "cleared") {
    return <div className="u6-dungeon-change"><span>이 던전</span><strong>정복</strong><small>게시판에서 제거됨</small></div>;
  }
  if (outcome.kind === "riskCapped") {
    return <div className="u6-dungeon-change"><span>던전 위험도</span><strong>{riskStars(outcome.level)}</strong><small>최대 위험도라 더 오르지 않는다</small></div>;
  }
  return (
    <div className="u6-dungeon-change">
      <span>던전 위험도</span>
      <strong>{riskStars(outcome.before)} <span aria-hidden="true">→</span> {riskStars(outcome.after)}</strong>
      <small>실패로 위험도가 올랐다</small>
    </div>
  );
}
```

자원은 클리어의 `계약 골드`, 전멸의 `계약 보상 없음`, `relicGold > 0`의 `유품 골드`를 별도 `<dl>` 항목으로 만든다.

신뢰 누적 상세는 구조화된 보정값을 포맷한다.

```ts
function trustPressureDetail(pressure: U6TrustPressureView): string {
  if (pressure.reachedThreshold) return `누적 고발 기준 ${pressure.threshold}명에 도달했다`;
  if (pressure.afterCount === 0) return "살아 있는 신뢰 0 인물이 없어 누적 불이익이 해제됐다";
  if (pressure.acceptModifier !== 0 || pressure.exposeModifier !== 0) {
    const accept = `조언 수용 ${signed(pressure.acceptModifier)}`;
    const expose = pressure.exposeModifier === 0 ? null : `거짓 적발 ${signed(pressure.exposeModifier)}`;
    return [accept, expose].filter(Boolean).join(" · ");
  }
  return "신뢰 0 인물은 플레이어 원정에 출전할 수 없다";
}
```

- [ ] **Step 8: 새 컴포넌트를 `GameShell`에 연결한다**

좌측:

```tsx
<div className="u6-settlement-main">
  <Outcome settlement={settlement} />
  <CauseSummary settlement={settlement} />
  <PartyResults settlement={settlement} />
</div>
```

우측에는 `Changes`와 기존 CTA만 남긴다. 기존 우측 `Returned` 호출을 제거한다.

- [ ] **Step 9: 임시 호환 필드와 고정 5단계 타입을 제거한다**

`u6-settlement-model.ts`에서 `CAUSE_ORDER`, `U6CauseOrder`, `U6CauseStep`, `causeChain`, `survivors`, `riskBefore`, `riskAfter`, `riskCapped`를 삭제한다. 모델 테스트의 1~5단계 fixture도 삭제한다.

- [ ] **Step 10: 화면·모델 테스트와 타입 검사를 실행한다**

Run:

```bash
pnpm vitest run components/game/U6SettlementScreen.test.ts components/game/u6-settlement-model.test.ts
pnpm typecheck
```

Expected: 대상 테스트 PASS, typecheck 성공. 생산 화면에 legacy View 참조가 남지 않는다.

- [ ] **Step 11: 화면 의미 변경을 커밋한다**

```bash
git add components/game/U6SettlementScreen.tsx components/game/U6SettlementScreen.test.ts components/game/u6-settlement-model.ts components/game/u6-settlement-model.test.ts
git commit -m "화면: 정산의 영구 결과를 전면에 둔다" -m "정복과 전멸을 명시하고 선택·판단, 인물별 사망·중상·신뢰 0, 캠페인 변화를 중복 없이 배치한다."
```

---

### Task 4: 새 정보 위계에 맞게 CSS와 프리뷰 갱신

**Files:**
- Modify: `app/u6-result.css`
- Modify: `components/game/U6FixedCanvas.test.ts`
- Modify: `components/game/u6-preview-data.ts`
- Modify: `components/game/u6-preview-data.test.ts`

**Interfaces:**
- Consumes: Task 3의 `.u6-outcome`, `.u6-cause-summary`, `.u6-party-results`, `.u6-dungeon-change`, `.u6-trust-pressure`
- Produces: 고정 캔버스 안에서 세 인물과 캠페인 변화가 스크롤 없이 보이는 레이아웃 및 실제 규칙 프리뷰

- [ ] **Step 1: 현재 Next.js CSS 문서를 읽는다**

Run:

```bash
sed -n '1,260p' node_modules/next/dist/docs/01-app/01-getting-started/11-css.md
```

Expected: root layout의 전역 CSS import가 현재 Next.js에서 지원됨을 확인한다. import 구조는 바꾸지 않는다.

- [ ] **Step 2: 새 정산 격자의 실패 CSS 계약 테스트를 작성한다**

```ts
it("정산 본문은 결과·원인·원정대 결과 세 행을 쓴다", () => {
  const rule = css.match(/\.u6-settlement-main\s*\{([^}]*)\}/)?.[1] ?? "";
  expect(rule).toMatch(/grid-template-rows:\s*auto\s+auto\s+minmax\(0,\s*1fr\)/);
});

it("원정대 결과 목록은 세 인물을 세로로 담고 넘치지 않는다", () => {
  const rule = css.match(/\.u6-party-results__list\s*\{([^}]*)\}/)?.[1] ?? "";
  expect(rule).toMatch(/display:\s*grid/);
  expect(rule).toMatch(/grid-template-rows:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  expect(rule).toMatch(/min-height:\s*0/);
});

it("폐기한 다섯 단계와 다녀온 사람 선택자를 남기지 않는다", () => {
  expect(css).not.toContain("u6-cause__order");
  expect(css).not.toContain("u6-returned");
});
```

기존 CTA 내용 폭·우측 정렬 테스트는 유지한다.

- [ ] **Step 3: CSS 테스트가 실패하는지 확인한다**

Run:

```bash
pnpm vitest run components/game/U6FixedCanvas.test.ts
```

Expected: 새 목록과 3행 계약이 없고 폐기 선택자가 남아 있어 FAIL.

- [ ] **Step 4: 좌측 결과·원인·인물 격자를 구현한다**

핵심 규칙:

```css
.u6-settlement-main {
  grid-template-rows: auto auto minmax(0, 1fr);
}

.u6-outcome {
  display: grid;
  gap: 0.2rem;
  margin: 0;
}

.u6-cause-summary ul {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(0.4rem, 0.5cqw, 0.8rem);
  margin: 0;
  padding: 0;
  list-style: none;
}

.u6-party-results {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
}

.u6-party-results__list {
  display: grid;
  grid-template-rows: repeat(3, minmax(0, 1fr));
  gap: clamp(0.3rem, 0.4cqh, 0.55rem);
  min-height: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}
```

각 인물 행은 `portrait / who / state / flags` 네 열을 사용한다. `is-dead`, `is-exposed`, `is-gravely-wounded`는 서로 다른 border와 텍스트 배지를 가지며 `opacity`만으로 상태를 구분하지 않는다.

- [ ] **Step 5: 우측 캠페인 변화와 CTA 격자를 맞춘다**

```css
.u6-settlement-side {
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  height: 100%;
  min-height: 0;
}

.u6-trust-pressure {
  display: grid;
  gap: 0.2rem;
  padding: clamp(0.45rem, 0.55cqw, 0.8rem);
  border: 1px solid color-mix(in srgb, #a7654f 55%, var(--color-edge));
  background: rgb(35 18 14 / 72%);
}
```

`.u6-settlement-side .u6-settlement-continue { grid-row: 4; justify-self: end; text-align: center; }`는 유지한다. `.u6-cause-chain`, `.u6-cause`, `.u6-cause__order`, `.u6-cause__note`, `.u6-returned*`와 피해 문양 색 연계 선택자를 삭제한다.

- [ ] **Step 6: 부분 생존 프리뷰에 살아 있는 신뢰 0을 넣는다**

`settlement-partial`의 생존자 한 명을 `trust: 0`으로 만들고 다른 한 명은 생존, 세 번째 인물은 사망으로 유지한다. 신뢰 0은 사망자가 아니라 생존자에게 둔다.

- [ ] **Step 7: 프리뷰 테스트를 새 union과 인물 상태로 교체한다**

```ts
it("부분 생존 정산은 정복·사망·생존자 신뢰 0을 함께 담는다", () => {
  const partial = U6_PREVIEW_ENTRIES.find((entry) => entry.id === "settlement-partial")?.settlement;
  if (partial === undefined) throw new Error("부분 생존 프리뷰가 없다");

  expect(partial.outcome.kind).toBe("cleared");
  expect(partial.dungeonOutcome).toEqual({ kind: "cleared" });
  expect(partial.members.some((member) => member.diedThisExpedition)).toBe(true);
  expect(partial.members.some((member) => member.trust.countsTowardCampaign)).toBe(true);
  expect(partial.trustPressure?.afterCount).toBeGreaterThan(0);
});

it("전멸 정산은 사망자 셋과 위험도 상승을 담는다", () => {
  const wiped = U6_PREVIEW_ENTRIES.find((entry) => entry.id === "settlement-wipe")?.settlement;
  if (wiped === undefined) throw new Error("전멸 프리뷰가 없다");

  expect(wiped.outcome.kind).toBe("wiped");
  expect(wiped.members.every((member) => member.diedThisExpedition)).toBe(true);
  expect(wiped.dungeonOutcome.kind).toBe("riskIncreased");
  expect(wiped.members.some((member) => member.trust.countsTowardCampaign)).toBe(false);
});
```

기존 `causeChain` 피해 줄 테스트와 직접 `riskBefore/riskAfter/riskCapped` 검사는 삭제한다.

- [ ] **Step 8: CSS·프리뷰·화면 테스트를 실행한다**

Run:

```bash
pnpm vitest run components/game/U6FixedCanvas.test.ts components/game/U6SettlementScreen.test.ts components/game/u6-preview-data.test.ts
pnpm typecheck
```

Expected: 대상 테스트 PASS, typecheck 성공.

- [ ] **Step 9: 시각 구조와 프리뷰 변경을 커밋한다**

```bash
git add app/u6-result.css components/game/U6FixedCanvas.test.ts components/game/u6-preview-data.ts components/game/u6-preview-data.test.ts
git commit -m "화면: 정산 정보 위계를 시각적으로 정리한다" -m "선택과 판단을 압축하고 원정대 결과 세 행과 신뢰 누적을 고정 캔버스 안에 배치한다."
```

---

### Task 5: 정산 도메인에서 중복 UI 문장 제거

**Files:**
- Modify: `lib/domain/settlement.ts`
- Modify: `lib/domain/index.ts`
- Modify: `lib/rules/settlement.ts`
- Modify: `lib/rules/settlement.test.ts`
- Modify: `components/game/u6-settlement-model.ts`
- Modify: `components/game/u6-settlement-model.test.ts`
- Modify: `lib/rules/campaign-statistics.test.ts`
- Modify: `lib/rules/campaign-history.test.ts`
- Modify: `lib/store/campaign-reproducibility.test.ts`
- Modify: `components/game/campaign-render.test.tsx`

**Interfaces:**
- Consumes: 기존 `SettlementSnapshot.causeInputs`
- Produces: `SettlementResult.causeInputs: SettlementCauseInputs`; 삭제되는 `SettlementCauseChain`, `createCauseChain`, `SettlementResult.causeChain`

- [ ] **Step 1: UI 문장 제거의 실패 테스트를 작성한다**

```ts
it("정산 결과는 원정 근거만 보존하고 UI용 경제·캠페인 문장을 만들지 않는다", () => {
  const campaign = campaignFixture();
  const snapshot = snapshotFixture(campaign, {
    causeInputs: {
      choice: "마지막 조언",
      reactions: "파티의 판단",
      damage: "결정적 피해",
    },
  });

  const { result } = settleExpedition(campaign, snapshot);

  expect(result.causeInputs).toEqual(snapshot.causeInputs);
  expect(result).not.toHaveProperty("causeChain");
  expect(JSON.stringify(result)).not.toContain("던전 위험도");
});

it("memberChanges는 finalMembers 입력 순서와 무관하게 계약 파티 순서를 따른다", () => {
  const campaign = campaignFixture();
  const snapshot = snapshotFixture(campaign);
  const reversed = [...snapshot.finalMembers].reverse();

  const { result } = settleExpedition(campaign, {
    ...snapshot,
    finalMembers: reversed,
  });

  expect(result.memberChanges.map((change) => change.characterId)).toEqual(
    snapshot.party.memberIds,
  );
});
```

- [ ] **Step 2: 테스트가 `causeInputs` 부재로 실패하는지 확인한다**

Run:

```bash
pnpm vitest run lib/rules/settlement.test.ts
```

Expected: 첫 테스트는 `result.causeInputs`가 없고 `causeChain`이 남아 있어 FAIL하며, 순서 테스트는 현재 구현이 `finalMembers` 순서를 보존해 FAIL.

- [ ] **Step 3: 도메인 타입을 단일 원인 입력으로 바꾼다**

`SettlementCauseChain`을 삭제하고 `SettlementResult`의 마지막 필드를 다음으로 바꾼다.

```ts
readonly causeInputs: SettlementCauseInputs;
```

`SettlementCauseInputs`와 `SettlementSnapshot.causeInputs`는 유지한다.

`lib/domain/index.ts`의 type export 목록에서도 `SettlementCauseChain`을 제거하고 `SettlementCauseInputs`, `SettlementMemberChange`, `SettlementResult`, `SettlementSnapshot`은 유지한다.

- [ ] **Step 4: 정산 규칙에서 문장 생성기를 제거한다**

`lib/rules/settlement.ts`에서 `SettlementCauseChain` import와 `createCauseChain` 함수를 삭제한다. 먼저 최종 인물을 계약 파티 순서로 정렬한 뒤 이후 생존자, 유품, `memberChanges` 계산이 모두 그 배열을 사용하게 한다.

```ts
const finalById = new Map(snapshot.finalMembers.map((member) => [member.id, member] as const));
const finalMembers = snapshot.party.memberIds.map((id) => {
  const member = finalById.get(id);
  if (member === undefined) invalid("계약 파티원의 최종 상태가 없다", { characterId: id });
  return normalizedMember(member);
});
```

결과 생성에는 다음 원정 근거만 남긴다.

```ts
causeInputs: { ...snapshot.causeInputs },
```

보상, 위험도, 유품, 인물 변화 코드는 수정하지 않는다.

- [ ] **Step 5: U6 어댑터를 `causeInputs`로 연결한다**

```ts
const causes: readonly U6SettlementCause[] = [
  { kind: "choice", label: "마지막 조언", detail: settlement.causeInputs.choice },
  { kind: "reactions", label: "파티의 판단", detail: settlement.causeInputs.reactions },
];
```

- [ ] **Step 6: 정산 결과 literal fixture를 모두 갱신한다**

다음 파일의 `causeChain` 객체를 동일한 앞 세 값의 `causeInputs`로 바꾼다.

- `components/game/u6-settlement-model.test.ts`
- `lib/rules/campaign-statistics.test.ts`
- `lib/rules/campaign-history.test.ts`

```ts
causeInputs: {
  choice: "선택 내용",
  reactions: "반응 내용",
  damage: "피해 내용",
},
```

`economy`, `campaignChange` fixture는 삭제한다.

`lib/store/campaign-reproducibility.test.ts`의 실제 한 판 검증은 삭제하지 않고 다음처럼 새 필드로 이전한다.

```ts
expect(settlement.causeInputs.choice.length).toBeGreaterThan(0);
expect(settlement.causeInputs.reactions.length).toBeGreaterThan(0);
expect(settlement.causeInputs.damage.length).toBeGreaterThan(0);
expect(settlement.causeInputs.choice).not.toBe("조언을 고를 일이 없었다");
expect(settlement.causeInputs.choice).toContain("보스");
if (settlement.survivorIds.length === 0) {
  expect(settlement.causeInputs.damage).toContain("→ 0");
}
```

`components/game/campaign-render.test.tsx`는 선택과 반응이 화면에 남는지 확인하되, 제거된 `damage` 원인 카드를 기대하지 않는다.

```ts
expect(markup).toContain(settlement.causeInputs.choice);
expect(markup).toContain(settlement.causeInputs.reactions);
expect(markup).not.toContain("<strong>피해</strong>");
```

- [ ] **Step 7: 도메인·어댑터·통계·이력 테스트를 실행한다**

Run:

```bash
pnpm vitest run \
  lib/rules/settlement.test.ts \
  components/game/u6-settlement-model.test.ts \
  lib/rules/campaign-statistics.test.ts \
  lib/rules/campaign-history.test.ts \
  lib/store/campaign-reproducibility.test.ts \
  components/game/campaign-render.test.tsx
pnpm typecheck
```

Expected: 대상 테스트 PASS, typecheck 성공. 생산 코드와 도메인 export에서 `SettlementCauseChain`, `causeChain.economy`, `causeChain.campaignChange` 참조가 0건이고 실제 한 판의 원정 근거 검증은 `causeInputs`로 유지된다.

- [ ] **Step 8: 도메인 정리를 커밋한다**

```bash
git add lib/domain/settlement.ts lib/domain/index.ts lib/rules/settlement.ts lib/rules/settlement.test.ts components/game/u6-settlement-model.ts components/game/u6-settlement-model.test.ts lib/rules/campaign-statistics.test.ts lib/rules/campaign-history.test.ts lib/store/campaign-reproducibility.test.ts components/game/campaign-render.test.tsx
git commit -m "정산: 결과에서 화면 문장을 제거한다" -m "선택·반응·피해 원본만 보존하고 보상과 던전 변화는 구조화된 필드가 계속 소유하게 한다."
```

---

### Task 6: 규칙부터 화면까지 통합 검증하고 실제 캔버스 확인

**Files:**
- Create: `components/game/u6-settlement-integration.test.tsx`
- Verify: `components/game/U6SettlementScreen.tsx`
- Verify: `components/game/u6-settlement-model.ts`
- Verify: `app/u6-result.css`
- Verify: `components/game/u6-preview-data.ts`

**Interfaces:**
- Consumes: `settleExpedition → createU6SettlementView → U6SettlementScreen`
- Produces: 실제 규칙 결과가 클리어와 전멸 화면에서 정확히 읽힌다는 통합 증거

- [ ] **Step 1: 통합 테스트 helper를 작성한다**

```tsx
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CampaignState, Character, SettlementSnapshot } from "@/lib/domain";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { settleExpedition } from "@/lib/rules/settlement";
import { statusFor } from "./campaign-adapters";
import { U6SettlementScreen } from "./U6SettlementScreen";
import { createU6SettlementView } from "./u6-settlement-model";

function partyMembers(campaign: CampaignState): Character[] {
  const members: Character[] = [];
  const classes = new Set<string>();
  for (const id of campaign.pool.order) {
    const member = campaign.pool.byId[id];
    if (member === undefined || classes.has(member.classId)) continue;
    classes.add(member.classId);
    members.push(member);
    if (members.length === 3) break;
  }
  if (members.length !== 3) throw new Error("서로 다른 직업 셋이 없다");
  return members;
}

function renderResult(campaign: CampaignState, snapshot: SettlementSnapshot): string {
  const dungeon = campaign.dungeons.find((candidate) => candidate.id === snapshot.dungeonId);
  if (dungeon === undefined) throw new Error("정산 던전이 없다");
  const execution = settleExpedition(campaign, snapshot);
  return renderToStaticMarkup(createElement(U6SettlementScreen, {
    status: statusFor(execution.campaign, null),
    settlement: createU6SettlementView(
      execution.campaign,
      execution.result,
      dungeon.name,
      dungeon.theme,
    ),
  }));
}
```

- [ ] **Step 2: 2명 생환 클리어 통합 테스트를 작성한다**

```tsx
it("2명 생환 클리어가 정복·사망·생존자 신뢰 0을 보여준다", () => {
  const campaign = initializeCampaign("u6-integration-clear");
  const dungeon = campaign.dungeons[0]!;
  const [first, second, third] = partyMembers(campaign);
  if (first === undefined || second === undefined || third === undefined) throw new Error("파티가 없다");
  const finalMembers = [
    { ...first, hp: Math.max(1, first.hp - 5), trust: 0 },
    { ...second, hp: Math.max(1, second.hp - 3) },
    { ...third, hp: 0, alive: false },
  ];
  const html = renderResult(campaign, {
    expeditionId: "u6-integration-clear-expedition",
    dungeonId: dungeon.id,
    contractRisk: dungeon.riskLevel,
    party: { memberIds: [first.id, second.id, third.id] },
    finalMembers,
    status: "cleared",
    causeInputs: {
      choice: "수상한 표식 두 건만 믿으라고 했다",
      reactions: `${first.name} 수용 · ${second.name} 의심`,
      damage: `${third.name} HP ${third.hp} → 0`,
    },
  });

  expect(html).toContain(`${dungeon.name} 정복`);
  expect(html).toContain(`${third.name} 사망`);
  expect(html).toContain(`신뢰 ${first.trust} → 0`);
  expect(html).toContain("정체 발각");
  expect(html).toContain("1 / 5");
  expect(html).not.toContain("위험도 유지");
});
```

- [ ] **Step 3: 전멸 통합 테스트를 작성한다**

```tsx
it("전멸이 계약 보상 없음·유품·위험도 상승을 보여준다", () => {
  const campaign = initializeCampaign("u6-integration-wipe");
  const dungeon = campaign.dungeons.find((candidate) => candidate.riskLevel < 5)!;
  const members = partyMembers(campaign);
  const finalMembers = members.map((member) => ({ ...member, hp: 0, alive: false }));
  const html = renderResult(campaign, {
    expeditionId: "u6-integration-wipe-expedition",
    dungeonId: dungeon.id,
    contractRisk: dungeon.riskLevel,
    party: { memberIds: members.map((member) => member.id) },
    finalMembers,
    status: "wiped",
    causeInputs: {
      choice: "보스의 약점을 잘못 짚었다",
      reactions: "세 명 모두 조언을 따랐다",
      damage: finalMembers.map((member) => `${member.name} HP → 0`).join(" · "),
    },
  });

  expect(html).toContain("원정대 전멸");
  expect(html).toContain("계약 보상");
  expect(html).toContain("없음");
  expect(html).toContain("유품 골드");
  expect(html).toContain(`★${dungeon.riskLevel}`);
  expect(html).toContain(`★${dungeon.riskLevel + 1}`);
});
```

- [ ] **Step 4: 통합 테스트를 실행한다**

Run:

```bash
pnpm vitest run components/game/u6-settlement-integration.test.tsx
```

Expected: 두 테스트 PASS.

- [ ] **Step 5: 통합 테스트를 커밋한다**

```bash
git add components/game/u6-settlement-integration.test.tsx
git commit -m "검증: 정산 규칙과 화면을 함께 확인한다" -m "실제 클리어와 전멸 결과가 정복, 사망, 신뢰 0, 유품, 위험도 변화를 정확히 렌더링하는지 고정한다."
```

- [ ] **Step 6: 전체 자동 검사를 실행한다**

Run:

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
git diff --check origin/main...HEAD
```

Expected: 전체 단위 테스트 PASS, lint 오류 0개, typecheck 성공, production build 성공, diff 공백 오류 없음.

- [ ] **Step 7: 폐기된 문구와 필드를 검색한다**

Run:

```bash
rg -n "던전 위험도 .*유지|SettlementCauseChain|causeChain|u6-returned|u6-cause__order" \
  app components lib docs/experience docs/technical
```

Expected: 현재 구현, 도메인 export, 테스트 fixture, 공식 문서에서 0건. 이전 설계·계획 기록인 `docs/superpowers/`는 역사 자료이므로 검색 범위에서 제외한다.

- [ ] **Step 8: 개발 서버를 실행한다**

Run:

```bash
pnpm dev
```

Expected: Next.js 개발 서버가 로컬 주소를 출력하고 `/u6-test`, `/campaign`을 제공한다.

- [ ] **Step 9: `/u6-test`의 정산 세 상태를 확인한다**

Open: `http://localhost:3000/u6-test`

Verify:

- `settlement-partial`: 정복, 귀환자 수, 사망자 이름, 살아 있는 신뢰 0, 누적 효과가 보이고 `던전 위험도 유지`가 없다.
- `settlement-wipe`: 전멸, 세 사망자, 계약 보상 없음, 명성 손실, 유품 골드, 위험도 전후, 재도전 보상이 보인다.
- `settlement-promotion`: ★5 클리어가 정복으로 보이고 위험도 상한 실패처럼 보이지 않는다. 상단 승급 가능 표시는 유지되고 우측에 승급 제어가 중복되지 않는다.
- 세 상태 모두 스크롤, 잘림, 겹침, 콘솔 오류가 없다.

- [ ] **Step 10: 실제 `/campaign` 정산 경로를 확인한다**

Open: `http://localhost:3000/campaign`

Verify:

- 진행 화면의 마지막 조언과 파티 반응이 정산에 이어진다.
- 인물 HP·신뢰 전후가 실제 최종 상태와 일치한다.
- 클리어면 정복과 게시판 제거, 전멸이면 위험도 상승이 표시된다.
- `길드로 돌아간다`가 우측 최하단의 내용 폭 버튼으로 남고 기존 월드턴·게시판 흐름이 정상 진행된다.
- 고정 캔버스에서 화면 잘림, 스크롤, 겹침, 콘솔 오류, Next.js 오류 오버레이가 없다.

- [ ] **Step 11: 브랜치 범위를 최종 확인한다**

Run:

```bash
git status --short --branch
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
```

Expected: 작업 트리가 깨끗하고 공식 문서, ViewModel, 화면, CSS, 도메인 정리, 통합 테스트 커밋만 존재한다.

---

### Task 7: 원정대 결과를 3열 세로형 카드로 확장

**Files:**
- Modify: `docs/experience/SCREEN_LAYOUT.md`
- Modify: `docs/superpowers/specs/2026-08-25-lattebun-u6-settlement-information-hierarchy-design.md`
- Modify: `components/game/U6FixedCanvas.test.ts`
- Modify: `components/game/U6SettlementScreen.test.ts`
- Modify: `components/game/U6SettlementScreen.tsx`
- Modify: `app/u6-result.css`

**Interfaces:**
- Consumes: 기존 `U6SettlementMember`와 공용 파티 카드의 `--party-portrait-height` 크기 계약
- Produces: 생환·부분 사망·전멸 모두 같은 3열 세로형 인물 카드 레이아웃

- [ ] **Step 1: CSS 계약 테스트를 먼저 교체한다**

`U6FixedCanvas.test.ts`에서 세로 3행 기대를 제거하고, 목록이 `repeat(3, minmax(0, 1fr))` 3열이며 각 카드가 `portrait / who / state / badges`의 세로 흐름을 사용하는지 검증한다. 초상은 카드 폭을 채우고 높이가 공용 파티 상태 카드와 같은 `clamp(5.5rem, 8.6cqw, 11.5rem)` 범위를 쓰는지 확인한다.

- [ ] **Step 2: 화면 테스트에 공통 카드 구조를 고정한다**

생환자가 있는 결과와 전멸 결과가 모두 세 인물을 같은 카드 markup으로 렌더하고, 이름·직업·HP·신뢰·사망·중상·정체 발각 문구와 계약 파티 순서를 유지하는지 확인한다.

- [ ] **Step 3: 실패를 확인한 뒤 3열 카드를 구현한다**

`u6-party-results__list`를 한 행의 3열 grid로 바꾸고 각 `li`를 세로형 카드로 만든다. 직사각형 초상은 카드 폭 전체와 공용 파티 상태 카드 수준의 높이를 사용하고 `object-fit: cover`, 얼굴 중심의 `object-position`을 적용한다. 이름·상태 글씨를 기존보다 키우며 배지는 카드 하단에 둔다. 새 보상·위험도 정보는 추가하지 않는다.

- [ ] **Step 4: 자동 검증과 실제 프리뷰 확인을 수행한다**

Run:

```bash
pnpm vitest run components/game/U6FixedCanvas.test.ts components/game/U6SettlementScreen.test.ts components/game/u6-settlement-integration.test.tsx
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

`/u6-test`의 부분 생환·전멸·★5 정복 세 상태에서 1920×1080 고정 캔버스의 카드 잘림, 글자 겹침, 스크롤을 확인한다.

- [ ] **Step 5: 변경을 커밋하고 PR을 갱신한다**

```bash
git add docs/experience/SCREEN_LAYOUT.md docs/superpowers/specs/2026-08-25-lattebun-u6-settlement-information-hierarchy-design.md docs/superpowers/plans/2026-08-25-lattebun-u6-settlement-information-hierarchy.md components/game/U6FixedCanvas.test.ts components/game/U6SettlementScreen.test.ts components/game/U6SettlementScreen.tsx app/u6-result.css
git commit -m "화면: 정산 인물 카드를 세로형으로 확장한다" -m "세 인물의 직사각형 초상과 상태 정보를 3열 카드로 키워 생환과 전멸 결과의 빈 공간을 줄인다."
```
