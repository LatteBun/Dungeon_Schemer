import type {
  ClassId,
  EventId,
  MemberId,
  NodeId,
  RunState,
} from "@/lib/domain";

export function createPreviewRun(seed: string): RunState {
  const entryNodeId = "preview-entry" as NodeId;
  const bossNodeId = "preview-boss" as NodeId;

  return {
    seed,
    phase: "partyIntro",
    party: [
      {
        id: "preview-member-aria" as MemberId,
        name: "아리아",
        classId: "preview-guardian" as ClassId,
        personality: "righteous",
        trust: 75,
        alive: true,
      },
      {
        id: "preview-member-borin" as MemberId,
        name: "보린",
        classId: "preview-scout" as ClassId,
        personality: "suspicious",
        trust: 52,
        alive: true,
      },
      {
        id: "preview-member-celine" as MemberId,
        name: "셀린",
        classId: "preview-scholar" as ClassId,
        personality: "prudent",
        trust: 34,
        alive: true,
      },
    ],
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
