import { describe, expect, it } from "vitest";
import { initializeCampaign } from "./campaign-init";
import { settleCampaignExpedition } from "./campaign-transition";
import type { CampaignState, Character, SettlementSnapshot } from "@/lib/domain";

function snapshotFixture(campaign: CampaignState, expeditionId = "exp-01"): SettlementSnapshot {
  const members: Character[] = [];
  const classes = new Set<string>();
  for (const id of campaign.pool.order) {
    const member = campaign.pool.byId[id];
    if (member !== undefined && !classes.has(member.classId)) {
      members.push(member);
      classes.add(member.classId);
    }
    if (members.length === 3) break;
  }
  return {
    expeditionId,
    dungeonId: campaign.dungeons[0].id,
    contractRisk: campaign.dungeons[0].riskLevel,
    party: { memberIds: members.map((member) => member.id) },
    finalMembers: members,
    status: "cleared",
    causeInputs: { choice: "선택", reactions: "반응", damage: "피해" },
  };
}

describe("settleCampaignExpedition", () => {
  it("새 expeditionId는 C4 결과를 한 번 적용하고 통계에 기록한다", () => {
    const campaign = initializeCampaign("transition-test");
    const transition = settleCampaignExpedition(campaign, snapshotFixture(campaign));

    expect(transition.campaign.settledExpeditionIds).toEqual(["exp-01"]);
    expect(transition.campaign.statistics.settlements).toEqual([transition.settlement]);
    expect(transition.campaign.phase).toBe("settlement");
  });

  it("이미 처리한 expeditionId는 C4 호출 전에 INVALID_TRANSITION으로 거부한다", () => {
    const campaign = initializeCampaign("transition-duplicate");
    const snapshot = snapshotFixture(campaign);
    expect(() => settleCampaignExpedition(
      { ...campaign, settledExpeditionIds: ["exp-01"] },
      snapshot,
    )).toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }));
  });
});
