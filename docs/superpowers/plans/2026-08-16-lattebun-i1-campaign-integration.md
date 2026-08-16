# I1 캠페인 전체 통합 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** C4의 전이 함수 위에 Zustand 스토어를 올리고 U1·U2·U3 화면을 게시판부터 엔딩까지 한 흐름으로 이으며, 구 단일 런 코드를 지운다.

**Architecture:** 전이 함수가 규칙 결과를 버리지 않도록 `transitionCampaignDetailed`를 진실로 두고 기존 `transitionCampaign`을 얇은 래퍼로 남긴다. 스토어가 그 결과와 보스전 직전 스냅샷을 보관하고, 기존 `/play` 셸의 단계-라우팅 골격을 캠페인 단계로 이행해 U1·U2·U3 컴포넌트를 배선한다.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript 5 strict, Zustand 5(vanilla store + context), Vitest 4(node 환경).

**Spec:** `docs/superpowers/specs/2026-08-16-lattebun-i1-campaign-integration-design.md`

## Global Constraints

- 새 규칙·새 화면을 만들지 않는다. I1은 이미 있는 것을 연결하고 지우는 작업이다.
- `transitionCampaign`의 기존 시그니처(`CampaignState` 반환)를 유지한다. 호출부 20곳(백테스트 6, `campaign-machine.test.ts` 헬퍼, `u3-test` 하네스 12)을 수정하지 않으며, **C4의 기존 테스트가 수정 없이 통과하는 것이 이 변경의 회귀 검사다.**
- 구현이 둘로 갈라지면 안 된다. `transitionCampaign`은 `transitionCampaignDetailed(...).state`만 돌려준다.
- 보스전 스냅샷은 전이 **전에** 찍는다. 전이 후에는 HP가 이미 깎여 복원할 수 없다.
- `acceptContract` 처리 시 `lastBossResolution`·`lastSettlementSteps`·`membersBeforeBoss`를 모두 `null`로 되돌린다.
- `RuleError`를 삼키지 않는다. 화면은 유효한 행동만 제시하므로 던져진 오류는 화면 버그다.
- 시드는 URL `?seed=`로 재현하고 없으면 `createSeed()`. 무작위 시드는 마운트 후 초기화해 hydration 불일치를 피한다.
- `lib/domain/run.ts`의 `TrustChange`는 현역이다(`lib/rules/boss.ts`·`event.ts`·`trust.ts`·`trust-history.ts`가 사용). `lib/domain/party.ts`로 옮겨 살리고 나머지만 지운다.
- 삭제 전후로 `rg`를 돌려 제품 경로에 잔여 참조가 없음을 보이고 결과를 커밋 본문에 적는다.
- 프리뷰 하네스(`/u1-test`·`/u2-test`·`/u3-test`)는 지우지 않는다.
- 검증 명령 넷 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`를 유지한다.
- 커밋 메시지는 제목과 본문을 모두 한글로 쓴다.
- 브랜치는 `feature/i1-campaign-integration`이며 spec 커밋(`6c858ff`)이 이미 올라가 있다. main에 직접 push하지 않는다.

## 파일 구조

| 파일 | 작업 |
| --- | --- |
| `lib/flow/campaign-machine.ts` | `CampaignTransition`·`transitionCampaignDetailed` 추가, `transitionCampaign`을 래퍼로, `resolveBoss` 내부 함수가 결과를 함께 반환 |
| `lib/flow/campaign-machine.test.ts` | detailed 케이스 추가(기존 테스트는 수정 금지) |
| `lib/stores/campaign-store.ts` (신규) | Zustand 캠페인 스토어 |
| `lib/stores/campaign-store.test.ts` (신규) | 타이밍 3규칙 검증 |
| `lib/stores/campaign-store-provider.tsx` (신규) | context + `useCampaignStore` + `useCampaignDispatch` |
| `app/play/play-campaign-provider.tsx` (신규) | 시드 처리와 스토어 공급 |
| `app/play/phase-route.ts` | `CampaignPhase` 기준으로 교체 |
| `app/play/play-chrome.tsx` | `CampaignHeader` + `PartyStatusSidebar`로 교체 |
| `app/play/layout.tsx` | 새 provider 사용 |
| `app/play/page.tsx`·`map/page.tsx`·`encounter/page.tsx`·`result/page.tsx` | U1·U2·U3 컴포넌트 배선 |
| `components/game/expedition-view-model.ts` | `MemberStatusView`에 `alive` 추가 |
| `components/game/PartyStatusSidebar.tsx` | 사망 표시 |
| `lib/domain/party.ts`·`index.ts` | `TrustChange` 이동 |
| 삭제 | `lib/stores/{run-store,run-store.test,game-store-provider}`, `lib/flow/{run-machine,initial-run,path}(+tests)`, `app/state-preview/*`, `lib/domain/run.ts`, 미사용 구 컴포넌트 |

---

### Task 1: 전이 함수가 규칙 결과를 내보내게 한다

**Files:**
- Modify: `lib/flow/campaign-machine.ts`
- Modify: `lib/flow/campaign-machine.test.ts` (추가만, 기존 테스트 수정 금지)

**Interfaces:**
- Produces: `CampaignTransition { state: CampaignState; bossResolution?: BossResolution; settlementSteps?: SettlementStep[] }`, `transitionCampaignDetailed(state, action, context): CampaignTransition`.
- Keeps: `transitionCampaign(state, action, context): CampaignState` — 시그니처 불변.

- [ ] **Step 1: 실패하는 테스트를 추가한다.**

`lib/flow/campaign-machine.test.ts` 끝에 추가한다. **기존 테스트와 헬퍼는 한 줄도 건드리지 않는다.** 아래 블록은 자체 헬퍼를 갖고 있으므로 기존 파일의 헬퍼 이름을 몰라도 그대로 붙여 넣을 수 있다. 파일 상단 import에 `transitionCampaignDetailed`를 더한다(`CONTEXT`·`transitionCampaign`·`initializeCampaign`·`affordableChoiceIds`가 이미 있으면 재사용하고, 없으면 아래 헬퍼가 쓰는 것만 추가한다).

```ts
describe("transitionCampaignDetailed", () => {
  /** 보스 단계까지 진행한 상태를 만든다. 첫 유효 선택만 고른다. */
  function stateAtBoss(seed: string): CampaignState {
    let state = transitionCampaign(
      initializeCampaign(seed),
      { type: "openBoard" },
      CONTEXT,
    );
    const offer = state.board.find((candidate) => !candidate.locked)!;
    state = transitionCampaign(
      state,
      { type: "acceptContract", offerId: offer.id },
      CONTEXT,
    );

    for (let guard = 0; state.phase !== "boss"; guard += 1) {
      if (guard > 100) throw new Error("보스 단계에 닿지 않는다");
      const expedition = state.expedition!;

      if (state.phase === "map") {
        const current = expedition.map.nodes.find(
          (node) => node.id === expedition.currentNodeId,
        )!;
        state = transitionCampaign(
          state,
          { type: "selectNode", nodeId: current.nextNodeIds[0] },
          CONTEXT,
        );
      } else if (state.phase === "infoOpportunity") {
        state = transitionCampaign(
          state,
          { type: "chooseInfoCard", cardId: expedition.pendingInfo!.cardIds[0] },
          CONTEXT,
        );
      } else if (state.phase === "event") {
        const choiceId =
          affordableChoiceIds(state, CONTEXT)[0] ?? expedition.pendingEvent!.choiceIds[0];
        state = transitionCampaign(state, { type: "chooseEvent", choiceId }, CONTEXT);
      } else {
        throw new Error(`예상 밖 단계: ${state.phase}`);
      }
    }

    return state;
  }

  it("resolveBoss는 상태와 함께 보스 결과를 돌려준다", () => {
    const transition = transitionCampaignDetailed(
      stateAtBoss("detailed-boss"),
      { type: "resolveBoss" },
      CONTEXT,
    );

    expect(transition.state.phase).toBe("settlement");
    expect(transition.bossResolution).toBeDefined();
    expect(transition.bossResolution!.members.length).toBeGreaterThan(0);
    expect(transition.settlementSteps).toBeUndefined();
  });

  it("applySettlement은 상태와 함께 정산 단계를 돌려준다", () => {
    const beforeSettlement = transitionCampaign(
      stateAtBoss("detailed-settlement"),
      { type: "resolveBoss" },
      CONTEXT,
    );
    const transition = transitionCampaignDetailed(
      beforeSettlement,
      { type: "applySettlement" },
      CONTEXT,
    );

    expect(transition.settlementSteps).toBeDefined();
    expect(transition.settlementSteps!.length).toBeGreaterThan(0);
    expect(transition.settlementSteps![0].kind).toBe("survival");
    expect(transition.bossResolution).toBeUndefined();
  });

  it("결과가 없는 행동은 상태만 돌려준다", () => {
    const transition = transitionCampaignDetailed(
      initializeCampaign("detailed-open"),
      { type: "openBoard" },
      CONTEXT,
    );

    expect(transition.bossResolution).toBeUndefined();
    expect(transition.settlementSteps).toBeUndefined();
  });

  it("transitionCampaign은 detailed의 state와 같다", () => {
    const board = initializeCampaign("detailed-wrapper");
    const viaWrapper = transitionCampaign(board, { type: "openBoard" }, CONTEXT);
    const viaDetailed = transitionCampaignDetailed(
      board,
      { type: "openBoard" },
      CONTEXT,
    ).state;

    expect(viaWrapper).toEqual(viaDetailed);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다.**

Run: `pnpm test lib/flow/campaign-machine.test.ts`
Expected: FAIL — `transitionCampaignDetailed`가 없어 실패한다. **기존 테스트는 계속 통과해야 한다.**

- [ ] **Step 3: 전이 함수를 고친다.**

`lib/flow/campaign-machine.ts`를 다음 순서로 고친다.

1. 파일 상단 타입 import에 `BossResolution`(`@/lib/rules/boss`)과 `SettlementStep`(`@/lib/rules/settlement`)을 추가한다. `settleExpedition`은 이미 import돼 있다.

2. `CampaignAction` 정의 아래에 반환 타입을 추가한다.

```ts
/**
 * 전이 결과. 규칙이 만든 설명을 상태 밖으로 함께 내보낸다.
 *
 * `CampaignState`에는 보스 피해 보정과 정산 원인 사슬이 남지 않아, 상태만
 * 돌려주면 화면이 "왜 그렇게 됐는지"를 영영 알 수 없다.
 */
export interface CampaignTransition {
  readonly state: CampaignState;
  /** `resolveBoss`일 때만 있다. */
  readonly bossResolution?: BossResolution;
  /** `applySettlement`일 때만 있다. */
  readonly settlementSteps?: SettlementStep[];
}
```

3. 내부 함수 `resolveBoss`(448번째 줄 근처)가 `CampaignState` 대신 `CampaignTransition`을 반환하게 바꾼다. 이미 `const resolution = resolveBossFight({...})`로 결과를 갖고 있으므로, 마지막 `return { ...state, phase: "settlement", ... }`를 `return { state: { ...state, phase: "settlement", ... }, bossResolution: resolution }`으로 감싼다. 내부 계산은 그대로 둔다.

4. `transitionCampaign`을 `transitionCampaignDetailed`로 이름을 바꾸고 반환 타입을 `CampaignTransition`으로 바꾼다. 각 `case`의 반환을 감싼다.

```ts
export function transitionCampaignDetailed(
  state: CampaignState,
  action: CampaignAction,
  context: CampaignMachineContext,
): CampaignTransition {
  switch (action.type) {
    case "openBoard":
      if (state.phase !== "board") invalidTransition(state, action);
      return { state: { ...state, board: generateBoard(state) } };

    case "acceptContract":
      if (state.phase !== "board") invalidTransition(state, action);
      return { state: acceptContract(state, action.offerId, context) };

    case "selectNode":
      if (state.phase !== "map") invalidTransition(state, action);
      return { state: selectNode(state, action.nodeId, context) };

    case "chooseInfoCard":
      if (state.phase !== "infoOpportunity") invalidTransition(state, action);
      return { state: chooseInfoCard(state, action.cardId, context) };

    case "chooseEvent":
      if (state.phase !== "event") invalidTransition(state, action);
      return { state: chooseEvent(state, action.choiceId, context) };

    case "resolveBoss":
      if (state.phase !== "boss") invalidTransition(state, action);
      return resolveBoss(state, context);

    case "applySettlement": {
      if (state.phase !== "settlement") invalidTransition(state, action);
      const expedition = requireExpedition(state);
      const dungeon = findDungeon(state, expedition);
      const settled = settleExpedition({
        state,
        expedition,
        rng: createRng(expeditionKey(state, dungeon)).derive("regroup"),
      });
      return { state: settled.state, settlementSteps: settled.steps };
    }
  }
}

/** 결과가 필요 없는 호출부를 위한 편의 함수다. */
export function transitionCampaign(
  state: CampaignState,
  action: CampaignAction,
  context: CampaignMachineContext,
): CampaignState {
  return transitionCampaignDetailed(state, action, context).state;
}
```

- [ ] **Step 4: 새 테스트와 기존 테스트가 모두 통과하는지 확인한다.**

Run: `pnpm test lib/flow/campaign-machine.test.ts && pnpm typecheck`
Expected: PASS. **기존 테스트를 한 줄도 고치지 않고 통과해야 한다.** 고쳐야 통과한다면 래퍼가 계약을 깬 것이므로 구현을 다시 본다.

- [ ] **Step 5: 백테스트가 깨지지 않았는지 확인한다.**

Run: `BACKTEST_SEEDS=200 pnpm backtest`
Expected: 생성 오류 0건으로 정상 완료. 백테스트는 `transitionCampaign`을 그대로 쓰므로 영향이 없어야 한다.

- [ ] **Step 6: 커밋한다.**

```bash
git add lib/flow/campaign-machine.ts lib/flow/campaign-machine.test.ts
git commit -m "흐름: 전이 함수가 보스·정산 결과를 함께 돌려준다" -m "상태만 돌려주면 화면이 원인 사슬을 받을 수 없어 transitionCampaignDetailed를 진실로 두고 기존 이름을 얇은 래퍼로 남긴다. 호출부 20곳과 C4 기존 테스트를 수정하지 않았고 200시드 백테스트로 회귀를 확인했다."
```

---

### Task 2: 캠페인 스토어

**Files:**
- Create: `lib/stores/campaign-store.ts`
- Test: `lib/stores/campaign-store.test.ts`
- Create: `lib/stores/campaign-store-provider.tsx`

**Interfaces:**
- Consumes: `transitionCampaignDetailed`, `CampaignMachineContext` from `@/lib/flow/campaign-machine`; `initializeCampaign` from `@/lib/rules/campaign-init`.
- Produces:
  - `CampaignStore`, `CampaignStoreApi`, `createCampaignStore(initial: CampaignState, context: CampaignMachineContext): CampaignStoreApi`
  - `CampaignStoreProvider`, `useCampaignStore<T>(selector)` from the provider file

- [ ] **Step 1: 실패하는 테스트를 작성한다.**

Create `lib/stores/campaign-store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BOSSES } from "@/lib/content/bosses";
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
import { INFO_CARDS } from "@/lib/content/info-cards";
import { ITEMS } from "@/lib/content/items";
import {
  affordableChoiceIds,
  createCampaignMachineContext,
} from "@/lib/flow/campaign-machine";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { createCampaignStore } from "./campaign-store";
import type { CampaignStoreApi } from "./campaign-store";

const CONTEXT = createCampaignMachineContext({
  events: DUNGEON_EVENT_POOLS,
  cards: INFO_CARDS,
  items: ITEMS,
  bosses: BOSSES,
});

/** 보스 단계까지 진행한 스토어를 만든다. 첫 유효 선택만 고른다. */
function storeAtBoss(seed: string): CampaignStoreApi {
  const store = createCampaignStore(initializeCampaign(seed), CONTEXT);
  store.getState().dispatch({ type: "openBoard" });

  const offer = store.getState().campaign.board.find((candidate) => !candidate.locked)!;
  store.getState().dispatch({ type: "acceptContract", offerId: offer.id });

  for (let guard = 0; store.getState().campaign.phase !== "boss"; guard += 1) {
    if (guard > 100) throw new Error("보스 단계에 닿지 않는다");
    const state = store.getState().campaign;
    const expedition = state.expedition!;

    if (state.phase === "map") {
      const current = expedition.map.nodes.find(
        (node) => node.id === expedition.currentNodeId,
      )!;
      store.getState().dispatch({ type: "selectNode", nodeId: current.nextNodeIds[0] });
    } else if (state.phase === "infoOpportunity") {
      store.getState().dispatch({
        type: "chooseInfoCard",
        cardId: expedition.pendingInfo!.cardIds[0],
      });
    } else if (state.phase === "event") {
      const choiceId =
        affordableChoiceIds(state, CONTEXT)[0] ?? expedition.pendingEvent!.choiceIds[0];
      store.getState().dispatch({ type: "chooseEvent", choiceId });
    } else {
      throw new Error(`예상 밖 단계: ${state.phase}`);
    }
  }

  return store;
}

describe("createCampaignStore", () => {
  it("보스전 직전 파티를 전투 전 HP로 보관한다", () => {
    const store = storeAtBoss("i1-snapshot");
    const before = store.getState().campaign;
    const expedition = before.expedition!;
    const party = before.parties.find((candidate) => candidate.id === expedition.partyId)!;
    const expected = party.memberIds.map(
      (memberId) => before.members.find((member) => member.id === memberId)!.currentHp,
    );

    store.getState().dispatch({ type: "resolveBoss" });

    const snapshot = store.getState().membersBeforeBoss!;
    expect(snapshot.map((member) => member.currentHp)).toEqual(expected);
  });

  it("resolveBoss와 applySettlement이 각각 결과를 채운다", () => {
    const store = storeAtBoss("i1-results");

    store.getState().dispatch({ type: "resolveBoss" });
    expect(store.getState().lastBossResolution).not.toBeNull();
    expect(store.getState().lastSettlementSteps).toBeNull();

    store.getState().dispatch({ type: "applySettlement" });
    expect(store.getState().lastSettlementSteps).not.toBeNull();
    expect(store.getState().lastSettlementSteps!.length).toBeGreaterThan(0);
  });

  it("새 계약을 수락하면 지난 탐험 결과를 비운다", () => {
    const store = storeAtBoss("i1-reset");
    store.getState().dispatch({ type: "resolveBoss" });
    store.getState().dispatch({ type: "applySettlement" });
    expect(store.getState().lastBossResolution).not.toBeNull();

    // 정산 뒤 게시판으로 돌아왔다면 다음 공고를 수락한다.
    const state = store.getState().campaign;
    if (state.phase === "board") {
      const offer = state.board.find((candidate) => !candidate.locked);
      if (offer !== undefined) {
        store.getState().dispatch({ type: "acceptContract", offerId: offer.id });
        expect(store.getState().lastBossResolution).toBeNull();
        expect(store.getState().lastSettlementSteps).toBeNull();
        expect(store.getState().membersBeforeBoss).toBeNull();
      }
    }
  });

  it("startCampaign은 그 시드의 캠페인을 만든다", () => {
    const store = createCampaignStore(initializeCampaign("i1-a"), CONTEXT);
    store.getState().startCampaign("i1-b");
    expect(store.getState().campaign.seed).toBe("i1-b");
    expect(store.getState().lastBossResolution).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다.**

Run: `pnpm test lib/stores/campaign-store.test.ts`
Expected: FAIL — `./campaign-store` 모듈이 없어 import 실패.

- [ ] **Step 3: 스토어를 구현한다.**

Create `lib/stores/campaign-store.ts`:

```ts
import { createStore, type StoreApi } from "zustand/vanilla";
import {
  transitionCampaignDetailed,
  type CampaignAction,
  type CampaignMachineContext,
} from "@/lib/flow/campaign-machine";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import type { BossResolution } from "@/lib/rules/boss";
import type { SettlementStep } from "@/lib/rules/settlement";
import type { CampaignMember, CampaignState } from "@/lib/domain";

export interface CampaignStoreState {
  campaign: CampaignState;
  lastBossResolution: BossResolution | null;
  lastSettlementSteps: SettlementStep[] | null;
  /** 보스전 직전 출전 파티. 전투 전 HP를 화면에 보여주려면 여기서만 얻을 수 있다. */
  membersBeforeBoss: CampaignMember[] | null;
}

export interface CampaignStoreActions {
  dispatch(action: CampaignAction): void;
  startCampaign(seed: string): void;
  resetCampaign(): void;
}

export type CampaignStore = CampaignStoreState & CampaignStoreActions;
export type CampaignStoreApi = StoreApi<CampaignStore>;

const EMPTY_RESULTS = {
  lastBossResolution: null,
  lastSettlementSteps: null,
  membersBeforeBoss: null,
} as const;

/** 출전 파티원을 상태에서 뽑아 복사한다. */
function participantsOf(state: CampaignState): CampaignMember[] {
  const expedition = state.expedition;
  if (expedition === null) return [];
  const party = state.parties.find((candidate) => candidate.id === expedition.partyId);
  const ids = new Set((party?.memberIds ?? []).map(String));
  return state.members
    .filter((member) => ids.has(member.id as string))
    .map((member) => ({ ...member }));
}

export function createCampaignStore(
  initial: CampaignState,
  context: CampaignMachineContext,
): CampaignStoreApi {
  return createStore<CampaignStore>()((set, get) => ({
    campaign: initial,
    ...EMPTY_RESULTS,

    dispatch: (action) => {
      const current = get().campaign;

      // 전이 뒤에는 HP가 이미 깎여 전투 전 값을 복원할 수 없다.
      const membersBeforeBoss =
        action.type === "resolveBoss" ? participantsOf(current) : get().membersBeforeBoss;

      const transition = transitionCampaignDetailed(current, action, context);

      // 새 탐험이 시작되면 지난 결과가 화면에 남지 않게 비운다.
      if (action.type === "acceptContract") {
        set({ campaign: transition.state, ...EMPTY_RESULTS });
        return;
      }

      set({
        campaign: transition.state,
        membersBeforeBoss,
        lastBossResolution: transition.bossResolution ?? get().lastBossResolution,
        lastSettlementSteps: transition.settlementSteps ?? get().lastSettlementSteps,
      });
    },

    startCampaign: (seed) => {
      set({ campaign: initializeCampaign(seed), ...EMPTY_RESULTS });
    },

    resetCampaign: () => {
      set({ campaign: initial, ...EMPTY_RESULTS });
    },
  }));
}
```

- [ ] **Step 4: provider를 구현한다.**

Create `lib/stores/campaign-store-provider.tsx`:

```tsx
"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import { useStore } from "zustand";
import type { CampaignMachineContext } from "@/lib/flow/campaign-machine";
import type { CampaignState } from "@/lib/domain";
import {
  createCampaignStore,
  type CampaignStore,
  type CampaignStoreApi,
} from "./campaign-store";

const CampaignStoreContext = createContext<CampaignStoreApi | null>(null);

interface CampaignStoreProviderProps {
  initialCampaign: CampaignState;
  context: CampaignMachineContext;
  children: ReactNode;
}

export function CampaignStoreProvider({
  initialCampaign,
  context,
  children,
}: CampaignStoreProviderProps) {
  const [store] = useState<CampaignStoreApi>(() =>
    createCampaignStore(initialCampaign, context),
  );

  return (
    <CampaignStoreContext.Provider value={store}>
      {children}
    </CampaignStoreContext.Provider>
  );
}

export function useCampaignStore<T>(selector: (state: CampaignStore) => T): T {
  const store = useContext(CampaignStoreContext);

  if (store === null) {
    throw new Error(
      "useCampaignStore는 CampaignStoreProvider 안에서 호출해야 합니다.",
    );
  }

  return useStore(store, selector);
}
```

- [ ] **Step 5: 테스트와 타입 검사를 통과시킨다.**

Run: `pnpm test lib/stores/campaign-store.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: 검사 발동을 확인한다.**

`dispatch`의 스냅샷 계산을 전이 **뒤로** 옮겨(`transitionCampaignDetailed` 호출 다음에 `participantsOf(transition.state)`) 스냅샷 테스트가 실패하는지 확인한 뒤 되돌린다. 확인 내용을 커밋 본문에 적는다.

- [ ] **Step 7: 커밋한다.**

```bash
git add lib/stores/campaign-store.ts lib/stores/campaign-store.test.ts lib/stores/campaign-store-provider.tsx
git commit -m "저장소: 캠페인 스토어와 provider를 추가한다" -m "전이 결과와 보스전 직전 파티 스냅샷을 보관해 화면이 원인 사슬을 그릴 수 있게 한다. 스냅샷을 전이 뒤로 옮겨 테스트가 잡는지 확인 후 되돌렸다."
```

---

### Task 3: /play를 캠페인 흐름으로 배선

**Files:**
- Create: `app/play/play-campaign-provider.tsx`
- Modify: `app/play/layout.tsx`, `phase-route.ts`, `play-chrome.tsx`
- Modify: `app/play/page.tsx`, `map/page.tsx`, `encounter/page.tsx`, `result/page.tsx`
- Modify: `components/game/expedition-view-model.ts`, `components/game/PartyStatusSidebar.tsx`

**Interfaces:**
- Consumes: `useCampaignStore`, `CampaignStoreProvider` from `@/lib/stores/campaign-store-provider`; U1·U2·U3 컴포넌트와 view-model 함수 전부.
- Produces: `ROUTE_BY_PHASE: Record<CampaignPhase, string>`, `usePhaseGuard(allowed: readonly CampaignPhase[]): boolean`, `useCampaignDispatch(): (action: CampaignAction) => void`.

- [ ] **Step 1: `MemberStatusView`에 사망 표시를 더한다.**

`components/game/expedition-view-model.ts`의 `MemberStatusView`에 `alive: boolean;`을 추가하고, `toPartyStatusView`가 `alive: member.alive`를 채우게 한다.

`components/game/PartyStatusSidebar.tsx`에서 죽은 파티원을 구분한다. 이름 옆에 `· 사망`을 붙이고 카드 테두리를 `border-dashed border-trust-down`으로 바꾼다. 색만으로 구분하지 않는다.

```tsx
<li
  key={member.memberId}
  className={`rounded border px-3 py-2 ${
    member.alive ? "border-edge" : "border-dashed border-trust-down"
  }`}
>
  <p className="text-sm text-parchment">
    {member.name}
    <span className="ml-1 text-xs text-muted">{member.className}</span>
    {member.alive ? null : (
      <span className="ml-1 text-xs text-trust-down">· 사망</span>
    )}
  </p>
```

`components/game/expedition-view-model.test.ts`에 `alive`가 전달되는지 확인하는 단언을 기존 `toPartyStatusView` 테스트에 한 줄 더한다.

- [ ] **Step 2: 단계 라우팅을 캠페인으로 바꾼다.**

`app/play/phase-route.ts`를 교체한다.

```ts
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CampaignPhase } from "@/lib/domain";
import { useCampaignStore } from "@/lib/stores/campaign-store-provider";

/**
 * 단계가 화면을 결정한다. URL을 직접 입력해도 현재 단계의 화면만 보이므로
 * 지도에서 정산으로 건너뛰는 우회가 라우팅 수준에서 막힌다.
 */
export const ROUTE_BY_PHASE: Record<CampaignPhase, string> = {
  board: "/play",
  contract: "/play",
  map: "/play/map",
  infoOpportunity: "/play/encounter",
  event: "/play/encounter",
  boss: "/play/result",
  settlement: "/play/result",
  ended: "/play/result",
};

export function usePhaseGuard(allowed: readonly CampaignPhase[]): boolean {
  const phase = useCampaignStore((store) => store.campaign.phase);
  const router = useRouter();
  const matches = allowed.includes(phase);

  useEffect(() => {
    if (!matches) {
      router.replace(ROUTE_BY_PHASE[phase]);
    }
  }, [matches, phase, router]);

  return matches;
}
```

- [ ] **Step 3: provider와 셸을 교체한다.**

Create `app/play/play-campaign-provider.tsx`. 기존 `play-run-provider.tsx`의 시드 처리 방식(주석 포함)을 그대로 옮기되 캠페인으로 바꾼다. `CampaignMachineContext`는 콘텐츠 풀에서 한 번만 만들어 모듈 상수로 둔다. `useCampaignDispatch`도 여기서 내보낸다.

```tsx
"use client";

import { type ReactNode, useEffect, useState } from "react";
import { BOSSES } from "@/lib/content/bosses";
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
import { INFO_CARDS } from "@/lib/content/info-cards";
import { ITEMS } from "@/lib/content/items";
import { createCampaignMachineContext } from "@/lib/flow/campaign-machine";
import type { CampaignAction } from "@/lib/flow/campaign-machine";
import { createSeed } from "@/lib/rng";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import {
  CampaignStoreProvider,
  useCampaignStore,
} from "@/lib/stores/campaign-store-provider";
import type { CampaignState } from "@/lib/domain";

export const CAMPAIGN_CONTEXT = createCampaignMachineContext({
  events: DUNGEON_EVENT_POOLS,
  cards: INFO_CARDS,
  items: ITEMS,
  bosses: BOSSES,
});

/**
 * /play 화면 흐름에 실제 캠페인을 공급한다.
 *
 * 시드는 URL의 ?seed=로 재현하고 없으면 무작위다. 레이아웃은 URL 쿼리를
 * 받지 못하고 서버는 무작위 시드를 미리 알 수 없으므로, 마운트 후에
 * 초기화해 hydration 불일치를 피한다.
 */
export function PlayCampaignProvider({ children }: { children: ReactNode }) {
  const [initial, setInitial] = useState<CampaignState | null>(null);

  useEffect(() => {
    const seedParam = new URLSearchParams(window.location.search).get("seed");
    const seed =
      seedParam === null || seedParam.trim() === "" ? createSeed() : seedParam;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInitial(initializeCampaign(seed));
  }, []);

  if (initial === null) {
    return (
      <p className="p-6 text-center text-sm text-muted">캠페인을 준비하는 중…</p>
    );
  }

  return (
    <CampaignStoreProvider initialCampaign={initial} context={CAMPAIGN_CONTEXT}>
      {children}
    </CampaignStoreProvider>
  );
}

/**
 * 화면의 모든 상태 변경이 지나는 단일 통로다. 화면은 유효한 행동만
 * 제시하므로 여기서 던져진 오류는 화면 버그다. 삼키지 않는다.
 */
export function useCampaignDispatch(): (action: CampaignAction) => void {
  return useCampaignStore((store) => store.dispatch);
}
```

`app/play/layout.tsx`가 `PlayCampaignProvider`를 쓰게 바꾼다.

`app/play/play-chrome.tsx`를 캠페인 셸로 바꾼다. `CampaignHeader`(`toCampaignHeaderView`)와 `PartyStatusSidebar`(`toPartyStatusView`)를 쓴다. 사이드바에 넣을 파티는 탐험 중이면 출전 파티, 아니면 표시하지 않는다.

- [ ] **Step 4: 네 라우트를 배선한다.**

각 페이지가 `usePhaseGuard`로 자기 단계를 지키고 스토어에서 필요한 것만 골라 컴포넌트에 넘긴다. 뷰 변환은 U1·U2·U3의 view-model 함수를 그대로 쓴다.

- `app/play/page.tsx` — `usePhaseGuard(["board", "contract"])`. `toBoardView`·`toContractView`로 `Board`와 `ContractPanel`을 그리고, 공고 선택은 로컬 `useState`, 계약 수락은 `dispatch({ type: "acceptContract", offerId })`.
- `app/play/map/page.tsx` — `usePhaseGuard(["map"])`. `toMapView`로 `DungeonMapView`를 그리고 지점 입장은 `dispatch({ type: "selectNode", nodeId })`.
- `app/play/encounter/page.tsx` — `usePhaseGuard(["infoOpportunity", "event"])`. `infoOpportunity`면 `toInfoOpportunityView`로 `InfoOpportunityPanel`, 카드 선택은 `dispatch({ type: "chooseInfoCard", cardId })`. `event`면 `toEventView`로 `EventActions`, 선택은 `dispatch({ type: "chooseEvent", choiceId })`.
- `app/play/result/page.tsx` — `usePhaseGuard(["boss", "settlement", "ended"])`. `boss`면 `dispatch({ type: "resolveBoss" })` 버튼, `settlement`면 스토어의 `lastBossResolution`·`membersBeforeBoss`로 `BossResultPanel`과 `lastSettlementSteps`로 `SettlementTimeline`을 그리고 `dispatch({ type: "applySettlement" })` 버튼, `ended`면 `toEndingView`로 `EndingPanel`.

`u1-test`·`u2-test`·`u3-test` 하네스가 같은 컴포넌트를 쓰므로, 배선은 데이터 출처만 스토어로 바뀐 것이다. 컴포넌트의 props를 바꾸지 않는다.

- [ ] **Step 5: 검증한다.**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: 넷 모두 PASS.

- [ ] **Step 6: 브라우저로 한 바퀴 돈다.**

`pnpm dev` 후 `http://localhost:3000/play?seed=i1-demo`에서 게시판 → 계약 → 지도 → 정보 → 사건 → 보스 → 정산 → 다음 게시판을 진행한다. 같은 주소를 새 탭에서 다시 열어 같은 게시판이 나오는지, `board` 단계에서 `/play/result`를 직접 열면 `/play`로 되돌아오는지 확인한다. 확인 결과를 리포트에 적는다.

- [ ] **Step 7: 커밋한다.**

```bash
git add app/play components/game/expedition-view-model.ts components/game/expedition-view-model.test.ts components/game/PartyStatusSidebar.tsx
git commit -m "화면: /play를 캠페인 흐름으로 배선한다" -m "스토어 위에 U1·U2·U3 화면을 올리고 단계가 화면을 결정하는 라우팅을 캠페인 단계로 옮긴다. 실제 흐름에서는 파티원이 죽으므로 사이드바에 사망 표시를 더한다."
```

---

### Task 4: 구 단일 런 코드 정리와 전체 검증

**Files:**
- Modify: `lib/domain/party.ts`, `lib/domain/index.ts`
- Delete: `lib/domain/run.ts`, `lib/stores/{run-store.ts,run-store.test.ts,game-store-provider.tsx}`, `lib/flow/{run-machine.ts,run-machine.test.ts,initial-run.ts,initial-run.test.ts,path.ts,path.test.ts}`, `app/state-preview/*`, `app/play/play-run-provider.tsx`, 미사용 구 컴포넌트
- Modify: `components/game/labels.ts` (`PHASE_LABELS` 정리)
- Modify: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md` (I1 상태 — main 동기화 후, 컨트롤러가 finishing에서)

**Interfaces:**
- Produces: `TrustChange`가 `@/lib/domain`에서 계속 export된다(위치만 `party.ts`로 이동).

- [ ] **Step 1: `TrustChange`를 옮긴다.**

`lib/domain/party.ts` 끝에 `run.ts`의 `TrustChange`를 주석까지 그대로 옮긴다.

```ts
/** 신뢰 변화 한 건. reason은 화면이 지어내지 않도록 규칙이 문장으로 남긴다. */
export interface TrustChange {
  memberId: MemberId;
  delta: number;
  /** "정의로운 성격: 거짓 정보가 발각됨"처럼 사람이 읽는 문장이다. */
  reason: string;
}
```

`lib/domain/index.ts`에서 `run.ts` 재export를 지우고 `TrustChange`가 `party.ts`에서 나가도록 맞춘다.

Run: `pnpm typecheck`
Expected: `TrustChange` 관련 오류 없음. 남은 오류는 아직 지우지 않은 구 파일이 `RunState` 등을 참조해 생기는 것이다.

- [ ] **Step 2: 삭제 전 참조를 확인한다.**

Run: `rg -n "RunState|useRunStore|run-machine|initial-run|state-preview|PHASE_LABELS" app components lib --glob '!**/*.test.ts'`

각 결과가 (a) 삭제 대상 파일 안인지 (b) 살려야 할 현역 코드인지 판단한다. 현역이면 그 파일은 지우지 않고 컨트롤러에 보고한다. 확인 결과를 리포트에 적는다.

- [ ] **Step 3: 구 코드를 지운다.**

Step 2에서 삭제 대상으로 확인된 것만 지운다.

```bash
git rm lib/domain/run.ts \
  lib/stores/run-store.ts lib/stores/run-store.test.ts lib/stores/game-store-provider.tsx \
  lib/flow/run-machine.ts lib/flow/run-machine.test.ts \
  lib/flow/initial-run.ts lib/flow/initial-run.test.ts \
  lib/flow/path.ts lib/flow/path.test.ts \
  app/play/play-run-provider.tsx
git rm -r app/state-preview
```

구 컴포넌트(`ResourceBar`·`PartySidebar`·`ResultSummary`·`SceneStage`·`ChoiceList`·`DungeonMap`·`MemberDetail`·`TrustRow`)는 Step 2의 확인 결과에 따라 **아무도 참조하지 않는 것만** 지운다. `components/game/labels.ts`의 `PHASE_LABELS`는 `RunPhase`에 묶여 있으므로 함께 지우고, `ENDING_LABELS`·`SETTLEMENT_STEP_LABELS`·`EVENT_KIND_*`·`PERSONALITY_LABELS`·`TRUTH_TYPE_LABELS`는 현역이므로 남긴다.

- [ ] **Step 4: 삭제 후 잔여 참조가 없는지 확인한다.**

Run: `rg -n "RunState|useRunStore|run-machine|initial-run|state-preview" app components lib`
Expected: 결과 없음. 남으면 그 파일을 마저 정리하거나 컨트롤러에 보고한다.

- [ ] **Step 5: 전체 검증을 실행한다.**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: 넷 모두 PASS. 삭제된 테스트만큼 테스트 수가 줄어드는 것은 정상이다. 줄어든 수를 리포트에 적는다.

- [ ] **Step 6: 커밋한다.**

```bash
git add -A
git commit -m "정리: 구 단일 런 코드를 지운다" -m "캠페인 흐름이 /play를 대신하므로 run 스토어·상태 머신·프리뷰와 구 화면 컴포넌트를 지운다. 현역인 TrustChange만 party.ts로 옮겨 살렸고 삭제 전후로 rg를 돌려 잔여 참조가 없음을 확인했다."
```

- [ ] **Step 7: (컨트롤러, main 동기화 후) 배정표 I1 상태를 갱신한다.**

`git fetch origin && git merge origin/main` 후 `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`에서 `I1` 상태를 `⬜`→`✅`, 담당을 `LatteBun`으로 바꾸고 `Q1`의 `선행`에서 `I1`을 지운다.

Run: `pnpm test docs/technical/PROTOTYPE_WORK_ASSIGNMENT.test.ts`
Expected: 무결성 검사 PASS.

```bash
git add docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md
git commit -m "문서: 배정표에서 I1 완료를 반영한다" -m "캠페인 전체 통합으로 I1을 완료 처리하고 Q1 선행에서 I1을 지운다."
```

---

## 완료 검증 체크리스트

- [ ] `transitionCampaignDetailed`가 보스·정산 결과를 함께 돌려주고, 기존 `transitionCampaign` 호출부와 C4 테스트가 수정 없이 통과한다.
- [ ] 스토어가 보스전 직전 스냅샷을 전이 전에 찍고, 새 계약 때 결과를 비운다.
- [ ] `/play`에서 게시판→계약→지도→정보→사건→보스→정산→다음 게시판이 새로고침 없이 진행된다.
- [ ] 같은 `?seed=`가 같은 게시판과 같은 첫 지도를 만든다.
- [ ] 단계에 맞지 않는 URL은 현재 단계 화면으로 되돌아온다.
- [ ] 죽은 파티원이 사이드바에서 색 외 단서(점선·`· 사망`)로 구분된다.
- [ ] 구 단일 런 코드가 제품 경로에 남지 않고 `TrustChange`는 계속 동작한다.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`가 모두 통과한다.
- [ ] 프리뷰 하네스 세 개가 그대로 동작한다.

## 실행 시 검토 지점

- Task 1은 남의 작업(C4, sbh3821) 코드를 고친다. 기존 테스트를 한 줄도 고치지 않고 통과하는지가 핵심 게이트다.
- Task 2의 스냅샷 타이밍은 화면의 HP 표시가 조용히 틀리는지를 가르는 지점이다.
- Task 3의 `result` 라우트가 `boss`·`settlement`·`ended` 세 단계를 한 화면에서 다루므로 분기 조건을 특히 본다.
- Task 4는 삭제이므로 되돌리기 어렵다. Step 2의 참조 확인을 건너뛰지 않는다. 판단이 서지 않는 파일은 지우지 말고 보고한다.
- 배정표 갱신(Task 4 Step 7)은 반드시 main 동기화 뒤에 한다.
