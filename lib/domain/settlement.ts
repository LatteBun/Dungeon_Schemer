import type { RiskLevel } from "./dungeon";
import type { Character } from "./character";
import type { CharacterId, DungeonId } from "./ids";
import type { ExpeditionParty } from "./pool";
import type { ExpeditionStatus } from "./expedition";

export interface Reward {
  readonly reputation: number;
  readonly gold: number;
}

export const FULL_SURVIVOR_REWARDS: Readonly<Record<RiskLevel, Reward>> = {
  1: { reputation: 6, gold: 12 },
  2: { reputation: 10, gold: 20 },
  3: { reputation: 15, gold: 32 },
  4: { reputation: 21, gold: 45 },
  5: { reputation: 28, gold: 60 },
};

export function rewardForSurvivors(
  risk: RiskLevel,
  survivors: 0 | 1 | 2 | 3,
): Reward {
  const full = FULL_SURVIVOR_REWARDS[risk];
  const factor = ([0, 0.3, 0.6, 1] as const)[survivors];
  return {
    reputation: Math.floor(full.reputation * factor),
    gold: Math.floor(full.gold * factor),
  };
}

export interface SettlementCauseInputs {
  readonly choice: string;
  readonly reactions: string;
  readonly damage: string;
}

export interface SettlementCauseChain {
  readonly choice: string;
  readonly reactions: string;
  readonly damage: string;
  readonly economy: string;
  readonly campaignChange: string;
}

export interface SettlementSnapshot {
  readonly expeditionId: string;
  readonly dungeonId: DungeonId;
  readonly contractRisk: RiskLevel;
  readonly party: ExpeditionParty;
  readonly finalMembers: readonly Character[];
  readonly status: ExpeditionStatus;
  readonly causeInputs: SettlementCauseInputs;
}

export interface SettlementMemberChange {
  readonly characterId: CharacterId;
  readonly before: Character;
  readonly after: Character;
}

export interface SettlementResult {
  readonly expeditionId: string;
  readonly dungeonId: DungeonId;
  readonly status: ExpeditionStatus;
  readonly survivorIds: readonly CharacterId[];
  readonly survivorCount: 0 | 1 | 2 | 3;
  readonly memberChanges: readonly SettlementMemberChange[];
  readonly reputationDelta: number;
  /** 계약 보상만 포함한다. 전멸에서는 0이다. */
  readonly goldDelta: number;
  /** 전멸 유품만 포함한다. 클리어에서는 0이다. */
  readonly relicGold: number;
  readonly riskBefore: RiskLevel;
  readonly riskAfter: RiskLevel;
  readonly riskCapped: boolean;
  /** 전멸 뒤에만 계산한다. 클리어한 던전에는 다음 계약이 없다. */
  readonly nextReward: Reward | null;
  readonly causeChain: SettlementCauseChain;
}
