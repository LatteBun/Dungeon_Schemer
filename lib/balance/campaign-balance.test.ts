import { describe, expect, it } from "vitest";
import { CAMPAIGN_BALANCE } from "./campaign-balance";

describe("CAMPAIGN_BALANCE", () => {
  it("B1-B 초기 월드턴, 보스, 조언 압력 설정을 제공한다", () => {
    expect(CAMPAIGN_BALANCE.revision).toBe("b1b-initial-v1");
    expect(CAMPAIGN_BALANCE.worldTurn).toEqual({
      restRecoveryRatio: 0.2,
      backgroundLossPercent: { min: 5, max: 10 },
    });
    expect(Object.keys(CAMPAIGN_BALANCE.bossBaseStatMultiplierByInitialRisk)).toEqual(["1", "2", "3", "4", "5"]);
    expect(Object.values(CAMPAIGN_BALANCE.bossBaseStatMultiplierByInitialRisk)).toEqual([0.8, 0.8, 0.775, 0.775, 0.8]);
    expect(CAMPAIGN_BALANCE.advicePressure).toEqual({
      0: { incomingDamageMultiplier: 1, outgoingDamageMultiplier: 1 },
      1: { incomingDamageMultiplier: 1.05, outgoingDamageMultiplier: 1 },
      2: { incomingDamageMultiplier: 1.15, outgoingDamageMultiplier: 0.9 },
      3: { incomingDamageMultiplier: 1.3, outgoingDamageMultiplier: 0.8 },
    });
    expect(CAMPAIGN_BALANCE.bossInfo).toEqual({
      multipliers: {
        targetWeight: { help: 0.8, harm: 1.25 },
        incomingDamage: { help: 0.8, harm: 1.25 },
        outgoingDamage: { help: 1.25, harm: 0.8 },
      },
      limits: { min: 0.7, max: 1.5 },
    });
  });

  it("압력이 늘수록 incoming은 비감소하고 outgoing은 비증가한다", () => {
    const pressures = [0, 1, 2, 3] as const;

    for (const [index, pressure] of pressures.entries()) {
      if (index === 0) continue;
      const previous = CAMPAIGN_BALANCE.advicePressure[pressures[index - 1]];
      const current = CAMPAIGN_BALANCE.advicePressure[pressure];
      expect(current.incomingDamageMultiplier).toBeGreaterThanOrEqual(previous.incomingDamageMultiplier);
      expect(current.outgoingDamageMultiplier).toBeLessThanOrEqual(previous.outgoingDamageMultiplier);
    }
  });
});
