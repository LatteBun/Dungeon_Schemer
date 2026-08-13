import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RunPhase } from "@/lib/domain";
import { useRunStore } from "@/lib/stores/game-store-provider";

/**
 * 단계가 화면을 결정한다. 인터페이스 문서의 화면 매핑을 코드로 고정한다.
 * docs/experience/ONBOARDING_AND_INTERFACE.md
 */
export const ROUTE_BY_PHASE: Record<RunPhase, string> = {
  partyIntro: "/play",
  pathChoice: "/play/map",
  event: "/play/encounter",
  bossFight: "/play/encounter",
  settlement: "/play/result",
  ended: "/play/result",
};

/**
 * 현재 단계가 이 화면의 것이 아니면 단계에 맞는 화면으로 보낸다.
 * URL을 직접 입력해도 현재 단계의 화면만 보이므로, 지도에서 보스방으로
 * 건너뛰는 우회가 라우팅 수준에서 막힌다.
 */
export function usePhaseGuard(allowed: readonly RunPhase[]): boolean {
  const phase = useRunStore((store) => store.run.phase);
  const router = useRouter();
  const matches = allowed.includes(phase);

  useEffect(() => {
    if (!matches) {
      router.replace(ROUTE_BY_PHASE[phase]);
    }
  }, [matches, phase, router]);

  return matches;
}
