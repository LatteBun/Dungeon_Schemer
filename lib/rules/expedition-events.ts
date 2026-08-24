import { eventsForTheme } from "@/lib/content/event-registry";
import { createRng } from "@/lib/rng";
import { RuleError } from "@/lib/domain";
import { consumePendingMerchantEffect } from "@/lib/rules/merchant";
import { resolveBattle, type BattleResolution } from "@/lib/rules/battle-engine";
import { expandEncounter, resolveEncounter } from "@/lib/rules/encounter";
import { combatMultipliersForAdvicePressure } from "@/lib/rules/advice-pressure";
import type { AdviceDecision, AdvicePressure, Character, ClassDef, EncounterModifier, EventKind, ImmediateEventEffect, MaterializedNodeEvent, MonsterDef, PendingMerchantEffect, PreparedExpeditionEvents, PreparedNodePlan, SituationEvent, StrongLinkPlan, ThemeContent } from "@/lib/domain";
import type { ClueId, DungeonId, EventId, MonsterId, NodeId, RuleId } from "@/lib/domain";
import type { GeneratedMap, RiskLevel } from "@/lib/domain";

function invalid(message: string, details: Record<string, unknown> = {}): never {
  throw new RuleError("INVALID_GENERATION", message, details);
}

function cloneState(state: PreparedExpeditionEvents, patch: Partial<PreparedExpeditionEvents>): PreparedExpeditionEvents {
  return { ...state, ...patch };
}

function cutDepths(riskLevel: RiskLevel, layerCount: number): readonly number[] {
  const count = riskLevel <= 2 ? 1 : 2;
  const first = Math.max(1, Math.floor(layerCount / 2));
  return Array.from({ length: count }, (_, index) => Math.min(layerCount - 2, first + index));
}

function reachableNodes(map: GeneratedMap, start: NodeId, blocked?: NodeId): ReadonlySet<NodeId> {
  const nodes = new Map(map.nodes.map((node) => [node.id, node]));
  const visited = new Set<NodeId>();
  const queue: NodeId[] = [start];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId) || nodeId === blocked) continue;
    visited.add(nodeId);
    for (const nextNodeId of nodes.get(nodeId)?.nextNodeIds ?? []) queue.push(nextNodeId);
  }
  return visited;
}

/**
 * 후속에 닿는 **모든** 길이 선행을 지나는가.
 *
 * 도달 가능한 것과 반드시 거쳐 가는 것은 다르다. 지도가 갈라지면 선행을 밟지
 * 않고 후속에 닿는 길이 생기고, 그 길로 간 길잡이에게는 후속 사건이 뜻을 잃는다
 * — "아까 본 그 자국" 을 본 적이 없다.
 *
 * 그때 물질화가 거부하는데, 지도는 그 지점을 고를 수 있게 이미 내놓은 뒤다.
 * 실제 플레이에서 막다른 길이었고 40 시드 중 23 이 걸렸다. 배치에서 막는다.
 *
 * 선행을 지운 지도에서 후속에 닿을 수 없으면 반드시 거쳐 간다는 뜻이다.
 */
function passesThrough(map: GeneratedMap, predecessorId: NodeId, followerId: NodeId): boolean {
  return !reachableNodes(map, map.entryNodeId, predecessorId).has(followerId);
}

/*
 * 조우 종을 그 던전에 사는 몹으로 갈아끼운다.
 *
 * `event-registry` 는 조우를 선언하지 않은 monster 사건에 `theme.monsters[0]`
 * 을 넣는다. 54개 사건 전부가 그렇다. 저자가 고른 종이 아니라 자리표시자다.
 * 그 종이 그 던전에 살지 않으면 사건이 통째로 걸러져, `monster` 노드를 계획해
 * 놓고도 물질화하지 못한다. 생태 패키지 15개 중 9개가 그랬다.
 *
 * 어느 몹이 나오는지는 사건이 아니라 던전의 생태가 정한다. 그러니 살지 않는
 * 종만 갈아끼우고, 이미 사는 종이면 그대로 둔다. 고르는 일은 노드마다 결정적
 * 이어서 같은 시드가 같은 결과를 낸다.
 */
function withLocalSpecies(event: SituationEvent, activeMonsterIds: readonly MonsterId[], rng: ReturnType<typeof createRng>): SituationEvent {
  if (event.kind !== "monster" || activeMonsterIds.length === 0) return event;

  const active = new Set<MonsterId>(activeMonsterIds);
  let local: MonsterId | undefined;
  const swap = (monsterId: MonsterId): MonsterId => {
    if (active.has(monsterId)) return monsterId;
    local ??= rng.pick([...activeMonsterIds]);
    return local;
  };
  const swapGroups = <T extends { readonly monsterId: MonsterId }>(groups: readonly T[] | undefined): readonly T[] | undefined =>
    groups?.map((group) => ({ ...group, monsterId: swap(group.monsterId) }));

  return {
    ...event,
    encounter: event.encounter === undefined ? undefined : { ...event.encounter, enemies: swapGroups(event.encounter.enemies) ?? [] },
    encounterModifier: event.encounterModifier === undefined ? undefined : {
      ...event.encounterModifier,
      addEnemies: swapGroups(event.encounterModifier.addEnemies),
      removeEnemies: swapGroups(event.encounterModifier.removeEnemies),
    },
    defaultEncounterModifier: event.defaultEncounterModifier === undefined ? undefined : {
      ...event.defaultEncounterModifier,
      addEnemies: swapGroups(event.defaultEncounterModifier.addEnemies),
      removeEnemies: swapGroups(event.defaultEncounterModifier.removeEnemies),
    },
    advice: event.advice.map((option) => option.encounterModifier === undefined ? option : {
      ...option,
      encounterModifier: {
        ...option.encounterModifier,
        addEnemies: swapGroups(option.encounterModifier.addEnemies),
        removeEnemies: swapGroups(option.encounterModifier.removeEnemies),
      },
    }),
  };
}

function eventMatchesProfile(event: SituationEvent, activeRuleIds: ReadonlySet<RuleId>, activeMonsterIds: ReadonlySet<MonsterId>): boolean {
  const referencedRules = event.advice.flatMap((option) => option.source?.kind === "ecology" ? [option.source.ruleId] : []);
  const encounterGroups = event.kind === "merchant" ? [] : [
    ...(event.encounter?.enemies ?? []),
    ...(event.encounterModifier?.addEnemies ?? []),
    ...(event.encounterModifier?.removeEnemies ?? []),
    ...(event.defaultEncounterModifier?.addEnemies ?? []),
    ...(event.defaultEncounterModifier?.removeEnemies ?? []),
    ...event.advice.flatMap((option) => [
      ...(option.encounterModifier?.addEnemies ?? []),
      ...(option.encounterModifier?.removeEnemies ?? []),
    ]),
  ];
  if (event.kind !== "merchant" && event.satisfiedConditionalRuleIds?.some((ruleId) => !activeRuleIds.has(ruleId))) return false;
  if (referencedRules.some((ruleId) => !activeRuleIds.has(ruleId))) return false;
  /* 몹 종은 여기서 거르지 않는다. withLocalSpecies 가 그 던전에 사는 몹으로
   * 갈아끼우므로, 종 때문에 사건을 버리면 후보만 비고 얻는 것이 없다. */
  void encounterGroups;
  void activeMonsterIds;
  return true;
}

/*
 * 강한 연계가 쓸 노드의 분류를 확보한다.
 *
 * 짝이 성립하려면 선행이 후속보다 앞선 층에 있고, 후속에 닿는 **모든** 길이
 * 선행을 지나야 한다. 그 조건을 만족하는 자유 노드 둘을 골라, 분류를 그 단서의
 * 사건이 요구하는 종류로 바꾼다. 지도 순서로 훑으므로 결정적이다.
 *
 * hiddenRole 은 건드리지 않는다. 그것은 뒤에서 findSelection 이 정한다.
 */
function reserveStrongLinkCategories(input: {
  readonly plans: Map<NodeId, PreparedNodePlan>;
  readonly map: GeneratedMap;
  readonly layerByNode: ReadonlyMap<NodeId, number>;
  readonly reservedNodes: ReadonlySet<NodeId>;
  readonly strongClues: readonly ClueId[];
  readonly eligibleEvents: readonly SituationEvent[];
  readonly desired: number;
}): void {
  const taken = new Set<NodeId>(input.reservedNodes);
  let placed = 0;

  for (const clueId of input.strongClues) {
    if (placed >= input.desired) return;
    const predecessorKinds = new Set(input.eligibleEvents.filter((event) => event.revealsClue === clueId).map((event) => event.kind));
    const followerKinds = new Set(input.eligibleEvents.filter((event) => event.requiresClue === clueId).map((event) => event.kind));
    if (predecessorKinds.size === 0 || followerKinds.size === 0) continue;

    const free = input.map.nodes
      .filter((node) => node.kind === "normal" && !taken.has(node.id) && input.plans.has(node.id))
      .map((node) => node.id);

    let pair: readonly [NodeId, NodeId] | undefined;
    for (const predecessorId of free) {
      const predecessorLayer = input.layerByNode.get(predecessorId) ?? -1;
      const reachable = reachableNodes(input.map, predecessorId);
      const followerId = free.find((candidate) => candidate !== predecessorId
        && (input.layerByNode.get(candidate) ?? -1) > predecessorLayer
        && reachable.has(candidate)
        && passesThrough(input.map, predecessorId, candidate));
      if (followerId !== undefined) { pair = [predecessorId, followerId]; break; }
    }
    if (pair === undefined) continue;

    const [predecessorId, followerId] = pair;
    const predecessorPlan = input.plans.get(predecessorId)!;
    const followerPlan = input.plans.get(followerId)!;
    /* 이미 맞는 분류면 그대로 둔다. 바꿀 때는 정렬해 첫 종류를 쓴다. */
    if (!predecessorKinds.has(predecessorPlan.category)) {
      input.plans.set(predecessorId, { ...predecessorPlan, category: [...predecessorKinds].sort()[0]! });
    }
    if (!followerKinds.has(followerPlan.category)) {
      input.plans.set(followerId, { ...followerPlan, category: [...followerKinds].sort()[0]! });
    }
    taken.add(predecessorId);
    taken.add(followerId);
    placed += 1;
  }
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
  const buildOptions = (): Map<ClueId, readonly { readonly clueId: ClueId; readonly predecessorNodeId: NodeId; readonly followerNodeId: NodeId }[]> => {
  const optionsByClue = new Map<ClueId, readonly { readonly clueId: ClueId; readonly predecessorNodeId: NodeId; readonly followerNodeId: NodeId }[]>();
  for (const clueId of strongClues) {
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
            && passesThrough(input.map, predecessorNode.nodeId, followerNode.nodeId)
            && followerEvents.some((event) => event.kind === followerNode.category))
          .map((followerNode) => ({ predecessorNode, followerNode }));
      }));
    optionsByClue.set(clueId, pairs.map((pair) => ({ clueId, predecessorNodeId: pair.predecessorNode.nodeId, followerNodeId: pair.followerNode.nodeId })));
  }
  return optionsByClue;
  };
  let optionsByClue = buildOptions();
  const findSelection = (clueIndex: number, selected: readonly { readonly clueId: ClueId; readonly predecessorNodeId: NodeId; readonly followerNodeId: NodeId }[], usedNodes: ReadonlySet<NodeId>): readonly { readonly clueId: ClueId; readonly predecessorNodeId: NodeId; readonly followerNodeId: NodeId }[] | undefined => {
    if (selected.length === desiredStrongLinkCount) return selected;
    if (strongClues.length - clueIndex < desiredStrongLinkCount - selected.length) return undefined;
    for (let index = clueIndex; index < strongClues.length; index += 1) {
      const clueId = strongClues[index];
      for (const option of optionsByClue.get(clueId) ?? []) {
        if (usedNodes.has(option.predecessorNodeId) || usedNodes.has(option.followerNodeId)) continue;
        const nextUsedNodes = new Set(usedNodes);
        nextUsedNodes.add(option.predecessorNodeId);
        nextUsedNodes.add(option.followerNodeId);
        const result = findSelection(index + 1, [...selected, option], nextUsedNodes);
        if (result !== undefined) return result;
      }
    }
    return undefined;
  };
  let selectedLinks = findSelection(0, [], reservedNodes);
  if (selectedLinks === undefined && desiredStrongLinkCount > 0) {
    /*
     * 분류를 필요한 만큼만 확보하고 다시 찾는다.
     *
     * 노드 분류는 하한 없는 균등 추첨이고, 보스 정보 cut 층은 통째로 special
     * 로 먼저 빠진다. 그래서 ★3 이상 던전의 9% 가 강한 연계에 쓸 분류의 노드를
     * 요구 수만큼 갖지 못한 채 나온다. 실제로 노드 21개 중 monster 가 1개인
     * 던전이 나왔고, 그때 원정이 시작조차 되지 않았다.
     *
     * 추첨 결과로 이미 되는 던전은 건드리지 않는다. 안 되는 던전에서만 짝을
     * 이룰 노드의 분류를 그 단서의 사건이 요구하는 종류로 바꾼다.
     */
    reserveStrongLinkCategories({
      plans, map: input.map, layerByNode, reservedNodes,
      strongClues, eligibleEvents, desired: desiredStrongLinkCount,
    });
    optionsByClue = buildOptions();
    selectedLinks = findSelection(0, [], reservedNodes);
  }
  if (selectedLinks === undefined) invalid("요구된 strong link 수를 만족하는 전역 후보 조합이 없다", { desiredStrongLinkCount });
  for (const link of selectedLinks) {
    const predecessorPlan = plans.get(link.predecessorNodeId);
    if (predecessorPlan === undefined) invalid("strong predecessor node plan이 없다", { nodeId: link.predecessorNodeId });
    plans.set(link.predecessorNodeId, { ...predecessorPlan, hiddenRole: "strongPredecessor", plannedClueId: link.clueId });
    strongLinks.push(link);
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
  const reservedFollower = input.prepared.strongLinks.find((link) => link.followerNodeId === input.nodeId);
  if (plan.hiddenRole === "normal" && reservedFollower !== undefined && !input.prepared.heldClueIds.has(reservedFollower.clueId)) {
    invalid("strong follower의 선행 단서가 아직 없다", { nodeId: input.nodeId, clueId: reservedFollower.clueId });
  }
  if (plan.hiddenRole === "strongFollower" && plan.plannedClueId !== undefined && !input.prepared.heldClueIds.has(plan.plannedClueId)) {
    invalid("strong follower의 선행 단서가 아직 없다", { nodeId: input.nodeId, clueId: plan.plannedClueId });
  }
  const eligibleEvents = eventsForTheme(input.theme.id).filter((event) => eventMatchesProfile(event, new Set(input.activeRuleIds), new Set(input.activeMonsterIds)));
  const strongClues = new Set(eligibleEvents.flatMap((event) => event.requiresClue ? [event.requiresClue] : []));
  const candidates = normalCandidates(eligibleEvents.filter((event) => event.kind === plan.category), plan.hiddenRole, plan.plannedClueId, input.targetBossId, strongClues);
  const available = candidates.filter((event) => !input.prepared.usedEventIds.has(event.id));
  if (available.length === 0) invalid("방문 노드의 사용 가능한 사건이 없다", { nodeId: input.nodeId, category: plan.category, role: plan.hiddenRole });
  const nodeRng = createRng(`${input.campaignSeed}/${input.dungeonId}/${input.attempt}/${input.nodeId}/${plan.hiddenRole}`).derive("event");
  const picked = nodeRng.pick([...available]);
  const event = withLocalSpecies(picked, input.activeMonsterIds, nodeRng);
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
  readonly advicePressure: AdvicePressure;
  readonly pendingMerchantEffect: PendingMerchantEffect | null;
}): { readonly battle: BattleResolution | null; readonly pendingMerchantEffect: PendingMerchantEffect | null } {
  if (input.modifier.avoidCombat === true) {
    return { battle: null, pendingMerchantEffect: input.pendingMerchantEffect };
  }
  if (input.event.encounter === undefined) invalid("monster 사건의 encounter가 없다", { eventId: input.event.id });
  const resolved = resolveEncounter({ base: input.event.encounter, modifier: input.modifier, activeMonsterIds: input.activeMonsterIds });
  const expanded = expandEncounter(resolved);
  const defs = new Map(input.monsterDefs.map((monster) => [monster.id, monster]));
  const pressure = combatMultipliersForAdvicePressure(input.advicePressure);
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
    partyDamageMultiplier: (input.modifier.partyDamageMultiplier ?? 1) * (partyDamageMultiplier ?? 1) * pressure.outgoingDamageMultiplier,
    incomingDamageMultiplier: (input.modifier.incomingDamageMultiplier ?? 1) * (incomingDamageMultiplier ?? 1) * pressure.incomingDamageMultiplier,
  });
  return { battle, pendingMerchantEffect: consumed.pendingMerchantEffect };
}
