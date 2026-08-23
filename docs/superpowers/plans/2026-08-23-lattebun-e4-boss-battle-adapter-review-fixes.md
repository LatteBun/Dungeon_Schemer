# E4 보스전 어댑터 리뷰 보완 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** E4 보스전 어댑터가 최종 1회 clamp, action 귀속 cue, 모순 없는 종료 상태, 안정적인 신뢰도 순서를 보장하도록 PR #103의 리뷰 항목을 반영한다.

**Architecture:** 보스 정보와 merchant의 raw multiplier는 캐릭터·축별로 끝까지 곱한 다음 `boss-traits.ts`의 중앙 clamp를 단 한 번 적용한다. cue는 application 목록이 아니라 `BattleResolution.actions`를 순회해 만들어 `actionIndex`로 재생 대상을 확정하고, 50턴 제한은 정산 가능한 승패가 아니므로 진단 가능한 `RuleError`로 중단한다.

**Tech Stack:** TypeScript, Vitest, Next.js 16.3, pnpm

**Spec:** `docs/superpowers/specs/2026-08-22-lattebun-e4-boss-battle-adapter-design.md`

## Global Constraints

- 일반전과 보스전은 하나의 공통 `BattleEngine`만 사용하며 보스 전용 공격 루프를 만들지 않는다.
- bossInfo modifier는 수용한 살아 있는 참가자 개인에게만 적용하고, 축은 static `targetWeight`, `incomingDamage`, `outgoingDamage` 세 개로 제한한다.
- E4 임시값은 target/incoming help `×0.80`, harm `×1.25`; outgoing help `×1.25`, harm `×0.80`이며 `base × bossInfo들 × merchant`의 **최종값만** 중앙 카탈로그의 `0.70..1.50`으로 clamp한다.
- `neutral`·`suspected`·`exposed`는 전투 modifier를 만들지 않고, 전투 종료 때 죽은 인물에게는 지연 trust 변화를 적용하지 않는다.
- UI는 action record와 E4 cue를 재생만 하며 RNG·피해·신뢰·cue 우선순위를 재계산하지 않는다.
- `cleared`는 보스 처치와 생존자 1명 이상, `wiped`는 생존자 0명만 의미한다. `roundLimit`은 어느 결과로도 투영하지 않는다.
- 모든 결정적 배열은 `characterId → bossRuleId → eventId → adviceId` 및 명시적인 cue 우선순위를 사용하며 입력 배열·object iteration 순서에 의존하지 않는다.
- 커밋 제목과 본문은 한국어로 작성한다.

---

## File Structure

- `lib/content/boss-traits.ts`: modifier 최종 clamp와 action 내 cue 축 우선순위를 중앙화한다.
- `lib/content/boss-traits.test.ts`: 중앙 clamp 및 cue 우선순위 상수의 계약을 고정한다.
- `lib/domain/expedition.ts`: cue가 `BattleResolution.actions`의 정확한 action을 가리키는 `actionIndex`를 소유한다.
- `lib/domain/info.ts`: accepted와 suspected 지연 기록을 모두 보존한다는 주석을 실제 계약에 맞춘다.
- `lib/rules/boss-battle-adapter.ts`: raw multiplier 합성, 안정 정렬, action 기반 cue 축소, round-limit 진단을 수행한다.
- `lib/rules/boss-battle-adapter.test.ts`: 리뷰에서 지적한 합성·cue·종료·정렬·입력 검증 회귀를 고정한다.
- `docs/superpowers/specs/2026-08-22-lattebun-e4-boss-battle-adapter-design.md`, `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`: final clamp, cue 귀속, round-limit의 비정산 의미를 공식 계약으로 명시한다.

### Task 1: 중앙 최종 clamp와 지연 기록 정렬을 바로잡는다

**Files:**
- Modify: `lib/content/boss-traits.ts`
- Modify: `lib/content/boss-traits.test.ts`
- Modify: `lib/domain/expedition.ts`
- Modify: `lib/domain/index.ts`
- Modify: `lib/rules/boss-battle-adapter.ts`
- Modify: `lib/rules/boss-battle-adapter.test.ts`

**Interfaces:**
- Consumes: `BOSS_INFO_MULTIPLIERS`, `BOSS_INFO_MULTIPLIER_LIMITS`, `InfoRecord`.
- Produces: `clampBossInfoMultiplier(rawValue)`를 한 축당 정확히 한 번만 호출하는 member-ID 전투 입력, `characterId → bossRuleId → eventId → adviceId` 정렬, 그리고 원본 규칙 식별자를 보존하는 `BossInfoVerification.bossRuleId`.

- [ ] **Step 1: 최종 1회 clamp와 정렬의 실패 회귀 테스트를 추가한다**

```ts
it("두 outgoing help와 merchant를 모두 곱한 뒤 한 번만 clamp한다", () => {
  const result = resolve({
    dungeon: dungeon({ bossId: SPIDER_BOSSES[1].id }),
    infoRecords: [
      info({ bossRuleId: "boss-morkan-cocoon-side" as BossRuleId }),
      info({ adviceId: "spin" as ChoiceId, bossRuleId: "boss-morkan-spin-pause" as BossRuleId }),
    ],
    classDefs: classesWithWarriorAttack(20),
    pendingMerchantEffect: { adviceId: "merchant" as ChoiceId, nextBattle: { partyDamageMultiplier: 0.5 } },
  });

  expect(firstPartyAction(result).damage).toBe(16); // round(20 × 1.25 × 1.25 × 0.5)
});

it("검증과 trust 적용을 characterId, bossRuleId, eventId, adviceId 순서로 고정한다", () => {
  const result = resolve({ infoRecords: recordsInReverseCanonicalOrder });
  expect(result.bossResult.verifications.map(({ characterId, bossRuleId, eventId, adviceId }) =>
    `${characterId}/${bossRuleId}/${eventId}/${adviceId}`,
  )).toEqual(canonicalRecordKeys);
});
```

`BossInfoVerification`에 `bossRuleId: BossRuleId`를 추가해 verification과 trust 순서가 같은 원본 기록을 가리키게 한다. `classesWithWarriorAttack`과 `firstPartyAction`은 테스트 파일의 지역 helper로 정의해 15(`1.5 × 0.5`)와 16(`1.5625 × 0.5`)의 차이를 손실 없이 검증한다.

- [ ] **Step 2: 테스트가 현재 중간 clamp와 event-first 정렬에서 실패하는지 확인한다**

Run: `pnpm test lib/rules/boss-battle-adapter.test.ts`

Expected: FAIL; 현재 party action damage는 중간 clamp 때문에 `15`이고 verification 정렬은 event/advice-first다.

- [ ] **Step 3: raw product 축적과 중앙 clamp를 구현한다**

```ts
import { clampBossInfoMultiplier } from "@/lib/content/boss-traits";

function compareInfoRecords(left: InfoRecord, right: InfoRecord): number {
  return left.characterId.localeCompare(right.characterId)
    || left.bossRuleId.localeCompare(right.bossRuleId)
    || left.eventId.localeCompare(right.eventId)
    || left.adviceId.localeCompare(right.adviceId);
}

function multiplyRawAxis(map: Map<string, number>, memberId: string, axis: BossInfoAxis, value: number): void {
  const key = `${memberId}:${axis}`;
  map.set(key, (map.get(key) ?? 1) * value);
}

function finalAxisValue(map: ReadonlyMap<string, number>, memberId: string, axis: BossInfoAxis): number {
  return clampBossInfoMultiplier(map.get(`${memberId}:${axis}`) ?? 1);
}
```

`resolveBossBattle`에서 accepted bossInfo와 `consumePendingMerchantEffect()`의 해당 축을 모두 `multiplyRawAxis`로 누적한다. merchant를 적용하기 전의 member-ID map을 만들지 말고, 모든 raw factor가 더해진 후 살아 있는 각 멤버의 세 입력을 `finalAxisValue`로 만들며 기존 `0.7`/`1.5` 숫자 리터럴과 `multiplyAxis`를 삭제한다. `eligibleRecords`·verification·applications가 모두 `compareInfoRecords` 순서를 사용하게 한다.

`BossInfoVerification`을 만들 때 `bossRuleId: record.bossRuleId`를 채우고, `lib/domain/index.ts`의 type export는 기존 이름을 유지해 호출자가 새 식별자를 받을 수 있게 한다.

- [ ] **Step 4: focused 테스트와 카탈로그 테스트를 통과시킨다**

Run: `pnpm test lib/content/boss-traits.test.ts lib/rules/boss-battle-adapter.test.ts`

Expected: PASS; raw product가 `0.70..1.50` 범위를 벗어날 때만 중앙 clamp가 적용되고, 입력 배열을 뒤집어도 verification/trust 순서가 바뀌지 않는다.

- [ ] **Step 5: 합성과 정렬 변경을 커밋한다**

```bash
git add lib/content/boss-traits.ts lib/content/boss-traits.test.ts lib/domain/expedition.ts lib/domain/index.ts lib/rules/boss-battle-adapter.ts lib/rules/boss-battle-adapter.test.ts
git commit -m "수정: 보스 정보 합성과 검증 순서를 고정한다" -m "모든 배율을 누적한 뒤 중앙 상한을 한 번 적용하고 지연 기록을 계약 순서로 처리한다."
```

### Task 2: cue를 실제 BattleActionRecord 하나에 귀속한다

**Files:**
- Modify: `lib/content/boss-traits.ts`
- Modify: `lib/content/boss-traits.test.ts`
- Modify: `lib/domain/expedition.ts`
- Modify: `lib/domain/index.ts`
- Modify: `lib/rules/boss-battle-adapter.ts`
- Modify: `lib/rules/boss-battle-adapter.test.ts`

**Interfaces:**
- Produces: `BossInfoPresentationCue.actionIndex: number`, `BOSS_INFO_CUE_AXIS_PRIORITY`, action당 최대 한 개의 결정적 cue.
- Consumes: `BattleResolution.actions`, accepted `BossInfoApplication`, 안정 정렬된 원본 `InfoRecord`.

- [ ] **Step 1: action 귀속과 충돌 우선순위의 실패 테스트를 작성한다**

```ts
it("cue는 실제 actionIndex를 가리키고 한 action당 하나만 남긴다", () => {
  const result = resolve({
    dungeon: dungeon({ bossId: SPIDER_BOSSES[1].id }),
    infoRecords: [morkanCocoonHelp, morkanSpinHelp],
  });

  expect(result.bossResult.cues.filter((cue) => cue.actionIndex === 0)).toEqual([
    expect.objectContaining({ actionIndex: 0, bossRuleId: "boss-morkan-cocoon-side" }),
  ]);
  expect(new Set(result.bossResult.cues.map((cue) => cue.actionIndex)).size)
    .toBe(result.bossResult.cues.length);
});

it("같은 적 action의 targetWeight가 incomingDamage보다 먼저 선택된다", () => {
  const result = resolve({
    classDefs: classesWithWarriorAttack(1),
    infoRecords: [ragnaTurningHelp, ragnaCrouchHelp],
  });
  const enemyActionIndex = result.bossResult.battle.actions.findIndex((action) => action.actorSide === "enemy");
  expect(result.bossResult.cues).toContainEqual(expect.objectContaining({
    actionIndex: enemyActionIndex,
    axis: "targetWeight",
    timing: "beforeTarget",
  }));
});
```

테스트의 Morkan fixture는 한 party attack에 outgoing application 두 개가 겹치게 하고, Ragna fixture는 같은 멤버가 enemy action의 target이 되도록 단일 멤버 파티를 사용한다. 각 fixture의 입력 순서를 뒤집은 결과도 동일한 cue 배열인지 함께 고정한다.

- [ ] **Step 2: 현재 application당 cue 생성에서 실패하는지 확인한다**

Run: `pnpm test lib/rules/boss-battle-adapter.test.ts`

Expected: FAIL; 현재 cue에는 `actionIndex`가 없고 같은 action의 application 수만큼 cue가 생긴다.

- [ ] **Step 3: cue 도메인 계약과 결정적 후보 선택을 구현한다**

```ts
export const BOSS_INFO_CUE_AXIS_PRIORITY = {
  targetWeight: 0,
  incomingDamage: 1,
  outgoingDamage: 2,
} as const satisfies Readonly<Record<BossTraitAxis, number>>;

export interface BossInfoPresentationCue {
  readonly actionIndex: number;
  readonly bossRuleId: BossRuleId;
  readonly characterId: CharacterId;
  readonly timing: BossInfoTiming;
  readonly axis: BossInfoAxis;
  readonly direction: BossInfoDirection;
  readonly presentationKey: string;
}
```

`applications`에 원본 record identity를 연결할 수 있도록 application에 `eventId`·`adviceId`·`characterId`·`bossRuleId`를 그대로 유지한다. `battle.actions.entries()`를 순회해 다음 후보만 만든다.

```ts
const appliesToAction = (application: BossInfoApplication, action: BattleActionRecord): boolean =>
  application.axis === "outgoingDamage"
    ? action.actorSide === "party" && action.actorId === application.characterId
    : action.actorSide === "enemy" && action.targetId === application.characterId;
```

각 action의 후보를 `BOSS_INFO_CUE_AXIS_PRIORITY[axis]`, 그 다음 `compareInfoRecords`와 같은 record identity 순으로 정렬해 첫 후보만 cue로 변환한다. targetWeight는 `beforeTarget`, incomingDamage는 `beforeDamage`, outgoingDamage는 `afterDamage` timing을 유지한다. UI가 candidate 선택이나 priority를 다시 계산할 여지를 남기지 않는다.

- [ ] **Step 4: cue 단위·결정성·타입 검증을 통과시킨다**

Run: `pnpm test lib/content/boss-traits.test.ts lib/rules/boss-battle-adapter.test.ts && pnpm typecheck`

Expected: PASS; cue는 모두 유효한 `battle.actions[actionIndex]`에 귀속되고, 한 action에 최대 한 개이며, 같은 입력의 순열도 동일한 cue 배열을 만든다.

- [ ] **Step 5: action 기반 cue 변경을 커밋한다**

```bash
git add lib/content/boss-traits.ts lib/content/boss-traits.test.ts lib/domain/expedition.ts lib/domain/index.ts lib/rules/boss-battle-adapter.ts lib/rules/boss-battle-adapter.test.ts
git commit -m "수정: 보스 정보 cue를 전투 action에 귀속한다" -m "UI가 재계산하지 않도록 action별 단일 cue와 결정적 우선순위를 결과에 남긴다."
```

### Task 3: roundLimit을 전멸 정산으로 투영하지 않는다

**Files:**
- Modify: `lib/rules/boss-battle-adapter.ts`
- Modify: `lib/rules/boss-battle-adapter.test.ts`
- Modify: `docs/superpowers/specs/2026-08-22-lattebun-e4-boss-battle-adapter-design.md`
- Modify: `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`

**Interfaces:**
- Produces: `roundLimit`에서 `BossResult`를 반환하지 않는 `RuleError("INVALID_GENERATION", ...)`.
- Preserves: `cleared`는 `defeatedEnemies`와 생존자 1명 이상, `wiped`는 `partyWipe`와 생존자 0명만 나타난다.

- [ ] **Step 1: roundLimit과 생존자 1명 clear의 실패 테스트를 추가한다**

```ts
it("roundLimit을 생존자가 있는 wiped 결과로 만들지 않고 진단 오류로 중단한다", () => {
  expect(() => resolve({
    members: [member("member-1", { hp: 999, maxHp: 999 })],
    classDefs: classesWithWarriorAttack(0),
    theme: themeWithBossDamage(0),
  })).toThrowError(RuleError);

  expectRuleError(() => resolve(roundLimitInput), {
    code: "INVALID_GENERATION",
    details: { bossId: SPIDER_BOSSES[0].id, termination: "roundLimit", rounds: 50 },
  });
});

it("보스를 처치하고 한 명만 살아도 cleared와 해당 survivorIds를 반환한다", () => {
  const result = resolve({ members: [survivor, deadMember] });
  expect(result.bossResult).toMatchObject({ status: "cleared", survivorIds: [survivor.id] });
});
```

`roundLimitInput`은 전사 공격력과 보스 기본 피해를 `0`으로 만들어 50턴 뒤 양쪽이 살아 있게 한다. `expectRuleError`는 기존 프로젝트의 `RuleError.code`와 `details`를 검사하는 지역 helper로 작성한다.

- [ ] **Step 2: 현재 `wiped + survivorIds` 모순에서 실패하는지 확인한다**

Run: `pnpm test lib/rules/boss-battle-adapter.test.ts`

Expected: FAIL; 현재 `roundLimit` 결과가 반환되며 `status === "wiped"`와 비어 있지 않은 `survivorIds`를 함께 가진다.

- [ ] **Step 3: adapter 경계에서 roundLimit을 진단 오류로 바꾼다**

```ts
const battle = resolveBattle(battleInput);
if (battle.termination === "roundLimit") {
  invalid("보스전이 50턴 안에 종료되지 않았다", {
    bossId: boss.id,
    termination: battle.termination,
    rounds: battle.rounds,
    livingPartyIds: battle.party.filter((member) => member.hp > 0).map((member) => member.id),
    livingEnemyIds: battle.enemies.filter((enemy) => enemy.hp > 0).map((enemy) => enemy.id),
  });
}
```

이 검사는 battle HP를 campaign member에 투영하기 전에 수행한다. 공통 `BattleEngine`의 일반전 `roundLimit` 표현은 변경하지 않는다. 그 뒤 `BossResult.status`는 다음 두 경우만 허용한다.

```ts
if (battle.termination === "defeatedEnemies" && survivorIds.length > 0) return "cleared";
if (battle.termination === "partyWipe" && survivorIds.length === 0) return "wiped";
invalid("보스전 결과와 생존자 상태가 모순된다", { termination: battle.termination, survivorIds });
```

- [ ] **Step 4: 공식 계약에 진단 경계를 추가하고 테스트를 통과시킨다**

`E4 Spec` 12절과 `DUNGEON_EVENTS_AND_BOSSES.md`의 E4 책임에 다음 의미를 추가한다: 50턴 `roundLimit`은 보스 처치도 전멸도 아니며 E4는 `BossResult`/C4 정산 입력을 만들지 않고 보스·라운드·생존 ID를 포함한 `RuleError("INVALID_GENERATION", ...)`로 중단한다.

Run: `pnpm test lib/rules/boss-battle-adapter.test.ts lib/rules/battle-engine.test.ts`

Expected: PASS; 공통 엔진의 일반전 roundLimit 회귀는 유지되고 보스 어댑터는 모순된 settlement 상태를 만들지 않는다.

- [ ] **Step 5: 종료 상태 경계를 커밋한다**

```bash
git add lib/rules/boss-battle-adapter.ts lib/rules/boss-battle-adapter.test.ts docs/superpowers/specs/2026-08-22-lattebun-e4-boss-battle-adapter-design.md docs/systems/DUNGEON_EVENTS_AND_BOSSES.md
git commit -m "수정: 보스전 roundLimit 정산 모순을 막는다" -m "시간 제한 종료를 진단 오류로 분리해 생존자 있는 전멸 결과를 만들지 않는다."
```

### Task 4: 입력 검증·주석·전체 회귀를 보강한다

**Files:**
- Modify: `lib/domain/info.ts`
- Modify: `lib/rules/boss-battle-adapter.test.ts`

**Interfaces:**
- Preserves: accepted와 suspected help/harm 모두 E4 지연 검증 입력이며 exposed/neutral은 제외된다는 `InfoRecord` 계약.
- Verifies: accepted harm, boss/rule mismatch, duplicate delayed record, final clamp, cue priority, roundLimit, 한 명 생존 clear.

- [ ] **Step 1: 누락된 입력 오류와 accepted harm의 실패 테스트를 작성한다**

```ts
it("accepted harm은 harmful application과 불리한 outgoing damage를 만든다", () => {
  const input = { dungeon: dungeon({ bossId: SPIDER_BOSSES[1].id }) };
  const result = resolve({ ...input, infoRecords: [morkanCocoonHarm] });
  expect(result.bossResult.applications).toContainEqual(expect.objectContaining({
    bossRuleId: "boss-morkan-cocoon-side", axis: "outgoingDamage", direction: "harmful",
  }));
  expect(firstPartyAction(result).damage).toBeLessThan(firstPartyAction(resolve(input)).damage);
});

it.each([
  ["다른 보스 rule", [info({ bossRuleId: "boss-zakar-burrow-trace" as BossRuleId })]],
  ["중복 delayed record", [info(), info()]],
])("%s는 INVALID_GENERATION으로 거부한다", (_label, infoRecords) => {
  expect(() => resolve({ infoRecords })).toThrowError(RuleError);
});
```

- [ ] **Step 2: 테스트가 현재 누락된 회귀 범위를 드러내는지 확인한다**

Run: `pnpm test lib/rules/boss-battle-adapter.test.ts`

Expected: FAIL only for assertions that document newly corrected behavior; mismatch와 duplicate 검증이 이미 구현되어 있다면 이 사례들은 즉시 PASS여도 된다.

- [ ] **Step 3: `InfoRecord` 주석을 현재 지연 검증 계약에 맞춘다**

```ts
/**
 * 보스전 뒤 검증해야 하는 지연형 조언에 대한 한 파티원의 반응 기록이다.
 * accepted는 전투 modifier와 사후 검증을, suspected는 사후 검증만 남긴다.
 * neutral·exposed는 E2에서 기록하지 않는다.
 */
export interface InfoRecord { /* existing fields */ }

/** accepted 또는 suspected help/harm이 보스전 뒤 검증 대상인지 나타낸다. */
readonly pendingVerification: boolean;
```

주석 외 동작 변경은 이 task에서 추가하지 않는다. Task 1~3에서 구현한 테스트를 포함해 reviewer가 요구한 모든 회귀 사례를 같은 파일에서 읽을 수 있게 정리한다.

- [ ] **Step 4: 전체 검증을 실행한다**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm test docs/DOCUMENT_LINKS.test.ts docs/DOCUMENT_TERMINOLOGY.test.ts && git diff --check`

Expected: 모두 PASS. lint의 기존 경고 수가 바뀌지 않음을 확인하고 새 경고는 남기지 않는다.

- [ ] **Step 5: 주석과 회귀 보강을 커밋한다**

```bash
git add lib/domain/info.ts lib/rules/boss-battle-adapter.test.ts
git commit -m "테스트: 보스전 리뷰 회귀를 보강한다" -m "지연 정보 주석을 현재 계약에 맞추고 보스 정보 입력 오류와 harm 경로를 고정한다."
```

## Self-Review

- 최종 1회 clamp와 중앙 카탈로그 사용은 Task 1이, action당 단일 cue와 명시적 우선순위는 Task 2가 다룬다.
- `roundLimit`이 `wiped + survivorIds` 모순을 만들지 않는 경계와 문서 계약은 Task 3이 다룬다.
- Plan이 요구한 canonical trust 순서, accepted harm, mismatch/duplicate, 생존자 1명 clear 및 `InfoRecord` 주석은 Task 1·3·4에 각각 고정한다.
- 공통 `BattleEngine`의 일반전 API와 50턴 안전장치는 유지하며 보스 어댑터에만 settlement 금지를 둔다.
- 본 Plan은 placeholder 없이 실제 파일·함수·테스트·커밋 단위를 명시하고, 새 외부 의존성이나 보스 전용 전투 루프를 추가하지 않는다.
