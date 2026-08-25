import type { CampaignState } from "@/lib/domain";
import type { CompletedCampaignRecord } from "./player-progress";

export function completedCampaignRecordFor(
  campaign: CampaignState,
  runId: string,
): CompletedCampaignRecord | null {
  if (campaign.phase !== "ended" || campaign.ending === null) return null;

  return {
    runId,
    ending: campaign.ending.kind,
    finalRank: campaign.ending.finalRank,
    totalExpeditions: campaign.statistics.totalExpeditions,
    clearedExpeditions: campaign.statistics.clearedExpeditions,
    wipedExpeditions: campaign.statistics.wipedExpeditions,
    deaths: campaign.statistics.totalDeaths,
    advices: campaign.history.events.filter((event) => event.type === "ADVICE_RESOLVED").length,
  };
}

export function createCampaignRunId(randomUUID: () => string = () => crypto.randomUUID()): string {
  const id = randomUUID();
  if (id.length === 0) throw new TypeError("캠페인 실행 ID가 비어 있다");
  return id;
}
