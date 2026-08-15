# U3 보스전 결과·정산·엔딩 화면 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 자동 보스전 결과, 정산 6단계 원인 사슬, 캠페인 엔딩 화면을 순수 view-model과 프리뷰 하네스로 구현해 라이브 스토어 없이 완성한다.

**Architecture:** `C3`·`C4` 규칙이 만든 `BossResolution`·`SettlementStep[]`·`CampaignEnding`을 순수 함수가 표시용 view로 바꾸고, 표시 전용 컴포넌트 셋이 렌더하며, 하네스가 실제 캠페인을 한 탐험 진행시켜 그 데이터를 만든다. 전이 함수가 버리는 결과는 같은 규칙 함수를 직접 호출해 얻는다.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript 5 strict, Tailwind CSS 4(디자인 토큰), Vitest 4(node 환경), 기존 프리미티브 `Panel`·`StatValue`와 `CampaignHeader`(U1).

**Spec:** `docs/superpowers/specs/2026-08-15-lattebun-u3-settlement-ending-design.md`

## Global Constraints

- 규칙 재구현 금지. 보스·정산·승급·엔딩 계산은 `resolveBossFight`·`settleExpedition`·`resolveEnding`·`calculatePromotionScore`가 소유하고 U3는 표시·조립만 한다.
- 규칙이 만든 문장을 그대로 표시한다. `SettlementStep.summary`, `TrustChange.reason`, `CampaignEnding.reason`을 화면이 다시 쓰지 않는다.
- 정산 단계는 `C3`의 `SETTLEMENT_STEP_ORDER` 6단계를 그대로 쓴다. 와이어프레임의 5칸처럼 단계를 합치지 않는다.
- 엔딩 요약은 `CampaignState`에서 계산 가능한 것만 쓴다. 캠페인 누적 카드 통계·생존/전멸 파티 수·`가장 큰 전환점`은 넣지 않는다.
- 엔딩 이름 4종은 `불신의 대가`·`원정 종료`·`길잡이 자격 박탈`·`용사들의 시대가 끝나다`다.
- 생존·사망과 단계 순서는 색뿐 아니라 기호(`✓`/`×`)·번호·`<ol>` 마크업으로 함께 구분한다.
- `components/**`는 `@/lib/mock`을 import하지 않는다. view-model·컴포넌트는 `@/lib/domain`·`@/lib/rules`·`@/lib/content`·`./labels`만 참조한다. 데이터는 `app/u3-test`가 주입한다.
- 표시 컴포넌트는 DOM 테스트가 없다(Vitest node 환경). typecheck+lint+build와 `/u3-test` 브라우저로 검증한다.
- 검증 명령 넷 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`를 유지한다.
- 커밋 메시지는 제목과 본문을 모두 한글로 쓴다.
- 브랜치는 `feature/u3-settlement-ending`이며 spec 커밋(`610ae55`)이 이미 올라가 있다. main에 직접 push하지 않는다.

## 파일 구조

| 파일 | 책임 |
| --- | --- |
| `components/game/labels.ts` (수정) | 엔딩 이름·정산 단계 라벨 추가 |
| `components/game/settlement-view-model.ts` (+test) | 보스 결과·정산 단계·엔딩 view 조인(순수) |
| `components/game/BossResultPanel.tsx` | 파티원별 보스전 결과 |
| `components/game/SettlementTimeline.tsx` | 6단계 원인 사슬 |
| `components/game/EndingPanel.tsx` | 엔딩 이름·원인·최종 등급·요약 |
| `app/u3-test/u3-fixtures.ts` | 한 탐험을 실제로 진행시켜 정산·엔딩 데이터 생성 |
| `app/u3-test/page.tsx` | 프리뷰 하네스 |

**참조 계약(변경 없음):** `lib/rules/boss.ts`(`resolveBossFight`·`BossResolution`·`BossMemberResult`·`BossOutcome`), `lib/rules/settlement.ts`(`settleExpedition`·`SettlementStep`·`SettlementStepKind`), `lib/rules/ending.ts`(`resolveEnding`), `lib/rules/promotion.ts`(`calculatePromotionScore`·`nextGradeTarget`), `lib/flow/campaign-machine.ts`(`transitionCampaign`·`createCampaignMachineContext`·`affordableChoiceIds`), `lib/rules/campaign-init.ts`(`initializeCampaign`), `lib/content/{bosses,events,info-cards,items,classes}.ts`, `components/game/CampaignHeader.tsx`, `components/game/campaign-view-model.ts`(`toCampaignHeaderView`·`CampaignHeaderView`), `components/ui/{Panel,StatValue}.tsx`.

---

### Task 1: 라벨과 정산 view-model

**Files:**
- Modify: `components/game/labels.ts`
- Create: `components/game/settlement-view-model.ts`
- Test: `components/game/settlement-view-model.test.ts`

**Interfaces:**
- Consumes: `BossResolution`, `BossOutcome` from `@/lib/rules/boss`; `SettlementStep`, `SettlementStepKind` from `@/lib/rules/settlement`; `calculatePromotionScore`, `nextGradeTarget` from `@/lib/rules/promotion`; `CLASSES` from `@/lib/content/classes`; domain types `CampaignEnding`, `CampaignEndingId`, `CampaignMember`, `CampaignState`, `ClassId`, `Grade`, `MemberId`.
- Produces the view types and three functions below (Tasks 2–3 consume them):
  - `toBossResultView(resolution: BossResolution, membersBefore: readonly CampaignMember[]): BossResultView`
  - `toSettlementTimelineView(steps: readonly SettlementStep[]): SettlementStepView[]`
  - `toEndingView(state: CampaignState, ending: CampaignEnding | null): EndingView | null`
  - Types: `BossMemberView`, `BossResultView`, `SettlementStepView`, `EndingSummaryView`, `EndingView`
- Also produces `ENDING_LABELS`, `SETTLEMENT_STEP_LABELS` from `./labels`.

- [ ] **Step 1: 실패하는 테스트를 작성한다.**

Create `components/game/settlement-view-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BOSSES } from "@/lib/content/bosses";
import { createRng } from "@/lib/rng";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { resolveBossFight } from "@/lib/rules/boss";
import { resolveEnding } from "@/lib/rules/ending";
import type { CampaignMember, CampaignState } from "@/lib/domain";
import type { SettlementStep } from "@/lib/rules/settlement";
import {
  toBossResultView,
  toEndingView,
  toSettlementTimelineView,
} from "./settlement-view-model";

function firstParty(state: CampaignState): CampaignMember[] {
  const party = state.parties.find((candidate) => candidate.complete)!;
  return party.memberIds.map(
    (memberId) => state.members.find((member) => member.id === memberId)!,
  );
}

describe("toBossResultView", () => {
  it("실제 보스전 결과에서 생존 여부와 HP 변화를 파생한다", () => {
    const state = initializeCampaign("u3-boss");
    const membersBefore = firstParty(state).map((member) => ({ ...member }));
    const resolution = resolveBossFight({
      boss: BOSSES.find((boss) => boss.grade === "C")!,
      members: membersBefore,
      infoRecords: [],
      rng: createRng("u3-boss").derive("boss"),
    });

    const view = toBossResultView(resolution, membersBefore);

    expect(view.members).toHaveLength(membersBefore.length);
    expect(view.outcomeLabel).toBe("클리어");
    for (const member of view.members) {
      const before = membersBefore.find((candidate) => candidate.id === member.memberId)!;
      expect(member.hpBefore).toBe(before.currentHp);
      expect(member.hpAfter).toBe(Math.max(0, member.hpBefore - member.damage));
      expect(member.survivalMark).toBe(member.survived ? "✓" : "×");
      expect(member.survivalLabel).toBe(member.survived ? "생존" : "사망");
    }
  });

  it("피해 보정을 백분율 문구로 바꾸고 0이면 보정 없음으로 쓴다", () => {
    const state = initializeCampaign("u3-modifier");
    const membersBefore = firstParty(state).map((member) => ({ ...member }));
    const resolution = resolveBossFight({
      boss: BOSSES.find((boss) => boss.grade === "C")!,
      members: membersBefore,
      infoRecords: [],
      rng: createRng("u3-modifier").derive("boss"),
    });

    const view = toBossResultView(resolution, membersBefore);

    // 정보 카드를 전달하지 않았으므로 모든 보정이 0이다.
    for (const member of view.members) {
      expect(member.modifierNote).toBe("보정 없음");
      expect(member.verificationNote).toBeNull();
      expect(member.trustDelta).toBe(0);
    }
  });
});

describe("toSettlementTimelineView", () => {
  it("번호를 1부터 매기고 순서와 원문을 그대로 지킨다", () => {
    const steps: SettlementStep[] = [
      { kind: "survival", summary: "생존 2 · 사망 1" },
      { kind: "reward", summary: "명성 +6 · 골드 +12" },
      { kind: "ending", summary: "엔딩 없음" },
    ];

    const view = toSettlementTimelineView(steps);

    expect(view.map((step) => step.order)).toEqual([1, 2, 3]);
    expect(view.map((step) => step.kind)).toEqual(["survival", "reward", "ending"]);
    expect(view.map((step) => step.summary)).toEqual([
      "생존 2 · 사망 1",
      "명성 +6 · 골드 +12",
      "엔딩 없음",
    ]);
    expect(view[0].label).toBe("생존·신뢰");
  });
});

describe("toEndingView", () => {
  it("엔딩이 없으면 null이다", () => {
    const state = initializeCampaign("u3-no-ending");
    expect(toEndingView(state, null)).toBeNull();
  });

  it("모든 던전을 클리어하면 원정 종료를 최종 등급·요약과 함께 보여준다", () => {
    const base = initializeCampaign("u3-complete");
    const cleared: CampaignState = {
      ...base,
      currentReputation: 72,
      cumulativeGold: 200,
      currentGold: 146,
      dungeons: base.dungeons.map((dungeon) => ({ ...dungeon, status: "cleared" as const })),
    };
    const ending = resolveEnding(cleared, [])!;

    const view = toEndingView(cleared, ending)!;

    expect(view.endingId).toBe("expeditionComplete");
    expect(view.endingLabel).toBe("원정 종료");
    expect(view.reason).toBe(ending.reason);
    expect(view.promotionScore).toBe(72 * 2 + 200);
    expect(view.summary.clearedDungeons).toBe(15);
    expect(view.summary.totalDungeons).toBe(15);
    expect(view.summary.finalReputation).toBe(72);
    expect(view.summary.cumulativeGold).toBe(200);
    expect(view.summary.seed).toBe("u3-complete");
    expect(view.summary.survivalRate).toBe(100);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다.**

Run: `pnpm test components/game/settlement-view-model.test.ts`
Expected: FAIL — `./settlement-view-model` 모듈이 없어 import 실패.

- [ ] **Step 3: 라벨을 추가한다.**

Modify `components/game/labels.ts` — 기존 내용을 지우지 말고 import 줄을 넓히고 아래 두 상수를 파일 끝에 붙인다.

기존 첫 줄을 다음으로 바꾼다:

```ts
import type {
  CampaignEndingId,
  EventKind,
  Personality,
  RunPhase,
  TruthType,
} from "@/lib/domain";
import type { SettlementStepKind } from "@/lib/rules/settlement";
```

파일 끝에 추가한다:

```ts
/** 엔딩 화면에 쓰는 이름. 규칙은 id와 reason만 주고 이름은 화면의 몫이다. */
export const ENDING_LABELS: Record<CampaignEndingId, string> = {
  distrust: "불신의 대가",
  expeditionComplete: "원정 종료",
  supportUnavailable: "길잡이 자격 박탈",
  partyExhausted: "용사들의 시대가 끝나다",
};

/** 정산 원인 사슬의 단계 이름. 순서는 SETTLEMENT_STEP_ORDER가 정한다. */
export const SETTLEMENT_STEP_LABELS: Record<SettlementStepKind, string> = {
  survival: "생존·신뢰",
  reward: "계약 보상",
  dungeon: "던전",
  promotion: "승급",
  party: "파티·회복",
  ending: "다음 상태",
};
```

- [ ] **Step 4: view-model을 구현한다.**

Create `components/game/settlement-view-model.ts`:

```ts
import { CLASSES } from "@/lib/content/classes";
import { calculatePromotionScore, nextGradeTarget } from "@/lib/rules/promotion";
import type { BossOutcome, BossResolution } from "@/lib/rules/boss";
import type { SettlementStep, SettlementStepKind } from "@/lib/rules/settlement";
import type {
  CampaignEnding,
  CampaignEndingId,
  CampaignMember,
  CampaignState,
  ClassId,
  Grade,
  MemberId,
} from "@/lib/domain";
import { ENDING_LABELS, SETTLEMENT_STEP_LABELS } from "./labels";

const RETROSPECTIVE = "S급 목표를 위해 어떤 선택을 했는가?";

function classNameOf(classId: ClassId): string {
  return CLASSES.find((klass) => klass.id === classId)?.name ?? "직업 미정";
}

// --- 보스전 결과 ---

export interface BossMemberView {
  memberId: MemberId;
  name: string;
  className: string;
  survived: boolean;
  survivalMark: string;
  survivalLabel: string;
  hpBefore: number | null;
  hpAfter: number;
  damage: number;
  modifierNote: string;
  verificationNote: string | null;
  trustDelta: number;
}

export interface BossResultView {
  outcome: BossOutcome;
  outcomeLabel: string;
  members: BossMemberView[];
}

/**
 * 피해 보정을 사람이 읽는 문구로 바꾼다.
 * 소수 오차가 화면에 새지 않도록 백분율로 반올림한 뒤 문자열을 만든다.
 */
function modifierNoteOf(modifier: number): string {
  const percent = Math.round(modifier * 100);
  if (percent === 0) return "보정 없음";
  return `보스 피해 ${percent > 0 ? "+" : ""}${percent}%`;
}

export function toBossResultView(
  resolution: BossResolution,
  membersBefore: readonly CampaignMember[],
): BossResultView {
  const beforeById = new Map(
    membersBefore.map((member) => [member.id as string, member]),
  );
  const survivors = new Set<string>(resolution.survivorIds.map(String));

  const members = resolution.members.map((entry): BossMemberView => {
    const member = entry.member;
    // BossMemberResult.member는 피해가 반영된 사후 상태다. 누락된 생존자의
    // 전투 전 HP만 역산하고, 사망자는 0 clamp 전 값을 알 수 없어 null로 둔다.
    const snapshot = beforeById.get(member.id as string);
    const hpBefore = snapshot?.currentHp
      ?? (member.currentHp === 0
        ? null
        : Math.min(member.maxHp, member.currentHp + entry.damage));
    const survived = survivors.has(member.id as string);
    const verification = resolution.verifications.find(
      (candidate) => candidate.memberId === member.id,
    );

    return {
      memberId: member.id,
      name: member.name,
      className: classNameOf(member.classId),
      survived,
      survivalMark: survived ? "✓" : "×",
      survivalLabel: survived ? "생존" : "사망",
      hpBefore,
      hpAfter: member.currentHp,
      damage: entry.damage,
      modifierNote: modifierNoteOf(entry.damageModifier),
      verificationNote: verification?.change.reason ?? null,
      trustDelta: verification?.change.delta ?? 0,
    };
  });

  return {
    outcome: resolution.outcome,
    outcomeLabel: resolution.outcome === "clear" ? "클리어" : "전멸",
    members,
  };
}

// --- 정산 단계 ---

export interface SettlementStepView {
  order: number;
  kind: SettlementStepKind;
  label: string;
  summary: string;
}

/**
 * 규칙이 만든 단계에 번호와 이름만 얹는다.
 *
 * `summary`를 가공하지 않는 이유는 원인 설명이 규칙의 소유이기 때문이다.
 * 화면이 문장을 다시 쓰면 규칙과 화면이 서로 다른 말을 하기 시작한다.
 */
export function toSettlementTimelineView(
  steps: readonly SettlementStep[],
): SettlementStepView[] {
  return steps.map((step, index) => ({
    order: index + 1,
    kind: step.kind,
    label: SETTLEMENT_STEP_LABELS[step.kind],
    summary: step.summary,
  }));
}

// --- 엔딩 ---

export interface EndingSummaryView {
  clearedDungeons: number;
  totalDungeons: number;
  deadMembers: number;
  aliveMembers: number;
  survivalRate: number;
  completeParties: number;
  finalReputation: number;
  currentGold: number;
  cumulativeGold: number;
  seed: string;
}

export interface EndingView {
  endingId: CampaignEndingId;
  endingLabel: string;
  reason: string;
  finalRank: Grade;
  promotionScore: number;
  nextGrade: { grade: Grade; threshold: number } | null;
  summary: EndingSummaryView;
  retrospective: string;
}

export function toEndingView(
  state: CampaignState,
  ending: CampaignEnding | null,
): EndingView | null {
  if (ending === null) {
    return null;
  }

  const alive = state.members.filter((member) => member.alive).length;
  const total = state.members.length;

  return {
    endingId: ending.id,
    endingLabel: ENDING_LABELS[ending.id],
    reason: ending.reason,
    finalRank: state.rank,
    promotionScore: calculatePromotionScore(
      state.currentReputation,
      state.cumulativeGold,
    ),
    nextGrade: nextGradeTarget(state.rank),
    summary: {
      clearedDungeons: state.dungeons.filter(
        (dungeon) => dungeon.status === "cleared",
      ).length,
      totalDungeons: state.dungeons.length,
      deadMembers: total - alive,
      aliveMembers: alive,
      survivalRate: total === 0 ? 0 : Math.round((alive / total) * 100),
      completeParties: state.parties.filter((party) => party.complete).length,
      finalReputation: state.currentReputation,
      currentGold: state.currentGold,
      cumulativeGold: state.cumulativeGold,
      seed: state.seed,
    },
    retrospective: RETROSPECTIVE,
  };
}
```

- [ ] **Step 5: 테스트와 타입 검사를 통과시킨다.**

Run: `pnpm test components/game/settlement-view-model.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: 검사 발동을 확인한다.**

`toBossResultView`의 `Math.max(0, hpBefore - entry.damage)`에서 `Math.max(0, …)`를 벗겨 `hpBefore - entry.damage`로 바꾸고, `toSettlementTimelineView`의 `index + 1`을 `index`로 바꿔 각각 테스트가 실패하는지 확인한 뒤 되돌린다. 확인 내용을 커밋 본문에 적는다.

- [ ] **Step 7: 커밋한다.**

```bash
git add components/game/labels.ts components/game/settlement-view-model.ts components/game/settlement-view-model.test.ts
git commit -m "화면: 보스 결과·정산 단계·엔딩 view-model을 추가한다" -m "규칙이 만든 summary와 reason을 그대로 두고 번호·라벨·기호만 얹는다. HP 하한과 단계 번호 시작값을 일부러 틀리게 바꿔 테스트가 잡는지 확인 후 되돌렸다."
```

---

### Task 2: 표시 컴포넌트 셋

**Files:**
- Create: `components/game/BossResultPanel.tsx`
- Create: `components/game/SettlementTimeline.tsx`
- Create: `components/game/EndingPanel.tsx`

**Interfaces:**
- Consumes: `BossResultView`, `SettlementStepView`, `EndingView` from `./settlement-view-model`; `Panel` from `@/components/ui/Panel`.
- Produces components with these exact props (Task 3 renders them):
  - `BossResultPanel({ view: BossResultView })`
  - `SettlementTimeline({ steps: SettlementStepView[] })`
  - `EndingPanel({ view: EndingView })`

- [ ] **Step 1: `BossResultPanel`을 작성한다.**

Create `components/game/BossResultPanel.tsx`:

```tsx
import { Panel } from "@/components/ui/Panel";
import type { BossResultView } from "./settlement-view-model";

interface BossResultPanelProps {
  view: BossResultView;
}

/** 자동 보스전 결과. 새 선택 없이 누적 상태가 만든 결말을 원인과 함께 보여준다. */
export function BossResultPanel({ view }: BossResultPanelProps) {
  return (
    <Panel title={`자동 보스전 결과 · ${view.outcomeLabel}`}>
      <ul className="grid gap-2 sm:grid-cols-3">
        {view.members.map((member) => (
          <li
            key={member.memberId}
            className={`rounded border px-3 py-2 ${
              member.survived
                ? "border-trust-up"
                : "border-dashed border-trust-down"
            }`}
          >
            <p className="text-sm text-parchment">
              <span className={member.survived ? "text-trust-up" : "text-trust-down"}>
                {member.survivalMark} {member.survivalLabel}
              </span>
              <span className="ml-2">{member.name}</span>
              <span className="ml-1 text-xs text-muted">{member.className}</span>
            </p>
            <p className="mt-1 text-xs text-muted">
              HP {member.hpBefore ?? "미상"} → {member.hpAfter} · 피해 {member.damage}
            </p>
            <p className="mt-1 text-xs text-muted">원인: {member.modifierNote}</p>
            {member.verificationNote === null ? null : (
              <p className="mt-1 text-xs text-muted">
                <span
                  className={
                    member.trustDelta < 0 ? "text-trust-down" : "text-trust-up"
                  }
                >
                  신뢰 {member.trustDelta > 0 ? "+" : ""}{member.trustDelta}
                </span>
                {" · "}
                {member.verificationNote}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
```

- [ ] **Step 2: `SettlementTimeline`을 작성한다.**

Create `components/game/SettlementTimeline.tsx`:

```tsx
import { Panel } from "@/components/ui/Panel";
import type { SettlementStepView } from "./settlement-view-model";

interface SettlementTimelineProps {
  steps: SettlementStepView[];
}

/**
 * 정산의 원인 사슬. 순서가 곧 의미이므로 ol로 그려 보조기술도 순서를 읽게 한다.
 */
export function SettlementTimeline({ steps }: SettlementTimelineProps) {
  return (
    <Panel title="정산 · 원인 사슬">
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step) => (
          <li
            key={step.kind}
            className="rounded border border-edge px-3 py-2"
          >
            <p className="text-sm text-parchment">
              <span className="mr-2 inline-block rounded border border-edge px-2 text-xs text-muted">
                {step.order}
              </span>
              {step.label}
            </p>
            <p className="mt-1 text-xs text-muted">{step.summary}</p>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
```

- [ ] **Step 3: `EndingPanel`을 작성한다.**

Create `components/game/EndingPanel.tsx`:

```tsx
import { Panel } from "@/components/ui/Panel";
import type { EndingView } from "./settlement-view-model";

interface EndingPanelProps {
  view: EndingView;
}

export function EndingPanel({ view }: EndingPanelProps) {
  const summary = view.summary;

  return (
    <Panel title="캠페인 엔딩">
      <p className="text-xs text-muted">시드 {summary.seed}</p>
      <h2 className="mt-1 text-2xl font-semibold text-parchment">
        {view.endingLabel}
      </h2>
      <p className="mt-1 text-sm text-muted">{view.reason}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-[160px_1fr]">
        <div className="rounded border border-trust-up px-3 py-2 text-center">
          <p className="text-xs text-muted">최종 영구 등급</p>
          <p className="text-4xl font-semibold text-trust-up">{view.finalRank}</p>
          <p className="mt-1 text-xs text-muted">
            승급 점수 {view.promotionScore}
            {view.nextGrade === null
              ? " · 최고 등급"
              : ` · 다음 ${view.nextGrade.grade} ${view.nextGrade.threshold}`}
          </p>
        </div>

        <ul className="grid gap-1 text-xs text-muted sm:grid-cols-2">
          <li>클리어 던전 {summary.clearedDungeons} / {summary.totalDungeons}</li>
          <li>완성 파티 {summary.completeParties}팀</li>
          <li>생존 용사 {summary.aliveMembers}명 · 생존률 {summary.survivalRate}%</li>
          <li>사망 용사 {summary.deadMembers}명</li>
          <li>최종 명성 {summary.finalReputation}</li>
          <li>골드 {summary.currentGold} / 누적 {summary.cumulativeGold}</li>
        </ul>
      </div>

      <p className="mt-3 rounded border border-edge px-3 py-2 text-sm text-parchment">
        {view.retrospective}
      </p>
    </Panel>
  );
}
```

- [ ] **Step 4: 타입·린트 검사가 통과하는지 확인한다.**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS, 경고 0. import 경계 위반이 없다. (표시 컴포넌트는 DOM 테스트 없음 — Global Constraints 참조.)

- [ ] **Step 5: 커밋한다.**

```bash
git add components/game/BossResultPanel.tsx components/game/SettlementTimeline.tsx components/game/EndingPanel.tsx
git commit -m "화면: 보스 결과·정산·엔딩 표시 컴포넌트를 추가한다" -m "screen-04·05 구도로 생존 여부와 단계 순서를 색 외에 기호·번호·ol 마크업으로 구분한다."
```

---

### Task 3: 프리뷰 하네스와 전체 검증

**Files:**
- Create: `app/u3-test/u3-fixtures.ts`
- Create: `app/u3-test/page.tsx`
- Modify: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md` (U3 상태 갱신 — main 동기화 후, 컨트롤러가 finishing에서)

**Interfaces:**
- Consumes: `initializeCampaign` from `@/lib/rules/campaign-init`; `transitionCampaign`, `createCampaignMachineContext`, `affordableChoiceIds` from `@/lib/flow/campaign-machine`; `resolveBossFight` from `@/lib/rules/boss`; `settleExpedition` from `@/lib/rules/settlement`; `resolveEnding` from `@/lib/rules/ending`; `createRng` from `@/lib/rng`; `DUNGEON_EVENT_POOLS` from `@/lib/content/events`; `INFO_CARDS` from `@/lib/content/info-cards`; `ITEMS` from `@/lib/content/items`; `BOSSES` from `@/lib/content/bosses`; the three components and three view-model functions; `CampaignHeader` and `toCampaignHeaderView`.
- Produces: `ExpeditionOutcome`, `runOneExpedition(seed: string): ExpeditionOutcome`, `completedCampaignOutcome(seed: string): ExpeditionOutcome`.

- [ ] **Step 1: fixture를 작성한다.**

Create `app/u3-test/u3-fixtures.ts`:

```ts
import { BOSSES } from "@/lib/content/bosses";
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
import { INFO_CARDS } from "@/lib/content/info-cards";
import { ITEMS } from "@/lib/content/items";
import { createRng } from "@/lib/rng";
import {
  affordableChoiceIds,
  createCampaignMachineContext,
  transitionCampaign,
} from "@/lib/flow/campaign-machine";
import { resolveBossFight } from "@/lib/rules/boss";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { resolveEnding } from "@/lib/rules/ending";
import { settleExpedition } from "@/lib/rules/settlement";
import { toCampaignHeaderView } from "@/components/game/campaign-view-model";
import type { CampaignHeaderView } from "@/components/game/campaign-view-model";
import type { BossResolution } from "@/lib/rules/boss";
import type { SettlementStep } from "@/lib/rules/settlement";
import type {
  CampaignEnding,
  CampaignMember,
  CampaignState,
  ExpeditionState,
} from "@/lib/domain";

export interface ExpeditionOutcome {
  headerView: CampaignHeaderView;
  bossResolution: BossResolution;
  membersBefore: CampaignMember[];
  steps: SettlementStep[];
  stateAfter: CampaignState;
  ending: CampaignEnding | null;
}

const CONTEXT = createCampaignMachineContext({
  events: DUNGEON_EVENT_POOLS,
  cards: INFO_CARDS,
  items: ITEMS,
  bosses: BOSSES,
});

/** 전이 함수와 같은 시드를 써야 직접 호출한 보스전이 같은 결과를 낸다. */
function expeditionKey(state: CampaignState, dungeonId: string, failureCount: number): string {
  return `${state.seed}/${dungeonId}#${failureCount}`;
}

function participantsOf(
  state: CampaignState,
  expedition: ExpeditionState,
): CampaignMember[] {
  const party = state.parties.find((candidate) => candidate.id === expedition.partyId);
  const ids = new Set((party?.memberIds ?? []).map(String));
  return state.members.filter((member) => ids.has(member.id as string));
}

/**
 * 한 탐험을 실제 전이 함수로 끝까지 진행한다.
 *
 * 보스전과 정산은 전이 함수 대신 규칙 함수를 직접 부른다. transitionCampaign이
 * BossResolution과 SettlementResult.steps를 버려서 화면이 원인을 못 받기 때문이다.
 * 같은 시드를 쓰므로 결과는 전이 함수를 통과한 상태와 같다.
 */
export function runOneExpedition(seed: string): ExpeditionOutcome {
  let state = initializeCampaign(seed);
  state = transitionCampaign(state, { type: "openBoard" }, CONTEXT);

  const offer = state.board.find((candidate) => !candidate.locked);
  if (offer === undefined) {
    throw new Error(`지원 가능한 공고가 없다: ${seed}`);
  }
  state = transitionCampaign(
    state,
    { type: "acceptContract", offerId: offer.id },
    CONTEXT,
  );

  for (let guard = 0; state.phase !== "boss"; guard += 1) {
    if (guard > 100) {
      throw new Error(`탐험이 보스방에 닿지 않는다: ${seed} · ${state.phase}`);
    }
    const expedition = state.expedition;
    if (expedition === null) {
      throw new Error(`탐험 상태가 비었다: ${seed}`);
    }

    if (state.phase === "map") {
      const current = expedition.map.nodes.find(
        (node) => node.id === expedition.currentNodeId,
      );
      const nextNodeId = current?.nextNodeIds[0];
      if (nextNodeId === undefined) {
        throw new Error(`다음 지점이 없다: ${expedition.currentNodeId}`);
      }
      state = transitionCampaign(state, { type: "selectNode", nodeId: nextNodeId }, CONTEXT);
    } else if (state.phase === "infoOpportunity") {
      const cardId = expedition.pendingInfo?.cardIds[0];
      if (cardId === undefined) {
        throw new Error("정보 기회에 카드 후보가 없다");
      }
      state = transitionCampaign(state, { type: "chooseInfoCard", cardId }, CONTEXT);
    } else if (state.phase === "event") {
      // 잔액을 넘는 거래는 규칙이 거부하므로 살 수 있는 것만 고른다.
      const choiceId =
        affordableChoiceIds(state, CONTEXT)[0] ?? expedition.pendingEvent?.choiceIds[0];
      if (choiceId === undefined) {
        throw new Error("사건에 고를 수 있는 선택지가 없다");
      }
      state = transitionCampaign(state, { type: "chooseEvent", choiceId }, CONTEXT);
    } else {
      throw new Error(`예상 밖 단계: ${state.phase}`);
    }
  }

  const expedition = state.expedition;
  if (expedition === null) {
    throw new Error(`보스 단계에 탐험 상태가 없다: ${seed}`);
  }
  const dungeon = state.dungeons.find((candidate) => candidate.id === expedition.dungeonId);
  if (dungeon === undefined) {
    throw new Error(`던전을 찾을 수 없다: ${expedition.dungeonId}`);
  }
  const boss = CONTEXT.bossByGrade.get(dungeon.grade);
  if (boss === undefined) {
    throw new Error(`등급별 보스가 없다: ${dungeon.grade}`);
  }

  const key = expeditionKey(state, dungeon.id as string, dungeon.failureCount);
  const membersBefore = participantsOf(state, expedition).map((member) => ({ ...member }));
  const bossResolution = resolveBossFight({
    boss,
    members: membersBefore,
    infoRecords: expedition.infoRecords,
    rng: createRng(key).derive("boss"),
  });

  state = transitionCampaign(state, { type: "resolveBoss" }, CONTEXT);
  const settledExpedition = state.expedition;
  if (settledExpedition === null) {
    throw new Error(`정산 단계에 탐험 상태가 없다: ${seed}`);
  }
  const settled = settleExpedition({
    state,
    expedition: settledExpedition,
    rng: createRng(key).derive("regroup"),
  });

  return {
    headerView: toCampaignHeaderView(settled.state),
    bossResolution,
    membersBefore,
    steps: settled.steps,
    stateAfter: settled.state,
    ending: settled.state.ending,
  };
}

/**
 * 엔딩 화면을 보기 위해 남은 던전을 모두 클리어 처리한 뒤 다시 판정한다.
 * 규칙을 우회하지 않고 규칙에 넣는 입력만 손질한다.
 */
export function completedCampaignOutcome(seed: string): ExpeditionOutcome {
  const outcome = runOneExpedition(seed);
  const cleared: CampaignState = {
    ...outcome.stateAfter,
    dungeons: outcome.stateAfter.dungeons.map((dungeon) => ({
      ...dungeon,
      status: "cleared" as const,
    })),
  };
  const ending = resolveEnding(cleared, outcome.bossResolution.survivorIds);
  const withEnding: CampaignState = { ...cleared, ending };

  return {
    ...outcome,
    headerView: toCampaignHeaderView(withEnding),
    stateAfter: withEnding,
    ending,
  };
}
```

- [ ] **Step 2: 하네스 페이지를 작성한다.**

Create `app/u3-test/page.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { BossResultPanel } from "@/components/game/BossResultPanel";
import { CampaignHeader } from "@/components/game/CampaignHeader";
import { EndingPanel } from "@/components/game/EndingPanel";
import { SettlementTimeline } from "@/components/game/SettlementTimeline";
import {
  toBossResultView,
  toEndingView,
  toSettlementTimelineView,
} from "@/components/game/settlement-view-model";
import { completedCampaignOutcome, runOneExpedition } from "./u3-fixtures";

type Tab = "settlement" | "ending";

const SEED = "u3-demo";

export default function U3TestPage() {
  const settlement = useMemo(() => runOneExpedition(SEED), []);
  const completed = useMemo(() => completedCampaignOutcome(SEED), []);
  const [tab, setTab] = useState<Tab>("settlement");

  const outcome = tab === "settlement" ? settlement : completed;
  const endingView = toEndingView(outcome.stateAfter, outcome.ending);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-3 p-4 text-parchment">
      <div className="flex gap-2">
        <button
          type="button"
          aria-pressed={tab === "settlement"}
          onClick={() => setTab("settlement")}
          className={`rounded border px-3 py-1 text-xs ${
            tab === "settlement" ? "border-trust-up bg-edge" : "border-edge"
          }`}
        >
          정산(보스전 결과 · 원인 사슬)
        </button>
        <button
          type="button"
          aria-pressed={tab === "ending"}
          onClick={() => setTab("ending")}
          className={`rounded border px-3 py-1 text-xs ${
            tab === "ending" ? "border-trust-up bg-edge" : "border-edge"
          }`}
        >
          엔딩(원정 종료)
        </button>
      </div>

      <CampaignHeader view={outcome.headerView} />

      {tab === "settlement" ? (
        <>
          <BossResultPanel
            view={toBossResultView(outcome.bossResolution, outcome.membersBefore)}
          />
          <SettlementTimeline steps={toSettlementTimelineView(outcome.steps)} />
          {endingView === null ? (
            <p className="text-xs text-muted">
              엔딩이 판정되지 않았다. 캠페인은 다음 게시판으로 이어진다.
            </p>
          ) : null}
        </>
      ) : endingView === null ? (
        <p className="text-sm text-muted">엔딩을 만들지 못했다.</p>
      ) : (
        <EndingPanel view={endingView} />
      )}
    </main>
  );
}
```

- [ ] **Step 3: 전체 검증을 실행한다.**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: 넷 모두 PASS. `/u3-test` 라우트가 빌드에 포함되고 fixture가 모듈 로드 시 오류 없이 실행된다.

- [ ] **Step 4: 개발 서버로 초기 렌더를 확인한다.**

`pnpm dev`를 백그라운드로 띄우고 `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/u3-test`가 `200`인지 확인한 뒤 서버를 끈다. 헤드리스 환경이므로 탭 전환 같은 상호작용은 확인하지 못한다. 확인한 범위와 못 한 범위를 리포트에 적는다.

- [ ] **Step 5: 커밋한다.**

```bash
git add app/u3-test
git commit -m "화면: U3 정산·엔딩 프리뷰 하네스를 추가한다" -m "실제 전이 함수로 한 탐험을 진행하고 보스전·정산은 규칙 함수를 직접 호출해 원인 사슬을 얻는다."
```

- [ ] **Step 6: (컨트롤러, main 동기화 후) 배정표 U3 상태를 갱신한다.**

작업 마지막에 `git fetch origin && git merge origin/main`으로 최신 main을 반영한 뒤 `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`에서 `U3` 행 상태를 `⬜`에서 `✅`로, 담당을 `LatteBun`으로 바꾸고, `U3`를 `선행`에 가진 행(`I1`)에서 `U3`를 지운다.

Run: `pnpm test docs/technical/PROTOTYPE_WORK_ASSIGNMENT.test.ts`
Expected: 무결성 검사 PASS.

```bash
git add docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md
git commit -m "문서: 배정표에서 U3 완료를 반영한다" -m "정산·엔딩 화면 구현으로 U3를 완료 처리하고 I1 선행에서 U3를 지운다."
```

---

## 완료 검증 체크리스트

- [ ] 보스 결과 view가 생존 여부·HP 변화·피해·보정 문구·검증 원인·신뢰 변화를 정확히 파생한다.
- [ ] 정산 view가 번호를 1부터 매기고 `summary`를 가공 없이 그대로 전달한다.
- [ ] 엔딩 view가 네 엔딩 이름·원인·최종 등급·승급 점수·요약을 만들고, 엔딩이 없으면 `null`이다.
- [ ] 세 컴포넌트가 생존·사망과 단계 순서를 색 외에 기호·번호·`<ol>`로 구분한다.
- [ ] 하네스가 실제 전이 함수로 한 탐험을 진행하고 보스전·정산 결과를 규칙 함수에서 직접 얻는다.
- [ ] 엔딩 탭이 `원정 종료`를 최종 등급과 함께 보여준다.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`가 모두 통과한다.
- [ ] 구 단일 런 화면(`app/play/*`)과 스토어를 수정하지 않았다.

## 실행 시 검토 지점

- Task 1의 `hpBefore` 스냅샷 폴백과 보정 문구 포맷을 별도 리뷰 지점으로 둔다.
- Task 3의 진행 루프가 `initializeCampaign`·`transitionCampaign`의 실제 동작에 의존하므로, 규칙이 바뀌면 fixture를 맞춘다. 루프는 100회 상한을 두어 무한 반복을 막는다.
- 보스전을 규칙 함수와 전이 함수가 각각 한 번씩 실행하지만 같은 시드(`${seed}/${dungeonId}#${failureCount}`)를 쓰므로 결과가 같다. 시드 문자열이 어긋나면 화면과 상태가 다른 말을 하므로 구현 시 확인한다.
- 배정표 갱신(Task 3 Step 6)은 반드시 main 동기화 뒤에 한다.
