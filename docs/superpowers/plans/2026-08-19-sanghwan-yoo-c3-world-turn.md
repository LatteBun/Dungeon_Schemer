# C3 World Turn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** C3 월드턴 규칙을 순수·재현 가능한 함수로 구현해 비출전 캐릭터의 휴식, 백그라운드 원정, 중상 상태와 입력 검증을 제공한다.

**Architecture:** `runWorldTurn`을 유일한 공개 오케스트레이터로 두고, 입력 검증·활동 배정·휴식·백그라운드 상태 계산을 `lib/domain/worldturn.ts` 내부 순수 함수로 분리한다. 함수는 원본 `CharacterPool`을 변경하지 않고 `{ pool, result }`를 반환하며, 호출부가 이미 파생한 `worldturn` RNG만 소비한다.

**Tech Stack:** TypeScript 5, Vitest 4, existing `RuleError`, existing `CharacterPool`/`ExpeditionParty` domain types, `@/lib/rng`.

**Spec:** `docs/superpowers/specs/2026-08-19-sanghwan-yoo-c3-world-turn-design.md`

## Global Constraints

- HP, HP 변화량, 회복량, 손실량은 항상 정수로 유지한다.
- HP 50% 미만은 강제 휴식이며, HP 20% 미만인 중상과 동일한 상태가 아니다.
- 정확히 50%는 강제 휴식이 아니고, 정확히 20%는 중상이 아니다.
- 중상 캐릭터는 휴식만 하며, 회복 후 HP가 20% 이상이면 중상을 해제한다.
- 백그라운드 HP는 `max(1, round(maxHp × lossPercent / 100))`만큼 줄고 `lossPercent`는 시드로 10~20에서 고른다.
- 백그라운드 골드는 시드로 5~15 정수를 얻으며 HP는 1 아래로 내려가지 않는다.
- 생존한 비출전 캐릭터만 처리하고, 사망자와 원정 파티원은 결과에서 제외한다.
- 절반 배정은 후보를 시드로 섞은 뒤 휴식 `ceil(n / 2)`, 백그라운드 `floor(n / 2)`로 한다.
- 결과 순서는 RNG 셔플 순서가 아니라 `pool.order` 순서로 정렬한다.
- `runWorldTurn`은 입력 풀을 변경하지 않고 `worldturnRng` 외의 난수를 소비하지 않는다.
- 잘못된 풀·캐릭터 상태는 `INVALID_STATE`, 알 수 없는 파티 ID는 `UNKNOWN_ID`, 중복 파티 ID는 `DUPLICATE_ID`로 거부한다.
- C3는 엔딩을 판정하지 않는다. 모든 캐릭터가 중상이어서 3인 편성이 불가능한지는 C7이 `인력 소진`으로 판정한다.
- 주석은 기존 코드 규칙에 맞춰 한국어로 작성하고, 구현 이유를 설명한다.
- 커밋 메시지는 제목과 본문을 포함한 한글로 작성한다.

---

### Task 1: RNG 및 상태 오류 계약 정합성

**Files:**
- Modify: `lib/domain/errors.ts`
- Modify: `lib/domain/errors.test.ts`
- Modify: `lib/rng/index.ts`
- Modify: `lib/rng/index.test.ts`
- Modify: `lib/rng/streams.test.ts`

**Interfaces:**
- Consumes: existing `RuleError`, `RngStream`, `RNG_STREAMS` contracts
- Produces: `RuleErrorCode`에 `INVALID_STATE`, 공식 10개 RNG 스트림 목록과 `RngStream`의 `worldturn`

- [ ] **Step 1: 오류 코드와 RNG 목록의 실패 테스트를 먼저 작성한다**

`lib/domain/errors.test.ts`에 다음 계약을 추가한다.

```ts
it("잘못된 도메인 상태 오류를 표현한다", () => {
  const error = new RuleError("INVALID_STATE", "월드턴 상태가 유효하지 않다", {
    field: "worldTurn",
  });

  expect(error.code).toBe("INVALID_STATE");
  expect(error.details).toEqual({ field: "worldTurn" });
});
```

`lib/rng/streams.test.ts`의 스트림 기대값을 다음 배열로 바꾼다.

```ts
expect(RNG_STREAMS).toEqual([
  "pool",
  "board",
  "party",
  "map",
  "ecology",
  "card",
  "event",
  "boss",
  "trust",
  "worldturn",
]);
```

- [ ] **Step 2: 변경 전 테스트를 실행해 실패를 확인한다**

Run: `corepack pnpm test -- lib/domain/errors.test.ts lib/rng/streams.test.ts`

Expected: `errors.test.ts`는 `INVALID_STATE` 타입 부재로 컴파일에 실패하고, `streams.test.ts`는 이전 스트림 배열과 기대값이 달라 실패한다.

- [ ] **Step 3: 오류 코드와 스트림 목록을 최소 변경한다**

`RuleErrorCode` 유니온에 `"INVALID_STATE"`를 추가한다. `lib/rng/index.ts`의 `RNG_STREAMS`를 다음 순서로 교체한다.

```ts
export const RNG_STREAMS = [
  "pool",
  "board",
  "party",
  "map",
  "ecology",
  "card",
  "event",
  "boss",
  "trust",
  "worldturn",
] as const;
```

`RngStream`은 이 배열에서 추론되므로 별도 유니온을 중복 선언하지 않는다. 기존 테스트가 사용하는 `party`, `dungeon`, `trust` 중 `dungeon`은 현재 공식 스트림 계약에 없으므로 `lib/rng/index.test.ts`의 파생 독립성 테스트 입력을 `map`으로 바꾼다. `trust` 테스트는 그대로 유지한다.

- [ ] **Step 4: 계약 테스트가 통과하는지 확인한다**

Run: `corepack pnpm test -- lib/domain/errors.test.ts lib/rng/index.test.ts lib/rng/streams.test.ts`

Expected: PASS.

- [ ] **Step 5: 커밋한다**

```bash
git add lib/domain/errors.ts lib/domain/errors.test.ts lib/rng/index.ts lib/rng/index.test.ts lib/rng/streams.test.ts
git commit -m "기반: 월드턴 오류와 난수 스트림 계약을 맞춘다" -m "INVALID_STATE를 추가하고 공식 worldturn 스트림을 포함한 10개 RNG 목록으로 정합성을 맞춘다."
```

### Task 2: C3 공개 결과 타입과 입력 검증

**Files:**
- Create: `lib/domain/worldturn.test.ts`
- Modify: `lib/domain/worldturn.ts`
- Modify: `lib/domain/index.ts`

**Interfaces:**
- Consumes: `Character`, `CharacterPool`, `ExpeditionParty`, `WorldTurnResult`, `RuleError`, `Rng`
- Produces: `WorldTurnExecution`과 `runWorldTurn(pool, expeditionParty, worldTurn, worldturnRng)`

- [ ] **Step 1: 테스트 픽스처와 입력 검증 실패 테스트를 작성한다**

`lib/domain/worldturn.test.ts`에 다음 형태의 픽스처를 만든다. 모든 ID는 기존 brand 타입처럼 문자열을 단언하고, 풀은 `pool.order`와 `pool.byId`를 함께 생성한다.

```ts
const emptyParty: ExpeditionParty = { memberIds: [] };

function party(memberIds: readonly CharacterId[] = []): ExpeditionParty {
  return { memberIds };
}

const rng = createRng("worldturn-test").derive("worldturn");

function character(overrides: Partial<Character> = {}): Character {
  return {
    id: "character-001" as CharacterId,
    name: "테스트",
    classId: "warrior" as ClassId,
    personality: "prudent",
    maxHp: 100,
    hp: 100,
    trust: 50,
    gold: 30,
    alive: true,
    gravelyWounded: false,
    ...overrides,
  };
}

function makePool(members: Character[]): CharacterPool {
  return {
    byId: Object.fromEntries(
      members.map((member) => [member.id, member]),
    ) as Record<CharacterId, Character>,
    order: members.map((member) => member.id),
  };
}

const memberId = "character-001" as CharacterId;
const pool = makePool([character({ id: memberId })]);
```

다음 검증을 각각 테스트한다.

```ts
it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])(
  "월드턴 번호가 정수가 아니면 INVALID_STATE: %s",
  (worldTurn) => {
    expect(() => runWorldTurn(pool, emptyParty, worldTurn, rng)).toThrowError(
      expect.objectContaining({ code: "INVALID_STATE" }),
    );
  },
);

it("pool.order와 byId의 ID 집합이 다르면 INVALID_STATE다", () => {
  const invalidPool = { ...pool, order: ["missing" as CharacterId] };
  expect(() => runWorldTurn(invalidPool, emptyParty, 0, rng)).toThrowError(
    expect.objectContaining({ code: "INVALID_STATE" }),
  );
});

it.each([
  { field: "maxHp", value: 0 },
  { field: "hp", value: 100.5 },
  { field: "gold", value: -1 },
  { field: "trust", value: 101 },
])("캐릭터 $field 상태가 잘못되면 INVALID_STATE다", ({ field, value }) => {
  const invalid = character({ [field]: value } as Partial<Character>);
  expect(() => runWorldTurn(makePool([invalid]), emptyParty, 0, rng)).toThrowError(
    expect.objectContaining({ code: "INVALID_STATE" }),
  );
});

it("알 수 없는 파티 ID는 UNKNOWN_ID다", () => {
  expect(() => runWorldTurn(pool, party(["missing" as CharacterId]), 0, rng))
    .toThrowError(expect.objectContaining({ code: "UNKNOWN_ID" }));
});

it("중복 파티 ID는 DUPLICATE_ID다", () => {
  expect(() => runWorldTurn(pool, party([memberId, memberId]), 0, rng))
    .toThrowError(expect.objectContaining({ code: "DUPLICATE_ID" }));
});
```

- [ ] **Step 2: 검증 테스트가 실패하는지 확인한다**

Run: `corepack pnpm test -- lib/domain/worldturn.test.ts`

Expected: `runWorldTurn`과 `WorldTurnExecution`이 아직 구현/export되지 않아 컴파일에 실패한다.

- [ ] **Step 3: 공개 타입과 검증 오케스트레이터를 구현한다**

`lib/domain/worldturn.ts`에 필요한 import와 다음 타입을 추가한다.

```ts
export interface WorldTurnExecution {
  pool: CharacterPool;
  result: WorldTurnResult;
}
```

`runWorldTurn`은 먼저 `validateWorldTurnInput`을 호출하고, 검증 후에는 아직 비어 있는 배정 목록을 처리해 `worldTurn + 1`과 빈 outcomes를 반환하는 형태로 둔다. 다음 Task에서 배정과 상태 계산을 채운다. 검증 함수는 다음을 확인한다.

- `worldTurn`이 0 이상의 정수인지
- `pool.order` 중복·누락·`byId`와의 집합 불일치
- `byId` 키와 `character.id` 일치
- `maxHp` 양의 정수
- `hp` 정수이며 `1..maxHp`
- `gold` 0 이상의 정수
- `trust` 정수이며 `0..100`
- 파티 ID가 `byId`에 존재하는지
- 파티 ID가 중복되지 않는지

상태 오류에는 `new RuleError("INVALID_STATE", "월드턴 입력 상태가 유효하지 않다", { field, characterId })` 형태로 구체적인 details를 넣는다. 파티 인원 수·파티원 생존·파티원 중상은 검증하지 않는다.

`lib/domain/index.ts`에서 `WorldTurnExecution`과 `runWorldTurn`을 export한다.

- [ ] **Step 4: 입력 검증 테스트를 통과시키고 타입을 확인한다**

Run: `corepack pnpm test -- lib/domain/worldturn.test.ts`

Expected: 입력 검증 테스트 PASS. 정상 입력은 빈 outcomes를 반환한다.

Run: `corepack pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: 커밋한다**

```bash
git add lib/domain/worldturn.ts lib/domain/worldturn.test.ts lib/domain/index.ts
git commit -m "C3: 월드턴 입력 계약을 구현한다" -m "월드턴 실행 결과 타입과 풀·캐릭터·파티 입력 검증을 추가한다."
```

### Task 3: 월드턴 활동 배정

**Files:**
- Modify: `lib/domain/worldturn.test.ts`
- Modify: `lib/domain/worldturn.ts`

**Interfaces:**
- Consumes: Task 2의 `runWorldTurn`, `WorldTurnExecution`, `WorldTurnAssignment`
- Produces: 입력 상태에 따른 결정적 `WorldTurnAssignment[]`와 활동별 결과 순서

- [ ] **Step 1: 활동 배정 실패 테스트를 추가한다**

다음 테스트를 추가한다.

```ts
it("원정 파티원과 사망자는 월드턴에서 처리하지 않는다", () => {
  const result = runWorldTurn(
    makePool([
      character({ id: memberId }),
      character({ id: "dead" as CharacterId, alive: false }),
      character({ id: "resting" as CharacterId, hp: 40 }),
    ]),
    party([memberId]),
    3,
    rng,
  );

  expect(result.result.outcomes.map((outcome) => outcome.characterId)).toEqual([
    "resting",
  ]);
});

it("HP 50% 미만은 forcedRest이고 중상과 다르다", () => {
  const lowHp = character({ id: "low" as CharacterId, hp: 40 });
  const result = runWorldTurn(makePool([lowHp]), emptyParty, 0, rng);

  expect(result.result.outcomes[0].activity).toBe("forcedRest");
  expect(result.pool.byId[lowHp.id].gravelyWounded).toBe(false);
});

it("이미 중상인 캐릭터는 HP가 높아도 rest만 받는다", () => {
  const wounded = character({
    id: "wounded" as CharacterId,
    hp: 80,
    gravelyWounded: true,
  });
  const result = runWorldTurn(makePool([wounded]), emptyParty, 0, rng);

  expect(result.result.outcomes[0].activity).toBe("rest");
});

it("일반 후보는 시드로 섞은 뒤 휴식 ceil/2, 백그라운드 floor/2로 나뉜다", () => {
  const members = Array.from({ length: 5 }, (_, index) =>
    character({ id: `candidate-${index}` as CharacterId }),
  );
  const result = runWorldTurn(makePool(members), emptyParty, 0, rng);
  const activities = result.result.outcomes.map((outcome) => outcome.activity);

  expect(activities.filter((activity) => activity === "rest")).toHaveLength(3);
  expect(activities.filter((activity) => activity === "background")).toHaveLength(2);
});
```

- [ ] **Step 2: 배정 테스트가 실패하는지 확인한다**

Run: `corepack pnpm test -- lib/domain/worldturn.test.ts`

Expected: low HP와 wounded 캐릭터의 outcomes가 비어 있고 일반 후보의 활동이 없어 실패한다.

- [ ] **Step 3: 배정 함수를 구현한다**

`selectWorldTurnAssignments`는 `pool.order`로 캐릭터를 읽고 다음 우선순위를 적용한다.

```ts
if (character.gravelyWounded) return { characterId, activity: "rest" };
if (character.hp / character.maxHp < FORCED_REST_HP_RATIO) {
  return { characterId, activity: "forcedRest" };
}
return candidate;
```

후보 배열만 `worldturnRng.shuffle`하고, `restCount = Math.ceil(candidates.length / 2)`로 앞쪽을 `rest`, 나머지를 `background`로 만든다. `WorldTurnAssignment` 배열을 `pool.order` 위치 기준으로 정렬할 수 있도록 내부 map을 사용하되 RNG 셔플 자체는 보존한다. 사망자와 파티원은 처음부터 후보에 넣지 않는다.

`runWorldTurn`은 배정 목록을 다음 Task의 상태 적용 함수로 넘길 수 있도록 연결한다. 아직 상태 적용은 최소한 현재 캐릭터를 그대로 복사하고 활동·0 변화 결과를 만드는 형태로 두며, Task 4에서 실제 계산으로 교체한다.

- [ ] **Step 4: 배정 테스트를 통과시키고 회귀를 확인한다**

Run: `corepack pnpm test -- lib/domain/worldturn.test.ts lib/domain/contract.test.ts`

Expected: PASS.

- [ ] **Step 5: 커밋한다**

```bash
git add lib/domain/worldturn.ts lib/domain/worldturn.test.ts
git commit -m "C3: 월드턴 활동을 시드로 배정한다" -m "비출전 생존자를 선별하고 강제 휴식·중상 휴식·절반 배정 규칙을 연결한다."
```

### Task 4: 휴식·백그라운드·중상 상태 적용

**Files:**
- Modify: `lib/domain/worldturn.test.ts`
- Modify: `lib/domain/worldturn.ts`

**Interfaces:**
- Consumes: Task 3의 `WorldTurnAssignment[]`, `Character`, worldturn constants, `worldturnRng`
- Produces: 갱신된 `CharacterPool`과 실제 HP·골드·중상 변화를 담은 `WorldTurnResult`

- [ ] **Step 1: 상태 변화 테스트를 추가한다**

다음 테스트를 추가한다. `fixedRng` 픽스처는 `shuffle`은 입력 순서를 보존하고 `int(min, max)`는 `min`을 반환하도록 만들어 백그라운드 손실 10%, 골드 5의 경계를 고정한다.

```ts
it("휴식은 최대 HP의 15%를 최소 2만큼 회복하고 maxHp를 넘지 않는다", () => {
  const member = character({ id: "rest" as CharacterId, hp: 40, maxHp: 100 });
  const result = runWorldTurn(makePool([member]), emptyParty, 0, fixedRng);

  expect(result.pool.byId[member.id].hp).toBe(55);
  expect(result.result.outcomes[0].hpDelta).toBe(15);
  expect(result.result.outcomes[0].goldDelta).toBe(0);
});

it("휴식 회복량은 최소 2이고 HP는 maxHp에서 멈춘다", () => {
  const member = character({ id: "small" as CharacterId, maxHp: 10, hp: 9 });
  const result = runWorldTurn(makePool([member]), emptyParty, 0, fixedRng);

  expect(result.pool.byId[member.id].hp).toBe(10);
  expect(result.result.outcomes[0].hpDelta).toBe(1);
});

it("백그라운드는 정수 HP 손실·골드 획득을 적용하고 HP 하한 1을 지킨다", () => {
  const members = [
    character({ id: "rest" as CharacterId }),
    character({ id: "background" as CharacterId, hp: 50 }),
  ];
  const result = runWorldTurn(makePool(members), emptyParty, 0, fixedRng);
  const outcome = result.result.outcomes.find(
    (entry) => entry.characterId === ("background" as CharacterId),
  );

  expect(result.pool.byId["background" as CharacterId].hp).toBe(40);
  expect(result.pool.byId["background" as CharacterId].gold).toBe(35);
  expect(outcome?.hpDelta).toBe(-10);
  expect(outcome?.goldDelta).toBe(5);
});

it("처리 후 HP가 20% 미만이면 중상이 되고, 정확히 20%면 중상이 아니다", () => {
  const below = character({ id: "below" as CharacterId, hp: 1 });
  const exact = character({ id: "exact" as CharacterId, hp: 5 });
  const result = runWorldTurn(makePool([below, exact]), emptyParty, 0, fixedRng);

  expect(result.pool.byId[below.id].gravelyWounded).toBe(true);
  expect(result.pool.byId[exact.id].hp).toBe(20);
  expect(result.pool.byId[exact.id].gravelyWounded).toBe(false);
  expect(result.result.outcomes.find((entry) => entry.characterId === below.id)
    ?.becameGravelyWounded).toBe(true);
});

it("중상 캐릭터가 휴식으로 20% 이상이 되면 중상을 해제한다", () => {
  const member = character({
    id: "wounded" as CharacterId,
    hp: 10,
    gravelyWounded: true,
  });
  const result = runWorldTurn(makePool([member]), emptyParty, 0, fixedRng);

  expect(result.pool.byId[member.id].hp).toBe(25);
  expect(result.pool.byId[member.id].gravelyWounded).toBe(false);
  expect(result.result.outcomes[0].becameGravelyWounded).toBe(false);
});
```

`fixedRng`는 다음 계약을 갖는 테스트용 `Rng` 객체로 정의한다. `shuffle`은 복사본을 반환해 입력을 변경하지 않고, `int(min, max)`는 항상 `min`을 반환한다.

```ts
const fixedRng: Rng = {
  seed: "worldturn-fixed",
  float: () => 0,
  int: (min) => min,
  pick: <T>(items: readonly T[]) => items[0],
  shuffle: <T>(items: readonly T[]) => [...items],
  derive: () => fixedRng,
};
```

추가로 같은 입력과 같은 RNG를 두 번 실행해 `pool`과 `result`가 deep-equal인지, 입력 `pool`과 `party`가 변경되지 않는지 테스트한다.

- [ ] **Step 2: 상태 변화 테스트가 실패하는지 확인한다**

Run: `corepack pnpm test -- lib/domain/worldturn.test.ts`

Expected: 임시 0 변화 구현 때문에 HP·골드·중상 기대값이 실패한다.

- [ ] **Step 3: 휴식·백그라운드 계산을 구현한다**

내부 함수는 다음 계산을 그대로 사용한다.

```ts
const recovery = Math.max(
  REST_RECOVERY_MIN,
  Math.round(character.maxHp * REST_RECOVERY_RATIO),
);
const nextHp = Math.min(character.maxHp, character.hp + recovery);

const lossPercent = worldturnRng.int(10, 20);
const hpLoss = Math.max(
  1,
  Math.round((character.maxHp * lossPercent) / 100),
);
const nextHp = Math.max(BACKGROUND_HP_FLOOR, character.hp - hpLoss);
const goldDelta = worldturnRng.int(5, 15);
```

각 계산은 `{ character, hpDelta, goldDelta, becameGravelyWounded, reason }`을 반환하고, 상위 함수가 `byId`를 새 Record로 만든다. `updateGravelyWounded`는 처리 전 플래그와 처리 후 `nextHp / maxHp < GRAVELY_WOUNDED_HP_RATIO`를 비교한다. 휴식 결과가 20% 이상이면 플래그를 false로 바꾸고, 백그라운드 결과가 20% 미만이면 true로 바꾼다.

사유 문자열에는 활동과 실제 변화량을 포함한다. 예를 들어 휴식은 `월드턴 휴식: HP +15`, 백그라운드는 `백그라운드 원정: HP -5, 골드 +5` 형식으로 만들고 중상 생성·해제 시 해당 사실을 덧붙인다.

- [ ] **Step 4: 결과·불변성·경계 테스트를 통과시킨다**

Run: `corepack pnpm test -- lib/domain/worldturn.test.ts`

Expected: PASS. 특히 HP가 모두 정수이고, 백그라운드 HP가 1 아래로 내려가지 않으며, 결과가 `pool.order` 순서인지 확인한다.

- [ ] **Step 5: 커밋한다**

```bash
git add lib/domain/worldturn.ts lib/domain/worldturn.test.ts
git commit -m "C3: 월드턴 상태 변화를 적용한다" -m "휴식·백그라운드 HP와 골드 변화, 중상 생성·해제 및 결과 사유를 구현한다."
```

### Task 5: C3 완료 통합과 작업 배정표 갱신

**Files:**
- Modify: `lib/domain/worldturn.test.ts`
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

**Interfaces:**
- Consumes: Task 4의 완성된 `runWorldTurn` 계약
- Produces: C3 완료 상태와 C7의 갱신된 직접 선행 목록

- [ ] **Step 1: C3 완료 기준을 한 테스트 묶음으로 확인한다**

`worldturn.test.ts`에 다음 통합 테스트를 추가한다.

```ts
it("모든 생존자가 중상이어도 C3는 엔딩을 만들지 않고 다음 풀을 반환한다", () => {
  const members = [
    character({ id: "one" as CharacterId, hp: 10, gravelyWounded: true }),
    character({ id: "two" as CharacterId, hp: 10, gravelyWounded: true }),
    character({ id: "three" as CharacterId, hp: 10, gravelyWounded: true }),
  ];
  const result = runWorldTurn(makePool(members), emptyParty, 4, fixedRng);

  expect(result.result.worldTurn).toBe(5);
  expect(result.result.outcomes).toHaveLength(3);
  expect(result).not.toHaveProperty("ending");
});
```

동일 시드 재현성, 결과 순서, 원본 불변성, 모든 입력 검증, RNG 계약을 함께 실행한다.

- [ ] **Step 2: 통합 테스트를 실행한다**

Run: `corepack pnpm test -- lib/domain/worldturn.test.ts lib/domain/contract.test.ts lib/rng/streams.test.ts`

Expected: PASS.

- [ ] **Step 3: 배정표의 C3 상태와 C7 선행을 갱신한다**

`docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`의 C3 행을 다음 의미로 갱신한다.

- 담당자: `sanghwan.yoo`
- 상태: `✅`

C7 행의 직접 선행에서 완료된 `C3`를 제거해 `C1 C5 C6`만 남긴다. 다른 행·그래프·완료 기준은 변경하지 않는다.

- [ ] **Step 4: 문서 변경을 검증한다**

Run: `rg -n "\| C3 \||\| C7 \|" docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

Expected: C3 행이 `sanghwan.yoo`와 `✅`를 포함하고, C7 행의 선행이 `C1 C5 C6`이다.

- [ ] **Step 5: 커밋한다**

```bash
git add lib/domain/worldturn.test.ts docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md
git commit -m "C3: 월드턴 작업을 완료 처리한다" -m "C3 완료 기준을 통합 테스트로 확인하고 배정표의 상태와 C7 선행을 갱신한다."
```

### Task 6: 전체 검증과 인수 확인

**Files:**
- Verify: `lib/domain/worldturn.ts`
- Verify: `lib/domain/worldturn.test.ts`
- Verify: `lib/domain/errors.ts`
- Verify: `lib/rng/index.ts`
- Verify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

**Interfaces:**
- Consumes: Tasks 1–5의 구현과 테스트
- Produces: C3 완료를 뒷받침하는 typecheck/test/lint/build 결과

- [ ] **Step 1: 전체 테스트를 실행한다**

Run: `corepack pnpm test`

Expected: 모든 Vitest 테스트 PASS.

- [ ] **Step 2: 타입 검사를 실행한다**

Run: `corepack pnpm typecheck`

Expected: TypeScript 오류 0건.

- [ ] **Step 3: 린트를 실행한다**

Run: `corepack pnpm lint`

Expected: ESLint 오류·경고 0건.

- [ ] **Step 4: 프로덕션 빌드를 실행한다**

Run: `corepack pnpm build`

Expected: Next.js production build 성공.

- [ ] **Step 5: 변경 범위와 상태를 확인한다**

Run: `git diff --check; git status --short --branch; git log --oneline -6`

Expected: whitespace 오류가 없고, 변경 파일은 C3 spec/plan·domain·RNG·assignment 문서 범위이며, 의도하지 않은 파일이 없다.

- [ ] **Step 6: 최종 커밋 상태를 확인한다**

```bash
git status --short
```

Expected: 작업 트리가 clean이거나, 사용자가 검토할 수 있도록 남은 의도된 변경만 명시적으로 보고한다.
