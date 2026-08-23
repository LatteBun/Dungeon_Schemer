import type { SettlementResult } from "./settlement";

export interface CampaignStatistics {
  readonly settlements: readonly SettlementResult[];
}
