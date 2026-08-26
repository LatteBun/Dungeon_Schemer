# 캠페인 복원 실패 안전장치 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 손상되거나 과거 형식인 캠페인 저장의 replay가 실패해도 `/campaign`을 새 캠페인으로 열고 최신 원문 한 건을 진단용으로 보존한다.

**Architecture:** 실시간 전이의 예외 정책은 유지하고 저장 replay 경계만 모든 예외를 실패 값으로 바꾼다. 저장 모듈은 원문을 포함한 load 결과와 예외를 던지지 않는 quarantine 함수를 제공하며, Provider는 unusable/replay 실패를 같은 격리 흐름으로 보낸다.

**Tech Stack:** TypeScript, React 19, Zustand, Vitest, Playwright, Next.js 16 App Router

**Spec:** `docs/superpowers/specs/2026-08-26-sbh3821-campaign-restore-failure-guard-design.md`

## Global Constraints

- 자동 복구가 변경하는 키는 `dungeon-schemer.campaign-run.v1`과 `dungeon-schemer.campaign-run.corrupt-backup`뿐이다.
- 최신 손상 원문 한 건만 보존한다.
- 백업 또는 삭제 실패를 UI로 던지지 않는다.
- 업적 프로필, 업적 손상 백업, 오디오 설정과 앱 밖 키를 변경하지 않는다.
- `?seed=...`는 저장을 읽거나 격리하지 않는다.
- 정상 저장은 기존 결정적 replay 결과와 액션 기록을 유지한다.

---

### Task 1: replay 일반 예외를 실패 값으로 닫기

**Files:**
- Modify: `lib/store/campaign-run.ts:80-103`
- Test: `lib/store/campaign-run-storage.test.ts`

**Interfaces:**
- Consumes: `advanceRun(state, action): AdvanceResult`
- Produces: `replayRun(seed, actions): ReplayResult`, 모든 액션별 예외를 `{ ok: false, reason, failedAt }`으로 반환

- [ ] **Step 1: 손상된 START_EXPEDITION 회귀 테스트 작성**

```ts
it("저장 replay의 일반 예외를 실패 위치로 반환한다", () => {
  const opened = advanceRun(initialRunState("damaged"), { type: "OPEN_BOARD" });
  expect(opened.ok).toBe(true);
  if (!opened.ok) return;
  const actions = [
    OPEN_BOARD,
    { type: "SELECT_CONTRACT", offerId: opened.state.campaign.offers[0]!.id },
    { type: "START_EXPEDITION", expeditionId: "broken" },
  ] as unknown as CampaignTransition[];

  expect(replayRun("damaged", actions)).toMatchObject({
    ok: false,
    failedAt: 2,
  });
});
```

- [ ] **Step 2: RED 확인**

Run: `pnpm exec vitest run lib/store/campaign-run-storage.test.ts`
Expected: FAIL — `TypeError`가 테스트 밖으로 탈출한다.

- [ ] **Step 3: replayRun의 액션별 호출만 예외 값으로 변환**

```ts
function reasonForReplayFailure(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

for (const [index, action] of actions.entries()) {
  let step: AdvanceResult;
  try {
    step = advanceRun(state, action);
  } catch (error) {
    return { ok: false, reason: reasonForReplayFailure(error), failedAt: index };
  }
  if (!step.ok) return { ok: false, reason: step.reason, failedAt: index };
  state = step.state;
}
```

- [ ] **Step 4: GREEN 및 기존 replay 회귀 확인**

Run: `pnpm exec vitest run lib/store/campaign-run-storage.test.ts lib/store/campaign-reproducibility.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add lib/store/campaign-run.ts lib/store/campaign-run-storage.test.ts
git commit -m "수정: 저장 replay 예외를 실패 값으로 닫는다" -m "손상 액션의 일반 예외도 실패 위치와 이유로 반환해 복원 effect 밖으로 탈출하지 않게 한다."
```

### Task 2: 손상 원문 격리 저장 경계

**Files:**
- Modify: `lib/store/campaign-run-storage.ts`
- Modify: `lib/store/campaign-run-storage.test.ts`
- Modify: `lib/diagnostics/local-storage-diagnostics.test.ts`

**Interfaces:**
- Produces: `CAMPAIGN_RUN_CORRUPT_BACKUP_KEY`
- Produces: ready `LoadResult`의 `raw: string`
- Produces: `quarantineCampaignRun(storage, input): { backup: SaveResult; clear: SaveResult }`

- [ ] **Step 1: 원문 반환과 격리 동작 테스트 작성**

```ts
expect(loadCampaignRun(memoryStorage({ [CAMPAIGN_RUN_STORAGE_KEY]: raw })))
  .toMatchObject({ status: "ready", raw });

const result = quarantineCampaignRun(storage, {
  raw,
  reason: "Cannot read properties of undefined",
  failedAt: 2,
  capturedAt: "2026-08-26T13:00:00.000Z",
});
expect(result).toEqual({ backup: { ok: true }, clear: { ok: true } });
expect(JSON.parse(storage.map.get(CAMPAIGN_RUN_CORRUPT_BACKUP_KEY)!)).toEqual({
  version: 1,
  capturedAt: "2026-08-26T13:00:00.000Z",
  reason: "Cannot read properties of undefined",
  failedAt: 2,
  raw,
});
expect(storage.map.has(CAMPAIGN_RUN_STORAGE_KEY)).toBe(false);
```

백업 `setItem`이 던져도 삭제를 시도하는 저장과, 삭제가 던져도 함수가 실패 값만
반환하는 저장을 각각 추가한다. 업적·오디오·업적 손상 백업·앱 밖 키가 그대로인지
같은 테스트에서 확인한다.

- [ ] **Step 2: RED 확인**

Run: `pnpm exec vitest run lib/store/campaign-run-storage.test.ts lib/diagnostics/local-storage-diagnostics.test.ts`
Expected: FAIL — 새 상수·함수·ready 원문이 없다.

- [ ] **Step 3: 최소 저장 API 구현**

```ts
export const CAMPAIGN_RUN_CORRUPT_BACKUP_KEY = "dungeon-schemer.campaign-run.corrupt-backup";

export function quarantineCampaignRun(storage: StringStorage, input: {
  readonly raw: string;
  readonly reason: string;
  readonly failedAt: number | null;
  readonly capturedAt?: string;
}): { readonly backup: SaveResult; readonly clear: SaveResult } {
  let backup: SaveResult;
  try {
    storage.setItem(CAMPAIGN_RUN_CORRUPT_BACKUP_KEY, JSON.stringify({
      version: 1,
      capturedAt: input.capturedAt ?? new Date().toISOString(),
      reason: input.reason,
      failedAt: input.failedAt,
      raw: input.raw,
    }));
    backup = { ok: true };
  } catch (error) {
    backup = { ok: false, reason: reasonFor(error) };
  }
  return { backup, clear: clearSavedCampaignRun(storage) };
}
```

`parseRun(raw)`의 ready 결과에도 같은 `raw`를 포함한다. 진단 수집은 앱 prefix를
이미 수집하므로 새 백업 키가 보고서에 포함되고 요약 캠페인은 진행 키만 읽는지
테스트로 고정한다.

- [ ] **Step 4: GREEN 확인**

Run: `pnpm exec vitest run lib/store/campaign-run-storage.test.ts lib/diagnostics/local-storage-diagnostics.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add lib/store/campaign-run-storage.ts lib/store/campaign-run-storage.test.ts lib/diagnostics/local-storage-diagnostics.test.ts
git commit -m "기능: 복원 실패 캠페인 원문을 격리한다" -m "최신 손상 원문과 실패 위치를 별도 키에 보관하고 캠페인 진행 키 삭제 결과를 독립적으로 반환한다."
```

### Task 3: Provider 자동 복구와 브라우저 회귀

**Files:**
- Create: `lib/store/campaign-run-restore.ts`
- Create: `lib/store/campaign-run-restore.test.ts`
- Modify: `components/game/CampaignStoreProvider.tsx:82-100`
- Create: `e2e/campaign-restore-failure.spec.ts`

**Interfaces:**
- Consumes: `loadCampaignRun`, `replayRun`, `quarantineCampaignRun`
- Produces: `restoreCampaignRun(storage): { status: "empty" | "restored" | "recovered"; run?: SavedCampaignRun; state?: CampaignRunState }`
- Produces: unusable/replay 실패 저장에서도 새 캠페인을 유지하는 Provider effect

- [ ] **Step 1: Provider와 실제 브라우저 실패 테스트 작성**

순수 restore 함수 테스트는 ready 저장의 replay 실패 시 `CAMPAIGN_RUN_STORAGE_KEY`가 제거되고
백업에 `failedAt`과 원문이 남으며 인트로 markup을 유지하는지 확인한다. Playwright는
페이지 진입 전 아래 저장을 주입한다.

```ts
await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), {
  key: "dungeon-schemer.campaign-run.v1",
  raw: JSON.stringify({
    version: 1,
    seed: "broken-mobile-save",
    actions: [
      { type: "OPEN_BOARD" },
      { type: "SELECT_CONTRACT", offerId: "offer-0-dungeon-spider-01" },
      { type: "START_EXPEDITION", expeditionId: "broken" },
    ],
  }),
});
await page.goto("/campaign");
await expect(page.getByRole("button", { name: "길드 게시판으로" })).toBeVisible();
await expect(page.getByText("This page couldn't load")).toHaveCount(0);
```

또한 `?seed=explicit` 진입에서는 같은 저장과 백업 키가 바뀌지 않는 테스트를 둔다.

- [ ] **Step 2: RED 확인**

Run: `pnpm exec vitest run lib/store/campaign-run-restore.test.ts`
Expected: FAIL — restore 함수가 없고 replay 실패를 격리하지 않는다.

- [ ] **Step 3: Provider에 동일 격리 흐름 연결**

```ts
export function restoreCampaignRun(storage: StringStorage): RestoreCampaignRunResult {
  const loaded = loadCampaignRun(storage);
  if (loaded.status === "empty") return { status: "empty" };
  if (loaded.status === "unusable") {
    if (loaded.raw !== undefined) quarantineCampaignRun(storage, {
      raw: loaded.raw,
      reason: loaded.reason,
      failedAt: null,
    });
    return { status: "recovered" };
  }

  const replayed = replayRun(loaded.run.seed, loaded.run.actions);
  if (!replayed.ok) {
    quarantineCampaignRun(storage, {
      raw: loaded.raw,
      reason: replayed.reason,
      failedAt: replayed.failedAt,
    });
    return { status: "recovered" };
  }
  return { status: "restored", run: loaded.run, state: replayed.state };
}

const restored = restoreCampaignRun(storage);
if (restored.status === "restored") {
  store.getState().restore(restored.run.seed, restored.state, restored.run.actions);
}
```

실제 함수는 성공 시 Provider가 `store.restore`에 전달할 `run`과 replay `state`를
반환한다. Provider effect는 `restoreCampaignRun(storage)`이 `restored`일 때만
스토어를 교체한다. 이 분리로 React effect를 흉내 내지 않고 복원 경계를 직접
테스트한다.

- [ ] **Step 4: 단위 테스트 GREEN 확인**

Run: `pnpm exec vitest run lib/store/campaign-run-restore.test.ts lib/store/campaign-run-storage.test.ts lib/diagnostics/local-storage-diagnostics.test.ts`
Expected: PASS

- [ ] **Step 5: 프로덕션 빌드와 Chromium 회귀 확인**

Run: `pnpm build --webpack`
Expected: exit 0

Run: `pnpm exec playwright test e2e/campaign-restore-failure.spec.ts --project=chromium`
Expected: PASS — 손상 저장은 인트로로 복구되고 명시적 seed는 저장을 보존한다.

- [ ] **Step 6: 전체 정적·단위 검증**

Run: `pnpm typecheck && pnpm lint && pnpm exec vitest run --testTimeout=15000`
Expected: typecheck/lint exit 0, 전체 Vitest PASS

- [ ] **Step 7: 커밋**

```bash
git add lib/store/campaign-run-restore.ts lib/store/campaign-run-restore.test.ts components/game/CampaignStoreProvider.tsx e2e/campaign-restore-failure.spec.ts
git commit -m "수정: 손상 캠페인을 새 판으로 자동 복구한다" -m "복원 실패 원문을 격리하고 캠페인 진행만 제거해 모바일을 포함한 브라우저가 오류 화면에 갇히지 않게 한다."
```
