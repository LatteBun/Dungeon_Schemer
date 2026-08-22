import { describe, expect, it } from "vitest";
import { generateDungeonMap } from "@/lib/rules/dungeon-map";
import { activateStrongFollower, applyImmediateEffect, prepareExpeditionEvents, materializeNodeEvent, resolveMonsterEventBattle, retryCombatMultiplier } from "@/lib/rules/expedition-events";
import { THEMES } from "@/lib/content/themes";
import { eventsForTheme } from "@/lib/content/event-registry";
import { CLASSES } from "@/lib/content/classes";
import type { ChoiceId, ClueId, DungeonId, NodeId, PreparedExpeditionEvents, PreparedNodePlan, StrongLinkPlan } from "@/lib/domain";
import type { CharacterId, ClassId } from "@/lib/domain";

describe("E3 원정 사건 준비와 물질화", () => {
  it("같은 입력의 준비 결과와 방문 EventId가 결정적이다", () => {
    const input = { campaignSeed: "e3-seed", dungeonId: "dungeon-spider-01" as DungeonId, initialRiskLevel: 3 as const, riskLevel: 3 as const, attempt: 0 };
    const map = generateDungeonMap(input);
    const first = prepareExpeditionEvents({ ...input, map, theme: THEMES[0] });
    const second = prepareExpeditionEvents({ ...input, map, theme: THEMES[0] });
    expect(first).toEqual(second);
    const node = map.layers[1].nodeIds[0];
    if (node === undefined) throw new Error("node 없음");
    const result = materializeNodeEvent({ prepared: first, nodeId: node, campaignSeed: input.campaignSeed, dungeonId: input.dungeonId, attempt: 0, theme: THEMES[0] });
    expect(result.event.id).toBe(materializeNodeEvent({ prepared: first, nodeId: node, campaignSeed: input.campaignSeed, dungeonId: input.dungeonId, attempt: 0, theme: THEMES[0] }).event.id);
  });

  it("재도전 배율은 0단계에서 1이고 단조 증가한다", () => {
    expect(retryCombatMultiplier(0)).toBe(1);
    expect(retryCombatMultiplier(1)).toBeGreaterThan(retryCombatMultiplier(0));
    expect(retryCombatMultiplier(2)).toBeGreaterThan(retryCombatMultiplier(1));
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

  it("predecessor 방문 뒤 follower node의 숨은 역할을 활성화한다", () => {
    const nodePlans = new Map<NodeId, PreparedNodePlan>([
      ["pre" as NodeId, { nodeId: "pre" as NodeId, category: "monster", hiddenRole: "strongPredecessor", plannedClueId: "clue-1" as ClueId }],
      ["follow" as NodeId, { nodeId: "follow" as NodeId, category: "monster", hiddenRole: "normal" }],
    ]);
    const prepared: PreparedExpeditionEvents = { nodePlans, bossInfoCuts: [], strongLinks: [{ clueId: "clue-1" as ClueId, predecessorNodeId: "pre" as NodeId } satisfies StrongLinkPlan], usedEventIds: new Set(), heldClueIds: new Set(["clue-1" as ClueId]), materializedEvents: new Map() };
    const activated = activateStrongFollower({ prepared, clueId: "clue-1" as ClueId, nodeId: "pre" as NodeId, followerNodeId: "follow" as NodeId });
    expect(activated.nodePlans.get("follow" as NodeId)?.hiddenRole).toBe("strongFollower");
  });

  it("avoidCombat은 pending을 보존하고 실제 전투 직전에만 소비한다", () => {
    const event = eventsForTheme("spider").find((candidate) => candidate.kind === "monster");
    if (event?.kind !== "monster" || event.encounter === undefined) throw new Error("monster encounter 없음");
    const member = { id: "member-1" as CharacterId, name: "전사", classId: "warrior" as ClassId, personality: "prudent" as const, maxHp: 45, hp: 45, trust: 50, gold: 10, alive: true, gravelyWounded: false };
    const pending = { adviceId: "merchant-1" as ChoiceId, nextBattle: { partyDamageMultiplier: 0.5 } };
    const base = { event: event as typeof event & { readonly kind: "monster" }, activeMonsterIds: THEMES[0].monsters.map((monster) => monster.id), monsterDefs: THEMES[0].monsters, members: [member], classDefs: CLASSES, seed: "battle-adapter", retrySteps: 0 };
    const avoided = resolveMonsterEventBattle({ ...base, modifier: { avoidCombat: true }, pendingMerchantEffect: pending });
    expect(avoided.battle).toBeNull();
    expect(avoided.pendingMerchantEffect).toBe(pending);
    const fought = resolveMonsterEventBattle({ ...base, modifier: {}, pendingMerchantEffect: pending });
    expect(fought.battle).not.toBeNull();
    expect(fought.pendingMerchantEffect).toBeNull();
  });
});
