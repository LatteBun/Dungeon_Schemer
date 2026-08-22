# U4 던전 지도 화면 설계

## 문서 지위

이 문서는 캠페인 개편 작업의 `U4 | 던전 지도` 화면 구현을 위한 정식 설계다.

근거 우선순위는 다음과 같다.

1. `docs/GAME_PRINCIPLES.md`
2. `docs/design/*`, `docs/systems/*`
3. `docs/experience/SCREEN_LAYOUT.md`
4. `docs/experience/ONBOARDING_AND_INTERFACE.md`
5. `docs/experience/UI_IMPLEMENTATION_GUIDE.md`
6. 이 문서와 `docs/experience/U4_DUNGEON_MAP.md`

옛 `U3 dungeon map`, `U4 wireframe fidelity`, 75:25 화면 설계는 현재 U4의 근거가 아니다.

---

## 1. 목표

U4는 계약 직후 원정의 전체 논리 경로를 공간형 던전 지도로 보여주고, 플레이어가 현재 위치에서 갈 수 있는 다음 지점을 선택하게 한다.

플레이어는 이 화면에서 다음을 즉시 이해해야 한다.

- 현재 위치가 어디인지
- 이미 지나온 길이 어디인지
- 지금 선택 가능한 다음 방이 무엇인지
- 다른 갈래 중 현재 선택할 수 없는 곳이 무엇인지
- 보스방이 어디인지
- 파티원 3명의 현재 HP·신뢰·소지 골드
- 선택한 다음 지점의 공개 사건 분류
- 이동을 확정하는 CTA

U4는 지도 topology나 사건 콘텐츠를 새로 생성하지 않는다. E1이 만든 `GeneratedMap`과 상위 탐험 로직이 제공하는 공개 정보만 표현한다.

---

## 2. 화면 구조

기존 `GameShell`과 `TopStatusBar`를 그대로 사용한다.

```text
GameShell
├─ TopStatusBar
├─ MainContent 60%
│  └─ DungeonMap
└─ RightPanel 40%
   ├─ PartyStatus
   └─ SelectedDestination + Move CTA
```

### 고정 캔버스

- 전체 게임 캔버스는 U3와 동일한 1920×1080 16:9 고정 캔버스다.
- 창 크기에 따라 구성 요소를 재배치하지 않는다.
- 캔버스를 균일 확대·축소하고 남는 영역은 검은 레터박스로 남긴다.
- U4 전용 `vw`, `vh`, 미디어 쿼리를 추가하지 않는다.
- `rem`, `cqw`, `cqh`를 사용해 기존 고정 캔버스 규칙을 따른다.
- 가로·세로 스크롤을 만들지 않는다.

검증 viewport:

- 1920×1080
- 2560×1440
- 1440×900
- 1280×1024

네 viewport에서 내부 배치와 줄바꿈은 동일하고 레터박스 두께만 달라야 한다.

---

## 3. 지도 데이터 경계

E1의 `GeneratedMap`은 topology만 소유한다.

```ts
interface GeneratedMap {
  entryNodeId: NodeId;
  bossNodeId: NodeId;
  layers: readonly DungeonLayer[];
  nodes: readonly DungeonNode[];
}
```

E1은 다음을 제공하지 않는다.

- 사건 콘텐츠 ID
- 몬스터/휴식/상인/특수 분류
- 화면 좌표
- 시각 상태

따라서 U4는 다음 입력을 결합해 ViewModel을 만든다.

```ts
interface U4DungeonMapInput {
  map: GeneratedMap;
  currentNodeId: NodeId;
  visitedNodeIds: readonly NodeId[];
  publicKindByNodeId: Readonly<Partial<Record<NodeId, EventKind>>>;
}
```

`publicKindByNodeId`는 U4가 생성하지 않는다. 실제 통합 단계에서는 탐험/E3 계층이 제공해야 한다.

`/u4-test`에서만 화면 검증을 위해 deterministic fixture를 주입한다.

Entry와 Boss는 각각 E1의 `kind`를 그대로 사용하고 일반 노드만 공개 사건 분류를 사용한다.

---

## 4. U4 ViewModel

React 컴포넌트 안에서 topology, 좌표, 상태 판정을 섞지 않는다.

```ts
export type U4RoomKind =
  | "entry"
  | "monster"
  | "rest"
  | "merchant"
  | "special"
  | "boss";

export type U4RoomState =
  | "current"
  | "visited"
  | "selectable"
  | "inactive";

export interface U4MapNodeView {
  id: NodeId;
  kind: U4RoomKind;
  state: U4RoomState;
  x: number;
  y: number;
  nextNodeIds: readonly NodeId[];
}
```

상태 우선순위는 다음과 같다.

1. `currentNodeId`이면 `current`
2. `visitedNodeIds`에 있으면 `visited`
3. 현재 노드의 `nextNodeIds`에 있으면 `selectable`
4. 나머지는 `inactive`

Boss는 방 종류로 구분하며 상태는 위 규칙을 그대로 따른다.

---

## 5. 지도 레이아웃

### 방향

- Entry: 최하단 중앙
- Boss: 최상단 중앙
- Depth 1~N: 아래에서 위로 균등 배치

### 한 Depth의 방 배치

한 Depth에는 1~5개 일반 방이 존재한다.

- 같은 Depth의 방은 가로 안전 영역 안에 균등 분산한다.
- 1개면 중앙.
- 2개면 좌우.
- 3~5개는 같은 간격으로 배치한다.
- 방 크기는 Depth 폭이 커질수록 무작정 줄이지 않고, 5개가 동시에 들어갈 수 있는 고정 상한 크기를 기준으로 한다.

U4는 E1의 NodeId와 `nextNodeIds`를 보존하고, 각 Depth의 좌우 표시 순서만
결정적으로 재배치해 직선 통로의 전체 교차 수가 최소인 조합을 선택한다.
최소값이 같으면 원래 `nodeIds` 순서와의 위치 차이가 작은 조합, 안정적인
후보 생성 순서가 앞선 조합을 차례로 우선한다.

### 예시 검증 지도

`/u4-test`는 실제 E1의 ★3 템플릿 중 5개 방이 한 번 등장하는 형태를 사용한다.

예: `risk3-c`

```text
[2, 3, 5, 4, 3, 2, 2]
```

예시 화면에서는 `5 -> 5`가 연속인 템플릿을 사용하지 않는다. E1의 `5 -> 5` 허용 규칙 자체는 수정하지 않는다.

---

## 6. 지도 표현 방식

원형 노드와 얇은 선 그래프를 만들지 않는다.

구조는 다음 레이어로 그린다.

```text
MapSurface
├─ background texture
├─ atmospheric props / vignette
├─ corridor layer
├─ room layer
└─ state overlay layer
```

### 방

방은 실제 `<button>` 또는 비활성 container로 렌더링하고 U4 PNG를 사용한다.

- entry: `room_entry_base.png`
- monster: `room_battle_base.png`
- rest: `room_rest_base.png`
- merchant: `room_merchant_base.png`
- special: `room_special_base.png`
- boss: `room_boss_base.png`

방 종류와 상태는 별개다.

예:

```text
room_battle_base + overlay_selectable_glow
```

### 통로

간선은 SVG의 가는 선 대신 석재 corridor 이미지 조각으로 표현한다.

연결선은 source와 target 중심점 사이에 DOM corridor element를 배치하고 회전/길이를 계산한다. 필요한 경우 가로·세로·코너 asset을 조합하되, topology 자체는 바꾸지 않는다.

통로의 의미 상태:

- 지나온 경로: 밝기/채도 낮춤
- 현재 → selectable: 금색 계열 강조
- 나머지 공개 갈래: 어두운 기본값

### 상태 오버레이

- current: `overlay_current_glow.png` + `overlay_current_marker.png`
- selectable: `overlay_selectable_glow.png`
- visited: 완료용 저채도/회색 시각 처리
- inactive: 어두운 저명도 처리

색 외에도 marker, 테두리, 방 자체의 대비 차이를 함께 사용한다.

---

## 7. U4 이미지 에셋 위치

새 U4 에셋은 다음처럼 저장한다.

```text
public/assets/u4/
├─ map/
├─ rooms/
├─ icons/
├─ corridors/
├─ states/
└─ navigation/
```

전체 완성 화면 이미지를 배경으로 사용하지 않는다. 개별 PNG를 실제 UI 요소로 조합한다.

텍스트는 이미지에 굽지 않는다.

---

## 8. 우측 파티 상태

우측 40%의 상단은 파티원 세 명을 세로로 배치한다.

U3에서 계승하는 요소:

- 다크 패널 프레임
- 이름/직업/성격 위계
- HP
- 신뢰
- `/assets/u2/status-gold.svg`
- 소지 골드 행

### 초상 슬롯

U4에서는 U3의 원형 portrait가 아니라 네모 portrait를 사용한다.

- 슬롯 비율: 1:1
- 원본 파일은 수정/재저장하지 않는다.
- CSS crop: `object-fit: cover`
- 상단 50%를 우선 보여주는 느낌을 위해 `object-position: 50% 0%`
- 얼굴/상체가 중심이 되도록 화면에서 확인한다.

### 직업별 초상

반드시 Character의 `classId`와 같은 직업 디렉터리를 사용한다.

```text
/assets/characters/live/{class}/{class}_{a|b}.png
/assets/characters/dead/{class}/{class}_{a|b}.png
```

A/B 변형은 캐릭터별 stable mapping을 사용한다. 화면 render마다 무작위로 바꾸지 않는다.

### 사망 상태

`character.alive === false`인 경우:

1. `live`가 아니라 같은 직업·같은 A/B 변형의 `dead` 파일을 사용한다.
2. 카드의 portrait와 카드 전체를 저채도/회색 계열로 처리한다.
3. `사망` 텍스트 또는 형태 단서를 함께 표시한다.

신뢰 0, 중상, 현재 미출전은 사망이 아니므로 `dead` 이미지를 사용하지 않는다.

---

## 9. 선택 지점 패널과 CTA

우측 하단에는 다음을 둔다.

```text
선택한 다음 지점
[room preview] [공개 사건 분류]
[ 이 지점으로 이동  > ]
```

새 U4 navigation asset을 사용한다.

- destination panel frame
- destination thumbnail frame
- CTA left / center / right
- CTA arrow

텍스트는 HTML로 렌더링한다.

방 클릭 즉시 이동하지 않는다.

1. selectable room을 선택
2. `selectedNextNodeId` 갱신
3. 우측 상세 갱신
4. CTA 클릭으로 `onMove(selectedNextNodeId)` 호출

실제 I2 연결 전 `/u4-test`에서는 이동 callback 결과를 preview 상태로만 확인한다.

---

## 10. 접근성 및 키보드

선택 가능한 다음 방은 실제 `button`이다.

필수:

- mouse click
- Tab focus
- Enter / Space 선택
- `aria-pressed`
- `focus-visible`
- 이벤트 종류를 `aria-label`에 포함

추가로 같은 선택 그룹 안에서 좌/우 방향키 이동을 지원한다. 순서는 화면의 x 좌표 오름차순으로 고정한다.

보스/visited/inactive 방은 선택 가능한 button처럼 동작하지 않는다.

---

## 11. `/u4-test`

실제 통합 전에 시각·접근성 검수용 페이지를 만든다.

```text
app/u4-test/page.tsx
```

사용하는 실제 데이터:

- `initializeCampaign`
- `createBoardOffers`
- 실제 party member data
- `generateDungeonMap`
- Character classId
- 실제 `public/assets/characters`

테스트 fixture:

- `publicKindByNodeId`
- 현재 위치/방문 상태를 재현하기 위한 deterministic preview 진행 위치

preview seed는 상수로 고정해 새로고침할 때 동일한 화면이 나온다.

---

## 12. 예상 코드 구조

```text
components/game/
├─ U4DungeonMapScreen.tsx
├─ U4Preview.tsx
├─ u4-dungeon-map-model.ts
├─ u4-dungeon-map-layout.ts
├─ U4DungeonMapScreen.test.tsx
├─ u4-dungeon-map-model.test.ts
└─ u4-dungeon-map-layout.test.ts

app/
├─ u4-dungeon-map.css
└─ u4-test/page.tsx
```

기존 `GameShell`, `TopStatusBar`, domain/rules는 가능한 수정하지 않는다.

---

## 13. 테스트 계약

### 순수 모델 테스트

- Entry/Boss kind 변환
- public kind 결합
- current/visited/selectable/inactive 우선순위
- 현재 노드 nextNodeIds만 selectable
- 알 수 없는 일반 node public kind 처리
- dead/live portrait 경로가 직업과 A/B를 유지하며 전환

### 레이아웃 테스트

- Entry 최하단 중앙
- Boss 최상단 중앙
- 모든 일반 Depth가 순서대로 배치
- 각 depth의 x 좌표가 충돌하지 않음
- 5개 방 depth가 안전 영역 안에 들어감
- node topology를 변경하지 않음

### 컴포넌트 테스트

- selectable room은 button
- inactive/visited room은 이동 선택 불가
- 선택 시 `aria-pressed`
- CTA는 선택 전 disabled
- CTA는 선택 후 enabled
- CTA가 선택한 NodeId를 callback으로 전달
- party 3명 정보 노출
- 직업별 portrait path 사용
- 사망자는 `/dead/` portrait + 사망 표시
- 생존자는 `/live/` portrait

### 16:9 고정 캔버스 테스트

기존 FixedCanvas/GameShell 계약과 함께 U4에서 다음을 검증한다.

- 1920×1080: 정확한 전체 캔버스
- 2560×1440: 동일 16:9 구성
- 1440×900: 16:9 canvas + 레터박스
- 1280×1024: 16:9 canvas + 더 큰 레터박스
- 60:40 유지
- scroll 없음
- UI 순서/줄바꿈 변화 없음
- CTA 및 map clipping 없음

---

## 14. 완료 조건

- 기존 GameShell/TopStatusBar를 재사용한다.
- 전체 화면이 U3와 동일한 고정 16:9 규칙을 따른다.
- E1 실제 GeneratedMap을 시각화한다.
- U4가 topology 또는 사건 콘텐츠를 생성하지 않는다.
- 범례 없이 current/visited/selectable/inactive/boss를 구분한다.
- 지도는 원형 노드 그래프가 아니라 방과 석재 통로의 공간처럼 보인다.
- 새 U4 PNG 자산을 실제 조합 가능한 asset으로 사용한다.
- 파티 상태에서 U3의 골드 icon과 정보 위계를 재사용한다.
- 파티 portrait는 직업에 맞는 실제 character asset을 1:1 상단 crop으로 표시한다.
- 사망자는 동일 직업/변형의 `dead` asset으로 교체하고 회색 처리한다.
- 신뢰 0/중상은 dead portrait로 바꾸지 않는다.
- 다음 방은 마우스와 키보드로 선택 가능하다.
- 이동은 우측 CTA로 별도 확정한다.
- `/u4-test`가 재현 가능한 검수 화면을 제공한다.
- lint, typecheck, test, build를 통과한다.
- 브라우저 실제 화면 캡처로 사용자 검수를 받는다.
- feature branch에만 commit하고 사용자가 요청하기 전 PR을 만들지 않는다.
