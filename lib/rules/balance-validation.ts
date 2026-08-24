import { CAMPAIGN_BALANCE, type AdvicePressure, type CampaignBalance } from "@/lib/balance/campaign-balance";
import { RuleError } from "@/lib/domain/errors";

const INITIAL_RISK_LEVELS = [1, 2, 3, 4, 5] as const;
const ADVICE_PRESSURES = [0, 1, 2, 3] as const satisfies readonly AdvicePressure[];
const BOSS_INFO_AXES = ["targetWeight", "incomingDamage", "outgoingDamage"] as const;
const BOSS_INFO_OUTCOMES = ["help", "harm"] as const;

function invalidBalance(message: string, details: Record<string, unknown>): never {
  throw new RuleError("INVALID_GENERATION", message, details);
}

function requireFiniteInRange(
  value: number,
  min: number,
  max: number,
  field: string,
): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    invalidBalance("캠페인 밸런스 값이 승인 범위를 벗어난다", { field, value, min, max });
  }
}

function requireFinitePositive(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    invalidBalance("캠페인 밸런스 multiplier는 유한한 양수여야 한다", { field, value });
  }
}

function validateExactKeys(
  value: object,
  expected: readonly string[],
  field: string,
): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    invalidBalance("캠페인 밸런스 키가 계약과 다르다", { field, expected: wanted, actual });
  }
}

export function validateCampaignBalance(profile: CampaignBalance = CAMPAIGN_BALANCE): void {
  requireFiniteInRange(profile.worldTurn.restRecoveryRatio, 0.20, 0.25, "worldTurn.restRecoveryRatio");
  const backgroundLoss = profile.worldTurn.backgroundLossPercent;
  requireFiniteInRange(backgroundLoss.min, 5, 10, "worldTurn.backgroundLossPercent.min");
  requireFiniteInRange(backgroundLoss.max, 5, 10, "worldTurn.backgroundLossPercent.max");
  if (backgroundLoss.min > backgroundLoss.max) {
    invalidBalance("캠페인 밸런스 백그라운드 손실 범위가 뒤집혔다", { min: backgroundLoss.min, max: backgroundLoss.max });
  }

  const bossMultipliers = profile.bossBaseStatMultiplierByInitialRisk;
  validateExactKeys(bossMultipliers, INITIAL_RISK_LEVELS.map(String), "bossBaseStatMultiplierByInitialRisk");
  for (const riskLevel of INITIAL_RISK_LEVELS) {
    requireFiniteInRange(
      bossMultipliers[riskLevel],
      0.75,
      0.85,
      `bossBaseStatMultiplierByInitialRisk.${riskLevel}`,
    );
  }

  const pressure = profile.advicePressure;
  validateExactKeys(pressure, ADVICE_PRESSURES.map(String), "advicePressure");
  for (const [index, pressureLevel] of ADVICE_PRESSURES.entries()) {
    const current = pressure[pressureLevel];
    requireFinitePositive(current.incomingDamageMultiplier, `advicePressure.${pressureLevel}.incomingDamageMultiplier`);
    requireFinitePositive(current.outgoingDamageMultiplier, `advicePressure.${pressureLevel}.outgoingDamageMultiplier`);
    if (index === 0) continue;

    const previous = pressure[ADVICE_PRESSURES[index - 1]];
    if (current.incomingDamageMultiplier < previous.incomingDamageMultiplier) {
      invalidBalance("캠페인 밸런스 조언 압력 incoming multiplier가 감소한다", { pressureLevel });
    }
    if (current.outgoingDamageMultiplier > previous.outgoingDamageMultiplier) {
      invalidBalance("캠페인 밸런스 조언 압력 outgoing multiplier가 증가한다", { pressureLevel });
    }
  }

  const bossInfo = profile.bossInfo;
  validateExactKeys(bossInfo.multipliers, BOSS_INFO_AXES, "bossInfo.multipliers");
  for (const axis of BOSS_INFO_AXES) {
    const multipliers = bossInfo.multipliers[axis];
    validateExactKeys(multipliers, BOSS_INFO_OUTCOMES, `bossInfo.multipliers.${axis}`);
    for (const outcome of BOSS_INFO_OUTCOMES) {
      requireFinitePositive(multipliers[outcome], `bossInfo.multipliers.${axis}.${outcome}`);
    }
  }

  requireFinitePositive(bossInfo.limits.min, "bossInfo.limits.min");
  requireFinitePositive(bossInfo.limits.max, "bossInfo.limits.max");
  if (bossInfo.limits.min > bossInfo.limits.max) {
    invalidBalance("캠페인 밸런스 보스 정보 clamp 범위가 뒤집혔다", bossInfo.limits);
  }
}
