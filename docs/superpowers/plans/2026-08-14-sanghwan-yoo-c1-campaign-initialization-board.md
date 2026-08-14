# C1 캠페인 초기화·게시판 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 결정적인 시드 하나로 15개 던전·15개 완성 파티·예비 인원 6명과 첫 게시판을 생성하고, 게시판의 정렬·최대 5개 연결·명성 잠금 규칙을 순수 TypeScript 규칙으로 제공한다.

**Architecture:** 기존 F1 `CampaignState`와 F2 콘텐츠를 소비하는 `campaign-init.ts`와 `board.ts`를 분리한다. `party.ts`에는 기본 3~5인 생성 동작을 유지하면서 C1의 고정 3인 파티와 예비 인원이 공유할 프로필 생성 계약을 추가한다. C1은 C3 정산·승급·엔딩 전이, C2 파티 생명주기, UI·스토어를 호출하거나 수정하지 않는다.

**Tech Stack:** TypeScript 5, Vitest 4, 기존 `createRng(...).derive(...)` 난수 스트림, F1 `CampaignState` 도메인 타입, pnpm 스크립트. 새 의존성은 추가하지 않는다.

## Global Constraints

- 같은 seed와 같은 입력 상태는 deep equal 결과를 내야 한다.
- `Math.random()`이나 모듈 내부의 새 루트 RNG를 사용하지 않고 `dungeon`, `party`, `reserve`, `carriedGold`, `board` 스트림을 분리한다.
- C1 완성 파티는 모든 등급에서 정확히 3명이고, 파티 내부 직업·성격은 중복되지 않는다.
- 초기 캠페인은 C 6개, B 4개, A 3개, S 2개 던전과 완성 파티 15팀·예비 인원 6명으로 시작한다.
- 초기 자원은 `rank: "C"`, `currentReputation: 0`, `currentGold: 10`, `cumulativeGold: 0`이다.
- 인물의 `maxHp`와 `currentHp`는 100, 소지 골드는 시드 기반 10..30, 초기 신뢰는 성격 기본값 ±5와 0..100 제한을 사용한다.
- 게시판은 C→B→A→S와 `sortOrder`로 정렬하고 `min(5, 남은 던전 수, 완성 파티 수)`개만 만든다. 잠긴 공고는 제거하지 않는다.
- 규칙 함수는 입력 상태·콘텐츠·중첩 배열을 직접 수정하지 않는다.
- C3의 정산·승급·엔딩, C2의 충원·재편·회복, E1~E3의 탐험 규칙, U1의 화면은 변경하지 않는다.
- 구현 전후 명령은 저장소의 `pnpm` 스크립트를 사용한다. 커밋 메시지는 제목과 본문을 포함한 한글로 작성한다.

## File Map

| 파일 | 책임 | 이 plan에서의 변경 |
| --- | --- | --- |
| `lib/content/dungeons.ts` | C1 등급별 보상·지원·지도 지점 상수와 초기 던전 정의 | 생성 |
| `lib/rules/party.ts` | 기존 파티 생성과 공유 가능한 단일 인물 프로필 생성 | 수정 |
| `lib/rules/party.test.ts` | 기본 3~5인 동작과 고정 크기 옵션 회귀 | 수정 |
| `lib/rules/board.ts` | 게시판 생성·공고 수락·게시판 종료 후보 | 생성 |
| `lib/rules/board.test.ts` | 정렬·연결·잠금·불변성 테스트 | 생성 |
| `lib/rules/campaign-init.ts` | 초기 `CampaignState` factory | 생성 |
| `lib/rules/campaign-init.test.ts` | 15개 캠페인 초기화 불변식·재현성 테스트 | 생성 |
| `docs/README.md` | C1 spec·plan 탐색 링크 | 수정 |
| `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md` | 구현 완료 후 C1 담당·상태 기록 | 마지막 검증 후 수정 |

`lib/domain/campaign.ts`와 `lib/domain/index.ts`는 현재 F1 계약이 충분한지
먼저 사용한다. 컴파일에 필요한 필드가 실제로 부족할 때만 최소 수정하며,
C3 전용 정산·승급 필드를 선행 추가하지 않는다.

---

### Task 1: 고정 파티 생성과 C1 던전 상수 기반

**Files:**
- Create: `lib/content/dungeons.ts`
- Modify: `lib/rules/party.ts`
- Test: `lib/rules/party.test.ts`

**Interfaces:**
- Consumes: 기존 `ClassDef`, `CLASSES`, `MEMBER_NAMES`, `PERSONALITIES`, `Rng`와 F1의 `CAMPAIGN_PARTY_SIZE`.
- Produces: `GeneratePartyOptions.size?: number`, `MemberProfile`, `generateMemberProfile(rng, options?)`, `CAMPAIGN_GRADE_CONFIG`, `INITIAL_DUNGEON_DEFINITIONS`.
- Preserves: `generateParty(rng)`의 기존 기본 크기 3~5와 기존 호출부의 반환 형태.

- [ ] **Step 1: 고정 크기와 단일 프로필의 실패 테스트를 작성한다.**

`lib/rules/party.test.ts`에 기존 기본 동작을 보존하는 테스트와 C1 고정 크기
테스트를 추가한다.

```ts
it("size 옵션으로 3인 파티를 고정 생성한다", () => {
  const party = generateParty(createRng("campaign-party").derive("party"), {
    size: CAMPAIGN_PARTY_SIZE,
  });

  expect(party).toHaveLength(3);
  expect(new Set(party.map((member) => member.classId)).size).toBe(3);
  expect(new Set(party.map((member) => member.personality)).size).toBe(3);
});

it("예비 인원용 단일 프로필도 같은 신뢰 계약을 사용한다", () => {
  const profile = generateMemberProfile(createRng("reserve-profile"));

  expect(profile.name).not.toBe("");
  expect(profile.trust).toBeGreaterThanOrEqual(0);
  expect(profile.trust).toBeLessThanOrEqual(100);
});

it("size가 파티 범위를 벗어나면 거부한다", () => {
  expect(() =>
    generateParty(createRng("invalid-party"), { size: 2 }),
  ).toThrow(/파티 인원/);
});
```

- [ ] **Step 2: 테스트를 실행해 새 계약이 아직 없음을 확인한다.**

Run: `pnpm test lib/rules/party.test.ts`

Expected: `size`와 `generateMemberProfile`이 아직 없어 TypeScript 또는
Vitest가 실패한다. 기존 파티 테스트의 실패 원인은 함께 확인하고 기존
기본 생성 회귀가 깨지지 않았는지 기록한다.

- [ ] **Step 3: 프로필 helper와 고정 크기 옵션을 최소 구현한다.**

`GeneratePartyOptions`에 선택적 `size`를 추가하고, 값이 없으면 기존처럼
`rng.int(PARTY_SIZE_MIN, PARTY_SIZE_MAX)`를 사용한다. 값이 있으면 정수이며
`PARTY_SIZE_MIN..PARTY_SIZE_MAX` 안에 있는지 검사한다.

기존 `generateParty`의 파티 내부 중복 방지 로직은 유지하고, 신뢰 계산을
공유할 수 있도록 다음 형태의 공개 프로필을 추가한다.

```ts
export interface MemberProfile {
  name: string;
  classId: ClassId;
  personality: Personality;
  trust: number;
}

export function generateMemberProfile(
  rng: Rng,
  options: GeneratePartyOptions = {},
): MemberProfile {
  const classPool = options.classes ?? CLASSES;
  const namePool = options.names ?? MEMBER_NAMES;
  const personality = rng.pick(PERSONALITIES);
  const base = INITIAL_TRUST_BASE[personality];

  return {
    classId: rng.pick(classPool).id,
    name: rng.pick(namePool),
    personality,
    trust: clampTrust(base + rng.int(-INITIAL_TRUST_JITTER, INITIAL_TRUST_JITTER)),
  };
}
```

파티 생성은 여전히 `shuffle(...).slice(0, size)`로 직업·성격·이름을
각각 중복 없이 뽑는다. 단일 프로필 helper는 예비 인원처럼 전역 중복을
요구하지 않는 생성에만 사용한다.

`lib/content/dungeons.ts`에는 다음 값을 `Grade`별 읽기 전용 설정으로
둔다.

```ts
export interface CampaignGradeConfig {
  readonly requiredReputation: number;
  readonly baseReputationReward: number;
  readonly baseGoldReward: number;
  readonly nodeCount: number;
}

export const CAMPAIGN_GRADE_CONFIG: Readonly<Record<Grade, CampaignGradeConfig>> = {
  C: { requiredReputation: 0, baseReputationReward: 10, baseGoldReward: 20, nodeCount: 7 },
  B: { requiredReputation: 30, baseReputationReward: 15, baseGoldReward: 35, nodeCount: 9 },
  A: { requiredReputation: 60, baseReputationReward: 25, baseGoldReward: 55, nodeCount: 11 },
  S: { requiredReputation: 100, baseReputationReward: 40, baseGoldReward: 80, nodeCount: 13 },
};

export const INITIAL_DUNGEON_DEFINITIONS = [
  ...Array.from({ length: 6 }, (_, index) => ({
    id: `dungeon-${String(index + 1).padStart(3, "0")}` as DungeonId,
    initialGrade: "C" as const,
  })),
  ...Array.from({ length: 4 }, (_, index) => ({
    id: `dungeon-${String(index + 7).padStart(3, "0")}` as DungeonId,
    initialGrade: "B" as const,
  })),
  ...Array.from({ length: 3 }, (_, index) => ({
    id: `dungeon-${String(index + 11).padStart(3, "0")}` as DungeonId,
    initialGrade: "A" as const,
  })),
  ...Array.from({ length: 2 }, (_, index) => ({
    id: `dungeon-${String(index + 14).padStart(3, "0")}` as DungeonId,
    initialGrade: "S" as const,
  })),
] as const;
```

- [ ] **Step 4: 공통 생성 계약과 기존 회귀 테스트를 통과시킨다.**

Run: `pnpm test lib/rules/party.test.ts && pnpm typecheck`

Expected: 기존 기본 파티 테스트와 새 고정 크기·단일 프로필 테스트가 모두
통과하고, `CAMPAIGN_GRADE_CONFIG`와 초기 던전 정의가 타입 검사에 통과한다.

- [ ] **Step 5: 기반 변경을 커밋한다.**

```bash
git add lib/content/dungeons.ts lib/rules/party.ts lib/rules/party.test.ts
git commit -m "기반: C1 고정 파티와 던전 상수를 준비한다" -m "기존 파티 생성 동작을 유지하면서 3인 캠페인 파티와 예비 인원이 공유할 프로필 계약, 등급별 던전 상수를 추가한다."
```

---

### Task 2: 게시판 생성·명성 잠금 규칙

**Files:**
- Create: `lib/rules/board.ts`
- Test: `lib/rules/board.test.ts`

**Interfaces:**
- Consumes: `CampaignState`, `CampaignDungeon`, `CampaignParty`, `BoardOffer`, `CAMPAIGN_GRADE_CONFIG`, `GRADES`, `createRng`.
- Produces: `generateBoard(state): BoardOffer[]`, `canAcceptOffer(state, offer)`, `createBoardEnding(state)`.
- Does not produce: 계약 실행, `CampaignState.phase` 변경, `CampaignEnding` 객체, RNG 상태 저장.

- [ ] **Step 1: 정렬·최대 5개·잠금·가용성 테스트를 작성한다.**

테스트 파일 안에 fixture factory를 두어 필요한 필드만 바꾼다. 입력 fixture의
중첩 배열은 새 배열로 만들고, production `generateBoard`가 다른 테스트의
state를 변형하지 않는지도 확인한다.

```ts
function stateWithBoardInputs(
  completePartyCount: number,
  currentReputation = 0,
): CampaignState {
  const base = createFixtureCampaignState("board-fixture");
  const dungeons = Array.from({ length: 15 }, (_, index) => ({
    ...base.dungeons[0],
    id: `dungeon-${String(index + 1).padStart(3, "0")}` as DungeonId,
    initialGrade: index < 6 ? "C" : index < 10 ? "B" : index < 13 ? "A" : "S",
    grade: index < 6 ? "C" : index < 10 ? "B" : index < 13 ? "A" : "S",
    sortOrder: index,
  }));
  const parties = Array.from({ length: completePartyCount }, (_, index) => ({
    id: `party-${String(index + 1).padStart(3, "0")}` as PartyId,
    memberIds: base.parties[0].memberIds,
    complete: true,
  }));

  return {
    ...base,
    currentReputation,
    dungeons,
    parties,
    board: [],
  };
}

it("남은 던전을 C부터 같은 등급 sortOrder 순으로 최대 5개 제시한다", () => {
  const board = generateBoard(stateWithBoardInputs(15, 0));

  expect(board).toHaveLength(5);
  expect(board.map((offer) => offer.dungeonId)).toEqual([
    "dungeon-001", "dungeon-002", "dungeon-003", "dungeon-004", "dungeon-005",
  ]);
});

it("완성 파티가 1~4팀이면 공고 수도 줄어든다", () => {
  expect(generateBoard(stateWithBoardInputs(1))).toHaveLength(1);
  expect(generateBoard(stateWithBoardInputs(4))).toHaveLength(4);
});

it("명성 부족 공고를 숨기지 않고 잠근다", () => {
  const state = stateWithBoardInputs(5, 0);
  const board = generateBoard(state);

  expect(board.some((offer) => offer.locked)).toBe(true);
  expect(board.find((offer) => offer.dungeonId === "dungeon-007"))
    .toMatchObject({ locked: true, lockReason: "insufficientReputation" });
});
```

추가 테스트로 같은 상태의 deep equal 재현성, 던전·파티 중복 방지, 지원
가능 공고·잠긴 공고의 `canAcceptOffer`, stale offer와 불완성 파티의
`partyUnavailable`, `partyExhausted`·`supportUnavailable`·`null` 후보를
고정한다.

- [ ] **Step 2: 게시판 테스트를 실행해 구현 부재 실패를 확인한다.**

Run: `pnpm test lib/rules/board.test.ts`

Expected: `lib/rules/board.ts`와 공개 함수가 없어 import 또는 함수 호출이
실패한다. fixture 자체의 타입 오류가 있으면 먼저 fixture 입력을 고친 뒤
다시 실행한다.

- [ ] **Step 3: 정렬·연결·잠금 규칙을 구현한다.**

입력 배열을 직접 정렬하지 않고 복사한 뒤 다음 순서로 계산한다.

```ts
const GRADE_INDEX: Readonly<Record<Grade, number>> = {
  C: 0,
  B: 1,
  A: 2,
  S: 3,
};

function sortedRemainingDungeons(state: CampaignState): CampaignDungeon[] {
  return state.dungeons
    .filter((dungeon) => dungeon.status === "remaining")
    .toSorted((left, right) =>
      GRADE_INDEX[left.grade] - GRADE_INDEX[right.grade]
      || left.sortOrder - right.sortOrder
      || left.id.localeCompare(right.id),
    );
}
```

`generateBoard`는 완성 파티만 새 배열로 수집하고
`createRng(state.seed).derive("board").shuffle(parties)`로 연결 순서를
만든다. 남은 던전과 섞인 파티를 `min(5, ...)`만큼 `zip`한다. 공고에는
현재 등급 설정의 `requiredReputation`, `baseReputationReward`,
`baseGoldReward`, `nodeCount`를 복사한다. 공고 ID는
`offer-${dungeon.id}-${party.id}`를 `BoardOfferId`로 단언해 쌍마다
결정적·고유하게 만든다.

`locked`는 `state.currentReputation < requiredReputation`으로 계산하고,
생성되는 offer의 `lockReason`은 잠겼을 때만
`"insufficientReputation"`, 아니면 `null`로 둔다.

`canAcceptOffer`는 먼저 `state.board`에서 같은 ID와 같은 dungeon·party
쌍을 찾고, 던전이 남아 있고 파티가 완성인지 확인한다. stale offer,
존재하지 않는 ID, 남지 않은 던전, 불완성 파티는
`{ accepted: false, reason: "partyUnavailable" }`를 반환한다. 그 뒤 현재
명성과 실제 `requiredReputation`을 비교해 부족하면
`"insufficientReputation"`, 충분하면 `{ accepted: true }`를 반환한다.
이 함수는 state를 수정하지 않는다.

`createBoardEnding`은 남은 던전이 없으면 `null`, 남은 던전이 있고 완성
파티가 없으면 `"partyExhausted"`, 생성된 보드가 1개 이상이며 모두
잠겼으면 `"supportUnavailable"`, 그 외에는 `null`을 반환한다. 이 함수는
`generateBoard(state)`를 사용해 stale한 `state.board`에도 순수하게 대응하되
ending·phase·log를 수정하지 않는다.

- [ ] **Step 4: 게시판 단위 테스트와 타입 검사를 통과시킨다.**

Run: `pnpm test lib/rules/board.test.ts && pnpm typecheck`

Expected: 게시판 테스트가 모두 통과하고 C1 공개 함수의 반환 타입이 F1
도메인 타입과 일치한다.

- [ ] **Step 5: 게시판 규칙을 커밋한다.**

```bash
git add lib/rules/board.ts lib/rules/board.test.ts
git commit -m "캠페인: C1 명성 잠금 게시판을 구현한다" -m "남은 던전 정렬과 완성 파티 연결, 최대 5개 공고, 명성 잠금과 게시판 진행 후보를 결정적인 순수 규칙으로 추가한다."
```

---

### Task 3: 15개 던전 캠페인 초기화 factory

**Files:**
- Create: `lib/rules/campaign-init.ts`
- Test: `lib/rules/campaign-init.test.ts`

**Interfaces:**
- Consumes: `CAMPAIGN_GRADE_CONFIG`, `INITIAL_DUNGEON_DEFINITIONS`, `generateParty`, `generateMemberProfile`, `createRng`, `generateBoard`, F1 `CampaignState` types.
- Produces: `initializeCampaign(seed: string): CampaignState` with a materialized initial board.
- Preserves: 기존 `createInitialRun`과 `RunState` 소비자. C1 factory를 기존 단일 탐험 factory로 역변환하지 않는다.

- [ ] **Step 1: 15개·15팀·6예비·자원·재현성 실패 테스트를 작성한다.**

```ts
describe("initializeCampaign", () => {
  it("같은 seed는 전체 초기 캠페인을 재현한다", () => {
    const first = initializeCampaign("campaign-001");
    const second = initializeCampaign("campaign-001");

    expect(second).toEqual(first);
    expect(first.dungeons).toHaveLength(15);
    expect(first.parties).toHaveLength(15);
    expect(first.parties.filter((party) => party.complete)).toHaveLength(15);
    expect(first.reserveMemberIds).toHaveLength(6);
    expect(first.board).toHaveLength(5);
  });

  it("초기 등급·자원·개인 상태 불변식을 지킨다", () => {
    const state = initializeCampaign("campaign-002");
    const gradeCounts = Object.fromEntries(
      GRADES.map((grade) => [
        grade,
        state.dungeons.filter((dungeon) => dungeon.grade === grade).length,
      ]),
    );

    expect(gradeCounts).toEqual({ C: 6, B: 4, A: 3, S: 2 });
    expect(state).toMatchObject({
      phase: "board",
      rank: "C",
      currentReputation: 0,
      currentGold: 10,
      cumulativeGold: 0,
      expedition: null,
      ending: null,
      log: [],
    });
    expect(state.members).toHaveLength(51);
    expect(state.members.every((member) =>
      member.currentHp === 100
      && member.maxHp === 100
      && member.alive
      && member.carriedGold >= 10
      && member.carriedGold <= 30
      && member.memory.length === 0,
    )).toBe(true);
  });

  it("파티 내부 직업·성격과 전체 ID를 중복하지 않는다", () => {
    const state = initializeCampaign("campaign-003");
    const members = new Map(state.members.map((member) => [member.id, member]));

    expect(new Set(state.members.map((member) => member.id)).size).toBe(51);
    for (const party of state.parties) {
      const partyMembers = party.memberIds.map((id) => members.get(id)!);
      expect(new Set(partyMembers.map((member) => member.classId)).size).toBe(3);
      expect(new Set(partyMembers.map((member) => member.personality)).size).toBe(3);
    }
  });
});
```

추가 테스트로 예비 ID가 어떤 파티에도 포함되지 않는지, 다른 시드가
정렬·파티·소지 골드 중 하나 이상을 바꾸는지, 한 반환 상태의 memory나
memberIds를 수정해도 다음 호출에 영향을 주지 않는지를 확인한다.

- [ ] **Step 2: 초기화 테스트를 실행해 factory 부재 실패를 확인한다.**

Run: `pnpm test lib/rules/campaign-init.test.ts`

Expected: `initializeCampaign` export가 없어 실패한다. 이 단계에서
`board.ts` 또는 기존 F1 fixture의 오류가 섞이면 import 경계를 확인한다.

- [ ] **Step 3: 결정적 초기화 factory를 구현한다.**

초기화 순서와 스트림 소비를 다음처럼 고정한다.

1. `root = createRng(seed)`를 만들고 `dungeon`, `party`, `reserve`,
   `carriedGold`를 각각 파생한다.
2. 등급별 초기 정의를 `dungeon` stream으로 섞어 각 항목에 `sortOrder`,
   `status: "remaining"`, `failureCount: 0`을 붙인다.
3. `party` stream을 하나 유지하면서 15회
   `generateParty(partyRng, { size: CAMPAIGN_PARTY_SIZE })`를 호출한다.
   각 호출이 반환한 로컬 member ID는 사용하지 않고 생성 순서로 전역
   `member-001..member-045`를 부여한다.
4. `reserve` stream으로 `generateMemberProfile`을 6회 호출하고
   `member-046..member-051`을 부여한다.
5. 모든 인물의 carried gold는 별도의 `carriedGold` stream에서 출전 인물
   45명 다음 예비 인원 6명 순서로 `int(10, 30)`을 호출한다.
6. 캠페인 상태를 `phase: "board"`, 초기 자원, 빈 waiting·log,
   `expedition: null`, `ending: null`, 빈 board로 만든다.
7. 완성 상태를 `generateBoard(state)`에 넘겨 첫 board를 새 배열로 채운다.

캠페인 인물 변환 helper는 다음 필드를 명시적으로 만든다.

```ts
function toCampaignMember(
  id: MemberId,
  profile: MemberProfile,
  carriedGold: number,
): CampaignMember {
  return {
    id,
    name: profile.name,
    classId: profile.classId,
    personality: profile.personality,
    currentHp: 100,
    maxHp: 100,
    trust: profile.trust,
    carriedGold,
    alive: true,
    memory: [],
  };
}
```

파티의 `memberIds`는 전역 ID 배열만 보유하고, `complete`는 초기 파티에서
항상 `true`다. 초기 던전은 `initialGrade === grade`이며 공고가 현재
등급 설정을 읽을 수 있도록 `BoardOffer`의 보상 필드를 board factory에서
채운다. 어떤 입력 배열도 `sort`나 `splice`로 직접 변경하지 않는다.

- [ ] **Step 4: 초기화 테스트·도메인 타입 검사를 통과시킨다.**

Run: `pnpm test lib/rules/party.test.ts lib/rules/board.test.ts lib/rules/campaign-init.test.ts && pnpm typecheck`

Expected: 기존 파티 회귀, 게시판 규칙, 15개 캠페인 초기화 테스트가 모두
통과하고 새 factory가 F1 `CampaignState`를 만족한다.

- [ ] **Step 5: 캠페인 초기화 factory를 커밋한다.**

```bash
git add lib/rules/campaign-init.ts lib/rules/campaign-init.test.ts
git commit -m "캠페인: C1 15개 던전 초기화를 추가한다" -m "결정적 난수 스트림으로 던전 15개, 3인 완성 파티 15팀, 예비 인원 6명과 첫 게시판을 생성한다."
```

---

### Task 4: 문서 연결과 C1 완료 검증

**Files:**
- Modify: `docs/README.md`
- Modify: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`
- Test/Verify: `lib/rules/party.test.ts`, `lib/rules/board.test.ts`, `lib/rules/campaign-init.test.ts`, 전체 저장소 검사

**Interfaces:**
- Consumes: Task 1~3의 공개 함수와 테스트 결과.
- Produces: 문서 인덱스의 C1 spec·plan 링크와, 모든 C1 완료 기준을 반영한 배정표 기록.
- Does not modify: C3 담당자·상태, C3 규칙 파일, F2 완료 기록, 기존 원본 자료.

- [ ] **Step 1: C1 공식 문서 인덱스 링크를 추가한다.**

`docs/README.md`에 C1 실행 기록을 추가하고 아래 두 문서를 연결한다.

```md
## C1 실행 기록

- [C1 캠페인 초기화·게시판 설계](superpowers/specs/2026-08-14-sanghwan-yoo-c1-campaign-initialization-board-design.md)
- [C1 캠페인 초기화·게시판 구현 계획](superpowers/plans/2026-08-14-sanghwan-yoo-c1-campaign-initialization-board.md)
```

- [ ] **Step 2: 전체 자동 검증을 실행한다.**

Run each command to capture fresh output.

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: Vitest failures 0, TypeScript exit 0, ESLint errors 0, Next build
exit 0, diff check output empty. 실패가 있으면 C1 범위 안에서 원인을
수정하고 해당 Task의 targeted test부터 다시 실행한다. C3 동료 작업이나
무관한 기존 변경은 되돌리거나 덮어쓰지 않는다.

- [ ] **Step 3: 배정표에 C1 완료를 기록한다.**

모든 C1 완료 기준과 전체 검증이 통과한 뒤에만
`docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`의 C1 행을 다음처럼 갱신한다.

```md
| C1 | 캠페인 초기화·게시판 | 15개 던전 생성, 정렬, 최대 5개 공고와 시드 기반 파티 연결·명성 제한 테스트 통과 | — | **C3 U1** | SangHwan Yoo | ✅ |
```

그래프의 `C1 --> C3 & U1`, C3의 선행 `C1 C2 E3`, U1의 선행 `C1`은
변경하지 않는다. C3가 진행 중이어도 C1 완료 기록만 갱신한다.

- [ ] **Step 4: 문서·구현 변경을 한글 커밋으로 저장한다.**

```bash
git add docs/README.md docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md
git diff --cached --check
git commit -m "문서: C1 구현과 검증 완료를 기록한다" -m "캠페인 초기화·게시판 규칙의 실행 계획 링크와 자동 검증 결과를 문서에 반영하고 C1 담당 상태를 완료로 갱신한다."
```

---

## 최종 검증 체크리스트

- [ ] 같은 seed의 초기 `CampaignState`가 deep equal이다.
- [ ] 던전 수량이 C/B/A/S = 6/4/3/2다.
- [ ] 완성 파티 15팀이 모두 3명이고 파티 내부 직업·성격이 중복되지 않는다.
- [ ] 예비 인원 6명이 파티와 분리되어 있고 전체 인물 ID가 유일하다.
- [ ] HP 100/100, 신뢰 0..100, 소지 골드 10..30, 빈 memory를 지킨다.
- [ ] 게시판 정렬이 C→B→A→S 및 `sortOrder` 순이다.
- [ ] 공고가 최대 5개이고 완성 파티가 1~4팀이면 그 수로 줄어든다.
- [ ] 명성 부족 공고가 보이는 상태로 잠기며 `insufficientReputation`을 반환한다.
- [ ] stale offer·불완성 파티·남지 않은 던전이 `partyUnavailable`을 반환한다.
- [ ] C1 함수가 입력 상태·콘텐츠·중첩 배열을 변경하지 않는다.
- [ ] C3 정산·승급·엔딩 파일과 상태 전이를 변경하지 않는다.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`가 모두 통과한다.
