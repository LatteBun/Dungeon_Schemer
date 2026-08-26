import { createRng } from "@/lib/rng";
import { RuleError } from "@/lib/domain";
import { validateClasses } from "@/lib/content/class-validation";
import type { ClassBattleAbilityDef, ClassId } from "@/lib/domain";
import type {
  BattleActionRecord,
  BattleEnemyInput,
  BattlePartyMember,
  BattlePartyMemberAbilityState,
  BattleResolution,
} from "@/lib/domain/battle";
export type {
  BattleActionRecord,
  BattleEnemyInput,
  BattlePartyMember,
  BattlePartyMemberAbilityState,
  BattleResolution,
} from "@/lib/domain/battle";

export interface BattleInput {
  readonly seed: string;
  readonly party: readonly BattlePartyMember[];
  readonly enemies: readonly BattleEnemyInput[];
  readonly partyDamageMultiplier?: number;
  readonly incomingDamageMultiplier?: number;
  readonly enemyHpMultiplier?: number;
  readonly enemyDamageMultiplier?: number;
  readonly targetWeightMultipliers?: Readonly<Record<string, number>>;
  readonly targetWeightMultiplierByMemberId?: Readonly<Record<string, number>>;
  readonly incomingDamageMultiplierByMemberId?: Readonly<Record<string, number>>;
  readonly outgoingDamageMultiplierByMemberId?: Readonly<Record<string, number>>;
}

function invalid(message: string): never {
  throw new RuleError("INVALID_GENERATION", message, { contentType: "battle" });
}

function damage(value: number): number {
  if (!Number.isFinite(value)) invalid("전투 피해가 유한하지 않다");
  return Math.max(0, Math.round(value));
}

function validateBattleAbility(member: BattlePartyMember): void {
  const ability: unknown = member.battleAbility;
  if (ability === undefined) return;
  if (ability === null || typeof ability !== "object") {
    invalid(`전투 능력 상태가 객체가 아니다: ${member.id}`);
  }

  const runtimeAbility = ability as BattlePartyMemberAbilityState;
  if (runtimeAbility.kind !== "emergencyHeal") {
    invalid(`지원하지 않는 전투 능력이다: ${member.id}`);
  }
  if (typeof runtimeAbility.name !== "string") {
    invalid(`전투 능력 이름이 문자열이 아니다: ${member.id}`);
  }

  const { remainingUses, ...abilityDefinition } = runtimeAbility;
  validateClasses([{
    id: member.classId as ClassId,
    name: member.classId,
    description: member.classId,
    maxHp: member.maxHp,
    attack: member.attack,
    hitWeight: member.hitWeight,
    battleAbility: abilityDefinition as ClassBattleAbilityDef,
  }]);

  if (
    !Number.isSafeInteger(remainingUses) ||
    remainingUses < 0 ||
    remainingUses > runtimeAbility.usesPerExpedition
  ) {
    invalid(`전투 능력의 남은 사용 횟수가 범위를 벗어난다: ${member.id}`);
  }
}

type RuntimePartyMember = Omit<BattlePartyMember, "hp" | "battleAbility"> & {
  hp: number;
  battleAbility?: BattlePartyMemberAbilityState;
};

function copyPartyMember(member: BattlePartyMember): RuntimePartyMember {
  const copied = {
    ...member,
    hp: Math.max(0, Math.min(member.maxHp, member.hp)),
  };
  if (member.battleAbility === undefined) return copied;
  return { ...copied, battleAbility: { ...member.battleAbility } };
}

function lowestHpRatioTarget(
  party: readonly RuntimePartyMember[],
  triggerAtOrBelowHpPercent: number,
): RuntimePartyMember | undefined {
  let selected: RuntimePartyMember | undefined;
  for (const candidate of party) {
    if (
      candidate.hp <= 0 ||
      candidate.hp >= candidate.maxHp ||
      candidate.hp * 100 > candidate.maxHp * triggerAtOrBelowHpPercent
    ) {
      continue;
    }
    if (
      selected === undefined ||
      candidate.hp * selected.maxHp < selected.hp * candidate.maxHp
    ) {
      selected = candidate;
    }
  }
  return selected;
}

export function resolveBattle(input: BattleInput): BattleResolution {
  if (input.party.length === 0 || input.enemies.length === 0) invalid("전투 참가자가 비어 있다");
  input.party.forEach(validateBattleAbility);
  const party = input.party.map(copyPartyMember);
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
  const abilityUsesInBattleByActorId = new Map<string, number>();
  let rounds = 0;
  for (rounds = 1; rounds <= 50; rounds += 1) {
    for (const member of party) {
      if (member.hp <= 0) continue;
      const target = aliveEnemies()[0];
      if (target === undefined) break;
      const ability = member.battleAbility;
      const usesInBattle = abilityUsesInBattleByActorId.get(member.id) ?? 0;
      if (
        ability !== undefined &&
        ability.remainingUses > 0 &&
        usesInBattle < ability.maxUsesPerBattle
      ) {
        const healTarget = lowestHpRatioTarget(party, ability.triggerAtOrBelowHpPercent);
        if (healTarget !== undefined) {
          const before = healTarget.hp;
          const healing = Math.min(ability.healAmount, healTarget.maxHp - before);
          if (healing > 0) {
            healTarget.hp = before + healing;
            member.battleAbility = {
              ...ability,
              remainingUses: ability.remainingUses - 1,
            };
            abilityUsesInBattleByActorId.set(member.id, usesInBattle + 1);
            actions.push({
              kind: "heal",
              round: rounds,
              actorSide: "party",
              actorId: member.id,
              targetId: healTarget.id,
              abilityKind: ability.kind,
              healing,
              targetHpBefore: before,
              targetHpAfter: healTarget.hp,
            });
            continue;
          }
        }
      }
      const before = target.hp;
      const dealt = damage(member.attack * (input.partyDamageMultiplier ?? 1) * (input.outgoingDamageMultiplierByMemberId?.[member.id] ?? 1));
      target.hp = Math.max(0, target.hp - dealt);
      actions.push({ kind: "attack", round: rounds, actorSide: "party", actorId: member.id, targetId: target.id, damage: dealt, targetHpBefore: before, targetHpAfter: target.hp, defeated: target.hp === 0 });
    }
    if (aliveEnemies().length === 0) return { status: "victory", termination: "defeatedEnemies", rounds, actions, party, enemies };
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      const targets = aliveParty();
      if (targets.length === 0) return { status: "wipe", termination: "partyWipe", rounds, actions, party, enemies };
      const weighted = targets.flatMap((member) => Array.from({ length: Math.max(1, Math.round(member.hitWeight * (input.targetWeightMultipliers?.[member.classId] ?? 1) * (input.targetWeightMultiplierByMemberId?.[member.id] ?? 1) * (enemy.targetWeightMultipliers?.[member.classId] ?? 1) * 10)) }, () => member));
      const target = rng.pick(weighted);
      const before = target.hp;
      const dealt = damage(enemy.baseDamage * (input.incomingDamageMultiplier ?? 1) * (input.incomingDamageMultiplierByMemberId?.[target.id] ?? 1));
      target.hp = Math.max(0, target.hp - dealt);
      actions.push({ kind: "attack", round: rounds, actorSide: "enemy", actorId: enemy.id, targetId: target.id, damage: dealt, targetHpBefore: before, targetHpAfter: target.hp, defeated: target.hp === 0 });
    }
    if (aliveParty().length === 0) return { status: "wipe", termination: "partyWipe", rounds, actions, party, enemies };
  }
  return { status: "wipe", termination: "roundLimit", rounds: 50, actions, party, enemies };
}
