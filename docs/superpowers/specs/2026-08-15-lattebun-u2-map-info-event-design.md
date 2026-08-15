# U2 던전 지도·정보 전달·사건 화면 설계

> 상태: 사용자 검토 요청
> 작성일: 2026-08-15
> 작성자: LatteBun
> 작성 도구: Claude Code (Opus 4.8)

## 목적

던전 15개 캠페인 개편의 화면 트랙 두 번째 작업 `U2`를 구현한다. 공개 던전 지도, 정보 전달 기회, 개인별 반응, 별도 사건 행동 흐름을 만들어 플레이어가 한 탐험 안에서 경로를 고르고 정보를 전달하며 사건에 개입하게 한다.

`U1`과 같은 병렬 화면 트랙 방식을 따른다. 라이브 캠페인 스토어·상태 머신(`I1`)에는 연결하지 않고, 이미 완료된 `E1`(지도 생성)·`E2`(정보 판정)·`E3`(사건 행동) 순수 규칙과 프리뷰 하네스로 화면을 완성한다.

## 근거와 기준 문서

- 화면 구조: `docs/diagram/screen-wireframes.md`와 `docs/diagram/png/screen-02-dungeon-map.png`(던전 지도), `docs/diagram/png/screen-03-info-event.png`(정보·사건). 좌표는 `docs/diagram/svg/screen-02-dungeon-map.svg`에서 확인
- 표시 요구: `docs/experience/ONBOARDING_AND_INTERFACE.md`의 "던전 지도", "정보 전달 화면", "사건과 상인"
- 최상위 기준: `docs/GAME_PRINCIPLES.md`
- 배정표: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`의 `U2` 행(완료 기준 = 공개 지도, 정보 전달 기회, 개인 반응과 별도 사건 행동 흐름 동작)
- 규칙 계약: `lib/rules/map.ts`(`generateGradeMap`), `lib/rules/info.ts`(`createInfoOpportunity`·`evaluatePartyInfoCard`), `lib/rules/event.ts`(`resolveEventChoice`), `lib/domain/expedition.ts`·`info.ts`·`dungeon.ts`

규칙이 충돌하면 게임 원칙 → 공식 경험·시스템 문서 → 상위 spec → 와이어프레임 순으로 해석한다. 와이어프레임은 "구조 참고용·최종 아트 아님"이므로 구조와 좌표는 따르되 고정 5행동 같은 예시 표현은 실제 콘텐츠 계약을 따른다.

## 범위

### 포함

- 던전 지도 화면: 좌측 범례, 중앙 SVG 분기 그래프(아래 입구→위 보스), 우측 파티 상태, 지점 선택과 입장
- 정보 전달 화면: 관람 영역(사건 상황·공개 위험), 진실·거짓·중립 후보 카드, 카드 선택
- 개인별 정보 반응: 살아 있는 파티원마다 수용·의심·적발과 효과·신뢰 변화
- 사건 행동 화면: 정보 반응과 분리된 사건 행동(콘텐츠의 `event.choices`) 선택과 진행
- 지도 좌표를 계산하는 순수 레이아웃 모듈과 화면 데이터 조인 view-model, 각 단위 테스트
- 검증용 프리뷰 라우트(`app/u2-test`)와 fixture

### 제외

- 라이브 캠페인 스토어·상태 머신 연결과 실제 전이·정산 반영 (`I1`)
- 자동 보스전 화면과 정산·엔딩 화면 (`U3`, 보스전 결과 표시는 U2 범위 밖)
- 규칙 재구현. 지도·정보·사건 계산은 `E1`·`E2`·`E3`가 소유하며 U2는 표시·조립만 한다
- 게임 원칙 밖 콘텐츠 추가. 던전은 등급·번호로 표시한다(`U1`과 동일). 던전 제목은 콘텐츠가 주는 값이 있으면 쓰고 없으면 등급·번호로 표시
- 구 단일 런 화면(`app/play/*`, `DungeonMap`·`SceneStage`·`ChoiceList`)의 수정·삭제

## 아키텍처

`U1`과 같은 단방향 흐름을 두 화면으로 확장한다.

```text
ExpeditionState(+ 캠페인 컨텍스트, props 주입)
   → map-layout.ts (순수 기하) + expedition-view-model.ts (순수 조인)
   → DungeonMapView · PartyStatusSidebar · InfoOpportunityPanel · EventActions · PartyReactionSidebar (순수 표시)
   → app/u2-test 하네스 (지도→정보→사건 흐름, 로컬 useState, 실 전이 없음)
```

### 파일

| 파일 | 책임 |
| --- | --- |
| `components/game/map-layout.ts` | `GeneratedMap` 구조에서 노드 x/y·간선 계산(순수 기하) |
| `components/game/map-layout.test.ts` | 등급별 좌표·순서·간선 불변식 |
| `components/game/expedition-view-model.ts` | 지도·정보·반응·사건·파티 상태 view 조인(순수) |
| `components/game/expedition-view-model.test.ts` | 조인·파생·경계값 테스트 |
| `components/game/DungeonMapView.tsx` | SVG 지도 + 좌측 범례 + 하단 캡션 |
| `components/game/PartyStatusSidebar.tsx` | 파티원 상태 카드(HP·신뢰·Δ·아이템·기억) |
| `components/game/InfoOpportunityPanel.tsx` | 관람 영역 + 진실·거짓·중립 후보 카드 |
| `components/game/EventActions.tsx` | 사건 행동 버튼과 진행 |
| `components/game/PartyReactionSidebar.tsx` | 카드 선택 후 개인별 반응 |
| `app/u2-test/u2-fixtures.ts` | 하네스용 지도·파티·이벤트 조회 fixture |
| `app/u2-test/page.tsx` | 프리뷰 하네스 |

**재사용(변경 없음)**: `components/game/CampaignHeader.tsx`(U1 HUD), `components/game/labels.ts`(`EVENT_KIND_LABELS`·`EVENT_KIND_MARKS`·`PERSONALITY_LABELS`·`TRUTH_TYPE_LABELS`), `components/ui/Panel.tsx`·`StatValue.tsx`.

### import 경계 (eslint 강제)

- `components/**`는 `@/lib/mock`을 import하지 않는다. 데이터는 `app/u2-test`가 만들어 props로 주입한다.
- `map-layout.ts`·view-model·컴포넌트는 `@/lib/domain`·`@/lib/rules`·`@/lib/content`·`./labels`만 참조한다.
- 새 컴포넌트는 `components/game/**`에 둔다(게임을 아는 계층).

## 지도 레이아웃: `map-layout.ts`

`generateGradeMap`이 만든 `GeneratedMap`은 노드마다 `depth`·`nextNodeIds`와 구조적 ID를 주지만 좌표는 주지 않는다. 레이아웃은 그 구조에서 좌표를 결정한다.

```ts
export interface MapLayoutNode { id: NodeId; x: number; y: number; }
export interface MapLayoutEdge { fromId: NodeId; toId: NodeId; }
export interface MapLayout {
  viewWidth: number;
  viewHeight: number;
  nodes: MapLayoutNode[];
  edges: MapLayoutEdge[];
}
export function layoutMap(map: GeneratedMap): MapLayout;
```

**행(y, 아래→위)**: `MapNode.depth`를 그대로 쓴다. 입구 `depth 0`(맨 아래), 갈래 `depth 1..L`, 합류 `depth L+1`, 보스 `depth L+2`(맨 위). 행 수는 `L+3`이며 등급별로 C=5, B=6, A=7, S=8이다. `rowGap`을 상수로 두고 `viewHeight = (L+3-1) × rowGap`, `y = viewHeight − depth × rowGap`로 계산해 depth가 클수록 위로 간다.

**열(x)**:

- 중앙 열 = 입구(`map.entryNodeId`), 보스(`map.bossNodeId`), 합류. 합류는 **들어오는 간선이 둘인 노드**로 식별한다(양 갈래가 모인다).
- 좌·우 열 = 갈래 노드. 갈래 번호는 노드 ID `node-path-{branch}-depth-{d}`의 `branch`로 판별하며 `1`은 왼쪽, `2`는 오른쪽이다.
- `x = centerX ± branchOffset` (정규화 좌표: 예 `centerX = 200`, `branchOffset = 120`, `viewWidth = 400`).

**간선**: `map.nodes`의 각 `node.nextNodeIds`를 `{ fromId, toId }`로 편다.

**ID 규약 의존**: 열 판별은 `E1`이 확정한 노드 ID 형식(`node-entry`·`node-merge`·`node-boss`·`node-path-{branch}-depth-{d}`)에 의존한다. 형식에 맞지 않는 노드를 만나면 조용히 중앙에 두지 않고 `RuleError("INVALID_GENERATION", …)`를 던져 계약 위반을 드러낸다.

**검증(테스트)**: 좌표계는 화면 크기와 무관한 순수 값이므로 단위 테스트가 값을 고정한다. 등급별 노드 수, 입구 y가 최대(맨 아래)·보스 y가 최소(맨 위), 갈래 노드가 좌/우로 갈림, 중앙 노드가 `centerX`, 간선 집합이 `nextNodeIds`와 일치함을 검사한다.

## view-model: `expedition-view-model.ts`

모든 함수는 순수하며 입력을 변경하지 않는다. 노드의 사건 분류는 `MapNode`에 없으므로(`eventId`만 있음) 호출자가 `eventId → EventKind` 조회 함수를 주입한다.

### 지도

```ts
export type MapNodeState = "current" | "visited" | "selectable" | "inactive";

export interface MapNodeView {
  id: NodeId;
  x: number;
  y: number;
  categoryLabel: string;   // EVENT_KIND_LABELS[kind]; 입구는 "입구", 보스는 "보스방"
  categoryMark: string;    // EVENT_KIND_MARKS[kind]
  hasInfo: boolean;        // 정보 기회 마커(?)
  state: MapNodeState;
  isBoss: boolean;
  riskSummary: string;
}

export interface MapView {
  viewWidth: number;
  viewHeight: number;
  edges: MapLayoutEdge[];
  nodes: MapNodeView[];
  bossNodeId: NodeId;
  caption: string;         // "공개 지도는 결과를 숨기지 않지만 사건의 정확한 수치는 숨긴다."
}

export function toMapView(
  map: GeneratedMap,
  currentNodeId: NodeId,
  visitedNodeIds: readonly NodeId[],
  eventKindById: (eventId: EventId) => EventKind,
): MapView;
```

노드 상태 규칙: `current` = `id === currentNodeId`; `visited` = `visitedNodeIds`에 포함; `selectable` = 현재 노드의 `nextNodeIds`에 포함되고 방문하지 않음; 나머지 = `inactive`. 입구·보스는 분류 대신 고정 라벨을 쓰고 보스는 `isBoss`로 별 모양을 그린다.

### 정보 기회

```ts
export interface InfoCardView {
  cardId: CardId;
  truthType: TruthType;
  truthLabel: string;       // TRUTH_TYPE_LABELS
  truthMark: string;        // 진실 "✓", 거짓 "!", 중립 "?"
  topic: string;
  text: string;
  expectedNote: string;     // 진실 "안정적 전술 효과 · 검증 가능" 등 truthType별 고정 문구
  dashed: boolean;          // 거짓이면 점선 테두리
}

export interface InfoSceneView {
  sceneText: string;        // event.title (사건 상황 제목)
  riskSummary: string;      // "공개 위험: …" (sceneNode.riskSummary)
  memberNames: { id: MemberId; name: string; alive: boolean }[];
}

export interface InfoOpportunityView {
  scene: InfoSceneView;
  cards: InfoCardView[];    // 후보 2~3장(createInfoOpportunity 결과)
}

export function toInfoOpportunityView(
  pendingInfo: PendingInfo,
  cardById: (cardId: CardId) => InfoCard,
  sceneNode: MapNode,
  event: DungeonEvent,
  party: readonly CampaignMember[],
): InfoOpportunityView;
```

`sceneText`는 `event.title`을, `riskSummary`는 `sceneNode.riskSummary`를 쓴다. `DungeonEvent`에 별도 서술 필드가 있으면 그것을 우선할 수 있으나, 확정된 필드는 `title`이므로 그것을 기준으로 둔다.

```ts
```

`createInfoOpportunity`는 존재하는 진위마다 한 장씩 뽑아 2~3장을 준다. 화면은 그 후보를 그대로 보여주며 개수가 3장 미만일 수 있음을 전제한다.

### 개인별 반응

```ts
export interface MemberReactionView {
  memberId: MemberId;
  name: string;
  className: string;
  personalityLabel: string;
  reaction: InfoReaction;    // accepted | suspected | exposed
  reactionLabel: string;     // 수용 | 의심 | 적발
  reactionMark: string;      // ✓ | ? | !
  trustDelta: number;        // 반응이 만든 신뢰 변화(없으면 0)
  currentHp: number;
  maxHp: number;
  trust: number;
  note: string;              // "거짓 적용 · 미검증 기록" 등
}

export function toInfoReactionsView(
  evaluation: PartyInfoCardEvaluation<CampaignMember>,
): MemberReactionView[];
```

카드를 고른 뒤에만 채워진다. `evaluatePartyInfoCard`의 `memberResults`에서 반응·신뢰 변화·효과를 읽는다.

### 사건 행동

```ts
export interface EventChoiceView {
  choiceId: ChoiceId;
  label: string;
  disabled: boolean;         // 거래인데 잔액 부족이면 true
  disabledReason: string | null; // "골드 부족" 등
}

export interface EventView {
  title: string;
  kindLabel: string;
  description: string;
  riskSummary: string;
  choices: EventChoiceView[];
}

export function toEventView(
  event: DungeonEvent,
  currentGold: number,
  itemById: (itemId: ItemId) => ItemDef | undefined,
): EventView;
```

`event.choices`를 그대로 버튼으로 편다. 거래(`effectTags`에 `trade`) 선택지는 `itemId`의 가격이 `currentGold`를 넘으면 `disabled`로 표시하되 숨기지 않는다.

### 파티 상태

```ts
export interface MemberStatusView {
  memberId: MemberId;
  name: string;
  className: string;
  currentHp: number;
  maxHp: number;
  trust: number;
  trustDelta: number;        // 최근 변화(없으면 0). >0 ▲, <0 ▼
  carriedGold: number;
  memoryNote: string;        // 최신 memory summary, 없으면 "최근 변화 없음"
}

export function toPartyStatusView(
  members: readonly CampaignMember[],
  trustDeltaById?: Readonly<Record<string, number>>,
): MemberStatusView[];
```

신뢰 변화 화살표는 `trustDeltaById`(하네스가 마지막 정보 반응·사건 행동에서 계산해 주입)로 표시한다. 없으면 `trustDelta = 0`이고 화살표를 그리지 않는다.

## 컴포넌트

와이어프레임 `screen-02`·`screen-03` 구도를 따른다. 모두 순수 표시 컴포넌트이며 동작은 콜백 prop으로 올린다. 상태·잠금·선택·반응은 색뿐 아니라 기호·테두리·`aria` 속성으로 함께 구분한다.

### `DungeonMapView`

- props: `view: MapView`, `selectedNodeId: NodeId | null`, `onSelectNode(nodeId)`, `onEnterNode()`
- 좌측 범례(현재 ◎ / 방문 ✓ / 선택 가능 → / 비활성 ×, 지점 분류 `!?$+`, 공개 원칙 — 정적 텍스트), 중앙 SVG(`viewBox`로 반응형, 원=노드, 선=간선, 보스=별), 하단 캡션.
- `selectable` 노드는 클릭 가능한 요소로 두고 `inactive` 노드는 `aria-disabled`로 표시한다. 선택된 노드는 강조 + `aria-pressed`. "선택 지점 입장 · 정보 기회 →" 버튼은 `selectedNodeId`가 없으면 비활성.

### `PartyStatusSidebar`

- props: `members: MemberStatusView[]`, `footer?: ReactNode`
- 파티원 카드: 이름·직업, `HP x / y`, `신뢰 N`과 변화 `▲Δ`/`▼Δ`(색 + 기호 + 스크린리더 텍스트), `소지 nG`, 기억 문구. `footer`로 지도 화면의 입장 버튼을 받는다.

### `InfoOpportunityPanel`

- props: `view: InfoOpportunityView`, `selectedCardId: CardId | null`, `onSelectCard(cardId)`
- 관람 영역(사건 상황 텍스트, 파티 아바타, 보스, 공개 위험) + 후보 카드 버튼(진실 `✓` / 거짓 `!` / 중립 `?`, 선택 강조, 거짓은 점선). 색 외 단서를 함께 쓴다.

### `EventActions`

- props: `view: EventView`, `selectedChoiceId: ChoiceId | null`, `onSelectChoice(choiceId)`, `onAdvance()`
- `view.choices`를 버튼으로 그린다. `disabled`면 비활성 + 사유. "→ 진행"은 선택이 있어야 활성.

### `PartyReactionSidebar`

- props: `reactions: MemberReactionView[]`
- 개인별 `✓ 수용` / `? 의심` / `! 적발` + 효과 + `HP·신뢰`. 카드 선택 전에는 하네스가 렌더하지 않거나 빈 안내를 보여준다.

## 데이터 흐름과 하네스

`app/u2-test/page.tsx`가 유일한 렌더 소비자다. 스토어·상태 머신을 만들지 않는다.

- `u2-fixtures.ts`는 `initializeCampaign(seed)`로 완성 파티 하나를 얻고, 선택한 등급의 지도를 `generateGradeMap(grade, createRng(seed).derive("map"))`로 만든다. `eventKindById`·`cardById`·`itemById` 조회는 콘텐츠 풀(`DUNGEON_EVENT_POOLS`·`INFO_CARDS`·`ITEMS`)에서 구성한다.
- 하네스는 단계(`map` → `info` → `event`)와 `currentNodeId`·`visitedNodeIds`·`selectedNodeId`·`selectedCardId`·반응·`selectedChoiceId`를 로컬 `useState`로 관리한다.
  - 지도에서 노드를 고르고 입장하면, 그 노드가 `hasInfoOpportunity`면 `createInfoOpportunity`로 후보를 만들어 `info` 단계로, 아니면 바로 `event` 단계로 간다.
  - `info`에서 카드를 고르면 `evaluatePartyInfoCard`로 반응을 만들고 `trustDeltaById`를 갱신한 뒤 사건 행동을 활성화한다.
  - `event`에서 행동을 고르고 진행하면 `resolveEventChoice`로 결과를 반영하고 방문 처리한 뒤 다음 지도로 돌아간다.
- fixture·조회 함수 구성은 `app/**`에서만 한다. 컴포넌트·view-model은 목을 모른다.

## 오류·경계 처리

- `layoutMap`은 ID 규약에 맞지 않는 노드나 합류를 찾지 못하면 `RuleError`를 던진다.
- 정보 기회가 없는 노드에서 `createInfoOpportunity`를 호출하지 않는다. 하네스가 `node.hasInfoOpportunity`로 분기한다.
- `toEventView`의 거래 선택지는 잔액을 넘으면 `disabled`로 두고, 실제 구매 거부는 `resolveEventChoice`가 `INSUFFICIENT_GOLD`로 처리한다(규칙 소유).
- view-model은 입력 상태를 변경하지 않는다. 배열을 복사·파생만 한다.
- 죽은 파티원은 반응 대상이 아니다. `evaluatePartyInfoCard`가 살아 있는 파티원만 평가하므로 반응 목록도 그 결과를 따른다.
- `evaluatePartyInfoCard`는 `M extends PartyMember` 제네릭을 받는다. 하네스는 `CampaignMember[]`를 넘기므로 `CampaignMember`가 `PartyMember` 제약을 만족하는지 구현 시 확인한다. 만족하지 않으면 하네스에서 평가에 필요한 형태로 맞춰 넘기고, view-model은 반환된 `memberResults`만 읽어 표시한다. `resolveEventChoice`는 이미 `CampaignMember[]`를 직접 받는다.

## 테스트

### 단위 테스트(Vitest, node 환경, DOM 없음)

`map-layout.test.ts`:
- 등급별 노드 수(C 7 · B 9 · A 11 · S 13)와 행 수(C 5 … S 8)
- 입구 `y`가 최대(맨 아래), 보스 `y`가 최소(맨 위)
- 갈래 노드가 `centerX`를 기준으로 좌/우로 갈리고 입구·합류·보스가 `centerX`에 옴
- 간선 집합이 모든 `node.nextNodeIds`와 정확히 일치
- ID 규약 위반 노드에 `RuleError`

`expedition-view-model.test.ts`:
- 노드 상태(현재·방문·선택 가능·비활성) 판정, `eventId→kind` 분류 라벨, 정보 마커
- 카드 라벨·진위 기호·예상 문구, 후보 2장인 경우 처리
- 반응 매핑(수용/의심/적발)과 신뢰 변화·효과 문구
- 사건 행동 disabled(거래 잔액 부족)와 사유
- 파티 상태 조인, 신뢰 Δ 화살표(양수 ▲·음수 ▼·0 없음), 빈 memory → "최근 변화 없음"

### 통합·시각 검증

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` 모두 통과
- `/u2-test`를 브라우저로 열어 지도 그래프(입구 아래·보스 위, 현재·선택 가능·비활성 구분), 정보 카드 3종과 개인 반응, 사건 행동과 진행, 정보 기회 없는 노드의 건너뜀을 확인한다

### 검사 발동 확인(습관)

`map-layout`의 y 뒤집기(입구가 위로 가게)와 view-model의 선택 가능 판정을 일부러 틀리게 바꿔 테스트가 잡는지 확인하고, 확인 내용을 PR 본문에 적은 뒤 되돌린다.

## 완료 기준

- 지도 화면이 공개 분기 그래프(아래 입구→위 보스), 범례, 파티 상태, 지점 선택과 입장을 보여준다.
- 정보 화면이 사건 상황·공개 위험, 진실·거짓·중립 후보 카드, 카드 선택을 보여준다.
- 카드 선택 후 살아 있는 파티원마다 수용·의심·적발과 효과·신뢰 변화를 개인별로 보여준다.
- 사건 행동을 정보 반응과 분리해 콘텐츠의 선택지로 고르고 진행한다.
- 지점·정보·사건 상태를 색뿐 아니라 기호·테두리·형태·`aria` 속성으로 구분한다.
- 던전·파티는 등급·번호로 표시한다.
- `map-layout`·view-model 단위 테스트와 네 검증 명령이 모두 통과한다.
- 구 단일 런 화면과 스토어·상태 머신을 수정하지 않는다.

## 후속 연결

- `I1`이 `app/u2-test`의 fixture 대신 라이브 캠페인 스토어를 붙이고 지도·정보·사건 콜백을 `transitionCampaign`에 연결한다.
- `U1`의 위험 표시 보류 항목(`BoardOfferView.riskSummary`)은 이 지도의 `riskSummary` 노출과 함께 `I1`에서 채운다.
- 보스전 결과·정산 화면은 `U3`가 담당한다.
- 배정표 `U2` 상태 갱신은 작업 마지막에 main 동기화 후 수행한다.
