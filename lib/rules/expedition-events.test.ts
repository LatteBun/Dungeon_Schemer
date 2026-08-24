import { describe, expect, it } from "vitest";
import { generateDungeonMap } from "@/lib/rules/dungeon-map";
import { activateStrongFollower, applyImmediateEffect, prepareExpeditionEvents, materializeNodeEvent, resolveMonsterEventBattle } from "@/lib/rules/expedition-events";
import { THEMES } from "@/lib/content/themes";
import { eventsForTheme } from "@/lib/content/event-registry";
import { CLASSES } from "@/lib/content/classes";
import { RuleError } from "@/lib/domain";
import type { ChoiceId, ClueId, DungeonId, GeneratedMap, MonsterId, NodeId, PreparedExpeditionEvents, PreparedNodePlan, RuleId, SituationEvent, StrongLinkPlan } from "@/lib/domain";
import type { CharacterId, ClassId } from "@/lib/domain";

describe("E3 원정 사건 준비와 물질화", () => {
  it("같은 입력의 준비 결과와 방문 EventId가 결정적이다", () => {
    const input = { campaignSeed: "e3-seed-0", dungeonId: "dungeon-spider-01" as DungeonId, initialRiskLevel: 3 as const, riskLevel: 3 as const, attempt: 0, activeRuleIds: THEMES[0].rules.map((rule) => rule.id), activeMonsterIds: THEMES[0].monsters.map((monster) => monster.id) };
    const map = generateDungeonMap(input);
    const first = prepareExpeditionEvents({ ...input, map, theme: THEMES[0] });
    const second = prepareExpeditionEvents({ ...input, map, theme: THEMES[0] });
    expect(first).toEqual(second);
    const node = map.layers[1].nodeIds[0];
    if (node === undefined) throw new Error("node 없음");
    const result = materializeNodeEvent({ prepared: first, nodeId: node, campaignSeed: input.campaignSeed, dungeonId: input.dungeonId, attempt: 0, theme: THEMES[0], activeRuleIds: input.activeRuleIds, activeMonsterIds: input.activeMonsterIds });
    expect(result.event.id).toBe(materializeNodeEvent({ prepared: first, nodeId: node, campaignSeed: input.campaignSeed, dungeonId: input.dungeonId, attempt: 0, theme: THEMES[0], activeRuleIds: input.activeRuleIds, activeMonsterIds: input.activeMonsterIds }).event.id);
    expect(first.strongLinks).toHaveLength(1);
    expect(first.strongLinks[0]?.followerNodeId).toBeDefined();
  });

  it("방문 시점에도 비활성 생태 규칙과 몬스터에 맞는 사건만 선택한다", () => {
    const input = { campaignSeed: "e3-seed-0", dungeonId: "dungeon-spider-01" as DungeonId, initialRiskLevel: 3 as const, riskLevel: 3 as const, attempt: 0, activeRuleIds: THEMES[0].rules.map((rule) => rule.id), activeMonsterIds: THEMES[0].monsters.map((monster) => monster.id) };
    const map = generateDungeonMap(input);
    const prepared = prepareExpeditionEvents({ ...input, map, theme: THEMES[0] });
    const monsterNode = [...prepared.nodePlans.values()].find((plan) => plan.category === "monster" && plan.hiddenRole === "normal" && !prepared.strongLinks.some((link) => link.followerNodeId === plan.nodeId));
    if (monsterNode === undefined) throw new Error("monster normal node 없음");
    expect(() => materializeNodeEvent({ prepared, nodeId: monsterNode.nodeId, campaignSeed: input.campaignSeed, dungeonId: input.dungeonId, attempt: 0, theme: THEMES[0], activeRuleIds: [], activeMonsterIds: [] })).toThrow(/사용 가능한 사건이 없다/);
  });

  it("후보 용량을 넘기던 묘지 경로도 중복 EventId 없이 모두 물질화한다", () => {
    const theme = THEMES.find((candidate) => candidate.id === "graveyard");
    if (theme === undefined) throw new Error("graveyard theme 없음");
    const input = {
      campaignSeed: "i2-run-3",
      dungeonId: "dungeon-graveyard-05" as DungeonId,
      initialRiskLevel: 5 as const,
      riskLevel: 5 as const,
      attempt: 0,
      activeRuleIds: ["graveyard-light" as RuleId, "graveyard-archer-light" as RuleId, "graveyard-desecration" as RuleId],
      activeMonsterIds: ["graveyard-mage" as MonsterId, "graveyard-archer" as MonsterId],
    };
    const map = generateDungeonMap(input);
    const visitedNodeIds = [
      "dungeon-graveyard-05:attempt:0:depth:1:node:0" as NodeId,
      "dungeon-graveyard-05:attempt:0:depth:2:node:2" as NodeId,
      "dungeon-graveyard-05:attempt:0:depth:3:node:2" as NodeId,
      "dungeon-graveyard-05:attempt:0:depth:4:node:2" as NodeId,
      "dungeon-graveyard-05:attempt:0:depth:5:node:2" as NodeId,
      "dungeon-graveyard-05:attempt:0:depth:6:node:0" as NodeId,
      "dungeon-graveyard-05:attempt:0:depth:7:node:1" as NodeId,
      "dungeon-graveyard-05:attempt:0:depth:8:node:0" as NodeId,
    ] as const;
    const materializedIds: string[] = [];
    let prepared = prepareExpeditionEvents({ ...input, map, theme });

    for (const nodeId of visitedNodeIds) {
      const result = materializeNodeEvent({
        prepared,
        nodeId,
        campaignSeed: input.campaignSeed,
        dungeonId: input.dungeonId,
        attempt: input.attempt,
        theme,
        targetBossId: "boss-graveyard-4",
        activeRuleIds: input.activeRuleIds,
        activeMonsterIds: input.activeMonsterIds,
      });
      materializedIds.push(result.event.id);
      prepared = result.revealedClueId === undefined
        ? result.state
        : activateStrongFollower({ prepared: result.state, clueId: result.revealedClueId, nodeId });
    }

    expect(new Set(materializedIds)).toHaveLength(visitedNodeIds.length);
  });

  it("실제 후보 pool에서 중립 교환이 필요한 plan을 준비하고 양쪽 경로를 물질화한다", () => {
    const fixture = capacityExchangeFixture();
    const prepared = prepareExpeditionEvents(fixture);
    const materializePath = (nodeIds: readonly NodeId[]) => {
      let state = prepared;
      const ids: string[] = [];
      for (const nodeId of nodeIds) {
        const result = materializeNodeEvent({ ...fixture, prepared: state, nodeId, targetBossId: fixture.bossEvent.targetBossId, eventCatalog: fixture.eventCatalog });
        ids.push(result.event.id);
        state = result.state;
      }
      return ids;
    };

    expect(new Set(materializePath(fixture.upperPath))).toHaveLength(fixture.upperPath.length);
    expect(new Set(materializePath(fixture.lowerPath))).toHaveLength(fixture.lowerPath.length);
  });

  it("실제 후보 pool에 어느 normal category 배정도 없으면 INVALID_GENERATION으로 거부한다", () => {
    const fixture = capacityExchangeFixture();
    const impossibleCatalog = fixture.eventCatalog.filter((event) => event.kind !== "rest");

    try {
      prepareExpeditionEvents({ ...fixture, eventCatalog: impossibleCatalog });
      throw new Error("불가능한 후보 pool이 준비되었다");
    } catch (error) {
      expect(error).toBeInstanceOf(RuleError);
      expect((error as RuleError).code).toBe("INVALID_GENERATION");
    }
  });

  it("예약된 follower는 predecessor보다 먼저 일반 사건으로 소모되지 않는다", () => {
    const input = { campaignSeed: "e3-seed-0", dungeonId: "dungeon-spider-01" as DungeonId, initialRiskLevel: 3 as const, riskLevel: 3 as const, attempt: 0, activeRuleIds: THEMES[0].rules.map((rule) => rule.id), activeMonsterIds: THEMES[0].monsters.map((monster) => monster.id) };
    const map = generateDungeonMap(input);
    const prepared = prepareExpeditionEvents({ ...input, map, theme: THEMES[0] });
    const followerNodeId = prepared.strongLinks[0]?.followerNodeId;
    if (followerNodeId === undefined) throw new Error("follower 예약 없음");
    expect(() => materializeNodeEvent({ prepared, nodeId: followerNodeId, campaignSeed: input.campaignSeed, dungeonId: input.dungeonId, attempt: 0, theme: THEMES[0], activeRuleIds: input.activeRuleIds, activeMonsterIds: input.activeMonsterIds })).toThrow(/선행 단서가 아직 없다/);
  });

  it("조언 압력이 높으면 일반전의 파티 피해는 줄고 적 피해는 늘어난다", () => {
    const event = eventsForTheme("spider").find((candidate) => candidate.kind === "monster" && candidate.encounter !== undefined);
    if (event?.kind !== "monster" || event.encounter === undefined) throw new Error("monster encounter 없음");
    const monsterDefs = THEMES[0].monsters.map((monster) => ({ ...monster, maxHp: 999, baseDamage: 10 }));
    const member = { id: "member-1" as CharacterId, name: "전사", classId: "warrior" as ClassId, personality: "prudent" as const, maxHp: 999, hp: 999, trust: 50, gold: 10, alive: true, gravelyWounded: false };
    const classDefs = CLASSES.map((classDef) => classDef.id === "warrior" ? { ...classDef, attack: 10 } : classDef);
    const base = {
      event: event as typeof event & { readonly kind: "monster" },
      modifier: {},
      activeMonsterIds: monsterDefs.map((monster) => monster.id),
      monsterDefs,
      members: [member],
      classDefs,
      seed: "battle-adapter-pressure",
    };
    const safe = resolveMonsterEventBattle({ ...base, advicePressure: 0, pendingMerchantEffect: null });
    const pressured = resolveMonsterEventBattle({ ...base, advicePressure: 3, pendingMerchantEffect: null });
    const firstPartyDamage = (result: typeof safe) => result.battle!.actions.find((action) => action.actorSide === "party")!.damage;
    const firstEnemyDamage = (result: typeof safe) => result.battle!.actions.find((action) => action.actorSide === "enemy")!.damage;

    expect(firstPartyDamage(pressured)).toBeLessThan(firstPartyDamage(safe));
    expect(firstEnemyDamage(pressured)).toBeGreaterThan(firstEnemyDamage(safe));
  });

  it("즉시 HP 효과는 생존자만 clamp하고 0 HP를 사망으로 만든다", () => {
    const members = applyImmediateEffect({
      members: [
        { id: "a" as CharacterId, name: "a", classId: "warrior" as ClassId, personality: "prudent", maxHp: 10, hp: 9, trust: 1, gold: 1, alive: true, gravelyWounded: false },
        { id: "b" as CharacterId, name: "b", classId: "mage" as ClassId, personality: "prudent", maxHp: 10, hp: 2, trust: 1, gold: 1, alive: true, gravelyWounded: false },
      ],
      effect: { kind: "hp", hpDeltaPerMember: -5 },
    });
    expect(members.map((member) => [member.hp, member.alive])).toEqual([[4, true], [0, false]]);
  });

  it("지원하지 않는 즉시 효과는 성공한 no-op으로 삼지 않는다", () => {
    expect(() => applyImmediateEffect({ members: [], effect: { kind: "gold", delta: 3 } })).toThrow(/지원하지 않는 즉시 효과/);
  });

  it("predecessor 방문 뒤 follower node의 숨은 역할을 활성화한다", () => {
    const nodePlans = new Map<NodeId, PreparedNodePlan>([
      ["pre" as NodeId, { nodeId: "pre" as NodeId, category: "monster", hiddenRole: "strongPredecessor", plannedClueId: "clue-1" as ClueId }],
      ["follow" as NodeId, { nodeId: "follow" as NodeId, category: "monster", hiddenRole: "normal" }],
    ]);
    const prepared: PreparedExpeditionEvents = { nodePlans, bossInfoCuts: [], strongLinks: [{ clueId: "clue-1" as ClueId, predecessorNodeId: "pre" as NodeId, followerNodeId: "follow" as NodeId } satisfies StrongLinkPlan], usedEventIds: new Set(), heldClueIds: new Set(["clue-1" as ClueId]), materializedEvents: new Map() };
    const activated = activateStrongFollower({ prepared, clueId: "clue-1" as ClueId, nodeId: "pre" as NodeId });
    expect(activated.nodePlans.get("follow" as NodeId)?.hiddenRole).toBe("strongFollower");
  });

  it("avoidCombat은 pending을 보존하고 실제 전투 직전에만 소비한다", () => {
    const event = eventsForTheme("spider").find((candidate) => candidate.kind === "monster");
    if (event?.kind !== "monster" || event.encounter === undefined) throw new Error("monster encounter 없음");
    const member = { id: "member-1" as CharacterId, name: "전사", classId: "warrior" as ClassId, personality: "prudent" as const, maxHp: 45, hp: 45, trust: 50, gold: 10, alive: true, gravelyWounded: false };
    const pending = { adviceId: "merchant-1" as ChoiceId, nextBattle: { partyDamageMultiplier: 0.5 } };
    const base = { event: event as typeof event & { readonly kind: "monster" }, activeMonsterIds: THEMES[0].monsters.map((monster) => monster.id), monsterDefs: THEMES[0].monsters, members: [member], classDefs: CLASSES, seed: "battle-adapter", advicePressure: 0 as const };
    const avoided = resolveMonsterEventBattle({ ...base, modifier: { avoidCombat: true }, pendingMerchantEffect: pending });
    expect(avoided.battle).toBeNull();
    expect(avoided.pendingMerchantEffect).toBe(pending);
    const fought = resolveMonsterEventBattle({ ...base, modifier: {}, pendingMerchantEffect: pending });
    expect(fought.battle).not.toBeNull();
    expect(fought.pendingMerchantEffect).toBeNull();
  });

  it("일반 몬스터의 target weight를 공통 BattleEngine에 전달한다", () => {
    const event = eventsForTheme("spider").find((candidate) => candidate.kind === "monster");
    if (event?.kind !== "monster" || event.encounter === undefined) throw new Error("monster encounter 없음");
    const monsterDefs = THEMES[0].monsters.map((monster, index) => index === 0 ? { ...monster, targetWeightMultipliers: { mage: 3 } } : monster);
    const member = { id: "member-1" as CharacterId, name: "전사", classId: "warrior" as ClassId, personality: "prudent" as const, maxHp: 45, hp: 45, trust: 50, gold: 10, alive: true, gravelyWounded: false };
    const result = resolveMonsterEventBattle({ event: event as typeof event & { readonly kind: "monster" }, activeMonsterIds: monsterDefs.map((monster) => monster.id), monsterDefs, members: [member], classDefs: CLASSES, seed: "battle-adapter-weight", modifier: {}, pendingMerchantEffect: null, advicePressure: 0 });
    expect(result.battle?.enemies[0]?.targetWeightMultipliers).toEqual({ mage: 3 });
  });
});

function capacityExchangeFixture() {
  const theme = THEMES.find((candidate) => candidate.id === "graveyard");
  if (theme === undefined) throw new Error("graveyard theme 없음");
  const events = eventsForTheme(theme.id);
  const monster = events.find((event) => event.id === "graveyard-light-candle-mage");
  const rest = events.filter((event) => event.kind === "rest").slice(0, 2);
  const merchant = events.find((event) => event.kind === "merchant");
  const special = events.find((event) => event.kind === "special" && event.targetBossId === undefined);
  const bossEvent = events.find((event) => event.kind === "special" && event.targetBossId !== undefined);
  if (monster === undefined || rest.length !== 2 || merchant === undefined || special === undefined || bossEvent?.targetBossId === undefined) {
    throw new Error("capacity fixture event 없음");
  }
  const eventCatalog: readonly SituationEvent[] = [monster, ...rest, merchant, special, bossEvent];
  const entry = "capacity:entry" as NodeId;
  const sharedFirst = "capacity:shared:first" as NodeId;
  const sharedSecond = "capacity:shared:second" as NodeId;
  const upperBranch = "capacity:upper:branch" as NodeId;
  const lowerBranch = "capacity:lower:branch" as NodeId;
  const bossInfo = "capacity:boss-info" as NodeId;
  const upperTail = "capacity:upper:tail" as NodeId;
  const lowerTail = "capacity:lower:tail" as NodeId;
  const exit = "capacity:exit" as NodeId;
  const boss = "capacity:boss" as NodeId;
  const map: GeneratedMap = {
    entryNodeId: entry,
    bossNodeId: boss,
    layers: [
      { depth: 1, nodeIds: [sharedFirst] },
      { depth: 2, nodeIds: [sharedSecond] },
      { depth: 3, nodeIds: [upperBranch, lowerBranch] },
      { depth: 4, nodeIds: [bossInfo] },
      { depth: 5, nodeIds: [upperTail, lowerTail] },
      { depth: 6, nodeIds: [exit] },
    ],
    nodes: [
      { id: entry, kind: "entry", nextNodeIds: [sharedFirst] },
      { id: sharedFirst, kind: "normal", nextNodeIds: [sharedSecond] },
      { id: sharedSecond, kind: "normal", nextNodeIds: [upperBranch, lowerBranch] },
      { id: upperBranch, kind: "normal", nextNodeIds: [bossInfo] },
      { id: lowerBranch, kind: "normal", nextNodeIds: [bossInfo] },
      { id: bossInfo, kind: "normal", nextNodeIds: [upperTail, lowerTail] },
      { id: upperTail, kind: "normal", nextNodeIds: [exit] },
      { id: lowerTail, kind: "normal", nextNodeIds: [exit] },
      { id: exit, kind: "normal", nextNodeIds: [boss] },
      { id: boss, kind: "boss", nextNodeIds: [] },
    ],
  };
  return {
    campaignSeed: "capacity-exchange-1380",
    dungeonId: "dungeon-capacity-exchange" as DungeonId,
    initialRiskLevel: 1 as const,
    riskLevel: 1 as const,
    attempt: 0,
    map,
    theme,
    activeRuleIds: theme.rules.map((rule) => rule.id),
    activeMonsterIds: theme.monsters.map((monsterDef) => monsterDef.id),
    eventCatalog,
    bossEvent,
    upperPath: [sharedFirst, sharedSecond, upperBranch, bossInfo, upperTail, exit],
    lowerPath: [sharedFirst, sharedSecond, lowerBranch, bossInfo, lowerTail, exit],
  };
}

/** 그 시드로 ★3 던전 하나를 준비한다. 짝이 안 놓이면 `null` 이다. */
function prepareForSeed(seed: string) {
  const input = {
    campaignSeed: seed,
    dungeonId: "dungeon-spider-01" as DungeonId,
    initialRiskLevel: 3 as const,
    riskLevel: 3 as const,
    attempt: 0,
    activeRuleIds: THEMES[0].rules.map((rule) => rule.id),
    activeMonsterIds: THEMES[0].monsters.map((monster) => monster.id),
  };
  const map = generateDungeonMap(input);
  try {
    return { map, prepared: prepareExpeditionEvents({ ...input, map, theme: THEMES[0] }) };
  } catch { return null; }
}

/** 한 노드를 지운 지도에서 닿을 수 있는 곳. */
function walk(map: ReturnType<typeof generateDungeonMap>, start: NodeId, blocked: NodeId): ReadonlySet<NodeId> {
  const byId = new Map(map.nodes.map((node) => [node.id, node]));
  const seen = new Set<NodeId>();
  const queue: NodeId[] = [start];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (seen.has(nodeId) || nodeId === blocked) continue;
    seen.add(nodeId);
    for (const nextNodeId of byId.get(nodeId)?.nextNodeIds ?? []) queue.push(nextNodeId);
  }
  return seen;
}

describe("강한 연계의 배치", () => {
  /*
   * 후속에 닿는 모든 길이 선행을 지나야 한다.
   *
   * 도달 가능하기만 하면 갈림길에서 선행을 건너뛸 수 있고, 그러면 후속 사건이
   * 뜻을 잃는다 — "아까 본 그 자국" 을 본 적이 없다. 물질화가 그때 거부하는데,
   * 지도는 이미 그 지점을 고를 수 있게 내놓은 뒤다.
   */
  it("선행을 지나지 않고 후속에 닿는 길이 없다", () => {
    const checked: string[] = [];
    for (let index = 0; index < 25; index += 1) {
      const prepared = prepareForSeed(`link-dominance-${index}`);
      if (prepared === null) continue;
      for (const link of prepared.prepared.strongLinks) {
        checked.push(link.clueId);
        const withoutPredecessor = walk(prepared.map, prepared.map.entryNodeId, link.predecessorNodeId);

        expect(withoutPredecessor.has(link.followerNodeId)).toBe(false);
      }
    }

    /* 짝이 하나도 없으면 위 단언이 한 번도 돌지 않는다. */
    expect(checked.length).toBeGreaterThan(0);
  });

  it("선행이 후속보다 앞선 층에 있다", () => {
    for (let index = 0; index < 25; index += 1) {
      const prepared = prepareForSeed(`link-layer-${index}`);
      if (prepared === null) continue;
      const layerOf = new Map(prepared.map.layers.flatMap((layer, depth) => layer.nodeIds.map((id) => [id, depth] as const)));
      for (const link of prepared.prepared.strongLinks) {
        expect(layerOf.get(link.predecessorNodeId)!).toBeLessThan(layerOf.get(link.followerNodeId)!);
      }
    }
  });
});
