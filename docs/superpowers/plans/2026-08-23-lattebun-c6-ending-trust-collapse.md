# C6 엔딩·신뢰 붕괴 구현 계획

- 작성자: LatteBun
- 작성 도구: Codex

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 영구 신뢰 0 누적 보정과 다섯 캠페인 엔딩의 결정적 순수 판정을 C7과 U6이 소비할 수 있게 만든다.

**Architecture:** C6은 `lib/rules/ending.ts`에 순수 질의와 엔딩 결과 생성만 둔다. 즉시 `distrust`와 정상 경로 엔딩은 별도 함수로 분리한다. C7은 후속 작업에서 결과를 받아 `phase: "ended"`와 `ending`을 원자적으로 기록하며, C6은 Store·UI·정산·월드턴을 변경하지 않는다.

**Tech Stack:** Next.js 16.3, TypeScript 5, Vitest 4. 새 런타임 의존성 없음.

**Spec:** [C6 엔딩·신뢰 붕괴 설계](../specs/2026-08-23-lattebun-c6-ending-trust-collapse-design.md)

## Global Constraints

- 구현 전에 `node_modules/next/dist/docs`에서 현재 Next.js 16.3 가이드를 확인한다. 이 작업은 순수 규칙이므로 컴포넌트·CSS를 변경하지 않는다.
- 신뢰 0의 유일한 상태는 `Character.trust === 0`이다. `hasReachedZeroTrust` 또는 동등한 이력 필드를 추가하지 않는다.
- 살아 있는 신뢰 0 인원만 센다. 사망자는 누적 보정·`denounced`·`triggerCharacterIds`에서 제외한다.
- C6은 상태를 변경하지 않는다. C4 정산, C3 월드턴, C7 상태 전이, C8 통계, I1 Store, U6 화면은 이 작업의 구현 범위가 아니다.
- 즉시 `distrust`는 한 조언 결과 또는 보스 정보 검증의 신뢰 변화 묶음이 모두 반영된 뒤 C7이 호출한다. C7은 결과가 있을 때 C4/C3/C8을 호출하지 않는다.
- 정상 엔딩 판정 순서는 `denounced → completed → exhausted → unemployed`다. 즉시 `distrust`는 별도 함수로 먼저 판정한다.
- `unemployed`는 인력 소진이 아닌 상태에서 남은 던전 공고가 하나 이상이고 모두 `rankTooLow`일 때만 성립한다. 빈 공고 배열은 실직이 아니다.
- `completed`는 15개 던전 전부가 `cleared`인 상태만 뜻한다. 원정·월드턴·정산 기록 수로 판정하지 않는다.
- C6의 제목·사유·trigger ID 순서는 도메인에서 만들고 U6은 재계산하지 않는다. ID 순서는 `campaign.pool.order`다.
- 신뢰 0 누적 보정값은 0–1명 `(0, 0)`, 2명 `(-5, 0)`, 3명 `(-10, +5)`, 4명 `(-15, +15)`다. 5명 이상은 정상 경로에서 `denounced`다. B1에서 조기 엔딩 분포와 함께 재측정한다.
- 커밋 제목과 본문은 한국어로 작성한다.

---

## 파일 구조와 책임

| 파일 | 변경 | 책임 |
| --- | --- | --- |
| `lib/domain/campaign.ts` | 수정 | 엔딩 제목과 결정적 trigger ID 공개 계약 |
| `lib/domain/index.ts` | 수정 | C6 도메인 타입의 공개 export 확인 |
| `lib/rules/ending.ts` | 수정 | 신뢰 0 인원·반응 보정·즉시 불신·정상 엔딩 순수 판정 |
| `lib/rules/ending.test.ts` | 수정 | 엔딩 경계, ID 정렬, 보정값, 불변성 검증 |
| `lib/rules/advice-evaluation.test.ts` | 수정 | C6 보정 객체와 E2 입력의 구조적 호환 검증 |
| `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md` | 수정 | C6 완료 상태와 C7 인수인계 기록 |
| `docs/DOCUMENT_TERMINOLOGY.test.ts` | 수정 필요 시 | 실제 용어 충돌이 있을 때만 문서 검증 동기화 |

`lib/rules/campaign-transition.ts`는 C7 전용이다. 이 Plan에서는 수정하지 않는다. C7은 아래 C6 API를 소비한다.

```ts
export interface CampaignTrustModifier { accept: number; expose: number; }
export function countLivingZeroTrust(campaign: CampaignState): number;
export function getCampaignTrustModifier(campaign: CampaignState): CampaignTrustModifier;
export function evaluateImmediateDistrustEnding(campaign: CampaignState, partyMembers: readonly Character[]): CampaignEnding | null;
export function evaluateCampaignEnding(campaign: CampaignState): CampaignEnding | null;
```

---

### Task 1: C6 엔딩 결과 공개 계약

**Files:**
- Modify: `lib/domain/campaign.ts`
- Modify: `lib/domain/index.ts`
- Modify: `lib/rules/ending.test.ts`

**Interfaces:**

```ts
export interface CampaignEnding {
  kind: EndingKind;
  title: string;
  reason: string;
  finalRank: GuideRank;
  triggerCharacterIds: readonly CharacterId[];
}
```

- [ ] **Step 1: 실패하는 계약 테스트를 작성한다.**

`ending.test.ts`의 fixture가 아래 완전한 계약을 요구하게 한다. 기존 `CampaignEnding` fixture도 같은 필드를 갖게 고친다.

```ts
const ending: CampaignEnding = {
  kind: "denounced", title: "누적 고발",
  reason: "살아 있는 용사 5명 이상이 길잡이를 불신합니다.",
  finalRank: "B", triggerCharacterIds: [campaign.pool.order[0]!],
};
expect(ending.triggerCharacterIds).toEqual([campaign.pool.order[0]]);
```

- [ ] **Step 2: 실패를 확인한다.**

Run: `pnpm vitest run lib/rules/ending.test.ts`

Expected: FAIL — `title` 또는 `triggerCharacterIds`가 `CampaignEnding`에 없다.

- [ ] **Step 3: 최소 도메인 타입을 구현한다.**

`campaign.ts`의 `CampaignEnding`에 `title: string`과 `triggerCharacterIds: readonly CharacterId[]`를 추가하고 ID type import에 `CharacterId`를 넣는다. `index.ts`가 `CampaignEnding`과 `CharacterId`를 export하는지 확인하고, 누락된 type export만 추가한다.

- [ ] **Step 4: 계약 회귀를 통과시킨다.**

Run: `pnpm vitest run lib/domain/contract.test.ts lib/rules/ending.test.ts`

Expected: PASS.

- [ ] **Step 5: 커밋한다.**

```bash
git add lib/domain/campaign.ts lib/domain/index.ts lib/rules/ending.test.ts
git commit -m "feat: C6 엔딩 결과 계약 확장" -m "엔딩 제목과 결정적 트리거 캐릭터 식별자를 도메인에 추가한다."
```

### Task 2: 신뢰 0 누적 보정과 즉시 불신

**Files:**
- Modify: `lib/rules/ending.ts`
- Modify: `lib/rules/ending.test.ts`
- Modify: `lib/rules/advice-evaluation.test.ts`

**Interfaces:**

```ts
export interface CampaignTrustModifier { accept: number; expose: number; }
export function countLivingZeroTrust(campaign: CampaignState): number;
export function getCampaignTrustModifier(campaign: CampaignState): CampaignTrustModifier;
export function evaluateImmediateDistrustEnding(campaign: CampaignState, partyMembers: readonly Character[]): CampaignEnding | null;
```

- [ ] **Step 1: 보정값의 실패 테스트를 작성한다.**

`ending.test.ts` fixture에서 신뢰 0 생존자 0~5명과 신뢰 0 사망자 한 명을 만든다. 다음 경계를 고정한다.

```ts
expect(countLivingZeroTrust(campaignWithZeroTrust(2))).toBe(2);
expect(getCampaignTrustModifier(campaignWithZeroTrust(2))).toEqual({ accept: -5, expose: 0 });
expect(getCampaignTrustModifier(campaignWithZeroTrust(3))).toEqual({ accept: -10, expose: 5 });
expect(getCampaignTrustModifier(campaignWithZeroTrust(4))).toEqual({ accept: -15, expose: 15 });
expect(getCampaignTrustModifier(campaignWithZeroTrust(5))).toEqual({ accept: 0, expose: 0 });
```

`advice-evaluation.test.ts`에는 이 반환값을 `decideImmediateAdvice`의 `campaignModifier`로 넘겨 harm 조언의 결정적 적발·수용 경계가 변하는 seed 사례를 추가한다.

- [ ] **Step 2: 실패를 확인한다.**

Run: `pnpm vitest run lib/rules/ending.test.ts lib/rules/advice-evaluation.test.ts`

Expected: FAIL — C6 보정 함수 export가 없다.

- [ ] **Step 3: 보정 테이블을 구현한다.**

`ending.ts`에 `pool.order`를 순회하는 private helper를 둔다. `alive === true && trust === TRUST_MIN`만 센다. `getCampaignTrustModifier`는 다음 switch를 그대로 사용한다.

```ts
switch (countLivingZeroTrust(campaign)) {
  case 2: return { accept: -5, expose: 0 };
  case 3: return { accept: -10, expose: 5 };
  case 4: return { accept: -15, expose: 15 };
  default: return { accept: 0, expose: 0 };
}
```

- [ ] **Step 4: 즉시 불신의 실패 테스트를 작성한다.**

두 생존 신뢰 0이면 `distrust`, 생존자 중 한 명이라도 신뢰 양수면 `null`, 사망 신뢰 0만 있으면 `null`을 각각 검증한다. 파티 입력은 `pool.order`의 역순으로 전달해도 결과 `triggerCharacterIds`가 풀 순서인지, `campaign`과 `partyMembers`가 `structuredClone` 전후 동일한지도 검사한다.

```ts
expect(evaluateImmediateDistrustEnding(campaign, [aliveZeroA, aliveZeroB])).toMatchObject({
  kind: "distrust", title: "불신의 대가", finalRank: campaign.rank,
  triggerCharacterIds: [aliveZeroA.id, aliveZeroB.id],
});
```

- [ ] **Step 5: 즉시 불신 builder를 구현한다.**

살아 있는 파티원이 0이거나 한 명이라도 `trust > 0`이면 `null`을 반환한다. 성립 시 파티와 풀에 모두 있는 살아 있는 ID를 `campaign.pool.order` 순서로 반환한다.

```ts
return {
  kind: "distrust", title: "불신의 대가",
  reason: "원정 생존자 전원이 길잡이를 더는 믿지 않습니다.",
  finalRank: campaign.rank, triggerCharacterIds,
};
```

C4 정산, 던전, gold, reputation, `phase`, `ending`, `statistics`를 변경하지 않는다.

- [ ] **Step 6: 신뢰 붕괴 회귀를 통과시킨다.**

Run: `pnpm vitest run lib/rules/ending.test.ts lib/rules/advice-evaluation.test.ts lib/rules/trust.test.ts`

Expected: PASS.

- [ ] **Step 7: 커밋한다.**

```bash
git add lib/rules/ending.ts lib/rules/ending.test.ts lib/rules/advice-evaluation.test.ts
git commit -m "feat: 신뢰 0 누적과 즉시 불신 판정 추가" -m "살아 있는 신뢰 0 인원 보정과 원정 즉시 종료 결과를 순수 규칙으로 제공한다."
```

### Task 3: 정상 경로 엔딩 우선순위

**Files:**
- Modify: `lib/rules/ending.ts`
- Modify: `lib/rules/ending.test.ts`

**Interfaces:**

```ts
export function evaluateCampaignEnding(campaign: CampaignState): CampaignEnding | null;
```

- [ ] **Step 1: 실패하는 우선순위 테스트를 작성한다.**

다음 여섯 fixture를 만든다. `denounced`는 살아 있는 신뢰 0 다섯 명과 사망 신뢰 0 한 명을 가지며 ID는 `pool.order` 순서여야 한다. `completed`는 모든 던전을 `cleared`로 하되 `statistics.settlements`와 `worldTurn`은 15가 아닌 값으로 만들어 이력 수에 의존하지 않음을 보인다. `unemployed`는 완전한 응급 파티·하나 이상의 미클리어 던전·`rankTooLow` 공고만 가진다.

```ts
expect(evaluateCampaignEnding(denouncedAndCompleted)).toMatchObject({ kind: "denounced" });
expect(evaluateCampaignEnding(allDungeonsCleared)).toMatchObject({ kind: "completed" });
expect(evaluateCampaignEnding(noEmergencyParty)).toMatchObject({ kind: "exhausted" });
expect(evaluateCampaignEnding(allOffersRankLocked)).toMatchObject({ kind: "unemployed" });
expect(evaluateCampaignEnding({ ...noEmergencyParty, offers: [] })).toMatchObject({ kind: "exhausted" });
expect(evaluateCampaignEnding(activeCampaign)).toBeNull();
```

- [ ] **Step 2: 실패를 확인한다.**

Run: `pnpm vitest run lib/rules/ending.test.ts lib/rules/board.test.ts`

Expected: FAIL — `evaluateCampaignEnding`이 없다.

- [ ] **Step 3: early-return 우선순위를 구현한다.**

`distrust`는 포함하지 않는다. C7이 먼저 Task 2의 함수를 호출한다.

정상 엔딩 builder는 아래 문자열을 그대로 사용한다.

| kind | title | reason | triggerCharacterIds |
| --- | --- | --- | --- |
| `denounced` | `누적 고발` | `살아 있는 용사 5명 이상이 길잡이를 불신합니다.` | 풀 순서의 살아 있는 신뢰 0 인물 전체 |
| `completed` | `원정 종료` | `15개의 던전을 모두 돌파했습니다.` | `[]` |
| `exhausted` | `인력 소진` | `서로 다른 직업 3명으로 원정을 꾸릴 수 없습니다.` | `[]` |
| `unemployed` | `실직` | `남은 모든 공고가 현재 길잡이 등급보다 높습니다.` | `[]` |

```ts
if (countLivingZeroTrust(campaign) >= DENOUNCE_THRESHOLD) return denouncedEnding(campaign);
if (campaign.dungeons.every((dungeon) => dungeon.status === "cleared")) return completedEnding(campaign);
if (isPersonnelExhausted(campaign)) return exhaustedEnding(campaign);
if (campaign.offers.length > 0 && campaign.offers.every((offer) => offer.lockReason === "rankTooLow")) return unemployedEnding(campaign);
return null;
```

각 private builder는 위 표의 한국어 제목·사유·현 `campaign.rank`를 반환한다.

- [ ] **Step 4: 엔딩·편성 회귀를 통과시킨다.**

Run: `pnpm vitest run lib/rules/ending.test.ts lib/rules/board.test.ts lib/rules/campaign-init.test.ts`

Expected: PASS.

- [ ] **Step 5: 커밋한다.**

```bash
git add lib/rules/ending.ts lib/rules/ending.test.ts
git commit -m "feat: C6 캠페인 엔딩 판정 구현" -m "누적 고발부터 실직까지 정상 경로의 결정적 우선순위를 제공한다."
```

### Task 4: 문서와 작업 배정 상태

**Files:**
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`
- Modify: `docs/DOCUMENT_TERMINOLOGY.test.ts` (용어 검증이 실제로 요구할 때만)

- [ ] **Step 1: 실패하는 문서 검증을 작성한다.**

`DOCUMENT_TERMINOLOGY.test.ts`가 C6 완료 설명의 `신뢰 0 누적`, `즉시 불신`, `C7`을 확인하도록 필요한 assertion만 추가한다.

- [ ] **Step 2: 실패를 확인한다.**

Run: `pnpm vitest run docs/DOCUMENT_LINKS.test.ts docs/DOCUMENT_TERMINOLOGY.test.ts`

Expected: FAIL — C6은 미완료 상태이거나 C7 인수인계가 없다.

- [ ] **Step 3: 배정표를 갱신한다.**

배정표의 C6 상태를 `✅`로 바꾸고 다음 경계를 기록한다: 신뢰 0 누적 2~4명 보정, 즉시 불신 결과, 정상 엔딩 4종의 순수 판정이 완료되며, C7은 즉시 불신 결과를 받으면 `phase`/`ending`을 원자적으로 기록하고 C4·C3·C8을 건너뛴다. Spec과 공식 문서는 이미 확정 커밋에서 갱신됐으므로 다시 수정하지 않는다.

- [ ] **Step 4: 전체 검증을 통과시킨다.**

Run: `pnpm vitest run docs/DOCUMENT_LINKS.test.ts docs/DOCUMENT_TERMINOLOGY.test.ts lib/rules/ending.test.ts lib/rules/advice-evaluation.test.ts && pnpm lint && pnpm typecheck && pnpm build`

Expected: PASS.

- [ ] **Step 5: 커밋한다.**

```bash
git add docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md docs/DOCUMENT_TERMINOLOGY.test.ts
git commit -m "docs: C6 엔딩 규칙 완료 상태 반영" -m "신뢰 붕괴 엔딩 계약과 C7 인수인계 경계를 작업 배정표에 기록한다."
```

## Spec Coverage Review

- §3–4 영구 신뢰 0 단일 상태: Task 2의 생존자 count 및 trust 회귀.
- §5 즉시 `distrust`와 정산 우회: Task 2 API와 Global Constraints의 C7 계약.
- §6–7 정상 엔딩 순서·경계: Task 3의 여섯 fixture.
- §8 보정값과 B1 재측정: Task 2와 Global Constraints.
- §9 제목·사유·최종 등급·결정적 trigger ID: Task 1과 Task 3.
- §10 모든 사례: Task 2와 Task 3.
- §11 C7/C8/U6 경계: Global Constraints와 Task 4.

```bash
rg -n -i 'TODO|TBD|FIXME|implement later|fill in details|적절한 오류 처리' docs/superpowers/plans/2026-08-23-lattebun-c6-ending-trust-collapse.md
```

Expected: no matches.
