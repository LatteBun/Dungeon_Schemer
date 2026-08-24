import { describe, expect, it } from "vitest";
import { createStrategy } from "./strategies";
import { merchantTraceDeltaFor, runCampaign } from "./campaign-driver";
import { createCampaignStore } from "@/lib/store/campaign-store";
import type { Accuracy } from "./public-state";

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

  it("단일 실행 가능 상인 조언의 정확도 miss도 캠페인을 중단시키지 않는다", () => {
    // Break caught: a sampled miss used to reject the sole neutral executable merchant option.
    const result = runCampaign({
      seed: "b1b-calibration-v1/000000",
      strategy: createStrategy("opportunist"),
      accuracy: 0.4,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.campaign.phase).toBe("ended");
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

  it("전투 전멸도 결과를 확인한 뒤 정산한다", () => {
    const base = createStrategy("selective-betrayal");
    const harmful = {
      ...base,
      chooseOffer: (view: Parameters<typeof base.chooseOffer>[0]) => ({ ...base.chooseOffer(view), betrayal: true }),
      chooseAdviceIntent: () => "harm" as const,
    };
    let found = false;
    for (let index = 0; index < 40; index += 1) {
      const result = runCampaign({ seed: `driver-wipe-ack-${index}`, strategy: harmful, accuracy: 1 as unknown as Accuracy });
      const actions = result.trace.actionTypes;
      if (actions.some((action, actionIndex) => action === "COMPLETE_EXPEDITION"
        && actions[actionIndex - 1] === "ACKNOWLEDGE_OUTCOME"
        && actions[actionIndex - 2] === "CHOOSE_ADVICE")) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  }, 15_000);

  it("원정을 시작해도 상인 효과를 소비한 것으로 세지 않는다", () => {
    const result = runCampaign({
      seed: "driver-merchant-start",
      strategy: createStrategy("survival"),
      accuracy: 0.7,
      stepLimit: 3,
    });

    expect(result.trace.actionTypes).toEqual(["OPEN_BOARD", "SELECT_CONTRACT", "START_EXPEDITION"]);
    expect(result.trace.merchantEffectsConsumed).toBe(0);
  });

  it("골드 승급 비용을 상인 지출로 합산하지 않는다", () => {
    const before = createCampaignStore("driver-gold-promotion").getState();
    const after = {
      ...before,
      campaign: { ...before.campaign, gold: before.campaign.gold - 10 },
    };

    expect(merchantTraceDeltaFor({ type: "PROMOTE_GUIDE", method: "gold" }, before, after)).toEqual({
      goldSpent: 0,
      effectsConsumed: 0,
    });
  });

  it("실제 상인 조언의 골드와 효과 소비를 모두 기록한다", () => {
    const result = runCampaign({ seed: "driver-smoke", strategy: createStrategy("survival"), accuracy: 0.7 });

    expect(result.trace.merchantGoldSpent).toBeGreaterThan(0);
    expect(result.trace.merchantEffectsConsumed).toBeGreaterThan(0);
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
