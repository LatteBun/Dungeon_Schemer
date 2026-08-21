import type {
  AdviceOption,
  AdviceOutcome,
  ChoiceId,
  EventEffectTag,
  EventId,
  EventKind,
  SituationEvent,
} from "@/lib/domain";

export function advice(
  id: string,
  outcome: AdviceOutcome,
  label: string,
  line: string,
  resultText: string,
  effectTags: readonly EventEffectTag[],
): AdviceOption {
  return { id: id as ChoiceId, label, line, outcome, relation: "unrelated", effectTags, resultText };
}

export function sharedEvent(
  id: string,
  kind: EventKind,
  title: string,
  description: string,
  advices: readonly AdviceOption[],
  defaultResultText: string,
): SituationEvent {
  return { id: id as EventId, kind, title, description, advice: advices, defaultResultText };
}
