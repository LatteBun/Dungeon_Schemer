# U4 Dungeon Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** E1의 실제 `GeneratedMap`을 기존 16:9 `GameShell` 안에서 공간형 던전 지도로 렌더링하고, U3 스타일의 파티 상태와 실제 캐릭터 live/dead 초상, 키보드 가능한 다음 방 선택, 별도 이동 CTA를 제공한다.

**Architecture:** `GeneratedMap`과 탐험 상태를 순수 ViewModel/레이아웃 함수로 변환한 뒤 `U4DungeonMapScreen`이 렌더링한다. E1 topology와 사건 분류 소유권은 건드리지 않고 `publicKindByNodeId`를 외부 주입하며, `/u4-test`에서만 deterministic fixture를 사용한다. 지도는 PNG 방/통로/상태 오버레이를 DOM으로 조합하고, 기존 `GameShell`/`TopStatusBar`의 60:40 및 1920×1080 고정 16:9 캔버스를 그대로 사용한다.

**Tech Stack:** Next.js 16.3, React 19, TypeScript 5, CSS, Vitest, existing GameShell/FixedCanvas conventions

**Spec:** `docs/superpowers/specs/2026-08-22-sanghwan-yoo-u4-dungeon-map-design.md`

## Global Constraints

- 전체 화면은 U3와 동일한 1920×1080 16:9 고정 캔버스를 사용한다.
- `GameShell` 60:40과 기존 `TopStatusBar`를 재사용하고 U4 때문에 비율을 재정의하지 않는다.
- 새 `vw`, `vh`, media query를 추가하지 않는다. U4 레이아웃은 `rem`, `cqw`, `cqh`를 사용한다.
- 지도는 Entry 아래, Boss 위의 공간형 방/복도 구조로 보이며 별도 범례를 두지 않는다.
- U4는 E1 topology, 사건 콘텐츠, 사건 분류를 생성하지 않는다.
- 실제 통합 입력은 `publicKindByNodeId`; `/u4-test`만 deterministic fixture를 허용한다.
- 예시 화면은 연속 `5 -> 5` Depth를 사용하지 않는다. E1 자체 규칙은 변경하지 않는다.
- 파티 초상은 `public/assets/characters`의 실제 직업별 이미지를 사용한다.
- `alive === false`일 때만 동일 직업/동일 A/B variant의 `/dead/` 이미지로 바꾸고 회색 처리한다.
- 신뢰 0, 중상, 미출전은 dead 이미지를 사용하지 않는다.
- 방 선택과 이동 확정은 분리한다. 방 선택 뒤 우측 CTA로 이동을 확정한다.
- 사용자가 요청하기 전 PR을 만들지 않는다.

---

## File Structure

### New files

- `components/game/u4-dungeon-map-model.ts` — domain input을 U4 표시 상태로 변환, portrait path 결정
- `components/game/u4-dungeon-map-model.test.ts` — room state/public kind/live-dead portrait 계약 테스트
- `components/game/u4-dungeon-map-layout.ts` — Depth 기반 x/y 좌표와 corridor geometry 계산
- `components/game/u4-dungeon-map-layout.test.ts` — Entry/Boss/Depth/5-room 안전영역/layout invariant 테스트
- `components/game/U4DungeonMapScreen.tsx` — 지도, 파티 상태, destination CTA 렌더링
- `components/game/U4DungeonMapScreen.test.tsx` — interaction/accessibility/component contract 테스트
- `components/game/U4Preview.tsx` — 실제 campaign/E1 기반 deterministic 검수 fixture
- `app/u4-test/page.tsx` — 브라우저 검수 route
- `app/u4-dungeon-map.css` — U4 전용 16:9 내부 UI 스타일
- `components/game/U4Assets.test.ts` — U4 asset 경로와 기존 재사용 asset 경로 검증

### Existing files to modify

- `app/layout.tsx` — `./u4-dungeon-map.css` import 한 줄 추가

### Assets to add

- `public/assets/u4/map/*`
- `public/assets/u4/rooms/*`
- `public/assets/u4/icons/*`
- `public/assets/u4/corridors/*`
- `public/assets/u4/states/*`
- `public/assets/u4/navigation/*`

기존 `public/assets/characters/{live|dead}/...`와 `/assets/u2/status-gold.svg`는 복사하지 않고 그대로 참조한다.

---

### Task 1: Add U4 asset tree and asset contract test

**Files:**
- Create: `public/assets/u4/map/...`
- Create: `public/assets/u4/rooms/...`
- Create: `public/assets/u4/icons/...`
- Create: `public/assets/u4/corridors/...`
- Create: `public/assets/u4/states/...`
- Create: `public/assets/u4/navigation/...`
- Create: `components/game/U4Assets.test.ts`

**Interfaces:**
- Consumes: approved transparent U4 PNG files from the current design session
- Produces: stable asset paths used by all later U4 components

- [ ] **Step 1: Write the failing asset-path test**

```ts
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

const U4_ASSETS = [
  "public/assets/u4/map/map_background_base.png",
  "public/assets/u4/map/map_background_vignette.png",
  "public/assets/u4/map/map_atmosphere_ruins_props.png",
  "public/assets/u4/map/map_main_panel_frame.png",
  "public/assets/u4/rooms/room_entry_base.png",
  "public/assets/u4/rooms/room_battle_base.png",
  "public/assets/u4/rooms/room_rest_base.png",
  "public/assets/u4/rooms/room_merchant_base.png",
  "public/assets/u4/rooms/room_special_base.png",
  "public/assets/u4/rooms/room_boss_base.png",
  "public/assets/u4/states/overlay_current_glow.png",
  "public/assets/u4/states/overlay_current_marker.png",
  "public/assets/u4/states/overlay_selectable_glow.png",
  "public/assets/u4/states/overlay_completed_glow.png",
  "public/assets/u4/states/overlay_unvisited_glow.png",
  "public/assets/u4/navigation/destination_panel_frame.png",
  "public/assets/u4/navigation/destination_thumbnail_frame.png",
  "public/assets/u4/navigation/cta_button_left.png",
  "public/assets/u4/navigation/cta_button_center.png",
  "public/assets/u4/navigation/cta_button_right.png",
  "public/assets/u4/navigation/cta_button_arrow.png",
] as const;

describe("U4 assets", () => {
  it.each(U4_ASSETS)("exists: %s", (path) => {
    expect(existsSync(path)).toBe(true);
  });

  it("reuses existing U2/U3 character assets", () => {
    expect(existsSync("public/assets/u2/status-gold.svg")).toBe(true);
    expect(existsSync("public/assets/characters/live/warrior/warrior_a.png")).toBe(true);
    expect(existsSync("public/assets/characters/dead/warrior/warrior_a.png")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test and verify it fails before assets are copied**

Run: `pnpm vitest run components/game/U4Assets.test.ts`

Expected: FAIL for missing `public/assets/u4/...` files.

- [ ] **Step 3: Add approved transparent PNGs to the exact paths**

Use the approved extracted files without baking text into them. Preserve alpha channel. Keep original U2/U3/character assets untouched.

- [ ] **Step 4: Run the asset test**

Run: `pnpm vitest run components/game/U4Assets.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/assets/u4 components/game/U4Assets.test.ts
git commit -m "feat: add U4 dungeon map assets"
```

---

### Task 2: Build U4 map ViewModel and stable live/dead portrait resolver

**Files:**
- Create: `components/game/u4-dungeon-map-model.ts`
- Create: `components/game/u4-dungeon-map-model.test.ts`

**Interfaces:**
- Consumes:
  - `GeneratedMap`
  - `NodeId`
  - `EventKind`
  - Character fields: `id`, `classId`, `alive`, `hp`, `maxHp`, `trust`, `gold`
- Produces:

```ts
export type U4RoomKind = "entry" | "monster" | "rest" | "merchant" | "special" | "boss";
export type U4RoomState = "current" | "visited" | "selectable" | "inactive";

export interface U4MapNodeView {
  id: NodeId;
  kind: U4RoomKind;
  state: U4RoomState;
  nextNodeIds: readonly NodeId[];
}

export interface U4PartyMemberView {
  id: CharacterId;
  name: string;
  classId: ClassId;
  classLabel: string;
  personalityLabel: string;
  hp: number;
  maxHp: number;
  trust: number;
  gold: number;
  alive: boolean;
  portraitSrc: string;
}

export function createU4MapNodeViews(input: {
  map: GeneratedMap;
  currentNodeId: NodeId;
  visitedNodeIds: readonly NodeId[];
  publicKindByNodeId: Readonly<Partial<Record<NodeId, EventKind>>>;
}): readonly U4MapNodeView[];

export function portraitVariantForCharacterId(characterId: CharacterId): "a" | "b";

export function portraitSrcForCharacter(input: {
  id: CharacterId;
  classId: ClassId;
  alive: boolean;
}): string;
```

- [ ] **Step 1: Write failing state and portrait tests**

Cover at minimum:

```ts
it("marks only current next nodes selectable", () => { /* exact fixture map */ });
it("entry and boss kinds come from E1 node kind", () => { /* assert entry/boss */ });
it("uses publicKindByNodeId for normal nodes", () => { /* monster/rest/... */ });
it("keeps visited priority below current and above inactive", () => { /* assert */ });
it("keeps character portrait variant stable", () => {
  expect(portraitVariantForCharacterId(characterId)).toBe(
    portraitVariantForCharacterId(characterId),
  );
});
it("switches live to same dead class and variant", () => {
  const live = portraitSrcForCharacter({ id, classId: warrior, alive: true });
  const dead = portraitSrcForCharacter({ id, classId: warrior, alive: false });
  expect(live.replace("/live/", "/dead/")).toBe(dead);
});
```

For a normal node without a public kind, expect an explicit error instead of inventing a kind.

- [ ] **Step 2: Run test and verify it fails**

Run: `pnpm vitest run components/game/u4-dungeon-map-model.test.ts`

Expected: FAIL because module/functions do not exist.

- [ ] **Step 3: Implement the minimal pure model functions**

Use existing `CLASSES` for class labels and the same personality label mapping semantics as U3. Do not mutate domain objects.

The portrait variant must be deterministic from CharacterId. A simple stable character-code parity/hash is acceptable as long as the same ID always maps to the same `a`/`b` and both live/dead use that same result.

- [ ] **Step 4: Run the model test**

Run: `pnpm vitest run components/game/u4-dungeon-map-model.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/game/u4-dungeon-map-model.ts components/game/u4-dungeon-map-model.test.ts
git commit -m "feat: add U4 map view model"
```

---

### Task 3: Build deterministic Depth layout and corridor geometry

**Files:**
- Create: `components/game/u4-dungeon-map-layout.ts`
- Create: `components/game/u4-dungeon-map-layout.test.ts`

**Interfaces:**
- Consumes: `GeneratedMap`
- Produces:

```ts
export interface U4Point {
  x: number; // normalized 0..1 in map safe area
  y: number; // normalized 0..1, 0 = top
}

export interface U4MapLayout {
  nodePositions: Readonly<Record<NodeId, U4Point>>;
  corridors: readonly {
    from: NodeId;
    to: NodeId;
    start: U4Point;
    end: U4Point;
    length: number;
    angleDeg: number;
  }[];
}

export function createU4DungeonMapLayout(map: GeneratedMap): U4MapLayout;
```

- [ ] **Step 1: Write failing layout tests**

Tests must assert:

```ts
expect(position(entry).x).toBeCloseTo(0.5);
expect(position(entry).y).toBeGreaterThan(position(depth1).y);
expect(position(boss).x).toBeCloseTo(0.5);
expect(position(boss).y).toBeLessThan(position(lastDepth).y);
```

Also assert for a 5-node Depth:

- all x values are unique
- all are within the declared horizontal safe range, e.g. `0.10 <= x <= 0.90`
- x values are ascending in layer order
- every E1 edge appears exactly once in `corridors`
- the function does not add/remove edges

- [ ] **Step 2: Run and verify failure**

Run: `pnpm vitest run components/game/u4-dungeon-map-layout.test.ts`

Expected: FAIL because module is missing.

- [ ] **Step 3: Implement normalized layout**

Use fixed safe areas rather than viewport-dependent heuristics:

- boss y: `0.06`
- general Depth region: `0.14 .. 0.82`
- entry y: `0.93`
- horizontal safe area: `0.10 .. 0.90`

For each Depth, place nodes at evenly spaced centers across the safe area. Use layer order; do not reorder topology in this task.

Calculate corridor `length` and `angleDeg` from normalized deltas.

- [ ] **Step 4: Run layout tests**

Run: `pnpm vitest run components/game/u4-dungeon-map-layout.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/game/u4-dungeon-map-layout.ts components/game/u4-dungeon-map-layout.test.ts
git commit -m "feat: add U4 dungeon map layout"
```

---

### Task 4: Implement U4 screen DOM and interaction

**Files:**
- Create: `components/game/U4DungeonMapScreen.tsx`
- Create: `components/game/U4DungeonMapScreen.test.tsx`

**Interfaces:**
- Consumes:

```ts
export interface U4DungeonMapScreenProps {
  status: TopStatusView;
  dungeonName: string;
  riskLevel: RiskLevel;
  nodes: readonly U4MapNodeView[];
  layout: U4MapLayout;
  party: readonly U4PartyMemberView[];
  selectedNextNodeId: NodeId | null;
  onSelectNextNode: (nodeId: NodeId) => void;
  onMove: (nodeId: NodeId) => void;
}
```

- Produces: accessible `GameShell` U4 screen; no campaign mutation

- [ ] **Step 1: Write failing component tests**

Cover these behaviors:

1. `GameShell` renders with U4 title and party panel.
2. only `state === "selectable"` rooms are enabled buttons.
3. clicking a selectable room calls `onSelectNextNode(nodeId)`.
4. selected room gets `aria-pressed="true"`.
5. CTA disabled when `selectedNextNodeId === null`.
6. CTA enabled after selected node is supplied and calls `onMove(selectedNodeId)`.
7. party shows name/class/personality/HP/trust/gold.
8. gold row uses `/assets/u2/status-gold.svg`.
9. alive member portrait path includes `/live/{class}/`.
10. dead member portrait path includes `/dead/{class}/`, card has death class/label.
11. right/left arrow key moves focus within selectable rooms in visual x-order.

- [ ] **Step 2: Run and verify failure**

Run: `pnpm vitest run components/game/U4DungeonMapScreen.test.tsx`

Expected: FAIL because component is missing.

- [ ] **Step 3: Implement minimal semantic DOM**

Use `GameShell` directly.

Map room rules:

- `selectable` → `<button type="button">`
- current/visited/inactive/boss-nonselectable → non-interactive element
- button `aria-label` includes room kind label
- selection uses `aria-pressed`

Party portrait:

```tsx
<div className="u4-party-card__portrait">
  <img src={member.portraitSrc} alt="" aria-hidden="true" />
</div>
```

Dead card includes visible `사망` text.

CTA uses U4 navigation PNG pieces as decorative layers and real HTML text.

- [ ] **Step 4: Run component tests**

Run: `pnpm vitest run components/game/U4DungeonMapScreen.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/game/U4DungeonMapScreen.tsx components/game/U4DungeonMapScreen.test.tsx
git commit -m "feat: add U4 dungeon map screen"
```

---

### Task 5: Implement U4 visual styling while preserving fixed 16:9 composition

**Files:**
- Create: `app/u4-dungeon-map.css`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: class names emitted by `U4DungeonMapScreen`
- Produces: fixed-canvas U4 composition using `rem/cqw/cqh`

- [ ] **Step 1: Add a CSS contract test/search guard before styling**

Add to `U4DungeonMapScreen.test.tsx` or a focused source test assertions that U4 stylesheet text does not contain:

```ts
expect(css).not.toMatch(/\b\d+(?:\.\d+)?vw\b/);
expect(css).not.toMatch(/\b\d+(?:\.\d+)?vh\b/);
expect(css).not.toMatch(/@media/);
```

- [ ] **Step 2: Run test and verify it fails because stylesheet is missing**

Run: `pnpm vitest run components/game/U4DungeonMapScreen.test.tsx`

- [ ] **Step 3: Implement U4 CSS**

Required styling contract:

- `.u4-dungeon-map-screen` fills available GameShell area, `overflow: hidden`.
- left map panel uses U4 background asset + vignette/atmosphere layers.
- rooms are absolutely positioned from normalized x/y custom properties.
- room image maintains aspect ratio and supports 5 rooms per Depth without overlap.
- current room: green glow + current marker.
- selectable room: gold glow + clear focus-visible outline.
- visited room: grayscale/desaturated and reduced brightness.
- inactive room: darker but still visible.
- boss room remains larger/distinct and uses red-danger treatment.
- corridor elements are thick stone-textured strips rotated from computed geometry.
- right panel is two sections: party status top, destination/CTA bottom.
- portrait slot is square, `object-fit: cover`, `object-position: 50% 0%`.
- dead card applies grayscale/low saturation to portrait/card while retaining readable text.
- U4 CTA is composed from navigation PNGs but remains a real `<button>`.

Use `rem`, `cqw`, `cqh` only for scalable dimensions; `1px` borders are allowed.

- [ ] **Step 4: Import stylesheet in root layout**

Add:

```ts
import "./u4-dungeon-map.css";
```

after existing screen CSS imports.

- [ ] **Step 5: Run component tests and lint on touched files**

Run:

```bash
pnpm vitest run components/game/U4DungeonMapScreen.test.tsx
pnpm lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/u4-dungeon-map.css app/layout.tsx components/game/U4DungeonMapScreen.test.tsx
git commit -m "style: add U4 dungeon map presentation"
```

---

### Task 6: Build deterministic `/u4-test` preview from real campaign and E1 data

**Files:**
- Create: `components/game/U4Preview.tsx`
- Create: `app/u4-test/page.tsx`
- Test: extend `components/game/U4DungeonMapScreen.test.tsx` or create `components/game/U4Preview.test.tsx`

**Interfaces:**
- Consumes:
  - `initializeCampaign`
  - `createBoardOffers`
  - `generateDungeonMap`
  - `createU4MapNodeViews`
  - `createU4DungeonMapLayout`
- Produces: deterministic browser test page

- [ ] **Step 1: Write failing preview test**

Assert preview fixture:

- uses a fixed seed
- generates an actual E1 map
- selected dungeon has a ★3 map shape whose layer widths contain one `5` but no consecutive `5,5`
- party has exactly 3 members with distinct class IDs as supplied by board generation
- `publicKindByNodeId` fixture covers every normal node
- fixture includes at least monster/rest/merchant/special across visible normal nodes

- [ ] **Step 2: Run and verify failure**

Run: `pnpm vitest run components/game/U4Preview.test.tsx`

Expected: FAIL before preview exists.

- [ ] **Step 3: Implement preview fixture**

Use a constant seed such as:

```ts
const PREVIEW_SEED = "u4-dungeon-map-preview";
```

Select/create a campaign dungeon whose `initialRiskLevel === 3`. Call actual E1 generation with deterministic attempt chosen so that the resulting template has no adjacent 5-width layers.

Build `publicKindByNodeId` deterministically by ordered normal nodes for preview only, cycling through:

```ts
["monster", "rest", "merchant", "special"]
```

This fixture is strictly presentation data and must not be exported as game-rule generation.

Set current/visited state at a middle depth so the page simultaneously shows:

- visited path
- current room
- 1–2 selectable next rooms
- inactive branches
- boss room

- [ ] **Step 4: Implement controlled selection state**

`U4Preview` owns only `selectedNextNodeId` and a preview feedback message. Clicking CTA does not mutate campaign; it reports selected node for visual verification.

- [ ] **Step 5: Add route**

```tsx
import { U4Preview } from "@/components/game/U4Preview";

export default function U4TestPage() {
  return <U4Preview />;
}
```

- [ ] **Step 6: Run preview/component/model/layout tests**

Run:

```bash
pnpm vitest run components/game/u4-dungeon-map-model.test.ts components/game/u4-dungeon-map-layout.test.ts components/game/U4DungeonMapScreen.test.tsx components/game/U4Preview.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/game/U4Preview.tsx components/game/U4Preview.test.tsx app/u4-test/page.tsx
git commit -m "feat: add deterministic U4 preview"
```

---

### Task 7: Add explicit dead-party visual fixture coverage

**Files:**
- Modify: `components/game/U4Preview.tsx`
- Modify/Test: `components/game/U4Preview.test.tsx`

**Interfaces:**
- Consumes: existing U4 party view model
- Produces: a deterministic preview/test path proving dead portrait behavior without changing campaign rules

- [ ] **Step 1: Write failing test for death-state preview helper or fixture**

Create a fixture helper that can produce both default-live and one-dead-member UI data without mutating the campaign domain object used by other tests.

Assert:

```ts
expect(deadMember.alive).toBe(false);
expect(deadMember.portraitSrc).toContain("/characters/dead/");
expect(deadMember.portraitSrc).toContain(`/${deadMember.classId}/`);
```

- [ ] **Step 2: Run and verify failure**

Run: `pnpm vitest run components/game/U4Preview.test.tsx`

- [ ] **Step 3: Implement deterministic death-state fixture switch**

Expose a small preview-only control or query-independent toggle button labeled `사망 상태 미리보기` that switches the first member’s UI view to dead while retaining the exact same class and A/B variant. This is for visual inspection only and must not write back to campaign state.

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run components/game/U4Preview.test.tsx components/game/U4DungeonMapScreen.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/game/U4Preview.tsx components/game/U4Preview.test.tsx
git commit -m "test: expose U4 dead portrait preview"
```

---

### Task 8: Full verification and browser review

**Files:**
- No production file required unless verification exposes a defect

**Interfaces:**
- Consumes: completed U4 branch
- Produces: verified branch and user-review screenshots

- [ ] **Step 1: Run focused U4 tests**

```bash
pnpm vitest run components/game/U4Assets.test.ts components/game/u4-dungeon-map-model.test.ts components/game/u4-dungeon-map-layout.test.ts components/game/U4DungeonMapScreen.test.tsx components/game/U4Preview.test.tsx
```

Expected: all PASS.

- [ ] **Step 2: Run full repository checks**

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Expected: all exit 0.

- [ ] **Step 3: Start the app**

```bash
pnpm dev
```

Open `/u4-test`.

- [ ] **Step 4: Verify 1920×1080**

Check:

- canvas fills 16:9 without scroll
- top bar remains U3-compatible
- left/right stays 60:40
- 5-room Depth fits without overlap
- Entry bottom / Boss top
- current/selectable/visited/inactive readable without legend
- party portraits are square upper-body crop
- CTA is fully visible

Capture screenshot.

- [ ] **Step 5: Verify 2560×1440**

Check exact same internal composition and line breaks, no scroll. Capture screenshot.

- [ ] **Step 6: Verify 1440×900**

Check centered 16:9 canvas with letterbox and unchanged internal composition. Capture screenshot if useful.

- [ ] **Step 7: Verify 1280×1024**

Check centered 16:9 canvas with larger letterbox, no clipping or scroll.

- [ ] **Step 8: Verify death preview**

Toggle `사망 상태 미리보기` and confirm:

- same party member keeps same class
- corresponding `/dead/` artwork appears
- portrait/card is grayscale/low saturation
- visible `사망` state appears
- other two members remain live

Capture at least one screenshot showing the normal U4 screen; optionally capture the dead-state version separately.

- [ ] **Step 9: Commit any verification-only fixes**

If fixes were required:

```bash
git add <fixed-files>
git commit -m "fix: polish U4 viewport fidelity"
```

Do not create a PR.

---

### Task 9: Hand off branch for Codespaces review

**Files:** none

**Interfaces:**
- Consumes: pushed `feature/u4-dungeon-map`
- Produces: reproducible reviewer workflow

- [ ] **Step 1: Confirm branch comparison against main**

```bash
git fetch origin
git log --oneline origin/main..origin/feature/u4-dungeon-map
git diff --stat origin/main...origin/feature/u4-dungeon-map
```

- [ ] **Step 2: Provide Codespaces checkout commands to the user**

```bash
git fetch origin
git switch feature/u4-dungeon-map
# If the local branch does not exist yet:
# git switch --track origin/feature/u4-dungeon-map
pnpm install
pnpm dev
```

Then open the forwarded port’s `/u4-test` path.

- [ ] **Step 3: State explicitly that no PR has been created**

Wait for user visual review and explicit PR instruction.
