export type AdvicePressure = 0 | 1 | 2 | 3;

type BossInfoAxis = "targetWeight" | "incomingDamage" | "outgoingDamage";
type BossInfoOutcome = "help" | "harm";

const INITIAL_RISK_LEVELS = [1, 2, 3, 4, 5] as const;

export const BOSS_MULTIPLIER_CALIBRATION = {
  min: 0.20,
  max: 1.20,
  step: 0.025,
} as const;

export const GENERAL_MONSTER_MULTIPLIER_CALIBRATION = {
  min: 0.70,
  max: 1.10,
  step: 0.025,
} as const;

export interface CampaignBalance {
  readonly revision: string;
  readonly generalMonsterBaseStatMultiplier: number;
  readonly worldTurn: {
    readonly restRecoveryRatio: number;
    readonly backgroundLossPercent: { readonly min: number; readonly max: number };
  };
  readonly bossBaseStatMultiplierByInitialRisk: Readonly<Record<1 | 2 | 3 | 4 | 5, number>>;
  readonly advicePressure: Readonly<Record<AdvicePressure, {
    readonly incomingDamageMultiplier: number;
    readonly outgoingDamageMultiplier: number;
  }>>;
  readonly bossInfo: {
    readonly multipliers: Readonly<Record<BossInfoAxis, Readonly<Record<BossInfoOutcome, number>>>>;
    readonly limits: { readonly min: number; readonly max: number };
  };
}

export interface CampaignCalibrationSettings {
  readonly revision: string;
  readonly generalMonsterBaseStatMultiplier: number;
  readonly restRecoveryRatio: number;
  readonly bossBaseStatMultiplierByInitialRisk: Readonly<Record<1 | 2 | 3 | 4 | 5, number>>;
}

export const CAMPAIGN_BALANCE = {
  revision: "b1-risk-curve-v2",
  generalMonsterBaseStatMultiplier: 1.00,
  worldTurn: { restRecoveryRatio: 0.20, backgroundLossPercent: { min: 5, max: 10 } },
  bossBaseStatMultiplierByInitialRisk: { 1: 1.05, 2: 0.80, 3: 0.60, 4: 0.475, 5: 0.45 },
  advicePressure: {
    0: { incomingDamageMultiplier: 1.00, outgoingDamageMultiplier: 1.00 },
    1: { incomingDamageMultiplier: 1.05, outgoingDamageMultiplier: 1.00 },
    2: { incomingDamageMultiplier: 1.15, outgoingDamageMultiplier: 0.90 },
    3: { incomingDamageMultiplier: 1.30, outgoingDamageMultiplier: 0.80 },
  },
  bossInfo: {
    multipliers: {
      targetWeight: { help: 0.80, harm: 1.25 },
      incomingDamage: { help: 0.80, harm: 1.25 },
      outgoingDamage: { help: 1.25, harm: 0.80 },
    },
    limits: { min: 0.70, max: 1.50 },
  },
} as const satisfies CampaignBalance;

export const B1_RISK_CURVE_V2_CALIBRATION_SELECTION = {
  selectedAxis: "bossBaseStatMultiplierByInitialRisk",
  before: {
    revision: "b1c-boss-depletion-v1",
    generalMonsterBaseStatMultiplier: 1.00,
    restRecoveryRatio: 0.20,
    bossBaseStatMultiplierByInitialRisk: { 1: 1.10, 2: 0.825, 3: 0.65, 4: 0.55, 5: 0.60 },
  },
  after: {
    revision: CAMPAIGN_BALANCE.revision,
    generalMonsterBaseStatMultiplier: CAMPAIGN_BALANCE.generalMonsterBaseStatMultiplier,
    restRecoveryRatio: CAMPAIGN_BALANCE.worldTurn.restRecoveryRatio,
    bossBaseStatMultiplierByInitialRisk: CAMPAIGN_BALANCE.bossBaseStatMultiplierByInitialRisk,
  },
} as const satisfies {
  readonly selectedAxis: keyof Pick<CampaignBalance,
    "generalMonsterBaseStatMultiplier" | "worldTurn" | "bossBaseStatMultiplierByInitialRisk">;
  readonly before: CampaignCalibrationSettings;
  readonly after: CampaignCalibrationSettings;
};

function isCalibrationStep(value: number): boolean {
  const steps = (value - BOSS_MULTIPLIER_CALIBRATION.min)
    / BOSS_MULTIPLIER_CALIBRATION.step;
  return Math.abs(steps - Math.round(steps)) < 1e-9;
}

function isGeneralMonsterCalibrationStep(value: number): boolean {
  const steps = (value - GENERAL_MONSTER_MULTIPLIER_CALIBRATION.min)
    / GENERAL_MONSTER_MULTIPLIER_CALIBRATION.step;
  return Math.abs(steps - Math.round(steps)) < 1e-9;
}

export function validateCampaignBalance(balance: CampaignBalance): void {
  const generalMonsterMultiplier = balance.generalMonsterBaseStatMultiplier;
  if (
    !Number.isFinite(generalMonsterMultiplier)
    || generalMonsterMultiplier <= 0
    || generalMonsterMultiplier < GENERAL_MONSTER_MULTIPLIER_CALIBRATION.min
    || generalMonsterMultiplier > GENERAL_MONSTER_MULTIPLIER_CALIBRATION.max
    || !isGeneralMonsterCalibrationStep(generalMonsterMultiplier)
  ) {
    throw new Error("일반 몬스터 기본 능력치 배율이 calibration 계약을 벗어난다");
  }

  const multipliers = balance.bossBaseStatMultiplierByInitialRisk;
  const keys = Object.keys(multipliers).sort();
  const expectedKeys = INITIAL_RISK_LEVELS.map(String);
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error("보스 기본 능력치 배율의 위험도 키가 calibration 계약과 다르다");
  }

  for (const riskLevel of INITIAL_RISK_LEVELS) {
    const multiplier = multipliers[riskLevel];
    if (
      !Number.isFinite(multiplier)
      || multiplier <= 0
      || multiplier < BOSS_MULTIPLIER_CALIBRATION.min
      || multiplier > BOSS_MULTIPLIER_CALIBRATION.max
      || !isCalibrationStep(multiplier)
    ) {
      throw new Error("보스 기본 능력치 배율이 calibration 계약을 벗어난다");
    }
  }
}

validateCampaignBalance(CAMPAIGN_BALANCE);
