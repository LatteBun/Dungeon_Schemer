import { describe, expect, it } from "vitest";
import type {
  AdviceDecision,
  BoardOffer,
  BossResult,
  BossId,
  CampaignEnding,
  Character,
  CharacterId,
  ChoiceId,
  DungeonId,
  EventId,
  CampaignState,
  CampaignTransition,
  CampaignTransitionContext,
  ExpeditionState,
  PromotionResult,
  SettlementResult,
  SettlementSnapshot,
} from "@/lib/domain";
import {
  createCampaignHistory,
  createCampaignStatistics,
  createCampaignTransitionContext,
} from "@/lib/domain";
import {
  appendCampaignEvent,
  assertCampaignHistoryIntegrity,
  deriveTurningPoints,
  selectHighlightedTurningPoint,
  toAdviceResolvedEventDraft,
  toBossBattleResolvedEventDraft,
  toCampaignEndedEventDraft,
  toExpeditionSettledEventDraft,
  toGuidePromotedEventDraft,
  toTrustCollapsedEventDraft,
} from "./campaign-history";
import { initializeCampaign } from "./campaign-init";
import { recordSettlementStatistics } from "./campaign-statistics";
import { transitionCampaign } from "./campaign-transition";

const DUNGEON_ID = "dungeon-spider-01" as DungeonId;
const EVENT_ID = "event-spider-01" as EventId;
const ADVICE_ID = "advice-spider-01" as ChoiceId;
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

function settlementFixture(expeditionId = "exp-1"): SettlementResult {
  return {
    expeditionId,
    dungeonId: DUNGEON_ID,
    status: "wiped",
    survivorIds: [CHARACTER_IDS[0]!],
    survivorCount: 1,
    memberChanges: [
      { characterId: CHARACTER_IDS[0]!, before: character(CHARACTER_IDS[0]!), after: character(CHARACTER_IDS[0]!) },
      { characterId: CHARACTER_IDS[1]!, before: character(CHARACTER_IDS[1]!, false), after: character(CHARACTER_IDS[1]!, false) },
      { characterId: CHARACTER_IDS[2]!, before: character(CHARACTER_IDS[2]!), after: character(CHARACTER_IDS[2]!, false) },
    ],
    reputationDelta: -10,
    goldDelta: 0,
    relicGold: 30,
    riskBefore: 3,
    riskAfter: 4,
    riskCapped: false,
    nextReward: { reputation: 10, gold: 30 },
    causeChain: {
      choice: "choice",
      reactions: "reactions",
      damage: "damage",
      economy: "economy",
      campaignChange: "campaignChange",
    },
  };
}

const distrustEnding: CampaignEnding = {
  kind: "distrust",
  title: "불신의 대가",
  reason: "생존자 전원이 길잡이를 믿지 않는다.",
  finalRank: "C",
  triggerCharacterIds: [CHARACTER_IDS[0]!],
};

const promotionResult: PromotionResult = {
  fromRank: "C",
  toRank: "B",
  method: "reputation",
  reputationBefore: 60,
  reputationAfter: 60,
  goldBefore: 10,
  goldAfter: 10,
  newlyUnlockedRiskLevel: 2,
};

describe("C8-B campaign event draft factories", () => {
  it("조언의 accepted·suspected·exposed 반응과 실행 여부를 보존한다", () => {
    const decision: AdviceDecision = {
      adviceId: ADVICE_ID,
      outcome: "harm",
      reactions: [
        { characterId: CHARACTER_IDS[0]!, reaction: "accepted" },
        { characterId: CHARACTER_IDS[1]!, reaction: "suspected" },
        { characterId: CHARACTER_IDS[2]!, reaction: "exposed" },
      ],
      executed: true,
      delayedRecords: [],
    };

    const draft = toAdviceResolvedEventDraft({
      expeditionId: "exp-1",
      dungeonId: DUNGEON_ID,
      sourceEventId: EVENT_ID,
      decision,
    });

    expect(draft).toMatchObject({
      type: "ADVICE_RESOLVED",
      sourceKey: `exp-1:advice:${EVENT_ID}:${ADVICE_ID}`,
      outcome: "harm",
      executed: true,
      reactions: decision.reactions,
    });
    expect(draft.reactions).not.toBe(decision.reactions);
  });

  it("전원 미수용 조언은 rejected 이벤트가 아니라 executed false로 기록한다", () => {
    const decision: AdviceDecision = {
      adviceId: ADVICE_ID,
      outcome: "help",
      reactions: CHARACTER_IDS.map((characterId) => ({ characterId, reaction: "suspected" as const })),
      executed: false,
      delayedRecords: [],
    };

    const draft = toAdviceResolvedEventDraft({
      expeditionId: "exp-1",
      dungeonId: DUNGEON_ID,
      sourceEventId: EVENT_ID,
      decision,
    });

    expect(draft.type).toBe("ADVICE_RESOLVED");
    expect(draft.executed).toBe(false);
  });

  it("보스 결과는 생존자와 검증 횟수를 복사한다", () => {
    const result = {
      status: "cleared",
      survivorIds: [CHARACTER_IDS[0]!, CHARACTER_IDS[1]!],
      verifications: [{}, {}],
    } as unknown as BossResult;

    const draft = toBossBattleResolvedEventDraft({
      expeditionId: "exp-1",
      dungeonId: DUNGEON_ID,
      bossId: "boss-spider-01" as BossId,
      result,
    });

    expect(draft).toMatchObject({
      type: "BOSS_BATTLE_RESOLVED",
      sourceKey: "exp-1:boss-result",
      status: "cleared",
      verificationCount: 2,
    });
    expect(draft.survivorIds).toEqual(result.survivorIds);
    expect(draft.survivorIds).not.toBe(result.survivorIds);
  });

  it("정산은 새 사망만, 승급·불신·엔딩은 확정 결과만 draft로 만든다", () => {
    const settlement = toExpeditionSettledEventDraft(settlementFixture());
    expect(settlement).toMatchObject({
      type: "EXPEDITION_SETTLED",
      sourceKey: "exp-1:settlement",
      deceasedCharacterIds: [CHARACTER_IDS[2]],
    });

    expect(toGuidePromotedEventDraft(promotionResult)).toMatchObject({
      type: "GUIDE_PROMOTED",
      sourceKey: "promotion:C:B",
      fromRank: "C",
      toRank: "B",
    });
    expect(toTrustCollapsedEventDraft({ expeditionId: "exp-1", ending: distrustEnding })).toMatchObject({
      type: "TRUST_COLLAPSED",
      sourceKey: "exp-1:trust-collapse",
      triggerCharacterIds: [CHARACTER_IDS[0]],
    });
    expect(toCampaignEndedEventDraft(distrustEnding)).toMatchObject({
      type: "CAMPAIGN_ENDED",
      sourceKey: "campaign-ended:distrust",
      ending: distrustEnding,
    });
  });

  it("trust collapse draft는 distrust 엔딩만 받는다", () => {
    expect(() => toTrustCollapsedEventDraft({
      expeditionId: "exp-1",
      ending: { ...distrustEnding, kind: "completed" },
    })).toThrowError(expect.objectContaining({ code: "INVALID_STATE" }));
  });
});

describe("C8-B campaign history reducer", () => {
  function adviceDraft() {
    return toAdviceResolvedEventDraft({
      expeditionId: "exp-1",
      dungeonId: DUNGEON_ID,
      sourceEventId: EVENT_ID,
      decision: {
        adviceId: ADVICE_ID,
        outcome: "help",
        reactions: [{ characterId: CHARACTER_IDS[0]!, reaction: "accepted" }],
        executed: true,
        delayedRecords: [],
      },
    });
  }

  function bossDraft() {
    return toBossBattleResolvedEventDraft({
      expeditionId: "exp-1",
      dungeonId: DUNGEON_ID,
      bossId: "boss-spider-01" as BossId,
      result: {
        status: "cleared",
        survivorIds: [CHARACTER_IDS[0]!],
        verifications: [{}],
      } as unknown as BossResult,
    });
  }

  function settlementDraft(expeditionId: string) {
    return toExpeditionSettledEventDraft(settlementFixture(expeditionId));
  }

  it("append는 결정적인 event ID와 연속 sequence를 만든다", () => {
    const first = appendCampaignEvent(createCampaignHistory(), {
      campaignTurn: 0,
      event: adviceDraft(),
    });
    const history = appendCampaignEvent(first, {
      campaignTurn: 1,
      event: bossDraft(),
    });

    expect(history.events.map(({ id, campaignTurn, sequence }) => ({ id, campaignTurn, sequence }))).toEqual([
      { id: "campaign:0:event:0", campaignTurn: 0, sequence: 0 },
      { id: "campaign:1:event:1", campaignTurn: 1, sequence: 1 },
    ]);
  });

  it("append 실패는 중복 source key·잘못된 turn을 거부하고 입력을 변경하지 않는다", () => {
    const initial = appendCampaignEvent(createCampaignHistory(), {
      campaignTurn: 0,
      event: adviceDraft(),
    });
    const before = structuredClone(initial);

    expect(() => appendCampaignEvent(initial, {
      campaignTurn: 1,
      event: adviceDraft(),
    })).toThrowError(expect.objectContaining({ code: "DUPLICATE_ID" }));
    expect(() => appendCampaignEvent(initial, {
      campaignTurn: -1,
      event: bossDraft(),
    })).toThrowError(expect.objectContaining({ code: "INVALID_STATE" }));
    expect(initial).toEqual(before);
  });

  it("손상된 turningPoints cache는 INVALID_STATE로 거부한다", () => {
    const history = appendCampaignEvent(createCampaignHistory(), {
      campaignTurn: 0,
      event: settlementDraft("exp-1"),
    });

    expect(() => assertCampaignHistoryIntegrity({ ...history, turningPoints: [] }))
      .toThrowError(expect.objectContaining({ code: "INVALID_STATE" }));
  });

  it("전환점은 첫 사망·보스 클리어·불신·엔딩을 event sequence로 파생한다", () => {
    const events = [
      appendCampaignEvent(createCampaignHistory(), {
        campaignTurn: 0,
        event: settlementDraft("exp-1"),
      }),
      appendCampaignEvent(
        appendCampaignEvent(createCampaignHistory(), {
          campaignTurn: 0,
          event: settlementDraft("exp-1"),
        }),
        { campaignTurn: 0, event: bossDraft() },
      ),
    ];
    const withBoss = events[1]!;
    const withDeath = events[0]!;
    const afterTrust = appendCampaignEvent(withBoss, {
      campaignTurn: 0,
      event: toTrustCollapsedEventDraft({ expeditionId: "exp-1", ending: distrustEnding }),
    });
    const ended = appendCampaignEvent(afterTrust, {
      campaignTurn: 0,
      event: toCampaignEndedEventDraft(distrustEnding),
    });
    const turningPoints = deriveTurningPoints([
      ...withDeath.events,
      ...ended.events.slice(1),
    ]);

    expect(turningPoints.map(({ kind }) => kind)).toEqual([
      "firstCharacterDeath",
      "bossBreakthrough",
      "trustCollapse",
      "campaignEnded",
    ]);
  });

  it("firstCharacterDeath는 두 번째 사망 정산에서 중복 생성되지 않는다", () => {
    const first = appendCampaignEvent(createCampaignHistory(), {
      campaignTurn: 0,
      event: settlementDraft("exp-1"),
    });
    const second = appendCampaignEvent(first, {
      campaignTurn: 1,
      event: settlementDraft("exp-2"),
    });

    expect(second.turningPoints.filter(({ kind }) => kind === "firstCharacterDeath")).toHaveLength(1);
  });

  it("U6 강조 전환점은 엔딩을 제외하고 우선순위와 같은 kind의 최신 sequence를 따른다", () => {
    const history = appendCampaignEvent(
      appendCampaignEvent(
        appendCampaignEvent(
          appendCampaignEvent(createCampaignHistory(), {
            campaignTurn: 0,
            event: settlementDraft("exp-1"),
          }),
          { campaignTurn: 0, event: bossDraft() },
        ),
        { campaignTurn: 0, event: toTrustCollapsedEventDraft({ expeditionId: "exp-1", ending: distrustEnding }) },
      ),
      { campaignTurn: 0, event: toCampaignEndedEventDraft(distrustEnding) },
    );

    expect(selectHighlightedTurningPoint(history.turningPoints)?.kind).toBe("trustCollapse");
    expect(selectHighlightedTurningPoint(history.turningPoints.filter(({ kind }) => kind === "campaignEnded"))).toBeNull();
  });
});

describe("C7·C8-A·C8-B composition boundary", () => {
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
      expeditionId: "exp-c8-composition",
      partyMembers: membersFor(offer, campaign),
      expedition: {
        dungeonId: offer.dungeonId,
        riskLevel: offer.riskLevel,
        party: offer.party,
      } as ExpeditionState,
    };
  }

  function expeditionFlow(seed: string) {
    const initial = initializeCampaign(seed);
    const opened = transitionCampaign(initial, createCampaignTransitionContext(), { type: "OPEN_BOARD" });
    const offer = opened.campaign.offers.find((candidate) => candidate.lockReason === null);
    if (offer === undefined) throw new Error("open offer fixture is missing");
    const contract = transitionCampaign(opened.campaign, opened.context, {
      type: "SELECT_CONTRACT",
      offerId: offer.id,
    });
    return transitionCampaign(
      contract.campaign,
      contract.context,
      startAction(contract.campaign, contract.context),
    );
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
      party: active.expedition.party,
      finalMembers: membersFor(active.offer, campaign),
      status: "cleared",
      causeInputs: { choice: "choice", reactions: "reactions", damage: "damage" },
    };
  }

  it("C7 전이 뒤 C8-A 통계와 C8-B history를 한 replacement로 조합한다", () => {
    const expedition = expeditionFlow("c8-composition");
    const transition = transitionCampaign(expedition.campaign, expedition.context, {
      type: "COMPLETE_EXPEDITION",
      snapshot: snapshotFor(expedition.campaign, expedition.context),
    });
    const settlement = transition.settlement;
    if (settlement === null) throw new Error("settlement fixture is missing");
    const dungeon = transition.campaign.dungeons.find((candidate) => candidate.id === settlement.dungeonId);
    if (dungeon === undefined) throw new Error("campaign dungeon fixture is missing");

    const statistics = recordSettlementStatistics(
      transition.campaign.statistics,
      settlement,
      dungeon,
    );
    const history = appendCampaignEvent(transition.campaign.history, {
      campaignTurn: transition.campaign.worldTurn,
      event: toExpeditionSettledEventDraft(settlement),
    });
    const committed = { ...transition.campaign, statistics, history };

    expect(committed.phase).toBe("settlement");
    expect(committed.settledExpeditionIds).toEqual([settlement.expeditionId]);
    expect(committed.statistics).not.toEqual(createCampaignStatistics());
    expect(committed.statistics.settlements).toHaveLength(1);
    expect(committed.history.events).toHaveLength(1);
    expect(committed.history.events[0]?.type).toBe("EXPEDITION_SETTLED");
    expect(transition.campaign.statistics).toEqual(createCampaignStatistics());
    expect(transition.campaign.history).toEqual(createCampaignHistory());

    expect(() => appendCampaignEvent(history, {
      campaignTurn: transition.campaign.worldTurn,
      event: toExpeditionSettledEventDraft(settlement),
    })).toThrowError(expect.objectContaining({ code: "DUPLICATE_ID" }));
  });
});
