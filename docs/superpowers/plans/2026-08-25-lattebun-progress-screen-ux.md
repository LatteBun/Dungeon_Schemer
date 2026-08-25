# 진행 화면 UX 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## 문서 정보

- 작성자: LatteBun
- 작성 도구: Codex
- 작성일: 2026-08-25
- 기준 브랜치: `main` (`939d158`)

**Goal:** 진행 화면의 조언 카드를 낮은 A1 금속 명패로 바꾸고, 비전투 장면 좌측에 파티를 세우며, 일반 몬스터 전투가 끝날 때까지 우측 하단의 지도 이동을 건너뛰기 CTA로 대체한다.

**Architecture:** `useU5BattlePlayback`이 replay의 frame index와 timer를 소유하고 `U5ProgressScreen`이 재생 상태에 맞춰 우측 하단 단일 CTA를 고른다. `U5BattleScene`은 전달받은 frame만 표현하며, `U5NonBattlePartyScene`은 replay가 없을 때 기존 파티 초상을 좌측에 장식으로 배치한다. 카드 스타일은 기존 `AdviceOption`의 동일 구조 계약을 보존한 채 U5 CSS namespace 안에서 A1 외형과 낮은 공통 높이를 적용한다.

**Tech Stack:** Next.js 16.3 App Router, React 19 Client Components, TypeScript 5, Framer Motion 13, Vitest 4, Playwright 1.62, CSS container query units

**Spec:** `docs/superpowers/specs/2026-08-25-lattebun-progress-screen-ux-design.md`

## Global Constraints

- `main` 기준 spec 커밋 `939d158` 이후에서 작업한다.
- 구현 시작 시 `superpowers:using-git-worktrees`로 격리된 worktree와 feature branch를 만든다.
- 구현 전에 `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`, `03-api-reference/02-components/image.md`, `02-guides/testing/vitest.md`, `02-guides/testing/playwright.md`를 다시 확인한다.
- `U5ProgressScreen`과 재생 훅은 state·effect·event handler가 필요하므로 Client Component 경계 안에 둔다.
- 비전투 파티의 `next/image`는 `fill`, 위치가 지정된 parent, `object-fit: contain`, 빈 `alt`, 정확한 `sizes`를 함께 사용한다.
- 1920×1080 고정 캔버스, GameShell 60:40, 진행 화면 상단 40%·하단 60%를 바꾸지 않는다.
- `rem`, `cqw`, `cqh`만 사용하고 `vw`, `vh`, 화면별 `@media`를 추가하지 않는다.
- 세 조언 카드의 색·장식·크기·상호작용 구조는 동일해야 한다.
- 전투 계산, HP, 신뢰, RNG, action record, 캠페인 phase를 UI에서 다시 계산하거나 변경하지 않는다.
- 일반 몬스터 전투에만 완료 전 지도 이동 게이트를 명시적으로 적용한다. 보스전 `정산으로`와 비전투 사건의 결과 확인 흐름은 유지한다.
- 새 이미지 자산이나 의존성을 추가하지 않는다.
- 커밋 제목과 본문은 한글로 작성한다.
- 사용자의 기존 미추적 파일과 무관한 변경을 stage하지 않는다.

## File Structure

| 파일 | 책임 |
| --- | --- |
| `components/game/use-u5-battle-playback.ts` (신규) | replay signature, frame index, timer, skip, replay-from-start를 소유하는 Client hook |
| `components/game/use-u5-battle-playback.test.ts` (신규) | signature와 순수 frame 전이 helper의 경계값 검증 |
| `components/game/u5-battle-test-fixture.ts` (신규) | 전투 장면과 playback 테스트가 공유하는 최소 승리 replay fixture |
| `components/game/U5BattleScene.tsx` | 전달받은 현재 frame 표현과 complete 상태의 `다시 보기` 보조 버튼 |
| `components/game/U5BattleScene.test.tsx` | controlled frame 렌더, 내부 skip 제거, complete/replay 마크업 검증 |
| `components/game/U5ProgressScreen.tsx` | playback hook 조합, 일반전 exit 정책, 우측 하단 단일 CTA, 비전투 파티 배치 |
| `components/game/U5ProgressScreen.test.tsx` | 초기 CTA 정책, 비전투 파티와 전투 장면의 상호 배타성, 카드 구조 검증 |
| `components/game/U5NonBattlePartyScene.tsx` (신규) | 기존 `progress.party` 초상을 좌측 하단 장식 슬롯 3개로 표현 |
| `components/game/U5NonBattlePartyScene.test.tsx` (신규) | 초상 순서, 빈 경로, 장식 접근성, 원본 방향 보존 계약 |
| `components/game/CampaignScreen.tsx` | 일반 몬스터 사건 결과에만 `after-playback` exit 정책 지정 |
| `components/game/campaign-render.test.tsx` | 실제 사건/보스 분기에서 정책 범위와 기존 CTA 회귀 검증 |
| `app/u5-progress.css` | 낮은 A1 금속 명패와 비전투 파티 좌측 배치 |
| `e2e/campaign-smoke.spec.ts` | 실제 일반전의 skip→return→replay 게이트와 지도 복귀 검증 |

---

### Task 1: 전투 재생 제어를 화면이 소비할 수 있는 훅으로 분리한다

**Files:**
- Create: `components/game/use-u5-battle-playback.ts`
- Create: `components/game/use-u5-battle-playback.test.ts`
- Create: `components/game/u5-battle-test-fixture.ts`
- Modify: `components/game/U5BattleScene.tsx`
- Modify: `components/game/U5BattleScene.test.tsx`

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

  it("frame 행동 내용이 바뀌면 새 replay로 식별한다", () => {
    const changed = {
      ...U5_TEST_BATTLE_REPLAY,
      frames: U5_TEST_BATTLE_REPLAY.frames.map((frame, index) => index === 1
        ? { ...frame, damage: (frame.damage ?? 0) + 1 }
        : frame),
    };
    expect(u5ReplaySignature(changed)).not.toBe(u5ReplaySignature(U5_TEST_BATTLE_REPLAY));
  });
});
```

`u5-battle-test-fixture.ts`에는 현재 `U5BattleScene.test.tsx`의 `BattleResolution`, presentation, `createU5BattleReplay` 호출을 옮기고 결과를 `U5_TEST_BATTLE_REPLAY`라는 이름으로 export한다. 두 테스트는 이 fixture를 import해 production component에 테스트 전용 export가 생기지 않게 한다.

기존 `U5BattleScene.test.tsx`의 render helper를 `frame`과 noop callback을 전달하도록 바꾸고 다음 실패 계약을 추가한다.

```ts
it("재생 중 장면 안에는 건너뛰기 버튼을 두지 않는다", () => {
  const html = render(replay.frames[0]!);
  expect(html).not.toContain("전투 건너뛰기");
  expect(html).not.toContain("다시 보기");
});

it("complete frame에서만 다시 보기 버튼을 제공한다", () => {
  const html = render(replay.frames.at(-1)!);
  expect(html).toMatch(/<button[^>]*>다시 보기<\/button>/);
});
```

- [ ] **Step 2: 테스트를 실행해 새 모듈 부재와 기존 내부 skip 때문에 실패하는지 확인한다**

Run: `pnpm test components/game/use-u5-battle-playback.test.ts components/game/U5BattleScene.test.tsx`

Expected: FAIL — `use-u5-battle-playback`을 찾지 못하고 기존 장면이 `전투 건너뛰기`를 렌더링한다.

- [ ] **Step 3: 순수 helper와 playback hook을 최소 구현한다**

`components/game/use-u5-battle-playback.ts`:

```ts
"use client";

import { useEffect, useState } from "react";
import type { U5BattleReplay, U5BattleReplayPhase } from "./u5-battle-replay";

const FRAME_DURATION_MS: Readonly<Record<U5BattleReplayPhase, number>> = {
  idle: 500,
  attack: 360,
  impact: 420,
  settle: 520,
  complete: 0,
};

export function u5ReplaySignature(replay: U5BattleReplay | undefined): string {
  if (replay === undefined) return "none";
  return [
    replay.frames.length,
    replay.outcome,
    replay.termination,
    replay.participants
      .map((one) => `${one.id}@${one.initialHp}/${one.finalHp}`)
      .join(","),
    replay.frames
      .map((one) => [
        one.phase,
        one.actionIndex,
        one.actorId,
        one.targetId,
        one.damage,
        Object.entries(one.hpByParticipantId).map(([id, hp]) => `${id}@${hp}`).join(";"),
        one.defeatedParticipantIds.join(";"),
      ].join(":"))
      .join(","),
  ].join("|");
}

export function nextU5BattleFrameIndex(replay: U5BattleReplay, current: number): number {
  return Math.min(current + 1, Math.max(0, replay.frames.length - 1));
}

export function useU5BattlePlayback(replay: U5BattleReplay | undefined) {
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
  } as const;
}
```

`U5BattleScene.tsx`에서는 `useState`, `useEffect`, `FRAME_DURATION_MS`, `replaySignature`을 제거한다. 전달받은 `frame`을 그대로 사용하고 controls는 complete일 때만 남긴다.

```tsx
{complete ? (
  <div className="u5-battle-controls">
    <button type="button" onClick={onReplayFromStart}>다시 보기</button>
  </div>
) : null}
```

- [ ] **Step 4: 집중 테스트와 typecheck를 실행한다**

Run: `pnpm test components/game/use-u5-battle-playback.test.ts components/game/U5BattleScene.test.tsx && pnpm typecheck`

Expected: PASS. `U5BattleScene`은 controlled frame을 렌더하고 장면 내부 skip을 더 이상 소유하지 않는다.

- [ ] **Step 5: Task 1 변경만 한글 커밋으로 기록한다**

```bash
git add components/game/use-u5-battle-playback.ts components/game/use-u5-battle-playback.test.ts components/game/U5BattleScene.tsx components/game/U5BattleScene.test.tsx components/game/u5-battle-test-fixture.ts
git commit -m "리팩터링: 전투 재생 제어를 진행 화면으로 올린다" -m "프레임 타이머와 건너뛰기 상태를 훅으로 분리하고 전투 장면은 현재 프레임 표현만 맡긴다."
```

---

### Task 2: 일반 몬스터 전투에 우측 하단 단일 CTA 게이트를 연결한다

**Files:**
- Modify: `components/game/U5ProgressScreen.tsx`
- Modify: `components/game/U5ProgressScreen.test.tsx`
- Modify: `components/game/CampaignScreen.tsx`
- Modify: `components/game/campaign-render.test.tsx`
- Modify: `e2e/campaign-smoke.spec.ts`

**Interfaces:**
- Consumes: `useU5BattlePlayback(replay)` and controlled `U5BattleScene` from Task 1.
- Produces:

```ts
export type U5BattleExitPolicy = "after-playback";

export interface U5ProgressScreenProps {
  // existing props remain
  readonly battleReplay?: U5BattleReplay;
  readonly battleExitPolicy?: U5BattleExitPolicy;
}
```

- `CampaignScreen` passes `battleExitPolicy="after-playback"` only when `active.pendingOutcome?.event.kind === "monster"` and the outcome owns a battle.

- [ ] **Step 1: 초기 재생 CTA와 기존 흐름 보존의 실패 렌더 테스트를 작성한다**

`U5ProgressScreen.test.tsx`의 `넘어가는 버튼` describe에 추가한다.

```ts
it("일반전 재생 중 우측 하단에는 건너뛰기 하나만 둔다", () => {
  const html = render(
    { outcome },
    {
      battleReplay,
      battleExitPolicy: "after-playback",
      onAcknowledge: () => undefined,
    },
  );

  expect(html.split("u5-outcome-continue").length - 1).toBe(1);
  expect(html).toContain("전투 건너뛰기");
  expect(html).not.toContain("지도로 돌아간다");
});

it("정산 CTA에는 일반전 게이트를 적용하지 않는다", () => {
  const html = render(
    { outcome },
    { battleReplay, onAcknowledge: () => undefined, acknowledgeLabel: "정산으로" },
  );
  expect(html).toContain("정산으로");
  expect(html).not.toContain("전투 건너뛰기");
});

it("frame이 빈 replay에는 전투 장면과 건너뛰기를 만들지 않는다", () => {
  const html = render(
    { outcome },
    {
      battleReplay: { ...battleReplay, frames: [] },
      battleExitPolicy: "after-playback",
      onAcknowledge: () => undefined,
    },
  );
  expect(html).not.toContain('data-testid="u5-battle-scene"');
  expect(html).not.toContain("전투 건너뛰기");
});
```

`campaign-render.test.tsx`에는 실제 monster outcome이 `battleExitPolicy`를 전달하는지 직접 문자열로 추측하지 말고 `CampaignScreen` 렌더 결과로 검증한다. 고정 seed에서 전투 결과를 가진 monster 사건까지 진행한 뒤 `전투 건너뛰기`가 있고 `지도로 돌아간다`가 없음을 확인한다. 보스 종료 화면은 계속 `정산으로`를 포함해야 한다.

- [ ] **Step 2: 집중 테스트를 실행해 기존 지도 CTA가 너무 일찍 노출되는지 확인한다**

Run: `pnpm test components/game/U5ProgressScreen.test.tsx components/game/campaign-render.test.tsx`

Expected: FAIL — `battleExitPolicy` prop이 없고 결과 화면이 곧바로 `지도로 돌아간다`를 렌더링한다.

- [ ] **Step 3: U5ProgressScreen에서 playback과 우측 CTA를 조합한다**

컴포넌트 본문 시작에서 hook을 항상 호출한다.

```ts
const playback = useU5BattlePlayback(battleReplay);
const gateMapExit = battleExitPolicy === "after-playback"
  && battleReplay !== undefined
  && playback.frame !== undefined
  && !playback.isComplete;

const rightAction = gateMapExit
  ? { label: "전투 건너뛰기", onClick: playback.skipToComplete }
  : onAcknowledge === undefined
    ? null
    : { label: acknowledgeLabel, onClick: onAcknowledge };
```

장면에는 현재 frame이 있을 때만 controlled battle scene을 전달한다.

```tsx
{battleReplay !== undefined && playback.frame !== undefined ? (
  <U5BattleScene
    replay={battleReplay}
    frame={playback.frame}
    onReplayFromStart={playback.replayFromStart}
  />
) : null}
```

우측 하단은 기존 class와 자리를 유지하며 `rightAction` 하나만 렌더한다.

```tsx
{rightAction === null ? null : (
  <button type="button" className="u5-outcome-continue" onClick={rightAction.onClick}>
    {rightAction.label}
  </button>
)}
```

- [ ] **Step 4: CampaignScreen에서 일반 monster outcome만 명시적으로 지정한다**

adapter 결과를 한 번만 만든다.

```tsx
const replay = eventReplayFor(campaign, active);
const gateMonsterBattle = seeing
  && active.pendingOutcome?.event.kind === "monster"
  && active.pendingOutcome.battle !== null;

return (
  <U5ProgressScreen
    // existing props
    battleReplay={replay ?? undefined}
    battleExitPolicy={gateMonsterBattle ? "after-playback" : undefined}
  />
);
```

문구 `"지도로 돌아간다"`, `sceneKind`, `battleReplay !== undefined`만으로 정책을 정하지 않는다.

- [ ] **Step 5: 렌더 테스트와 typecheck를 통과시킨다**

Run: `pnpm test components/game/use-u5-battle-playback.test.ts components/game/U5BattleScene.test.tsx components/game/U5ProgressScreen.test.tsx components/game/campaign-render.test.tsx && pnpm typecheck`

Expected: PASS. 초기 일반전은 skip CTA 하나, 보스전은 `정산으로`, 비전투 결과는 기존 지도 CTA를 가진다.

- [ ] **Step 6: 실제 캠페인 E2E를 새 게이트에 맞춘다**

`e2e/campaign-smoke.spec.ts`의 outcome 이후 기대를 다음 순서로 바꾼다.

```ts
const skip = page.getByRole("button", { name: "전투 건너뛰기" });
await expect(skip).toBeEnabled();
await expect(page.getByRole("button", { name: "지도로 돌아간다" })).toHaveCount(0);

await skip.click();
const returnToMap = page.getByRole("button", { name: "지도로 돌아간다" });
await expect(returnToMap).toBeEnabled();

await page.getByRole("button", { name: "다시 보기" }).click();
await expect(page.getByRole("button", { name: "지도로 돌아간다" })).toHaveCount(0);
await expect(page.getByRole("button", { name: "전투 건너뛰기" })).toBeEnabled();

await page.getByRole("button", { name: "전투 건너뛰기" }).click();
await page.getByRole("button", { name: "지도로 돌아간다" }).click();
await expect(page.getByRole("region", { name: "던전 지도" })).toBeVisible();
```

Run: `pnpm exec playwright test e2e/campaign-smoke.spec.ts --project=chromium`

Expected: PASS. 전투 중에는 지도 CTA가 없고 complete 뒤에만 지도 화면으로 돌아간다.

- [ ] **Step 7: Task 2 변경만 한글 커밋으로 기록한다**

```bash
git add components/game/U5ProgressScreen.tsx components/game/U5ProgressScreen.test.tsx components/game/CampaignScreen.tsx components/game/campaign-render.test.tsx e2e/campaign-smoke.spec.ts
git commit -m "화면: 일반전 중 지도 이동을 잠근다" -m "재생 중에는 우측 하단에서 전투만 건너뛰고 완료 뒤 같은 자리를 지도 복귀로 전환한다."
```

---

### Task 3: 비전투 진행 장면 좌측에 현재 파티를 세운다

**Files:**
- Create: `components/game/U5NonBattlePartyScene.tsx`
- Create: `components/game/U5NonBattlePartyScene.test.tsx`
- Modify: `components/game/U5ProgressScreen.tsx`
- Modify: `components/game/U5ProgressScreen.test.tsx`
- Modify: `app/u5-progress.css`

**Interfaces:**
- Consumes: `readonly U5PartyMemberView[]` from `components/game/u5-progress-model.ts`.
- Produces:

```ts
export interface U5NonBattlePartySceneProps {
  readonly party: readonly U5PartyMemberView[];
}

export function U5NonBattlePartyScene(props: U5NonBattlePartySceneProps): React.ReactNode;
```

- [ ] **Step 1: 초상 순서와 장식 접근성의 실패 테스트를 작성한다**

`U5NonBattlePartyScene.test.tsx`:

```ts
it("초상이 있는 파티원을 안정적인 슬롯 순서로 장식 렌더한다", () => {
  const html = renderToStaticMarkup(createElement(U5NonBattlePartyScene, { party }));
  expect(html).toContain('data-testid="u5-nonbattle-party"');
  expect(html).toContain('aria-hidden="true"');
  expect(html.match(/data-u5-party-scene-slot=/g)).toHaveLength(3);
  expect(html.indexOf("warrior_a.png")).toBeLessThan(html.indexOf("rogue_a.png"));
  expect(html.indexOf("rogue_a.png")).toBeLessThan(html.indexOf("cleric_a.png"));
});

it("초상 경로가 없어도 슬롯은 유지하고 깨진 img는 만들지 않는다", () => {
  const html = renderToStaticMarkup(createElement(U5NonBattlePartyScene, {
    party: [{ ...party[0]!, portraitSrc: undefined }],
  }));
  expect(html).toContain('data-u5-party-scene-slot="0"');
  expect(html).not.toContain("<img");
});
```

`U5ProgressScreen.test.tsx`에는 replay 유무의 상호 배타성을 추가한다.

```ts
it("비전투 장면에는 파티를, 전투 장면에는 battle scene만 둔다", () => {
  const calm = render(threeMemberProgress);
  const battle = render(threeMemberProgress, { battleReplay });
  expect(calm).toContain('data-testid="u5-nonbattle-party"');
  expect(calm).not.toContain('data-testid="u5-battle-scene"');
  expect(battle).not.toContain('data-testid="u5-nonbattle-party"');
  expect(battle).toContain('data-testid="u5-battle-scene"');
});
```

- [ ] **Step 2: 테스트를 실행해 컴포넌트 부재로 실패하는지 확인한다**

Run: `pnpm test components/game/U5NonBattlePartyScene.test.tsx components/game/U5ProgressScreen.test.tsx`

Expected: FAIL — `U5NonBattlePartyScene`이 없고 비전투 장면에 파티 마크업이 없다.

- [ ] **Step 3: 기존 초상만 사용하는 장식 컴포넌트를 구현한다**

```tsx
import Image from "next/image";
import type { U5PartyMemberView } from "./u5-progress-model";

export function U5NonBattlePartyScene({ party }: U5NonBattlePartySceneProps) {
  return (
    <div className="u5-scene-party" data-testid="u5-nonbattle-party" aria-hidden="true">
      {party.slice(0, 3).map((member, index) => (
        <span key={member.id} className="u5-scene-party__slot" data-u5-party-scene-slot={index}>
          {member.portraitSrc === undefined ? null : (
            <Image
              className="u5-scene-party__image"
              src={member.portraitSrc}
              alt=""
              fill
              sizes="12rem"
            />
          )}
        </span>
      ))}
    </div>
  );
}
```

`U5ProgressScreen`의 scene 내부 분기를 다음처럼 만든다.

```tsx
{battleReplay === undefined ? (
  <U5NonBattlePartyScene party={progress.party} />
) : playback.frame === undefined ? null : (
  <U5BattleScene replay={battleReplay} frame={playback.frame} onReplayFromStart={playback.replayFromStart} />
)}
```

- [ ] **Step 4: 좌측 배치와 원본 방향 보존 CSS를 구현한다**

`app/u5-progress.css`에 다음 namespace를 추가한다.

```css
.u5-scene { position: relative; overflow: hidden; }

.u5-scene-party {
  position: absolute;
  inset: auto auto 2% 2%;
  display: flex;
  align-items: end;
  width: 48%;
  height: 92%;
  pointer-events: none;
}

.u5-scene-party__slot {
  position: relative;
  flex: 0 0 33.333%;
  height: 84%;
  filter: drop-shadow(0 0.6rem 0.45rem rgb(0 0 0 / 72%));
}

.u5-scene-party__slot:nth-child(1) { height: 76%; }
.u5-scene-party__slot:nth-child(2) { height: 92%; }
.u5-scene-party__slot:nth-child(3) { height: 83%; }

.u5-scene-party__image { object-fit: contain; object-position: 50% 100%; }
```

실제 PNG를 브라우저에서 보고 `width`, `height`, gap만 조정한다. `scaleX(-1)`, `rotateY(180deg)`, 상태 기반 class는 추가하지 않는다. 장소 문구가 현재 배경 이미지 자체에 없으므로 별도 텍스트를 옮기거나 새로 만들지 않는다.

- [ ] **Step 5: 테스트, typecheck, lint를 실행한다**

Run: `pnpm test components/game/U5NonBattlePartyScene.test.tsx components/game/U5ProgressScreen.test.tsx && pnpm typecheck && pnpm lint`

Expected: PASS. lint error 0; 저장소의 기존 warning은 개수와 종류를 최종 보고에 기록한다.

- [ ] **Step 6: Task 3 변경만 한글 커밋으로 기록한다**

```bash
git add components/game/U5NonBattlePartyScene.tsx components/game/U5NonBattlePartyScene.test.tsx components/game/U5ProgressScreen.tsx components/game/U5ProgressScreen.test.tsx app/u5-progress.css
git commit -m "화면: 비전투 장면에 파티를 세운다" -m "오른쪽을 보는 기존 캐릭터 초상을 진행 장면 좌측에 고정된 깊이 순서로 배치한다."
```

---

### Task 4: 조언 카드 3장을 낮은 A1 금속 명패로 바꾼다

**Files:**
- Modify: `components/game/U5ProgressScreen.tsx`
- Modify: `components/game/U5ProgressScreen.test.tsx`
- Modify: `app/u5-progress.css`

**Interfaces:**
- Consumes: existing `AdviceOption` props and `U5AdviceOptionView` without adding advice truth metadata.
- Produces: identical `.u5-advice__rivets` decorative markup in every advice button and A1 CSS contract.

- [ ] **Step 1: 동일 리벳 구조와 낮은 목록 배치의 실패 테스트를 작성한다**

`U5ProgressScreen.test.tsx`의 동일 카드 계약에 다음 assertion을 추가한다.

```ts
for (const item of items) {
  expect(item.match(/class="u5-advice__rivet/g)).toHaveLength(4);
}
```

CSS 계약 테스트를 구체화한다.

```ts
it("조언 카드는 남은 높이를 채우지 않고 A1 금속 명패로 중앙 정렬한다", () => {
  const sheet = readFileSync("app/u5-progress.css", "utf8");
  expect(sheet).toMatch(/\.u5-advice-list\s*\{[^}]*align-content:\s*center/);
  expect(sheet).toMatch(/\.u5-advice\s*\{[^}]*height:\s*clamp\(/);
  expect(sheet).toMatch(/\.u5-advice__button\s*\{[^}]*clip-path:\s*polygon\(/);
  expect(sheet).toMatch(/\.u5-advice__button\s*\{[^}]*box-shadow:[^}]*inset/);
  expect(sheet).toMatch(/\.u5-advice__rivet\s*\{/);
});
```

- [ ] **Step 2: 테스트를 실행해 기존 full-height 사각 카드 때문에 실패하는지 확인한다**

Run: `pnpm test components/game/U5ProgressScreen.test.tsx`

Expected: FAIL — rivet 마크업이 없고 `.u5-advice-list`가 `minmax(0, 1fr)` 한 행으로 카드를 끝까지 늘린다.

- [ ] **Step 3: 모든 카드에 같은 장식 마크업을 추가한다**

`AdviceOption` 버튼의 첫 자식으로 추가한다.

```tsx
<span className="u5-advice__rivets" aria-hidden="true">
  <i className="u5-advice__rivet is-top-left" />
  <i className="u5-advice__rivet is-top-right" />
  <i className="u5-advice__rivet is-bottom-left" />
  <i className="u5-advice__rivet is-bottom-right" />
</span>
```

slot별 class, inline color, 진실 유형 data attribute는 추가하지 않는다.

- [ ] **Step 4: 낮은 공통 높이와 A1 CSS를 구현한다**

기존 `.u5-advice-list`, `.u5-advice`, `.u5-advice__button`을 다음 의도로 바꾼다.

```css
.u5-advice-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: auto;
  align-content: center;
  gap: clamp(0.4rem, 0.55cqw, 0.85rem);
  margin: 0;
  padding: 0;
  min-height: 0;
  list-style: none;
}

.u5-advice {
  display: grid;
  height: clamp(10.5rem, 23cqh, 14rem);
  min-width: 0;
}

.u5-advice__button {
  position: relative;
  border: 0.125rem solid color-mix(in srgb, var(--color-shell-metal) 72%, var(--color-edge));
  clip-path: polygon(7% 0, 93% 0, 100% 10%, 100% 90%, 93% 100%, 7% 100%, 0 90%, 0 10%);
  background: linear-gradient(145deg, rgb(40 27 16 / 96%), rgb(20 14 9 / 98%));
  box-shadow: inset 0 0 0 0.18rem #120c07, inset 0 0 0 0.25rem #87673c;
}

.u5-advice__rivets { position: absolute; inset: 0; pointer-events: none; }
.u5-advice__rivet {
  position: absolute;
  width: 0.42rem;
  height: 0.42rem;
  border: 1px solid #a68a59;
  border-radius: 50%;
  background: #392a1b;
  box-shadow: inset 0 0.06rem 0.08rem #d4bd87;
}
.u5-advice__rivet.is-top-left { top: 0.55rem; left: 0.72rem; }
.u5-advice__rivet.is-top-right { top: 0.55rem; right: 0.72rem; }
.u5-advice__rivet.is-bottom-left { bottom: 0.55rem; left: 0.72rem; }
.u5-advice__rivet.is-bottom-right { right: 0.72rem; bottom: 0.55rem; }
```

기존 disabled, hover, focus-visible 상태는 잘린 모서리 안에서 읽히도록 유지한다. 긴 merchant 비용·잠금 이유 fixture에서도 overflow가 없어야 하며, 카드별 높이를 따로 늘리지 않는다.

- [ ] **Step 5: 카드 집중 테스트와 고정 캔버스 회귀를 실행한다**

Run: `pnpm test components/game/U5ProgressScreen.test.tsx components/game/U5FixedCanvas.test.ts components/game/u5-advice-presentation.test.ts`

Expected: PASS. 세 카드 구조가 같고 truth metadata가 DOM에 새지 않으며 `vw`, `vh`, `@media`가 없다.

- [ ] **Step 6: Task 4 변경만 한글 커밋으로 기록한다**

```bash
git add components/game/U5ProgressScreen.tsx components/game/U5ProgressScreen.test.tsx app/u5-progress.css
git commit -m "화면: 조언 카드를 낮은 금속 명패로 바꾼다" -m "세 카드의 높이를 함께 줄이고 동일한 팔각 프레임과 이중 테두리, 리벳을 적용한다."
```

---

### Task 5: 실제 화면을 두 viewport에서 검증하고 회귀를 마감한다

**Files:**
- Test: `e2e/campaign-smoke.spec.ts`
- Verify: all files listed in Tasks 1–4

**Interfaces:**
- Consumes: completed Tasks 1–4 and the committed spec.
- Produces: no new runtime interface; produces verification evidence and focused fixes only.

- [ ] **Step 1: 전체 자동 검증을 새 출력으로 실행한다**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm exec playwright test --project=chromium
git diff --check
```

Expected:

- 모든 Vitest와 Playwright 테스트 PASS.
- typecheck와 build PASS.
- lint error 0; 기존 warning은 최종 보고에 실제 개수를 적는다.
- `git diff --check` 출력 없음.
- 전투 수치를 바꾸지 않았으므로 `pnpm backtest`는 실행하지 않는다.

- [ ] **Step 2: 1920×1080 실제 `/campaign` 일반전 흐름을 확인한다**

브라우저에서 다음 순서로 확인한다.

1. `/campaign?seed=dungeon-schemer` 진입.
2. 게시판에서 진입 가능한 계약을 고르고 전투 지점으로 이동.
3. 조언 선택 전 장면 좌측에 원본 방향의 파티 3명이 보이는지 확인.
4. A1 카드 3장이 낮은 공통 높이, 동일 장식, 위아래 여백을 가지는지 확인.
5. 조언을 골라 전투가 시작되면 비전투 파티가 사라지는지 확인.
6. 우측 하단에 `전투 건너뛰기` 하나만 있고 지도 CTA가 없는지 확인.
7. 자연 종료와 건너뛰기 각각에서 `지도로 돌아간다`로 바뀌는지 확인.
8. `다시 보기` 중에는 지도 CTA가 다시 사라지는지 확인.

Expected: 겹침, clipping, 스크롤, hydration/console error 없음.

- [ ] **Step 3: 1024×640에서 같은 계약이 균일 축소되는지 확인한다**

같은 seed와 흐름을 사용한다. 고정 캔버스 내부 좌표 관계가 1920×1080과 같고, 카드 문구·리벳·캐릭터 실루엣·우측 CTA가 잘리지 않아야 한다.

Expected: 레이아웃 재배치 없이 균일 축소, 가로·세로 스크롤 없음.

- [ ] **Step 4: 검증 중 발견한 결함만 테스트 우선으로 수정한다**

결함이 있으면 해당 Task의 가장 가까운 테스트에 재현을 먼저 추가하고 실패를 확인한 뒤 최소 수정한다. 시안과 무관한 리팩터링, 새 자산, 규칙 변경은 하지 않는다.

Run: 해당 집중 테스트 뒤 Step 1 전체 명령을 다시 실행한다.

Expected: 재현 테스트와 전체 suite PASS.

- [ ] **Step 5: 검증 수정이 있을 때만 한글 커밋으로 기록한다**

```bash
git add components/game/use-u5-battle-playback.ts components/game/use-u5-battle-playback.test.ts components/game/u5-battle-test-fixture.ts components/game/U5BattleScene.tsx components/game/U5BattleScene.test.tsx components/game/U5ProgressScreen.tsx components/game/U5ProgressScreen.test.tsx components/game/U5NonBattlePartyScene.tsx components/game/U5NonBattlePartyScene.test.tsx components/game/CampaignScreen.tsx components/game/campaign-render.test.tsx app/u5-progress.css e2e/campaign-smoke.spec.ts
git commit -m "수정: 진행 화면 최종 검증 문제를 바로잡는다" -m "공식 viewport에서 확인된 겹침 또는 전투 CTA 회귀를 재현 테스트와 함께 수정한다."
```

수정이 없으면 빈 커밋을 만들지 않는다.

## Final Review Checklist

- [ ] spec 3.1의 낮은 A1 카드가 Task 4에 구현됐다.
- [ ] spec 3.2의 좌측 비전투 파티와 원본 방향이 Task 3에 구현됐다.
- [ ] spec 4의 replaying/complete/replay 상태가 Tasks 1–2에 구현됐다.
- [ ] complete 전 `onAcknowledge`가 DOM handler로 노출되지 않는다.
- [ ] 일반 몬스터만 gated이고 보스·비전투 CTA 회귀가 없다.
- [ ] 빈 frame, replay 교체, 중복 skip, 빈 portrait 경계를 테스트했다.
- [ ] 접근성의 실제 button, 빈 alt, 단일 live region, focus-visible을 유지했다.
- [ ] 공식 두 viewport와 전체 자동 검증 결과를 기록했다.
