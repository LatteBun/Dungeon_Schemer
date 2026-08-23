import { RuleError } from "@/lib/domain";
import type { CampaignState, SettlementResult, SettlementSnapshot } from "@/lib/domain";
import { settleExpedition } from "./settlement";

export interface CampaignSettlementTransition {
  readonly campaign: CampaignState;
  readonly settlement: SettlementResult;
}

export function settleCampaignExpedition(
  campaign: CampaignState,
  snapshot: SettlementSnapshot,
): CampaignSettlementTransition {
  if (campaign.settledExpeditionIds.includes(snapshot.expeditionId)) {
    throw new RuleError("INVALID_TRANSITION", "이미 정산한 원정이다", {
      expeditionId: snapshot.expeditionId,
    });
  }

  const execution = settleExpedition(campaign, snapshot);
  return {
    settlement: execution.result,
    campaign: {
      ...execution.campaign,
      phase: "settlement",
      settledExpeditionIds: [...campaign.settledExpeditionIds, snapshot.expeditionId],
      statistics: {
        ...campaign.statistics,
        settlements: [...campaign.statistics.settlements, execution.result],
      },
    },
  };
}
