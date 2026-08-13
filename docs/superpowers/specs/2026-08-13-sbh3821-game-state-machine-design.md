# P1 게임 상태 머신 설계

> 상태: **제품 요구사항 대체됨**
> 캠페인 게시판부터 정산·엔딩까지의 상태 전이는 [게임 방향 개편 설계](2026-08-13-sanghwan-yoo-game-direction-rework-design.md)를 따른다. 이 문서는 기존 구현의 역사 기록으로 보존한다.

**작성자:** sbh3821
**작성 도구:** Claude Code

## 목적

파티 등장부터 보스전 진입까지 한 판의 단계 전이를 순수 함수로 관리하고,
잘못된 전이를 거부한다. 같은 시드와 같은 행동 순서는 같은 상태를 재현한다.

이 작업은 [프로토타입 작업 배정표](../../technical/PROTOTYPE_WORK_ASSIGNMENT.md)의
`P1`이다. 완료되면 `P2` 보스전과 종료 조건, `U3` 던전 분기 지도, `U5` 30초
온보딩의 선행 조건을 해소한다.

## 설계 원칙

### 순수 전이 함수만 제공한다

상태 머신은 `RunState`와 행동을 받아 새 `RunState`를 반환한다. 입력을 변경하지
않고, 스토어·UI·부수효과를 포함하지 않는다. Zustand 연동과 화면 연결은 후속
작업이 이 함수를 감싸서 한다.

### 잘못된 전이는 Error로 거부한다

단계에 맞지 않는 행동, 존재하지 않는 경로, 존재하지 않는 선택지는 자동으로
보정하지 않고 `Error`를 던진다. 오류 메시지는 현재 단계와 거부된 행동, 문제의
ID를 포함한다. R4 던전 생성의 오류 처리 방식과 같다.

### 효과 계산은 하지 않는다

이벤트 선택이 신뢰·자원·전투에 주는 효과는 계산하지 않는다. 어떤 선택을
했는지 `DecisionRecord`로 로그에 남기기만 한다. 효과 계산은 `R2` 신뢰 판정을
소비하는 후속 흐름과 `R5` 결과 정산, `P2` 보스전의 몫이다.

## 공개 계약

```ts
export type RunAction =
  | { type: "enterDungeon" }
  | { type: "completeEvent"; choiceId: ChoiceId }
  | { type: "choosePath"; nodeId: NodeId };

export interface RunMachineContext {
  /** 이번 던전이 사용하는 이벤트 목록. GeneratedDungeon.events를 그대로 넘긴다. */
  readonly events: readonly DungeonEvent[];
}

/** 유효한 전이면 새 RunState를 반환하고, 아니면 Error를 던진다. */
export function transitionRun(
  run: RunState,
  action: RunAction,
  context: RunMachineContext,
): RunState;
```

초기 상태는 R1 파티 생성과 R4 던전 생성을 묶어 만든다.

```ts
export interface CreateInitialRunOptions {
  /** 초기 자원. 생략하면 잠정 기본값을 쓴다. */
  readonly resources?: Resources;
}

export interface InitialRun {
  readonly run: RunState;
  readonly events: DungeonEvent[];
}

export function createInitialRun(
  seed: string,
  options?: CreateInitialRunOptions,
): InitialRun;
```

`createInitialRun`은 `createRng(seed)`에서 `party`·`dungeon` 스트림을 파생해
파티와 던전을 만들고, `phase: "partyIntro"`, `currentNodeId: entryNodeId`,
빈 `pendingClaims`·`log`로 시작 상태를 만든다. `run.seed`는 입력 시드를
보존한다.

초기 자원은 아직 공식 확정 전이므로 잠정 상수로 두고 옵션으로 대체할 수
있게 한다.

```ts
/** 잠정값. 공식 초기값이 확정되면 교체한다. */
export const INITIAL_RESOURCES: Resources = { gold: 10, food: 5, reputation: 0 };
```

## 단계 전이 규칙

`RunPhase` 여섯 단계 중 P1은 `partyIntro`, `event`, `pathChoice`에서의 전이와
`bossFight` 진입까지 관리한다.

| 현재 단계 | 행동 | 다음 단계 | 상태 변화 |
| --- | --- | --- | --- |
| `partyIntro` | `enterDungeon` | `event` | 입구 노드의 이벤트를 시작한다. `currentNodeId`는 이미 입구다 |
| `event` | `completeEvent(choiceId)` | `pathChoice` | 고른 선택지를 로그에 기록한다 |
| `pathChoice` | `choosePath(nodeId)` | `event` 또는 `bossFight` | `currentNodeId`를 갱신하고 경로 선택을 로그에 기록한다. 보스방이면 `bossFight`로 진입한다 |

- R4가 입구 노드에도 이벤트를 배치하므로 던전 입장은 입구 이벤트부터
  시작한다. 생성된 콘텐츠를 버리지 않는다.
- 보스방을 제외한 모든 노드는 `nextNodeIds`가 비어 있지 않으므로
  `completeEvent`는 항상 `pathChoice`로 이어진다.
- `choosePath`로 보스방에 도달하면 단계만 `bossFight`로 바꾼다. 보스방
  이벤트의 진행은 `P2`가 맡는다.
- `bossFight`, `settlement`, `ended`에서는 P1의 어떤 행동도 받지 않는다.
  이 단계들의 전이는 `P2`가 `RunAction` 유니온을 확장해 추가한다.

### 거부 조건

다음은 모두 `Error`다.

- 단계에 맞지 않는 행동. 예: `pathChoice` 중 `completeEvent`
- `bossFight`·`settlement`·`ended`에서의 모든 P1 행동
- `choosePath`의 `nodeId`가 현재 노드의 `nextNodeIds`에 없음
- `completeEvent`의 `choiceId`가 현재 노드 이벤트의 선택지에 없음
- `context.events`에 현재 노드의 `eventId`가 없음. R4 계약 위반이므로
  보정하지 않는다
- `dungeon.nodes`에 `currentNodeId`가 없음

검증은 상태를 만들기 전에 실행한다. 거부된 호출은 로그를 포함해 어떤 상태도
바꾸지 않는다.

## 로그 기록

효과 계산 없이 결정만 기록한다. `trustChanges`는 빈 배열이다.

- `completeEvent`: `at: log.length`, `nodeId`: 현재 노드,
  `summary`: `"<이벤트 제목> · <선택지 라벨>"`
- `choosePath`: `at: log.length`, `nodeId`: 선택한 노드,
  `summary`: `"경로 선택 · <선택한 노드 이벤트 제목>"`

경로 선택도 기록하는 이유는 둘이다. `R5` 정산의 "영향을 준 선택 목록"에
경로 결정이 포함되고, `U3` 지도가 로그의 `nodeId` 순서로 지나온 경로를
재구성할 수 있어 `RunState`에 방문 목록을 추가하지 않아도 된다.

`summary` 문구는 잠정 형식이다. 화면 작업이 다듬을 수 있으나 로그 재구성
규칙(순번, `nodeId`)은 유지한다.

## 파일 구조

| 파일 | 책임 |
| --- | --- |
| `lib/flow/run-machine.ts` | 행동 타입, 전이 함수, 거부 검증. `lib/domain`만 의존한다 |
| `lib/flow/initial-run.ts` | `createInitialRun`. R1 파티·R4 던전 생성과 rng를 결합한다 |
| `lib/flow/run-machine.test.ts` | 전이·거부·로그·불변성 테스트 |
| `lib/flow/initial-run.test.ts` | 초기 상태·재현성 테스트 |
| `docs/design/CORE_GAME_LOOP.md` | 단계 전이 규칙을 공식 문서에 반영한다 |

`lib/rules`는 UI 없는 순수 규칙(L1), `lib/flow`는 규칙을 묶는 흐름(L2)이다.
배정표의 층 구분을 디렉터리로 드러낸다.

## 테스트

### 전체 여정

- 고정 시드에서 `partyIntro → 입구 event → pathChoice → event → … →
  합류 → pathChoice → bossFight`까지 유효한 행동 순서가 통과한다.
- 보스방 도달 시 `phase`가 `bossFight`, `currentNodeId`가 `bossNodeId`다.
- 세 경로 형태(2×2, 3×2, 2×3)를 만드는 시드에서 모두 여정이 완주된다.

### 재현성과 불변성

- 같은 시드의 `createInitialRun`이 같은 결과를 만든다.
- 같은 초기 상태에 같은 행동 순서를 적용하면 같은 상태가 나온다.
- `transitionRun`은 입력 `run`과 `context`를 변경하지 않는다.

### 로그

- `completeEvent`와 `choosePath`가 각각 순번 `at: log.length`로 기록을
  추가한다.
- 기록의 `nodeId`·`summary`가 규칙과 일치하고 `trustChanges`가 빈 배열이다.
- 로그의 `nodeId` 순서로 입구부터 현재 위치까지 경로가 재구성된다.

### 거부

- 여섯 단계 각각에서 허용되지 않는 행동이 모두 거부된다.
- `nextNodeIds`에 없는 `nodeId`, 존재하지 않는 `choiceId`가 거부된다.
- `events`에 현재 노드 `eventId`가 없으면 거부된다.
- 거부된 호출 전후로 상태가 같다.

### 초기 상태

- `phase: "partyIntro"`, `currentNodeId`가 입구, 파티 3~5명, 시드 보존.
- `resources` 기본값이 `INITIAL_RESOURCES`이고 옵션으로 대체된다.

검사는 고정 시드를 사용하며 확률에 따라 통과 여부가 달라지지 않는다. 전체
완료 검증은 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` 넷이다.

## 제외 범위

- 이벤트 선택의 신뢰·자원·전투 효과 계산
- 보스전 진행, 미검증 정보 검증, 승패·처형·클리어 종료 조건 (`P2`)
- 처형·전멸로 보스전을 건너뛰고 정산으로 가는 조기 종료 전이 (`P2`)
- `bossFight` → `settlement` → `ended` 전이 (`P2`)
- Zustand 스토어 연동과 화면 연결 (`U3`·`U5` 등 후속 작업)
- 정보 카드 판정 (`R3`)

## 후속 작업 계약

- `P2`는 `RunAction` 유니온과 전이 표를 확장해 `bossFight` 이후와 조기
  종료를 추가한다.
- `U3`는 `choosePath`를 상태 머신에 전달하고, 현재 노드의 `nextNodeIds`와
  로그로 지도·지나온 경로를 그린다.
- `U5`는 이 전이 순서를 따라 첫 실행부터 첫 선택 결과 확인까지 안내한다.
- `R5`는 로그의 `DecisionRecord`를 정산의 "영향을 준 선택 목록"에 사용한다.
- 스토어 연동은 `startNewRun`·`replaceRun`이 이미 받는 `RunState`를 그대로
  쓰므로 F2 계약을 바꾸지 않는다.
