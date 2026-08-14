import { BOSS_MODIFIER_MAX, BOSS_MODIFIER_MIN } from "@/lib/content/effects";
import { RuleError } from "@/lib/domain";
import type {
  BossDef,
  CampaignMember,
  InfoRecord,
  MemberId,
  TrustChange,
} from "@/lib/domain";
import type { Rng } from "@/lib/rng";
import { evaluateTrust } from "@/lib/rules/trust";
import type { TrustAction } from "@/lib/rules/trust";

export interface ResolveBossFightInput {
  readonly boss: BossDef;
  readonly members: readonly CampaignMember[];
  readonly infoRecords: readonly InfoRecord[];
  readonly rng: Rng;
}

export interface BossMemberResult {
  readonly member: CampaignMember;
  /** 이 파티원에게 적용한 최종 피해 보정. 이미 상한으로 잘린 값이다. */
  readonly damageModifier: number;
  readonly damage: number;
}

export type BossOutcome = "clear" | "wipe";

/** 보스전 뒤 미검증 기록을 판정한 결과. */
export interface InfoVerification {
  readonly memberId: MemberId;
  readonly cardId: InfoRecord["cardId"];
  readonly action: Extract<
    TrustAction,
    "deceptionExposed" | "suspicionWasCorrect" | "suspicionWasCostly"
  >;
  readonly change: TrustChange;
}

export interface BossResolution {
  readonly outcome: BossOutcome;
  readonly members: BossMemberResult[];
  readonly survivorIds: MemberId[];
  readonly casualtyIds: MemberId[];
  readonly verifications: InfoVerification[];
}

function clampModifier(value: number): number {
  return Math.min(BOSS_MODIFIER_MAX, Math.max(BOSS_MODIFIER_MIN, value));
}

/**
 * 보스전 뒤 이 기록을 어떤 신뢰 행동으로 검증할지 정한다.
 *
 * 중립을 의심한 것도 손해로 본다. 수용했다면 보스 피해 -10%를 받았을 것이므로
 * 의심은 그 이득을 스스로 버린 선택이다. 수용한 진실·중립과 즉시 적발은 이미
 * 그 자리에서 신뢰가 움직였으므로 다시 검증하지 않는다.
 * docs/superpowers/specs/2026-08-15-sbh3821-event-action-boss-fight-design.md
 */
function verificationAction(record: InfoRecord): InfoVerification["action"] | null {
  if (record.pendingVerification) return "deceptionExposed";
  if (record.reaction !== "suspected") return null;
  return record.truthType === "lie"
    ? "suspicionWasCorrect"
    : "suspicionWasCostly";
}

/**
 * 보스전을 자동으로 해결하고 미검증 기록을 검증한다.
 *
 * 보정은 파티원마다 독립이고 기본 피해에 한 번만 적용한다. 난수는 전투가 아니라
 * 사후 검증의 신뢰 변동에서만 쓴다. 입력이 정해지면 피해는 하나로 정해진다.
 */
export function resolveBossFight(
  input: ResolveBossFightInput,
): BossResolution {
  const fighters = input.members.filter((member) => member.alive);
  if (fighters.length === 0) {
    throw new RuleError(
      "INVALID_SETTLEMENT",
      "살아 있는 파티원 없이 보스전을 시작할 수 없다.",
      { bossId: input.boss.id },
    );
  }

  const modifierByMember = new Map<string, number>();
  for (const record of input.infoRecords) {
    if (record.subject !== "boss") continue;
    modifierByMember.set(
      record.memberId,
      (modifierByMember.get(record.memberId) ?? 0) + record.modifier,
    );
  }

  const survivorIds: MemberId[] = [];
  const casualtyIds: MemberId[] = [];
  const members = fighters.map((member) => {
    const damageModifier = clampModifier(modifierByMember.get(member.id) ?? 0);
    const damage = Math.round(input.boss.baseDamage * (1 + damageModifier));
    const currentHp = Math.max(0, member.currentHp - damage);
    const alive = currentHp > 0;
    (alive ? survivorIds : casualtyIds).push(member.id);

    return {
      member: { ...member, currentHp, alive },
      damageModifier,
      damage,
    };
  });

  // 검증은 보스전 뒤에 한다. 죽은 사람의 신뢰는 움직여도 갈 곳이 없다.
  const survivorById = new Map(
    members
      .filter((entry) => entry.member.alive)
      .map((entry) => [entry.member.id as string, entry]),
  );
  const verifications: InfoVerification[] = [];
  for (const record of input.infoRecords) {
    const action = verificationAction(record);
    const entry = survivorById.get(record.memberId);
    if (action === null || entry === undefined) continue;

    const evaluation = evaluateTrust(entry.member, action, input.rng);
    survivorById.set(record.memberId, { ...entry, member: evaluation.member });
    verifications.push({
      memberId: record.memberId,
      cardId: record.cardId,
      action,
      change: evaluation.change,
    });
  }

  return {
    outcome: survivorIds.length > 0 ? "clear" : "wipe",
    members: members.map((entry) =>
      survivorById.get(entry.member.id as string) ?? entry),
    survivorIds,
    casualtyIds,
    verifications,
  };
}
