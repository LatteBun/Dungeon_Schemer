import { createRng } from "@/lib/rng";
import type { AdviceOutcome, BaseAdviceOption, ChoiceId } from "@/lib/domain";
import type { Accuracy, StrategyId } from "./public-state";

export interface AccuracySelectionInput {
  readonly campaignSeed: string;
  readonly strategyId: StrategyId;
  readonly accuracy: Accuracy;
  readonly expeditionId: string;
  readonly decisionIndex: number;
  readonly intendedOutcome: AdviceOutcome;
  readonly options: readonly BaseAdviceOption[];
}

export interface AccuracySelection {
  readonly adviceId: ChoiceId;
  readonly intendedOutcome: AdviceOutcome;
  readonly selectedOutcome: AdviceOutcome;
  readonly hit: boolean;
}

export class InvalidStrategyDecisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStrategyDecisionError";
  }
}

export function selectAdviceByAccuracy(input: AccuracySelectionInput): AccuracySelection {
  const seed = [
    input.campaignSeed,
    "backtest-advice-v1",
    input.strategyId,
    String(input.accuracy),
    input.expeditionId,
    String(input.decisionIndex),
  ].join("/");
  const rng = createRng(seed);
  const hit = rng.float() < input.accuracy;
  const candidates = input.options.filter((option) => hit
    ? option.outcome === input.intendedOutcome
    : option.outcome !== input.intendedOutcome);
  if (candidates.length === 0) {
    throw new InvalidStrategyDecisionError("선택 가능한 조언 결과가 없다");
  }
  const selected = candidates[rng.int(0, candidates.length - 1)]!;
  return {
    adviceId: selected.id,
    intendedOutcome: input.intendedOutcome,
    selectedOutcome: selected.outcome,
    hit: selected.outcome === input.intendedOutcome,
  };
}
