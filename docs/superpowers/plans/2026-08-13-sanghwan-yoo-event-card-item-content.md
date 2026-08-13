# F2 사건·카드·아이템 콘텐츠 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or **superpowers:executing-plans** to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** F1의 캠페인·탐험 계약을 유지하면서 S급까지 생성할 수 있는 사건·정보 카드·아이템·보스 콘텐츠 풀과 구조화 불변식 검증, F1 연동 브라우저 검증 페이지를 추가한다.

**Architecture:** 콘텐츠 정의는 `lib/content`에 두고, 공유 데이터 타입·닫힌 태그·브랜드 ID는 `lib/domain`에 둔다. `validateContentPools`는 콘텐츠를 계산하거나 변형하지 않고 계약 위반을 `RuleError("INVALID_GENERATION")`으로 보고한다. `/f2-test`는 F1 fixture와 실제 콘텐츠 풀을 직접 호출하는 서버 검증 화면이며, 이후 Task 6~7 규칙 계산을 구현하지 않는다.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript 5 strict mode, Vitest 4, 기존 Tailwind CSS, 기존 `RuleError`와 F1 fixture, `pnpm`.

## Global Constraints

- 일반 사건은 정확히 12개를 `monster/rest/merchant/special` 각 3개로 제공한다.
- 모든 일반·보스 사건은 선택지를 2개 이상 제공하고, 모든 F2 선택지는 유효한 `effectTags`를 하나 이상 가진다.
- F2 콘텐츠에는 보스 거래 또는 보스 대상 선택지를 넣지 않는다. 기존 역사적 mock의 호환 분기는 F2 생산 콘텐츠 검증 대상이 아니며 별도 이행 작업에서 정리한다.
- 정보 카드는 12개이며 `truth/lie/neutral` 각 4개, `subject === "boss"` 최소 2개다.
- 아이템은 치료제·독·식량·정보 두루마리·유인용 미끼를 각각 하나 이상 제공하며 가짜 지도는 제공하지 않는다.
- 보스 데이터는 C/B/A/S 각 1개이며 `baseDamage`는 1 이상의 정수다.
- 효과 태그는 F2에서 계산하지 않는다. HP·신뢰·골드·피해·생존·RNG 소비는 Task 6~7에서 해석한다.
- 콘텐츠 오류는 기존 `RuleError`의 `INVALID_GENERATION` code와 구조화 `details`를 사용한다.
- F1 fixture 값과 `/f1-test`의 기존 표시 계약을 불필요하게 바꾸지 않는다.
- 새 런타임 의존성을 추가하지 않는다.
- Next.js 코드를 작성하기 전에 저장소의 `node_modules/next/dist/docs/` 관련 guide를 확인한다.
- 모든 변경은 `apply_patch`로 편집하고, 각 task의 커밋 제목과 본문은 한글로 작성한다.
- 최종 완료 표시는 자동 검증과 실제 브라우저 검증을 모두 통과한 뒤에만 한다.

---

## 파일 구조와 책임

### 도메인 계약

- Create: `lib/domain/content.ts` — `EventEffectTag`, `ItemKind`, `ItemEffectTag`, `ItemDef`, `BossDef`와 닫힌 목록 상수
- Modify: `lib/domain/ids.ts` — `BossId` 브랜드 추가
- Modify: `lib/domain/dungeon.ts` — `EventChoice.effectTags` 필수 필드 추가
- Modify: `lib/domain/index.ts` — 새 브랜드·콘텐츠 타입·상수 export
- Modify: `lib/domain/__checks__.ts` — 새 브랜드와 필수 필드의 compile-time 검사
- Modify: `lib/mock/events.ts` — 기존 역사적 UI fixture의 필수 `effectTags` 보완

### 콘텐츠 데이터

- Modify: `lib/content/events.ts` — 일반 사건 12개와 보스 사건 풀
- Create: `lib/content/info-cards.ts` — 12개 정보 카드
- Create: `lib/content/items.ts` — 5개 아이템 정의
- Create: `lib/content/bosses.ts` — C/B/A/S 보스 정의

### 콘텐츠 검증

- Create: `lib/content/validation.ts` — 사건 단독 검증과 전체 `validateContentPools`
- Create: `lib/content/content.test.ts` — 정상 풀·오류 fixture·불변성 테스트
- Modify: `lib/rules/dungeon.ts` — 기존 사건 생성 검증을 공유 validator로 연결하고 구조화 오류 유지
- Modify: `lib/rules/dungeon.test.ts` — 사건 선택지 계약과 `RuleError` 회귀 검사

### F1 연동 검증 화면

- Create: `app/f2-test/f2-test-snapshot.ts` — F1 fixture·F2 콘텐츠·음성 시나리오의 순수 snapshot 생성
- Create: `app/f2-test/f2-test-snapshot.test.ts` — 페이지 snapshot의 핵심 수량·재현성·오류 보고 테스트
- Create: `app/f2-test/page.tsx` — `/f2-test?seed=` 서버 검증 화면
- Modify: `app/f1-test/page.tsx` — F2 검증 화면 링크 추가

### 문서와 최종 검증

- Create: `docs/technical/F2_TESTING.md` — 자동·브라우저 검증 절차
- Modify: `docs/technical/F1_TESTING.md` — F2 연동 링크와 회귀 안내
- Modify: `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md` — 사건·아이템·보스 콘텐츠 계약
- Modify: `docs/systems/INFORMATION_AND_DECEPTION.md` — 카드 풀 수량과 보스 카드 최소 수량
- Modify: `docs/README.md` — F2 spec·plan 기록 링크
- Modify: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md` — 모든 검증 뒤 F2 담당·상태 갱신

---

### Task 1: 공유 콘텐츠 타입과 브랜드 ID 고정

**Files:**

- Create: `lib/domain/content.ts`
- Modify: `lib/domain/ids.ts`
- Modify: `lib/domain/dungeon.ts`
- Modify: `lib/domain/index.ts`
- Modify: `lib/domain/__checks__.ts`
- Modify: `lib/mock/events.ts`
- Test: `lib/domain/constants.test.ts`, `lib/domain/__checks__.ts`

**Interfaces:**

- Produces `BossId = Brand<string, "BossId">`.
- Produces `EventEffectTag = "support" | "sabotage" | "rest" | "trade" | "item" | "information" | "observe"` and `EVENT_EFFECT_TAGS`.
- Produces `ItemKind = "healing" | "poison" | "food" | "information" | "lure"` and `ITEM_KINDS`.
- Produces `ItemEffectTag = "restoreHp" | "dealDamage" | "restoreFood" | "revealInformation" | "lureMonster"` and `ITEM_EFFECT_TAGS`.
- Produces `ItemDef { id: ItemId; kind: ItemKind; name: string; description: string; price: number; effectTags: readonly ItemEffectTag[] }`.
- Produces `BossDef { id: BossId; grade: Grade; name: string; description: string; baseDamage: number }`.
- Changes `EventChoice` to require `effectTags: readonly EventEffectTag[]` while retaining the existing optional `target` for compatibility.

- [ ] **Step 1: Add failing compile/type assertions for the new contracts.**

Add the following values to `lib/domain/__checks__.ts` before the implementation exists:

```ts
import type {
  BossDef,
  BossId,
  EventChoice,
  ItemDef,
  ItemId,
} from "./index";

export const sampleBossId = "boss-c" as BossId;
export const sampleItemId = "item-healing-potion" as ItemId;
export const sampleChoiceWithEffect: EventChoice = {
  id: "choice-support" as ChoiceId,
  label: "안전한 길을 알려준다",
  expectedGain: "파티의 피해를 줄인다",
  knownRisk: "지원 사실이 드러날 수 있다",
  effectTags: ["support"],
};
export const sampleItem: ItemDef = {
  id: sampleItemId,
  kind: "healing",
  name: "치료제",
  description: "상처를 치료한다.",
  price: 4,
  effectTags: ["restoreHp"],
};
export const sampleBoss: BossDef = {
  id: sampleBossId,
  grade: "C",
  name: "C급 수호자",
  description: "낮은 등급 던전의 수호자다.",
  baseDamage: 20,
};
```

Expected: `pnpm typecheck` fails because `BossId`, content definitions, tag constants, and `EventChoice.effectTags` are not yet available.

- [ ] **Step 2: Implement the closed lists, definitions, and brand.**

Add the exact unions and `as const satisfies readonly ...[]` lists from the Interfaces block. Add `BossId` to `lib/domain/ids.ts`, re-export it and all content definitions from `lib/domain/index.ts`, and add `effectTags` to `EventChoice` as a required readonly array.

Update every existing `DungeonEvent` fixture that now fails typecheck. In `lib/domain/__checks__.ts`, use `effectTags: ["support"]` for the supporting choice and `effectTags: ["observe"]` for the watch choice. In `lib/mock/events.ts`, preserve the mock's historical audience targets but add a tag to each choice according to its intent: support choices use `support`, harmful choices use `sabotage`, rest choices use `rest`, purchases use `trade`, information choices use `information`, and watch choices use `observe`. `lib/flow/run-machine.ts` only consumes the `EventChoice` type and requires no logic change.

- [ ] **Step 3: Run focused type and domain tests.**

Run: `pnpm typecheck && pnpm test lib/domain/constants.test.ts lib/domain/errors.test.ts`

Expected: typecheck and the focused domain tests pass. No event content pool or rule calculation is changed in this task.

- [ ] **Step 4: Commit the contract boundary.**

```bash
git add lib/domain/content.ts lib/domain/ids.ts lib/domain/dungeon.ts lib/domain/index.ts lib/domain/__checks__.ts lib/mock/events.ts
git commit -m "기반: F2 콘텐츠 타입과 브랜드 ID를 정의한다" -m "사건 효과 태그, 아이템·보스 데이터 계약과 BossId를 추가한다."
```

### Task 2: 사건·카드·아이템·보스 콘텐츠 풀 채우기

**Files:**

- Modify: `lib/content/events.ts`
- Create: `lib/content/info-cards.ts`
- Create: `lib/content/items.ts`
- Create: `lib/content/bosses.ts`
- Create: `lib/content/content.test.ts`
- Test: `lib/rules/dungeon.test.ts`

**Interfaces:**

- Produces `DUNGEON_EVENT_POOLS: DungeonEventPools` with 12 regular events and at least one boss event.
- Produces `INFO_CARDS: readonly InfoCard[]` with 12 cards.
- Produces `ITEMS: readonly ItemDef[]` with the five required item kinds.
- Produces `BOSSES: readonly BossDef[]` with one definition per `Grade`.

- [ ] **Step 1: Write failing inventory tests.**

Create `lib/content/content.test.ts` with tests that import the not-yet-created pools:

```ts
import { describe, expect, it } from "vitest";
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
import { INFO_CARDS } from "@/lib/content/info-cards";
import { ITEMS } from "@/lib/content/items";
import { BOSSES } from "@/lib/content/bosses";
import { EVENT_KINDS, GRADES, ITEM_KINDS, TRUTH_TYPES } from "@/lib/domain";

describe("F2 콘텐츠 정상 풀", () => {
  it("일반 사건 12개를 네 분류별 3개로 제공한다", () => {
    expect(EVENT_KINDS.every((kind) => DUNGEON_EVENT_POOLS.regular[kind].length === 3)).toBe(true);
    expect(EVENT_KINDS.flatMap((kind) => DUNGEON_EVENT_POOLS.regular[kind])).toHaveLength(12);
  });

  it("모든 사건의 선택지가 두 개 이상이다", () => {
    const events = [
      ...EVENT_KINDS.flatMap((kind) => DUNGEON_EVENT_POOLS.regular[kind]),
      ...DUNGEON_EVENT_POOLS.boss,
    ];
    expect(events.every((event) => event.choices.length >= 2)).toBe(true);
  });

  it("카드·아이템·보스의 요구 수량을 제공한다", () => {
    expect(INFO_CARDS).toHaveLength(12);
    for (const truthType of TRUTH_TYPES) {
      expect(INFO_CARDS.filter((card) => card.truthType === truthType)).toHaveLength(4);
    }
    expect(INFO_CARDS.filter((card) => card.subject === "boss").length).toBeGreaterThanOrEqual(2);
    expect(ITEMS.map((item) => item.kind)).toEqual(expect.arrayContaining([...ITEM_KINDS]));
    expect(BOSSES.map((boss) => boss.grade)).toEqual([...GRADES]);
  });
});
```

Run: `pnpm test lib/content/content.test.ts`

Expected: FAIL because the new content modules and the 12-event inventory do not yet exist.

- [ ] **Step 2: Expand the event pool without adding forbidden behavior.**

Keep the existing `DungeonEventPools` shape and rewrite `lib/content/events.ts` so the regular IDs are distributed as follows:

| Kind | Event IDs |
| --- | --- |
| `monster` | `event-goblin-ambush`, `event-spider-nest`, `event-collapsed-bridge` |
| `rest` | `event-dying-campfire`, `event-abandoned-camp`, `event-wounded-scout` |
| `merchant` | `event-shadow-merchant`, `event-map-peddler`, `event-herbalist-cart` |
| `special` | `event-sealed-contract`, `event-whispering-door`, `event-unstable-rune` |

Retain `event-boss-audience` as the boss event and give it at least two choices, removing its `target: { kind: "boss" }` and negotiation copy. Every production choice must include a non-empty `effectTags` array. Use `support`, `sabotage`, `rest`, `trade`, `item`, `information`, and `observe` according to the choice's declared intent. Each event must expose a meaningful alternative, not two labels for the same action; at minimum, the choices should cover a support/safety path and a risky, costly, or observing path.

- [ ] **Step 3: Create the card pool.**

Create 12 `InfoCard` values with four `truth`, four `lie`, and four `neutral` cards. Use route, event, monster, rest, merchant, and boss topics across the pool. Make at least two cards use `subject: "boss"`; all cards must have unique IDs, non-empty topics, and non-empty text. Do not add a card audience field or any card effect calculation.

- [ ] **Step 4: Create the item and boss data.**

Create exactly one initial item for each required kind with these IDs and declarative tags:

| ID | Kind | Tags |
| --- | --- | --- |
| `item-healing-potion` | `healing` | `restoreHp` |
| `item-venom-vial` | `poison` | `dealDamage` |
| `item-hard-rations` | `food` | `restoreFood` |
| `item-information-scroll` | `information` | `revealInformation` |
| `item-lure-pouch` | `lure` | `lureMonster` |

Use positive integer prices for the production values even though the validator permits zero. Create `boss-c`, `boss-b`, `boss-a`, and `boss-s` with grades in `C`, `B`, `A`, and `S`, non-empty descriptions, and positive integer `baseDamage` values. Do not encode a combat formula.

- [ ] **Step 5: Run inventory and dungeon regressions.**

Run: `pnpm test lib/content/content.test.ts lib/rules/dungeon.test.ts`

Expected: all normal inventory tests and existing dungeon generation tests pass. If an existing fixture is now missing `effectTags`, update only that fixture's data shape; do not weaken the required field.

- [ ] **Step 6: Commit the content data.**

```bash
git add lib/content/events.ts lib/content/info-cards.ts lib/content/items.ts lib/content/bosses.ts lib/content/content.test.ts
git commit -m "콘텐츠: F2 사건·카드·아이템·보스 풀을 채운다" -m "S급까지 사용할 사건 12개와 정보·아이템·등급별 보스 데이터를 추가한다."
```

### Task 3: 콘텐츠 validator와 구조화 생성 오류

**Files:**

- Create: `lib/content/validation.ts`
- Modify: `lib/content/content.test.ts`
- Modify: `lib/rules/dungeon.ts`
- Modify: `lib/rules/dungeon.test.ts`

**Interfaces:**

- Produces `ContentPools { events: DungeonEventPools; cards: readonly InfoCard[]; items: readonly ItemDef[]; bosses: readonly BossDef[] }`.
- Produces `validateDungeonEventPools(pools: DungeonEventPools): void` for the event generator's event-only validation.
- Produces `validateContentPools(pools: ContentPools): void` for the complete F2 contract.
- Both functions throw `RuleError` with code `INVALID_GENERATION`, a Korean message, and details containing the failing content type plus relevant ID/kind/count.

- [ ] **Step 1: Add failing negative and immutability tests.**

Extend `lib/content/content.test.ts` with explicit malformed fixtures created from `structuredClone`:

```ts
import { RuleError } from "@/lib/domain";
import type { BossDef, DungeonEvent, EventKind, InfoCard, ItemDef } from "@/lib/domain";
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
import { INFO_CARDS } from "@/lib/content/info-cards";
import { ITEMS } from "@/lib/content/items";
import { BOSSES } from "@/lib/content/bosses";
import { validateContentPools } from "@/lib/content/validation";

const validPools = () => ({
  events: structuredClone(DUNGEON_EVENT_POOLS),
  cards: structuredClone(INFO_CARDS),
  items: structuredClone(ITEMS),
  bosses: structuredClone(BOSSES),
});

type MutablePools = {
  events: { regular: Record<EventKind, DungeonEvent[]>; boss: DungeonEvent[] };
  cards: InfoCard[];
  items: ItemDef[];
  bosses: BossDef[];
};

function mutablePools(): MutablePools {
  return structuredClone(validPools()) as MutablePools;
}

function expectInvalid(pools: ReturnType<typeof validPools>) {
  try {
    validateContentPools(pools);
    throw new Error("검증이 실패해야 한다.");
  } catch (error) {
    expect(error).toBeInstanceOf(RuleError);
    expect((error as RuleError).code).toBe("INVALID_GENERATION");
    return error as RuleError;
  }
}

it("사건 ID·선택지 ID·카드 ID 중복을 구조화 오류로 거부한다", () => {
  const pools = mutablePools();
  pools.events.regular.rest[0].id = pools.events.regular.monster[0].id;
  expectInvalid(pools);
});

it("부족한 사건·보스 카드·아이템 종류를 거부하고 입력을 바꾸지 않는다", () => {
  const pools = mutablePools();
  const snapshot = structuredClone(pools);
  pools.events.regular.special = pools.events.regular.special.slice(0, 2);
  pools.cards = pools.cards.filter((card) => card.subject !== "boss");
  pools.items = pools.items.filter((item) => item.kind !== "lure");
  expectInvalid(pools);
  expect(snapshot.events.regular.monster).toHaveLength(3);
});

it("보스 대상 선택지와 잘못된 수치를 거부한다", () => {
  const pools = mutablePools();
  pools.events.regular.special[0].choices[0].target = { kind: "boss" };
  pools.items[0].price = -1;
  pools.bosses[0].baseDamage = 0;
  const error = expectInvalid(pools);
  expect(error.details).toHaveProperty("contentType");
});
```

Run: `pnpm test lib/content/content.test.ts`

Expected: FAIL because `validateContentPools` is not defined or does not yet return structured `RuleError` values.

- [ ] **Step 2: Implement event-only and complete validation.**

In `lib/content/validation.ts`, collect IDs in `Set<string>` instances and validate in this order: event pool shape, event and choice fields/tags/targets, card fields/counts, item fields/kinds/prices/tags, and boss fields/grade uniqueness/base damage. Return the first deterministic failure as `new RuleError("INVALID_GENERATION", message, details)`; never mutate the input. Validate the complete F2 pool's 12-event capacity as at least 12 and each regular kind as at least 3. `validateDungeonEventPools` uses the same field, target, tag, and ID checks for the event generator but keeps its existing minimum of 2 per regular kind for historical rule fixtures; `validateContentPools` adds the F2 minimum of 3 per kind and 12 total. The production pool test keeps the exact count at 12.

Keep the event generator's existing call contract by importing `validateDungeonEventPools` into `lib/rules/dungeon.ts`. Replace raw `Error` throws for content failures with `RuleError("INVALID_GENERATION", ...)`, retaining Korean message fragments that existing regex assertions depend on (`monster`, `선택지`, `이벤트 ID`, `보스`). Do not make `generateDungeon` consume cards, items, or bosses yet.

- [ ] **Step 3: Add regression assertions for the shared generator validator.**

Update `lib/rules/dungeon.test.ts` to assert both the existing rejection messages and the new structured code:

```ts
it("사건 풀 오류는 INVALID_GENERATION 구조화 오류다", () => {
  const pools = clonedPools();
  const invalid = {
    ...pools,
    regular: { ...pools.regular, monster: pools.regular.monster.slice(0, 1) },
  };
  try {
    generateDungeon(createRng("invalid").derive("dungeon"), { eventPools: invalid });
    throw new Error("생성 오류가 필요하다.");
  } catch (error) {
    expect(error).toMatchObject({ name: "RuleError", code: "INVALID_GENERATION" });
  }
});
```

Retain the current duplicate ID, wrong kind, empty choice, empty gain/risk, and party-member-target cases. Add a production-pool assertion that all choices have `effectTags.length >= 1` and no production choice has a boss target.

- [ ] **Step 4: Run the validator and rule tests.**

Run: `pnpm test lib/content/content.test.ts lib/rules/dungeon.test.ts`

Expected: all normal and negative content tests pass; every invalid fixture reports `RuleError.code === "INVALID_GENERATION"`; input snapshots remain unchanged.

- [ ] **Step 5: Commit the validator.**

```bash
git add lib/content/validation.ts lib/content/content.test.ts lib/rules/dungeon.ts lib/rules/dungeon.test.ts
git commit -m "검증: F2 콘텐츠 불변식과 구조화 오류를 추가한다" -m "사건·카드·아이템·보스 풀을 검증하고 생성 실패 원인을 보존한다."
```

### Task 4: F1 연동 F2 검증 snapshot과 브라우저 페이지

**Files:**

- Create: `app/f2-test/f2-test-snapshot.ts`
- Create: `app/f2-test/f2-test-snapshot.test.ts`
- Create: `app/f2-test/page.tsx`
- Modify: `app/f1-test/page.tsx`

**Interfaces:**

- Produces `createF2TestSnapshot(seed: string): F2TestSnapshot`.
- `F2TestSnapshot` contains the F1 campaign/expedition fixtures, content counts, C/B/A/S capacity rows, overall validation result, five negative-case results, and a same-seed reproducibility result.
- The page reads `searchParams: Promise<{ seed?: string | string[] | undefined }>` using the same first-value/trim/default pattern as `app/f1-test/page.tsx`.
- The page exposes the stable test IDs `f2-f1-campaign`, `f2-f1-expedition`, `f2-content-status`, `f2-events`, `f2-cards`, `f2-items`, `f2-bosses`, `f2-capacity`, `f2-negative-cases`, and `f2-reproducibility`.

- [ ] **Step 1: Write the snapshot tests before the page helper.**

Create `app/f2-test/f2-test-snapshot.test.ts` with pure assertions:

```ts
import { describe, expect, it } from "vitest";
import { createF2TestSnapshot } from "./f2-test-snapshot";

describe("F2 검증 snapshot", () => {
  it("F1 fixture와 콘텐츠 통계를 함께 반환한다", () => {
    const snapshot = createF2TestSnapshot("alpha");
    expect(snapshot.seed).toBe("alpha");
    expect(snapshot.campaign.seed).toBe("alpha");
    expect(snapshot.contentStatus).toBe("pass");
    expect(snapshot.eventCounts).toEqual({ monster: 3, rest: 3, merchant: 3, special: 3 });
    expect(snapshot.cardCounts).toEqual({ truth: 4, lie: 4, neutral: 4 });
    expect(snapshot.capacity.map((row) => row.required)).toEqual([6, 8, 10, 12]);
    expect(snapshot.capacity.every((row) => row.pass)).toBe(true);
  });

  it("같은 seed의 F1 fixture는 재현되고 모든 음성 검증은 실패를 감지한다", () => {
    const snapshot = createF2TestSnapshot("alpha");
    expect(snapshot.reproducible).toBe(true);
    expect(snapshot.negativeCases).toHaveLength(5);
    expect(snapshot.negativeCases.every((scenario) => scenario.pass)).toBe(true);
    expect(snapshot.negativeCases.every((scenario) => scenario.code === "INVALID_GENERATION")).toBe(true);
  });
});
```

Run: `pnpm test app/f2-test/f2-test-snapshot.test.ts`

Expected: FAIL because the snapshot helper and route do not exist.

- [ ] **Step 2: Implement the pure snapshot helper.**

`createF2TestSnapshot` must call `createFixtureCampaignState(seed)` twice and `createFixtureExpeditionState()` twice, compare the relevant serializable fixture values, call `validateContentPools` on the real pools, compute event/card/item/boss counts, and build capacity rows `{ grade, required, available, pass }` for `C/B/A/S` with required `6/8/10/12`. Build five explicit malformed pool cases: duplicate event ID, insufficient regular events, no boss cards, missing lure item, and non-positive boss damage. Catch only `RuleError`, preserve its `code` and `details`, and mark a scenario as pass only when the expected `INVALID_GENERATION` occurs.

- [ ] **Step 3: Implement the server page and F1 link.**

Render the snapshot in `app/f2-test/page.tsx` with the current F1 visual language: `Panel`/border sections, readable Korean labels, tables for content, text plus status labels instead of color alone, and a GET seed form. Include links to `/f1-test` and `/play`. Show every event's choices and tags, cards by truth type/subject, item kind/price/tags, boss grade/base damage, capacity pass state, and each negative-case error code/message/details. Keep the page read-only; it must not call a rule that applies an event or item effect.

Add an `/f2-test` link to the existing `/f1-test` header without changing its F1 fixture values or existing test IDs.

- [ ] **Step 4: Run snapshot and type checks.**

Run: `pnpm test app/f2-test/f2-test-snapshot.test.ts lib/content/content.test.ts && pnpm typecheck`

Expected: snapshot assertions pass, the F1 page still typechecks, and no DOM testing dependency is introduced.

- [ ] **Step 5: Commit the F1 integration tool.**

```bash
git add app/f2-test app/f1-test/page.tsx
git commit -m "도구: F1 연동 F2 콘텐츠 검증 페이지를 추가한다" -m "F1 fixture, 콘텐츠 통계, 음성 오류와 seed 재현을 한 화면에서 확인한다."
```

### Task 5: 공식 규칙 문서와 테스트 안내 갱신

**Files:**

- Create: `docs/technical/F2_TESTING.md`
- Modify: `docs/technical/F1_TESTING.md`
- Modify: `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`
- Modify: `docs/systems/INFORMATION_AND_DECEPTION.md`
- Modify: `docs/README.md`

**Interfaces:**

- Documents the exact F2 content inventory, validator errors, `/f2-test?seed=alpha` manual flow, and full command sequence.
- Does not change `docs/GAME_PRINCIPLES.md`, because the role and core principles are unchanged.

- [ ] **Step 1: Update the direct system documents.**

In `DUNGEON_EVENTS_AND_BOSSES.md`, replace the merchant example `가짜 지도` with `유인용 미끼`, add the 12-event/3-per-kind content contract, state that each event has at least two choices, and state that grade-specific boss base damage is content data while calculation belongs to later rules. Preserve the existing public map counts and no-duplicate-in-one-dungeon rule.

In `INFORMATION_AND_DECEPTION.md`, add the F2 inventory contract: 12 cards, four per truth type, at least two `boss` subject cards, and the fact that the card pool does not implement reaction probabilities or modifiers. Keep the party-only recipient rule and C/B/A/S guarantee values unchanged.

- [ ] **Step 2: Add the F2 testing guide and F1 cross-link.**

Create `docs/technical/F2_TESTING.md` with these exact sections: scope, automatic checks, browser startup, `/f2-test?seed=alpha` checklist, `/f1-test?seed=alpha` comparison, negative-case expectations, keyboard/error-overlay checks, and final completion evidence. Update `F1_TESTING.md` with a short link to the F2 page and explain that F1 remains a regression contract consumed by F2.

- [ ] **Step 3: Add the new design record links.**

In `docs/README.md` add:

```md
- [F2 사건·카드·아이템 콘텐츠 설계](superpowers/specs/2026-08-13-sanghwan-yoo-event-card-item-content-design.md)
- [F2 사건·카드·아이템 콘텐츠 구현 계획](superpowers/plans/2026-08-13-sanghwan-yoo-event-card-item-content.md)
```

- [ ] **Step 4: Review documentation consistency.**

Run: `rg -n "가짜 지도|유인용 미끼|INFO_CARDS|12개|보스 주제|F2" docs/GAME_PRINCIPLES.md docs/design docs/systems docs/technical/F1_TESTING.md docs/technical/F2_TESTING.md docs/README.md`

Expected: direct F2 documents use the new item name and quantities consistently; historical source documents are not edited; `GAME_PRINCIPLES.md` has no unnecessary change.

- [ ] **Step 5: Commit documentation.**

```bash
git add docs/technical/F2_TESTING.md docs/technical/F1_TESTING.md docs/systems/DUNGEON_EVENTS_AND_BOSSES.md docs/systems/INFORMATION_AND_DECEPTION.md docs/README.md
git commit -m "문서: F2 콘텐츠와 F1 연동 검증 절차를 기록한다" -m "사건·카드·아이템·보스 계약과 브라우저 확인 순서를 공식 문서에 반영한다."
```

### Task 6: 전체 자동 검증과 실제 브라우저 검증

**Files:**

- Modify: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`
- Test: all files touched by Tasks 1~5

**Interfaces:**

- Produces completion evidence for F2 only after both automated and browser checks pass.
- Updates only the F2 row's 담당 and 상태 fields after evidence exists; do not mark C4/E1/E2/E3 or unrelated actions complete.

- [ ] **Step 1: Run focused unit and domain checks.**

Run: `pnpm test lib/content/content.test.ts lib/domain lib/rules/dungeon.test.ts app/f2-test/f2-test-snapshot.test.ts`

Expected: all F2 content, domain, dungeon regression, and snapshot tests pass with zero failures.

- [ ] **Step 2: Run the repository quality gates.**

Run each command separately:

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
git diff --check
```

Expected: every command exits successfully. If the Next.js build reports a changed generated agent file, inspect the diff and retain only the required repository rule output; do not silence a type or lint error.

- [ ] **Step 3: Start the dev server and verify the F1/F2 routes in a browser.**

Run: `pnpm dev`

Use the browser verification tool against `http://localhost:3000/f1-test?seed=alpha` and `http://localhost:3000/f2-test?seed=alpha`. Verify:

1. Both pages render without an error overlay or console error.
2. `/f1-test` still shows its contract success badge, F1 campaign fixture values, expedition table, RNG streams, and `INVALID_TRANSITION` sample.
3. `/f2-test` shows F1 campaign/expedition sections and an F2 content pass badge.
4. The event table shows 12 events, three per regular kind, at least two choices per event, and effect tags.
5. The card table shows 12 cards, four per truth type, and at least two boss subjects.
6. The item table shows all five kinds, including `유인용 미끼`, and no `가짜 지도`.
7. The boss table shows C/B/A/S and positive base damage.
8. The capacity table shows required `6/8/10/12` and pass for every grade.
9. The negative-case table shows five passing checks, each with `INVALID_GENERATION`.
10. Submitting `alpha` again preserves the F1 seed and displayed fixture values; keyboard focus reaches the seed input, submit button, links, and tables in a usable order.

- [ ] **Step 4: Record browser verification and inspect the final diff.**

Record the verified routes and checks in the final handoff. Run `git status --short --branch` and `git diff --check`. Inspect that no generated artifacts, secrets, dependency changes, or unrelated edits entered the diff.

- [ ] **Step 5: Mark F2 complete only after evidence.**

In `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`, update only the F2 row to the agreed owner `SangHwan Yoo` and status `✅ 완료`. Keep C4's direct prerequisite `F2` unchanged and leave all unverified action rows untouched. Run the assignment integrity test after the table edit:

Run: `pnpm test docs/technical/PROTOTYPE_WORK_ASSIGNMENT.test.ts`

Expected: the table and dependency graph remain consistent, with only F2's status/owner change.

- [ ] **Step 6: Commit the verified completion state.**

```bash
git add docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md
git commit -m "검증: F2 콘텐츠와 F1 연동 화면을 완료한다" -m "전체 자동 테스트와 브라우저 검증을 통과한 F2를 배정표에 반영한다."
```

## Final handoff checklist

- [ ] `BossId`, `ItemDef`, `BossDef`, effect tags, and required `EventChoice.effectTags` are exported and typechecked.
- [ ] Production content has 12 regular events, four kinds × three, with no boss-target choices.
- [ ] Production content has 12 cards, four per truth type, at least two boss subjects, five required item kinds, and four grade bosses.
- [ ] Validator rejects every specified malformed pool with `RuleError("INVALID_GENERATION")` and does not mutate input.
- [ ] Existing dungeon generation tests still pass through the shared event validator.
- [ ] `/f2-test?seed=alpha` uses real F1 fixtures and real content pools, not duplicated hard-coded output.
- [ ] F1 page links to F2 page and its existing contract values remain unchanged.
- [ ] Official system documents and technical testing guides match the implementation.
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `git diff --check` pass.
- [ ] Browser verification confirms both routes, content tables, negative cases, reproducibility, keyboard navigation, and no console/error overlay.
- [ ] Only after all evidence exists, F2 is marked `✅ 완료` in the assignment table.
