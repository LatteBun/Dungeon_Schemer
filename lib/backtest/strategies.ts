import { maxMerchantGoldCost, type AdviceDecisionView, type Accuracy, type BoardDecisionView, type MapDecisionView, type PublicMemberView, type StrategyId } from "./public-state";
import type { AdviceOutcome, CharacterId, ClassId, GuideRank, NodeId, OfferId, PromotionMethod } from "@/lib/domain";

export interface OfferDecision {
  readonly offerId: OfferId;
  readonly betrayal: boolean;
}

export interface StrategyPolicy {
  readonly id: StrategyId;
  chooseOffer(view: BoardDecisionView): OfferDecision;
  choosePromotion(view: BoardDecisionView): PromotionMethod | null;
  chooseNode(view: MapDecisionView): NodeId;
  chooseAdviceIntent(view: AdviceDecisionView): AdviceOutcome;
}

export interface PartyCapacity {
  readonly normal: number;
  readonly emergency: number;
}

const PATH_PRIORITY: Readonly<Record<StrategyId, readonly string[]>> = {
  survival: ["rest", "merchant", "special", "monster", "boss"],
  opportunist: ["special", "merchant", "rest", "monster", "boss"],
  "selective-betrayal": ["monster", "special", "merchant", "rest", "boss"],
};

function maximumDisjointParties(counts: ReadonlyMap<ClassId, number>): number {
  const classes = [...counts.keys()].sort((left, right) => String(left).localeCompare(String(right)));
  const triples: (readonly number[])[] = [];
  for (let first = 0; first < classes.length - 2; first += 1) {
    for (let second = first + 1; second < classes.length - 1; second += 1) {
      for (let third = second + 1; third < classes.length; third += 1) triples.push([first, second, third]);
    }
  }
  const memo = new Map<string, number>();
  const visit = (remaining: readonly number[]): number => {
    const key = remaining.join(",");
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let best = 0;
    for (const triple of triples) {
      if (!triple.every((index) => remaining[index]! > 0)) continue;
      const next = remaining.map((count, index) => count - (triple.includes(index) ? 1 : 0));
      best = Math.max(best, 1 + visit(next));
    }
    memo.set(key, best);
    return best;
  };
  return visit(classes.map((classId) => counts.get(classId) ?? 0));
}

function countCapacity(members: readonly PublicMemberView[], includeWounded: boolean): number {
  const counts = new Map<ClassId, number>();
  for (const member of members) {
    if (!member.alive || member.trust <= 0 || (!includeWounded && member.gravelyWounded)) continue;
    counts.set(member.classId, (counts.get(member.classId) ?? 0) + 1);
  }
  return maximumDisjointParties(counts);
}

export function partyCapacityAfterHypotheticalWipe(
  pool: readonly PublicMemberView[],
  wipedIds: readonly CharacterId[],
): PartyCapacity {
  const wiped = new Set(wipedIds);
  const remaining = pool.filter((member) => !wiped.has(member.id));
  return { normal: countCapacity(remaining, false), emergency: countCapacity(remaining, true) };
}

function minimumHpRatio(party: readonly PublicMemberView[]): number {
  return Math.min(...party.map((member) => member.hp / member.maxHp));
}

function minimumTrust(party: readonly PublicMemberView[]): number {
  return Math.min(...party.map((member) => member.trust));
}

function accessibleOffers(view: BoardDecisionView) {
  return view.offers.filter((offer) => offer.lockReason === null);
}

function hasProgressionLock(view: BoardDecisionView): boolean {
  const promotion = view.promotion;
  return promotion !== null && view.offers.some((offer) =>
    offer.lockReason === "rankTooLow"
    && offer.riskLevel >= promotion.newlyUnlockedRiskLevel,
  );
}

function survivalOffer(view: BoardDecisionView): OfferDecision {
  const chosen = [...accessibleOffers(view)].sort((left, right) =>
    (hasProgressionLock(view) ? right.riskLevel - left.riskLevel : left.riskLevel - right.riskLevel)
    || minimumHpRatio(right.party) - minimumHpRatio(left.party)
    || minimumTrust(right.party) - minimumTrust(left.party)
    || String(left.id).localeCompare(String(right.id)),
  )[0];
  if (chosen === undefined) throw new Error("생존형이 고를 수 있는 공고가 없다");
  return { offerId: chosen.id, betrayal: false };
}

function opportunistOffer(view: BoardDecisionView): OfferDecision {
  const chosen = [...accessibleOffers(view)].sort((left, right) =>
    right.riskLevel - left.riskLevel
    || right.fullSurvivorReward.reputation - left.fullSurvivorReward.reputation
    || right.fullSurvivorReward.gold - left.fullSurvivorReward.gold
    || minimumHpRatio(right.party) - minimumHpRatio(left.party)
    || String(left.id).localeCompare(String(right.id)),
  )[0];
  if (chosen === undefined) throw new Error("기회주의형이 고를 수 있는 공고가 없다");
  return { offerId: chosen.id, betrayal: false };
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

function carriedGold(offer: BoardDecisionView["offers"][number]): number {
  return offer.party.reduce((sum, member) => sum + member.gold, 0);
}

function selectiveBetrayalOffer(view: BoardDecisionView): OfferDecision {
  const accessible = accessibleOffers(view);
  const medianGold = median(accessible.map(carriedGold));
  const candidates = accessible.filter((candidate) => {
    const capacity = partyCapacityAfterHypotheticalWipe(view.pool, candidate.party.map((member) => member.id));
    return capacity.emergency >= 1
      && (view.remainingDungeonCount <= 3 || capacity.normal >= 2)
      && carriedGold(candidate) >= medianGold;
  });
  const chosen = [...candidates].sort((left, right) =>
    carriedGold(right) - carriedGold(left)
    || right.riskLevel - left.riskLevel
    || String(left.id).localeCompare(String(right.id)),
  )[0];
  return chosen === undefined ? survivalOffer(view) : { offerId: chosen.id, betrayal: true };
}

function canUseGoldPromotion(view: BoardDecisionView): boolean {
  const promotion = view.promotion;
  if (promotion === null || !promotion.canPromoteByGold) return false;
  const accessible = accessibleOffers(view);
  const lockedByRank = view.offers.some((offer) => offer.lockReason === "rankTooLow" && offer.riskLevel >= promotion.newlyUnlockedRiskLevel);
  return accessible.length <= 1 && lockedByRank;
}

function promotionFor(view: BoardDecisionView, reserveMerchant: boolean): PromotionMethod | null {
  const promotion = view.promotion;
  if (promotion === null) return null;
  if (promotion.canPromoteByReputation) return "reputation";
  if (!canUseGoldPromotion(view)) return null;
  if (reserveMerchant && accessibleOffers(view).length > 0
    && view.gold - promotion.goldRequired < maxMerchantGoldCost()) return null;
  return "gold";
}

function chooseNode(view: MapDecisionView, id: StrategyId): NodeId {
  const priority = PATH_PRIORITY[id];
  const chosen = [...view.nextNodes].sort((left, right) =>
    priority.indexOf(left.category) - priority.indexOf(right.category)
    || String(left.id).localeCompare(String(right.id)),
  )[0];
  if (chosen === undefined) throw new Error("전략이 고를 다음 지점이 없다");
  return chosen.id;
}

function adviceIntent(view: AdviceDecisionView, id: StrategyId): AdviceOutcome {
  if (id === "selective-betrayal" && view.betrayed) return "harm";
  if (id === "opportunist" && view.category === "merchant" && view.goldPromotionCost !== undefined
    && view.campaignGold < view.goldPromotionCost + maxMerchantGoldCost()) return "neutral";
  return "help";
}

function policy(id: StrategyId): StrategyPolicy {
  return {
    id,
    chooseOffer: (view) => id === "survival" ? survivalOffer(view) : id === "opportunist" ? opportunistOffer(view) : selectiveBetrayalOffer(view),
    choosePromotion: (view) => promotionFor(view, id === "opportunist"),
    chooseNode: (view) => chooseNode(view, id),
    chooseAdviceIntent: (view) => adviceIntent(view, id),
  };
}

export function createStrategy(id: StrategyId): StrategyPolicy {
  return policy(id);
}

export const STRATEGY_IDS: readonly StrategyId[] = ["survival", "opportunist", "selective-betrayal"];
