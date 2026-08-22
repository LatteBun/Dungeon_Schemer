import { RuleError } from "@/lib/domain";
import { conditionalRuleIdsForEvent } from "@/lib/content/conditional-event-rules";
import type {
  AdviceDecision,
  AdviceOutcome,
  AdviceResolution,
  CampaignDungeon,
  Character,
  ChoiceId,
  DungeonId,
  InfoReaction,
  InfoRecord,
  MemberReaction,
  PresentedAdviceOption,
  RiskLevel,
  RuleId,
  SituationEvent,
  ThemeContent,
  TrustChange,
} from "@/lib/domain";
import { createRng } from "@/lib/rng";
import { evaluateTrust, type TrustAction } from "@/lib/rules/trust";

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

export function disclosedRuleIds(input: {
  campaignSeed: string;
  dungeonId: DungeonId;
  riskLevel: RiskLevel;
  activeRuleIds: readonly RuleId[];
}): readonly RuleId[] {
  if (input.activeRuleIds.length !== 3 || new Set(input.activeRuleIds).size !== 3) {
    throw new RuleError("INVALID_GENERATION", "활성 생태 규칙은 중복 없는 3개여야 한다", { dungeonId: input.dungeonId });
  }
  const counts: Record<RiskLevel, number> = { 1: 3, 2: 3, 3: 2, 4: 2, 5: 1 };
  const ordered = createRng(`${input.campaignSeed}:${input.dungeonId}`)
    .derive("ecology")
    .shuffle([...input.activeRuleIds].sort());
  return ordered.slice(0, counts[input.riskLevel]);
}

export function isEventEligible(input: {
  event: SituationEvent;
  dungeon: CampaignDungeon;
  theme: ThemeContent;
}): boolean {
  if (input.event.theme === undefined || input.event.targetBossId !== undefined) return true;
  const sources = input.event.advice.flatMap((option) =>
    option.source?.kind === "ecology" ? [option.source.ruleId] : [],
  );
  if (!sources.every((ruleId) => input.dungeon.theme === input.theme.id && input.dungeon.activeRuleIds.includes(ruleId))) {
    return false;
  }

  const declared = conditionalRuleIdsForEvent(input.event.id);
  const inline = "satisfiedConditionalRuleIds" in input.event
    ? input.event.satisfiedConditionalRuleIds ?? []
    : [];
  const declaredSet = new Set(declared);
  const inlineSet = new Set(inline);
  if (
    declaredSet.size !== inlineSet.size
    || [...declaredSet].some((ruleId) => !inlineSet.has(ruleId))
  ) {
    return false;
  }

  return sources.every((ruleId) =>
    !input.theme.rules.find((rule) => rule.id === ruleId)?.conditional || declaredSet.has(ruleId),
  );
}

export function presentShuffledAdvice(input: {
  campaignSeed: string;
  dungeonId: DungeonId;
  attempt: number;
  depth: number;
  event: SituationEvent;
}): readonly PresentedAdviceOption[] {
  const shuffled = createRng(
    `${input.campaignSeed}:${input.dungeonId}:attempt:${input.attempt}:depth:${input.depth}:event:${input.event.id}`,
  ).derive("advice").shuffle([...input.event.advice]);
  return shuffled.map((option) => ({
    id: option.id,
    label: option.label,
    line: option.line,
    ...(input.event.kind === "merchant" ? { goldCost: option.goldCost } : {}),
  }));
}

export interface CampaignReactionModifier {
  accept: number;
  expose: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const BASE_ACCEPT: Record<AdviceOutcome, number> = {
  help: 70,
  neutral: 55,
  harm: 45,
};

function trustReactionModifier(member: Character, outcome: AdviceOutcome): CampaignReactionModifier {
  if (member.trust <= 33) {
    return { accept: -20, expose: outcome === "harm" ? 15 : 0 };
  }
  if (member.trust >= 67) {
    return { accept: 15, expose: outcome === "harm" ? -10 : 0 };
  }
  return { accept: 0, expose: 0 };
}

function personalityReactionModifier(member: Character, outcome: AdviceOutcome): CampaignReactionModifier {
  switch (member.personality) {
    case "suspicious":
      return { accept: -20, expose: outcome === "harm" ? 20 : 0 };
    case "righteous":
      return {
        accept: outcome === "help" ? 15 : outcome === "harm" ? -10 : 0,
        expose: outcome === "harm" ? 15 : 0,
      };
    case "greedy":
      return { accept: 10, expose: outcome === "harm" ? -5 : 0 };
    case "prudent":
      return { accept: -10, expose: outcome === "harm" ? 10 : 0 };
    case "impulsive":
      return { accept: 15, expose: outcome === "harm" ? -10 : 0 };
  }
}

function probabilities(
  member: Character,
  outcome: AdviceOutcome,
  campaignModifier: CampaignReactionModifier,
): { accept: number; expose: number } {
  const trustModifier = trustReactionModifier(member, outcome);
  const personalityModifier = personalityReactionModifier(member, outcome);
  const acceptUnclamped = BASE_ACCEPT[outcome]
    + trustModifier.accept
    + personalityModifier.accept
    + campaignModifier.accept;

  if (outcome !== "harm") {
    return { accept: clamp(acceptUnclamped, 5, 95), expose: 0 };
  }

  const expose = clamp(
    15 + trustModifier.expose + personalityModifier.expose + campaignModifier.expose,
    5,
    80,
  );
  return {
    accept: clamp(acceptUnclamped, 5, 95 - expose),
    expose,
  };
}

export function decideImmediateAdvice(input: {
  campaignSeed: string;
  dungeonId: DungeonId;
  attempt: number;
  depth: number;
  event: SituationEvent;
  adviceId: ChoiceId;
  members: readonly Character[];
  campaignModifier?: CampaignReactionModifier;
}): AdviceDecision {
  const option = input.event.advice.find((candidate) => candidate.id === input.adviceId);
  if (option === undefined) {
    throw new RuleError("INVALID_GENERATION", `사건에 없는 조언을 선택했다: ${input.adviceId}`, { eventId: input.event.id });
  }
  const alive = input.members.filter((member) => member.alive);
  if (alive.length === 0) {
    throw new RuleError("INVALID_STATE", "살아 있는 파티원이 없다", { eventId: input.event.id });
  }
  const modifier = input.campaignModifier ?? { accept: 0, expose: 0 };
  const reactions: MemberReaction[] = alive.map((member) => {
    const roll = createRng(
      `${input.campaignSeed}:${input.dungeonId}:attempt:${input.attempt}:depth:${input.depth}:event:${input.event.id}:advice:${input.adviceId}:character:${member.id}`,
    ).derive("card").int(1, 100);
    const probability = probabilities(member, option.outcome, modifier);
    let reaction: InfoReaction = "suspected";
    if (option.outcome === "harm" && roll <= probability.expose) reaction = "exposed";
    else if (roll <= probability.expose + probability.accept) reaction = "accepted";
    return { characterId: member.id, reaction };
  });
  const executed = reactions.some((reaction) => reaction.reaction === "accepted");
  return { adviceId: option.id, outcome: option.outcome, reactions, executed, delayedRecords: [] };
}

function evaluateActions(member: Character, adviceId: ChoiceId, actions: readonly TrustAction[]): readonly TrustChange[] {
  const changes: TrustChange[] = [];
  let current = member;
  for (const action of actions) {
    const evaluated = evaluateTrust(
      current,
      action,
      createRng(`${adviceId}:${member.id}:${action}`).derive("trust"),
    );
    changes.push(evaluated.change);
    current = evaluated.member;
  }
  return changes;
}

export function finalizeImmediateAdviceTrust(input: {
  decision: AdviceDecision;
  members: readonly Character[];
  applied: { executed: boolean; resultText: string };
}): AdviceResolution {
  if (input.decision.executed !== input.applied.executed) {
    throw new RuleError("INVALID_STATE", "조언 실행 결과가 판정과 다르다", { adviceId: input.decision.adviceId });
  }
  const trustChanges: TrustChange[] = [];
  for (const reaction of input.decision.reactions) {
    const member = input.members.find((candidate) => candidate.id === reaction.characterId);
    if (member === undefined) continue;
    const actions: readonly TrustAction[] = reaction.reaction === "exposed" && input.decision.outcome === "harm"
      ? ["adviceHarmed", "deceptionExposed"]
      : input.decision.executed && reaction.reaction === "accepted" && input.decision.outcome !== "neutral"
        ? [input.decision.outcome === "help" ? "adviceHelped" : "adviceHarmed"]
        : !input.decision.executed && reaction.reaction === "suspected" && input.decision.outcome !== "neutral"
          ? [input.decision.outcome === "help" ? "suspicionWasCostly" : "suspicionWasCorrect"]
          : [];
    trustChanges.push(...evaluateActions(member, input.decision.adviceId, actions));
  }
  return { decision: input.decision, trustChanges };
}

export function resolveBossInfoAdvice(
  input: Parameters<typeof decideImmediateAdvice>[0] & { dungeon: CampaignDungeon },
): AdviceResolution {
  const option = input.event.advice.find((candidate) => candidate.id === input.adviceId);
  if (option === undefined || input.event.targetBossId === undefined) {
    throw new RuleError("INVALID_GENERATION", "보스 정보 사건이 아니다", { eventId: input.event.id });
  }
  if (input.event.targetBossId !== input.dungeon.bossId) {
    throw new RuleError("INVALID_GENERATION", "현재 던전 보스와 다른 보스 정보 사건이다", {
      dungeonId: input.dungeon.id,
      bossId: input.dungeon.bossId,
      targetBossId: input.event.targetBossId,
      eventId: input.event.id,
    });
  }
  if (option.outcome !== "neutral" && option.source?.kind !== "boss") {
    throw new RuleError("INVALID_GENERATION", "보스 도움·방해 조언이 보스 특징을 참조하지 않는다", {
      eventId: input.event.id,
      adviceId: option.id,
    });
  }

  const decision = decideImmediateAdvice(input);
  const delayedRecords: InfoRecord[] = decision.reactions.map((reaction) => ({
    eventId: input.event.id,
    adviceId: option.id,
    outcome: option.outcome,
    characterId: reaction.characterId,
    reaction: reaction.reaction,
    modifier: reaction.reaction === "accepted" ? option.bossDamageModifier ?? 0 : 0,
    pendingVerification: option.outcome !== "neutral" && reaction.reaction !== "exposed",
  }));
  const bossDecision = { ...decision, delayedRecords };
  const trustChanges: TrustChange[] = [];

  if (option.outcome === "harm") {
    for (const reaction of decision.reactions) {
      if (reaction.reaction !== "exposed") continue;
      const member = input.members.find((candidate) => candidate.id === reaction.characterId);
      if (member === undefined) continue;
      trustChanges.push(...evaluateActions(member, option.id, ["adviceHarmed", "deceptionExposed"]));
    }
  }

  return { decision: bossDecision, trustChanges };
}
