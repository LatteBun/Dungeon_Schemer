import { createExpeditionForOffer, createSettlementSnapshotFor } from "@/lib/rules/campaign-transition";
import { getMerchantAdviceAvailability } from "@/lib/rules/merchant";
import { getGuidePromotionEligibility } from "@/lib/rules/promotion";
import { createCampaignStore } from "@/lib/store/campaign-store";
import { RuleError } from "@/lib/domain";
import type {
  ActiveExpeditionContext,
  AdvicePressure,
  AdviceOutcome,
  BaseAdviceOption,
  CampaignState,
  CampaignTransition,
  DungeonId,
  EndingKind,
  ExpeditionStatus,
  InfoReaction,
  RiskLevel,
  ThemeId,
} from "@/lib/domain";
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
  readonly steps: number;
}

export interface ExpeditionBalanceTrace {
  readonly expeditionId: string;
  readonly dungeonId: DungeonId;
  readonly theme: ThemeId;
  readonly initialRiskLevel: RiskLevel;
  readonly startAdvicePressure: 0;
  readonly maxAdvicePressure: AdvicePressure;
  readonly bossEntry: null | {
    readonly advicePressure: AdvicePressure;
    readonly aliveCount: number;
    readonly hp: number;
    readonly maxHp: number;
  };
  readonly endAdvicePressure: AdvicePressure | null;
  readonly result: ExpeditionStatus | null;
}

export interface CampaignRunSuccess {
  readonly ok: true;
  readonly campaign: CampaignState;
  readonly trace: CampaignRunTrace;
}

export interface CampaignRunFailure {
  readonly ok: false;
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
  -readonly [Key in keyof ExpeditionBalanceTrace]: ExpeditionBalanceTrace[Key];
};

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
    steps: 0,
  };
}

function freezeTrace(trace: MutableTrace): CampaignRunTrace {
  return {
    ...trace,
    actionTypes: [...trace.actionTypes],
    adviceSelections: [...trace.adviceSelections],
    betrayalExpeditionIds: [...trace.betrayalExpeditionIds],
    nodeCategoryChoices: { ...trace.nodeCategoryChoices },
    intendedAdviceCounts: { ...trace.intendedAdviceCounts },
    selectedAdviceCounts: { ...trace.selectedAdviceCounts },
    reactionCounts: { ...trace.reactionCounts },
    balanceExpeditions: trace.balanceExpeditions.map((expedition) => ({
      ...expedition,
      bossEntry: expedition.bossEntry === null ? null : { ...expedition.bossEntry },
    })),
  };
}

function balanceTraceFor(trace: MutableTrace, expeditionId: string): MutableExpeditionBalanceTrace {
  const expedition = trace.balanceExpeditions.find((candidate) => candidate.expeditionId === expeditionId);
  if (expedition === undefined) throw new DriverFailure("stall", `원정 밸런스 trace가 없다: ${expeditionId}`);
  return expedition;
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
    const beforeGold = before.campaign.gold;
    const beforeMerchant = before.context.activeExpedition?.expedition.pendingMerchantEffect !== null;
    before.dispatch(action);
    trace.steps += 1;
    trace.actionTypes.push(action.type);
    const after = store.getState();
    if (after.rejected !== null) fail("rejected-transition", `${after.rejected.type}: ${after.rejected.reason}`);
    trace.merchantGoldSpent += Math.max(0, beforeGold - after.campaign.gold);
    const afterMerchant = after.context.activeExpedition?.expedition.pendingMerchantEffect !== null;
    if (beforeMerchant && !afterMerchant) trace.merchantEffectsConsumed += 1;
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
        return { ok: true, campaign, trace: freezeTrace(trace) };
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
      if (active.expedition.result !== null || active.expedition.bossResult !== null) {
        const entry = balanceTraceFor(trace, active.expeditionId);
        entry.endAdvicePressure = active.expedition.advicePressure;
        entry.result = active.expedition.result?.status ?? active.expedition.bossResult?.status ?? null;
        act({ type: "COMPLETE_EXPEDITION", snapshot: createSettlementSnapshotFor(campaign, active) });
        continue;
      }
      if (active.pendingOutcome !== null) {
        act({ type: "ACKNOWLEDGE_OUTCOME" });
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
      errorKind: failure.kind,
      message: failure.message,
      phase: current.campaign.phase,
      trace: freezeTrace(trace),
    };
  }
}
