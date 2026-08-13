# U3 던전 분기 지도 연동 설계

> 상태: **제품 요구사항 대체됨**
> 등급별 전체 지도와 사건·정보 흐름은 [게임 방향 개편 설계](2026-08-13-sanghwan-yoo-game-direction-rework-design.md)를 따른다. 이 문서는 기존 구현의 역사 기록으로 보존한다.

**작성자:** sbh3821
**작성 도구:** Claude Code

## 목적

`/play` 화면 흐름을 목 데이터에서 실제 게임 상태로 전환한다. 지도가 현재
위치·지나온 경로·선택 가능한 다음 경로를 실제 `RunState`로 보여주고, 화면의
선택이 P1 상태 머신 `transitionRun`을 거쳐 상태를 바꾼다.

이 작업은 [프로토타입 작업 배정표](../../technical/PROTOTYPE_WORK_ASSIGNMENT.md)의
`U3`다. 완료 기준인 "선택이 상태 머신에 전달됨"을 지도만 연결해서는 만족할
수 없다. `choosePath` 뒤는 `event` 단계이므로, 조우 화면이 `completeEvent`를
전달해 지도로 복귀시켜야 지도 루프가 실제로 돈다. 따라서 파티 소개 →
조우 → 지도 반복의 흐름 전체를 연결하되, 정보 카드 판정·표시는 `R3`·`U2`에
남긴다.

## 설계 원칙

### 화면은 상태 머신을 거쳐서만 상태를 바꾼다

화면 컴포넌트는 `RunState`를 직접 만들지 않는다. 모든 변경은
`transitionRun`의 세 행동을 스토어에 전달하는 하나의 훅을 지난다. 갈 수
없는 노드는 화면에서 비활성으로 보이고, 우회해서 눌러도 상태 머신이
거부한다.

### 단계가 화면을 결정한다

인터페이스 문서의 화면 매핑을 코드로 고정한다.

| 단계 | 화면 |
| --- | --- |
| `partyIntro` | `/play` 파티 소개·던전 입장 |
| `pathChoice` | `/play/map` 던전 분기 지도 |
| `event` `bossFight` | `/play/encounter` 조우 |
| `settlement` `ended` | `/play/result` 결과 (목 유지, `U4`) |

각 화면은 현재 단계가 자기 것이 아니면 단계에 맞는 화면으로 이동시킨다.
URL을 직접 입력해도 현재 단계의 화면만 보이므로, 지도에서 보스방으로
건너뛰는 구멍이 사라진다.

### 조우 화면은 URL에 노드를 담지 않는다

조우 라우트는 `/play/encounter` 하나이며 항상 스토어의 `currentNodeId`
이벤트를 보여준다. 시드마다 달라지는 노드 ID를 URL에 노출하지 않고, 임의
노드로 접근하는 경로 자체가 없다. 목 셸의 정적 라우트
`/play/node/[nodeId]`는 제거한다.

## 런 초기화와 시드

`/play` 레이아웃이 클라이언트 프로바이더로 감싼다.

- 마운트 후 URL의 `?seed=` 값을 읽어 그 시드로, 없으면 `createSeed()`로
  `createInitialRun`을 호출한다.
- 준비 전에는 짧은 준비 문구를 보여준다. 서버 렌더 시점에는 시드를 알 수
  없으므로 클라이언트 마운트 후 초기화가 hydration 불일치를 막는 가장 단순한
  방법이다.
- 만든 `run`은 기존 F2 `GameStoreProvider`에 넘기고, `events`는 별도
  컨텍스트로 함께 제공한다. F2 스토어 계약은 바꾸지 않는다.
- 파티 소개 화면에 현재 시드를 표시한다. `?seed=` 링크로 같은 판을 재현할
  수 있다.

`/play` 안의 화면 이동은 클라이언트 내비게이션이므로 프로바이더와 스토어가
유지된다. 새 시드로 다시 시작하려면 새 `?seed=`로 진입한다.

## 공개 계약

지나온 경로 재구성은 P1 로그 규칙의 소비자가 여럿(`U3`·`R5`)이므로
`lib/flow`에 순수 함수로 둔다.

```ts
/** 입구부터 현재 위치까지, 로그의 nodeId 순서로 방문 경로를 재구성한다. */
export function reconstructPath(run: RunState): NodeId[];
```

화면 쪽 훅은 스토어의 `run`에 `transitionRun`을 적용해 `replaceRun`으로
반영한다.

```ts
/** GameStoreProvider + 이벤트 컨텍스트 안에서만 호출한다. */
export function useRunTransition(): (action: RunAction) => void;
```

## 화면별 연동

### 레이아웃

`ResourceBar`와 `PartySidebar`가 스토어의 실제 자원·단계·파티·최근 신뢰
변화를 읽는다. 신뢰 변화 사유의 상세 표시는 `U1` 몫이므로 기존 컴포넌트에
실제 데이터를 넘기는 것까지만 한다.

### 파티 소개 `/play`

실제 파티원의 직업·성격·초기 신뢰를 보여주고, "던전에 들어간다" 버튼이
`enterDungeon`을 전달한다. 전이 후 단계 규칙에 따라 조우 화면(입구
이벤트)으로 이동한다.

### 조우 `/play/encounter`

`currentNodeId`의 이벤트 제목·설명·선택지를 보여준다. 선택지를 누르면
`completeEvent`가 전달되고 지도로 이동한다. 정보 카드 영역은 `R3` 판정이
없으므로 이 화면에서 뺀다. `U2`가 카드 선택과 반응을 붙인다.

`bossFight` 단계에서는 보스 조우 이벤트를 보여주되 선택지를 비활성하고
"보스전 진행은 P2에서 구현한다"를 안내한다. P1에는 `bossFight` 이후 전이가
없기 때문이다.

### 지도 `/play/map`

- 현재 위치, `reconstructPath`로 재구성한 지나온 경로, 현재 노드의
  `nextNodeIds`를 구분해 보여준다.
- `pathChoice` 단계에서 `nextNodeIds`의 노드만 누를 수 있다. 누르면
  `choosePath`가 전달되고 조우 화면으로 이동한다. 나머지 노드는 비활성
  버튼이다.
- `DungeonMap`은 `Link` 나열에서 선택 콜백을 받는 버튼으로 바꾼다. 선택
  가능·현재·지나옴·비활성의 구분은 색상 외 단서(테두리·표식·문구)를
  함께 쓴다.

## 파일 구조

| 파일 | 책임 |
| --- | --- |
| `lib/flow/path.ts` | `reconstructPath` 순수 함수 |
| `lib/flow/path.test.ts` | 경로 재구성 테스트 |
| `app/play/play-run-provider.tsx` | 시드 결정, `createInitialRun`, 스토어·이벤트 컨텍스트 제공, `useRunTransition` |
| `app/play/phase-route.ts` | 단계 → 화면 경로 매핑과 단계 가드 훅 |
| `app/play/layout.tsx` | 프로바이더 적용, 실제 상태 기반 레이아웃 |
| `app/play/page.tsx` | 파티 소개 연동 |
| `app/play/map/page.tsx` | 지도 연동 |
| `app/play/encounter/page.tsx` | 조우 연동 |
| `components/game/DungeonMap.tsx` | 버튼·선택 가능 상태 지원 |
| `components/game/ChoiceList.tsx` | 선택 콜백 지원, 카드 영역 분리 |

`app/play/node/[nodeId]`는 제거한다. `/play/result`와 `lib/mock`은 `U4`·`R5`
작업 전까지 그대로 둔다.

## 테스트와 검증

순수 로직은 테스트로, 화면 흐름은 실행으로 검증한다.

- `reconstructPath`: 전체 여정에서 입구→현재 위치 순서와 일치, 중복 없음,
  시작 직후에는 입구만 있음. P1 상태 머신 테스트의 재구성 규칙과 같다.
- 단계 → 경로 매핑: 여섯 단계가 모두 화면을 가진다.
- 화면 흐름: 브라우저에서 같은 시드로 파티 소개 → 입구 조우 → 지도 →
  조우 반복 → 보스방 진입까지 진행하고, 비활성 노드가 눌리지 않는지,
  `?seed=` 재현이 되는지 확인한다.

전체 완료 검증은 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
넷이다.

## 제외 범위

- 정보 카드 선택·반응 표시 (`R3`·`U2`)
- 신뢰 변화 상세 패널 (`U1`)
- 보스전 진행과 종료 조건, 결과 화면 연동 (`P2`·`R5`·`U4`)
- 이벤트 선택의 자원·신뢰 효과 계산 (P1 로그 기록 그대로)
- 온보딩 안내 (`U5`)
- `/play/result`의 실제 상태 전환

## 후속 작업 계약

- `U2`는 조우 화면의 선택지 영역 옆에 정보 카드 패널을 되살리고 `R3` 판정
  결과를 표시한다.
- `P2`·`U4`는 `bossFight` 이후 전이가 생기면 조우 화면의 보스전 안내를
  실제 진행으로 바꾸고 결과 화면을 연동한다.
- `U5`는 이 흐름 위에 온보딩 안내를 얹는다.
- `Q2`는 지도의 색상 외 단서와 키보드 조작을 점검한다.
