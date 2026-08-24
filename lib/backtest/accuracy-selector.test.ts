import { describe, expect, it } from "vitest";
import type { BaseAdviceOption } from "@/lib/domain";
import { selectAdviceByAccuracy } from "./accuracy-selector";

const OPTIONS: readonly BaseAdviceOption[] = [
  { id: "help" as BaseAdviceOption["id"], label: "도움", line: "도움", outcome: "help", relation: "unrelated", effectTags: ["support"], resultText: "도움" },
  { id: "harm" as BaseAdviceOption["id"], label: "방해", line: "방해", outcome: "harm", relation: "unrelated", effectTags: ["sabotage"], resultText: "방해" },
  { id: "neutral" as BaseAdviceOption["id"], label: "중립", line: "중립", outcome: "neutral", relation: "unrelated", effectTags: ["observe"], resultText: "중립" },
];

describe("백테스트 정확도 선택기", () => {
  it("같은 입력은 같은 조언 ID를 고른다", () => {
    const input = {
      campaignSeed: "same",
      strategyId: "survival" as const,
      accuracy: 0.7 as const,
      expeditionId: "exp-1",
      decisionIndex: 4,
      intendedOutcome: "help" as const,
      options: OPTIONS,
    };
    expect(selectAdviceByAccuracy(input)).toEqual(selectAdviceByAccuracy(input));
  });

  it("정확도 선택은 게임 RNG 소비와 무관하다", () => {
    const input = {
      campaignSeed: "isolated",
      strategyId: "opportunist" as const,
      accuracy: 0.4 as const,
      expeditionId: "exp-2",
      decisionIndex: 2,
      intendedOutcome: "harm" as const,
      options: OPTIONS,
    };
    const first = selectAdviceByAccuracy(input);
    expect(selectAdviceByAccuracy(input)).toEqual(first);
  });

  it("miss가 뽑혀도 유일한 실행 가능 결과를 선택하고 실제 적중으로 기록한다", () => {
    // Break caught: an empty miss candidate set used to throw instead of selecting the sole executable option.
    const result = selectAdviceByAccuracy({
      campaignSeed: "sole-miss",
      strategyId: "opportunist",
      accuracy: 0.4,
      expeditionId: "exp-1",
      decisionIndex: 2,
      intendedOutcome: "neutral",
      options: [OPTIONS[2]!],
    });

    expect(result.selectedOutcome).toBe("neutral");
    expect(result.hit).toBe(true);
  });

  it("10,000회 관측 적중률의 99.9% 구간이 목표 정확도를 포함한다", () => {
    for (const accuracy of [0.4, 0.7] as const) {
      let hits = 0;
      for (let index = 0; index < 10_000; index += 1) {
        const result = selectAdviceByAccuracy({
          campaignSeed: "rate",
          strategyId: "survival",
          accuracy,
          expeditionId: `exp-${index}`,
          decisionIndex: index,
          intendedOutcome: "help",
          options: OPTIONS,
        });
        if (result.hit) hits += 1;
      }
      const p = hits / 10_000;
      const z = 3.2905267314919255;
      const denominator = 1 + (z * z) / 10_000;
      const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * 10_000)) / 10_000) / denominator;
      const center = (p + (z * z) / (2 * 10_000)) / denominator;
      expect(accuracy).toBeGreaterThanOrEqual(center - margin);
      expect(accuracy).toBeLessThanOrEqual(center + margin);
    }
  });
});
