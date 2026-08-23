import type { SettlementResult } from "./settlement";
import type { DungeonId } from "./ids";
import type { ExpeditionStatus } from "./expedition";
import type { CampaignDungeonOrder } from "./dungeon";

export interface SettlementSummary {
  readonly expeditionId: string;
  readonly dungeonId: DungeonId;
  readonly dungeonOrder: CampaignDungeonOrder;
  readonly status: ExpeditionStatus;
  readonly goldEarned: number;
  readonly survivorCount: 0 | 1 | 2 | 3;
  readonly deathCount: 0 | 1 | 2 | 3;
}

export interface CampaignStatistics {
  readonly settlements: readonly SettlementResult[];
  readonly settlementHistory: readonly SettlementSummary[];
  readonly totalExpeditions: number;
  readonly clearedExpeditions: number;
  readonly wipedExpeditions: number;
  readonly totalDeaths: number;
  readonly totalGoldEarned: number;
  readonly highestDungeonCleared: CampaignDungeonOrder | 0;
}

export function createCampaignStatistics(): CampaignStatistics {
  return {
    settlements: [],
    settlementHistory: [],
    totalExpeditions: 0,
    clearedExpeditions: 0,
    wipedExpeditions: 0,
    totalDeaths: 0,
    totalGoldEarned: 0,
    highestDungeonCleared: 0,
  };
}
