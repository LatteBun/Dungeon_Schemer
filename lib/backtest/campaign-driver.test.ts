import { describe, expect, it } from "vitest";
import { createStrategy } from "./strategies";
import { runCampaign } from "./campaign-driver";

describe("백테스트 캠페인 driver", () => {
  it("실제 Store 액션으로 캠페인을 엔딩까지 진행한다", () => {
    const result = runCampaign({ seed: "driver-smoke", strategy: createStrategy("survival"), accuracy: 0.7 });
    if (!result.ok) throw new Error(`${result.errorKind}: ${result.message}`);
    expect(result.ok).toBe(true);
    expect(result.campaign.phase).toBe("ended");
    expect(result.trace.actionTypes).toContain("COMPLETE_EXPEDITION");
    expect(result.trace.actionTypes).toContain("ACKNOWLEDGE_OUTCOME");
    expect(result.trace.steps).toBeLessThanOrEqual(800);
  });

  it("실제 원정의 조언 압력과 보스 진입 상태를 추적한다", () => {
    const result = runCampaign({ seed: "driver-balance-trace", strategy: createStrategy("survival"), accuracy: 0.7 });

    if (!result.ok) throw new Error(`${result.errorKind}: ${result.message}`);
    expect(result.ok).toBe(true);
    expect(result.trace.balanceExpeditions.length).toBeGreaterThanOrEqual(result.campaign.statistics.totalExpeditions);
    expect(result.trace.balanceExpeditions.filter((one) => one.result !== null)).toHaveLength(
      result.campaign.statistics.totalExpeditions,
    );
    expect(result.trace.balanceExpeditions.every((one) => one.startAdvicePressure === 0)).toBe(true);
    expect(result.trace.balanceExpeditions.every((one) => one.maxAdvicePressure >= 0 && one.maxAdvicePressure <= 3)).toBe(true);
    expect(result.trace.balanceExpeditions.filter((one) => one.bossEntry !== null)
      .every((one) => one.bossEntry!.hp <= one.bossEntry!.maxHp)).toBe(true);
  });

  it("같은 seed·전략·정확도는 같은 trace와 결과를 만든다", () => {
    const first = runCampaign({ seed: "driver-repeat", strategy: createStrategy("opportunist"), accuracy: 0.4 });
    const second = runCampaign({ seed: "driver-repeat", strategy: createStrategy("opportunist"), accuracy: 0.4 });
    expect(second.trace).toEqual(first.trace);
    expect(second).toEqual(first);
  });

  it("세 전략과 두 정확도 조합을 모두 실행한다", () => {
    for (const strategyId of ["survival", "opportunist", "selective-betrayal"] as const) {
      for (const accuracy of [0.4, 0.7] as const) {
        const result = runCampaign({ seed: `driver-${strategyId}-${accuracy}`, strategy: createStrategy(strategyId), accuracy });
        expect(result.trace.steps).toBeLessThanOrEqual(800);
      }
    }
  });
});
