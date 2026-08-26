import { createStore } from "zustand/vanilla";
import type {
  CampaignPhase,
  CampaignState,
  CampaignTransition,
  CampaignTransitionContext,
  CampaignTransitionResult,
} from "@/lib/domain";
import { advanceRun, initialRunState } from "./campaign-run";
import type { CampaignRunState } from "./campaign-run";

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
  /** 거부를 읽고 치운다. 화면이 알린 뒤 부른다. */
  clearRejected(): void;
  /** 뒤로가기로 되살아난 화면이 현재 상태를 다시 읽을 때 쓴다. */
  snapshot(): Pick<CampaignStoreState, "campaign" | "context" | "last">;
  /** 지금까지 성공한 조작. 저장이 이것만 적는다. */
  recordedActions(): readonly CampaignTransition[];
  /** 저장에서 되살린 판으로 갈아 끼운다. */
  restore(seed: string, state: CampaignRunState, actions: readonly CampaignTransition[]): void;
}

/** 성공한 조작이 하나 늘 때마다 불린다. 저장이 여기에 붙는다. */
export type CampaignRunListener = (seed: string, actions: readonly CampaignTransition[]) => void;

export type CampaignStore = ReturnType<typeof createCampaignStore>;

export function createCampaignStore(seed: string, onChange?: CampaignRunListener) {
  /*
   * 성공한 조작만 모은다.
   *
   * 거부된 조작은 상태를 바꾸지 않으므로 기록하면 안 된다. 되살릴 때 그것까지
   * 다시 넣으면 같은 자리에서 또 거부될 뿐이고, 기록이 실제로 일어난 일과
   * 어긋난다.
   */
  let actions: CampaignTransition[] = [];
  let runSeed = seed;

  return createStore<CampaignStoreState>((set, get) => ({
    ...initialRunState(seed),
    rejected: null,

    /*
     * 던지지 않는다.
     *
     * 잘못된 조작 하나가 캠페인을 깨뜨리면 안 된다. `C7` 이 던지면 잡아서 값으로
     * 남기고 상태를 그대로 둔다. 뒤로가기로 되살아난 낡은 화면이 보내는 조작이
     * 바로 이 자리로 온다.
     */
    dispatch(action) {
      const { campaign, context, last } = get();
      const step = advanceRun({ campaign, context, last }, action);
      if (!step.ok) {
        set({ rejected: { type: action.type, reason: step.reason, details: step.details } });
        return;
      }
      actions = [...actions, action];
      set({ ...step.state, rejected: null });
      onChange?.(runSeed, actions);
    },

    clearRejected() {
      if (get().rejected !== null) set({ rejected: null });
    },

    snapshot() {
      const { campaign, context, last } = get();
      return { campaign, context, last };
    },

    recordedActions() {
      return actions;
    },

    /*
     * 되살린 판으로 갈아 끼운다.
     *
     * 시드도 함께 바꾼다. `/campaign` 은 들어올 때마다 새 시드를 뽑으므로, 저장을
     * 되살리면 스토어가 만들어질 때 받은 시드는 버려야 한다. 그것을 남겨 두면
     * 이후 저장이 판과 다른 시드를 적어, 다음 새로고침에서 아주 다른 캠페인이
     * 선다.
     */
    restore(seed, state, restoredActions) {
      runSeed = seed;
      actions = [...restoredActions];
      set({ ...state, rejected: null });
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
