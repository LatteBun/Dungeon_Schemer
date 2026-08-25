# 메인 메뉴·브라우저 업적 기록 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 루트에서 캠페인과 업적 기록으로 이동하고, 엔딩에 도달한 캠페인의 결과형·누적형 업적 8개를 브라우저에 정확히 한 번 저장한다.

**Architecture:** 캠페인 Zustand Store는 계속 한 판의 메모리 상태만 소유한다. 순수 업적 reducer가 완료 캠페인 요약을 `PlayerProgressV1`에 누적하고, 별도 저장 어댑터와 전역 Client Provider가 `localStorage` 수명만 담당한다. 메인 메뉴와 업적 화면은 Provider의 view를 소비하며 캠페인 규칙을 다시 계산하지 않는다.

**Tech Stack:** Next.js 16.3 App Router, React 19.2, TypeScript 5.9, Zustand 5 vanilla store, Vitest 4.1, CSS 고정 캔버스, 정적 PNG, `localStorage`

**Spec:** `docs/superpowers/specs/2026-08-24-sbh3821-main-menu-achievements-design.md`

## Global Constraints

- Node.js 기준은 `24.19.0`, pnpm 기준은 `11.21.0`이다.
- 화면은 1920×1080 고정 캔버스 전체를 점유하고 `vw`·`vh`·미디어 쿼리를 추가하지 않는다.
- 캠페인 Zustand Store에 `persist`를 붙이거나 `CampaignState`·`CampaignTransitionContext`를 브라우저에 저장하지 않는다.
- 저장 키는 `dungeon-schemer.player-progress.v1`, payload 버전은 숫자 리터럴 `1`이다.
- 업적은 승인된 8개만 구현하고 게임 규칙 보상이나 캠페인 도중 팝업을 추가하지 않는다.
- 업적 집계는 `CampaignState.phase === "ended"`이고 `ending !== null`인 캠페인만 받는다.
- 같은 실행 UUID는 정확히 한 번만 집계하고 같은 seed를 새로 플레이한 실행은 별개로 센다.
- 컴포넌트는 완료 결과를 표시·전달할 뿐 업적 수치나 캠페인 결과를 임의 생성하지 않는다.
- 크기는 `rem`·`cqw`·`cqh`로 쓰고 큰 그림자 번짐에 `px`를 사용하지 않는다.
- 네 개의 신규 문양은 imagegen skill로 기존 U6 문양의 금속·양피지 질감과 정면 문장 구도를 계승한 래스터 PNG로 만든다.
- 커밋 제목과 본문은 한글로 작성한다.

## 파일 구조

| 파일 | 책임 |
| --- | --- |
| `lib/achievements/player-progress.ts` | 프로필 타입, 업적 카탈로그, 순수 누적·해금·진행도 |
| `lib/achievements/player-progress-storage.ts` | V1 검증, `localStorage` 읽기·쓰기·백업·초기화 |
| `lib/achievements/completed-campaign.ts` | 종료 `CampaignState`를 최소 완료 기록으로 변환 |
| `lib/store/player-progress-store.ts` | 저장 어댑터와 React 사이의 vanilla Zustand 상태·액션 |
| `components/game/PlayerProgressProvider.tsx` | 전역 Store 인스턴스와 React selector hook |
| `components/game/CampaignCompletionRecorder.tsx` | 캠페인 실행 UUID와 엔딩 기록 effect |
| `components/game/MainMenuScreen.tsx` | 메인 메뉴의 순수 화면과 Provider 연결 |
| `components/game/AchievementScreen.tsx` | 업적 카드·진행률·초기화 dialog와 Provider 연결 |
| `app/page.tsx`, `app/achievements/page.tsx` | 두 공개 라우트 진입점 |
| `app/main-menu.css`, `app/achievements.css` | 전체 캔버스 배치와 다크 판타지 표현 |
| `public/assets/achievements/*.png` | 신규 업적 문양 4종 |

---

### Task 1: 순수 업적 프로필과 카탈로그

**Files:**
- Create: `lib/achievements/player-progress.ts`
- Create: `lib/achievements/player-progress.test.ts`

**Interfaces:**
- Consumes: `EndingKind`, `GuideRank`, `ENDING_ORDER` from `@/lib/domain`
- Produces: `AchievementId`, `AchievementDefinition`, `AchievementProgress`, `CompletedCampaignRecord`, `PlayerProgressV1`, `ACHIEVEMENT_CATALOG`, `createEmptyPlayerProgress()`, `recordCompletedCampaign()`, `achievementProgressFor()`, `unlockedAchievementCount()`

- [ ] **Step 1: 빈 프로필·불변 누적·중복 방지 실패 테스트 작성**

```ts
import { describe, expect, it } from "vitest";
import {
  createEmptyPlayerProgress,
  recordCompletedCampaign,
} from "./player-progress";
import type { CompletedCampaignRecord } from "./player-progress";

const completed: CompletedCampaignRecord = {
  runId: "run-1",
  ending: "completed",
  finalRank: "A",
  totalExpeditions: 18,
  clearedExpeditions: 15,
  wipedExpeditions: 3,
  deaths: 4,
  advices: 72,
};

describe("플레이어 업적 프로필", () => {
  it("V1 빈 프로필을 만든다", () => {
    expect(createEmptyPlayerProgress()).toEqual({
      version: 1,
      totals: {
        completedCampaigns: 0,
        expeditions: 0,
        clearedExpeditions: 0,
        wipedExpeditions: 0,
        deaths: 0,
        advices: 0,
      },
      endingCounts: {
        distrust: 0,
        denounced: 0,
        completed: 0,
        exhausted: 0,
        unemployed: 0,
      },
      unlocked: {},
      recordedRunIds: [],
    });
  });

  it("완료 결과를 불변 누적하고 같은 runId는 다시 세지 않는다", () => {
    const before = createEmptyPlayerProgress();
    const once = recordCompletedCampaign(before, completed, "2026-08-24T10:00:00.000Z");
    const twice = recordCompletedCampaign(once, completed, "2026-08-25T10:00:00.000Z");

    expect(once).not.toBe(before);
    expect(before.totals.completedCampaigns).toBe(0);
    expect(once.totals).toMatchObject({ completedCampaigns: 1, expeditions: 18, advices: 72 });
    expect(twice).toBe(once);
  });
});
```

- [ ] **Step 2: 테스트를 실행해 계약 부재로 실패 확인**

Run: `pnpm test -- lib/achievements/player-progress.test.ts`

Expected: FAIL with module `./player-progress` not found.

- [ ] **Step 3: 타입과 빈 프로필, 안전 정수 검증, 순수 누적 최소 구현**

```ts
import { ENDING_ORDER } from "@/lib/domain";
import type { EndingKind, GuideRank } from "@/lib/domain";

export const PLAYER_PROGRESS_VERSION = 1 as const;

export type AchievementId =
  | "first-record"
  | "dungeon-conqueror"
  | "s-rank-guide"
  | "everyone-returned"
  | "five-endings"
  | "hundred-advices"
  | "seasoned-expedition"
  | "death-in-the-plan";

export interface CompletedCampaignRecord {
  readonly runId: string;
  readonly ending: EndingKind;
  readonly finalRank: GuideRank;
  readonly totalExpeditions: number;
  readonly clearedExpeditions: number;
  readonly wipedExpeditions: number;
  readonly deaths: number;
  readonly advices: number;
}

export interface PlayerProgressV1 {
  readonly version: 1;
  readonly totals: {
    readonly completedCampaigns: number;
    readonly expeditions: number;
    readonly clearedExpeditions: number;
    readonly wipedExpeditions: number;
    readonly deaths: number;
    readonly advices: number;
  };
  readonly endingCounts: Readonly<Record<EndingKind, number>>;
  readonly unlocked: Readonly<Partial<Record<AchievementId, { readonly unlockedAt: string }>>>;
  readonly recordedRunIds: readonly string[];
}

export interface AchievementProgress {
  readonly current: number;
  readonly target: number;
}

export interface AchievementDefinition {
  readonly id: AchievementId;
  readonly title: string;
  readonly description: string;
  readonly category: "result" | "cumulative";
  readonly hiddenWhenLocked: boolean;
  readonly imageSrc: string;
  isUnlocked(progress: PlayerProgressV1, latest: CompletedCampaignRecord): boolean;
  progress?(progress: PlayerProgressV1): AchievementProgress;
}

export function createEmptyPlayerProgress(): PlayerProgressV1 {
  return {
    version: PLAYER_PROGRESS_VERSION,
    totals: { completedCampaigns: 0, expeditions: 0, clearedExpeditions: 0, wipedExpeditions: 0, deaths: 0, advices: 0 },
    endingCounts: Object.fromEntries(ENDING_ORDER.map((kind) => [kind, 0])) as Record<EndingKind, number>,
    unlocked: {},
    recordedRunIds: [],
  };
}
```

`recordCompletedCampaign`은 빈 `runId`, 음수·소수·비안전 정수 입력을 `TypeError`로
거부한다. `recordedRunIds.includes(record.runId)`이면 입력 객체 자체를 반환하고,
그 외에는 모든 합계와 해당 `endingCounts`를 새 객체로 누적한다.

- [ ] **Step 4: 경계값과 8개 업적 실패 테스트 추가**

```ts
it("결과형 네 개를 마지막 완료 기록으로 판정한다", () => {
  const first = recordCompletedCampaign(createEmptyPlayerProgress(), completed, "2026-08-24T10:00:00.000Z");
  expect(Object.keys(first.unlocked)).toContain("first-record");
  expect(Object.keys(first.unlocked)).toContain("dungeon-conqueror");
  expect(Object.keys(first.unlocked)).not.toContain("s-rank-guide");
  expect(Object.keys(first.unlocked)).not.toContain("everyone-returned");

  const perfect = recordCompletedCampaign(first, {
    ...completed,
    runId: "run-2",
    finalRank: "S",
    deaths: 0,
  }, "2026-08-25T10:00:00.000Z");
  expect(perfect.unlocked["s-rank-guide"]?.unlockedAt).toBe("2026-08-25T10:00:00.000Z");
  expect(perfect.unlocked["everyone-returned"]?.unlockedAt).toBe("2026-08-25T10:00:00.000Z");
  expect(perfect.unlocked["first-record"]?.unlockedAt).toBe("2026-08-24T10:00:00.000Z");
});

it("엔딩 다섯 종류의 마지막 기록에서 숨은 업적을 연다", () => {
  const endings = ["distrust", "denounced", "completed", "exhausted", "unemployed"] as const;
  const result = endings.reduce(
    (progress, ending, index) => recordCompletedCampaign(progress, {
      ...completed,
      runId: `ending-${index}`,
      ending,
    }, `2026-08-${20 + index}T10:00:00.000Z`),
    createEmptyPlayerProgress(),
  );
  expect(result.unlocked["five-endings"]).toBeDefined();
});

it.each([
  ["hundred-advices", { advices: 100 }],
  ["seasoned-expedition", { clearedExpeditions: 30 }],
  ["death-in-the-plan", { wipedExpeditions: 10 }],
] as const)("%s는 문턱에서 열린다", (id, totals) => {
  const result = recordCompletedCampaign(createEmptyPlayerProgress(), {
    ...completed,
    runId: id,
    advices: 0,
    clearedExpeditions: 0,
    wipedExpeditions: 0,
    ...totals,
  }, "2026-08-24T10:00:00.000Z");
  expect(result.unlocked[id]).toBeDefined();
});
```

- [ ] **Step 5: 카탈로그와 해금·진행도 구현**

`ACHIEVEMENT_CATALOG`은 승인된 표 순서대로 정확히 8개를 담는다. 각 정의는 `id`,
`title`, `description`, `category: "result" | "cumulative"`, `hiddenWhenLocked`,
`imageSrc`, `isUnlocked(progress, record)`를 가진다. 누적 세 항목은 추가로
`progress(progress) => { current, target }`를 제공한다.

기존 자산 경로는 spec의 네 매핑을 그대로 쓰고 신규 네 경로는 다음으로 고정한다.

```ts
"/assets/achievements/achievement_s_rank.png"
"/assets/achievements/achievement_advice.png"
"/assets/achievements/achievement_expedition.png"
"/assets/achievements/achievement_wipe.png"
```

누적 뒤 `ACHIEVEMENT_CATALOG`을 순회해 아직 없는 ID만 `unlockedAt`으로 추가한다.
`achievementProgressFor`는 공개 누적형만 `{ current, target }`을 반환하고 잠긴
`five-endings`에는 `null`을 반환한다. `unlockedAchievementCount`는 카탈로그 ID 중
실제로 저장된 항목만 센다.

- [ ] **Step 6: 집중 테스트와 타입 검사**

Run: `pnpm test -- lib/achievements/player-progress.test.ts && pnpm typecheck`

Expected: PASS. 8개 카탈로그 ID가 고유하고 모든 해금 경계가 통과한다.

- [ ] **Step 7: 커밋**

```bash
git add lib/achievements/player-progress.ts lib/achievements/player-progress.test.ts
git commit -m "기능: 업적 프로필과 해금 규칙을 만든다" -m "엔딩 결과와 누적 통계를 불변으로 합산하고 승인된 업적 8개를 한 곳에서 판정한다."
```

---

### Task 2: 브라우저 저장 어댑터와 전역 Store

**Files:**
- Create: `lib/achievements/player-progress-storage.ts`
- Create: `lib/achievements/player-progress-storage.test.ts`
- Create: `lib/store/player-progress-store.ts`
- Create: `lib/store/player-progress-store.test.ts`
- Create: `components/game/PlayerProgressProvider.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: Task 1의 `PlayerProgressV1`, `CompletedCampaignRecord`, `createEmptyPlayerProgress`, `recordCompletedCampaign`
- Produces: `PLAYER_PROGRESS_STORAGE_KEY`, `PLAYER_PROGRESS_BACKUP_KEY`, `StringStorage`, `ProgressLoadResult`, `loadPlayerProgress()`, `savePlayerProgress()`, `clearPlayerProgress()`, `createPlayerProgressStore()`, `usePlayerProgressStore()`

- [ ] **Step 1: 저장값 검증과 손상·미래 버전 실패 테스트 작성**

```ts
import { describe, expect, it } from "vitest";
import { createEmptyPlayerProgress } from "./player-progress";
import { loadPlayerProgress, savePlayerProgress } from "./player-progress-storage";

function memoryStorage(initial?: Record<string, string>) {
  const values = new Map(Object.entries(initial ?? {}));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    value: (key: string) => values.get(key),
  };
}

it("값이 없으면 빈 프로필이다", () => {
  expect(loadPlayerProgress(memoryStorage())).toMatchObject({ status: "empty", progress: createEmptyPlayerProgress() });
});

it("손상된 V1은 원문과 빈 프로필을 함께 돌려준다", () => {
  const storage = memoryStorage({ "dungeon-schemer.player-progress.v1": "{broken" });
  expect(loadPlayerProgress(storage)).toMatchObject({ status: "recovered", corruptRaw: "{broken" });
});

it("미래 버전을 덮어쓸 수 있는 값으로 해석하지 않는다", () => {
  const storage = memoryStorage({ "dungeon-schemer.player-progress.v1": JSON.stringify({ version: 2 }) });
  expect(loadPlayerProgress(storage).status).toBe("unavailable");
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test -- lib/achievements/player-progress-storage.test.ts`

Expected: FAIL with module not found.

- [ ] **Step 3: 명시적 구조 검증과 저장 함수 구현**

```ts
export const PLAYER_PROGRESS_STORAGE_KEY = "dungeon-schemer.player-progress.v1";
export const PLAYER_PROGRESS_BACKUP_KEY = "dungeon-schemer.player-progress.corrupt-backup";

export interface StringStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type ProgressLoadResult =
  | { readonly status: "ready" | "empty"; readonly progress: PlayerProgressV1 }
  | { readonly status: "recovered"; readonly progress: PlayerProgressV1; readonly corruptRaw: string }
  | { readonly status: "unavailable"; readonly progress: PlayerProgressV1; readonly reason: string };
```

`isPlayerProgressV1`은 다음을 전부 확인한다.

- 정확한 `version: 1`
- 여섯 totals와 다섯 ending count가 0 이상의 안전한 정수
- 여분/누락 없이 허용된 achievement ID만 존재
- `unlockedAt`이 유효한 ISO 문자열이고 다시 `toISOString()` 했을 때 같은 값
- `recordedRunIds`가 비어 있지 않은 고유 문자열 배열

`savePlayerProgress(storage, progress, corruptRaw?)`은 `corruptRaw`가 있고 백업 키가
비어 있을 때만 백업을 먼저 시도한다. 백업 실패는 무시하되 기본 키 쓰기 실패는
`{ ok: false, reason }`으로 반환한다. `clearPlayerProgress`는 두 고정 키만 지운다.

- [ ] **Step 4: 어댑터 경계 테스트 보강 후 통과 확인**

중복 run ID, 음수·소수 카운터, 잘못된 ending 키, 알 수 없는 업적 ID, 잘못된 ISO,
`getItem`/`setItem`/`removeItem` 예외를 각각 직접 만든 storage double로 검증한다.

Run: `pnpm test -- lib/achievements/player-progress-storage.test.ts`

Expected: PASS.

- [ ] **Step 5: vanilla Store 실패 테스트 작성**

```ts
it("hydrate 뒤 완료 캠페인을 저장하고 상태를 갱신한다", () => {
  const storage = memoryStorage();
  const store = createPlayerProgressStore();
  store.getState().hydrate(storage);
  store.getState().record({ ...completed, runId: "stored" }, "2026-08-24T10:00:00.000Z");

  expect(store.getState().status).toBe("ready");
  expect(store.getState().progress.totals.completedCampaigns).toBe(1);
  expect(storage.value(PLAYER_PROGRESS_STORAGE_KEY)).toContain('"recordedRunIds":["stored"]');
});

it("쓰기 실패 뒤에도 메모리 업적은 남는다", () => {
  const store = createPlayerProgressStore();
  store.getState().hydrate(throwingWriteStorage);
  store.getState().record(completed, "2026-08-24T10:00:00.000Z");

  expect(store.getState().status).toBe("unavailable");
  expect(store.getState().progress.totals.completedCampaigns).toBe(1);
});
```

- [ ] **Step 6: Store와 Provider 구현**

```ts
export interface PlayerProgressStoreState {
  readonly progress: PlayerProgressV1;
  readonly status: "loading" | "ready" | "recovered" | "unavailable";
  readonly message: string | null;
  hydrate(storage: StringStorage): void;
  record(record: CompletedCampaignRecord, unlockedAt: string): void;
  clear(): void;
}
```

Store factory는 모듈 singleton이 아니라 `createStore`로 매번 만든다. `hydrate`가
받은 storage만 closure에 보관하고, 미래 버전이나 storage 예외 상태에서는 `record`
후 메모리 상태만 갱신한다. `clear`는 저장 가능하면 두 키를 지우고 항상 빈 메모리
프로필로 돌아간다.

`PlayerProgressProvider`는 `useState(() => createPlayerProgressStore())`로 Store를 한
번 만들고 mount effect에서 `store.getState().hydrate(window.localStorage)`를 호출한다.
`usePlayerProgressStore(selector)`는 Context 밖에서 사용하면 명시적 오류를 던진다.

`app/layout.tsx`는 다음 경계를 만든다.

```tsx
<div className="game-canvas">
  <PlayerProgressProvider>{children}</PlayerProgressProvider>
</div>
```

- [ ] **Step 7: Store·레이아웃 집중 검증**

Run: `pnpm test -- lib/store/player-progress-store.test.ts components/game/FixedCanvas.test.ts && pnpm typecheck`

Expected: PASS. Provider는 DOM wrapper를 추가하지 않아 화면 루트의 전체 점유 계약을
깨뜨리지 않는다.

- [ ] **Step 8: 커밋**

```bash
git add lib/achievements/player-progress-storage.ts lib/achievements/player-progress-storage.test.ts lib/store/player-progress-store.ts lib/store/player-progress-store.test.ts components/game/PlayerProgressProvider.tsx app/layout.tsx
git commit -m "기능: 업적 기록을 브라우저에 보관한다" -m "버전 검증과 손상 복구를 거친 별도 프로필 Store를 전역 Provider에 연결한다."
```

---

### Task 3: 캠페인 엔딩을 정확히 한 번 기록

**Files:**
- Create: `lib/achievements/completed-campaign.ts`
- Create: `lib/achievements/completed-campaign.test.ts`
- Create: `components/game/CampaignCompletionRecorder.tsx`
- Modify: `components/game/CampaignScreen.tsx`

**Interfaces:**
- Consumes: `CampaignState`, Task 1의 `CompletedCampaignRecord`, Task 2의 `usePlayerProgressStore`
- Produces: `completedCampaignRecordFor(campaign, runId)`, `createCampaignRunId()`, `CampaignCompletionRecorder`

- [ ] **Step 1: 종료 전 거부와 종료 요약 실패 테스트 작성**

```ts
import { describe, expect, it } from "vitest";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { completedCampaignRecordFor } from "./completed-campaign";
import type { CampaignState } from "@/lib/domain";

it("끝나지 않은 캠페인은 기록으로 만들지 않는다", () => {
  expect(completedCampaignRecordFor(initializeCampaign("open"), "run-open")).toBeNull();
});

it("규칙 통계와 ADVICE_RESOLVED 수만 옮긴다", () => {
  const base = initializeCampaign("ended");
  const campaign = {
    ...base,
    phase: "ended",
    ending: { kind: "completed", title: "원정 종료", reason: "완주", finalRank: "S", triggerCharacterIds: [] },
    statistics: { ...base.statistics, totalExpeditions: 17, clearedExpeditions: 15, wipedExpeditions: 2, totalDeaths: 3 },
    history: { ...base.history, events: [adviceEvent, bossEvent, adviceEvent2] },
  } as CampaignState;

  expect(completedCampaignRecordFor(campaign, "run-ended")).toEqual({
    runId: "run-ended",
    ending: "completed",
    finalRank: "S",
    totalExpeditions: 17,
    clearedExpeditions: 15,
    wipedExpeditions: 2,
    deaths: 3,
    advices: 2,
  });
});
```

테스트의 `adviceEvent`와 `bossEvent`는 `CampaignEvent` 타입을 만족하는 최소 branded
fixture로 선언한다. adapter가 이력 무결성을 다시 검증하지 않고 확정 타입만 읽는
경계를 유지한다.

- [ ] **Step 2: 실패 확인**

Run: `pnpm test -- lib/achievements/completed-campaign.test.ts`

Expected: FAIL with module not found.

- [ ] **Step 3: 완료 기록 어댑터 구현**

```ts
export function completedCampaignRecordFor(
  campaign: CampaignState,
  runId: string,
): CompletedCampaignRecord | null {
  if (campaign.phase !== "ended" || campaign.ending === null) return null;
  return {
    runId,
    ending: campaign.ending.kind,
    finalRank: campaign.ending.finalRank,
    totalExpeditions: campaign.statistics.totalExpeditions,
    clearedExpeditions: campaign.statistics.clearedExpeditions,
    wipedExpeditions: campaign.statistics.wipedExpeditions,
    deaths: campaign.statistics.totalDeaths,
    advices: campaign.history.events.filter((event) => event.type === "ADVICE_RESOLVED").length,
  };
}

export function createCampaignRunId(randomUUID: () => string = () => crypto.randomUUID()): string {
  const id = randomUUID();
  if (id.length === 0) throw new TypeError("캠페인 실행 ID가 비어 있다");
  return id;
}
```

- [ ] **Step 4: Recorder를 구현하고 CampaignScreen 최상단에 연결**

```tsx
"use client";

export function CampaignCompletionRecorder({ campaign }: { readonly campaign: CampaignState }) {
  const [runId] = useState(createCampaignRunId);
  const record = usePlayerProgressStore((state) => state.record);

  useEffect(() => {
    const completed = completedCampaignRecordFor(campaign, runId);
    if (completed !== null) record(completed, new Date().toISOString());
  }, [campaign, record, runId]);

  return null;
}
```

`CampaignScreen`은 이미 읽는 `campaign` selector를 최상위로 올리고 Fragment의 첫
자식으로 `<CampaignCompletionRecorder campaign={campaign} />`를 둔다. `CurrentScreen`
내부 selector와 렌더 책임은 유지한다. effect가 두 번 호출돼도 Task 1 원장이 막는다.

- [ ] **Step 5: 집중 검증과 커밋**

Run: `pnpm test -- lib/achievements/completed-campaign.test.ts lib/achievements/player-progress.test.ts && pnpm typecheck`

Expected: PASS.

```bash
git add lib/achievements/completed-campaign.ts lib/achievements/completed-campaign.test.ts components/game/CampaignCompletionRecorder.tsx components/game/CampaignScreen.tsx
git commit -m "기능: 캠페인 엔딩을 업적 기록에 연결한다" -m "규칙이 확정한 최종 통계만 요약하고 실행 UUID로 중복 기록을 차단한다."
```

---

### Task 4: 전체 캔버스 메인 메뉴

**Files:**
- Create: `components/game/MainMenuScreen.tsx`
- Create: `components/game/MainMenuScreen.test.tsx`
- Create: `app/main-menu.css`
- Create: `app/page.test.ts`
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: Task 1의 `unlockedAchievementCount`, Task 2의 `usePlayerProgressStore`, Next.js `Link`
- Produces: `MainMenuScreen`, 실제 `/` → `/campaign`·`/achievements` 내비게이션

- [ ] **Step 1: 순수 화면의 링크·로딩 자리 실패 테스트 작성**

```tsx
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MainMenuScreen } from "./MainMenuScreen";

it("캠페인과 업적 기록으로 가는 실제 링크를 제공한다", () => {
  const html = renderToStaticMarkup(createElement(MainMenuScreen, { unlockedCount: 3, loading: false }));
  expect(html).toContain('href="/campaign"');
  expect(html).toContain("캠페인 시작");
  expect(html).toContain('href="/achievements"');
  expect(html).toContain("달성 3 / 8");
  expect(html).not.toMatch(/<button[^>]*>.*<a/s);
});

it("저장값을 읽기 전에도 같은 요약 자리를 둔다", () => {
  const html = renderToStaticMarkup(createElement(MainMenuScreen, { unlockedCount: 0, loading: true }));
  expect(html).toContain("달성 — / 8");
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test -- components/game/MainMenuScreen.test.tsx`

Expected: FAIL with module not found.

- [ ] **Step 3: 순수 화면과 Provider 연결 wrapper 구현**

```tsx
export function MainMenuScreen({ unlockedCount, loading }: MainMenuScreenProps) {
  return (
    <main className="main-menu-screen">
      <div className="main-menu-screen__shade" aria-hidden="true" />
      <header className="main-menu-screen__title">
        <p>길드가 기억하지 않는 길을 기록하라</p>
        <h1>Dungeon Schemer</h1>
      </header>
      <nav className="main-menu-screen__actions" aria-label="메인 메뉴">
        <Link className="main-menu-screen__start" href="/campaign">캠페인 시작</Link>
        <Link className="main-menu-screen__achievements" href="/achievements">
          <span>업적 기록</span>
          <small>{loading ? "달성 — / 8" : `달성 ${unlockedCount} / 8`}</small>
        </Link>
      </nav>
    </main>
  );
}
```

동일 파일의 client wrapper `MainMenu`는 Provider의 `status`와 `progress`만 읽어
`MainMenuScreen`에 넘긴다. `app/page.tsx`는 자리 표시자와 `Panel`을 제거하고
`<MainMenu />`만 반환한다.

- [ ] **Step 4: 1920×1080 배경·표제·CTA CSS 구현**

`app/main-menu.css`는 U2 배경을 `background-image`로 재사용하고, 암색 vignette와
금빛 주요 CTA·금속 보조 CTA를 중앙 정렬한다. `width: 100%`, `height: 100%`,
`overflow: hidden`을 사용하고 모든 치수는 `rem` 또는 `cqw`·`cqh`다. `:hover`와
`:focus-visible`은 같은 시각 강조를 제공하며 `outline`을 제거하지 않는다.

`app/layout.tsx`에서 `./main-menu.css`를 한 번 import한다.

- [ ] **Step 5: route와 고정 캔버스 검증**

`app/page.test.ts`는 실제 `RootLayout`에 `Home()` 결과를 children으로 넣어
`renderToStaticMarkup`한다. 최종 HTML에 `/campaign`, `/achievements` 링크와
`달성 — / 8` 로딩 자리가 있고 옛 자리 표시자 문구가 없음을 확인한다. 소스 파일
문자열을 읽는 change detector를 만들지 않는다. `FixedCanvas.test.ts`는 새 CSS의
`vw`·`vh`·미디어 쿼리를 자동 검사하므로 별도 허용 목록을 추가하지 않는다.

Run: `pnpm test -- components/game/MainMenuScreen.test.tsx app/page.test.ts components/game/FixedCanvas.test.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add components/game/MainMenuScreen.tsx components/game/MainMenuScreen.test.tsx app/page.tsx app/page.test.ts app/main-menu.css app/layout.tsx
git commit -m "기능: 루트에 게임 메인 메뉴를 연다" -m "전체 캔버스에서 캠페인 시작과 업적 기록의 두 진입점을 제공한다."
```

---

### Task 5: 업적 기록 화면과 문양

**Files:**
- Create: `components/game/AchievementScreen.tsx`
- Create: `components/game/AchievementScreen.test.tsx`
- Create: `components/game/AchievementAssets.test.ts`
- Create: `app/achievements/page.tsx`
- Create: `app/achievements/page.test.ts`
- Create: `app/achievements.css`
- Create: `public/assets/achievements/achievement_s_rank.png`
- Create: `public/assets/achievements/achievement_advice.png`
- Create: `public/assets/achievements/achievement_expedition.png`
- Create: `public/assets/achievements/achievement_wipe.png`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: Task 1의 `ACHIEVEMENT_CATALOG`, `achievementProgressFor`, Task 2의 Provider status·clear 액션
- Produces: `AchievementCardView`, `achievementCardViewsFor()`, `AchievementScreen`, `/achievements`

- [ ] **Step 1: 잠금·해금·숨김·진행률 view 실패 테스트 작성**

```tsx
it("잠금과 해금을 색 이외의 문구로 구분한다", () => {
  const progress = recordCompletedCampaign(createEmptyPlayerProgress(), completed, "2026-08-24T10:00:00.000Z");
  const html = renderToStaticMarkup(createElement(AchievementScreen, {
    cards: achievementCardViewsFor(progress),
    unlockedCount: unlockedAchievementCount(progress),
    status: "ready",
    onClear: () => {},
  }));
  expect(html).toContain("달성 완료");
  expect(html).toContain("미달성");
  expect(html).toContain('href="/"');
  expect(html).toContain('dateTime="2026-08-24T10:00:00.000Z"');
});

it("숨은 업적은 잠긴 동안 이름과 진행도를 감춘다", () => {
  const html = renderEmptyGallery();
  expect(html).toContain("알 수 없는 기록");
  expect(html).not.toContain("다섯 갈래의 결말");
  expect(html).not.toContain("0 / 5");
});

it("공개 누적 업적은 접근 가능한 진행도를 제공한다", () => {
  const html = renderEmptyGallery();
  expect(html).toMatch(/role="progressbar"[^>]*aria-valuemax="100"[^>]*aria-valuenow="0"/);
  expect(html).toContain("0 / 100");
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test -- components/game/AchievementScreen.test.tsx`

Expected: FAIL with module not found.

- [ ] **Step 3: 카드 view와 순수 화면 구현**

`achievementCardViewsFor(progress)`는 카탈로그 순서를 지키고 다음 view만 만든다.

```ts
export interface AchievementCardView {
  readonly id: AchievementId;
  readonly title: string;
  readonly description: string;
  readonly categoryLabel: "결과 기록" | "누적 기록";
  readonly imageSrc: string;
  readonly unlocked: boolean;
  readonly unlockedAt: string | null;
  readonly progress: { readonly current: number; readonly target: number } | null;
}
```

잠긴 hidden 정의는 `title: "알 수 없는 기록"`, `description: "아직 드러나지 않은
길드 기록입니다."`, `progress: null`로 치환한다. 날짜는 `YYYY. MM. DD.` 형식의
결정적 UTC 포매터로 표시하고 원본 ISO는 `<time dateTime>`에 보존한다.

`AchievementScreen`은 8개 `<article>` 카드, 결과/누적 라벨, Next.js `Image`의 구체적인 alt,
잠금 텍스트, progressbar, status 안내, 메인 메뉴 `Link`, 초기화 버튼과 확인
`<dialog open={confirming}>`을 제공한다. 취소 버튼이 dialog에서 먼저 오며
`autoFocus`를 갖는다. Provider wrapper `Achievements`가 `clear`를 전달한다.

- [ ] **Step 4: 기존 문양·신규 문양 계약 테스트 작성**

```ts
const NEW_ASSETS = [
  "achievement_s_rank.png",
  "achievement_advice.png",
  "achievement_expedition.png",
  "achievement_wipe.png",
] as const;

it.each(NEW_ASSETS)("%s는 충분한 정사각 PNG다", (name) => {
  const path = join(process.cwd(), "public", "assets", "achievements", name);
  const content = readFileSync(path);
  expect(content.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const { width, height } = pngDimensions(path);
  expect(width).toBe(height);
  expect(width).toBeGreaterThanOrEqual(512);
});
```

테스트는 `ACHIEVEMENT_CATALOG`의 모든 `imageSrc`가 실제 파일로 해석되는지도
검증한다.

- [ ] **Step 5: imagegen으로 신규 래스터 문양 4종 생성**

imagegen skill을 읽고 기존 U6 네 문양을 시각 레퍼런스로 포함한다. 네 자산 모두
정사각 1024×1024, 정면 문장, 중앙 실루엣, 어두운 단조 금속, 낡은 양피지 바탕,
따뜻한 금빛 테두리, 낮은 채도, 텍스트 없음, 로고·플랫 벡터가 아닌 회화풍 게임
UI 문양으로 통일한다.

- `achievement_s_rank.png`: 월계와 별을 품은 위엄 있는 S급 길잡이 문장
- `achievement_advice.png`: 펼친 지도 위를 가로지르는 깃펜과 작은 봉인
- `achievement_expedition.png`: 여러 갈래 길과 누적된 원정 발자국이 모이는 문장
- `achievement_wipe.png`: 깨진 원정 방패와 꺼진 횃불, 과도한 유혈 표현 없음

생성 결과를 각각 `public/assets/achievements/`의 정확한 이름으로 저장하고
`view_image`로 네 파일의 스타일·방향·텍스트 부재를 확인한다. 필요하면 imagegen으로
수정하고, 셸 명령으로 이미지를 임의 변형하지 않는다.

- [ ] **Step 6: 업적 페이지와 CSS 구현**

`app/achievements/page.tsx`는 `<Achievements />`만 반환한다. `app/achievements.css`는
전체 캔버스 기록 보관소, 4열×2행 grid, 해금 양피지 카드, 잠긴 암색 금속 카드,
금색 구분선, 진행 막대, dialog를 구현한다. 카드 이미지에는 `object-fit: contain`을
사용하고 종횡비를 늘리지 않는다. CSS는 `rem`·`cqw`·`cqh`만 사용한다.

`app/layout.tsx`에서 `./achievements.css`를 import한다.

`app/achievements/page.test.ts`도 실제 `RootLayout`에 `AchievementPage()` 결과를
넣어 서버 렌더하고 `길잡이 업적 기록`, 메인 메뉴 `/` 링크, 8개의 `미달성` 카드와
세 개의 접근 가능한 progressbar가 초기 HTML에 있는지 검증한다.

- [ ] **Step 7: 화면·자산·고정 캔버스 검증**

Run: `pnpm test -- components/game/AchievementScreen.test.tsx components/game/AchievementAssets.test.ts app/achievements/page.test.ts components/game/FixedCanvas.test.ts && pnpm typecheck`

Expected: PASS. 8개 카드가 한 화면에 있고 신규 PNG 네 개가 512px 이상의 정사각이다.

- [ ] **Step 8: 커밋**

```bash
git add components/game/AchievementScreen.tsx components/game/AchievementScreen.test.tsx components/game/AchievementAssets.test.ts app/achievements/page.tsx app/achievements/page.test.ts app/achievements.css app/layout.tsx public/assets/achievements
git commit -m "기능: 길잡이 업적 기록 화면을 연다" -m "결과형과 누적형 업적 8개를 잠금·해금·진행 상태와 일관된 문양으로 보여준다."
```

---

### Task 6: 공식 문서 정합성과 전체 검증

**Files:**
- Modify: `docs/GAME_PRINCIPLES.md`
- Modify: `docs/systems/PROGRESSION_AND_ENDINGS.md`
- Modify: `docs/experience/SCREEN_LAYOUT.md`
- Modify: `docs/experience/ONBOARDING_AND_INTERFACE.md`
- Modify: `docs/technical/DEVELOPMENT_ENVIRONMENT.md`
- Modify: `docs/technical/SESSION_PERSISTENCE_REVIEW.md`
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`
- Modify: `docs/diagram/screens.md`
- Modify: `docs/diagram/README.md`
- Modify: `docs/README.md`
- Create: `docs/diagram/png/screen-main-menu.png`
- Create: `docs/diagram/png/screen-achievements.png`

**Interfaces:**
- Consumes: Tasks 1–5의 실제 동작과 화면
- Produces: 현재 구현과 일치하는 공식 범위, 검증 증거, 로컬 확인 URL

- [ ] **Step 1: 공식 문서의 현재 저장 경계를 증거로 확인**

Run:

```bash
rg -n "저장·복원|localStorage|화면 일곱 장|인트로부터" docs/GAME_PRINCIPLES.md docs/technical/DEVELOPMENT_ENVIRONMENT.md docs/technical/SESSION_PERSISTENCE_REVIEW.md docs/diagram/screens.md docs/diagram/README.md docs/README.md
```

Expected: `GAME_PRINCIPLES.md`와 `DEVELOPMENT_ENVIRONMENT.md`는 브라우저 영속화를
범위 밖으로 적고, `SESSION_PERSISTENCE_REVIEW.md`는 `localStorage` 0개, 화면 문서는
캠페인 화면 일곱 장만 설명한다. 이 단계는 낡은 문구를 고정하는 자동 테스트를
추가하지 않고 변경 전 증거만 남긴다.

- [ ] **Step 2: 공식 문서의 범위를 실제 구현에 맞게 갱신**

- `GAME_PRINCIPLES`: 기존 `저장·복원, 서버 연동, 로그인: 범위 밖`을 “캠페인
  이어하기·서버 연동·로그인은 범위 밖, 브라우저 업적 기록은 범위 안”으로 바꾼다.
- `PROGRESSION_AND_ENDINGS`: 엔딩 확정 뒤 프로필에 한 번 기록하며 업적은 게임 규칙
  보상이나 능력치를 주지 않는다고 적는다.
- `SCREEN_LAYOUT`: 메인 메뉴와 업적 화면을 `GameShell` 없는 전체 점유 화면으로,
  업적 화면을 4열×2행으로 기록한다.
- `ONBOARDING_AND_INTERFACE`: `/`에서 캠페인과 업적 기록으로 갈라지고 캠페인은
  기존 U2부터 시작한다고 적는다.
- `DEVELOPMENT_ENVIRONMENT`: 브라우저에 영속화하지 않는다는 절대 문장을 캠페인
  Store에 한정하고 허용 키 하나를 명시한다.
- `SESSION_PERSISTENCE_REVIEW`: localStorage 0개라는 과거 측정을 현재 업적 프로필
  1개로 갱신하되 캠페인 상태는 여전히 0개임을 구별한다.
- `CAMPAIGN_REWORK_WORK_ASSIGNMENT`: `M1 메인 메뉴·업적 기록` 항목에 규칙·저장·UI
  책임과 완료 여부를 기록한다.
- `screens.md`, `diagram/README.md`, `docs/README.md`: 대표 화면 수와 진입 흐름을
  7개 캠페인 화면 + 2개 메타 화면으로 설명하고 Task 6에서 생성할 두 PNG 경로를
  연결한다.

- [ ] **Step 3: 문서와 집중 테스트 통과 확인**

Run: `pnpm test -- docs/DOCUMENT_TERMINOLOGY.test.ts lib/achievements/player-progress.test.ts lib/achievements/player-progress-storage.test.ts lib/achievements/completed-campaign.test.ts components/game/MainMenuScreen.test.tsx components/game/AchievementScreen.test.tsx components/game/FixedCanvas.test.ts`

Expected: PASS.

- [ ] **Step 4: 전체 정적 검증**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build --webpack`

Expected: exit 0 for all four commands. 기존 lint warning은 개수와 파일을 보고하되 새
warning을 만들지 않는다. `.next` 캐시 오류가 나면 원인 확인 없이 삭제하지 않고
기준 브랜치에서도 재현되는지 먼저 비교한다.

- [ ] **Step 5: 프로덕션 서버와 네 viewport 브라우저 검증**

Run: `pnpm start --hostname 127.0.0.1 --port 3110`

다음 주소를 1920×1080, 2560×1440, 1440×900, 1280×1024에서 확인한다.

```text
http://127.0.0.1:3110/
http://127.0.0.1:3110/achievements
```

확인 항목:

- 캔버스가 정확한 16:9로 가운데 있고 남는 공간은 레터박스다.
- 네 viewport에서 내부 배치와 줄바꿈이 같다.
- 8개 카드가 스크롤 없이 보이고 이미지가 찌그러지지 않는다.
- Tab·Shift+Tab·Enter로 두 메인 링크, 뒤로가기, 기록 초기화 dialog를 조작한다.
- `localStorage`를 비운 상태, 일부 해금 fixture, 8개 해금 fixture, storage 예외
  모의 상태에서 문구와 배치가 유지된다.
- 콘솔 error와 hydration mismatch가 없다.

1920×1080 캡처 두 장을 `docs/diagram/png/screen-main-menu.png`와
`docs/diagram/png/screen-achievements.png`에 저장한다. 서버나 브라우저 실행이
권한 문제로 막히면 필요한 승인 절차를 사용하며, 승인까지 거부되면 작업을 완료로
표시하지 말고 사용자에게 그 차단 상태를 보고한다.

- [ ] **Step 6: 최종 diff 검토와 문서 커밋**

Run: `git diff --check && git status --short && git diff --stat origin/main...HEAD`

Expected: 의도한 소스·자산·공식 문서만 변경되고 `.DS_Store`, 임시 캡처,
`node_modules`, `.next`가 추적되지 않는다.

```bash
git add docs/GAME_PRINCIPLES.md docs/systems/PROGRESSION_AND_ENDINGS.md docs/experience/SCREEN_LAYOUT.md docs/experience/ONBOARDING_AND_INTERFACE.md docs/technical/DEVELOPMENT_ENVIRONMENT.md docs/technical/SESSION_PERSISTENCE_REVIEW.md docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md docs/diagram/screens.md docs/diagram/README.md docs/README.md docs/diagram/png/screen-main-menu.png docs/diagram/png/screen-achievements.png
git commit -m "문서: 메인 메뉴와 업적 기록을 공식 흐름에 반영한다" -m "캠페인 저장과 브라우저 메타 기록의 경계, 두 전체 캔버스 화면과 검증 절차를 현재 구현에 맞춘다."
```

---

## 계획 자체 검토 결과

- Spec 1–3: Tasks 2–5가 루트 연결, 별도 프로필 계층, 진행 저장 제외를 구현한다.
- Spec 4–6: Task 1이 V1 계약, 8개 카탈로그, 불변 누적, UUID 중복 방지를 구현한다.
- Spec 7–8: Task 2가 구조 검증·백업·fallback·Provider를, Task 3이 엔딩 연결을 구현한다.
- Spec 9–10: Tasks 4–5가 두 전체 캔버스, 문양, 접근성, 확인 초기화를 구현한다.
- Spec 11–13: Task 6이 공식 문서, 전체 명령, viewport, 저장 상태를 검증한다.
- 타입 이름은 전 Task에서 `PlayerProgressV1`, `CompletedCampaignRecord`,
  `AchievementCardView`, `recordCompletedCampaign`, `usePlayerProgressStore`로 일치한다.
- 미정 수치, 후속 빈칸, 범위 밖 캠페인 저장은 없다.
