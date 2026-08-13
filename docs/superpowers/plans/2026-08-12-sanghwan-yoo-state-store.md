# F2 상태 스토어 골격 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zustand로 현재 `RunState`와 UI 선택 상태를 분리해 관리하고, 개발 전용 `/state-preview`에서 초기 상태와 action 동작을 검증한다.

**Architecture:** `zustand/vanilla` 팩토리가 요청·화면 인스턴스마다 독립적인 Run Store와 UI Store를 만든다. Client Context Provider가 두 인스턴스를 한 번 생성하고 selector hook으로 제공하며, 실제 게임 규칙은 스토어 밖에 둔다. Server Component인 preview page가 직렬화 가능한 `RunState` fixture를 Provider에 전달하고 production에서는 렌더 시작 전에 `notFound()`를 호출한다.

**Tech Stack:** Next.js 16.3.0 App Router, React 19.2.8, TypeScript 5, Zustand 5.0.14, Vitest 4.1.10, Tailwind CSS 4, Node.js 24.19.0, pnpm 11.21.0

## Global Constraints

- 커밋 메시지는 제목과 본문을 포함해 항상 한글로 작성한다. (`AGENTS.md`)
- 작업 브랜치는 `feature/state-store`이며 `main`에 직접 커밋하거나 push하지 않는다.
- 승인된 spec은 `docs/superpowers/specs/2026-08-12-sanghwan-yoo-state-store-design.md`다.
- production dependency는 정확히 `zustand@5.0.14` 하나만 추가한다. `jsdom`과 React Testing Library는 추가하지 않는다.
- `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `lib/domain/*`, `lib/rng/*`를 수정하지 않는다.
- Run Store와 UI Store를 분리하고 모듈 전역 singleton 스토어를 만들지 않는다.
- React Server Component는 스토어를 읽거나 쓰지 않는다. 직렬화 가능한 `RunState`만 Client Provider에 전달한다.
- 스토어에 파티 생성, 신뢰 판정, 던전 생성, 상태 전이 규칙을 넣지 않는다.
- `RunState`의 중첩 객체를 제자리에서 변경하지 않고 완성된 다음 상태로 전체 교체한다.
- `persist`, `localStorage`, Supabase 저장·복원을 사용하지 않는다.
- `Math.random`을 사용하지 않는다. 새 런 시드는 `@/lib/rng`의 `createSeed()`로 만든다.
- 신뢰는 파티원별 `trust`만 표시한다. 파티 평균·합계 신뢰를 계산하거나 표시하지 않는다.
- `/state-preview`는 개발 전용 검증 라우트이며 홈에서 링크하지 않는다. production에서는 404여야 한다.
- preview fixture 값은 기술 예시이며 `R1`, `R2`, `R4`, `Q1`의 공식 규칙이나 기본값이 아니다.
- 테스트 파일은 대상과 같은 디렉터리의 `<대상>.test.ts`다.
- 테스트는 `@/` 별칭을 사용하고 `describe`, `it`, `expect`를 `vitest`에서 명시적으로 가져온다.
- `describe`와 `it` 설명은 한국어로 쓴다.
- 현재 Vitest `environment`는 `node`이며 변경하지 않는다.
- 구현 완료 주장 전 `superpowers:verification-before-completion`을 사용하고, 전체 구현 뒤 `superpowers:requesting-code-review`를 사용한다.

### 확인한 로컬 Next.js 16.3.0 규칙

구현자는 코드를 쓰기 전에 아래 설치본 문서를 다시 열어 확인한다.

- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md`

적용할 규칙:

- page는 기본 Server Component다.
- 상태, custom hook, event handler를 쓰는 Provider와 panel에만 `"use client"`를 선언한다.
- Server Component가 Client Component에 전달하는 `initialRun`은 직렬화 가능한 데이터다.
- `notFound()`는 render path에서 직접 호출하며 `return notFound()`로 쓰거나 `try/catch`로 감싸지 않는다.
- production 404 판정은 streaming 전에 page 최상단에서 수행한다.

### 현재 환경 확인 결과

- `package.json` production dependencies는 Next.js, React, React DOM뿐이며 Zustand는 아직 없다.
- `pnpm test` baseline은 테스트 파일 2개, 테스트 28개 통과다.
- `vitest.config.mts`는 `**/*.test.ts`와 Node 환경, `@` 별칭을 이미 설정한다.
- `RunState`는 `seed`, `phase`, `party`, `dungeon`, `currentNodeId`, `resources`, `pendingClaims`, `log`를 가진다.
- `createSeed(): string`은 `lib/rng/index.ts`에 이미 있다.
- 격리 worktree는 `/tmp/dungeon-schemer-f2-state-store`이며 설계 커밋 `f563da9` 위에서 시작한다.

### 전체 검증 명령

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

---

## File Structure

| 파일 | 책임 | 변경 |
| --- | --- | --- |
| `package.json` | Zustand production dependency 고정 | 수정 (Task 1) |
| `pnpm-lock.yaml` | Zustand 5.0.14 해상도 기록 | 수정 (Task 1) |
| `lib/stores/run-store.ts` | Run Store 타입, vanilla factory, 교체·새 런·초기화 action | 신규 (Task 1) |
| `lib/stores/run-store.test.ts` | Run Store 계약과 시드 불일치 원자성 검증 | 신규 (Task 1) |
| `lib/stores/ui-store.ts` | UI Store 타입, vanilla factory, 선택·해제·초기화 action | 신규 (Task 2) |
| `lib/stores/ui-store.test.ts` | UI Store 계약과 Run Store 독립성 검증 | 신규 (Task 2) |
| `lib/stores/game-store-provider.tsx` | 두 Context, 인스턴스별 Provider, selector hook | 신규 (Task 3) |
| `app/state-preview/preview-run.ts` | 기술 검증용 `RunState` fixture factory | 신규 (Task 4) |
| `app/state-preview/state-preview-panel.tsx` | 두 스토어의 상태 표시와 수동 action | 신규 (Task 4) |
| `app/state-preview/page.tsx` | 개발 전용 preview 조립과 production 404 | 신규 (Task 4) |
| `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md` | F2 완료 및 P1 남은 선행 갱신 | 수정 (Task 5) |

---

### Task 1: Zustand 설치와 Run Store

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `lib/stores/run-store.ts`
- Test: `lib/stores/run-store.test.ts`

**Interfaces:**
- Consumes: `RunState` from `@/lib/domain`, `createSeed(): string` from `@/lib/rng`, `createStore` and `StoreApi` from `zustand/vanilla`
- Produces: `RunFactory`, `RunStoreState`, `RunStoreActions`, `RunStore`, `RunStoreApi`, `createRunStore(initialRun: RunState): RunStoreApi`

- [ ] **Step 1: 로컬 Next.js 문서를 확인한다**

```bash
sed -n '1,260p' node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md
sed -n '1,220p' node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md
```

Expected: page는 기본 Server Component이고 상태·event handler·custom hook은 Client Component에 두며, `notFound()`는 render path에서 직접 호출한다는 내용이 확인된다.

- [ ] **Step 2: Zustand를 정확한 production 버전으로 설치한다**

```bash
pnpm add --save-exact zustand@5.0.14
pnpm list zustand --depth 0
```

Expected: `package.json`의 `dependencies`에 `"zustand": "5.0.14"`가 생기고 목록에 `zustand 5.0.14`가 표시된다.

- [ ] **Step 3: 실패하는 Run Store 테스트를 작성한다**

`lib/stores/run-store.test.ts`를 만든다.

```ts
import { describe, expect, it } from "vitest";
import type {
  ClassId,
  EventId,
  MemberId,
  NodeId,
  RunState,
} from "@/lib/domain";
import { createRunStore } from "@/lib/stores/run-store";

function createTestRun(seed: string): RunState {
  const entryNodeId = "test-entry" as NodeId;
  const bossNodeId = "test-boss" as NodeId;

  return {
    seed,
    phase: "partyIntro",
    party: [
      {
        id: "test-member-1" as MemberId,
        name: "첫 번째",
        classId: "test-class-1" as ClassId,
        personality: "righteous",
        trust: 70,
        alive: true,
      },
      {
        id: "test-member-2" as MemberId,
        name: "두 번째",
        classId: "test-class-2" as ClassId,
        personality: "suspicious",
        trust: 50,
        alive: true,
      },
      {
        id: "test-member-3" as MemberId,
        name: "세 번째",
        classId: "test-class-3" as ClassId,
        personality: "prudent",
        trust: 30,
        alive: true,
      },
    ],
    dungeon: {
      nodes: [
        {
          id: entryNodeId,
          depth: 0,
          eventId: "test-entry-event" as EventId,
          nextNodeIds: [bossNodeId],
        },
        {
          id: bossNodeId,
          depth: 1,
          eventId: "test-boss-event" as EventId,
          nextNodeIds: [],
        },
      ],
      entryNodeId,
      bossNodeId,
    },
    currentNodeId: entryNodeId,
    resources: {
      gold: 10,
      food: 5,
      reputation: 1,
    },
    pendingClaims: [],
    log: [],
  };
}

describe("Run Store", () => {
  it("전달한 초기 런을 정확히 보관한다", () => {
    const initialRun = createTestRun("initial-seed");
    const store = createRunStore(initialRun);

    expect(store.getState().run).toBe(initialRun);
  });

  it("런 전체를 교체하고 이전 객체를 변경하지 않는다", () => {
    const initialRun = createTestRun("initial-seed");
    const nextRun = {
      ...initialRun,
      seed: "next-seed",
      resources: {
        ...initialRun.resources,
        gold: 99,
      },
    };
    const store = createRunStore(initialRun);

    store.getState().replaceRun(nextRun);

    expect(store.getState().run).toBe(nextRun);
    expect(initialRun.seed).toBe("initial-seed");
    expect(initialRun.resources.gold).toBe(10);
  });

  it("고정 시드를 새 런 factory에 전달하고 결과를 저장한다", () => {
    const store = createRunStore(createTestRun("initial-seed"));
    let receivedSeed = "";

    store.getState().startNewRun((seed) => {
      receivedSeed = seed;
      return createTestRun(seed);
    }, "fixed-seed");

    expect(receivedSeed).toBe("fixed-seed");
    expect(store.getState().run.seed).toBe("fixed-seed");
  });

  it("시드를 생략하면 생성한 시드를 factory와 상태에 함께 쓴다", () => {
    const store = createRunStore(createTestRun("initial-seed"));
    let receivedSeed = "";

    store.getState().startNewRun((seed) => {
      receivedSeed = seed;
      return createTestRun(seed);
    });

    expect(receivedSeed).not.toBe("");
    expect(store.getState().run.seed).toBe(receivedSeed);
  });

  it("factory의 시드가 다르면 오류를 던지고 기존 런을 유지한다", () => {
    const initialRun = createTestRun("initial-seed");
    const store = createRunStore(initialRun);

    expect(() =>
      store
        .getState()
        .startNewRun(() => createTestRun("wrong-seed"), "expected-seed"),
    ).toThrow("새 런 시드가 일치하지 않습니다");

    expect(store.getState().run).toBe(initialRun);
  });

  it("생성 시점의 초기 런으로 되돌린다", () => {
    const initialRun = createTestRun("initial-seed");
    const store = createRunStore(initialRun);

    store.getState().replaceRun(createTestRun("changed-seed"));
    store.getState().resetRun();

    expect(store.getState().run).toBe(initialRun);
  });
});
```

- [ ] **Step 4: 테스트가 올바른 이유로 실패하는지 확인한다**

Run: `pnpm test lib/stores/run-store.test.ts`

Expected: FAIL. `Cannot find module '@/lib/stores/run-store'` 또는 동등한 모듈 누락 오류가 난다.

- [ ] **Step 5: 최소 Run Store 구현을 작성한다**

`lib/stores/run-store.ts`를 만든다.

```ts
import type { RunState } from "@/lib/domain";
import { createSeed } from "@/lib/rng";
import { createStore, type StoreApi } from "zustand/vanilla";

export type RunFactory = (seed: string) => RunState;

export interface RunStoreState {
  run: RunState;
}

export interface RunStoreActions {
  replaceRun(nextRun: RunState): void;
  startNewRun(createRun: RunFactory, seed?: string): void;
  resetRun(): void;
}

export type RunStore = RunStoreState & RunStoreActions;
export type RunStoreApi = StoreApi<RunStore>;

export function createRunStore(initialRun: RunState): RunStoreApi {
  return createStore<RunStore>()((set) => ({
    run: initialRun,
    replaceRun: (nextRun) => {
      set({ run: nextRun });
    },
    startNewRun: (createRun, seed) => {
      const chosenSeed = seed ?? createSeed();
      const nextRun = createRun(chosenSeed);

      if (nextRun.seed !== chosenSeed) {
        throw new Error(
          "새 런 시드가 일치하지 않습니다: expected " +
            chosenSeed +
            ", received " +
            nextRun.seed,
        );
      }

      set({ run: nextRun });
    },
    resetRun: () => {
      set({ run: initialRun });
    },
  }));
}
```

- [ ] **Step 6: Run Store 테스트를 통과시킨다**

Run: `pnpm test lib/stores/run-store.test.ts`

Expected: PASS. 테스트 6개가 통과한다.

- [ ] **Step 7: 정적 검사를 실행한다**

```bash
pnpm lint
pnpm typecheck
```

Expected: 두 명령 모두 오류 없이 종료한다.

- [ ] **Step 8: Task 1을 커밋한다**

```bash
git add package.json pnpm-lock.yaml lib/stores/run-store.ts lib/stores/run-store.test.ts
git commit -m "기능: Run Store 골격 추가" -m "Zustand 5.0.14를 production dependency로 고정한다.
RunState 전체 교체와 새 시드 런 생성, 초기화 계약을 vanilla store와 단위 테스트로 구현한다.
factory가 다른 시드를 반환하면 기존 상태를 유지하고 오류를 던진다."
```

---

### Task 2: UI Store

**Files:**
- Create: `lib/stores/ui-store.ts`
- Test: `lib/stores/ui-store.test.ts`

**Interfaces:**
- Consumes: `MemberId` from `@/lib/domain`, `createRunStore(initialRun)` from Task 1
- Produces: `UiStoreState`, `UiStoreActions`, `UiStore`, `UiStoreApi`, `createUiStore(): UiStoreApi`

- [ ] **Step 1: 실패하는 UI Store 테스트를 작성한다**

`lib/stores/ui-store.test.ts`를 만든다.

```ts
import { describe, expect, it } from "vitest";
import type { MemberId, NodeId, RunState } from "@/lib/domain";
import { createRunStore } from "@/lib/stores/run-store";
import { createUiStore } from "@/lib/stores/ui-store";

const memberId = "ui-member" as MemberId;

describe("UI Store", () => {
  it("선택된 파티원 없이 시작한다", () => {
    const store = createUiStore();

    expect(store.getState().selectedMemberId).toBeNull();
  });

  it("파티원을 선택한다", () => {
    const store = createUiStore();

    store.getState().selectMember(memberId);

    expect(store.getState().selectedMemberId).toBe(memberId);
  });

  it("선택을 해제한다", () => {
    const store = createUiStore();

    store.getState().selectMember(memberId);
    store.getState().clearSelectedMember();

    expect(store.getState().selectedMemberId).toBeNull();
  });

  it("UI 상태를 초기화한다", () => {
    const store = createUiStore();

    store.getState().selectMember(memberId);
    store.getState().resetUi();

    expect(store.getState().selectedMemberId).toBeNull();
  });

  it("UI 변경이 Run Store를 바꾸지 않는다", () => {
    const entryNodeId = "ui-entry" as NodeId;
    const initialRun: RunState = {
      seed: "ui-independent",
      phase: "partyIntro",
      party: [],
      dungeon: {
        nodes: [],
        entryNodeId,
        bossNodeId: "ui-boss" as NodeId,
      },
      currentNodeId: entryNodeId,
      resources: {
        gold: 0,
        food: 0,
        reputation: 0,
      },
      pendingClaims: [],
      log: [],
    };
    const runStore = createRunStore(initialRun);
    const uiStore = createUiStore();

    uiStore.getState().selectMember(memberId);

    expect(runStore.getState().run).toBe(initialRun);
  });
});
```

이 테스트의 빈 파티·노드는 UI와 Run Store의 연결 여부만 보는 구조 fixture다. 실제 preview와 게임 초기값으로 사용하지 않는다.

- [ ] **Step 2: 테스트가 올바른 이유로 실패하는지 확인한다**

Run: `pnpm test lib/stores/ui-store.test.ts`

Expected: FAIL. `Cannot find module '@/lib/stores/ui-store'` 또는 동등한 모듈 누락 오류가 난다.

- [ ] **Step 3: 최소 UI Store 구현을 작성한다**

`lib/stores/ui-store.ts`를 만든다.

```ts
import type { MemberId } from "@/lib/domain";
import { createStore, type StoreApi } from "zustand/vanilla";

export interface UiStoreState {
  selectedMemberId: MemberId | null;
}

export interface UiStoreActions {
  selectMember(memberId: MemberId): void;
  clearSelectedMember(): void;
  resetUi(): void;
}

export type UiStore = UiStoreState & UiStoreActions;
export type UiStoreApi = StoreApi<UiStore>;

export function createUiStore(): UiStoreApi {
  return createStore<UiStore>()((set) => ({
    selectedMemberId: null,
    selectMember: (memberId) => {
      set({ selectedMemberId: memberId });
    },
    clearSelectedMember: () => {
      set({ selectedMemberId: null });
    },
    resetUi: () => {
      set({ selectedMemberId: null });
    },
  }));
}
```

- [ ] **Step 4: 두 스토어 테스트를 통과시킨다**

```bash
pnpm test lib/stores/run-store.test.ts lib/stores/ui-store.test.ts
pnpm lint
pnpm typecheck
```

Expected: Store 테스트 11개가 통과하고 lint와 typecheck도 통과한다.

- [ ] **Step 5: Task 2를 커밋한다**

```bash
git add lib/stores/ui-store.ts lib/stores/ui-store.test.ts
git commit -m "기능: UI Store 골격 추가" -m "선택한 파티원 ID를 게임 런과 분리된 vanilla store에 보관한다.
선택, 해제, 초기화와 Run Store 독립성을 단위 테스트로 검증한다."
```

---

### Task 3: 화면 인스턴스별 Store Provider

**Files:**
- Create: `lib/stores/game-store-provider.tsx`
- Test: TypeScript와 ESLint 정적 검사. 승인된 spec에 따라 DOM 테스트 환경은 추가하지 않는다.

**Interfaces:**
- Consumes: `RunState`, Task 1의 `RunStore`·`RunStoreApi`·`createRunStore`, Task 2의 `UiStore`·`UiStoreApi`·`createUiStore`
- Produces: `GameStoreProvider`, `useRunStore<T>(selector): T`, `useUiStore<T>(selector): T`

- [ ] **Step 1: Provider와 selector hook을 작성한다**

`lib/stores/game-store-provider.tsx`를 만든다.

```tsx
"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useState,
} from "react";
import { useStore } from "zustand";
import type { RunState } from "@/lib/domain";
import {
  createRunStore,
  type RunStore,
  type RunStoreApi,
} from "@/lib/stores/run-store";
import {
  createUiStore,
  type UiStore,
  type UiStoreApi,
} from "@/lib/stores/ui-store";

const RunStoreContext = createContext<RunStoreApi | null>(null);
const UiStoreContext = createContext<UiStoreApi | null>(null);

interface GameStoreProviderProps {
  initialRun: RunState;
  children: ReactNode;
}

export function GameStoreProvider({
  initialRun,
  children,
}: GameStoreProviderProps) {
  const [runStore] = useState<RunStoreApi>(() => createRunStore(initialRun));
  const [uiStore] = useState<UiStoreApi>(() => createUiStore());

  return (
    <RunStoreContext.Provider value={runStore}>
      <UiStoreContext.Provider value={uiStore}>
        {children}
      </UiStoreContext.Provider>
    </RunStoreContext.Provider>
  );
}

export function useRunStore<T>(selector: (state: RunStore) => T): T {
  const store = useContext(RunStoreContext);

  if (store === null) {
    throw new Error(
      "useRunStore는 GameStoreProvider 안에서 호출해야 합니다.",
    );
  }

  return useStore(store, selector);
}

export function useUiStore<T>(selector: (state: UiStore) => T): T {
  const store = useContext(UiStoreContext);

  if (store === null) {
    throw new Error(
      "useUiStore는 GameStoreProvider 안에서 호출해야 합니다.",
    );
  }

  return useStore(store, selector);
}
```

`useState`의 lazy initializer로 각 Provider mount에 store를 한 번씩 만든다. `initialRun` prop이 이후 바뀌어도 같은 Provider 인스턴스의 store를 암묵적으로 교체하지 않는다.

- [ ] **Step 2: Client 경계와 타입을 검증한다**

```bash
pnpm typecheck
pnpm lint
pnpm test lib/stores/run-store.test.ts lib/stores/ui-store.test.ts
```

Expected: typecheck와 lint가 통과하고 Store 테스트 11개가 유지된다. `game-store-provider.tsx`만 `"use client"`를 가지며 `run-store.ts`와 `ui-store.ts`에는 Client 지시어가 없다.

- [ ] **Step 3: Task 3을 커밋한다**

```bash
git add lib/stores/game-store-provider.tsx
git commit -m "기능: 화면별 Store Provider 추가" -m "Run Store와 UI Store를 Provider mount마다 한 번 생성한다.
Client Component는 selector hook으로 필요한 상태만 구독하고 Provider 밖 호출은 명확한 오류로 거부한다."
```

---

### Task 4: 개발 전용 상태 미리보기

**Files:**
- Create: `app/state-preview/preview-run.ts`
- Create: `app/state-preview/state-preview-panel.tsx`
- Create: `app/state-preview/page.tsx`
- Test: TypeScript, ESLint, Next.js production build

**Interfaces:**
- Consumes: `RunState`와 브랜드 ID 타입, `GameStoreProvider`, `useRunStore`, `useUiStore`, Run/UI Store action, Next.js `notFound()`
- Produces: `createPreviewRun(seed: string): RunState`, 개발 전용 `/state-preview` UI

- [ ] **Step 1: 기술 검증용 RunState fixture를 작성한다**

`app/state-preview/preview-run.ts`를 만든다.

```ts
import type {
  ClassId,
  EventId,
  MemberId,
  NodeId,
  RunState,
} from "@/lib/domain";

export function createPreviewRun(seed: string): RunState {
  const entryNodeId = "preview-entry" as NodeId;
  const bossNodeId = "preview-boss" as NodeId;

  return {
    seed,
    phase: "partyIntro",
    party: [
      {
        id: "preview-member-aria" as MemberId,
        name: "아리아",
        classId: "preview-guardian" as ClassId,
        personality: "righteous",
        trust: 75,
        alive: true,
      },
      {
        id: "preview-member-borin" as MemberId,
        name: "보린",
        classId: "preview-scout" as ClassId,
        personality: "suspicious",
        trust: 52,
        alive: true,
      },
      {
        id: "preview-member-celine" as MemberId,
        name: "셀린",
        classId: "preview-scholar" as ClassId,
        personality: "prudent",
        trust: 34,
        alive: true,
      },
    ],
    dungeon: {
      nodes: [
        {
          id: entryNodeId,
          depth: 0,
          eventId: "preview-entry-event" as EventId,
          nextNodeIds: [bossNodeId],
        },
        {
          id: bossNodeId,
          depth: 1,
          eventId: "preview-boss-event" as EventId,
          nextNodeIds: [],
        },
      ],
      entryNodeId,
      bossNodeId,
    },
    currentNodeId: entryNodeId,
    resources: {
      gold: 42,
      food: 7,
      reputation: 3,
    },
    pendingClaims: [],
    log: [],
  };
}
```

- [ ] **Step 2: 상태 표시와 action panel을 작성한다**

`app/state-preview/state-preview-panel.tsx`를 만든다.

```tsx
"use client";

import { createPreviewRun } from "@/app/state-preview/preview-run";
import {
  useRunStore,
  useUiStore,
} from "@/lib/stores/game-store-provider";

export function StatePreviewPanel() {
  const run = useRunStore((state) => state.run);
  const startNewRun = useRunStore((state) => state.startNewRun);
  const resetRun = useRunStore((state) => state.resetRun);
  const selectedMemberId = useUiStore((state) => state.selectedMemberId);
  const selectMember = useUiStore((state) => state.selectMember);
  const clearSelectedMember = useUiStore(
    (state) => state.clearSelectedMember,
  );
  const resetUi = useUiStore((state) => state.resetUi);

  const selectedMember = run.party.find(
    (member) => member.id === selectedMemberId,
  );

  function handleNewPreviewRun() {
    startNewRun(createPreviewRun);
    resetUi();
  }

  function handleResetAll() {
    resetRun();
    resetUi();
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-8 p-6 sm:p-10">
      <header className="space-y-3">
        <p className="font-mono text-sm uppercase tracking-widest">
          Development only
        </p>
        <h1 className="text-3xl font-bold">F2 상태 스토어 개발 미리보기</h1>
        <p className="rounded border border-amber-500 p-4">
          표시 값은 기술 검증용 예시이며 공식 기본값이 아닙니다.
        </p>
      </header>

      <section aria-labelledby="run-state-heading" className="space-y-4">
        <h2 id="run-state-heading" className="text-2xl font-semibold">
          Run Store
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="font-semibold">seed</dt>
            <dd className="break-all font-mono">{run.seed}</dd>
          </div>
          <div>
            <dt className="font-semibold">phase</dt>
            <dd>{run.phase}</dd>
          </div>
          <div>
            <dt className="font-semibold">현재 노드</dt>
            <dd>{run.currentNodeId}</dd>
          </div>
          <div>
            <dt className="font-semibold">노드 수</dt>
            <dd>{run.dungeon.nodes.length}</dd>
          </div>
          <div>
            <dt className="font-semibold">파티원 수</dt>
            <dd>{run.party.length}</dd>
          </div>
          <div>
            <dt className="font-semibold">pending claim 수</dt>
            <dd>{run.pendingClaims.length}</dd>
          </div>
          <div>
            <dt className="font-semibold">log 수</dt>
            <dd>{run.log.length}</dd>
          </div>
          <div>
            <dt className="font-semibold">gold</dt>
            <dd>{run.resources.gold}</dd>
          </div>
          <div>
            <dt className="font-semibold">food</dt>
            <dd>{run.resources.food}</dd>
          </div>
          <div>
            <dt className="font-semibold">reputation</dt>
            <dd>{run.resources.reputation}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="party-heading" className="space-y-4">
        <h2 id="party-heading" className="text-2xl font-semibold">
          파티원별 상태
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {run.party.map((member) => (
            <li key={member.id} className="rounded border p-4">
              <h3 className="text-xl font-semibold">{member.name}</h3>
              <dl className="mt-3 space-y-1">
                <div>
                  <dt className="inline font-semibold">class ID: </dt>
                  <dd className="inline">{member.classId}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold">personality: </dt>
                  <dd className="inline">{member.personality}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold">개인 trust: </dt>
                  <dd className="inline">{member.trust}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold">alive: </dt>
                  <dd className="inline">{String(member.alive)}</dd>
                </div>
              </dl>
              <button
                type="button"
                aria-pressed={selectedMemberId === member.id}
                className="mt-4 rounded border px-3 py-2"
                onClick={() => selectMember(member.id)}
              >
                이 파티원 선택
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ui-state-heading" className="space-y-4">
        <h2 id="ui-state-heading" className="text-2xl font-semibold">
          UI Store
        </h2>
        <p>
          선택된 파티원:{" "}
          {selectedMember
            ? selectedMember.name + " (" + selectedMember.id + ")"
            : "없음"}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded border px-3 py-2"
            onClick={clearSelectedMember}
          >
            선택 해제
          </button>
          <button
            type="button"
            className="rounded border px-3 py-2"
            onClick={handleNewPreviewRun}
          >
            새 미리보기 런
          </button>
          <button
            type="button"
            className="rounded border px-3 py-2"
            onClick={handleResetAll}
          >
            모두 초기화
          </button>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: 개발 전용 page를 작성한다**

`app/state-preview/page.tsx`를 만든다.

```tsx
import { notFound } from "next/navigation";
import { createPreviewRun } from "@/app/state-preview/preview-run";
import { StatePreviewPanel } from "@/app/state-preview/state-preview-panel";
import { GameStoreProvider } from "@/lib/stores/game-store-provider";

export default function StatePreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <GameStoreProvider initialRun={createPreviewRun("f2-preview-initial")}>
      <StatePreviewPanel />
    </GameStoreProvider>
  );
}
```

page에는 `"use client"`를 넣지 않는다. production 조건과 `notFound()` 호출은 JSX 반환 전 render path에 둔다.

- [ ] **Step 4: 정적 검사와 production build를 실행한다**

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Expected:

- typecheck와 lint 통과
- 현재 기준 테스트 파일 4개, 테스트 39개 통과
- Next.js production build 성공
- `app/page.tsx` 변경 없음

- [ ] **Step 5: Task 4를 커밋한다**

```bash
git add app/state-preview/preview-run.ts app/state-preview/state-preview-panel.tsx app/state-preview/page.tsx
git commit -m "기능: F2 상태 미리보기 추가" -m "개발 환경에서 Run Store와 UI Store의 초기 상태와 action을 확인하는 임시 라우트를 추가한다.
기술 예시 값은 공식 게임 규칙과 분리하고 production에서는 notFound로 접근을 막는다.
기존 홈 화면과 F5 소유 파일은 수정하지 않는다."
```

---

### Task 5: 브라우저·production 검증과 F2 완료 기록

**Files:**
- Modify: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`
- Verify unchanged: `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `lib/domain/*`, `lib/rng/*`

**Interfaces:**
- Consumes: Task 1~4 전체 결과
- Produces: 검증된 F2 완료 상태와 `P1`의 갱신된 남은 선행 목록

- [ ] **Step 1: 개발 서버에서 전체 화면 흐름을 검증한다**

한 터미널에서 실행한다.

```bash
pnpm dev
```

서버가 준비되면 `vercel:agent-browser-verify`와 `vercel:agent-browser`를 사용하거나 실제 브라우저로 다음을 확인한다.

1. `http://localhost:3000/`이 기존 화면과 동일하게 열린다.
2. `http://localhost:3000/state-preview`에 개발 전용 안내, seed `f2-preview-initial`, phase `partyIntro`, 현재 노드 `preview-entry`, 노드 2개, 파티원 3명, 자원 `42/7/3`, pending claim 0개, log 0개가 표시된다.
3. 세 파티원은 서로 다른 personality와 개인 trust `75`, `52`, `34`를 표시한다. 평균·합계 신뢰는 없다.
4. 각 선택 버튼을 누르면 UI Store의 선택된 파티원만 바뀐다.
5. 선택 해제를 누르면 선택이 “없음”으로 돌아간다.
6. 새 미리보기 런을 누르면 seed가 `f2-preview-initial`이 아닌 새 UUID로 바뀌고 선택이 초기화된다.
7. 모두 초기화를 누르면 seed가 `f2-preview-initial`로 돌아가고 선택도 초기화된다.
8. 브라우저 console error와 hydration error가 없다.

Expected: 위 여덟 항목 모두 통과한다. 확인 뒤 개발 서버를 종료한다.

- [ ] **Step 2: production에서 preview가 실제 404인지 검증한다**

```bash
pnpm build
pnpm start
```

다른 터미널에서 실행한다.

```bash
curl --silent --output /dev/null --write-out "%{http_code}\n" http://localhost:3000/
curl --silent --output /dev/null --write-out "%{http_code}\n" http://localhost:3000/state-preview
```

Expected: 홈은 `200`, `/state-preview`는 `404`다. 확인 뒤 production 서버를 종료한다.

- [ ] **Step 3: F5 충돌 금지 범위를 확인한다**

```bash
git diff main...HEAD -- app/page.tsx app/layout.tsx app/globals.css lib/domain lib/rng
```

Expected: 출력이 없다. 출력이 있으면 F2 범위 밖 변경이므로 커밋하지 말고 원인을 조사한다.

- [ ] **Step 4: 배정표에 F2 완료를 기록한다**

`docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`에서 F2 행을 다음 값으로 바꾼다.

```markdown
| F2 | 상태 스토어 골격 | Zustand 설치, 런 상태와 UI 상태 스토어 분리, 초기 상태가 화면에 표시됨 | — | **P1** | SangHwan Yoo | ✅ |
```

P1 행의 남은 선행만 다음처럼 바꾼다.

```markdown
| P1 | 게임 상태 머신 | 파티 등장 → 경로 선택 → 이벤트 → 다음 노드 → 보스전 진입 전이가 테스트 통과하고 잘못된 전이는 거부됨 | R1 R4 | **P2 U3 U5** | | ⬜ |
```

의존성 그래프의 `F2 --> P1`과 F2의 `풀리는 것`은 전체 구조이므로 유지한다.

- [ ] **Step 5: 완료 전 전체 검증을 새로 실행한다**

먼저 `superpowers:verification-before-completion`을 사용한다.

```bash
pnpm list zustand --depth 0
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check
git status --short
```

Expected:

- `zustand 5.0.14`
- lint, typecheck, test, build 모두 종료 코드 0
- 현재 기준 테스트 파일 4개, 테스트 39개 통과
- `git diff --check` 출력 없음
- `git status --short`에는 배정표 한 파일만 수정 상태로 남음

- [ ] **Step 6: 배정표 갱신을 커밋한다**

```bash
git add docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md
git commit -m "문서: F2 상태 스토어 완료 기록" -m "F2 담당자와 완료 상태를 배정표에 반영한다.
P1의 완료된 선행 F2를 제거하고 남은 R1과 R4만 유지한다."
```

- [ ] **Step 7: 코드 리뷰와 최종 상태를 확인한다**

`superpowers:requesting-code-review`을 사용해 승인된 spec과 전체 diff를 대조한다. 지적 사항이 있으면 `superpowers:receiving-code-review` 절차로 검증한 뒤 수정하고 관련 검증을 다시 실행한다.

마지막으로 확인한다.

```bash
git status --short
git log --oneline --decorate -6
git diff main...HEAD --stat
```

Expected: worktree가 깨끗하고 `feature/state-store`에 설계, plan, Run Store, UI Store, Provider, preview, 완료 기록 커밋이 순서대로 존재한다.
