# F1·F2·C1 통합 검증 하네스 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이전 R1~R4 통합 화면을 제거하고 `/integration-test`를 F1·F2·C1만 확인하는 seed 기반 웹 검증 하네스로 교체한다.

**Architecture:** 기존 `/f1-test`와 `/f2-test`의 검증 계약을 재사용하고 C1의 `initializeCampaign(seed)`를 같은 snapshot에 연결한다. `/integration-test` 전용 snapshot과 패널은 새 F1·F2·C1 구조로 만들며, R3 단독 화면이 사용하는 `createR3HarnessResult`와 기존 규칙 파일은 유지한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Vitest 4, Tailwind CSS, 기존 `createF2TestSnapshot`·`initializeCampaign` 계약. 새 의존성은 추가하지 않는다.

## Global Constraints

- `/integration-test`에는 F1·F2·C1 섹션만 렌더링하고 이전 R1·R2·R3·R4·F2 `RunState` 섹션은 제거한다.
- `app/f1-test`, `app/f2-test`, `app/r3-test`, R1~R4 규칙과 C1 순수 규칙은 변경하지 않는다.
- F1·F2·C1 결과는 입력 seed 하나로 재현되어야 하며 UI에서 `Math.random()`을 사용하지 않는다.
- C1 패널은 `initializeCampaign(seed)`가 materialize한 초기 board를 표시하고 `generateBoard`를 다시 호출하지 않는다.
- 기존 `createR3HarnessResult`와 `/r3-test` 단독 검증을 보존한다.
- 테스트를 먼저 작성하고 실패를 확인한 뒤 최소 구현을 추가한다.
- 모든 커밋 메시지는 제목과 본문을 포함한 한글로 작성한다.
- 구현 전후 저장소의 `pnpm` 스크립트와 `git diff --check`를 사용한다.

## File Map

| 파일 | 책임 | 변경 |
| --- | --- | --- |
| `app/integration-test/integration-test-snapshot.ts` | F1·F2·C1 표시용 순수 snapshot factory | 생성 |
| `app/integration-test/integration-test-snapshot.test.ts` | 통합 snapshot의 수량·재현성·잠금 테스트 | 생성 |
| `app/integration-test/integration-test-panel.tsx` | F1·F2·C1 세 섹션과 seed 입력 UI | 교체 |
| `lib/dev-tools/test-snapshots.ts` | R3 단독 helper만 유지하도록 이전 integration helper 제거 | 수정 |
| `lib/dev-tools/test-snapshots.test.ts` | R3 단독 회귀만 유지하고 이전 통합 테스트 제거 | 수정 |
| `docs/README.md` | 승인된 integration spec·plan 링크 | 확인/필요 시 수정 |

---

### Task 1: F1·F2·C1 통합 snapshot 계약과 실패 테스트

**Files:**
- Create: `app/integration-test/integration-test-snapshot.ts`
- Test: `app/integration-test/integration-test-snapshot.test.ts`

**Interfaces:**
- Consumes: `createF2TestSnapshot(seed)`, `F2Snapshot`, `initializeCampaign(seed)`, `GRADES`, `Grade`, `CampaignState`.
- Produces: `CampaignIntegrationSnapshot`, `IntegrationSnapshot`, `createIntegrationSnapshot(seed: string): IntegrationSnapshot`.
- Does not consume: 이전 `createIntegrationSnapshot(options)`의 R1~R4/R2/R3 입력 계약.

- [ ] **Step 1: F1·F2·C1 snapshot 실패 테스트를 작성한다.**

`integration-test-snapshot.test.ts`에 실제 완료 기준을 고정한다.

```ts
import { describe, expect, it } from "vitest";
import { createIntegrationSnapshot } from "./integration-test-snapshot";

describe("F1·F2·C1 통합 snapshot", () => {
  it("같은 seed로 세 트랙 결과를 재현한다", () => {
    const first = createIntegrationSnapshot("integration-seed");
    const second = createIntegrationSnapshot("integration-seed");

    expect(second).toEqual(first);
    expect(first.f1.campaign.phase).toBe("board");
    expect(first.f2.contentStatus).toBe("pass");
    expect(first.c1.phase).toBe("board");
    expect(first.c1.reproducible).toBe(true);
  });

  it("F1·F2·C1 핵심 수량과 C1 잠금을 표시한다", () => {
    const snapshot = createIntegrationSnapshot("integration-counts");

    expect(snapshot.f1.campaign.dungeonCount).toBeGreaterThan(0);
    expect(snapshot.f2.events.total).toBe(12);
    expect(snapshot.f2.cards.total).toBe(12);
    expect(snapshot.c1).toMatchObject({
      phase: "board",
      rank: "C",
      currentReputation: 0,
      currentGold: 10,
      dungeonCount: 15,
      partyCount: 15,
      completePartyCount: 15,
      memberCount: 51,
      reserveMemberCount: 6,
    });
    expect(snapshot.c1.dungeonCounts).toEqual({ C: 6, B: 4, A: 3, S: 2 });
    expect(snapshot.c1.board).toHaveLength(5);
    expect(snapshot.c1.board.some((offer) => offer.locked)).toBe(true);
  });

  it("다른 seed는 C1 결과를 바꾼다", () => {
    const first = createIntegrationSnapshot("integration-a");
    const second = createIntegrationSnapshot("integration-b");

    expect(second.c1).not.toEqual(first.c1);
  });
});
```

- [ ] **Step 2: 테스트를 실행해 snapshot factory 부재 실패를 확인한다.**

Run: `pnpm test app/integration-test/integration-test-snapshot.test.ts`

Expected: `integration-test-snapshot.ts`가 없어서 import 실패가 발생한다.
이 단계에서 기존 F1/F2/C1 규칙 테스트까지 실행하지 않고 새 계약의 RED만 확인한다.

- [ ] **Step 3: 표시용 타입과 순수 snapshot factory를 최소 구현한다.**

`CampaignIntegrationSnapshot`은 다음 필드를 가진다.

```ts
export interface CampaignIntegrationSnapshot {
  seed: string;
  phase: string;
  rank: string;
  currentReputation: number;
  currentGold: number;
  cumulativeGold: number;
  dungeonCounts: Record<Grade, number>;
  dungeonCount: number;
  partyCount: number;
  completePartyCount: number;
  memberCount: number;
  reserveMemberCount: number;
  board: Array<{
    id: string;
    dungeonId: string;
    dungeonGrade: Grade;
    partyId: string;
    partyMemberNames: string[];
    requiredReputation: number;
    baseReputationReward: number;
    baseGoldReward: number;
    nodeCount: number;
    locked: boolean;
    lockReason: string | null;
  }>;
  reproducible: boolean;
}
```

`createIntegrationSnapshot(seed)`는 `createF2TestSnapshot(seed)`의 `f1`과
F2 검증 필드를 새 객체로 복사하고 `initializeCampaign(seed)`를 호출한다.
C1 요약은 던전 등급을 `GRADES` 순서로 세고, board offer의 파티 ID를
`CampaignState.parties`와 `members`로 연결해 이름을 만든다. 같은 seed로
C1 상태를 다시 생성해 `reproducible`을 계산한다.

- [ ] **Step 4: snapshot 테스트를 통과시키고 타입을 확인한다.**

Run: `pnpm test app/integration-test/integration-test-snapshot.test.ts && pnpm typecheck`

Expected: 새 통합 snapshot 테스트가 통과하고 F1/F2/C1 도메인 타입이 일치한다.

- [ ] **Step 5: snapshot factory를 커밋한다.**

```bash
git add app/integration-test/integration-test-snapshot.ts app/integration-test/integration-test-snapshot.test.ts
git commit -m "통합: F1 F2 C1 snapshot을 연결한다" -m "하나의 seed로 F1 fixture와 F2 콘텐츠 검증, C1 초기 캠페인·게시판 요약을 재현하는 통합 snapshot을 추가한다."
```

---

### Task 2: 이전 통합 전용 R1~R4 helper와 테스트 제거

**Files:**
- Modify: `lib/dev-tools/test-snapshots.ts`
- Modify: `lib/dev-tools/test-snapshots.test.ts`

**Interfaces:**
- Consumes: `createR3HarnessResult`, `/r3-test` imports.
- Produces: `lib/dev-tools/test-snapshots.ts`에는 R3 단독 계약만 남긴다.
- Removes: `IntegrationSnapshotOptions`, `IntegrationSnapshot`, `createRunState`, `createIntegrationSnapshot`와 이를 검증하는 이전 통합 테스트.

- [ ] **Step 1: 이전 통합 export와 테스트를 제거한다.**

`test-snapshots.ts`에서 `RunState` import, `IntegrationSnapshotOptions`,
`IntegrationSnapshot`, `createRunState`, `createIntegrationSnapshot` 및
R1/R2/R3/R4/F2 통합 계산에만 쓰인 import를 제거한다. `R3HarnessOptions`,
`R3HarnessResult`, `createR3HarnessResult`는 유지한다.

`test-snapshots.test.ts`에서는 `createIntegrationSnapshot` import와 두 개의
이전 통합 테스트를 제거하고 R3 재현성 테스트만 남긴다.

- [ ] **Step 2: 제거 후 R3 단독 회귀를 실행한다.**

Run: `pnpm test lib/dev-tools/test-snapshots.test.ts && pnpm typecheck`

Expected: R3 helper 테스트가 통과하고 `/r3-test`가 더 이상 제거된 export를
참조하지 않는다. 이 단계에서 통합 snapshot 테스트는 Task 1의 새 모듈을 사용한다.

- [ ] **Step 3: 정리 결과를 커밋한다.**

```bash
git add lib/dev-tools/test-snapshots.ts lib/dev-tools/test-snapshots.test.ts
git commit -m "정리: 이전 통합 전용 하네스를 제거한다" -m "R1부터 R4까지의 이전 integration-test 전용 snapshot을 걷어내고 R3 단독 검증 helper는 유지한다."
```

---

### Task 3: `/integration-test`를 F1·F2·C1 세 섹션으로 교체

**Files:**
- Modify: `app/integration-test/integration-test-panel.tsx`
- Test: `app/integration-test/integration-test-snapshot.test.ts`

**Interfaces:**
- Consumes: `createIntegrationSnapshot(seed)`, `IntegrationSnapshot`, `Panel`, existing `/f1-test`, `/f2-test`, `/r3-test` routes.
- Produces: F1·F2·C1 세 섹션만 렌더링하는 `IntegrationTestPanel`.
- Preserves: `app/integration-test/page.tsx` route entrypoint.

- [ ] **Step 1: panel의 새 DOM 계약을 테스트에 추가한다.**

프로젝트에 React DOM 테스트 의존성을 추가하지 않는다. snapshot 테스트에서
표시용 snapshot 필드를 다시 고정하고, panel 구현에서는 다음 `data-testid`와
텍스트 계약을 직접 사용한다.

```text
integration-f1
integration-f2
integration-c1
integration-c1-board
integration-seed
integration-reproducible
```

브라우저 검증에서 세 section 외의 이전 R1/R2/R3/R4 heading이 존재하지 않는지
확인할 수 있게 heading 문구를 고정한다.

- [ ] **Step 2: 기존 client panel을 F1·F2·C1 전용 패널로 교체한다.**

기존 `MOCK_CARDS`, `TRUST_ACTIONS`, `InfoCardEvaluation`, R1 party,
R2 trust, R3 info, R4 dungeon, F2 RunState 렌더링과 선택 입력을 제거한다.
seed 입력과 실행 버튼만 유지하고, 제출 시 `createIntegrationSnapshot(seed)`를
새로 계산한다.

F1 섹션에는 F1 campaign/expedition 요약을, F2 섹션에는 content status,
이벤트·카드·아이템·보스 수량, capacity, negative cases, reproducibility를,
C1 섹션에는 초기 자원·등급별 던전·파티/예비 인원·board offer를 표시한다.

각 board offer는 던전 등급·지점 수·파티원 이름·보상·필요 명성과 함께
잠금 여부를 텍스트로 표시한다. `locked` offer에는
`aria-label="명성 부족으로 잠김"`을 제공하고, 지원 가능한 offer에는
`aria-label="지원 가능"`을 제공한다.

navigation에는 `/f1-test`, `/f2-test`, `/r3-test` 링크를 둔다. 이 패널에서
공고를 클릭하거나 상태를 전이시키는 동작은 추가하지 않는다.

- [ ] **Step 3: 패널에 대한 정적·타입 검사를 실행한다.**

Run: `pnpm typecheck && pnpm lint`

Expected: Next.js client component에서 새 snapshot import와 JSX 타입이 통과하고,
이전 사용하지 않는 import 경고가 없다.

- [ ] **Step 4: panel 교체를 커밋한다.**

```bash
git add app/integration-test/integration-test-panel.tsx
git commit -m "화면: integration-test를 F1 F2 C1 전용으로 교체한다" -m "이전 R1부터 R4까지의 통합 섹션을 제거하고 F1 계약, F2 콘텐츠, C1 초기 게시판을 같은 seed로 확인하는 개발 화면을 제공한다."
```

---

### Task 4: 통합 검증 문서와 브라우저 실행 확인

**Files:**
- Modify: `docs/README.md` only if the revised spec/plan links are missing
- Verify: all changed files and `app/integration-test`

**Interfaces:**
- Consumes: Task 1~3의 snapshot, R3 회귀, F1/F2/C1 규칙.
- Produces: 자동 검증과 실제 dev server 브라우저 확인 결과.
- Does not modify: C1 규칙, F1/F2 단독 화면, R3 단독 화면, C3 동료 작업.

- [ ] **Step 1: 통합 관련 targeted test를 실행한다.**

```bash
pnpm test app/integration-test/integration-test-snapshot.test.ts lib/dev-tools/test-snapshots.test.ts
```

Expected: F1·F2·C1 snapshot과 R3 단독 helper가 모두 통과한다.

- [ ] **Step 2: 전체 자동 검증을 실행한다.**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: 테스트 실패 0건, typecheck/lint/build exit 0, diff check 출력 없음.

- [ ] **Step 3: 개발 서버로 새 통합 화면을 확인한다.**

```bash
pnpm dev
```

브라우저에서 `http://localhost:3000/integration-test`를 열고 다음을 확인한다.

1. F1·F2·C1 섹션만 존재한다.
2. 이전 R1/R2/R3/R4 heading과 F2 `RunState` 섹션이 존재하지 않는다.
3. C1에 C/B/A/S = 6/4/3/2, 파티 15, 예비 6, board 5개가 표시된다.
4. 초기 명성 0에서 B/A/S 공고가 잠기고 C 공고가 지원 가능하다.
5. seed를 바꿔 실행하면 F1·F2·C1 결과가 함께 바뀌며 같은 seed는 재현된다.
6. `/f1-test`, `/f2-test`, `/r3-test` 링크가 동작하고 콘솔 오류가 없다.

- [ ] **Step 4: 문서와 구현을 한글 커밋으로 저장한다.**

```bash
git add docs/README.md docs/superpowers/specs/2026-08-14-sanghwan-yoo-c1-f1-f2-integration-harness-design.md docs/superpowers/plans/2026-08-14-sanghwan-yoo-f1-f2-c1-integration-harness.md
git diff --cached --check
git commit -m "문서: F1 F2 C1 통합 검증을 완료한다" -m "새 integration-test의 F1·F2·C1 구성과 자동·브라우저 검증 결과를 기록한다."
```

## 최종 검증 체크리스트

- [ ] `/integration-test`는 F1·F2·C1만 표시한다.
- [ ] 이전 R1~R4·F2 RunState UI와 integration 전용 helper가 제거되었다.
- [ ] R3 단독 helper와 `/r3-test`는 유지된다.
- [ ] F1 fixture와 F2 콘텐츠 검증 핵심 값이 유지된다.
- [ ] C1 초기 캠페인과 게시판 잠금 상태가 표시된다.
- [ ] 같은 seed 결과가 deep equal이다.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`가 통과한다.
- [ ] `pnpm dev` 브라우저 확인에서 콘솔 오류가 없다.
