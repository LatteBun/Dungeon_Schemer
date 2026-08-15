import { describe, expect, it } from "vitest";
import { GRADES } from "@/lib/domain";
import {
  STRATEGY_NAMES,
  runBacktest,
  simulateCampaign,
  simulateFixture,
} from "@/lib/backtest/campaign-simulator";

describe("기준 승급 시나리오", () => {
  it("승급 checkpoint를 정확히 재현한다", () => {
    const report = simulateFixture("baseline");

    expect(report.checkpoints).toEqual({
      B: { reputation: 30, cumulativeGold: 60, score: 120 },
      A: { reputation: 66, cumulativeGold: 142, score: 274 },
      S: { reputation: 90, cumulativeGold: 190, score: 370 },
    });
    expect(report.finalRank).toBe("S");
  });

  it("난수를 쓰지 않으므로 몇 번을 돌려도 같다", () => {
    expect(simulateFixture("baseline")).toEqual(simulateFixture("baseline"));
  });
});

describe("한 캠페인 시뮬레이션", () => {
  it.each(STRATEGY_NAMES)("%s 전략이 캠페인을 끝까지 돌린다", (strategy) => {
    const report = simulateCampaign("시뮬-001", strategy);

    expect(report.generationError).toBeNull();
    expect(report.unplayable).toBe(false);
    expect(report.expeditions).toBeGreaterThan(0);
    expect(report.clears + report.wipes).toBe(report.expeditions);
  });

  it("같은 시드와 전략은 같은 보고서를 만든다", () => {
    expect(simulateCampaign("재현-001", "balanced"))
      .toEqual(simulateCampaign("재현-001", "balanced"));
  });

  it("전략마다 결과가 갈린다", () => {
    const signatures = STRATEGY_NAMES.map((strategy) => {
      const report = simulateCampaign("비교-001", strategy);
      return `${report.clears}/${report.wipes}/${report.finalRank}/${report.ending}`;
    });

    expect(new Set(signatures).size).toBeGreaterThan(1);
  });

  it("보스방 도착 HP를 등급별로 모은다", () => {
    const report = simulateCampaign("HP-001", "survivalFirst");
    const grades = Object.keys(report.bossEntryHpByGrade);

    expect(grades.length).toBeGreaterThan(0);
    for (const grade of grades) {
      expect(GRADES).toContain(grade);
    }
  });
});

describe("백테스트 보고서", () => {
  // 10,000개 시드 전체 보고서는 별도 실행이다. 테스트에서는 규약이 지켜지는지만
  // 확인할 수 있는 크기로 돌린다. 실제 수치는 PR 본문과 배정표에 남긴다.
  const report = runBacktest({ seedCount: 60, seedPrefix: "검증" });

  it("생성 오류와 진행 불가 시드가 0건이다", () => {
    expect(report.generationErrors).toEqual([]);
    expect(report.unplayableSeeds).toEqual([]);
  });

  it("세 전략을 모두 집계한다", () => {
    for (const name of STRATEGY_NAMES) {
      expect(report.byStrategy[name].campaigns).toBe(report.seedCount);
    }
  });

  it("엔딩 비율의 합이 1이다", () => {
    for (const name of STRATEGY_NAMES) {
      const total = Object.values(report.byStrategy[name].endingRates)
        .reduce((sum, value) => sum + value, 0);
      expect(total).toBeCloseTo(1, 5);
    }
  });

  it("밸런스 관찰 세 항목이 보고서에 담긴다", () => {
    for (const name of STRATEGY_NAMES) {
      const summary = report.byStrategy[name];

      // C3 명성 음수 절벽
      expect(summary.wipeThenSupportUnavailableRate).toBeGreaterThanOrEqual(0);
      expect(summary.wipeThenSupportUnavailableRate).toBeLessThanOrEqual(1);
      // E3 보스전 전 HP 편차
      expect(Object.keys(summary.averageBossEntryHp).length).toBeGreaterThan(0);
      // F3 정보 카드 노출
      expect(summary.cardExposure.distinct).toBeGreaterThan(0);
      expect(summary.cardExposure.most).not.toBeNull();
    }
  });

  it("기준 시나리오를 함께 담는다", () => {
    expect(report.baseline.checkpoints.S.score).toBe(370);
  });
}, 60_000);
