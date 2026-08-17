import { BOSS_MODIFIER_MAX, BOSS_MODIFIER_MIN } from "@/lib/content/effects";
import { RuleError } from "@/lib/domain";
import type {
  BossDef,
  CampaignMember,
  ClassDef,
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
  /** 직업별 공격력과 피격 가중치. 규칙이 콘텐츠를 인자로 받는 관례를 따른다. */
  readonly classes: readonly ClassDef[];
}

export interface BossMemberResult {
  readonly member: CampaignMember;
  /** 이 파티원에게 적용한 최종 피해 보정. 이미 상한으로 잘린 값이다. */
  readonly damageModifier: number;
  /** 전투 내내 받은 피해의 합계. 맞은 횟수만큼 쌓인다. */
  readonly damage: number;
  /** 이 파티원이 보스에게 맞은 횟수. */
  readonly hits: number;
}

/**
 * 파티원 한 명이 보스를 친 기록이다.
 *
 * 합계만 남기면 모션이 누가 언제 쳤는지 그릴 수 없다. 순차로 적용해도 보스가
 * 쓰러지는 턴과 그 턴에 반격하지 않는다는 규칙이 같으므로 결과는 합산과
 * 동일하고 기록만 자세해진다.
 */
export interface BossPartyAttack {
  readonly memberId: MemberId;
  readonly damage: number;
  readonly bossHpAfter: number;
}

/**
 * 한 턴의 기록. 화면과 모션이 이것만 순서대로 읽으면 전투를 재생할 수 있다.
 *
 * 한 턴은 `attacks`를 순서대로 그린 뒤 `targetId`가 있으면 보스의 반격을
 * 그리면 된다. 보스가 파티 공격에 쓰러진 턴은 `targetId`가 없다.
 */
export interface BossTurn {
  readonly turn: number;
  /** 이 턴에 파티가 넣은 피해의 합. `attacks`의 합과 같다. */
  readonly partyDamage: number;
  readonly attacks: readonly BossPartyAttack[];
  readonly bossHpAfter: number;
  /** 보스가 이 턴에 때린 대상. 보스가 먼저 쓰러지면 없다. */
  readonly targetId: MemberId | null;
  readonly damage: number;
  readonly targetHpAfter: number;
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
  readonly turns: BossTurn[];
  /** 전투가 끝났을 때 보스에게 남은 HP. 클리어면 0이다. */
  readonly bossHpRemaining: number;
  /** 보스의 최대 HP. 화면이 남은 비율을 그리려면 필요하다. */
  readonly bossMaxHp: number;
}

/**
 * 전투가 끝나지 않는 것을 막는 안전장치다.
 *
 * 파티 공격력 합이 0이면 보스 HP가 줄지 않아 무한 루프가 된다. 정상 콘텐츠에서는
 * 닿지 않는 값이고, 닿으면 공격력 데이터가 잘못됐다는 신호다.
 */
export const MAX_BOSS_TURNS = 50;

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

/** 가중치에 비례해 하나를 고른다. 가중치가 클수록 자주 뽑힌다. */
function pickWeighted(
  entries: readonly { readonly id: string; readonly weight: number }[],
  rng: Rng,
): string {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return entries[0].id;

  let roll = rng.int(1, total);
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry.id;
  }
  return entries[entries.length - 1].id;
}

/**
 * 보스전을 턴제로 해결하고 미검증 기록을 검증한다.
 *
 * 한 턴은 파티가 먼저 치고 보스가 되받는 순서다. 파티가 먼저 치는 이유는 공격력을
 * 결정에 넣기 위해서다. 보스를 N턴에 잡으면 맞는 것은 N-1번이므로 화력이 높은
 * 파티는 맞는 횟수 자체가 줄어든다. 보스가 먼저 치면 공격력은 전투 길이만 바꾸고
 * 첫 턴 피해는 못 줄인다.
 *
 * 보스는 살아 있는 파티원 중 피격 가중치에 비례한 확률로 대상을 고른다. 정보
 * 보정은 그 파티원이 맞을 때마다 적용한다.
 * docs/superpowers/specs/2026-08-17-sbh3821-turn-based-boss-fight-design.md
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

  const profileOf = (member: CampaignMember): ClassDef | undefined =>
    input.classes.find((entry) => entry.id === member.classId);

  const state = new Map<string, BossMemberResult>(fighters.map((member) => [
    member.id as string,
    {
      member: { ...member },
      damageModifier: clampModifier(modifierByMember.get(member.id) ?? 0),
      damage: 0,
      hits: 0,
    },
  ]));
  const order = fighters.map((member) => member.id as string);
  const aliveEntries = (): BossMemberResult[] =>
    order.map((id) => state.get(id)!).filter((entry) => entry.member.alive);

  const turns: BossTurn[] = [];
  let bossHp = input.boss.maxHp;
  let turn = 0;

  while (bossHp > 0 && aliveEntries().length > 0 && turn < MAX_BOSS_TURNS) {
    turn += 1;
    const alive = aliveEntries();

    // 파티원이 입력 순서대로 한 명씩 친다. 보스가 도중에 쓰러지면 남은 사람은
    // 치지 않는다. 합산해서 한 번에 깎던 때와 결과는 같고 기록만 자세해진다.
    const attacks: BossPartyAttack[] = [];
    for (const entry of alive) {
      if (bossHp === 0) break;
      const damage = profileOf(entry.member)?.attack ?? 0;
      bossHp = Math.max(0, bossHp - damage);
      attacks.push({ memberId: entry.member.id, damage, bossHpAfter: bossHp });
    }
    const partyDamage = attacks.reduce((sum, entry) => sum + entry.damage, 0);

    // 보스가 쓰러진 턴에는 반격하지 않는다.
    if (bossHp === 0) {
      turns.push({
        turn,
        partyDamage,
        attacks,
        bossHpAfter: 0,
        targetId: null,
        damage: 0,
        targetHpAfter: 0,
      });
      break;
    }

    const targetId = pickWeighted(
      alive.map((entry) => ({
        id: entry.member.id as string,
        weight: profileOf(entry.member)?.hitWeight ?? 1,
      })),
      input.rng,
    );
    const target = state.get(targetId)!;
    const damage = Math.round(input.boss.baseDamage * (1 + target.damageModifier));
    const currentHp = Math.max(0, target.member.currentHp - damage);

    state.set(targetId, {
      ...target,
      member: { ...target.member, currentHp, alive: currentHp > 0 },
      damage: target.damage + damage,
      hits: target.hits + 1,
    });
    turns.push({
      turn,
      partyDamage,
      attacks,
      bossHpAfter: bossHp,
      targetId: targetId as MemberId,
      damage,
      targetHpAfter: currentHp,
    });
  }

  const survivorIds: MemberId[] = [];
  const casualtyIds: MemberId[] = [];
  const members = order.map((id) => {
    const entry = state.get(id)!;
    (entry.member.alive ? survivorIds : casualtyIds).push(entry.member.id);
    return entry;
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
    // 보스를 쓰러뜨렸을 때만 클리어다. 생존자 수로 판정하면 턴 상한에 걸려
    // 보스가 멀쩡히 서 있는데도 클리어가 된다.
    outcome: bossHp === 0 ? "clear" : "wipe",
    members: members.map((entry) =>
      survivorById.get(entry.member.id as string) ?? entry),
    survivorIds,
    casualtyIds,
    verifications,
    turns,
    bossHpRemaining: bossHp,
    bossMaxHp: input.boss.maxHp,
  };
}
