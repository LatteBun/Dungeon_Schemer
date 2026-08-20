# F3-2 거미굴 조언 콘텐츠 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 거미굴의 일반 사건 12개와 보스 정보 사건 8개를 타입 안전한 데이터·검증 계약으로 제공한다.

**Architecture:** `AdviceOption.source`가 생태 규칙과 보스 특징을 구분하고, `SituationEvent.targetBossId`가 지연형 보스 정보의 대상 보스를 식별한다. 검증기는 공용/혼합 호출의 기존 동작을 보존하면서, `ThemeContent`를 받는 전용 모드에서 테마 전체 규칙과 보스 특징 소유권을 검사한다. 콘텐츠는 `lib/content/events/spider-events.ts`에만 두고, 전투 적용·사건 배치·UI는 후속 E2/E3/E4/U5가 맡는다.

**Tech Stack:** TypeScript 5 strict, Vitest 4, Next.js 16.3, pnpm 11

**Spec:** `docs/superpowers/specs/2026-08-21-lattebun-f3-2-spider-advice-content-design.md`

## Global Constraints

- 플레이어 화면에는 `RuleId`, `BossRuleId`, `AdviceSource`와 도움·방해·중립 유형을 노출하지 않는다.
- 사건은 정확히 조언 3개, 도움·방해·중립 각 1개, 비어 있지 않은 제목·상황·기본 결과·조언 문구를 가진다.
- 도움·방해는 source 필수, 중립은 source 없음이다. 공용 사건은 source·`targetBossId`·`bossDamageModifier`가 모두 없다.
- 보스 정보 사건은 `theme: "spider"`, `kind: "special"`, 실제 `targetBossId`, 그 보스가 소유한 boss source, 세 modifier를 가진다. 보정 수치는 도움 `-0.20`, 중립 `-0.10`, 방해 `+0.25`다.
- 일반 거미 사건은 `kind: "monster"`, 생태 source만 사용하고 보스 source·보스 modifier·`targetBossId`를 갖지 않는다.
- 거미굴의 생태 규칙 6개는 각각 기본 조언에서 도움·방해를 2회 이상 공급한다. 교차 사건은 참조한 모든 규칙이 활성일 때만 E3가 배치한다.
- F3-2는 수용·의심·적발 계산, 배치 알고리즘, 보스전 피해 산술·상한, 보스별 AI·상태이상, 사막·묘지 전용 콘텐츠를 구현하지 않는다.
- 기존 사용자 변경을 되돌리지 않는다. 커밋 제목과 본문은 항상 한글로 작성한다.

---

## File Structure

| 파일 | 책임 |
| --- | --- |
| `lib/domain/ids.ts` | `BossRuleId` 브랜드 ID 선언 |
| `lib/domain/content.ts` | `AdviceSource`, source 기반 조언, 보스 대상 사건 계약 |
| `lib/domain/dungeon.ts` | `BossRule`과 모든 보스의 `rules` 배열 계약 |
| `lib/domain/index.ts` | 새 ID·도메인 타입의 barrel export |
| `lib/content/themes.ts` | 거미 보스 8개 특징, 사막·묘지 보스의 빈 `rules`, `SPIDER_THEME` export |
| `lib/content/theme-validation.ts` | 보스 특징 배열의 ID·문구 무결성 검사 |
| `lib/content/situation-validation.ts` | source·targetBossId·테마 전체 공급량 검증 |
| `lib/content/events/spider-events.ts` | Spec 원문 20개를 표현하는 읽기 전용 거미굴 사건 배열 |
| `lib/content/*.test.ts`, `lib/domain/advice.test.ts` | 계약·회귀·콘텐츠 수량 검증 |
| `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md` | F3-2 완료 상태 기록 |

### Task 1: 보스 특징과 source 도메인 계약

**Files:**
- Modify: `lib/domain/ids.ts`
- Modify: `lib/domain/content.ts`
- Modify: `lib/domain/dungeon.ts`
- Modify: `lib/domain/index.ts`
- Modify: `lib/content/themes.ts`
- Modify: `lib/content/theme-validation.ts`
- Modify: `lib/content/theme-validation.test.ts`
- Modify: `lib/content/themes.test.ts`
- Modify: `lib/domain/advice.test.ts`

**Interfaces:**
- Produces: `type BossRuleId = Brand<string, "BossRuleId">`
- Produces: `type AdviceSource = { kind: "ecology"; ruleId: RuleId } | { kind: "boss"; bossRuleId: BossRuleId }`
- Produces: `interface BossRule { id: BossRuleId; text: string }`
- Produces: `interface SituationEvent { targetBossId?: BossId }`
- Produces: `export const SPIDER_THEME: ThemeContent`

- [ ] **Step 1: 타입 계약을 사용하는 실패 테스트를 작성한다.**

`lib/domain/advice.test.ts`의 fixture를 source 기반으로 바꾸고, 보스 source와 대상 보스를 가진 사건을 선언한다. `lib/content/themes.test.ts`에는 거미 보스별 `rules` ID가 아래와 정확히 두 개인지 검사한다.

```ts
expect(themeOf("spider").bosses.map((boss) => [boss.id, boss.rules.map((rule) => rule.id)])).toEqual([
  ["boss-spider-1", ["boss-ragna-turning", "boss-ragna-crouch"]],
  ["boss-spider-2", ["boss-morkan-cocoon-side", "boss-morkan-spin-pause"]],
  ["boss-spider-3", ["boss-serina-web-hub", "boss-serina-block-retreat"]],
  ["boss-spider-4", ["boss-araksha-swarm-follow", "boss-araksha-summon-first"]],
]);
```

`theme-validation.test.ts`에는 빈 `rules` 배열은 통과하고, 같은 보스 안의 중복 ID와 공백 `text`는 `RuleError("INVALID_GENERATION")`을 던지는 fixture를 추가한다.

- [ ] **Step 2: 테스트가 새 타입과 검증 규칙 때문에 실패하는지 확인한다.**

Run: `pnpm.cmd test -- lib/domain/advice.test.ts lib/content/themes.test.ts lib/content/theme-validation.test.ts`

Expected: FAIL — `BossRuleId`, `source`, `rules`, 또는 보스 특징 검증이 아직 없다.

- [ ] **Step 3: 최소 도메인 계약과 테마 데이터를 구현한다.**

`ids.ts`와 barrel에 `BossRuleId`를 추가한다. `content.ts`에서는 `ruleId?: RuleId`를 제거하고 아래처럼 source와 대상을 둔다.

```ts
export type AdviceSource =
  | { kind: "ecology"; ruleId: RuleId }
  | { kind: "boss"; bossRuleId: BossRuleId };

export interface AdviceOption {
  // id, label, line, outcome
  source?: AdviceSource;
  relation: EcologyRelation;
  effectTags: readonly EventEffectTag[];
  bossDamageModifier?: number;
  resultText: string;
}

export interface SituationEvent {
  // 기존 필드
  targetBossId?: BossId;
}
```

`dungeon.ts`의 `BossDef`에 필수 `rules: readonly BossRule[]`을 추가한다. `themes.ts`의 거미 보스에 Spec 3절의 ID와 text를 각각 두 개씩 넣고, 사막·묘지 보스 8개에는 `rules: []`를 명시한다. `const SPIDER_THEME`를 `export const SPIDER_THEME`로 바꾸며 `THEMES`는 동일한 객체를 계속 사용한다. `theme-validation.ts`의 보스 검증에는 각 `rules`의 ID 중복 및 `text.trim() === ""`을 `INVALID_GENERATION`으로 거부하는 루프를 추가한다.

- [ ] **Step 4: 계약 테스트와 기존 테마 테스트를 통과시킨다.**

Run: `pnpm.cmd test -- lib/domain/advice.test.ts lib/content/themes.test.ts lib/content/theme-validation.test.ts`

Expected: PASS.

- [ ] **Step 5: 타입 변경 소비처를 찾고 다음 작업의 마이그레이션 범위를 확인한다.**

Run: `rg -n "ruleId" lib --glob "*.ts"; pnpm.cmd typecheck`

Expected: `ruleId`가 `lib/content/situation-validation.ts`와 그 테스트에 남아 있음을 확인한다. 이는 Task 2에서 `source`로 옮길 소비처이며, Task 1 완료 시점의 테스트는 통과하되 전체 typecheck는 Task 2 전까지 실패할 수 있다.

- [ ] **Step 6: 첫 번째 독립 변경을 커밋한다.**

```powershell
git add lib/domain/ids.ts lib/domain/content.ts lib/domain/dungeon.ts lib/domain/index.ts lib/domain/advice.test.ts lib/content/themes.ts lib/content/themes.test.ts lib/content/theme-validation.ts lib/content/theme-validation.test.ts
git commit -m "보스 특징 도메인 계약 추가" -m "조언 근거를 생태와 보스로 구분하고 거미굴 보스 특징을 콘텐츠에 등록한다."
```

### Task 2: 상황 검증기의 테마·보스 계약

**Files:**
- Modify: `lib/content/situation-validation.ts`
- Modify: `lib/content/situation-validation.test.ts`
- Modify: `lib/content/shared-events.ts`
- Modify: `lib/content/shared-events.test.ts`

**Interfaces:**
- Consumes: `AdviceSource`, `BossRule`, `ThemeContent`, `SPIDER_THEME` from Task 1
- Produces: `validateSituationEvents(events: readonly SituationEvent[], theme?: ThemeContent): void`
- Produces: existing `validateSituationEvent(event: SituationEvent): void` compatibility for source-free shared-event callers

- [ ] **Step 1: source 기반 fixture와 실패 사례를 작성한다.**

`themedAdvice` fixture는 `source: { kind: "ecology", ruleId: "spider-fire" as RuleId }`를, 보스 fixture는 `targetBossId: "boss-spider-1" as BossId`와 `source: { kind: "boss", bossRuleId: "boss-ragna-turning" as BossRuleId }`를 사용한다. 아래의 실패 테스트를 추가한다.

```ts
expect(() => validateSituationEvents(spiderEventsMissingFire, SPIDER_THEME))
  .toThrow(/spider-fire.*help 조언이 2개 미만/);
expect(() => validateSituationEvents([foreignEcologyEvent], SPIDER_THEME))
  .toThrow(/테마 밖.*규칙/);
expect(() => validateSituationEvents([wrongBossRuleEvent], SPIDER_THEME))
  .toThrow(/다른 보스.*특징/);
expect(() => validateSituationEvents([bossEventWithoutModifier], SPIDER_THEME))
  .toThrow(/보스 피해 보정/);
expect(() => validateSituationEvent(normalEventWithBossSource)).toThrow(RuleError);
```

추가로 `validateSituationEvents(SHARED_EVENTS)`가 계속 통과하고, `validateSituationEvents(themedTwentyLikeFixture, SPIDER_THEME)`는 공용 사건 15개 없이 통과하는 테스트를 둔다. 강화판 fixture도 source 구조를 사용하며, 교체 전후 outcome이 다르면 계속 거부됨을 유지한다.

- [ ] **Step 2: 새 검증 테스트가 기존 구현에서 실패하는지 확인한다.**

Run: `pnpm.cmd test -- lib/content/situation-validation.test.ts lib/content/shared-events.test.ts`

Expected: FAIL — `ruleId` 기반 구현이 source를 읽지 못하고, 두 번째 `theme` 인수를 받지 못한다.

- [ ] **Step 3: source 판별과 보스 소유권 검증을 구현한다.**

`validateSituationEvent`의 기본 구조·문구·3개/outcome·강화판 검사는 유지한다. 조언 분류 규칙은 다음으로 교체한다.

```ts
const needsSource = option.relation !== "unrelated";
if (needsSource && option.source === undefined) invalid(/* source 없음 */);
if (!needsSource && option.source !== undefined) invalid(/* 중립 source 금지 */);

if (event.theme === undefined) {
  // 모든 source, targetBossId, bossDamageModifier 금지
} else if (event.targetBossId === undefined) {
  // help/harm은 ecology source, modifier 금지
} else {
  // kind special, 세 modifier 존재, help/harm은 boss source
}
```

`validateSituationEvents`를 optional `theme` 인자로 확장한다. 인자가 없으면 기존 공용 공급량과 실제로 참조된 ecology source의 하한 검사를 유지한다. 인자가 있으면 공용 공급량을 생략하고, 모든 event의 `theme === theme.id`를 요구하며 `theme.rules` 6개 전체마다 기본 조언의 help/harm 2개를 센다. ecology source는 해당 `theme.rules` 안에 있어야 한다. boss event는 `theme.bosses`에서 target을 찾고, target의 `rules`에만 bossRuleId가 있어야 한다. source/소유권 검사는 기본 조언과 `upgrades[].replacement` 모두에 적용한다.

- [ ] **Step 4: 검증기 회귀 테스트를 통과시킨다.**

Run: `pnpm.cmd test -- lib/content/situation-validation.test.ts lib/content/shared-events.test.ts`

Expected: PASS.

- [ ] **Step 5: 두 번째 독립 변경을 커밋한다.**

```powershell
git add lib/content/situation-validation.ts lib/content/situation-validation.test.ts lib/content/shared-events.ts lib/content/shared-events.test.ts
git commit -m "상황 이벤트 보스 근거 검증 추가" -m "테마 전용 검증 모드와 보스 대상 사건의 source 및 modifier 계약을 검사한다."
```

### Task 3: 거미굴 20개 사건 데이터와 수직 슬라이스 테스트

**Files:**
- Create: `lib/content/events/spider-events.ts`
- Create: `lib/content/spider-events.test.ts`

**Interfaces:**
- Consumes: `SituationEvent`, `AdviceOption`, `AdviceSource`, `SPIDER_THEME`, `validateSituationEvents`
- Produces: `export const SPIDER_EVENTS: readonly SituationEvent[]`

- [ ] **Step 1: 데이터 계약을 잠그는 실패 테스트를 작성한다.**

`spider-events.test.ts`에서 아래 수량·소유권·연계·검증기를 명시한다.

```ts
expect(SPIDER_EVENTS).toHaveLength(20);
expect(SPIDER_EVENTS.filter((event) => event.kind === "monster")).toHaveLength(12);
expect(SPIDER_EVENTS.filter((event) => event.kind === "special")).toHaveLength(8);
expect(SPIDER_EVENTS.every((event) => event.theme === "spider")).toBe(true);
const bossEventCounts = Object.values(Object.groupBy(
  SPIDER_EVENTS.filter((event) => event.targetBossId !== undefined),
  (event) => event.targetBossId,
)).map((events) => events?.length ?? 0);
expect(bossEventCounts).toHaveLength(4);
expect(bossEventCounts.every((count) => count === 2)).toBe(true);
expect(() => validateSituationEvents(SPIDER_EVENTS, SPIDER_THEME)).not.toThrow();
```

규칙별 도움·방해 수를 `source?.kind === "ecology"`로 세어 6개 모두 2 이상인지 검사한다. `clue-spider-vibration-response`가 SP03의 `revealsClue`와 SP04의 help-slot upgrade에 연결되는지, `clue-spider-carrion-tracks`와 `clue-spider-brood-follows-light`가 각각 선행/`requiresClue`로 연결되는지도 확인한다. 보스 정보 사건은 세 modifier가 `[-0.2, -0.1, 0.25]`인지 검사한다.

- [ ] **Step 2: 아직 없는 콘텐츠 모듈 때문에 테스트가 실패하는지 확인한다.**

Run: `pnpm.cmd test -- lib/content/spider-events.test.ts`

Expected: FAIL — `@/lib/content/events/spider-events` 모듈을 찾을 수 없다.

- [ ] **Step 3: Spec 원문을 재창작 없이 데이터로 옮긴다.**

`spider-events.ts`에 source를 만드는 작은 로컬 helper만 두고, Spec 4절과 6절의 제목·상황·선택지·대사·결과·기본 결과를 한 글자도 의미 변경 없이 옮긴다.

```ts
function ecology(ruleId: string): AdviceSource {
  return { kind: "ecology", ruleId: ruleId as RuleId };
}

function boss(bossRuleId: string): AdviceSource {
  return { kind: "boss", bossRuleId: bossRuleId as BossRuleId };
}

const BOSS_MODIFIER_BY_OUTCOME = {
  help: -0.2,
  neutral: -0.1,
  harm: 0.25,
} as const;
```

일반 사건은 아래 ID·관계를 정확히 사용한다.

| 사건 | ID | help source | harm source | 연계 |
| --- | --- | --- | --- | --- |
| SP01 | `spider-fire-floor-torch` | `spider-fire` | `spider-fire` | — |
| SP02 | `spider-fire-web-nest` | `spider-fire` | `spider-fire` | — |
| SP03 | `spider-vibration-pebble` | `spider-vibration` | `spider-vibration` | reveals `clue-spider-vibration-response` |
| SP04 | `spider-vibration-stone-floor` | `spider-vibration` | `spider-vibration` | help slot 0 upgrade from that clue |
| SP05 | `spider-carrion-carcass` | `spider-carrion` | `spider-carrion` | reveals `clue-spider-carrion-tracks` |
| SP06 | `spider-shadow-dark-room` | `spider-shadow` | `spider-shadow` | — |
| SP07 | `spider-brood-follow-light` | `spider-brood-light` | `spider-brood-light` | reveals `clue-spider-brood-follows-light` |
| SP08 | `spider-brood-armored-cross` | `spider-brood-light` | `spider-armor-vibration` | requires brood clue |
| SP09 | `spider-armored-brood-cross` | `spider-armor-vibration` | `spider-brood-light` | — |
| SP10 | `spider-armored-sleeper` | `spider-armor-vibration` | `spider-armor-vibration` | — |
| SP11 | `spider-carrion-shadow-cross` | `spider-carrion` | `spider-shadow` | requires carrion clue |
| SP12 | `spider-shadow-carrion-cross` | `spider-shadow` | `spider-carrion` | — |

보스 사건은 모두 `kind: "special"`, `theme: "spider"`, 세 modifier를 가지며 아래 target/source 쌍을 정확히 쓴다.

| 사건 ID | targetBossId | help/harm bossRuleId |
| --- | --- | --- |
| `spider-boss-ragna-turning` | `boss-spider-1` | `boss-ragna-turning` |
| `spider-boss-ragna-crouch` | `boss-spider-1` | `boss-ragna-crouch` |
| `spider-boss-morkan-cocoon` | `boss-spider-2` | `boss-morkan-cocoon-side` |
| `spider-boss-morkan-spin` | `boss-spider-2` | `boss-morkan-spin-pause` |
| `spider-boss-serina-web-hub` | `boss-spider-3` | `boss-serina-web-hub` |
| `spider-boss-serina-retreat` | `boss-spider-3` | `boss-serina-block-retreat` |
| `spider-boss-araksha-follow` | `boss-spider-4` | `boss-araksha-swarm-follow` |
| `spider-boss-araksha-summon` | `boss-spider-4` | `boss-araksha-summon-first` |

- [ ] **Step 4: 콘텐츠 수직 슬라이스 테스트를 통과시킨다.**

Run: `pnpm.cmd test -- lib/content/spider-events.test.ts lib/content/situation-validation.test.ts lib/content/themes.test.ts`

Expected: PASS.

- [ ] **Step 5: 세 번째 독립 변경을 커밋한다.**

```powershell
git add lib/content/events/spider-events.ts lib/content/spider-events.test.ts
git commit -m "거미굴 조언 사건 20개 추가" -m "일반 거미 사건과 보스별 지연형 정보 사건을 검증 가능한 콘텐츠 데이터로 제공한다."
```

### Task 4: 문서 완료 기록과 전체 회귀 검증

**Files:**
- Modify: `docs/superpowers/specs/2026-08-21-lattebun-f3-2-spider-advice-content-design.md`
- Modify: `docs/systems/DUNGEON_THEMES_AND_ECOLOGY.md`
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

**Interfaces:**
- Consumes: Tasks 1–3의 구현과 전체 테스트 결과
- Produces: 완료 기준과 공식 문서가 실제 20개 콘텐츠·보스 특징 계약과 일치하는 상태

- [ ] **Step 1: 이미 승인된 문서 계약이 코드와 일치하는지 확인한다.**

Spec에는 모든 보스의 `rules`, 테마 전용 검증 모드, `targetBossId` 상호 배타 규칙이 있어야 한다. 공식 테마 문서에는 보스 특징의 소유권과 사막·묘지의 빈 배열 경계가 있어야 한다. 작업표 F3-2 행은 20개(12 monster + 8 special), 규칙 커버리지, 보스별 2개, 강한 연계 2세트를 적어야 한다.

- [ ] **Step 2: 구현 완료 후 F3-2 상태를 완료로 기록한다.**

`CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`의 F3-2 행에서 담당자를 `LatteBun`으로 지정하고 상태를 `✅`로 바꾼다. 완료된 F3-2를 아직 진행하지 않은 F3-5·E2·E3의 `선행`에서 제거해 작업표 무결성 규약을 만족시키되, 그래프의 완료 작업 간선과 F3-2의 `풀리는 것` 기록은 유지한다.

- [ ] **Step 3: 문서 무결성과 전체 테스트를 실행한다.**

Run: `git diff --check; pnpm.cmd test; pnpm.cmd typecheck`

Expected: diff 공백 오류 없음, Vitest 전체 통과, TypeScript 소스 오류 없음. `.next` 생성 타입이 삭제된 옛 라우트를 참조해 typecheck가 실패하면 `pnpm.cmd build`로 생성 산출물을 새로 만든 뒤 `pnpm.cmd typecheck`를 다시 실행하고, 여전히 실패하면 F3-2와 무관한 기존 오류로 분리해 기록한다.

- [ ] **Step 4: 최종 변경을 커밋한다.**

```powershell
git add docs/superpowers/specs/2026-08-21-lattebun-f3-2-spider-advice-content-design.md docs/systems/DUNGEON_THEMES_AND_ECOLOGY.md docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md
git commit -m "거미굴 조언 콘텐츠 완료 기준 갱신" -m "보스 특징 계약과 F3-2의 20개 사건 완료 상태를 공식 문서에 반영한다."
```

## Self-Review

- Spec coverage: Task 1은 새 ID·source·BossRule과 전 테마 `rules` 마이그레이션을, Task 2는 공용 호환·테마 전체·보스 소유권 검증을, Task 3은 원문 20개와 규칙/연계/보정값을, Task 4는 공식 문서와 작업표 기록을 담당한다. E2/E3/E4 범위 밖 항목은 구현하지 않는다.
- Placeholder scan: 실행할 파일·함수 시그니처·실패 사례·명령·기대 결과와 사건 ID/source 매핑을 모두 명시했다.
- Type consistency: 모든 후속 작업은 `AdviceSource`, `BossRuleId`, `BossRule`, `SPIDER_THEME`, `validateSituationEvents(events, theme?)`, `SPIDER_EVENTS`를 Task 1~3에서 정의한 이름으로 사용한다.
