# E2 생태 추론·조언 판정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** C1의 활성 생태 규칙을 소비해 재현 가능한 공개·조언 판정·개인 반응·신뢰 검증·보스 정보 Depth 계획을 제공하고, 게시판의 공개 환경 특성 계약을 제거한다.

**Architecture:** 새 `lib/rules/advice-evaluation.ts`는 순수 E2 규칙만 소유한다. 이 모듈은 효과를 적용하지 않고 `executed`와 신뢰 행동·지연 기록을 반환한다. E3는 그 결정을 소비해 실제 효과와 merchant 결제를 한 번 적용하며, 보스 정보 Depth 계획을 입력으로 강한 연계 계획을 만든다.

**Tech Stack:** TypeScript strict, Vitest 4, Next.js 16/React 19, 기존 `createRng`, `RuleError`, `evaluateTrust`, 콘텐츠 검증기.

**Spec:** `docs/superpowers/specs/2026-08-22-lattebun-e2-advice-evaluation-design.md`

## Global Constraints

- `CampaignDungeon.activeRuleIds`는 C1이 확정한 정확히 3개의 규칙이며 E2는 재추첨하거나 변경하지 않는다.
- 공개 수는 현재 위험도 기준 ★1~2=3, ★3~4=2, ★5=1이고 공개 우선순위에는 `attempt`를 넣지 않는다.
- 선택 전후 UI DTO에 `outcome`, `relation`, `source`, 확률, 보스 피해 보정을 넣지 않는다.
- 파티 반응은 살아 있는 인물별로 독립적이며 `characterId`를 포함한 `card` 스트림 입력으로 재현한다.
- E2는 효과를 적용하지 않는다. `executed`는 E3가 한 번 적용해야 하는 결정이고, merchant의 결제·효과 적용은 기존 E3 책임을 유지한다.
- E2는 보스 정보 Depth만 계획한다. E3가 강한 연계 Depth를 계획하고 두 계획의 충돌을 검증한다.
- 생성 결함은 재추첨·축소 없이 `RuleError("INVALID_GENERATION", ...)`으로, 살아 있는 파티원이 없을 때의 판정 호출은 `INVALID_STATE`로 실패한다.
- 새 의존성을 추가하지 않으며, 커밋 제목과 본문은 한국어로 쓴다.

## File Structure

| 파일 | 책임 |
| --- | --- |
| `lib/domain/ids.ts`, `dungeon.ts`, `campaign.ts`, `content.ts`, `info.ts`, `expedition.ts`, `index.ts` | 환경 특성 제거와 E2 공개 타입·지연 기록 계약 |
| `lib/content/themes.ts`, `theme-validation.ts`, `situation-validation.ts`, `events/*.ts` | 조건부 성립 선언 및 정적 콘텐츠 검증 |
| `lib/rules/advice-evaluation.ts` | 공개 규칙·후보 적합성·결정적 셔플·반응·즉시 신뢰·보스 Depth 계획 |
| `lib/rules/trust.ts` | 결과 기반 `adviceHelped`·`adviceHarmed` 신뢰 행동 |
| `lib/rules/board.ts`, `components/game/u3-board-model.ts`, `U3BoardScreen.tsx` | 공개 환경 특성 제거 |
| 인접 `*.test.ts` | 도메인·콘텐츠·규칙·U3 회귀 검증 |
| `docs/` 공식 문서와 배정표 | 최신 E2 규칙으로 정합화 |

---

### Task 1: 공개 환경 특성 계약을 도메인·게시판·U3에서 제거한다

**Files:**

- Modify: `lib/domain/ids.ts`, `lib/domain/dungeon.ts`, `lib/domain/campaign.ts`, `lib/domain/index.ts`
- Modify: `lib/content/themes.ts`, `lib/content/theme-validation.ts`, `lib/content/theme-validation.test.ts`, `lib/domain/contract.test.ts`
- Modify: `lib/rules/board.ts`, `lib/rules/board.test.ts`
- Modify: `components/game/u3-board-model.ts`, `components/game/u3-board-model.test.ts`, `components/game/U3BoardScreen.tsx`, `components/game/U3BoardScreen.test.ts`, `app/u3-board.css`

**Produces:** `ThemeContent`와 `EcologyProfile`은 활성 규칙·출현 몬스터만, `BoardOffer`는 던전·위험도·파티·잠금 사유만 보관한다.

- [ ] **Step 1: 제거 후 계약을 단정하는 실패 테스트를 작성한다.**

`contract.test.ts`에서 `PublicEnvironmentTagId`, `PublicEnvironmentTag`, `EnvironmentTagDefinition` import를 제거하고, `BoardOffer` fixture에 `publicEnvironmentTag`를 넣은 줄에 `// @ts-expect-error 제거된 공개 환경 특성`을 둔다. `board.test.ts`는 공고가 환경 특성 없이 결정적으로 동일함을, U3 테스트는 `environmentLabel`, `u3-notice-environment`, `환경 특성` 문구가 없음을 단정한다.

Run: `pnpm typecheck && pnpm test lib/domain/contract.test.ts lib/rules/board.test.ts components/game/u3-board-model.test.ts components/game/U3BoardScreen.test.ts`

Expected: FAIL. 현재 타입과 U3가 공개 환경 특성을 요구하거나 표시한다.

- [ ] **Step 2: 도메인과 콘텐츠의 환경 특성 필드를 제거한다.**

`ids.ts`와 `index.ts`에서 세 공개 환경 특성 export를 제거한다. `dungeon.ts`에서 관련 interface와 `ThemeContent.publicEnvironmentTags`, `EcologyProfile.publicEnvironmentTagId`를 삭제하고, `campaign.ts`의 `BoardOffer.publicEnvironmentTag`를 삭제한다. `themes.ts`의 세 태그 배열과 프로필 생성 도우미의 태그 인수를 삭제한다. `theme-validation.ts`의 태그 존재·잡몹 trait 근거 검증도 함께 삭제한다.

- [ ] **Step 3: 게시판과 U3 표현 모델을 정리한다.**

`board.ts`의 `publicTagForDungeon()`와 관련 imports를 삭제하고 `createBoardOffers()`가 `riskLevel` 뒤에 바로 `party`를 넣는다. U3 view 타입에서 `environmentLabel`을 제거하고, 모델 생성과 `U3BoardScreen`의 공고 카드·계약 상세 환경 특성 markup을 삭제한다. `app/u3-board.css`에서 이제 markup이 없는 `.u3-notice__environment`와 그 하위 selector를 삭제하고, 남은 공고 카드의 grid/spacing을 명시적으로 조정해 빈 영역이 생기지 않게 한다.

- [ ] **Step 4: 회귀 검사를 통과시킨다.**

Run: `pnpm test lib/domain/contract.test.ts lib/content/theme-validation.test.ts lib/rules/board.test.ts components/game/u3-board-model.test.ts components/game/U3BoardScreen.test.ts && pnpm typecheck`

Expected: PASS. 환경 특성의 타입·콘텐츠·공고·표시가 모두 사라지고, 파티 편성과 공고 재현성은 유지된다.

- [ ] **Step 5: 독립 변경을 커밋한다.**

```bash
git add lib/domain lib/content/themes.ts lib/content/theme-validation.ts lib/content/theme-validation.test.ts lib/rules/board.ts lib/rules/board.test.ts components/game/u3-board-model.ts components/game/u3-board-model.test.ts components/game/U3BoardScreen.tsx components/game/U3BoardScreen.test.ts app/u3-board.css
git commit -m "도메인: 게시판 환경 특성을 제거한다" -m "생태 추론 정보를 계약 뒤 원정 단계에서만 공개하도록 C2와 U3 계약을 정리한다."
```

### Task 2: 조건부 생태 규칙의 사건별 성립 선언을 추가하고 검증한다

**Files:**

- Modify: `lib/domain/content.ts`, `lib/domain/__checks__.ts`, `lib/domain/advice.test.ts`
- Modify: `lib/content/situation-validation.ts`, `lib/content/situation-validation.test.ts`
- Modify: `lib/content/events/spider-events.ts`, `lib/content/events/desert-events.ts`, `lib/content/events/graveyard-events.ts`

**Interface:**

```ts
export interface NonMerchantSituationEvent extends BaseSituationEvent<NonMerchantAdviceOption> {
  satisfiedConditionalRuleIds?: readonly RuleId[];
}
```

**Validation:** 배열의 모든 ID는 현재 사건의 테마 규칙이어야 하고 `conditional === true`여야 한다. 조건부 규칙을 `source.kind === "ecology"`로 참조하는 help/harm은 같은 사건 배열에 그 ID가 있어야 한다.

- [ ] **Step 1: 조건부 계약의 실패 테스트를 작성한다.**

`situation-validation.test.ts`에 다음 fixture를 추가한다: 조건부 `spider-brood-light`를 참조하지만 선언이 없는 사건, 존재하지 않는 ID, 다른 테마 ID, 비조건부 `spider-fire`, 중복 ID, 그리고 조건부 선언이 있는 유효 사건. 각각 `validateSituationEvent(event, SPIDER_THEME)`가 `RuleError`와 `INVALID_GENERATION`으로 실패하거나 통과하는지 단정한다.

Run: `pnpm test lib/content/situation-validation.test.ts`

Expected: FAIL. 현재 이벤트 계약과 검증기가 조건 성립을 알지 못한다.

- [ ] **Step 2: 타입과 검증기를 구현한다.**

`content.ts`의 `NonMerchantSituationEvent`에 optional readonly 배열을 추가한다. `situation-validation.ts`에 `validateSatisfiedConditionalRules(event, theme)`를 추가하고 다음 순서로 검사한다: 공용·merchant·보스 정보 사건은 배열이 없거나 빈 배열이어야 함, ID 중복 없음, 테마에 존재함, `conditional`이 참임, 일반 테마 조언의 ecology source가 조건부이면 배열에 포함됨. `validateSituationEvent()`에서 advice set 검증 뒤 이 함수를 호출한다.

- [ ] **Step 3: 기존 조건부 콘텐츠를 선언에 맞게 보강한다.**

각 테마 이벤트에서 조건부 source를 갖는 도움·방해 조언이 있는 사건의 `spiderEvent`/동등 factory `extras`에 실제 참조한 조건부 ID를 넣는다. 조건부 규칙은 정확히 다음 여섯 개만 쓴다: `spider-brood-light`, `spider-armor-vibration`, `desert-lizard-heat`, `desert-spirit-dry`, `graveyard-ghoul-sound`, `graveyard-archer-light`. 한 사건이 두 조건부 규칙을 참조하면 두 ID를 한 배열에 넣고, 보스 정보·공용 사건에는 넣지 않는다.

- [ ] **Step 4: 모든 콘텐츠 검증을 통과시킨다.**

Run: `pnpm test lib/domain/advice.test.ts lib/content/situation-validation.test.ts lib/content/spider-events.test.ts lib/content/desert-events.test.ts lib/content/graveyard-events.test.ts && pnpm typecheck`

Expected: PASS. 조건부 source는 모두 사건의 관찰 가능한 장면 조건과 기계적으로 연결되고, 공용·보스 사건은 생태 조건 검사를 받지 않는다.

- [ ] **Step 5: 조건부 콘텐츠 변경을 커밋한다.**

```bash
git add lib/domain/content.ts lib/domain/__checks__.ts lib/domain/advice.test.ts lib/content/situation-validation.ts lib/content/situation-validation.test.ts lib/content/events
git commit -m "콘텐츠: 조건부 생태 규칙의 성립 조건을 선언한다" -m "조건부 조언은 현재 사건에서 조건이 성립한 경우에만 후보가 되도록 검증한다."
```

### Task 3: E2 공개 타입과 신뢰 행동 계약을 만든다

**Files:**

- Modify: `lib/domain/info.ts`, `lib/domain/expedition.ts`, `lib/domain/index.ts`, `lib/domain/advice.test.ts`
- Modify: `lib/rules/trust.ts`, `lib/rules/trust.test.ts`
- Create: `lib/rules/advice-evaluation.ts`, `lib/rules/advice-evaluation.test.ts`

**Interfaces:**

```ts
export interface PresentedAdviceOption { id: ChoiceId; label: string; line: string; goldCost?: number }
export interface MemberReaction { characterId: CharacterId; reaction: InfoReaction }
export interface AdviceDecision {
  adviceId: ChoiceId; outcome: AdviceOutcome; reactions: readonly MemberReaction[];
  executed: boolean; delayedRecords: readonly InfoRecord[];
}
export interface AdviceResolution {
  decision: AdviceDecision; trustChanges: readonly TrustChange[];
}
export interface AdviceFeedback {
  selectedAdviceId: ChoiceId; reactions: readonly MemberReaction[];
  resultText: string; trustChanges: readonly TrustChange[];
}
```

- [ ] **Step 1: public DTO 은닉과 신뢰 action의 실패 테스트를 작성한다.**

`advice-evaluation.test.ts`에서 `presentAdviceOptions()` 결과가 label·line·merchant `goldCost`만 갖고 `outcome`, `relation`, `source`, `bossDamageModifier` 키가 없음을 `Object.keys()`로 단정한다. `trust.test.ts`에는 성격 다섯 종류의 `adviceHelped`와 `adviceHarmed` baseDelta가 Spec 표의 `+2/+3/+2/+3/+4`, `-4/-3/-3/-4/-2`인지 단정하고 `deceptionAccepted`가 `TRUST_ACTIONS`에 없음을 단정한다.

Run: `pnpm test lib/rules/advice-evaluation.test.ts lib/rules/trust.test.ts`

Expected: FAIL. E2 DTO·모듈이 없고 새 신뢰 action도 없다.

- [ ] **Step 2: 도메인 DTO와 지연 기록 의미를 구현한다.**

`info.ts`에 공개 DTO·내부 resolution·member reaction 타입을 추가한다. `InfoRecord` 주석을 “수용한 지연형”에서 “보스전 뒤 검증할 지연형 조언의 개인 기록”으로 바꾸되, 필드명과 기존 E4 소비 가능성은 유지한다. `expedition.ts`의 `infoRecords` 주석도 같은 의미로 갱신하고, `index.ts`에서 새 타입을 export한다.

- [ ] **Step 3: 신뢰 action을 결과 기반 계약으로 바꾼다.**

`TRUST_ACTIONS`에서 `deceptionAccepted`를 삭제하고 `adviceHelped`, `adviceHarmed`를 추가한다. `TRUST_RULES`의 각 성격에 Spec 표의 baseDelta와 결과 기반 한국어 reason을 추가한다. 기존 `deceptionExposed`, `suspicionWasCostly`, `suspicionWasCorrect` 값과 `evaluateTrust()`의 ±20% roll·0~100 clamp는 변경하지 않는다.

- [ ] **Step 4: 최소 presentation 함수를 구현한다.**

`advice-evaluation.ts`에 다음 함수를 먼저 추가한다.

```ts
export function presentAdviceOptions(event: SituationEvent): readonly PresentedAdviceOption[]
```

각 option은 `id`, `label`, `line`만 복사하고 merchant일 때만 `goldCost`를 넣는다. internal option 객체를 spread하거나 반환하지 않는다.

- [ ] **Step 5: 단위 검사를 통과시키고 커밋한다.**

Run: `pnpm test lib/domain/advice.test.ts lib/rules/trust.test.ts lib/rules/advice-evaluation.test.ts && pnpm typecheck`

Expected: PASS.

```bash
git add lib/domain/info.ts lib/domain/expedition.ts lib/domain/index.ts lib/domain/advice.test.ts lib/rules/trust.ts lib/rules/trust.test.ts lib/rules/advice-evaluation.ts lib/rules/advice-evaluation.test.ts
git commit -m "도메인: E2 조언 결과 계약을 추가한다" -m "플레이어용 표현과 내부 판정을 분리하고 신뢰를 결과 기반 조언 행동으로 갱신한다."
```

### Task 4: 활성 규칙 공개·사건 적합성·결정적 조언 순서를 구현한다

**Files:**

- Modify: `lib/rng/index.ts`, `lib/domain/index.ts`
- Modify: `lib/rules/advice-evaluation.ts`, `lib/rules/advice-evaluation.test.ts`

**Interfaces:**

```ts
export function disclosedRuleIds(input: {
  campaignSeed: string; dungeonId: DungeonId; riskLevel: RiskLevel;
  activeRuleIds: readonly RuleId[];
}): readonly RuleId[]
export function isEventEligible(input: {
  event: SituationEvent; dungeon: CampaignDungeon; theme: ThemeContent;
}): boolean
export function presentShuffledAdvice(input: {
  campaignSeed: string; dungeonId: DungeonId; attempt: number; depth: number; event: SituationEvent;
}): readonly PresentedAdviceOption[]
```

- [ ] **Step 1: 공개·적합성·셔플 실패 테스트를 작성한다.**

테스트는 정렬되지 않은 활성 규칙 세 개가 같은 seed/dungeon에서 같은 우선순위를 만들고 attempt가 달라도 같음을 검증한다. 위험도별 길이는 `3,3,2,2,1`, ★5⊆★3⊆★1을 단정한다. 일반 테마 사건은 active rule이 아니거나 조건부 source가 현재 `satisfiedConditionalRuleIds`에 없으면 false, 공용/merchant/boss 정보는 이 조건 검사에서 false가 되지 않음을 단정한다. 셔플은 같은 입력에서 같고 eventId 또는 attempt가 바뀌면 다른 순서를 만들 수 있으며 내부 result가 새지 않음을 단정한다.

Run: `pnpm test lib/rules/advice-evaluation.test.ts`

Expected: FAIL. 세 E2 함수가 없다.

- [ ] **Step 2: 독립 RNG stream을 추가한다.**

`lib/rng/index.ts`의 `RNG_STREAMS`/`RngStream`에 `"advice"`를 추가한다. 공개 우선순위는 `createRng(`${campaignSeed}:${dungeonId}`).derive("ecology")`, 조언 순서는 `createRng(`${campaignSeed}:${dungeonId}:attempt:${attempt}:depth:${depth}:event:${event.id}`).derive("advice")`를 사용한다. 반응은 다음 Task의 `card` stream이므로 여기서 사용하지 않는다.

- [ ] **Step 3: 공개 우선순위와 적합성 함수를 구현한다.**

`disclosedRuleIds()`는 active ID가 정확히 3개·중복 없음인지 먼저 검사하고 ID 기준 정렬 뒤 ecology RNG로 한 번 shuffle한다. 공개 수 lookup `{1:3,2:3,3:2,4:2,5:1}`만큼 slice한다. `isEventEligible()`는 일반 테마 ecology source의 모든 rule이 dungeon.activeRuleIds에 있고, source rule이 conditional이면 event 선언에도 있는지 확인한다. 계약 위반 이벤트를 직접 판정할 때는 `RuleError("INVALID_GENERATION")`; 단순 후보 필터는 `false`를 반환한다.

- [ ] **Step 4: 셔플된 공개 선택지를 구현한다.**

`presentShuffledAdvice()`는 event.advice를 독립 advice RNG로 shuffle한 뒤 `presentAdviceOptions()`와 같은 mapping으로 반환한다. 배열 원본을 바꾸지 않으며, UI DTO에는 내부 필드를 넣지 않는다.

- [ ] **Step 5: 규칙 공개 단위를 검증하고 커밋한다.**

Run: `pnpm test lib/rng/index.test.ts lib/rules/advice-evaluation.test.ts && pnpm typecheck`

Expected: PASS.

```bash
git add lib/rng/index.ts lib/domain/index.ts lib/rules/advice-evaluation.ts lib/rules/advice-evaluation.test.ts
git commit -m "규칙: E2 생태 공개와 조언 후보를 판정한다" -m "활성 규칙을 결정적으로 공개하고 조건부 장면 조건과 조언 순서를 재현 가능하게 처리한다."
```

### Task 5: 개인 반응·실행 결정·즉시 신뢰 검증을 구현한다

**Files:**

- Modify: `lib/rules/advice-evaluation.ts`, `lib/rules/advice-evaluation.test.ts`

**Interfaces:**

```ts
export interface CampaignReactionModifier { accept: number; expose: number }
export function decideImmediateAdvice(input: {
  campaignSeed: string; dungeonId: DungeonId; attempt: number; depth: number;
  event: SituationEvent; adviceId: ChoiceId; members: readonly Character[];
  campaignModifier?: CampaignReactionModifier;
}): AdviceDecision
export function finalizeImmediateAdviceTrust(input: {
  decision: AdviceDecision; members: readonly Character[];
  applied: { executed: boolean; resultText: string };
}): AdviceResolution
```

- [ ] **Step 1: 확률표와 실행·신뢰 순서의 실패 테스트를 작성한다.**

fixture에 fixed `CharacterId` 세 개를 써서 help/neutral accept 5~95 clamp, harm expose 5~80 clamp, harm accept 상한 `95 - expose`, 정의로운 neutral accept 보정 0, harm에서만 exposed를 각각 단정한다. 동일 입력 재현성 및 멤버 추가/삭제가 다른 ID의 결과를 바꾸지 않는 것도 단정한다. 이어서 1/2/3명 accepted가 모두 `executed: true`, 0명은 false, exposed와 accepted 공존도 true를 단정한다. `adviceHelped`, `adviceHarmed`, `suspicionWasCostly`, `suspicionWasCorrect`, exposed의 두 action 순서를 각각 입력 고정 RNG로 검증한다.

Run: `pnpm test lib/rules/advice-evaluation.test.ts`

Expected: FAIL. 반응과 resolution 함수가 없다.

- [ ] **Step 2: 확률 계산과 characterId 독립 roll을 구현한다.**

비공개 `reactionProbabilities(member, outcome, campaignModifier)`를 만든다. trust 구간과 성격 표를 합산하고 Spec 순서대로 clamp한다. 각 인물의 roll은 `createRng(`${campaignSeed}:${dungeonId}:attempt:${attempt}:depth:${depth}:event:${event.id}:advice:${adviceId}:character:${member.id}`).derive("card").int(1,100)` 하나만 사용한다. help/neutral은 accept 뒤 suspected, harm은 expose→accept→suspected 구간으로 해석한다. `alive === false` 인물은 결과에 넣지 않는다.


- [ ] **Step 3: 실행 결정과 효과 적용 뒤 신뢰 후속 판정을 구현한다.**

`decideImmediateAdvice()`는 선택한 advice가 event에 없거나 살아 있는 인물이 없으면 각각 `INVALID_GENERATION`/`INVALID_STATE`로 실패한다. accepted가 하나 이상이면 `executed: true`; 아니면 false인 `AdviceDecision`을 반환한다. 보스 정보는 다음 Task에서 별도 처리한다. `finalizeImmediateAdviceTrust()`는 E3의 `applied.executed`가 decision과 다르면 `INVALID_STATE`로 실패하고, 일치할 때만 `evaluateTrust()`에 trust stream을 action 순서별로 derive해 전달한다. executed면 accepted help/harm만, 미실행이면 suspected help/harm만, exposed harm은 실행 여부와 무관하게 `adviceHarmed` 뒤 `deceptionExposed`를 기록한다. neutral과 executed 상태 suspected에는 trust change가 없다.

- [ ] **Step 4: E3 경계가 효과를 적용하지 않음을 검증한다.**

merchant fixture를 넣어 `decideImmediateAdvice()`가 골드·HP·`pendingMerchantEffect`를 바꾸지 않고 decision만 반환하는지 단정한다. 별도 테스트에서 E3 적용 결과와 같은 `applied.executed`를 넘긴 뒤에만 `finalizeImmediateAdviceTrust()`가 trust change를 반환하는지 단정한다. 실제 merchant 적용은 `applyAcceptedMerchantAdvice()`의 기존 테스트 범위에 그대로 둔다.

- [ ] **Step 5: 즉시 판정 단위를 검증하고 커밋한다.**

Run: `pnpm test lib/rules/advice-evaluation.test.ts lib/rules/trust.test.ts lib/rules/merchant.test.ts && pnpm typecheck`

Expected: PASS.

```bash
git add lib/rules/advice-evaluation.ts lib/rules/advice-evaluation.test.ts
git commit -m "규칙: 조언 반응과 즉시 신뢰를 판정한다" -m "파티원별 반응을 독립 난수로 계산하고 실행 여부와 결과 기반 신뢰 행동을 분리한다."
```

### Task 6: 보스 정보 지연 기록과 Depth 계획을 구현한다

**Files:**

- Modify: `lib/rules/advice-evaluation.ts`, `lib/rules/advice-evaluation.test.ts`
- Modify: `lib/domain/advice.test.ts`

**Interfaces:**

```ts
export interface BossInfoDepthPlan { reservedDepths: readonly number[] }
export function planBossInfoDepths(input: {
  campaignSeed: string; dungeonId: DungeonId; attempt: number;
  riskLevel: RiskLevel; map: GeneratedMap;
}): BossInfoDepthPlan
export function resolveBossInfoAdvice(input: Parameters<typeof decideImmediateAdvice>[0]): AdviceResolution
```

- [ ] **Step 1: 계획·지연 기록 실패 테스트를 작성한다.**

`generateDungeonMap()`으로 위험도 1~5 지도를 만들고 ★1~2에는 하나, ★3~5에는 둘의 Depth가 있음을 단정한다. 첫·마지막 Depth 제외, 둘일 때 전반/후반 구간 분리, 동일 입력 재현성, attempt 변경 시 다른 계획 가능성을 검증한다. 모든 map layer를 지나가는 경로의 예약 횟수도 단정한다. 보스 advice 반응 fixture에서는 accepted help/harm/suspected help/harm만 `pendingVerification: true`, accepted neutral/exposed harm은 false이며 modifier 표와 exposed의 즉시 trust action을 단정한다.

Run: `pnpm test lib/rules/advice-evaluation.test.ts lib/domain/advice.test.ts`

Expected: FAIL. 보스 계획과 전용 resolution이 없다.

- [ ] **Step 2: 보스 Depth 계획을 구현한다.**

`map.layers.length`를 N으로 사용하고 `planBossInfoDepths()`는 N=6~8만 허용한다. risk 1~2는 `[floor(N/2)+1, N-1]`, risk 3~5는 `[2, floor(N/2)]`와 `[floor(N/2)+1, N-1]`에서 각각 하나를 `createRng(`${campaignSeed}:${dungeonId}:attempt:${attempt}:risk:${riskLevel}`).derive("event")`로 고른다. 유효하지 않은 map, 범위 밖 Depth, 중복은 `INVALID_GENERATION`이다. 반환 배열은 오름차순으로 고정한다.

- [ ] **Step 3: 보스 정보 resolution을 구현한다.**

현재 던전 boss와 event.targetBossId가 다르거나, help/harm이 해당 boss rule을 참조하지 않으면 `INVALID_GENERATION`이다. 반응 계산은 Task 5를 재사용하되, accepted에는 outcome별 `-0.2/-0.1/+0.25`, suspected/exposed에는 `0` modifier의 `InfoRecord`를 만든다. pendingVerification은 Spec 표대로 설정하고, exposed harm만 즉시 `adviceHarmed`→`deceptionExposed`를 적용한다. accepted/suspected의 결과 기반 trust action은 이 함수에서 적용하지 않는다.

- [ ] **Step 4: E3 예약 경계를 명시적으로 보존한다.**

`BossInfoDepthPlan`에는 강한 연계 배열이나 충돌 검사 함수를 넣지 않는다. 테스트에는 E3가 이 `reservedDepths`를 제외해 후속 계획을 만들 수 있는 단순 배열 계약만 둔다. 강한 연계 계획·충돌 실패의 구현은 E3 Plan의 범위다.

- [ ] **Step 5: 보스 계획 단위를 검증하고 커밋한다.**

Run: `pnpm test lib/rules/advice-evaluation.test.ts lib/rules/dungeon-map.test.ts lib/domain/advice.test.ts && pnpm typecheck`

Expected: PASS.

```bash
git add lib/rules/advice-evaluation.ts lib/rules/advice-evaluation.test.ts lib/domain/advice.test.ts
git commit -m "규칙: 보스 정보 Depth와 지연 기록을 만든다" -m "위험도별 보스 정보 기회를 예약하고 보스전 뒤 검증할 개인 기록을 남긴다."
```

### Task 7: 공식 문서와 작업 배정표를 최신 규칙으로 정합화한다

**Files:**

- Modify: `docs/GAME_PRINCIPLES.md`, `docs/design/GAME_OVERVIEW.md`, `docs/design/CORE_GAME_LOOP.md`
- Modify: `docs/systems/DUNGEON_THEMES_AND_ECOLOGY.md`, `docs/systems/INFORMATION_AND_DECEPTION.md`, `docs/systems/CHARACTERS_AND_TRUST.md`, `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`
- Modify: `docs/experience/SCREEN_LAYOUT.md`, `docs/experience/ONBOARDING_AND_INTERFACE.md`
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`, `docs/superpowers/specs/2026-08-19-lattebun-campaign-rework-design.md`
- Modify: `docs/DOCUMENT_TERMINOLOGY.test.ts`, `docs/DOCUMENT_LINKS.test.ts` when document link text or known terminology fixtures require it

- [ ] **Step 1: 문서 불일치 검색을 실패 기준으로 고정한다.**

다음 명령을 실행해 현재 규칙과 충돌하는 문구를 확인한다.

```bash
rg -n '공개 환경 특성|deceptionAccepted|단서 목록을 화면에 상시 표시|선택 뒤.*정합|선택 뒤.*모순|답사 기록.*활성 생태' docs --glob '*.md'
```

Expected: 구현 전 문서에는 오래된 공개 환경 특성·카드 수용·정답 공개 서술이 남아 있다.

- [ ] **Step 2: 공식 문서의 정보 공개·신뢰·책임 경계를 갱신한다.**

Spec 16절의 각 대상 문서에 다음을 반영한다: 게시판·계약에서 공개 환경 특성/생태 규칙 제거, 원정 시작 뒤 3/2/1 공개, 진행 기록의 확인된 생태·관찰 단서 분리, 정답 enum 비공개, `adviceHelped`/`adviceHarmed`와 `deceptionAccepted` 제거, E2 Depth 계획/E3 방문 물질화와 충돌 회피, 효과 적용 E3·판정 E2 경계. `GAME_PRINCIPLES.md`의 중심 원칙은 세부 수치로 바꾸지 않는다.

- [ ] **Step 3: 배정표와 역사 Spec 상태를 갱신한다.**

배정표의 C2/U3 완료 기준에서 환경 특성을 제거하고 E2 완료 기준을 C1 `activeRuleIds` 소비·조건부 선언·독립 반응·E2 `executed` 결정·보스 Depth 계획으로 바꾼다. E3에는 E2 plan 입력·충돌 검증·효과 적용을 명시한다. 2026-08-19 역사 Spec에는 최신 E1/E2 및 공식 문서가 현재 근거라는 상태 문구만 추가한다.

- [ ] **Step 4: 문서 테스트와 용어 검색을 통과시킨다.**

Run: `pnpm test docs/DOCUMENT_TERMINOLOGY.test.ts docs/DOCUMENT_LINKS.test.ts && rg -n 'deceptionAccepted|공개 환경 특성' docs/GAME_PRINCIPLES.md docs/design docs/systems docs/experience docs/technical --glob '*.md'`

Expected: 테스트 PASS. 역사 기록과 E2 Spec 자체를 제외한 현재 공식 문서에는 폐기한 규칙이 남지 않는다; 남기는 역사 문서는 현재 근거가 아님을 명시한다.

- [ ] **Step 5: 문서 정합화 단위를 커밋한다.**

```bash
git add docs
git commit -m "문서: E2 조언 판정 규칙을 반영한다" -m "생태 공개 시점과 결과 기반 신뢰, E2와 E3의 책임 경계를 공식 문서에 맞춘다."
```

### Task 8: 전체 검증과 변경 단위 검토를 마친다

**Files:**

- Verify only: 변경된 모든 파일

- [ ] **Step 1: 정적 검사와 전체 테스트를 실행한다.**

Run: `pnpm lint && pnpm typecheck && pnpm test`

Expected: 모두 exit code 0. 새 E2 테스트와 기존 콘텐츠·C1·E1·U3 테스트가 함께 통과한다.

- [ ] **Step 2: 빌드와 환경 특성 잔재를 검사한다.**

Run: `pnpm build && rg -n 'PublicEnvironmentTag|EnvironmentTagDefinition|publicEnvironmentTag|environmentLabel|deceptionAccepted' lib components app --glob '*.{ts,tsx}'`

Expected: build PASS. 코드 검색은 모두 0건이며, 필요한 역사 문서 설명만 `docs/`에 남는다.

- [ ] **Step 3: 변경 범위와 커밋을 검토한다.**

Run: `git status --short && git log --oneline --max-count=8 && git diff HEAD~7..HEAD --check`

Expected: E2 작업 파일만 커밋되어 있고, 사용자가 소유한 미추적 파일은 스테이징·삭제·수정하지 않는다.

## Self-Review

- Spec coverage: 공개 환경 특성 제거(Task 1), 조건부 계약(Task 2), UI 은닉(Task 3~4), 반응·실행·즉시 신뢰(Task 5), 보스 지연 기록과 Depth(Task 6), 문서·배정표(Task 7), 전체 검증(Task 8)으로 1~17절을 모두 연결했다.
- Scope boundary: 일반 사건 효과와 E3 강한 연계 계획은 구현하지 않는다. Task 5는 `executed` 결정만, Task 6은 `BossInfoDepthPlan`만 제공한다.
- Type consistency: Task 3의 공개 DTO와 `AdviceResolution`을 Task 4~6이 소비하며, `BossInfoDepthPlan.reservedDepths`만 E3가 이후 소비한다.
