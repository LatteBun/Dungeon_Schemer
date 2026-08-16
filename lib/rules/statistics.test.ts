import { describe, expect, it } from "vitest";
import { TRUTH_TYPES } from "@/lib/domain";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { emptyStatistics } from "./statistics";

describe("emptyStatistics", () => {
  it("진위 세 종류를 모두 0으로 채운다", () => {
    const statistics = emptyStatistics();

    for (const truthType of TRUTH_TYPES) {
      expect(statistics.cards[truthType]).toEqual({
        delivered: 0,
        accepted: 0,
        suspected: 0,
        exposed: 0,
        lateExposed: 0,
      });
    }
    expect(statistics.clearedExpeditions).toBe(0);
    expect(statistics.wipedExpeditions).toBe(0);
    expect(statistics.expeditions).toEqual([]);
    expect(statistics.turningPoint).toBeNull();
  });

  // 상수 하나를 공유하면 한 캠페인의 집계가 다음 캠페인에 새어 든다.
  it("호출마다 새 객체를 준다", () => {
    const first = emptyStatistics();
    first.cards.lie.delivered = 5;

    expect(emptyStatistics().cards.lie.delivered).toBe(0);
  });

  it("새 캠페인은 빈 통계로 시작한다", () => {
    expect(initializeCampaign("씨앗").statistics).toEqual(emptyStatistics());
  });
});
