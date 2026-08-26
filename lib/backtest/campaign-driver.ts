import { createExpeditionForOffer, createSettlementSnapshotFor } from "@/lib/rules/campaign-transition";
import { getMerchantAdviceAvailability } from "@/lib/rules/merchant";
import { getGuidePromotionEligibility } from "@/lib/rules/promotion";
import { createCampaignStore, type CampaignStoreState } from "@/lib/store/campaign-store";
import { canDeploy, canDeployEmergency, RuleError } from "@/lib/domain";
import type {
  ActiveExpeditionContext,
  AdvicePressure,
  AdviceOutcome,
  BaseAdviceOption,
  CampaignState,
  CampaignTransition,
  ClassId,
  CharacterId,
  DungeonId,
  EndingKind,
  ExpeditionStatus,
  InfoReaction,
  RiskLevel,
  ThemeId,
} from "@/lib/domain";
import type { BattleResolution } from "@/lib/domain";
import { selectAdviceByAccuracy, InvalidStrategyDecisionError, type AccuracySelection } from "./accuracy-selector";
import { projectAdviceDecision, projectBoardDecision, projectMapDecision, type Accuracy, type PublicNodeCategory } from "./public-state";
import type { StrategyPolicy } from "./strategies";

export type RunErrorKind =
  | "generation"
  | "rejected-transition"
  | "invalid-strategy-decision"
  | "stall"
  | "step-limit"
  | "nondeterminism";

export type DepletionSource =
  | "expedition-general"
  | "expedition-boss"
  | "world-turn-background"
  | "world-turn-rest";

export interface DepletionTraceEntry {
  readonly source: DepletionSource;
  readonly worldTurn: number;
  readonly expeditionId: string | null;
  readonly dungeonId: DungeonId | null;
  readonly initialRiskLevel: RiskLevel | null;
  readonly attemptNumber: number | null;
  readonly hpLost: number;
  readonly hpRecovered: number;
  readonly deaths: number;
  readonly seriousInjuriesStarted: number;
  readonly seriousInjuriesCleared: number;
  readonly trustZeroed: number;
}

export interface DepletionPoolStateEvidence {
  readonly aliveCount: number;
  readonly deployableCount: number;
  readonly normalEligibleClassCount: number;
  readonly emergencyEligibleClassCount: number;
  readonly zeroTrustCount: number;
  readonly gravelyWoundedCount: number;
  readonly totalHp: number;
}

export interface TerminationSourceLoss {
  readonly source: Exclude<DepletionSource, "world-turn-rest">;
  readonly hpLost: number;
  readonly deaths: number;
  readonly seriousInjuriesStarted: number;
  readonly trustZeroed: number;
}

export interface CampaignTerminationEvidence {
  readonly sourceLosses: readonly TerminationSourceLoss[];
  readonly wipeSource: Extract<DepletionSource, "expedition-general" | "expedition-boss"> | null;
  readonly precedingPool: DepletionPoolStateEvidence;
  readonly resultingPool: DepletionPoolStateEvidence;
  readonly finalPool: DepletionPoolStateEvidence;
}

/**
 * Backtest-only battle evidence captured while a transition still owns its full
 * resolution. Campaign history deliberately retains only presentation details.
 */
export interface BattleTraceEntry {
  readonly kind: "general" | "boss";
  readonly expeditionId: string;
  readonly party: readonly {
    readonly characterId: CharacterId;
    readonly classId: ClassId;
    readonly hpBefore: number;
    readonly hpAfter: number;
    readonly maxHp: number;
  }[];
  readonly battle: BattleResolution;
}

export interface CampaignRunTrace {
  readonly seed: string;
  readonly strategyId: StrategyPolicy["id"];
  readonly accuracy: Accuracy;
  readonly actionTypes: readonly CampaignTransition["type"][];
  readonly adviceSelections: readonly AccuracySelection[];
  readonly betrayalExpeditionIds: readonly string[];
  readonly betrayalCandidateCount: number;
  readonly nodeCategoryChoices: Readonly<Record<PublicNodeCategory, number>>;
  readonly intendedAdviceCounts: Readonly<Record<AdviceOutcome, number>>;
  readonly selectedAdviceCounts: Readonly<Record<AdviceOutcome, number>>;
  readonly reactionCounts: Readonly<Record<InfoReaction, number>>;
  readonly merchantGoldSpent: number;
  readonly merchantEffectsConsumed: number;
  readonly balanceExpeditions: readonly ExpeditionBalanceTrace[];
  readonly battles: readonly BattleTraceEntry[];
  readonly depletion: readonly DepletionTraceEntry[];
  readonly terminationEvidence: CampaignTerminationEvidence | null;
  readonly termination: EndingKind | "run-error";
  readonly steps: number;
}

export type ExpeditionTraceResult = ExpeditionStatus | "interrupted";

export interface ExpeditionBalanceTrace {
  readonly expeditionId: string;
  readonly dungeonId: DungeonId;
  readonly theme: ThemeId;
  readonly initialRiskLevel: RiskLevel;
  readonly currentRiskLevel: RiskLevel;
  readonly attemptNumber: number;
  readonly startAdvicePressure: 0;
  readonly maxAdvicePressure: AdvicePressure;
  readonly bossEntry: null | {
    readonly advicePressure: AdvicePressure;
    readonly aliveCount: number;
    readonly hp: number;
    readonly maxHp: number;
  };
  readonly endAdvicePressure: AdvicePressure | null;
  readonly result: ExpeditionTraceResult;
}

export interface CampaignRunSuccess {
  readonly ok: true;
  readonly campaign: CampaignState;
  readonly trace: CampaignRunTrace;
}

export interface CampaignRunFailure {
  readonly ok: false;
  readonly campaign: CampaignState;
  readonly errorKind: RunErrorKind;
  readonly message: string;
  readonly phase: CampaignState["phase"];
  readonly trace: CampaignRunTrace;
}

export type CampaignRun = CampaignRunSuccess | CampaignRunFailure;

export interface CampaignRunOptions {
  readonly seed: string;
  readonly strategy: StrategyPolicy;
  readonly accuracy: Accuracy;
  readonly stepLimit?: number;
}

type MutableExpeditionBalanceTrace = {
  -readonly [Key in keyof Omit<ExpeditionBalanceTrace, "result">]: Omit<ExpeditionBalanceTrace, "result">[Key];
} & { result: ExpeditionTraceResult | null };

class DriverFailure extends Error {
  constructor(readonly kind: RunErrorKind, message: string) {
    super(message);
  }
}

type MutableTrace = {
  seed: string;
  strategyId: StrategyPolicy["id"];
  accuracy: Accuracy;
  actionTypes: CampaignTransition["type"][];
  adviceSelections: AccuracySelection[];
  betrayalExpeditionIds: string[];
  betrayalCandidateCount: number;
  nodeCategoryChoices: Record<PublicNodeCategory, number>;
  intendedAdviceCounts: Record<AdviceOutcome, number>;
  selectedAdviceCounts: Record<AdviceOutcome, number>;
  reactionCounts: Record<InfoReaction, number>;
  merchantGoldSpent: number;
  merchantEffectsConsumed: number;
  balanceExpeditions: MutableExpeditionBalanceTrace[];
  battles: BattleTraceEntry[];
  depletion: DepletionTraceEntry[];
  terminationEvidence: CampaignTerminationEvidence | null;
  steps: number;
};

function initialTrace(options: CampaignRunOptions): MutableTrace {
  return {
    seed: options.seed,
    strategyId: options.strategy.id,
    accuracy: options.accuracy,
    actionTypes: [],
    adviceSelections: [],
    betrayalExpeditionIds: [],
    betrayalCandidateCount: 0,
    nodeCategoryChoices: { rest: 0, merchant: 0, special: 0, monster: 0, boss: 0 },
    intendedAdviceCounts: { help: 0, harm: 0, neutral: 0 },
    selectedAdviceCounts: { help: 0, harm: 0, neutral: 0 },
    reactionCounts: { accepted: 0, suspected: 0, exposed: 0 },
    merchantGoldSpent: 0,
    merchantEffectsConsumed: 0,
    balanceExpeditions: [],
    battles: [],
    depletion: [],
    terminationEvidence: null,
    steps: 0,
  };
}

/** 드라이버가 상인 조언에서 생긴 비용과 효과 소비만 분리해 기록한다. */
export function merchantTraceDeltaFor(
  action: CampaignTransition,
  before: CampaignStoreState,
  after: CampaignStoreState,
): { readonly goldSpent: number; readonly effectsConsumed: number } {
  const merchantAdvice = action.type === "CHOOSE_ADVICE"
    && before.context.activeExpedition?.pendingEvent?.kind === "merchant";
  const beforeEffect = before.context.activeExpedition?.expedition.pendingMerchantEffect ?? null;
  const afterEffect = after.context.activeExpedition?.expedition.pendingMerchantEffect ?? null;
  return {
    goldSpent: merchantAdvice ? Math.max(0, before.campaign.gold - after.campaign.gold) : 0,
    effectsConsumed: beforeEffect !== null && afterEffect === null ? 1 : 0,
  };
}

function freezeTrace(
  trace: MutableTrace,
  state: CampaignStoreState,
  termination: EndingKind | "run-error",
): CampaignRunTrace {
  const active = state.context.activeExpedition;
  return {
    ...trace,
    termination,
    actionTypes: [...trace.actionTypes],
    adviceSelections: [...trace.adviceSelections],
    betrayalExpeditionIds: [...trace.betrayalExpeditionIds],
    nodeCategoryChoices: { ...trace.nodeCategoryChoices },
    intendedAdviceCounts: { ...trace.intendedAdviceCounts },
    selectedAdviceCounts: { ...trace.selectedAdviceCounts },
    reactionCounts: { ...trace.reactionCounts },
    balanceExpeditions: trace.balanceExpeditions.map((expedition) => ({
      ...expedition,
      endAdvicePressure: expedition.endAdvicePressure
        ?? (active?.expeditionId === expedition.expeditionId
          ? active.expedition.advicePressure
          : null),
      result: expedition.result ?? "interrupted",
      bossEntry: expedition.bossEntry === null ? null : { ...expedition.bossEntry },
    })),
    battles: trace.battles.map((entry) => ({
      ...entry,
      party: entry.party.map((member) => ({ ...member })),
      battle: {
        ...entry.battle,
        actions: entry.battle.actions.map((action) => ({ ...action })),
        party: entry.battle.party.map((member) => ({ ...member })),
        enemies: entry.battle.enemies.map((enemy) => ({
          ...enemy,
          targetWeightMultipliers: enemy.targetWeightMultipliers === undefined
            ? undefined
            : { ...enemy.targetWeightMultipliers },
        })),
      },
    })),
    depletion: trace.depletion.map((entry) => ({ ...entry })),
    terminationEvidence: trace.terminationEvidence === null ? null : {
      sourceLosses: trace.terminationEvidence.sourceLosses.map((loss) => ({ ...loss })),
      wipeSource: trace.terminationEvidence.wipeSource,
      precedingPool: { ...trace.terminationEvidence.precedingPool },
      resultingPool: { ...trace.terminationEvidence.resultingPool },
      finalPool: poolStateEvidence(state),
    },
  };
}

function appendBattleTraceFor(
  action: CampaignTransition,
  before: CampaignStoreState,
  after: CampaignStoreState,
  trace: MutableTrace,
): void {
  const beforeActive = before.context.activeExpedition;
  const afterActive = after.context.activeExpedition;
  if (beforeActive === null || afterActive === null || beforeActive.expeditionId !== afterActive.expeditionId) return;

  const kind = action.type === "CHOOSE_ADVICE"
    ? "general"
    : action.type === "ENTER_BOSS"
      ? "boss"
      : null;
  if (kind === null) return;
  const battle = kind === "general"
    ? afterActive.pendingOutcome?.battle ?? null
    : afterActive.expedition.bossResult?.battle ?? null;
  if (battle === null) return;

  const afterById = new Map(afterActive.partyMembers.map((member) => [member.id, member]));
  trace.battles.push({
    kind,
    expeditionId: beforeActive.expeditionId,
    party: beforeActive.partyMembers.map((member) => ({
      characterId: member.id,
      classId: member.classId,
      hpBefore: member.hp,
      hpAfter: afterById.get(member.id)?.hp ?? member.hp,
      maxHp: member.maxHp,
    })),
    battle,
  });
}

function balanceTraceFor(trace: MutableTrace, expeditionId: string): MutableExpeditionBalanceTrace {
  const expedition = trace.balanceExpeditions.find((candidate) => candidate.expeditionId === expeditionId);
  if (expedition === undefined) throw new DriverFailure("stall", `원정 밸런스 trace가 없다: ${expeditionId}`);
  return expedition;
}

type PoolDelta = Pick<DepletionTraceEntry,
  "hpLost" | "hpRecovered" | "deaths" | "seriousInjuriesStarted" | "seriousInjuriesCleared" | "trustZeroed">;

function poolStateEvidence(state: CampaignStoreState): DepletionPoolStateEvidence {
  const activeById = new Map(state.context.activeExpedition?.partyMembers.map((member) => [member.id, member]) ?? []);
  const members = state.campaign.pool.order.flatMap((id) => {
    const member = activeById.get(id) ?? state.campaign.pool.byId[id];
    return member === undefined ? [] : [member];
  });
  return {
    aliveCount: members.filter((member) => member.alive).length,
    deployableCount: members.filter(canDeploy).length,
    normalEligibleClassCount: new Set(members.filter(canDeploy).map((member) => member.classId)).size,
    emergencyEligibleClassCount: new Set(members.filter(canDeployEmergency).map((member) => member.classId)).size,
    zeroTrustCount: members.filter((member) => member.trust === 0).length,
    gravelyWoundedCount: members.filter((member) => member.gravelyWounded).length,
    totalHp: members.reduce((sum, member) => sum + member.hp, 0),
  };
}

function sourceLossesFor(entries: readonly DepletionTraceEntry[]): readonly TerminationSourceLoss[] {
  return entries.flatMap((entry) => entry.source === "world-turn-rest"
    || (entry.hpLost === 0 && entry.deaths === 0 && entry.seriousInjuriesStarted === 0 && entry.trustZeroed === 0)
    ? []
    : [{
      source: entry.source,
      hpLost: entry.hpLost,
      deaths: entry.deaths,
      seriousInjuriesStarted: entry.seriousInjuriesStarted,
      trustZeroed: entry.trustZeroed,
    }]);
}

function wipeSourceFor(
  after: CampaignStoreState,
  sourceLosses: readonly TerminationSourceLoss[],
): CampaignTerminationEvidence["wipeSource"] {
  const active = after.context.activeExpedition;
  const wiped = active?.expedition.result?.status === "wiped"
    || active?.expedition.bossResult?.status === "wiped";
  if (!wiped) return null;
  const expeditionSources = [...new Set(sourceLosses.flatMap((loss) =>
    loss.source === "expedition-general" || loss.source === "expedition-boss" ? [loss.source] : [],
  ))];
  return expeditionSources.length === 1 ? expeditionSources[0]! : null;
}

function poolDelta(
  before: CampaignStoreState,
  after: CampaignStoreState,
  characterIds: readonly CharacterId[] = before.campaign.pool.order,
): PoolDelta {
  return characterIds.reduce<PoolDelta>((delta, characterId) => {
    const beforeMember = before.campaign.pool.byId[characterId];
    const afterMember = after.campaign.pool.byId[characterId];
    if (beforeMember === undefined || afterMember === undefined) return delta;
    return {
      hpLost: delta.hpLost + Math.max(0, beforeMember.hp - afterMember.hp),
      hpRecovered: delta.hpRecovered + Math.max(0, afterMember.hp - beforeMember.hp),
      deaths: delta.deaths + Number(beforeMember.alive && !afterMember.alive),
      seriousInjuriesStarted: delta.seriousInjuriesStarted + Number(!beforeMember.gravelyWounded && afterMember.gravelyWounded),
      seriousInjuriesCleared: delta.seriousInjuriesCleared + Number(beforeMember.gravelyWounded && !afterMember.gravelyWounded),
      trustZeroed: delta.trustZeroed + Number(beforeMember.trust > 0 && afterMember.trust === 0),
    };
  }, {
    hpLost: 0,
    hpRecovered: 0,
    deaths: 0,
    seriousInjuriesStarted: 0,
    seriousInjuriesCleared: 0,
    trustZeroed: 0,
  });
}

function expeditionPoolDelta(before: CampaignStoreState, after: CampaignStoreState): PoolDelta {
  const beforeActive = before.context.activeExpedition;
  const afterActive = after.context.activeExpedition;
  if (beforeActive === null || afterActive === null) {
    throw new DriverFailure("stall", "원정 손실을 비교할 활성 원정이 없다");
  }
  const afterById = new Map(afterActive.partyMembers.map((member) => [member.id, member]));
  return beforeActive.partyMembers.reduce<PoolDelta>((delta, beforeMember) => {
    const afterMember = afterById.get(beforeMember.id);
    if (afterMember === undefined) return delta;
    return {
      hpLost: delta.hpLost + Math.max(0, beforeMember.hp - afterMember.hp),
      hpRecovered: delta.hpRecovered + Math.max(0, afterMember.hp - beforeMember.hp),
      deaths: delta.deaths + Number(beforeMember.alive && !afterMember.alive),
      seriousInjuriesStarted: delta.seriousInjuriesStarted + Number(!beforeMember.gravelyWounded && afterMember.gravelyWounded),
      seriousInjuriesCleared: delta.seriousInjuriesCleared + Number(beforeMember.gravelyWounded && !afterMember.gravelyWounded),
      trustZeroed: delta.trustZeroed + Number(beforeMember.trust > 0 && afterMember.trust === 0),
    };
  }, {
    hpLost: 0,
    hpRecovered: 0,
    deaths: 0,
    seriousInjuriesStarted: 0,
    seriousInjuriesCleared: 0,
    trustZeroed: 0,
  });
}

function expeditionSettlementDelta(before: CampaignStoreState, after: CampaignStoreState): PoolDelta {
  const active = before.context.activeExpedition;
  if (active === null) throw new DriverFailure("stall", "정산 손실을 비교할 활성 원정이 없다");
  return active.partyMembers.reduce<PoolDelta>((delta, beforeMember) => {
    const afterMember = after.campaign.pool.byId[beforeMember.id];
    if (afterMember === undefined) return delta;
    return {
      ...delta,
      seriousInjuriesStarted: delta.seriousInjuriesStarted + Number(!beforeMember.gravelyWounded && afterMember.gravelyWounded),
      seriousInjuriesCleared: delta.seriousInjuriesCleared + Number(beforeMember.gravelyWounded && !afterMember.gravelyWounded),
    };
  }, {
    hpLost: 0,
    hpRecovered: 0,
    deaths: 0,
    seriousInjuriesStarted: 0,
    seriousInjuriesCleared: 0,
    trustZeroed: 0,
  });
}

function expeditionLocator(
  trace: MutableTrace,
  expeditionId: string,
): Pick<DepletionTraceEntry, "expeditionId" | "dungeonId" | "initialRiskLevel" | "attemptNumber"> {
  const expedition = balanceTraceFor(trace, expeditionId);
  return {
    expeditionId,
    dungeonId: expedition.dungeonId,
    initialRiskLevel: expedition.initialRiskLevel,
    attemptNumber: expedition.attemptNumber,
  };
}

function appendDepletionFor(
  action: CampaignTransition,
  before: CampaignStoreState,
  after: CampaignStoreState,
  trace: MutableTrace,
): void {
  const appendExpedition = (
    source: Extract<DepletionSource, "expedition-general" | "expedition-boss">,
    delta = expeditionPoolDelta(before, after),
  ): void => {
    const active = before.context.activeExpedition;
    if (active === null) throw new DriverFailure("stall", "원정 손실을 기록할 활성 원정이 없다");
    trace.depletion.push({
      source,
      worldTurn: after.campaign.worldTurn,
      ...expeditionLocator(trace, active.expeditionId),
      ...delta,
    });
  };

  if (action.type === "CHOOSE_ADVICE") {
    appendExpedition("expedition-general");
    return;
  }
  if (action.type === "ENTER_BOSS") {
    appendExpedition("expedition-boss");
    return;
  }
  if (action.type === "COMPLETE_EXPEDITION") {
    const active = before.context.activeExpedition;
    if (active === null) throw new DriverFailure("stall", "정산 손실을 기록할 활성 원정이 없다");
    appendExpedition(active.expedition.bossResult === null ? "expedition-general" : "expedition-boss", expeditionSettlementDelta(before, after));
    return;
  }
  if (action.type !== "COMPLETE_WORLD_TURN") return;

  const worldTurn = after.last?.worldTurn;
  if (worldTurn === null || worldTurn === undefined) {
    throw new DriverFailure("stall", "월드턴 완료 뒤 결과가 없다");
  }
  const appendWorldTurn = (source: Extract<DepletionSource, "world-turn-background" | "world-turn-rest">, characterIds: readonly CharacterId[]): void => {
    if (characterIds.length === 0) return;
    trace.depletion.push({
      source,
      worldTurn: worldTurn.worldTurn,
      expeditionId: null,
      dungeonId: null,
      initialRiskLevel: null,
      attemptNumber: null,
      ...poolDelta(before, after, characterIds),
    });
  };
  appendWorldTurn(
    "world-turn-background",
    worldTurn.outcomes.filter((outcome) => outcome.activity === "background").map((outcome) => outcome.characterId),
  );
  appendWorldTurn(
    "world-turn-rest",
    worldTurn.outcomes.filter((outcome) => outcome.activity === "rest" || outcome.activity === "forcedRest")
      .map((outcome) => outcome.characterId),
  );
}

function signature(campaign: CampaignState, active: ReturnType<ReturnType<typeof createCampaignStore>["getState"]>["context"]["activeExpedition"]): string {
  return JSON.stringify({
    phase: campaign.phase,
    rank: campaign.rank,
    worldTurn: campaign.worldTurn,
    dungeon: active?.expedition.dungeonId,
    node: active?.expedition.currentNodeId,
    pending: active?.pendingEvent?.id,
    outcome: active?.pendingOutcome?.event.id,
    result: active?.expedition.result?.status,
  });
}

function endingKind(campaign: CampaignState): EndingKind | null {
  return campaign.ending?.kind ?? null;
}

function selectableAdviceOptions(
  campaign: CampaignState,
  active: ActiveExpeditionContext,
): readonly BaseAdviceOption[] {
  const event = active.pendingEvent;
  if (event === null) throw new DriverFailure("stall", "대기 중인 사건이 없다");
  if (event.kind !== "merchant") return event.advice;
  return event.advice.filter((advice) => getMerchantAdviceAvailability(
    advice,
    campaign.gold,
    active.expedition.pendingMerchantEffect,
  ).executable);
}

export function runCampaign(options: CampaignRunOptions): CampaignRun {
  const store = createCampaignStore(options.seed);
  const trace = initialTrace(options);
  let pendingBetrayal = false;
  const limit = options.stepLimit ?? 800;
  let previousSignature: string | null = null;

  const fail = (kind: RunErrorKind, message: string): never => {
    throw new DriverFailure(kind, message);
  };

  const act = (action: CampaignTransition): void => {
    if (trace.steps >= limit) fail("step-limit", `800 action 안에 엔딩에 도달하지 못했다`);
    const before = store.getState();
    const precedingPool = poolStateEvidence(before);
    const depletionStart = trace.depletion.length;
    before.dispatch(action);
    trace.steps += 1;
    trace.actionTypes.push(action.type);
    const after = store.getState();
    if (after.rejected !== null) fail("rejected-transition", `${after.rejected.type}: ${after.rejected.reason}`);
    const merchantDelta = merchantTraceDeltaFor(action, before, after);
    trace.merchantGoldSpent += merchantDelta.goldSpent;
    trace.merchantEffectsConsumed += merchantDelta.effectsConsumed;
    appendBattleTraceFor(action, before, after, trace);
    appendDepletionFor(action, before, after, trace);
    const finalPool = poolStateEvidence(after);
    if (precedingPool.emergencyEligibleClassCount >= 3 && finalPool.emergencyEligibleClassCount < 3) {
      const sourceLosses = sourceLossesFor(trace.depletion.slice(depletionStart));
      trace.terminationEvidence = {
        sourceLosses,
        wipeSource: wipeSourceFor(after, sourceLosses),
        precedingPool,
        resultingPool: finalPool,
        finalPool,
      };
    }
    const event = after.campaign.history.events.at(-1);
    if (event?.type === "ADVICE_RESOLVED") {
      for (const reaction of event.reactions) trace.reactionCounts[reaction.reaction] += 1;
    }
  };

  try {
    for (;;) {
      const state = store.getState();
      const { campaign, context } = state;
      if (campaign.phase === "ended") {
        const ending = campaign.ending;
        if (ending === null) throw new DriverFailure("stall", "종료된 캠페인에 종료 사유가 없다");
        return { ok: true, campaign, trace: freezeTrace(trace, state, ending.kind) };
      }
      const currentSignature = signature(campaign, context.activeExpedition);
      if (currentSignature === previousSignature) fail("stall", "같은 캠페인 상태가 반복되었다");
      previousSignature = currentSignature;

      if (campaign.phase === "intro") {
        act({ type: "OPEN_BOARD" });
        continue;
      }
      if (campaign.phase === "settlement") {
        act({ type: "START_WORLD_TURN" });
        continue;
      }
      if (campaign.phase === "worldTurn") {
        act({ type: "COMPLETE_WORLD_TURN" });
        continue;
      }
      if (campaign.phase === "promotion") {
        const eligibility = getGuidePromotionEligibility(campaign);
        if (eligibility === null) throw new DriverFailure("invalid-strategy-decision", "승급 화면에 자격 정보가 없다");
        const method = options.strategy.choosePromotion(projectBoardDecision(campaign));
        if (method === null) throw new DriverFailure("invalid-strategy-decision", "승급 화면에서 전략이 대기했다");
        act({ type: "PROMOTE_GUIDE", method });
        continue;
      }
      if (campaign.phase === "board") {
        const view = projectBoardDecision(campaign);
        const promotion = options.strategy.choosePromotion(view);
        if (promotion !== null) {
          act({ type: "OPEN_PROMOTION" });
          continue;
        }
        const decision = options.strategy.chooseOffer(view);
        const offer = campaign.offers.find((candidate) => candidate.id === decision.offerId);
        if (offer === undefined || offer.lockReason !== null) throw new DriverFailure("invalid-strategy-decision", `선택할 수 없는 공고: ${String(decision.offerId)}`);
        pendingBetrayal = decision.betrayal;
        act({ type: "SELECT_CONTRACT", offerId: decision.offerId });
        continue;
      }
      if (campaign.phase === "contract") {
        const offer = context.selectedOffer;
        if (offer === null) throw new DriverFailure("stall", "계약 단계에 선택 공고가 없다");
        const expeditionId = `exp-${campaign.worldTurn}-${trace.steps}`;
        const prepared = createExpeditionForOffer(campaign, offer);
        if (pendingBetrayal) trace.betrayalExpeditionIds.push(expeditionId);
        pendingBetrayal = false;
        act({ type: "START_EXPEDITION", expeditionId, ...prepared });
        const started = store.getState();
        const active = started.context.activeExpedition;
        if (active === null) throw new DriverFailure("stall", "원정 시작 뒤 활성 원정이 없다");
        const dungeon = started.campaign.dungeons.find((candidate) => candidate.id === active.expedition.dungeonId);
        if (dungeon === undefined) throw new DriverFailure("stall", `원정 던전이 없다: ${active.expedition.dungeonId}`);
        trace.balanceExpeditions.push({
          expeditionId,
          dungeonId: active.expedition.dungeonId,
          theme: dungeon.theme,
          initialRiskLevel: dungeon.initialRiskLevel,
          currentRiskLevel: dungeon.riskLevel,
          attemptNumber: dungeon.attempts + 1,
          startAdvicePressure: 0,
          maxAdvicePressure: active.expedition.advicePressure,
          bossEntry: null,
          endAdvicePressure: null,
          result: null,
        });
        continue;
      }
      if (campaign.phase !== "expedition") throw new DriverFailure("stall", `처리할 수 없는 phase: ${campaign.phase}`);
      const active = context.activeExpedition;
      if (active === null) throw new DriverFailure("stall", "expedition phase에 활성 원정이 없다");
      const betrayed = trace.betrayalExpeditionIds.includes(active.expeditionId);
      if (active.pendingOutcome !== null) {
        act({ type: "ACKNOWLEDGE_OUTCOME" });
        continue;
      }
      if (active.expedition.result !== null || active.expedition.bossResult !== null) {
        const entry = balanceTraceFor(trace, active.expeditionId);
        entry.endAdvicePressure = active.expedition.advicePressure;
        entry.result = active.expedition.result?.status ?? active.expedition.bossResult?.status ?? null;
        act({ type: "COMPLETE_EXPEDITION", snapshot: createSettlementSnapshotFor(campaign, active) });
        continue;
      }
      if (active.pendingEvent !== null) {
        const view = projectAdviceDecision(campaign, active, betrayed);
        const intent = options.strategy.chooseAdviceIntent(view);
        if (intent !== "help" && intent !== "harm" && intent !== "neutral") fail("invalid-strategy-decision", `잘못된 조언 의도: ${intent}`);
        const selectable = selectableAdviceOptions(campaign, active);
        if (selectable.length === 0) fail("invalid-strategy-decision", "실행 가능한 조언이 없다");
        const intendedIsSelectable = selectable.some((option) => option.outcome === intent);
        const selection = intendedIsSelectable
          ? selectAdviceByAccuracy({
            campaignSeed: campaign.seed,
            strategyId: options.strategy.id,
            accuracy: options.accuracy,
            expeditionId: active.expeditionId,
            decisionIndex: trace.adviceSelections.length,
            intendedOutcome: intent,
            options: selectable,
          })
          : {
            adviceId: selectable[0]!.id,
            intendedOutcome: intent,
            selectedOutcome: selectable[0]!.outcome,
            hit: false,
          };
        trace.adviceSelections.push(selection);
        trace.intendedAdviceCounts[intent] += 1;
        trace.selectedAdviceCounts[selection.selectedOutcome] += 1;
        act({ type: "CHOOSE_ADVICE", adviceId: selection.adviceId });
        const updated = store.getState().context.activeExpedition;
        if (updated === null) throw new DriverFailure("stall", "조언 처리 뒤 활성 원정이 없다");
        const entry = balanceTraceFor(trace, updated.expeditionId);
        entry.maxAdvicePressure = Math.max(entry.maxAdvicePressure, updated.expedition.advicePressure) as AdvicePressure;
        continue;
      }
      const mapView = projectMapDecision(campaign, active, betrayed);
      const here = active.expedition.map.nodes.find((node) => node.id === active.expedition.currentNodeId);
      const next = here?.nextNodeIds.find((id) => !active.expedition.visitedNodeIds.includes(id));
      if (next === undefined) {
        if (active.expedition.currentNodeId !== active.expedition.map.bossNodeId) fail("stall", `원정이 갇혔다: ${active.expedition.currentNodeId}`);
        const entry = balanceTraceFor(trace, active.expeditionId);
        const living = active.partyMembers.filter((member) => member.alive);
        entry.bossEntry = {
          advicePressure: active.expedition.advicePressure,
          aliveCount: living.length,
          hp: living.reduce((sum, member) => sum + member.hp, 0),
          maxHp: living.reduce((sum, member) => sum + member.maxHp, 0),
        };
        act({ type: "ENTER_BOSS" });
        continue;
      }
      const chosen = options.strategy.chooseNode(mapView);
      const chosenNode = mapView.nextNodes.find((node) => node.id === chosen);
      if (chosenNode === undefined) throw new DriverFailure("invalid-strategy-decision", `연결되지 않은 지점: ${String(chosen)}`);
      trace.nodeCategoryChoices[chosenNode.category] += 1;
      act({ type: "VISIT_NODE", nodeId: chosen });
    }
  } catch (error) {
    const current = store.getState();
    const failure = error instanceof DriverFailure
      ? error
      : error instanceof InvalidStrategyDecisionError
        ? new DriverFailure("invalid-strategy-decision", error.message)
        : error instanceof RuleError
          ? new DriverFailure("generation", error.message)
          : new DriverFailure("generation", error instanceof Error ? error.message : String(error));
    return {
      ok: false,
      campaign: current.campaign,
      errorKind: failure.kind,
      message: failure.message,
      phase: current.campaign.phase,
      trace: freezeTrace(trace, current, "run-error"),
    };
  }
}
