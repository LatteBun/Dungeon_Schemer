import type {
  CampaignMember,
  CampaignState,
  ExpeditionState,
  GeneratedMap,
  MapNode,
  MapPath,
  ExpeditionRecord,
} from "@/lib/domain";
import type {
  ClassId,
  DungeonId,
  EventId,
  MemberId,
  NodeId,
  PartyId,
} from "@/lib/domain";
import { emptyStatistics, emptyCardStats } from "@/lib/rules/statistics";

const asId = <T extends string>(value: string): T => value as T;

export function createMemberWithHp(
  currentHp: number,
  maxHp = 100,
  overrides: Partial<CampaignMember> = {},
): CampaignMember {
  return {
    id: asId<MemberId>("member-fixture"),
    name: "테스트 용사",
    classId: asId<ClassId>("warrior"),
    personality: "prudent",
    currentHp,
    maxHp,
    trust: 50,
    carriedGold: 20,
    alive: currentHp > 0,
    memory: [],
    ...overrides,
  };
}

export function createFixtureExpeditionRecord(
  overrides: Partial<ExpeditionRecord> = {},
): ExpeditionRecord {
  return {
    order: 1,
    dungeonId: asId<DungeonId>("dungeon-001"),
    grade: "C",
    partyId: asId<PartyId>("party-001"),
    status: "cleared",
    survivorCount: 3,
    casualtyCount: 0,
    cards: emptyCardStats(),
    bossDamageTotal: 0,
    reputationDelta: 0,
    goldDelta: 0,
    scoreBefore: 0,
    scoreAfter: 0,
    rankBefore: "C",
    rankAfter: "C",
    steps: [],
    ...overrides,
  };
}

function fixtureMap(): GeneratedMap {
  const entry: MapNode = {
    id: asId<NodeId>("node-entry"),
    depth: 0,
    nextNodeIds: [asId<NodeId>("node-boss")],
    eventId: asId<EventId>("event-entry"),
    riskSummary: "낮은 위험",
    hasInfoOpportunity: true,
    bossRelatedInfoCount: 1,
  };
  const boss: MapNode = {
    id: asId<NodeId>("node-boss"),
    depth: 1,
    nextNodeIds: [],
    eventId: asId<EventId>("event-boss"),
    riskSummary: "보스 위험",
    hasInfoOpportunity: false,
    bossRelatedInfoCount: 0,
  };
  const path: MapPath = {
    nodeIds: [entry.id, boss.id],
    regularEventCount: 1,
    infoCount: 1,
    bossRelatedInfoCount: 1,
  };

  return {
    grade: "C",
    nodes: [entry, boss],
    entryNodeId: entry.id,
    bossNodeId: boss.id,
    paths: [path],
  };
}

export function createFixtureExpeditionState(): ExpeditionState {
  const map = fixtureMap();
  return {
    dungeonId: asId<DungeonId>("dungeon-001"),
    partyId: asId<PartyId>("party-001"),
    map,
    currentNodeId: map.entryNodeId,
    visitedNodeIds: [],
    pendingInfo: null,
    pendingEvent: null,
    infoRecords: [],
    bossResult: null,
    result: null,
    log: [],
  };
}

export function createFixtureCampaignState(seed = "f1-fixture"): CampaignState {
  const members = [
    createMemberWithHp(100, 100, {
      id: asId<MemberId>("member-001"),
      name: "라스",
      classId: asId<ClassId>("warrior"),
    }),
    createMemberWithHp(100, 100, {
      id: asId<MemberId>("member-002"),
      name: "미라",
      classId: asId<ClassId>("cleric"),
      personality: "righteous",
    }),
    createMemberWithHp(100, 100, {
      id: asId<MemberId>("member-003"),
      name: "토르",
      classId: asId<ClassId>("scout"),
      personality: "impulsive",
    }),
  ];

  return {
    seed,
    phase: "board",
    rank: "C",
    currentReputation: 0,
    currentGold: 10,
    cumulativeGold: 0,
    dungeons: [
      {
        id: asId<DungeonId>("dungeon-001"),
        initialGrade: "C",
        grade: "C",
        sortOrder: 0,
        status: "remaining",
        failureCount: 0,
      },
    ],
    members,
    parties: [
      {
        id: asId<PartyId>("party-001"),
        memberIds: members.map((member) => member.id),
        complete: true,
      },
    ],
    reserveMemberIds: [],
    waitingMemberIds: [],
    board: [
      {
        id: asId("offer-001"),
        dungeonId: asId<DungeonId>("dungeon-001"),
        partyId: asId<PartyId>("party-001"),
        requiredReputation: 0,
        baseReputationReward: 10,
        baseGoldReward: 20,
        nodeCount: 2,
        locked: false,
        lockReason: null,
      },
    ],
    expedition: null,
    ending: null,
    log: [],
    statistics: emptyStatistics(),
  };
}
