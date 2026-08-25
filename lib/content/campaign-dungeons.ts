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
  { id: "dungeon-spider-01" as DungeonId, name: "라그나의 산란굴", theme: "spider", initialRiskLevel: 1, campaignOrder: 1 },
  { id: "dungeon-spider-02" as DungeonId, name: "라그나의 검은실굴", theme: "spider", initialRiskLevel: 1, campaignOrder: 2 },
  { id: "dungeon-spider-03" as DungeonId, name: "모르칸의 사체길", theme: "spider", initialRiskLevel: 2, campaignOrder: 3 },
  { id: "dungeon-spider-04" as DungeonId, name: "세리나의 그림자굴", theme: "spider", initialRiskLevel: 3, campaignOrder: 4 },
  { id: "dungeon-spider-05" as DungeonId, name: "아라크샤의 왕좌", theme: "spider", initialRiskLevel: 4, campaignOrder: 5 },
  { id: "dungeon-desert-01" as DungeonId, name: "자카르의 불탄 우물", theme: "desert", initialRiskLevel: 1, campaignOrder: 6 },
  { id: "dungeon-desert-02" as DungeonId, name: "카르둠의 바람길", theme: "desert", initialRiskLevel: 2, campaignOrder: 7 },
  { id: "dungeon-desert-03" as DungeonId, name: "카르둠의 매장로", theme: "desert", initialRiskLevel: 2, campaignOrder: 8 },
  { id: "dungeon-desert-04" as DungeonId, name: "오벨론의 순례길", theme: "desert", initialRiskLevel: 3, campaignOrder: 9 },
  { id: "dungeon-desert-05" as DungeonId, name: "네프리스의 황무지", theme: "desert", initialRiskLevel: 4, campaignOrder: 10 },
  { id: "dungeon-graveyard-01" as DungeonId, name: "모르비안의 묘문", theme: "graveyard", initialRiskLevel: 2, campaignOrder: 11 },
  { id: "dungeon-graveyard-02" as DungeonId, name: "아즈라엘의 납골당", theme: "graveyard", initialRiskLevel: 3, campaignOrder: 12 },
  { id: "dungeon-graveyard-03" as DungeonId, name: "아즈라엘의 묘역", theme: "graveyard", initialRiskLevel: 3, campaignOrder: 13 },
  { id: "dungeon-graveyard-04" as DungeonId, name: "발드라크의 사냥터", theme: "graveyard", initialRiskLevel: 4, campaignOrder: 14 },
  { id: "dungeon-graveyard-05" as DungeonId, name: "발드라크의 왕묘", theme: "graveyard", initialRiskLevel: 5, campaignOrder: 15 },
];
