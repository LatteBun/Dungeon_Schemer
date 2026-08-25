import type { RiskLevel } from "./dungeon";
import type { Character } from "./character";
import type { CharacterId, DungeonId } from "./ids";
import type { ExpeditionParty } from "./pool";
import type { ExpeditionStatus } from "./expedition";
import type { ContractReward } from "./contract-reward";

export interface SettlementCauseInputs {
  readonly choice: string;
  readonly reactions: string;
  readonly damage: string;
}

export interface SettlementSnapshot {
  readonly expeditionId: string;
  readonly dungeonId: DungeonId;
  readonly contractRisk: RiskLevel;
  readonly contractReward: ContractReward;
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
  readonly causeInputs: SettlementCauseInputs;
}
