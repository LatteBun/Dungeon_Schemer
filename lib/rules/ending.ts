import type { CampaignState } from "@/lib/domain";
import { canCreateEmergencyParty } from "./board";

/** 월드턴 뒤 응급 후보까지 포함해 세 직업을 만들 수 없을 때만 성립한다. */
export function isPersonnelExhausted(campaign: CampaignState): boolean {
  return !canCreateEmergencyParty(campaign.pool);
}
