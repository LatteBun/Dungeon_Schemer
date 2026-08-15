import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CampaignPhase } from "@/lib/domain";
import { useCampaignStore } from "@/lib/stores/campaign-store-provider";

/**
 * 단계가 화면을 결정한다. URL을 직접 입력해도 현재 단계의 화면만 보이므로
 * 지도에서 정산으로 건너뛰는 우회가 라우팅 수준에서 막힌다.
 */
export const ROUTE_BY_PHASE: Record<CampaignPhase, string> = {
  board: "/play",
  contract: "/play",
  map: "/play/map",
  infoOpportunity: "/play/encounter",
  event: "/play/encounter",
  boss: "/play/result",
  settlement: "/play/result",
  ended: "/play/result",
};

export function usePhaseGuard(allowed: readonly CampaignPhase[]): boolean {
  const phase = useCampaignStore((store) => store.campaign.phase);
  const router = useRouter();
  const matches = allowed.includes(phase);

  useEffect(() => {
    if (!matches) {
      router.replace(ROUTE_BY_PHASE[phase]);
    }
  }, [matches, phase, router]);

  return matches;
}
