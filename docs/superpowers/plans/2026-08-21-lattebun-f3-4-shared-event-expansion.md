# F3-4 공용 사건 90종 확장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공용 `rest`·`merchant`·`special` 사건을 각각 30개, 총 90개로 확장하고 기존 조언 계약을 유지한다.

**Architecture:** `SituationEvent`·`AdviceOption`·`validateSituationEvents`는 변경하지 않는다. 현재 한 파일인 공용 데이터를 최소 builder와 분류별 세 모듈로 분리하고, entry point는 세 배열만 합쳐 기존 `SHARED_EVENTS` export를 보존한다. 전역 advice ID와 문구 중복, tag 비어 있음은 validator가 아니라 F3-4 콘텐츠 테스트가 검증한다.

**Tech Stack:** TypeScript 5 strict, Vitest 4, pnpm 11, Next.js 16.3

**Spec:** `docs/superpowers/specs/2026-08-21-lattebun-f3-4-shared-event-expansion-design.md` 및 `docs/superpowers/specs/2026-08-21-lattebun-f3-4-shared-event-expansion-design-review.md`

## Global Constraints

- review 문서가 원본 Spec보다 우선한다. M02는 기존 `shared-merchant-barter`의 `이름표`이고, `두 개의 가격표`는 만들지 않는다.
- 기존 14개 사건의 ID를 보존하며 `shared-special-contract`는 제거하고 S30 `무거운 전리품`을 새 ID로 만든다.
- 공용 advice는 항상 `relation: "unrelated"`, `source: undefined`, `bossDamageModifier: undefined`이다.
- 매 사건은 help·harm·neutral 각 1개, 각 advice는 비어 있지 않은 `line`·`resultText`·하나 이상의 기존 `EventEffectTag`를, 사건은 비어 있지 않은 `defaultResultText`를 가진다.
- `line`은 고블린의 조언이며 description의 관찰 사실을 짚고 정답·유형을 노출하지 않는다. 기본 결과는 조언 미수용 시 파티가 스스로 처리한 약한 결과다.
- 새 runtime field, enum, effect tag, UI, Store, service, validator 의미는 추가하지 않는다. 커밋 제목과 본문은 한글로 쓴다.

---

## File Structure

| 파일 | 책임 |
| --- | --- |
| `lib/content/shared-event-builders.ts` | 공용 advice/event 객체 생성과 공용 불변값 |
| `lib/content/shared-rest-events.ts` | rest 30개 데이터 |
| `lib/content/shared-merchant-events.ts` | merchant 30개 데이터 |
| `lib/content/shared-special-events.ts` | special 30개 데이터 |
| `lib/content/shared-events.ts` | 세 배열을 합쳐 기존 `SHARED_EVENTS` export 유지 |
| `lib/content/shared-events.test.ts` | 90개 수량·공용 계약·전역 중복·tag·validator 수직 검증 |
| `vitest.config.mts` | 연결 worktree를 테스트 discovery에서 제외 |
| `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md` | F3-4 완료 조건과 상태 |

### Task 1: 90개 공용 풀의 실패 회귀 테스트와 test discovery 경계

**Files:**
- Modify: `lib/content/shared-events.test.ts`
- Modify: `vitest.config.mts`

**Interfaces:**
- Consumes: `SHARED_EVENTS: readonly SituationEvent[]`, `EVENT_EFFECT_TAGS`, `validateSituationEvents`
- Produces: 30/30/30·90·전역 uniqueness·공용 advice 계약을 고정하는 콘텐츠 테스트

- [ ] **Step 1: 실패하는 F3-4 콘텐츠 테스트를 작성한다.**

기존 5/5/5·15 기대값을 30/30/30·90으로 바꾸고 아래 검사를 추가한다. 문구 비교는 exact string, ID 비교는 flatten한 문자열 배열로 한다.

```ts
const titles = SHARED_EVENTS.map((event) => event.title);
const descriptions = SHARED_EVENTS.map((event) => event.description);
const advice = SHARED_EVENTS.flatMap((event) => event.advice);
expect(new Set(SHARED_EVENTS.map((event) => event.id)).size).toBe(90);
expect(new Set(advice.map((option) => option.id)).size).toBe(270);
expect(new Set(titles).size).toBe(titles.length);
expect(new Set(descriptions).size).toBe(descriptions.length);
expect(new Set(advice.map((option) => option.label)).size).toBe(advice.length);
for (const option of advice) {
  expect(option.line.trim()).not.toBe("");
  expect(option.effectTags.length).toBeGreaterThan(0);
  expect(option.effectTags.every((tag) => EVENT_EFFECT_TAGS.includes(tag))).toBe(true);
  expect(option.relation).toBe("unrelated");
  expect(option.source).toBeUndefined();
  expect(option.bossDamageModifier).toBeUndefined();
}
for (const event of SHARED_EVENTS) expect(event.defaultResultText.trim()).not.toBe("");
```

- [ ] **Step 2: 15개 현재 데이터에서 실패를 확인한다.**

Run: `pnpm exec vitest run --config vitest.config.mts lib/content/shared-events.test.ts --exclude '.worktrees/**'`

Expected: FAIL — 분류별 기대값 30과 전체 90이 현재 5와 15라서 실패한다.

- [ ] **Step 3: test discovery에서 연결 worktree를 제외한다.**

`vitest.config.mts`의 `test`에 아래 exclude를 추가한다. 이는 `.worktrees`의 별도 node_modules가 현재 checkout의 React renderer와 섞여 전체 테스트를 실패시키는 것을 막는다.

```ts
exclude: [".worktrees/**", "node_modules/**", ".next/**"],
```

- [ ] **Step 4: config 변경의 원인 재현이 사라졌는지 확인한다.**

Run: `pnpm test -- lib/content/shared-events.test.ts`

Expected: F3-4 수량 assertion만 실패하며, `.worktrees/.../app/u1-test/page.test.ts`의 React invalid-hook 오류는 실행되지 않는다.

- [ ] **Step 5: 테스트 경계 변경을 커밋한다.**

```bash
git add vitest.config.mts lib/content/shared-events.test.ts
git commit -m "테스트: 공용 사건 90개 계약을 고정한다" -m "연결 worktree를 discovery에서 제외하고 F3-4의 수량·중복·공용 조언 불변식을 검증한다."
```

### Task 2: 공용 builder와 rest 30개 데이터

**Files:**
- Create: `lib/content/shared-event-builders.ts`
- Create: `lib/content/shared-rest-events.ts`
- Modify: `lib/content/shared-events.ts`

**Interfaces:**
- Produces: `advice(...) => AdviceOption`, `sharedEvent(...) => SituationEvent`, `export const SHARED_REST_EVENTS: readonly SituationEvent[]`

- [ ] **Step 1: 공용 helper를 현재 파일에서 추출한다.**

`shared-event-builders.ts`에 현재 `shared-events.ts`의 helper를 옮긴다. signature는 아래처럼 유지한다. 반환 객체는 `relation: "unrelated"`만 고정하고 `source`와 `bossDamageModifier`를 넣지 않는다.

```ts
export function advice(id: string, outcome: AdviceOutcome, label: string, line: string, resultText: string, effectTags: readonly EventEffectTag[]): AdviceOption;
export function sharedEvent(id: string, kind: EventKind, title: string, description: string, advices: readonly AdviceOption[], defaultResultText: string): SituationEvent;
```

- [ ] **Step 2: rest 30개를 작성한다.**

`SHARED_REST_EVENTS`에 Spec 5.1~5.6의 R01~R30을 순서대로 넣는다. 기존 ID는 R01 `shared-rest-wound`, R06 `shared-rest-ration`, R07 `shared-rest-water`, R16 `shared-rest-fire`, R21 `shared-rest-watch`를 보존한다. 나머지는 다음 ID를 사용한다: `ankle-laces`, `bloody-glove`, `dizzy-cleric`, `unbroken-arm`, `wet-hardbread`, `salty-jerky`, `half-apple`, `dripping-ceiling`, `sloped-floor`, `two-rooms`, `warm-stone-floor`, `room-with-door`, `wet-cloak`, `closed-brazier`, `frozen-metal-door`, `many-small-fires`, `noisy-can`, `two-entrances`, `vanishing-torch`, `strongest-warrior`, `loose-shield-strap`, `cracked-canteen-stop`, `sand-in-scabbard`, `wet-bowstring`, `creaking-armor`.

각 사건의 title·description·H/X/N label·resultText는 Spec 원문을 그대로 옮긴다. 각 line은 해당 description의 단서만 다시 말하는 자연스러운 고블린 대사, 기본 결과는 조언이 실행되지 않은 약한 결과로 작성한다. help에는 보통 `support` 또는 `rest`, harm에는 `sabotage`, neutral에는 `rest` 또는 `observe`를 사용한다.

- [ ] **Step 3: entry point가 rest 배열만 참조하도록 임시 연결한다.**

`shared-events.ts`에서 기존 데이터와 helper를 제거하고 `SHARED_REST_EVENTS`를 import한다. merchant/special arrays가 준비되기 전에는 이 파일을 최종 수량 테스트에 통과시키려 하지 않는다.

- [ ] **Step 4: rest 데이터의 타입·개별 계약을 확인한다.**

Run: `pnpm typecheck && pnpm exec vitest run --config vitest.config.mts lib/content/situation-validation.test.ts --exclude '.worktrees/**'`

Expected: PASS — helper signature와 validator 계약 회귀가 없다. F3-4 수량 테스트는 다음 두 분류가 아직 없어 실패 상태다.

- [ ] **Step 5: rest 데이터 변경을 커밋한다.**

```bash
git add lib/content/shared-event-builders.ts lib/content/shared-rest-events.ts lib/content/shared-events.ts
git commit -m "콘텐츠: 공용 휴식 사건 30개로 확장" -m "기존 공용 helper를 분리하고 관찰 단서 기반 휴식 사건 30개를 등록한다."
```

### Task 3: merchant 30개와 review 정본 편입

**Files:**
- Create: `lib/content/shared-merchant-events.ts`
- Modify: `lib/content/shared-events.ts`

**Interfaces:**
- Produces: `export const SHARED_MERCHANT_EVENTS: readonly SituationEvent[]`

- [ ] **Step 1: merchant 데이터를 작성한다.**

Spec 5.7~5.12의 M01~M30을 순서대로 넣는다. 보존 ID는 M01 `shared-merchant-scale`, M02 `shared-merchant-barter`, M06 `shared-merchant-potion`, M11 `shared-merchant-credit`, M16 `shared-merchant-scout`다. 신규 slug는 M03~M05 `counting-hands`, `bundle-discount`, `last-one`; M07~M10 `cracked-bottle-cap`, `new-blade-scratch`, `same-scent-potions`, `too-clean-map`; M12~M15 `blank-receipt`, `collateral-necklace`, `two-dates`, `free-repair`; M17~M20 `old-rumor`, `two-different-paths`, `too-specific-time`, `free-first-sentence`; M21~M25 `closing-box`, `changing-name`, `moving-spot`, `avoids-customers`, `friendly-prepayment`; M26~M30 `leaking-oil-bottle`, `cracked-arrowheads`, `hot-amulet`, `rattling-smoke-bomb`, `strong-torch-powder`다.

M02는 반드시 `이름표` 원문을 사용하며 `두 개의 가격표`는 만들지 않는다. tag는 거래 자체가 핵심인 help/neutral에 `trade`, 물건의 안전성이 핵심이면 `item`, 정보 판단이면 `information`, harm에는 `sabotage`를 사용한다.

- [ ] **Step 2: entry point에 merchant 배열을 합친다.**

```ts
export const SHARED_EVENTS: readonly SituationEvent[] = [
  ...SHARED_REST_EVENTS,
  ...SHARED_MERCHANT_EVENTS,
];
```

- [ ] **Step 3: data contract 회귀를 실행한다.**

Run: `pnpm exec vitest run --config vitest.config.mts lib/content/shared-events.test.ts lib/content/situation-validation.test.ts --exclude '.worktrees/**'`

Expected: rest 30과 merchant 30은 충족하지만 special 30과 전체 90 assertion은 실패한다.

- [ ] **Step 4: merchant 변경을 커밋한다.**

```bash
git add lib/content/shared-merchant-events.ts lib/content/shared-events.ts
git commit -m "콘텐츠: 공용 상인 사건 30개로 확장" -m "이름표 기존 사건을 M02로 보존하고 장면 단서 기반 상인 사건을 추가한다."
```

### Task 4: special 30개, 90개 entry point, 콘텐츠 테스트 통과

**Files:**
- Create: `lib/content/shared-special-events.ts`
- Modify: `lib/content/shared-events.ts`
- Modify: `lib/content/shared-events.test.ts`

**Interfaces:**
- Produces: `export const SHARED_SPECIAL_EVENTS: readonly SituationEvent[]`, 90개 `SHARED_EVENTS`

- [ ] **Step 1: special 데이터를 작성한다.**

Spec 5.13~5.18의 S01~S30을 순서대로 사용한다. 보존 ID는 S01 `shared-special-tripwire`, S06 `shared-special-camp`, S11 `shared-special-chasm`, S26 `shared-special-scrawl`이다. `shared-special-contract`는 포함하지 않는다. S30의 새 ID는 `shared-special-heavy-loot`, runtime title은 정확히 `무거운 전리품`이다. 나머지 신규 사건 ID는 title을 kebab-case 영어 slug로 만들되 모두 `shared-special-`로 시작하고, advice ID는 해당 event ID의 `-a/-b/-c`다.

help에는 `support` 또는 `information`, harm에는 `sabotage`, neutral에는 `observe`를 기본으로 사용한다. S26~S30은 파티에게 조언하는 고블린 관점을 유지하고, 길잡이가 직접 글씨를 지우거나 물건을 드는 문장으로 쓰지 않는다.

- [ ] **Step 2: 세 배열을 최종 entry point에서 합친다.**

```ts
export const SHARED_EVENTS: readonly SituationEvent[] = [
  ...SHARED_REST_EVENTS,
  ...SHARED_MERCHANT_EVENTS,
  ...SHARED_SPECIAL_EVENTS,
];
```

- [ ] **Step 3: exact duplicate와 90개 수직 슬라이스를 통과시킨다.**

Run: `pnpm exec vitest run --config vitest.config.mts lib/content/shared-events.test.ts lib/content/situation-validation.test.ts --exclude '.worktrees/**'`

Expected: PASS — 30/30/30·90, 공용 relation/source/modifier, nonempty line/default/tag, 전역 event/advice ID, title/description/label uniqueness, 기존 validator가 모두 통과한다.

- [ ] **Step 4: special·entry point 변경을 커밋한다.**

```bash
git add lib/content/shared-special-events.ts lib/content/shared-events.ts lib/content/shared-events.test.ts
git commit -m "콘텐츠: 공용 특수 사건 30개로 확장" -m "기존 계약서 사본을 무거운 전리품으로 교체하고 공용 사건 풀을 90개로 완성한다."
```

### Task 5: 공식 작업 배정표와 전체 검증

**Files:**
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

- [ ] **Step 1: F3-4 행을 완료 상태로 갱신한다.**

F3-4 완료 기준은 `rest`·`merchant`·`special` 각 30개, 검증기 통과, 사건 ID·문구 중복 없음으로 유지하고 담당자를 `LatteBun`, 상태를 `✅`로 바꾼다. F3-5의 30개 테마 확장과 E2/E3의 책임은 바꾸지 않는다.

- [ ] **Step 2: 문서·전체 검증을 실행한다.**

Run: `git diff --check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`

Expected: 모두 exit 0. 실패 시 F3-4 변경 파일인지 먼저 분리한다. `.worktrees` 관련 테스트가 다시 수집되면 Task 1의 `exclude` 설정이 누락된 것이므로 다른 수정 전에 그 설정을 복구한다.

- [ ] **Step 3: 완료 기록을 커밋한다.**

```bash
git add docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md
git commit -m "문서: F3-4 공용 사건 확장 완료 기록" -m "공용 사건 90개 콘텐츠와 검증 완료 기준을 작업 배정표에 반영한다."
```

## Self-Review

- **Spec coverage:** Task 1은 테스트·worktree isolation, Task 2~4는 30개씩의 파일 분리와 90개 데이터, Task 4는 S30 교체와 global validation, Task 5는 배정표 및 모든 필수 검증을 맡는다.
- **No architecture drift:** domain·validator·UI·Store·service와 event kind/effect tag 집합은 변경하지 않는다.
- **Type consistency:** 모든 배열은 `readonly SituationEvent[]`; builder는 기존 import type과 branded ID 캐스팅을 사용하며 entry point의 공개 이름은 `SHARED_EVENTS`로 유지한다.
