import { eventsForTheme } from "@/lib/content/event-registry";
import { createRng } from "@/lib/rng";
import { RuleError } from "@/lib/domain";
import { consumePendingMerchantEffect } from "@/lib/rules/merchant";
import { resolveBattle, type BattleResolution } from "@/lib/rules/battle-engine";
import { expandEncounter, resolveEncounter } from "@/lib/rules/encounter";
import type { AdviceDecision, Character, ClassDef, EncounterModifier, EventKind, ImmediateEventEffect, MaterializedNodeEvent, MonsterDef, PendingMerchantEffect, PreparedExpeditionEvents, PreparedNodePlan, SituationEvent, StrongLinkPlan, ThemeContent } from "@/lib/domain";
import type { ClueId, DungeonId, EventId, MonsterId, NodeId, RuleId } from "@/lib/domain";
import type { GeneratedMap, RiskLevel } from "@/lib/domain";

function invalid(message: string, details: Record<string, unknown> = {}): never {
  throw new RuleError("INVALID_GENERATION", message, details);
}

function cloneState(state: PreparedExpeditionEvents, patch: Partial<PreparedExpeditionEvents>): PreparedExpeditionEvents {
  return { ...state, ...patch };
}

export function retryCombatMultiplier(retrySteps: number): number {
  if (!Number.isInteger(retrySteps) || retrySteps < 0) invalid("retrySteps가 유효하지 않다", { retrySteps });
  return 1 + retrySteps * 0.1;
}

function cutDepths(riskLevel: RiskLevel, layerCount: number): readonly number[] {
  const count = riskLevel <= 2 ? 1 : 2;
  const first = Math.max(1, Math.floor(layerCount / 2));
  return Array.from({ length: count }, (_, index) => Math.min(layerCount - 2, first + index));
}

function reachableNodes(map: GeneratedMap, start: NodeId): ReadonlySet<NodeId> {
  const nodes = new Map(map.nodes.map((node) => [node.id, node]));
  const visited = new Set<NodeId>();
  const queue: NodeId[] = [start];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    for (const nextNodeId of nodes.get(nodeId)?.nextNodeIds ?? []) queue.push(nextNodeId);
  }
  return visited;
}

function eventMatchesProfile(event: SituationEvent, activeRuleIds: ReadonlySet<RuleId>, activeMonsterIds: ReadonlySet<MonsterId>): boolean {
  const referencedRules = event.advice.flatMap((option) => option.source?.kind === "ecology" ? [option.source.ruleId] : []);
  if (event.kind !== "merchant" && event.satisfiedConditionalRuleIds?.some((ruleId) => !activeRuleIds.has(ruleId))) return false;
  if (referencedRules.some((ruleId) => !activeRuleIds.has(ruleId))) return false;
  if (event.kind !== "merchant" && event.encounter?.enemies.some((enemy) => !activeMonsterIds.has(enemy.monsterId))) return false;
  return true;
}

export function prepareExpeditionEvents(input: {
  readonly campaignSeed: string;
  readonly dungeonId: DungeonId | string;
  readonly initialRiskLevel: RiskLevel;
  readonly riskLevel: RiskLevel;
  readonly attempt: number;
  readonly map: GeneratedMap;
  readonly theme: ThemeContent;
  readonly activeRuleIds: readonly RuleId[];
  readonly activeMonsterIds: readonly MonsterId[];
}): PreparedExpeditionEvents {
  if (input.attempt < 0 || !Number.isInteger(input.attempt)) invalid("attempt가 유효하지 않다", { attempt: input.attempt });
  const rng = createRng(`${input.campaignSeed}/${input.dungeonId}/${input.attempt}`).derive("event");
  const plans = new Map<NodeId, PreparedNodePlan>();
  const categories: readonly EventKind[] = ["monster", "rest", "merchant", "special"];
  const cuts = cutDepths(input.riskLevel, input.map.layers.length);
  const cutNodes = new Set(input.map.layers.flatMap((layer, index) => cuts.includes(index) ? layer.nodeIds : []));
  for (const node of input.map.nodes) {
    if (node.kind !== "normal") continue;
    plans.set(node.id, {
      nodeId: node.id,
      category: cutNodes.has(node.id) ? "special" : rng.pick(categories),
      hiddenRole: cutNodes.has(node.id) ? "bossInfo" : "normal",
    });
  }
  const bossInfoCuts = cuts.map((depth) => ({ nodeIds: input.map.layers[depth]?.nodeIds ?? [] }));
  const allEvents = eventsForTheme(input.theme.id);
  const activeRuleIds = new Set(input.activeRuleIds);
  const activeMonsterIds = new Set(input.activeMonsterIds);
  const eligibleEvents = allEvents.filter((event) => eventMatchesProfile(event, activeRuleIds, activeMonsterIds));
  const strongClues = [...new Set(eligibleEvents.flatMap((event) => event.requiresClue ? [event.requiresClue] : []))];
  const strongLinks: StrongLinkPlan[] = [];
  const desiredStrongLinkCount = input.initialRiskLevel >= 5 ? 2 : input.initialRiskLevel >= 3 ? 1 : 0;
  const layerByNode = new Map(input.map.layers.flatMap((layer, index) => layer.nodeIds.map((nodeId) => [nodeId, index] as const)));
  const reservedNodes = new Set([...plans.values()].filter((plan) => plan.hiddenRole !== "normal").map((plan) => plan.nodeId));
  for (const clueId of strongClues.slice(0, desiredStrongLinkCount)) {
    const predecessorEvents = eligibleEvents.filter((event) => event.revealsClue === clueId);
    const followerEvents = eligibleEvents.filter((event) => event.requiresClue === clueId);
    const pairs = [...plans.values()].flatMap((predecessorNode) => predecessorNode.hiddenRole !== "normal" || reservedNodes.has(predecessorNode.nodeId)
      ? []
      : predecessorEvents.filter((event) => event.kind === predecessorNode.category).flatMap(() => {
        const reachable = reachableNodes(input.map, predecessorNode.nodeId);
        return [...plans.values()]
          .filter((followerNode) => followerNode.hiddenRole === "normal" && !reservedNodes.has(followerNode.nodeId)
            && (layerByNode.get(followerNode.nodeId) ?? -1) > (layerByNode.get(predecessorNode.nodeId) ?? -1)
            && reachable.has(followerNode.nodeId)
            && followerEvents.some((event) => event.kind === followerNode.category))
          .map((followerNode) => ({ predecessorNode, followerNode }));
      }));
    if (pairs.length === 0) invalid("strong link를 준비할 수 있는 predecessor/follower 후보가 없다", { clueId, desiredStrongLinkCount });
    const selected = rng.pick(pairs);
    plans.set(selected.predecessorNode.nodeId, { ...selected.predecessorNode, hiddenRole: "strongPredecessor", plannedClueId: clueId });
    reservedNodes.add(selected.predecessorNode.nodeId);
    reservedNodes.add(selected.followerNode.nodeId);
    strongLinks.push({ clueId, predecessorNodeId: selected.predecessorNode.nodeId, followerNodeId: selected.followerNode.nodeId });
  }
  return {
    nodePlans: plans,
    bossInfoCuts,
    strongLinks,
    usedEventIds: new Set<EventId>(),
    heldClueIds: new Set<ClueId>(),
    materializedEvents: new Map<NodeId, SituationEvent>(),
  };
}

function normalCandidates(events: readonly SituationEvent[], role: PreparedNodePlan["hiddenRole"], clueId: ClueId | undefined, targetBossId: string | undefined, strongClues: ReadonlySet<ClueId>): readonly SituationEvent[] {
  if (role === "bossInfo") return events.filter((event) => event.kind === "special" && event.targetBossId === targetBossId);
  if (role === "strongPredecessor") return events.filter((event) => event.revealsClue === clueId);
  if (role === "strongFollower") return events.filter((event) => event.requiresClue === clueId);
  return events.filter((event) => event.requiresClue === undefined && (event.revealsClue === undefined || !strongClues.has(event.revealsClue)) && event.targetBossId === undefined);
}

export function materializeNodeEvent(input: {
  readonly prepared: PreparedExpeditionEvents;
  readonly nodeId: NodeId | string;
  readonly campaignSeed: string;
  readonly dungeonId: DungeonId | string;
  readonly attempt: number;
  readonly theme: ThemeContent;
  readonly targetBossId?: string;
  readonly activeRuleIds: readonly RuleId[];
  readonly activeMonsterIds: readonly MonsterId[];
}): MaterializedNodeEvent {
  const plan = input.prepared.nodePlans.get(input.nodeId as NodeId);
  if (plan === undefined) invalid("방문할 node plan이 없다", { nodeId: input.nodeId });
  if (plan.hiddenRole === "strongFollower" && plan.plannedClueId !== undefined && !input.prepared.heldClueIds.has(plan.plannedClueId)) {
    invalid("strong follower의 선행 단서가 아직 없다", { nodeId: input.nodeId, clueId: plan.plannedClueId });
  }
  const eligibleEvents = eventsForTheme(input.theme.id).filter((event) => eventMatchesProfile(event, new Set(input.activeRuleIds), new Set(input.activeMonsterIds)));
  const strongClues = new Set(eligibleEvents.flatMap((event) => event.requiresClue ? [event.requiresClue] : []));
  const candidates = normalCandidates(eligibleEvents.filter((event) => event.kind === plan.category), plan.hiddenRole, plan.plannedClueId, input.targetBossId, strongClues);
  const available = candidates.filter((event) => !input.prepared.usedEventIds.has(event.id));
  if (available.length === 0) invalid("방문 노드의 사용 가능한 사건이 없다", { nodeId: input.nodeId, category: plan.category, role: plan.hiddenRole });
  const event = createRng(`${input.campaignSeed}/${input.dungeonId}/${input.attempt}/${input.nodeId}/${plan.hiddenRole}`).derive("event").pick([...available]);
  const usedEventIds = new Set(input.prepared.usedEventIds);
  usedEventIds.add(event.id);
  const heldClueIds = new Set(input.prepared.heldClueIds);
  if (event.revealsClue !== undefined) heldClueIds.add(event.revealsClue);
  const materializedEvents = new Map(input.prepared.materializedEvents);
  materializedEvents.set(input.nodeId as NodeId, event);
  return { event, state: cloneState(input.prepared, { usedEventIds, heldClueIds, materializedEvents }), revealedClueId: event.revealsClue };
}

export function activateStrongFollower(input: { prepared: PreparedExpeditionEvents; clueId: ClueId; nodeId: NodeId }): PreparedExpeditionEvents {
  const link = input.prepared.strongLinks.find((candidate) => candidate.clueId === input.clueId && candidate.predecessorNodeId === input.nodeId);
  if (link === undefined) return input.prepared;
  const followerNodeId = link.followerNodeId;
  const plan = input.prepared.nodePlans.get(followerNodeId);
  if (plan === undefined || plan.hiddenRole !== "normal") return input.prepared;
  const nodePlans = new Map(input.prepared.nodePlans);
  nodePlans.set(followerNodeId, { ...plan, hiddenRole: "strongFollower", plannedClueId: input.clueId });
  const strongLinks = input.prepared.strongLinks.map((candidate) => candidate === link ? { ...candidate, followerNodeId } : candidate);
  return cloneState(input.prepared, { nodePlans, strongLinks });
}

export function applyImmediateEffect<M extends Character>(input: {
  readonly members: readonly M[];
  readonly effect: ImmediateEventEffect;
}): readonly M[] {
  const effect = input.effect;
  if (effect.kind !== "hp") invalid("지원하지 않는 즉시 효과를 적용할 수 없다", { effect });
  return input.members.map((member) => {
    if (!member.alive) return member;
    const hp = Math.min(member.maxHp, Math.max(0, member.hp + effect.hpDeltaPerMember));
    return { ...member, hp, alive: hp > 0 };
  });
}

export function applyEventChoice<M extends Character>(input: {
  readonly event: SituationEvent;
  readonly decision: AdviceDecision;
  readonly members: readonly M[];
}): { readonly members: readonly M[]; readonly encounterModifier: EncounterModifier | undefined } {
  const option = input.event.advice.find((candidate) => candidate.id === input.decision.adviceId);
  if (option === undefined) invalid("사건에 없는 조언을 적용했다", { eventId: input.event.id, adviceId: input.decision.adviceId });
  if (input.event.kind === "monster") {
    return { members: input.members, encounterModifier: input.decision.executed ? option.encounterModifier : input.event.defaultEncounterModifier };
  }
  const effect = input.decision.executed ? option.immediateEffect : input.event.defaultEffect;
  return { members: effect === undefined ? input.members : applyImmediateEffect({ members: input.members, effect }), encounterModifier: undefined };
}

export function resolveMonsterEventBattle(input: {
  readonly event: SituationEvent & { readonly kind: "monster" };
  readonly modifier: EncounterModifier;
  readonly activeMonsterIds: readonly import("@/lib/domain").MonsterId[];
  readonly monsterDefs: readonly MonsterDef[];
  readonly members: readonly Character[];
  readonly classDefs: readonly ClassDef[];
  readonly seed: string;
  readonly pendingMerchantEffect: PendingMerchantEffect | null;
  readonly retrySteps: number;
}): { readonly battle: BattleResolution | null; readonly pendingMerchantEffect: PendingMerchantEffect | null } {
  if (input.modifier.avoidCombat === true) {
    return { battle: null, pendingMerchantEffect: input.pendingMerchantEffect };
  }
  if (input.event.encounter === undefined) invalid("monster 사건의 encounter가 없다", { eventId: input.event.id });
  const resolved = resolveEncounter({ base: input.event.encounter, modifier: input.modifier, activeMonsterIds: input.activeMonsterIds });
  const expanded = expandEncounter(resolved);
  const defs = new Map(input.monsterDefs.map((monster) => [monster.id, monster]));
  const retryMultiplier = retryCombatMultiplier(input.retrySteps);
  const consumed = consumePendingMerchantEffect(input.pendingMerchantEffect);
  const partyDamageMultiplier = consumed.nextBattle?.partyDamageMultiplier;
  const incomingDamageMultiplier = consumed.nextBattle?.incomingDamageMultiplier;
  const classById = new Map(input.classDefs.map((classDef) => [classDef.id, classDef]));
  const battle = resolveBattle({
    seed: input.seed,
    party: input.members.filter((member) => member.alive).map((member) => {
      const classDef = classById.get(member.classId);
      if (classDef === undefined) invalid("전투 파티의 직업 정의가 없다", { classId: member.classId });
      return { id: member.id, classId: member.classId, hp: member.hp, maxHp: member.maxHp, attack: classDef.attack, hitWeight: classDef.hitWeight };
    }),
    enemies: expanded.map((enemy) => {
      const monster = defs.get(enemy.monsterId);
      if (monster === undefined) invalid("전투 encounter의 몬스터 정의가 없다", { monsterId: enemy.monsterId });
      return {
        id: enemy.id,
        monsterId: enemy.monsterId,
        hp: monster.maxHp ?? enemy.maxHp,
        maxHp: monster.maxHp ?? enemy.maxHp,
        baseDamage: monster.baseDamage ?? enemy.baseDamage,
        targetWeightMultipliers: monster.targetWeightMultipliers,
      };
    }),
    partyDamageMultiplier: (input.modifier.partyDamageMultiplier ?? 1) * (partyDamageMultiplier ?? 1),
    incomingDamageMultiplier: (input.modifier.incomingDamageMultiplier ?? 1) * (incomingDamageMultiplier ?? 1),
    enemyHpMultiplier: retryMultiplier,
    enemyDamageMultiplier: retryMultiplier,
  });
  return { battle, pendingMerchantEffect: consumed.pendingMerchantEffect };
}
