import { consumePendingMerchantEffect } from "@/lib/rules/merchant";
import { resolveBattle, type BattleResolution } from "@/lib/rules/battle-engine";
import { RuleError } from "@/lib/domain";
import type { BossDef, Character, ClassDef, PendingMerchantEffect } from "@/lib/domain";

export interface BossBattleInput {
  readonly boss: BossDef;
  readonly members: readonly Character[];
  readonly classDefs: readonly ClassDef[];
  readonly seed: string;
  readonly retrySteps: number;
  readonly pendingMerchantEffect: PendingMerchantEffect | null;
  readonly memberBossDamageMultipliers?: Readonly<Record<string, number>>;
}

export function retryBossStats(boss: BossDef, retrySteps: number): { readonly maxHp: number; readonly baseDamage: number } {
  if (!Number.isInteger(retrySteps) || retrySteps < 0) throw new RuleError("INVALID_GENERATION", "retrySteps가 유효하지 않다", { retrySteps });
  const multiplier = 1 + retrySteps * 0.1;
  return { maxHp: Math.max(1, Math.round(boss.maxHp * multiplier)), baseDamage: Math.max(1, Math.round(boss.baseDamage * multiplier)) };
}

export function resolveBossBattle(input: BossBattleInput): { readonly battle: BattleResolution; readonly pendingMerchantEffect: null } {
  const classById = new Map(input.classDefs.map((classDef) => [classDef.id, classDef]));
  const stats = retryBossStats(input.boss, input.retrySteps);
  const consumed = consumePendingMerchantEffect(input.pendingMerchantEffect);
  const party = input.members.filter((member) => member.alive).map((member) => {
    const classDef = classById.get(member.classId);
    if (classDef === undefined) throw new RuleError("INVALID_GENERATION", "보스전 파티의 직업 정의가 없다", { classId: member.classId });
    return { id: member.id, classId: member.classId, hp: member.hp, maxHp: member.maxHp, attack: classDef.attack, hitWeight: classDef.hitWeight };
  });
  const battle = resolveBattle({
    seed: input.seed,
    party,
    enemies: [{ id: input.boss.id, monsterId: input.boss.id, hp: stats.maxHp, maxHp: stats.maxHp, baseDamage: stats.baseDamage }],
    partyDamageMultiplier: consumed.nextBattle?.partyDamageMultiplier,
    incomingDamageMultiplier: consumed.nextBattle?.incomingDamageMultiplier,
    targetWeightMultipliers: input.boss.targetWeightMultipliers,
    incomingDamageMultiplierByMemberId: input.memberBossDamageMultipliers,
  });
  return { battle, pendingMerchantEffect: null };
}
