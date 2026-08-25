import type { RiskLevel } from "./dungeon";

export interface ContractReward {
  readonly reputation: number;
  readonly gold: number;
}

export interface IntegerRange {
  readonly min: number;
  readonly max: number;
}

export interface ContractRewardRange {
  readonly reputation: IntegerRange;
  readonly gold: IntegerRange;
}

export const CONTRACT_REWARD_RANGES: Readonly<Record<RiskLevel, ContractRewardRange>> = {
  1: { reputation: { min: 5, max: 7 }, gold: { min: 10, max: 14 } },
  2: { reputation: { min: 9, max: 11 }, gold: { min: 16, max: 24 } },
  3: { reputation: { min: 13, max: 17 }, gold: { min: 27, max: 37 } },
  4: { reputation: { min: 19, max: 23 }, gold: { min: 40, max: 50 } },
  5: { reputation: { min: 25, max: 31 }, gold: { min: 54, max: 66 } },
};

const SURVIVOR_FACTORS = [0, 0.3, 0.6, 1] as const;

export function contractRewardForSurvivors(
  fullReward: ContractReward,
  survivors: 0 | 1 | 2 | 3,
): ContractReward {
  const factor = SURVIVOR_FACTORS[survivors];
  return {
    reputation: Math.floor(fullReward.reputation * factor),
    gold: Math.floor(fullReward.gold * factor),
  };
}

export function isContractRewardInRange(
  riskLevel: RiskLevel,
  reward: ContractReward,
): boolean {
  const range = CONTRACT_REWARD_RANGES[riskLevel];
  return Number.isSafeInteger(reward.reputation)
    && Number.isSafeInteger(reward.gold)
    && reward.reputation >= range.reputation.min
    && reward.reputation <= range.reputation.max
    && reward.gold >= range.gold.min
    && reward.gold <= range.gold.max;
}
