import { CAMPAIGN_BALANCE } from "@/lib/balance/campaign-balance";
import { RuleError } from "@/lib/domain";
import type { AdviceDecision, AdvicePressure } from "@/lib/domain";

export function assertAdvicePressure(value: unknown): asserts value is AdvicePressure {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 3) {
    throw new RuleError("INVALID_STATE", "조언 압력이 유효하지 않다", { advicePressure: value });
  }
}

export function advanceAdvicePressure(
  current: AdvicePressure,
  decision: Pick<AdviceDecision, "executed" | "outcome">,
): AdvicePressure {
  assertAdvicePressure(current);
  if (!decision.executed || decision.outcome === "neutral") return current;
  if (decision.outcome === "help") return Math.max(0, current - 1) as AdvicePressure;
  return Math.min(3, current + 1) as AdvicePressure;
}

export function combatMultipliersForAdvicePressure(pressure: AdvicePressure): {
  readonly incomingDamageMultiplier: number;
  readonly outgoingDamageMultiplier: number;
} {
  assertAdvicePressure(pressure);
  return CAMPAIGN_BALANCE.advicePressure[pressure];
}
