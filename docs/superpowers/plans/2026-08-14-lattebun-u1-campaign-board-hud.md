# U1 공고 게시판·캠페인 HUD 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 캠페인 공통 HUD, 공고 게시판, 계약·파티 확인 패널을 순수 view-model 계층과 프리뷰 하네스로 구현해 라이브 스토어 없이 병렬로 완성한다.

**Architecture:** `CampaignState`를 순수 함수(`campaign-view-model.ts`)가 표시용 view로 변환하고, 순수 표시 컴포넌트(`CampaignHeader`·`Board`·`ContractPanel`)가 렌더하며, 동작은 콜백 prop으로 올린다. HUD 승급 점수는 최소 규칙 모듈(`lib/rules/promotion.ts`)이 계산한다. 검증은 프리뷰 라우트(`app/u1-test`)와 Vitest 단위 테스트로 한다.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript 5 strict, Tailwind CSS 4(디자인 토큰 `@theme`), Vitest 4(node 환경), 기존 프리미티브 `Panel`·`StatValue`.

**Spec:** `docs/superpowers/specs/2026-08-14-lattebun-u1-campaign-board-hud-design.md`

## Global Constraints

- 승급 점수 = `현재 명성 × 2 + 누적 획득 골드`. 기준 상수 `PROMOTION_THRESHOLDS = { C: 0, B: 120, A: 274, S: 370 }`.
- 던전·파티는 고유명 대신 등급·번호로 표시한다(예: `C급 1번`, `1팀`). 데이터 계약을 바꾸지 않는다.
- 위험(함정/정보/전투 등) 표시는 U1에서 넣지 않는다. 지도 생성 `E1` 소관이며 완료 기준 밖이다.
- 지도 갈래 수는 상위 spec "두 갈래"에 따라 항상 2로 고정한다. 갈래별 지점 수 계산은 하지 않는다.
- `components/**`는 `@/lib/mock`을 import하지 않는다. 데이터는 `app/u1-test`가 만들어 props로 주입한다.
- `components/ui/**`는 `@/lib/domain`을 import하지 않는다. 새 컴포넌트는 `components/game/**`에 둔다.
- 색으로만 뜻을 전달하지 않는다. 상태·잠금·선택은 `✓`/`×` 기호, 테두리 형태, `aria-*` 속성으로 함께 구분한다.
- 잠긴 공고는 숨기지 않고 상태와 부족 명성을 함께 보여준다.
- 검증 명령 넷 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`를 유지한다.
- 커밋 메시지는 제목과 본문을 모두 한글로 쓴다.
- 브랜치는 `feature/u1-campaign-board-hud`이며 spec 커밋(`7d926e9`)이 이미 올라가 있다. main에 직접 push하지 않는다.

## 파일 구조

| 파일 | 책임 |
| --- | --- |
| `lib/rules/promotion.ts` | 승급 점수·기준 상수·다음 등급(순수) |
| `lib/rules/promotion.test.ts` | promotion 단위 테스트 |
| `components/game/campaign-view-model.ts` | 도메인 상태 → HeaderView/BoardOfferView/ContractView 조인 |
| `components/game/campaign-view-model.test.ts` | view-model 단위 테스트 |
| `components/game/CampaignHeader.tsx` | HUD 헤더(표시 전용) |
| `components/game/Board.tsx` | 공고 목록·계약 버튼(표시 전용) |
| `components/game/ContractPanel.tsx` | 선택 던전·출전 파티(표시 전용) |
| `app/u1-test/u1-fixtures.ts` | 하네스용 CampaignState fixture |
| `app/u1-test/page.tsx` | 프리뷰 하네스 |

**참조 계약(변경 없음):** `lib/domain/campaign.ts`(CampaignState·BoardOffer·Grade), `lib/rules/board.ts`(`generateBoard`·`canAcceptOffer`), `lib/rules/campaign-init.ts`(`initializeCampaign`), `lib/content/classes.ts`(`CLASSES`), `components/game/labels.ts`(`PERSONALITY_LABELS`), `components/ui/Panel.tsx`, `components/ui/StatValue.tsx`.

---

### Task 1: 승급 점수 규칙 모듈

**Files:**
- Create: `lib/rules/promotion.ts`
- Test: `lib/rules/promotion.test.ts`

**Interfaces:**
- Consumes: `Grade` from `@/lib/domain`.
- Produces:
  - `PROMOTION_THRESHOLDS: Readonly<Record<Grade, number>>`
  - `calculatePromotionScore(currentReputation: number, cumulativeGold: number): number`
  - `nextGradeTarget(rank: Grade): { grade: Grade; threshold: number } | null`

- [ ] **Step 1: 실패하는 테스트를 작성한다.**

Create `lib/rules/promotion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  PROMOTION_THRESHOLDS,
  calculatePromotionScore,
  nextGradeTarget,
} from "./promotion";

describe("promotion", () => {
  it("승급 점수는 현재 명성 2배와 누적 골드를 합산한다", () => {
    expect(calculatePromotionScore(66, 142)).toBe(274);
    expect(calculatePromotionScore(0, 0)).toBe(0);
    expect(calculatePromotionScore(38, 60)).toBe(136);
  });

  it("등급 기준 상수는 확정값이다", () => {
    expect(PROMOTION_THRESHOLDS).toEqual({ C: 0, B: 120, A: 274, S: 370 });
  });

  it("다음 등급은 현재 영구 등급 바로 위이며 S면 null이다", () => {
    expect(nextGradeTarget("C")).toEqual({ grade: "B", threshold: 120 });
    expect(nextGradeTarget("B")).toEqual({ grade: "A", threshold: 274 });
    expect(nextGradeTarget("A")).toEqual({ grade: "S", threshold: 370 });
    expect(nextGradeTarget("S")).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다.**

Run: `pnpm test lib/rules/promotion.test.ts`
Expected: FAIL — `./promotion` 모듈이 없어 import 실패.

- [ ] **Step 3: 최소 구현을 작성한다.**

Create `lib/rules/promotion.ts`:

```ts
import type { Grade } from "@/lib/domain";

/** 승급 점수 기준. 상위 spec에서 확정된 값이다. */
export const PROMOTION_THRESHOLDS: Readonly<Record<Grade, number>> = {
  C: 0,
  B: 120,
  A: 274,
  S: 370,
};

const GRADE_ORDER: readonly Grade[] = ["C", "B", "A", "S"];

/** 승급 점수 = 현재 명성 × 2 + 누적 획득 골드. */
export function calculatePromotionScore(
  currentReputation: number,
  cumulativeGold: number,
): number {
  return currentReputation * 2 + cumulativeGold;
}

/**
 * 현재 영구 등급 바로 위 등급과 그 기준을 돌려준다.
 * 강등이 없으므로 등급이 점수보다 앞설 수 있어 등급 기준으로 계산한다.
 * S면 최고 등급이므로 null이다.
 */
export function nextGradeTarget(
  rank: Grade,
): { grade: Grade; threshold: number } | null {
  const next = GRADE_ORDER[GRADE_ORDER.indexOf(rank) + 1];
  if (next === undefined) {
    return null;
  }
  return { grade: next, threshold: PROMOTION_THRESHOLDS[next] };
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다.**

Run: `pnpm test lib/rules/promotion.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: 검사 발동을 확인한다.**

`calculatePromotionScore`의 `* 2`를 잠시 `* 3`으로 바꿔 `pnpm test lib/rules/promotion.test.ts`가 실패하는지 본 뒤 되돌린다. 확인 내용을 커밋 본문에 적는다.

- [ ] **Step 6: 커밋한다.**

```bash
git add lib/rules/promotion.ts lib/rules/promotion.test.ts
git commit -m "규칙: 승급 점수와 다음 등급 기준을 추가한다" -m "현재 명성 2배와 누적 골드를 합산하고 등급 기준 C0/B120/A274/S370으로 다음 등급을 계산한다. 점수식을 일부러 틀리게 바꿔 테스트가 잡는지 확인 후 되돌렸다."
```

---

### Task 2: 캠페인 view-model 조인 계층

**Files:**
- Create: `components/game/campaign-view-model.ts`
- Test: `components/game/campaign-view-model.test.ts`

**Interfaces:**
- Consumes: `CampaignState`, `BoardOfferId`, `BoardLockReason`, `CampaignMember`, `ClassId`, `Grade` from `@/lib/domain`; `canAcceptOffer` from `@/lib/rules/board`; `calculatePromotionScore`, `nextGradeTarget` from `@/lib/rules/promotion`; `CLASSES` from `@/lib/content/classes`; `PERSONALITY_LABELS` from `./labels`.
- Produces the exported view types and functions below. Later tasks (3, 4) consume these exact names:
  - `CampaignHeaderView`, `BoardOfferView`, `ContractMemberView`, `ContractView`
  - `toCampaignHeaderView(state: CampaignState): CampaignHeaderView`
  - `toBoardView(state: CampaignState): BoardOfferView[]`
  - `toContractView(state: CampaignState, offerId: BoardOfferId): ContractView | null`

- [ ] **Step 1: 실패하는 테스트를 작성한다.**

Create `components/game/campaign-view-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createFixtureCampaignState } from "@/lib/rules/fixtures";
import type {
  BoardOfferId,
  CampaignState,
  DungeonId,
  PartyId,
} from "@/lib/domain";
import {
  toBoardView,
  toCampaignHeaderView,
  toContractView,
} from "./campaign-view-model";

// createFixtureCampaignState: 등급 C, 명성 0, 던전 1개(dungeon-001),
// 완성 파티 1개(party-001, member-001~003), 공고 1개(offer-001, 잠금 없음).

function lockedState(): CampaignState {
  const base = createFixtureCampaignState();
  const dungeon = { ...base.dungeons[0], grade: "B" as const, id: "dungeon-007" as DungeonId };
  const offer = {
    ...base.board[0],
    dungeonId: dungeon.id,
    requiredReputation: 30,
    baseReputationReward: 15,
    baseGoldReward: 35,
    nodeCount: 9,
    locked: true,
    lockReason: "insufficientReputation" as const,
  };
  return {
    ...base,
    dungeons: [dungeon],
    board: [offer],
  };
}

describe("toCampaignHeaderView", () => {
  it("점수·다음 등급·남은 던전을 파생한다", () => {
    const base = createFixtureCampaignState();
    const state: CampaignState = {
      ...base,
      rank: "B",
      currentReputation: 38,
      cumulativeGold: 60,
    };
    const view = toCampaignHeaderView(state);
    expect(view.promotionScore).toBe(136);
    expect(view.nextGrade).toEqual({ grade: "A", threshold: 274 });
    expect(view.remainingDungeons).toBe(1);
    expect(view.totalDungeons).toBe(1);
  });

  it("S 등급이면 다음 등급이 null이다", () => {
    const state = { ...createFixtureCampaignState(), rank: "S" as const };
    expect(toCampaignHeaderView(state).nextGrade).toBeNull();
  });
});

describe("toBoardView", () => {
  it("던전·파티를 조인하고 평균 신뢰와 생존 수를 계산한다", () => {
    const view = toBoardView(createFixtureCampaignState());
    expect(view).toHaveLength(1);
    expect(view[0].dungeonLabel).toBe("C급 1번");
    expect(view[0].partyLabel).toBe("1팀");
    expect(view[0].survivorCount).toBe(3);
    expect(view[0].averageTrust).toBe(50);
    expect(view[0].locked).toBe(false);
    expect(view[0].shortfall).toBeNull();
  });

  it("잠긴 공고는 부족 명성을 계산한다", () => {
    const view = toBoardView(lockedState());
    expect(view[0].locked).toBe(true);
    expect(view[0].dungeonLabel).toBe("B급 7번");
    expect(view[0].shortfall).toBe(30);
  });
});

describe("toContractView", () => {
  it("파티원 상세를 조인하고 계약 가능 여부를 표시한다", () => {
    const state = createFixtureCampaignState();
    const view = toContractView(state, state.board[0].id);
    expect(view).not.toBeNull();
    expect(view?.branchCount).toBe(2);
    expect(view?.bossRevealed).toBe(true);
    expect(view?.members).toHaveLength(3);
    expect(view?.members[0].name).toBe("라스");
    expect(view?.members[0].memorySummary).toBe("최근 변화 없음");
    expect(view?.acceptable).toBe(true);
  });

  it("빈 memory는 최근 변화 없음으로 표시한다", () => {
    const state = createFixtureCampaignState();
    const withMemory: CampaignState = {
      ...state,
      members: state.members.map((member, index) =>
        index === 0
          ? { ...member, memory: [{ at: 1, kind: "settlement" as const, summary: "신뢰가 올랐다" }] }
          : member,
      ),
    };
    const view = toContractView(withMemory, withMemory.board[0].id);
    expect(view?.members[0].memorySummary).toBe("신뢰가 올랐다");
  });

  it("없는 공고 id는 null을 돌려준다", () => {
    const state = createFixtureCampaignState();
    expect(toContractView(state, "no-such-offer" as BoardOfferId)).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다.**

Run: `pnpm test components/game/campaign-view-model.test.ts`
Expected: FAIL — `./campaign-view-model` 모듈이 없어 import 실패.

- [ ] **Step 3: view-model을 구현한다.**

Create `components/game/campaign-view-model.ts`:

```ts
import { CLASSES } from "@/lib/content/classes";
import { canAcceptOffer } from "@/lib/rules/board";
import {
  calculatePromotionScore,
  nextGradeTarget,
} from "@/lib/rules/promotion";
import type {
  BoardLockReason,
  BoardOfferId,
  CampaignMember,
  CampaignState,
  ClassId,
  Grade,
} from "@/lib/domain";
import { PERSONALITY_LABELS } from "./labels";

/** 지도는 항상 두 갈래다(상위 spec). 갈래별 지점 수는 E1 소관이다. */
const TOTAL_BRANCHES = 2;

export interface CampaignHeaderView {
  rank: Grade;
  currentReputation: number;
  currentGold: number;
  cumulativeGold: number;
  promotionScore: number;
  nextGrade: { grade: Grade; threshold: number } | null;
  remainingDungeons: number;
  totalDungeons: number;
}

export interface BoardOfferView {
  offerId: BoardOfferId;
  order: number;
  dungeonLabel: string;
  grade: Grade;
  failureCount: number;
  requiredReputation: number;
  reputationReward: number;
  goldReward: number;
  nodeCount: number;
  partyLabel: string;
  survivorCount: number;
  averageTrust: number;
  locked: boolean;
  shortfall: number | null;
  lockReason: BoardLockReason;
  // riskSummary?: ... — E1 지도 통합 때 추가한다. U1에서는 없음.
}

export interface ContractMemberView {
  memberId: string;
  name: string;
  className: string;
  personalityLabel: string;
  currentHp: number;
  maxHp: number;
  trust: number;
  carriedGold: number;
  memorySummary: string;
}

export interface ContractView {
  offerId: BoardOfferId;
  dungeonLabel: string;
  grade: Grade;
  requiredReputation: number;
  reputationReward: number;
  goldReward: number;
  nodeCount: number;
  branchCount: number;
  bossRevealed: boolean;
  partyLabel: string;
  members: ContractMemberView[];
  acceptable: boolean;
  acceptBlockReason: "insufficientReputation" | "partyUnavailable" | null;
}

/** "dungeon-001" 또는 "party-007" 같은 id 끝의 숫자를 읽는다. */
function numericSuffix(id: string): number {
  const match = /(\d+)\s*$/.exec(id);
  return match === null ? 0 : Number(match[1]);
}

function classNameOf(classId: ClassId): string {
  return CLASSES.find((klass) => klass.id === classId)?.name ?? "직업 미정";
}

function memorySummaryOf(member: CampaignMember): string {
  if (member.memory.length === 0) {
    return "최근 변화 없음";
  }
  return member.memory[member.memory.length - 1].summary;
}

function membersOfParty(state: CampaignState, partyId: string): CampaignMember[] {
  const party = state.parties.find((candidate) => candidate.id === partyId);
  if (party === undefined) {
    return [];
  }
  return party.memberIds
    .map((memberId) => state.members.find((member) => member.id === memberId))
    .filter((member): member is CampaignMember => member !== undefined);
}

export function toCampaignHeaderView(state: CampaignState): CampaignHeaderView {
  return {
    rank: state.rank,
    currentReputation: state.currentReputation,
    currentGold: state.currentGold,
    cumulativeGold: state.cumulativeGold,
    promotionScore: calculatePromotionScore(
      state.currentReputation,
      state.cumulativeGold,
    ),
    nextGrade: nextGradeTarget(state.rank),
    remainingDungeons: state.dungeons.filter(
      (dungeon) => dungeon.status === "remaining",
    ).length,
    totalDungeons: state.dungeons.length,
  };
}

export function toBoardView(state: CampaignState): BoardOfferView[] {
  return state.board.map((offer, index) => {
    const dungeon = state.dungeons.find(
      (candidate) => candidate.id === offer.dungeonId,
    );
    const grade: Grade = dungeon?.grade ?? "C";
    const members = membersOfParty(state, offer.partyId);
    const alive = members.filter((member) => member.alive);
    const averageTrust =
      alive.length === 0
        ? 0
        : Math.round(
            alive.reduce((sum, member) => sum + member.trust, 0) / alive.length,
          );
    const shortfall =
      offer.locked && offer.lockReason === "insufficientReputation"
        ? offer.requiredReputation - state.currentReputation
        : null;

    return {
      offerId: offer.id,
      order: index + 1,
      dungeonLabel:
        dungeon === undefined
          ? "알 수 없는 던전"
          : `${grade}급 ${numericSuffix(dungeon.id)}번`,
      grade,
      failureCount: dungeon?.failureCount ?? 0,
      requiredReputation: offer.requiredReputation,
      reputationReward: offer.baseReputationReward,
      goldReward: offer.baseGoldReward,
      nodeCount: offer.nodeCount,
      partyLabel: `${numericSuffix(offer.partyId)}팀`,
      survivorCount: alive.length,
      averageTrust,
      locked: offer.locked,
      shortfall,
      lockReason: offer.lockReason,
    };
  });
}

export function toContractView(
  state: CampaignState,
  offerId: BoardOfferId,
): ContractView | null {
  const offer = state.board.find((candidate) => candidate.id === offerId);
  if (offer === undefined) {
    return null;
  }
  const dungeon = state.dungeons.find(
    (candidate) => candidate.id === offer.dungeonId,
  );
  const party = state.parties.find(
    (candidate) => candidate.id === offer.partyId,
  );
  if (dungeon === undefined || party === undefined) {
    return null;
  }

  const members = membersOfParty(state, offer.partyId).map((member) => ({
    memberId: member.id,
    name: member.name,
    className: classNameOf(member.classId),
    personalityLabel: PERSONALITY_LABELS[member.personality],
    currentHp: member.currentHp,
    maxHp: member.maxHp,
    trust: member.trust,
    carriedGold: member.carriedGold,
    memorySummary: memorySummaryOf(member),
  }));

  const acceptance = canAcceptOffer(state, offer);

  return {
    offerId: offer.id,
    dungeonLabel: `${dungeon.grade}급 ${numericSuffix(dungeon.id)}번`,
    grade: dungeon.grade,
    requiredReputation: offer.requiredReputation,
    reputationReward: offer.baseReputationReward,
    goldReward: offer.baseGoldReward,
    nodeCount: offer.nodeCount,
    branchCount: TOTAL_BRANCHES,
    bossRevealed: true,
    partyLabel: `${numericSuffix(party.id)}팀`,
    members,
    acceptable: acceptance.accepted,
    acceptBlockReason: acceptance.accepted ? null : acceptance.reason,
  };
}
```

- [ ] **Step 4: 테스트와 타입 검사가 통과하는지 확인한다.**

Run: `pnpm test components/game/campaign-view-model.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: 검사 발동을 확인한다.**

`averageTrust`의 `Math.round`를 잠시 `Math.floor`로 바꿔도 값이 같아 안 잡히므로, 대신 `shortfall` 계산의 `offer.requiredReputation - state.currentReputation`을 `+`로 바꿔 잠금 테스트가 실패하는지 확인한 뒤 되돌린다. 확인 내용을 커밋 본문에 적는다.

- [ ] **Step 6: 커밋한다.**

```bash
git add components/game/campaign-view-model.ts components/game/campaign-view-model.test.ts
git commit -m "화면: 캠페인 게시판 view-model 조인 계층을 추가한다" -m "CampaignState를 HUD·공고·계약 view로 변환하고 던전·파티·인물을 조인한다. 부족 명성 계산 부호를 일부러 뒤집어 테스트가 잡는지 확인 후 되돌렸다."
```

---

### Task 3: 표시 컴포넌트 셋

**Files:**
- Create: `components/game/CampaignHeader.tsx`
- Create: `components/game/Board.tsx`
- Create: `components/game/ContractPanel.tsx`

**Interfaces:**
- Consumes: `CampaignHeaderView`, `BoardOfferView`, `ContractView` types and `BoardOfferId` from `./campaign-view-model` (re-exported domain type via `@/lib/domain`); `Panel` from `@/components/ui/Panel`; `StatValue` from `@/components/ui/StatValue`.
- Produces components with these exact props (Task 4 renders them):
  - `CampaignHeader({ view: CampaignHeaderView })`
  - `Board({ offers: BoardOfferView[]; selectedOfferId: BoardOfferId | null; onSelectOffer: (offerId: BoardOfferId) => void; onAcceptContract: (offerId: BoardOfferId) => void })`
  - `ContractPanel({ contract: ContractView | null })`

- [ ] **Step 1: `CampaignHeader`를 작성한다.**

Create `components/game/CampaignHeader.tsx`:

```tsx
import { StatValue } from "@/components/ui/StatValue";
import type { CampaignHeaderView } from "./campaign-view-model";

interface CampaignHeaderProps {
  view: CampaignHeaderView;
}

/**
 * 캠페인 공통 HUD. 영구 등급과 현재 명성을 다른 그룹으로 나눠
 * 명성이 내려가도 등급이 유지된다는 원칙을 시각적으로 구분한다.
 */
export function CampaignHeader({ view }: CampaignHeaderProps) {
  const promotionText =
    view.nextGrade === null
      ? "최고 등급"
      : `${view.promotionScore} / ${view.nextGrade.grade} ${view.nextGrade.threshold}`;

  return (
    <header className="flex flex-wrap items-stretch gap-2">
      <div className="rounded border border-edge bg-panel px-3 py-2">
        <StatValue label="영구 등급" value={view.rank} />
      </div>
      <div className="rounded border border-edge bg-panel px-3 py-2">
        <StatValue label="현재 명성" value={view.currentReputation} />
      </div>
      <div className="rounded border border-edge bg-panel px-3 py-2">
        <StatValue
          label="골드"
          value={`${view.currentGold} / ${view.cumulativeGold}`}
        />
      </div>
      <div className="rounded border border-edge bg-panel px-3 py-2">
        <StatValue label="승급" value={promotionText} />
      </div>
      <div className="rounded border border-edge bg-panel px-3 py-2">
        <StatValue
          label="남은 던전"
          value={`${view.remainingDungeons} / ${view.totalDungeons}`}
        />
      </div>
    </header>
  );
}
```

- [ ] **Step 2: `Board`를 작성한다.**

Create `components/game/Board.tsx`:

```tsx
import { Panel } from "@/components/ui/Panel";
import type { BoardOfferId } from "@/lib/domain";
import type { BoardOfferView } from "./campaign-view-model";

interface BoardProps {
  offers: BoardOfferView[];
  selectedOfferId: BoardOfferId | null;
  onSelectOffer: (offerId: BoardOfferId) => void;
  onAcceptContract: (offerId: BoardOfferId) => void;
}

function statusText(offer: BoardOfferView): string {
  if (!offer.locked) {
    return "✓ 지원 가능";
  }
  if (offer.shortfall !== null) {
    return `× 지원 불가 · 명성 ${offer.shortfall} 부족`;
  }
  return "× 지원 불가";
}

function cardClassName(offer: BoardOfferView, selected: boolean): string {
  const base = "w-full rounded border px-3 py-2 text-left";
  if (offer.locked) {
    return `${base} border-dashed border-trust-down text-muted`;
  }
  if (selected) {
    return `${base} border-trust-up bg-edge text-parchment`;
  }
  return `${base} border-edge text-parchment hover:bg-edge`;
}

/** 왼쪽 공고 게시판. 잠긴 공고도 숨기지 않고 상태와 부족 명성을 함께 보여준다. */
export function Board({
  offers,
  selectedOfferId,
  onSelectOffer,
  onAcceptContract,
}: BoardProps) {
  const selected = offers.find((offer) => offer.offerId === selectedOfferId);
  const canAccept = selected !== undefined && !selected.locked;

  return (
    <Panel title={`원정 공고 · 최대 ${offers.length}개 비교`} aside={<span className="text-xs text-muted">지원 조건 / 보상</span>}>
      <ul className="flex flex-col gap-2">
        {offers.map((offer) => {
          const isSelected = offer.offerId === selectedOfferId;
          return (
            <li key={offer.offerId}>
              <button
                type="button"
                aria-selected={isSelected}
                aria-disabled={offer.locked}
                onClick={() => onSelectOffer(offer.offerId)}
                className={cardClassName(offer, isSelected)}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {String(offer.order).padStart(2, "0")} {offer.dungeonLabel}
                    {offer.failureCount > 0 ? (
                      <span className="ml-1 text-xs text-trust-down">
                        실패 {offer.failureCount}회 상승
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`text-xs ${offer.locked ? "text-trust-down" : "text-trust-up"}`}
                  >
                    {statusText(offer)}
                  </span>
                </span>
                <span className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
                  <span>필요 명성 {offer.requiredReputation}</span>
                  <span>
                    보상 명성 {offer.reputationReward} + {offer.goldReward}G
                  </span>
                  <span>지점 {offer.nodeCount}</span>
                </span>
                <span className="mt-1 block text-xs text-muted">
                  파티: {offer.partyLabel} · 생존 {offer.survivorCount} · 평균 신뢰{" "}
                  {offer.averageTrust}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        disabled={!canAccept}
        onClick={() => {
          if (selected !== undefined) {
            onAcceptContract(selected.offerId);
          }
        }}
        className="mt-3 w-full rounded border border-edge px-3 py-2 text-sm text-parchment enabled:hover:bg-edge disabled:opacity-40"
      >
        선택한 공고 계약하기 →
      </button>
    </Panel>
  );
}
```

- [ ] **Step 3: `ContractPanel`을 작성한다.**

Create `components/game/ContractPanel.tsx`:

```tsx
import { Panel } from "@/components/ui/Panel";
import type { ContractView } from "./campaign-view-model";

interface ContractPanelProps {
  contract: ContractView | null;
}

/** 오른쪽 계약·파티 확인. 선택한 던전과 출전 파티 3인의 상세를 보여준다. */
export function ContractPanel({ contract }: ContractPanelProps) {
  if (contract === null) {
    return (
      <Panel title="선택 상세">
        <p className="text-sm text-muted">공고를 선택하세요.</p>
      </Panel>
    );
  }

  return (
    <Panel title={`선택 상세 · ${contract.dungeonLabel}`}>
      <p className="text-xs text-muted">
        등급 {contract.grade} · 필요 명성 {contract.requiredReputation} · 명성{" "}
        {contract.reputationReward} + {contract.goldReward}G
      </p>
      <p className="mt-1 text-xs text-muted">
        지도: 전체 {contract.nodeCount}지점 · 두 갈래 · 보스방 공개
      </p>

      <h3 className="mt-3 text-sm font-semibold text-muted">
        출전 파티 · {contract.partyLabel}
      </h3>
      <ul className="mt-2 flex flex-col gap-2">
        {contract.members.map((member) => (
          <li
            key={member.memberId}
            className="rounded border border-edge px-3 py-2"
          >
            <p className="flex items-baseline justify-between gap-2 text-sm text-parchment">
              <span>
                {member.name}
                <span className="ml-1 text-xs text-muted">
                  {member.className}
                </span>
              </span>
              <span className="text-xs text-muted">
                성격: {member.personalityLabel}
              </span>
            </p>
            <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
              <span>
                HP {member.currentHp} / {member.maxHp}
              </span>
              <span>개인 신뢰 {member.trust}</span>
              <span>소지 {member.carriedGold}G</span>
            </p>
            <p className="mt-1 text-xs text-muted">
              {member.memorySummary} · 행동 기억 유지
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
```

- [ ] **Step 4: 타입·린트 검사가 통과하는지 확인한다.**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. import 경계 위반(`@/lib/mock` 등)이 없고 타입이 맞는다.

- [ ] **Step 5: 커밋한다.**

```bash
git add components/game/CampaignHeader.tsx components/game/Board.tsx components/game/ContractPanel.tsx
git commit -m "화면: 캠페인 HUD·게시판·계약 표시 컴포넌트를 추가한다" -m "와이어프레임 screen-01 구도를 따르고 상태·잠금·선택을 색 외에 기호·테두리·aria 속성으로 구분한다."
```

---

### Task 4: 프리뷰 하네스와 전체 검증

**Files:**
- Create: `app/u1-test/u1-fixtures.ts`
- Create: `app/u1-test/page.tsx`
- Modify: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md` (U1 상태 갱신 — main 동기화 후)

**Interfaces:**
- Consumes: `initializeCampaign` from `@/lib/rules/campaign-init`; `generateBoard` from `@/lib/rules/board`; `CampaignState` from `@/lib/domain`; `CampaignHeader`, `Board`, `ContractPanel`, `toCampaignHeaderView`, `toBoardView`, `toContractView` from `@/components/game/*`.
- Produces: `initialBoardState(): CampaignState`, `midCampaignState(): CampaignState`.

- [ ] **Step 1: fixture를 작성한다.**

`initializeCampaign`은 던전 15개·완성 파티 15팀·예비 6명을 시드로 생성한다(C1 완료). 여기에 명성·등급·클리어·실패 상승·인물 상태를 덧씌워 두 상황을 만든다. 게시판은 `generateBoard`로 채운다.

Create `app/u1-test/u1-fixtures.ts`:

```ts
import { generateBoard } from "@/lib/rules/board";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import type { CampaignState } from "@/lib/domain";

/** 초기 상황: 등급 C·명성 0이라 B/A/S 공고가 잠긴다. */
export function initialBoardState(): CampaignState {
  const base = initializeCampaign("u1-demo-initial");
  return { ...base, board: generateBoard(base) };
}

/**
 * 중반 상황: 등급 B·명성 38·던전 6개 클리어·던전 1개 실패 상승,
 * 첫 파티 인물 상태를 다양하게 바꿔 계약 패널을 확인한다.
 */
export function midCampaignState(): CampaignState {
  const base = initializeCampaign("u1-demo-mid");

  const dungeons = base.dungeons.map((dungeon, index) => {
    if (index < 6) {
      return { ...dungeon, status: "cleared" as const };
    }
    if (index === 6) {
      return {
        ...dungeon,
        grade: "B" as const,
        failureCount: 1,
      };
    }
    return dungeon;
  });

  const firstPartyMemberIds = new Set(
    base.parties.find((party) => party.complete)?.memberIds ?? [],
  );
  const memberOverrides = [
    { trust: 72, currentHp: 88, carriedGold: 18 },
    { trust: 54, currentHp: 100, carriedGold: 26 },
    { trust: 57, currentHp: 64, carriedGold: 11 },
  ];
  let overrideIndex = 0;
  const members = base.members.map((member) => {
    if (!firstPartyMemberIds.has(member.id) || overrideIndex >= memberOverrides.length) {
      return member;
    }
    const override = memberOverrides[overrideIndex];
    overrideIndex += 1;
    const memory =
      overrideIndex === 1
        ? [{ at: 1, kind: "settlement" as const, summary: "지난 정산에서 신뢰가 올랐다" }]
        : member.memory;
    return { ...member, ...override, memory };
  });

  const mid: CampaignState = {
    ...base,
    rank: "B",
    currentReputation: 38,
    currentGold: 36,
    cumulativeGold: 60,
    dungeons,
    members,
  };

  return { ...mid, board: generateBoard(mid) };
}
```

- [ ] **Step 2: 하네스 페이지를 작성한다.**

Create `app/u1-test/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Board } from "@/components/game/Board";
import { CampaignHeader } from "@/components/game/CampaignHeader";
import { ContractPanel } from "@/components/game/ContractPanel";
import {
  toBoardView,
  toCampaignHeaderView,
  toContractView,
} from "@/components/game/campaign-view-model";
import type { BoardOfferId } from "@/lib/domain";
import { initialBoardState, midCampaignState } from "./u1-fixtures";

const FIXTURES = {
  initial: { label: "초기(등급 C · 전부 지원 가능)", state: initialBoardState() },
  mid: { label: "중반(등급 B · 다양한 상태)", state: midCampaignState() },
} as const;

type FixtureKey = keyof typeof FIXTURES;

export default function U1TestPage() {
  const [fixtureKey, setFixtureKey] = useState<FixtureKey>("mid");
  const [selectedOfferId, setSelectedOfferId] = useState<BoardOfferId | null>(null);
  const [accepted, setAccepted] = useState<string | null>(null);

  const state = FIXTURES[fixtureKey].state;
  const contract =
    selectedOfferId === null ? null : toContractView(state, selectedOfferId);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-3 p-4 text-parchment">
      <div className="flex gap-2">
        {(Object.keys(FIXTURES) as FixtureKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setFixtureKey(key);
              setSelectedOfferId(null);
              setAccepted(null);
            }}
            className={`rounded border px-3 py-1 text-xs ${
              key === fixtureKey ? "border-trust-up bg-edge" : "border-edge"
            }`}
          >
            {FIXTURES[key].label}
          </button>
        ))}
      </div>

      <CampaignHeader view={toCampaignHeaderView(state)} />

      <div className="grid gap-3 md:grid-cols-2">
        <Board
          offers={toBoardView(state)}
          selectedOfferId={selectedOfferId}
          onSelectOffer={setSelectedOfferId}
          onAcceptContract={(offerId) =>
            setAccepted(`수락됨: ${offerId} (실 전이는 I1에서 연결)`)
          }
        />
        <ContractPanel contract={contract} />
      </div>

      {accepted === null ? null : (
        <p className="text-xs text-trust-up">{accepted}</p>
      )}
    </main>
  );
}
```

- [ ] **Step 3: 전체 검증을 실행한다.**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: 넷 모두 PASS. 새 파일이 import 경계·타입·빌드를 통과한다.

- [ ] **Step 4: 브라우저로 눈 확인한다.**

Run: `pnpm dev` 후 `http://localhost:3000/u1-test` 접속.
Expected: HUD 5그룹 표시, "중반" fixture에서 A/S 공고가 `× 지원 불가 · 명성 N 부족`으로 잠기고 C/B는 `✓ 지원 가능`, 실패 상승 던전에 "실패 1회 상승" 표기, 공고 클릭 시 우측에 파티원 3인 상세(이름·직업·성격·HP·신뢰·소지 골드·기억)와 계약 버튼 동작. 잠긴 공고를 선택하면 계약 버튼이 비활성.

- [ ] **Step 5: 컴포넌트·하네스를 커밋한다.**

```bash
git add app/u1-test
git commit -m "화면: U1 게시판 프리뷰 하네스를 추가한다" -m "초기·중반 두 fixture로 HUD·게시판·계약 패널을 라이브 스토어 없이 확인한다. 계약 수락은 I1 연결 전까지 문구만 표시한다."
```

- [ ] **Step 6: main 동기화 후 배정표 U1 상태를 갱신한다.**

배정표는 여러 PR이 건드리므로 **작업 마지막에** 갱신한다. 먼저 `git fetch origin && git merge origin/main`으로 최신 main을 반영한다(충돌 시 배정표 표를 main 기준으로 다시 맞춘다). 그다음 `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`에서:

- `U1` 행의 `상태`를 `⬜`에서 `✅`로 바꾼다.
- `U1`을 `선행`에 가진 행(`I1`)에서 `U1`을 지운다.

Run: `pnpm test docs/technical/PROTOTYPE_WORK_ASSIGNMENT.test.ts`
Expected: 무결성 검사 PASS.

```bash
git add docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md
git commit -m "문서: 배정표에서 U1 완료를 반영한다" -m "게시판·HUD·계약 화면 구현으로 U1을 완료 처리하고 I1 선행에서 U1을 지운다."
```

---

## 완료 검증 체크리스트

- [ ] `lib/rules/promotion.ts`가 점수식·기준·다음 등급을 순수 함수로 제공하고 테스트가 통과한다.
- [ ] view-model 세 함수가 HUD·공고·계약 view를 조인하고 부족 명성·평균 신뢰·기억 요약·계약 가능 여부를 정확히 파생한다.
- [ ] `CampaignHeader`가 영구 등급과 현재 명성을 다른 그룹으로 구분해 표시한다.
- [ ] `Board`가 잠긴 공고를 숨기지 않고 `✓`/`×` 기호·점선 테두리·`aria-*`로 상태를 구분한다.
- [ ] `ContractPanel`이 파티원 3인의 직업·성격·HP·신뢰·소지 골드·기억을 표시한다.
- [ ] 던전·파티가 등급·번호로 표시되고 고유명·위험 표시가 없다.
- [ ] `/u1-test`가 두 fixture로 잠금·선택·계약 흐름을 보여준다.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`가 모두 통과한다.
- [ ] 구 단일 런 화면(`app/play/*`)과 스토어·상태 머신을 수정하지 않았다.

## 실행 시 검토 지점

- Task 2 view-model의 조인·경계값(잠금 부족 명성, 빈 memory, 없는 offer)을 별도 리뷰 지점으로 둔다.
- Task 4의 `midCampaignState`가 `initializeCampaign` 출력 구조(파티·인물·던전 배열)에 의존하므로, C1 구현이 바뀌면 fixture를 맞춘다.
- merge 전 `lib/rules/promotion.ts` 소유를 C3과 조율한다(spec의 "merge 전 조율"). `gh pr list`로 C3 진행 여부를 확인한다.
- 배정표 갱신(Task 4 Step 6)은 반드시 main 동기화 뒤에 한다.
```
