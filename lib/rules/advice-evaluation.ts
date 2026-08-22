import { RuleError } from "@/lib/domain";
import type { CampaignDungeon, Character, PresentedAdviceOption, RiskLevel, SituationEvent, ThemeContent, DungeonId, RuleId, ChoiceId, AdviceDecision, AdviceResolution, MemberReaction, InfoReaction } from "@/lib/domain";
import { createRng } from "@/lib/rng";
import { evaluateTrust } from "@/lib/rules/trust";

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

export interface CampaignReactionModifier { accept: number; expose: number }

function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }

function probabilities(member: Character, outcome: string, modifier: CampaignReactionModifier): { accept: number; expose: number } {
  const accept = clamp(5 + member.trust * 0.9 + modifier.accept, 5, 95);
  if (outcome !== "harm") return { accept, expose: 0 };
  const expose = clamp(5 + (100 - member.trust) * 0.75 + modifier.expose, 5, 80);
  return { accept: Math.min(accept, 95 - expose), expose };
}

export function decideImmediateAdvice(input: { campaignSeed: string; dungeonId: DungeonId; attempt: number; depth: number; event: SituationEvent; adviceId: ChoiceId; members: readonly Character[]; campaignModifier?: CampaignReactionModifier }): AdviceDecision {
  const option = input.event.advice.find((candidate) => candidate.id === input.adviceId);
  if (option === undefined) throw new RuleError("INVALID_GENERATION", `사건에 없는 조언을 선택했다: ${input.adviceId}`, { eventId: input.event.id });
  const alive = input.members.filter((member) => member.alive);
  if (alive.length === 0) throw new RuleError("INVALID_STATE", "살아 있는 파티원이 없다", { eventId: input.event.id });
  const modifier = input.campaignModifier ?? { accept: 0, expose: 0 };
  const reactions: MemberReaction[] = alive.map((member) => {
    const roll = createRng(`${input.campaignSeed}:${input.dungeonId}:attempt:${input.attempt}:depth:${input.depth}:event:${input.event.id}:advice:${input.adviceId}:character:${member.id}`).derive("card").int(1, 100);
    const probability = probabilities(member, option.outcome, modifier);
    let reaction: InfoReaction = "suspected";
    if (option.outcome === "harm" && roll <= probability.expose) reaction = "exposed";
    else if (roll <= probability.expose + probability.accept) reaction = "accepted";
    return { characterId: member.id, reaction };
  });
  const executed = reactions.some((reaction) => reaction.reaction === "accepted");
  return { adviceId: option.id, outcome: option.outcome, reactions, executed, delayedRecords: [] };
}

export function finalizeImmediateAdviceTrust(input: { decision: AdviceDecision; members: readonly Character[]; applied: { executed: boolean; resultText: string } }): AdviceResolution {
  if (input.decision.executed !== input.applied.executed) throw new RuleError("INVALID_STATE", "조언 실행 결과가 판정과 다르다", { adviceId: input.decision.adviceId });
  const trustChanges = [];
  for (const reaction of input.decision.reactions) {
    const member = input.members.find((candidate) => candidate.id === reaction.characterId);
    if (member === undefined) continue;
    const actions = reaction.reaction === "exposed" && input.decision.outcome === "harm"
      ? ["adviceHarmed", "deceptionExposed"] as const
      : input.decision.executed && reaction.reaction === "accepted" && input.decision.outcome !== "neutral"
        ? [input.decision.outcome === "help" ? "adviceHelped" : "adviceHarmed"] as const
        : !input.decision.executed && reaction.reaction === "suspected" && input.decision.outcome !== "neutral"
          ? ["suspicionWasCostly"] as const
          : [];
    let current = member;
    for (const action of actions) {
      const evaluated = evaluateTrust(current, action, createRng(`${input.decision.adviceId}:${member.id}:${action}`).derive("trust"));
      trustChanges.push(evaluated.change);
      current = evaluated.member;
    }
  }
  return { decision: input.decision, trustChanges };
}
