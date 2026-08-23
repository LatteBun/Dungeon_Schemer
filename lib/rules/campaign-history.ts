import { RuleError } from "@/lib/domain";
import type {
  AdviceDecision,
  AdviceResolvedEvent,
  BossBattleResolvedEvent,
  BossId,
  BossResult,
  CampaignEndedEvent,
  CampaignEnding,
  CampaignEventDraft,
  DungeonId,
  EventId,
  ExpeditionSettledEvent,
  GuidePromotedEvent,
  PromotionResult,
  SettlementResult,
  TrustCollapsedEvent,
} from "@/lib/domain";

function invalidState(message: string, details: Record<string, unknown> = {}): never {
  throw new RuleError("INVALID_STATE", message, details);
}

type DraftOf<Type extends CampaignEventDraft["type"]> = Extract<CampaignEventDraft, { type: Type }>;

export function toAdviceResolvedEventDraft(input: {
  expeditionId: string;
  dungeonId: DungeonId;
  sourceEventId: EventId;
  decision: AdviceDecision;
}): DraftOf<"ADVICE_RESOLVED"> {
  return {
    type: "ADVICE_RESOLVED",
    sourceKey: `${input.expeditionId}:advice:${input.sourceEventId}:${input.decision.adviceId}` as DraftOf<"ADVICE_RESOLVED">["sourceKey"],
    expeditionId: input.expeditionId,
    dungeonId: input.dungeonId,
    sourceEventId: input.sourceEventId,
    adviceId: input.decision.adviceId,
    outcome: input.decision.outcome,
    executed: input.decision.executed,
    reactions: input.decision.reactions.map((reaction) => ({ ...reaction })),
  };
}

export function toBossBattleResolvedEventDraft(input: {
  expeditionId: string;
  dungeonId: DungeonId;
  bossId: BossId;
  result: BossResult;
}): DraftOf<"BOSS_BATTLE_RESOLVED"> {
  return {
    type: "BOSS_BATTLE_RESOLVED",
    sourceKey: `${input.expeditionId}:boss-result` as DraftOf<"BOSS_BATTLE_RESOLVED">["sourceKey"],
    expeditionId: input.expeditionId,
    dungeonId: input.dungeonId,
    bossId: input.bossId,
    status: input.result.status,
    survivorIds: [...input.result.survivorIds],
    verificationCount: input.result.verifications.length,
  };
}

export function toExpeditionSettledEventDraft(
  settlement: SettlementResult,
): DraftOf<"EXPEDITION_SETTLED"> {
  const deceasedCharacterIds = settlement.memberChanges
    .filter(({ before, after }) => before.alive && !after.alive)
    .map(({ characterId }) => characterId);

  return {
    type: "EXPEDITION_SETTLED",
    sourceKey: `${settlement.expeditionId}:settlement` as DraftOf<"EXPEDITION_SETTLED">["sourceKey"],
    expeditionId: settlement.expeditionId,
    dungeonId: settlement.dungeonId,
    status: settlement.status,
    deceasedCharacterIds,
  };
}

export function toGuidePromotedEventDraft(
  result: PromotionResult,
): DraftOf<"GUIDE_PROMOTED"> {
  return {
    type: "GUIDE_PROMOTED",
    sourceKey: `promotion:${result.fromRank}:${result.toRank}` as DraftOf<"GUIDE_PROMOTED">["sourceKey"],
    fromRank: result.fromRank,
    toRank: result.toRank,
    method: result.method,
  };
}

export function toTrustCollapsedEventDraft(input: {
  expeditionId: string;
  ending: CampaignEnding;
}): DraftOf<"TRUST_COLLAPSED"> {
  if (input.ending.kind !== "distrust") {
    return invalidState("불신 붕괴 이벤트는 distrust 엔딩에서만 만들 수 있다", {
      endingKind: input.ending.kind,
    });
  }

  return {
    type: "TRUST_COLLAPSED",
    sourceKey: `${input.expeditionId}:trust-collapse` as DraftOf<"TRUST_COLLAPSED">["sourceKey"],
    expeditionId: input.expeditionId,
    triggerCharacterIds: [...input.ending.triggerCharacterIds],
  };
}

export function toCampaignEndedEventDraft(
  ending: CampaignEnding,
): DraftOf<"CAMPAIGN_ENDED"> {
  return {
    type: "CAMPAIGN_ENDED",
    sourceKey: `campaign-ended:${ending.kind}` as DraftOf<"CAMPAIGN_ENDED">["sourceKey"],
    ending: {
      ...ending,
      triggerCharacterIds: [...ending.triggerCharacterIds],
    },
  };
}
