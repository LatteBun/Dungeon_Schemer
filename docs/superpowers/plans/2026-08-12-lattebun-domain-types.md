# F1 도메인 타입 정의 실행 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dungeon Schemer 프로토타입의 게임 데이터를 `lib/domain/` 아래 다섯 개 파일의 TypeScript 타입과 상수로 정의한다.

**Architecture:** 로직 없이 타입과 상수만 만든다. 규칙이 분기하는 종류는 리터럴 유니온으로 닫고, 콘텐츠 데이터는 브랜드 ID로 연다. 런타임 코드가 없어 Vitest를 쓸 수 없으므로 `lib/domain/__checks__.ts`에 컴파일 성공 자체가 검사인 파일을 두고 `pnpm typecheck`를 빨강·초록 신호로 사용한다.

**Tech Stack:** TypeScript 5 (`strict: true`), Next.js 16.3.0, pnpm 11.21.0

## Global Constraints

- 커밋 메시지는 제목과 본문을 포함해 항상 한글로 작성한다. (`AGENTS.md`)
- 작업 브랜치는 `feature/domain-types`이며 `main`에 직접 push하지 않는다. (`docs/technical/TEAM_DEVELOPMENT_WORKFLOW.md`)
- 로직, 함수, 클래스를 만들지 않는다. 타입과 상수만 만든다.
- 신뢰도는 0 이상 100 이하 정수다. (`docs/systems/PARTY_AND_TRUST.md`)
- 성격은 `suspicious` `righteous` `greedy` `prudent` `impulsive` 다섯으로 고정한다. (`docs/systems/PARTY_AND_TRUST.md`)
- 이벤트 분류는 `monster` `rest` `merchant` `special` 넷으로 고정한다. (`docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`)
- 진행 단계는 `partyIntro` `pathChoice` `event` `bossFight` `settlement` `ended` 여섯으로 고정한다. (`docs/design/CORE_GAME_LOOP.md`)
- 자원은 `gold` `food` `reputation` 셋이다. (`docs/design/CORE_GAME_LOOP.md`)
- 파티 인원은 3명 이상 5명 이하다. (`docs/systems/PARTY_AND_TRUST.md`)
- 초기값, 증감량, 성공 확률 상수를 만들지 않는다. 아직 확정하지 않은 값이다.
- `@ts-expect-error`에는 반드시 설명을 붙인다. `ban-ts-comment` 규칙이 설명 없는 억제 주석을 막는다.
- `__checks__.ts`의 모든 검사값은 `export`한다. `no-unused-vars` 규칙이 미사용 변수를 오류로 잡는다.
- `import type`을 사용한다. `isolatedModules: true`이므로 타입만 가져올 때 값 import를 쓰면 안 된다.

### 환경 확인 결과

계획 작성 시점에 확인한 사실이다. 다시 조사할 필요 없다.

- `tsconfig.json`에 `"paths": { "@/*": ["./*"] }`가 이미 있다. **경로 별칭 설정을 추가하지 않는다.**
- `tsconfig.json`의 `include`에 `"**/*.ts"`가 있다. **`lib/`를 include에 추가하지 않는다.** 새 파일이 자동으로 typecheck 대상이 된다.
- `tsconfig.json`에 `"strict": true`가 이미 있다.
- `lib/` 디렉터리는 아직 없다. Task 1에서 처음 생긴다.
- `package.json`에 `test` 스크립트가 없다. Vitest는 `F4`의 범위이며 이 작업의 선행이 아니다. **`pnpm test`를 실행하지 않는다.**

### 검증 명령

```bash
pnpm typecheck   # 이 작업의 주 신호
pnpm lint
pnpm build       # 마지막 태스크에서 한 번
```

---

## File Structure

| 파일 | 책임 | 의존 |
| --- | --- | --- |
| `lib/domain/ids.ts` | `Brand` 유틸과 ID 타입 7개 | 없음 |
| `lib/domain/party.ts` | `PartyMember`, `Personality`, `ClassDef`, 파티·신뢰 상수 | `ids` |
| `lib/domain/info.ts` | `InfoCard`, `TruthType`, `Target`, `InfoClaim` | `ids` |
| `lib/domain/dungeon.ts` | `DungeonEvent`, `EventKind`, `DungeonNode`, `DungeonState` | `ids` |
| `lib/domain/run.ts` | `RunState`, `RunPhase`, `Resources`, `TrustChange`, `DecisionRecord` | `ids` `info` `dungeon` `party` |
| `lib/domain/index.ts` | 배럴 재export | 위 다섯 개 |
| `lib/domain/__checks__.ts` | 컴파일 시점 검사와 예시 값 | 위 전부 |

`__checks__.ts`는 태스크마다 조금씩 자란다. 각 태스크가 자기 타입에 대한 검사를 덧붙인다.

---

## Task 1: ID와 브랜드 타입

**Files:**
- Create: `lib/domain/ids.ts`
- Create: `lib/domain/__checks__.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `Brand<T, B>`, `MemberId`, `ClassId`, `CardId`, `EventId`, `NodeId`, `ClaimId`, `ItemId`. 모두 `string`의 브랜드 타입이며 런타임 표현은 문자열이다. 값을 만들 때는 `"m1" as MemberId`처럼 단정한다.

- [ ] **Step 1: 실패하는 검사 파일을 만든다**

`lib/domain/__checks__.ts`를 만든다. 아직 없는 `./ids`를 가져오므로 컴파일이 실패해야 한다.

```ts
// 이 파일은 컴파일에 성공하는 것 자체가 검사다.
// 런타임에 실행하지 않으며 애플리케이션이 가져오지 않는다.
// 모든 값을 export하는 이유는 no-unused-vars 규칙을 피하기 위함이다.
import type { MemberId, NodeId } from "./ids";

export const memberId = "m1" as MemberId;
export const nodeId = "n1" as NodeId;

// 브랜드가 동작하면 NodeId를 MemberId 자리에 넣을 수 없다.
// @ts-expect-error NodeId는 MemberId에 대입할 수 없다
export const wrongId: MemberId = nodeId;
```

- [ ] **Step 2: 검사가 실패하는지 확인한다**

Run: `pnpm typecheck`
Expected: FAIL. `Cannot find module './ids'` 오류가 난다.

- [ ] **Step 3: `ids.ts`를 만든다**

```ts
declare const brand: unique symbol;

/**
 * 같은 string이지만 서로 섞이지 않는 ID 타입을 만든다.
 * brand는 타입 수준에만 존재하므로 런타임 비용이 없다.
 */
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type MemberId = Brand<string, "MemberId">;
export type ClassId = Brand<string, "ClassId">;
export type CardId = Brand<string, "CardId">;
export type EventId = Brand<string, "EventId">;
export type NodeId = Brand<string, "NodeId">;
export type ClaimId = Brand<string, "ClaimId">;
export type ItemId = Brand<string, "ItemId">;
```

- [ ] **Step 4: 검사가 통과하는지 확인한다**

Run: `pnpm typecheck`
Expected: PASS. 출력 없이 종료한다.

`@ts-expect-error` 줄에서 "Unused '@ts-expect-error' directive" 오류가 나면 브랜드가 동작하지 않는다는 뜻이다. `Brand` 정의를 다시 확인한다.

- [ ] **Step 5: lint를 확인한다**

Run: `pnpm lint`
Expected: PASS. 경고나 오류가 없다.

- [ ] **Step 6: 커밋**

```bash
git add lib/domain/ids.ts lib/domain/__checks__.ts
git commit -m "기능: 도메인 ID와 브랜드 타입 추가

같은 string이지만 서로 섞이지 않는 ID 타입 일곱 개를 정의한다.
MemberId 자리에 NodeId를 넣는 실수가 컴파일 타임에 잡힌다.

런타임 코드가 없어 Vitest를 쓸 수 없으므로 컴파일 성공 자체가
검사인 __checks__.ts를 함께 추가한다."
```

---

## Task 2: 파티원과 성격

**Files:**
- Create: `lib/domain/party.ts`
- Modify: `lib/domain/__checks__.ts`

**Interfaces:**
- Consumes: `MemberId`, `ClassId` (Task 1)
- Produces: `Personality` (닫힌 유니온 5종), `ClassDef`, `PartyMember`, 상수 `PERSONALITIES` `PARTY_SIZE_MIN=3` `PARTY_SIZE_MAX=5` `TRUST_MIN=0` `TRUST_MAX=100`. `PartyMember.trust`는 `number`이며 범위 보장은 `R2`의 책임이다.

- [ ] **Step 1: 실패하는 검사를 덧붙인다**

`lib/domain/__checks__.ts`의 기존 내용 아래에 추가한다. import 줄도 함께 늘린다. 파일 전체가 다음과 같이 된다.

```ts
// 이 파일은 컴파일에 성공하는 것 자체가 검사다.
// 런타임에 실행하지 않으며 애플리케이션이 가져오지 않는다.
// 모든 값을 export하는 이유는 no-unused-vars 규칙을 피하기 위함이다.
import type { ClassId, MemberId, NodeId } from "./ids";
import {
  PARTY_SIZE_MAX,
  PARTY_SIZE_MIN,
  PERSONALITIES,
  TRUST_MAX,
  TRUST_MIN,
} from "./party";
import type { ClassDef, PartyMember, Personality } from "./party";

export const memberId = "m1" as MemberId;
export const nodeId = "n1" as NodeId;

// 브랜드가 동작하면 NodeId를 MemberId 자리에 넣을 수 없다.
// @ts-expect-error NodeId는 MemberId에 대입할 수 없다
export const wrongId: MemberId = nodeId;

// 상수의 개수와 값이 설정집과 맞는지 확인한다.
export const personalityCount: 5 = PERSONALITIES.length;
export const partySizeRange: [3, 5] = [PARTY_SIZE_MIN, PARTY_SIZE_MAX];
export const trustRange: [0, 100] = [TRUST_MIN, TRUST_MAX];

export const sampleClass: ClassDef = {
  id: "warrior" as ClassId,
  name: "전사",
  description: "앞에서 버티며 파티의 피해를 받아낸다.",
};

export const sampleMember: PartyMember = {
  id: memberId,
  name: "라스",
  classId: sampleClass.id,
  personality: "righteous",
  trust: 55,
  alive: true,
};

// 목록에 없는 성격은 대입할 수 없다.
// @ts-expect-error brave는 확정된 성격 다섯에 없다
export const wrongPersonality: Personality = "brave";
```

- [ ] **Step 2: 검사가 실패하는지 확인한다**

Run: `pnpm typecheck`
Expected: FAIL. `Cannot find module './party'` 오류가 난다.

- [ ] **Step 3: `party.ts`를 만든다**

```ts
import type { ClassId, MemberId } from "./ids";

/**
 * 성격은 닫힌 목록이다. 신뢰 판정이 성격마다 다르게 분기하므로
 * 성격 추가는 콘텐츠 추가가 아니라 규칙 변경이다.
 * docs/systems/PARTY_AND_TRUST.md
 */
export type Personality =
  | "suspicious"
  | "righteous"
  | "greedy"
  | "prudent"
  | "impulsive";

export const PERSONALITIES = [
  "suspicious",
  "righteous",
  "greedy",
  "prudent",
  "impulsive",
] as const satisfies readonly Personality[];

export const PARTY_SIZE_MIN = 3;
export const PARTY_SIZE_MAX = 5;

/** 신뢰도 0은 정체가 발각된 상태이며 처형으로 이어진다. */
export const TRUST_MIN = 0;
export const TRUST_MAX = 100;

/**
 * 직업은 열린 목록이다. 콘텐츠 데이터로 관리하며
 * 새 직업을 추가할 때 규칙을 고치지 않는다.
 */
export interface ClassDef {
  id: ClassId;
  name: string;
  description: string;
}

export interface PartyMember {
  id: MemberId;
  name: string;
  classId: ClassId;
  personality: Personality;
  /** TRUST_MIN 이상 TRUST_MAX 이하. 범위 보장은 신뢰 판정의 책임이다. */
  trust: number;
  alive: boolean;
}
```

- [ ] **Step 4: 검사가 통과하는지 확인한다**

Run: `pnpm typecheck`
Expected: PASS.

`personalityCount`에서 "Type 'number' is not assignable to type '5'" 오류가 나면 `as const`가 빠진 것이다. `satisfies`만 쓰면 튜플이 되지 않아 `length`가 `number`로 넓어진다.

- [ ] **Step 5: lint를 확인한다**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add lib/domain/party.ts lib/domain/__checks__.ts
git commit -m "기능: 파티원과 성격 타입 추가

성격은 닫힌 유니온 다섯으로, 직업은 열린 ClassId로 표현한다.
신뢰 판정이 성격마다 분기해야 하므로 성격은 코드가 알아야 하고,
직업은 콘텐츠 데이터로 추가할 수 있어야 한다.

신뢰 척도와 파티 인원 상수를 함께 정의한다."
```

---

## Task 3: 정보 카드와 던전

**Files:**
- Create: `lib/domain/info.ts`
- Create: `lib/domain/dungeon.ts`
- Modify: `lib/domain/__checks__.ts`

**Interfaces:**
- Consumes: `CardId`, `ClaimId`, `MemberId`, `EventId`, `NodeId` (Task 1)
- Produces: `TruthType` (닫힌 유니온 3종), `Target`, `InfoCard`, `InfoClaim`, 상수 `TRUTH_TYPES`, `EventKind` (닫힌 유니온 4종), `DungeonEvent`, `DungeonNode`, `DungeonState`, 상수 `EVENT_KINDS`. `InfoClaim.toldAt`은 `DecisionRecord.at`과 같은 로그 순번이다. `DungeonNode.nextNodeIds`가 빈 배열이면 보스전 직전이다.

- [ ] **Step 1: 실패하는 검사를 덧붙인다**

`lib/domain/__checks__.ts`를 두 곳 고친다. **import 문은 반드시 파일 맨 위 import 블록에 모아 둔다.** 파일 중간에 import를 넣으면 `import/first` 규칙에 걸린다.

먼저 기존 `./ids` 타입 import 줄을 다음으로 바꾼다.

```ts
import type {
  CardId,
  ClaimId,
  ClassId,
  EventId,
  MemberId,
  NodeId,
} from "./ids";
```

그다음 import 블록 끝에 네 줄을 추가한다.

```ts
import { TRUTH_TYPES } from "./info";
import type { InfoCard, InfoClaim, Target } from "./info";
import { EVENT_KINDS } from "./dungeon";
import type { DungeonEvent, DungeonNode, DungeonState } from "./dungeon";
```

파일 맨 아래에 추가할 검사:

```ts
export const truthTypeCount: 3 = TRUTH_TYPES.length;
export const eventKindCount: 4 = EVENT_KINDS.length;

export const sampleTargetMember: Target = { kind: "member", id: memberId };
export const sampleTargetBoss: Target = { kind: "boss" };

export const sampleCard: InfoCard = {
  id: "card-boss-weakness-fire" as CardId,
  truthType: "truth",
  topic: "보스 약점",
  text: "보스는 화염에 약하다.",
};

export const sampleClaim: InfoClaim = {
  id: "claim-1" as ClaimId,
  cardId: sampleCard.id,
  target: sampleTargetMember,
  toldAt: 0,
};

export const sampleEvent: DungeonEvent = {
  id: "event-goblin-ambush" as EventId,
  kind: "monster",
  title: "고블린 매복",
  description: "좁은 길에서 고블린 세 마리가 튀어나온다.",
};

export const bossNode: DungeonNode = {
  id: "n-boss" as NodeId,
  depth: 2,
  eventId: sampleEvent.id,
  nextNodeIds: [],
};

export const entryNode: DungeonNode = {
  id: nodeId,
  depth: 0,
  eventId: sampleEvent.id,
  nextNodeIds: [bossNode.id],
};

export const sampleDungeon: DungeonState = {
  nodes: [entryNode, bossNode],
  entryNodeId: entryNode.id,
  bossNodeId: bossNode.id,
};

// 목록에 없는 이벤트 분류는 대입할 수 없다.
// @ts-expect-error trap은 확정된 이벤트 분류 넷에 없다
export const wrongEventKind: DungeonEvent["kind"] = "trap";
```

- [ ] **Step 2: 검사가 실패하는지 확인한다**

Run: `pnpm typecheck`
Expected: FAIL. `Cannot find module './info'`와 `Cannot find module './dungeon'` 오류가 난다.

- [ ] **Step 3: `info.ts`를 만든다**

```ts
import type { CardId, ClaimId, MemberId } from "./ids";

export type TruthType = "truth" | "lie" | "neutral";

export const TRUTH_TYPES = [
  "truth",
  "lie",
  "neutral",
] as const satisfies readonly TruthType[];

/** 정보를 받는 대상. 용사 개인 또는 보스다. */
export type Target =
  | { kind: "member"; id: MemberId }
  | { kind: "boss" };

export interface InfoCard {
  id: CardId;
  truthType: TruthType;
  /** "보스 약점", "파티 구성"처럼 카드가 다루는 주제다. */
  topic: string;
  text: string;
}

/**
 * 전달했지만 아직 사실 여부가 드러나지 않은 정보다.
 * docs/systems/INFORMATION_AND_DECEPTION.md
 */
export interface InfoClaim {
  id: ClaimId;
  cardId: CardId;
  target: Target;
  /** 전달한 시점의 로그 순번. DecisionRecord.at과 같은 축이다. */
  toldAt: number;
}
```

- [ ] **Step 4: `dungeon.ts`를 만든다**

```ts
import type { EventId, NodeId } from "./ids";

/**
 * 이벤트 분류는 닫힌 목록이다. 분류마다 제시하는 행동과 처리가 다르다.
 * 개별 이벤트는 이 분류 안에서 콘텐츠 데이터로 추가한다.
 * docs/systems/DUNGEON_EVENTS_AND_BOSSES.md
 */
export type EventKind = "monster" | "rest" | "merchant" | "special";

export const EVENT_KINDS = [
  "monster",
  "rest",
  "merchant",
  "special",
] as const satisfies readonly EventKind[];

export interface DungeonEvent {
  id: EventId;
  kind: EventKind;
  title: string;
  description: string;
}

/** 던전은 되돌아가지 않는 분기 그래프다. */
export interface DungeonNode {
  id: NodeId;
  /** 입구에서의 거리. 경로 지도가 세로 위치를 잡는 데 쓴다. */
  depth: number;
  eventId: EventId;
  /** 빈 배열이면 보스전 직전이다. */
  nextNodeIds: NodeId[];
}

export interface DungeonState {
  nodes: DungeonNode[];
  entryNodeId: NodeId;
  bossNodeId: NodeId;
}
```

- [ ] **Step 5: 검사가 통과하는지 확인한다**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: lint를 확인한다**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add lib/domain/info.ts lib/domain/dungeon.ts lib/domain/__checks__.ts
git commit -m "기능: 정보 카드와 던전 타입 추가

진실·거짓·중립 카드, 정보를 받는 대상, 미검증 정보를 정의한다.
이벤트 분류 넷을 닫힌 유니온으로 고정하고 던전을 되돌아가지 않는
분기 그래프로 표현한다.

미검증 정보는 거짓말의 대가가 나중에 오기 때문에 상태로 보관한다."
```

---

## Task 4: 런 상태와 결정 로그

**Files:**
- Create: `lib/domain/run.ts`
- Modify: `lib/domain/__checks__.ts`

**Interfaces:**
- Consumes: `MemberId`, `NodeId` (Task 1), `PartyMember` (Task 2), `InfoClaim` (Task 3), `DungeonState` (Task 3)
- Produces: `RunPhase` (닫힌 유니온 6종), `Resources`, `TrustChange`, `DecisionRecord`, `RunState`, 상수 `RUN_PHASES`. `DecisionRecord.at`은 0부터 시작하는 로그 순번이며 시각이 아니다. `RunState.log`는 추가 전용이다.

- [ ] **Step 1: 실패하는 검사를 덧붙인다**

`lib/domain/__checks__.ts`의 import 블록에 추가한다.

```ts
import { RUN_PHASES } from "./run";
import type {
  DecisionRecord,
  Resources,
  RunState,
  TrustChange,
} from "./run";
```

파일 맨 아래에 추가한다.

```ts
export const runPhaseCount: 6 = RUN_PHASES.length;

export const sampleResources: Resources = {
  gold: 20,
  food: 3,
  reputation: 0,
};

export const sampleTrustChange: TrustChange = {
  memberId,
  delta: -8,
  reason: "정의로운 성격: 거짓 정보가 발각됨",
};

export const sampleRecord: DecisionRecord = {
  at: 0,
  nodeId: entryNode.id,
  summary: "성직자에게 보스 약점을 사실대로 알렸다.",
  trustChanges: [sampleTrustChange],
};

// 필수 필드가 모두 있는 완전한 런 상태다.
// 필드를 하나라도 빼면 컴파일이 실패한다.
export const sampleRunState: RunState = {
  seed: "seed-0001",
  phase: "pathChoice",
  party: [sampleMember],
  dungeon: sampleDungeon,
  currentNodeId: entryNode.id,
  resources: sampleResources,
  pendingClaims: [sampleClaim],
  log: [sampleRecord],
};

// 목록에 없는 단계는 대입할 수 없다.
// @ts-expect-error growth는 확정된 진행 단계 여섯에 없다
export const wrongPhase: RunState["phase"] = "growth";
```

- [ ] **Step 2: 검사가 실패하는지 확인한다**

Run: `pnpm typecheck`
Expected: FAIL. `Cannot find module './run'` 오류가 난다.

- [ ] **Step 3: `run.ts`를 만든다**

```ts
import type { MemberId, NodeId } from "./ids";
import type { DungeonState } from "./dungeon";
import type { InfoClaim } from "./info";
import type { PartyMember } from "./party";

/**
 * 프로토타입이 다루는 한 판의 진행 단계다.
 * docs/design/CORE_GAME_LOOP.md
 */
export type RunPhase =
  | "partyIntro"
  | "pathChoice"
  | "event"
  | "bossFight"
  | "settlement"
  | "ended";

export const RUN_PHASES = [
  "partyIntro",
  "pathChoice",
  "event",
  "bossFight",
  "settlement",
  "ended",
] as const satisfies readonly RunPhase[];

/** 한 판에서 관리하는 자원. 개별 물품은 아이템으로 따로 관리한다. */
export interface Resources {
  gold: number;
  food: number;
  reputation: number;
}

export interface TrustChange {
  memberId: MemberId;
  delta: number;
  /** "정의로운 성격: 거짓 정보가 발각됨"처럼 사람이 읽는 문장이다. */
  reason: string;
}

/**
 * 한 번의 결정과 그 결과를 남긴 기록이다.
 * 정산이 "영향을 준 선택"을 만들고 화면이 신뢰 변화 사유를 보여줄 때 쓴다.
 */
export interface DecisionRecord {
  /** 0부터 시작하는 로그 순번. 시각이 아니다. 시각을 쓰면 재현성이 깨진다. */
  at: number;
  nodeId: NodeId;
  summary: string;
  trustChanges: TrustChange[];
}

export interface RunState {
  seed: string;
  phase: RunPhase;
  party: PartyMember[];
  dungeon: DungeonState;
  currentNodeId: NodeId;
  resources: Resources;
  /** 아직 사실 여부가 드러나지 않은 정보다. */
  pendingClaims: InfoClaim[];
  /** 추가 전용이다. 이미 쌓인 기록을 고치지 않는다. */
  log: DecisionRecord[];
}
```

- [ ] **Step 4: 검사가 통과하는지 확인한다**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: lint를 확인한다**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add lib/domain/run.ts lib/domain/__checks__.ts
git commit -m "기능: 런 상태와 결정 로그 타입 추가

한 판의 상태를 중첩 객체로 표현하고 그 옆에 추가 전용 결정 로그를
둔다. 정산이 영향을 준 선택 목록을 만들고 화면이 신뢰 변화 사유를
보여주려면 로그가 처음부터 상태의 일부여야 한다.

로그 순번을 시각이 아닌 정수로 둔다. 시각을 쓰면 같은 시드로
재현했을 때 값이 달라져 재현성 검사를 방해한다."
```

---

## Task 5: 배럴과 통합 검증

**Files:**
- Create: `lib/domain/index.ts`
- Modify: `lib/domain/__checks__.ts`

**Interfaces:**
- Consumes: Task 1~4의 모든 타입과 상수
- Produces: `@/lib/domain` 하나로 모든 도메인 타입에 접근하는 경로. `F2` `F3` `R1` `R2` `R3` `R4`는 개별 파일 대신 이 배럴에서 가져온다.

- [ ] **Step 1: 실패하는 검사를 덧붙인다**

`lib/domain/__checks__.ts`를 두 곳 고친다. import는 맨 위 블록에 넣는다.

import 블록 끝에 한 줄을 추가한다.

```ts
import * as domain from "@/lib/domain";
```

파일 맨 아래에 검사를 추가한다. 배럴이 모든 것을 내보내는지 확인한다.

```ts
export const barrelHasAllConstants: [5, 4, 3, 6, 3, 5, 0, 100] = [
  domain.PERSONALITIES.length,
  domain.EVENT_KINDS.length,
  domain.TRUTH_TYPES.length,
  domain.RUN_PHASES.length,
  domain.PARTY_SIZE_MIN,
  domain.PARTY_SIZE_MAX,
  domain.TRUST_MIN,
  domain.TRUST_MAX,
];

export const barrelRunState: domain.RunState = sampleRunState;
export const barrelMember: domain.PartyMember = sampleMember;
export const barrelCard: domain.InfoCard = sampleCard;
export const barrelClaim: domain.InfoClaim = sampleClaim;
export const barrelNode: domain.DungeonNode = entryNode;
export const barrelRecord: domain.DecisionRecord = sampleRecord;
export const barrelClassDef: domain.ClassDef = sampleClass;
export const barrelTarget: domain.Target = sampleTargetBoss;
export const barrelEvent: domain.DungeonEvent = sampleEvent;
export const barrelDungeon: domain.DungeonState = sampleDungeon;
export const barrelResources: domain.Resources = sampleResources;
export const barrelTrustChange: domain.TrustChange = sampleTrustChange;
```

- [ ] **Step 2: 검사가 실패하는지 확인한다**

Run: `pnpm typecheck`
Expected: FAIL. `Cannot find module '@/lib/domain'` 오류가 난다.

- [ ] **Step 3: `index.ts`를 만든다**

```ts
export type {
  Brand,
  CardId,
  ClaimId,
  ClassId,
  EventId,
  ItemId,
  MemberId,
  NodeId,
} from "./ids";

export {
  PARTY_SIZE_MAX,
  PARTY_SIZE_MIN,
  PERSONALITIES,
  TRUST_MAX,
  TRUST_MIN,
} from "./party";
export type { ClassDef, PartyMember, Personality } from "./party";

export { TRUTH_TYPES } from "./info";
export type { InfoCard, InfoClaim, Target, TruthType } from "./info";

export { EVENT_KINDS } from "./dungeon";
export type {
  DungeonEvent,
  DungeonNode,
  DungeonState,
  EventKind,
} from "./dungeon";

export { RUN_PHASES } from "./run";
export type {
  DecisionRecord,
  Resources,
  RunPhase,
  RunState,
  TrustChange,
} from "./run";
```

- [ ] **Step 4: 검사가 통과하는지 확인한다**

Run: `pnpm typecheck`
Expected: PASS.

`barrelHasAllConstants`에서 오류가 나면 배럴에서 빠진 상수가 있다는 뜻이다. 오류 메시지가 가리키는 위치의 값을 `index.ts`에 추가한다.

- [ ] **Step 5: lint를 확인한다**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 6: 프로덕션 빌드를 확인한다**

Run: `pnpm build`
Expected: 빌드 성공. `__checks__.ts`는 어떤 화면도 가져오지 않으므로 번들에 들어가지 않는다.

- [ ] **Step 7: 파일 구성을 확인한다**

```bash
ls lib/domain/
grep -c 'export' lib/domain/index.ts
```

기대 결과: `__checks__.ts` `dungeon.ts` `ids.ts` `index.ts` `info.ts` `party.ts` `run.ts` 일곱 개 파일. `export`를 포함한 줄이 9개다(`ids` 1개, `party` 2개, `info` 2개, `dungeon` 2개, `run` 2개).

- [ ] **Step 8: 로직이 섞여 들어가지 않았는지 확인한다**

```bash
grep -rn 'function\|=>\|class ' lib/domain/ --include='*.ts' | grep -v '__checks__'
```

기대 결과: 출력 없음. F1은 타입과 상수만 만든다. 결과가 나오면 로직이 섞인 것이므로 제거하고 해당 작업으로 넘긴다.

- [ ] **Step 9: 커밋**

```bash
git add lib/domain/index.ts lib/domain/__checks__.ts
git commit -m "기능: 도메인 타입 배럴 추가

다른 작업이 개별 파일 대신 @/lib/domain 하나에서 타입을 가져올
수 있게 한다. 배럴이 모든 공개 타입과 상수를 내보내는지 검사로
확인한다."
```

---

## Task 6: Pull Request 생성

**Files:** 없음 (git 작업만)

**Interfaces:**
- Consumes: Task 1~5의 커밋과 이미 있는 spec·설정집 커밋
- Produces: `main`을 대상으로 하는 Pull Request

- [ ] **Step 1: 브랜치 상태를 확인한다**

```bash
git branch --show-current
git log --oneline main..HEAD
git status --short
```

기대 결과: 브랜치가 `feature/domain-types`이고, 커밋이 7개(설정집 갱신, spec, plan, Task 1~5)이며 작업 트리가 깨끗하다.

- [ ] **Step 2: 검증 명령 셋을 한 번에 다시 돌린다**

```bash
pnpm lint && pnpm typecheck && pnpm build
```

Expected: 셋 다 통과. 하나라도 실패하면 원인을 고친 뒤 커밋하고 이 단계를 다시 실행한다.

- [ ] **Step 3: 변경 파일을 확인한다**

```bash
git diff --stat main..HEAD
```

기대 결과: `lib/domain/` 아래 7개 파일과 `docs/` 아래 문서만 나온다. `package.json`, `pnpm-lock.yaml`, `app/`이 나오면 의존성이나 화면을 건드린 것이므로 되돌린다.

- [ ] **Step 4: push한다**

```bash
git push -u origin feature/domain-types
```

- [ ] **Step 5: Pull Request를 만든다**

```bash
gh pr create --base main --title "기능: F1 도메인 타입 정의" --body "$(cat <<'PRBODY'
## 배경

프로토타입 배정표의 `F1`이다. `F2` `F3` `R1` `R2` `R3` `R4` 여섯 작업의 선행이며, 세 사람이 3트랙으로 갈라지기 전에 먼저 끝내야 하는 병목이다.

## 변경

`lib/domain/` 아래 다섯 파일에 게임 데이터 타입과 상수를 정의한다. 로직은 없다.

- `ids.ts` — 브랜드 ID 일곱 개. `MemberId` 자리에 `NodeId`를 넣는 실수가 컴파일 타임에 잡힌다.
- `party.ts` — `PartyMember`, `Personality`(닫힘 5종), `ClassDef`(열림), 신뢰·파티 상수
- `info.ts` — `InfoCard`, `TruthType`(닫힘 3종), `Target`, `InfoClaim`
- `dungeon.ts` — `DungeonEvent`, `EventKind`(닫힘 4종), `DungeonNode`, `DungeonState`
- `run.ts` — `RunState`, `RunPhase`(닫힘 6종), `Resources`, `TrustChange`, `DecisionRecord`
- `index.ts` — 배럴. 다른 작업은 `@/lib/domain`에서만 가져온다.

설정집이 미확정으로 남겨 둔 값 중 타입을 쓰려면 필요한 것들을 먼저 확정했다. 신뢰 척도 0~100, 성격 5종, 이벤트 분류 4종, 진행 단계 6종, 자원 3종, 경로가 되돌아가지 않는 분기 그래프라는 점이다. 초기값과 증감량은 확정하지 않았다.

## 확인 방법

런타임 코드가 없어 Vitest를 쓸 수 없다(`F4`는 이 작업과 병렬이며 선행이 아니다). 대신 `lib/domain/__checks__.ts`에 컴파일 성공 자체가 검사인 파일을 두었다.

- 완전한 `RunState` 리터럴이 컴파일된다. 필수 필드가 빠지면 실패한다.
- 잘못된 ID 대입, 목록에 없는 성격·이벤트 분류·진행 단계가 `@ts-expect-error`로 막힌다.
- 상수 개수(성격 5, 이벤트 4, 진실 유형 3, 단계 6)가 타입 수준에서 확인된다.
- 배럴이 모든 공개 타입과 상수를 내보내는지 확인된다.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` 통과.

## 리뷰 요청 사항

- 닫힌 유니온과 열린 ID의 경계가 적절한지. 지금은 규칙이 분기하는 것만 닫았다.
- `PlayerAction`과 `Effect` 같은 동사 어휘를 F1에서 제외했다. `R3`와 `R5`가 각자 결과 타입을 만들게 되고 나중에 맞추는 작업이 생길 수 있다. 이 비용을 받아들일지.
- `trust`를 브랜드 타입으로 만들지 않고 `number`로 두었다. 범위 보장은 `R2`의 책임이다.

## 관련 문서

- spec: `docs/superpowers/specs/2026-08-12-lattebun-domain-types-design.md`
- plan: `docs/superpowers/plans/2026-08-12-lattebun-domain-types.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
PRBODY
)"
```

- [ ] **Step 6: PR URL을 사용자에게 전달한다**

```bash
gh pr view --json url,number,title
```

출력된 URL을 사용자에게 알린다. 작업자가 아닌 팀원 한 명의 확인이 필요하다는 점도 함께 전달한다.

---

## 완료 조건

- `lib/domain/` 아래 `ids.ts` `party.ts` `info.ts` `dungeon.ts` `run.ts` `index.ts` `__checks__.ts` 일곱 파일이 있다.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`가 모두 통과한다.
- `lib/domain/`에 함수, 화살표 함수, 클래스가 없다(`__checks__.ts` 제외).
- `package.json`과 `pnpm-lock.yaml`이 변경되지 않았다.
- `main`을 대상으로 하는 Pull Request가 열려 있고 URL을 사용자가 받았다.

## 이 계획에서 하지 않는 것

- Vitest 설치와 `pnpm test` (`F4`)
- Zustand 설치와 스토어 (`F2`)
- 난수 생성기 (`F3`)
- 콘텐츠 데이터 파일 (`Q1`)
- `PlayerAction`, `Effect` 등 동사 타입
- `app/page.tsx` 변경

### 배정표 상태 갱신은 여기서 하지 않는다

배정표의 `상태` 열은 아직 `main`에 없다. 20행 배정표는 Pull Request #1(`feature/prototype-work-assignment-dependencies`)에 있고 병합되지 않았다. `F1`의 상태를 `✅`로 바꾸는 일은 그 PR이 병합된 뒤 별도로 처리한다.
