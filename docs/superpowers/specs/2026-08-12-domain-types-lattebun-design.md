# F1 도메인 타입 정의 설계

**작성자:** LatteBun  
**작성 도구:** Claude Code

## 목적

Dungeon Schemer 프로토타입의 게임 데이터를 TypeScript 타입으로 표현한다. 파티원, 성격, 직업, 신뢰, 정보 카드, 이벤트, 경로 노드, 한 판의 상태를 코드에서 확인할 수 있는 계약으로 만든다.

이 작업은 [프로토타입 작업 배정표](../../technical/PROTOTYPE_WORK_ASSIGNMENT.md)의 `F1`이다. `F2` `F3` `R1` `R2` `R3` `R4` 여섯 작업의 선행이며, 세 사람이 3트랙으로 갈라지기 전에 먼저 끝내야 하는 병목이다.

완료 기준은 배정표에 정해져 있다.

> 파티원·성격·직업·신뢰·정보 카드·이벤트·경로 노드·런 상태 타입이 존재하고 `pnpm typecheck` 통과. 로직 없이 타입과 상수만

## 선행 문서 갱신

이 설계를 확정하려면 공식 문서가 미확정으로 남겨 둔 값 중 일부를 정해야 했다. 커밋 `bd3c142`에서 다음을 먼저 확정했다.

| 확정한 것 | 문서 |
| --- | --- |
| 신뢰도는 0 이상 100 이하 정수 | `systems/PARTY_AND_TRUST.md` |
| 성격 다섯의 닫힌 목록과 식별자 | `systems/PARTY_AND_TRUST.md` |
| 직업 목록은 콘텐츠 데이터로 열림 | `systems/PARTY_AND_TRUST.md` |
| 이벤트 분류 넷의 닫힌 목록과 식별자 | `systems/DUNGEON_EVENTS_AND_BOSSES.md` |
| 경로는 되돌아가지 않는 분기 그래프 | `systems/DUNGEON_EVENTS_AND_BOSSES.md` |
| 미검증 정보를 런 상태가 보관 | `systems/INFORMATION_AND_DECEPTION.md` |
| 한 판의 진행 단계 여섯과 식별자 | `design/CORE_GAME_LOOP.md` |
| 자원 셋과 식별자 | `design/CORE_GAME_LOOP.md` |

초기값, 증감량, 성공 확률 공식은 여전히 확정하지 않는다. 타입은 이 수치들을 강제하지 않는다.

## 설계 결정

### 1. 콘텐츠 종류는 하이브리드로 표현한다

규칙이 분기하는 종류는 리터럴 유니온으로 닫고, 순수 데이터는 브랜드 ID로 연다.

| 닫힌 유니온 | 이유 |
| --- | --- |
| `Personality` | `R2` 신뢰 판정이 성격마다 다르게 분기한다 |
| `EventKind` | 분류마다 제시하는 행동과 처리가 다르다 |
| `TruthType` | 진실·거짓·중립은 게임의 핵심 구조다 |
| `RunPhase` | 상태 머신이 전이를 검사한다 |

| 열린 ID | 이유 |
| --- | --- |
| `ClassId` | 직업 추가에 규칙 변경이 필요 없다 |
| `CardId` `EventId` | 개별 콘텐츠는 데이터 파일에서 온다 |
| `MemberId` `NodeId` `ClaimId` `ItemId` | 런타임에 생성되는 식별자다 |

이 구분이 `Q1 콘텐츠 데이터 채우기`의 "코드 수정 없이 추가 가능"과 `R2`의 "성격별로 다른 증감"을 동시에 만족시킨다.

### 2. 상태는 중첩 객체 + 추가 전용 로그로 둔다

`RunState`는 현재 상태를 중첩 객체로 들고, 그 옆에 추가 전용 결정 로그를 둔다.

정규화(`id → 객체` 맵)를 쓰지 않는 이유는 파티가 3~5명이고 노드가 수십 개 규모라 색인 관리 비용이 이득보다 크기 때문이다. 이벤트 소싱을 쓰지 않는 이유는 모든 규칙을 순수 함수로 강제하게 되어 프로토타입 단계에 과투자이기 때문이다.

로그가 상태의 일부인 이유는 두 완료 기준이 로그를 요구하기 때문이다.

- `R5`: "영향을 준 선택 목록"을 정산이 반환해야 한다.
- `U1`: "최근 신뢰 변화 사유"를 화면이 보여줘야 한다.

로그를 나중에 붙이면 두 작업이 각자 임시 기록을 만들게 된다.

### 3. F1은 명사만 정의한다

`PlayerAction`과 `Effect` 같은 동사 어휘는 F1에 넣지 않는다. `R2`는 `TrustChange`를 F1에서 받아 쓰지만, `R3`의 카드 판정 결과와 `R5`의 정산 항목은 각 작업이 정의한다.

**이 선택에는 비용이 있다.** 세 작업이 비슷하지만 미묘히 다른 결과 타입을 만들 가능성이 높고, 나중에 이를 맞추는 작은 작업이 생길 수 있다. F1을 1~2일 안에 끝내 나머지 두 사람의 대기를 빨리 푸는 쪽을 택한 결과다.

`DecisionRecord`는 이 제약 안에서 설계한다. 액션과 효과 유니온을 참조하지 않고 명사 필드로만 구성한다. `log: unknown[]`처럼 타입을 비우지 않는다. 비우면 `pnpm typecheck` 통과라는 완료 기준이 무의미해진다.

### 4. 브랜드 타입으로 ID를 구분한다

모든 ID는 `string`의 브랜드 타입이다. `MemberId`를 받는 자리에 `NodeId`를 넣는 실수가 컴파일 타임에 잡힌다. 런타임 비용은 없다. 브랜드는 타입 수준에만 존재한다.

## 파일 구조

`lib/domain/` 아래 여섯 파일. 로직 없이 타입과 상수만 둔다.

| 파일 | 책임 |
| --- | --- |
| `ids.ts` | `Brand` 유틸과 모든 ID 타입 |
| `party.ts` | `PartyMember`, `Personality`, `ClassDef` |
| `info.ts` | `InfoCard`, `TruthType`, `Target`, `InfoClaim` |
| `dungeon.ts` | `DungeonEvent`, `EventKind`, `DungeonNode`, `DungeonState` |
| `run.ts` | `RunState`, `RunPhase`, `Resources`, `TrustChange`, `DecisionRecord` |
| `index.ts` | 배럴 재export |

파일을 나누는 이유는 2차 3트랙에서 트랙마다 주로 건드리는 파일이 다르기 때문이다. 규칙 트랙은 `party.ts`와 `info.ts`, 흐름 트랙은 `dungeon.ts`와 `run.ts`를 확장한다. 한 파일에 몰아 두면 세 사람이 같은 파일에서 충돌한다.

## 타입 정의

### `ids.ts`

```ts
declare const brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type MemberId = Brand<string, "MemberId">;
export type ClassId = Brand<string, "ClassId">;
export type CardId = Brand<string, "CardId">;
export type EventId = Brand<string, "EventId">;
export type NodeId = Brand<string, "NodeId">;
export type ClaimId = Brand<string, "ClaimId">;
export type ItemId = Brand<string, "ItemId">;
```

### `party.ts`

```ts
import type { ClassId, MemberId } from "./ids";

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

export const TRUST_MIN = 0;
export const TRUST_MAX = 100;

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
  trust: number;
  alive: boolean;
}
```

`trust`를 브랜드 타입으로 만들지 않는다. 0~100 범위는 타입이 아니라 `R2`의 판정이 지켜야 할 규칙이며, 산술 연산마다 브랜드를 벗기고 씌우는 비용이 이득보다 크다.

### `info.ts`

```ts
import type { CardId, ClaimId, MemberId } from "./ids";

export type TruthType = "truth" | "lie" | "neutral";

export const TRUTH_TYPES = [
  "truth",
  "lie",
  "neutral",
] as const satisfies readonly TruthType[];

export type Target =
  | { kind: "member"; id: MemberId }
  | { kind: "boss" };

export interface InfoCard {
  id: CardId;
  truthType: TruthType;
  topic: string;
  text: string;
}

export interface InfoClaim {
  id: ClaimId;
  cardId: CardId;
  target: Target;
  toldAt: number;
}
```

`InfoClaim`은 `systems/INFORMATION_AND_DECEPTION.md`의 미검증 정보 보관 규칙을 타입으로 옮긴 것이다. `toldAt`은 `DecisionRecord.at`과 같은 로그 순번을 가리킨다.

`topic`은 `"보스 약점"`, `"파티 구성"`처럼 카드가 다루는 주제다. 같은 주제의 진실 카드와 거짓 카드를 짝지어 제시할 때 쓴다.

### `dungeon.ts`

```ts
import type { EventId, NodeId } from "./ids";

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

export interface DungeonNode {
  id: NodeId;
  depth: number;
  eventId: EventId;
  nextNodeIds: NodeId[];
}

export interface DungeonState {
  nodes: DungeonNode[];
  entryNodeId: NodeId;
  bossNodeId: NodeId;
}
```

`nextNodeIds`가 빈 배열인 노드는 보스전 직전이다. `depth`는 입구에서의 거리이며 화면의 경로 지도가 세로 위치를 잡는 데 쓴다.

### `run.ts`

```ts
import type { MemberId, NodeId } from "./ids";
import type { InfoClaim } from "./info";
import type { DungeonState } from "./dungeon";
import type { PartyMember } from "./party";

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

export interface Resources {
  gold: number;
  food: number;
  reputation: number;
}

export interface TrustChange {
  memberId: MemberId;
  delta: number;
  reason: string;
}

export interface DecisionRecord {
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
  pendingClaims: InfoClaim[];
  log: DecisionRecord[];
}
```

`at`은 0부터 시작하는 로그 순번이며 시각이 아니다. 시각을 쓰면 같은 시드로 같은 판을 재현했을 때 값이 달라져 `F3`의 재현성 검사를 방해한다.

`reason`은 `"정의로운 성격: 거짓 정보가 발각됨"`처럼 사람이 읽는 문장이다. `experience/ONBOARDING_AND_INTERFACE.md`가 요구하는 원인 피드백을 이 필드가 담는다.

### `index.ts`

다섯 파일의 공개 타입과 상수를 재export한다. 다른 작업은 `@/lib/domain`에서만 가져온다.

## 검증

런타임 코드가 없으므로 Vitest 테스트를 쓸 수 없다. `F4 테스트 도구 도입`은 이 작업과 병렬로 진행되며 선행이 아니다.

대신 `lib/domain/__checks__.ts`에 타입 검사 파일을 둔다. 이 파일은 값을 export하지 않으며 컴파일에 성공하는 것 자체가 검사 통과다.

검사 내용:

- 완전한 `RunState` 리터럴을 하나 만든다. 필수 필드 누락이 있으면 컴파일이 실패한다.
- `MemberId` 자리에 `NodeId`를 넣는 코드를 `@ts-expect-error`로 감싼다. 브랜드가 동작하지 않으면 `@ts-expect-error`가 쓸모없다는 오류로 컴파일이 실패한다.
- `Personality`에 목록에 없는 문자열을 넣는 코드를 `@ts-expect-error`로 감싼다.
- `PERSONALITIES`의 길이가 5, `EVENT_KINDS`가 4, `TRUTH_TYPES`가 3, `RUN_PHASES`가 6인지 타입 수준에서 확인한다.

`pnpm typecheck`가 통과하면 완료 기준을 만족한다. `pnpm lint`와 `pnpm build`도 함께 통과해야 한다.

`@ts-expect-error`에는 반드시 설명을 붙인다. `eslint-config-next`의 `ban-ts-comment` 규칙이 설명 없는 억제 주석을 막는다.

## 제외 범위

- `PlayerAction`, `Effect` 등 동사 어휘
- 모든 로직, 함수, 클래스
- Zustand 스토어 (`F2`)
- 난수 생성기 (`F3`)
- 콘텐츠 데이터 파일 (`Q1`)
- 초기값, 증감량, 성공 확률 상수
- 성장, 엔딩, 저장, Supabase 관련 타입 (프로토타입 범위 밖)
- 기존 `app/page.tsx` 변경

## 후속 작업에 남기는 계약

이 작업이 끝나면 다음 작업이 아래 이름을 그대로 사용한다.

| 작업 | 사용할 타입 |
| --- | --- |
| `F2` 상태 스토어 | `RunState` 전체 |
| `F3` 랜덤 시드 | `RunState["seed"]` |
| `R1` 파티 생성 | `PartyMember`, `Personality`, `ClassDef`, `PARTY_SIZE_MIN/MAX` |
| `R2` 신뢰 판정 | `PartyMember`, `Personality`, `TrustChange`, `TRUST_MIN/MAX` |
| `R3` 정보 카드 판정 | `InfoCard`, `TruthType`, `Target`, `InfoClaim` |
| `R4` 이벤트·경로 생성 | `DungeonEvent`, `EventKind`, `DungeonNode`, `DungeonState` |
