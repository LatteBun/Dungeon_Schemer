import { RuleError } from "@/lib/domain";
import type { CampaignDungeon, PresentedAdviceOption, RiskLevel, SituationEvent, ThemeContent, DungeonId, RuleId } from "@/lib/domain";
import { createRng } from "@/lib/rng";

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

export function disclosedRuleIds(input: { campaignSeed: string; dungeonId: DungeonId; riskLevel: RiskLevel; activeRuleIds: readonly RuleId[] }): readonly RuleId[] {
  if (input.activeRuleIds.length !== 3 || new Set(input.activeRuleIds).size !== 3) {
    throw new RuleError("INVALID_GENERATION", "활성 생태 규칙은 중복 없는 3개여야 한다", { dungeonId: input.dungeonId });
  }
  const counts: Record<RiskLevel, number> = { 1: 3, 2: 3, 3: 2, 4: 2, 5: 1 };
  const ordered = createRng(`${input.campaignSeed}:${input.dungeonId}`).derive("ecology").shuffle([...input.activeRuleIds].sort());
  return ordered.slice(0, counts[input.riskLevel]);
}

export function isEventEligible(input: { event: SituationEvent; dungeon: CampaignDungeon; theme: ThemeContent }): boolean {
  if (input.event.theme === undefined || input.event.targetBossId !== undefined) return true;
  const sources = input.event.advice.flatMap((option) => option.source?.kind === "ecology" ? [option.source.ruleId] : []);
  if (!sources.every((ruleId) => input.dungeon.theme === input.theme.id && input.dungeon.activeRuleIds.includes(ruleId))) return false;
  const satisfied = "satisfiedConditionalRuleIds" in input.event ? input.event.satisfiedConditionalRuleIds : undefined;
  return sources.every((ruleId) => !input.theme.rules.find((rule) => rule.id === ruleId)?.conditional || satisfied?.includes(ruleId) === true);
}

export function presentShuffledAdvice(input: { campaignSeed: string; dungeonId: DungeonId; attempt: number; depth: number; event: SituationEvent }): readonly PresentedAdviceOption[] {
  const shuffled = createRng(`${input.campaignSeed}:${input.dungeonId}:attempt:${input.attempt}:depth:${input.depth}:event:${input.event.id}`).derive("advice").shuffle([...input.event.advice]);
  return shuffled.map((option) => ({ id: option.id, label: option.label, line: option.line, ...(input.event.kind === "merchant" ? { goldCost: option.goldCost } : {}) }));
}
