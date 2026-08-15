import { INFO_CARDS } from "@/lib/content/info-cards";
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
import { ITEMS } from "@/lib/content/items";
import { createRng } from "@/lib/rng";
import { generateGradeMap } from "@/lib/rules/map";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { toCampaignHeaderView } from "@/components/game/campaign-view-model";
import type {
  CampaignMember,
  CardId,
  DungeonEvent,
  EventId,
  EventKind,
  GeneratedMap,
  InfoCard,
  ItemDef,
  ItemId,
} from "@/lib/domain";
import type { CampaignHeaderView } from "@/components/game/campaign-view-model";

const ALL_EVENTS: DungeonEvent[] = [
  ...Object.values(DUNGEON_EVENT_POOLS.regular).flat(),
  ...DUNGEON_EVENT_POOLS.boss,
];

export interface U2Fixture {
  map: GeneratedMap;
  party: CampaignMember[];
  currentNodeId: GeneratedMap["entryNodeId"];
  headerView: CampaignHeaderView;
  eventById: (id: EventId) => DungeonEvent;
  eventKindById: (id: EventId) => EventKind;
  cardById: (id: CardId) => InfoCard;
  itemById: (id: ItemId) => ItemDef | undefined;
}

export function u2Fixture(grade: "C" | "B" | "A" | "S" = "C"): U2Fixture {
  const seed = `u2-demo-${grade}`;
  const campaign = initializeCampaign(seed);
  const firstParty = campaign.parties.find((candidate) => candidate.complete);
  const party = (firstParty?.memberIds ?? []).map(
    (memberId) => campaign.members.find((member) => member.id === memberId)!,
  );
  const map = generateGradeMap(grade, createRng(seed).derive("map"));

  const eventById = (id: EventId): DungeonEvent => {
    const found = ALL_EVENTS.find((event) => event.id === id);
    if (found === undefined) throw new Error(`no event ${id}`);
    return found;
  };
  const cardById = (id: CardId): InfoCard => {
    const found = INFO_CARDS.find((card) => card.id === id);
    if (found === undefined) throw new Error(`no card ${id}`);
    return found;
  };

  return {
    map,
    party,
    currentNodeId: map.entryNodeId,
    headerView: toCampaignHeaderView(campaign),
    eventById,
    eventKindById: (id) => eventById(id).kind,
    cardById,
    itemById: (id) => ITEMS.find((item) => item.id === id),
  };
}
