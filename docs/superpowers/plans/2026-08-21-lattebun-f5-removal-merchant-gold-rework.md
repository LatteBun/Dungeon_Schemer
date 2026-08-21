# F5 제거·상인 골드 개입 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 독립 아이템 계약을 제거하고, 공용 merchant 30개를 골드 결제·즉시/다음 전투 효과를 가진 콘텐츠와 순수 규칙으로 재구성한다.

**Architecture:** 비merchant `AdviceOption`과 merchant 전용 조언을 식별 가능한 타입으로 분리한다. 콘텐츠는 `goldCost`와 선언형 효과만 제공하고, `lib/rules/merchant.ts`가 실행 가능 여부·실제 결제·HP 변화·단일 pending 효과를 순수하게 처리한다. 아직 없는 E1~E4·Store·진행 UI는 새로 만들지 않으며, 이후 E3/E4가 이 규칙 API를 호출하도록 작업 배정표와 공식 문서에 책임을 기록한다.

**Tech Stack:** TypeScript 5 strict, Vitest 4, pnpm 11, Next.js 16.3, React 19

**Spec:** `docs/superpowers/specs/2026-08-21-lattebun-f5-removal-merchant-gold-rework-design.md`, `docs/superpowers/specs/2026-08-21-lattebun-f5-removal-merchant-gold-rework-design-review.md`, `docs/superpowers/specs/2026-08-21-lattebun-f5-removal-merchant-gold-rework-correction-design.md`

## Global Constraints

- 보정 Spec이 원본 Spec과 이전 review보다 우선한다.
- 원정 시작 때 사건과 지도는 시드로 확정하며, pending 효과를 이유로 재배치·재추첨하지 않는다.
- H/X는 양의 정수 골드 비용과 효과를 가지며, N은 `0G`이고 merchant 고유 효과가 없다.
- 비용과 효과는 한 명 이상 수용했을 때만 적용한다. 전원 의심·방해 즉시 적발은 결제·효과가 없다.
- `pendingMerchantEffect`는 한 개만 허용하고 다음 `monster` 또는 보스전 직후 폐기한다. 인벤토리·장비·수량·장기 아이템 상태를 만들지 않는다.
- `effectTags.item`은 유지 가능하지만 효과 수치 계산에는 쓰지 않는다.
- H/X 가격 표와 M01~M30 효과 강도는 보정 Spec 4절·6절을 정확히 따른다.
- 커밋 제목과 본문은 항상 한글로 쓴다.

---

## File Structure

| 파일 | 책임 |
| --- | --- |
| `docs/GAME_PRINCIPLES.md` | 독립 아이템 사용 제거와 merchant 개입 원칙 |
| `docs/design/CORE_GAME_LOOP.md` | 아이템 입력 제거 및 pending merchant effect 흐름 |
| `docs/experience/ONBOARDING_AND_INTERFACE.md` | 가격·골드 부족·효과 중복 불가 UI 피드백 |
| `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md` | merchant 골드·효과·사전 배치 계약 |
| `docs/systems/INFORMATION_AND_DECEPTION.md` | 정보 판매 제거와 merchant 예시 갱신 |
| `docs/systems/PROGRESSION_AND_ENDINGS.md` | 현재 골드만 차감하는 경제 설명 |
| `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md` | F5 노드·간선 삭제와 E3 책임 갱신 |
| `docs/DOCUMENT_TERMINOLOGY.test.ts` | 공식 문서의 폐기 아이템 표현 회귀 감시 |
| `lib/domain/ids.ts` | 사용하지 않는 `ItemId` 제거 |
| `lib/domain/content.ts` | merchant 전용 조언·효과 타입과 일반 조언 분리 |
| `lib/domain/expedition.ts` | 단일 `pendingMerchantEffect` 원정 상태 |
| `lib/domain/index.ts` | 새 타입 export 및 Item 계약 export 제거 |
| `lib/domain/advice.test.ts` | merchant 타입과 pending 상태 도메인 예제 |
| `lib/content/shared-event-builders.ts` | 비merchant builder와 merchant builder 분리 |
| `lib/content/shared-merchant-events.ts` | M01~M30의 가격·효과·문구 데이터 |
| `lib/content/situation-validation.ts` | merchant 비용·효과 계약 검증 |
| `lib/content/situation-validation.test.ts` | 잘못된 merchant 콘텐츠의 생성 오류 회귀 |
| `lib/content/shared-events.test.ts` | 30개 merchant 가격·효과·계열·정보 판매 부재 검증 |
| `lib/rules/merchant.ts` | 선택 실행 가능 여부, 실제 결제, 즉시 HP, pending 소비 순수 규칙 |
| `lib/rules/merchant.test.ts` | merchant 실행 규칙 단위 테스트 |

### Task 1: 기준선과 생성 산출물 정리

**Files:**
- Modify: 없음
- Verify: `node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md`
- Verify: `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`

**Interfaces:**
- Consumes: 현재 `tsconfig.json`의 `.next/dev/types/**/*.ts` include
- Produces: stale `.next`가 없는 검증 가능한 기준선

- [ ] **Step 1: Next.js 16 공식 문서를 읽는다.**

`node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md`와 `05-server-and-client-components.md`를 읽는다. 이번 변경은 UI 파일을 추가하지 않지만, 이후 U5가 콘텐츠 타입을 소비할 때 Server/Client 경계를 임의로 바꾸지 않기 위함이다.

- [ ] **Step 2: `.next`가 Git 추적 대상이 아님을 확인한다.**

Run:

```powershell
git ls-files -- .next
Test-Path -LiteralPath .next
```

Expected: 첫 명령 출력은 비어 있고, 두 번째 명령은 현재 캐시 존재 여부만 출력한다.

- [ ] **Step 3: stale 생성 타입 때문에 실패하는 typecheck를 재현한다.**

Run:

```powershell
pnpm.cmd typecheck
```

Expected: 현재 삭제된 `/play`, `/e1-test`, `/f1-test` 등의 `.next/dev/types/validator.ts` 참조 오류가 난다. 이 실패는 merchant 변경 전 기준선 문제로 기록한다.

- [ ] **Step 4: 검증 캐시만 삭제하고 기준선을 재생성한다.**

`git ls-files -- .next`가 빈 출력인 것을 확인한 뒤에만 다음을 실행한다.

```powershell
Remove-Item -LiteralPath .next -Recurse -Force
pnpm.cmd typecheck
pnpm.cmd test
```

Expected: typecheck와 테스트가 모두 성공한다. `.next` 외 파일을 삭제하거나 수정하지 않는다.

- [ ] **Step 5: 기준선 확인을 커밋 없이 기록한다.**

캐시 삭제는 Git 변경이 아니므로 커밋하지 않는다. 이후 각 Task의 검증에서 새 `.next` 오류가 나오면 먼저 이 Task의 절차를 다시 실행한다.

### Task 2: 공식 문서와 작업 그래프에서 F5를 제거한다

**Files:**
- Modify: `docs/GAME_PRINCIPLES.md`
- Modify: `docs/design/CORE_GAME_LOOP.md`
- Modify: `docs/experience/ONBOARDING_AND_INTERFACE.md`
- Modify: `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`
- Modify: `docs/systems/INFORMATION_AND_DECEPTION.md`
- Modify: `docs/systems/PROGRESSION_AND_ENDINGS.md`
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`
- Modify: `docs/DOCUMENT_TERMINOLOGY.test.ts`
- Test: `docs/DOCUMENT_TERMINOLOGY.test.ts`, `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.test.ts`

**Interfaces:**
- Consumes: 세 Spec의 문서 갱신 범위와 보정 Spec 2절·8절
- Produces: F5가 없는 42개 작업 그래프와 merchant의 공식 규칙

- [ ] **Step 1: 문서 회귀 테스트를 먼저 추가한다.**

`RETIRED_TERMS`에 `정보·치료제·독·가짜 지도 등을 구매한다`, `식량과 개별 물품은 원정 자원 또는 아이템으로 별도 관리한다`를 추가한다. `REQUIRED_ANCHORS`에는 아래 문구를 추가한다.

```ts
"GAME_PRINCIPLES.md": ["상인 사건", "현재 골드"],
"design/CORE_GAME_LOOP.md": ["pending merchant effect"],
"experience/ONBOARDING_AND_INTERFACE.md": ["골드 부족", "효과 중복 불가"],
"systems/DUNGEON_EVENTS_AND_BOSSES.md": ["다음 전투", "정보 판매"],
```

- [ ] **Step 2: 새 문서 테스트가 현재 문서에서 실패하는지 확인한다.**

Run:

```powershell
pnpm.cmd test -- docs/DOCUMENT_TERMINOLOGY.test.ts
```

Expected: 독립 아이템 사용·가짜 지도 구매 문구와 새 anchor 부재 때문에 FAIL한다.

- [ ] **Step 3: 공식 문서를 보정 Spec과 동일한 계약으로 고친다.**

다음 문장을 반영한다.

```text
merchant는 공용 사건이며 H/X는 현재 골드를 써 파티에 즉시 또는 다음 전투 한 번 개입한다.
neutral은 0G 비구매이며 정보·가짜 지도·생태 정답을 판매하지 않는다.
pending merchant effect는 하나이며 지도와 사건의 사전 배치를 바꾸지 않는다.
```

`CORE_GAME_LOOP.md`의 보스 입력에서 아이템을 제거하고 `pending merchant effect`를 추가한다. `GAME_PRINCIPLES.md`의 기본 행동에서 독립 아이템 사용을 제거한다. `ONBOARDING_AND_INTERFACE.md`에는 가격 표시, 골드 부족, `효과 중복 불가`의 비활성 상태만 추가하고 help/harm/neutral과 실제 수치를 선택 전에 노출하지 않는다. `DUNGEON_EVENTS_AND_BOSSES.md`의 merchant 주제·아이템 5종 계약을 새 merchant 계약으로 교체한다.

- [ ] **Step 4: 작업 배정표의 F5 노드와 간선을 정확히 제거한다.**

`CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`에서 다음을 모두 바꾼다.

```text
43개 항목 → 42개 항목
F1~F5 → 실제 남은 기반 항목을 나열한 F1·F1-2·F2-1·F2-2·F3-1~F3-5·F4
D3 → F5 삭제
F5 → E3 삭제
F5 행 삭제
시작 가능 작업의 F5 언급 삭제
E3의 선행에서 F5 삭제
```

Mermaid 노드 선언과 간선, 표의 `선행`·`풀리는 것`, 계층 설명, 재사용 자산 표를 같은 변경으로 맞춘다. E3 완료 기준에는 merchant의 비용 확인·실제 실행 시 결제·즉시/다음 전투 효과·pending 폐기를 추가한다.

- [ ] **Step 5: 문서와 그래프 테스트를 통과시킨다.**

Run:

```powershell
pnpm.cmd test -- docs/DOCUMENT_TERMINOLOGY.test.ts docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.test.ts docs/DOCUMENT_LINKS.test.ts
```

Expected: PASS — 문서 anchor·폐기 문구·배정표 노드/간선/선행 규약·상대 링크가 모두 통과한다.

- [ ] **Step 6: 문서 변경을 커밋한다.**

```powershell
git add docs/GAME_PRINCIPLES.md docs/design/CORE_GAME_LOOP.md docs/experience/ONBOARDING_AND_INTERFACE.md docs/systems/DUNGEON_EVENTS_AND_BOSSES.md docs/systems/INFORMATION_AND_DECEPTION.md docs/systems/PROGRESSION_AND_ENDINGS.md docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md docs/DOCUMENT_TERMINOLOGY.test.ts
git commit -m "문서: F5를 제거하고 상인 골드 계약을 반영한다" -m "공식 규칙과 작업 그래프를 골드 기반 즉시·다음 전투 개입 계약으로 갱신한다."
```

### Task 3: merchant 전용 도메인 타입과 pending 상태를 만든다

**Files:**
- Modify: `lib/domain/ids.ts`
- Modify: `lib/domain/content.ts`
- Modify: `lib/domain/expedition.ts`
- Modify: `lib/domain/index.ts`
- Modify: `lib/domain/advice.test.ts`
- Modify: `lib/domain/__checks__.ts`

**Interfaces:**
- Produces: `MerchantAdviceOption`, `MerchantEffect`, `NextBattleMerchantEffect`, `PendingMerchantEffect`, `MerchantSituationEvent`
- Consumes: 기존 `AdviceOption`, `SituationEvent`, `ExpeditionState`

- [ ] **Step 1: 도메인 테스트와 compile-time 계약을 RED로 작성한다.**

`advice.test.ts`에 다음 형태의 merchant 조언·원정 상태 fixture를 추가한다.

```ts
const merchantHelp: MerchantAdviceOption = {
  id: "merchant-help" as ChoiceId,
  outcome: "help",
  label: "치료를 부탁하세요",
  line: "상처가 깊으니 지금 치료하자고 하세요.",
  relation: "unrelated",
  effectTags: ["trade"],
  resultText: "상처를 봉합한다.",
  goldCost: 5,
  merchantEffect: { immediateHpDeltaPerMember: 8 },
};
expect(merchantHelp.goldCost).toBe(5);
```

`__checks__.ts`에는 `ItemId` export가 사라진 뒤에도 새 merchant type이 `lib/domain/index.ts`에서 export되는 import-only contract를 둔다.

- [ ] **Step 2: 새 테스트가 현재 계약에서 실패하는지 확인한다.**

Run:

```powershell
pnpm.cmd test -- lib/domain/advice.test.ts
pnpm.cmd typecheck
```

Expected: `MerchantAdviceOption`과 `pendingMerchantEffect`가 아직 없어서 FAIL한다.

- [ ] **Step 3: 식별 가능한 merchant 타입을 구현한다.**

`content.ts`에서 공통 필드를 `BaseAdviceOption`으로 추출하고 다음 형태로 선언한다.

```ts
export type NextBattleMerchantEffect =
  | { incomingDamageMultiplier: number; partyDamageMultiplier?: never }
  | { incomingDamageMultiplier?: never; partyDamageMultiplier: number };

export type MerchantEffect =
  | { immediateHpDeltaPerMember: number; nextBattle?: NextBattleMerchantEffect }
  | { immediateHpDeltaPerMember?: never; nextBattle: NextBattleMerchantEffect };

export type MerchantAdviceOption =
  | (BaseAdviceOption & { outcome: "neutral"; goldCost: 0; merchantEffect?: never })
  | (BaseAdviceOption & { outcome: "help" | "harm"; goldCost: number; merchantEffect: MerchantEffect });

export type AdviceOption = BaseAdviceOption & {
  goldCost?: never;
  merchantEffect?: never;
};
```

`MerchantSituationEvent`는 `kind: "merchant"`, `theme?: never`, `targetBossId?: never`, `upgrades?: never`, `readonly MerchantAdviceOption[]`를 갖게 한다. 기존 nonmerchant event는 `Exclude<EventKind, "merchant">`와 `readonly AdviceOption[]`를 갖게 한다. `SituationEvent`는 두 event type의 union으로 export한다. `PendingMerchantEffect`는 source advice ID와 `nextBattle`만 보관하며, `ExpeditionState`에 `pendingMerchantEffect: PendingMerchantEffect | null`을 추가한다. `ItemId`, `ItemKind`, `ITEM_KINDS`, `ItemDef`와 export를 제거한다.

- [ ] **Step 4: domain 계약 검증을 통과시킨다.**

Run:

```powershell
pnpm.cmd test -- lib/domain/advice.test.ts
pnpm.cmd typecheck
```

Expected: PASS — 비merchant 조언은 merchant 필드를 허용하지 않고, H/X/N과 pending 상태가 타입으로 표현된다.

- [ ] **Step 5: 도메인 변경을 커밋한다.**

```powershell
git add lib/domain/ids.ts lib/domain/content.ts lib/domain/expedition.ts lib/domain/index.ts lib/domain/advice.test.ts lib/domain/__checks__.ts
git commit -m "도메인: 상인 골드와 예약 효과 계약을 추가한다" -m "아이템 정의 계약을 제거하고 merchant 전용 조언과 단일 pending 효과 상태를 도입한다."
```

### Task 4: 콘텐츠 validator와 builder를 merchant 계약에 맞춘다

**Files:**
- Modify: `lib/content/shared-event-builders.ts`
- Modify: `lib/content/situation-validation.ts`
- Modify: `lib/content/situation-validation.test.ts`

**Interfaces:**
- Produces: `merchantAdvice(...) => MerchantAdviceOption`, merchant 비용·효과 검증
- Consumes: Task 3의 merchant union types

- [ ] **Step 1: 실패하는 merchant validator case를 추가한다.**

`situation-validation.test.ts`에 merchant event fixture를 만들고, 정적으로 표현할 수 없는 잘못된 fixture는 `as unknown as MerchantSituationEvent`로만 cast하여 다음 입력이 `INVALID_GENERATION`을 던지는지 검사한다.

```ts
expect(() => validateSituationEvent(merchantEventWith({ goldCost: 0 }))).toThrow(/비용/);
expect(() => validateSituationEvent(merchantEventWith({ goldCost: -1 }))).toThrow(/비용/);
expect(() => validateSituationEvent(merchantEventWith({ merchantEffect: undefined }))).toThrow(/효과/);
expect(() => validateSituationEvent(merchantEventWith({ nextBattle: { incomingDamageMultiplier: 0 } }))).toThrow(/보정/);
expect(() => validateSituationEvent(merchantEventWithNeutralEffect())).toThrow(/neutral/);
```

- [ ] **Step 2: 테스트가 현 validator에서 실패하는지 확인한다.**

Run:

```powershell
pnpm.cmd test -- lib/content/situation-validation.test.ts
```

Expected: merchant 전용 비용·효과를 검사하지 않으므로 새 negative case 중 하나 이상이 FAIL한다.

- [ ] **Step 3: merchant builder와 validator를 구현한다.**

`shared-event-builders.ts`의 기존 `advice`는 nonmerchant만 만들게 하고, 별도 helper를 추가한다.

```ts
export function merchantAdvice(
  id: string,
  outcome: AdviceOutcome,
  label: string,
  line: string,
  resultText: string,
  effectTags: readonly EventEffectTag[],
  goldCost: number,
  merchantEffect?: MerchantEffect,
): MerchantAdviceOption;
```

`validateSituationEvent`는 `event.kind === "merchant"`일 때 모든 N이 0G·효과 없음, H/X가 양의 정수 비용·효과 있음, immediate delta가 0이 아님, nextBattle의 정확히 하나의 multiplier가 유한한 양수인지 검사한다. 공용 사건의 `relation`, `source`, `bossDamageModifier` 검사는 merchant에도 그대로 적용한다.

- [ ] **Step 4: validator 테스트를 통과시킨다.**

Run:

```powershell
pnpm.cmd test -- lib/content/situation-validation.test.ts
```

Expected: PASS — 기존 themed/shared validation과 merchant negative case가 모두 통과한다.

- [ ] **Step 5: validator 변경을 커밋한다.**

```powershell
git add lib/content/shared-event-builders.ts lib/content/situation-validation.ts lib/content/situation-validation.test.ts
git commit -m "콘텐츠: 상인 비용과 효과 검증을 추가한다" -m "merchant H/X/N의 비용·효과·전투 보정 불변식을 생성 단계에서 검사한다."
```

### Task 5: merchant 30개를 골드 효과 콘텐츠로 전면 재작성한다

**Files:**
- Modify: `lib/content/shared-merchant-events.ts`
- Modify: `lib/content/shared-events.test.ts`

**Interfaces:**
- Produces: `SHARED_MERCHANT_EVENTS: readonly MerchantSituationEvent[]` — M01~M30
- Consumes: `merchantAdvice`, review의 가격 표, 보정 Spec 4절·6절

- [ ] **Step 1: merchant 콘텐츠 회귀 테스트를 RED로 바꾼다.**

기존 사기 판별 ID·제목 기대값을 제거하고 다음 검사를 추가한다.

```ts
const merchants = SHARED_EVENTS.filter((event) => event.kind === "merchant");
expect(merchants).toHaveLength(30);
expect(merchants.flatMap((event) => event.advice.filter((choice) => choice.outcome === "neutral"))
  .every((choice) => choice.goldCost === 0 && choice.merchantEffect === undefined)).toBe(true);
expect(merchants.flatMap((event) => event.advice.filter((choice) => choice.outcome !== "neutral"))
  .every((choice) => choice.goldCost > 0 && choice.merchantEffect !== undefined)).toBe(true);
```

또한 5계열 제목 prefix 배열이 각각 6개인지, H가 더 싼 수와 X가 더 싼 수의 차이가 4 이하인지, 평균 가격 차이가 1 이하인지, `information` tag·`정보`·`지도`·`보관`·`소지품` 문구가 merchant title/description/label/resultText에 없는지 검증한다.

- [ ] **Step 2: 현재 merchant 데이터에서 실패를 확인한다.**

Run:

```powershell
pnpm.cmd test -- lib/content/shared-events.test.ts
```

Expected: 현재 merchant 조언에 `goldCost`·`merchantEffect`가 없고 기존 정보 판매 문구가 있어 FAIL한다.

- [ ] **Step 3: M01~M30 데이터를 보정 Spec에 맞춰 작성한다.**

`merchantEvent` helper가 반환하는 타입을 `MerchantSituationEvent`로 바꾸고, 각 event를 M01~M30 순서로 쓴다. 각 event에는 다음 구조를 사용한다.

```ts
merchantEvent("shared-merchant-emergency-medicine", "응급 약장수", description, [
  merchantAdvice("shared-merchant-emergency-medicine-a", "help", helpLabel, helpLine, helpResult, ["trade", "item"], 5, { immediateHpDeltaPerMember: 8 }),
  merchantAdvice("shared-merchant-emergency-medicine-b", "harm", harmLabel, harmLine, harmResult, ["trade", "sabotage"], 4, { immediateHpDeltaPerMember: -3 }),
  merchantAdvice("shared-merchant-emergency-medicine-c", "neutral", neutralLabel, neutralLine, neutralResult, ["observe"], 0),
], defaultResultText)
```

제목·소재는 원본 Spec 10절의 M01~M30을 사용하고, 가격은 review 2절 표를 정확히 적용한다. 효과는 보정 Spec 6절 표를 정확히 적용한다. M12만 immediate와 `nextBattle`를 함께 넣는다. M19~M24는 현재 장면에서 서비스가 안전을 확보하거나 위험을 일으킨 결과로 즉시 HP가 변했다고 서술하고, 지도·다음 지점·경로를 바꾸는 문구를 넣지 않는다. N은 모두 “거래하지 않는다”의 비구매이며 효과가 없다.

- [ ] **Step 4: 콘텐츠와 전역 validation을 통과시킨다.**

Run:

```powershell
pnpm.cmd test -- lib/content/shared-events.test.ts lib/content/situation-validation.test.ts
```

Expected: PASS — 90개 공용 사건 수량, merchant 30개, H/X/N 가격·효과, 가격 편향, 문구 금지, 기존 공용 사건 계약이 모두 통과한다.

- [ ] **Step 5: merchant 콘텐츠 변경을 커밋한다.**

```powershell
git add lib/content/shared-merchant-events.ts lib/content/shared-events.test.ts
git commit -m "콘텐츠: 상인 30개를 골드 개입 사건으로 재작성한다" -m "정보 판매와 아이템 보관을 제거하고 H/X 결제와 즉시·다음 전투 효과를 부여한다."
```

### Task 6: 결제·즉시 HP·pending 소비를 순수 merchant 규칙으로 구현한다

**Files:**
- Create: `lib/rules/merchant.ts`
- Create: `lib/rules/merchant.test.ts`

**Interfaces:**
- Produces: `getMerchantAdviceAvailability`, `applyAcceptedMerchantAdvice`, `consumePendingMerchantEffect`
- Consumes: `MerchantAdviceOption`, `PendingMerchantEffect`, `Character`

- [ ] **Step 1: merchant 규칙의 실패 테스트를 작성한다.**

다음 테스트를 작성한다.

```ts
expect(getMerchantAdviceAvailability(help, 4, null)).toEqual({ executable: false, reason: "insufficientGold" });
expect(getMerchantAdviceAvailability(delayedHelp, 20, pending)).toEqual({ executable: false, reason: "pendingEffect" });
expect(getMerchantAdviceAvailability(immediateHelp, 20, pending)).toEqual({ executable: true });

const applied = applyAcceptedMerchantAdvice({ advice: compositeHelp, gold: 20, members, pendingMerchantEffect: null });
expect(applied.gold).toBe(12);
expect(applied.members.map((member) => member.hp)).toEqual([28, 30, 32]);
expect(applied.pendingMerchantEffect?.sourceAdviceId).toBe(compositeHelp.id);

const consumed = consumePendingMerchantEffect(applied.pendingMerchantEffect);
expect(consumed.pendingMerchantEffect).toBeNull();
expect(consumed.nextBattle).toEqual(compositeHelp.merchantEffect.nextBattle);
```

추가로 HP 최대치 clamp, 1 하한, neutral 0G, `applyAcceptedMerchantAdvice`를 호출하지 않는 전원 의심·방해 적발 경로에서 gold/HP/pending이 불변이라는 호출자 계약, pending 교체 금지를 각각 검사한다.

- [ ] **Step 2: 테스트가 새 모듈 부재로 실패하는지 확인한다.**

Run:

```powershell
pnpm.cmd test -- lib/rules/merchant.test.ts
```

Expected: FAIL — `lib/rules/merchant.ts`와 export 함수가 없다.

- [ ] **Step 3: 최소 순수 규칙을 구현한다.**

다음 API와 반환값을 사용한다.

```ts
export type MerchantAdviceAvailability =
  | { executable: true }
  | { executable: false; reason: "insufficientGold" | "pendingEffect" };

export function getMerchantAdviceAvailability(
  advice: MerchantAdviceOption,
  gold: number,
  pendingMerchantEffect: PendingMerchantEffect | null,
): MerchantAdviceAvailability;

export function applyAcceptedMerchantAdvice(input: {
  advice: MerchantAdviceOption;
  gold: number;
  members: readonly Character[];
  pendingMerchantEffect: PendingMerchantEffect | null;
}): {
  gold: number;
  members: readonly Character[];
  pendingMerchantEffect: PendingMerchantEffect | null;
};

export function consumePendingMerchantEffect(
  pendingMerchantEffect: PendingMerchantEffect | null,
): { pendingMerchantEffect: null; nextBattle: NextBattleMerchantEffect | null };
```

`applyAcceptedMerchantAdvice`는 호출 전에 `getMerchantAdviceAvailability`이 executable임을 확인하고, 그렇지 않으면 `RangeError`를 던진다. N은 gold·HP·pending을 바꾸지 않는다. 즉시 HP는 살아 있는 구성원에만 적용하고 `Math.min(maxHp, Math.max(1, hp + delta))`로 clamp한다. delayed 성분은 source advice ID와 함께 새 pending에 넣으며 기존 pending을 절대 교체하지 않는다.

- [ ] **Step 4: merchant 규칙 테스트를 통과시킨다.**

Run:

```powershell
pnpm.cmd test -- lib/rules/merchant.test.ts
```

Expected: PASS — 골드 부족, pending 잠금, 실제 수용 결제 한 번, 전원 의심/적발에 해당하는 미호출 상태, HP clamp, 복합 효과, 소비 후 폐기가 검증된다.

- [ ] **Step 5: 순수 규칙을 커밋한다.**

```powershell
git add lib/rules/merchant.ts lib/rules/merchant.test.ts
git commit -m "규칙: 상인 결제와 예약 효과를 처리한다" -m "실제 수용 시에만 골드를 차감하고 즉시 HP와 다음 전투 단일 효과를 순수 함수로 적용한다."
```

### Task 7: 전체 회귀 검증과 E3/E4 인계 경계를 확인한다

**Files:**
- Modify: 없음
- Verify: Task 2~6 변경 파일 전체

**Interfaces:**
- Consumes: `getMerchantAdviceAvailability`, `applyAcceptedMerchantAdvice`, `consumePendingMerchantEffect`
- Produces: E3/E4가 소비할 고정 API와 검증 기록

- [ ] **Step 1: E3/E4 인계 계약을 코드와 대조한다.**

E3 구현 시 반응 판정 결과가 “한 명 이상 수용”일 때만 `applyAcceptedMerchantAdvice`를 호출하고, 버튼 렌더링은 `getMerchantAdviceAvailability`를 사용해야 한다. E3는 다음 monster 전투 직전에 `consumePendingMerchantEffect`를 호출한다. E4는 보스전 시작 직전에 같은 함수를 호출하고, `nextBattle`의 incoming/party multiplier를 보스 정보 개인 보정과 한 번씩 합성한다. 현재 E1~E4는 존재하지 않으므로 이 Task에서 지도·반응·보스 시스템을 새로 만들지 않는다.

- [ ] **Step 2: 전체 품질 게이트를 실행한다.**

Run:

```powershell
git diff --check
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
```

Expected: 모든 명령이 exit 0이다. typecheck가 `.next/dev/types`의 삭제된 과거 route를 참조하면 Task 1의 추적 대상 확인 후 `.next`만 지우고 같은 명령을 다시 실행한다.

- [ ] **Step 3: 최종 검증 커밋을 만들지 않는다.**

Task별 코드와 문서는 이미 커밋되어야 한다. 이 단계는 추가 변경 없이 검증 결과만 확인한다. 실패가 있으면 실패한 Task의 파일로 돌아가 수정·해당 Task 테스트·한글 커밋을 다시 수행한다.

## Self-Review

- **Spec coverage:** Task 2는 F5 삭제·공식 문서·동적 배치 금지를, Task 3은 Item 계약 제거와 pending 상태를, Task 4~5는 merchant 타입/검증/30개 가격·효과·금지 문구를, Task 6은 결제·HP·pending 수명 계약을 구현한다. Task 7은 아직 미구현인 E3/E4가 API를 한 번만 소비하도록 인계 경계를 고정한다.
- **Intentional dependency boundary:** E1~E4와 Store/UI는 현재 코드베이스에 없고 별도 작업 항목이다. 이 Plan은 이를 재구현하지 않으며, 이후 E3/E4가 이미 검증된 merchant rule API를 연결한다.
- **Type consistency:** Task 3이 `MerchantAdviceOption`, `PendingMerchantEffect`, `NextBattleMerchantEffect`를 정의하고, Task 4 validator·Task 5 콘텐츠·Task 6 rules가 같은 이름을 소비한다.
- **No placeholders:** 모든 Task에는 정확한 파일, 테스트, 명령, API 또는 데이터 규칙, 커밋 메시지가 있다.
