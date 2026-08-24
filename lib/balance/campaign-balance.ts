export type AdvicePressure = 0 | 1 | 2 | 3;

type BossInfoAxis = "targetWeight" | "incomingDamage" | "outgoingDamage";
type BossInfoOutcome = "help" | "harm";

export interface CampaignBalance {
  readonly revision: string;
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

export const CAMPAIGN_BALANCE = {
  revision: "b1b-initial-v1",
  worldTurn: { restRecoveryRatio: 0.20, backgroundLossPercent: { min: 5, max: 10 } },
  bossBaseStatMultiplierByInitialRisk: { 1: 0.80, 2: 0.80, 3: 0.80, 4: 0.80, 5: 0.80 },
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
