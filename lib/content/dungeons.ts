import type { DungeonId, Grade } from "@/lib/domain";

export interface CampaignGradeConfig {
  readonly requiredReputation: number;
  readonly baseReputationReward: number;
  readonly baseGoldReward: number;
  /** 어느 길로 가도 지나는 사건 수. 지도의 층 수와 같다. */
  readonly pathLength: number;
  /** 지도에 그려지는 사건 지점 수. 갈래 때문에 경로 길이보다 많다. */
  readonly eventNodeCount: number;
  /** 실제 경로 하나에서 지나는 정보 전달 기회 수. */
  readonly infoOpportunityCount: number;
  /** 실제 경로 하나에서 보장하는 보스 주제 카드 수. */
  readonly bossRelatedInfoCount: number;
}

/**
 * 등급별 프로토타입 상수다.
 *
 * 경로를 짧게 하고 지점을 늘려 지도가 위아래로 길어지지 않게 한다. 평균 층 너비가
 * 1.75~1.86이라 갈래가 자주 갈라졌다 합쳐진다. 등급 단계가 하나 더 늘면 경로 8칸을
 * 그 자리에 둔다.
 *
 * `pathLength`와 `eventNodeCount`가 다른 것이 핵심이다. 앞은 플레이어가 겪는
 * 사건 수이고 뒤는 지도에 그려지는 지점 수다. 갈래가 여러 번 갈라졌다 합쳐지므로
 * 지점이 경로보다 많다.
 * docs/superpowers/specs/2026-08-18-sbh3821-irregular-map-generation-design.md
 */
export const CAMPAIGN_GRADE_CONFIG: Readonly<Record<Grade, CampaignGradeConfig>> = {
  C: { requiredReputation: -30, baseReputationReward: 6, baseGoldReward: 12, pathLength: 4, eventNodeCount: 7, infoOpportunityCount: 2, bossRelatedInfoCount: 1 },
  B: { requiredReputation: -10, baseReputationReward: 9, baseGoldReward: 21, pathLength: 5, eventNodeCount: 9, infoOpportunityCount: 3, bossRelatedInfoCount: 1 },
  A: { requiredReputation: 10, baseReputationReward: 15, baseGoldReward: 33, pathLength: 6, eventNodeCount: 11, infoOpportunityCount: 4, bossRelatedInfoCount: 2 },
  S: { requiredReputation: 30, baseReputationReward: 24, baseGoldReward: 48, pathLength: 7, eventNodeCount: 13, infoOpportunityCount: 5, bossRelatedInfoCount: 2 },
};

/** 한 층에 놓을 수 있는 지점 수의 상한. 화면이 읽을 수 있는 폭이다. */
export const MAX_LAYER_WIDTH = 3;

/** 한 지점이 제시할 수 있는 다음 지점 수의 상한. */
export const MAX_NEXT_NODES = 2;

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
