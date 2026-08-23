export interface BattlePartyMember {
  readonly id: string;
  readonly classId: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly attack: number;
  readonly hitWeight: number;
}

export interface BattleEnemyInput {
  readonly id: string;
  readonly monsterId: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly baseDamage: number;
  readonly targetWeightMultipliers?: Readonly<Record<string, number>>;
}

export interface BattleActionRecord {
  readonly round: number;
  readonly actorSide: "party" | "enemy";
  readonly actorId: string;
  readonly targetId: string;
  readonly damage: number;
  readonly targetHpBefore: number;
  readonly targetHpAfter: number;
  readonly defeated: boolean;
}

export interface BattleResolution {
  readonly status: "victory" | "wipe";
  readonly termination: "defeatedEnemies" | "partyWipe" | "roundLimit";
  readonly rounds: number;
  readonly actions: readonly BattleActionRecord[];
  readonly party: readonly BattlePartyMember[];
  readonly enemies: readonly BattleEnemyInput[];
}
