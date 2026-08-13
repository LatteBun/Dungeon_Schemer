# 던전 15개 캠페인 게임 방향 개편 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 승인된 상위 spec에 따라 기존 단일 `RunState` 탐험을 지속되는 15개 던전 캠페인으로 교체하고, 게시판·파티·지도·정보·보스·정산·승급·엔딩·화면을 같은 결정적 상태 흐름으로 연결한다.

**Architecture:** 캠페인 전체를 보관하는 `CampaignState`와 선택한 한 던전을 처리하는 `ExpeditionState`를 분리한다. 초기화·게시판·파티 생명주기·지도 생성·정보 판정·사건·보스·정산·승급·엔딩은 순수 규칙 모듈로 만들고, Zustand 스토어와 Next.js 화면은 `transitionCampaign`이라는 단일 전이 함수만 호출한다. 기존 `RunState`와 R1~P1 모듈은 새 계약으로 이행한 뒤 테스트용 역사 코드는 제거하거나 캠페인 fixture로 바꾼다.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript 5, Zustand 5 vanilla store, Vitest 4, 기존 이름 있는 RNG 스트림과 Tailwind CSS.

## Global Constraints

- 게임의 최상위 기준은 `docs/GAME_PRINCIPLES.md`이며, 구현 중 규칙을 임의로 완화하지 않는다.
- 캠페인은 C 6개·B 4개·A 3개·S 2개, 완성 3인 파티 15팀, 예비 인원 6명으로 시작한다.
- 프로토타입 출전 인원은 모든 등급에서 3명이며 `C·B 3명 / A 4명 / S 5명`은 구현하지 않는다.
- 승급 점수는 `현재 명성 × 2 + 누적 획득 골드`이고 기준은 B 120, A 274, S 370이다.
- 현재 골드는 10에서 시작하고 누적 획득 골드는 0에서 시작한다. 시작 골드 10은 누적 골드에 넣지 않는다.
- 비출전 생존자 회복은 `max(1, round(현재 HP × 0.05))`이며 최대 HP를 넘지 않는다.
- 카드의 수신자는 살아 있는 용사 파티원뿐이다. 보스는 카드의 주제일 수 있지만 수신자나 거래 상대가 아니다.
- 정보 횟수는 실제 선택 경로에서 C 2회·B 3회·A 4회·S 5회이고, 보스 관련 카드는 C/B 1회·A/S 2회를 보장한다.
- 보스 피해 보정은 수용한 진실 -20%, 중립 -10%, 거짓 +25%, 의심·적발 0%, 최종 합산 범위 -30%~+50%다.
- 한 명 이상 생존하면 클리어, 전멸만 실패다. 실패한 던전은 C→B→A→S로 오르고 S는 유지된다.
- 엔딩 우선순위는 `불신의 대가 → 원정 종료 → 길잡이 자격 박탈 → 용사들의 시대가 끝나다`다.
- 같은 시드와 같은 선택은 같은 상태·결정 기록을 만든다. 오류를 숨기기 위한 재추첨과 기본값 대체를 하지 않는다.
- 구현 작업은 각 Task의 실패 테스트를 먼저 작성하고, 기존 `pnpm test`, `pnpm lint`, `pnpm typecheck`를 유지한다.
- 커밋 메시지는 제목과 본문을 모두 한글로 작성한다.

---

## 파일 경계와 이행 순서

새 구현은 다음 파일 경계를 사용한다.

| 영역 | 생성·수정 파일 | 책임 |
| --- | --- | --- |
| 도메인 계약 | `lib/domain/ids.ts`, `campaign.ts`, `expedition.ts`, `run.ts`, `info.ts`, `dungeon.ts`, `index.ts` | 브랜드 ID, 등급, 캠페인·탐험 상태, 단계, 결과·오류 타입 |
| 콘텐츠 | `lib/content/classes.ts`, `names.ts`, `events.ts`, `dungeons.ts`, `info-cards.ts`, `items.ts` | 규칙과 분리된 직업·사건·지도·카드·상품 데이터 |
| 캠페인 규칙 | `lib/rules/campaign-init.ts`, `board.ts`, `party-lifecycle.ts`, `promotion.ts`, `ending.ts` | 초기화, 게시판, 파티 유지, 승급, 엔딩 |
| 탐험 규칙 | `lib/rules/map.ts`, `info.ts`, `event.ts`, `boss.ts`, `settlement.ts` | 지도·정보·사건·보스·정산 계산 |
| 전이·스토어 | `lib/flow/campaign-machine.ts`, `lib/stores/campaign-store.ts`, `lib/stores/game-store-provider.tsx` | 유효한 행동만 상태에 적용 |
| 캠페인 UI | `components/game/CampaignHeader.tsx`, `Board.tsx`, `ContractPanel.tsx`, `InfoOpportunity.tsx`, `SettlementTimeline.tsx`, 기존 `DungeonMap.tsx`·`PartySidebar.tsx` | 상태를 설명하고 행동을 전송 |
| 라우트 | `app/play/page.tsx`, `map/page.tsx`, `encounter/page.tsx`, `result/page.tsx`, `phase-route.ts`, `play-run-provider.tsx` | 게시판부터 엔딩까지 화면 흐름 |
| 검증 | 각 규칙의 `*.test.ts`, `lib/backtest/campaign-simulator.ts`, `campaign-simulator.test.ts` | 단위·불변식·재현·10,000시드 보고서 |

기존 `lib/domain/run.ts`, `lib/flow/run-machine.ts`, `app/state-preview`는 첫 단계에서 즉시 삭제하지 않는다. 새 계약을 사용하는 소비자가 모두 이행된 뒤 남은 참조를 `rg`로 확인하고, 더 이상 제품 흐름에 필요하지 않은 단일 런 전용 타입과 fixture만 마지막 정리 Task에서 제거한다.

---

### Task 1: 캠페인·탐험 도메인 계약과 구조화 오류

**Files:**
- Create: `lib/domain/campaign.ts`
- Create: `lib/domain/expedition.ts`
- Create: `lib/domain/errors.ts`
- Create: `lib/rules/fixtures.ts`
- Modify: `lib/domain/ids.ts`, `lib/domain/party.ts`, `lib/domain/info.ts`, `lib/domain/dungeon.ts`, `lib/domain/index.ts`
- Modify: `lib/domain/__checks__.ts`, `lib/domain/constants.test.ts`
- Test: `lib/domain/campaign.test.ts`, `lib/domain/expedition.test.ts`

**Interfaces:**
- Produces `Grade = "C" | "B" | "A" | "S"`, `CAMPAIGN_PHASES = ["board", "contract", "map", "infoOpportunity", "event", "boss", "settlement", "ended"]`.
- Produces branded `DungeonId`, `PartyId`, `BoardOfferId`, `ItemId` and existing ID와 섞이지 않는 타입. 사건 선택 ID는 기존 `ChoiceId`를 계속 사용한다.
- Produces `CampaignMember { id, name, classId, personality, currentHp, maxHp, trust, carriedGold, alive, memory: MemoryRecord[] }`, `CampaignParty { id, memberIds, complete }`, `CampaignDungeon { id, initialGrade, grade, sortOrder, status: "remaining" | "cleared", failureCount }`.
- Produces `BoardOffer { id, dungeonId, partyId, requiredReputation, baseReputationReward, baseGoldReward, nodeCount, locked, lockReason }`.
- Produces `CampaignState { seed, phase, rank, currentReputation, currentGold, cumulativeGold, dungeons, members, parties, reserveMemberIds, waitingMemberIds, board, expedition, ending, log }`.
- Produces `MapNode`, `MapPath`, and `GeneratedMap` in `lib/domain/expedition.ts`; `MapNode` contains `id`, `depth`, `nextNodeIds`, `eventId`, `riskSummary`, `hasInfoOpportunity`, and `bossRelatedInfoCount`, while `MapPath` contains `nodeIds`, `regularEventCount`, and `infoCount`.
- Produces `ExpeditionState { dungeonId, partyId, map: GeneratedMap, currentNodeId, visitedNodeIds, pendingInfo, pendingEvent, bossResult, result, log }`.
- Produces `RuleErrorCode`와 `RuleError`에 `code`, `message`, `details`를 포함한다. 최소 코드는 `INVALID_TRANSITION`, `UNKNOWN_ID`, `DUPLICATE_ID`, `INVALID_GENERATION`, `INSUFFICIENT_GOLD`, `INVALID_SETTLEMENT`이다.
- Produces `MemoryRecord` and test fixture helpers `createFixtureCampaignState`, `createFixtureExpeditionState`, `createMemberWithHp` for later rule tests; each helper returns a fresh deep-cloned fixture.

- [ ] **Step 1: 실패하는 타입 계약 테스트를 작성한다.**

```ts
it("캠페인 상태는 현재 명성·두 골드·영구 등급을 분리한다", () => {
  const state: CampaignState = createFixtureCampaignState();
  expect(state.currentReputation).toBe(0);
  expect(state.currentGold).toBe(10);
  expect(state.cumulativeGold).toBe(0);
  expect(state.rank).toBe("C");
});

it("보드 등급 단계와 정보 전이 단계는 닫힌 목록이다", () => {
  expect(CAMPAIGN_PHASES).toEqual([
    "board", "contract", "map", "infoOpportunity",
    "event", "boss", "settlement", "ended",
  ]);
});
```

- [ ] **Step 2: 테스트를 실행해 새 타입과 fixture가 없어서 실패하는지 확인한다.**

Run: `pnpm test lib/domain/campaign.test.ts lib/domain/expedition.test.ts`

Expected: `CampaignState`, `createFixtureCampaignState`, `CAMPAIGN_PHASES`가 없어 실패한다.

- [ ] **Step 3: 새 타입과 ID를 구현하고 기존 타입을 새 규칙과 맞춘다.**

`Target`에서 보스 수신자 분기를 제거하고 카드 주제는 `InfoSubject = "route" | "event" | "monster" | "rest" | "merchant" | "boss"`로 표현한다. `PartyMember`의 기존 소비자가 깨지지 않도록 캠페인 인물은 새 `CampaignMember`로 분리하며, `InfoCard`는 항상 파티 수신을 전제로 한다. `lib/rules/fixtures.ts`에는 이후 테스트가 공유할 빈 캠페인·탐험 fixture와 HP fixture를 만든다. 모든 프로토타입 인물의 `maxHp`는 우선 100으로 두고 `lib/content/classes.ts`의 조정 가능한 상수로 관리한다.

- [ ] **Step 4: 타입·도메인 테스트와 기존 타입 검사를 통과시킨다.**

Run: `pnpm test lib/domain && pnpm typecheck`

Expected: 새 테스트와 기존 도메인 상수·브랜드 ID 검사가 모두 통과한다.

- [ ] **Step 5: 커밋한다.**

```bash
git add lib/domain
git commit -m "기반: 캠페인과 탐험 도메인 계약을 정의한다" -m "CampaignState와 ExpeditionState, 등급·단계·구조화 오류 타입을 추가한다."
```

### Task 2: 결정적 캠페인 초기화와 콘텐츠 데이터

**Files:**
- Create: `lib/content/dungeons.ts`, `lib/content/info-cards.ts`, `lib/content/items.ts`
- Create: `lib/rules/campaign-init.ts`, `lib/rules/campaign-init.test.ts`
- Modify: `lib/content/events.ts`, `lib/content/names.ts`, `lib/rng/index.ts`
- Modify: `lib/flow/initial-run.ts` to export `createInitialCampaign` through the new factory while retaining `createInitialRun` as a compatibility adapter until Task 8

**Interfaces:**
- Consumes: `CampaignState` types from Task 1 and existing `createRng(seed).derive(name)`.
- Produces `initializeCampaign(seed: string): CampaignState`.
- Produces named stream contract: `dungeon`, `party`, `reserve`, `carriedGold`, `board`, `map`, `card`, `trust`, `event`, `boss`, `regroup`. Modify `RngStream` in `lib/rng/index.ts` to include exactly these names so every derive call is type-checked.
- Produces `INITIAL_CAMPAIGN_RESOURCES = { currentReputation: 0, currentGold: 10, cumulativeGold: 0, rank: "C" }`.
- Produces initial counts `6/4/3/2`, 15 complete parties, 6 reserves, unique job per party, seeded carried gold 10–30, and seeded HP/trust.

- [ ] **Step 1: 초기화 불변식을 고정하는 실패 테스트를 작성한다.**

```ts
it("같은 seed는 15개 던전·15팀·6예비를 같은 순서로 생성한다", () => {
  const first = initializeCampaign("campaign-001");
  const second = initializeCampaign("campaign-001");
  expect(second).toEqual(first);
  expect(first.dungeons).toHaveLength(15);
  expect(first.parties.filter((party) => party.complete)).toHaveLength(15);
  expect(first.reserveMemberIds).toHaveLength(6);
});

it("초기 캠페인 자원과 인물 골드 범위를 고정한다", () => {
  const state = initializeCampaign("campaign-002");
  expect([state.currentReputation, state.currentGold, state.cumulativeGold]).toEqual([0, 10, 0]);
  expect(state.members.every((member) => member.carriedGold >= 10 && member.carriedGold <= 30)).toBe(true);
});
```

- [ ] **Step 2: 테스트를 실행해 factory가 없어 실패하는지 확인한다.**

Run: `pnpm test lib/rules/campaign-init.test.ts`

Expected: `initializeCampaign` export가 없어 초기화 불변식 테스트가 실패한다.

- [ ] **Step 3: 콘텐츠와 factory를 구현한다.**

던전은 `dungeon-001`부터 `dungeon-015`까지 고정 ID와 시드 정렬 키를 갖는다. 파티와 예비 인원은 직업·성격을 풀에서 중복 없이 뽑고, 인물마다 `maxHp`와 `currentHp`를 같은 초기값으로 넣는다. 시작 골드 10은 `cumulativeGold`에 더하지 않는다. RNG는 모듈 안에서 새로 만들지 않고 이름 있는 stream을 인자로 파생한다.

- [ ] **Step 4: 초기화 테스트와 10개 시드 재현 테스트를 통과시킨다.**

Run: `pnpm test lib/rules/campaign-init.test.ts lib/rng/index.test.ts && pnpm typecheck`

Expected: 같은 seed 결과가 deep equal이고 다른 seed는 적어도 던전 또는 파티 조합이 달라진다.

- [ ] **Step 5: 커밋한다.**

```bash
git add lib/content lib/rules/campaign-init.ts lib/rules/campaign-init.test.ts lib/rng lib/flow/initial-run.ts
git commit -m "캠페인: 15개 던전 초기화와 콘텐츠 풀을 추가한다" -m "결정적 난수 스트림으로 던전·파티·예비 인원·초기 자원을 생성한다."
```

### Task 3: 게시판 생성과 지원 자격

**Files:**
- Create: `lib/rules/board.ts`, `lib/rules/board.test.ts`
- Modify: `lib/domain/campaign.ts` to include the `lockReason` and board result fields required by the board rule.

**Interfaces:**
- Consumes `CampaignState`의 남은 던전, 완성 파티, 현재 명성, campaign `board` stream.
- Produces `generateBoard(state: CampaignState): BoardOffer[]`.
- Produces `canAcceptOffer(state, offer): { accepted: true } | { accepted: false; reason: "insufficientReputation" }`.
- Produces `createBoardEnding(state): "supportUnavailable" | "partyExhausted" | null`.
- Step 1 test helpers are local to `board.test.ts`: `stateWithAllDungeonsAndThreeParties()` and `stateWithReputation(reputation)` call the fresh fixture factory and replace only the stated fields.

- [ ] **Step 1: 정렬·최대 5개·잠금·파티 축소 테스트를 작성한다.**

```ts
it("남은 던전을 C부터 같은 등급의 seed 순서로 최대 5개 제시한다", () => {
  const board = generateBoard(stateWithAllDungeonsAndThreeParties());
  expect(board).toHaveLength(3);
  expect(board.map((offer) => offer.dungeonId)).toEqual([
    "dungeon-001", "dungeon-002", "dungeon-003",
  ]);
});

it("명성 부족 공고는 보이지만 잠기고, 공고가 모두 잠기면 지원 불가가 된다", () => {
  const state = stateWithReputation(0);
  const board = generateBoard(state);
  expect(board.some((offer) => offer.locked)).toBe(true);
  expect(createBoardEnding({ ...state, board })).toBe("supportUnavailable");
});
```

- [ ] **Step 2: 게시판 테스트를 실행해 실패를 확인한다.**

Run: `pnpm test lib/rules/board.test.ts`

Expected: board rule 함수가 없어 실패한다.

- [ ] **Step 3: 게시판 규칙을 구현한다.**

남은 던전을 등급과 `sortOrder`로 정렬하고 완성 파티와 중복 없이 짝짓는다. 최대 5개이되 완성 파티가 1~4팀이면 그 수만 생성한다. 지원 최소 명성은 보드에 보존하고, 현재 명성이 부족한 공고도 삭제하지 않는다. 보드가 0개면 `partyExhausted`, 1개 이상이면서 모두 잠기면 `supportUnavailable`을 반환한다.

- [ ] **Step 4: 다양한 파티 수와 재현성 테스트를 통과시킨다.**

Run: `pnpm test lib/rules/board.test.ts`

Expected: 1·2·3·4팀 보드가 각각 그 수만큼 생성되고 동일 state에서 결과가 변하지 않는다.

- [ ] **Step 5: 커밋한다.**

```bash
git add lib/rules/board.ts lib/rules/board.test.ts lib/domain/campaign.ts
git commit -m "캠페인: 명성 잠금 게시판을 구현한다" -m "남은 던전 정렬과 완성 파티 연결, 지원 불가·파티 소진 조건을 추가한다."
```

### Task 4: 지속 파티·충원·자동 재편·5% 회복

**Files:**
- Create: `lib/rules/party-lifecycle.ts`, `lib/rules/party-lifecycle.test.ts`
- Modify: `lib/rules/party.ts`, `lib/domain/campaign.ts`

**Interfaces:**
- Consumes a settlement survivor/death result and `CampaignState`.
- Produces `maintainPartiesAfterExpedition(state, result, rng): CampaignState`.
- Produces `regroupSurvivors(memberIds, availableMembers, rng): CampaignParty[]`.
- Produces `healNonParticipants(members, participantIds): CampaignMember[]`.
- Step 1 test helpers are local to `party-lifecycle.test.ts`: `clearWithTwoSurvivors`, `memberWithHp`, and `uniqueClassIds` are concrete fixture builders/assertion helpers, not production exports.

- [ ] **Step 1: 생존 3명 유지, 1~2명 충원, 재편 우선순위, 회복 수식을 테스트한다.**

```ts
it("3명 생존 팀은 유지하고 1~2명 생존 팀은 중복 직업 없는 예비로 채운다", () => {
  const next = maintainPartiesAfterExpedition(state, clearWithTwoSurvivors, rng);
  expect(next.parties.find((party) => party.id === "party-001")?.memberIds).toHaveLength(3);
  expect(uniqueClassIds(next, "party-001")).toBe(true);
});

it("비출전 생존자는 현재 HP의 5%를 반올림하고 최소 1만큼 회복한다", () => {
  const members = healNonParticipants([memberWithHp(19, 100), memberWithHp(1, 100)], new Set());
  expect(members.map((member) => member.currentHp)).toEqual([20, 2]);
});
```

- [ ] **Step 2: 실패를 확인한다.**

Run: `pnpm test lib/rules/party-lifecycle.test.ts`

Expected: lifecycle 함수가 없어 실패한다.

- [ ] **Step 3: 파티 lifecycle을 구현한다.**

충원은 예비 인원 중 직업 중복이 없는 조합을 먼저 사용한다. 불가능하면 완성 파티 수 최대화, 기존 동료 쌍 최대화, `regroup` stream 순으로 자동 재편한다. 참여한 생존자는 해당 정산에서 회복 대상에서 제외하고, 게시판에 등장하지 않은 생존자와 불완성 대기 생존자도 회복한다. 인물의 HP·신뢰·골드·기억은 파티 ID가 아니라 인물 ID에 귀속한다.

- [ ] **Step 4: 재편 동률·최대 HP·전원 대기 테스트를 통과시킨다.**

Run: `pnpm test lib/rules/party-lifecycle.test.ts lib/rules/party.test.ts`

Expected: 직업 충돌을 만들지 않고 최대 완성 파티를 만들며, 회복이 maxHp를 넘지 않는다.

- [ ] **Step 5: 커밋한다.**

```bash
git add lib/rules/party.ts lib/rules/party-lifecycle.ts lib/rules/party-lifecycle.test.ts lib/domain/campaign.ts
git commit -m "파티: 지속 생존자와 자동 재편을 구현한다" -m "예비 충원, 재편 우선순위, 비출전 5퍼센트 회복을 추가한다."
```

### Task 5: 등급별 대칭 지도와 정보 기회 생성

**Files:**
- Create: `lib/rules/map.ts`, `lib/rules/map.test.ts`
- Modify: `lib/domain/dungeon.ts`, `lib/domain/expedition.ts`, `lib/content/events.ts`, `lib/rules/dungeon.ts`

**Interfaces:**
- Consumes `Grade`, event/card pools, and a grade-specific map RNG.
- Produces `generateGradeMap(grade: Grade, rng: Rng): GeneratedMap`.
- Produces `validateGeneratedMap(map: GeneratedMap): void`.

- [ ] **Step 1: 네 등급의 node 수와 모든 경로 수를 검증하는 테스트를 작성한다.**

```ts
it.each([
  ["C", 7, 4, 2], ["B", 9, 5, 3], ["A", 11, 6, 4], ["S", 13, 7, 5],
] as const)("%s급 지도는 전체·일반 사건·정보 횟수를 만족한다", (grade, total, regular, info) => {
  const map = generateGradeMap(grade, createRng(`map-${grade}`).derive("map"));
  expect(map.nodes).toHaveLength(total);
  expect(map.paths.every((path) => path.regularEventCount === regular)).toBe(true);
  expect(map.paths.every((path) => path.infoCount === info)).toBe(true);
});
```

- [ ] **Step 2: 불변식 테스트를 실행해 기존 임의 shape가 실패하는지 확인한다.**

Run: `pnpm test lib/rules/map.test.ts`

Expected: grade map generator 또는 새 경로 카운트 필드가 없어 실패한다.

- [ ] **Step 3: 대칭 비순환 그래프와 카드 위치를 구현한다.**

입구·양쪽 갈래·합류·보스 노드를 생성하고 갈래 길이를 C 2, B 3, A 4, S 5로 고정한다. 실제 어느 갈래를 따라가도 일반 사건과 정보 횟수가 같도록 정보 위치를 대칭으로 표시한다. 모든 경로에는 몬스터·휴식·상인·특수 사건을 한 번씩 배치하고, 보스 관련 카드 보장 수를 grade metadata로 검증한다. 콘텐츠가 부족하거나 중복이면 `RuleError(INVALID_GENERATION)`을 던진다.

- [ ] **Step 4: 10,000개 map seed 불변식과 실패 오류를 통과시킨다.**

Run: `pnpm test lib/rules/map.test.ts lib/rules/dungeon.test.ts`

Expected: 10,000개 시드에서 경로 단절·순환·카드 횟수 부족이 0건이고, 의도적으로 부족한 pool은 구조화된 오류를 반환한다.

- [ ] **Step 5: 커밋한다.**

```bash
git add lib/rules/map.ts lib/rules/map.test.ts lib/rules/dungeon.ts lib/domain/dungeon.ts lib/domain/expedition.ts lib/content/dungeons.ts lib/content/events.ts lib/content/info-cards.ts
git commit -m "탐험: 등급별 대칭 지도와 정보 기회를 생성한다" -m "C·B·A·S 경로 길이와 실제 경로별 정보 횟수 불변식을 고정한다."
```

### Task 6: 용사 대상 정보 카드와 사건 행동

**Files:**
- Modify: `lib/rules/info.ts`, `lib/rules/info.test.ts`, `lib/domain/info.ts`
- Create: `lib/rules/event.ts`, `lib/rules/event.test.ts`
- Modify: `lib/content/events.ts`, `lib/content/items.ts`, `lib/domain/expedition.ts`

**Interfaces:**
- Consumes `InfoCard`, living `CampaignMember[]`, `card`·`trust` RNG streams, and event choices.
- Produces `evaluatePartyInfoCard({ card, party, cardRng, trustRng }): PartyInfoCardEvaluation` with only `accepted | suspected | exposed` member results.
- Produces `applyInfoRecord(expedition, record): ExpeditionState`.
- Produces `resolveEventChoice({ expedition, event, choiceId, state, rng }): EventResolution`.
- Produces `InfoRecord { cardId, subject, memberId, reaction, modifier, pendingVerification }`.
- Step 1 test helpers are local to `info.test.ts` and `event.test.ts`: `bossTruthCard`, `party`, `cardRng`, `trustRng`, `acceptedBossTruthRecord`, `event`, `choiceId`, and `state` are constructed from the content fixtures and never exported from production code.

- [ ] **Step 1: 보스 수신자 제거와 개인 반응·별도 사건 행동 테스트를 작성한다.**

```ts
it("보스 수신자 없이 살아 있는 각 파티원에게만 독립 반응을 만든다", () => {
  const result = evaluatePartyInfoCard({ card: bossTruthCard, party, cardRng, trustRng });
  expect(result.memberResults).toHaveLength(3);
  expect(result.memberResults.every((entry) => entry.member.alive)).toBe(true);
  expect(result.audience).toBe("party");
});

it("정보 카드 처리 뒤 사건 행동을 별도로 적용한다", () => {
  const afterInfo = applyInfoRecord(expedition, acceptedBossTruthRecord);
  const resolved = resolveEventChoice({ expedition: afterInfo, event, choiceId, state, rng });
  expect(resolved.phase).toBe("map");
  expect(resolved.log).toHaveLength(1);
});
```

- [ ] **Step 2: 테스트를 실행해 기존 boss audience 계약이 실패하는지 확인한다.**

Run: `pnpm test lib/rules/info.test.ts lib/rules/event.test.ts`

Expected: 기존 `BossInfoCardOptions` 사용부와 새 party-only 계약이 맞지 않아 실패한다.

- [ ] **Step 3: 카드 판정과 사건 결과를 구현한다.**

기존 확률표와 성격별 보정을 유지하되 `audience: "boss"` 분기를 삭제한다. 보스 관련 여부는 `InfoSubject`로만 기록한다. 수용한 진실·거짓·중립은 각각 보스 피해 modifier를 기록하고, 의심·적발은 modifier 0으로 기록한다. 사건 행동은 카드 화면을 닫은 후에만 처리하며 지원·방해·아이템·거래·관망을 choice effect 데이터로 적용한다. 잔액을 초과한 거래는 원자적으로 실패한다.

- [ ] **Step 4: 카드 수신·사후 기록·거래 실패 테스트를 통과시킨다.**

Run: `pnpm test lib/rules/info.test.ts lib/rules/event.test.ts lib/rules/trust.test.ts`

Expected: 개인별 신뢰 변화, 미검증 거짓/의심 기록, 아이템·골드 변화와 실패 시 원상태 유지가 모두 통과한다.

- [ ] **Step 5: 커밋한다.**

```bash
git add lib/rules/info.ts lib/rules/info.test.ts lib/rules/event.ts lib/rules/event.test.ts lib/domain/info.ts lib/domain/expedition.ts lib/content/events.ts lib/content/items.ts
git commit -m "탐험: 용사 전용 정보와 사건 행동을 연결한다" -m "개인별 카드 반응을 유지하고 정보 기회 뒤 별도 사건 행동을 처리한다."
```

### Task 7: 자동 보스전·정산·승급·엔딩

**Files:**
- Create: `lib/rules/boss.ts`, `lib/rules/boss.test.ts`
- Create: `lib/rules/settlement.ts`, `lib/rules/settlement.test.ts`
- Create: `lib/rules/promotion.ts`, `lib/rules/promotion.test.ts`
- Create: `lib/rules/ending.ts`, `lib/rules/ending.test.ts`
- Modify: `lib/domain/campaign.ts`, `lib/domain/expedition.ts`

**Interfaces:**
- Produces `resolveBossFight(input): BossResolution` with per-member damage, final HP, survivors, verified claims, and `clear | wipe`.
- Produces `calculatePromotionScore(currentReputation, cumulativeGold): number` and `promote(rank, score): Grade`.
- Produces `settleExpedition(state, expedition, bossResolution): SettlementResult`.
- Produces `Ending = { id: "execution" | "expeditionComplete" | "supportUnavailable" | "partyExhausted", label: string, reason: string }` and `resolveEnding(state): Ending | null` with that exact priority.
- Step 1 test helpers are local to the four rule test files: `inputWithTruthNeutralAndLieClaims`, `stateWithAllDungeonsClearedAndZeroTrustSurvivors`, and the survivor-count settlement fixtures are created from `createFixtureCampaignState` and explicitly override only the tested values.

- [ ] **Step 1: 수치와 우선순위를 고정하는 실패 테스트를 작성한다.**

```ts
it("보스 정보 보정은 개인별 합산 후 -30%~+50%로 제한한다", () => {
  const result = resolveBossFight(inputWithTruthNeutralAndLieClaims);
  expect(result.members[0].damageModifier).toBe(-0.3);
  expect(result.members[1].damageModifier).toBe(0.5);
});

it("승급 점수는 현재 명성 2배와 누적 골드를 합산하고 강등하지 않는다", () => {
  expect(calculatePromotionScore(66, 142)).toBe(274);
  expect(promote("B", 100)).toBe("B");
  expect(promote("B", 400)).toBe("S");
});

it("처형은 원정 종료보다 먼저 판정한다", () => {
  const state = stateWithAllDungeonsClearedAndZeroTrustSurvivors();
  expect(resolveEnding(state)?.id).toBe("execution");
});
```

- [ ] **Step 2: 규칙 테스트를 실행해 구현 전 실패를 확인한다.**

Run: `pnpm test lib/rules/boss.test.ts lib/rules/settlement.test.ts lib/rules/promotion.test.ts lib/rules/ending.test.ts`

Expected: 보스·정산·승급·엔딩 모듈이 없어 실패한다.

- [ ] **Step 3: 보스와 정산 계산을 구현한다.**

보스 입력은 현재 HP, 사건 효과, 아이템 효과, 보스 주제 카드의 개인별 modifier, 미검증 기록이다. 거짓과 의심은 보스 처리 뒤 `deceptionExposed`, `suspicionWasCorrect`, `suspicionWasCostly` 중 하나로 검증한다. 클리어 보상은 생존 3/2/1명에 100/60/30%를 적용하고 버림한다. 전멸은 기본 명성만큼 잃고 사망자 소지 골드를 현재·누적 골드에 더하며 던전 등급을 올린다.

- [ ] **Step 4: 승급 기준 시나리오와 네 엔딩을 구현한다.**

정산 순서는 보상·손실 → 던전 제거/상승 → 점수·영구 등급 → 파티 lifecycle → 비출전 회복 → 엔딩이다. 점수 120/274/370에서 가장 높은 등급으로 즉시 승급하고, 현재 점수가 내려가도 `rank`를 낮추지 않는다. 엔딩은 실행 생존자 전원 신뢰 0, 모든 던전 클리어, 보드 전체 명성 잠금, 완성 파티 0 순으로 판정한다.

- [ ] **Step 5: 모든 정산 수치 테스트를 통과시킨다.**

Run: `pnpm test lib/rules/boss.test.ts lib/rules/settlement.test.ts lib/rules/promotion.test.ts lib/rules/ending.test.ts`

Expected: C 3개 전원 생존 후 120점, B 2개 전원 생존과 새 C 1개 2명 생존 후 274점, S 1개 2명 생존 후 370점, A 2개 경로 400점이 정확히 재현된다.

- [ ] **Step 6: 커밋한다.**

```bash
git add lib/rules/boss.ts lib/rules/boss.test.ts lib/rules/settlement.ts lib/rules/settlement.test.ts lib/rules/promotion.ts lib/rules/promotion.test.ts lib/rules/ending.ts lib/rules/ending.test.ts lib/domain/campaign.ts lib/domain/expedition.ts
git commit -m "정산: 보스 결과와 명성·골드 승급을 구현한다" -m "생존 보상, 전멸 유품, 승급 점수, 엔딩 우선순위를 연결한다."
```

### Task 8: 캠페인 상태 머신과 Zustand 저장소

**Files:**
- Create: `lib/flow/campaign-machine.ts`, `lib/flow/campaign-machine.test.ts`
- Create: `lib/stores/campaign-store.ts`, `lib/stores/campaign-store.test.ts`
- Modify: `lib/stores/game-store-provider.tsx`, `lib/flow/initial-run.ts`
- Modify: `lib/domain/run.ts` for the adapter boundary during migration

**Interfaces:**
- Produces `CampaignAction` union: `openBoard`, `acceptContract`, `selectNode`, `chooseInfoCard`, `chooseEvent`, `resolveBoss`, `applySettlement`.
- Produces `CampaignMachineContext` containing immutable content pools and named RNG streams.
- Produces `transitionCampaign(state, action, context): CampaignState`.
- Produces `createCampaignStore(initialState): CampaignStoreApi` with `campaign`, `replaceCampaign`, `startCampaign`, `resetCampaign`.
- `CampaignAction` payloads are exact: `{ type: "acceptContract"; offerId: BoardOfferId }`, `{ type: "selectNode"; nodeId: NodeId }`, `{ type: "chooseInfoCard"; cardId: CardId }`, `{ type: "chooseEvent"; choiceId: ChoiceId }`; `openBoard`, `resolveBoss`, and `applySettlement` carry no payload.
- Step 1 test helpers are local to `campaign-machine.test.ts`: `boardState`, `offerId`, `context`, and `snapshotBeforeCall` are fresh fixtures created before each test.

- [ ] **Step 1: 허용 전이·금지 전이·원자성 테스트를 작성한다.**

```ts
it("board → contract → map → optional info → event → boss → settlement 순서를 강제한다", () => {
  const afterContract = transitionCampaign(boardState, { type: "acceptContract", offerId }, context);
  expect(afterContract.phase).toBe("map");
});

it("잘못된 단계와 중복 정산은 상태를 바꾸지 않고 구조화 오류를 던진다", () => {
  expect(() => transitionCampaign(boardState, { type: "resolveBoss" }, context)).toThrow(RuleError);
  expect(boardState).toEqual(snapshotBeforeCall);
});
```

- [ ] **Step 2: 전이 테스트를 실행해 새 상태 머신 부재를 확인한다.**

Run: `pnpm test lib/flow/campaign-machine.test.ts lib/stores/campaign-store.test.ts`

Expected: 새 action·transition·store가 없어 실패한다.

- [ ] **Step 3: 전이 함수와 store를 구현한다.**

각 action은 현재 `phase`와 입력 ID를 검증한 뒤 새 불변 state를 반환한다. `selectNode`는 현재 노드의 다음 노드만 허용하고, `chooseInfoCard` 뒤에는 자동으로 event 단계로 가지 않고 카드 결과를 ExpeditionState에 남긴다. `resolveBoss`는 보스 결과를 만들고 settlement로 이동한다. `applySettlement`는 `settleExpedition`을 호출한 뒤 board 또는 ended로 이동한다.

- [ ] **Step 4: 기존 `RunState` 소비자를 새 store adapter로 옮긴다.**

`app/play/play-run-provider.tsx`는 `createCampaignStore(initializeCampaign(seed))`를 공급하고, 개발용 state-preview는 기존 fixture를 유지하되 새 캠페인 타입을 import하지 않도록 명시한다. 전이 중 발생한 `RuleError`는 삼키지 않고 테스트와 개발 화면에서 확인한다.

- [ ] **Step 5: 상태 머신·스토어·기존 회귀 테스트를 통과시킨다.**

Run: `pnpm test lib/flow/campaign-machine.test.ts lib/stores/campaign-store.test.ts lib/flow lib/stores app/state-preview`

Expected: 새 캠페인 전이와 기존 UI store 동작이 모두 통과하고, 실패한 action 뒤 state reference가 바뀌지 않는다.

- [ ] **Step 6: 커밋한다.**

```bash
git add lib/flow lib/stores lib/domain/run.ts app/play/play-run-provider.tsx
git commit -m "흐름: 캠페인 상태 머신과 저장소를 연결한다" -m "게시판부터 정산·엔딩까지의 유효 전이와 원자적 오류 처리를 추가한다."
```

### Task 9: 게시판부터 엔딩까지 화면 통합

**Files:**
- Create: `components/game/CampaignHeader.tsx`, `Board.tsx`, `ContractPanel.tsx`, `InfoOpportunity.tsx`, `SettlementTimeline.tsx`, `EndingPanel.tsx`
- Create: `components/game/campaign-view-model.ts`, `components/game/campaign-view-model.test.ts`
- Modify: `components/game/ResourceBar.tsx`, `PartySidebar.tsx`, `DungeonMap.tsx`, `ChoiceList.tsx`, `SceneStage.tsx`, `ResultSummary.tsx`
- Modify: `app/play/page.tsx`, `app/play/map/page.tsx`, `app/play/encounter/page.tsx`, `app/play/result/page.tsx`, `app/play/phase-route.ts`, `app/play/play-chrome.tsx`

**Interfaces:**
- Consumes `CampaignState`, `BoardOffer[]`, `ExpeditionState`, and `CampaignAction`.
- Produces accessible controls that dispatch only `CampaignAction` and never mutate domain state directly.
- `CampaignHeader` displays rank, current reputation, current gold, cumulative gold, promotion score, and remaining dungeon count.
- `Board` displays up to five offers, locked reasons, party status, exact carried gold, and required reputation.
- `InfoOpportunity` displays truth/lie/neutral cards and each living member reaction; event action remains a separate screen step.
- `SettlementTimeline` displays survivor/death, trust reason, rewards/loss, dungeon result, promotion, party lifecycle, and ending cause in that order.
- `campaign-view-model.ts` exposes pure `toCampaignHeaderView`, `toBoardOfferView`, and `toSettlementTimelineView` functions so the existing Vitest setup can verify UI data without adding a DOM testing dependency.
- Step 1 test helper `settlementWithInfoAndEventChoice` is a local fixture created from `createFixtureExpeditionState` with one accepted info record and one event choice.

- [ ] **Step 1: 화면 view-model의 action callback과 정보 노출 테스트를 작성한다.**

```ts
it("게시판 view-model은 잠긴 공고의 부족 명성을 숨기지 않는다", () => {
  const view = toBoardOfferView(lockedOffer);
  expect(view.lockedReason).toMatch(/필요 명성/);
  expect(view.canAccept).toBe(false);
});

it("정산 view-model은 카드 선택과 사건 행동을 별도 단계로 설명한다", () => {
  const view = toSettlementTimelineView(settlementWithInfoAndEventChoice);
  expect(view.steps.map((step) => step.kind)).toEqual(["info", "event", "settlement"]);
});
```

- [ ] **Step 2: view-model 테스트를 실행해 새 함수 부재를 확인한다.**

Run: `pnpm test components/game/campaign-view-model.test.ts`

Expected: view-model 함수가 없어 실패한다.

- [ ] **Step 3: 공통 헤더·게시판·계약 화면을 구현한다.**

`PlayChrome`에 `CampaignHeader`를 고정하고, `/play`는 새 용사 파티 소개 대신 게시판을 렌더링한다. 공고는 등급·번호·지원 명성·보상·경로 위험·파티의 HP·신뢰·소지 골드를 보여주며 잠긴 공고도 비교 가능하게 남긴다. 계약 선택 뒤 `partyIntro`는 별도 페이지가 아니라 계약 확인 패널로 처리한다.

- [ ] **Step 4: 지도·정보·사건·보스 화면을 구현한다.**

`DungeonMap`은 전체 경로, 보스 위치, 사건 제목·종류·대략 위험, 정보 기회 위치를 표시한다. 정확한 카드 내용·피해·보상은 도착 뒤 공개한다. `encounter/page.tsx`는 `infoOpportunity`와 `event`를 분리하고, 보스 단계에서는 새 선택지를 제공하지 않는다.

- [ ] **Step 5: 정산·엔딩 화면과 접근성 단서를 구현한다.**

`SettlementTimeline`은 spec의 정산 순서를 그대로 보여주고, `EndingPanel`은 네 엔딩 ID와 판정 원인을 표시한다. 색상만으로 신뢰·생존·잠금 상태를 구분하지 않고 텍스트, 아이콘, `aria` 상태를 함께 제공한다.

- [ ] **Step 6: 브라우저 경로와 화면 회귀를 확인한다.**

Run: `pnpm lint && pnpm typecheck && pnpm build`

Expected: `/play`에서 게시판 → 계약 → 지도 → 정보(있는 경우) → 사건 → 보스 → 정산 → 다음 게시판/엔딩을 새로고침 없이 진행하고, 주소에 같은 `?seed=`를 넣으면 같은 보드와 첫 지도 선택지를 보여준다.

- [ ] **Step 7: 커밋한다.**

```bash
git add components app/play lib/stores/game-store-provider.tsx
git commit -m "화면: 캠페인 게시판부터 엔딩까지 통합한다" -m "상태 머신 결과를 캠페인 HUD와 단계별 접근 가능한 화면으로 표시한다."
```

### Task 10: 10,000시드 백테스트와 기존 구현 정리

**Files:**
- Create: `lib/backtest/campaign-simulator.ts`, `lib/backtest/campaign-simulator.test.ts`
- Create: `lib/backtest/fixtures.ts`
- Modify: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md` to mark completed IDs only after evidence exists
- Modify: `app/state-preview/preview-run.ts`, `preview-run.test.ts`, `state-preview-panel.tsx`, `app/r3-test/r3-test-panel.tsx`, `app/integration-test/integration-test-panel.tsx`, and `lib/dev-tools/test-snapshots.ts` to use CampaignState and party-only information subjects.
- Delete after the reference check in Step 6: `lib/flow/run-machine.ts`, `lib/flow/path.ts`, `lib/stores/run-store.ts`, `lib/stores/run-store.test.ts`, `lib/domain/run.ts`, and `lib/mock/run.ts`. Boss-audience test helpers are removed in Task 6, not this cleanup task.

**Interfaces:**
- Produces `simulateCampaign(seed, strategy): SimulationReport`.
- Produces `runBacktest(seedCount = 10_000): BacktestReport` with generation errors, invalid states, ending distribution, promotion timing, HP/trust and resource distributions.
- Produces `simulateFixture(name: "baseline"): SimulationReport` for the exact promotion checkpoint test.
- Strategies are exactly `survivalFirst`, `balanced`, `wipeGoldFirst`; each strategy must use public actions and cannot mutate state directly.

- [ ] **Step 1: 기준 시나리오와 생성 오류 0건 테스트를 작성한다.**

```ts
it("기준 승급 시나리오의 점수 checkpoint를 정확히 재현한다", () => {
  const report = simulateFixture("baseline");
  expect(report.checkpoints).toMatchObject({
    B: { reputation: 30, cumulativeGold: 60, score: 120 },
    A: { reputation: 66, cumulativeGold: 142, score: 274 },
    S: { reputation: 90, cumulativeGold: 190, score: 370 },
  });
});

it("10,000개 시드에서 생성 불능·즉시 진행 불가가 0건이다", () => {
  const report = runBacktest(10_000);
  expect(report.generationErrors).toHaveLength(0);
  expect(report.unplayableSeeds).toHaveLength(0);
});
```

- [ ] **Step 2: 백테스트 테스트를 실행해 simulator 부재를 확인한다.**

Run: `pnpm test lib/backtest/campaign-simulator.test.ts`

Expected: simulator와 fixture가 없어 실패한다.

- [ ] **Step 3: 공개 규칙만 사용하는 세 전략 simulator를 구현한다.**

각 시드는 `initializeCampaign`으로 시작하고 게시판에서 허용 공고를 고른다. 생존 우선은 예상 사망 위험이 가장 낮은 공고·행동을, 균형은 명성·골드 기대값이 높은 공고를, 전멸 골드 우선은 파티 소지 골드가 높은 위험 선택을 고른다. 전략은 내부 state를 직접 수정하지 않고 `transitionCampaign` action만 호출한다.

- [ ] **Step 4: 생성 불변식과 재현성 보고서를 만든다.**

각 시드에서 초기 수량, 직업 중복, 지도 경로, 정보 횟수, 보스 카드 보장, 상태 전이, 같은 seed 재실행 결과를 검사한다. 보고서에는 최초 B/A/S 시점·도달률, 네 엔딩 비율, 평균 HP·신뢰, 현재·누적 골드, 던전 실패·등급 상승·보스 사망률을 기록한다. 전략별 목표 비율은 합격 조건이 아니라 후속 밸런스 조정 자료로 남긴다.

- [ ] **Step 5: 전체 검증과 문서 작업 배정 상태를 갱신한다.**

Run: `pnpm test && pnpm lint && pnpm typecheck && pnpm build`

Expected: 전체 테스트 통과, 생성 오류 0건, 백테스트 보고서 생성. `PROTOTYPE_WORK_ASSIGNMENT.md`의 F1부터 Q2 상태는 실제 완료 증거가 있는 행만 `✅`로 바꾼다.

- [ ] **Step 6: 사용하지 않는 단일 런 코드와 보스 수신자 분기를 정리하고 회귀 검증한다.**

Run: `rg -n "RunState|BossInfoCardOptions|audience.*boss|보스에게.*정보" lib app components`

Expected: 남은 결과는 의도적인 역사 문서·adapter 설명뿐이다. 제품 실행 경로와 테스트에는 단일 런 상태 또는 보스 수신자 분기가 남지 않는다.

- [ ] **Step 7: 최종 커밋한다.**

```bash
git add lib/backtest docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md lib app components
git commit -m "검증: 15개 던전 캠페인 백테스트를 추가한다" -m "세 전략과 10000개 시드 불변식 보고서를 연결하고 단일 런 잔여 코드를 정리한다."
```

---

## 완료 검증 체크리스트

- [ ] `CampaignState`와 `ExpeditionState`가 분리되고 모든 화면 전이는 `transitionCampaign`을 통한다.
- [ ] 15개 던전, 15개 완성 파티, 예비 6명, 시작 골드 10, 인물 소지 골드 10~30이 같은 seed로 재현된다.
- [ ] 게시판은 C→B→A→S, 같은 등급 seed 순서, 최대 5개, 1~4팀 축소, 명성 잠금·엔딩을 지킨다.
- [ ] 클리어·전멸 정산과 파티 충원·자동 재편·비출전 5% 회복이 인물 상태를 보존한다.
- [ ] 등급별 모든 실제 경로가 지도 길이·사건 종류·정보 횟수·보스 카드 보장을 만족한다.
- [ ] 카드 수신자는 용사 파티뿐이고, 사건 행동은 정보 카드 선택과 분리된다.
- [ ] 보스 피해 보정·검증, 승급 checkpoint, 무강등, 네 엔딩 우선순위가 테스트된다.
- [ ] 잘못된 ID·잔액 초과·잘못된 단계·중복 정산은 구조화 오류를 반환하고 상태를 변경하지 않는다.
- [ ] 10,000개 시드에서 생성 오류와 즉시 진행 불가가 0건이다.
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`가 모두 통과한다.

## 실행 시 검토 지점

각 Task의 커밋 뒤 다음 Task로 넘어가기 전에 해당 테스트와 `git diff --check`를 실행한다. Task 5의 지도 불변식, Task 7의 승급 checkpoint, Task 9의 전체 화면 전이는 별도 리뷰 지점으로 둔다. 백테스트에서 수치가 목표와 다르면 코드를 임의로 맞추지 말고 보고서를 먼저 남긴 뒤 공식 밸런스 상수 변경을 별도 커밋으로 수행한다.
