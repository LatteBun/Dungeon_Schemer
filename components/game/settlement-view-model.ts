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
    // BossMemberResult.member는 피해가 반영된 사후 상태다. 스냅샷이 없으면
    // 사후 HP에 피해를 되더해 전투 전 HP를 복원하고, 사후 HP는 규칙 값을 쓴다.
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
