import type { Character } from "./character";
import type { CampaignEnding, CampaignState, BoardOffer, PromotionMethod, PromotionResult } from "./campaign";
import type { ExpeditionState } from "./expedition";
import type { OfferId } from "./ids";
import type { SettlementResult, SettlementSnapshot } from "./settlement";
import type { WorldTurnResult } from "./worldturn";

export interface ActiveExpeditionContext {
  readonly expeditionId: string;
  readonly offer: BoardOffer;
  readonly expedition: ExpeditionState;
  readonly partyMembers: readonly Character[];
}

export interface CampaignTransitionContext {
  readonly selectedOffer: BoardOffer | null;
  readonly activeExpedition: ActiveExpeditionContext | null;
}

export function createCampaignTransitionContext(): CampaignTransitionContext {
  return { selectedOffer: null, activeExpedition: null };
}

export type CampaignTransition =
  | { readonly type: "OPEN_BOARD" }
  | { readonly type: "SELECT_CONTRACT"; readonly offerId: OfferId }
  | { readonly type: "CANCEL_CONTRACT" }
  | {
      readonly type: "START_EXPEDITION";
      readonly expeditionId: string;
      readonly expedition: ExpeditionState;
      readonly partyMembers: readonly Character[];
    }
  | { readonly type: "COMPLETE_EXPEDITION"; readonly snapshot: SettlementSnapshot }
  | { readonly type: "START_WORLD_TURN" }
  | { readonly type: "COMPLETE_WORLD_TURN" }
  | { readonly type: "OPEN_PROMOTION" }
  | { readonly type: "CANCEL_PROMOTION" }
  | { readonly type: "PROMOTE_GUIDE"; readonly method: PromotionMethod }
  | { readonly type: "APPLY_TRUST_BATCH"; readonly partyMembers: readonly Character[] };

export interface CampaignTransitionResult {
  readonly campaign: CampaignState;
  readonly context: CampaignTransitionContext;
  readonly settlement: SettlementResult | null;
  readonly worldTurn: WorldTurnResult | null;
  readonly promotion: PromotionResult | null;
  readonly ending: CampaignEnding | null;
}
