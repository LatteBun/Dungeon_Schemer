import { RuleError } from "@/lib/domain";
import type {
  AdviceDecision,
  CampaignEvent,
  CampaignEventDraft,
  CampaignEventId,
  CampaignHistory,
  CampaignEventSourceKey,
  BossId,
  BossResult,
  CampaignEnding,
  DungeonId,
  EventId,
  PromotionResult,
  SettlementResult,
  TurningPoint,
  TurningPointKind,
} from "@/lib/domain";

function invalidState(message: string, details: Record<string, unknown> = {}): never {
  throw new RuleError("INVALID_STATE", message, details);
}

function duplicateSourceKey(sourceKey: CampaignEventSourceKey): never {
  throw new RuleError("DUPLICATE_ID", "캠페인 이벤트 source key가 이미 이력에 있다", { sourceKey });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function assertUniqueStrings(values: readonly string[], field: string): void {
  if (values.some((value) => !isNonEmptyString(value)) || new Set(values).size !== values.length) {
    invalidState(`${field}가 비어 있거나 중복된다`, { field });
  }
}

function eventId(campaignTurn: number, sequence: number): CampaignEventId {
  return `campaign:${campaignTurn}:event:${sequence}` as CampaignEventId;
}

function expectedSourceKey(event: CampaignEvent): string {
  switch (event.type) {
    case "ADVICE_RESOLVED":
      return `${event.expeditionId}:advice:${event.sourceEventId}:${event.adviceId}`;
    case "BOSS_BATTLE_RESOLVED":
      return `${event.expeditionId}:boss-result`;
    case "EXPEDITION_SETTLED":
      return `${event.expeditionId}:settlement`;
    case "GUIDE_PROMOTED":
      return `promotion:${event.fromRank}:${event.toRank}`;
    case "TRUST_COLLAPSED":
      return `${event.expeditionId}:trust-collapse`;
    case "CAMPAIGN_ENDED":
      return `campaign-ended:${event.ending.kind}`;
  }
}

function assertEventPayload(event: CampaignEvent): void {
  if (!isNonEmptyString(event.sourceKey) || event.sourceKey !== expectedSourceKey(event)) {
    invalidState("캠페인 이벤트 source key가 payload와 일치하지 않는다", { type: event.type });
  }

  switch (event.type) {
    case "ADVICE_RESOLVED": {
      if (!isNonEmptyString(event.expeditionId) || !isNonEmptyString(event.dungeonId)
        || !isNonEmptyString(event.sourceEventId) || !isNonEmptyString(event.adviceId)) {
        invalidState("조언 이벤트의 식별자가 유효하지 않다", { type: event.type });
      }
      assertUniqueStrings(event.reactions.map(({ characterId }) => characterId), "reactions.characterId");
      if (event.executed !== event.reactions.some(({ reaction }) => reaction === "accepted")) {
        invalidState("조언 이벤트 실행 여부와 반응이 일치하지 않는다", { type: event.type });
      }
      return;
    }
    case "BOSS_BATTLE_RESOLVED":
      if (!isNonEmptyString(event.expeditionId) || !isNonEmptyString(event.dungeonId)
        || !isNonEmptyString(event.bossId)) {
        invalidState("보스 이벤트의 식별자가 유효하지 않다", { type: event.type });
      }
      assertUniqueStrings(event.survivorIds, "survivorIds");
      if (!Number.isSafeInteger(event.verificationCount) || event.verificationCount < 0) {
        invalidState("보스 이벤트 검증 횟수가 유효하지 않다", { type: event.type });
      }
      return;
    case "EXPEDITION_SETTLED":
      if (!isNonEmptyString(event.expeditionId) || !isNonEmptyString(event.dungeonId)) {
        invalidState("정산 이벤트의 식별자가 유효하지 않다", { type: event.type });
      }
      assertUniqueStrings(event.deceasedCharacterIds, "deceasedCharacterIds");
      return;
    case "GUIDE_PROMOTED":
      return;
    case "TRUST_COLLAPSED":
      if (!isNonEmptyString(event.expeditionId)) {
        invalidState("신뢰 붕괴 이벤트의 원정 ID가 유효하지 않다", { type: event.type });
      }
      assertUniqueStrings(event.triggerCharacterIds, "triggerCharacterIds");
      return;
    case "CAMPAIGN_ENDED":
      assertUniqueStrings(event.ending.triggerCharacterIds, "ending.triggerCharacterIds");
      return;
  }
}

function cloneEvent(event: CampaignEvent): CampaignEvent {
  switch (event.type) {
    case "ADVICE_RESOLVED":
      return { ...event, reactions: event.reactions.map((reaction) => ({ ...reaction })) };
    case "BOSS_BATTLE_RESOLVED":
      return { ...event, survivorIds: [...event.survivorIds] };
    case "EXPEDITION_SETTLED":
      return { ...event, deceasedCharacterIds: [...event.deceasedCharacterIds] };
    case "GUIDE_PROMOTED":
      return { ...event };
    case "TRUST_COLLAPSED":
      return { ...event, triggerCharacterIds: [...event.triggerCharacterIds] };
    case "CAMPAIGN_ENDED":
      return {
        ...event,
        ending: { ...event.ending, triggerCharacterIds: [...event.ending.triggerCharacterIds] },
      };
  }
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

export function deriveTurningPoints(events: readonly CampaignEvent[]): readonly TurningPoint[] {
  const sorted = [...events].sort((left, right) => left.sequence - right.sequence);
  const turningPoints: TurningPoint[] = [];
  let hasCharacterDeath = false;

  for (const event of sorted) {
    if (event.type === "EXPEDITION_SETTLED" && event.deceasedCharacterIds.length > 0 && !hasCharacterDeath) {
      hasCharacterDeath = true;
      turningPoints.push({
        eventId: event.id,
        kind: "firstCharacterDeath",
        campaignTurn: event.campaignTurn,
        sequence: event.sequence,
      });
    }
    if (event.type === "BOSS_BATTLE_RESOLVED" && event.status === "cleared") {
      turningPoints.push({
        eventId: event.id,
        kind: "bossBreakthrough",
        campaignTurn: event.campaignTurn,
        sequence: event.sequence,
      });
    }
    if (event.type === "TRUST_COLLAPSED") {
      turningPoints.push({
        eventId: event.id,
        kind: "trustCollapse",
        campaignTurn: event.campaignTurn,
        sequence: event.sequence,
      });
    }
    if (event.type === "CAMPAIGN_ENDED") {
      turningPoints.push({
        eventId: event.id,
        kind: "campaignEnded",
        campaignTurn: event.campaignTurn,
        sequence: event.sequence,
      });
    }
  }

  return turningPoints;
}

function sameTurningPoints(left: readonly TurningPoint[], right: readonly TurningPoint[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function assertCampaignHistoryIntegrity(history: CampaignHistory): void {
  const sourceKeys = new Set<string>();
  let previousTurn = 0;
  for (const [sequence, event] of history.events.entries()) {
    if (event.sequence !== sequence || event.id !== eventId(event.campaignTurn, sequence)) {
      invalidState("캠페인 이벤트 identity가 배열 순서와 일치하지 않는다", { sequence, eventId: event.id });
    }
    if (!Number.isSafeInteger(event.campaignTurn) || event.campaignTurn < 0 || event.campaignTurn < previousTurn) {
      invalidState("캠페인 이벤트 turn 순서가 유효하지 않다", { sequence, campaignTurn: event.campaignTurn });
    }
    previousTurn = event.campaignTurn;
    if (sourceKeys.has(event.sourceKey)) duplicateSourceKey(event.sourceKey);
    sourceKeys.add(event.sourceKey);
    assertEventPayload(event);
  }

  const derived = deriveTurningPoints(history.events);
  if (!sameTurningPoints(history.turningPoints, derived)) {
    invalidState("전환점 cache가 이벤트 이력과 일치하지 않는다");
  }
}

export function appendCampaignEvent(
  history: CampaignHistory,
  input: { readonly campaignTurn: number; readonly event: CampaignEventDraft },
): CampaignHistory {
  assertCampaignHistoryIntegrity(history);
  if (!Number.isSafeInteger(input.campaignTurn) || input.campaignTurn < 0) {
    invalidState("캠페인 이벤트 turn이 유효하지 않다", { campaignTurn: input.campaignTurn });
  }
  const lastEvent = history.events.at(-1);
  if (lastEvent !== undefined && input.campaignTurn < lastEvent.campaignTurn) {
    invalidState("캠페인 이벤트 turn이 뒤로 이동했다", { campaignTurn: input.campaignTurn });
  }
  if (history.events.some(({ sourceKey }) => sourceKey === input.event.sourceKey)) {
    duplicateSourceKey(input.event.sourceKey);
  }

  const sequence = history.events.length;
  const event = cloneEvent({
    ...input.event,
    id: eventId(input.campaignTurn, sequence),
    campaignTurn: input.campaignTurn,
    sequence,
  } as CampaignEvent);
  assertEventPayload(event);
  const events = [...history.events, event];
  return { events, turningPoints: deriveTurningPoints(events) };
}

export function selectHighlightedTurningPoint(
  turningPoints: readonly TurningPoint[],
): TurningPoint | null {
  const rank: Readonly<Record<Exclude<TurningPointKind, "campaignEnded">, number>> = {
    trustCollapse: 3,
    firstCharacterDeath: 2,
    bossBreakthrough: 1,
  };
  return turningPoints.reduce<TurningPoint | null>((selected, point) => {
    if (point.kind === "campaignEnded") return selected;
    if (selected === null || selected.kind === "campaignEnded") return point;
    return rank[point.kind] > rank[selected.kind]
      || (rank[point.kind] === rank[selected.kind] && point.sequence > selected.sequence)
      ? point
      : selected;
  }, null);
}
