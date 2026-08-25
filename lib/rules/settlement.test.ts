import { describe, expect, it } from "vitest";
import { initializeCampaign } from "./campaign-init";
import type {
  CampaignState,
  Character,
  ExpeditionParty,
  SettlementSnapshot,
} from "@/lib/domain";
import { createOfferReward } from "./board";
import { settleExpedition } from "./settlement";

function partyMembers(campaign: CampaignState): Character[] {
  const selected: Character[] = [];
  const classes = new Set<string>();
  for (const id of campaign.pool.order) {
    const member = campaign.pool.byId[id];
    if (member !== undefined && !classes.has(member.classId)) {
      selected.push(member);
      classes.add(member.classId);
    }
    if (selected.length === 3) break;
  }
  return selected;
}

function snapshotFixture(
  campaign: CampaignState,
  over: Partial<SettlementSnapshot> = {},
): SettlementSnapshot {
  const members = partyMembers(campaign);
  const contractRisk = over.contractRisk ?? campaign.dungeons[0].riskLevel;
  const dungeon = campaign.dungeons.find((candidate) => candidate.riskLevel === contractRisk)
    ?? campaign.dungeons[0];
  const contractReward = over.contractReward ?? createOfferReward(campaign, dungeon);
  return {
    expeditionId: "expedition-settlement-test",
    dungeonId: dungeon.id,
    contractRisk: dungeon.riskLevel,
    contractReward,
    party: { memberIds: members.map((member) => member.id) },
    finalMembers: members,
    status: "cleared",
    causeInputs: { choice: "선택", reactions: "반응", damage: "피해" },
    ...over,
  };
}

function campaignFixture(over: Partial<CampaignState> = {}): CampaignState {
  return { ...initializeCampaign("settlement-test"), ...over };
}

function withMembers(
  members: readonly Character[],
  campaign: CampaignState,
): CampaignState {
  const byId = { ...campaign.pool.byId };
  for (const member of members) byId[member.id] = member;
  return { ...campaign, pool: { ...campaign.pool, byId } };
}

describe("settleExpedition", () => {
  it("정산 결과는 원정 근거만 보존하고 UI용 경제·캠페인 문장을 만들지 않는다", () => {
    const campaign = campaignFixture();
    const snapshot = snapshotFixture(campaign, {
      causeInputs: {
        choice: "마지막 조언",
        reactions: "파티의 판단",
        damage: "결정적 피해",
      },
    });

    const { result } = settleExpedition(campaign, snapshot);

    expect(result.causeInputs).toEqual(snapshot.causeInputs);
    expect(result).not.toHaveProperty("causeChain");
    expect(JSON.stringify(result)).not.toContain("던전 위험도");
  });

  it("memberChanges는 finalMembers 입력 순서와 무관하게 계약 파티 순서를 따른다", () => {
    const campaign = campaignFixture();
    const snapshot = snapshotFixture(campaign);
    const reversed = [...snapshot.finalMembers].reverse();

    const { result } = settleExpedition(campaign, {
      ...snapshot,
      finalMembers: reversed,
    });

    expect(result.memberChanges.map((change) => change.characterId)).toEqual(
      snapshot.party.memberIds,
    );
  });

  it.each([
    [3, 16, 35],
    [2, 9, 21],
    [1, 4, 10],
  ] as const)("%i명 생존은 계약 확정 보상 비율을 적용한다", (survivors, reputation, gold) => {
    const campaign = campaignFixture();
    const members = partyMembers(campaign);
    const finalMembers = members.map((member, index) => ({
      ...member,
      alive: index < survivors,
      hp: index < survivors ? member.hp : 0,
      gold: member.gold,
    }));
    const { campaign: resultCampaign, result } = settleExpedition(
      campaign,
      snapshotFixture(campaign, {
        contractRisk: 3,
        contractReward: { reputation: 16, gold: 35 },
        finalMembers,
        status: "cleared",
      }),
    );

    expect(result).toMatchObject({
      survivorCount: survivors,
      reputationDelta: reputation,
      goldDelta: gold,
      relicGold: 0,
    });
    expect(resultCampaign).toMatchObject({ reputation: 30 + reputation, gold: 10 + gold, cumulativeGold: gold });
  });

  it("전멸은 계약 위험도 명성을 잃고 유품만 회수한다", () => {
    const initial = campaignFixture({ reputation: 6 });
    const members = partyMembers(initial).map((member, index) => ({
      ...member,
      alive: false,
      hp: 0,
      gold: 20 + index * 10,
    }));
    const campaign = withMembers(members, initial);
    const { campaign: resultCampaign, result } = settleExpedition(
      campaign,
      snapshotFixture(campaign, {
        contractRisk: 2,
        contractReward: { reputation: 11, gold: 23 },
        finalMembers: members,
        status: "wiped",
      }),
    );

    expect(result).toMatchObject({
      status: "wiped",
      reputationDelta: -11,
      goldDelta: 0,
      relicGold: 90,
      riskBefore: 2,
      riskAfter: 3,
    });
    expect(resultCampaign.reputation).toBe(0);
    expect(resultCampaign.gold).toBe(100);
    expect(resultCampaign.cumulativeGold).toBe(90);
    expect(members.every((member) => resultCampaign.pool.byId[member.id].gold === 0)).toBe(true);
  });

  it("★5 전멸은 위험도를 올리지 않고 상한을 표시한다", () => {
    const campaign = campaignFixture();
    const members = partyMembers(campaign).map((member) => ({ ...member, alive: false, hp: 0 }));
    const { result } = settleExpedition(campaign, snapshotFixture(campaign, {
      contractRisk: 5,
      finalMembers: members,
      status: "wiped",
    }));
    expect(result).toMatchObject({ riskBefore: 5, riskAfter: 5, riskCapped: true });
  });

  it("정확히 20% HP는 중상이 아니고 그보다 낮으면 중상이다", () => {
    const initial = campaignFixture();
    const members = partyMembers(initial);
    const exact = { ...members[0], maxHp: 15, hp: 3 };
    const below = { ...members[1], maxHp: 15, hp: 2 };
    const campaign = withMembers([exact, below], initial);
    const finalMembers = [exact, below, members[2]];
    const { campaign: resultCampaign } = settleExpedition(campaign, snapshotFixture(campaign, { finalMembers }));
    expect(resultCampaign.pool.byId[exact.id].gravelyWounded).toBe(false);
    expect(resultCampaign.pool.byId[below.id].gravelyWounded).toBe(true);
  });

  it("신뢰 0인 용사를 정산으로 회복시키지 않는다", () => {
    const initial = campaignFixture();
    const members = partyMembers(initial);
    const zeroTrustMember = { ...members[0], trust: 0 };
    const campaign = withMembers([zeroTrustMember], initial);
    const finalMembers = members.map((member, index) => index === 0
      ? { ...zeroTrustMember, trust: 1 }
      : member);
    const snapshot = snapshotFixture(campaign, { finalMembers });
    const beforeCampaign = structuredClone(campaign);
    const beforeSnapshot = structuredClone(snapshot);

    expect(() => settleExpedition(campaign, snapshot)).toThrowError(
      expect.objectContaining({ code: "INVALID_SETTLEMENT" }),
    );
    expect(campaign).toEqual(beforeCampaign);
    expect(snapshot).toEqual(beforeSnapshot);
  });

  it("잘못된 파티와 상태는 적용 전에 INVALID_SETTLEMENT로 거부한다", () => {
    const campaign = campaignFixture();
    const members = partyMembers(campaign);
    const duplicateParty: ExpeditionParty = { memberIds: [members[0].id, members[0].id, members[1].id] };
    const before = structuredClone(campaign);
    expect(() => settleExpedition(campaign, snapshotFixture(campaign, {
      party: duplicateParty,
      finalMembers: members,
    }))).toThrowError(expect.objectContaining({ code: "INVALID_SETTLEMENT" }));
    expect(campaign).toEqual(before);
  });

  it("중복 클래스 파티는 정산 전에 거부한다", () => {
    const campaign = campaignFixture();
    const members = partyMembers(campaign);
    const duplicateClassMembers = members.map((member, index) => index === 2
      ? { ...member, classId: members[0].classId }
      : member);
    expect(() => settleExpedition(campaign, snapshotFixture(campaign, {
      finalMembers: duplicateClassMembers,
    }))).toThrowError(expect.objectContaining({ code: "INVALID_SETTLEMENT" }));
  });

  it("계약 위험도 범위 밖 보상은 INVALID_SETTLEMENT로 거부한다", () => {
    const campaign = campaignFixture();

    expect(() => settleExpedition(campaign, snapshotFixture(campaign, {
      contractRisk: 2,
      contractReward: { reputation: 15, gold: 20 },
    }))).toThrowError(expect.objectContaining({ code: "INVALID_SETTLEMENT" }));
  });
});
