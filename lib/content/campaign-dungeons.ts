import type { CampaignDungeonOrder, DungeonId, RiskLevel, ThemeId } from "@/lib/domain";

export interface CampaignDungeonSlot {
  id: DungeonId;
  name: string;
  theme: ThemeId;
  initialRiskLevel: RiskLevel;
  campaignOrder: CampaignDungeonOrder;
}

/** C1에서 모든 시드가 공유하는 던전 슬롯이다. */
export const INITIAL_DUNGEON_SLOTS: readonly CampaignDungeonSlot[] = [
  { id: "dungeon-spider-01" as DungeonId, name: "거미굴 1", theme: "spider", initialRiskLevel: 1, campaignOrder: 1 },
  { id: "dungeon-spider-02" as DungeonId, name: "거미굴 2", theme: "spider", initialRiskLevel: 1, campaignOrder: 2 },
  { id: "dungeon-spider-03" as DungeonId, name: "거미굴 3", theme: "spider", initialRiskLevel: 2, campaignOrder: 3 },
  { id: "dungeon-spider-04" as DungeonId, name: "거미굴 4", theme: "spider", initialRiskLevel: 3, campaignOrder: 4 },
  { id: "dungeon-spider-05" as DungeonId, name: "거미굴 5", theme: "spider", initialRiskLevel: 4, campaignOrder: 5 },
  { id: "dungeon-desert-01" as DungeonId, name: "사막 1", theme: "desert", initialRiskLevel: 1, campaignOrder: 6 },
  { id: "dungeon-desert-02" as DungeonId, name: "사막 2", theme: "desert", initialRiskLevel: 2, campaignOrder: 7 },
  { id: "dungeon-desert-03" as DungeonId, name: "사막 3", theme: "desert", initialRiskLevel: 2, campaignOrder: 8 },
  { id: "dungeon-desert-04" as DungeonId, name: "사막 4", theme: "desert", initialRiskLevel: 3, campaignOrder: 9 },
  { id: "dungeon-desert-05" as DungeonId, name: "사막 5", theme: "desert", initialRiskLevel: 4, campaignOrder: 10 },
  { id: "dungeon-graveyard-01" as DungeonId, name: "묘지 1", theme: "graveyard", initialRiskLevel: 2, campaignOrder: 11 },
  { id: "dungeon-graveyard-02" as DungeonId, name: "묘지 2", theme: "graveyard", initialRiskLevel: 3, campaignOrder: 12 },
  { id: "dungeon-graveyard-03" as DungeonId, name: "묘지 3", theme: "graveyard", initialRiskLevel: 3, campaignOrder: 13 },
  { id: "dungeon-graveyard-04" as DungeonId, name: "묘지 4", theme: "graveyard", initialRiskLevel: 4, campaignOrder: 14 },
  { id: "dungeon-graveyard-05" as DungeonId, name: "묘지 5", theme: "graveyard", initialRiskLevel: 5, campaignOrder: 15 },
];
