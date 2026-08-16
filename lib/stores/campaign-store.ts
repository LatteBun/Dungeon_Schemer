import { createStore, type StoreApi } from "zustand/vanilla";
import {
  transitionCampaignDetailed,
  type CampaignAction,
  type CampaignMachineContext,
} from "@/lib/flow/campaign-machine";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import type { BossResolution } from "@/lib/rules/boss";
import type { SettlementStep } from "@/lib/rules/settlement";
import type { CampaignMember, CampaignState } from "@/lib/domain";

export interface CampaignStoreState {
  campaign: CampaignState;
  lastBossResolution: BossResolution | null;
  lastSettlementSteps: SettlementStep[] | null;
  /** 보스전 직전 출전 파티. 전투 전 HP를 화면에 보여주려면 여기서만 얻을 수 있다. */
  membersBeforeBoss: CampaignMember[] | null;
  /**
   * 마지막 정보 카드가 만든 개인별 신뢰 증감.
   * MemberReactionView 는 components 의 타입이므로 숫자 맵만 담아
   * lib 이 components 를 가져오는 방향 역전을 막는다.
   */
  lastTrustDeltas: Record<string, number> | null;
}

export interface CampaignStoreActions {
  dispatch(action: CampaignAction): void;
  rememberTrustDeltas(deltas: Record<string, number>): void;
  startCampaign(seed: string): void;
  resetCampaign(): void;
}

export type CampaignStore = CampaignStoreState & CampaignStoreActions;
export type CampaignStoreApi = StoreApi<CampaignStore>;

const EMPTY_RESULTS = {
  lastBossResolution: null,
  lastSettlementSteps: null,
  membersBeforeBoss: null,
  lastTrustDeltas: null,
} as const;

/** 출전 파티원을 상태에서 뽑아 복사한다. */
function participantsOf(state: CampaignState): CampaignMember[] {
  const expedition = state.expedition;
  if (expedition === null) return [];
  const party = state.parties.find((candidate) => candidate.id === expedition.partyId);
  const ids = new Set((party?.memberIds ?? []).map(String));
  return state.members
    .filter((member) => ids.has(member.id as string))
    .map((member) => ({ ...member }));
}

export function createCampaignStore(
  initial: CampaignState,
  context: CampaignMachineContext,
): CampaignStoreApi {
  return createStore<CampaignStore>()((set, get) => ({
    campaign: initial,
    ...EMPTY_RESULTS,

    dispatch: (action) => {
      const current = get().campaign;

      // 전이 뒤에는 HP가 이미 깎여 전투 전 값을 복원할 수 없다.
      const membersBeforeBoss =
        action.type === "resolveBoss" ? participantsOf(current) : get().membersBeforeBoss;

      const transition = transitionCampaignDetailed(current, action, context);

      // 새 탐험이 시작되면 지난 결과가 화면에 남지 않게 비운다.
      if (action.type === "acceptContract") {
        set({ campaign: transition.state, ...EMPTY_RESULTS });
        return;
      }

      set({
        campaign: transition.state,
        membersBeforeBoss,
        lastBossResolution: transition.bossResolution ?? get().lastBossResolution,
        lastSettlementSteps: transition.settlementSteps ?? get().lastSettlementSteps,
      });
    },

    rememberTrustDeltas: (deltas) => {
      set({ lastTrustDeltas: deltas });
    },

    startCampaign: (seed) => {
      set({ campaign: initializeCampaign(seed), ...EMPTY_RESULTS });
    },

    resetCampaign: () => {
      set({ campaign: initial, ...EMPTY_RESULTS });
    },
  }));
}
