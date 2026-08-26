import { describe, expect, it } from "vitest";
import { PROMOTION_GOLD, PROMOTION_REPUTATION, createCampaignStatistics } from "@/lib/domain";
import type { BoardOffer, CampaignEnding, CampaignState, Character, CharacterId } from "@/lib/domain";
import { createBoardOffers, createOfferReward } from "./board";
import { initializeCampaign } from "./campaign-init";
import {
  countEmergencyEligibleAdventurers,
  countLivingZeroTrust,
  evaluateCampaignEnding,
  evaluateImmediateDistrustEnding,
  getCampaignTrustModifier,
  isPersonnelExhausted,
} from "./ending";

function campaignWith(
  members: readonly { classId: string; gravelyWounded?: boolean; alive?: boolean; trust?: number }[],
): CampaignState {
  const campaign = initializeCampaign("ending-exhaustion-test");
  const byId = Object.fromEntries(Object.entries(campaign.pool.byId).map(([id, member]) => [
    id,
    { ...member, alive: false, hp: 0, trust: 0 },
  ])) as Record<string, Character>;
  for (const entry of members) {
    const member = Object.values(campaign.pool.byId).find((candidate) => candidate.classId === entry.classId);
    if (member === undefined) throw new Error(`missing class ${entry.classId}`);
    byId[member.id] = {
      ...member,
      alive: entry.alive ?? true,
      hp: entry.alive === false ? 0 : member.maxHp,
      trust: entry.trust ?? 50,
      gravelyWounded: entry.gravelyWounded ?? false,
    };
  }
  return { ...campaign, pool: { ...campaign.pool, byId } };
}

function campaignWithThreeLivingWarriors(): CampaignState {
  const campaign = initializeCampaign("ending-three-warriors-test");
  const warriorIds = campaign.pool.order.filter((id) => campaign.pool.byId[id]?.classId === "warrior").slice(0, 3);
  if (warriorIds.length !== 3) throw new Error("missing three warriors");
  const livingWarriors = new Set(warriorIds);
  const byId = Object.fromEntries(Object.entries(campaign.pool.byId).map(([id, member]) => [
    id,
    livingWarriors.has(member.id)
      ? { ...member, alive: true, hp: member.maxHp, trust: 50 }
      : { ...member, alive: false, hp: 0, trust: 0 },
  ])) as Record<string, Character>;
  return { ...campaign, pool: { ...campaign.pool, byId } };
}

function campaignWithZeroTrust(count: number): CampaignState {
  const campaign = initializeCampaign(`ending-zero-trust-${count}`);
  const byId = Object.fromEntries(Object.entries(campaign.pool.byId).map(([id, member]) => [
    id,
    { ...member, alive: false, hp: 0, trust: 0 },
  ])) as Record<string, Character>;
  for (const id of campaign.pool.order.slice(0, count)) {
    const member = byId[id];
    if (member === undefined) throw new Error(`missing character ${id}`);
    byId[id] = { ...member, alive: true, hp: member.maxHp, trust: 0 };
  }
  return { ...campaign, pool: { ...campaign.pool, byId } };
}

describe("isPersonnelExhausted", () => {
  it("중상자를 포함해 세 직업을 만들 수 있으면 인력 소진이 아니다", () => {
    expect(isPersonnelExhausted(campaignWith([
      { classId: "warrior" },
      { classId: "rogue" },
      { classId: "cleric", gravelyWounded: true },
    ]))).toBe(false);
  });

  it("사망자와 신뢰 0을 뺀 뒤 세 직업을 못 만들면 인력 소진이다", () => {
    expect(isPersonnelExhausted(campaignWith([
      { classId: "warrior" },
      { classId: "rogue" },
      { classId: "mage", alive: false },
      { classId: "cleric", trust: 0 },
    ]))).toBe(true);
  });
});

describe("countEmergencyEligibleAdventurers", () => {
  it("중상자는 포함하고 사망자와 신뢰 0은 제외한다", () => {
    const campaign = campaignWith([
      { classId: "warrior" },
      { classId: "rogue", gravelyWounded: true },
      { classId: "mage", alive: false },
      { classId: "cleric", trust: 0 },
    ]);

    expect(countEmergencyEligibleAdventurers(campaign)).toBe(2);
  });

  it("표시 인원이 셋이어도 직업이 겹치면 인력 소진일 수 있다", () => {
    const campaign = campaignWithThreeLivingWarriors();

    expect(countEmergencyEligibleAdventurers(campaign)).toBe(3);
    expect(isPersonnelExhausted(campaign)).toBe(true);
  });
});

describe("CampaignEnding 계약", () => {
  it("엔딩 제목과 결정적 트리거 캐릭터 ID를 표현한다", () => {
    const campaign = campaignWith([
      { classId: "warrior", trust: 0 },
      { classId: "rogue", trust: 0 },
    ]);
    const ending: CampaignEnding = {
      kind: "denounced",
      title: "누적 고발",
      reason: "살아 있는 용사 5명 이상이 길잡이를 불신합니다.",
      finalRank: "B",
      triggerCharacterIds: [campaign.pool.order[0]!],
    };

    expect(ending.triggerCharacterIds).toEqual([campaign.pool.order[0]]);
  });
});

describe("신뢰 0 누적 보정", () => {
  it("살아 있는 신뢰 0만 세고 2~4명 보정을 적용한다", () => {
    expect(countLivingZeroTrust(campaignWithZeroTrust(2))).toBe(2);
    expect(getCampaignTrustModifier(campaignWithZeroTrust(2))).toEqual({ accept: -5, expose: 0 });
    expect(getCampaignTrustModifier(campaignWithZeroTrust(3))).toEqual({ accept: -10, expose: 5 });
    expect(getCampaignTrustModifier(campaignWithZeroTrust(4))).toEqual({ accept: -15, expose: 15 });
    expect(getCampaignTrustModifier(campaignWithZeroTrust(5))).toEqual({ accept: 0, expose: 0 });
  });
});

describe("즉시 불신 엔딩", () => {
  it("생존 파티원 전원이 신뢰 0이면 결정적 결과를 반환한다", () => {
    const campaign = campaignWithZeroTrust(2);
    const first = campaign.pool.byId[campaign.pool.order[0]!];
    const second = campaign.pool.byId[campaign.pool.order[1]!];
    if (first === undefined || second === undefined) throw new Error("missing party member");

    const result = evaluateImmediateDistrustEnding(campaign, [second, first]);

    expect(result).toMatchObject({
      kind: "distrust",
      title: "불신의 대가",
      reason: "원정 생존자 전원이 길잡이를 더는 믿지 않습니다.",
      finalRank: campaign.rank,
      triggerCharacterIds: [first.id, second.id],
    });
  });

  it("양수 신뢰 생존자 또는 생존자 없음이면 종료하지 않는다", () => {
    const campaign = campaignWithZeroTrust(2);
    const first = campaign.pool.byId[campaign.pool.order[0]!];
    const second = campaign.pool.byId[campaign.pool.order[1]!];
    if (first === undefined || second === undefined) throw new Error("missing party member");

    expect(evaluateImmediateDistrustEnding(campaign, [{ ...first, trust: 1 }, second])).toBeNull();
    expect(evaluateImmediateDistrustEnding(campaign, [{ ...first, alive: false, hp: 0 }, { ...second, alive: false, hp: 0 }])).toBeNull();
  });

  it("입력 캠페인과 파티를 변경하지 않는다", () => {
    const campaign = campaignWithZeroTrust(2);
    const party = campaign.pool.order.slice(0, 2).map((id) => campaign.pool.byId[id]!);
    const beforeCampaign = structuredClone(campaign);
    const beforeParty = structuredClone(party);

    evaluateImmediateDistrustEnding(campaign, party);

    expect(campaign).toEqual(beforeCampaign);
    expect(party).toEqual(beforeParty);
  });
});

describe("정상 경로 엔딩 우선순위", () => {
  it("누적 고발을 완주보다 먼저 판정한다", () => {
    const campaign = campaignWithZeroTrust(5);
    const completed = { ...campaign, dungeons: campaign.dungeons.map((dungeon) => ({ ...dungeon, status: "cleared" as const })) };

    expect(evaluateCampaignEnding(completed)).toMatchObject({
      kind: "denounced",
      title: "누적 고발",
      reason: "살아 있는 용사 5명 이상이 길잡이를 불신합니다.",
      triggerCharacterIds: completed.pool.order.slice(0, 5),
    });
  });

  it("15개 던전이 모두 cleared면 원정 종료를 반환한다", () => {
    const campaign = campaignWith([
      { classId: "warrior" },
      { classId: "rogue" },
      { classId: "cleric" },
    ]);
    const completed = {
      ...campaign,
      worldTurn: 2,
      statistics: createCampaignStatistics(),
      dungeons: campaign.dungeons.map((dungeon) => ({ ...dungeon, status: "cleared" as const })),
    };

    expect(evaluateCampaignEnding(completed)).toEqual({
      kind: "completed",
      title: "원정 종료",
      reason: "15개의 던전을 모두 돌파했습니다.",
      finalRank: completed.rank,
      triggerCharacterIds: [],
    });
  });

  it("응급 편성도 불가능하면 빈 공고와 함께 인력 소진을 반환한다", () => {
    const campaign = campaignWith([
      { classId: "warrior" },
      { classId: "rogue" },
      { classId: "mage", alive: false },
      { classId: "cleric", trust: 0 },
    ]);

    expect(evaluateCampaignEnding({ ...campaign, offers: [] })).toMatchObject({
      kind: "exhausted",
      title: "인력 소진",
      reason: "서로 다른 직업 3명으로 원정을 꾸릴 수 없습니다.",
      triggerCharacterIds: [],
    });
  });

  it("인력이 남고 모든 남은 공고가 rankTooLow면 실직을 반환한다", () => {
    const campaign = campaignWith([
      { classId: "warrior" },
      { classId: "rogue" },
      { classId: "cleric" },
    ]);
    const party = campaign.pool.order.slice(0, 3) as [CharacterId, CharacterId, CharacterId];
    const offers: BoardOffer[] = campaign.dungeons.slice(0, 2).map((dungeon, index) => ({
      id: `c6-offer-${index}` as BoardOffer["id"],
      dungeonId: dungeon.id,
      riskLevel: dungeon.riskLevel,
      reward: createOfferReward(campaign, dungeon),
      party: { memberIds: party },
      lockReason: "rankTooLow",
    }));

    expect(evaluateCampaignEnding({ ...campaign, offers })).toMatchObject({
      kind: "unemployed",
      title: "실직",
      reason: "남은 모든 공고가 현재 길잡이 등급보다 높습니다.",
      triggerCharacterIds: [],
    });
  });

  it("빈 공고는 실직이 아니며 진행 중 캠페인은 null이다", () => {
    expect(evaluateCampaignEnding({ ...campaignWith([
      { classId: "warrior" },
      { classId: "rogue" },
      { classId: "cleric" },
    ]), offers: [] })).toBeNull();
  });
});

describe("실직 판정과 승급", () => {
  /*
   * 올라갈 수 있으면 실직이 아니다.
   *
   * 공고가 전부 등급 미달이어도 지금 승급할 수 있으면 그 공고들이 열린다. 실제로
   * 명성 60(B 요건)과 골드 153(요건 150)을 둘 다 갖춘 캠페인이 실직으로 끝났다.
   */
  function allLocked(over: Partial<CampaignState>): CampaignState {
    const base = initializeCampaign("unemployed-vs-promotion");
    const boarded = { ...base, offers: createBoardOffers(base) };
    return {
      ...boarded,
      offers: boarded.offers.map((offer) => ({ ...offer, lockReason: "rankTooLow" as const })),
      ...over,
    };
  }

  it("명성으로 올라갈 수 있으면 실직이 아니다", () => {
    const campaign = allLocked({ reputation: PROMOTION_REPUTATION.B, gold: 0 });

    expect(evaluateCampaignEnding(campaign)).toBeNull();
  });

  it("골드로 올라갈 수 있으면 실직이 아니다", () => {
    const campaign = allLocked({ reputation: 0, gold: PROMOTION_GOLD.B });

    expect(evaluateCampaignEnding(campaign)).toBeNull();
  });

  it("둘 다 문턱에 못 미치면 실직이다", () => {
    const campaign = allLocked({
      reputation: PROMOTION_REPUTATION.B - 1,
      gold: PROMOTION_GOLD.B - 1,
    });

    expect(evaluateCampaignEnding(campaign)?.kind).toBe("unemployed");
  });

  /* 문턱을 딱 맞춘 값이 통과해야 한다. 경계에서 갈리면 한 걸음이 사라진다. */
  it("문턱을 딱 맞추면 올라갈 수 있다", () => {
    expect(evaluateCampaignEnding(allLocked({ reputation: PROMOTION_REPUTATION.B, gold: 0 }))).toBeNull();
    expect(evaluateCampaignEnding(allLocked({ reputation: PROMOTION_REPUTATION.B - 1, gold: 0 }))?.kind)
      .toBe("unemployed");
  });
});
