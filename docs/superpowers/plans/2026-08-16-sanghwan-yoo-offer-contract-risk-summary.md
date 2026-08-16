# 공고·계약 위험 요약 구현 계획

> **에이전트 작업자에게:** 필수 하위 스킬 — `superpowers:subagent-driven-development`(권장) 또는 `superpowers:executing-plans`로 Task 단위로 구현한다. 단계는 체크박스(`- [ ]`)로 추적한다.

**목표:** 게시판의 공고마다 사건 분류별 위험 요약을, 계약 확인에 분류별 개수를 보여주고, 그 미리보기가 계약 후 실제 탐험 지도와 일치함을 보장한다.

**설계:** 위험 요약을 도메인에 넣지 않고 화면 파생값으로 둔다. 탐험이 쓰는 지도 시드 키를 `lib/rules`로 옮겨 게시판과 탐험이 한 벌을 공유하게 하고, 새 규칙 모듈이 그 키로 지도를 미리 만들어 분류를 센다.

**기술 스택:** Next.js 16.3.0 App Router, React 19.2.8, TypeScript 5 strict, Tailwind CSS 4, Zustand 5.0.14, Vitest 4.1.10(`environment: node`), pnpm 11.21.0.

**Spec:** `docs/superpowers/specs/2026-08-16-sanghwan-yoo-offer-contract-risk-summary-design.md`

## 전역 제약

- **게임 규칙의 수치·확률·판정을 바꾸지 않는다.** 이번 작업은 이미 정해진 결과를 앞당겨 보여줄 뿐이다.
- **`pnpm backtest` 후 `git diff docs/technical/BACKTEST_REPORT.md`가 비어야 한다.** `lib/flow`를 건드리므로 이것이 "동작 무변경"의 증거다.
- **`BoardOffer`·`CampaignState`에 새 필드를 만들지 않는다.**
- **`lib/rules`는 `lib/flow`를 import하지 않는다.** 지금 한 곳도 없다. 이 방향을 깨지 않는다.
- **선택 인자로 기본값을 주지 않는다.** `U4`가 고친 결함이 정확히 그것이었다 — `toPartyStatusView(members)`가 두 번째 인자 없이 불려 신뢰 증감이 늘 0이었다. 값을 안 넘기면 컴파일이 실패해야 한다.
- **`Math.random`을 쓰지 않는다.** eslint가 막는다.
- **규칙 함수를 JSX 안에서 호출하지 않는다.** 렌더마다 지도를 다시 만든다. `useMemo`로 감싼다.
- **import 경계:** `components/**`는 `@/lib/mock` 금지. `components/ui/**`는 추가로 `@/lib/domain` 금지.
- **DOM 테스트를 쓰지 않는다.** Vitest가 `environment: node`이고 `@testing-library`가 없다. 컴포넌트는 typecheck·lint·build와 브라우저로 게이트한다.
- 커밋 메시지는 제목·본문 모두 한글이며 본문에 "왜"를 적는다.

## 파일 구조

| 파일 | 책임 | 상태 |
| --- | --- | --- |
| `lib/rules/expedition-key.ts` | 원정 난수 키 한 벌 | 신설 |
| `lib/rules/expedition-key.test.ts` | 키 형식과 분기 조건 | 신설 |
| `lib/flow/campaign-machine.ts` | 지역 함수를 import로 교체 | 수정 |
| `lib/rules/offer-risk.ts` | 계약 전 지도 미리보기와 분류 집계 | 신설 |
| `lib/rules/offer-risk.test.ts` | 개수 불변식과 재현성 | 신설 |
| `lib/flow/campaign-machine.test.ts` | 미리보기 = 탐험 지도 불변식 | 수정 |
| `components/game/campaign-view-model.ts` | `OfferRiskView` 변환 | 수정 |
| `components/game/campaign-view-model.test.ts` | 변환 테스트 | 수정 |
| `components/game/Board.tsx` | 위험 한 줄 | 수정 |
| `components/game/ContractPanel.tsx` | 분류별 개수 표 | 수정 |
| `app/play/page.tsx` | `useMemo` 계산과 전달 | 수정 |
| `app/u1-test/page.tsx` | 바뀐 시그니처 추종 | 수정 |
| `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md` | `C5` 완료 | 수정 |

---

## Task 1: 지도 시드 키를 규칙으로 옮긴다

**Files:**
- Create: `lib/rules/expedition-key.ts`
- Modify: `lib/flow/campaign-machine.ts` (165~174행의 지역 함수 제거, import 추가)
- Test: `lib/rules/expedition-key.test.ts`

**Interfaces:**
- Consumes: `CampaignState`·`CampaignDungeon`(`@/lib/domain`)
- Produces:
  - `expeditionKey(state: CampaignState, dungeon: CampaignDungeon): string`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/rules/expedition-key.test.ts`를 새로 만든다. 픽스처의 던전은 `dungeon-001`이고 `failureCount`가 0이다.

```ts
import { describe, expect, it } from "vitest";
import { createFixtureCampaignState } from "@/lib/rules/fixtures";
import { expeditionKey } from "./expedition-key";

describe("expeditionKey", () => {
  it("캠페인 시드와 던전 id와 실패 횟수를 잇는다", () => {
    const state = createFixtureCampaignState("씨앗");
    expect(expeditionKey(state, state.dungeons[0])).toBe("씨앗/dungeon-001#0");
  });

  it("실패 횟수가 다르면 다른 키가 된다", () => {
    const state = createFixtureCampaignState("씨앗");
    const retried = { ...state.dungeons[0], failureCount: 1 };
    expect(expeditionKey(state, retried)).not.toBe(
      expeditionKey(state, state.dungeons[0]),
    );
  });

  it("공고와 파티는 키에 들어가지 않는다", () => {
    const state = createFixtureCampaignState("씨앗");
    const otherBoard = {
      ...state,
      board: [{ ...state.board[0], partyId: state.board[0].partyId }],
      parties: [],
    };
    expect(expeditionKey(otherBoard, otherBoard.dungeons[0])).toBe(
      expeditionKey(state, state.dungeons[0]),
    );
  });
});
```

세 번째 테스트가 이 작업의 핵심이다. 키가 공고·파티를 타지 않아야 계약 전 미리보기와 계약 후 지도가 같다.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `pnpm vitest run lib/rules/expedition-key.test.ts`
Expected: FAIL — `Failed to resolve import "./expedition-key"`

- [ ] **Step 3: 모듈을 만든다**

`lib/rules/expedition-key.ts`를 새로 만든다. 주석은 `campaign-machine.ts` 165~171행에 있던 것을 그대로 옮긴다.

```ts
import type { CampaignDungeon, CampaignState } from "@/lib/domain";

/**
 * 한 원정을 가리키는 안정된 난수 키다.
 *
 * 호출 횟수가 아니라 식별자에서 파생하므로 같은 시드로 같은 선택을 하면 중간에
 * 무엇을 몇 번 했든 같은 결과가 나온다. 실패 횟수를 넣는 이유는 전멸 뒤 등급이
 * 올라 같은 던전을 다시 도전할 때 첫 도전과 같은 지도가 나오지 않게 하려는 것이다.
 *
 * 캠페인 시드·던전 id·실패 횟수에만 의존하고 공고와 파티를 타지 않는다. 그래서
 * 계약 전에 만든 지도와 계약 후 만든 지도가 같다. 게시판의 위험 미리보기가
 * 이 성질에 기댄다.
 */
export function expeditionKey(
  state: CampaignState,
  dungeon: CampaignDungeon,
): string {
  return `${state.seed}/${dungeon.id}#${dungeon.failureCount}`;
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `pnpm vitest run lib/rules/expedition-key.test.ts`
Expected: PASS — 3개 통과

- [ ] **Step 5: `campaign-machine`이 옮긴 함수를 쓰게 한다**

`lib/flow/campaign-machine.ts`에서 165~174행의 주석과 `expeditionKey` 함수 정의를 **지운다.** 그 자리에 남는 것은 `nodeRng`부터다.

import 구역(23행 `import type { Rng } from "@/lib/rng";` 다음 줄)에 추가한다. 기존 `@/lib/rules/*` import들이 알파벳 순이므로 `board` 다음, `boss` 앞이 아니라 `expedition-key`는 `event` 다음에 온다.

```ts
import { expeditionKey } from "@/lib/rules/expedition-key";
```

`CampaignDungeon` 타입 import는 `nodeRng`가 여전히 쓰므로 **지우지 않는다.**

- [ ] **Step 6: 동작이 안 바뀌었는지 확인한다**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: 전부 통과

```bash
pnpm backtest
git diff --stat docs/technical/BACKTEST_REPORT.md
```

Expected: 출력 없음. **출력이 있으면 순수 이동이 아니었다는 뜻이므로 멈추고 보고한다.**

- [ ] **Step 7: 커밋한다**

```bash
git add lib/rules/expedition-key.ts lib/rules/expedition-key.test.ts lib/flow/campaign-machine.ts
git commit -m "$(cat <<'EOF'
규칙: 원정 난수 키를 규칙 쪽으로 옮긴다

게시판이 계약 전에 지도를 미리 보여주려면 탐험과 같은 시드 키를 써야
하는데, 키가 campaign-machine 안에 비공개로 있어 밖에서 쓸 수 없었다.

복사하지 않고 옮긴다. 두 벌이 되면 나중에 키가 바뀔 때 한쪽만 고쳐도
컴파일이 통과하고, 게시판이 보여준 위험과 실제 지도가 조용히 어긋난다.
한 벌을 공유하면 그 어긋남이 구조적으로 불가능하다.

lib/rules 는 lib/flow 를 import 하지 않으므로 규칙 쪽에 둔다.
순수 이동이며 백테스트 보고서가 그대로임을 확인했다.
EOF
)"
```

---

## Task 2: 위험 요약 규칙

**Files:**
- Create: `lib/rules/offer-risk.ts`
- Test: `lib/rules/offer-risk.test.ts` (순수 규칙 검사)
- Test: `lib/flow/campaign-machine.test.ts` (미리보기 = 탐험 지도 검사만 추가)

**테스트를 두 파일로 나누는 이유:** "미리보기가 탐험 지도와 같다"를 검사하려면
`transitionCampaign`이 필요한데 그것은 `lib/flow`에 있다. `lib/rules`의 테스트는
지금 `lib/flow`를 한 곳도 import하지 않는다. 그 경계를 테스트가 먼저 깨면
production 코드가 따라가기 쉬워지므로, 상태 머신이 필요한 검사는 상태 머신의
테스트 파일에 둔다.

**Interfaces:**
- Consumes: `expeditionKey`(Task 1), `generateGradeMap`(`@/lib/rules/map`), `DungeonEventPools`(`@/lib/content/events`)
- Produces:
  - `interface OfferRiskSummary { readonly counts: Readonly<Record<EventKind, number>>; readonly bossCount: number }`
  - `previewOfferMap(state: CampaignState, offer: BoardOffer, pools: DungeonEventPools): GeneratedMap`
  - `summarizeOfferRisk(state: CampaignState, offer: BoardOffer, pools: DungeonEventPools): OfferRiskSummary`

spec은 `summarizeOfferRisk`만 적었다. `previewOfferMap`을 따로 내보내는 이유는 "미리보기 지도 = 탐험 지도"라는 `C5`의 완료 기준을 개수가 아니라 **지도 자체로** 검사하기 위해서다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/rules/offer-risk.test.ts`를 새로 만든다.

**픽스처를 쓰지 않는다.** `createFixtureCampaignState`의 공고는 `nodeCount: 2`라서 실제 C급 지도(7지점)와 맞지 않아 개수 불변식을 검사할 수 없다. `initializeCampaign`이 만든 진짜 캠페인을 쓴다.

```ts
import { describe, expect, it } from "vitest";
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
import { EVENT_KINDS } from "@/lib/domain";
import type { BoardOffer, CampaignState, DungeonId } from "@/lib/domain";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { previewOfferMap, summarizeOfferRisk } from "./offer-risk";

/** 잠기지 않은 첫 공고. board[0]은 명성 제한으로 잠겨 있을 수 있다. */
function openOffer(state: CampaignState): BoardOffer {
  const offer = state.board.find((candidate) => !candidate.locked);
  if (offer === undefined) throw new Error("잠기지 않은 공고가 없다.");
  return offer;
}

describe("previewOfferMap", () => {
  it("캠페인에 없는 던전이면 오류를 낸다", () => {
    const state = initializeCampaign("c5-없는던전");
    const offer: BoardOffer = {
      ...openOffer(state),
      dungeonId: "dungeon-없음" as DungeonId,
    };
    expect(() => previewOfferMap(state, offer, DUNGEON_EVENT_POOLS)).toThrow(
      /캠페인에 없는 던전/,
    );
  });

  it("실패 횟수가 오르면 다른 지도를 만든다", () => {
    const state = initializeCampaign("c5-실패");
    const offer = openOffer(state);
    const retried: CampaignState = {
      ...state,
      dungeons: state.dungeons.map((dungeon) =>
        dungeon.id === offer.dungeonId
          ? { ...dungeon, failureCount: 1 }
          : dungeon,
      ),
    };

    expect(previewOfferMap(retried, offer, DUNGEON_EVENT_POOLS)).not.toEqual(
      previewOfferMap(state, offer, DUNGEON_EVENT_POOLS),
    );
  });
});

describe("summarizeOfferRisk", () => {
  it("개수 합과 보스가 공고의 지점 수와 맞는다", () => {
    const state = initializeCampaign("c5-합계");
    const offer = openOffer(state);
    const risk = summarizeOfferRisk(state, offer, DUNGEON_EVENT_POOLS);

    const total = EVENT_KINDS.reduce((sum, kind) => sum + risk.counts[kind], 0);
    expect(total + risk.bossCount).toBe(offer.nodeCount);
    expect(risk.bossCount).toBe(1);
  });

  it("네 분류가 모두 한 번 이상 나온다", () => {
    const state = initializeCampaign("c5-분류");
    const risk = summarizeOfferRisk(state, openOffer(state), DUNGEON_EVENT_POOLS);
    for (const kind of EVENT_KINDS) {
      expect(risk.counts[kind]).toBeGreaterThan(0);
    }
  });

  it("같은 입력은 같은 요약을 낸다", () => {
    const state = initializeCampaign("c5-재현");
    const offer = openOffer(state);
    expect(summarizeOfferRisk(state, offer, DUNGEON_EVENT_POOLS)).toEqual(
      summarizeOfferRisk(state, offer, DUNGEON_EVENT_POOLS),
    );
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `pnpm vitest run lib/rules/offer-risk.test.ts`
Expected: FAIL — `Failed to resolve import "./offer-risk"`

- [ ] **Step 3: 규칙 모듈을 구현한다**

`lib/rules/offer-risk.ts`를 새로 만든다.

```ts
import type { DungeonEventPools } from "@/lib/content/events";
import { EVENT_KINDS, RuleError } from "@/lib/domain";
import type {
  BoardOffer,
  CampaignState,
  EventKind,
  GeneratedMap,
} from "@/lib/domain";
import { createRng } from "@/lib/rng";
import { expeditionKey } from "./expedition-key";
import { generateGradeMap } from "./map";

export interface OfferRiskSummary {
  /** 보스방을 뺀 전체 지점의 분류별 개수. 합은 offer.nodeCount - 1이다. */
  readonly counts: Readonly<Record<EventKind, number>>;
  /** 보스방 수. 지도마다 항상 1이다. */
  readonly bossCount: number;
}

/**
 * 공고가 가리키는 던전의 지도를 계약 전에 만든다.
 *
 * 탐험이 쓰는 expeditionKey 를 그대로 쓰므로 계약 뒤 생기는 지도와 같다.
 * 키가 공고와 파티를 타지 않기 때문이다.
 */
export function previewOfferMap(
  state: CampaignState,
  offer: BoardOffer,
  pools: DungeonEventPools,
): GeneratedMap {
  const dungeon = state.dungeons.find(
    (candidate) => candidate.id === offer.dungeonId,
  );
  if (dungeon === undefined) {
    throw new RuleError(
      "UNKNOWN_ID",
      `캠페인에 없는 던전이다: ${offer.dungeonId}`,
      { offerId: offer.id, dungeonId: offer.dungeonId },
    );
  }

  return generateGradeMap(
    dungeon.grade,
    createRng(expeditionKey(state, dungeon)).derive("map"),
    { eventPools: pools },
  );
}

/**
 * 계약 전에 공개하는 사건 분류별 개수다.
 *
 * 지도 전체 기준이라 실제로 한 경로에서 지나는 지점보다 많다. 계약 단계의
 * 질문이 "어느 갈래로 갈까"가 아니라 "이 던전이 대체로 어떤 성격인가"이므로
 * 갈래별로 나누지 않는다.
 *
 * CampaignMachineContext 를 받지 않는 이유는 그 타입이 lib/flow 에 있고
 * lib/rules 가 lib/flow 를 import 하지 않기 때문이다. 조회표를 매번 만들지만
 * 이 경로는 사람이 게시판을 볼 때만 돈다.
 */
export function summarizeOfferRisk(
  state: CampaignState,
  offer: BoardOffer,
  pools: DungeonEventPools,
): OfferRiskSummary {
  const map = previewOfferMap(state, offer, pools);
  const kindById = new Map<string, EventKind>(
    EVENT_KINDS.flatMap((kind) =>
      pools.regular[kind].map((event) => [event.id as string, kind])),
  );

  const counts: Record<EventKind, number> = {
    monster: 0,
    rest: 0,
    merchant: 0,
    special: 0,
  };
  let bossCount = 0;

  for (const node of map.nodes) {
    if (node.id === map.bossNodeId) {
      bossCount += 1;
      continue;
    }
    const kind = kindById.get(node.eventId as string);
    if (kind === undefined) {
      throw new RuleError(
        "UNKNOWN_ID",
        `풀에 없는 사건이 지도에 있다: ${node.eventId}`,
        { nodeId: node.id, eventId: node.eventId },
      );
    }
    counts[kind] += 1;
  }

  return { counts, bossCount };
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `pnpm vitest run lib/rules/offer-risk.test.ts`
Expected: PASS — 5개 통과

- [ ] **Step 5: 미리보기 = 탐험 지도 검사를 상태 머신 테스트에 더한다**

`lib/flow/campaign-machine.test.ts`는 이미 `CONTEXT`(24행), `boardState(seed)`(31행), `DUNGEON_EVENT_POOLS`·`transitionCampaign` import를 갖고 있다. **새 헬퍼를 만들지 않는다.** import 한 줄만 더한다.

```ts
import { previewOfferMap } from "@/lib/rules/offer-risk";
```

파일 끝에 추가한다.

```ts
describe("게시판 위험 미리보기", () => {
  it("계약 전에 만든 지도가 계약 후 탐험 지도와 같다", () => {
    const state = boardState("c5-일치");
    const offer = state.board.find((candidate) => !candidate.locked)!;

    const preview = previewOfferMap(state, offer, DUNGEON_EVENT_POOLS);
    const after = transitionCampaign(
      state,
      { type: "acceptContract", offerId: offer.id },
      CONTEXT,
    );

    expect(after.expedition).not.toBeNull();
    expect(preview).toEqual(after.expedition!.map);
  });
});
```

이것이 `C5`의 완료 기준 "지도 생성 시드가 탐험과 일치"를 직접 검사하는 항목이다.

Run: `pnpm vitest run lib/flow/campaign-machine.test.ts`
Expected: PASS

- [ ] **Step 6: 검사의 판별력을 확인한다**

`previewOfferMap`의 `expeditionKey(state, dungeon)` 호출을 `` `${state.seed}/${dungeon.id}` `` 로 바꾼다(실패 횟수를 뺀다).

Run: `pnpm vitest run lib/rules/offer-risk.test.ts lib/flow/campaign-machine.test.ts`
Expected: `offer-risk`의 "실패 횟수가 오르면 다른 지도를 만든다"가 실패한다. **머신 테스트의 "계약 전에 만든 지도가 계약 후 탐험 지도와 같다"는 `failureCount`가 0이라 그대로 통과한다.** 두 검사가 서로 다른 것을 지키므로 둘 다 필요하다. **둘 다 실패하거나 둘 다 통과하면 멈추고 보고한다.**

되돌리고 `git diff --stat`으로 복원을 확인한다. 확인 내용을 PR 본문에 적는다.

- [ ] **Step 7: 검증하고 커밋한다**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: 전부 통과

```bash
git add lib/rules/offer-risk.ts lib/rules/offer-risk.test.ts lib/flow/campaign-machine.test.ts
git commit -m "$(cat <<'EOF'
규칙: 계약 전 지도 미리보기와 사건 분류 집계를 만든다

공개 정보 규정은 길잡이가 답사를 마쳤으므로 지점의 사건 분류와 대략적
위험을 입장 전에 안다고 적는다. 규칙에 그 값을 낼 함수가 없었다.

BoardOffer 에 넣지 않고 별도 함수로 둔다. generateBoard 는 캠페인
초기화와 정산과 엔딩 판정과 백테스트에서 불리므로, 거기에 지도 생성을
얹으면 시드 10,000개 백테스트에 75만 번의 지도 생성이 붙는다.
시뮬레이터는 이 값을 읽지 않는다.

previewOfferMap 을 따로 내보낸다. 미리보기가 탐험 지도와 같다는 것을
개수가 아니라 지도 자체로 검사해야 규칙이 지켜지는지 알 수 있다.

expeditionKey 에서 실패 횟수를 빼 테스트가 실패하는 것을 확인한 뒤
되돌렸다.
EOF
)"
```

---

## Task 3: view-model 확장

**Files:**
- Modify: `components/game/campaign-view-model.ts`
- Test: `components/game/campaign-view-model.test.ts`

**Interfaces:**
- Consumes: `OfferRiskSummary`(Task 2), `EVENT_KIND_MARKS`·`EVENT_KIND_LABELS`(`./labels`)
- Produces:
  - `interface OfferRiskKindView { kind: EventKind; mark: string; label: string; count: number }`
  - `interface OfferRiskView { kinds: OfferRiskKindView[]; bossCount: number }`
  - `toOfferRiskView(summary: OfferRiskSummary): OfferRiskView`
  - `toBoardView(state, riskByOfferId: ReadonlyMap<string, OfferRiskSummary>): BoardOfferView[]` — **두 번째 인자 필수**
  - `toContractView(state, offerId, risk: OfferRiskSummary | null): ContractView | null` — **세 번째 인자 필수**
  - `BoardOfferView`에 `risk: OfferRiskView | null`, `ContractView`에 `risk: OfferRiskView | null`

**기본값을 주지 않는다.** 안 넘기면 컴파일이 실패해야 한다. 하네스가 값을 안 갖고 있어도 `new Map()`과 `null`을 **명시적으로** 넘긴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`components/game/campaign-view-model.test.ts` 끝에 추가한다. import에 `toOfferRiskView`를 더한다.

```ts
describe("toOfferRiskView", () => {
  const summary = {
    counts: { monster: 2, rest: 2, merchant: 1, special: 1 },
    bossCount: 1,
  } as const;

  it("네 분류를 항상 같은 순서로 낸다", () => {
    const view = toOfferRiskView(summary);
    expect(view.kinds.map((entry) => entry.kind)).toEqual([
      "monster",
      "rest",
      "merchant",
      "special",
    ]);
  });

  it("기호와 분류명을 함께 담는다", () => {
    const view = toOfferRiskView(summary);
    const monster = view.kinds[0];
    expect(monster.mark).toBe("◆");
    expect(monster.label).toBe("몬스터");
    expect(monster.count).toBe(2);
  });

  it("보스 수를 분류와 섞지 않는다", () => {
    const view = toOfferRiskView(summary);
    expect(view.bossCount).toBe(1);
    expect(view.kinds).toHaveLength(4);
  });
});
```

기호를 값으로 못박는 이유: 게시판과 지도 범례가 같은 기호를 써야 학습이 이어진다. `EVENT_KIND_MARKS`가 바뀌면 이 테스트가 알려준다.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `pnpm vitest run components/game/campaign-view-model.test.ts`
Expected: FAIL — `toOfferRiskView is not a function`

- [ ] **Step 3: 변환 함수를 구현한다**

`components/game/campaign-view-model.ts`를 고친다.

import을 세 군데 고친다.

1. 값 import를 새로 넣는다. 이 파일은 지금 `@/lib/domain`에서 타입만 가져오지만, `EVENT_KINDS`는 값이라 `import type`에 넣을 수 없다. `campaign-machine.ts`가 같은 모듈에서 값과 타입을 따로 가져오는 것과 같은 형태다.

```ts
import { EVENT_KINDS } from "@/lib/domain";
import type { OfferRiskSummary } from "@/lib/rules/offer-risk";
```

2. 기존 `import type { … } from "@/lib/domain";` 블록에 `EventKind`를 **알파벳 순 자리**(`ClassId` 다음, `Grade` 앞)에 끼워 넣는다. 새 블록을 만들지 않는다.

3. 기존 `import { PERSONALITY_LABELS } from "./labels";`를 다음으로 바꾼다.

```ts
import {
  EVENT_KIND_LABELS,
  EVENT_KIND_MARKS,
  PERSONALITY_LABELS,
} from "./labels";
```

타입과 함수를 `BoardOfferView` 정의 앞에 추가한다.

```ts
export interface OfferRiskKindView {
  kind: EventKind;
  mark: string;
  label: string;
  count: number;
}

export interface OfferRiskView {
  /** 네 분류가 EVENT_KINDS 순서로 모두 들어온다. 개수가 0인 분류는 없다. */
  kinds: OfferRiskKindView[];
  bossCount: number;
}

/**
 * 기호 옆에 분류명을 함께 담는다.
 * 기호만으로는 스크린리더가 읽지 못하고 색·기호 외 단서를 요구하는
 * 접근성 기준에 걸린다.
 */
export function toOfferRiskView(summary: OfferRiskSummary): OfferRiskView {
  return {
    kinds: EVENT_KINDS.map((kind) => ({
      kind,
      mark: EVENT_KIND_MARKS[kind],
      label: EVENT_KIND_LABELS[kind],
      count: summary.counts[kind],
    })),
    bossCount: summary.bossCount,
  };
}
```

`BoardOfferView`의 47행 주석 `// riskSummary?: ... — E1 지도 통합 때 추가한다. U1에서는 없음.`을 **지우고** 그 자리에 넣는다.

```ts
  risk: OfferRiskView | null;
```

`ContractView`의 `acceptBlockReason` 다음에도 같은 줄을 넣는다.

- [ ] **Step 4: 두 변환 함수의 시그니처를 바꾼다**

`toBoardView`:

```ts
export function toBoardView(
  state: CampaignState,
  riskByOfferId: ReadonlyMap<string, OfferRiskSummary>,
): BoardOfferView[] {
```

반환 객체의 `lockReason: offer.lockReason,` 다음에 추가한다.

```ts
      risk: (() => {
        const summary = riskByOfferId.get(offer.id as string);
        return summary === undefined ? null : toOfferRiskView(summary);
      })(),
```

`toContractView`:

```ts
export function toContractView(
  state: CampaignState,
  offerId: BoardOfferId,
  risk: OfferRiskSummary | null,
): ContractView | null {
```

반환 객체의 `acceptBlockReason: ...` 다음에 추가한다.

```ts
    risk: risk === null ? null : toOfferRiskView(risk),
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

Run: `pnpm vitest run components/game/campaign-view-model.test.ts`
Expected: PASS. 기존 `toBoardView`·`toContractView` 테스트가 있으면 인자가 모자라 **타입 오류가 난다.** 그 호출부에 `new Map()`과 `null`을 넣어 고친다.

- [ ] **Step 6: 검증하고 커밋한다**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: 통과. `app/play/page.tsx`와 `app/u1-test/page.tsx`는 아직 인자를 안 넘기므로 **typecheck가 실패한다.** Task 4가 고친다. 이 단계에서는 `pnpm vitest run components/game/campaign-view-model.test.ts`만 통과하면 된다.

```bash
git add components/game/campaign-view-model.ts components/game/campaign-view-model.test.ts
git commit -m "$(cat <<'EOF'
화면: 공고 위험 요약을 화면 모델로 옮긴다

U1 이 남긴 riskSummary 자리 주석을 실제 필드로 바꾼다. E1 지도 규칙이
붙은 지금은 데이터가 있다.

기호 옆에 분류명을 함께 담는다. 기호만 담으면 스크린리더가 읽지 못하고,
컴포넌트가 라벨을 다시 찾아야 해 같은 표가 두 곳에 생긴다.

두 변환 함수의 새 인자에 기본값을 주지 않는다. U4 가 고친 결함이 정확히
그것이었다. toPartyStatusView 가 두 번째 인자 없이 불려 신뢰 증감이 늘
0이었는데, 기본값이 있어 아무 데서도 오류가 나지 않았다.
EOF
)"
```

---

## Task 4: 화면 배선

**Files:**
- Modify: `components/game/Board.tsx`
- Modify: `components/game/ContractPanel.tsx`
- Modify: `app/play/page.tsx`
- Modify: `app/u1-test/page.tsx`

**Interfaces:**
- Consumes: `OfferRiskView`(Task 3), `summarizeOfferRisk`(Task 2), `CAMPAIGN_CONTEXT`(`app/play/play-campaign-provider`)
- Produces: 없음. 배선만 한다.

- [ ] **Step 1: 게시판 카드에 위험 한 줄을 넣는다**

`components/game/Board.tsx`의 파티 줄(`파티: {offer.partyLabel} …`을 담은 `<span>`) **다음에** 추가한다.

```tsx
                {offer.risk === null ? null : (
                  <span className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted">
                    {offer.risk.kinds.map((entry) => (
                      <span key={entry.kind}>
                        {entry.mark}
                        {entry.label} {entry.count}
                      </span>
                    ))}
                    <span>보스전 {offer.risk.bossCount}</span>
                  </span>
                )}
```

보스전에는 기호를 붙이지 않는다. `EVENT_KIND_MARKS.special`과 보스의 `categoryMark`가 둘 다 `★`라서 같은 기호가 두 뜻을 갖는다.

`<button>` 안이므로 `<div>`·`<p>`를 쓰지 않는다. 기존 줄들이 전부 `<span>`인 이유가 그것이다.

- [ ] **Step 2: 계약 확인에 분류별 개수 표를 넣는다**

`components/game/ContractPanel.tsx`의 지원 가능 여부 `<p>` **다음**, `출전 파티` `<h3>` **앞에** 추가한다.

```tsx
      {contract.risk === null ? null : (
        <>
          <h3 className="mt-3 text-sm font-semibold text-muted">
            사건 분류
            <span className="ml-1 text-xs font-normal">
              전체 지도 기준 · 한 갈래만 지난다
            </span>
          </h3>
          <ul className="mt-2 flex flex-col gap-1">
            {contract.risk.kinds.map((entry) => (
              <li
                key={entry.kind}
                className="flex justify-between text-xs text-muted"
              >
                <span>
                  {entry.mark} {entry.label}
                </span>
                <span>{entry.count}곳</span>
              </li>
            ))}
            <li className="flex justify-between border-t border-edge pt-1 text-xs text-muted">
              <span>보스전</span>
              <span>{contract.risk.bossCount}곳</span>
            </li>
          </ul>
        </>
      )}
```

`전체 지도 기준 · 한 갈래만 지난다`를 빼지 않는다. 전체 기준 개수는 실제 통과 지점보다 많아서(C급이면 6곳을 세지만 4곳을 지난다) 이 문구가 없으면 숫자가 사람을 속인다.

- [ ] **Step 3: 게시판 페이지가 위험을 계산해 넘긴다**

`app/play/page.tsx`를 고친다. import를 더한다.

```tsx
import { useMemo, useState } from "react";
import { summarizeOfferRisk } from "@/lib/rules/offer-risk";
import type { OfferRiskSummary } from "@/lib/rules/offer-risk";
import { CAMPAIGN_CONTEXT } from "./play-campaign-provider";
```

`useCampaignDispatch` import 줄은 그대로 둔다 — 같은 파일에서 온다.

`matches` 가드 **다음에** 계산을 넣는다.

```tsx
  const riskByOfferId = useMemo(() => {
    const entries = new Map<string, OfferRiskSummary>();
    for (const offer of campaign.board) {
      entries.set(
        offer.id as string,
        summarizeOfferRisk(campaign, offer, CAMPAIGN_CONTEXT.events),
      );
    }
    return entries;
  }, [campaign]);
```

`useMemo`를 조건부 `return null` 뒤에 두면 훅 순서가 깨진다. **`usePhaseGuard` 결과로 일찍 반환하기 전에 `useMemo`를 놓는다.** 즉 `const matches = usePhaseGuard(...)` 다음, `if (!matches) return null;` **앞**이다.

호출부를 바꾼다.

```tsx
  const contract = selectedOfferId === null
    ? null
    : toContractView(
        campaign,
        selectedOfferId,
        riskByOfferId.get(selectedOfferId as string) ?? null,
      );
```

```tsx
        offers={toBoardView(campaign, riskByOfferId)}
```

- [ ] **Step 4: u1 하네스를 따라 고친다**

`app/u1-test/page.tsx`는 위험 데이터를 갖고 있지 않다. 하네스 픽스처의 공고는 `nodeCount`가 실제 지도와 맞지 않으므로 계산하지 않고 빈 값을 **명시적으로** 넘긴다.

```tsx
        <Board
          offers={toBoardView(state, new Map())}
```

```tsx
  const contract =
    selectedOfferId === null ? null : toContractView(state, selectedOfferId, null);
```

- [ ] **Step 5: 검증한다**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: 전부 통과

- [ ] **Step 6: 브라우저로 확인한다**

```bash
pnpm dev &
timeout 40 bash -c 'until curl -sf http://localhost:3000 >/dev/null; do sleep 1; done'
```

`http://localhost:3000/play`에서 확인할 것:

- 공고 카드마다 `◆몬스터 N · ○휴식 N · ◇상인 N · ★특수 사건 N · 보스전 1` 한 줄이 있다
- 네 분류가 모든 카드에서 같은 순서다
- 공고를 고르면 오른쪽에 분류별 개수 표와 `전체 지도 기준 · 한 갈래만 지난다`가 나온다
- **계약해 지도로 들어간 뒤 지점들의 분류를 세면 카드에 적힌 개수와 같다** (핵심)
- 창을 1024px로 좁혀도 가로 스크롤이 없다

끝나면 `lsof -ti:3000 -sTCP:LISTEN | xargs -r kill`

- [ ] **Step 7: 커밋한다**

```bash
git add components/game/Board.tsx components/game/ContractPanel.tsx app/play/page.tsx app/u1-test/page.tsx
git commit -m "$(cat <<'EOF'
화면: 공고와 계약에 사건 분류별 위험을 보여준다

게시판이 필요 명성과 보상과 파티만 보여주고 던전의 위험 성격은 계약을
수락한 뒤 지도에서야 드러났다. 공개 정보 규정이 입장 전에 알 수 있다고
정한 것을 화면이 늦게 전달하고 있었다.

기호는 지도 범례와 같은 것을 쓴다. 게시판에서 본 기호가 지도에서 같은
뜻이어야 학습이 이어진다. 보스전에는 기호를 붙이지 않는다. 특수 사건과
보스의 표시가 둘 다 ★ 라서 한 기호가 두 뜻을 갖기 때문이다.

계약 확인에 "전체 지도 기준 · 한 갈래만 지난다"를 적는다. 전체 기준
개수는 실제 통과 지점보다 많아서(C급이면 6곳 중 4곳) 문구가 없으면
숫자가 사람을 속인다.

지도 생성은 useMemo 로 감싼다. JSX 안에서 부르면 렌더마다 지도 다섯
개를 다시 만들고 RuleError 가 페이지를 백지로 만든다.
EOF
)"
```

---

## Task 5: 전체 검증과 배정표 갱신

**Files:**
- Modify: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`

**Interfaces:**
- Consumes: Task 1~4의 결과 전부

- [ ] **Step 1: 검증 넷을 돌린다**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: 전부 통과

- [ ] **Step 2: 규칙 동작이 안 바뀌었는지 확인한다**

```bash
pnpm backtest
git diff --stat docs/technical/BACKTEST_REPORT.md
```

Expected: 출력 없음. **출력이 있으면 멈추고 보고한다.** 이번 작업은 규칙의 수치·확률·판정을 바꾸지 않았으므로 보고서가 달라질 이유가 없다.

- [ ] **Step 3: 백테스트가 느려지지 않았는지 확인한다**

Step 2의 `pnpm backtest` 실행 시간을 적어 둔다. 직전 기준은 약 93초다. 크게 늘었다면 지도 생성이 시뮬레이터 경로에 새어 들어간 것이므로 멈추고 보고한다.

- [ ] **Step 4: 배정표를 갱신한다**

**먼저 main과 동기화한다.** 배정표는 여러 PR이 건드리는 파일이다.

```bash
git fetch origin
git merge origin/main
```

`docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`에서 두 곳을 고친다.

1. `C5` 행의 상태를 `⬜`에서 `✅`로, 담당자를 `SangHwan Yoo`로 바꾼다.
2. 「상세 구현 plan 대응표」의 `C5` 행에서 `현재 plan 범위 밖`을 이 plan을 가리키게 바꾼다.

```
| C5 | 현재 plan 범위 밖 | `U4`가 데이터 없음으로 미룬 공고·계약의 공개 위험. 게시판 단계에서 지도에 닿아야 한다 |
```
를
```
| C5 | 별도 plan Task 1~5 | 계약 전 지도 미리보기로 사건 분류별 위험을 공개한다. [별도 spec](../superpowers/specs/2026-08-16-sanghwan-yoo-offer-contract-risk-summary-design.md) |
```
로 바꾼다.

**`C6` 행은 건드리지 않는다.** 별개 작업이다.

```bash
pnpm vitest run docs/technical/PROTOTYPE_WORK_ASSIGNMENT.test.ts
```

Expected: 15개 통과

- [ ] **Step 5: 커밋한다**

```bash
git add docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md
git commit -m "$(cat <<'EOF'
문서: 배정표에서 C5 완료를 반영한다

C5 를 완료로 바꾸고 대응표가 별도 plan 을 가리키게 한다.
EOF
)"
```

- [ ] **Step 6: PR을 연다**

PR 본문에 적을 것:

- 남의 코드를 고쳤는지 — `lib/flow/campaign-machine.ts`에서 함수 한 개를 파일 밖으로 옮겼다. **백테스트 보고서 무변경**이 동작이 그대로임을 증명한다는 것을 적는다
- 발동을 확인한 검사: `expeditionKey`에서 실패 횟수 빼기. 어떤 테스트가 실패했는지와 되돌렸음을 적는다
- 브라우저로 대조한 결과 — 카드에 적힌 개수와 실제 지도의 지점 분류가 같았는지
- 백테스트 실행 시간이 직전과 비슷한지
- 범위 밖으로 남긴 것과 후속 ID(`C6`·`B1`)

**승인을 받은 뒤에는 이 브랜치에 push하지 않는다.** `dismiss_stale_reviews_on_push`가 켜져 있어 승인이 날아간다. 고칠 것이 생기면 별도 PR로 낸다.
