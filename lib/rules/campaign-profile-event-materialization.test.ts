import { describe, expect, it } from "vitest";
import { THEMES } from "@/lib/content/themes";
import type { NodeId, PreparedExpeditionEvents } from "@/lib/domain";
import { initializeCampaign } from "./campaign-init";
import { activateStrongFollower, materializeNodeEvent, prepareExpeditionEvents } from "./expedition-events";
import { generateDungeonMap } from "./dungeon-map";

function materializeEveryPath(input: {
  readonly campaignSeed: string;
  readonly dungeon: ReturnType<typeof initializeCampaign>["dungeons"][number];
  readonly attempt: number;
  readonly theme: (typeof THEMES)[number];
  readonly map: ReturnType<typeof generateDungeonMap>;
  readonly prepared: PreparedExpeditionEvents;
}): void {
  const nodesById = new Map(input.map.nodes.map((node) => [node.id, node]));
  const visit = (nodeId: NodeId, prepared: PreparedExpeditionEvents): void => {
    const node = nodesById.get(nodeId);
    if (node === undefined || node.kind === "boss") return;
    const result = node.kind === "normal"
      ? materializeNodeEvent({
        prepared,
        nodeId,
        campaignSeed: input.campaignSeed,
        dungeonId: input.dungeon.id,
        attempt: input.attempt,
        theme: input.theme,
        targetBossId: input.dungeon.bossId,
        activeRuleIds: input.dungeon.activeRuleIds,
        activeMonsterIds: input.dungeon.activeMonsterIds,
      })
      : undefined;
    const next = result === undefined
      ? prepared
      : result.revealedClueId === undefined
        ? result.state
        : activateStrongFollower({ prepared: result.state, clueId: result.revealedClueId, nodeId });
    for (const childNodeId of node.nextNodeIds) visit(childNodeId, next);
  };
  visit(input.map.entryNodeId, input.prepared);
}

describe("실제 캠페인 생태 프로필의 사건 물질화", () => {
  it("3개 시드의 모든 던전과 두 attempt에서 준비와 선택 경로가 생성 오류 없이 이어진다", () => {
    for (const campaignSeed of ["issue-114-a", "issue-114-b", "issue-114-c"]) {
      const campaign = initializeCampaign(campaignSeed);
      for (const dungeon of campaign.dungeons) {
        const theme = THEMES.find((candidate) => candidate.id === dungeon.theme);
        if (theme === undefined) throw new Error("campaign dungeon theme이 없다");
        for (const attempt of [0, 1]) {
          const map = generateDungeonMap({
            campaignSeed,
            dungeonId: dungeon.id,
            initialRiskLevel: dungeon.initialRiskLevel,
            attempt,
          });
          const prepared = prepareExpeditionEvents({
            campaignSeed,
            dungeonId: dungeon.id,
            initialRiskLevel: dungeon.initialRiskLevel,
            riskLevel: dungeon.riskLevel,
            attempt,
            map,
            theme,
            activeRuleIds: dungeon.activeRuleIds,
            activeMonsterIds: dungeon.activeMonsterIds,
          });

          expect(() => materializeEveryPath({ campaignSeed, dungeon, attempt, theme, map, prepared })).not.toThrow();
        }
      }
    }
  });
});
