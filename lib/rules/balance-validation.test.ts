import { describe, expect, it } from "vitest";
import { CAMPAIGN_BALANCE, type CampaignBalance } from "@/lib/balance/campaign-balance";
import { RuleError } from "@/lib/domain";
import { validateCampaignBalance } from "./balance-validation";

function expectInvalid(profile: CampaignBalance): void {
  expect(() => validateCampaignBalance(profile)).toThrowError(
    expect.objectContaining({ code: "INVALID_GENERATION" }),
  );
}

describe("validateCampaignBalance", () => {
  it("기본 B1-B 프로필을 허용한다", () => {
    expect(() => validateCampaignBalance()).not.toThrow();
  });

  it("필수 위험도 키가 빠진 프로필을 생성 오류로 거부한다", () => {
    expectInvalid({
      ...CAMPAIGN_BALANCE,
      bossBaseStatMultiplierByInitialRisk: {
        1: 0.8,
        2: 0.8,
        3: 0.8,
        4: 0.8,
      } as unknown as CampaignBalance["bossBaseStatMultiplierByInitialRisk"],
    });
  });

  it("중첩 설정 객체가 없거나 객체가 아니어도 생성 오류로 거부한다", () => {
    const malformedProfiles: readonly unknown[] = [
      { ...CAMPAIGN_BALANCE, worldTurn: undefined },
      { ...CAMPAIGN_BALANCE, worldTurn: { ...CAMPAIGN_BALANCE.worldTurn, backgroundLossPercent: undefined } },
      { ...CAMPAIGN_BALANCE, bossInfo: undefined },
      { ...CAMPAIGN_BALANCE, bossInfo: { ...CAMPAIGN_BALANCE.bossInfo, multipliers: undefined } },
      { ...CAMPAIGN_BALANCE, bossInfo: { ...CAMPAIGN_BALANCE.bossInfo, limits: undefined } },
    ];

    for (const profile of malformedProfiles) {
      expectInvalid(profile as CampaignBalance);
    }
  });

  it("월드턴과 보스 정보의 중첩 키가 계약과 다르면 생성 오류로 거부한다", () => {
    const invalidProfiles: readonly CampaignBalance[] = [
      {
        ...CAMPAIGN_BALANCE,
        worldTurn: { ...CAMPAIGN_BALANCE.worldTurn, unexpected: true } as CampaignBalance["worldTurn"],
      },
      {
        ...CAMPAIGN_BALANCE,
        worldTurn: {
          ...CAMPAIGN_BALANCE.worldTurn,
          backgroundLossPercent: { ...CAMPAIGN_BALANCE.worldTurn.backgroundLossPercent, unexpected: true },
        } as CampaignBalance["worldTurn"],
      },
      {
        ...CAMPAIGN_BALANCE,
        bossInfo: { ...CAMPAIGN_BALANCE.bossInfo, unexpected: true } as CampaignBalance["bossInfo"],
      },
      {
        ...CAMPAIGN_BALANCE,
        bossInfo: {
          ...CAMPAIGN_BALANCE.bossInfo,
          limits: { ...CAMPAIGN_BALANCE.bossInfo.limits, unexpected: true },
        } as CampaignBalance["bossInfo"],
      },
    ];

    for (const profile of invalidProfiles) {
      expectInvalid(profile);
    }
  });

  it("승인 범위를 벗어난 회복·손실·보스 단계를 생성 오류로 거부한다", () => {
    expectInvalid({
      ...CAMPAIGN_BALANCE,
      worldTurn: { ...CAMPAIGN_BALANCE.worldTurn, restRecoveryRatio: 0.19 },
    });
    expectInvalid({
      ...CAMPAIGN_BALANCE,
      worldTurn: { ...CAMPAIGN_BALANCE.worldTurn, backgroundLossPercent: { min: 5, max: 11 } },
    });
    expectInvalid({
      ...CAMPAIGN_BALANCE,
      bossBaseStatMultiplierByInitialRisk: { ...CAMPAIGN_BALANCE.bossBaseStatMultiplierByInitialRisk, 5: 0.86 },
    });
  });

  it("보스 배율 calibration 범위와 0.025 grid를 적용한다", () => {
    expect(() => validateCampaignBalance({
      ...CAMPAIGN_BALANCE,
      bossBaseStatMultiplierByInitialRisk: {
        ...CAMPAIGN_BALANCE.bossBaseStatMultiplierByInitialRisk,
        3: 0.90,
      },
    })).not.toThrow();

    for (const multiplier of [0.199, 1.201, 0.81]) {
      expectInvalid({
        ...CAMPAIGN_BALANCE,
        bossBaseStatMultiplierByInitialRisk: {
          ...CAMPAIGN_BALANCE.bossBaseStatMultiplierByInitialRisk,
          3: multiplier,
        },
      });
    }
  });

  it("유한한 양수가 아닌 multiplier와 뒤집힌 clamp 범위를 생성 오류로 거부한다", () => {
    expectInvalid({
      ...CAMPAIGN_BALANCE,
      advicePressure: {
        ...CAMPAIGN_BALANCE.advicePressure,
        2: { ...CAMPAIGN_BALANCE.advicePressure[2], incomingDamageMultiplier: Number.NaN },
      },
    });
    expectInvalid({
      ...CAMPAIGN_BALANCE,
      bossInfo: {
        ...CAMPAIGN_BALANCE.bossInfo,
        multipliers: {
          ...CAMPAIGN_BALANCE.bossInfo.multipliers,
          targetWeight: { ...CAMPAIGN_BALANCE.bossInfo.multipliers.targetWeight, help: 0 },
        },
      },
    });
    expectInvalid({
      ...CAMPAIGN_BALANCE,
      bossInfo: { ...CAMPAIGN_BALANCE.bossInfo, limits: { min: 1.5, max: 0.7 } },
    });
  });

  it("압력 multiplier의 단조성을 어긴 프로필을 생성 오류로 거부한다", () => {
    expectInvalid({
      ...CAMPAIGN_BALANCE,
      advicePressure: {
        ...CAMPAIGN_BALANCE.advicePressure,
        3: { incomingDamageMultiplier: 1.1, outgoingDamageMultiplier: 0.95 },
      },
    });
  });

  it("생성 오류는 기존 RuleError 코드로 보고한다", () => {
    const invalid: CampaignBalance = {
      ...CAMPAIGN_BALANCE,
      advicePressure: {
        ...CAMPAIGN_BALANCE.advicePressure,
        2: { ...CAMPAIGN_BALANCE.advicePressure[2], incomingDamageMultiplier: Number.NaN },
      },
    };

    try {
      validateCampaignBalance(invalid);
      expect.fail("유효하지 않은 설정을 허용했다");
    } catch (error) {
      expect(error).toBeInstanceOf(RuleError);
      expect((error as RuleError).code).toBe("INVALID_GENERATION");
    }
  });
});
