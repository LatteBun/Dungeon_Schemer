# E1 위험도별 지도 생성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 초기 위험도와 재도전 횟수에서 결정적으로 층형 던전 그래프를 생성하고, E2·E3·U4가 소비할 Depth 계약을 제공한다.

**Architecture:** `lib/domain/dungeon.ts`에는 순수 데이터 계약인 `DungeonLayer`와 확장된 `GeneratedMap`만 둔다. `lib/rules/dungeon-map.ts`는 템플릿 데이터, 템플릿·그래프 검증기, 결정적 간선 생성과 공개 API를 한 곳에서 소유한다. 사건은 지도에 사전 배정하지 않으며, E3가 실제로 방문한 노드에서 Depth 슬롯 역할에 맞춰 물질화한다.

**Tech Stack:** TypeScript strict, Vitest 4, 기존 `createRng`/`derive("map")`, 기존 `RuleError`.

**Spec:** `docs/superpowers/specs/2026-08-22-lattebun-e1-risk-map-generation-design.md`

## Global Constraints

- `generateDungeonMap({ campaignSeed, dungeonId, initialRiskLevel, attempt })`는 시간·전역 가변 상태·`Math.random()`을 읽지 않는 순수 함수다.
- 일반 Depth 수는 초기 위험도 기준으로 ★1/★2 **6**, ★3 **7**, ★4/★5 **8**이며, 현재 `riskLevel`과 보스 ID는 E1 입력·출력이 아니다.
- 일반 간선은 `Entry → D1 → … → Dn → Boss`만 허용한다. 일반 노드의 incoming/outgoing은 각각 **1~2**, Entry outgoing과 Boss incoming은 각각 **1~2**다.
- 폭은 **1~5**, 첫·마지막 Depth는 최대 **2**, 이웃 폭은 양방향으로 최대 **2배**다. 유효하지 않은 템플릿·생성 결과는 재추첨하지 않고 `RuleError("INVALID_GENERATION", ...)`으로 실패한다.
- 위험도별 템플릿 수는 ★1 **3**, ★2 **3**, ★3 **3**, ★4 **4**, ★5 **3**이다. 동일 던전은 위험도 전용 템플릿 순서를 결정적으로 섞고 `attempt % pool.length`로 순환한다.
- Node ID는 던전 ID·attempt·Depth·Depth 내 index를 포함하며, `nodes` 배열 순서는 Entry → Depth 오름차순·layer index 오름차순 → Boss로 고정한다.
- `GeneratedMap`에는 사건 콘텐츠 ID 또는 `EventId`를 넣지 않는다. E3의 사건 중복 금지는 실제 원정에서 방문·물질화한 사건에 적용한다.
- 새 의존성을 추가하지 않는다. 코드 주석과 커밋 제목·본문은 한국어로 작성한다.

---

## File Structure

| 파일 | 책임 |
| --- | --- |
| `lib/domain/dungeon.ts` | `DungeonLayer`, `GeneratedMap.layers`의 공식 도메인 계약 |
| `lib/domain/index.ts` | `DungeonLayer` 공개 배럴 |
| `lib/domain/contract.test.ts` | 새 공개 타입과 `GeneratedMap.layers`의 최소 타입 계약 |
| `lib/domain/advice.test.ts` | 확장된 `GeneratedMap` fixture의 최소 유효 레이어 |
| `lib/rules/dungeon-map.ts` | E1 템플릿, 구조 검증, 결정적 층 그래프 생성 |
| `lib/rules/dungeon-map.test.ts` | 템플릿·그래프 불변식, 결정성, 재도전, 오류 계약 |
| `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md` | Depth·Depth 슬롯·방문 사건 기준의 공식 던전 규칙 |
| `docs/design/CORE_GAME_LOOP.md` | 초기 위험도가 일반 Depth를 정한다는 루프 규칙 |
| `docs/experience/ONBOARDING_AND_INTERFACE.md` | 공통 일반 지점을 요구하지 않는 지도 설명 |
| `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md` | E1/E2/E3 완료 기준의 새 계약 |
| `docs/DOCUMENT_TERMINOLOGY.test.ts` | 위 공식 문서에 새 용어 앵커가 남는 회귀 방지 |

---

### Task 1: 공식 문서와 작업 완료 기준을 새 지도 의미로 고정한다

**Files:**

- Modify: `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md:18-35,78-92,147-157,169-173`
- Modify: `docs/design/CORE_GAME_LOOP.md:20-25`
- Modify: `docs/experience/ONBOARDING_AND_INTERFACE.md:72-78`
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md:198-200`
- Modify: `docs/DOCUMENT_TERMINOLOGY.test.ts:REQUIRED_ANCHORS`

**Interfaces:**

- Consumes: Spec §§2, 8, 13
- Produces: E1 구현이 따라야 할 공식 문서 계약과 E2/E3의 후속 소비 경계

- [ ] **Step 1: 문서 앵커의 실패 검사를 먼저 추가한다.**

`REQUIRED_ANCHORS`에 아래 앵커를 추가한다. 아직 공식 문서에 없으므로 문서 테스트가 실패해야 한다.

```ts
"design/CORE_GAME_LOOP.md": [
  "월드턴", "위험도", "캐릭터 30명", "pending merchant effect",
  "일반 Depth", "방문한 사건",
],
"systems/DUNGEON_EVENTS_AND_BOSSES.md": [
  "위험도별 지도", "재도전", "★5", "생태 규칙", "다음 전투", "정보 판매",
  "일반 Depth", "Depth 슬롯",
],
"experience/ONBOARDING_AND_INTERFACE.md": [
  "인트로", "위험도", "월드턴", "골드 부족", "효과 중복 불가", "여러 Depth",
],
```

Run: `pnpm test docs/DOCUMENT_TERMINOLOGY.test.ts`

Expected: FAIL. 새 앵커가 아직 문서에 없다.

- [ ] **Step 2: 시스템 문서의 지도·강한 연계·재도전 규칙을 바꾼다.**

`DUNGEON_EVENTS_AND_BOSSES.md`에서 ★1~★5 표의 “일반 지점”을 “일반 Depth”로 교체하고 `6 / 6 / 7 / 8 / 8`을 유지한다. 각 Depth의 일반 노드는 1~5개, 첫·마지막은 최대 2개, 노드 차수는 최대 2개라고 적는다. 공통 일반 지점·공통 지점 수 요구를 제거하고, E3가 서로 다른 Depth 슬롯에서 강한 연계를 보장한다고 적는다.

사건 중복은 모든 지도 노드의 사전 배정이 아니라 실제 원정에서 방문한 사건에 적용하며, 방문 시 사건이 물질화된다고 명시한다. 실패·재도전 절에서는 일반 **Depth** 수와 초기 위험도 템플릿 풀이 유지되고 `attempt`만 달라진다고 적는다.

- [ ] **Step 3: 루프·온보딩 문서의 오래된 지도 설명을 바꾼다.**

`CORE_GAME_LOOP.md`의 캠페인 생성 항목을 “초기 위험도로 정해지는 일반 Depth 수”로 바꾸고, 지도 노드의 사건은 실제 방문 시 결정된다고 적는다. `ONBOARDING_AND_INTERFACE.md`의 “두 갈래는 보스 전 공통 지점에서 합쳐진다”를 “여러 Depth에서 갈라지고 합쳐질 수 있으며 Boss 외 공통 일반 지점을 요구하지 않는다”로 바꾼다.

- [ ] **Step 4: 배정표의 E1/E2/E3 완료 기준을 교체한다.**

E1에는 16개 폭 템플릿, 최대 폭 5, 각 노드의 incoming/outgoing 최대 2, `layers`, 결정적 재도전 순환과 `INVALID_GENERATION`을 적는다. E2의 보스 정보 보장은 Depth 슬롯을 실제 방문할 때 물질화한다고 바꾼다. E3는 공통 지점 대신 선후가 다른 Depth 슬롯을 사용하고, 중복 금지는 실제 방문 사건 ID에 적용한다고 바꾼다. E1 상태는 구현·검증 전까지 `⬜`로 유지한다.

- [ ] **Step 5: 문서 검사를 통과시킨다.**

Run: `pnpm test docs/DOCUMENT_TERMINOLOGY.test.ts docs/DOCUMENT_LINKS.test.ts docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.test.ts`

Expected: PASS. 폐기 용어·상대 링크·배정표 구조가 모두 유효하다.

- [ ] **Step 6: 문서 단위를 커밋한다.**

```bash
git add docs/systems/DUNGEON_EVENTS_AND_BOSSES.md docs/design/CORE_GAME_LOOP.md \
  docs/experience/ONBOARDING_AND_INTERFACE.md \
  docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md docs/DOCUMENT_TERMINOLOGY.test.ts
git commit -m "문서: 위험도별 지도 계약을 깊이 기준으로 바꾼다" \
  -m "공통 일반 지점 대신 Depth 슬롯을 사용하고 사건 중복 기준을 실제 방문 경로로 명시한다."
```

### Task 2: Depth를 도메인 계약으로 추가한다

**Files:**

- Modify: `lib/domain/dungeon.ts:144-157`
- Modify: `lib/domain/index.ts:40-53`
- Modify: `lib/domain/contract.test.ts`
- Modify: `lib/domain/advice.test.ts:198-222`

**Interfaces:**

- Consumes: Task 1의 일반 Depth 정의
- Produces:

```ts
export interface DungeonLayer {
  depth: number;
  nodeIds: readonly NodeId[];
}

export interface GeneratedMap {
  entryNodeId: NodeId;
  bossNodeId: NodeId;
  layers: readonly DungeonLayer[];
  nodes: readonly DungeonNode[];
}
```

- [ ] **Step 1: 새 공개 타입과 `layers` 필드의 실패 계약 테스트를 작성한다.**

`contract.test.ts`에서 아직 없는 `DungeonLayer`를 public barrel에서 import하고, `GeneratedMap` fixture가 `layers`를 보존한다고 단정한다. 구현 전에는 import와 객체 필드 양쪽이 타입 오류여야 한다.

```ts
import type { DungeonLayer, GeneratedMap, NodeId } from "@/lib/domain";

const layers: readonly DungeonLayer[] = [{ depth: 1, nodeIds: ["node-1" as NodeId] }];
const map: GeneratedMap = { entryNodeId: "entry" as NodeId, bossNodeId: "boss" as NodeId, layers, nodes: [] };
expect(map.layers).toBe(layers);
```

Run: `pnpm typecheck`

Expected: FAIL. `DungeonLayer`와 `GeneratedMap.layers`가 아직 없다.

- [ ] **Step 2: `DungeonLayer`와 `GeneratedMap.layers`를 구현·공개한다.**

`DungeonNode` 바로 뒤에 `DungeonLayer`를 선언하고 `GeneratedMap`에 `layers`를 넣는다. `lib/domain/index.ts`에서 `DungeonLayer`를 type export한다. 기존 `DungeonNode`의 `nextNodeIds` 계약과 `NodeId` 브랜드는 바꾸지 않는다.

- [ ] **Step 3: 기존 fixture를 유효한 빈 일반 레이어로 보정한다.**

Entry에서 Boss로 직접 연결하는 fixture는 E1 지도 검증의 대상이 아니므로, 타입 fixture에는 빈 레이어 배열만 넣는다.

```ts
map: {
  entryNodeId: "node-entry" as never,
  bossNodeId: "node-boss" as never,
  layers: [],
  nodes: [/* existing entry and boss */],
},
```

- [ ] **Step 4: 도메인 회귀를 확인한다.**

Run: `pnpm test lib/domain/contract.test.ts lib/domain/advice.test.ts && pnpm typecheck`

Expected: PASS. 기존 원정 상태 소비자는 `layers`를 보존하면서 타입 검사를 통과한다.

- [ ] **Step 5: 도메인 단위를 커밋한다.**

```bash
git add lib/domain/dungeon.ts lib/domain/index.ts lib/domain/contract.test.ts lib/domain/advice.test.ts
git commit -m "도메인: 던전 지도에 깊이 레이어를 추가한다" \
  -m "후속 사건 배치와 지도 화면이 공통 일반 지점 없이 경로 보장을 소비할 수 있게 한다."
```

### Task 3: 템플릿과 그래프 검증기의 실패 경로를 먼저 만든다

**Files:**

- Create: `lib/rules/dungeon-map.test.ts`
- Create: `lib/rules/dungeon-map.ts`

**Interfaces:**

```ts
export interface MapTemplate {
  id: string;
  riskLevel: RiskLevel;
  layerWidths: readonly number[];
}

export const MAP_TEMPLATES: readonly MapTemplate[];
export function validateMapTemplate(template: MapTemplate): void;
export function validateMapTemplates(templates: readonly MapTemplate[]): void;
export function validateGeneratedMap(map: GeneratedMap, initialRiskLevel: RiskLevel): void;
```

- [ ] **Step 1: 템플릿 데이터 계약의 실패 테스트를 작성한다.**

`dungeon-map.test.ts`에서 `MAP_TEMPLATES`가 위험도별 `3 / 3 / 3 / 4 / 3`, ID 16개 고유, Spec의 각 폭 배열과 평균 폭 범위를 만족한다고 단정한다. 아래 깨진 템플릿과 중복 ID가 든 템플릿 집합도 `RuleError`의 `code === "INVALID_GENERATION"`으로 거부하는 테스트를 쓴다.

```ts
validateMapTemplate({ id: "broken", riskLevel: 1, layerWidths: [3, 1, 1, 1, 1, 1] });
// 첫 Depth 폭 3과 3 -> 1 비율 위반
validateMapTemplates([{ id: "same", riskLevel: 1, layerWidths: [1, 1, 1, 1, 1, 1] }, { id: "same", riskLevel: 1, layerWidths: [1, 1, 1, 1, 1, 1] }]);
```

Run: `pnpm test lib/rules/dungeon-map.test.ts`

Expected: FAIL. 모듈과 공개 함수가 아직 없다.

- [ ] **Step 2: 템플릿 데이터와 `validateMapTemplate`을 최소 구현한다.**

Spec §4-3의 16개 배열을 `MAP_TEMPLATES` 하나에 `as const satisfies readonly MapTemplate[]`로 기록한다. `validateMapTemplate`은 `RISK_LEVELS`에 없는 위험도, 위험도별 Depth 수 불일치, 폭 1~5 위반, 첫·마지막 폭 2 초과, 이웃 폭의 두 배 초과를 검사한다. `validateMapTemplates`는 이 함수를 각 항목에 적용한 뒤 빈 ID·전역 중복 ID·위험도별 템플릿 수를 검사한다. 모두 `RuleError("INVALID_GENERATION", message, details)`로 실패한다.

```ts
const DEPTH_COUNT: Readonly<Record<RiskLevel, number>> = { 1: 6, 2: 6, 3: 7, 4: 8, 5: 8 };

function invalidGeneration(message: string, details: Record<string, unknown>): never {
  throw new RuleError("INVALID_GENERATION", message, details);
}
```

- [ ] **Step 3: 그래프 검증기의 깨진 입력 테스트를 추가한다.**

작은 유효 ★1 fixture를 만든 뒤, 각각 (a) 중복 `nextNodeIds`, (b) 존재하지 않는 NodeId, (c) 같은 Depth 간선, (d) Entry에서 닿지 않는 일반 노드, (e) Boss에 닿지 않는 일반 노드, (f) 일반 노드 incoming 또는 outgoing이 0/3인 경우를 만들고 `validateGeneratedMap`이 `INVALID_GENERATION`으로 거부한다고 단정한다.

Run: `pnpm test lib/rules/dungeon-map.test.ts`

Expected: FAIL. `validateGeneratedMap`이 아직 없다.

- [ ] **Step 4: 전체 구조 검증기를 구현한다.**

`nodes` ID Map과 reverse incoming Map을 만든 뒤 다음을 검사한다: Entry/Boss의 존재·kind·유일성, `layers[index].depth === index + 1`, 각 일반 노드가 정확히 한 레이어에 속함, 레이어 폭과 초기 위험도, 간선의 허용 방향, 중복·유령 간선, 모든 차수 범위, Entry 도달성, Boss 역도달성, ID 유일성이다. 레이어 간선만 허용하므로 Entry→Boss의 모든 경로 길이가 레이어 수와 같은지도 명시적으로 검사한다.

- [ ] **Step 5: 검증기 단위를 통과시킨다.**

Run: `pnpm test lib/rules/dungeon-map.test.ts`

Expected: PASS. 템플릿 정적 계약과 모든 의도적 그래프 위반이 검증된다.

- [ ] **Step 6: 검증기 단위를 커밋한다.**

```bash
git add lib/rules/dungeon-map.ts lib/rules/dungeon-map.test.ts
git commit -m "규칙: 위험도별 지도 템플릿과 검증기를 만든다" \
  -m "유효하지 않은 폭과 층형 그래프를 재추첨 없이 생성 오류로 거부한다."
```

### Task 4: 결정적 지도 생성과 재도전 순환을 구현한다

**Files:**

- Modify: `lib/rules/dungeon-map.ts`
- Modify: `lib/rules/dungeon-map.test.ts`

**Interfaces:**

```ts
export interface GenerateDungeonMapInput {
  campaignSeed: string;
  dungeonId: DungeonId;
  initialRiskLevel: RiskLevel;
  attempt: number;
}

export function generateDungeonMap(input: GenerateDungeonMapInput): GeneratedMap;
```

- [ ] **Step 1: 생성 API의 실패·결정성 테스트를 작성한다.**

각 위험도와 여러 `campaignSeed`·`dungeonId` 조합에서 생성한 지도를 `validateGeneratedMap`에 통과시킨다. 같은 입력은 `toEqual`, 서로 다른 `dungeonId`는 독립 템플릿 순서 또는 간선 결과, attempt 0→1은 서로 다른 템플릿 폭, 한 바퀴 뒤 attempt는 재현 가능한 순환을 단정한다. `attempt: -1`, `1.5`, `Number.NaN`은 `INVALID_GENERATION`이어야 한다.

```ts
const input = {
  campaignSeed: "e1-deterministic",
  dungeonId: "dungeon-spider-01" as DungeonId,
  initialRiskLevel: 4 as RiskLevel,
  attempt: 0,
};
expect(generateDungeonMap(input)).toEqual(generateDungeonMap(input));
```

Run: `pnpm test lib/rules/dungeon-map.test.ts`

Expected: FAIL. 생성 API가 아직 없다.

- [ ] **Step 2: 템플릿 순환과 결정적 Node ID를 구현한다.**

위험도별 템플릿만 골라 아래 두 독립 root seed를 사용한다. `attempt`는 `Number.isSafeInteger(attempt) && attempt >= 0`으로 검증한다.

```ts
const orderedTemplates = createRng(`${campaignSeed}:${dungeonId}:template-order`)
  .derive("map")
  .shuffle(templatesForRisk);
const template = orderedTemplates[attempt % orderedTemplates.length];
const mapRng = createRng(`${campaignSeed}:${dungeonId}:attempt:${attempt}`).derive("map");
```

Entry, Boss, 일반 노드는 각각 ``${dungeonId}:attempt:${attempt}:entry``, ``${dungeonId}:attempt:${attempt}:depth:${depth}:node:${index}``, ``${dungeonId}:attempt:${attempt}:boss`` 형식으로 만든다. `nodes` 배열에는 이 순서를 그대로 보존한다.

- [ ] **Step 3: 각 인접 레이어의 기본 간선을 구현한다.**

각 레이어의 노드 ID를 `mapRng.shuffle`한 후, 폭 `m <= n`이면 `A[Math.floor(j * m / n)] → B[j]`, `m > n`이면 `A[i] → B[Math.floor(i * n / m)]`를 추가한다. Entry는 D1 전체에, 마지막 Depth 전체는 Boss에 잇는다. 이로써 모든 일반 노드의 최소 incoming/outgoing 1을 재추첨 없이 보장한다.

- [ ] **Step 4: 선택적 교차 간선을 결정적으로 추가한다.**

기본 간선 뒤 모든 `(source, target)` 후보를 `mapRng.shuffle`한다. 후보마다 `source.outgoing < 2`, `target.incoming < 2`, 기존 간선 없음일 때만 `mapRng.int(0, 1) === 1`이면 추가한다. 기본 연결은 항상 남기므로 추가 간선이 0개여도 성공이며, 어떤 추가 간선도 차수·방향 제약을 우회하지 않는다.

- [ ] **Step 5: 생성 결과를 즉시 검증하고 구조 속성 테스트를 확장한다.**

생성 함수의 반환 직전에 `validateGeneratedMap(map, initialRiskLevel)`을 호출한다. 테스트는 모든 템플릿이 실제로 attempt 순환에서 선택됨, 모든 일반 노드가 정확히 한 `layer.nodeIds`에 있음, `layers`에 Entry/Boss가 없음, Node ID에 attempt가 들어가 재도전 Node ID 공간이 겹치지 않음을 단정한다. `GeneratedMap`에 `EventId` 또는 사건 콘텐츠 ID가 없다는 타입/런타임 구조 단정도 추가한다.

Run: `pnpm test lib/rules/dungeon-map.test.ts && pnpm typecheck`

Expected: PASS. 모든 위험도·시드·attempt의 지도가 구조 불변식과 재현성 계약을 만족한다.

- [ ] **Step 6: 생성기 단위를 커밋한다.**

```bash
git add lib/rules/dungeon-map.ts lib/rules/dungeon-map.test.ts
git commit -m "규칙: 결정적 위험도별 던전 지도를 생성한다" \
  -m "재도전마다 초기 위험도 템플릿 풀을 순환하고 층형 그래프 불변식을 검증한다."
```

### Task 5: E1 전체 검증과 완료 기록을 남긴다

**Files:**

- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md:E1 row only`

**Interfaces:**

- Consumes: Tasks 1–4의 문서·도메인·순수 규칙 API
- Produces: E1 완료 기록. E2/E3/U4는 미완료 상태로 유지한다.

- [ ] **Step 1: 범위가 E1에만 머무는지 확인한다.**

`git diff --name-only`에서 E2/E3 사건 배치, U4 좌표·컴포넌트, Store·상태 전이 파일이 포함되지 않았는지 확인한다. 이번 작업의 변경은 문서, 지도 도메인 계약, 지도 규칙과 테스트여야 한다.

- [ ] **Step 2: 전체 정적·테스트 검증을 실행한다.**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: 모두 exit 0. 네 명령 중 하나라도 실패하면 E1 완료 상태를 기록하지 않고 해당 실패를 먼저 수정한다.

- [ ] **Step 3: 배정표에서 E1만 완료 처리한다.**

E1 행의 상태를 `✅`로 바꾸고 담당을 `lattebun`으로 기록한다. E2/E3/U4 행은 그대로 `⬜`로 남긴다. 배정표 무결성 규칙에 따라 완료된 E1은 후속 행의 `선행` 열에서 제거한다.

- [ ] **Step 4: 문서 회귀 검사를 다시 실행한다.**

Run: `pnpm test docs/`

Expected: PASS. 문서 링크, 용어 앵커, 배정표 무결성이 완료 표기 후에도 통과한다.

- [ ] **Step 5: 완료 기록을 커밋한다.**

```bash
git add docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md
git commit -m "문서: E1 지도 생성을 완료로 기록한다" \
  -m "위험도별 층형 지도와 재도전 재현성 계약의 검증 완료 상태를 배정표에 반영한다."
```

## Plan Self-Review

- **Spec coverage:** 템플릿 16개와 폭·차수·도달성·동일 경로 길이는 Tasks 3–4, 도메인 `layers`는 Task 2, 시드·attempt 순환과 Node ID는 Task 4, Depth 슬롯·방문 사건 경계는 Tasks 1·4, U4 최대 밀도 문서는 Task 1, 공식 문서와 E1 완료 기준은 Tasks 1·5가 다룬다.
- **Scope:** E2 사건 선택·단서 판정, E3 사건 물질화 구현, U4 좌표·렌더링, C4 실패 정산과 I1 Store는 생성하지 않는다. E1은 후속 작업이 사용할 `layers`와 순수 그래프만 제공한다.
- **Type consistency:** `DungeonLayer`, `MapTemplate`, `GenerateDungeonMapInput`, `generateDungeonMap`, `validateMapTemplate`, `validateMapTemplates`, `validateGeneratedMap`의 이름과 서명을 모든 태스크에서 동일하게 사용한다.
- **Placeholder scan:** 미결정 표식과 모호한 검증 지시를 두지 않았다.
