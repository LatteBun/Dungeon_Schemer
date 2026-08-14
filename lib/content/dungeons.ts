import type { DungeonId, Grade } from "@/lib/domain";

export interface CampaignGradeConfig {
  readonly requiredReputation: number;
  readonly baseReputationReward: number;
  readonly baseGoldReward: number;
  readonly nodeCount: number;
}

export const CAMPAIGN_GRADE_CONFIG: Readonly<Record<Grade, CampaignGradeConfig>> = {
  C: { requiredReputation: 0, baseReputationReward: 10, baseGoldReward: 20, nodeCount: 7 },
  B: { requiredReputation: 30, baseReputationReward: 15, baseGoldReward: 35, nodeCount: 9 },
  A: { requiredReputation: 60, baseReputationReward: 25, baseGoldReward: 55, nodeCount: 11 },
  S: { requiredReputation: 100, baseReputationReward: 40, baseGoldReward: 80, nodeCount: 13 },
};

export interface InitialDungeonDefinition {
  readonly id: DungeonId;
  readonly initialGrade: Grade;
}

function definitionsForGrade(
  start: number,
  count: number,
  initialGrade: Grade,
): InitialDungeonDefinition[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `dungeon-${String(start + index).padStart(3, "0")}` as DungeonId,
    initialGrade,
  }));
}

export const INITIAL_DUNGEON_DEFINITIONS: readonly InitialDungeonDefinition[] = [
  ...definitionsForGrade(1, 6, "C"),
  ...definitionsForGrade(7, 4, "B"),
  ...definitionsForGrade(11, 3, "A"),
  ...definitionsForGrade(14, 2, "S"),
];
