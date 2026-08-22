# U4 지도 교차 최소화와 비네팅 레이어 조정 설계

## 문서 지위

이 문서는 기존 `U4 | 던전 지도 화면`의 후속 시각 개선 설계다.

E1의 논리 지도 구조와 분기 수는 변경하지 않는다. U4가 같은
`GeneratedMap`을 더 읽기 쉬운 공간 배치로 표현하고, 비네팅이 방과 통로를
덮지 않도록 합성 순서만 바로잡는다.

근거 문서는 다음과 같다.

- `docs/superpowers/specs/2026-08-22-lattebun-e1-risk-map-generation-design.md`
- `docs/superpowers/specs/2026-08-22-sanghwan-yoo-u4-dungeon-map-design.md`
- `docs/experience/U4_DUNGEON_MAP.md`

## 1. 문제

현재 U4 지도에는 서로 다른 두 문제가 있다.

### 1-1. 비네팅이 지도 정보를 덮는다

`map_background_vignette.png`는 현재 `z-index: 8`, `opacity: 0.84`로
렌더링된다. 통로 레이어는 `z-index: 3`, 방 레이어는 `z-index: 6`이므로
비네팅이 배경뿐 아니라 통로와 방까지 덮는다.

통로 자체의 대비를 올려도 그 위에 어두운 이미지가 다시 합성되므로 전체
topology가 불필요하게 어둡게 보인다.

### 1-2. 논리 간선 순서와 화면의 좌우 순서가 다르다

E1은 인접 Depth의 노드를 attempt 전용 RNG로 shuffle한 순서를 사용해
간선을 만든다. U4는 그 간선을 그대로 받지만 각 Depth의 X 좌표는 원래
`layers[].nodeIds` 순서대로 균등 배치한다.

따라서 논리적으로 인접하게 연결된 노드가 화면에서는 반대쪽에 배치될 수
있다. 특히 폭 3~5인 Depth가 연속되면 직선 통로가 여러 번 교차한다.

## 2. 현재 지도 생성 로직

E1의 `generateDungeonMap`은 다음 순서로 논리 지도를 만든다.

1. `initialRiskLevel`에 맞는 폭 템플릿 풀을 고른다.
2. `campaignSeed + dungeonId`로 템플릿 순서를 결정적으로 shuffle한다.
3. `attempt` 순번에 맞는 템플릿을 선택한다.
4. 템플릿의 `layerWidths`로 6~8개의 일반 Depth와 노드를 만든다.
5. Entry를 첫 Depth의 1~2개 노드에 연결한다.
6. attempt 전용 RNG로 각 Depth의 노드 순서를 독립적으로 shuffle한다.
7. 인접 Depth의 폭 비율에 따라 모든 노드가 살아 있는 기본 간선을 만든다.
8. source outgoing과 target incoming이 각각 2 미만이면 제한적으로 추가
   간선을 넣는다.
9. 마지막 Depth의 1~2개 노드를 Boss에 연결한다.
10. `validateGeneratedMap`으로 차수, 도달성, Depth 전용 진행, 동일 경로
    길이와 NodeId 무결성을 검증한다.

생성 결과는 `Entry -> Depth 1 -> ... -> Depth N -> Boss` 형태의 층형
DAG다. 모든 일반 간선은 바로 다음 Depth로만 향하고 일반 노드의 incoming과
outgoing은 각각 1~2다.

## 3. 변경 경계

### 유지하는 것

- `generateDungeonMap` API와 구현
- 위험도별 폭 템플릿 16개
- E1의 결정적 RNG와 attempt 순환
- `GeneratedMap` 데이터 계약
- 모든 NodeId와 `nextNodeIds`
- 실제 분기 수, 재합류 구조, 도달 가능한 경로
- Entry와 Boss의 중앙 배치
- Depth별 Y 좌표와 가로 안전 영역

### 변경하는 것

- U4에서 같은 Depth의 노드를 놓는 좌우 순서
- 비네팅과 지도 정보 레이어의 합성 순서
- 관련 U4 레이아웃 테스트와 시각 레이어 계약
- `docs/experience/U4_DUNGEON_MAP.md`의 교차 감소 책임 설명

## 4. 교차 최소화 알고리즘

### 4-1. 행 구성

레이아웃 입력을 다음 행의 연속으로 본다.

```text
Entry / Depth 1 / ... / Depth N / Boss
```

Entry와 Boss의 가능한 순서는 각각 하나뿐이다. 일반 Depth는 해당
`nodeIds`의 모든 순열을 후보로 사용한다.

Depth 폭은 최대 5이므로 한 행의 최대 후보 수는 `5! = 120`개다.

### 4-2. 인접 행 교차 비용

인접한 두 행의 순서가 주어지면 각 간선을 `(sourceIndex, targetIndex)`로
표현한다.

두 간선 `(a, b)`, `(c, d)`가 다음을 만족하면 한 번 교차한 것으로 센다.

```text
(a - c) * (b - d) < 0
```

source 또는 target을 공유하는 간선은 분기나 합류이며 교차로 세지 않는다.
E1 계약상 간선은 인접 행 사이에만 있으므로 전체 교차 수는 각 인접 행 쌍의
비용 합으로 계산할 수 있다.

### 4-3. 동적 계획법

각 행의 각 순열에 대해 이전 행 순열에서 올 때의 최소 누적 교차 수를
기록한다.

```text
cost[row][order] = min(
  cost[row - 1][previousOrder]
  + crossings(previousOrder, order)
)
```

마지막 행에서 최소 비용을 고른 뒤 역추적해 모든 Depth의 좌우 순서를
결정한다.

이 방식은 휴리스틱이 아니라 주어진 층형 DAG와 직선 통로 표현에서 가능한
좌우 순서 중 전체 교차 수가 가장 작은 조합을 선택한다.

### 4-4. 결정적 동률 처리

최소 비용이 같은 후보가 여러 개면 다음 순서로 고른다.

1. 원래 `layers[].nodeIds` 순서와 위치 차이가 적은 후보
2. 후보 생성 순서가 앞선 항목

후보 생성은 원래 `nodeIds` 배열을 기준으로 결정적인 순열 순서를 사용한다.
동일한 `GeneratedMap`은 실행 환경과 렌더 시점에 관계없이 항상 같은 좌표를
얻는다.

### 4-5. 좌표와 간선 보존

최적화된 순서는 기존 `xPositions(count)`의 균등 X 좌표에 대응시킨다.
`depthY`, `MAP_TOP`, `MAP_BOTTOM`, 가로 안전 영역은 변경하지 않는다.

모든 corridor는 기존 E1 간선을 정확히 한 번씩 렌더링한다. 최적화 과정은
간선을 추가, 제거, 반전하거나 NodeId를 바꾸지 않는다.

## 5. 비네팅 합성 순서

지도 레이어 순서를 다음처럼 정리한다.

```text
0  background base
1  atmosphere props
2  vignette + background tone overlay
3  corridors
6  rooms
```

비네팅은 유지하되 `z-index: 2`로 내려 배경과 가장자리만 어둡게 한다.
통로와 방은 비네팅 위에 렌더링하므로 원래 상태별 opacity와 glow가 가려지지
않는다.

비네팅 opacity는 우선 기존 `0.84`를 유지한다. 합성 순서 수정만으로도 정보
레이어가 분리되므로, 추가 명도 조정은 브라우저 캡처에서 배경이 과도하게
어두운 경우에만 별도 판단한다.

## 6. 코드 경계

주요 변경 파일은 다음과 같다.

- `components/game/u4-dungeon-map-layout.ts`
  - 행 순열 생성
  - 인접 행 교차 수 계산
  - 동적 계획법과 역추적
  - 최적화된 순서에 X 좌표 배정
- `components/game/u4-dungeon-map-layout.test.ts`
  - 교차 감소와 전역 최소값
  - 결정성, 간선 보존, 안전 영역 회귀
- `app/u4-dungeon-map-fixes.css`
  - vignette stacking depth 수정
- `components/game/U4FixedCanvas.test.ts`
  - `vignette < corridors < rooms` 레이어 계약
- `docs/experience/U4_DUNGEON_MAP.md`
  - U4가 화면 좌우 순서를 최적화한다는 책임 반영

E1 파일과 도메인 인터페이스는 수정하지 않는다.

## 7. 오류 처리

U4 배치기는 유효한 `GeneratedMap`을 입력으로 받는 기존 계약을 유지한다.

- 좌표가 없는 NodeId를 간선이 참조하면 기존과 같이 명시적 오류를 낸다.
- 행에 속하지 않는 일반 노드나 인접하지 않은 Depth 간선은 E1 validator의
  책임이며 U4가 조용히 보정하지 않는다.
- 후보 순서나 DP 상태가 비어 있는 경우 일반 좌표로 fallback하지 않고 배치
  오류를 드러낸다.

## 8. 테스트와 검증

### 자동 테스트

- 교차가 있는 fixture가 최적화 뒤 더 적은 교차 수를 가진다.
- 교차를 0으로 만들 수 있는 fixture는 0이 된다.
- 여러 최소해가 있는 fixture는 항상 같은 순서를 고른다.
- 입력 `GeneratedMap`의 모든 간선이 결과 corridor에 정확히 한 번 남는다.
- Entry, Boss, Y 좌표, X 안전 영역 계약이 유지된다.
- 실제 `/u4-test` preview의 교차 수가 기존 단순 배치보다 감소한다.
- 비네팅의 stacking depth가 corridor와 room보다 낮다.

### 브라우저 검증

- 1920×1080
- 2560×1440
- 1440×900
- 1280×1024

각 viewport에서 확인한다.

- 전체 경로가 이전보다 덜 교차한다.
- 통로와 방이 비네팅에 눌리지 않는다.
- selectable과 current 강조가 유지된다.
- 지도, 파티 패널, CTA가 잘리거나 재배치되지 않는다.
- 스크롤이 생기지 않는다.
- hydration 또는 runtime 오류가 없다.

## 9. 완료 조건

- E1 생성 결과와 분기 수가 바뀌지 않는다.
- U4가 가능한 좌우 순서 중 최소 교차 배치를 결정적으로 선택한다.
- 기존 U4 preview의 교차 수가 자동 테스트로 감소한다.
- 비네팅이 방과 통로 아래에서만 배경을 어둡게 한다.
- 관련 문서의 E1/U4 책임 경계가 일치한다.
- 전체 lint, typecheck, test, build가 통과한다.
- 네 기준 viewport의 브라우저 캡처를 사용자에게 제공한다.
