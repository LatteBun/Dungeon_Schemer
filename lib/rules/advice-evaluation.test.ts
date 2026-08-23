import { describe, expect, it } from "vitest";
import type { AdviceDecision, CampaignDungeon, Character, SituationEvent } from "@/lib/domain";
import { createRng } from "@/lib/rng";
import { initializeCampaign } from "./campaign-init";
import {
  decideImmediateAdvice,
  disclosedRuleIds,
  finalizeImmediateAdviceTrust,
  presentAdviceOptions,
  presentShuffledAdvice,
  resolveBossInfoAdvice,
} from "./advice-evaluation";
import { getCampaignTrustModifier } from "./ending";

const DUNGEON_ID = "dungeon-spider-01" as never;
const ATTEMPT = 1;
const DEPTH = 1;

const event = {
  id: "shared-merchant-wound",
  kind: "merchant",
  title: "상처",
  description: "상인이 붕대를 내민다.",
  advice: [
    { id: "a", label: "돕기", line: "도우세요.", outcome: "help", relation: "unrelated", effectTags: [], resultText: "회복한다.", goldCost: 3, merchantEffect: { immediateHpDeltaPerMember: 1 } },
    { id: "b", label: "해치기", line: "거절하세요.", outcome: "harm", relation: "unrelated", effectTags: [], resultText: "손해 본다.", goldCost: 2, merchantEffect: { immediateHpDeltaPerMember: -1 } },
    { id: "c", label: "관찰", line: "보세요.", outcome: "neutral", relation: "unrelated", effectTags: [], resultText: "지켜본다.", goldCost: 0 },
  ],
  defaultResultText: "그냥 지나간다.",
} as unknown as SituationEvent;

const bossEvent = {
  id: "boss-info-a",
  kind: "special",
  theme: "spider",
  targetBossId: "boss-a",
  title: "보스의 습성",
  description: "보스가 공격 직전 몸을 낮춘다.",
  advice: [
    { id: "boss-help", label: "피하세요", line: "몸을 낮추면 옆으로 피하세요.", outcome: "help", relation: "consistent", source: { kind: "boss", bossRuleId: "boss-rule-a" }, effectTags: ["information"], resultText: "회피법을 기억한다." },
    { id: "boss-harm", label: "버티세요", line: "몸을 낮추면 정면으로 버티세요.", outcome: "harm", relation: "contradictory", source: { kind: "boss", bossRuleId: "boss-rule-a" }, effectTags: ["sabotage"], resultText: "잘못된 대응을 기억한다." },
    { id: "boss-neutral", label: "관찰하세요", line: "일단 거리를 두고 보세요.", outcome: "neutral", relation: "unrelated", effectTags: ["information"], resultText: "조심스럽게 관찰한다." },
  ],
  defaultResultText: "특별한 정보를 얻지 못한다.",
} as unknown as SituationEvent;

function member(personality: Character["personality"], trust: number, id = `${personality}-${trust}`): Character {
  return {
    id: id as never,
    name: id,
    classId: "test" as never,
    personality,
    maxHp: 10,
    hp: 10,
    trust,
    gold: 10,
    alive: true,
    gravelyWounded: false,
  };
}

function seedForRoll(targetRoll: number, eventId: string, adviceId: string, characterId: string): string {
  for (let index = 0; index < 20_000; index += 1) {
    const campaignSeed = `roll-${targetRoll}-${index}`;
    const roll = createRng(
      `${campaignSeed}:${DUNGEON_ID}:attempt:${ATTEMPT}:depth:${DEPTH}:event:${eventId}:advice:${adviceId}:character:${characterId}`,
    ).derive("card").int(1, 100);
    if (roll === targetRoll) return campaignSeed;
  }
  throw new Error(`테스트용 ${targetRoll} 카드 난수를 찾지 못했다`);
}

function decideAtRoll(adviceId: string, partyMember: Character, targetRoll: number, targetEvent: SituationEvent = event) {
  return decideImmediateAdvice({
    campaignSeed: seedForRoll(targetRoll, targetEvent.id, adviceId, partyMember.id),
    dungeonId: DUNGEON_ID,
    attempt: ATTEMPT,
    depth: DEPTH,
    event: targetEvent,
    adviceId: adviceId as never,
    members: [partyMember],
  });
}

function dungeon(bossId = "boss-a"): CampaignDungeon {
  return {
    id: DUNGEON_ID,
    name: "거미굴 1",
    theme: "spider",
    initialRiskLevel: 1,
    riskLevel: 1,
    activeRuleIds: ["spider-fire", "spider-vibration", "spider-carrion"] as never,
    activeMonsterIds: ["spider-cave"] as never,
    ecologyProfileId: "spider-shallow-a" as never,
    bossId: bossId as never,
    status: "unexplored",
    attempts: 0,
  };
}

describe("조언 공개", () => {
  it("플레이어에게 내부 판정 필드를 노출하지 않는다", () => {
    const options = presentAdviceOptions(event);
    expect(options).toHaveLength(3);
    expect(Object.keys(options[0])).toEqual(["id", "label", "line", "goldCost"]);
    expect(Object.keys(options[1])).toEqual(["id", "label", "line", "goldCost"]);
    expect(Object.keys(options[2])).toEqual(["id", "label", "line", "goldCost"]);
    expect(options[0]).not.toHaveProperty("outcome");
    expect(options[0]).not.toHaveProperty("relation");
    expect(options[0]).not.toHaveProperty("source");
    expect(options[0]).not.toHaveProperty("bossDamageModifier");
  });

  it("활성 규칙 공개 수는 위험도에 따라 결정적이고 부분집합을 유지한다", () => {
    const active = ["spider-shadow", "spider-fire", "spider-vibration"] as never;
    const risk1 = disclosedRuleIds({ campaignSeed: "seed", dungeonId: DUNGEON_ID, riskLevel: 1, activeRuleIds: active });
    const risk3 = disclosedRuleIds({ campaignSeed: "seed", dungeonId: DUNGEON_ID, riskLevel: 3, activeRuleIds: active });
    const risk5 = disclosedRuleIds({ campaignSeed: "seed", dungeonId: DUNGEON_ID, riskLevel: 5, activeRuleIds: active });
    expect(risk1).toHaveLength(3);
    expect(risk3).toHaveLength(2);
    expect(risk5).toHaveLength(1);
    expect(risk1.slice(0, 2)).toEqual(risk3);
    expect(risk3.slice(0, 1)).toEqual(risk5);
  });

  it("조언 순서는 입력을 보존하며 같은 입력에서 재현된다", () => {
    const first = presentShuffledAdvice({ campaignSeed: "seed", dungeonId: DUNGEON_ID, attempt: 1, depth: 2, event });
    const second = presentShuffledAdvice({ campaignSeed: "seed", dungeonId: DUNGEON_ID, attempt: 1, depth: 2, event });
    expect(first).toEqual(second);
    expect(event.advice.map((option) => option.id)).toEqual(["a", "b", "c"]);
    expect(first[0]).not.toHaveProperty("outcome");
  });
});

describe("파티원별 반응 확률", () => {
  it("중립은 신뢰 34~66의 정의로운 인물에게 기본 수용 55%를 사용한다", () => {
    const target = member("righteous", 50, "neutral-righteous");
    expect(decideAtRoll("c", target, 55).reactions[0]?.reaction).toBe("accepted");
    expect(decideAtRoll("c", target, 56).reactions[0]?.reaction).toBe("suspected");
  });

  it("도움은 기본 70%에 신뢰 구간과 성격 보정을 더한다", () => {
    const righteous = member("righteous", 50, "help-righteous");
    expect(decideAtRoll("a", righteous, 85).reactions[0]?.reaction).toBe("accepted");
    expect(decideAtRoll("a", righteous, 86).reactions[0]?.reaction).toBe("suspected");

    const suspiciousLowTrust = member("suspicious", 20, "help-suspicious-low");
    expect(decideAtRoll("a", suspiciousLowTrust, 30).reactions[0]?.reaction).toBe("accepted");
    expect(decideAtRoll("a", suspiciousLowTrust, 31).reactions[0]?.reaction).toBe("suspected");
  });

  it("방해는 적발을 먼저 판정하고 남은 구간에서 수용·의심을 나눈다", () => {
    const righteous = member("righteous", 50, "harm-righteous");
    expect(decideAtRoll("b", righteous, 30).reactions[0]?.reaction).toBe("exposed");
    expect(decideAtRoll("b", righteous, 31).reactions[0]?.reaction).toBe("accepted");
    expect(decideAtRoll("b", righteous, 66).reactions[0]?.reaction).toBe("suspected");
  });

  it("C6 캠페인 보정은 E2의 조언 반응 판정에 구조적으로 공급된다", () => {
    const campaign = initializeCampaign("c6-advice-modifier");
    const byId = { ...campaign.pool.byId };
    for (const id of campaign.pool.order.slice(0, 3)) {
      const member = byId[id];
      if (member === undefined) throw new Error(`missing character ${id}`);
      byId[id] = { ...member, trust: 0 };
    }
    const modifiedCampaign = { ...campaign, pool: { ...campaign.pool, byId } };
    const modifier = getCampaignTrustModifier(modifiedCampaign);
    const target = member("righteous", 50, "c6-modifier-target");
    const seed = seedForRoll(32, event.id, "b", target.id);
    const base = decideImmediateAdvice({
      campaignSeed: seed,
      dungeonId: DUNGEON_ID,
      attempt: ATTEMPT,
      depth: DEPTH,
      event,
      adviceId: "b" as never,
      members: [target],
    });
    const modified = decideImmediateAdvice({
      campaignSeed: seed,
      dungeonId: DUNGEON_ID,
      attempt: ATTEMPT,
      depth: DEPTH,
      event,
      adviceId: "b" as never,
      members: [target],
      campaignModifier: modifier,
    });

    expect(modifier).toEqual({ accept: -10, expose: 5 });
    expect(base.reactions[0]?.reaction).toBe("accepted");
    expect(modified.reactions[0]?.reaction).toBe("exposed");
  });

  it("죽은 파티원은 반응 판정에서 제외한다", () => {
    const alive = member("righteous", 50, "alive-member");
    const dead = { ...member("suspicious", 50, "dead-member"), alive: false };
    const decision = decideImmediateAdvice({
      campaignSeed: "dead-member-filter",
      dungeonId: DUNGEON_ID,
      attempt: ATTEMPT,
      depth: DEPTH,
      event,
      adviceId: "a" as never,
      members: [dead, alive],
    });
    expect(decision.reactions.map((reaction) => reaction.characterId)).toEqual([alive.id]);
  });
});

describe("즉시형 결과 기반 신뢰", () => {
  it("아무도 수용하지 않은 도움은 suspicionWasCostly, 방해는 suspicionWasCorrect로 검증한다", () => {
    const target = member("righteous", 50, "trust-verify");
    const base = {
      adviceId: "a" as never,
      reactions: [{ characterId: target.id, reaction: "suspected" as const }],
      executed: false,
      delayedRecords: [],
    };
    const helpDecision: AdviceDecision = { ...base, outcome: "help" };
    const harmDecision: AdviceDecision = { ...base, adviceId: "b" as never, outcome: "harm" };

    const help = finalizeImmediateAdviceTrust({ decision: helpDecision, members: [target], applied: { executed: false, resultText: "기본 결과" } });
    const harm = finalizeImmediateAdviceTrust({ decision: harmDecision, members: [target], applied: { executed: false, resultText: "기본 결과" } });

    expect(help.trustChanges).toHaveLength(1);
    expect(help.trustChanges[0]?.delta).toBeGreaterThan(0);
    expect(harm.trustChanges).toHaveLength(1);
    expect(harm.trustChanges[0]?.delta).toBeLessThan(0);
  });
});

describe("보스 정보 지연 검증", () => {
  it("수용한 보스 정보는 선택 시 신뢰를 바꾸지 않고 지연 기록만 남긴다", () => {
    const target = member("righteous", 50, "boss-accepted");
    const result = resolveBossInfoAdvice({
      campaignSeed: seedForRoll(1, bossEvent.id, "boss-help", target.id),
      dungeonId: DUNGEON_ID,
      attempt: ATTEMPT,
      depth: DEPTH,
      event: bossEvent,
      adviceId: "boss-help" as never,
      members: [target],
      dungeon: dungeon(),
    } as never);

    expect(result.decision.reactions[0]?.reaction).toBe("accepted");
    expect(result.decision.delayedRecords).toHaveLength(1);
    expect(result.decision.delayedRecords[0]?.pendingVerification).toBe(true);
    expect(result.decision.delayedRecords[0]?.bossRuleId).toBe("boss-rule-a");
    expect(result.trustChanges).toEqual([]);
  });

  it("적발된 방해 보스 정보만 선택 시 즉시 신뢰 페널티를 적용한다", () => {
    const target = member("righteous", 50, "boss-exposed");
    const result = resolveBossInfoAdvice({
      campaignSeed: seedForRoll(1, bossEvent.id, "boss-harm", target.id),
      dungeonId: DUNGEON_ID,
      attempt: ATTEMPT,
      depth: DEPTH,
      event: bossEvent,
      adviceId: "boss-harm" as never,
      members: [target],
      dungeon: dungeon(),
    } as never);

    expect(result.decision.reactions[0]?.reaction).toBe("exposed");
    expect(result.decision.delayedRecords).toEqual([]);
    expect(result.trustChanges).toHaveLength(2);
    expect(result.trustChanges.every((change) => change.delta < 0)).toBe(true);
  });

  it("현재 던전 보스와 다른 보스 정보 사건을 거부한다", () => {
    const target = member("righteous", 50, "boss-mismatch");
    expect(() => resolveBossInfoAdvice({
      campaignSeed: "boss-mismatch",
      dungeonId: DUNGEON_ID,
      attempt: ATTEMPT,
      depth: DEPTH,
      event: bossEvent,
      adviceId: "boss-help" as never,
      members: [target],
      dungeon: dungeon("boss-b"),
    } as never)).toThrow(/현재 던전 보스|보스 정보/);
  });
});
