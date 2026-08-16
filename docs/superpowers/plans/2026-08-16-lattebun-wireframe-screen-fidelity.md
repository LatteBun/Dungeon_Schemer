# 와이어프레임 화면 충실도 구현 계획

> **에이전트 작업자에게:** 필수 하위 스킬 — `superpowers:subagent-driven-development`(권장) 또는 `superpowers:executing-plans`로 Task 단위로 구현한다. 단계는 체크박스(`- [ ]`)로 추적한다.

**목표:** 대표 화면 5개의 패널 배치·순서·표시 항목을 `docs/diagram/png`의 와이어프레임과 일치시킨다.

**설계:** `PlayChrome`을 HUD 셸로 축소하고 레이아웃 소유권을 각 라우트로 옮긴다. 화면 제목은 캠페인 상태에서 파생한다. 이미 계산되어 있으나 렌더되지 않는 값(`trustDelta`, `isBoss`, `InfoSceneView`)을 드러낸다.

**기술 스택:** Next.js 16.3.0 App Router, React 19.2.8, TypeScript 5 strict, Tailwind CSS 4, Zustand 5.0.14, Vitest 4.1.10(`environment: node`), pnpm 11.21.0.

**Spec:** `docs/superpowers/specs/2026-08-16-lattebun-wireframe-screen-fidelity-design.md`

## 전역 제약

- **`lib/rules/**`와 `lib/flow/**`를 고치지 않는다.** 규칙 트랙은 sbh3821 소유다. `pnpm backtest` 후 `git diff docs/technical/BACKTEST_REPORT.md`가 비어야 한다.
- **새 도메인 필드를 만들지 않는다.** `CampaignState`·`CampaignMember`를 확장하지 않는다.
- **DOM 테스트를 쓰지 않는다.** Vitest가 `environment: node`이고 `@testing-library`가 없다. 로직은 view-model 테스트로, 컴포넌트는 typecheck·lint·build와 브라우저로 게이트한다.
- **`Math.random`을 쓰지 않는다.** eslint가 막는다.
- **규칙 함수를 JSX 안에서 호출하지 않는다.** 렌더마다 재실행되고 `RuleError`가 페이지를 백지로 만든다. 핸들러에서 부르고 결과를 state에 담는다.
- **import 경계:** `components/**`는 `@/lib/mock` 금지. `components/ui/**`는 추가로 `@/lib/domain` 금지. `lib/**`는 `components/**`를 import하지 않는다.
- **`aria-selected`를 `<button>`에 쓰지 않는다.** 선택 상태는 `aria-pressed`다.
- **고정 픽셀 레이아웃을 만들지 않는다.** 반응형을 유지하고 가로 스크롤을 만들지 않는다.
- 커밋 메시지는 제목·본문 모두 한글이며 본문에 "왜"를 적는다.

## 파일 구조

| 파일 | 책임 | 상태 |
| --- | --- | --- |
| `components/game/campaign-view-model.ts` | `toScreenTitle` 추가 | 수정 |
| `components/game/campaign-view-model.test.ts` | `toScreenTitle` 테스트 | 수정 |
| `components/game/CampaignHeader.tsx` | 제목 + 칩 5개 | 수정 |
| `app/play/play-chrome.tsx` | HUD 셸. 파티 사이드바 제거 | 수정 |
| `app/play/expedition-party-aside.tsx` | 파티 사이드바 + footer 슬롯 | 신설 |
| `components/game/MapLegend.tsx` | 지도 범례 | 신설 |
| `components/game/DungeonMapView.tsx` | 지도만. 범례·버튼 분리, 보스 별 도형 | 수정 |
| `components/game/EncounterScenePanel.tsx` | 관람 영역 | 신설 |
| `components/game/InfoCardChoices.tsx` | 정보 카드 3장 | 신설 |
| `components/game/InfoOpportunityPanel.tsx` | 삭제 (위 둘로 대체) | 삭제 |
| `components/game/EventActions.tsx` | 관람 영역을 밖으로 뺀 행동 목록 | 수정 |
| `components/game/SettlementTimeline.tsx` | 6칸 한 줄 | 수정 |
| `components/game/EndingPanel.tsx` | 중앙 헤더 + 2열 + 버튼 | 수정 |
| `lib/stores/campaign-store.ts` | `lastTrustDeltas` | 수정 |
| `lib/stores/campaign-store.test.ts` | `lastTrustDeltas` 테스트 | 수정 |
| `app/play/page.tsx` | 01 그리드 | 수정 |
| `app/play/map/page.tsx` | 02 3열 | 수정 |
| `app/play/encounter/page.tsx` | 03 관람/조작 | 수정 |
| `app/play/result/page.tsx` | 05 엔딩 버튼 배선 | 수정 |
| `app/u2-test/page.tsx` | 바뀐 시그니처 추종 | 수정 |
| `app/u3-test/page.tsx` | 바뀐 시그니처 추종 | 수정 |

---

## Task 1: 화면 제목 파생

**Files:**
- Modify: `components/game/campaign-view-model.ts`
- Modify: `components/game/CampaignHeader.tsx`
- Modify: `app/play/play-chrome.tsx`
- Test: `components/game/campaign-view-model.test.ts`

**Interfaces:**
- Consumes: `CampaignState`(`@/lib/domain`), 기존 `toCampaignHeaderView`
- Produces:
  - `toScreenTitle(state: CampaignState): string`
  - `CampaignHeaderProps`에 `title: string` 추가

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`components/game/campaign-view-model.test.ts` 끝에 추가한다. 이 파일은 이미
`createFixtureCampaignState`를 `@/lib/rules/fixtures`에서 가져온다. 같은 모듈의
`createFixtureExpeditionState`를 import에 더한다 — 던전 `dungeon-001`, 파티
`party-001`을 가리키므로 픽스처 캠페인과 그대로 맞물린다.

```ts
function stateWithExpedition(phase: CampaignState["phase"]): CampaignState {
  return {
    ...createFixtureCampaignState(),
    phase,
    expedition: createFixtureExpeditionState(),
  };
}

describe("toScreenTitle", () => {
  it("게시판과 계약 단계는 같은 제목을 쓴다", () => {
    const base = createFixtureCampaignState();
    expect(toScreenTitle({ ...base, phase: "board" })).toBe("캠페인 게시판");
    expect(toScreenTitle({ ...base, phase: "contract" })).toBe("캠페인 게시판");
  });

  it("엔딩 단계는 고정 제목을 쓴다", () => {
    const base = createFixtureCampaignState();
    expect(toScreenTitle({ ...base, phase: "ended" })).toBe("캠페인 엔딩");
  });

  it("지도 단계는 던전 이름을 앞에 붙인다", () => {
    expect(toScreenTitle(stateWithExpedition("map"))).toBe(
      "C급 1번 · 공개 분기 지도",
    );
  });

  it("단계마다 다른 제목을 낸다", () => {
    const titles = (
      ["map", "infoOpportunity", "event", "boss"] as const
    ).map((phase) => toScreenTitle(stateWithExpedition(phase)));
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("보스와 정산은 같은 제목을 쓴다", () => {
    expect(toScreenTitle(stateWithExpedition("boss"))).toBe(
      toScreenTitle(stateWithExpedition("settlement")),
    );
  });

  it("탐험이 없으면 던전 이름 없이도 문장이 성립한다", () => {
    const base = createFixtureCampaignState();
    expect(toScreenTitle({ ...base, phase: "map" })).toBe("공개 분기 지도");
  });
});
```

**규칙 함수나 전이 함수를 부르지 않는다.** 픽스처만으로 충분하다.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `pnpm vitest run components/game/campaign-view-model.test.ts`
Expected: FAIL — `toScreenTitle is not a function` 또는 export 없음

- [ ] **Step 3: `toScreenTitle`을 구현한다**

`components/game/campaign-view-model.ts` 끝에 추가한다. `numericSuffix`는 같은 파일 79행에 이미 있고 `toBoardView`가 던전 이름을 만들 때 쓰는 헬퍼다. 새로 만들지 말고 그것을 쓴다.

```ts
/**
 * 화면 제목은 phase와 현재 탐험에서 전부 파생된다.
 * 페이지가 layout 위쪽 HUD에 제목을 올리려면 context가 필요하므로
 * 셸이 상태에서 파생하게 두어 그 비용을 없앤다.
 */
export function toScreenTitle(state: CampaignState): string {
  const expedition = state.expedition;
  const dungeon =
    expedition === null
      ? undefined
      : state.dungeons.find((candidate) => candidate.id === expedition.dungeonId);
  const dungeonLabel =
    dungeon === undefined
      ? null
      : `${dungeon.grade}급 ${numericSuffix(dungeon.id)}번`;

  const withDungeon = (suffix: string): string =>
    dungeonLabel === null ? suffix : `${dungeonLabel} · ${suffix}`;

  switch (state.phase) {
    case "board":
    case "contract":
      return "캠페인 게시판";
    case "map":
      return withDungeon("공개 분기 지도");
    case "infoOpportunity":
      return withDungeon("정보 전달");
    case "event":
      return withDungeon("사건");
    case "boss":
    case "settlement":
      return withDungeon("자동 보스전 결과");
    case "ended":
      return "캠페인 엔딩";
  }
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `pnpm vitest run components/game/campaign-view-model.test.ts`
Expected: PASS

- [ ] **Step 5: 검사의 판별력을 확인한다**

`case "map"`의 `withDungeon("공개 분기 지도")`와 `case "boss"`의
`withDungeon("자동 보스전 결과")`를 서로 바꾼다.

Run: `pnpm vitest run components/game/campaign-view-model.test.ts`
Expected: 두 개가 실패한다 — "지도 단계는 던전 이름을 앞에 붙인다"(기대
`C급 1번 · 공개 분기 지도`, 실제 `C급 1번 · 자동 보스전 결과`)와
"보스와 정산은 같은 제목을 쓴다"(boss만 바뀌어 settlement와 갈린다).
**하나만 실패하면 테스트가 부족한 것이니 보고한다.**

실패를 확인한 뒤 **되돌리고** `git diff --stat`으로 복원을 확인한다. 확인 내용을 PR 본문에 적는다.

- [ ] **Step 6: `CampaignHeader`에 제목을 넣는다**

`components/game/CampaignHeader.tsx`의 props와 최상단을 바꾼다.

```tsx
interface CampaignHeaderProps {
  title: string;
  view: CampaignHeaderView;
}

export function CampaignHeader({ title, view }: CampaignHeaderProps) {
```

`<header>`의 첫 자식으로 제목을 넣고, 칩들이 오른쪽으로 밀리게 한다.

```tsx
    <header className="flex flex-wrap items-center gap-2">
      <h1 className="mr-auto text-lg font-semibold text-parchment">{title}</h1>
```

나머지 칩 5개의 `<div>`는 그대로 둔다.

- [ ] **Step 7: `PlayChrome`이 제목을 넘긴다**

`app/play/play-chrome.tsx`에서 import에 `toScreenTitle`을 추가하고 호출을 바꾼다.

```tsx
      <CampaignHeader
        title={toScreenTitle(campaign)}
        view={toCampaignHeaderView(campaign)}
      />
```

- [ ] **Step 8: 검증하고 커밋한다**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: 전부 통과

```bash
git add components/game/campaign-view-model.ts components/game/campaign-view-model.test.ts components/game/CampaignHeader.tsx app/play/play-chrome.tsx
git commit -m "$(cat <<'EOF'
화면: 공통 HUD에 화면 제목을 붙인다

와이어프레임은 모든 화면의 HUD 왼쪽에 지금 무엇을 보고 있는지를 적는다.
현재 HUD는 칩 다섯 개뿐이라 화면이 바뀌어도 머리글이 같다.

제목을 페이지가 셸에 올리지 않고 셸이 상태에서 파생한다. Next의 layout은
children만 받으므로 페이지가 위쪽 HUD에 값을 주려면 context가 필요한데,
제목은 phase와 현재 탐험만으로 전부 정해지므로 파생이 더 싸다.

toScreenTitle의 map과 boss 반환값을 맞바꿔 테스트가 실패하는 것을
확인한 뒤 되돌렸다.
EOF
)"
```

---

## Task 2: 셸 축소와 파티 사이드바 분리

**Files:**
- Create: `app/play/expedition-party-aside.tsx`
- Modify: `app/play/play-chrome.tsx`
- Modify: `app/play/page.tsx`

**Interfaces:**
- Consumes: `toScreenTitle`(Task 1), `PartyStatusSidebar`, `toPartyStatusView`
- Produces:
  - `ExpeditionPartyAside({ footer }: { footer?: ReactNode }): ReactNode | null`
    스토어에서 출전 파티원을 읽어 `PartyStatusSidebar`를 그린다. 참가자가 없으면 `null`.

- [ ] **Step 1: `ExpeditionPartyAside`를 만든다**

`app/play/expedition-party-aside.tsx`를 새로 만든다. `PlayChrome`에 있던 참가자 계산을 그대로 옮긴다.

```tsx
"use client";

import type { ReactNode } from "react";
import { PartyStatusSidebar } from "@/components/game/PartyStatusSidebar";
import { toPartyStatusView } from "@/components/game/expedition-view-model";
import { useCampaignStore } from "@/lib/stores/campaign-store-provider";

/**
 * 출전 파티 상태. 오른쪽 패널은 화면마다 다르므로 셸이 아니라
 * 필요한 라우트가 직접 놓는다.
 */
export function ExpeditionPartyAside({ footer }: { footer?: ReactNode }) {
  const campaign = useCampaignStore((store) => store.campaign);
  const expedition = campaign.expedition;
  const party = expedition === null
    ? undefined
    : campaign.parties.find((candidate) => candidate.id === expedition.partyId);
  const participantIds = new Set((party?.memberIds ?? []).map(String));
  const participants = campaign.members.filter((member) =>
    participantIds.has(member.id as string),
  );

  if (participants.length === 0) return null;

  return (
    <PartyStatusSidebar
      members={toPartyStatusView(participants)}
      footer={footer}
    />
  );
}
```

- [ ] **Step 2: `PlayChrome`에서 사이드바를 걷어낸다**

`app/play/play-chrome.tsx`를 통째로 바꾼다.

```tsx
"use client";

import type { ReactNode } from "react";
import { CampaignHeader } from "@/components/game/CampaignHeader";
import {
  toCampaignHeaderView,
  toScreenTitle,
} from "@/components/game/campaign-view-model";
import { useCampaignStore } from "@/lib/stores/campaign-store-provider";

/** 모든 캠페인 화면에 영구 진행을 유지한다. 레이아웃은 각 라우트가 소유한다. */
export function PlayChrome({ children }: { children: ReactNode }) {
  const campaign = useCampaignStore((store) => store.campaign);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-3 p-3">
      <CampaignHeader
        title={toScreenTitle(campaign)}
        view={toCampaignHeaderView(campaign)}
      />
      <main className="flex flex-1 flex-col gap-3">{children}</main>
    </div>
  );
}
```

`PartyStatusSidebar`와 `toPartyStatusView` import가 남으면 lint가 잡는다.

- [ ] **Step 3: 01 게시판의 그리드를 와이어프레임 비율로 바꾼다**

`app/play/page.tsx`의 반환 그리드만 바꾼다.

```tsx
    <div className="grid gap-3 lg:grid-cols-[3fr_2fr]">
```

게시판 화면은 오른쪽 `ContractPanel`이 파티를 보여주므로 `ExpeditionPartyAside`를 쓰지 않는다.

- [ ] **Step 4: 검증한다**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: 전부 통과

이 시점에서 지도·사건 화면의 파티 사이드바가 **사라져 있다.** Task 3·4가 각각 되돌려 놓는다. 중간 상태이므로 정상이다.

- [ ] **Step 5: 커밋한다**

```bash
git add app/play/expedition-party-aside.tsx app/play/play-chrome.tsx app/play/page.tsx
git commit -m "$(cat <<'EOF'
화면: 셸을 HUD로 줄이고 레이아웃을 라우트로 옮긴다

셸이 참가자가 있으면 항상 PartyStatusSidebar를 띄우는데, 정보 전달
화면은 PartyReactionSidebar를 따로 띄운다. 오른쪽 사이드바가 두 개
겹쳐 나오는 결함이 여기서 나왔다.

와이어프레임에서 오른쪽 패널은 화면마다 다르다. 게시판은 계약·파티,
지도는 파티 상태, 정보 전달은 개인별 반응이고 정산과 엔딩은 없다.
셸이 그걸 알아야 하는 구조가 원인이므로 셸을 HUD로 줄이고 오른쪽
패널을 필요한 라우트가 직접 놓게 한다.

지도와 사건 화면의 파티 사이드바는 다음 커밋들이 각각 되돌려 놓는다.
EOF
)"
```

---

## Task 3: 지도 화면 3열과 보스 도형

**Files:**
- Create: `components/game/MapLegend.tsx`
- Modify: `components/game/DungeonMapView.tsx`
- Modify: `app/play/map/page.tsx`
- Modify: `app/u2-test/page.tsx`

**Interfaces:**
- Consumes: `MapView`·`MapNodeView`(`expedition-view-model`), `ExpeditionPartyAside`(Task 2)
- Produces:
  - `MapLegend(): ReactNode` — props 없음
  - `DungeonMapView({ view, selectedNodeId, onSelectNode }): ReactNode`
    — **`onEnterNode` prop이 사라진다.** 입장 버튼은 호출부가 놓는다.

- [ ] **Step 1: `MapLegend`를 만든다**

`components/game/MapLegend.tsx`를 새로 만든다. `DungeonMapView`의 범례 `<Panel>` 내용을 그대로 옮기되, 보스 줄을 기호가 아니라 도형으로 설명한다.

```tsx
import { Panel } from "@/components/ui/Panel";
import { EVENT_KIND_MARKS } from "./labels";

/**
 * 보스방은 기호가 아니라 도형으로 구분한다.
 * EVENT_KIND_MARKS.special 과 보스의 categoryMark 가 둘 다 ★ 라서
 * 기호만으로는 같은 표시가 두 뜻을 갖는다.
 */
export function MapLegend() {
  return (
    <Panel title="범례">
      <ul className="flex flex-col gap-1 text-xs text-muted">
        <li>◎ 현재 위치</li>
        <li>✓ 방문 완료</li>
        <li>→ 선택 가능</li>
        <li>× 비활성</li>
        <li className="mt-2">{EVENT_KIND_MARKS.monster} 몬스터</li>
        <li>{EVENT_KIND_MARKS.rest} 휴식</li>
        <li>{EVENT_KIND_MARKS.merchant} 상인</li>
        <li>{EVENT_KIND_MARKS.special} 특수 사건</li>
        <li>? 정보 전달 기회</li>
        <li className="mt-2">보스방은 별 도형</li>
        <li>그 밖의 지점은 원</li>
        <li className="mt-2">전체 연결·대략 위험·보스 위치 공개</li>
        <li>색 + 기호 + 도형으로 구분</li>
      </ul>
    </Panel>
  );
}
```

- [ ] **Step 2: `DungeonMapView`에서 범례와 버튼을 걷어낸다**

`components/game/DungeonMapView.tsx`를 바꾼다.

props에서 `onEnterNode`를 지운다.

```tsx
interface DungeonMapViewProps {
  view: MapView;
  selectedNodeId: NodeId | null;
  onSelectNode: (id: NodeId) => void;
}
```

`Panel` import는 남기고 `EVENT_KIND_MARKS` import를 지운다(범례로 옮겼다). 최상단 `<div className="grid ...">`와 범례 `<Panel>`을 지우고 지도 `<Panel>` 하나만 반환한다. 맨 아래 `<button>`도 지운다. `<p className="mt-2 text-xs text-muted">{view.caption}</p>`는 남긴다.

- [ ] **Step 3: 보스 노드를 별 도형으로 그린다**

같은 파일에 별 좌표 헬퍼를 추가한다.

```tsx
/** 반지름 r의 5각 별 좌표. 원과 같은 자리에 놓이도록 중심이 (0,0)이다. */
function starPoints(r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(
      `${(radius * Math.cos(angle)).toFixed(2)},${(radius * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return points.join(" ");
}
```

노드를 그리는 `<g>` 안의 `<circle>`을 `isBoss`로 분기한다.

```tsx
                {node.isBoss ? (
                  <polygon
                    points={starPoints(30)}
                    fill={selected ? "var(--color-edge)" : "var(--color-panel)"}
                    stroke={NODE_STROKE[node.state]}
                    strokeWidth={selected ? 4 : 2}
                    strokeDasharray={node.state === "inactive" ? "4 3" : undefined}
                  />
                ) : (
                  <circle
                    r={26}
                    fill={selected ? "var(--color-edge)" : "var(--color-panel)"}
                    stroke={NODE_STROKE[node.state]}
                    strokeWidth={selected ? 4 : 2}
                    strokeDasharray={node.state === "inactive" ? "4 3" : undefined}
                  />
                )}
```

`<text>` 두 줄은 그대로 둔다.

- [ ] **Step 4: 지도 페이지를 3열로 만든다**

`app/play/map/page.tsx`의 반환부를 바꾼다. import에 `MapLegend`와 `ExpeditionPartyAside`를 추가한다.

```tsx
  return (
    <div className="grid gap-3 lg:grid-cols-[13rem_1fr_18rem]">
      <MapLegend />
      <DungeonMapView
        view={view}
        selectedNodeId={selectedNodeId}
        onSelectNode={setSelectedNodeId}
      />
      <ExpeditionPartyAside
        footer={
          <button
            type="button"
            disabled={selectedNodeId === null}
            onClick={() => {
              if (selectedNodeId !== null) {
                dispatch({ type: "selectNode", nodeId: selectedNodeId });
              }
            }}
            className="w-full rounded border border-edge px-3 py-2 text-sm text-parchment enabled:hover:bg-edge disabled:opacity-40"
          >
            선택 지점 입장 · 정보 기회 →
          </button>
        }
      />
    </div>
  );
```

- [ ] **Step 5: u2 하네스를 따라 고친다**

`app/u2-test/page.tsx`에서 `DungeonMapView`에 넘기던 `onEnterNode`를 지우고, 하네스가 다음 지점으로 넘어가던 동작을 별도 버튼으로 옮긴다. 하네스가 `MapLegend`도 함께 보여주도록 `DungeonMapView` 옆에 놓는다. **하네스의 기존 로컬 `useState` 구동 방식은 그대로 둔다.**

- [ ] **Step 6: 검증한다**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: 전부 통과. build가 통과하면 하네스 추종이 끝났다는 뜻이다

- [ ] **Step 7: 브라우저로 확인한다**

```bash
pnpm dev &
timeout 40 bash -c 'until curl -sf http://localhost:3000 >/dev/null; do sleep 1; done'
```

`http://localhost:3000/play`에서 공고를 계약하고 지도까지 간다. 확인할 것:

- 범례 / 지도 / 파티가 가로로 셋
- 보스 지점이 별 도형
- 입장 버튼이 오른쪽 파티 패널 아래
- 지점을 키보드 Tab으로 옮기고 Enter로 선택 가능
- 창을 1024px로 좁히면 세로로 쌓이고 가로 스크롤이 없음

끝나면 `lsof -ti:3000 -sTCP:LISTEN | xargs -r kill`

- [ ] **Step 8: 커밋한다**

```bash
git add components/game/MapLegend.tsx components/game/DungeonMapView.tsx app/play/map/page.tsx app/u2-test/page.tsx
git commit -m "$(cat <<'EOF'
화면: 지도를 범례·지도·파티 3열로 세운다

와이어프레임은 범례와 지도와 파티 상태를 한 줄에 나란히 둔다. 지금은
범례가 지도 컴포넌트 안에 md 기준으로 중첩돼 있고 파티는 셸이 lg 기준으로
붙여, md 너비에서 범례와 지도만 가로가 되고 파티는 아래로 쌓였다.
범례를 컴포넌트로 분리해 세 패널이 같은 기준으로 한 줄에 놓이게 한다.

보스방을 별 도형으로 그린다. EVENT_KIND_MARKS.special 과 보스의
categoryMark 가 둘 다 ★ 라서 범례가 같은 기호를 특수 사건과 보스방
두 뜻으로 가르치고 있었다. 기호를 바꾸면 다른 화면과 테스트에 번지므로
보스만 도형을 달리해 구분한다. 계산만 되고 쓰이지 않던 isBoss 를 쓴다.

입장 버튼은 와이어프레임 자리인 오른쪽 파티 패널 아래로 옮긴다.
PartyStatusSidebar 에 이미 있으나 쓰이지 않던 footer 슬롯을 쓴다.
EOF
)"
```

---

## Task 4: 관람 영역 분리와 사이드바 겹침 해소

**Files:**
- Create: `components/game/EncounterScenePanel.tsx`
- Create: `components/game/InfoCardChoices.tsx`
- Delete: `components/game/InfoOpportunityPanel.tsx`
- Modify: `components/game/EventActions.tsx`
- Modify: `app/play/encounter/page.tsx`
- Modify: `app/u2-test/page.tsx`

**Interfaces:**
- Consumes: `InfoOpportunityView`·`InfoSceneView`·`EventView`(`expedition-view-model`), `ExpeditionPartyAside`(Task 2)
- Produces:
  - `EncounterScenePanel({ title, sceneText, riskSummary, memberNames }): ReactNode`
    - `title: string`, `sceneText: string`, `riskSummary: string`
    - `memberNames: { id: MemberId; name: string; alive: boolean }[]`
  - `InfoCardChoices({ cards, selectedCardId, onSelectCard }): ReactNode`
    - `cards: InfoCardView[]`
  - `EventActions({ view, selectedChoiceId, onSelectChoice, onAdvance }): ReactNode`
    — **관람 영역을 그리지 않는다.** 행동 목록만 그린다.

- [ ] **Step 1: `EncounterScenePanel`을 만든다**

`components/game/EncounterScenePanel.tsx`를 새로 만든다. 사망자를 산 사람과 다르게 표시한다.

```tsx
import { Panel } from "@/components/ui/Panel";
import type { MemberId } from "@/lib/domain";

interface EncounterScenePanelProps {
  title: string;
  sceneText: string;
  riskSummary: string;
  memberNames: { id: MemberId; name: string; alive: boolean }[];
}

/** 와이어프레임의 관람 영역. 정보 전달과 사건이 같은 머리 영역을 쓴다. */
export function EncounterScenePanel({
  title,
  sceneText,
  riskSummary,
  memberNames,
}: EncounterScenePanelProps) {
  return (
    <Panel title={`관람 영역 · ${title}`}>
      <ul className="flex flex-wrap gap-2">
        {memberNames.map((member) => (
          <li
            key={member.id}
            className={`rounded-full border px-3 py-1 text-xs ${
              member.alive
                ? "border-edge text-parchment"
                : "border-dashed border-trust-down text-trust-down"
            }`}
          >
            {member.name}
            {member.alive ? null : " · 사망"}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-parchment">{sceneText}</p>
      <p className="mt-1 text-xs text-trust-down">{riskSummary}</p>
    </Panel>
  );
}
```

- [ ] **Step 2: `InfoCardChoices`를 만든다**

`components/game/InfoCardChoices.tsx`를 새로 만든다. 카드 목록은 `InfoOpportunityPanel`에 있던 것을 그대로 옮긴다.

```tsx
import { Panel } from "@/components/ui/Panel";
import type { CardId } from "@/lib/domain";
import type { InfoCardView } from "./expedition-view-model";

interface InfoCardChoicesProps {
  cards: InfoCardView[];
  selectedCardId: CardId | null;
  onSelectCard: (id: CardId) => void;
}

/** 와이어프레임의 조작 영역 1. 카드 한 장을 고른다. */
export function InfoCardChoices({
  cards,
  selectedCardId,
  onSelectCard,
}: InfoCardChoicesProps) {
  return (
    <Panel title="조작 영역 · 정보 카드 한 장">
      <ul className="grid gap-2 sm:grid-cols-3">
        {cards.map((card) => {
          const selected = card.cardId === selectedCardId;
          const border = card.dashed
            ? "border-dashed border-trust-down"
            : "border-edge";
          return (
            <li key={card.cardId}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelectCard(card.cardId)}
                className={`w-full rounded border px-3 py-2 text-left ${border} ${selected ? "bg-edge" : "hover:bg-edge"}`}
              >
                <p className="text-sm text-parchment">
                  {card.truthMark} {card.truthLabel} 카드
                </p>
                <p className="mt-1 text-xs text-parchment">“{card.text}”</p>
                <p className="mt-1 text-xs text-muted">{card.expectedNote}</p>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
```

- [ ] **Step 3: `InfoOpportunityPanel`을 지운다**

```bash
rg -n "InfoOpportunityPanel"
```

`app/play/encounter/page.tsx`와 `app/u2-test/page.tsx`만 나와야 한다. **다른 곳이 나오면 지우지 말고 보고한다.**

```bash
git rm components/game/InfoOpportunityPanel.tsx
```

- [ ] **Step 4: `EventActions`에서 관람 부분을 뺀다**

`components/game/EventActions.tsx`를 읽고, 제목·설명·`riskSummary`를 그리던 줄을 지운다. `Panel`의 제목을 `"조작 영역 · 사건 행동"`으로 바꾸고 선택지 목록과 진행 버튼만 남긴다. props 시그니처는 바꾸지 않는다 — `view`가 여전히 `disabled`·`disabledReason`을 담고 있다.

- [ ] **Step 5: 사건·정보 화면을 다시 배치한다**

`app/play/encounter/page.tsx`의 두 반환부를 바꾼다. import를 `InfoOpportunityPanel` 대신 `EncounterScenePanel`·`InfoCardChoices`·`ExpeditionPartyAside`로 바꾼다.

`infoOpportunity` 분기의 반환:

```tsx
    const infoView = toInfoOpportunityView(
      pending,
      (cardId) => {
        const card = CAMPAIGN_CONTEXT.cards.find(
          (candidate) => candidate.id === cardId,
        );
        if (card === undefined) {
          throw new Error(`콘텐츠에 없는 카드입니다: ${cardId}`);
        }
        return card;
      },
      node,
      event,
      participants,
    );

    return (
      <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-3">
          <EncounterScenePanel
            title={event.title}
            sceneText={infoView.scene.sceneText}
            riskSummary={infoView.scene.riskSummary}
            memberNames={infoView.scene.memberNames}
          />
          <InfoCardChoices
            cards={infoView.cards}
            selectedCardId={selectedCardId}
            onSelectCard={(cardId) => {
              const review = prepareInfoCardReview(
                campaign,
                cardId,
                CAMPAIGN_CONTEXT,
              );
              setSelectedCardId(review.selectedCardId);
              setReactions(review.reactions);
            }}
          />
          {selectedCardId === null ? null : (
            <button
              type="button"
              onClick={() => {
                const cardId = selectedCardId;
                setSelectedCardId(null);
                setReactions([]);
                dispatch({ type: "chooseInfoCard", cardId });
              }}
              className="rounded border border-edge px-3 py-2 text-sm text-parchment hover:bg-edge"
            >
              정보 반응 확인 완료 · 사건 행동으로 →
            </button>
          )}
        </div>
        <PartyReactionSidebar reactions={reactions} />
      </div>
    );
```

`event` 분기의 반환:

```tsx
  const eventView = toEventView(
    event,
    campaign.currentGold,
    (itemId) => CAMPAIGN_CONTEXT.items.find(
      (candidate) => candidate.id === itemId,
    ),
  );

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-3">
        <EncounterScenePanel
          title={eventView.title}
          sceneText={eventView.description}
          riskSummary={eventView.riskSummary}
          memberNames={participants.map((member) => ({
            id: member.id,
            name: member.name,
            alive: member.alive,
          }))}
        />
        <EventActions
          view={eventView}
          selectedChoiceId={selectedChoiceId}
          onSelectChoice={setSelectedChoiceId}
          onAdvance={() => {
            if (selectedChoiceId !== null) {
              dispatch({ type: "chooseEvent", choiceId: selectedChoiceId });
            }
          }}
        />
      </div>
      <ExpeditionPartyAside />
    </div>
  );
```

`toInfoOpportunityView`와 `toEventView`가 JSX 밖에서 호출되는 것을 확인한다. **JSX 안으로 옮기지 않는다.**

- [ ] **Step 6: u2 하네스를 따라 고친다**

`app/u2-test/page.tsx`에서 `InfoOpportunityPanel` 사용부를 `EncounterScenePanel` + `InfoCardChoices`로 바꾸고, `EventActions`가 더 이상 관람 부분을 그리지 않으므로 하네스에도 `EncounterScenePanel`을 놓는다.

- [ ] **Step 7: 검증한다**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: 전부 통과

- [ ] **Step 8: 브라우저로 겹침 해소를 확인한다**

`pnpm dev` 후 정보 전달 화면까지 간다. 확인할 것:

- 오른쪽 사이드바가 **하나뿐**이고 "개인별 정보 반응"이다
- 위쪽에 관람 영역, 아래에 카드 3장
- 카드를 고르면 오른쪽에 개인별 반응이 뜬다
- "정보 반응 확인 완료"로 넘어가면 사건 화면에도 위쪽 관람 영역이 유지되고, 오른쪽은 파티 상태다

- [ ] **Step 9: 커밋한다**

```bash
git add -A components/game app/play/encounter/page.tsx app/u2-test/page.tsx
git commit -m "$(cat <<'EOF'
화면: 관람 영역과 조작 영역을 나눈다

와이어프레임은 정보 전달 화면을 위쪽 관람 영역과 아래쪽 조작 영역으로
나눈다. 지금은 상황 문장과 파티와 위험과 카드가 한 패널에 눌려 있어
무엇이 보는 것이고 무엇이 고르는 것인지 구분되지 않는다.

관람 영역을 사건 화면도 함께 쓴다. EventView 에 title 과 description 과
riskSummary 가 이미 있어 그대로 들어가고, 정보에서 사건으로 넘어갈 때
위쪽이 유지되어 흐름이 끊기지 않는다.

오른쪽 사이드바 겹침이 사라진다. 셸이 파티 상태를 띄우고 이 화면이
개인별 반응을 또 띄워 둘이 겹쳐 있었다. 이제 정보 전달은 반응만,
사건은 파티 상태만 놓는다.
EOF
)"
```

---

## Task 5: 신뢰 증감 배선

**Files:**
- Modify: `lib/stores/campaign-store.ts`
- Modify: `lib/stores/campaign-store.test.ts`
- Modify: `app/play/encounter/page.tsx`
- Modify: `app/play/expedition-party-aside.tsx`

**Interfaces:**
- Consumes: `prepareInfoCardReview`(`app/play/encounter/info-review.ts`), `toPartyStatusView(members, trustDeltaById)`
- Produces:
  - `CampaignStoreState.lastTrustDeltas: Record<string, number> | null`
  - `CampaignStoreActions.rememberTrustDeltas(deltas: Record<string, number>): void`

- [ ] **Step 1: 실패하는 스토어 테스트를 쓴다**

`lib/stores/campaign-store.test.ts` 끝에 추가한다. 이 파일은 이미 `CONTEXT`(14행)와
`initializeCampaign`(10행 import)을 갖고 있다. 새 헬퍼를 만들지 않는다.

게시판을 열어야 공고가 생기고, **잠기지 않은 공고를 골라야 한다** —
`advanceToBoss`가 쓰는 방식과 같다. `board[0]`은 잠겨 있을 수 있다.

```ts
describe("lastTrustDeltas", () => {
  it("처음에는 비어 있다", () => {
    const store = createCampaignStore(initializeCampaign("u4-deltas"), CONTEXT);
    expect(store.getState().lastTrustDeltas).toBeNull();
  });

  it("기억한 값을 그대로 돌려준다", () => {
    const store = createCampaignStore(initializeCampaign("u4-deltas"), CONTEXT);
    store.getState().rememberTrustDeltas({ "member-001": 3, "member-002": -14 });
    expect(store.getState().lastTrustDeltas).toEqual({
      "member-001": 3,
      "member-002": -14,
    });
  });

  it("새 계약을 수락하면 지난 신뢰 변화를 비운다", () => {
    const store = createCampaignStore(initializeCampaign("u4-deltas"), CONTEXT);
    store.getState().dispatch({ type: "openBoard" });
    store.getState().rememberTrustDeltas({ "member-001": 3 });

    const offer = store
      .getState()
      .campaign.board.find((candidate) => !candidate.locked)!;
    store.getState().dispatch({ type: "acceptContract", offerId: offer.id });

    expect(store.getState().lastTrustDeltas).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `pnpm vitest run lib/stores/campaign-store.test.ts`
Expected: FAIL — `rememberTrustDeltas is not a function`

- [ ] **Step 3: 스토어에 필드와 액션을 넣는다**

`lib/stores/campaign-store.ts`를 고친다.

```ts
export interface CampaignStoreState {
  campaign: CampaignState;
  lastBossResolution: BossResolution | null;
  lastSettlementSteps: SettlementStep[] | null;
  /** 보스전 직전 출전 파티. 전투 전 HP를 화면에 보여주려면 여기서만 얻을 수 있다. */
  membersBeforeBoss: CampaignMember[] | null;
  /**
   * 마지막 정보 카드가 만든 개인별 신뢰 증감.
   * MemberReactionView 는 components 의 타입이므로 숫자 맵만 담아
   * lib 이 components 를 가져오는 방향 역전을 막는다.
   */
  lastTrustDeltas: Record<string, number> | null;
}

export interface CampaignStoreActions {
  dispatch(action: CampaignAction): void;
  rememberTrustDeltas(deltas: Record<string, number>): void;
  startCampaign(seed: string): void;
  resetCampaign(): void;
}
```

`EMPTY_RESULTS`에 `lastTrustDeltas: null`을 넣는다. 이렇게 하면 `acceptContract`·`startCampaign`·`resetCampaign`이 전부 함께 비운다.

```ts
const EMPTY_RESULTS = {
  lastBossResolution: null,
  lastSettlementSteps: null,
  membersBeforeBoss: null,
  lastTrustDeltas: null,
} as const;
```

`dispatch`의 마지막 `set` 호출에 `lastTrustDeltas: get().lastTrustDeltas`를 넣지 **않는다** — 명시하지 않으면 zustand가 기존 값을 유지한다. 액션을 추가한다.

```ts
    rememberTrustDeltas: (deltas) => {
      set({ lastTrustDeltas: deltas });
    },
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `pnpm vitest run lib/stores/campaign-store.test.ts`
Expected: PASS

- [ ] **Step 5: 검사의 판별력을 확인한다**

`EMPTY_RESULTS`에서 `lastTrustDeltas: null`을 지운다.

Run: `pnpm vitest run lib/stores/campaign-store.test.ts`
Expected: FAIL — "새 계약을 수락하면 지난 신뢰 변화를 비운다"

되돌리고 `git diff --stat`으로 복원을 확인한다.

- [ ] **Step 6: 카드 선택이 증감을 기억하게 한다**

`app/play/encounter/page.tsx`의 `onSelectCard` 콜백에 한 줄을 더한다. 스토어 액션은 `useCampaignStore`로 꺼낸다.

```tsx
  const rememberTrustDeltas = useCampaignStore(
    (store) => store.rememberTrustDeltas,
  );
```

```tsx
            onSelectCard={(cardId) => {
              const review = prepareInfoCardReview(
                campaign,
                cardId,
                CAMPAIGN_CONTEXT,
              );
              setSelectedCardId(review.selectedCardId);
              setReactions(review.reactions);
              rememberTrustDeltas(
                Object.fromEntries(
                  review.reactions.map((reaction) => [
                    reaction.memberId as string,
                    reaction.trustDelta,
                  ]),
                ),
              );
            }}
```

- [ ] **Step 7: 사이드바가 증감을 읽게 한다**

`app/play/expedition-party-aside.tsx`에서 스토어의 값을 읽어 넘긴다.

```tsx
  const trustDeltas = useCampaignStore((store) => store.lastTrustDeltas);
```

```tsx
    <PartyStatusSidebar
      members={toPartyStatusView(participants, trustDeltas ?? {})}
      footer={footer}
    />
```

- [ ] **Step 8: 검증하고 브라우저로 확인한다**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`

`pnpm dev` 후 정보 카드를 고르고 사건 화면으로 넘어간다. 오른쪽 파티 상태의 신뢰 옆에 `▲`나 `▼`가 보여야 한다. 다음 공고를 계약하면 사라져야 한다.

- [ ] **Step 9: 커밋한다**

```bash
git add lib/stores/campaign-store.ts lib/stores/campaign-store.test.ts app/play/encounter/page.tsx app/play/expedition-party-aside.tsx
git commit -m "$(cat <<'EOF'
저장소: 정보 카드가 만든 신뢰 증감을 화면까지 잇는다

와이어프레임의 파티 상태는 신뢰 옆에 증감을 함께 보여준다.
PartyStatusSidebar 는 이미 ▲▼ 를 그릴 줄 아는데 toPartyStatusView 를
두 번째 인자 없이 부르고 있어 증감이 늘 0이었다.

전이 함수는 신뢰 변화를 돌려주지 않는다. 대신 정보 화면이
prepareInfoCardReview 로 개인별 증감을 이미 계산하고 있으므로 그 결과를
스토어가 기억하게 한다. 규칙은 고치지 않는다.

스토어에는 숫자 맵만 담는다. MemberReactionView 는 components 의
타입이라 lib 이 그것을 가져오면 의존 방향이 뒤집힌다.

EMPTY_RESULTS 에서 lastTrustDeltas 를 빼 테스트가 실패하는 것을
확인한 뒤 되돌렸다.
EOF
)"
```

---

## Task 6: 정산과 엔딩 화면 계층

**Files:**
- Modify: `components/game/SettlementTimeline.tsx`
- Modify: `components/game/EndingPanel.tsx`
- Modify: `app/play/result/page.tsx`
- Modify: `app/u3-test/page.tsx`

**Interfaces:**
- Consumes: `SettlementStepView`·`EndingView`(`settlement-view-model`), `CampaignStoreActions.startCampaign`
- Produces:
  - `EndingPanel({ view, onRestart }): ReactNode` — `onRestart: () => void` 추가

- [ ] **Step 1: 정산 6칸을 한 줄로 만든다**

`components/game/SettlementTimeline.tsx`의 `<ol>` 클래스만 바꾼다.

```tsx
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
```

**6칸을 5칸으로 묶지 않는다.** 와이어프레임이 5칸이지만 `SETTLEMENT_STEP_ORDER`가 단일 출처다.

- [ ] **Step 2: 엔딩 화면의 계층을 세운다**

`components/game/EndingPanel.tsx`를 통째로 바꾼다. 헤더를 `Panel` 밖 중앙 정렬로 올린다.

```tsx
import { Panel } from "@/components/ui/Panel";
import type { EndingView } from "./settlement-view-model";

interface EndingPanelProps {
  view: EndingView;
  onRestart: () => void;
}

export function EndingPanel({ view, onRestart }: EndingPanelProps) {
  const summary = view.summary;

  return (
    <div className="flex flex-col gap-3">
      <header className="text-center">
        <p className="text-xs text-muted">시드 {summary.seed}</p>
        <h2 className="mt-1 text-4xl font-semibold text-parchment">
          {view.endingLabel}
        </h2>
        <p className="mt-2 text-sm text-muted">{view.reason}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_1fr]">
        <Panel title="최종 영구 길잡이 등급">
          <p className="text-center text-6xl font-semibold text-trust-up">
            {view.finalRank}
          </p>
          <p className="mt-2 text-center text-xs text-muted">
            승급 점수 {view.promotionScore}
            {view.nextGrade === null
              ? " · 최고 등급"
              : ` · 다음 ${view.nextGrade.grade} ${view.nextGrade.threshold}`}
          </p>
        </Panel>

        <Panel title="캠페인 요약">
          <ul className="grid gap-1 text-xs text-muted sm:grid-cols-2">
            <li>클리어 던전 {summary.clearedDungeons} / {summary.totalDungeons}</li>
            <li>완성 파티 {summary.completeParties}팀</li>
            <li>생존 용사 {summary.aliveMembers}명 · 생존률 {summary.survivalRate}%</li>
            <li>사망 용사 {summary.deadMembers}명</li>
            <li>최종 명성 {summary.finalReputation}</li>
            <li>골드 {summary.currentGold} / 누적 {summary.cumulativeGold}</li>
          </ul>
        </Panel>
      </div>

      <Panel title="캠페인 회고">
        <p className="text-center text-sm text-parchment">{view.retrospective}</p>
      </Panel>

      <button
        type="button"
        onClick={onRestart}
        className="rounded border border-edge px-3 py-2 text-sm text-parchment hover:bg-edge"
      >
        새 캠페인 시작 →
      </button>
    </div>
  );
}
```

와이어프레임의 `대표 정보 선택` 열과 나머지 버튼 둘은 데이터가 없어 넣지 않는다.

- [ ] **Step 3: 엔딩 버튼을 배선한다**

`app/play/result/page.tsx`의 마지막 반환부를 바꾼다. 스토어에서 `startCampaign`을 꺼낸다.

```tsx
  const startCampaign = useCampaignStore((store) => store.startCampaign);
```

```tsx
  return (
    <EndingPanel
      view={ending}
      onRestart={() => {
        startCampaign(`${campaign.seed}-next`);
        router.replace(ROUTE_BY_PHASE.board);
      }}
    />
  );
```

`campaign.seed`의 실제 필드명을 `CampaignState`에서 확인해 맞춘다. `EndingView.summary.seed`가 이미 시드를 담고 있으면 그것을 쓴다.

- [ ] **Step 4: u3 하네스를 따라 고친다**

`app/u3-test/page.tsx`가 `EndingPanel`을 쓰면 `onRestart`를 넘긴다. 하네스에서는 아무것도 하지 않는 함수로 충분하다.

```tsx
        <EndingPanel view={endingView} onRestart={() => {}} />
```

- [ ] **Step 5: 검증한다**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: 전부 통과

- [ ] **Step 6: 커밋한다**

```bash
git add components/game/SettlementTimeline.tsx components/game/EndingPanel.tsx app/play/result/page.tsx app/u3-test/page.tsx
git commit -m "$(cat <<'EOF'
화면: 정산과 엔딩의 계층을 와이어프레임에 맞춘다

와이어프레임의 엔딩은 엔딩 이름과 판정 원인과 최종 등급을 가장 크게
보여준다. 지금은 한 패널 안에 작은 제목으로 눌려 있어 무엇이 결론인지
읽히지 않는다. 머리글을 패널 밖 중앙으로 올리고 등급과 요약을 두 열로
나눈다.

정산은 여섯 칸을 유지한다. 와이어프레임이 다섯 칸으로 그렸지만
SETTLEMENT_STEP_ORDER 가 단일 출처다. 한 줄로 읽히도록 열 수만 맞춘다.

새 캠페인 시작 버튼을 넣는다. 스토어에 startCampaign 이 이미 있는데
엔딩 화면에서 다음으로 갈 길이 없었다. 와이어프레임의 나머지 버튼 둘과
대표 정보 선택 열은 데이터가 없어 넣지 않는다.
EOF
)"
```

---

## Task 7: 전체 검증과 브라우저 대조

**Files:**
- 변경 없음. 검증만 한다.

**Interfaces:**
- Consumes: Task 1~6의 결과 전부

- [ ] **Step 1: 검증 넷을 돌린다**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: 전부 통과

- [ ] **Step 2: 규칙을 건드리지 않았는지 확인한다**

```bash
git diff --stat main -- lib/rules lib/flow
```

Expected: 출력 없음. **출력이 있으면 멈추고 보고한다.**

```bash
pnpm backtest
git diff --stat docs/technical/BACKTEST_REPORT.md
```

Expected: 출력 없음. 보고서가 달라졌다면 규칙에 영향을 준 것이다.

- [ ] **Step 3: 브라우저로 5개 화면을 대조한다**

```bash
pnpm dev &
timeout 40 bash -c 'until curl -sf http://localhost:3000 >/dev/null; do sleep 1; done'
```

스크래치패드에서 `npm install playwright-core@1.62.1 --no-save` 후,
`executablePath`를 `C:/Users/김대연/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe`로 잡아 1920×1080 뷰포트로 `/play`를 끝까지 진행하며 5개 화면을 캡처한다. **SVG는 `innerText()`가 듣지 않으니 `textContent()`를 쓴다.**

캡처를 `docs/diagram/png/screen-0N-*.png`와 나란히 놓고 확인한다. 픽셀이 아니라 아래 항목을 본다.

| 화면 | 확인 |
| --- | --- |
| 01 | HUD에 제목, 왼쪽 공고 목록, 오른쪽 계약·파티 3인 |
| 02 | 범례 / 지도 / 파티 3열, 보스가 별 도형, 입장 버튼이 파티 아래 |
| 03 | 위 관람 영역 / 아래 카드 3장, 오른쪽 사이드바 **하나** |
| 04 | 보스 결과 3인 → 정산 6칸 한 줄 |
| 05 | 중앙 엔딩 이름, 등급/요약 2열, 회고, 새 캠페인 버튼 |

- [ ] **Step 4: 좁은 폭을 확인한다**

같은 스크립트로 뷰포트를 1024×768과 768×1024로 바꿔 5개 화면을 다시 연다.

- 패널이 세로로 쌓인다
- `document.documentElement.scrollWidth <= window.innerWidth` 가 참이다 (가로 스크롤 없음)

- [ ] **Step 5: 지도 키보드 조작을 확인한다**

지도 화면에서 Tab으로 선택 가능한 지점에 초점이 가고 Enter와 Space로 선택되는지 본다. **`Q1`이 다시 볼 항목이지만 이번 작업이 도형을 바꿨으므로 회귀가 없는지 여기서 확인한다.**

- [ ] **Step 6: 개발 서버를 끈다**

```bash
lsof -ti:3000 -sTCP:LISTEN | xargs -r kill
```

- [ ] **Step 7: 배정표에서 U4를 완료로 바꾼다**

**먼저 main과 동기화한다.** 배정표는 여러 PR이 건드리는 파일이다.

```bash
git fetch origin
git merge origin/main
```

`docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`에서 `U4` 행의 상태를 `🟡`에서 `✅`로 바꾸고, `Q1` 행의 `선행`에서 `U4`를 지워 `—`로 만든다.

```bash
pnpm vitest run docs/technical/PROTOTYPE_WORK_ASSIGNMENT.test.ts
```

Expected: 15개 통과

- [ ] **Step 8: 커밋한다**

```bash
git add docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md
git commit -m "$(cat <<'EOF'
문서: 배정표에서 U4 완료를 반영한다

U4 를 완료로 바꾸고 Q1 의 선행에서 지운다. Q1 이 시작 가능해진다.
EOF
)"
```

- [ ] **Step 9: PR을 연다**

PR 본문에 적을 것:

- 남의 코드를 고쳤는지 — **이번에는 규칙 트랙을 고치지 않았다.** `git diff --stat main -- lib/rules lib/flow`가 비었음을 적는다
- 발동을 확인한 검사 둘: `toScreenTitle`의 map/boss 맞바꾸기, `EMPTY_RESULTS`에서 `lastTrustDeltas` 빼기. 각각 어떤 테스트가 실패했는지와 되돌렸음을 적는다
- 대조한 5개 화면의 캡처 결과 요약
- 범위 밖으로 남긴 것과 후속 ID(`C5`·`C6`·`B1`)

**승인을 받은 뒤에는 이 브랜치에 push하지 않는다.** `dismiss_stale_reviews_on_push`가 켜져 있어 승인이 날아간다. 고칠 것이 생기면 별도 PR로 낸다.
