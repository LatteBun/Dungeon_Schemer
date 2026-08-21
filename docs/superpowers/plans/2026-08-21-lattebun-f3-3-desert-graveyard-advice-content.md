# F3-3 사막·묘지 조언 콘텐츠 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사막과 묘지에 각각 일반 사건 12개와 보스 정보 사건 8개를, F3-2와 동일한 조언·검증 계약의 읽기 전용 콘텐츠로 제공한다.

**Architecture:** 기존 `AdviceSource`, `SituationEvent`, `BossRule`, `validateSituationEvents(events, theme)`를 변경하지 않고 소비한다. `themes.ts`는 사막·묘지 보스의 특징과 검증용 테마 export만 맡고, 각 테마의 20개 사건은 독립 모듈로 둔다. 연계·활성 규칙 배치·반응 판정·보스 피해 산술·UI는 E2/E3/E4/U5의 책임으로 남긴다.

**Tech Stack:** TypeScript 5 strict, Vitest 4, pnpm 11, Next.js 16.3

**Spec:** `docs/superpowers/specs/2026-08-21-lattebun-f3-3-desert-graveyard-advice-content-design.md`

## Global Constraints

- Spec의 ID·상황·선택지·고블린 대사·결과·기본 결과를 의미 변경이나 재창작 없이 콘텐츠 데이터로 옮긴다.
- 플레이어에게 `RuleId`, `BossRuleId`, `AdviceSource`, 도움·방해·중립 유형을 노출하지 않는다.
- 일반 사건은 `kind: "monster"`이며 도움은 `consistent` ecology source·`support`, 방해는 `contradictory` ecology source·`sabotage`, 중립은 source 없는 `unrelated`·`observe`다.
- 보스 정보 사건은 `kind: "special"`, `targetBossId`, 같은 대상 보스 소유의 boss source를 가진 도움·방해, source 없는 중립을 갖는다. modifier는 도움 `-0.20`, 중립 `-0.10`, 방해 `+0.25`다.
- 각 테마의 기본 조언은 모든 생태 규칙에 도움 2개·방해 2개 이상을 공급한다. 강화판은 교체 슬롯과 같은 outcome을 유지한다.
- 사막·묘지마다 약한 연계 1세트와 `requiresClue`를 쓰는 강한 연계 2세트를 둔다.
- `THEMES`는 기존과 같은 테마 객체를 계속 참조한다. 공용 helper 추출이나 검증 의미 추가는 F3-3 범위가 아니다.
- 관련 공식 문서와 작업 배정표의 대표 콘텐츠 수량을 테마당 20개(일반 12 + 보스 정보 8)로 동기화한다.
- 커밋 제목과 본문은 항상 한글로 작성한다.

---

## File Structure

| 파일 | 책임 |
| --- | --- |
| `lib/content/themes.ts` | 사막·묘지 보스별 BossRule 2개와 `DESERT_THEME`·`GRAVEYARD_THEME` export |
| `lib/content/themes.test.ts` | 사막·묘지 보스 특징 ID 소유권과 개수 회귀 검증 |
| `lib/content/events/desert-events.ts` | 사막 일반 12개와 보스 정보 8개 데이터 |
| `lib/content/desert-events.test.ts` | 사막 수량·공급량·연계·modifier·범용 검증기 수직 슬라이스 |
| `lib/content/events/graveyard-events.ts` | 묘지 일반 12개와 보스 정보 8개 데이터 |
| `lib/content/graveyard-events.test.ts` | 묘지 수량·공급량·연계·modifier·범용 검증기 수직 슬라이스 |
| `docs/systems/INFORMATION_AND_DECEPTION.md` | 테마 전용 대표 콘텐츠 수량 20개 계약 |
| `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md` | F3-3 완료 기준과 콘텐츠 요약의 20개 계약 및 완료 상태 |

### Task 1: 사막·묘지 BossRule과 테마 export

**Files:**
- Modify: `lib/content/themes.ts:370-649`
- Modify: `lib/content/themes.test.ts:1-103`

**Interfaces:**
- Consumes: `BossDef.rules: readonly BossRule[]`, `BossRuleId`, `ThemeContent`
- Produces: `export const DESERT_THEME: ThemeContent`, `export const GRAVEYARD_THEME: ThemeContent`
- Produces: 사막·묘지 각 보스가 정확히 두 개의 소유 BossRule을 갖는 `THEMES`

- [ ] **Step 1: 사막·묘지 보스 특징의 실패 회귀 테스트를 작성한다.**

`themes.test.ts`에서 `DESERT_THEME`, `GRAVEYARD_THEME`를 import하고 아래 소유권 매핑을 추가한다. 각 보스의 특징 수가 두 개인지도 같이 검증한다.

```ts
expect(DESERT_THEME.bosses.map((boss) => [boss.id, boss.rules.map((rule) => rule.id)])).toEqual([
  ["boss-desert-1", ["boss-zakar-burrow-trace", "boss-zakar-emerge-gap"]],
  ["boss-desert-2", ["boss-kardum-sand-ridge", "boss-kardum-landing-pause"]],
  ["boss-desert-3", ["boss-obelon-leg-collapse", "boss-obelon-rebuild-stones"]],
  ["boss-desert-4", ["boss-nephris-question-still", "boss-nephris-wrong-answer-tell"]],
]);
expect(GRAVEYARD_THEME.bosses.map((boss) => [boss.id, boss.rules.map((rule) => rule.id)])).toEqual([
  ["boss-graveyard-1", ["boss-barkan-command-blade", "boss-barkan-reform-line"]],
  ["boss-graveyard-2", ["boss-morbian-staff-link", "boss-morbian-death-tell"]],
  ["boss-graveyard-3", ["boss-azrael-marked-prey", "boss-azrael-scythe-mist"]],
  ["boss-graveyard-4", ["boss-valdrak-oath-boundary", "boss-valdrak-tomb-priority"]],
]);
```

- [ ] **Step 2: 테스트가 export와 빈 rules 때문에 실패하는지 확인한다.**

Run: `pnpm test -- lib/content/themes.test.ts`

Expected: FAIL — `DESERT_THEME`·`GRAVEYARD_THEME`가 export되지 않았거나 기대한 BossRule ID가 없다.

- [ ] **Step 3: 최소 테마 콘텐츠 변경을 구현한다.**

`DESERT_BOSSES`와 `GRAVEYARD_BOSSES`의 각 `rules: []`를 Spec 3절·6절의 아래 `{ id, text }` 두 항목으로 교체한다. 모든 ID는 `as BossRuleId`로 brand 처리하고 Spec의 굵은 문장을 `text`로 그대로 쓴다. `const DESERT_THEME`와 `const GRAVEYARD_THEME`를 각각 `export const`로 바꾸되 `THEMES` 배열은 새 객체를 만들지 않고 기존 상수를 넣는다.

```ts
rules: [
  { id: "boss-zakar-burrow-trace" as BossRuleId, text: "자카르가 숨어 있는 모래 위에는 꼬리 끝이 지나간 가느다란 홈이 남는다." },
  { id: "boss-zakar-emerge-gap" as BossRuleId, text: "자카르는 모래에서 튀어나온 직후 몸을 다시 가다듬느라 잠깐 움직임이 멈춘다." },
],
```

나머지 일곱 보스도 같은 배열 형태를 사용하며, ID와 text는 Spec의 보스 특징 표를 정확히 따른다. `SPIDER_THEME`와 `selectThemeBoss`의 동작은 변경하지 않는다.

- [ ] **Step 4: 테마·보스 검증 회귀를 통과시킨다.**

Run: `pnpm test -- lib/content/themes.test.ts lib/content/theme-validation.test.ts`

Expected: PASS — 세 테마의 기존 계약, 사막·묘지 16개 BossRule 소유권, 위험도 보스 선택이 모두 통과한다.

- [ ] **Step 5: 독립 테마 계약 변경을 커밋한다.**

```bash
git add lib/content/themes.ts lib/content/themes.test.ts
git commit -m "사막과 묘지 보스 특징 추가" -m "F3-3 보스 정보 사건이 참조할 테마별 BossRule과 검증용 export를 등록한다."
```

### Task 2: 사막 20개 조언 사건과 수직 슬라이스 테스트

**Files:**
- Create: `lib/content/events/desert-events.ts`
- Create: `lib/content/desert-events.test.ts`

**Interfaces:**
- Consumes: `SituationEvent`, `AdviceOption`, `AdviceSource`, `RuleId`, `BossRuleId`, `DESERT_THEME`, `validateSituationEvents`
- Produces: `export const DESERT_EVENTS: readonly SituationEvent[]`

- [ ] **Step 1: 사막 콘텐츠 계약을 잠그는 실패 테스트를 작성한다.**

`desert-events.test.ts`에 다음 테스트를 작성한다. 도움·방해 공급량은 `source?.kind === "ecology"`이고 기본 `event.advice`만 세므로 강화판은 공급량에 포함하지 않는다.

```ts
expect(DESERT_EVENTS).toHaveLength(20);
expect(DESERT_EVENTS.filter((event) => event.kind === "monster")).toHaveLength(12);
expect(DESERT_EVENTS.filter((event) => event.kind === "special")).toHaveLength(8);
expect(DESERT_EVENTS.every((event) => event.theme === "desert")).toBe(true);
expect(DESERT_EVENTS.filter((event) => event.requiresClue !== undefined)).toHaveLength(2);
expect(() => validateSituationEvents(DESERT_EVENTS, DESERT_THEME)).not.toThrow();
```

각 `DESERT_THEME.rules`에 대해 기본 ecology advice의 `help`·`harm`이 각각 2개 이상인지 반복 검사한다. `targetBossId`별 건수는 `boss-desert-1`~`boss-desert-4` 모두 2개인지 검사한다. 보스 정보 사건의 modifier 정렬값이 매번 `[-0.2, -0.1, 0.25]`인지 검사한다. 연계는 다음 식별자를 정확히 잠근다.

```ts
expect(find("desert-heat-moving-shadow")?.revealsClue).toBe("clue-desert-cobra-shade");
expect(find("desert-heat-torn-canopy")?.upgrades?.[0].clueId).toBe("clue-desert-cobra-shade");
expect(find("desert-water-damp-well")?.revealsClue).toBe("clue-desert-scorpion-damp-burrow");
expect(find("desert-water-leaking-cargo")?.requiresClue).toBe("clue-desert-scorpion-damp-burrow");
expect(find("desert-mummy-silent-tomb")?.revealsClue).toBe("clue-desert-mummy-no-tracks");
expect(find("desert-wind-mummy-courtyard")?.requiresClue).toBe("clue-desert-mummy-no-tracks");
```

- [ ] **Step 2: 콘텐츠 모듈이 없어 테스트가 실패하는지 확인한다.**

Run: `pnpm test -- lib/content/desert-events.test.ts`

Expected: FAIL — `@/lib/content/events/desert-events` 모듈을 찾을 수 없다.

- [ ] **Step 3: F3-2와 동일한 로컬 helper를 가진 사막 데이터 모듈을 작성한다.**

`spider-events.ts`의 `ecology`, `boss`, `advice`, `ecologyAdvice`, `neutralAdvice`, 일반 사건 factory, 보스 조언 factory, 보스 사건 factory 구조를 파일 안에만 복제한다. helper가 보장할 값은 다음과 같다.

```ts
relation: outcome === "help" ? "consistent" : outcome === "harm" ? "contradictory" : "unrelated";
effectTags: [outcome === "help" ? "support" : "sabotage"];
const modifier = outcome === "help" ? -0.2 : outcome === "neutral" ? -0.1 : 0.25;
effectTags: [outcome === "harm" ? "sabotage" : "information"];
```

일반 사건은 Spec 4절의 제목·상황·세 조언·기본 결과를 그대로 옮기며 아래 ID/source/연계를 따른다. 교차 사건도 세 조언의 outcome은 하나씩만 유지한다.

| 사건 ID | help source | harm source | 연계 |
| --- | --- | --- | --- |
| `desert-heat-moving-shadow` | `desert-heat` | `desert-heat` | reveals `clue-desert-cobra-shade` |
| `desert-heat-torn-canopy` | `desert-heat` | `desert-heat` | help slot 0 upgrade |
| `desert-lizard-heated-rock` | `desert-lizard-heat` | `desert-lizard-heat` | — |
| `desert-lizard-sunrise-slope` | `desert-lizard-heat` | `desert-lizard-heat` | — |
| `desert-water-damp-well` | `desert-water` | `desert-water` | reveals `clue-desert-scorpion-damp-burrow` |
| `desert-water-leaking-cargo` | `desert-water` | `desert-water` | requires that clue |
| `desert-spirit-dry-altar` | `desert-spirit-dry` | `desert-spirit-dry` | — |
| `desert-mummy-silent-tomb` | `desert-mummy-silent` | `desert-mummy-silent` | reveals `clue-desert-mummy-no-tracks` |
| `desert-wind-track-erasure` | `desert-wind-track` | `desert-wind-track` | — |
| `desert-dry-wind-boundary` | `desert-spirit-dry` | `desert-wind-track` | — |
| `desert-mummy-dry-chamber` | `desert-mummy-silent` | `desert-spirit-dry` | — |
| `desert-wind-mummy-courtyard` | `desert-wind-track` | `desert-mummy-silent` | requires `clue-desert-mummy-no-tracks` |

보스 정보 사건은 Spec 5절 원문을 그대로 옮기고 `kind: "special"`, `theme: "desert"`와 아래 target/source를 정확히 사용한다. 도움과 방해 모두 같은 행의 `bossRuleId`를 source로 삼고 중립에는 source를 넣지 않는다.

| event ID | targetBossId | bossRuleId |
| --- | --- | --- |
| `desert-boss-zakar-burrow-trace` | `boss-desert-1` | `boss-zakar-burrow-trace` |
| `desert-boss-zakar-emerge-gap` | `boss-desert-1` | `boss-zakar-emerge-gap` |
| `desert-boss-kardum-sand-ridge` | `boss-desert-2` | `boss-kardum-sand-ridge` |
| `desert-boss-kardum-landing-pause` | `boss-desert-2` | `boss-kardum-landing-pause` |
| `desert-boss-obelon-leg-collapse` | `boss-desert-3` | `boss-obelon-leg-collapse` |
| `desert-boss-obelon-rebuild-stones` | `boss-desert-3` | `boss-obelon-rebuild-stones` |
| `desert-boss-nephris-question-still` | `boss-desert-4` | `boss-nephris-question-still` |
| `desert-boss-nephris-wrong-answer-tell` | `boss-desert-4` | `boss-nephris-wrong-answer-tell` |

- [ ] **Step 4: 사막 콘텐츠와 기존 검증기 회귀를 통과시킨다.**

Run: `pnpm test -- lib/content/desert-events.test.ts lib/content/situation-validation.test.ts lib/content/themes.test.ts`

Expected: PASS — 사막의 20개 데이터가 모든 theme·source·보스 소유권·공급량 계약을 만족하고 기존 검증기 회귀가 없다.

- [ ] **Step 5: 사막 콘텐츠 변경을 커밋한다.**

```bash
git add lib/content/events/desert-events.ts lib/content/desert-events.test.ts
git commit -m "사막 조언 사건 20개 추가" -m "사막 생태 추론 사건과 보스별 지연형 정보 사건을 콘텐츠 데이터로 등록한다."
```

### Task 3: 묘지 20개 조언 사건과 수직 슬라이스 테스트

**Files:**
- Create: `lib/content/events/graveyard-events.ts`
- Create: `lib/content/graveyard-events.test.ts`

**Interfaces:**
- Consumes: `SituationEvent`, `AdviceOption`, `AdviceSource`, `RuleId`, `BossRuleId`, `GRAVEYARD_THEME`, `validateSituationEvents`
- Produces: `export const GRAVEYARD_EVENTS: readonly SituationEvent[]`

- [ ] **Step 1: 묘지 콘텐츠 계약을 잠그는 실패 테스트를 작성한다.**

`graveyard-events.test.ts`에 아래 수직 슬라이스 검사를 작성한다. 각 `GRAVEYARD_THEME.rules`의 기본 ecology advice가 `help`·`harm`을 각각 두 개 이상 공급하는 반복 검사, 모든 보스 정보 사건의 `[-0.2, -0.1, 0.25]` modifier 검사, `validateSituationEvents(GRAVEYARD_EVENTS, GRAVEYARD_THEME)` 통과 검사를 포함한다. 네 target 보스는 `boss-graveyard-1`~`boss-graveyard-4`이며 모두 정확히 두 사건을 가져야 한다.

```ts
expect(GRAVEYARD_EVENTS).toHaveLength(20);
expect(GRAVEYARD_EVENTS.filter((event) => event.kind === "monster")).toHaveLength(12);
expect(GRAVEYARD_EVENTS.filter((event) => event.kind === "special")).toHaveLength(8);
expect(GRAVEYARD_EVENTS.every((event) => event.theme === "graveyard")).toBe(true);
expect(GRAVEYARD_EVENTS.filter((event) => event.requiresClue !== undefined)).toHaveLength(2);
expect(() => validateSituationEvents(GRAVEYARD_EVENTS, GRAVEYARD_THEME)).not.toThrow();
```

```ts
expect(find("graveyard-silence-zombie-bell")?.revealsClue).toBe("clue-graveyard-zombie-sound");
expect(find("graveyard-silence-rusted-chain")?.upgrades?.[0].clueId).toBe("clue-graveyard-zombie-sound");
expect(find("graveyard-light-mage-lantern")?.revealsClue).toBe("clue-graveyard-mage-light");
expect(find("graveyard-light-mage-two-candles")?.requiresClue).toBe("clue-graveyard-mage-light");
expect(find("graveyard-archer-light-retreat")?.revealsClue).toBe("clue-graveyard-archer-shadow");
expect(find("graveyard-desecration-archer-shadow")?.requiresClue).toBe("clue-graveyard-archer-shadow");
```

- [ ] **Step 2: 콘텐츠 모듈이 없어 테스트가 실패하는지 확인한다.**

Run: `pnpm test -- lib/content/graveyard-events.test.ts`

Expected: FAIL — `@/lib/content/events/graveyard-events` 모듈을 찾을 수 없다.

- [ ] **Step 3: F3-2 관례를 따르는 묘지 데이터 모듈을 작성한다.**

`graveyard-events.ts` 내부에 아래 로컬 helper를 두고 공용 helper 파일을 만들지 않는다. 일반 사건은 Spec 7절의 원문을 그대로 사용하며 아래 source 매핑을 따른다.

```ts
function ecology(ruleId: string): AdviceSource {
  return { kind: "ecology", ruleId: ruleId as RuleId };
}

function boss(bossRuleId: string): AdviceSource {
  return { kind: "boss", bossRuleId: bossRuleId as BossRuleId };
}

function advice(id: string, outcome: AdviceOutcome, label: string, line: string, resultText: string, effectTags: readonly EventEffectTag[], source?: AdviceSource, bossDamageModifier?: number): AdviceOption {
  return {
    id: id as ChoiceId,
    label,
    line,
    outcome,
    source,
    relation: outcome === "help" ? "consistent" : outcome === "harm" ? "contradictory" : "unrelated",
    effectTags,
    bossDamageModifier,
    resultText,
  };
}

function bossAdvice(id: string, outcome: AdviceOutcome, bossRuleId: string | undefined, label: string, line: string, resultText: string): AdviceOption {
  const modifier = outcome === "help" ? -0.2 : outcome === "neutral" ? -0.1 : 0.25;
  return advice(id, outcome, label, line, resultText, [outcome === "harm" ? "sabotage" : "information"], bossRuleId === undefined ? undefined : boss(bossRuleId), modifier);
}
```

| 사건 ID | help source | harm source | 연계 |
| --- | --- | --- | --- |
| `graveyard-silence-zombie-bell` | `graveyard-silence` | `graveyard-silence` | reveals `clue-graveyard-zombie-sound` |
| `graveyard-silence-rusted-chain` | `graveyard-silence` | `graveyard-silence` | help slot 0 upgrade |
| `graveyard-ghoul-bone-crunch` | `graveyard-ghoul-sound` | `graveyard-ghoul-sound` | — |
| `graveyard-ghoul-dropped-coin` | `graveyard-ghoul-sound` | `graveyard-ghoul-sound` | — |
| `graveyard-light-mage-lantern` | `graveyard-light` | `graveyard-light` | reveals `clue-graveyard-mage-light` |
| `graveyard-light-mage-two-candles` | `graveyard-light` | `graveyard-light` | requires that clue |
| `graveyard-archer-light-retreat` | `graveyard-archer-light` | `graveyard-archer-light` | reveals `clue-graveyard-archer-shadow` |
| `graveyard-guard-intact-goods` | `graveyard-guard` | `graveyard-guard` | — |
| `graveyard-desecration-stolen-necklace` | `graveyard-desecration` | `graveyard-desecration` | — |
| `graveyard-archer-guard-crossfire` | `graveyard-archer-light` | `graveyard-guard` | — |
| `graveyard-guard-desecration-return` | `graveyard-guard` | `graveyard-desecration` | — |
| `graveyard-desecration-archer-shadow` | `graveyard-desecration` | `graveyard-archer-light` | requires `clue-graveyard-archer-shadow` |

보스 정보 사건은 Spec 8절 원문을 그대로 옮기고 `kind: "special"`, `theme: "graveyard"`와 아래 target/source를 정확히 사용한다. 세 조언 모두 modifier를 가져야 하고 중립의 source는 없다.

| event ID | targetBossId | bossRuleId |
| --- | --- | --- |
| `graveyard-boss-barkan-command-blade` | `boss-graveyard-1` | `boss-barkan-command-blade` |
| `graveyard-boss-barkan-reform-line` | `boss-graveyard-1` | `boss-barkan-reform-line` |
| `graveyard-boss-morbian-staff-link` | `boss-graveyard-2` | `boss-morbian-staff-link` |
| `graveyard-boss-morbian-death-tell` | `boss-graveyard-2` | `boss-morbian-death-tell` |
| `graveyard-boss-azrael-marked-prey` | `boss-graveyard-3` | `boss-azrael-marked-prey` |
| `graveyard-boss-azrael-scythe-mist` | `boss-graveyard-3` | `boss-azrael-scythe-mist` |
| `graveyard-boss-valdrak-oath-boundary` | `boss-graveyard-4` | `boss-valdrak-oath-boundary` |
| `graveyard-boss-valdrak-tomb-priority` | `boss-graveyard-4` | `boss-valdrak-tomb-priority` |

- [ ] **Step 4: 묘지 콘텐츠와 기존 검증기 회귀를 통과시킨다.**

Run: `pnpm test -- lib/content/graveyard-events.test.ts lib/content/situation-validation.test.ts lib/content/themes.test.ts`

Expected: PASS — 묘지의 20개 데이터가 검증기 계약, 연계, modifier, 보스 특징 소유권을 만족한다.

- [ ] **Step 5: 묘지 콘텐츠 변경을 커밋한다.**

```bash
git add lib/content/events/graveyard-events.ts lib/content/graveyard-events.test.ts
git commit -m "묘지 조언 사건 20개 추가" -m "묘지 감각 추론 사건과 보스별 지연형 정보 사건을 콘텐츠 데이터로 등록한다."
```

### Task 4: 공식 문서·작업 배정표 동기화와 전체 검증

**Files:**
- Modify: `docs/systems/INFORMATION_AND_DECEPTION.md:242-249`
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md:187-190,285`
- Modify: `docs/superpowers/specs/2026-08-21-lattebun-f3-3-desert-graveyard-advice-content-design.md:1512-1517`

**Interfaces:**
- Consumes: `DESERT_EVENTS`, `GRAVEYARD_EVENTS`, 각 테마의 콘텐츠 테스트 통과 결과
- Produces: 공식 문서와 F3-3 완료 기준이 대표 콘텐츠 20개 계약과 실제 구현에 일치한 상태

- [ ] **Step 1: 문서 수량 변경을 확인하는 실패 검사를 실행한다.**

Run: `grep -nE '테마당 16|전용 사건 16개|16개씩' docs/systems/INFORMATION_AND_DECEPTION.md docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

Expected: MATCH — 아직 남아 있는 테마 전용 16개 계약과 F3-3 행을 확인한다.

- [ ] **Step 2: 공식 문서를 실제 완료 계약으로 갱신한다.**

`INFORMATION_AND_DECEPTION.md`의 콘텐츠 수량 표에서 테마 전용을 `테마당 20`으로 고친다. 작업 배정표의 F3-3 행은 아래 완료 기준으로 바꾸고 담당자를 `LatteBun`, 상태를 `✅`로 갱신한다. 같은 문서의 “반드시 새로 만드는 것” 요약에 남은 테마당 16개 표현도 20개 대표 콘텐츠로 맞춘다. F3-5의 테마당 30개 확장 범위는 유지한다.

```text
사막·묘지 전용 사건이 각각 20개(일반 monster 12 + 보스 정보 special 8)이며,
각 생태 규칙이 도움 2개·방해 2개 이상을 공급하고 각 보스가 전용 정보 2개를 가진다.
테마별 약한 연계 1세트와 강한 연계 2세트가 존재하며 기존 테마·보스 source 검증을 통과한다.
```

F3-3 Spec의 완료 기준은 구현된 사실과 일치하는지 확인하고, 완료 기록을 남기는 짧은 문구만 추가한다. 설계 원본의 사건 원문과 범위 정의는 변경하지 않는다.

- [ ] **Step 3: 문서 수량 불일치가 해소됐는지 확인한다.**

Run: `grep -nE '테마당 16|전용 사건 16개|16개씩' docs/systems/INFORMATION_AND_DECEPTION.md docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

Expected: no output.

- [ ] **Step 4: 전체 정적·회귀 검증을 실행한다.**

Run: `git diff --check && pnpm test && pnpm typecheck && pnpm build`

Expected: 모두 성공. `.next`의 오래된 생성 타입 때문에 `pnpm typecheck`가 실패하면 먼저 `pnpm build`를 다시 실행한 뒤 `pnpm typecheck`를 재실행하고, 같은 오류가 남으면 F3-3 변경 파일과 무관한 기존 오류인지 분리해 기록한다.

- [ ] **Step 5: 문서 완료 기록과 최종 검증 변경을 커밋한다.**

```bash
git add docs/systems/INFORMATION_AND_DECEPTION.md docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md docs/superpowers/specs/2026-08-21-lattebun-f3-3-desert-graveyard-advice-content-design.md
git commit -m "사막과 묘지 조언 콘텐츠 완료 기록" -m "대표 콘텐츠 20개 계약과 F3-3 완료 기준을 공식 문서에 반영한다."
```

## Self-Review

- **Spec coverage:** Task 1이 두 테마의 BossRule 16개와 export를, Task 2와 Task 3이 각 테마의 12 monster + 8 special·규칙 공급량·연계·modifier·소유권을, Task 4가 공식 문서의 16→20 계약 동기화와 완료 상태를 담당한다. E2/E3/E4/U5 범위 밖 기능은 어떤 Task도 구현하지 않는다.
- **Placeholder scan:** 모든 생성·수정 파일, 테스트 명령, event/source/target ID 매핑, 연계 clue ID, 커밋 메시지를 명시했다. 콘텐츠 원문은 유일한 설계 원본인 F3-3 Spec의 해당 절을 그대로 옮기도록 지정했다.
- **Type consistency:** 세 콘텐츠 모듈은 `readonly SituationEvent[]`를 export하고 `validateSituationEvents(DESERT_EVENTS, DESERT_THEME)` 및 `validateSituationEvents(GRAVEYARD_EVENTS, GRAVEYARD_THEME)`로 검증한다. BossRule ID는 Task 1에서 등록한 ID만 Task 2·3의 boss source가 참조한다.
