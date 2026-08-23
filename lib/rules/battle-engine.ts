import { createRng } from "@/lib/rng";
import { RuleError } from "@/lib/domain";
import type { BattleActionRecord, BattleEnemyInput, BattlePartyMember, BattleResolution } from "@/lib/domain";
export type { BattleActionRecord, BattleEnemyInput, BattlePartyMember, BattleResolution } from "@/lib/domain";

export interface BattleInput {
  readonly seed: string;
  readonly party: readonly BattlePartyMember[];
  readonly enemies: readonly BattleEnemyInput[];
  readonly partyDamageMultiplier?: number;
  readonly incomingDamageMultiplier?: number;
  readonly enemyHpMultiplier?: number;
  readonly enemyDamageMultiplier?: number;
  readonly targetWeightMultipliers?: Readonly<Record<string, number>>;
  readonly incomingDamageMultiplierByMemberId?: Readonly<Record<string, number>>;
}

function invalid(message: string): never {
  throw new RuleError("INVALID_GENERATION", message, { contentType: "battle" });
}

function damage(value: number): number {
  if (!Number.isFinite(value)) invalid("전투 피해가 유한하지 않다");
  return Math.max(0, Math.round(value));
}

export function resolveBattle(input: BattleInput): BattleResolution {
  if (input.party.length === 0 || input.enemies.length === 0) invalid("전투 참가자가 비어 있다");
  const party = input.party.map((member) => ({ ...member, hp: Math.max(0, Math.min(member.maxHp, member.hp)) }));
  const enemies = input.enemies.map((enemy) => ({
    ...enemy,
    maxHp: Math.max(0, Math.round(enemy.maxHp * (input.enemyHpMultiplier ?? 1))),
    hp: Math.max(0, Math.round(enemy.hp * (input.enemyHpMultiplier ?? 1))),
    baseDamage: Math.max(0, Math.round(enemy.baseDamage * (input.enemyDamageMultiplier ?? 1))),
  }));
  const actions: BattleActionRecord[] = [];
  const rng = createRng(input.seed).derive("battle");
  const aliveParty = () => party.filter((member) => member.hp > 0);
  const aliveEnemies = () => enemies.filter((enemy) => enemy.hp > 0);
  let rounds = 0;
  for (rounds = 1; rounds <= 50; rounds += 1) {
    for (const member of party) {
      if (member.hp <= 0) continue;
      const target = aliveEnemies()[0];
      if (target === undefined) break;
      const before = target.hp;
      const dealt = damage(member.attack * (input.partyDamageMultiplier ?? 1));
      target.hp = Math.max(0, target.hp - dealt);
      actions.push({ round: rounds, actorSide: "party", actorId: member.id, targetId: target.id, damage: dealt, targetHpBefore: before, targetHpAfter: target.hp, defeated: target.hp === 0 });
    }
    if (aliveEnemies().length === 0) return { status: "victory", termination: "defeatedEnemies", rounds, actions, party, enemies };
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      const targets = aliveParty();
      if (targets.length === 0) return { status: "wipe", termination: "partyWipe", rounds, actions, party, enemies };
      const weighted = targets.flatMap((member) => Array.from({ length: Math.max(1, Math.round(member.hitWeight * (input.targetWeightMultipliers?.[member.classId] ?? 1) * (enemy.targetWeightMultipliers?.[member.classId] ?? 1) * 10)) }, () => member));
      const target = rng.pick(weighted);
      const before = target.hp;
      const dealt = damage(enemy.baseDamage * (input.incomingDamageMultiplier ?? 1) * (input.incomingDamageMultiplierByMemberId?.[target.id] ?? 1));
      target.hp = Math.max(0, target.hp - dealt);
      actions.push({ round: rounds, actorSide: "enemy", actorId: enemy.id, targetId: target.id, damage: dealt, targetHpBefore: before, targetHpAfter: target.hp, defeated: target.hp === 0 });
    }
    if (aliveParty().length === 0) return { status: "wipe", termination: "partyWipe", rounds, actions, party, enemies };
  }
  return { status: "wipe", termination: "roundLimit", rounds: 50, actions, party, enemies };
}
