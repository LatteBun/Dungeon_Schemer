import type { EventId, NodeId, RunState } from "@/lib/domain";
import { createRng } from "@/lib/rng";
import { generateParty } from "@/lib/rules/party";

export const PREVIEW_INITIAL_SEED = "f2-preview-initial";

export function createPreviewRun(seed: string): RunState {
  const entryNodeId = "preview-entry" as NodeId;
  const bossNodeId = "preview-boss" as NodeId;

  return {
    seed,
    phase: "partyIntro",
    party: generateParty(createRng(seed).derive("party")),
    dungeon: {
      nodes: [
        {
          id: entryNodeId,
          depth: 0,
          eventId: "preview-entry-event" as EventId,
          nextNodeIds: [bossNodeId],
        },
        {
          id: bossNodeId,
          depth: 1,
          eventId: "preview-boss-event" as EventId,
          nextNodeIds: [],
        },
      ],
      entryNodeId,
      bossNodeId,
    },
    currentNodeId: entryNodeId,
    resources: {
      gold: 42,
      food: 7,
      reputation: 3,
    },
    pendingClaims: [],
    log: [],
  };
}
