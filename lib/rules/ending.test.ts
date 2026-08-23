import { describe, expect, it } from "vitest";
import type { CampaignEnding, CampaignState, Character } from "@/lib/domain";
import { initializeCampaign } from "./campaign-init";
import {
  countLivingZeroTrust,
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
