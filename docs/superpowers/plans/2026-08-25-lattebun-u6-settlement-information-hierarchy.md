# U6 정산 정보 위계 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** U6 정산 화면이 정복·전멸을 정확히 구분하고, 사망·중상·신뢰 0과 캠페인 누적 효과를 중복 없이 보여주게 한다.

**Architecture:** 정산 규칙은 구조화된 상태와 수치 및 원정 근거만 반환한다. `createU6SettlementView`가 정산 뒤 `CampaignState`와 `SettlementResult`를 받아 결과 표제, 인물 상태, 던전 결과, 신뢰 0 누적을 화면용 union으로 한 번만 분류하고, `U6SettlementScreen`은 그 View를 좌측 결과·원인·인물과 우측 캠페인 변화로 배치한다.

**Tech Stack:** Next.js 16.3.0 App Router, React 19.2.8, TypeScript 5.x, Zustand 5.0.14, CSS Grid, Vitest 4.1.10, Playwright 1.62.1, Node.js 24.19.0, pnpm 11.21.0

**Spec:** `docs/superpowers/specs/2026-08-25-lattebun-u6-settlement-information-hierarchy-design.md`

## Global Constraints

- 정산 보상, 명성 손실, 위험도 상승, 유품 회수, 신뢰 판정, 신뢰 0 누적 보정 수치는 바꾸지 않는다.
- 클리어는 `정복`과 `게시판에서 제거됨`으로 표시하며 화면 어디에도 `던전 위험도 유지`를 만들지 않는다.
- 전멸에서만 위험도 전후 또는 ★5 상한을 표시한다.
- 살아 있는 신뢰 0 인물은 신뢰 변화량이 0이어도 항상 표시한다.
- 사망자의 `trust === 0`은 살아 있는 신뢰 0 누적에 포함하지 않는다.
- 계약 골드와 유품 골드를 합쳐 표시하지 않는다.
- 승급 가능 여부는 상단 상태 바가 계속 소유하며 정산 패널에 중복하지 않는다.
- `길드로 돌아간다` 문구, callback, 내용 폭, 우측 최하단 배치를 유지한다.
- 새 패키지와 새 이미지 에셋을 추가하지 않는다.
- 1920×1080 고정 캔버스, 3:2 셸, 공용 상태 바를 유지한다.
- 캔버스 내부에 `vw`, `vh`, 화면별 미디어 쿼리를 추가하지 않는다.
- CSS 작업 전에 `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`를 끝까지 읽는다.
- 커밋 제목과 본문은 모두 한글로 작성한다.

## File Map

| 파일 | 책임 |
| --- | --- |
| `docs/experience/SCREEN_LAYOUT.md` | 정산 좌우 정보 위계의 공식 화면 계약 |
| `docs/experience/ONBOARDING_AND_INTERFACE.md` | 플레이어가 정산에서 읽는 순서와 피드백 계약 |
| `docs/technical/SCREEN_ADAPTER_CONTRACT.md` | 실제 C4 결과와 U6 ViewModel의 인수인계 경계 |
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
| `lib/rules/settlement.ts` | 구조화된 정산 계산과 원정 근거 보존 |
| `lib/rules/settlement.test.ts` | 정산 원인 입력 보존과 기존 계산 회귀 |
| `lib/rules/campaign-statistics.test.ts` | 변경된 `SettlementResult` fixture 갱신 |
| `lib/rules/campaign-history.test.ts` | 변경된 `SettlementResult` fixture 갱신 |
| `components/game/u6-settlement-integration.test.tsx` | 규칙 → 어댑터 → 화면 전체 경로 검증 |

---

## Execution Preflight: 최신 main 통합

- [ ] **Step 1: 구현용 격리 worktree를 만든다**

Use: `superpowers:using-git-worktrees`

Expected: 현재 작업 디렉터리와 분리된 worktree에서 `spec/u6-settlement-information-hierarchy` 브랜치를 체크아웃한다.

- [ ] **Step 2: 최신 main을 통합한다**

Run:

```bash
git fetch origin main
git merge origin/main -m "병합: 최신 main 변경을 반영한다" -m "U6 정산 정보 위계 설계와 계획을 유지하면서 선행 변경을 통합한다."
```

Expected: 충돌 없이 병합되거나, U6 관련 충돌에서 main의 최신 기능과 이 설계의 정산 계약을 모두 보존한다.

- [ ] **Step 3: 기준 검사를 실행한다**

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
- Modify: `docs/experience/SCREEN_LAYOUT.md`의 `### 정산·엔딩`
- Modify: `docs/experience/ONBOARDING_AND_INTERFACE.md`의 `## 보스전과 정산`
- Modify: `docs/technical/SCREEN_ADAPTER_CONTRACT.md`의 `## U6 정산·엔딩 ← C4 · C6 · C8`
- Modify: `docs/README.md`의 `## 이번 개편 설계`

**Interfaces:**
- Consumes: 설계 문서의 4질문 정보 위계와 `createU6SettlementView(campaignAfterSettlement, settlement, dungeonName, themeId)` 계약
- Produces: 이후 모든 구현 Task가 따라야 하는 공식 화면·어댑터 문서

- [ ] **Step 1: `SCREEN_LAYOUT.md`의 정산 부분을 새 좌우 구조로 교체한다**

`### 정산·엔딩`의 정산 설명을 다음 내용으로 바꾼다. 엔딩 설명이 별도로 있다면 보존한다.

```markdown
### 정산·엔딩

정산 왼쪽은 `원정 결과 표제 → 마지막 조언과 파티의 판단 → 원정대 결과 3인` 순으로 읽힌다. 고정된 다섯 단계와 번호는 사용하지 않는다. 피해 수치와 신뢰 변화는 인물별 결과에, 보상과 던전 변화는 우측 캠페인 변화에 한 번만 둔다.

클리어는 던전 이름과 `정복`, 귀환 인원과 사망자 이름을 표시한다. 클리어한 던전은 게시판에서 제거되므로 위험도 유지 여부를 표시하지 않는다. 전멸에서만 위험도 전후 또는 ★5 상한과 재도전 보상을 보여준다.

정산 오른쪽은 던전 결과, 명성, 계약 골드, 전멸 유품 골드, 살아 있는 신뢰 0 누적과 현재 보정만 보여준다. 살아 있는 신뢰 0 인물은 변화량이 없어도 `정체 발각`과 `원정 출전 불가`를 표시하며, 사망자는 신뢰 0 누적에서 제외한다. 승급 가능 여부는 상단 상태 바가 계속 알리고 정산 패널에 중복하지 않는다.

정산을 마치고 게시판으로 돌아가는 CTA는 우측 패널의 최하단에 둔다. 다른 화면의 다음 단계 CTA와 같은 높이·글자 크기·좌우 여백을 사용하되, 패널 전체 폭으로 늘리지 않고 문구에 필요한 내용 폭으로 우측 정렬한다.
```

- [ ] **Step 2: `ONBOARDING_AND_INTERFACE.md`의 정산 표시 순서를 교체한다**

기존 1~7 목록을 다음 내용으로 교체한다.

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

기존 `승급은 자동으로 일어나지 않는다` 문단은 그대로 둔다.

- [ ] **Step 3: `SCREEN_ADAPTER_CONTRACT.md`의 U6 정산 경계를 현재 구현 상태로 갱신한다**

U6 정산 subsection을 다음 계약으로 바꾼다.

```markdown
### `U6SettlementView` — C4 정산과 C6 신뢰 누적

U6 정산은 fixture가 아니라 실제 `SettlementResult`와 정산 뒤 `CampaignState`를 소비한다. 규칙은 보상·유품·위험도·인물 전후 상태와 원정 근거를 구조화된 값으로 내고, 어댑터가 화면용 결과 표제와 상태 union을 만든다.

```ts
createU6SettlementView(
  campaignAfterSettlement: CampaignState,
  settlement: SettlementResult,
  dungeonName: string,
  themeId: ThemeId,
): U6SettlementView
```

화면은 생존자 수로 클리어·전멸을 재판정하지 않는다. `SettlementResult.status`를 보존한 `outcome.kind`와 `dungeonOutcome`을 사용한다. 살아 있는 신뢰 0 정산 전후 인원은 정산 뒤 캠페인과 `memberChanges.before`로 만들며, 현재 보정은 C6의 `getCampaignTrustModifier`를 그대로 옮긴다.
```

- [ ] **Step 4: `docs/README.md`에 설계와 계획을 색인한다**

`## 이번 개편 설계` 목록 상단에 다음 두 줄을 추가한다.

```markdown
- [U6 정산 정보 위계 개선 설계](superpowers/specs/2026-08-25-lattebun-u6-settlement-information-hierarchy-design.md): 정복·전멸, 인물별 영구 상태, 신뢰 0 누적, 캠페인 변화를 중복 없이 보여주는 정산 화면 계약
- [U6 정산 정보 위계 개선 구현 계획](superpowers/plans/2026-08-25-lattebun-u6-settlement-information-hierarchy.md): 공식 문서부터 ViewModel, 화면, 도메인 정리, 통합 검증까지의 테스트 우선 구현 순서
```

- [ ] **Step 5: 문서 검사를 실행한다**

Run:

```bash
pnpm vitest run docs/DOCUMENT_LINKS.test.ts docs/DOCUMENT_TERMINOLOGY.test.ts
```

Expected: 문서 링크와 용어 검사 모두 PASS.

- [ ] **Step 6: 공식 문서 변경을 커밋한다**

```bash
git add docs/README.md docs/experience/SCREEN_LAYOUT.md docs/experience/ONBOARDING_AND_INTERFACE.md docs/technical/SCREEN_ADAPTER_CONTRACT.md
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
- Consumes: 현재 `SettlementResult`, 정산 뒤 `CampaignState`, `countLivingZeroTrust`, `getCampaignTrustModifier`, `DENOUNCE_THRESHOLD`
- Produces: `U6SettlementOutcome`, `U6SettlementCause`, `U6DungeonOutcome`, `U6TrustPressureView`, 확장된 `U6SettlementMember`, 새 4인자 `createU6SettlementView`
- Temporary compatibility: 현재 화면이 사용하는 `causeChain`, `survivors`, `riskBefore`, `riskAfter`, `riskCapped`는 Task 3에서 화면 전환이 끝날 때까지 한 Task 동안 유지한다.

- [ ] **Step 1: 결과 분류와 신뢰 누적의 실패 테스트를 작성한다**

`components/game/u6-settlement-model.test.ts`에 다음 helper와 테스트를 추가한다. 기존 `result()` helper는 현재 `SettlementResult.causeChain`을 유지한다.

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
  return members;
}

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
  const settlementResult = result({
    status: "cleared",
    survivorCount: 2,
    survivorIds: [first.id, second.id],
    memberChanges: afterMembers.map((after, index) => ({
      characterId: after.id,
      before: [first, second, third][index],
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

it("살아 있는 신뢰 0의 전후 인원과 현재 보정을 만든다", () => {
  const campaign = initializeCampaign("u6-zero-trust-view");
  const [first, second, third] = distinctMembers(campaign);
  const existingZero = { ...campaign.pool.byId[campaign.pool.order[10]], trust: 0, alive: true };
  const beforeById = { ...campaign.pool.byId, [existingZero.id]: existingZero };
  const beforeCampaign = { ...campaign, pool: { ...campaign.pool, byId: beforeById } };
  const afterFirst = { ...first, trust: 0 };
  const afterById = { ...beforeById, [afterFirst.id]: afterFirst };
  const afterCampaign = { ...beforeCampaign, pool: { ...beforeCampaign.pool, byId: afterById } };
  const settlementResult = result({
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

it("사망한 신뢰 0 인물은 누적에서 제외한다", () => {
  const campaign = initializeCampaign("u6-dead-zero-trust");
  const [first, second, third] = distinctMembers(campaign);
  const beforeFirst = { ...first, trust: 0 };
  const beforeById = { ...campaign.pool.byId, [first.id]: beforeFirst };
  const beforeCampaign = { ...campaign, pool: { ...campaign.pool, byId: beforeById } };
  const deadFirst = { ...beforeFirst, hp: 0, alive: false };
  const afterById = { ...beforeById, [first.id]: deadFirst };
  const afterCampaign = { ...beforeCampaign, pool: { ...beforeCampaign.pool, byId: afterById } };
  const settlementResult = result({
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

- [ ] **Step 2: 테스트가 새 시그니처와 타입 부재로 실패하는지 확인한다**

Run:

```bash
pnpm vitest run components/game/u6-settlement-model.test.ts
```

Expected: `createU6SettlementView`의 첫 인자와 `outcome`, `dungeonOutcome`, `trustPressure`, 인물 신뢰 플래그가 없어서 FAIL.

- [ ] **Step 3: 새 View 타입을 추가한다**

`components/game/u6-settlement-model.ts`에 설계와 동일한 타입을 추가한다.

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

`U6SettlementView`에 다음 필드를 추가한다.

```ts
readonly outcome: U6SettlementOutcome;
readonly causes: readonly U6SettlementCause[];
readonly dungeonOutcome: U6DungeonOutcome;
readonly trustPressure: U6TrustPressureView | null;
```

- [ ] **Step 4: 정산 전 신뢰 0 인원을 복원하는 helper를 구현한다**

같은 파일에 다음 helper를 둔다.

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

정산 뒤 인원은 `countLivingZeroTrust(campaignAfterSettlement)`, 현재 보정은 `getCampaignTrustModifier(campaignAfterSettlement)`, 기준은 `DENOUNCE_THRESHOLD`를 사용한다. 새 수치표를 만들지 않는다.

- [ ] **Step 5: 결과·던전·인물 View 생성 helper를 구현한다**

다음 helper를 추가한다.

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
      : `${settlement.survivorCount}명 귀환 · ${deadNames.join(" · ")} 사망`,
  };
}

function dungeonOutcomeFor(settlement: SettlementResult): U6DungeonOutcome {
  if (settlement.status === "cleared") return { kind: "cleared" };
  if (settlement.riskCapped) return { kind: "riskCapped", level: settlement.riskAfter };
  return { kind: "riskIncreased", before: settlement.riskBefore, after: settlement.riskAfter };
}
```

인물 매핑은 다음 플래그를 계산한다.

```ts
const alive = after.alive;
const isZero = after.trust === TRUST_MIN;
return {
  id: String(after.id),
  name: after.name,
  classLabel: classLabel(after.classId),
  portraitSrc: portraitSrcForCharacter({ id: after.id, classId: after.classId, alive }),
  alive,
  diedThisExpedition: before.alive && !after.alive,
  gravelyWounded: after.gravelyWounded,
  hp: { before: before.hp, after: after.hp, max: after.maxHp },
  trust: {
    before: before.trust,
    after: after.trust,
    changed: before.trust !== after.trust,
    isZero,
    becameZero: before.trust > TRUST_MIN && isZero,
    countsTowardCampaign: alive && isZero,
  },
};
```

- [ ] **Step 6: 어댑터 시그니처와 반환값을 확장한다**

함수 시그니처를 다음으로 바꾼다.

```ts
export function createU6SettlementView(
  campaignAfterSettlement: CampaignState,
  settlement: SettlementResult,
  dungeonName: string,
  themeId: ThemeId,
): U6SettlementView
```

`causes`는 현재 도메인 필드에서 다음 두 개만 만든다.

```ts
const causes: readonly U6SettlementCause[] = [
  { kind: "choice", label: "마지막 조언", detail: settlement.causeChain.choice },
  { kind: "reactions", label: "파티의 판단", detail: settlement.causeChain.reactions },
];
```

`trustPressure`는 정산 전후가 모두 0일 때만 `null`로 둔다.

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

기존 화면 호환 필드는 이 Task에서 유지한다.

- [ ] **Step 7: 실제 호출부를 새 시그니처로 바꾼다**

`components/game/CampaignScreen.tsx`:

```ts
settlement={createU6SettlementView(
  campaign,
  shownSettlement,
  dungeon?.name ?? "",
  dungeon?.theme ?? "spider",
)}
```

`components/game/u6-preview-data.ts`의 `settlementFor`:

```ts
view: createU6SettlementView(
  execution.campaign,
  execution.result,
  dungeon.name,
  dungeon.theme satisfies ThemeId,
),
```

`components/game/campaign-render.test.tsx`와 기존 모델 테스트의 모든 호출도 첫 인자로 정산 뒤 캠페인을 넘긴다.

- [ ] **Step 8: 대상 테스트와 타입 검사를 실행한다**

Run:

```bash
pnpm vitest run components/game/u6-settlement-model.test.ts components/game/u6-preview-data.test.ts components/game/campaign-render.test.tsx
pnpm typecheck
```

Expected: 대상 테스트 PASS, typecheck 성공. 기존 U6 화면은 호환 필드로 그대로 렌더링된다.

- [ ] **Step 9: ViewModel 변경을 커밋한다**

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

- [ ] **Step 1: 화면 의미 테스트 fixture를 새 View로 교체한다**

`components/game/U6SettlementScreen.test.ts`의 `view()` 기본값을 다음 구조로 바꾼다.

```ts
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
  members: [],
  reputationDelta: 9,
  goldDelta: 19,
  relicGold: 0,
  nextReward: null,
  trustPressure: null,
  ...over,
});
```

기존 `CAUSE_ORDER`, `causeChain`, `survivors`, `riskBefore`, `riskAfter`, `riskCapped` fixture를 제거한다.

- [ ] **Step 2: 실패하는 핵심 화면 테스트를 작성한다**

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
    members: [member({
      trust: {
        before: 0,
        after: 0,
        changed: false,
        isZero: true,
        becameZero: false,
        countsTowardCampaign: true,
      },
    })],
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

it("이번 원정에서 신뢰 0이 된 생존자를 강조한다", () => {
  const html = render({
    members: [member({
      trust: {
        before: 11,
        after: 0,
        changed: true,
        isZero: true,
        becameZero: true,
        countsTowardCampaign: true,
      },
    })],
  });

  expect(html).toContain("신뢰 11 → 0");
  expect(html).toContain("정체 발각");
});

it("사망자는 HP와 마지막 신뢰 변화만 남기고 누적 원인으로 표시하지 않는다", () => {
  const html = render({
    members: [member({
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
    })],
  });

  expect(html).toContain("사망 · HP 24 → 0");
  expect(html).toContain("마지막 신뢰 8 → 0");
  expect(html).not.toContain("이후 원정 출전 불가");
});

it("전멸은 계약 보상과 유품 골드를 분리한다", () => {
  const html = render({
    outcome: { kind: "wiped", title: "원정대 전멸", summary: "3명 전원 사망 · 계약 실패" },
    dungeonOutcome: { kind: "riskIncreased", before: 2, after: 3 },
    reputationDelta: -10,
    goldDelta: 0,
    relicGold: 84,
    nextReward: { reputation: 15, gold: 32 },
  });

  expect(html).toContain("계약 보상 없음");
  expect(html).toContain("유품 골드");
  expect(html).toContain("+84");
  expect(html).toContain("★2");
  expect(html).toContain("★3");
});
```

`member()` helper의 기본값에는 `diedThisExpedition`, `gravelyWounded`, 확장된 `trust` 필드를 모두 넣는다.

- [ ] **Step 3: 테스트가 기존 5단계 화면에서 실패하는지 확인한다**

Run:

```bash
pnpm vitest run components/game/U6SettlementScreen.test.ts
```

Expected: 새 View 필드를 렌더링하지 않고 기존 `causeChain`, `survivors`를 찾으므로 FAIL.

- [ ] **Step 4: 결과 표제와 원인 요약 컴포넌트를 구현한다**

기존 `CauseChain`과 `CAUSE_ICON` 1~5 매핑을 제거하고 다음 두 컴포넌트를 둔다.

```tsx
const CAUSE_ICON = {
  choice: `${ASSET}/stats/icon_advice.png`,
  reactions: `${ASSET}/stats/icon_trust.png`,
} as const;

function Outcome({ settlement }: { settlement: U6SettlementView }) {
  return (
    <header className={`u6-outcome is-${outcomeTone(settlement.outcome.kind, settlement.members)}`} data-testid="u6-outcome">
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

`outcomeTone`은 `outcome.kind === "wiped"`면 `lost`, 사망자가 있으면 `costly`, 그 외 `whole`을 반환한다. 생존자 수로 상태를 판정하지 않는다.

- [ ] **Step 5: `원정대 결과`를 좌측 본문에 구현한다**

기존 `Returned`를 다음 의미로 교체한다.

```tsx
function PartyResults({ settlement }: { settlement: U6SettlementView }) {
  return (
    <section className="u6-party-results" aria-labelledby="u6-party-results-title">
      <h3 id="u6-party-results-title">원정대 결과</h3>
      <ul className="u6-party-results__list">
        {settlement.members.map((member) => (
          <li
            key={member.id}
            className={[
              member.diedThisExpedition ? "is-dead" : "",
              member.trust.countsTowardCampaign ? "is-exposed" : "",
              member.gravelyWounded ? "is-gravely-wounded" : "",
            ].filter(Boolean).join(" ")}
          >
            <img src={member.portraitSrc} alt="" aria-hidden="true" />
            <span className="u6-party-results__who">
              <strong>{member.name}</strong>
              <small>{member.classLabel}</small>
            </span>
            <span className="u6-party-results__state">
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
                <small>
                  {member.trust.changed ? `신뢰 ${member.trust.before} → 0` : "신뢰 0"}
                </small>
              ) : !member.diedThisExpedition && member.trust.changed ? (
                <small>신뢰 {member.trust.before} → {member.trust.after}</small>
              ) : null}
            </span>
            <span className="u6-party-results__flags">
              {member.diedThisExpedition ? <em>사망</em> : null}
              {member.gravelyWounded ? <em>중상</em> : null}
              {member.trust.countsTowardCampaign ? <em>정체 발각 · 원정 출전 불가</em> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

사망자는 `countsTowardCampaign`이 거짓이므로 출전 불가 문구가 나오지 않는다.

- [ ] **Step 6: 우측 캠페인 변화와 신뢰 누적을 구현한다**

던전 결과는 union으로 분기한다.

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

자원은 다음처럼 출처를 나눈다.

```tsx
<dl className="u6-deltas">
  <div><dt>명성</dt><dd>{signed(settlement.reputationDelta)}</dd></div>
  {settlement.outcome.kind === "cleared" ? (
    <div><dt>계약 골드</dt><dd>{signed(settlement.goldDelta)}</dd></div>
  ) : (
    <div><dt>계약 보상</dt><dd>없음</dd></div>
  )}
  {settlement.relicGold > 0 ? (
    <div><dt>유품 골드</dt><dd>{signed(settlement.relicGold)}</dd></div>
  ) : null}
</dl>
```

신뢰 누적 문구 helper는 구조화된 값을 그대로 포맷한다.

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

전후 수가 다르면 `1 → 2 / 5`, 같으면 `2 / 5`를 표시한다.

- [ ] **Step 7: 좌우 배치를 새 컴포넌트로 연결한다**

`GameShell.main`은 다음 순서를 사용한다.

```tsx
<div className="u6-settlement-main">
  <Outcome settlement={settlement} />
  <CauseSummary settlement={settlement} />
  <PartyResults settlement={settlement} />
</div>
```

`rightPanel`에서는 `Changes`와 CTA만 남긴다. 기존 우측 `Returned` 호출을 제거한다.

- [ ] **Step 8: ViewModel의 임시 호환 필드를 제거한다**

`components/game/u6-settlement-model.ts`에서 다음을 삭제한다.

- `CAUSE_ORDER`
- `U6CauseOrder`
- `U6CauseStep`
- `causeChain`
- `survivors`
- `riskBefore`
- `riskAfter`
- `riskCapped`

`components/game/u6-settlement-model.test.ts`의 1~5단계 테스트와 legacy fixture도 삭제하고 새 union과 `outcome` 테스트만 남긴다.

- [ ] **Step 9: 화면·모델 테스트와 타입 검사를 실행한다**

Run:

```bash
pnpm vitest run components/game/U6SettlementScreen.test.ts components/game/u6-settlement-model.test.ts
pnpm typecheck
```

Expected: 화면과 모델 테스트 PASS, typecheck 성공. `U6SettlementScreen.tsx`에 `survivors`, `causeChain`, `riskBefore`, `riskAfter`, `riskCapped` 참조가 남지 않는다.

- [ ] **Step 10: 화면 의미 변경을 커밋한다**

```bash
git add components/game/U6SettlementScreen.tsx components/game/U6SettlementScreen.test.ts components/game/u6-settlement-model.ts components/game/u6-settlement-model.test.ts
git commit -m "화면: 정산의 영구 결과를 전면에 둔다" -m "정복과 전멸을 명시하고 선택·판단, 인물별 사망·중상·신뢰 0, 캠페인 변화를 중복 없이 배치한다."
```

---

### Task 4: 새 정보 위계에 맞게 CSS와 프리뷰를 갱신

**Files:**
- Modify: `app/u6-result.css`
- Modify: `components/game/U6FixedCanvas.test.ts`
- Modify: `components/game/u6-preview-data.ts`
- Modify: `components/game/u6-preview-data.test.ts`

**Interfaces:**
- Consumes: Task 3의 `.u6-outcome`, `.u6-cause-summary`, `.u6-party-results`, `.u6-dungeon-change`, `.u6-trust-pressure`
- Produces: 고정 캔버스 안에서 세 인물과 캠페인 변화가 스크롤 없이 보이는 정산 레이아웃 및 실제 규칙 프리뷰

- [ ] **Step 1: 현재 Next.js CSS 문서를 읽는다**

Run:

```bash
sed -n '1,260p' node_modules/next/dist/docs/01-app/01-getting-started/11-css.md
```

Expected: root layout의 전역 CSS import와 현재 프로젝트 구성이 지원되는지 확인한다. import 구조는 바꾸지 않는다.

- [ ] **Step 2: 새 정산 격자의 실패 CSS 계약 테스트를 작성한다**

`components/game/U6FixedCanvas.test.ts`에 다음 테스트를 추가하고 CTA 테스트는 유지한다.

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

- [ ] **Step 3: CSS 테스트가 기존 선택자와 격자 때문에 실패하는지 확인한다**

Run:

```bash
pnpm vitest run components/game/U6FixedCanvas.test.ts
```

Expected: 새 `.u6-party-results__list`와 3행 계약이 없고 폐기 선택자가 남아 있어 FAIL.

- [ ] **Step 4: 좌측 결과·원인·인물 격자를 구현한다**

`app/u6-result.css`의 정산 좌측 영역을 다음 핵심 규칙으로 교체한다.

```css
.u6-settlement-main {
  grid-template-rows: auto auto minmax(0, 1fr);
}

.u6-outcome {
  display: grid;
  gap: 0.2rem;
  margin: 0;
}

.u6-outcome strong {
  color: var(--color-shell-gold);
  font-size: clamp(1.5rem, 1.5cqw, 2.3rem);
}

.u6-outcome small {
  color: var(--color-muted);
  font-size: clamp(0.8rem, 0.78cqw, 1.15rem);
}

.u6-cause-summary ul {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(0.4rem, 0.5cqw, 0.8rem);
  margin: 0;
  padding: 0;
  list-style: none;
}

.u6-cause-summary li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: clamp(0.5rem, 0.6cqw, 0.9rem);
  padding: clamp(0.45rem, 0.55cqw, 0.8rem);
  border: 1px solid color-mix(in srgb, var(--color-shell-metal) 40%, var(--color-edge));
  border-radius: 0.28rem;
  background: linear-gradient(180deg, rgb(28 21 14 / 88%), rgb(16 12 8 / 92%));
}

.u6-cause-summary li > img {
  width: clamp(1.8rem, 2cqw, 2.8rem);
  height: clamp(1.8rem, 2cqw, 2.8rem);
  object-fit: contain;
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

각 인물 행은 `portrait / who / state / flags` 네 열을 사용하고, `is-dead`, `is-exposed`, `is-gravely-wounded`는 서로 다른 border와 텍스트 배지를 가진다. `opacity`만으로 상태를 구분하지 않는다.

- [ ] **Step 5: 우측 캠페인 변화와 CTA 격자를 맞춘다**

기존 `.u6-risk-change`를 `.u6-dungeon-change`로 바꾸고 `.u6-trust-pressure` 규칙을 추가한다.

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

`.u6-settlement-side .u6-settlement-continue { grid-row: 4; justify-self: end; text-align: center; }`는 그대로 유지한다.

기존 `.u6-cause-chain`, `.u6-cause`, `.u6-cause__order`, `.u6-cause__note`, `.u6-returned*` 및 피해 문양 색 연계 선택자를 삭제한다. 인주 색은 `.u6-changes__seal.is-*`만 유지한다.

- [ ] **Step 6: 프리뷰의 부분 생존 상태에 실제 신뢰 0을 넣는다**

`components/game/u6-preview-data.ts`의 `settlementPartial`에서 살아남는 인물 한 명이 신뢰 0에 도달하도록 만든다. 사망자를 신뢰 누적 사례로 쓰지 않는다.

```ts
const settlementPartial = settlementFor({
  campaign: baseCampaign,
  finalMembers: [
    { ...first, hp: Math.max(1, first.hp - 7), trust: 0 },
    { ...second, hp: Math.max(1, second.hp - 9) },
    { ...third, hp: 0, alive: false },
  ],
  status: "cleared",
});
```

실제 변수 순서가 다르면 생존자 2명과 사망자 1명이라는 같은 상태를 유지하되, 신뢰 0은 반드시 생존자에게 둔다.

- [ ] **Step 7: 프리뷰 테스트를 새 의미로 교체한다**

`components/game/u6-preview-data.test.ts`의 `causeChain` 피해 줄 describe를 삭제하고 다음 테스트로 교체한다.

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

it("전멸 정산은 사망자 셋과 위험도 상승을 담고 신뢰 0 누적을 만들지 않는다", () => {
  const wiped = U6_PREVIEW_ENTRIES.find((entry) => entry.id === "settlement-wipe")?.settlement;
  if (wiped === undefined) throw new Error("전멸 프리뷰가 없다");

  expect(wiped.outcome.kind).toBe("wiped");
  expect(wiped.members.every((member) => member.diedThisExpedition)).toBe(true);
  expect(wiped.dungeonOutcome.kind).toBe("riskIncreased");
  expect(wiped.members.some((member) => member.trust.countsTowardCampaign)).toBe(false);
});
```

기존 `riskBefore`, `riskAfter`, `riskCapped` 직접 검사는 `dungeonOutcome` union 검사로 바꾼다.

- [ ] **Step 8: CSS·프리뷰·화면 테스트를 실행한다**

Run:

```bash
pnpm vitest run components/game/U6FixedCanvas.test.ts components/game/U6SettlementScreen.test.ts components/game/u6-preview-data.test.ts
pnpm typecheck
```

Expected: 모든 대상 테스트 PASS, typecheck 성공.

- [ ] **Step 9: 시각 구조와 프리뷰 변경을 커밋한다**

```bash
git add app/u6-result.css components/game/U6FixedCanvas.test.ts components/game/u6-preview-data.ts components/game/u6-preview-data.test.ts
git commit -m "화면: 정산 정보 위계를 시각적으로 정리한다" -m "선택과 판단을 압축하고 원정대 결과 세 행과 신뢰 누적을 고정 캔버스 안에 배치한다."
```

---

### Task 5: 정산 도메인에서 중복 UI 문장을 제거

**Files:**
- Modify: `lib/domain/settlement.ts`
- Modify: `lib/rules/settlement.ts`
- Modify: `lib/rules/settlement.test.ts`
- Modify: `components/game/u6-settlement-model.ts`
- Modify: `components/game/u6-settlement-model.test.ts`
- Modify: `lib/rules/campaign-statistics.test.ts`
- Modify: `lib/rules/campaign-history.test.ts`

**Interfaces:**
- Consumes: 기존 `SettlementSnapshot.causeInputs`
- Produces: `SettlementResult.causeInputs: SettlementCauseInputs`; 삭제되는 `SettlementCauseChain`, `createCauseChain`, `SettlementResult.causeChain`

- [ ] **Step 1: UI 문장 제거의 실패 테스트를 작성한다**

`lib/rules/settlement.test.ts`에 다음 테스트를 추가한다.

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
```

- [ ] **Step 2: 테스트가 `causeInputs` 부재로 실패하는지 확인한다**

Run:

```bash
pnpm vitest run lib/rules/settlement.test.ts
```

Expected: `result.causeInputs`가 없고 `causeChain`이 남아 있어 FAIL.

- [ ] **Step 3: 도메인 타입을 단일 원인 입력으로 바꾼다**

`lib/domain/settlement.ts`에서 `SettlementCauseChain`을 삭제하고 `SettlementResult` 끝 필드를 다음으로 바꾼다.

```ts
export interface SettlementResult {
  readonly expeditionId: string;
  readonly dungeonId: DungeonId;
  readonly status: ExpeditionStatus;
  readonly survivorIds: readonly CharacterId[];
  readonly survivorCount: 0 | 1 | 2 | 3;
  readonly memberChanges: readonly SettlementMemberChange[];
  readonly reputationDelta: number;
  readonly goldDelta: number;
  readonly relicGold: number;
  readonly riskBefore: RiskLevel;
  readonly riskAfter: RiskLevel;
  readonly riskCapped: boolean;
  readonly nextReward: Reward | null;
  readonly causeInputs: SettlementCauseInputs;
}
```

`SettlementCauseInputs`와 `SettlementSnapshot.causeInputs`는 그대로 유지한다.

- [ ] **Step 4: 정산 규칙에서 문장 생성기를 제거한다**

`lib/rules/settlement.ts`에서 다음을 삭제한다.

- `SettlementCauseChain` import
- `createCauseChain` 함수 전체

결과 생성의 마지막 필드를 다음으로 바꾼다.

```ts
causeInputs: { ...snapshot.causeInputs },
```

보상, 위험도, 유품, 인물 변화 코드는 수정하지 않는다.

- [ ] **Step 5: U6 어댑터를 `causeInputs`로 연결한다**

Task 2에서 만든 두 원인 항목을 다음으로 바꾼다.

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

형태는 모두 다음과 같다.

```ts
causeInputs: {
  choice: "선택 내용",
  reactions: "반응 내용",
  damage: "피해 내용",
},
```

`economy`, `campaignChange` fixture는 삭제한다.

- [ ] **Step 7: 도메인·어댑터·통계·이력 테스트를 실행한다**

Run:

```bash
pnpm vitest run \
  lib/rules/settlement.test.ts \
  components/game/u6-settlement-model.test.ts \
  lib/rules/campaign-statistics.test.ts \
  lib/rules/campaign-history.test.ts
pnpm typecheck
```

Expected: 대상 테스트 PASS, typecheck 성공, 코드 검색에서 생산 코드의 `SettlementCauseChain`, `causeChain.economy`, `causeChain.campaignChange`가 0건이다.

- [ ] **Step 8: 도메인 정리를 커밋한다**

```bash
git add lib/domain/settlement.ts lib/rules/settlement.ts lib/rules/settlement.test.ts components/game/u6-settlement-model.ts components/game/u6-settlement-model.test.ts lib/rules/campaign-statistics.test.ts lib/rules/campaign-history.test.ts
git commit -m "정산: 결과에서 화면 문장을 제거한다" -m "선택·반응·피해 원본만 보존하고 보상과 던전 변화는 구조화된 필드가 계속 소유하게 한다."
```

---

### Task 6: 규칙부터 화면까지 통합 검증하고 실제 캔버스를 확인

**Files:**
- Create: `components/game/u6-settlement-integration.test.tsx`
- Verify: `components/game/U6SettlementScreen.tsx`
- Verify: `components/game/u6-settlement-model.ts`
- Verify: `app/u6-result.css`
- Verify: `components/game/u6-preview-data.ts`
- Verify: `docs/experience/SCREEN_LAYOUT.md`

**Interfaces:**
- Consumes: `settleExpedition → createU6SettlementView → U6SettlementScreen`
- Produces: 실제 규칙 결과가 클리어와 전멸 화면에서 정확히 읽힌다는 통합 증거

- [ ] **Step 1: 클리어와 전멸의 통합 테스트를 작성한다**

`components/game/u6-settlement-integration.test.tsx`를 다음 구조로 만든다.

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

describe("U6 정산 통합", () => {
  it("2명 생환 클리어가 정복·사망·생존자 신뢰 0을 보여준다", () => {
    const campaign = initializeCampaign("u6-integration-clear");
    const dungeon = campaign.dungeons[0];
    const [first, second, third] = partyMembers(campaign);
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

  it("전멸이 계약 보상 없음·유품·위험도 상승을 보여준다", () => {
    const campaign = initializeCampaign("u6-integration-wipe");
    const dungeon = campaign.dungeons[0];
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
});
```

- [ ] **Step 2: 통합 테스트를 실행한다**

Run:

```bash
pnpm vitest run components/game/u6-settlement-integration.test.tsx
```

Expected: 두 테스트 PASS.

- [ ] **Step 3: 통합 테스트를 커밋한다**

```bash
git add components/game/u6-settlement-integration.test.tsx
git commit -m "검증: 정산 규칙과 화면을 함께 확인한다" -m "실제 클리어와 전멸 결과가 정복, 사망, 신뢰 0, 유품, 위험도 변화를 정확히 렌더링하는지 고정한다."
```

- [ ] **Step 4: 전체 자동 검사를 실행한다**

Run:

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
git diff --check origin/main...HEAD
```

Expected: 전체 단위 테스트 PASS, lint 오류 0개, typecheck 성공, Next.js production build 성공, diff 공백 오류 없음.

- [ ] **Step 5: 폐기된 문구와 필드가 남지 않았는지 검색한다**

Run:

```bash
rg -n "던전 위험도 .*유지|SettlementCauseChain|causeChain\.economy|causeChain\.campaignChange|u6-returned|u6-cause__order" \
  app components lib docs/experience docs/technical
```

Expected: 현재 구현·공식 문서에서 0건. 이전 설계 기록인 `docs/superpowers/specs/2026-08-22-sbh3821-u6-settlement-ending-design.md`는 역사 자료이므로 검색 범위에서 제외했다.

- [ ] **Step 6: 개발 서버를 실행한다**

Run:

```bash
pnpm dev
```

Expected: Next.js 개발 서버가 로컬 주소를 출력하고 `/u6-test`, `/campaign`을 제공한다.

- [ ] **Step 7: `/u6-test`의 정산 세 상태를 확인한다**

Open: `http://localhost:3000/u6-test`

Verify `settlement-partial`:

- 던전 이름과 `정복`이 가장 먼저 보인다.
- 귀환자 수와 사망자 이름이 표제에 보인다.
- 살아 있는 신뢰 0 인물에 `정체 발각 · 원정 출전 불가`가 보인다.
- 우측에 신뢰 0 누적과 현재 효과가 보인다.
- `던전 위험도 유지`가 없다.

Verify `settlement-wipe`:

- `원정대 전멸`과 세 사망자가 보인다.
- `계약 보상 없음`, 명성 손실, 유품 골드가 분리되어 보인다.
- 위험도 전후와 재도전 보상이 보인다.
- 사망자의 신뢰 0을 살아 있는 누적으로 표시하지 않는다.

Verify `settlement-promotion`:

- ★5 클리어가 `정복`으로 보이고 위험도 상한 실패처럼 보이지 않는다.
- 상단 상태 바의 승급 가능 표시가 유지된다.
- 정산 우측에 승급 제어가 중복되지 않는다.

- [ ] **Step 8: 실제 `/campaign` 정산 경로를 확인한다**

Open: `http://localhost:3000/campaign`

한 원정을 정산까지 진행하고 다음을 확인한다.

- 진행 화면에서 본 마지막 조언과 파티 반응이 정산에 이어진다.
- 인물 HP·신뢰 전후가 실제 최종 상태와 일치한다.
- 클리어면 정복과 게시판 제거, 전멸이면 위험도 상승이 표시된다.
- `길드로 돌아간다`가 우측 최하단의 내용 폭 버튼으로 남는다.
- 버튼을 누르면 기존 월드턴과 게시판 흐름이 정상 진행된다.
- 화면 잘림, 스크롤, 겹침, 콘솔 오류, Next.js 오류 오버레이가 없다.

- [ ] **Step 9: 브랜치 범위를 최종 확인한다**

Run:

```bash
git status --short --branch
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
```

Expected: 작업 트리가 깨끗하고, 공식 문서, ViewModel, 화면, CSS, 도메인 정리, 통합 테스트 커밋만 존재한다.
