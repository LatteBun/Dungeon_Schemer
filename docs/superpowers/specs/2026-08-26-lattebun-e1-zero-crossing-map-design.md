# E1 지도 경로 교차 0 보장 설계

## 문서 지위

이 문서는 현재 E1 위험도별 지도 생성과 U4 지도 교차 최소화 구현의 후속 설계다.

기준 브랜치는 `main`이며, 작성 시점 기준 SHA는 `226085835516fe5487e6dce681db76e9c6dbb06d`다.

관련 기존 문서:

- `docs/superpowers/specs/2026-08-22-lattebun-e1-risk-map-generation-design.md`
- `docs/superpowers/specs/2026-08-22-sbh3821-u4-map-crossing-vignette-design.md`
- `docs/experience/U4_DUNGEON_MAP.md`
- `lib/rules/dungeon-map.ts`
- `components/game/u4-dungeon-map-order.ts`
- `components/game/u4-dungeon-map-layout.ts`

이 문서는 기존 E1의 필수 게임 규칙을 바꾸지 않고, **생성된 논리 지도 자체가 직선 경로 교차 0 배치를 반드시 하나 이상 갖도록 보장**하는 변경을 정의한다.

---

## 1. 문제

현재 지도 교차 문제는 필수 사건이나 몬스터 배치 때문에 생기는 것이 아니다.

현재 순서는 다음과 같다.

1. E1이 위험도별 폭 템플릿으로 Depth와 노드를 만든다.
2. 각 Depth 노드 순서를 attempt 전용 RNG로 shuffle한다.
3. 모든 노드가 살아 있도록 기본 간선을 만든다.
4. 남은 차수가 있으면 일부 후보 간선을 25% 확률로 추가한다.
5. E1 검증기는 차수, 도달성, Depth 진행, 동일 경로 길이 등을 검사한다.
6. E3가 이후에 monster/rest/merchant/special, 보스 정보, 강한 연계를 노드에 배정한다.
7. U4가 이미 확정된 `GeneratedMap`을 받아 각 Depth의 좌우 순서를 전역 최적화해 교차 수를 최소화한다.

기본 간선은 E1의 필수 구조를 모두 만족한다. 추가 간선은 분기와 재합류를 다양하게 만들기 위한 선택 요소다.

문제는 현재 추가 간선 채택 조건에 **교차 가능 여부가 포함되어 있지 않다**는 점이다.

따라서 어떤 `GeneratedMap`은 U4가 모든 Depth 순열을 전역 탐색해도 최소 교차 수가 1 이상이다. 이 경우 U4는 topology를 바꿀 권한이 없으므로 교차를 없앨 수 없다.

즉 현재 문제는 다음과 같다.

> E1은 교차를 고려하지 않고 선택적 간선을 확정하고, U4는 확정된 간선을 보존해야 하므로 사후 최소화만 가능하다.

---

## 2. 설계 결정

### 핵심 결정

**추가 간선은 그 간선을 포함한 전체 지도가 여전히 교차 0 배치를 가질 때만 채택한다.**

기본 연결은 그대로 유지한다.

추가 간선 후보도 현재와 같이 RNG로 결정한다.

다만 후보가 기존 차수 조건과 RNG 조건을 통과한 뒤, 임시로 추가했을 때 전체 층형 그래프의 최소 교차 수를 계산한다.

- 최소 교차 수 `0`: 간선 채택
- 최소 교차 수 `1 이상`: 후보만 버림

이 과정을 모든 추가 간선 후보에 순서대로 적용한다.

### 결과 계약

최종 `GeneratedMap`은 다음을 새로 만족해야 한다.

> Entry, 모든 일반 Depth, Boss의 각 행 안에서 노드 좌우 순서를 적절히 고르면, 서로 source와 target을 공유하지 않는 모든 직선 간선의 교차 수를 0으로 만들 수 있다.

이 문서에서 이를 **zero-crossing 계약**이라 부른다.

---

## 3. 유지하는 게임 규칙

다음은 변경하지 않는다.

- 위험도별 일반 Depth 수 `6 / 6 / 7 / 8 / 8`
- 위험도별 16개 폭 템플릿
- 한 Depth 폭 `1~5`
- 첫 Depth와 마지막 Depth 폭 최대 `2`
- 인접 Depth 폭 최대 2배
- 일반 노드 incoming `1~2`
- 일반 노드 outgoing `1~2`
- Entry incoming `0`, outgoing `1~2`
- Boss incoming `1~2`, outgoing `0`
- 모든 노드는 Entry에서 도달 가능
- 모든 노드는 Boss에 도달 가능
- 모든 경로는 같은 수의 일반 Depth를 통과
- 간선은 바로 다음 Depth로만 진행
- 동일 입력의 결정성
- attempt 증가 시 지도 재생성
- E3 사건 배치 방식
- 경로별 monster 최소치
- 보스 정보 지점
- strong link 보장
- 사건 콘텐츠 중복 방지

특히 E3의 필수 요소를 위해 간선을 새로 추가하거나 topology를 변경하지 않는다.

---

## 4. 교차의 정확한 정의

### 4-1. 행

지도를 다음 행의 연속으로 본다.

```text
Entry / Depth 1 / Depth 2 / ... / Depth N / Boss
```

Entry와 Boss는 각각 한 노드뿐이다.

각 일반 Depth는 최대 5개 노드를 가진다.

### 4-2. 간선 교차

인접 행의 좌우 순서가 주어졌을 때 각 간선을 다음처럼 표현한다.

```text
(sourceIndex, targetIndex)
```

서로 다른 두 간선 A, B에 대해 다음 조건이면 한 번의 교차로 센다.

```text
(sourceA - sourceB) * (targetA - targetB) < 0
```

다음은 교차로 세지 않는다.

- 같은 source에서 갈라지는 두 간선
- 같은 target으로 합류하는 두 간선

이들은 하나의 방에서 자연스럽게 분기하거나 합류하는 구조이기 때문이다.

### 4-3. zero-crossing

각 Depth의 좌우 순열 중 하나를 선택했을 때 전체 인접 행 쌍의 교차 수 합이 0이면 그 지도는 zero-crossing 가능하다.

필수 조건은 **현재 `layers[].nodeIds` 순서가 0이어야 한다는 뜻이 아니다.**

U4처럼 각 Depth의 표시 순서를 바꿀 수 있으며, 가능한 모든 순서 중 교차 0인 순서가 하나 이상 존재하면 합격이다.

---

## 5. 기본 연결은 왜 교차 0을 보장하는가

현재 E1은 각 Depth 노드 배열을 먼저 `shuffledLayers`로 만든다.

기본 연결은 이 shuffle 순서를 기준으로 폭 비율에 따라 단조롭게 연결한다.

`m <= n`:

```text
A[floor(j * m / n)] -> B[j]
```

`m > n`:

```text
A[i] -> B[floor(i * n / m)]
```

두 경우 모두 `shuffledLayers`의 index가 뒤집히는 기본 간선을 만들지 않는다.

또한 하나의 Depth에 사용한 shuffle 순서는 앞 Depth와 연결할 때와 다음 Depth와 연결할 때 동일하다.

따라서 다음 행 순서를 사용하면 기본 지도 전체가 교차 0이다.

```text
Entry
shuffled Depth 1
shuffled Depth 2
...
shuffled Depth N
Boss
```

즉 zero-crossing을 깨뜨릴 수 있는 부분은 필수 기본 연결이 아니라 **선택적 추가 간선**이다.

기본 연결만 만든 상태에서 최소 교차 수가 0이 아니면 정상적인 생성 결과가 아니며 오류로 취급한다.

---

## 6. 공용 교차 계산기

현재 교차 최적화 알고리즘은 `components/game/u4-dungeon-map-order.ts`에 U4 전용 코드로 존재한다.

E1이 같은 판단을 해야 하므로 이 알고리즘을 UI에서 복사하지 않는다.

교차 계산과 최적 행 순서 탐색을 UI와 규칙 계층이 함께 사용할 수 있는 순수 모듈로 분리한다.

위치:

```text
lib/rules/layered-map-crossing.ts
```

### 6-1. 입력 모델

공용 계산기는 완성된 `GeneratedMap`만 받도록 제한하지 않는다.

E1은 간선을 만드는 도중 후보를 임시 평가해야 하기 때문이다.

공용 경계:

```ts
export interface LayeredEdge {
  readonly from: NodeId;
  readonly to: NodeId;
}

export interface LayeredOrderResult {
  readonly rows: readonly (readonly NodeId[])[];
  readonly crossingCount: number;
}

export interface LayeredOrderSolver {
  solve(edges: readonly LayeredEdge[]): LayeredOrderResult;
}

createLayeredOrderSolver(
  rows: readonly (readonly NodeId[])[],
): LayeredOrderSolver;
```

완성 지도용 편의 함수와 U4 adapter는 이 공용 경계를 감싸는 thin adapter로만 둔다.

### 6-2. 입력 무결성 계약

공용 solver는 낮은 수준의 입력을 받지만 잘못된 행이나 간선을 조용히 무시하지 않는다.

`createLayeredOrderSolver(rows)`는 생성 시 다음을 검증한다.

- 행이 하나 이상 있다.
- 모든 행은 비어 있지 않다.
- 하나의 행 안에 같은 `NodeId`가 중복되지 않는다.
- 하나의 `NodeId`가 서로 다른 행에 중복되지 않는다.
- 한 행의 폭은 최대 5다.

`solve(edges)`는 호출마다 다음을 검증한다.

- 모든 `from`과 `to`가 `rows`에 존재한다.
- 모든 간선은 정확히 다음 행으로만 진행한다.
- self edge가 없다.
- 같은 `(from, to)` 간선이 중복되지 않는다.

위반은 `RuleError("INVALID_GENERATION", ...)`으로 실패시킨다. E1과 U4가 같은
잘못된 입력을 서로 다르게 해석하거나, 행에 없는 간선을 crossing 계산에서
조용히 제외해서는 안 된다.

solver는 모든 행이 서로 연결되어 있는지나 노드 차수가 유효한지는 검사하지 않는다.
그 책임은 `validateGeneratedMap`에 있다. 따라서 E1이 optional edge를 조립하는 중간
간선 집합처럼 아직 완성되지 않은 그래프도, 간선 자체가 유효하면 계산할 수 있다.

### 6-3. 계산 방식

현재 U4와 같은 정확한 전역 최적화를 사용한다.

1. 각 행의 모든 순열을 만든다.
2. 인접 행 순열 조합별 교차 비용을 계산한다.
3. 동적 계획법으로 누적 교차 수가 최소인 행 순서를 찾는다.
4. 최소 교차 수가 같으면 원래 행 순서와 displacement가 작은 조합을 우선한다.
5. displacement도 같으면 먼저 생성된 후보를 사용한다.

Depth 폭 최대가 5이므로 한 행의 후보는 최대 `5! = 120`개다.

휴리스틱이나 greedy row ordering으로 대체하지 않는다. 생성 계약 자체를 판단하므로 **정확한 최소값**이 필요하다.

### 6-4. 계산기 재사용과 의존 방향

E1은 추가 간선 후보마다 행 순열을 새로 만들지 않는다.

한 지도의 행 구성은 간선 추가 중 변하지 않으므로 `createLayeredOrderSolver(rows)`를 한 번 만들고, 후보별로 `solve(edges)`만 반복한다.

순열과 displacement처럼 행에만 의존하는 값은 solver 생성 시 캐시한다.

각 `solve(edges)` 호출은 먼저 간선을 인접 row pair별로 한 번 분류한다. DP의 각
순열 transition에서 전체 지도 노드나 전체 간선 집합을 다시 순회하지 않는다.

의존 방향은 다음으로 고정한다.

```text
components/game/u4-dungeon-map-order.ts
  -> lib/rules/layered-map-crossing.ts
```

공용 solver가 `components` 파일을 import하는 역방향 의존은 금지한다.

---

## 7. 추가 간선 채택 알고리즘

현재 추가 후보 생성 순서와 RNG 성격을 최대한 유지한다.

### 7-1. 기존 흐름

현재는 각 인접 Depth에 대해 모든 `(from, to)` 후보를 shuffle한 뒤 다음을 만족하면 간선을 추가한다.

- 중복 간선이 아님
- source outgoing < 2
- target incoming < 2
- RNG 25% 성공

### 7-2. 새 흐름

위 조건 뒤에 zero-crossing 조건을 추가한다.

Entry 연결, 모든 일반 Depth 사이의 기본 연결, 마지막 Depth에서 Boss로 가는 연결을
먼저 모두 만든다. 현재 구현은 Boss 연결을 optional edge 처리 뒤에 추가하지만,
변경 후에는 RNG를 소비하지 않는 Boss 기본 연결을 먼저 완성해 solver가 매번 동일한
전체 필수 topology를 평가하게 한다. 이 순서 변경은 일반 Depth의 optional 후보 풀이나
차수 판정에는 영향을 주지 않는다.

개념 흐름:

```text
후보 순서 결정
  ↓
중복인가?          -> 버림
source 차수 꽉 참? -> 버림
target 차수 꽉 참? -> 버림
RNG 25% 실패?      -> 버림
  ↓
후보 간선을 임시 추가
  ↓
전체 최소 교차 수 계산
  ↓
0       -> 실제 채택
1 이상  -> 후보만 버림
```

의사 코드:

```ts
for (const candidate of shuffledCandidates) {
  if (!hasDegreeCapacity(candidate)) continue;
  if (!passesExistingRandomGate()) continue;

  const trialEdges = [...acceptedEdges, candidate];
  if (solver.solve(trialEdges).crossingCount !== 0) continue;

  addEdge(candidate);
}
```

### 7-3. greedy 채택 정책

이 설계는 모든 가능한 추가 간선 부분집합을 탐색해 간선 수의 전역 최댓값을 구하지 않는다.

그 방식은 작은 지도 생성 문제에 비해 복잡도가 과도하고, 기존 RNG 후보 우선순위도 사실상 무시하게 된다.

대신 현재 RNG가 만든 후보 순서를 설계 우선순위로 사용한다.

- 앞에서 채택한 안전한 간선은 유지한다.
- 뒤 후보는 지금까지 채택된 간선과 함께 zero-crossing이면 채택한다.
- 안전한 후보를 이유 없이 버리지 않는다.
- 한 후보 때문에 전체 zero-crossing이 깨질 때만 그 후보를 포기한다.

따라서 목표는 **전역 최대 간선 수**가 아니라 **기존 랜덤 분기 성격을 유지하면서 zero-crossing 계약을 절대 깨지 않는 것**이다.

### 7-4. RNG 결정성

같은 입력은 변경 후에도 항상 같은 결과를 내야 한다.

```text
campaignSeed + dungeonId + initialRiskLevel + attempt
```

이 값이 같으면 다음이 모두 같아야 한다.

- 템플릿
- 후보 순서
- RNG 판정
- 채택/거절된 추가 간선
- 최종 `GeneratedMap`

다만 이번 변경 전의 옛 `GeneratedMap`과 bit-for-bit 동일할 필요는 없다.

교차 간선이 거절되면 이후 차수 상태가 달라질 수 있어 뒤 후보의 RNG 호출 시점도 달라질 수 있다. 이는 정상적인 규칙 변경으로 인정한다.

별도 재추첨이나 성공할 때까지 attempt를 내부 증가시키는 방식은 사용하지 않는다.

### 7-5. 테스트 가능한 생성 경계와 진단

optional edge 채택을 seed 우연에만 의존해 테스트하지 않는다. 생성기는 다음처럼
완성 지도와 생성 진단을 함께 얻을 수 있는 내부용 경계를 제공한다.

```ts
export interface DungeonMapGenerationDiagnostics {
  readonly baseEdgeCount: number;
  readonly evaluatedOptionalCandidateCount: number;
  readonly acceptedOptionalEdgeCount: number;
  readonly rejectedForCrossingCount: number;
  readonly maximumRowCandidateCount: number;
}

export interface DungeonMapGenerationResult {
  readonly map: GeneratedMap;
  readonly diagnostics: DungeonMapGenerationDiagnostics;
}

export function generateDungeonMapWithDiagnostics(
  input: GenerateDungeonMapInput,
): DungeonMapGenerationResult;
```

기존 `generateDungeonMap(input): GeneratedMap`은 이 내부용 생성 경계를 호출하고
`map`만 반환하는 호환 API로 유지한다. 이 진단 함수와 타입은
`lib/rules/dungeon-map.ts`의 named export로 테스트와 구현 PR 진단에서만 사용하고,
domain barrel이나 UI에서 re-export하지 않는다. 진단은 `GeneratedMap`, Store,
저장 데이터에 넣지 않는다.

degree/RNG/zero-crossing 판정 순서를 담당하는 작은 내부 helper에는 결정적인 후보
목록과 RNG gate callback을 주입할 수 있게 한다. 집중 테스트는 이를 사용해 안전한
후보 채택, crossing 후보 거절, 거절 후 차수 미소비를 직접 검증한다. 이 helper는
domain barrel이나 UI API로 re-export하지 않는다.

---

## 8. 최종 E1 validator 계약

`generateDungeonMap`의 후보 필터만 믿지 않는다.

`validateGeneratedMap`에 zero-crossing 검증을 추가해 최종 생성 계약으로 고정한다.

검증 순서는 기존 구조 검증 뒤에 둔다.

1. Depth와 노드 무결성
2. 차수
3. 인접 Depth 간선
4. Entry 도달성
5. Boss 도달성
6. 동일 경로 길이
7. **최소 직선 교차 수가 0인지**

최소 교차 수가 1 이상이면 다음처럼 실패한다.

```text
RuleError("INVALID_GENERATION", ...)
```

세부 정보의 `minimumCrossingCount`에는 최소 교차 수를 반드시 포함한다.
`validateGeneratedMap`은 별도 생성
입력을 받지 않으므로 dungeon/attempt를 새 매개변수나 `GeneratedMap` 필드로 추가하지
않는다. 생성 경로의 상위 오류 문맥은 기존 결정적 NodeId와
`generateDungeonMapWithDiagnostics` 입력으로 추적한다.

검증 실패를 숨기기 위해 자동 재추첨하지 않는다.

### 기본 연결 검증

추가 간선을 넣기 전 기본 연결 상태도 개발 중 assertion 또는 집중 테스트에서 `crossingCount === 0`을 확인한다.

이 성질이 깨지면 추가 간선 필터가 아니라 기본 연결 알고리즘의 회귀다.

---

## 9. U4 책임 변경

E1이 zero-crossing을 보장한 뒤에도 U4의 행 순서 최적화는 삭제하지 않는다.

U4는 E1이 보장한 0 교차 embedding 중 실제 표시 순서를 결정해야 하기 때문이다.

다만 교차 계산 구현은 공용 solver를 사용한다.

### 9-1. `u4-dungeon-map-order.ts`

이 파일은 기존 공개 함수명인 `countU4LayerCrossings`와
`createU4OptimizedLayerOrder`를 유지하면서, `GeneratedMap`을 공용 rows/edges로
변환해 solver를 호출하는 thin adapter로 축소한다.

U4와 E1에 교차 계산 로직을 복제하지 않는다.

### 9-2. 표시 결과

정상적인 E1 지도에 대해 U4가 선택한 `crossingCount`는 항상 0이어야 한다.

기존 테스트의

```text
원래 순서보다 교차가 적다
```

만으로는 부족하다.

새 계약은

```text
최종 최소 교차 수 === 0
```

이다.

---

## 10. U4 실제 좌표의 교차 안전장치

공용 crossing 계산은 행 순서를 기준으로 한 논리적 직선 교차를 계산한다.

현재 U4는 같은 Depth 안에서도 방의 Y 좌표를 조금 흔들어 격자 느낌을 줄인다. 이 Y wobble은 행 순서를 뒤집지는 않지만, 실제 두 직선 segment의 기하학적 교차를 드물게 만들 가능성을 완전히 배제하지 않는다.

사용자가 보는 최종 화면에서도 X자 교차가 없어야 하므로 U4 레이아웃에 한 단계의 안전 검증을 둔다.

### 10-1. 최종 corridor 중심선 검사

표준 wobble 좌표로 corridor를 만든 뒤 실제 렌더에 사용하는 4자리 정규화 좌표를
검사한다. 부동소수점 epsilon에 결과가 흔들리지 않도록 각 좌표에 `10_000`을 곱해
정수로 바꾼 뒤 orientation 기반 닫힌 선분 교차를 계산한다.

검사 대상 corridor 쌍은 어떤 endpoint `NodeId`도 공유하지 않는 두 corridor다.
즉 `A -> B`와 `B -> C`처럼 한 방에서 이어지는 두 corridor도 제외한다. 논리 crossing의
같은 source/같은 target 제외보다 범위가 넓은 이유는, 기하 검사는 서로 다른 row pair의
corridor도 함께 비교하기 때문이다.

다음은 실제 교차로 센다.

- 두 선분 내부가 X자로 만나는 proper intersection
- 한 선분이 endpoint를 공유하지 않는 다른 corridor의 endpoint에 닿는 경우
- endpoint를 공유하지 않는 두 선분이 일부라도 일직선으로 겹치는 경우

같은 방을 endpoint로 공유하는 corridor끼리 방 중심에서 닿는 것은 교차로 세지 않는다.

- 실제 교차 0: 기존 wobble 좌표 유지
- 실제 교차 1 이상: deterministic fallback 적용

### 10-2. fallback

fallback 지도에서는 다음을 유지한다.

- 전역 최적 X 순서
- X spread
- X shift
- X wobble
- Entry/Boss 고정 위치
- 방 기울기/크기/flip variation

다음만 제거한다.

- 일반 노드 Y wobble

즉 각 Depth의 방을 해당 `depthY`에 다시 맞춘 뒤 corridor를 재계산한다.

행 자체가 zero-crossing 순서이므로 같은 Depth를 동일 Y에 놓으면 non-shared 직선 corridor의 X자 교차가 다시 생겨서는 안 된다.

fallback 결과에서도 실제 선분 교차가 남으면 조용히 렌더하지 않고
`U4MapLayoutError` 전용 오류로 실패시킨다. 오류에는 fallback 뒤 남은
`geometricCrossingCount`를 포함한다. 이는 유효한 E1 지도에서 도달해서는 안 되는
invariant violation이다.

현재 캠페인 화면은 layout을 render 중 순수 계산하고 별도 U4 error boundary를 두지
않는다. 이번 작업은 사용자 복구 UI나 재추첨을 추가하지 않는다. 자동 테스트에서
전용 오류 타입/메시지를 검증하고, 개발 및 운영 오류 수집에서 원인이 드러나게 한다.

### 10-3. 이 설계가 보장하지 않는 것

다음은 zero-crossing 계약의 대상이 아니다.

- 같은 방에서 갈라지는 corridor 이미지의 시작 부분이 시각적으로 닿는 현상
- 같은 방으로 합류하는 corridor 이미지가 방 근처에서 닿는 현상
- 한 방에서 다음 방으로 이어지는 연속 corridor가 그 공유 방에서 닿는 현상
- corridor PNG 두께 때문에 평행한 길의 외곽 픽셀이 가까워지는 현상

이들은 topology 교차가 아니라 corridor 시각 라우팅 문제다.

이번 변경은 **서로 다른 두 경로가 X자로 교차하는 문제**를 해결한다.

---

## 11. E3 및 필수 사건과의 경계

E3는 변경하지 않는다.

현재 `prepareExpeditionEvents`는 E1의 완성된 `GeneratedMap`을 입력으로 받아 다음을 배정한다.

- 공개 category
- 경로별 monster 최소치
- 보스 정보 지점
- strong predecessor/follower
- 사건 후보 용량

이 과정은 `nextNodeIds`를 추가하거나 제거하지 않는다.

따라서 zero-crossing을 위해 다음을 완화하지 않는다.

- monster 최소치
- strong link 수
- bossInfo 수
- 사건 중복 금지

반대로 이 필수 요소를 이유로 교차 간선을 허용하지도 않는다.

지도 topology와 사건 역할 배치는 계속 분리한다.

---

## 12. 분기 다양성 보존

zero-crossing을 가장 쉽게 만드는 방법은 선택적 추가 간선을 전부 없애는 것이다.

이 방식은 금지한다.

기본 연결만으로 게임은 성립하지만, 기존 E1이 추가 간선을 둔 이유는 같은 폭 템플릿에서도 분기와 재합류 모양에 변화를 주기 위해서다.

구현은 다음을 지켜야 한다.

- 기존 추가 간선 후보 풀 유지
- 기존 후보 shuffle 유지
- 기존 25% gate 유지
- 기존 degree cap 유지
- zero-crossing을 유지하는 후보는 채택
- zero-crossing을 깨는 후보만 거절

검증 시 위험도별로 추가 간선 수를 진단해 변경 전과 변경 후를 비교한다.

고정된 밸런스 임계값을 새 게임 규칙으로 만들지는 않는다. 다만 모든 지도에서 추가 간선이 0이 되는 구현은 본 설계에 맞지 않는다.

---

## 13. 성능 경계

정확한 전역 최적화를 유지하지만 입력 크기는 강하게 제한되어 있다.

- 일반 Depth 최대 8
- Entry/Boss 포함 최대 10행
- 한 일반 Depth 최대 5노드
- 한 행 순열 최대 120개
- 한 인접 Depth 후보 쌍 최대 25개

추가 간선마다 `permutations()`를 다시 생성하지 않는다.

solver는 행 후보를 한 번 준비하고 간선 집합만 바꿔 반복 계산한다.

추가로 다음 구조를 유지한다.

- solver 생성 시 순열과 displacement를 한 번만 준비한다.
- `solve` 시작 시 edge를 인접 row pair별로 한 번만 분류한다.
- DP transition은 해당 row pair의 작은 edge 목록만 사용한다.
- E1 incoming 차수는 후보마다 전체 edge map을 합산하지 않고 카운터로 유지한다.
- trial edge 하나를 평가하기 위해 `GeneratedMap` 전체를 매번 재구성하지 않는다.

구현 시 불필요하게 다음을 하지 않는다.

- 모든 추가 간선 부분집합 완전 탐색
- 내부 attempt 재추첨
- 브라우저에서 비결정적 worker 병렬화
- 확률적 crossing 휴리스틱

벽시계 시간에 의존하는 불안정한 CI 성능 임계값은 두지 않는다.

대신 테스트에서 최대 행 후보 수가 120이라는 구조적 상한과 solver 재사용 경계를 검증한다.

---

## 14. 코드 변경 경계

### 새 파일

다음 파일을 만든다.

```text
lib/rules/layered-map-crossing.ts
lib/rules/layered-map-crossing.test.ts
```

역할:

- 행 순열 준비
- crossing count
- displacement tie-break
- exact DP
- 반복 solve 가능한 solver

### 변경 파일

```text
lib/rules/dungeon-map.ts
lib/rules/dungeon-map.test.ts
components/game/u4-dungeon-map-order.ts
components/game/u4-dungeon-map-order.test.ts
components/game/u4-dungeon-map-layout.ts
components/game/u4-dungeon-map-layout.test.ts
components/game/u4-preview-data.test.ts
docs/experience/U4_DUNGEON_MAP.md
docs/systems/DUNGEON_EVENTS_AND_BOSSES.md
```

`docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`는 공식 지도 규칙의 소유 문서이므로 반드시
새 E1 zero-crossing topology 계약을 반영한다. `docs/experience/U4_DUNGEON_MAP.md`에는
공용 solver 사용과 실제 corridor fallback 책임을 반영한다.

### 변경하지 않는 핵심 영역

```text
lib/rules/expedition-events.ts
lib/domain의 GeneratedMap shape
MAP_TEMPLATES
사건 콘텐츠 catalog
전투 규칙
저장 데이터 shape
```

`GeneratedMap`에 좌표나 별도 `layerOrder` 필드를 저장하지 않는다.

zero-crossing은 생성 검증 가능한 topology 성질이며, 실제 표시 순서는 U4가 계산한다.

---

## 15. 테스트 설계

### 15-1. 공용 crossing solver

필수 fixture:

1. 단순 역전 2x2 그래프
   - 원래 순서 교차 1
   - 순서 변경으로 최소 0

2. 안전한 추가 간선

```text
A -> C
B -> D
A -> D
```

   - 최소 교차 0

3. 교차가 불가피한 K2,2

```text
A -> C
A -> D
B -> C
B -> D
```

   - 어떤 좌우 순서에서도 최소 교차 1 이상

4. 같은 source/target을 공유하는 간선
   - 분기/합류 자체는 crossing으로 세지 않음

5. 같은 rows + edges
   - 항상 같은 결과

6. 잘못된 rows
   - 빈 rows, 빈 행, 행 내부 중복 NodeId, 행 사이 중복 NodeId, 폭 6을 각각
     `INVALID_GENERATION`으로 거부

7. 잘못된 edges
   - rows에 없는 endpoint, 행 건너뛰기, 역방향, self edge, 중복 edge를 각각
     `INVALID_GENERATION`으로 거부

8. solver 재사용
   - 같은 solver instance에 서로 다른 edge 집합을 순서대로 넣어도 각각 독립적인
     정확한 결과를 반환
   - 행별 후보 수가 최대 120이고 solve마다 permutations를 재생성하지 않음

### 15-2. E1 추가 간선

- 안전한 후보는 채택 가능
- K2,2처럼 zero-crossing을 깨는 후보는 거절
- 거절된 후보가 source/target 차수를 소비하지 않음
- 기존 incoming/outgoing 1~2 유지
- 기본 연결 상태는 crossing 0
- 최종 지도는 crossing 0

### 15-3. validator

구조상 유효하지만 unavoidable crossing을 가진 수동 fixture를 만들어 `validateGeneratedMap`이 `INVALID_GENERATION`으로 거부하는지 확인한다.

### 15-4. 생성 회귀 매트릭스

CI에서 고정 seed 문자열을 사용해 다음 행렬을 검사한다.

- 아래 20개 seed
- 위험도 1~5
- attempt 0, 1, 2

총 300개 지도를 생성한다.

seed 목록은 다음으로 고정한다.

```text
e1-zero-crossing-00
e1-zero-crossing-01
e1-zero-crossing-02
e1-zero-crossing-03
e1-zero-crossing-04
e1-zero-crossing-05
e1-zero-crossing-06
e1-zero-crossing-07
e1-zero-crossing-08
e1-zero-crossing-09
e1-zero-crossing-10
e1-zero-crossing-11
e1-zero-crossing-12
e1-zero-crossing-13
e1-zero-crossing-14
e1-zero-crossing-15
e1-zero-crossing-16
e1-zero-crossing-17
e1-zero-crossing-18
e1-zero-crossing-19
```

각 조합의 `dungeonId`는 `e1-zero-crossing-risk-{riskLevel}`로 고정한다. seed,
riskLevel, attempt 외에 현재 날짜나 Git SHA처럼 실행마다 달라지는 값을 입력에 넣지 않는다.

모든 지도에서 확인:

- 기존 E1 validator 통과
- 최소 crossing `0`
- 모든 노드 도달 가능
- 모든 노드 Boss 도달 가능
- 차수 계약 유지
- 같은 입력 결정성

추가로 `generateDungeonMapWithDiagnostics`를 사용해 위험도별
`acceptedOptionalEdgeCount`, `rejectedForCrossingCount`,
`maximumRowCandidateCount`를 집계한다.

### 15-5. U4

- 정상 E1 지도에서 optimized `crossingCount === 0`
- 최종 corridor 중심선 실제 교차 0
- wobble로 교차 fixture를 만들면 Y-wobble fallback 후 0
- endpoint NodeId를 공유하는 연속/분기/합류 corridor는 기하 교차에서 제외
- endpoint를 공유하지 않는 proper intersection, endpoint touch, collinear overlap은 교차로 검출
- fallback 뒤에도 교차하는 잘못된 fixture는 전용 `U4MapLayoutError`로 실패
- X order와 X safe range 유지
- Entry/Boss 위치 유지
- 모든 E1 간선을 corridor에 정확히 한 번 렌더링

### 15-6. E3 회귀

기존 expedition event 테스트가 그대로 통과해야 한다.

특히 확인:

- 위험도별 strong link 수
- bossInfo cut
- 경로별 monster 최소치
- event materialization

zero-crossing 때문에 E3 규칙을 완화하는 테스트 수정은 허용하지 않는다.

---

## 16. 진단 및 검수

### 16-1. optional edge 계산 정의

한 지도의 기본 간선 수는 다음 합으로 정의한다.

```text
Entry -> Depth 1 간선 수
+ 각 일반 Depth 쌍의 max(currentWidth, nextWidth)
+ 마지막 Depth -> Boss 간선 수
```

현재 기본 연결 알고리즘은 이 수만큼 중복 없는 간선을 만든다. 따라서 완성 지도의
optional edge 수는 다음 두 방식이 같아야 한다.

```text
전체 edge 수 - baseEdgeCount
=== diagnostics.acceptedOptionalEdgeCount
```

두 값이 다르면 진단 또는 기본 연결 구현의 회귀로 실패시킨다.

### 16-2. 변경 전/후 기준선

변경 전 기준선은 이 spec의 기준 SHA
`226085835516fe5487e6dce681db76e9c6dbb06d`에서 위 300-map 고정 행렬을 실행해
기록한다. 구현 뒤에는 동일 seed, dungeonId, 위험도, attempt로 다시 측정한다.

구현 PR 설명 또는 첨부 진단에는 위험도별 표로 다음을 함께 남긴다.

- 위험도별 생성 샘플 수
- 변경 전 평균 optional edge 수
- 변경 후 평균 optional edge 수
- zero-crossing 때문에 거절된 평균 후보 수
- 최종 crossing 최대값

변경 전 구현에는 crossing 거절 개념이 없으므로 변경 전
`rejectedForCrossingCount`는 비교값 `해당 없음`으로 기록한다. 변경 후 수치는
`generateDungeonMapWithDiagnostics`에서 직접 집계한다. 측정만을 위해
`GeneratedMap`이나 저장 shape를 바꾸지 않는다.

최종 crossing 최대값은 반드시 `0`이어야 한다.

고정 밸런스 임계값은 두지 않지만 다음은 구현 실패다.

- 300개 지도 전체의 accepted optional edge 합이 0
- 진단의 optional edge 수와 실제 edge 차분이 불일치

위험도별 accepted optional edge 합이 0인 구간은 자동 실패로 고정하지 않고 진단 표에서
명시해 수동 검토한다. 실제 플레이 다양성 부족이 확인되기 전에는 새 위험도별 밸런스
임계값으로 승격하지 않는다.

### 16-3. 브라우저 검수

브라우저 검증은 기존 U4 viewport를 유지한다.

- 1920×1080
- 2560×1440
- 1440×900
- 1280×1024

각 viewport에서 확인:

- X자 corridor 교차 없음
- Entry부터 Boss까지 경로가 읽힘
- 분기와 합류가 지나치게 단순해지지 않음
- 방 겹침 없음
- 기존 60:40 레이아웃 유지
- 스크롤 없음
- current/selectable 표시 유지

---

## 17. 오류 처리

### 공용 solver 입력

행 또는 간선 무결성 위반은 `RuleError("INVALID_GENERATION", ...)`이다. 잘못된
endpoint나 비인접 간선을 무시하고 부분 그래프만 계산하지 않는다.

### 추가 후보

교차를 만드는 선택적 추가 간선은 정상적인 거절 후보다.

오류를 던지지 않고 그 후보만 건너뛴다.

### 기본 연결

기본 연결에서 최소 교차 수가 0이 아니면 생성 알고리즘 회귀다.

테스트 또는 명시적 generation assertion에서 실패시킨다.

### 최종 지도

`validateGeneratedMap`에서 최소 교차 수가 0이 아니면 `INVALID_GENERATION`이다.

오류 details의 `minimumCrossingCount`에 정확한 최소값을 넣는다.

자동 재추첨으로 숨기지 않는다.

### U4

E1 validator를 통과한 지도가 U4 logical optimizer에서 0을 찾지 못하면 E1/U4의 crossing 정의가 갈라진 버그다.

실제 좌표 fallback 뒤에도 corridor 중심선 교차가 남으면 렌더 결과를 조용히 허용하지
않고 `U4MapLayoutError`를 던진다. 이 오류 때문에 자동으로 Y/X 좌표를 다시 뽑거나
지도를 재생성하지 않는다. 별도 사용자 복구 UI는 이번 범위 밖이다.

---

## 18. 고려했지만 선택하지 않은 방식

### 방식 A. 추가 간선을 전부 제거

장점:

- 가장 단순함
- 교차 0 보장이 쉬움

단점:

- 현재 존재하는 선택적 분기/재합류 다양성을 통째로 잃음

결론: 사용하지 않는다.

### 방식 B. 현재 shuffle 좌표에서만 교차하는 후보를 제거

장점:

- 구현이 단순함
- 전역 DP를 생성기에 넣지 않아도 됨

단점:

- 다른 Depth 좌우 순서를 선택하면 살릴 수 있는 추가 간선도 불필요하게 제거함
- U4의 전역 최적화 능력을 활용하지 못함

결론: 사용하지 않는다.

### 방식 C. E1은 그대로 두고 U4 corridor를 곡선으로 우회

장점:

- E1 변경이 적음

단점:

- 논리적으로 교차가 불가피한 topology는 그대로 남음
- 경로 라우팅이 복잡해짐
- 같은 좁은 공간에 많은 곡선이 모이면 새로운 겹침 문제가 생김
- 현재 문제의 원인인 선택적 교차 간선을 그대로 허용함

결론: 이번 목표에는 사용하지 않는다.

### 방식 D. 추가 간선 부분집합 중 최대 개수의 planar 조합 탐색

장점:

- 이론적으로 더 많은 optional edge를 살릴 수 있음

단점:

- 후보 부분집합 조합 탐색이 과도함
- 기존 RNG 후보 우선순위 의미가 약해짐
- 현재 게임에서 필요한 수준을 넘는 복잡도

결론: 현재는 사용하지 않는다. 향후 지도 분기 밀도가 실제 플레이에서 부족하다는 증거가 생길 때만 별도 설계한다.

---

## 19. 완료 조건

다음을 모두 만족하면 구현 완료다.

- E1 기본 연결 규칙과 모든 기존 구조 계약이 유지된다.
- 선택적 추가 간선은 전체 최소 crossing이 0일 때만 채택된다.
- `validateGeneratedMap`이 zero-crossing을 최종 계약으로 검증한다.
- E1과 U4가 동일한 공용 exact crossing solver를 사용한다.
- 정상 `GeneratedMap`의 최소 crossing은 항상 0이다.
- 안전한 optional edge는 계속 생성된다.
- optional edge를 모두 제거하는 우회 구현을 사용하지 않는다.
- E3의 monster, bossInfo, strong link 규칙을 완화하지 않는다.
- U4 최종 corridor 중심선의 non-shared X자 교차가 0이다.
- 필요한 경우 Y wobble만 deterministic fallback되고 X 배치와 방 variation은 유지된다.
- 같은 입력은 같은 지도를 만든다.
- 300-map 고정 회귀 행렬이 모두 통과한다.
- 고정 seed/dungeonId 기준선에서 optional edge 진단 전후 표가 남는다.
- 공용 solver가 잘못된 rows/edges를 조용히 무시하지 않는다.
- 기하 교차는 4자리 렌더 좌표를 정수화한 닫힌 선분 교차 정의를 사용한다.
- `GeneratedMap`, Store, 저장 데이터 shape에 진단이나 표시 순서를 추가하지 않는다.
- 공식 지도 문서와 U4 경험 문서가 새 책임 경계로 갱신된다.
- 기존 전체 lint, typecheck, test, build가 통과한다.
- 네 기준 viewport에서 지도 교차와 레이아웃을 수동 확인한다.

---

## 20. 최종 책임 경계

변경 후 책임은 다음처럼 정리한다.

### E1

- 논리 지도 생성
- 필수 도달성/차수/Depth 계약
- optional edge 다양성
- **zero-crossing 가능한 topology 보장**

### 공용 crossing solver

- 가능한 행 순서 전체에서 정확한 최소 crossing 계산
- deterministic 최적 행 순서 반환
- rows/edges 입력 무결성 검증
- 행 후보 캐시와 row-pair edge 분류 재사용

### E3

- topology를 바꾸지 않고 필수 사건 역할과 category 배정

### U4

- 공용 solver가 선택한 zero-crossing 행 순서를 실제 X 좌표에 반영
- 화면의 불규칙한 방 배치 유지
- Y wobble이 실제 선분 교차를 만들면 deterministic fallback
- fallback 뒤 invariant violation은 `U4MapLayoutError`로 노출
- corridor/room 시각 표현

이 경계로 지도 생성 단계에서 교차 문제를 막고, U4는 이미 안전한 topology를 읽기 좋은 화면으로 표현하는 역할에 집중한다.
