import type { CampaignPhase } from "@/lib/domain";

export type ResultStage =
  | "bossAction"
  | "settlementAction"
  | "settlementSummary"
  | "ending"
  | "redirect";

/**
 * 규칙의 정산 전이는 곧바로 board/ended 상태를 만든다. 그 전이를 시작한
 * 결과 화면만 저장된 정산 단계를 한 번 보여주고, 확인 뒤 실제 단계로 간다.
 */
export function deriveResultStage(
  phase: CampaignPhase,
  holdsSettlementSummary: boolean,
  hasSettlementSteps: boolean,
): ResultStage {
  if (
    holdsSettlementSummary
    && hasSettlementSteps
    && (phase === "board" || phase === "ended")
  ) {
    return "settlementSummary";
  }
  if (phase === "boss") return "bossAction";
  if (phase === "settlement") return "settlementAction";
  if (phase === "ended") return "ending";
  return "redirect";
}
