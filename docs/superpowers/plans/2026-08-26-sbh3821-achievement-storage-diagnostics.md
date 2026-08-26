# 업적 화면 저장 진단 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 업적 화면의 달성 수를 5회 연속 눌러 앱 localStorage를 복사하고 진행 중 캠페인만 초기화할 수 있는 숨은 진단 dialog를 제공한다.

**Architecture:** localStorage 수집·표시·캠페인 삭제 검증은 브라우저 전역에 의존하지 않는 진단 모듈이 맡고, React dialog는 이 모듈에 Storage와 clipboard·navigation 경계를 주입한다. `AchievementScreen`은 2초짜리 5회 클릭 트리거와 open 상태만 소유하며 독립 route와 overlay가 같은 `Achievements` 연결을 재사용한다.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript, native `<dialog>`, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-08-26-sbh3821-achievement-storage-diagnostics-design.md`

## Global Constraints

- 현재 origin의 `dungeon-schemer.*` localStorage 키만 진단에 포함한다.
- 캠페인 초기화는 `dungeon-schemer.campaign-run.v1`만 삭제하고 업적·오디오·손상 백업·prefix 밖 키를 보존한다.
- 캠페인 키 삭제를 검증하지 못하면 `/campaign`으로 이동하지 않는다.
- 진단 데이터는 자동 전송하지 않고 사용자 요청 때 clipboard로만 복사한다.
- JSON 파싱 실패 원문을 수정하거나 덮어쓰지 않는다.
- 첫 클릭부터 2초 안의 다섯 번째 클릭만 진단을 연다.
- 새 외부 패키지를 추가하지 않는다.

---

### Task 1: localStorage 진단과 캠페인 삭제 경계

**Files:**
- Create: `lib/diagnostics/local-storage-diagnostics.ts`
- Create: `lib/diagnostics/local-storage-diagnostics.test.ts`
- Modify: `lib/store/campaign-run-storage.ts`
- Modify: `lib/store/campaign-run-storage.test.ts`

**Interfaces:**
- Consumes: `CAMPAIGN_RUN_STORAGE_KEY` from `lib/store/campaign-run-storage.ts`
- Produces: `collectStorageDiagnostics(storage, context): StorageDiagnosticSnapshot`, `formatStorageDiagnostics(snapshot): string`, `clearSavedCampaignRun(storage): StorageResult`

- [ ] **Step 1: 캠페인 삭제 결과를 검증하는 실패 테스트를 작성한다**

```ts
it("캠페인 저장만 지우고 삭제 성공을 반환한다", () => {
  const storage = memoryStorage({
    [CAMPAIGN_RUN_STORAGE_KEY]: JSON.stringify({ version: 1, seed: "old", actions: [] }),
    "dungeon-schemer.player-progress.v1": "achievement",
  });

  expect(clearSavedCampaignRun(storage)).toEqual({ ok: true });
  expect(storage.getItem(CAMPAIGN_RUN_STORAGE_KEY)).toBeNull();
  expect(storage.getItem("dungeon-schemer.player-progress.v1")).toBe("achievement");
});

it("remove 뒤 키가 남으면 실패를 반환한다", () => {
  const storage = stickyStorage(CAMPAIGN_RUN_STORAGE_KEY, "saved");
  expect(clearSavedCampaignRun(storage)).toEqual({ ok: false, reason: "캠페인 저장이 남아 있다" });
});
```

- [ ] **Step 2: 삭제 테스트가 export 부재로 실패하는지 확인한다**

Run: `pnpm exec vitest run lib/store/campaign-run-storage.test.ts`

Expected: FAIL because `clearSavedCampaignRun` is not exported.

- [ ] **Step 3: 삭제 결과 API를 최소 구현한다**

```ts
export function clearSavedCampaignRun(storage: StringStorage): SaveResult {
  try {
    storage.removeItem(CAMPAIGN_RUN_STORAGE_KEY);
    return storage.getItem(CAMPAIGN_RUN_STORAGE_KEY) === null
      ? { ok: true }
      : { ok: false, reason: "캠페인 저장이 남아 있다" };
  } catch (error) {
    return { ok: false, reason: reasonFor(error) };
  }
}

export function clearCampaignRun(storage: StringStorage): void {
  clearSavedCampaignRun(storage);
}
```

- [ ] **Step 4: 삭제 테스트를 통과시킨다**

Run: `pnpm exec vitest run lib/store/campaign-run-storage.test.ts`

Expected: PASS.

- [ ] **Step 5: prefix 수집·원문 보존·요약 실패 테스트를 작성한다**

```ts
it("앱 키만 정렬하고 정상 캠페인을 요약한다", () => {
  const snapshot = collectStorageDiagnostics(memoryStorage({
    unrelated: "secret",
    "dungeon-schemer.player-progress.v1": "{broken",
    [CAMPAIGN_RUN_STORAGE_KEY]: JSON.stringify({
      version: 1,
      seed: "report-seed",
      actions: [{ type: "OPEN_BOARD" }, { type: "SELECT_CONTRACT", offerId: "offer" }],
    }),
  }), { collectedAt: "2026-08-26T12:00:00.000Z", userAgent: "test-agent" });

  expect(snapshot.entries.map(({ key }) => key)).toEqual([
    CAMPAIGN_RUN_STORAGE_KEY,
    "dungeon-schemer.player-progress.v1",
  ]);
  expect(snapshot.entries[1]).toMatchObject({ format: "invalid-json", raw: "{broken" });
  expect(snapshot.campaign).toEqual({ seed: "report-seed", actionCount: 2, latestActionType: "SELECT_CONTRACT" });
  expect(formatStorageDiagnostics(snapshot)).not.toContain("unrelated");
});

it("저장소 접근 예외를 빈 저장으로 위장하지 않는다", () => {
  const snapshot = collectStorageDiagnostics(throwingStorage(new Error("blocked")), {
    collectedAt: "2026-08-26T12:00:00.000Z",
    userAgent: "test-agent",
  });
  expect(snapshot).toMatchObject({ status: "unavailable", reason: "blocked", entries: [] });
});
```

- [ ] **Step 6: 진단 테스트가 모듈 부재로 실패하는지 확인한다**

Run: `pnpm exec vitest run lib/diagnostics/local-storage-diagnostics.test.ts`

Expected: FAIL because the diagnostics module does not exist.

- [ ] **Step 7: 저장 진단 타입과 수집·포맷을 최소 구현한다**

```ts
export const APP_STORAGE_PREFIX = "dungeon-schemer.";

export interface StorageDiagnosticEntry {
  readonly key: string;
  readonly format: "json" | "invalid-json";
  readonly raw: string;
  readonly display: string;
}

export interface StorageDiagnosticSnapshot {
  readonly version: 1;
  readonly collectedAt: string;
  readonly userAgent: string;
  readonly status: "ready" | "unavailable";
  readonly reason: string | null;
  readonly campaign: { readonly seed: string; readonly actionCount: number; readonly latestActionType: string | null } | null;
  readonly entries: readonly StorageDiagnosticEntry[];
}

export function collectStorageDiagnostics(
  storage: Pick<Storage, "length" | "key" | "getItem">,
  context: { readonly collectedAt: string; readonly userAgent: string },
): StorageDiagnosticSnapshot;

export function formatStorageDiagnostics(snapshot: StorageDiagnosticSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}
```

Implementation details: enumerate `0..storage.length - 1`, filter prefix, sort keys, preserve every raw string, and only form `campaign` when parsed `seed` is a non-empty string and `actions` is an array whose last item has a string `type`.

- [ ] **Step 8: 진단과 캠페인 저장 테스트를 함께 통과시킨다**

Run: `pnpm exec vitest run lib/diagnostics/local-storage-diagnostics.test.ts lib/store/campaign-run-storage.test.ts`

Expected: PASS.

- [ ] **Step 9: Task 1을 커밋한다**

```bash
git add lib/diagnostics/local-storage-diagnostics.ts lib/diagnostics/local-storage-diagnostics.test.ts lib/store/campaign-run-storage.ts lib/store/campaign-run-storage.test.ts
git commit -m "기능: 브라우저 저장 진단 경계를 만든다" -m "앱 소유 localStorage만 원문과 함께 수집하고 캠페인 진행 키 삭제 성공을 검증한다."
```

### Task 2: 5회 연속 진입과 진단 dialog

**Files:**
- Create: `components/game/AchievementStorageDiagnostics.tsx`
- Create: `components/game/achievement-storage-trigger.ts`
- Create: `components/game/achievement-storage-trigger.test.ts`
- Modify: `components/game/AchievementScreen.tsx`
- Modify: `components/game/AchievementScreen.test.tsx`

**Interfaces:**
- Consumes: Task 1의 `collectStorageDiagnostics`, `formatStorageDiagnostics`, `clearSavedCampaignRun`
- Produces: `advanceDiagnosticTrigger(state, now): DiagnosticTriggerResult`, `AchievementStorageDiagnostics` component

- [ ] **Step 1: 2초 내 5회와 시간 초과를 표현하는 실패 테스트를 작성한다**

```ts
it("2초 안의 다섯 번째 클릭에서만 연다", () => {
  let state = initialDiagnosticTriggerState();
  for (const now of [0, 300, 600, 900]) {
    const result = advanceDiagnosticTrigger(state, now);
    state = result.state;
    expect(result.open).toBe(false);
  }
  expect(advanceDiagnosticTrigger(state, 1200).open).toBe(true);
});

it("첫 클릭에서 2초가 지나면 새 연속 입력으로 센다", () => {
  const first = advanceDiagnosticTrigger(initialDiagnosticTriggerState(), 0);
  const expired = advanceDiagnosticTrigger(first.state, 2001);
  expect(expired).toMatchObject({ open: false, state: { count: 1, startedAt: 2001 } });
});
```

- [ ] **Step 2: trigger 테스트가 모듈 부재로 실패하는지 확인한다**

Run: `pnpm exec vitest run components/game/achievement-storage-trigger.test.ts`

Expected: FAIL because the trigger module does not exist.

- [ ] **Step 3: 순수 trigger 상태 머신을 최소 구현한다**

```ts
export interface DiagnosticTriggerState { readonly count: number; readonly startedAt: number | null }
export interface DiagnosticTriggerResult { readonly state: DiagnosticTriggerState; readonly open: boolean }

export function initialDiagnosticTriggerState(): DiagnosticTriggerState {
  return { count: 0, startedAt: null };
}

export function advanceDiagnosticTrigger(state: DiagnosticTriggerState, now: number): DiagnosticTriggerResult {
  const expired = state.startedAt === null || now - state.startedAt > 2000;
  const startedAt = expired ? now : state.startedAt;
  const count = expired ? 1 : state.count + 1;
  return count === 5
    ? { state: initialDiagnosticTriggerState(), open: true }
    : { state: { count, startedAt }, open: false };
}
```

- [ ] **Step 4: trigger 테스트를 통과시킨다**

Run: `pnpm exec vitest run components/game/achievement-storage-trigger.test.ts`

Expected: PASS.

- [ ] **Step 5: AchievementScreen의 버튼·dialog 계약 실패 테스트를 작성한다**

```ts
it("달성 수를 히든 진단 트리거 버튼으로 렌더한다", () => {
  const html = renderEmptyGallery();
  expect(html).toMatch(/<button[^>]*class="game-shell__status-chip achievement-screen__count"/);
  expect(html).toContain("달성 <strong>0</strong> / 12");
});

it("진단 open 상태는 원문과 세 버튼을 렌더한다", () => {
  const html = renderToStaticMarkup(createElement(AchievementStorageDiagnostics, {
    snapshot: diagnosticFixture(),
    copyStatus: "idle",
    confirmingClear: false,
    onCopy: () => {}, onRequestClear: () => {}, onClose: () => {},
  }));
  expect(html).toContain("브라우저 저장 진단");
  expect(html).toContain("전체 복사");
  expect(html).toContain("캠페인 초기화");
  expect(html).toContain("닫기");
});
```

- [ ] **Step 6: 화면 테스트가 버튼·컴포넌트 부재로 실패하는지 확인한다**

Run: `pnpm exec vitest run components/game/AchievementScreen.test.tsx`

Expected: FAIL because the status chip is still a paragraph and diagnostics component is missing.

- [ ] **Step 7: native dialog와 AchievementScreen 연결을 최소 구현한다**

`AchievementStorageDiagnostics.tsx`는 `useRef<HTMLDialogElement>`와 기존
`showResetDialogModal` 패턴으로 mount 때 `showModal()`을 호출한다. props는 다음을
사용한다.

```ts
interface AchievementStorageDiagnosticsProps {
  readonly snapshot: StorageDiagnosticSnapshot;
  readonly copyStatus: "idle" | "copied" | "failed";
  readonly confirmingClear: boolean;
  readonly clearError?: string | null;
  readonly onCopy: () => void;
  readonly onRequestClear: () => void;
  readonly onCancelClear?: () => void;
  readonly onConfirmClear?: () => void;
  readonly onClose: () => void;
}
```

`AchievementScreen`에 `onActivateDiagnostics?: () => void`를 추가하고 status chip을
`type="button"`으로 바꾼다. `Achievements`는 trigger state를 `useRef`에 보관하고
`performance.now()`을 넘겨 다섯 번째 클릭에서만 `collectStorageDiagnostics`를 호출해
dialog 상태를 연다.

- [ ] **Step 8: trigger와 화면 테스트를 함께 통과시킨다**

Run: `pnpm exec vitest run components/game/achievement-storage-trigger.test.ts components/game/AchievementScreen.test.tsx`

Expected: PASS.

- [ ] **Step 9: Task 2를 커밋한다**

```bash
git add components/game/AchievementStorageDiagnostics.tsx components/game/achievement-storage-trigger.ts components/game/achievement-storage-trigger.test.ts components/game/AchievementScreen.tsx components/game/AchievementScreen.test.tsx
git commit -m "기능: 업적 화면에 저장 진단을 연다" -m "달성 수를 2초 안에 다섯 번 누르면 앱 저장 요약과 원문을 native dialog로 보여 준다."
```

### Task 3: 복사와 캠페인 단독 초기화 동작

**Files:**
- Modify: `components/game/AchievementStorageDiagnostics.tsx`
- Create: `components/game/achievement-storage-actions.ts`
- Create: `components/game/achievement-storage-actions.test.ts`
- Modify: `components/game/AchievementScreen.tsx`
- Modify: `components/game/AchievementScreen.test.tsx`

**Interfaces:**
- Consumes: Task 1의 `formatStorageDiagnostics`, `clearSavedCampaignRun`
- Produces: `copyStorageDiagnostics(clipboard, text)`, `resetCampaignForDiagnostics(storage, navigate)`

- [ ] **Step 1: 복사와 삭제 후 이동 경계의 실패 테스트를 작성한다**

```ts
it("진단 문자열을 clipboard에 복사한다", async () => {
  const writes: string[] = [];
  await expect(copyStorageDiagnostics({ writeText: async (text) => { writes.push(text); } }, "report"))
    .resolves.toEqual({ ok: true });
  expect(writes).toEqual(["report"]);
});

it("캠페인 키 삭제 성공 뒤에만 새 캠페인으로 이동한다", () => {
  const storage = memoryStorage({
    [CAMPAIGN_RUN_STORAGE_KEY]: "saved",
    "dungeon-schemer.player-progress.v1": "achievement",
    "dungeon-schemer.audio-settings.v1": "audio",
  });
  const destinations: string[] = [];
  expect(resetCampaignForDiagnostics(storage, (href) => destinations.push(href))).toEqual({ ok: true });
  expect(destinations).toEqual(["/campaign"]);
  expect(storage.getItem("dungeon-schemer.player-progress.v1")).toBe("achievement");
  expect(storage.getItem("dungeon-schemer.audio-settings.v1")).toBe("audio");
});

it("삭제가 실패하면 이동하지 않는다", () => {
  const destinations: string[] = [];
  expect(resetCampaignForDiagnostics(stickyStorage(CAMPAIGN_RUN_STORAGE_KEY, "saved"), (href) => destinations.push(href)))
    .toEqual({ ok: false, reason: "캠페인 저장이 남아 있다" });
  expect(destinations).toEqual([]);
});
```

- [ ] **Step 2: action 테스트가 모듈 부재로 실패하는지 확인한다**

Run: `pnpm exec vitest run components/game/achievement-storage-actions.test.ts`

Expected: FAIL because the action module does not exist.

- [ ] **Step 3: 복사와 초기화 action을 최소 구현한다**

```ts
export async function copyStorageDiagnostics(
  clipboard: { writeText(text: string): Promise<void> }, text: string,
): Promise<StorageActionResult> {
  try { await clipboard.writeText(text); return { ok: true }; }
  catch (error) { return { ok: false, reason: reasonFor(error) }; }
}

export function resetCampaignForDiagnostics(
  storage: StringStorage,
  navigate: (href: string) => void,
): StorageActionResult {
  const result = clearSavedCampaignRun(storage);
  if (!result.ok) return result;
  navigate("/campaign");
  return { ok: true };
}
```

- [ ] **Step 4: action 테스트를 통과시킨다**

Run: `pnpm exec vitest run components/game/achievement-storage-actions.test.ts`

Expected: PASS.

- [ ] **Step 5: Achievements 컨테이너에 실제 브라우저 경계를 연결한다**

`전체 복사`는 `navigator.clipboard.writeText(formatStorageDiagnostics(snapshot))`를
호출해 성공·실패 status를 갱신한다. 확인 dialog의 최종 버튼은
`resetCampaignForDiagnostics(window.localStorage, (href) => window.location.assign(href))`
를 호출한다. 실패 결과는 dialog에 남기고 이동하지 않는다. 취소는 진단 dialog로
돌아가며 업적 초기화 상태를 건드리지 않는다.

- [ ] **Step 6: 연결된 화면 회귀를 통과시킨다**

Run: `pnpm exec vitest run components/game/AchievementScreen.test.tsx components/game/achievement-storage-actions.test.ts`

Expected: PASS.

- [ ] **Step 7: Task 3을 커밋한다**

```bash
git add components/game/AchievementStorageDiagnostics.tsx components/game/achievement-storage-actions.ts components/game/achievement-storage-actions.test.ts components/game/AchievementScreen.tsx components/game/AchievementScreen.test.tsx
git commit -m "기능: 진단 복사와 캠페인 초기화를 연결한다" -m "업적과 오디오 기록은 보존하고 캠페인 저장 삭제를 검증한 뒤 새 무작위 캠페인으로 이동한다."
```

### Task 4: 스타일, 브라우저 흐름, 전체 검증

**Files:**
- Modify: `app/achievements.css`
- Modify: `components/game/OutOfCampaignScreenConsistency.test.ts`
- Create: `e2e/achievement-storage-diagnostics.spec.ts`
- Modify: `docs/technical/SESSION_PERSISTENCE_REVIEW.md` only if implementation names differ from the approved contract

**Interfaces:**
- Consumes: Tasks 1–3의 완성된 route/overlay UI와 `data-testid="achievement-storage-diagnostics"`
- Produces: 1920×1080 캔버스 안의 진단 dialog와 실제 Chromium 회귀

- [ ] **Step 1: CSS와 브라우저 계약 실패 테스트를 작성한다**

CSS 테스트는 `.achievement-screen__count`가 button이어도 기본 border/background를
덧씌우지 않는 reset과 진단 dialog의 중앙 배치·고정폭 `<pre>` overflow를 검사한다.
Playwright 테스트는 `/achievements`에서 달성 버튼을 네 번 누른 뒤 dialog가 없고,
다섯 번째에 나타나는지 확인한다.

```ts
await page.goto("/achievements");
const trigger = page.getByRole("button", { name: /달성 0 \/ 12/ });
for (let index = 0; index < 4; index += 1) await trigger.click();
await expect(page.getByTestId("achievement-storage-diagnostics")).toHaveCount(0);
await trigger.click();
await expect(page.getByRole("dialog", { name: "브라우저 저장 진단" })).toBeVisible();
```

- [ ] **Step 2: 새 테스트가 CSS·test id 부재로 실패하는지 확인한다**

Run: `pnpm exec vitest run components/game/OutOfCampaignScreenConsistency.test.ts`

Run: `pnpm exec playwright test e2e/achievement-storage-diagnostics.spec.ts --project=chromium`

Expected: FAIL on the new style contract or missing diagnostics locator.

- [ ] **Step 3: 업적 화면 재질을 계승한 최소 스타일을 구현한다**

```css
.achievement-screen__count {
  border: 0;
  font: inherit;
  cursor: default;
}

.achievement-storage-diagnostics {
  margin: auto;
  width: min(64rem, calc(100% - 4rem));
  max-height: calc(100% - 4rem);
}

.achievement-storage-diagnostics pre {
  max-height: 30rem;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
```

실제 색·border·shadow·버튼은 기존 `.achievement-screen__dialog` 토큰을 재사용하고,
확인 상태에서만 캠페인 초기화 버튼에 danger 색을 적용한다.

- [ ] **Step 4: Playwright에 저장 보존과 새 인트로 이동을 추가한다**

테스트가 localStorage에 캠페인·업적·오디오·손상 백업을 넣고 dialog를 다시 연 뒤
초기화를 확인한다. `/campaign` 이동과 인트로를 확인한 다음 업적·오디오·백업 키가
그대로이고 캠페인 키만 새 캠페인의 첫 저장 전까지 없음을 확인한다. overlay 경로는
`/campaign?seed=diagnostics-overlay`에서 전역 메뉴로 업적을 열고 같은 5회 진입을
확인하되 초기화는 취소한다.

- [ ] **Step 5: 집중 테스트를 통과시킨다**

Run: `pnpm exec vitest run lib/diagnostics/local-storage-diagnostics.test.ts lib/store/campaign-run-storage.test.ts components/game/achievement-storage-trigger.test.ts components/game/achievement-storage-actions.test.ts components/game/AchievementScreen.test.tsx components/game/OutOfCampaignScreenConsistency.test.ts`

Run: `pnpm exec playwright test e2e/achievement-storage-diagnostics.spec.ts --project=chromium`

Expected: PASS.

- [ ] **Step 6: 전체 정적 검증과 단위 테스트를 실행한다**

Run: `pnpm typecheck`

Run: `pnpm lint`

Run: `pnpm test`

Expected: typecheck and lint exit 0; all unit tests pass. If the two known backtest cases exceed the shared 5-second timeout, rerun exactly `pnpm exec vitest run lib/backtest/campaign-driver.test.ts lib/backtest/backtest.run.test.ts` and record both results.

- [ ] **Step 7: production build를 검증한다**

Run: `pnpm build --webpack`

Expected: Next.js production build exits 0.

- [ ] **Step 8: 문서 일치와 diff를 자체 검토한다**

Run: `git diff --check`

Run: `rg -n "T[B]D|T[O]DO|F[I]XME" docs/superpowers/specs/2026-08-26-sbh3821-achievement-storage-diagnostics-design.md docs/superpowers/plans/2026-08-26-sbh3821-achievement-storage-diagnostics.md`

Expected: no whitespace errors and no placeholders.

- [ ] **Step 9: Task 4를 커밋한다**

```bash
git add app/achievements.css components/game/OutOfCampaignScreenConsistency.test.ts e2e/achievement-storage-diagnostics.spec.ts docs/technical/SESSION_PERSISTENCE_REVIEW.md
git commit -m "검증: 업적 저장 진단 흐름을 고정한다" -m "독립 업적 화면과 캠페인 overlay에서 진단 진입·복사·캠페인 단독 초기화를 브라우저로 검증한다."
```
