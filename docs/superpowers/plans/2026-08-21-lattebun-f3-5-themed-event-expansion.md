# F3-5 테마 전용 사건 확장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 거미굴·사막·묘지의 테마 전용 사건을 각각 30개로 늘리고, 기존 콘텐츠 계약과 전역 유일성을 검증한다.

**Architecture:** 기존 테마별 이벤트 모듈의 `ecologyAdvice`, `neutralAdvice`, 이벤트 helper를 그대로 사용한다. 신규 monster 여섯 개는 규칙 하나를 help/harm source로 쓰고, 일반 special 네 개는 대표 ecology source 하나만 저장하되 장면과 선택 문구에서 두 생태 규칙을 함께 추론하게 한다. 타입·validator·규칙·UI는 변경하지 않고, 전역 중복은 세 이벤트 배열을 합친 테스트에서 검증한다.

**Tech Stack:** TypeScript, Vitest 4, Next.js 16, pnpm

**Spec:** `docs/superpowers/specs/2026-08-21-lattebun-f3-5-themed-event-expansion-design.md`

## Global Constraints

- 새 runtime enum/field, ecology rule, monster, boss, clue 타입, validator 의미를 추가·변경하지 않는다.
- 모든 신규 사건은 help/harm/neutral 조언을 정확히 하나씩 가지며, neutral은 source 없이 `relation: "unrelated"`다.
- 신규 일반 special은 `kind: "special"`이고 `targetBossId`·`bossDamageModifier`가 없다.
- 기존 20개, 보스 정보 special 8개, 약한 연계 1세트와 강한 연계 2세트를 변경하지 않는다.
- 도움·방해 source는 해당 테마의 ecology rule이고 각각 `consistent`·`contradictory` 관계여야 한다.
- event/advice ID, title, description은 세 테마 전용 사건 전체에서 중복되지 않아야 한다.
- 공식 콘텐츠 계약은 테마 전용 30개·공용 90개·테마별 후보 120개다.
- 커밋 제목과 본문은 모두 한글로 쓴다.

---

## File Structure

| 파일 | 책임 |
| --- | --- |
| `lib/content/events/spider-events.ts` | 거미굴 monster 6개와 일반 special 4개 데이터 |
| `lib/content/events/desert-events.ts` | 사막 monster 6개와 일반 special 4개 데이터 |
| `lib/content/events/graveyard-events.ts` | 묘지 monster 6개와 일반 special 4개 데이터 |
| `lib/content/spider-events.test.ts` | 거미굴 30개 수량·구성·기존 연계 회귀 |
| `lib/content/desert-events.test.ts` | 사막 30개 수량·구성·기존 연계 회귀 |
| `lib/content/graveyard-events.test.ts` | 묘지 30개 수량·구성·기존 연계 회귀 |
| `lib/content/themed-events.test.ts` | 세 테마 전용 90개 전체의 ID·문구 유일성 |
| `docs/systems/INFORMATION_AND_DECEPTION.md` | 공식 콘텐츠 총량 계약 |
| `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md` | F3-5 완료 기준·요약·상태 |

### Task 1: 거미굴 10개 데이터와 30개 계약

**Files:**
- Modify: `lib/content/spider-events.test.ts`
- Modify: `lib/content/events/spider-events.ts`

**Interfaces:**
- Consumes: `spiderEvent`, `ecologyAdvice`, `neutralAdvice`, `SituationEvent`
- Produces: `SPIDER_EVENTS` — `monster` 18개, 일반 `special` 4개, 보스 정보 `special` 8개

- [ ] **Step 1: 거미굴 수량·일반 special 테스트를 30개 계약으로 변경한다.**

```ts
expect(SPIDER_EVENTS).toHaveLength(30);
expect(SPIDER_EVENTS.filter((event) => event.kind === "monster")).toHaveLength(18);
expect(SPIDER_EVENTS.filter((event) => event.kind === "special" && event.targetBossId === undefined))
  .toHaveLength(4);
expect(SPIDER_EVENTS.filter((event) => event.targetBossId !== undefined)).toHaveLength(8);
```

- [ ] **Step 2: 테스트가 RED인지 확인한다.**

Run: `pnpm test lib/content/spider-events.test.ts`  
Expected: FAIL — 현재 사건 수 20개와 신규 일반 special 0개가 기대값과 다름.

- [ ] **Step 3: 6개 monster를 기존 `SPIDER_MONSTER_EVENTS`에 추가한다.**

각 사건은 `spiderEvent(id, title, description, [help, harm, neutral], defaultResultText)`로 만들고, help/harm에는 같은 규칙 source를 쓴다.

각 호출에는 design Spec 5.1의 event ID·제목·description·H/X/N label과 resultText를
그대로 옮긴다. 새 `line`과 `defaultResultText`는 Spec 6.1의 인과·보수성 규칙으로
작성해 기존 helper 인자에 전달한다.

추가 ID와 source는 아래처럼 고정한다.

| event ID | help/harm rule |
| --- | --- |
| `spider-fire-smoke-gap` | `spider-fire` |
| `spider-brood-lantern-cluster` | `spider-brood-light` |
| `spider-vibration-loose-gravel` | `spider-vibration` |
| `spider-armor-vibration-hammer` | `spider-armor-vibration` |
| `spider-carrion-bloody-cloth` | `spider-carrion` |
| `spider-shadow-light-edge` | `spider-shadow` |

- [ ] **Step 4: 4개 일반 special을 같은 배열에 추가하고 `kind`만 덮어쓴다.**

`spiderEvent(..., { kind: "special" })`의 `extras`로 monster 기본값만 덮어쓴다.
각 사건의 문자열은 design Spec 5.1을, 새 `line`과 `defaultResultText`는 Spec 6.1을
따른다.

대표 source는 review Spec 표를 그대로 쓴다: `carrion-dark-store` H shadow/X carrion, `fire-shadow-lane` H/X shadow, `vibration-carrion-floor` H/X vibration, `fire-brood-trap` H/X brood-light. `targetBossId`와 `bossDamageModifier`는 어떤 조언에도 넣지 않는다.

- [ ] **Step 5: 거미굴 단위 테스트를 GREEN으로 확인한다.**

Run: `pnpm test lib/content/spider-events.test.ts`  
Expected: PASS — 30개 구성, 규칙 공급, 기존 clue·보스 정보·validator 회귀가 모두 통과.

- [ ] **Step 6: 거미굴 변경을 커밋한다.**

```bash
git add lib/content/events/spider-events.ts lib/content/spider-events.test.ts
git commit -m "거미굴 테마 사건 10개 확장" -m "생태 규칙별 몬스터와 복합 특수 사건을 추가한다."
```

### Task 2: 사막 10개 데이터와 30개 계약

**Files:**
- Modify: `lib/content/desert-events.test.ts`
- Modify: `lib/content/events/desert-events.ts`

**Interfaces:**
- Consumes: `desertEvent`, `ecologyAdvice`, `neutralAdvice`, `SituationEvent`
- Produces: `DESERT_EVENTS` — `monster` 18개, 일반 `special` 4개, 보스 정보 `special` 8개

- [ ] **Step 1: 사막 테스트의 총수·monster·일반 special·보스 정보 special 기대값을 30/18/4/8로 바꾼다.**

```ts
expect(DESERT_EVENTS).toHaveLength(30);
expect(DESERT_EVENTS.filter((event) => event.kind === "monster")).toHaveLength(18);
expect(DESERT_EVENTS.filter((event) => event.kind === "special" && !event.targetBossId)).toHaveLength(4);
expect(DESERT_EVENTS.filter((event) => event.targetBossId)).toHaveLength(8);
```

- [ ] **Step 2: 테스트가 RED인지 확인한다.**

Run: `pnpm test lib/content/desert-events.test.ts`  
Expected: FAIL — 현재 사막 데이터는 20개와 보스 정보 special 8개뿐임.

- [ ] **Step 3: 6개 사막 monster를 기존 배열에 추가한다.**

| event ID | help/harm rule |
| --- | --- |
| `desert-heat-shadow-rock` | `desert-heat` |
| `desert-lizard-heat-hot-ridge` | `desert-lizard-heat` |
| `desert-water-damp-stone-ring` | `desert-water` |
| `desert-spirit-dry-white-basin` | `desert-spirit-dry` |
| `desert-mummy-silent-dust-door` | `desert-mummy-silent` |
| `desert-wind-track-half-print` | `desert-wind-track` |

각 호출의 label과 resultText는 design Spec 5.2를 그대로 옮기고, `line`과
`defaultResultText`는 Spec 6.1의 필수 문구 규칙으로 작성한다.

- [ ] **Step 4: 4개 사막 일반 special을 `kind: "special"`로 추가한다.**

| event ID | H representative source | X representative source |
| --- | --- | --- |
| `desert-special-water-dry-split` | `desert-spirit-dry` | `desert-water` |
| `desert-special-heat-water-well` | `desert-water` | `desert-water` |
| `desert-special-mummy-wind-trace` | `desert-wind-track` | `desert-wind-track` |
| `desert-special-heat-lizard-trap` | `desert-lizard-heat` | `desert-lizard-heat` |

```ts
desertEvent(id, title, description, adviceOptions, defaultResultText, { kind: "special" });
```

각 description, H/X/N label·line·resultText, 기본 결과는 design Spec 5.2를 문장 단위로 옮긴다. neutral에는 source나 modifier를 넣지 않는다.

- [ ] **Step 5: 사막 단위 테스트를 GREEN으로 확인한다.**

Run: `pnpm test lib/content/desert-events.test.ts`  
Expected: PASS — 30개 계약과 기존 약한·강한 연계, 보스별 2개 정보 사건, validator가 모두 통과.

- [ ] **Step 6: 사막 변경을 커밋한다.**

```bash
git add lib/content/events/desert-events.ts lib/content/desert-events.test.ts
git commit -m "사막 테마 사건 10개 확장" -m "생태 규칙별 몬스터와 복합 특수 사건을 추가한다."
```

### Task 3: 묘지 10개 데이터와 테마 전용 전역 중복 검증

**Files:**
- Modify: `lib/content/graveyard-events.test.ts`
- Modify: `lib/content/events/graveyard-events.ts`
- Create: `lib/content/themed-events.test.ts`

**Interfaces:**
- Consumes: `GRAVEYARD_EVENTS`, `SPIDER_EVENTS`, `DESERT_EVENTS`
- Produces: `GRAVEYARD_EVENTS` 30개와 세 테마 합산 전역 유일성 회귀 테스트

- [ ] **Step 1: 묘지 테스트를 30/18/4/8 계약으로 바꾸고, 새 전역 테스트를 작성한다.**

```ts
const THEMED_EVENTS = [...SPIDER_EVENTS, ...DESERT_EVENTS, ...GRAVEYARD_EVENTS];

it("세 테마 전용 사건 90개의 식별자와 문구가 전역에서 유일하다", () => {
  expect(THEMED_EVENTS).toHaveLength(90);
  expect(new Set(THEMED_EVENTS.map((event) => event.id)).size).toBe(90);
  expect(new Set(THEMED_EVENTS.flatMap((event) => event.advice.map((advice) => advice.id))).size)
    .toBe(270);
  expect(new Set(THEMED_EVENTS.map((event) => event.title)).size).toBe(90);
  expect(new Set(THEMED_EVENTS.map((event) => event.description)).size).toBe(90);
});
```

- [ ] **Step 2: 테스트가 RED인지 확인한다.**

Run: `pnpm test lib/content/graveyard-events.test.ts lib/content/themed-events.test.ts`  
Expected: FAIL — 묘지가 아직 20개이고 전역 사건 수가 80개다.

- [ ] **Step 3: 6개 묘지 monster를 추가한다.**

| event ID | help/harm rule |
| --- | --- |
| `graveyard-silence-fallen-bell` | `graveyard-silence` |
| `graveyard-ghoul-sound-small-bell` | `graveyard-ghoul-sound` |
| `graveyard-light-candle-mage` | `graveyard-light` |
| `graveyard-archer-light-column` | `graveyard-archer-light` |
| `graveyard-guard-intact-offerings` | `graveyard-guard` |
| `graveyard-desecration-open-chest` | `graveyard-desecration` |

각 호출의 label과 resultText는 design Spec 5.3을 그대로 옮기고, `line`과
`defaultResultText`는 Spec 6.1의 필수 문구 규칙으로 작성한다.

- [ ] **Step 4: 4개 묘지 일반 special을 추가한다.**

| event ID | H representative source | X representative source |
| --- | --- | --- |
| `graveyard-special-guard-desecration-tomb` | `graveyard-desecration` | `graveyard-desecration` |
| `graveyard-special-sound-light-hall` | `graveyard-ghoul-sound` | `graveyard-ghoul-sound` |
| `graveyard-special-mage-archer-light` | `graveyard-light` | `graveyard-archer-light` |
| `graveyard-special-zombie-ghoul-sound-trap` | `graveyard-ghoul-sound` | `graveyard-ghoul-sound` |

```ts
graveyardEvent(id, title, description, adviceOptions, defaultResultText, { kind: "special" });
```

각 special은 두 생태 규칙을 모두 description과 행동 결과에 드러내되, review Spec이 고정한 H/X 대표 source 하나만 저장한다.

- [ ] **Step 5: 묘지·전역 테스트를 GREEN으로 확인한다.**

Run: `pnpm test lib/content/graveyard-events.test.ts lib/content/themed-events.test.ts`  
Expected: PASS — 테마별 30개, 세 테마 90개·조언 270개, ID·제목·묘사 유일성 및 기존 연계가 통과.

- [ ] **Step 6: 묘지와 전역 검증 변경을 커밋한다.**

```bash
git add lib/content/events/graveyard-events.ts lib/content/graveyard-events.test.ts lib/content/themed-events.test.ts
git commit -m "묘지 테마 사건과 전역 검증 확장" -m "묘지 복합 사건을 추가하고 테마 전용 콘텐츠의 중복을 방지한다."
```

### Task 4: 공식 콘텐츠 계약과 완료 배정표 동기화

**Files:**
- Modify: `docs/systems/INFORMATION_AND_DECEPTION.md`
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

**Interfaces:**
- Consumes: 세 테마 전용 30개와 공용 사건 90개라는 검증된 콘텐츠 수량
- Produces: 구현 데이터와 일치하는 공식 문서·완료 상태

- [ ] **Step 1: 공식 문서의 이전 수량 표현을 검색해 변경 대상만 확인한다.**

Run: `grep -nE '31개|테마당 20|공용 \| 15|\| 35' docs/systems/INFORMATION_AND_DECEPTION.md`  
Expected: 31개 서술과 20/15/35 표 행이 반환됨.

- [ ] **Step 2: 정보·기만 공식 문서의 수량 계약을 갱신한다.**

```md
| 테마 전용 | 테마당 30 |
| 공용 | 90 |
| 한 테마에서 만날 수 있는 것 | 120 |
```

31개라는 서술은 “테마 전용 30개와 공용 90개가 함께 있어도 두 종류의 추론이 단조롭지 않다”라는 의미가 분명한 문장으로 교체한다. 활성 규칙과 중립 공급 규칙은 변경하지 않는다.

- [ ] **Step 3: 작업 배정표의 F3-5 행과 대표 콘텐츠 요약을 갱신한다.**

```md
| F3-5 | 테마 전용 사건 확장 | 테마마다 전용 사건이 30개(일반 `monster` 18 + 일반 `special` 4 + 보스 정보 `special` 8)이며, 규칙별 도움·방해 공급과 테마별 중립 공급을 유지하고 세 테마 전역 ID·문구 중복 검증을 통과 | — | — | LatteBun | ✅ |
```

대표 콘텐츠 요약의 테마당 20개도 30개로 맞춘다.

- [ ] **Step 4: 문서 변경과 전체 검증을 확인한다.**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`  
Expected: 모든 명령이 성공하고, 문서 수량과 테스트된 데이터 수량이 일치.

- [ ] **Step 5: 공식 문서 동기화를 커밋한다.**

```bash
git add docs/systems/INFORMATION_AND_DECEPTION.md docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md
git commit -m "테마 사건 확장 공식 계약 갱신" -m "전용 사건 수량과 전역 중복 검증 기준을 문서에 반영한다."
```

## Plan Self-Review

- **Spec coverage:** Task 1~3이 30개 콘텐츠, 규칙별 monster, 복합 special, 기존 clue·보스 정보 보존과 테마별 validator를 맡고, Task 3이 전역 중복 요구를 담당한다. Task 4가 공식 문서·배정표 동기화와 최종 상태를 맡는다.
- **Placeholder scan:** 구현자가 의존할 event ID, source, 파일, 테스트 명령, 문서의 최종 수량 및 커밋 메시지를 모두 명시했다. 각 테마의 나머지 문자열은 design Spec 5절의 승인된 event ID별 명세를 그대로 옮긴다.
- **Type consistency:** 모든 신규 일반 special은 기존 `SituationEvent`와 helper의 `extras: Partial<SituationEvent>`를 사용하며, 새 API·타입·validator 함수는 정의하지 않는다.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-21-lattebun-f3-5-themed-event-expansion.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
