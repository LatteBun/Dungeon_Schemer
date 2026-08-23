import { createStore } from "zustand/vanilla";
import { RuleError, createCampaignTransitionContext } from "@/lib/domain";
import type {
  CampaignPhase,
  CampaignState,
  CampaignTransition,
  CampaignTransitionContext,
  CampaignTransitionResult,
} from "@/lib/domain";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { transitionCampaign } from "@/lib/rules/campaign-transition";

/**
 * 캠페인 스토어.
 *
 * `C7 transitionCampaign` 이 순수 리듀서다. 이 스토어는 그 위의 껍질로, 상태를
 * 들고 액션을 넘기고 결과를 화면에 내준다. **규칙을 새로 쓰지 않는다.**
 *
 * 모듈 전역이 아니라 팩토리로 만든다. 서버에서 모듈 하나를 여러 요청이 나눠
 * 쓰면 다른 사람의 캠페인이 새어 나온다. 지금은 화면이 전부 정적 프리뷰라
 * 드러나지 않지만, 나중에 터지면 원인을 찾기 어렵다.
 */

export interface RejectedTransition {
  readonly type: CampaignTransition["type"];
  readonly reason: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface CampaignStoreState {
  readonly campaign: CampaignState;
  readonly context: CampaignTransitionContext;
  /** 마지막 전이가 낸 것. 정산·엔딩 화면이 읽는다. */
  readonly last: CampaignTransitionResult | null;
  /** 거부된 전이. 화면이 왜 안 되는지 말할 수 있게 남긴다. */
  readonly rejected: RejectedTransition | null;
  dispatch(action: CampaignTransition): void;
  /** 뒤로가기로 되살아난 화면이 현재 상태를 다시 읽을 때 쓴다. */
  snapshot(): Pick<CampaignStoreState, "campaign" | "context" | "last">;
}

export type CampaignStore = ReturnType<typeof createCampaignStore>;

export function createCampaignStore(seed: string) {
  return createStore<CampaignStoreState>((set, get) => ({
    campaign: initializeCampaign(seed),
    context: createCampaignTransitionContext(),
    last: null,
    rejected: null,

    /*
     * 던지지 않는다.
     *
     * 잘못된 조작 하나가 캠페인을 깨뜨리면 안 된다. `C7` 이 던지면 잡아서 값으로
     * 남기고 상태를 그대로 둔다. 뒤로가기로 되살아난 낡은 화면이 보내는 조작이
     * 바로 이 자리로 온다.
     */
    dispatch(action) {
      const { campaign, context } = get();
      try {
        const result = transitionCampaign(campaign, context, action);
        set({
          campaign: result.campaign,
          context: result.context,
          last: result,
          rejected: null,
        });
      } catch (error) {
        if (!(error instanceof RuleError)) throw error;
        set({
          rejected: {
            type: action.type,
            reason: error.message,
            details: error.details ?? {},
          },
        });
      }
    },

    snapshot() {
      const { campaign, context, last } = get();
      return { campaign, context, last };
    },
  }));
}

/**
 * `phase` 가 화면을 정한다.
 *
 * 화면이 스스로 "나는 게시판이다" 라고 우기지 못하게 하는 것이 목적이다.
 * 뒤로가기로 되살아난 문서도 다시 그릴 때 현재 `phase` 를 보므로, 계약을 맺은
 * 뒤 게시판이 `계약 전` 모습으로 되살아나는 일이 없다.
 */
export type CampaignScreen = "intro" | "board" | "expedition" | "settlement" | "ending";

const SCREEN_BY_PHASE: Readonly<Record<CampaignPhase, CampaignScreen>> = {
  intro: "intro",
  board: "board",
  /* 계약 상세와 승급은 게시판 셸 안에서 열린다. 별도 화면이 아니다. */
  contract: "board",
  promotion: "board",
  expedition: "expedition",
  settlement: "settlement",
  worldTurn: "settlement",
  ended: "ending",
};

export function screenForPhase(phase: CampaignPhase): CampaignScreen {
  return SCREEN_BY_PHASE[phase];
}
