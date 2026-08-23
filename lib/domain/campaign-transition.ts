import type { Character } from "./character";
import type { CampaignEnding, CampaignState, BoardOffer, PromotionMethod, PromotionResult } from "./campaign";
import type { ExpeditionState, MaterializedNodeEvent, PreparedExpeditionEvents } from "./expedition";
import type { ChoiceId, NodeId, OfferId } from "./ids";
import type { SettlementResult, SettlementSnapshot } from "./settlement";
import type { WorldTurnResult } from "./worldturn";

export interface ActiveExpeditionContext {
  readonly expeditionId: string;
  readonly offer: BoardOffer;
  readonly expedition: ExpeditionState;
  readonly partyMembers: readonly Character[];
  /*
   * 사건 배치 계획이다. 방문 사이에 이어져야 한다.
   *
   * `ExpeditionState` 가 아니라 여기 둔다. 「지금 벌어지는 일」이라 세션 맥락의
   * 것이고, 영속 상태에 넣으면 저장해야 할 것이 부푼다. 이어지지 않으면 사용한
   * 사건 목록이 초기화되어 같은 사건이 두 번 나온다.
   *
   * 첫 방문 때 만든다. 원정을 시작만 하고 지점을 밟지 않는 경우가 있고,
   * 계획은 시드·던전·재도전·지도에서 결정적으로 나오므로 언제 만들어도 같다.
   */
  readonly preparedEvents: PreparedExpeditionEvents | null;
  /** 지금 지점에서 확정된 사건. 조언을 아직 고르지 않았으면 남아 있다. */
  readonly pendingEvent: MaterializedNodeEvent["event"] | null;
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
  | { readonly type: "APPLY_TRUST_BATCH"; readonly partyMembers: readonly Character[] }
  /* 원정 안쪽. 문서가 정한 「지점 선택 → 조언 선택 → 보스방」 순서다. */
  | { readonly type: "VISIT_NODE"; readonly nodeId: NodeId }
  | { readonly type: "CHOOSE_ADVICE"; readonly adviceId: ChoiceId }
  | { readonly type: "ENTER_BOSS" };

export interface CampaignTransitionResult {
  readonly campaign: CampaignState;
  readonly context: CampaignTransitionContext;
  readonly settlement: SettlementResult | null;
  readonly worldTurn: WorldTurnResult | null;
  readonly promotion: PromotionResult | null;
  readonly ending: CampaignEnding | null;
}
