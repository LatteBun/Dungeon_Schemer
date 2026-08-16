# 캠페인 누적 통계 구현 계획

> **에이전트 작업자에게:** 필수 하위 스킬 — `superpowers:subagent-driven-development`(권장) 또는 `superpowers:executing-plans`로 Task 단위로 구현한다. 단계는 체크박스(`- [ ]`)로 추적한다.

**목표:** 카드 진위별 전달·반응·적발, 생환·전멸 원정 수, 가장 큰 전환점, 원정 연대기를 `CampaignState`에 누적하고 엔딩·정산 화면이 그대로 표시한다.

**설계:** 통계 갱신을 정산 한 곳에 모은다. 필요한 원재료가 정산 시점에 이미 `expedition` 안에 전부 있으므로 `campaign-machine`을 건드리지 않는다. 순수 함수만 쓰고 난수를 소비하지 않아 게임 결과가 바뀔 수 없다.

**기술 스택:** Next.js 16.3.0 App Router, React 19.2.8, TypeScript 5 strict, Tailwind CSS 4, Zustand 5.0.14, Vitest 4.1.10(`environment: node`), pnpm 11.21.0.

**Spec:** `docs/superpowers/specs/2026-08-16-sanghwan-yoo-campaign-statistics-design.md`

## 전역 제약

- **게임 규칙의 수치·확률·판정을 바꾸지 않는다.** 이번 작업은 이미 일어난 일을 기록할 뿐이다.
- **`pnpm backtest` 후 `git diff docs/technical/BACKTEST_REPORT.md`가 비어야 한다.** `lib/rules/settlement.ts`를 건드리므로 이것이 "동작 무변경"의 증거다.
- **통계 함수는 난수를 받지 않는다.** `Rng`를 인자로 받는 통계 함수를 만들지 않는다.
- **`Math.random`을 쓰지 않는다.** eslint가 막는다.
- **`lib/domain`은 `lib/rules`를 import하지 않는다.** 이 방향이 뒤집히면 안 된다.
- **`lib/rules`는 `lib/flow`를 import하지 않는다.** 지금 한 곳도 없다.
- **`pendingVerification`을 다시 계산하지 않는다.** `lib/rules/info.ts`가 세운 깃발을 그대로 읽는다.
- **선택 인자로 기본값을 주지 않는다.** 값을 안 넘기면 컴파일이 실패해야 한다.
- **import 경계:** `components/**`는 `@/lib/mock` 금지. `components/ui/**`는 추가로 `@/lib/domain` 금지.
- **DOM 테스트를 쓰지 않는다.** Vitest가 `environment: node`이고 `@testing-library`가 없다. 컴포넌트는 typecheck·lint·build와 브라우저로 게이트한다.
- **기호만으로 뜻을 전달하지 않는다.** `✓`·`×` 옆에 `생환`·`전멸` 글자를 함께 적는다.
- 커밋 메시지는 제목·본문 모두 한글이며 본문에 "왜"를 적는다.

## 파일 구조

| 파일 | 책임 | 상태 |
| --- | --- | --- |
| `lib/domain/campaign.ts` | 통계 타입 5종, `SettlementStep` 이동 | 수정 |
| `lib/domain/index.ts` | 새 타입 재export | 수정 |
| `lib/rules/statistics.ts` | 빈 통계·카드 집계·전환점·누적 | 신설 |
| `lib/rules/statistics.test.ts` | 집계 불변식과 전환점 우선순위 | 신설 |
| `lib/rules/settlement.ts` | 원정 기록 생성과 통계 갱신, 타입 재export | 수정 |
| `lib/rules/settlement.test.ts` | 배선 검사 | 수정 |
| `lib/rules/campaign-init.ts` | 빈 통계로 시작 | 수정 |
| `lib/rules/campaign-init.test.ts` | 필드 추종 | 수정 |
| `lib/rules/fixtures.ts` | 빈 통계와 원정 기록 픽스처 | 수정 |
| `components/game/campaign-view-model.ts` | `numericSuffix` export | 수정 |
| `components/game/settlement-view-model.ts` | 카드·전환점·연대기·원인 사슬 변환 | 수정 |
| `components/game/settlement-view-model.test.ts` | 변환 테스트 | 수정 |
| `components/game/EndingPanel.tsx` | 3열, 전환점, 연대기 | 수정 |
| `components/game/ExpeditionChronicle.tsx` | 연대기 목록 | 신설 |
| `components/game/CauseChainBand.tsx` | 원인 사슬 띠 | 신설 |
| `app/play/result/page.tsx` | 띠 배치 | 수정 |
| `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md` | `C6` 완료 | 수정 |
| `app/u3-test/u3-fixtures.ts` | `settleExpedition`을 직접 부르므로 통계가 저절로 찬다 | 변경 없음 |

---

## Task 1: 도메인 타입과 빈 통계

`CampaignState`에 `statistics`를 더하고 `SettlementStep` 타입을 도메인으로 옮긴다. 원정 기록이 원인 사슬을 품으려면 도메인이 그 타입을 알아야 하는데, 지금은 `lib/rules/settlement.ts`에 있어 도메인이 참조할 수 없다.

**Files:**
- Modify: `lib/domain/campaign.ts`
- Modify: `lib/domain/index.ts`
- Modify: `lib/rules/settlement.ts:25-36`(타입 정의 제거, import와 재export)
- Modify: `lib/rules/campaign-init.ts:114-131`
- Modify: `lib/rules/fixtures.ts:113-156`
- Modify: `lib/rules/campaign-init.test.ts:38-42`
- Create: `lib/rules/statistics.ts`
- Test: `lib/rules/statistics.test.ts`

**Interfaces:**
- Consumes: `TRUTH_TYPES`·`TruthType`(`@/lib/domain`), `initializeCampaign`(`@/lib/rules/campaign-init`)
- Produces:
  - `CardTruthStat`·`TurningPoint`·`TurningPointKind`·`ExpeditionRecord`·`CampaignStatistics` 타입
  - `SettlementStep`·`SettlementStepKind`가 `@/lib/domain`에서 나온다
  - `emptyCardStats(): Record<TruthType, CardTruthStat>`
  - `emptyStatistics(): CampaignStatistics`
  - `CampaignState.statistics: CampaignStatistics`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/rules/statistics.test.ts`를 새로 만든다.

```ts
import { describe, expect, it } from "vitest";
import { TRUTH_TYPES } from "@/lib/domain";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { emptyStatistics } from "./statistics";

describe("emptyStatistics", () => {
  it("진위 세 종류를 모두 0으로 채운다", () => {
    const statistics = emptyStatistics();

    for (const truthType of TRUTH_TYPES) {
      expect(statistics.cards[truthType]).toEqual({
        delivered: 0,
        accepted: 0,
        suspected: 0,
        exposed: 0,
        lateExposed: 0,
      });
    }
    expect(statistics.clearedExpeditions).toBe(0);
    expect(statistics.wipedExpeditions).toBe(0);
    expect(statistics.expeditions).toEqual([]);
    expect(statistics.turningPoint).toBeNull();
  });

  // 상수 하나를 공유하면 한 캠페인의 집계가 다음 캠페인에 새어 든다.
  it("호출마다 새 객체를 준다", () => {
    const first = emptyStatistics();
    first.cards.lie.delivered = 5;

    expect(emptyStatistics().cards.lie.delivered).toBe(0);
  });

  it("새 캠페인은 빈 통계로 시작한다", () => {
    expect(initializeCampaign("씨앗").statistics).toEqual(emptyStatistics());
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run lib/rules/statistics.test.ts`
Expected: FAIL — `Failed to resolve import "./statistics"`

- [ ] **Step 3: 도메인 타입을 더한다**

`lib/domain/campaign.ts`의 import 문에 두 줄을 더한다.

```ts
import type { ExpeditionResultStatus, ExpeditionState } from "./expedition";
import type { TruthType } from "./info";
```

`ExpeditionState` import가 이미 있으므로 그 줄을 위처럼 바꾼다. 그리고 `CampaignState` 정의 **앞**에 다음을 붙인다.

```ts
/**
 * 정산이 남기는 원인 사슬 한 단계다.
 *
 * 규칙이 아니라 도메인에 두는 이유는 원정 기록이 이 단계를 그대로 품기
 * 때문이다. 도메인이 `lib/rules`를 가져오면 의존 방향이 뒤집힌다. 단계의
 * 순서는 여전히 규칙의 결정이므로 `SETTLEMENT_STEP_ORDER`는 규칙에 남는다.
 */
export type SettlementStepKind =
  | "survival"
  | "reward"
  | "dungeon"
  | "promotion"
  | "party"
  | "ending";

export interface SettlementStep {
  readonly kind: SettlementStepKind;
  readonly summary: string;
}

/**
 * 진위 한 종류의 전달·반응 누적이다.
 *
 * 두 단위를 일부러 함께 둔다. `delivered`는 플레이어가 내린 결정의 수이고
 * 나머지는 카드 × 파티원 판정의 수다. 한 단위로 통일하면 둘 중 하나를 잃는다.
 * docs/superpowers/specs/2026-08-16-sanghwan-yoo-campaign-statistics-design.md
 */
export interface CardTruthStat {
  /** 용사에게 전달한 카드 장수. */
  delivered: number;
  accepted: number;
  suspected: number;
  exposed: number;
  /** 수용됐다가 보스전 뒤 드러난 거짓. `lie` 외에는 항상 0이다. */
  lateExposed: number;
}

export type TurningPointKind = "firstWipe" | "promotion" | "scoreSwing";

export interface TurningPoint {
  kind: TurningPointKind;
  /** 가리키는 `ExpeditionRecord.order`. */
  expeditionOrder: number;
  /** 왜 이 원정이 전환점인지. 규칙이 쓴 문장을 화면이 그대로 쓴다. */
  summary: string;
}

/** 원정 하나가 캠페인에 남긴 것. 한 캠페인에 15건 남짓이라 통째로 들고 있는다. */
export interface ExpeditionRecord {
  /** 1부터 빈틈없이 증가한다. */
  order: number;
  dungeonId: DungeonId;
  /** 출전 당시 등급. 실패로 등급이 오르기 전 값이다. */
  grade: Grade;
  partyId: PartyId;
  status: ExpeditionResultStatus;
  survivorCount: number;
  casualtyCount: number;
  cards: Record<TruthType, CardTruthStat>;
  /** 보스전에서 파티가 입은 피해 합. 보스전이 없었으면 0이다. */
  bossDamageTotal: number;
  reputationDelta: number;
  goldDelta: number;
  scoreBefore: number;
  scoreAfter: number;
  rankBefore: Grade;
  rankAfter: Grade;
  /** 정산이 만든 원인 사슬 그대로. */
  steps: SettlementStep[];
}

/**
 * 캠페인 누적 통계다.
 *
 * `cards`와 `expeditions`의 중복은 의도한 것이다. 엔딩 화면이 매 렌더마다
 * 15건을 접지 않아도 되고, 두 벌의 일치는 `statistics.test.ts`가 검사한다.
 */
export interface CampaignStatistics {
  cards: Record<TruthType, CardTruthStat>;
  clearedExpeditions: number;
  wipedExpeditions: number;
  expeditions: ExpeditionRecord[];
  /** 정산마다 연대기 전체에서 다시 고른다. */
  turningPoint: TurningPoint | null;
}
```

`CampaignState`에 필드를 더한다. `log` 아래에 놓는다.

```ts
  log: CampaignLogRecord[];
  statistics: CampaignStatistics;
```

- [ ] **Step 4: 도메인 index에 재export를 더한다**

`lib/domain/index.ts`의 `./campaign` 타입 export 목록에 알파벳 순서를 지켜 넣는다.

```ts
export type {
  BoardLockReason,
  BoardOffer,
  CampaignDungeon,
  CampaignEnding,
  CampaignEndingId,
  CampaignLogRecord,
  CampaignMember,
  CampaignParty,
  CampaignPhase,
  CampaignState,
  CampaignStatistics,
  CardTruthStat,
  DungeonStatus,
  ExpeditionRecord,
  Grade,
  MemoryRecord,
  SettlementStep,
  SettlementStepKind,
  TurningPoint,
  TurningPointKind,
} from "./campaign";
```

- [ ] **Step 5: 규칙에서 타입 정의를 지우고 재export한다**

`lib/rules/settlement.ts`의 `SettlementStepKind`·`SettlementStep` 정의(25~36행)를 지운다. `SETTLEMENT_STEP_ORDER`는 그대로 둔다. import 목록에 두 타입을 더하고 파일에 재export 한 줄을 넣는다.

```ts
import type {
  CampaignDungeon,
  CampaignEnding,
  CampaignMember,
  CampaignState,
  ExpeditionResult,
  ExpeditionState,
  Grade,
  MemberId,
  SettlementStep,
  SettlementStepKind,
} from "@/lib/domain";

/** 타입은 도메인으로 옮겼다. 기존 import 경로를 깨지 않기 위해 다시 내보낸다. */
export type { SettlementStep, SettlementStepKind };
```

`campaign-machine`·`campaign-store`·`settlement-view-model`·`labels`·`u3-fixtures`가 이 경로로 가져오므로 재export가 없으면 다섯 곳이 함께 깨진다.

- [ ] **Step 6: 빈 통계 함수를 만든다**

`lib/rules/statistics.ts`를 새로 만든다.

```ts
import { TRUTH_TYPES } from "@/lib/domain";
import type {
  CampaignStatistics,
  CardTruthStat,
  TruthType,
} from "@/lib/domain";

function emptyCardStat(): CardTruthStat {
  return { delivered: 0, accepted: 0, suspected: 0, exposed: 0, lateExposed: 0 };
}

/** 진위 세 종류를 모두 채운 빈 집계다. 빠진 키가 생기지 않게 상수에서 만든다. */
export function emptyCardStats(): Record<TruthType, CardTruthStat> {
  return Object.fromEntries(
    TRUTH_TYPES.map((truthType) => [truthType, emptyCardStat()]),
  ) as Record<TruthType, CardTruthStat>;
}

/**
 * 새 캠페인의 통계다.
 *
 * 상수가 아니라 함수인 이유는 집계가 가변 숫자를 담기 때문이다. 한 벌을
 * 공유하면 한 캠페인의 수치가 다음 캠페인에 새어 든다.
 */
export function emptyStatistics(): CampaignStatistics {
  return {
    cards: emptyCardStats(),
    clearedExpeditions: 0,
    wipedExpeditions: 0,
    expeditions: [],
    turningPoint: null,
  };
}
```

- [ ] **Step 7: 상태를 만드는 세 곳에 필드를 채운다**

세 곳 모두 `log: []` 다음 줄에 넣는다. 필드가 필수이므로 빠뜨리면 컴파일이 막는다.

`lib/rules/campaign-init.ts` — import를 더하고 `initialState` 리터럴에 넣는다.

```ts
import { emptyStatistics } from "@/lib/rules/statistics";
```

```ts
    log: [],
    statistics: emptyStatistics(),
  };
```

`lib/rules/fixtures.ts` — 같은 import와 같은 한 줄을 `createFixtureCampaignState`의 반환 리터럴에 넣는다.

`lib/rules/campaign-init.test.ts` — 기대 상태 리터럴(38~42행 부근)에 같은 한 줄을 넣는다.

- [ ] **Step 8: 테스트를 통과시킨다**

Run: `pnpm vitest run lib/rules/statistics.test.ts`
Expected: PASS 3건

- [ ] **Step 9: 전체 회귀를 확인한다**

Run: `pnpm typecheck && pnpm test`
Expected: 전부 PASS. 타입 이동이 순수하다면 기존 테스트가 하나도 깨지지 않는다.

- [ ] **Step 10: 커밋**

```bash
git add lib/domain/campaign.ts lib/domain/index.ts lib/rules/statistics.ts \
  lib/rules/statistics.test.ts lib/rules/settlement.ts lib/rules/campaign-init.ts \
  lib/rules/campaign-init.test.ts lib/rules/fixtures.ts
git commit -m "$(cat <<'EOF'
규칙: 캠페인 통계 타입과 빈 통계를 만든다

원정 기록이 정산 원인 사슬을 그대로 품어야 해서 SettlementStep 타입을
도메인으로 옮겼다. 도메인이 lib/rules 를 가져오면 의존 방향이 뒤집힌다.
단계의 순서는 여전히 규칙의 결정이므로 SETTLEMENT_STEP_ORDER 는 규칙에 남고,
기존 import 다섯 곳을 위해 settlement.ts 가 타입을 다시 내보낸다.

emptyStatistics 를 상수가 아닌 함수로 둔 것은 집계가 가변 숫자를 담기
때문이다. 한 벌을 공유하면 한 캠페인의 수치가 다음 캠페인에 새어 든다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 원정 하나의 카드 집계

`expedition.infoRecords`를 진위별로 접는다. **사후 발각 조건이 이 작업에서 가장 틀리기 쉬운 곳이다.** 세 조건 중 하나라도 빠지면 `들키지 않고 넘어간 거짓말`이 실제보다 적게 나온다.

**Files:**
- Modify: `lib/rules/statistics.ts`
- Test: `lib/rules/statistics.test.ts`

**Interfaces:**
- Consumes: `emptyCardStats`(Task 1), `ExpeditionState`·`InfoRecord`·`BossResult`(`@/lib/domain`), `createFixtureExpeditionState`(`@/lib/rules/fixtures`)
- Produces:
  - `summarizeExpeditionCards(expedition: ExpeditionState): Record<TruthType, CardTruthStat>`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/rules/statistics.test.ts`에 아래를 더한다. import 문도 함께 넓힌다.

```ts
import type {
  BossResult,
  ExpeditionState,
  InfoRecord,
  CardId,
  MemberId,
} from "@/lib/domain";
import { createFixtureExpeditionState } from "@/lib/rules/fixtures";
import { emptyStatistics, summarizeExpeditionCards } from "./statistics";

function infoRecord(overrides: Partial<InfoRecord> = {}): InfoRecord {
  return {
    cardId: "card-001" as CardId,
    truthType: "truth",
    subject: "boss",
    memberId: "member-001" as MemberId,
    reaction: "accepted",
    modifier: 0,
    pendingVerification: false,
    ...overrides,
  };
}

function expeditionWith(
  infoRecords: InfoRecord[],
  bossResult: BossResult | null,
): ExpeditionState {
  return { ...createFixtureExpeditionState(), infoRecords, bossResult };
}

function bossResult(survivorIds: string[]): BossResult {
  return {
    survivorIds: survivorIds as MemberId[],
    casualtyIds: [],
    damageByMember: {},
  };
}

describe("summarizeExpeditionCards", () => {
  it("한 번의 전달을 세 명이 판정하면 전달 1장에 반응 3건이다", () => {
    const cards = summarizeExpeditionCards(expeditionWith([
      infoRecord({ memberId: "member-001" as MemberId, reaction: "accepted" }),
      infoRecord({ memberId: "member-002" as MemberId, reaction: "suspected" }),
      infoRecord({ memberId: "member-003" as MemberId, reaction: "accepted" }),
    ], null));

    expect(cards.truth.delivered).toBe(1);
    expect(cards.truth.accepted).toBe(2);
    expect(cards.truth.suspected).toBe(1);
  });

  // id 를 집합으로 세면 두 번째 거짓말이 사라진다.
  it("같은 카드를 두 지점에서 전달하면 전달 2장이다", () => {
    const cards = summarizeExpeditionCards(expeditionWith([
      infoRecord({ cardId: "card-001" as CardId }),
      infoRecord({ cardId: "card-001" as CardId, memberId: "member-002" as MemberId }),
      infoRecord({ cardId: "card-002" as CardId }),
      infoRecord({ cardId: "card-001" as CardId }),
    ], null));

    expect(cards.truth.delivered).toBe(3);
  });

  it("반응 건수의 합이 기록 수와 같다", () => {
    const records = [
      infoRecord({ truthType: "lie", reaction: "accepted", pendingVerification: true }),
      infoRecord({ truthType: "lie", reaction: "exposed", memberId: "member-002" as MemberId }),
      infoRecord({ truthType: "neutral", reaction: "suspected" }),
    ];
    const cards = summarizeExpeditionCards(expeditionWith(records, null));
    const total = Object.values(cards).reduce(
      (sum, stat) => sum + stat.accepted + stat.suspected + stat.exposed,
      0,
    );

    expect(total).toBe(records.length);
  });

  it("수용된 거짓은 보스전에서 살아남은 사람만 사후 발각으로 센다", () => {
    const cards = summarizeExpeditionCards(expeditionWith([
      infoRecord({
        truthType: "lie",
        memberId: "member-001" as MemberId,
        pendingVerification: true,
      }),
      infoRecord({
        truthType: "lie",
        memberId: "member-002" as MemberId,
        pendingVerification: true,
      }),
    ], bossResult(["member-001"])));

    expect(cards.lie.lateExposed).toBe(1);
  });

  // 사건 도중 전멸하면 보스전 자체가 없어 아무도 검증되지 않는다.
  it("보스전을 치르지 않은 원정은 사후 발각이 0이다", () => {
    const cards = summarizeExpeditionCards(expeditionWith([
      infoRecord({ truthType: "lie", pendingVerification: true }),
    ], null));

    expect(cards.lie.lateExposed).toBe(0);
  });

  it("진실과 중립은 사후 발각이 없다", () => {
    const cards = summarizeExpeditionCards(expeditionWith([
      infoRecord({ truthType: "truth" }),
      infoRecord({ truthType: "neutral", memberId: "member-002" as MemberId }),
    ], bossResult(["member-001", "member-002"])));

    expect(cards.truth.lateExposed).toBe(0);
    expect(cards.neutral.lateExposed).toBe(0);
  });

  it("사후 발각은 수용된 거짓을 넘을 수 없다", () => {
    const cards = summarizeExpeditionCards(expeditionWith([
      infoRecord({
        truthType: "lie",
        reaction: "accepted",
        memberId: "member-001" as MemberId,
        pendingVerification: true,
      }),
      infoRecord({
        truthType: "lie",
        reaction: "exposed",
        memberId: "member-002" as MemberId,
      }),
    ], bossResult(["member-001", "member-002"])));

    expect(cards.lie.lateExposed).toBeLessThanOrEqual(cards.lie.accepted);
  });

  it("기록이 없으면 빈 집계다", () => {
    expect(summarizeExpeditionCards(expeditionWith([], null)))
      .toEqual(emptyStatistics().cards);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run lib/rules/statistics.test.ts`
Expected: FAIL — `summarizeExpeditionCards is not a function`

- [ ] **Step 3: 구현한다**

`lib/rules/statistics.ts`에 더한다. import에 `ExpeditionState`를 넣는다.

```ts
/**
 * 원정 하나의 정보 기록을 진위별로 접는다.
 *
 * 사후 발각의 세 조건이 여기 한 곳에만 있다. 수용된 거짓이라도 보스전을
 * 치르지 않았거나 그 사람이 보스전에서 죽었으면 검증이 일어나지 않는다.
 * lib/rules/boss.ts 가 생존자만 검증하기 때문이다.
 */
export function summarizeExpeditionCards(
  expedition: ExpeditionState,
): Record<TruthType, CardTruthStat> {
  const cards = emptyCardStats();
  const verified = new Set<string>(
    (expedition.bossResult?.survivorIds ?? []).map(String),
  );

  // applyInfoRecord 가 전달 순서대로 덧붙이므로 한 번의 전달은 같은 cardId 가
  // 연속으로 놓인 구간 하나다. id 를 집합으로 세면 같은 카드의 재전달이 사라진다.
  let previousCardId: string | null = null;

  for (const record of expedition.infoRecords) {
    const stat = cards[record.truthType];
    const cardId = record.cardId as string;

    if (cardId !== previousCardId) {
      stat.delivered += 1;
      previousCardId = cardId;
    }
    stat[record.reaction] += 1;

    if (record.pendingVerification && verified.has(record.memberId as string)) {
      stat.lateExposed += 1;
    }
  }

  return cards;
}
```

- [ ] **Step 4: 테스트를 통과시킨다**

Run: `pnpm vitest run lib/rules/statistics.test.ts`
Expected: PASS 11건

- [ ] **Step 5: 커밋**

```bash
git add lib/rules/statistics.ts lib/rules/statistics.test.ts
git commit -m "$(cat <<'EOF'
규칙: 원정 하나의 카드 전달과 반응을 집계한다

사후 발각의 세 조건을 한 곳에 모았다. 수용된 거짓이라도 보스전을 치르지
않았거나 그 사람이 보스전에서 죽었으면 검증이 일어나지 않는다. boss.ts 가
생존자만 검증하기 때문이며, 조건이 하나라도 빠지면 들키지 않고 넘어간
거짓말이 실제보다 적게 나온다.

전달은 같은 cardId 가 연속으로 놓인 구간의 개수로 센다. id 를 집합으로 세면
같은 카드를 두 지점에서 전달했을 때 두 번째가 사라진다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 전환점 우선순위

단위가 다른 값을 하나의 축에 더하지 않는다. 먼저 성립한 것을 고르고 왜 골랐는지를 규칙이 문장으로 남긴다.

**Files:**
- Modify: `lib/rules/statistics.ts`
- Modify: `lib/rules/fixtures.ts`(원정 기록 픽스처 추가)
- Test: `lib/rules/statistics.test.ts`

**Interfaces:**
- Consumes: `emptyCardStats`(Task 1), `GRADES`·`ExpeditionRecord`·`TurningPoint`(`@/lib/domain`)
- Produces:
  - `createFixtureExpeditionRecord(overrides?: Partial<ExpeditionRecord>): ExpeditionRecord`
  - `findTurningPoint(records: readonly ExpeditionRecord[]): TurningPoint | null`

- [ ] **Step 1: 원정 기록 픽스처를 만든다**

`lib/rules/fixtures.ts`에 더한다. import에 `ExpeditionRecord`와 `emptyCardStats`를 넣는다.

```ts
export function createFixtureExpeditionRecord(
  overrides: Partial<ExpeditionRecord> = {},
): ExpeditionRecord {
  return {
    order: 1,
    dungeonId: asId<DungeonId>("dungeon-001"),
    grade: "C",
    partyId: asId<PartyId>("party-001"),
    status: "cleared",
    survivorCount: 3,
    casualtyCount: 0,
    cards: emptyCardStats(),
    bossDamageTotal: 0,
    reputationDelta: 0,
    goldDelta: 0,
    scoreBefore: 0,
    scoreAfter: 0,
    rankBefore: "C",
    rankAfter: "C",
    steps: [],
    ...overrides,
  };
}
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`lib/rules/statistics.test.ts`에 더한다.

```ts
import { createFixtureExpeditionRecord } from "@/lib/rules/fixtures";
import { findTurningPoint } from "./statistics";

describe("findTurningPoint", () => {
  it("기록이 없으면 전환점이 없다", () => {
    expect(findTurningPoint([])).toBeNull();
  });

  // wipeGoldFirst 의 77.4%가 첫 전멸 뒤 지원 불가로 끝났다.
  it("전멸이 승급보다 앞선다", () => {
    const point = findTurningPoint([
      createFixtureExpeditionRecord({
        order: 1,
        rankBefore: "C",
        rankAfter: "B",
        scoreBefore: 0,
        scoreAfter: 500,
      }),
      createFixtureExpeditionRecord({
        order: 2,
        status: "failed",
        survivorCount: 0,
        casualtyCount: 3,
      }),
    ]);

    expect(point?.kind).toBe("firstWipe");
    expect(point?.expeditionOrder).toBe(2);
  });

  it("전멸이 여럿이면 첫 전멸을 고른다", () => {
    const point = findTurningPoint([
      createFixtureExpeditionRecord({ order: 1, status: "failed" }),
      createFixtureExpeditionRecord({ order: 2, status: "failed" }),
    ]);

    expect(point?.expeditionOrder).toBe(1);
  });

  it("전멸이 없으면 가장 높은 등급에 도달한 원정을 고른다", () => {
    const point = findTurningPoint([
      createFixtureExpeditionRecord({ order: 1, rankBefore: "C", rankAfter: "B" }),
      createFixtureExpeditionRecord({ order: 2, rankBefore: "B", rankAfter: "S" }),
      createFixtureExpeditionRecord({ order: 3 }),
    ]);

    expect(point?.kind).toBe("promotion");
    expect(point?.expeditionOrder).toBe(2);
    expect(point?.summary).toContain("B에서 S로");
  });

  it("전멸도 승급도 없으면 점수 변화폭이 가장 큰 원정을 고른다", () => {
    const point = findTurningPoint([
      createFixtureExpeditionRecord({ order: 1, scoreBefore: 100, scoreAfter: 120 }),
      createFixtureExpeditionRecord({ order: 2, scoreBefore: 120, scoreAfter: 40 }),
    ]);

    expect(point?.kind).toBe("scoreSwing");
    expect(point?.expeditionOrder).toBe(2);
    expect(point?.summary).toContain("80");
  });

  it("점수 변화폭이 같으면 이른 원정을 고른다", () => {
    const point = findTurningPoint([
      createFixtureExpeditionRecord({ order: 1, scoreBefore: 0, scoreAfter: 30 }),
      createFixtureExpeditionRecord({ order: 2, scoreBefore: 30, scoreAfter: 60 }),
    ]);

    expect(point?.expeditionOrder).toBe(1);
  });

  it("승급이 여럿이고 등급이 같으면 이른 원정을 고른다", () => {
    const point = findTurningPoint([
      createFixtureExpeditionRecord({ order: 1, rankBefore: "C", rankAfter: "B" }),
      createFixtureExpeditionRecord({ order: 2, rankBefore: "C", rankAfter: "B" }),
    ]);

    expect(point?.expeditionOrder).toBe(1);
  });
});
```

- [ ] **Step 3: 실패를 확인한다**

Run: `pnpm vitest run lib/rules/statistics.test.ts -t 전환점`
Expected: FAIL — `findTurningPoint is not a function`

- [ ] **Step 4: 구현한다**

`lib/rules/statistics.ts`에 더한다. import에 `GRADES`(값)와 `ExpeditionRecord`·`TurningPoint`(타입)를 넣는다.

```ts
function scoreSwingOf(record: ExpeditionRecord): number {
  return Math.abs(record.scoreAfter - record.scoreBefore);
}

/**
 * 캠페인의 궤적을 꺾은 원정 하나를 고른다.
 *
 * 단위가 다른 값을 억지로 한 축에 더하지 않고 우선순위로 고른다. 첫 전멸이
 * 승급보다 앞서는 근거는 첫 백테스트다. wipeGoldFirst 전략의 77.4%가 첫
 * 전멸 뒤 지원 불가로 끝나 평균 6.4회 원정으로 캠페인이 멈췄다.
 *
 * 점수 변화폭을 마지막에 두는 것은 승급 점수가 `명성 × 2 + 누적 골드`라
 * 등급이 높은 던전일수록 보상도 손실도 커지기 때문이다. 이것만으로 고르면
 * S급 원정이 거의 항상 뽑혀 전환점이 등급의 다른 이름이 된다.
 *
 * 세 갈래 모두 비교가 `>`이므로 동률이면 먼저 온 기록이 남는다.
 * docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md 「확인된 밸런스 문제」
 */
export function findTurningPoint(
  records: readonly ExpeditionRecord[],
): TurningPoint | null {
  const wiped = records.find((record) => record.status === "failed");
  if (wiped !== undefined) {
    return {
      kind: "firstWipe",
      expeditionOrder: wiped.order,
      summary: `${wiped.order}번째 원정에서 출전한 파티가 전멸했다`,
    };
  }

  const promoted = records
    .filter((record) => record.rankBefore !== record.rankAfter)
    .reduce<ExpeditionRecord | null>(
      (best, record) =>
        best === null
          || GRADES.indexOf(record.rankAfter) > GRADES.indexOf(best.rankAfter)
          ? record
          : best,
      null,
    );
  if (promoted !== null) {
    return {
      kind: "promotion",
      expeditionOrder: promoted.order,
      summary: `${promoted.order}번째 원정에서 등급이 `
        + `${promoted.rankBefore}에서 ${promoted.rankAfter}로 올랐다`,
    };
  }

  const swung = records.reduce<ExpeditionRecord | null>(
    (best, record) =>
      best === null || scoreSwingOf(record) > scoreSwingOf(best) ? record : best,
    null,
  );
  if (swung === null) return null;

  return {
    kind: "scoreSwing",
    expeditionOrder: swung.order,
    summary: `${swung.order}번째 원정에서 승급 점수가 ${scoreSwingOf(swung)} 움직였다`,
  };
}
```

문장에 던전·파티 이름을 넣지 않는다. 규칙은 **이유**를 소유하고 이름표는 화면의 몫이다. 기록에 `dungeonId`·`grade`·`partyId`가 있으므로 화면이 붙일 수 있다.

- [ ] **Step 5: 테스트를 통과시킨다**

Run: `pnpm vitest run lib/rules/statistics.test.ts`
Expected: PASS 18건

- [ ] **Step 6: 커밋**

```bash
git add lib/rules/statistics.ts lib/rules/statistics.test.ts lib/rules/fixtures.ts
git commit -m "$(cat <<'EOF'
규칙: 가장 큰 전환점을 우선순위로 고른다

단위가 다른 값을 한 축에 더하지 않고 첫 전멸 > 승급 > 점수 변화폭 순으로
먼저 성립한 것을 고른다. 첫 전멸이 앞서는 근거는 첫 백테스트다.
wipeGoldFirst 의 77.4%가 첫 전멸 뒤 지원 불가로 끝났다.

점수 변화폭을 마지막에 둔 것은 승급 점수가 명성×2 + 누적 골드라 등급이
높은 던전일수록 보상도 손실도 커지기 때문이다. 이것만으로 고르면 S급
원정이 거의 항상 뽑혀 전환점이 등급의 다른 이름이 된다.

문장에 던전·파티 이름을 넣지 않았다. 규칙은 이유를 소유하고 이름표는
화면의 몫이다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 누적

**Files:**
- Modify: `lib/rules/statistics.ts`
- Test: `lib/rules/statistics.test.ts`

**Interfaces:**
- Consumes: `emptyStatistics`·`emptyCardStats`(Task 1), `findTurningPoint`(Task 3)
- Produces:
  - `recordExpedition(statistics: CampaignStatistics, record: ExpeditionRecord): CampaignStatistics`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
import { emptyStatistics, recordExpedition } from "./statistics";

describe("recordExpedition", () => {
  function statWith(lieDelivered: number, lieExposed: number) {
    const cards = emptyStatistics().cards;
    cards.lie.delivered = lieDelivered;
    cards.lie.exposed = lieExposed;
    return cards;
  }

  it("누적 카드 통계가 각 원정의 합과 같다", () => {
    const first = recordExpedition(
      emptyStatistics(),
      createFixtureExpeditionRecord({ order: 1, cards: statWith(2, 1) }),
    );
    const second = recordExpedition(
      first,
      createFixtureExpeditionRecord({ order: 2, cards: statWith(3, 2) }),
    );

    expect(second.cards.lie.delivered).toBe(5);
    expect(second.cards.lie.exposed).toBe(3);
  });

  it("생환과 전멸의 합이 원정 수와 같다", () => {
    const statistics = [
      createFixtureExpeditionRecord({ order: 1 }),
      createFixtureExpeditionRecord({ order: 2, status: "failed" }),
      createFixtureExpeditionRecord({ order: 3 }),
    ].reduce(recordExpedition, emptyStatistics());

    expect(statistics.clearedExpeditions).toBe(2);
    expect(statistics.wipedExpeditions).toBe(1);
    expect(statistics.clearedExpeditions + statistics.wipedExpeditions)
      .toBe(statistics.expeditions.length);
  });

  it("입력 통계를 고치지 않는다", () => {
    const before = emptyStatistics();
    recordExpedition(before, createFixtureExpeditionRecord({ cards: statWith(9, 9) }));

    expect(before.cards.lie.delivered).toBe(0);
    expect(before.expeditions).toEqual([]);
  });

  // 3번째에 전멸하면 1·2번째에서 고른 승급 전환점을 물러야 한다.
  it("나중 원정이 전환점을 뒤집는다", () => {
    const promoted = recordExpedition(
      emptyStatistics(),
      createFixtureExpeditionRecord({ order: 1, rankBefore: "C", rankAfter: "B" }),
    );
    expect(promoted.turningPoint?.kind).toBe("promotion");

    const wiped = recordExpedition(
      promoted,
      createFixtureExpeditionRecord({ order: 2, status: "failed" }),
    );
    expect(wiped.turningPoint?.kind).toBe("firstWipe");
  });
});
```

`reduce(recordExpedition, ...)`가 그대로 도는 것은 인자 순서가 `(누적값, 원소)`이기 때문이다.

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run lib/rules/statistics.test.ts -t recordExpedition`
Expected: FAIL — `recordExpedition is not a function`

- [ ] **Step 3: 구현한다**

```ts
function addCardStats(
  base: Record<TruthType, CardTruthStat>,
  added: Record<TruthType, CardTruthStat>,
): Record<TruthType, CardTruthStat> {
  return Object.fromEntries(
    TRUTH_TYPES.map((truthType) => [truthType, {
      delivered: base[truthType].delivered + added[truthType].delivered,
      accepted: base[truthType].accepted + added[truthType].accepted,
      suspected: base[truthType].suspected + added[truthType].suspected,
      exposed: base[truthType].exposed + added[truthType].exposed,
      lateExposed: base[truthType].lateExposed + added[truthType].lateExposed,
    }]),
  ) as Record<TruthType, CardTruthStat>;
}

/**
 * 원정 하나를 통계에 접어 넣는다.
 *
 * 전환점을 증분으로 유지하지 않고 매번 연대기 전체에서 다시 고른다.
 * 우선순위가 뒤늦게 뒤집히기 때문이다. 3번째 원정에서 전멸하면 1·2번째에서
 * 고른 승급 전환점을 물러야 한다. 연대기가 15건 남짓이라 비용이 없다.
 */
export function recordExpedition(
  statistics: CampaignStatistics,
  record: ExpeditionRecord,
): CampaignStatistics {
  const expeditions = [...statistics.expeditions, record];

  return {
    cards: addCardStats(statistics.cards, record.cards),
    clearedExpeditions:
      statistics.clearedExpeditions + (record.status === "cleared" ? 1 : 0),
    wipedExpeditions:
      statistics.wipedExpeditions + (record.status === "failed" ? 1 : 0),
    expeditions,
    turningPoint: findTurningPoint(expeditions),
  };
}
```

- [ ] **Step 4: 테스트를 통과시킨다**

Run: `pnpm vitest run lib/rules/statistics.test.ts`
Expected: PASS 22건

- [ ] **Step 5: 커밋**

```bash
git add lib/rules/statistics.ts lib/rules/statistics.test.ts
git commit -m "$(cat <<'EOF'
규칙: 원정 기록을 캠페인 통계에 누적한다

전환점을 증분으로 유지하지 않고 매번 연대기 전체에서 다시 고른다.
우선순위가 뒤늦게 뒤집히기 때문이다. 3번째 원정에서 전멸하면 1·2번째에서
고른 승급 전환점을 물러야 한다. 연대기가 15건 남짓이라 비용이 없다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 정산 배선

`settleExpedition`이 원정 기록 하나를 만들어 붙인다. **before 값을 어디서 읽는지가 이 작업의 전부다.**

**Files:**
- Modify: `lib/rules/settlement.ts:190-260`
- Test: `lib/rules/settlement.test.ts`

**Interfaces:**
- Consumes: `summarizeExpeditionCards`(Task 2), `recordExpedition`(Task 4), `calculatePromotionScore`(`@/lib/rules/promotion`, 이미 import되어 있다)
- Produces: `settleExpedition`의 반환 상태가 갱신된 `statistics`를 담는다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/rules/settlement.test.ts`에 새 `describe`를 더한다. 기존 `settle`·`stateBeforeSettlement` 헬퍼를 그대로 쓰고 import 두 줄을 더한다.

```ts
import { createFixtureExpeditionRecord } from "@/lib/rules/fixtures";
import { recordExpedition } from "@/lib/rules/statistics";
```

```ts
describe("원정 기록", () => {
  it("정산 한 번이 기록 하나를 남긴다", () => {
    const settled = settle({ survivors: [1, 2, 3], casualties: [] });
    const statistics = settled.state.statistics;

    expect(statistics.expeditions).toHaveLength(1);
    expect(statistics.expeditions[0].order).toBe(1);
    expect(statistics.clearedExpeditions).toBe(1);
    expect(statistics.wipedExpeditions).toBe(0);
  });

  // settledDungeon 을 읽으면 실패로 오른 등급이 기록에 새어 든다.
  it("실패해도 기록의 등급은 출전 당시 등급이다", () => {
    const settled = settle({ grade: "C", survivors: [], casualties: [1, 2, 3] });
    const record = settled.state.statistics.expeditions[0];

    expect(record.grade).toBe("C");
    expect(settled.state.dungeons[0].grade).toBe("B");
    expect(record.status).toBe("failed");
  });

  it("승급하면 기록의 등급 전후가 갈린다", () => {
    const settled = settle({
      grade: "S",
      survivors: [1, 2, 3],
      casualties: [],
      currentReputation: 200,
      cumulativeGold: 300,
    });
    const record = settled.state.statistics.expeditions[0];

    expect(record.rankBefore).toBe("C");
    expect(record.rankAfter).toBe(settled.state.rank);
    expect(record.scoreAfter).toBeGreaterThan(record.scoreBefore);
  });

  it("기록이 정산 원인 사슬을 그대로 품는다", () => {
    const settled = settle({ survivors: [1, 2], casualties: [3] });

    expect(settled.state.statistics.expeditions[0].steps).toEqual(settled.steps);
  });

  // 앞선 원정을 다시 돌리지 않고 통계만 미리 채운다. 두 번째 정산이
  // 파티 재편을 다시 거치면 이 테스트가 순번이 아닌 것을 재게 된다.
  it("이미 기록이 있으면 다음 순번을 붙인다", () => {
    const { state, expedition } = stateBeforeSettlement({
      survivors: [1, 2, 3],
      casualties: [],
    });
    const settled = settleExpedition({
      state: {
        ...state,
        statistics: recordExpedition(
          state.statistics,
          createFixtureExpeditionRecord({ order: 1 }),
        ),
      },
      expedition,
      rng: createRng("순번"),
    });

    expect(settled.state.statistics.expeditions.map((record) => record.order))
      .toEqual([1, 2]);
  });

  it("같은 입력은 같은 통계를 낸다", () => {
    const first = settle({ survivors: [1, 2], casualties: [3], seed: "재현" });
    const second = settle({ survivors: [1, 2], casualties: [3], seed: "재현" });

    expect(first.state.statistics).toEqual(second.state.statistics);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run lib/rules/settlement.test.ts -t "원정 기록"`
Expected: FAIL — `expect(received).toHaveLength(1)` / received length 0

- [ ] **Step 3: 구현한다**

`lib/rules/settlement.ts`에 import를 더한다.

```ts
import { recordExpedition, summarizeExpeditionCards } from "@/lib/rules/statistics";
import type { ExpeditionRecord } from "@/lib/domain";
```

`settleExpedition`의 `steps` 배열 정의 **뒤**, `return` **앞**에 기록을 만든다.

```ts
  const record: ExpeditionRecord = {
    order: input.state.statistics.expeditions.length + 1,
    dungeonId: dungeon.id,
    // settledDungeon 이 아니라 dungeon 이다. 실패로 등급이 오르기 전 값이어야
    // 연대기가 "어느 등급에 나갔다가 무슨 일을 겪었는지"를 옳게 말한다.
    grade: dungeon.grade,
    partyId: input.expedition.partyId,
    status: result.status,
    survivorCount: result.survivorIds.length,
    casualtyCount: result.casualtyIds.length,
    cards: summarizeExpeditionCards(input.expedition),
    bossDamageTotal: Object.values(
      input.expedition.bossResult?.damageByMember ?? {},
    ).reduce((sum, damage) => sum + damage, 0),
    reputationDelta: payout.reputation,
    goldDelta: payout.gold + payout.loot,
    scoreBefore: calculatePromotionScore(
      input.state.currentReputation,
      input.state.cumulativeGold,
    ),
    scoreAfter: score,
    // promote 이전 값이다.
    rankBefore: input.state.rank,
    rankAfter: rank,
    steps,
  };

  return {
    state: {
      ...withBoard,
      ending,
      phase: ending === null ? "board" : "ended",
      statistics: recordExpedition(input.state.statistics, record),
    },
    steps,
  };
```

- [ ] **Step 4: 테스트를 통과시킨다**

Run: `pnpm vitest run lib/rules/settlement.test.ts`
Expected: PASS. 기존 정산 테스트도 그대로 통과한다.

- [ ] **Step 5: 전체 검증과 백테스트 게이트**

```bash
pnpm lint && pnpm typecheck && pnpm test
pnpm backtest
git diff --stat docs/technical/BACKTEST_REPORT.md
```

Expected: 앞 세 명령 전부 통과. **마지막 명령의 출력이 비어 있어야 한다.**

출력이 있으면 규칙을 건드린 것이다. 멈추고 원인을 찾는다. 통계는 난수를 쓰지 않으므로 보고서가 달라질 이유가 없다.

`pnpm backtest`의 실행 시간을 기록한다. 기준은 92.9초이며 눈에 띄게 늘면 PR 본문에 적는다.

- [ ] **Step 6: 커밋**

```bash
git add lib/rules/settlement.ts lib/rules/settlement.test.ts
git commit -m "$(cat <<'EOF'
규칙: 정산이 원정 기록을 통계에 남긴다

갱신을 정산 한 곳에 모았다. 통계에 필요한 원재료가 정산 시점에 이미
expedition 안에 전부 있어 campaign-machine 을 건드릴 필요가 없고, 갱신
지점이 하나여서 누락된 경로도 생기지 않는다. 사건 도중 전멸해 보스전을
건너뛴 원정도 정산은 반드시 거친다.

기록의 등급은 settledDungeon 이 아니라 dungeon 에서 읽는다. 실패로 등급이
오른 뒤 값을 쓰면 연대기가 어느 등급에 나갔는지를 틀리게 말한다.

난수를 쓰지 않으므로 백테스트 보고서가 그대로다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 엔딩 화면 view-model

규칙이 만든 값에 이름표만 붙인다. 문장을 다시 쓰지 않는다.

**Files:**
- Modify: `components/game/campaign-view-model.ts:116-120`(`numericSuffix` export)
- Modify: `components/game/settlement-view-model.ts`
- Test: `components/game/settlement-view-model.test.ts`

**Interfaces:**
- Consumes: `CampaignStatistics`·`ExpeditionRecord`·`TurningPoint`(`@/lib/domain`), `TRUTH_TYPE_LABELS`(`./labels`), `toSettlementTimelineView`(같은 파일)
- Produces:
  - `numericSuffix(id: string): number` (`campaign-view-model.ts`에서 export)
  - `CardStatView`·`TurningPointView`·`ChronicleEntryView` 타입
  - `EndingView`에 `cards`·`turningPoint`·`chronicle` 추가
  - `EndingSummaryView`에 `clearedExpeditions`·`wipedExpeditions` 추가

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`components/game/settlement-view-model.test.ts`에 더한다.

```ts
import { emptyStatistics, recordExpedition } from "@/lib/rules/statistics";
import { createFixtureCampaignState, createFixtureExpeditionRecord } from "@/lib/rules/fixtures";
import type { CampaignEnding, CampaignState, DungeonId } from "@/lib/domain";

const ENDING: CampaignEnding = {
  id: "expeditionComplete",
  reason: "던전 15개를 모두 정리하고 원정을 끝냈다.",
  at: 0,
};

function stateWithStatistics(): CampaignState {
  const cards = emptyStatistics().cards;
  cards.lie.delivered = 2;
  cards.lie.accepted = 4;
  cards.lie.exposed = 1;
  cards.lie.lateExposed = 3;

  const statistics = [
    createFixtureExpeditionRecord({
      order: 1,
      grade: "B",
      dungeonId: "dungeon-003" as DungeonId,
      cards,
      reputationDelta: -6,
      goldDelta: 31,
      scoreBefore: 274,
      scoreAfter: 262,
      status: "failed",
      survivorCount: 0,
      casualtyCount: 3,
    }),
  ].reduce(recordExpedition, emptyStatistics());

  return { ...createFixtureCampaignState(), statistics };
}

describe("toEndingView 누적 통계", () => {
  it("진위 세 종류를 순서대로 이름표와 함께 낸다", () => {
    const view = toEndingView(stateWithStatistics(), ENDING);

    expect(view?.cards.map((card) => card.label)).toEqual(["진실", "거짓", "중립"]);
    expect(view?.cards[1].delivered).toBe(2);
    expect(view?.cards[1].lateExposed).toBe(3);
  });

  it("생환과 전멸 원정 수를 요약에 넣는다", () => {
    const view = toEndingView(stateWithStatistics(), ENDING);

    expect(view?.summary.clearedExpeditions).toBe(0);
    expect(view?.summary.wipedExpeditions).toBe(1);
  });

  it("전환점에 규칙 문장과 화면 이름표를 함께 담는다", () => {
    const view = toEndingView(stateWithStatistics(), ENDING);

    expect(view?.turningPoint?.summary).toContain("전멸했다");
    expect(view?.turningPoint?.dungeonLabel).toBe("B급 3번");
    expect(view?.turningPoint?.detail).toContain("274 → 262");
  });

  it("연대기가 기호와 글자를 함께 낸다", () => {
    const view = toEndingView(stateWithStatistics(), ENDING);
    const entry = view?.chronicle[0];

    expect(entry?.orderLabel).toBe("01");
    expect(entry?.statusMark).toBe("×");
    expect(entry?.statusLabel).toBe("전멸");
    expect(entry?.rewardLabel).toBe("명성 -6 · 골드 +31");
  });

  it("통계가 비면 전환점이 없고 연대기가 빈 목록이다", () => {
    const view = toEndingView(createFixtureCampaignState(), ENDING);

    expect(view?.turningPoint).toBeNull();
    expect(view?.chronicle).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run components/game/settlement-view-model.test.ts`
Expected: FAIL — `view?.cards` is undefined

- [ ] **Step 3: `numericSuffix`를 공유한다**

`components/game/campaign-view-model.ts`의 함수 앞에 `export`를 붙인다.

```ts
/** "dungeon-001" 또는 "party-007" 같은 id 끝의 숫자를 읽는다. */
export function numericSuffix(id: string): number {
```

- [ ] **Step 4: 구현한다**

`components/game/settlement-view-model.ts`에 더한다.

```ts
import { numericSuffix } from "./campaign-view-model";
import { TRUTH_TYPE_LABELS } from "./labels";
import { TRUTH_TYPES } from "@/lib/domain";
import type {
  CampaignStatistics,
  ExpeditionRecord,
  TurningPoint,
  TruthType,
} from "@/lib/domain";

export interface CardStatView {
  truthType: TruthType;
  label: string;
  delivered: number;
  accepted: number;
  suspected: number;
  exposed: number;
  lateExposed: number;
}

export interface TurningPointView {
  order: number;
  /** 규칙이 쓴 이유 문장 그대로. */
  summary: string;
  dungeonLabel: string;
  partyLabel: string;
  detail: string;
}

export interface ChronicleEntryView {
  order: number;
  orderLabel: string;
  dungeonLabel: string;
  partyLabel: string;
  /** 색과 기호에 기대지 않도록 글자를 함께 낸다. */
  statusMark: string;
  statusLabel: string;
  rewardLabel: string;
  scoreLabel: string;
}

function dungeonLabelOf(record: ExpeditionRecord): string {
  return `${record.grade}급 ${numericSuffix(record.dungeonId)}번`;
}

function partyLabelOf(record: ExpeditionRecord): string {
  return `${numericSuffix(record.partyId)}팀`;
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

function rewardLabelOf(record: ExpeditionRecord): string {
  return `명성 ${signed(record.reputationDelta)} · 골드 ${signed(record.goldDelta)}`;
}

export function toCardStatViews(
  statistics: CampaignStatistics,
): CardStatView[] {
  return TRUTH_TYPES.map((truthType) => ({
    truthType,
    label: TRUTH_TYPE_LABELS[truthType],
    ...statistics.cards[truthType],
  }));
}

export function toTurningPointView(
  statistics: CampaignStatistics,
): TurningPointView | null {
  const point: TurningPoint | null = statistics.turningPoint;
  if (point === null) return null;

  const record = statistics.expeditions.find(
    (entry) => entry.order === point.expeditionOrder,
  );
  if (record === undefined) return null;

  return {
    order: point.expeditionOrder,
    summary: point.summary,
    dungeonLabel: dungeonLabelOf(record),
    partyLabel: partyLabelOf(record),
    detail: `${rewardLabelOf(record)} · `
      + `승급 점수 ${record.scoreBefore} → ${record.scoreAfter}`,
  };
}

export function toChronicleView(
  statistics: CampaignStatistics,
): ChronicleEntryView[] {
  return statistics.expeditions.map((record) => ({
    order: record.order,
    orderLabel: String(record.order).padStart(2, "0"),
    dungeonLabel: dungeonLabelOf(record),
    partyLabel: partyLabelOf(record),
    statusMark: record.status === "cleared" ? "✓" : "×",
    statusLabel: record.status === "cleared"
      ? `생환 ${record.survivorCount}명`
      : "전멸",
    rewardLabel: rewardLabelOf(record),
    scoreLabel: `${record.scoreBefore} → ${record.scoreAfter}`,
  }));
}
```

`EndingSummaryView`에 두 필드를 더한다.

```ts
export interface EndingSummaryView {
  clearedDungeons: number;
  totalDungeons: number;
  clearedExpeditions: number;
  wipedExpeditions: number;
  deadMembers: number;
  // …기존 필드 그대로
}
```

`EndingView`에 세 필드를 더한다.

```ts
export interface EndingView {
  endingId: CampaignEndingId;
  endingLabel: string;
  reason: string;
  finalRank: Grade;
  promotionScore: number;
  nextGrade: { grade: Grade; threshold: number } | null;
  summary: EndingSummaryView;
  cards: CardStatView[];
  turningPoint: TurningPointView | null;
  chronicle: ChronicleEntryView[];
  retrospective: string;
}
```

`toEndingView`의 반환 리터럴에 값을 채운다.

```ts
    summary: {
      clearedDungeons: state.dungeons.filter(
        (dungeon) => dungeon.status === "cleared",
      ).length,
      totalDungeons: state.dungeons.length,
      clearedExpeditions: state.statistics.clearedExpeditions,
      wipedExpeditions: state.statistics.wipedExpeditions,
      // …기존 필드 그대로
    },
    cards: toCardStatViews(state.statistics),
    turningPoint: toTurningPointView(state.statistics),
    chronicle: toChronicleView(state.statistics),
    retrospective: RETROSPECTIVE,
```

- [ ] **Step 5: 테스트를 통과시킨다**

Run: `pnpm vitest run components/game/settlement-view-model.test.ts`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add components/game/settlement-view-model.ts \
  components/game/settlement-view-model.test.ts \
  components/game/campaign-view-model.ts
git commit -m "$(cat <<'EOF'
화면: 엔딩 화면 모델에 누적 통계를 싣는다

규칙이 쓴 전환점 문장을 그대로 옮기고 던전·파티 이름표만 화면이 붙인다.
규칙이 이유를 소유하고 화면이 이름을 소유하는 기존 경계와 같다.

연대기의 생환·전멸에 기호와 글자를 함께 낸다. 기호만으로는 스크린리더가
읽지 못하고 Q1 접근성 기준에 걸린다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 엔딩 화면

`U4`가 데이터 없음으로 비워 둔 세 번째 열을 채우고 전환점·연대기를 더한다.

**Files:**
- Modify: `components/game/EndingPanel.tsx`
- Create: `components/game/ExpeditionChronicle.tsx`

**Interfaces:**
- Consumes: `EndingView`(Task 6), `Panel`(`@/components/ui/Panel`)
- Produces: `ExpeditionChronicle` 컴포넌트

- [ ] **Step 1: 연대기 컴포넌트를 만든다**

`components/game/ExpeditionChronicle.tsx`를 새로 만든다.

```tsx
import { Panel } from "@/components/ui/Panel";
import type { ChronicleEntryView } from "./settlement-view-model";

interface ExpeditionChronicleProps {
  entries: ChronicleEntryView[];
}

export function ExpeditionChronicle({ entries }: ExpeditionChronicleProps) {
  return (
    <Panel title="원정 연대기" aside={<span className="text-xs text-muted">{entries.length}건</span>}>
      {entries.length === 0 ? (
        <p className="text-xs text-muted">아직 다녀온 원정이 없다.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-xs">
          {entries.map((entry) => (
            <li
              key={entry.order}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-edge pb-1 last:border-b-0"
            >
              <span className="text-muted tabular-nums">{entry.orderLabel}</span>
              <span className="text-parchment">{entry.dungeonLabel}</span>
              <span className="text-muted">{entry.partyLabel}</span>
              <span
                className={
                  entry.statusMark === "✓" ? "text-trust-up" : "text-trust-down"
                }
              >
                {entry.statusMark} {entry.statusLabel}
              </span>
              <span className="text-muted">{entry.rewardLabel}</span>
              <span className="text-muted tabular-nums">{entry.scoreLabel}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
```

- [ ] **Step 2: 엔딩 패널을 3열로 넓힌다**

`components/game/EndingPanel.tsx`를 아래 내용으로 바꾼다.

```tsx
import { Panel } from "@/components/ui/Panel";
import { ExpeditionChronicle } from "./ExpeditionChronicle";
import type { EndingView } from "./settlement-view-model";

interface EndingPanelProps {
  view: EndingView;
  onRestart: () => void;
}

export function EndingPanel({ view, onRestart }: EndingPanelProps) {
  const summary = view.summary;

  return (
    <div className="flex flex-col gap-3">
      <header className="text-center">
        <p className="text-xs text-muted">시드 {summary.seed}</p>
        <h2 className="mt-1 text-4xl font-semibold text-parchment">
          {view.endingLabel}
        </h2>
        <p className="mt-2 text-sm text-muted">{view.reason}</p>
      </header>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,12rem)_1fr_1fr]">
        <Panel title="최종 영구 길잡이 등급">
          <p className="text-center text-6xl font-semibold text-trust-up">
            {view.finalRank}
          </p>
          <p className="mt-2 text-center text-xs text-muted">
            승급 점수 {view.promotionScore}
            {view.nextGrade === null
              ? " · 최고 등급"
              : ` · 다음 ${view.nextGrade.grade} ${view.nextGrade.threshold}`}
          </p>
        </Panel>

        <Panel title="캠페인 요약">
          <ul className="grid gap-1 text-xs text-muted sm:grid-cols-2">
            <li>클리어 던전 {summary.clearedDungeons} / {summary.totalDungeons}</li>
            <li>
              생환 {summary.clearedExpeditions}팀 · 전멸 {summary.wipedExpeditions}팀
            </li>
            <li>완성 파티 {summary.completeParties}팀</li>
            <li>생존 용사 {summary.aliveMembers}명 · 생존률 {summary.survivalRate}%</li>
            <li>사망 용사 {summary.deadMembers}명</li>
            <li>최종 명성 {summary.finalReputation}</li>
            <li>골드 {summary.currentGold} / 누적 {summary.cumulativeGold}</li>
          </ul>
        </Panel>

        <Panel title="정보 전달 기록">
          <ul className="flex flex-col gap-1 text-xs text-muted">
            {view.cards.map((card) => (
              <li key={card.truthType}>
                <span className="text-parchment">
                  {card.label} {card.delivered}장
                </span>
                {" · "}
                수용 {card.accepted} / 의심 {card.suspected} / 즉시 적발 {card.exposed}
                {card.lateExposed === 0 ? null : (
                  <span className="text-trust-down">
                    {" · "}사후 발각 {card.lateExposed}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {view.turningPoint === null ? null : (
        <Panel title="가장 큰 전환점">
          <p className="text-sm text-parchment">
            {view.turningPoint.dungeonLabel} · {view.turningPoint.partyLabel}
            {" — "}
            {view.turningPoint.summary}
          </p>
          <p className="mt-1 text-xs text-muted">{view.turningPoint.detail}</p>
        </Panel>
      )}

      <ExpeditionChronicle entries={view.chronicle} />

      <Panel title="캠페인 회고">
        <p className="text-center text-sm text-parchment">{view.retrospective}</p>
      </Panel>

      <button
        type="button"
        onClick={onRestart}
        className="rounded border border-edge px-3 py-2 text-sm text-parchment hover:bg-edge"
      >
        새 캠페인 시작 →
      </button>
    </div>
  );
}
```

- [ ] **Step 3: 검증한다**

Run: `pnpm lint && pnpm typecheck && pnpm build`
Expected: 전부 통과

- [ ] **Step 4: 브라우저로 확인한다**

```bash
pnpm dev
```

`/u3-test`를 열고 `엔딩` 탭을 고른다. 세 열이 나란히 나오고 연대기에 원정 1건이 보이는지 확인한다. 1024·768 폭에서 세로로 쌓이고 가로 스크롤이 생기지 않는지 본다.

- [ ] **Step 5: 커밋**

```bash
git add components/game/EndingPanel.tsx components/game/ExpeditionChronicle.tsx
git commit -m "$(cat <<'EOF'
화면: 엔딩에 정보 전달 기록과 전환점과 연대기를 보여준다

U3·I1·U4가 데이터 없음으로 비워 둔 세 번째 열을 채웠다. 와이어프레임 05가
요구하는 3열 요약이 이제 실제 데이터로 선다.

생환·전멸을 기호와 글자로 함께 적었다. 기호만으로는 스크린리더가 읽지
못한다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 정산 화면 원인 사슬 띠

와이어프레임 04의 `선택 → 개인 반응 → 피해 → 보상·손실 → 캠페인 변화`를 방금 붙은 기록 하나에서 파생한다.

**Files:**
- Modify: `components/game/settlement-view-model.ts`
- Modify: `components/game/settlement-view-model.test.ts`
- Create: `components/game/CauseChainBand.tsx`
- Modify: `app/play/result/page.tsx:87-117`

**Interfaces:**
- Consumes: `ExpeditionRecord`(`@/lib/domain`), `TRUTH_TYPE_LABELS`(`./labels`)
- Produces:
  - `CauseChainLinkView { label: string; value: string }`
  - `toCauseChainView(record: ExpeditionRecord): CauseChainLinkView[]`
  - `CauseChainBand` 컴포넌트

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
describe("toCauseChainView", () => {
  it("다섯 고리를 순서대로 낸다", () => {
    const cards = emptyStatistics().cards;
    cards.lie.delivered = 2;
    cards.lie.accepted = 5;
    cards.truth.delivered = 1;
    cards.truth.suspected = 3;
    cards.truth.exposed = 1;

    const links = toCauseChainView(createFixtureExpeditionRecord({
      cards,
      bossDamageTotal: 47,
      survivorCount: 2,
      reputationDelta: 8,
      goldDelta: 72,
      scoreBefore: 274,
      scoreAfter: 358,
      rankBefore: "A",
      rankAfter: "A",
    }));

    expect(links.map((link) => link.label)).toEqual([
      "전달", "반응", "결과", "보상", "캠페인",
    ]);
    expect(links[0].value).toBe("진실 1 · 거짓 2");
    expect(links[1].value).toBe("수용 5 · 의심 3 · 적발 1");
    expect(links[2].value).toBe("보스 피해 47 · 2명 생환");
    expect(links[3].value).toBe("명성 +8 · 골드 +72");
    expect(links[4].value).toBe("승급 점수 274 → 358 · 등급 A 유지");
  });

  it("전달한 카드가 없으면 없음이라고 적는다", () => {
    const links = toCauseChainView(createFixtureExpeditionRecord({}));

    expect(links[0].value).toBe("없음");
  });

  it("전멸과 승급을 문장으로 구분한다", () => {
    const links = toCauseChainView(createFixtureExpeditionRecord({
      status: "failed",
      survivorCount: 0,
      bossDamageTotal: 62,
      rankBefore: "A",
      rankAfter: "S",
    }));

    expect(links[2].value).toBe("보스 피해 62 · 전멸");
    expect(links[4].value).toContain("등급 A → S");
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run components/game/settlement-view-model.test.ts -t toCauseChainView`
Expected: FAIL — `toCauseChainView is not a function`

- [ ] **Step 3: 구현한다**

`components/game/settlement-view-model.ts`에 더한다.

```ts
export interface CauseChainLinkView {
  label: string;
  value: string;
}

/**
 * 원정 하나의 인과를 다섯 고리로 편다.
 *
 * 스토어의 휘발성 값이 아니라 상태의 원정 기록에서 파생하므로 새로고침해도
 * 남는다. 와이어프레임 04의 `선택 → 개인 반응 → 피해 → 보상·손실 →
 * 캠페인 변화`와 같은 순서다.
 */
export function toCauseChainView(record: ExpeditionRecord): CauseChainLinkView[] {
  const delivered = TRUTH_TYPES
    .filter((truthType) => record.cards[truthType].delivered > 0)
    .map((truthType) =>
      `${TRUTH_TYPE_LABELS[truthType]} ${record.cards[truthType].delivered}`);

  const totals = TRUTH_TYPES.reduce(
    (sum, truthType) => ({
      accepted: sum.accepted + record.cards[truthType].accepted,
      suspected: sum.suspected + record.cards[truthType].suspected,
      exposed: sum.exposed + record.cards[truthType].exposed,
    }),
    { accepted: 0, suspected: 0, exposed: 0 },
  );

  return [
    { label: "전달", value: delivered.length === 0 ? "없음" : delivered.join(" · ") },
    {
      label: "반응",
      value: `수용 ${totals.accepted} · 의심 ${totals.suspected} · 적발 ${totals.exposed}`,
    },
    {
      label: "결과",
      value: `보스 피해 ${record.bossDamageTotal} · `
        + (record.status === "cleared" ? `${record.survivorCount}명 생환` : "전멸"),
    },
    { label: "보상", value: rewardLabelOf(record) },
    {
      label: "캠페인",
      value: `승급 점수 ${record.scoreBefore} → ${record.scoreAfter} · `
        + (record.rankBefore === record.rankAfter
          ? `등급 ${record.rankAfter} 유지`
          : `등급 ${record.rankBefore} → ${record.rankAfter}`),
    },
  ];
}
```

- [ ] **Step 4: 테스트를 통과시킨다**

Run: `pnpm vitest run components/game/settlement-view-model.test.ts`
Expected: PASS

- [ ] **Step 5: 띠 컴포넌트를 만든다**

`components/game/CauseChainBand.tsx`를 새로 만든다.

```tsx
import { Panel } from "@/components/ui/Panel";
import type { CauseChainLinkView } from "./settlement-view-model";

interface CauseChainBandProps {
  links: CauseChainLinkView[];
}

/** 고리 사이의 `→`는 장식이 아니라 인과의 방향이다. */
export function CauseChainBand({ links }: CauseChainBandProps) {
  return (
    <Panel title="원인 사슬">
      <ol className="flex flex-wrap items-stretch gap-2 text-xs">
        {links.map((link, index) => (
          <li key={link.label} className="flex items-center gap-2">
            <div className="rounded border border-edge px-2 py-1">
              <p className="text-muted">{link.label}</p>
              <p className="text-parchment">{link.value}</p>
            </div>
            {index === links.length - 1 ? null : (
              <span aria-hidden="true" className="text-muted">→</span>
            )}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
```

- [ ] **Step 6: 정산 화면에 배치한다**

`app/play/result/page.tsx`의 `settlementSummary` 분기에서 `SettlementTimeline` 아래에 띠를 넣는다. 정산이 적용된 뒤이므로 기록이 반드시 있다.

```tsx
import { CauseChainBand } from "@/components/game/CauseChainBand";
import { toCauseChainView } from "@/components/game/settlement-view-model";
```

```tsx
        <SettlementTimeline
          steps={toSettlementTimelineView(lastSettlementSteps)}
        />
        {(() => {
          const record = campaign.statistics.expeditions.at(-1);
          return record === undefined ? null : (
            <CauseChainBand links={toCauseChainView(record)} />
          );
        })()}
```

- [ ] **Step 7: 검증한다**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: 전부 통과

- [ ] **Step 8: 커밋**

```bash
git add components/game/settlement-view-model.ts \
  components/game/settlement-view-model.test.ts \
  components/game/CauseChainBand.tsx app/play/result/page.tsx
git commit -m "$(cat <<'EOF'
화면: 정산에 원인 사슬 띠를 보여준다

와이어프레임 04가 요구하는 선택 → 개인 반응 → 피해 → 보상·손실 → 캠페인
변화를 다섯 고리로 편다. 스토어의 휘발성 값이 아니라 상태의 원정 기록에서
파생하므로 새로고침해도 남는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 판별력 확인, 문서, 전체 검증

**Files:**
- Modify: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md:137,273`

- [ ] **Step 1: 테스트의 판별력을 확인한다**

`lib/rules/statistics.ts`의 `findTurningPoint`에서 전멸 갈래와 승급 갈래의 순서를 서로 바꾼다. 전멸 블록을 승급 블록 **뒤로** 옮긴다.

Run: `pnpm vitest run lib/rules/statistics.test.ts`
Expected: FAIL — `전멸이 승급보다 앞선다`가 깨진다

깨지는 것을 확인했으면 되돌린다.

```bash
git checkout lib/rules/statistics.ts
git diff --stat
```

Expected: 출력이 비어 있다. 확인한 내용을 PR 본문에 적는다.

- [ ] **Step 2: 사후 발각 조건의 판별력도 확인한다**

`summarizeExpeditionCards`에서 `&& verified.has(record.memberId as string)`를 지운다.

Run: `pnpm vitest run lib/rules/statistics.test.ts`
Expected: FAIL — `수용된 거짓은 보스전에서 살아남은 사람만 사후 발각으로 센다`와 `보스전을 치르지 않은 원정은 사후 발각이 0이다`가 깨진다

되돌리고 `git diff --stat`으로 복원을 확인한다.

- [ ] **Step 3: 배정표를 갱신한다**

`docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`의 두 곳을 고친다.

대응표 137행:

```markdown
| C6 | 별도 plan Task 1~9 | 카드 진위별 전달·반응, 생환·전멸 원정, 전환점과 원정 연대기를 정산이 누적한다. [별도 spec](../superpowers/specs/2026-08-16-sanghwan-yoo-campaign-statistics-design.md) |
```

배정표 273행의 담당과 상태를 채운다.

```markdown
| C6 | 캠페인 누적 통계 | 카드 진위별 제시·적발 횟수, 생존·전멸 파티 수, 가장 큰 전환점이 `CampaignState`에 쌓이고 엔딩 화면이 그대로 표시 | — | — | SangHwan Yoo | ✅ |
```

`U4`가 남긴 후속 표에서 `C6`으로 넘긴 항목 중 **소지 아이템은 이번 범위가 아니다.** 142행 부근의 완료 서술에 한 문장을 더한다.

```markdown
C6은 카드 진위별 전달·반응, 생환·전멸 원정, 전환점, 원정 연대기와 정산 원인 사슬을 완료했다. `U4`가 함께 넘긴 파티원 소지 아이템은 사건 해결 규칙을 바꿔야 하고 백테스트 수치가 움직이므로 `B1`과 함께 볼 후속으로 남긴다.
```

- [ ] **Step 4: 배정표 무결성 검사를 돌린다**

Run: `pnpm vitest run docs/technical/PROTOTYPE_WORK_ASSIGNMENT.test.ts`
Expected: PASS

- [ ] **Step 5: 전체 검증**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm backtest
git diff --stat docs/technical/BACKTEST_REPORT.md
```

Expected: 앞의 다섯 명령 전부 통과, 마지막 명령의 출력이 비어 있다.

- [ ] **Step 6: 브라우저로 캠페인 하나를 끝까지 본다**

```bash
pnpm dev
```

`/play`에서 캠페인을 진행하며 다음을 확인한다.

1. **거짓 카드를 일부러 고른다.** 즉시 적발과 사후 발각이 모두 나오게 여러 지점에서 고른다.
2. 정산 화면에서 원인 사슬 띠의 다섯 고리가 위쪽 보스 결과·정산 타임라인과 어긋나지 않는지 본다.
3. **정산 화면에서 새로고침한다.** 띠가 남아 있어야 한다.
4. 엔딩까지 가서 정보 전달 기록의 장수·반응 수가 실제로 고른 카드와 맞는지, 연대기의 원정 수가 다녀온 횟수와 맞는지, 전환점이 실제 전멸·승급을 가리키는지 대조한다.
5. 1024·768 폭에서 세로로 쌓이고 가로 스크롤이 생기지 않는지 본다.

- [ ] **Step 7: 커밋과 PR**

```bash
git add docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md
git commit -m "$(cat <<'EOF'
문서: 배정표에서 C6 완료를 반영한다

U4가 함께 넘긴 파티원 소지 아이템은 범위에서 뺀 이유를 적었다. 사건 해결
규칙을 바꿔야 해서 백테스트 수치가 움직이고 B1 밸런스 조정과 뒤엉킨다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
git push -u origin feature/c6-campaign-statistics
gh pr create --title "C6 캠페인 누적 통계" --body "..."
```

PR 본문에는 다음을 적는다.

- 무엇을 왜 만들었는지
- `pnpm backtest` 보고서가 무변경임과 실행 시간
- Step 1~2의 판별력 확인 결과와 복원 확인
- 브라우저 검증 항목 5가지의 결과
- 소지 아이템을 범위에서 뺀 이유
