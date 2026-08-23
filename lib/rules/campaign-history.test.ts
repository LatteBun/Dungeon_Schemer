import { describe, expect, it } from "vitest";
import type {
  AdviceDecision,
  BossResult,
  BossId,
  CampaignEnding,
  Character,
  CharacterId,
  ChoiceId,
  DungeonId,
  EventId,
  GuideRank,
  PromotionResult,
  SettlementResult,
} from "@/lib/domain";
import {
  toAdviceResolvedEventDraft,
  toBossBattleResolvedEventDraft,
  toCampaignEndedEventDraft,
  toExpeditionSettledEventDraft,
  toGuidePromotedEventDraft,
  toTrustCollapsedEventDraft,
} from "./campaign-history";

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

function settlementFixture(): SettlementResult {
  return {
    expeditionId: "exp-1",
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
