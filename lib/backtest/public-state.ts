import { publicKindByNodeId } from "@/components/game/campaign-adapters";
import { SHARED_MERCHANT_EVENTS } from "@/lib/content/shared-merchant-events";
import { THEMES } from "@/lib/content/themes";
import type {
  ActiveExpeditionContext,
  BaseAdviceOption,
  BoardOffer,
  CampaignState,
  Character,
  CharacterId,
  ClassId,
  ContractReward,
  DungeonId,
  EventKind,
  GuideRank,
  NodeId,
  OfferId,
  OfferLockReason,
  Personality,
  PresentedAdviceOption,
  PromotionEligibility,
  RiskLevel,
  RuleId,
  ThemeId,
} from "@/lib/domain";
import { getGuidePromotionEligibility } from "@/lib/rules/promotion";
import { presentShuffledAdvice } from "@/lib/rules/advice-evaluation";

export type StrategyId = "survival" | "opportunist" | "selective-betrayal";
export type Accuracy = 0.4 | 0.7;
export type PublicNodeCategory = EventKind | "boss";

export interface PublicMemberView {
  readonly id: CharacterId;
  readonly classId: ClassId;
  readonly personality: Personality;
  readonly hp: number;
  readonly maxHp: number;
  readonly trust: number;
  readonly gold: number;
  readonly alive: boolean;
  readonly gravelyWounded: boolean;
}

export interface PublicOfferView {
  readonly id: OfferId;
  readonly dungeonId: DungeonId;
  readonly dungeonName: string;
  readonly theme: ThemeId;
  readonly riskLevel: RiskLevel;
  readonly fullSurvivorReward: ContractReward;
  readonly lockReason: OfferLockReason | null;
  readonly party: readonly PublicMemberView[];
}

export interface BoardDecisionView {
  readonly rank: GuideRank;
  readonly reputation: number;
  readonly gold: number;
  readonly cumulativeGold: number;
  readonly remainingDungeonCount: number;
  readonly offers: readonly PublicOfferView[];
  readonly pool: readonly PublicMemberView[];
  readonly promotion: PromotionEligibility | null;
}

export interface PublicNodeView {
  readonly id: NodeId;
  readonly category: PublicNodeCategory;
}

export interface MapDecisionView {
  readonly expeditionId: string;
  readonly betrayed: boolean;
  readonly currentNodeId: NodeId;
  readonly nextNodes: readonly PublicNodeView[];
  readonly visitedNodeIds: readonly NodeId[];
  readonly bossNodeId: NodeId;
  readonly party: readonly PublicMemberView[];
  readonly campaignGold: number;
  readonly hasPendingMerchantEffect: boolean;
  readonly disclosedRuleIds: readonly RuleId[];
  readonly observations: readonly string[];
}

export interface AdviceDecisionView {
  readonly expeditionId: string;
  readonly betrayed: boolean;
  readonly category: EventKind;
  readonly title: string;
  readonly description: string;
  readonly options: readonly PresentedAdviceOption[];
  readonly party: readonly PublicMemberView[];
  readonly campaignGold: number;
  readonly goldPromotionCost?: number;
  readonly hasPendingMerchantEffect: boolean;
  readonly disclosedRuleIds: readonly RuleId[];
  readonly observations: readonly string[];
}

function publicMember(member: Character): PublicMemberView {
  const { id, classId, personality, hp, maxHp, trust, gold, alive, gravelyWounded } = member;
  return { id, classId, personality, hp, maxHp, trust, gold, alive, gravelyWounded };
}

function publicParty(members: readonly Character[]): readonly PublicMemberView[] {
  return members.map(publicMember);
}

function dungeonFor(campaign: CampaignState, dungeonId: DungeonId) {
  const dungeon = campaign.dungeons.find((candidate) => candidate.id === dungeonId);
  if (dungeon === undefined) throw new Error(`던전을 찾을 수 없다: ${dungeonId}`);
  return dungeon;
}

function themeFor(themeId: ThemeId) {
  const theme = THEMES.find((candidate) => candidate.id === themeId);
  if (theme === undefined) throw new Error(`테마를 찾을 수 없다: ${themeId}`);
  return theme;
}

function publicOffer(campaign: CampaignState, offer: BoardOffer): PublicOfferView {
  const dungeon = dungeonFor(campaign, offer.dungeonId);
  return {
    id: offer.id,
    dungeonId: dungeon.id,
    dungeonName: dungeon.name,
    theme: dungeon.theme,
    riskLevel: offer.riskLevel,
    fullSurvivorReward: { ...offer.reward },
    lockReason: offer.lockReason,
    party: publicParty(offer.party.memberIds.map((id) => campaign.pool.byId[id]).filter((member): member is Character => member !== undefined)),
  };
}

export function projectBoardDecision(campaign: CampaignState): BoardDecisionView {
  return {
    rank: campaign.rank,
    reputation: campaign.reputation,
    gold: campaign.gold,
    cumulativeGold: campaign.cumulativeGold,
    remainingDungeonCount: campaign.dungeons.filter((dungeon) => dungeon.status !== "cleared").length,
    offers: campaign.offers.map((offer) => publicOffer(campaign, offer)),
    pool: publicParty(campaign.pool.order.map((id) => campaign.pool.byId[id]).filter((member): member is Character => member !== undefined)),
    promotion: getGuidePromotionEligibility(campaign),
  };
}

function observations(active: ActiveExpeditionContext): readonly string[] {
  return active.expedition.infoRecords.map((record) => `${record.eventId}:${record.adviceId}`);
}

export function projectMapDecision(
  campaign: CampaignState,
  active: ActiveExpeditionContext,
  betrayed: boolean,
): MapDecisionView {
  const current = active.expedition.map.nodes.find((node) => node.id === active.expedition.currentNodeId);
  if (current === undefined) throw new Error(`현재 지점을 찾을 수 없다: ${active.expedition.currentNodeId}`);
  const kinds = publicKindByNodeId(active);
  return {
    expeditionId: active.expeditionId,
    betrayed,
    currentNodeId: active.expedition.currentNodeId,
    nextNodes: current.nextNodeIds.map((id) => ({
      id,
      category: id === active.expedition.map.bossNodeId ? "boss" : kinds[id] ?? "special",
    })),
    visitedNodeIds: [...active.expedition.visitedNodeIds],
    bossNodeId: active.expedition.map.bossNodeId,
    party: publicParty(active.partyMembers),
    campaignGold: campaign.gold,
    hasPendingMerchantEffect: active.expedition.pendingMerchantEffect !== null,
    disclosedRuleIds: [...active.expedition.disclosedRuleIds],
    observations: observations(active),
  };
}

export function projectAdviceDecision(
  campaign: CampaignState,
  active: ActiveExpeditionContext,
  betrayed: boolean,
): AdviceDecisionView {
  const event = active.pendingEvent;
  if (event === null) throw new Error("대기 중인 사건이 없다");
  const dungeon = dungeonFor(campaign, active.expedition.dungeonId);
  const depth = active.expedition.map.layers.findIndex((layer) => layer.nodeIds.includes(active.expedition.currentNodeId));
  const presented = presentShuffledAdvice({
    campaignSeed: campaign.seed,
    dungeonId: dungeon.id,
    attempt: dungeon.attempts,
    depth: depth < 0 ? 0 : depth,
    event,
  });
  return {
    expeditionId: active.expeditionId,
    betrayed,
    category: event.kind,
    title: event.title,
    description: event.description,
    options: presented,
    party: publicParty(active.partyMembers),
    campaignGold: campaign.gold,
    goldPromotionCost: getGuidePromotionEligibility(campaign)?.goldRequired,
    hasPendingMerchantEffect: active.expedition.pendingMerchantEffect !== null,
    disclosedRuleIds: [...active.expedition.disclosedRuleIds],
    observations: observations(active),
  };
}

export function maxMerchantGoldCost(): number {
  return Math.max(...SHARED_MERCHANT_EVENTS.flatMap((event) => event.advice
    .map((advice) => advice.goldCost)
    .filter((cost): cost is number => typeof cost === "number")));
}
