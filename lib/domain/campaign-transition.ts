import type { BattleResolution } from "./battle";
import type { Character } from "./character";
import type { CampaignEnding, CampaignState, BoardOffer, PromotionMethod, PromotionResult } from "./campaign";
import type { BossInfoVerificationAction, ExpeditionState, MaterializedNodeEvent, PreparedExpeditionEvents } from "./expedition";
import type { CharacterId, ChoiceId, NodeId, OfferId } from "./ids";
import type { MemberReaction } from "./info";
import type { SettlementResult, SettlementSnapshot } from "./settlement";
import type { WorldTurnResult } from "./worldturn";

/**
 * 원정에서 실제로 일어난 일 한 칸.
 *
 * 두 곳이 이것을 읽는다. 정산의 원인 사슬(`C4`)은 마지막 한 칸을 읽고, `U5` 의
 * 진행 기록은 전부를 읽는다.
 *
 * 왜 따로 쌓는가 — `C8-B` 의 `ADVICE_RESOLVED` 는 조언 **식별자**와 반응을
 * 남기지만 조언 **문구**도 사건 서술도 HP 변화도 담지 않는다. 캠페인 이력에
 * 필요한 것과 한 원정을 되짚는 데 필요한 것이 다르다. 그리고 이 재료는 사건이
 * 확정되는 순간에만 한자리에 있다 — 사건이 사라지면 문구도 사라진다.
 */
export interface ExpeditionRecord {
  /** 그 자리에서 본 것. 사건의 서술이다. */
  readonly observation: string;
  /** 길잡이가 실제로 고른 조언의 문구. */
  readonly choice: string;
  /*
   * 사람마다 그 판단이 어떻게 돌아왔는가.
   *
   * 조언에서는 수용 · 의심 · 적발이고, 보스전에서는 그 믿음이 맞았는지다. 둘 다
   * "그 사람에게 어떻게 돌아왔는가" 라 한 줄에 함께 선다.
   */
  readonly reactions: readonly {
    readonly characterId: CharacterId;
    readonly reaction: MemberReaction["reaction"] | BossInfoVerificationAction;
  }[];
  readonly damage: readonly { readonly characterId: CharacterId; readonly before: number; readonly after: number }[];
  /** 그 자리에서 오간 신뢰. 사람마다 전후를 남긴다. */
  readonly trustChanges: readonly { readonly characterId: CharacterId; readonly before: number; readonly after: number }[];
  /** 그 자리에서 싸웠다면 그 결과. 싸우지 않았으면 `null` 이다. */
  readonly battle: { readonly rounds: number; readonly victory: boolean } | null;
}

/**
 * 조언 하나가 끝난 직후. 결과를 보는 중이다.
 *
 * 전에는 조언을 고르면 곧장 지도로 돌아갔다. 규칙은 반응도 결과 문장도 전투도
 * 이미 계산해 두고 그대로 버렸고, 화면에는 그것을 그리는 자리가 있는데 캠페인이
 * 한 번도 채우지 않았다. 길잡이는 자기 조언이 어떻게 됐는지 보지 못한 채 다음
 * 갈림길에 섰다.
 *
 * 조언 식별자는 담지 않는다. 결과 문장은 이미 골라 둔 것을 담는다 — 화면이
 * 식별자를 들고 정답을 되짚을 수 없어야 한다.
 */
export interface ExpeditionOutcome {
  /** 그 자리의 사건. 결과를 보는 동안에도 상황이 그대로 있어야 한다. */
  readonly event: MaterializedNodeEvent["event"];
  readonly reactions: readonly MemberReaction[];
  /** 무슨 일이 왜 일어났는지. 아무도 수용하지 않으면 기본 결과 문구가 온다. */
  readonly resultText: string;
  readonly hpChanges: readonly { readonly characterId: CharacterId; readonly before: number; readonly after: number }[];
  readonly trustChanges: readonly { readonly characterId: CharacterId; readonly before: number; readonly after: number }[];
  /** 싸웠으면 그 전투. 화면이 재생한다. 싸우지 않았으면 `null` 이다. */
  readonly battle: BattleResolution | null;
}

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
  /** 이 원정에서 일어난 일들. 시간 순이다. */
  readonly records: readonly ExpeditionRecord[];
  /** 방금 고른 조언의 결과. 길잡이가 확인하면 사라진다. */
  readonly pendingOutcome: ExpeditionOutcome | null;
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
  | { readonly type: "ENTER_BOSS" }
  /** 결과를 다 봤다. 지도로 돌아간다. */
  | { readonly type: "ACKNOWLEDGE_OUTCOME" };

export interface CampaignTransitionResult {
  readonly campaign: CampaignState;
  readonly context: CampaignTransitionContext;
  readonly settlement: SettlementResult | null;
  readonly worldTurn: WorldTurnResult | null;
  readonly promotion: PromotionResult | null;
  readonly ending: CampaignEnding | null;
}
