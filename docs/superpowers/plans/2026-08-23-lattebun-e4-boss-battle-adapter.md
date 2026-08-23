# E4 보스전 어댑터 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공통 `BattleEngine`으로 보스전을 해결하고, `BossRule` 기반 개인 modifier·사후 신뢰 검증·결정적 presentation cue를 C4와 U5-2가 소비할 수 있게 만든다.

**Architecture:** 보스 trait와 임시 multiplier는 콘텐츠 카탈로그 한 곳에 두고, E2는 지연 기록에 `BossRuleId`만 보존한다. E4 adapter는 현재 던전·테마 콘텐츠·지연 기록을 검증해 공통 엔진의 캐릭터별 static 입력으로 변환한 뒤, 전투 결과·생존자·검증 근거를 `BossResult`로 반환한다. 일반 monster 전투는 기존 class 기반 보정 API를 유지하고, 새 member-ID 입력의 기본값 `1.0`으로 동작을 보존한다.

**Tech Stack:** TypeScript, Vitest, Next.js 16.3, pnpm

**Spec:** `docs/superpowers/specs/2026-08-22-lattebun-e4-boss-battle-adapter-design.md`

## Global Constraints

- 일반전과 보스전은 하나의 공통 `BattleEngine`만 사용하며 보스 전용 공격 루프를 만들지 않는다.
- 보스 정보 modifier는 수용한 살아 있는 참가자 개인에게만 적용한다.
- 계산 축은 static `targetWeight`, `incomingDamage`, `outgoingDamage` 세 개뿐이다.
- E4 임시값은 target/incoming help `×0.80`, harm `×1.25`; outgoing help `×1.25`, harm `×0.80`; 최종값은 `0.70..1.50` clamp다.
- 보스 종류는 초기 위험도로 고정하고, `1 + (currentRiskLevel - initialRiskLevel) × 0.10`으로 HP·공격력을 scaling한다. attempt 수는 scaling 입력이 아니다.
- `neutral`·`suspected`·`exposed`는 전투 modifier를 만들지 않으며 exposed는 지연 검증하지 않는다.
- 전투 종료 때 죽은 인물에게는 지연 trust 변화를 적용하지 않는다.
- UI는 E4/E3 action record와 cue를 재생할 뿐 RNG·피해·신뢰를 재계산하지 않는다.
- E4는 명성·골드·위험도·월드턴·승급·엔딩 정산을 직접 변경하지 않는다.
- 모든 결정적 배열은 명시적 ID 정렬/우선순위를 사용하며 입력 배열·object iteration 순서에 의존하지 않는다.
- 커밋 제목과 본문은 한국어로 작성한다.

---

## File Structure

- `lib/content/boss-traits.ts`: 24개 shipped `BossRuleId`의 trait/axis mapping, 임시 multiplier·clamp, 결정적 cue 우선순위를 제공한다.
- `lib/content/theme-validation.ts`: 보스당 rule 2개 및 모든 shipped rule의 정확히 하나인 trait mapping을 검증한다.
- `lib/domain/info.ts`, `lib/domain/content.ts`: 구형 단일 피해 수치를 제거하고 E4가 필요한 `bossRuleId` 지연 기록을 정의한다.
- `lib/domain/expedition.ts`: `BattleResolution` 기반 `BossResult`, applied record, verification metadata, presentation cue를 정의한다.
- `lib/rules/battle-engine.ts`: 캐릭터 ID별 static target/incoming/outgoing multiplier를 소비한다.
- `lib/rules/advice-evaluation.ts`: help/harm의 accepted·suspected 보스 정보만 `BossRuleId`와 함께 보존한다.
- `lib/rules/boss-battle-adapter.ts`: 보스 조회·입력 조립·merchant 소비·전투·사후 검증을 한 순수 규칙으로 연결한다.
- 기존 `*.test.ts`: 각 계층의 실패 사례와 결정성을 고정한다.
- `docs/systems/*.md`, `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`: E4 계약과 선행/완료 기준을 공식 문서에 맞춘다.

### Task 1: BossTrait 카탈로그와 콘텐츠 검증

**Files:**
- Create: `lib/content/boss-traits.ts`
- Create: `lib/content/boss-traits.test.ts`
- Modify: `lib/content/theme-validation.ts`
- Modify: `lib/content/theme-validation.test.ts`
- Modify: `lib/content/themes.ts`

**Interfaces:**
- Produces: `BossTraitId`, `BossTraitAxis`, `BossTrait`, `BOSS_RULE_TRAITS`, `modifierForBossInfo(axis, outcome)`, `validateBossTraitMappings(themes)`.
- Consumes: `ThemeContent`, `BossRuleId`, `AdviceOutcome`, `RuleError`.

- [ ] **Step 1: Write failing catalog and validation tests**

```ts
expect(BOSS_RULE_TRAITS).toHaveLength(24);
expect(() => validateBossTraitMappings(THEMES)).not.toThrow();
expect(() => validateBossTraitMappings([themeWithUnmappedRule])).toThrow(/trait mapping/);
expect(() => validateThemes([themeWithOneBossRule])).toThrow(/보스 특징이 정확히 2개/);
expect(modifierForBossInfo("incomingDamage", "help")).toBe(0.8);
expect(modifierForBossInfo("outgoingDamage", "harm")).toBe(0.8);
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `pnpm test lib/content/boss-traits.test.ts lib/content/theme-validation.test.ts`

Expected: FAIL because the catalog exports and exact-two-rule validation do not exist.

- [ ] **Step 3: Implement the central catalog and validators**

```ts
export type BossTraitAxis = "targetWeight" | "incomingDamage" | "outgoingDamage";
export const BOSS_INFO_MULTIPLIERS = {
  targetWeight: { help: 0.8, harm: 1.25 },
  incomingDamage: { help: 0.8, harm: 1.25 },
  outgoingDamage: { help: 1.25, harm: 0.8 },
} as const;
export const BOSS_INFO_MULTIPLIER_LIMITS = { min: 0.7, max: 1.5 } as const;
```

Add all 24 mappings from the Spec table, reject every boss with a rule count other than two, and reject missing or duplicate mappings with `RuleError("INVALID_GENERATION", ...)`. Call `validateBossTraitMappings(THEMES)` beside existing theme validation so shipped content fails at module initialization.

- [ ] **Step 4: Run the focused tests and confirm pass**

Run: `pnpm test lib/content/boss-traits.test.ts lib/content/theme-validation.test.ts`

Expected: PASS; shipped 12 bosses/24 rules pass and each malformed fixture fails.

- [ ] **Step 5: Commit the catalog boundary**

```bash
git add lib/content/boss-traits.ts lib/content/boss-traits.test.ts lib/content/theme-validation.ts lib/content/theme-validation.test.ts lib/content/themes.ts
git commit -m "기능: 보스 특성 카탈로그를 추가한다" -m "24개 보스 규칙의 전투 축과 임시 보정값을 중앙화한다."
```

### Task 2: 지연 보스 정보와 보스 결과 도메인 계약 이관

**Files:**
- Modify: `lib/domain/content.ts`
- Modify: `lib/domain/info.ts`
- Modify: `lib/domain/expedition.ts`
- Modify: `lib/domain/index.ts`
- Modify: `lib/domain/advice.test.ts`
- Modify: `lib/domain/contract.test.ts`

**Interfaces:**
- Produces: required `InfoRecord.bossRuleId`; `BossInfoApplication`, `BossInfoVerification`, `BossInfoPresentationCue`; `BossResult` containing `battle`, `survivorIds`, `status`, applications, verifications and cues.
- Consumes: `BossRuleId`, `CharacterId`, `BattleResolution`, `TrustChange`.

- [ ] **Step 1: Write failing domain contract tests**

```ts
const record: InfoRecord = {
  eventId: "boss-info-1" as EventId, adviceId: "help-1" as ChoiceId,
  outcome: "help", characterId, reaction: "accepted", bossRuleId,
  pendingVerification: true,
};
expect(record.bossRuleId).toBe(bossRuleId);
expectTypeOf<BossResult>().toMatchTypeOf<{
  battle: BattleResolution; survivorIds: readonly CharacterId[]; status: "cleared" | "wiped";
}>();
```

Add a compile-time negative fixture proving `bossDamageModifier` is no longer an `AdviceOption` field.

- [ ] **Step 2: Run the affected domain tests and confirm failure**

Run: `pnpm test lib/domain/advice.test.ts lib/domain/contract.test.ts`

Expected: FAIL because `InfoRecord` has only `modifier` and `BossResult` uses `BossTurnRecord[]`.

- [ ] **Step 3: Replace the old contracts without a compatibility computation path**

Remove `BaseAdviceOption.bossDamageModifier` and `InfoRecord.modifier`. Make `bossRuleId` mandatory for delayed help/harm records. Replace `BossTurnRecord` storage with the common `BattleResolution` and typed metadata; an application includes record identity and axis/direction, verification includes record identity/action/character ID, and a cue contains the Spec timing/axis/direction/presentation key. Export all new public types from `lib/domain/index.ts`.

- [ ] **Step 4: Run the affected domain tests and typecheck**

Run: `pnpm test lib/domain/advice.test.ts lib/domain/contract.test.ts && pnpm typecheck`

Expected: PASS; no public type still permits a content-owned boss damage number.

- [ ] **Step 5: Commit the domain migration**

```bash
git add lib/domain/content.ts lib/domain/info.ts lib/domain/expedition.ts lib/domain/index.ts lib/domain/advice.test.ts lib/domain/contract.test.ts
git commit -m "기능: 보스 정보 지연 기록 계약을 이관한다" -m "보스 규칙 식별자와 전투 결과 메타데이터를 도메인에 추가한다."
```

### Task 3: E2 보스 정보 기록과 콘텐츠 수치 제거

**Files:**
- Modify: `lib/rules/advice-evaluation.ts`
- Modify: `lib/rules/advice-evaluation.test.ts`
- Modify: `lib/content/events/spider-events.ts`
- Modify: `lib/content/events/desert-events.ts`
- Modify: `lib/content/events/graveyard-events.ts`
- Modify: `lib/content/{spider-events,desert-events,graveyard-events}.test.ts`
- Modify: `lib/content/situation-validation.ts`
- Modify: `lib/content/situation-validation.test.ts`

**Interfaces:**
- Consumes: Task 2 `InfoRecord` and each boss advice option's `source.kind === "boss"` / `source.bossRuleId`.
- Produces: only non-neutral, non-exposed accepted/suspected records; each carries the selected option's `bossRuleId`.

- [ ] **Step 1: Write failing E2 tests**

```ts
expect(result.decision.delayedRecords[0]).toMatchObject({
  outcome: "help", reaction: "accepted", bossRuleId: "boss-ragna-turning",
});
expect(neutralBossResult.decision.delayedRecords).toEqual([]);
expect(exposedHarmResult.decision.delayedRecords).toEqual([]);
expect(bossAdvice).not.toHaveProperty("bossDamageModifier");
```

- [ ] **Step 2: Run the affected tests and confirm failure**

Run: `pnpm test lib/rules/advice-evaluation.test.ts lib/content/spider-events.test.ts lib/content/desert-events.test.ts lib/content/graveyard-events.test.ts lib/content/situation-validation.test.ts`

Expected: FAIL because the current helpers populate numeric `bossDamageModifier` and keep neutral/exposed records.

- [ ] **Step 3: Implement record preservation by rule identity**

Delete the optional numeric parameter from all themed event helper functions and remove all literal modifier values. In `resolveBossInfoAdvice`, require a boss source for help/harm, create records only for accepted/suspected help/harm reactions, copy `source.bossRuleId`, and keep exposed's immediate trust behavior unchanged. Update validation to reject any help/harm boss advice without its boss rule source.

- [ ] **Step 4: Run the affected tests and confirm pass**

Run: `pnpm test lib/rules/advice-evaluation.test.ts lib/content/spider-events.test.ts lib/content/desert-events.test.ts lib/content/graveyard-events.test.ts lib/content/situation-validation.test.ts`

Expected: PASS; no event content contains a combat multiplier and all delayed records retain rule identity.

- [ ] **Step 5: Commit the E2 migration**

```bash
git add lib/rules/advice-evaluation.ts lib/rules/advice-evaluation.test.ts lib/content/events lib/content/spider-events.test.ts lib/content/desert-events.test.ts lib/content/graveyard-events.test.ts lib/content/situation-validation.ts lib/content/situation-validation.test.ts
git commit -m "기능: 보스 정보 기록을 규칙 식별자로 보존한다" -m "사건 콘텐츠의 구형 피해 수치를 제거하고 지연 검증 대상을 정리한다."
```

### Task 4: 공통 BattleEngine의 캐릭터별 static modifier 입력

**Files:**
- Modify: `lib/rules/battle-engine.ts`
- Modify: `lib/rules/battle-engine.test.ts`
- Modify: `lib/rules/expedition-events.ts`
- Modify: `lib/rules/expedition-events.test.ts`

**Interfaces:**
- Produces: optional `targetWeightMultiplierByMemberId`, `incomingDamageMultiplierByMemberId`, `outgoingDamageMultiplierByMemberId` in `BattleInput`.
- Preserves: existing class-keyed `targetWeightMultipliers`, enemy target weight, global party/incoming multipliers and monster battle callers.

- [ ] **Step 1: Write failing engine tests**

```ts
expect(enemyTargetsForSeed({ warriorA: 0.1, warriorB: 10 })).toContain("warrior-b");
expect(partyAttackDamage({ [warriorA]: 1.25 })).toBe(8);
expect(enemyDamage({ [warriorA]: 0.8 })).toBe(4);
expect(resolveBattle(input)).toEqual(resolveBattle(input));
```

Use two party members with the same `classId` to prove target weights are keyed by `member.id`, and add an unchanged monster-event regression test with no member maps.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `pnpm test lib/rules/battle-engine.test.ts lib/rules/expedition-events.test.ts`

Expected: FAIL because outgoing and member-specific target inputs do not exist.

- [ ] **Step 3: Add the three static member-ID multipliers**

In party attacks multiply `member.attack` by global `partyDamageMultiplier` and `outgoingDamageMultiplierByMemberId[member.id] ?? 1`. In enemy target selection multiply the current class and enemy weights by `targetWeightMultiplierByMemberId[member.id] ?? 1`. Keep the maps immutable and read them only during resolution; never update them for HP, elapsed rounds, attacks, or enemy HP.

- [ ] **Step 4: Run the focused tests and confirm pass**

Run: `pnpm test lib/rules/battle-engine.test.ts lib/rules/expedition-events.test.ts`

Expected: PASS; same seed/input preserves full action order and general encounters retain current behavior.

- [ ] **Step 5: Commit the engine extension**

```bash
git add lib/rules/battle-engine.ts lib/rules/battle-engine.test.ts lib/rules/expedition-events.ts lib/rules/expedition-events.test.ts
git commit -m "기능: 전투 엔진에 개인별 정적 보정 입력을 추가한다" -m "보스와 일반전이 같은 전투 코어를 공유하도록 확장한다."
```

### Task 5: E4 adapter의 입력 조립·사후 검증·cue

**Files:**
- Modify: `lib/rules/boss-battle-adapter.ts`
- Modify: `lib/rules/boss-battle-adapter.test.ts`
- Modify: `lib/rules/trust.ts`
- Modify: `lib/rules/trust.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4, `CampaignDungeon`, `ThemeContent`, party `Character[]`, delayed `InfoRecord[]`, `PendingMerchantEffect | null`, seed.
- Produces: `resolveBossBattle(input): { bossResult: BossResult; members: readonly Character[]; trustChanges: readonly TrustChange[]; pendingMerchantEffect: null }`.

- [ ] **Step 1: Write failing adapter tests for the full contract**

```ts
expect(result.bossResult.status).toBe("cleared");
expect(result.bossResult.survivorIds).toEqual([survivor.id]);
expect(result.bossResult.applications).toContainEqual(expect.objectContaining({
  characterId: accepted.id, bossRuleId, axis: "incomingDamage", direction: "beneficial",
}));
expect(result.bossResult.verifications).toContainEqual(expect.objectContaining({ action: "adviceHelped" }));
expect(result.members.find(m => m.id === dead.id)?.trust).toBe(dead.trust);
expect(result.pendingMerchantEffect).toBeNull();
```

Cover accepted help/harm, suspected help/harm, neutral/exposed omission, two records multiplying and clamping, per-member isolation, mismatched boss/rule/nonparticipant/double-consumption errors, merchant composition and one-time consumption, current-risk scaling/★5 cap, deterministic action/cue arrays, one surviving clear, and wipe.

- [ ] **Step 2: Run the adapter tests and confirm failure**

Run: `pnpm test lib/rules/boss-battle-adapter.test.ts lib/rules/trust.test.ts`

Expected: FAIL because the adapter accepts a precomputed incoming-damage map and returns no applications, cues, verification, or member state.

- [ ] **Step 3: Implement deterministic assembly and result projection**

Change input to receive `dungeon`, `theme`, `members`, `infoRecords`, seed, and pending merchant effect. Resolve `theme.bosses` by `dungeon.bossId`, reject theme/boss/rule mismatch, compute risk scale from current minus initial risk, sort eligible records by `characterId`, then `bossRuleId`, then `eventId`/`adviceId`, and build the three member-ID maps via Task 1 catalog values and final clamp.

Call `consumePendingMerchantEffect` once and only map its existing incoming/party-damage meanings to the common engine; reject unsupported merchant shapes. Project battle HP/alive values back to all campaign members. For each applicable accepted record and each eligible suspected record, produce exactly one verification metadata entry; call `evaluateTrust` only for a member alive at battle end, using a seed derived from battle seed plus record identity and action. Build at most one cue per action by an explicit ordering such as `beforeTarget` targetWeight, `beforeDamage` incomingDamage, `afterDamage` outgoingDamage, then lexical record identity.

- [ ] **Step 4: Run adapter/trust tests and full rules suite**

Run: `pnpm test lib/rules/boss-battle-adapter.test.ts lib/rules/trust.test.ts && pnpm test lib/rules`

Expected: PASS; all paths use `resolveBattle`, dead members receive zero delayed trust delta, and repeated calls are deeply equal.

- [ ] **Step 5: Commit the E4 rule**

```bash
git add lib/rules/boss-battle-adapter.ts lib/rules/boss-battle-adapter.test.ts lib/rules/trust.ts lib/rules/trust.test.ts
git commit -m "기능: 보스전 어댑터와 사후 검증을 구현한다" -m "공통 전투 결과에서 개인 보정과 결정적 재생 정보를 만든다."
```

### Task 6: 누적 고발·공식 문서·배정표 정합성

**Files:**
- Modify: `docs/systems/INFORMATION_AND_DECEPTION.md`
- Modify: `docs/systems/DUNGEON_THEMES_AND_ECOLOGY.md`
- Modify: `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`
- Modify: `docs/systems/CHARACTERS_AND_TRUST.md`
- Modify: `docs/systems/PROGRESSION_AND_ENDINGS.md`
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`
- Modify: `docs/DOCUMENT_TERMINOLOGY.test.ts`
- Modify: `docs/DOCUMENT_LINKS.test.ts`

**Interfaces:**
- Produces: C6가 사용할 누적 고발 정의 `alive === true && trust === 0`; E4의 trait·cue·사후 검증 책임이 명시된 공식 문서.

- [ ] **Step 1: Write failing document contract tests**

```ts
expect(read("CHARACTERS_AND_TRUST.md")).toContain("alive === true && trust === 0");
expect(read("PROGRESSION_AND_ENDINGS.md")).toContain("살아 있는 trust-0 캐릭터 5명");
expect(read("DUNGEON_EVENTS_AND_BOSSES.md")).not.toContain("accepted neutral: -10%");
```

- [ ] **Step 2: Run document tests and confirm failure**

Run: `pnpm test docs/DOCUMENT_LINKS.test.ts docs/DOCUMENT_TERMINOLOGY.test.ts`

Expected: FAIL until every official document and the assignment row use the E4 terminology.

- [ ] **Step 3: Update all referenced official contracts**

Keep the already-approved three-axis temporary values and risk scaling; add the required BossRule-to-trait contract, accepted/suspected record retention, dead-member trust exclusion, cue replay-only rule, and alive-only cumulative denouncement definition. Mark E4 completed only when implementation is actually complete; do not claim C4 rewards or C6 ending logic are implemented by E4.

- [ ] **Step 4: Run document tests and confirm pass**

Run: `pnpm test docs/DOCUMENT_LINKS.test.ts docs/DOCUMENT_TERMINOLOGY.test.ts`

Expected: PASS; no official document retains the single-damage/neutral-bonus contract.

- [ ] **Step 5: Commit documentation consistency**

```bash
git add docs/systems docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md docs/DOCUMENT_TERMINOLOGY.test.ts docs/DOCUMENT_LINKS.test.ts
git commit -m "문서: E4 보스전 계약을 설정집에 반영한다" -m "보스 특성, 재도전 scaling, 지연 신뢰와 누적 고발 기준을 통일한다."
```

### Task 7: 전체 회귀 검증과 완료 기록

**Files:**
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`
- Test: repository-wide lint, typecheck, test, build

**Interfaces:**
- Verifies: Tasks 1–6 public APIs, deterministic adapter results, no UI recomputation responsibility, and unchanged general combat behavior.

- [ ] **Step 1: Run focused E4 regression set**

Run: `pnpm test lib/content/boss-traits.test.ts lib/content/theme-validation.test.ts lib/rules/advice-evaluation.test.ts lib/rules/battle-engine.test.ts lib/rules/boss-battle-adapter.test.ts`

Expected: PASS; all 41 Spec test contracts have direct coverage across the focused suites.

- [ ] **Step 2: Run repository validation**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`

Expected: all commands exit 0.

- [ ] **Step 3: Record actual E4 completion only after green verification**

Update E4's assignment row from `🟡` to `✅`, replace old single-damage wording with BossTrait/personal modifier/verification/cue wording, and leave C4/C6 dependency rows pending.

- [ ] **Step 4: Re-run documentation and repository checks after the status edit**

Run: `pnpm test docs/DOCUMENT_LINKS.test.ts docs/DOCUMENT_TERMINOLOGY.test.ts && git diff --check`

Expected: PASS and no whitespace errors.

- [ ] **Step 5: Commit the completion record**

```bash
git add docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md
git commit -m "문서: E4 보스전 완료 상태를 기록한다" -m "전체 검증을 통과한 보스전 어댑터의 완료 기준을 반영한다."
```

## Plan Self-Review

- **Spec coverage:** Tasks 1–3 cover 24 rules, trait mapping, record identity and content migration; Task 4 covers the shared static engine inputs; Task 5 covers adapter assembly, merchant consumption, scaling, result projection, verification and cues; Task 6 records the cross-system trust/ending constraints; Task 7 verifies all requirements before marking E4 complete.
- **Intentional boundary:** C4 settlement and C6's future runtime denouncement counter are not implemented here. E4 produces survivor/trust facts and documents the alive-only contract for those owners.
- **No duplicate combat logic:** Task 5 calls Task 4's `resolveBattle`; it does not define target selection or damage loops.
- **Completeness check:** all introduced public identifiers, inputs, outputs, values, test commands, and commit messages are defined above.
