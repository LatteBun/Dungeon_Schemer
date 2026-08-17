import type { DungeonId, Grade } from "@/lib/domain";

export interface CampaignGradeConfig {
  readonly requiredReputation: number;
  readonly baseReputationReward: number;
  readonly baseGoldReward: number;
  readonly nodeCount: number;
  /** 한쪽 갈래의 지점 수. 전체 지점은 입구·합류·보스를 더해 2 × 이 값 + 3이다. */
  readonly branchLength: number;
  /** 실제 경로 하나에서 지나는 정보 전달 기회 수. */
  readonly infoOpportunityCount: number;
  /** 실제 경로 하나에서 보장하는 보스 주제 카드 수. */
  readonly bossRelatedInfoCount: number;
}

/**
 * 등급별 프로토타입 상수다.
 *
 * `infoOpportunityCount`가 지금은 `branchLength`와 같지만 유도하지 않는다. 두
 * 값이 같은 것은 현재 밸런스 표의 우연이고, 정보 횟수만 조정하는 일이 지도
 * 크기를 함께 바꾸어서는 안 된다.
 * docs/superpowers/specs/2026-08-13-sanghwan-yoo-game-direction-rework-design.md
 */
export const CAMPAIGN_GRADE_CONFIG: Readonly<Record<Grade, CampaignGradeConfig>> = {
  C: { requiredReputation: 0, baseReputationReward: 6, baseGoldReward: 12, nodeCount: 7, branchLength: 2, infoOpportunityCount: 2, bossRelatedInfoCount: 1 },
  B: { requiredReputation: 30, baseReputationReward: 9, baseGoldReward: 21, nodeCount: 9, branchLength: 3, infoOpportunityCount: 3, bossRelatedInfoCount: 1 },
  A: { requiredReputation: 60, baseReputationReward: 15, baseGoldReward: 33, nodeCount: 11, branchLength: 4, infoOpportunityCount: 4, bossRelatedInfoCount: 2 },
  S: { requiredReputation: 100, baseReputationReward: 24, baseGoldReward: 48, nodeCount: 13, branchLength: 5, infoOpportunityCount: 5, bossRelatedInfoCount: 2 },
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
