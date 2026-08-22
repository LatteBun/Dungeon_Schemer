import type { PresentedAdviceOption, SituationEvent } from "@/lib/domain";

export function presentAdviceOptions(event: SituationEvent): readonly PresentedAdviceOption[] {
  return event.advice.map((option) => {
    const presented: PresentedAdviceOption = {
      id: option.id,
      label: option.label,
      line: option.line,
    };
    if (event.kind === "merchant") {
      presented.goldCost = option.goldCost;
    }
    return presented;
  });
}
