import type { EmergencyHealAbilityDef } from "./character";

export interface BattlePartyMemberAbilityState extends EmergencyHealAbilityDef {
  readonly remainingUses: number;
}

export interface BattlePartyMember {
  readonly id: string;
  readonly classId: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly attack: number;
  readonly hitWeight: number;
  readonly battleAbility?: BattlePartyMemberAbilityState;
}

export interface BattleEnemyInput {
  readonly id: string;
  readonly monsterId: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly baseDamage: number;
  readonly targetWeightMultipliers?: Readonly<Record<string, number>>;
}

interface BattleActionRecordBase {
  readonly round: number;
  readonly actorId: string;
  readonly targetId: string;
  readonly targetHpBefore: number;
  readonly targetHpAfter: number;
}

export interface BattleAttackActionRecord extends BattleActionRecordBase {
  readonly kind: "attack";
  readonly actorSide: "party" | "enemy";
  readonly damage: number;
  readonly defeated: boolean;
}

export interface BattleHealActionRecord extends BattleActionRecordBase {
  readonly kind: "heal";
  readonly actorSide: "party";
  readonly abilityKind: "emergencyHeal";
  readonly healing: number;
}

export type BattleActionRecord = BattleAttackActionRecord | BattleHealActionRecord;

export interface BattleResolution {
  readonly status: "victory" | "wipe";
  readonly termination: "defeatedEnemies" | "partyWipe" | "roundLimit";
  readonly rounds: number;
  readonly actions: readonly BattleActionRecord[];
  readonly party: readonly BattlePartyMember[];
  readonly enemies: readonly BattleEnemyInput[];
}
