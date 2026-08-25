# U4 지도 이동 버튼 눌림 잔상 수정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지도 이동 CTA의 눌림 이미지를 기본 이미지 위에 정확히 겹쳐 버튼 아래쪽 잔상을 없앤다.

**Architecture:** U4의 기존 DOM과 이동 상태 흐름은 유지하고 CSS에서 눌림 판의 배치만 바로잡는다. 정적 CSS 계약과 실제 Chromium 배치 검사를 함께 추가해 선언과 브라우저 결과를 모두 고정하며, 공식 U4 문서에 버튼 경계 계약을 기록한다.

**Tech Stack:** Next.js 16.3.0 App Router, React 19, TypeScript, CSS, Vitest 4, Playwright 1.62

**Spec:** `docs/superpowers/specs/2026-08-25-lattebun-u4-move-button-pressed-ghost-design.md`

**작성자:** LatteBun  
**작성 도구:** Codex  
**작성일:** 2026-08-25

## Global Constraints

- 눌림 상태의 시각 피드백은 유지하되 CTA의 실제 경계 안에서만 표시한다.
- DOM 구조, 이미지 에셋, CTA 문구와 클릭 callback은 변경하지 않는다.
- 버튼 전체의 `overflow`를 바꿔 증상을 가리지 않고 눌림 판의 배치 자체를 수정한다.
- `VISIT_NODE`와 보스방의 `ENTER_BOSS` dispatch 순서는 변경하지 않는다.
- 새 `vw`, `vh`, 미디어 쿼리 또는 의존성을 추가하지 않는다.
- 사용자의 기존 미추적 `.pnpm-store/`와 `public/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/` 파일은 수정하거나 커밋하지 않는다.
- 모든 커밋 메시지는 제목과 본문을 모두 한글로 작성한다.

---

## File Map

| 파일 | 책임 | 변경 |
| --- | --- | --- |
| `components/game/U4FixedCanvas.test.ts` | U4 CSS 선언의 고정 캔버스·레이어 계약 | 눌림 판의 절대 겹침과 `:active` 투명도 계약 추가 |
| `e2e/campaign-smoke.spec.ts` | 실제 캠페인의 인트로→지도→첫 사건 Chromium 흐름 | 클릭 직전 두 CTA 판의 브라우저 좌표와 눌림 상태 검사 추가 |
| `app/u4-dungeon-map.css` | U4 지도와 이동 CTA의 기본 시각 상태 | 눌림 판을 skin 기준 `position: absolute; inset: 0`으로 배치 |
| `docs/experience/U4_DUNGEON_MAP.md` | U4 화면의 공식 UI 계약 | CTA 눌림 피드백의 버튼 내부 경계 기록 |

도메인, Store, `U4DungeonMapScreen.tsx`, `CampaignScreen.tsx`, U5 화면과 이미지
에셋은 변경하지 않는다.

---

### Task 1: 눌림 판 겹침을 테스트 우선으로 수정한다

**Files:**
- Modify: `components/game/U4FixedCanvas.test.ts`
- Modify: `e2e/campaign-smoke.spec.ts`
- Modify: `app/u4-dungeon-map.css:660-673`

**Interfaces:**
- Consumes: `MoveButton`이 렌더링하는 `.u4-move-button__center`와 `.u4-move-button__center--active`, 기존 `:active` 선택자
- Produces: 기본 판과 같은 skin 영역에 고정되고 클릭 중에만 보이는 눌림 판 CSS 계약

- [ ] **Step 1: 정적 CSS 회귀 테스트를 작성한다**

`components/game/U4FixedCanvas.test.ts`의 `U4 fixed 16:9 canvas contract`
describe 안, 기존 CTA 가시성 테스트 다음에 아래 테스트를 추가한다.

```ts
it("keeps the pressed move-button skin over the default skin", () => {
  const base = readFileSync("app/u4-dungeon-map.css", "utf8");
  const pressed = base.match(
    /\.u4-move-button__center--active\s*\{([^}]*)\}/,
  )?.[1] ?? "";
  const active = base.match(
    /\.u4-move-button:not\(:disabled\):active \.u4-move-button__center--active\s*\{([^}]*)\}/,
  )?.[1] ?? "";

  expect(pressed).toMatch(/position:\s*absolute/);
  expect(pressed).toMatch(/inset:\s*0/);
  expect(active).toMatch(/opacity:\s*1/);
});
```

- [ ] **Step 2: 실제 Chromium 배치 회귀 테스트를 작성한다**

`e2e/campaign-smoke.spec.ts`에서 `await expect(move).toBeEnabled();` 다음의
`await move.click();`을 아래 코드로 교체한다. 기본 판과 눌림 판의 좌표를 비교한
뒤 눌림 상태에서 투명도가 1이 되는지 확인하고, `mouse.up()`으로 기존 이동
클릭을 그대로 완료한다.

```ts
const defaultSkin = move.locator(
  ".u4-move-button__center:not(.u4-move-button__center--active)",
);
const pressedSkin = move.locator(".u4-move-button__center--active");
const [defaultBox, pressedBox] = await Promise.all([
  defaultSkin.boundingBox(),
  pressedSkin.boundingBox(),
]);
expect(defaultBox).not.toBeNull();
expect(pressedBox).not.toBeNull();
if (defaultBox !== null && pressedBox !== null) {
  expect(Math.abs(pressedBox.x - defaultBox.x)).toBeLessThan(1);
  expect(Math.abs(pressedBox.y - defaultBox.y)).toBeLessThan(1);
  expect(Math.abs(pressedBox.width - defaultBox.width)).toBeLessThan(1);
  expect(Math.abs(pressedBox.height - defaultBox.height)).toBeLessThan(1);
}

await move.hover();
await page.mouse.down();
await expect(pressedSkin).toHaveCSS("opacity", "1");
await page.mouse.up();
```

- [ ] **Step 3: 두 회귀 테스트가 기존 코드에서 실패하는지 확인한다**

Run:

```bash
pnpm test components/game/U4FixedCanvas.test.ts
```

Expected: FAIL. `.u4-move-button__center--active`에 `position: absolute`와
`inset: 0`이 없어 정적 계약이 실패한다.

Run:

```bash
pnpm exec playwright test e2e/campaign-smoke.spec.ts --project=chromium
```

Expected: FAIL. 눌림 판의 `y` 좌표가 기본 판의 높이만큼 아래여서 좌표 비교가
실패한다. 기존 개발 서버가 떠 있어 다른 revision을 제공한다면 종료한 뒤
Playwright가 `playwright.config.ts`의 포트 3100 서버를 시작하게 한다.

- [ ] **Step 4: 눌림 판을 기본 판 위에 겹치는 최소 CSS를 작성한다**

`app/u4-dungeon-map.css`의 `.u4-move-button__center--active`를 다음과 같이
수정한다.

```css
.u4-move-button__center--active {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 90ms ease;
}
```

`overflow`, DOM, 이미지 `src`, 이벤트 handler는 변경하지 않는다.

- [ ] **Step 5: 정적 계약과 실제 클릭 흐름이 통과하는지 확인한다**

Run:

```bash
pnpm test components/game/U4FixedCanvas.test.ts components/game/U4DungeonMapScreen.test.tsx
```

Expected: PASS. 눌림 판 겹침 계약과 기존 U4 컴포넌트 계약이 모두 통과한다.

Run:

```bash
pnpm exec playwright test e2e/campaign-smoke.spec.ts --project=chromium
```

Expected: PASS. 두 판의 좌표·크기가 1px 미만 오차로 일치하고, 마우스를 누른
동안 눌림 판의 opacity가 1이며 첫 사건 화면으로 정상 전환된다.

- [ ] **Step 6: 코드와 회귀 테스트를 커밋한다**

```bash
git add app/u4-dungeon-map.css components/game/U4FixedCanvas.test.ts e2e/campaign-smoke.spec.ts
git commit -m "수정: 지도 이동 버튼의 눌림 잔상을 없앤다" -m "눌림 판을 기본 판 위에 겹치고 CSS와 Chromium 배치 회귀 검사를 추가한다."
```

---

### Task 2: 공식 문서를 동기화하고 전체 검증한다

**Files:**
- Modify: `docs/experience/U4_DUNGEON_MAP.md:66-70`

**Interfaces:**
- Consumes: Task 1이 보장하는 버튼 내부 눌림 판 배치
- Produces: 구현과 일치하는 U4 공식 CTA 시각 계약과 전체 검증 기록

- [ ] **Step 1: U4 공식 문서에 눌림 상태 경계를 기록한다**

`docs/experience/U4_DUNGEON_MAP.md`의 `## 7. 사용자 행동` 목록 다음에 아래
문단을 추가한다.

```md
`이 지점으로 이동` CTA의 눌림 판은 기본 판과 같은 버튼 경계 안에서만 겹쳐
표시한다. 버튼 아래나 다음 화면에 별도 이미지가 잔상처럼 나타나서는 안 된다.
```

- [ ] **Step 2: 관련 테스트와 정적 검사를 실행한다**

Run:

```bash
pnpm test components/game/U4FixedCanvas.test.ts components/game/U4DungeonMapScreen.test.tsx
pnpm typecheck
pnpm lint
git diff --check
```

Expected: 모든 명령이 exit code 0이고 `git diff --check` 출력이 없다.

- [ ] **Step 3: 전체 단위·브라우저 회귀를 실행한다**

Run:

```bash
pnpm test
pnpm test:e2e
```

Expected: 전체 Vitest와 Chromium E2E가 PASS한다. FHD 1920×1080을 포함한
고정 캔버스 검사에서 새 스크롤·canvas 밖 이미지가 없고, 캠페인 smoke에서
지도 CTA가 첫 사건 화면으로 정상 전환된다.

- [ ] **Step 4: 변경 범위를 점검한다**

Run:

```bash
git status --short
git diff --stat HEAD
git diff HEAD -- app/u4-dungeon-map.css components/game/U4FixedCanvas.test.ts e2e/campaign-smoke.spec.ts docs/experience/U4_DUNGEON_MAP.md
```

Expected: Task 1에서 커밋한 CSS와 테스트 세 파일에는 미커밋 diff가 없고, HEAD
대비 diff에는 Task 2의 U4 공식 문서 한 개만 포함된다. 기존 미추적
`.pnpm-store/`와 `public/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/`는 그대로
남지만 staging과 diff에는 포함되지 않는다.

- [ ] **Step 5: 공식 문서 변경을 커밋한다**

```bash
git add docs/experience/U4_DUNGEON_MAP.md
git commit -m "문서: 지도 이동 CTA의 눌림 경계를 기록한다" -m "눌림 판이 버튼 안에서만 표시되고 화면 아래에 잔상을 남기지 않는 계약을 명시한다."
```

- [ ] **Step 6: 완료 직전 커밋 상태를 확인한다**

Run:

```bash
git status --short
git log -3 --oneline
```

Expected: 구현 관련 추적 파일은 깨끗하고, spec 커밋 뒤에 코드·테스트 커밋과
공식 문서 커밋이 한국어 제목으로 보인다. 사용자 소유 미추적 파일만 남는다.
