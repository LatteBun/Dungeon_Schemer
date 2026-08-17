import { CAMPAIGN_GRADE_CONFIG } from "@/lib/content/dungeons";
import type { Grade } from "@/lib/domain";
import { CLEAR_REWARD_RATIO } from "@/lib/rules/settlement";
import { calculatePromotionScore, promote } from "@/lib/rules/promotion";

export interface CheckpointSnapshot {
  readonly reputation: number;
  readonly cumulativeGold: number;
  readonly score: number;
}

export interface BaselineReport {
  readonly name: "baseline";
  readonly checkpoints: Readonly<Record<Exclude<Grade, "C">, CheckpointSnapshot>>;
  readonly finalRank: Grade;
}

interface ClearStep {
  readonly grade: Grade;
  readonly survivors: 1 | 2 | 3;
  /** 이 클리어 뒤 도달해야 하는 등급. 없으면 아직 승급하지 않는다. */
  readonly reaches?: Exclude<Grade, "C">;
}

/**
 * 던전 15개를 등급 순으로 완주하는 기준 진행이다. 캠페인 길이가 승급 속도의
 * 기준이므로 클리어 횟수를 캠페인 전체로 잡는다.
 * docs/systems/PROGRESSION_AND_ENDINGS.md
 */
const BASELINE_CLEARS: readonly ClearStep[] = [
  { grade: "C", survivors: 3 },
  { grade: "C", survivors: 3 },
  { grade: "C", survivors: 3 },
  { grade: "C", survivors: 3 },
  { grade: "C", survivors: 3, reaches: "B" },
  { grade: "C", survivors: 3 },
  { grade: "B", survivors: 3 },
  { grade: "B", survivors: 3 },
  { grade: "B", survivors: 3, reaches: "A" },
  { grade: "B", survivors: 3 },
  { grade: "A", survivors: 3 },
  { grade: "A", survivors: 3 },
  { grade: "A", survivors: 3, reaches: "S" },
  { grade: "S", survivors: 3 },
  { grade: "S", survivors: 3 },
];

/**
 * 난수 없이 정산 보상만 순서대로 적용해 승급 checkpoint를 재현한다.
 *
 * 전략 시뮬레이션과 달리 시드를 쓰지 않는다. 보상표나 승급 기준이 바뀌면 무작위
 * 백테스트의 통계가 흔들리기 전에 여기서 먼저 정확한 값으로 깨진다.
 */
export function simulateBaseline(): BaselineReport {
  const checkpoints: Record<string, CheckpointSnapshot> = {};
  let reputation = 0;
  let cumulativeGold = 0;
  let rank: Grade = "C";

  for (const step of BASELINE_CLEARS) {
    const config = CAMPAIGN_GRADE_CONFIG[step.grade];
    const ratio = CLEAR_REWARD_RATIO[step.survivors];
    reputation += Math.floor(config.baseReputationReward * ratio);
    cumulativeGold += Math.floor(config.baseGoldReward * ratio);
    rank = promote(rank, calculatePromotionScore(reputation, cumulativeGold));

    if (step.reaches !== undefined) {
      checkpoints[step.reaches] = {
        reputation,
        cumulativeGold,
        score: calculatePromotionScore(reputation, cumulativeGold),
      };
    }
  }

  return {
    name: "baseline",
    checkpoints: checkpoints as BaselineReport["checkpoints"],
    finalRank: rank,
  };
}
