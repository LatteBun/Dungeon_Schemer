import {
  BOSS_MULTIPLIER_CALIBRATION,
  CAMPAIGN_BALANCE,
  GENERAL_MONSTER_MULTIPLIER_CALIBRATION,
  type AdvicePressure,
  type CampaignBalance,
} from "@/lib/balance/campaign-balance";
import { RuleError } from "@/lib/domain/errors";

const INITIAL_RISK_LEVELS = [1, 2, 3, 4, 5] as const;
const ADVICE_PRESSURES = [0, 1, 2, 3] as const satisfies readonly AdvicePressure[];
const BOSS_INFO_AXES = ["targetWeight", "incomingDamage", "outgoingDamage"] as const;
const BOSS_INFO_OUTCOMES = ["help", "harm"] as const;

function invalidBalance(message: string, details: Record<string, unknown>): never {
  throw new RuleError("INVALID_GENERATION", message, details);
}

function requireFiniteInRange(
  value: unknown,
  min: number,
  max: number,
  field: string,
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    invalidBalance("캠페인 밸런스 값이 승인 범위를 벗어난다", { field, value, min, max });
  }
  return value;
}

function requireFinitePositive(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    invalidBalance("캠페인 밸런스 multiplier는 유한한 양수여야 한다", { field, value });
  }
  return value;
}

function requireBossMultiplierCalibration(value: unknown, field: string): number {
  const multiplier = requireFinitePositive(value, field);
  const { min, max, step } = BOSS_MULTIPLIER_CALIBRATION;
  const steps = (multiplier - min) / step;
  if (multiplier < min || multiplier > max || Math.abs(steps - Math.round(steps)) >= 1e-9) {
    invalidBalance("캠페인 밸런스 값이 승인 범위를 벗어난다", { field, value, min, max, step });
  }
  return multiplier;
}

function requireGeneralMonsterMultiplierCalibration(value: unknown, field: string): number {
  const multiplier = requireFinitePositive(value, field);
  const { min, max, step } = GENERAL_MONSTER_MULTIPLIER_CALIBRATION;
  const steps = (multiplier - min) / step;
  if (multiplier < min || multiplier > max || Math.abs(steps - Math.round(steps)) >= 1e-9) {
    invalidBalance("캠페인 밸런스 값이 승인 범위를 벗어난다", { field, value, min, max, step });
  }
  return multiplier;
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return invalidBalance("캠페인 밸런스 객체가 유효하지 않다", { field, value });
  }
  return value as Record<string, unknown>;
}

function validateExactKeys(
  value: Record<string, unknown>,
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
  const root = requireRecord(profile, "profile");
  requireGeneralMonsterMultiplierCalibration(root.generalMonsterBaseStatMultiplier, "generalMonsterBaseStatMultiplier");
  const worldTurn = requireRecord(root.worldTurn, "worldTurn");
  validateExactKeys(worldTurn, ["restRecoveryRatio", "backgroundLossPercent"], "worldTurn");
  requireFiniteInRange(worldTurn.restRecoveryRatio, 0.20, 0.25, "worldTurn.restRecoveryRatio");
  const backgroundLoss = requireRecord(worldTurn.backgroundLossPercent, "worldTurn.backgroundLossPercent");
  validateExactKeys(backgroundLoss, ["min", "max"], "worldTurn.backgroundLossPercent");
  const backgroundLossMin = requireFiniteInRange(backgroundLoss.min, 5, 10, "worldTurn.backgroundLossPercent.min");
  const backgroundLossMax = requireFiniteInRange(backgroundLoss.max, 5, 10, "worldTurn.backgroundLossPercent.max");
  if (backgroundLossMin > backgroundLossMax) {
    invalidBalance("캠페인 밸런스 백그라운드 손실 범위가 뒤집혔다", { min: backgroundLossMin, max: backgroundLossMax });
  }

  const bossMultipliers = requireRecord(root.bossBaseStatMultiplierByInitialRisk, "bossBaseStatMultiplierByInitialRisk");
  validateExactKeys(bossMultipliers, INITIAL_RISK_LEVELS.map(String), "bossBaseStatMultiplierByInitialRisk");
  for (const riskLevel of INITIAL_RISK_LEVELS) {
    requireBossMultiplierCalibration(
      bossMultipliers[String(riskLevel)],
      `bossBaseStatMultiplierByInitialRisk.${riskLevel}`,
    );
  }

  const pressure = requireRecord(root.advicePressure, "advicePressure");
  validateExactKeys(pressure, ADVICE_PRESSURES.map(String), "advicePressure");
  for (const [index, pressureLevel] of ADVICE_PRESSURES.entries()) {
    const current = requireRecord(pressure[String(pressureLevel)], `advicePressure.${pressureLevel}`);
    validateExactKeys(current, ["incomingDamageMultiplier", "outgoingDamageMultiplier"], `advicePressure.${pressureLevel}`);
    const currentIncoming = requireFinitePositive(current.incomingDamageMultiplier, `advicePressure.${pressureLevel}.incomingDamageMultiplier`);
    const currentOutgoing = requireFinitePositive(current.outgoingDamageMultiplier, `advicePressure.${pressureLevel}.outgoingDamageMultiplier`);
    if (index === 0) continue;

    const previousPressureLevel = ADVICE_PRESSURES[index - 1];
    const previous = requireRecord(pressure[String(previousPressureLevel)], `advicePressure.${previousPressureLevel}`);
    const previousIncoming = requireFinitePositive(previous.incomingDamageMultiplier, `advicePressure.${previousPressureLevel}.incomingDamageMultiplier`);
    const previousOutgoing = requireFinitePositive(previous.outgoingDamageMultiplier, `advicePressure.${previousPressureLevel}.outgoingDamageMultiplier`);
    if (currentIncoming < previousIncoming) {
      invalidBalance("캠페인 밸런스 조언 압력 incoming multiplier가 감소한다", { pressureLevel });
    }
    if (currentOutgoing > previousOutgoing) {
      invalidBalance("캠페인 밸런스 조언 압력 outgoing multiplier가 증가한다", { pressureLevel });
    }
  }

  const bossInfo = requireRecord(root.bossInfo, "bossInfo");
  validateExactKeys(bossInfo, ["multipliers", "limits"], "bossInfo");
  const bossInfoMultipliers = requireRecord(bossInfo.multipliers, "bossInfo.multipliers");
  validateExactKeys(bossInfoMultipliers, BOSS_INFO_AXES, "bossInfo.multipliers");
  for (const axis of BOSS_INFO_AXES) {
    const multipliers = requireRecord(bossInfoMultipliers[axis], `bossInfo.multipliers.${axis}`);
    validateExactKeys(multipliers, BOSS_INFO_OUTCOMES, `bossInfo.multipliers.${axis}`);
    for (const outcome of BOSS_INFO_OUTCOMES) {
      requireFinitePositive(multipliers[outcome], `bossInfo.multipliers.${axis}.${outcome}`);
    }
  }

  const bossInfoLimits = requireRecord(bossInfo.limits, "bossInfo.limits");
  validateExactKeys(bossInfoLimits, ["min", "max"], "bossInfo.limits");
  requireFinitePositive(bossInfoLimits.min, "bossInfo.limits.min");
  requireFinitePositive(bossInfoLimits.max, "bossInfo.limits.max");
  if (typeof bossInfoLimits.min === "number" && typeof bossInfoLimits.max === "number" && bossInfoLimits.min > bossInfoLimits.max) {
    invalidBalance("캠페인 밸런스 보스 정보 clamp 범위가 뒤집혔다", bossInfoLimits);
  }
}
