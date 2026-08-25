import { describe, expect, it } from "vitest";
import type {
  BoardOffer,
  CampaignDungeonOrder,
  CampaignState,
  CampaignStatistics,
  CampaignTransition,
  CampaignTransitionContext,
  Character,
  CharacterId,
  DungeonId,
  ExpeditionState,
  SettlementMemberChange,
  SettlementResult,
  SettlementSnapshot,
} from "@/lib/domain";
import { createCampaignTransitionContext, createCampaignStatistics } from "@/lib/domain";
import { initializeCampaign } from "./campaign-init";
import { recordSettlementStatistics } from "./campaign-statistics";
import { createExpeditionForOffer, transitionCampaign } from "./campaign-transition";

const DUNGEON_ID = "dungeon-spider-01" as DungeonId;
const CHARACTER_IDS = [
  "character-001",
  "character-002",
  "character-003",
] as CharacterId[];

function character(id: CharacterId, alive = true): Character {
  return {
    id,
    name: id,
    classId: "warrior" as Character["classId"],
    personality: "prudent",
    maxHp: 100,
    hp: alive ? 100 : 0,
    trust: 50,
    gold: 30,
    alive,
    gravelyWounded: false,
  };
}

function memberChange(
  id: CharacterId,
  beforeAlive: boolean,
  afterAlive: boolean,
): SettlementMemberChange {
  return {
    characterId: id,
    before: character(id, beforeAlive),
    after: character(id, afterAlive),
  };
}

function settlementFixture(
  overrides: Partial<SettlementResult> = {},
): SettlementResult {
  const allAlive = CHARACTER_IDS.map((id) => memberChange(id, true, true));
  return {
    expeditionId: "exp-c8-01",
    dungeonId: DUNGEON_ID,
    status: "cleared",
    survivorIds: [...CHARACTER_IDS],
    survivorCount: 3,
    memberChanges: allAlive,
    reputationDelta: 15,
    goldDelta: 32,
    relicGold: 0,
    riskBefore: 3,
    riskAfter: 3,
    riskCapped: false,
    causeInputs: {
      choice: "선택",
      reactions: "반응",
      damage: "피해",
    },
    ...overrides,
  };
}

function dungeon(
  order: CampaignDungeonOrder,
  id: DungeonId = DUNGEON_ID,
): { id: DungeonId; campaignOrder: CampaignDungeonOrder } {
  return { id, campaignOrder: order };
}

function membersFor(offer: BoardOffer, campaign: CampaignState): Character[] {
  return offer.party.memberIds.map((id) => campaign.pool.byId[id]).filter(
    (member): member is Character => member !== undefined,
  );
}

function startAction(
  campaign: CampaignState,
  context: CampaignTransitionContext,
): CampaignTransition {
  const offer = context.selectedOffer;
  if (offer === null) throw new Error("selected offer fixture is missing");
  return {
    type: "START_EXPEDITION",
    expeditionId: "exp-c8-transition",
    /* 규칙이 만든 원정을 쓴다. 손으로 만든 최소 상태는 지도가 없다. */
    ...createExpeditionForOffer(campaign, offer),
  };
}

function snapshotFor(
  campaign: CampaignState,
  context: CampaignTransitionContext,
): SettlementSnapshot {
  const active = context.activeExpedition;
  if (active === null) throw new Error("active expedition fixture is missing");
  return {
    expeditionId: active.expeditionId,
    dungeonId: active.expedition.dungeonId,
    contractRisk: active.expedition.riskLevel,
    contractReward: { ...active.offer.reward },
    party: active.expedition.party,
    finalMembers: membersFor(active.offer, campaign),
    status: "cleared",
    causeInputs: { choice: "선택", reactions: "반응", damage: "피해" },
  };
}

function expeditionFlow(seed: string) {
  const initial = initializeCampaign(seed);
  const opened = transitionCampaign(initial, createCampaignTransitionContext(), { type: "OPEN_BOARD" });
  const offer = opened.campaign.offers.find((candidate) => candidate.lockReason === null);
  if (offer === undefined) throw new Error("open offer fixture is missing");
  const contract = transitionCampaign(opened.campaign, opened.context, {
    type: "SELECT_CONTRACT", offerId: offer.id,
  });
  const expedition = transitionCampaign(
    contract.campaign,
    contract.context,
    startAction(contract.campaign, contract.context),
  );
  return expedition;
}

describe("recordSettlementStatistics", () => {
  it("cleared 정산을 원본과 요약 이력에 한 번 누적한다", () => {
    const result = recordSettlementStatistics(
      createCampaignStatistics(),
      settlementFixture({ expeditionId: "exp-clear", goldDelta: 32 }),
      dungeon(7),
    );

    expect(result).toMatchObject({
      totalExpeditions: 1,
      clearedExpeditions: 1,
      wipedExpeditions: 0,
      totalDeaths: 0,
      totalGoldEarned: 32,
      highestDungeonCleared: 7,
    });
    expect(result.settlementHistory).toEqual([{
      expeditionId: "exp-clear",
      dungeonId: DUNGEON_ID,
      dungeonOrder: 7,
      status: "cleared",
      goldEarned: 32,
      survivorCount: 3,
      deathCount: 0,
    }]);
    expect(result.settlements).toEqual([expect.objectContaining({ expeditionId: "exp-clear" })]);
  });

  it("wiped 정산은 유품 골드와 실제 사망자를 누적한다", () => {
    const wiped = settlementFixture({
      expeditionId: "exp-wipe",
      status: "wiped",
      survivorIds: [],
      survivorCount: 0,
      memberChanges: CHARACTER_IDS.map((id) => memberChange(id, true, false)),
      goldDelta: 0,
      relicGold: 45,
      riskAfter: 4,
    });

    const result = recordSettlementStatistics(createCampaignStatistics(), wiped, dungeon(4));

    expect(result).toMatchObject({
      totalExpeditions: 1,
      clearedExpeditions: 0,
      wipedExpeditions: 1,
      totalDeaths: 3,
      totalGoldEarned: 45,
      highestDungeonCleared: 0,
    });
    expect(result.settlementHistory[0]?.goldEarned).toBe(45);
  });

  it("이미 죽어 있던 멤버의 false-to-false 변화는 새 사망으로 세지 않는다", () => {
    const result = recordSettlementStatistics(
      createCampaignStatistics(),
      settlementFixture({
        survivorCount: 2,
        survivorIds: CHARACTER_IDS.slice(0, 2),
        memberChanges: [
          memberChange(CHARACTER_IDS[0]!, true, true),
          memberChange(CHARACTER_IDS[1]!, false, false),
          memberChange(CHARACTER_IDS[2]!, true, false),
        ],
      }),
      dungeon(2),
    );

    expect(result.totalDeaths).toBe(1);
    expect(result.settlementHistory[0]?.deathCount).toBe(1);
  });

  it("클리어한 정산 중 가장 높은 고정 던전 순서를 유지한다", () => {
    const first = recordSettlementStatistics(
      createCampaignStatistics(), settlementFixture({ expeditionId: "exp-5" }), dungeon(5),
    );
    const second = recordSettlementStatistics(
      first, settlementFixture({ expeditionId: "exp-2" }), dungeon(2),
    );
    const wiped = recordSettlementStatistics(
      second,
      settlementFixture({ expeditionId: "exp-wipe-2", status: "wiped", survivorIds: [], survivorCount: 0 }),
      dungeon(9),
    );

    expect(wiped.highestDungeonCleared).toBe(5);
    const final = recordSettlementStatistics(
      wiped, settlementFixture({ expeditionId: "exp-7" }), dungeon(7),
    );
    expect(final.highestDungeonCleared).toBe(7);
  });

  it("중복 expeditionId는 DUPLICATE_ID로 거부하고 입력을 변경하지 않는다", () => {
    const initial = recordSettlementStatistics(
      createCampaignStatistics(), settlementFixture({ expeditionId: "exp-duplicate" }), dungeon(1),
    );
    const before = structuredClone(initial);

    expect(() => recordSettlementStatistics(
      initial, settlementFixture({ expeditionId: "exp-duplicate" }), dungeon(2),
    )).toThrowError(expect.objectContaining({ code: "DUPLICATE_ID" }));
    expect(initial).toEqual(before);
  });

  it("던전 ID와 순서가 유효하지 않으면 INVALID_STATE다", () => {
    const campaignDungeon = dungeon(1);
    const before = createCampaignStatistics();

    expect(() => recordSettlementStatistics(
      before,
      settlementFixture({ dungeonId: "dungeon-desert-01" as DungeonId }),
      campaignDungeon,
    )).toThrowError(expect.objectContaining({ code: "INVALID_STATE" }));
    expect(() => recordSettlementStatistics(
      before,
      settlementFixture(),
      { id: DUNGEON_ID, campaignOrder: 16 as CampaignDungeonOrder },
    )).toThrowError(expect.objectContaining({ code: "INVALID_STATE" }));
  });

  it("원본·요약 이력과 맞지 않는 기존 집계는 INVALID_STATE다", () => {
    const corrupted: CampaignStatistics = {
      ...createCampaignStatistics(),
      totalExpeditions: 1,
    };

    expect(() => recordSettlementStatistics(
      corrupted, settlementFixture(), dungeon(1),
    )).toThrowError(expect.objectContaining({ code: "INVALID_STATE" }));
  });

  it("C7 정산 결과를 소비해도 phase와 C7 통계 소유권을 바꾸지 않는다", () => {
    const expedition = expeditionFlow("c8-transition");
    const transition = transitionCampaign(expedition.campaign, expedition.context, {
      type: "COMPLETE_EXPEDITION",
      snapshot: snapshotFor(expedition.campaign, expedition.context),
    });
    const settlement = transition.settlement;
    if (settlement === null) throw new Error("settlement fixture is missing");
    const campaignDungeon = transition.campaign.dungeons.find(
      (candidate) => candidate.id === settlement.dungeonId,
    );
    if (campaignDungeon === undefined) throw new Error("dungeon fixture is missing");

    const updatedCampaign = {
      ...transition.campaign,
      statistics: recordSettlementStatistics(
        transition.campaign.statistics,
        settlement,
        campaignDungeon,
      ),
    };

    expect(updatedCampaign.phase).toBe("settlement");
    expect(updatedCampaign.settledExpeditionIds).toEqual([settlement.expeditionId]);
    expect(updatedCampaign.statistics.settlements).toEqual([settlement]);
    expect(transition.campaign.statistics).toEqual(createCampaignStatistics());
  });

  it("즉시 distrust 결과에는 SettlementResult와 C8 통계 기록이 없다", () => {
    const expedition = expeditionFlow("c8-distrust");
    const active = expedition.context.activeExpedition;
    if (active === null) throw new Error("active expedition fixture is missing");
    const distrust = transitionCampaign(expedition.campaign, expedition.context, {
      type: "APPLY_TRUST_BATCH",
      partyMembers: active.partyMembers.map((member) => ({ ...member, trust: 0 })),
    });

    expect(distrust.campaign.phase).toBe("ended");
    expect(distrust.ending?.kind).toBe("distrust");
    expect(distrust.settlement).toBeNull();
    expect(distrust.campaign.statistics).toEqual(createCampaignStatistics());
  });
});
