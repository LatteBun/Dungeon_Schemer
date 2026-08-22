import { describe, expect, it } from "vitest";
import { presentAdviceOptions } from "./advice-evaluation";
import type { SituationEvent } from "@/lib/domain";

const event = {
  id: "shared-merchant-wound",
  kind: "merchant",
  title: "상처",
  description: "상인이 붕대를 내민다.",
  advice: [
    { id: "a", label: "돕기", line: "도우세요.", outcome: "help", relation: "unrelated", effectTags: [], resultText: "회복한다.", goldCost: 3, merchantEffect: { immediateHpDeltaPerMember: 1 } },
    { id: "b", label: "해치기", line: "거절하세요.", outcome: "harm", relation: "unrelated", effectTags: [], resultText: "손해 본다.", goldCost: 2, merchantEffect: { immediateHpDeltaPerMember: -1 } },
    { id: "c", label: "관찰", line: "보세요.", outcome: "neutral", relation: "unrelated", effectTags: [], resultText: "지켜본다.", goldCost: 0 },
  ],
  defaultResultText: "그냥 지나간다.",
} as unknown as SituationEvent;

describe("조언 공개", () => {
  it("플레이어에게 내부 판정 필드를 노출하지 않는다", () => {
    const options = presentAdviceOptions(event);
    expect(options).toHaveLength(3);
    expect(Object.keys(options[0])).toEqual(["id", "label", "line", "goldCost"]);
    expect(Object.keys(options[1])).toEqual(["id", "label", "line", "goldCost"]);
    expect(Object.keys(options[2])).toEqual(["id", "label", "line", "goldCost"]);
    expect(options[0]).not.toHaveProperty("outcome");
    expect(options[0]).not.toHaveProperty("relation");
    expect(options[0]).not.toHaveProperty("source");
    expect(options[0]).not.toHaveProperty("bossDamageModifier");
  });
});
