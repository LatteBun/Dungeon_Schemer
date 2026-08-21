import { RuleError } from "@/lib/domain";
import type {
  AdviceOutcome,
  ChoiceId,
  EventEffectTag,
  EventId,
  MerchantAdviceOption,
  MerchantEffect,
  MerchantSituationEvent,
  NonMerchantAdviceOption,
  NonMerchantSituationEvent,
} from "@/lib/domain";

export function advice(
  id: string,
  outcome: AdviceOutcome,
  label: string,
  line: string,
  resultText: string,
  effectTags: readonly EventEffectTag[],
): NonMerchantAdviceOption {
  return { id: id as ChoiceId, label, line, outcome, relation: "unrelated", effectTags, resultText };
}

export function sharedEvent(
  id: string,
  kind: "rest" | "special",
  title: string,
  description: string,
  advices: readonly NonMerchantAdviceOption[],
  defaultResultText: string,
): NonMerchantSituationEvent {
  return { id: id as EventId, kind, title, description, advice: advices, defaultResultText };
}

export function merchantAdvice(
  id: string,
  outcome: "neutral",
  label: string,
  line: string,
  resultText: string,
  effectTags: readonly EventEffectTag[],
  goldCost: 0,
): Extract<MerchantAdviceOption, { outcome: "neutral" }>;
export function merchantAdvice(
  id: string,
  outcome: "help" | "harm",
  label: string,
  line: string,
  resultText: string,
  effectTags: readonly EventEffectTag[],
  goldCost: number,
  merchantEffect: MerchantEffect,
): Extract<MerchantAdviceOption, { outcome: "help" | "harm" }>;
export function merchantAdvice(
  id: string,
  outcome: AdviceOutcome,
  label: string,
  line: string,
  resultText: string,
  effectTags: readonly EventEffectTag[],
  goldCost: number,
  merchantEffect?: MerchantEffect,
): MerchantAdviceOption {
  const base = {
    id: id as ChoiceId,
    label,
    line,
    outcome,
    relation: "unrelated" as const,
    effectTags,
    resultText,
  };

  if (outcome === "neutral") {
    if (goldCost !== 0 || merchantEffect !== undefined) {
      throw new RuleError(
        "INVALID_GENERATION",
        `merchant neutral 조언은 0G이고 효과가 없어야 한다: ${id}`,
        { contentType: "advice", adviceId: id, goldCost },
      );
    }
    return { ...base, outcome, goldCost: 0 };
  }

  if (merchantEffect === undefined) {
    throw new RuleError(
      "INVALID_GENERATION",
      `merchant H/X 조언에 효과가 없다: ${id}`,
      { contentType: "advice", adviceId: id, goldCost },
    );
  }
  if (!Number.isInteger(goldCost) || goldCost <= 0) {
    throw new RuleError(
      "INVALID_GENERATION",
      `merchant H/X 비용은 양의 정수여야 한다: ${id}`,
      { contentType: "advice", adviceId: id, goldCost },
    );
  }

  return {
    ...base,
    outcome,
    goldCost,
    merchantEffect,
  };
}

export function sharedMerchantEvent(
  id: string,
  title: string,
  description: string,
  advices: readonly MerchantAdviceOption[],
  defaultResultText: string,
): MerchantSituationEvent {
  return { id: id as EventId, kind: "merchant", title, description, advice: advices, defaultResultText };
}
