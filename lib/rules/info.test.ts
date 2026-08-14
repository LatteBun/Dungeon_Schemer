import { describe, expect, it } from "vitest";
import { CAMPAIGN_GRADE_CONFIG } from "@/lib/content/dungeons";
import { INFO_CARDS } from "@/lib/content/info-cards";
import { GRADES, RuleError, TRUTH_TYPES } from "@/lib/domain";
import type {
  CampaignMember,
  CardId,
  ClassId,
  ExpeditionState,
  InfoCard,
  MapNode,
  MemberId,
  NodeId,
  PartyMember,
} from "@/lib/domain";
import { createRng } from "@/lib/rng";
import type { Rng } from "@/lib/rng";
import { createFixtureExpeditionState } from "@/lib/rules/fixtures";
import { generateGradeMap } from "@/lib/rules/map";
import { TRUST_RULES } from "@/lib/rules/trust";
import {
  BOSS_DAMAGE_MODIFIERS,
  applyInfoRecord,
  bossDamageModifier,
  createInfoOpportunity,
  evaluatePartyInfoCard,
  toInfoRecords,
} from "@/lib/rules/info";

function scriptedRng(...values: number[]): Rng {
  let index = 0;
  const rng: Rng = {
    seed: "scripted",
    float: () => {
      throw new Error("이 테스트는 float를 사용하지 않는다.");
    },
    int: (min, max) => {
      const value = values[index++];
      if (value === undefined || value < min || value > max) {
        throw new Error(
          "허용 범위 " + min + "~" + max + " 밖의 scriptedRng 값: " + value,
        );
      }
      return value;
    },
    pick: <T>(items: readonly T[]) => items[0] as T,
    shuffle: <T>(items: readonly T[]) => [...items],
    derive: () => rng,
  };
  return rng;
}

function member(
  personality: PartyMember["personality"],
  trust = 50,
  alive = true,
): PartyMember {
  return {
    id: ("member-" + personality + "-" + trust) as MemberId,
    name: personality,
    classId: "test-class" as ClassId,
    personality,
    trust,
    alive,
  };
}

function campaignMember(personality: PartyMember["personality"]): CampaignMember {
  return {
    ...member(personality),
    currentHp: 80,
    maxHp: 100,
    carriedGold: 25,
    memory: [],
  };
}

function card(
  truthType: InfoCard["truthType"],
  subject: InfoCard["subject"] = "event",
): InfoCard {
  return {
    id: ("card-" + truthType + "-" + subject) as CardId,
    truthType,
    subject,
    topic: "테스트 정보",
    text: truthType + " 카드",
  };
}

function infoNode(overrides: Partial<MapNode> = {}): MapNode {
  return {
    id: "node-path-1-depth-1" as NodeId,
    depth: 1,
    nextNodeIds: [],
    eventId: "event-goblin-ambush" as MapNode["eventId"],
    riskSummary: "위험 낮음",
    hasInfoOpportunity: true,
    bossRelatedInfoCount: 0,
    ...overrides,
  };
}

function subjectsOf(pending: { cardIds: readonly CardId[] }): string[] {
  const byId = new Map(INFO_CARDS.map((entry) => [entry.id as string, entry]));
  return pending.cardIds.map((id) => byId.get(id as string)!.subject);
}

function generationErrorOf(call: () => unknown): RuleError {
  let caught: unknown;
  try {
    call();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(RuleError);
  return caught as RuleError;
}

describe("정보 카드 반응", () => {
  it("파티원마다 같은 카드에 다른 반응과 즉시 신뢰 판정 결과를 낸다", () => {
    const party = [member("righteous"), member("greedy"), member("prudent")];

    const truth = evaluatePartyInfoCard({
      card: card("truth"),
      party,
      cardRng: scriptedRng(1, 100, 100),
      trustRng: scriptedRng(0),
    });
    expect(truth.audience).toBe("party");
    expect(truth.memberResults.map((result) => result.reaction)).toEqual([
      "accepted",
      "suspected",
      "suspected",
    ]);
    expect(truth.memberResults[0].trustEvaluation?.change.reason).toBe(
      TRUST_RULES.righteous.actHonestly.reason,
    );

    const neutral = evaluatePartyInfoCard({
      card: card("neutral"),
      party,
      cardRng: scriptedRng(1, 100, 100),
      trustRng: scriptedRng(),
    });
    expect(neutral.memberResults[0].trustEvaluation).toBeNull();

    const lie = evaluatePartyInfoCard({
      card: card("lie"),
      party,
      cardRng: scriptedRng(31, 1, 100),
      trustRng: scriptedRng(0, 0),
    });
    expect(lie.memberResults.map((result) => result.reaction)).toEqual([
      "accepted",
      "exposed",
      "suspected",
    ]);
    expect(lie.memberResults[0].trustEvaluation?.change.reason).toBe(
      TRUST_RULES.righteous.deceptionAccepted.reason,
    );
    expect(lie.memberResults[1].trustEvaluation?.change.reason).toBe(
      TRUST_RULES.greedy.deceptionExposed.reason,
    );
    expect(lie.memberResults[2].trustEvaluation).toBeNull();
  });

  it("거짓 카드의 수용·의심·적발 플래그를 파티원별로 만든다", () => {
    const result = evaluatePartyInfoCard({
      card: card("lie"),
      party: [member("suspicious", 0), member("impulsive", 100), member("greedy")],
      cardRng: scriptedRng(1, 30, 100),
      trustRng: scriptedRng(0, 0),
    });

    expect(result.memberResults.map((entry) => entry.reaction)).toEqual([
      "exposed",
      "accepted",
      "suspected",
    ]);
    expect(result.memberResults.map((entry) => entry.pendingVerification)).toEqual([
      false,
      true,
      false,
    ]);
    expect(
      result.memberResults.map((entry) => entry.pendingSuspicionEvaluation),
    ).toEqual([false, false, true]);
  });

  it("확률 하한·상한과 거짓의 최소 의심 구간을 지킨다", () => {
    const at = (
      truthType: InfoCard["truthType"],
      party: PartyMember[],
      roll: number,
      trustRolls: number[],
    ) => evaluatePartyInfoCard({
      card: card(truthType),
      party,
      cardRng: scriptedRng(roll),
      trustRng: scriptedRng(...trustRolls),
    }).memberResults[0].reaction;

    const highTrustImpulsive = [member("impulsive", 100)];
    const lowTrustSuspicious = [member("suspicious", 0)];

    expect(at("truth", highTrustImpulsive, 95, [0])).toBe("accepted");
    expect(at("truth", highTrustImpulsive, 96, [])).toBe("suspected");
    expect(at("lie", lowTrustSuspicious, 50, [])).toBe("exposed");
    expect(at("lie", lowTrustSuspicious, 51, [0])).toBe("accepted");
    expect(at("lie", lowTrustSuspicious, 56, [])).toBe("suspected");
  });

  it("사망자를 제외하고 입력을 바꾸지 않으며 같은 시드에서 재현된다", () => {
    const party = [member("prudent"), member("greedy", 50, false)];
    const snapshot = structuredClone(party);
    const evaluate = () => evaluatePartyInfoCard({
      card: card("truth"),
      party,
      cardRng: createRng("same").derive("card"),
      trustRng: createRng("same").derive("trust"),
    });

    const first = evaluate();
    expect(first).toEqual(evaluate());
    expect(first.memberResults).toHaveLength(1);
    expect(party).toEqual(snapshot);
    expect(first.memberResults[0].member).not.toBe(party[0]);
  });

  it("캠페인 인물을 넣으면 HP·소지 골드·기억이 결과에도 남는다", () => {
    const result = evaluatePartyInfoCard({
      card: card("truth"),
      party: [campaignMember("righteous")],
      cardRng: scriptedRng(1),
      trustRng: scriptedRng(0),
    });

    expect(result.memberResults[0].member.currentHp).toBe(80);
    expect(result.memberResults[0].member.carriedGold).toBe(25);
    expect(result.memberResults[0].member.memory).toEqual([]);
  });
});

describe("보스 피해 보정", () => {
  it("보스 주제를 수용한 경우에만 표의 값을 만든다", () => {
    expect(BOSS_DAMAGE_MODIFIERS).toEqual({ truth: -0.2, neutral: -0.1, lie: 0.25 });
    for (const truthType of TRUTH_TYPES) {
      expect(bossDamageModifier(card(truthType, "boss"), "accepted"))
        .toBe(BOSS_DAMAGE_MODIFIERS[truthType]);
      expect(bossDamageModifier(card(truthType, "boss"), "suspected")).toBe(0);
      expect(bossDamageModifier(card(truthType, "boss"), "exposed")).toBe(0);
      expect(bossDamageModifier(card(truthType, "route"), "accepted")).toBe(0);
    }
  });

  it("실제 콘텐츠의 중립 보스 카드가 -10% 보정을 만든다", () => {
    const neutralBoss = INFO_CARDS.find(
      (entry) => entry.subject === "boss" && entry.truthType === "neutral",
    );

    expect(neutralBoss, "중립 보스 카드가 콘텐츠에 없다").toBeDefined();
    expect(bossDamageModifier(neutralBoss!, "accepted")).toBe(-0.1);
  });

  it("판정 결과의 보정이 카드 한 장 기준으로 기록된다", () => {
    const result = evaluatePartyInfoCard({
      card: card("truth", "boss"),
      party: [member("righteous"), member("suspicious")],
      cardRng: scriptedRng(1, 100),
      trustRng: scriptedRng(0),
    });

    expect(result.memberResults.map((entry) => entry.bossDamageModifier))
      .toEqual([-0.2, 0]);
  });
});

describe("정보 기회 카드 후보", () => {
  it("보스 보장 지점은 보스 주제 카드만 제시한다", () => {
    const pending = createInfoOpportunity(
      infoNode({ bossRelatedInfoCount: 1 }),
      createRng("보장").derive("card"),
    );

    expect(pending.nodeId).toBe("node-path-1-depth-1");
    expect(new Set(subjectsOf(pending))).toEqual(new Set(["boss"]));
    expect(pending.bossRelatedCardCount).toBe(pending.cardIds.length);
  });

  it("보장 지점도 진실·거짓·중립 세 유형을 한 장씩 제시한다", () => {
    const byId = new Map(INFO_CARDS.map((entry) => [entry.id as string, entry]));
    const pending = createInfoOpportunity(
      infoNode({ bossRelatedInfoCount: 1 }),
      createRng("세유형").derive("card"),
    );

    expect(pending.cardIds).toHaveLength(3);
    expect(pending.cardIds.map((id) => byId.get(id as string)!.truthType))
      .toEqual([...TRUTH_TYPES]);
  });

  it("일반 정보 지점은 보스 주제를 제외하고 세 유형을 한 장씩 제시한다", () => {
    const byId = new Map(INFO_CARDS.map((entry) => [entry.id as string, entry]));
    const pending = createInfoOpportunity(infoNode(), createRng("일반").derive("card"));

    expect(pending.cardIds).toHaveLength(3);
    expect(subjectsOf(pending)).not.toContain("boss");
    expect(pending.bossRelatedCardCount).toBe(0);
    expect(pending.cardIds.map((id) => byId.get(id as string)!.truthType))
      .toEqual([...TRUTH_TYPES]);
  });

  it("정보 기회가 없는 지점은 거부한다", () => {
    const error = generationErrorOf(() => createInfoOpportunity(
      infoNode({ hasInfoOpportunity: false }),
      createRng("없음").derive("card"),
    ));

    expect(error.code).toBe("INVALID_GENERATION");
    expect(error.message).toMatch(/정보 기회/);
  });

  it("후보가 두 장 미만이면 거부한다", () => {
    const error = generationErrorOf(() => createInfoOpportunity(
      infoNode({ bossRelatedInfoCount: 1 }),
      createRng("한장").derive("card"),
      { cards: [card("truth", "boss")] },
    ));

    expect(error.code).toBe("INVALID_GENERATION");
    expect(error.message).toMatch(/두 장|2장/);
  });

  it("같은 시드는 같은 후보를 만든다", () => {
    const create = () => createInfoOpportunity(infoNode(), createRng("재현").derive("card"));

    expect(create()).toEqual(create());
  });
});

describe("E1 지도와의 연결", () => {
  it("경로에서 보스 카드만 제시하는 기회 수가 등급 보장과 같다", () => {
    for (const grade of GRADES) {
      const map = generateGradeMap(grade, createRng(`보장-${grade}`).derive("map"));
      const byId = new Map(map.nodes.map((node) => [node.id as string, node]));

      for (const path of map.paths) {
        const opportunities = path.nodeIds
          .map((id) => byId.get(id as string)!)
          .filter((node) => node.hasInfoOpportunity)
          .map((node) => createInfoOpportunity(node, createRng(`${grade}/${node.id}`).derive("card")));

        expect(opportunities).toHaveLength(CAMPAIGN_GRADE_CONFIG[grade].infoOpportunityCount);
        expect(opportunities.filter((pending) => pending.bossRelatedCardCount > 0))
          .toHaveLength(CAMPAIGN_GRADE_CONFIG[grade].bossRelatedInfoCount);
      }
    }
  });
});

describe("탐험 기록", () => {
  it("판정 결과를 파티원별 기록으로 바꾼다", () => {
    const bossLie = card("lie", "boss");
    const records = toInfoRecords(
      bossLie,
      evaluatePartyInfoCard({
        card: bossLie,
        party: [member("impulsive", 100), member("suspicious", 0)],
        cardRng: scriptedRng(30, 1),
        trustRng: scriptedRng(0, 0),
      }),
    );

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      cardId: bossLie.id,
      truthType: "lie",
      subject: "boss",
      reaction: "accepted",
      modifier: 0.25,
      pendingVerification: true,
    });
    expect(records[1]).toMatchObject({
      reaction: "exposed",
      modifier: 0,
      pendingVerification: false,
    });
  });

  it("기록과 로그를 덧붙이고 원본 상태를 바꾸지 않는다", () => {
    const expedition: ExpeditionState = createFixtureExpeditionState();
    const snapshot = structuredClone(expedition);
    const record = {
      cardId: "card-truth-boss" as CardId,
      truthType: "truth" as const,
      subject: "boss" as const,
      memberId: "member-001" as MemberId,
      reaction: "accepted" as const,
      modifier: -0.2,
      pendingVerification: false,
    };

    const next = applyInfoRecord(applyInfoRecord(expedition, record), record);

    expect(next.infoRecords).toHaveLength(2);
    expect(next.log).toHaveLength(2);
    expect(next.log.map((entry) => entry.kind)).toEqual(["info", "info"]);
    expect(next.log.map((entry) => entry.at)).toEqual([0, 1]);
    expect(next.log[0].memberIds).toEqual(["member-001"]);
    expect(expedition).toEqual(snapshot);
  });
});
