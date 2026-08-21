import type {
  AdviceOutcome,
  ChoiceId,
  EventEffectTag,
  EventId,
  MerchantAdviceOption,
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
  outcome: AdviceOutcome,
  label: string,
  line: string,
  resultText: string,
  effectTags: readonly EventEffectTag[],
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
    return { ...base, outcome, goldCost: 0 };
  }

  return {
    ...base,
    outcome,
    goldCost: 5,
    merchantEffect: {
      immediateHpDeltaPerMember: outcome === "help" ? 1 : -1,
    },
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
