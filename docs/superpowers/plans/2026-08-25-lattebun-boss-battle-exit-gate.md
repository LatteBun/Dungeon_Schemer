# 보스전 정산 CTA 게이트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## 문서 정보

- 작성자: LatteBun
- 작성 도구: Codex
- 작성일: 2026-08-25
- 기준 브랜치: `main` (`29985a9`)

**Goal:** 보스전 재생 중 우측 하단 CTA를 `전투 건너뛰기`로 잠그고, complete frame 뒤에만 같은 자리를 `정산으로`로 전환한다.

**Architecture:** `useU5BattlePlayback`이 replay의 frame index와 timer를 소유하고 `U5ProgressScreen`이 재생 상태에 따라 우측 하단의 단일 CTA를 선택한다. `U5BattleScene`은 전달받은 frame을 표현하고 complete 상태의 `다시 보기`만 제공한다. `CampaignScreen`은 일반전과 보스전에 `after-playback` 정책을 명시적으로 전달하고, 비전투 결과와 replay 없는 전멸에는 정책을 적용하지 않는다.

**Tech Stack:** Next.js 16.3 App Router, React 19 Client Components, TypeScript 5, Framer Motion 13, Vitest 4, Playwright 1.62

**Spec:** `docs/superpowers/specs/2026-08-25-lattebun-boss-battle-exit-gate-design.md`

## Global Constraints

- 기준 spec 커밋 `29985a9` 이후에서 작업한다.
- 구현 시작 시 `superpowers:using-git-worktrees`로 현재 작업 공간이 이미 격리되었는지 확인하고, 필요할 때만 별도 worktree를 만든다.
- 구현 전에 `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`, `01-app/02-guides/testing/vitest.md`, `01-app/02-guides/testing/playwright.md`를 다시 확인한다.
- state, effect, event handler, `window.setTimeout`은 기존 Client Component 경계 안에 둔다.
- Vitest 설정은 Node 환경이므로 순수 replay helper와 최초 정적 마크업을 검증하고, 클릭에 따른 CTA 전환은 Playwright에서 검증한다.
- 보스전과 일반전 모두 재생 중에는 다음 단계 콜백을 DOM에 연결하지 않는다.
- 자연 종료와 건너뛰기는 같은 complete frame과 같은 확정 전투 결과를 사용한다.
- replay 존재 여부나 `acknowledgeLabel` 문자열만으로 exit 정책을 추론하지 않는다.
- 전투 계산, HP, 신뢰, RNG, action record, settlement snapshot, 캠페인 phase를 UI에서 다시 계산하거나 변경하지 않는다.
- 새 외부 의존성, 이미지 자산, CSS 변경을 추가하지 않는다.
- 관련 없는 최신 브랜치 57개 커밋을 일괄 병합하지 않는다.
- 커밋 제목과 본문은 한글로 작성한다.
- 사용자의 기존 미추적 `.pnpm-store/`와 `public/assets/u6/...` 파일을 stage하지 않는다.

## File Structure

| 파일 | 책임 |
| --- | --- |
| `components/game/use-u5-battle-playback.ts` (신규) | replay signature, frame index, timer, skip, replay-from-start를 소유하는 Client hook |
| `components/game/use-u5-battle-playback.test.ts` (신규) | signature와 순수 frame 전이 helper의 경계값 검증 |
| `components/game/u5-battle-test-fixture.ts` (신규) | 전투 장면과 playback 테스트가 공유하는 최소 승리 replay fixture |
| `components/game/U5BattleScene.tsx` | 전달받은 현재 frame의 표현과 complete 상태의 `다시 보기` 보조 버튼 |
| `components/game/U5BattleScene.test.tsx` | controlled frame 렌더, 장면 내부 skip 제거, complete/replay 마크업 검증 |
| `components/game/U5ProgressScreen.tsx` | playback hook 조합과 exit/preview 정책에 따른 우측 하단 단일 CTA |
| `components/game/U5ProgressScreen.test.tsx` | 일반전·보스전 최초 CTA, 빈 replay, 비전투 CTA 회귀 검증 |
| `components/game/U5BattlePreview.tsx` | 독립 전투 프리뷰에서 playback controls를 명시적으로 활성화 |
| `components/game/CampaignScreen.tsx` | 실제 일반전과 보스전에 `after-playback` 정책을 명시적으로 지정 |
| `components/game/campaign-render.test.tsx` | 실제 캠페인 분기에서 일반전·보스전 최초 CTA와 replay 없는 전멸 회귀 검증 |
| `e2e/u5-battle-preview.spec.ts` (신규) | 일반전·보스전 프리뷰의 skip/replay 전환 검증 |
| `e2e/campaign-smoke.spec.ts` | 실제 일반전과 보스전의 다음 단계 게이트 및 정산 진입 검증 |

---

### Task 1: 전투 재생 제어를 진행 화면이 소비할 수 있는 훅으로 분리한다

**Files:**
- Create: `components/game/use-u5-battle-playback.ts`
- Create: `components/game/use-u5-battle-playback.test.ts`
- Create: `components/game/u5-battle-test-fixture.ts`
- Modify: `components/game/U5BattleScene.tsx`
- Modify: `components/game/U5BattleScene.test.tsx`
- Modify: `components/game/U5ProgressScreen.tsx`

**Interfaces:**
- Consumes: `U5BattleReplay`, `U5BattleReplayFrame`, `U5BattleReplayPhase` from `components/game/u5-battle-replay.ts`.
- Produces:

```ts
export interface U5BattlePlayback {
  readonly frame: U5BattleReplayFrame | undefined;
  readonly frameIndex: number;
  readonly isComplete: boolean;
  readonly skipToComplete: () => void;
  readonly replayFromStart: () => void;
}

export function u5ReplaySignature(replay: U5BattleReplay | undefined): string;
export function nextU5BattleFrameIndex(replay: U5BattleReplay, current: number): number;
export function useU5BattlePlayback(replay: U5BattleReplay | undefined): U5BattlePlayback;
```

- Changes `U5BattleSceneProps` to:

```ts
export interface U5BattleSceneProps {
  readonly replay: U5BattleReplay;
  readonly frame: U5BattleReplayFrame;
  readonly onReplayFromStart: () => void;
}
```

- [ ] **Step 1: replay signature와 frame 경계의 실패 테스트를 작성한다**

`components/game/u5-battle-test-fixture.ts`로 현재 `U5BattleScene.test.tsx`의 `BattleResolution`, presentations, `createU5BattleReplay` 호출을 옮기고 결과를 `U5_TEST_BATTLE_REPLAY`로 export한다.

`components/game/use-u5-battle-playback.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { nextU5BattleFrameIndex, u5ReplaySignature } from "./use-u5-battle-playback";
import { U5_TEST_BATTLE_REPLAY } from "./u5-battle-test-fixture";

describe("u5 battle playback", () => {
  it("같은 내용의 새 객체는 같은 signature를 가진다", () => {
    expect(u5ReplaySignature(U5_TEST_BATTLE_REPLAY))
      .toBe(u5ReplaySignature({ ...U5_TEST_BATTLE_REPLAY }));
  });

  it("마지막 frame을 넘지 않는다", () => {
    const last = U5_TEST_BATTLE_REPLAY.frames.length - 1;
    expect(nextU5BattleFrameIndex(U5_TEST_BATTLE_REPLAY, last)).toBe(last);
  });

  it("replay가 없으면 빈 signature다", () => {
    expect(u5ReplaySignature(undefined)).toBe("none");
  });

  it("frame cue나 참가자 표현이 바뀌면 새 replay로 식별한다", () => {
    const changed = {
      ...U5_TEST_BATTLE_REPLAY,
      participants: U5_TEST_BATTLE_REPLAY.participants.map((one, index) =>
        index === 0 ? { ...one, name: "바뀐 이름" } : one),
    };
    expect(u5ReplaySignature(changed)).not.toBe(u5ReplaySignature(U5_TEST_BATTLE_REPLAY));
  });
});
```

`U5BattleScene.test.tsx`의 render helper는 `frame`과 noop callback을 전달하도록 바꾸고 다음 계약을 추가한다.

```ts
it("재생 중 장면 안에는 건너뛰기 버튼을 두지 않는다", () => {
  const html = render(U5_TEST_BATTLE_REPLAY.frames[0]!);
  expect(html).not.toContain("전투 건너뛰기");
  expect(html).not.toContain("다시 보기");
});

it("complete frame에서만 다시 보기 버튼을 제공한다", () => {
  const html = render(U5_TEST_BATTLE_REPLAY.frames.at(-1)!);
  expect(html).toMatch(/<button[^>]*>다시 보기<\/button>/);
});
```

- [ ] **Step 2: 테스트를 실행해 새 모듈 부재와 기존 내부 skip 때문에 실패하는지 확인한다**

Run: `pnpm test components/game/use-u5-battle-playback.test.ts components/game/U5BattleScene.test.tsx`

Expected: FAIL — `use-u5-battle-playback` 모듈이 없고 기존 `U5BattleScene`이 frame/timer/skip을 내부에서 소유한다.

- [ ] **Step 3: 순수 helper와 playback hook을 최소 구현한다**

`use-u5-battle-playback.ts`는 기존 `FRAME_DURATION_MS` 값을 그대로 옮긴다. `u5ReplaySignature`는 `JSON.stringify`로 outcome, termination, 참가자의 id/side/name/image/HP, 정렬된 HP map과 defeated IDs, frame cues, verifications를 포함한다. 표시 데이터가 바뀐 replay를 같은 것으로 오인하지 않는다.

```ts
export function nextU5BattleFrameIndex(replay: U5BattleReplay, current: number): number {
  return Math.min(current + 1, Math.max(0, replay.frames.length - 1));
}

export function useU5BattlePlayback(replay: U5BattleReplay | undefined): U5BattlePlayback {
  const signature = u5ReplaySignature(replay);
  const [playback, setPlayback] = useState({ signature, frameIndex: 0 });
  const frameIndex = playback.signature === signature ? playback.frameIndex : 0;
  const frame = replay?.frames[Math.min(frameIndex, replay.frames.length - 1)];

  useEffect(() => {
    if (replay === undefined || frame === undefined || frame.phase === "complete") return;
    const timeout = window.setTimeout(
      () => setPlayback((current) => ({
        signature,
        frameIndex: nextU5BattleFrameIndex(replay, current.signature === signature ? current.frameIndex : 0),
      })),
      FRAME_DURATION_MS[frame.phase],
    );
    return () => window.clearTimeout(timeout);
  }, [frame?.phase, frameIndex, replay?.frames.length, signature]);

  return {
    frame,
    frameIndex,
    isComplete: frame?.phase === "complete",
    skipToComplete: () => setPlayback({
      signature,
      frameIndex: Math.max(0, (replay?.frames.length ?? 1) - 1),
    }),
    replayFromStart: () => setPlayback({ signature, frameIndex: 0 }),
  };
}
```

`U5BattleScene.tsx`에서는 `useState`, `useEffect`, `FRAME_DURATION_MS`, `replaySignature`과 내부 frame 선택을 제거한다. 전달받은 `frame`을 그대로 표현하고 complete일 때만 다음 버튼을 렌더한다.

```tsx
{complete ? (
  <div className="u5-battle-controls">
    <button type="button" onClick={onReplayFromStart}>다시 보기</button>
  </div>
) : null}
```

`U5ProgressScreen.tsx`는 `useU5BattlePlayback(battleReplay)`을 호출하고 현재 frame이 있을 때만 controlled scene을 렌더한다. 이 Task에서는 우측 CTA 정책을 바꾸지 않으며 다음 Task가 같은 playback 객체를 CTA와 연결한다.

```tsx
const battlePlayback = useU5BattlePlayback(battleReplay);

{battleReplay === undefined || battlePlayback.frame === undefined ? null : (
  <U5BattleScene
    replay={battleReplay}
    frame={battlePlayback.frame}
    onReplayFromStart={battlePlayback.replayFromStart}
  />
)}
```

- [ ] **Step 4: 집중 테스트와 typecheck를 실행한다**

Run: `pnpm test components/game/use-u5-battle-playback.test.ts components/game/U5BattleScene.test.tsx components/game/U5ProgressScreen.test.tsx && pnpm typecheck`

Expected: PASS. `U5BattleScene`은 controlled frame만 렌더하고 장면 내부에 skip을 중복하지 않는다.

- [ ] **Step 5: Task 1 변경만 한글 커밋으로 기록한다**

```bash
git add components/game/use-u5-battle-playback.ts components/game/use-u5-battle-playback.test.ts components/game/u5-battle-test-fixture.ts components/game/U5BattleScene.tsx components/game/U5BattleScene.test.tsx components/game/U5ProgressScreen.tsx
git commit -m "리팩터링: 전투 재생 제어를 진행 화면으로 올린다" -m "프레임 타이머와 건너뛰기 상태를 훅으로 분리하고 전투 장면은 현재 프레임 표현만 맡긴다."
```

---

### Task 2: 일반전과 보스전에 우측 하단 단일 CTA 게이트를 연결한다

**Files:**
- Modify: `components/game/U5ProgressScreen.tsx`
- Modify: `components/game/U5ProgressScreen.test.tsx`
- Modify: `components/game/U5BattlePreview.tsx`
- Modify: `components/game/CampaignScreen.tsx`
- Modify: `components/game/campaign-render.test.tsx`

**Interfaces:**
- Consumes: `useU5BattlePlayback(replay)` and controlled `U5BattleScene` from Task 1.
- Produces:

```ts
export type U5BattleExitPolicy = "after-playback";

// Add these fields to the existing U5ProgressScreenProps interface.
readonly battleReplay?: U5BattleReplay;
readonly battleExitPolicy?: U5BattleExitPolicy;
readonly previewPlaybackControls?: boolean;
```

위 세 속성을 기존 `U5ProgressScreenProps`에 그대로 추가한다. 기존 속성의 이름과 타입은 바꾸지 않는다.

- `CampaignScreen` passes `battleExitPolicy="after-playback"` to a battle-owning monster outcome and to a boss result with a non-null boss replay.

- [ ] **Step 1: 일반전·보스전 최초 CTA와 빈 replay의 실패 렌더 테스트를 작성한다**

`U5ProgressScreen.test.tsx`의 `넘어가는 버튼` describe에 추가한다.

```ts
it.each([
  ["일반전", "지도로 돌아간다"],
  ["보스전", "정산으로"],
])("%s 재생 중 우측 하단에는 건너뛰기 하나만 둔다", (_name, nextLabel) => {
  const html = render(
    { outcome },
    {
      battleReplay,
      battleExitPolicy: "after-playback",
      onAcknowledge: () => undefined,
      acknowledgeLabel: nextLabel,
    },
  );
  expect(html.split("u5-outcome-continue").length - 1).toBe(1);
  expect(html).toContain("전투 건너뛰기");
  expect(html).not.toContain(nextLabel);
});

it("frame이 빈 gated replay에는 건너뛰기와 다음 CTA를 모두 만들지 않는다", () => {
  const html = render(
    { outcome },
    {
      battleReplay: { ...battleReplay, frames: [] },
      battleExitPolicy: "after-playback",
      onAcknowledge: () => undefined,
      acknowledgeLabel: "정산으로",
    },
  );
  expect(html).not.toContain("전투 건너뛰기");
  expect(html).not.toContain("정산으로");
});

it("replay 없는 비전투 결과는 기존 다음 CTA를 유지한다", () => {
  const html = render({ outcome }, { onAcknowledge: () => undefined });
  expect(html).toContain("지도로 돌아간다");
});
```

`campaign-render.test.tsx`의 실제 보스전 테스트는 최초 server render에 `전투 건너뛰기`가 있고 `정산으로`가 없다고 기대하도록 바꾼다. 실제 monster outcome에도 `전투 건너뛰기`가 있고 `지도로 돌아간다`가 없다는 회귀 테스트를 추가한다. 기존 replay 없는 전멸 결과 테스트는 결과 확인 화면이 유지되는지 계속 검사한다.

- [ ] **Step 2: 집중 테스트를 실행해 다음 CTA가 너무 일찍 노출되는지 확인한다**

Run: `pnpm test components/game/U5ProgressScreen.test.tsx components/game/campaign-render.test.tsx`

Expected: FAIL — `battleExitPolicy`가 없고 보스전은 최초 render부터 `정산으로`를 노출한다.

- [ ] **Step 3: U5ProgressScreen에서 playback과 우측 CTA를 조합한다**

hook은 조건부 호출하지 않는다.

```ts
const playback = useU5BattlePlayback(battleReplay);
const hasGatedReplay = battleExitPolicy === "after-playback" && battleReplay !== undefined;
const replayingBattle = hasGatedReplay && playback.frame !== undefined && !playback.isComplete;
const missingGatedFrame = hasGatedReplay && playback.frame === undefined;
const showPreviewSkip = previewPlaybackControls
  && battleReplay !== undefined
  && playback.frame !== undefined
  && !playback.isComplete;

const rightAction = missingGatedFrame
  ? null
  : replayingBattle || showPreviewSkip
    ? { label: "전투 건너뛰기", onClick: playback.skipToComplete }
    : onAcknowledge === undefined
      ? null
      : { label: acknowledgeLabel, onClick: onAcknowledge };
```

장면에는 현재 frame을 전달하고 우측 하단은 `rightAction` 하나만 렌더한다.

```tsx
{battleReplay === undefined || playback.frame === undefined ? null : (
  <U5BattleScene
    replay={battleReplay}
    frame={playback.frame}
    onReplayFromStart={playback.replayFromStart}
  />
)}
```

`U5BattlePreview.tsx`는 독립 프리뷰가 다음 단계 callback 없이도 재생 중 skip을 제공하도록 `previewPlaybackControls`를 전달한다.

- [ ] **Step 4: CampaignScreen에서 실제 일반전과 보스전에 정책을 명시한다**

보스 종료 분기에서 replay를 한 번만 만든다.

```tsx
const bossReplay = bossReplayFor(campaign, active);
return (
  <U5ProgressScreen
    // existing props
    battleReplay={bossReplay ?? undefined}
    battleExitPolicy={bossReplay === null ? undefined : "after-playback"}
    onAcknowledge={() => dispatch({
      type: "COMPLETE_EXPEDITION",
      snapshot: createSettlementSnapshotFor(campaign, active),
    })}
    acknowledgeLabel="정산으로"
  />
);
```

monster 결과 분기에서는 다음 조건만 정책을 켠다.

```ts
const gateMonsterBattle = seeing
  && active.pendingOutcome?.event.kind === "monster"
  && active.pendingOutcome.battle !== null;
```

`battleReplay`, `sceneKind`, CTA 문구만 보고 전투 종류를 추론하지 않는다.

- [ ] **Step 5: 렌더 테스트와 typecheck를 통과시킨다**

Run: `pnpm test components/game/use-u5-battle-playback.test.ts components/game/U5BattleScene.test.tsx components/game/U5ProgressScreen.test.tsx components/game/campaign-render.test.tsx && pnpm typecheck`

Expected: PASS. 일반전과 보스전의 최초 CTA는 skip 하나이고 replay 없는 결과는 기존 흐름을 유지한다.

- [ ] **Step 6: Task 2 변경만 한글 커밋으로 기록한다**

```bash
git add components/game/U5ProgressScreen.tsx components/game/U5ProgressScreen.test.tsx components/game/U5BattlePreview.tsx components/game/CampaignScreen.tsx components/game/campaign-render.test.tsx
git commit -m "화면: 보스전 중 정산 이동을 잠근다" -m "일반전과 보스전의 재생 상태를 우측 하단 CTA에 연결하고 완료 뒤에만 다음 단계로 전환한다."
```

---

### Task 3: 브라우저에서 skip·다시 보기·정산 전환을 검증하고 회귀를 마감한다

**Files:**
- Create: `e2e/u5-battle-preview.spec.ts`
- Modify: `e2e/campaign-smoke.spec.ts`

**Interfaces:**
- Consumes: Task 2의 `previewPlaybackControls`, `battleExitPolicy="after-playback"`, accessible button names.
- Produces: 실제 브라우저에서 일반전과 보스전의 CTA 상태 전이가 깨지지 않는 회귀 계약.

- [ ] **Step 1: 독립 전투 프리뷰의 실패 E2E를 작성한다**

`e2e/u5-battle-preview.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { expectNoBrowserErrors, watchBrowserErrors } from "./browser-errors";

for (const battle of ["E3 실제 일반전", "E4 실제 보스전"]) {
  test(`${battle} 프리뷰는 재생 중 건너뛰고 완료 뒤 다시 볼 수 있다`, async ({ page }) => {
    const failures = watchBrowserErrors(page);
    await page.goto("/u5-2-test");
    await page.getByRole("button", { name: new RegExp(battle) }).click();

    await page.getByRole("button", { name: "전투 건너뛰기" }).click();
    await expect(page.getByRole("button", { name: "다시 보기" })).toBeVisible();

    await page.getByRole("button", { name: "다시 보기" }).click();
    await expect(page.getByRole("button", { name: "전투 건너뛰기" })).toBeVisible();
    expectNoBrowserErrors(failures, `/u5-2-test ${battle}`);
  });
}
```

같은 파일에서 timer의 자연 종료도 한 번 검증한다.

```ts
test("E3 실제 일반전 프리뷰는 자연 종료해 complete 상태에 도달한다", async ({ page }) => {
  await page.goto("/u5-2-test");
  await expect(page.getByRole("button", { name: "다시 보기" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: "전투 건너뛰기" })).toHaveCount(0);
});
```

- [ ] **Step 2: 실제 캠페인 보스전까지 진행하는 실패 E2E를 작성한다**

`e2e/campaign-smoke.spec.ts`에 `advanceToBossReplay(page)` helper를 추가한다. `/campaign?seed=boss-screen-0`에서 첫 진입 가능 공고를 계약한 뒤 최대 40회 동안 다음 규칙으로 진행한다.

```ts
for (let step = 0; step < 40; step += 1) {
  const bossScene = page.locator('[data-testid="u5-scene"][data-scene-kind="boss"]');
  if (await bossScene.isVisible()) return;

  const adviceList = page.getByTestId("u5-advice-list");
  if (await adviceList.isVisible()) {
    await adviceList.locator("button:not(:disabled)").first().click();
    continue;
  }

  const skip = page.getByRole("button", { name: "전투 건너뛰기" });
  if (await skip.isVisible()) {
    await skip.click();
    continue;
  }

  const returnToMap = page.getByRole("button", { name: "지도로 돌아간다" });
  if (await returnToMap.isVisible()) {
    await returnToMap.click();
    continue;
  }

  const map = page.getByRole("region", { name: "던전 지도" });
  if (await map.isVisible()) {
    await map.locator('button[aria-label$="지점 선택"]:not(:disabled)').first().click();
    await page.getByRole("button", { name: "이 지점으로 이동" }).click();
    continue;
  }
}
throw new Error("40단계 안에 보스전 replay에 도달하지 못했다");
```

실제 테스트는 다음 상태 전이를 검증한다.

```ts
await advanceToBossReplay(page);
await expect(page.getByRole("button", { name: "전투 건너뛰기" })).toBeEnabled();
await expect(page.getByRole("button", { name: "정산으로" })).toHaveCount(0);

await page.getByRole("button", { name: "전투 건너뛰기" }).click();
await expect(page.getByRole("button", { name: "정산으로" })).toBeEnabled();

await page.getByRole("button", { name: "다시 보기" }).click();
await expect(page.getByRole("button", { name: "정산으로" })).toHaveCount(0);
await expect(page.getByRole("button", { name: "전투 건너뛰기" })).toBeEnabled();

await page.getByRole("button", { name: "전투 건너뛰기" }).click();
await page.getByRole("button", { name: "정산으로" }).click();
await expect(page.getByTestId("u6-settlement")).toBeVisible();
```

- [ ] **Step 3: 기존 일반전 smoke를 공용 게이트 계약에 맞춘다**

첫 사건 결과에서 `전투 건너뛰기`만 보이고 `지도로 돌아간다`가 없는지 확인한다. skip 뒤 지도 CTA, 다시 보기 뒤 skip CTA, 두 번째 skip 뒤 실제 지도 복귀를 순서대로 검증한다. 보스전 테스트와 일반전 테스트 모두 `campaign-rejection`이 없고 browser error 수집기가 비어 있어야 한다.

- [ ] **Step 4: 집중 브라우저 테스트를 실행한다**

Run: `pnpm exec playwright test e2e/u5-battle-preview.spec.ts e2e/campaign-smoke.spec.ts --project=chromium`

Expected: PASS. 일반전은 complete 뒤 지도, 보스전은 complete 뒤 정산으로만 이동한다.

- [ ] **Step 5: 전체 정적 검증을 실행한다**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build && git diff --check`

Expected: 모두 exit code 0. 게임 수치를 바꾸지 않았으므로 backtest는 실행하지 않는다.

- [ ] **Step 6: 변경 범위와 작업 트리를 확인한다**

Run: `git status --short && git diff --stat HEAD~2..HEAD`

Expected: 구현 파일과 두 E2E 파일만 변경되며 `.pnpm-store/`, `public/assets/u6/...`는 미추적 상태 그대로다.

- [ ] **Step 7: Task 3 변경만 한글 커밋으로 기록한다**

```bash
git add e2e/u5-battle-preview.spec.ts e2e/campaign-smoke.spec.ts
git commit -m "테스트: 보스전 CTA 전환을 브라우저에서 검증한다" -m "건너뛰기와 다시 보기 동안 정산을 잠그고 완료 뒤 실제 정산 화면으로 이동하는 흐름을 고정한다."
```

---

## 최종 완료 체크

- [ ] 보스전 최초 CTA는 `전투 건너뛰기`이고 `정산으로`는 없다.
- [ ] 자연 종료 또는 skip 뒤 같은 우측 하단 자리가 `정산으로`로 바뀐다.
- [ ] 다시 보기 동안 `정산으로`가 사라지고 `전투 건너뛰기`가 돌아온다.
- [ ] 일반전은 같은 계약으로 complete 뒤 `지도로 돌아간다`를 제공한다.
- [ ] 비전투 결과와 replay 없는 전멸 흐름은 기존 CTA를 유지한다.
- [ ] 자연 종료, skip, replay가 전투 결과와 settlement snapshot을 다시 계산하지 않는다.
- [ ] 관련 Vitest, Playwright, typecheck, lint, build, diff check가 모두 통과한다.
