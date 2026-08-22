import { describe, expect, it } from "vitest";
import { decideImmediateAdvice, disclosedRuleIds, finalizeImmediateAdviceTrust, presentAdviceOptions, presentShuffledAdvice } from "./advice-evaluation";
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

  it("활성 규칙 공개 수는 위험도에 따라 결정적이다", () => {
    const active = ["spider-shadow", "spider-fire", "spider-vibration"] as never;
    expect(disclosedRuleIds({ campaignSeed: "seed", dungeonId: "dungeon-spider-01" as never, riskLevel: 1, activeRuleIds: active })).toHaveLength(3);
    expect(disclosedRuleIds({ campaignSeed: "seed", dungeonId: "dungeon-spider-01" as never, riskLevel: 5, activeRuleIds: active })).toHaveLength(1);
    expect(disclosedRuleIds({ campaignSeed: "seed", dungeonId: "dungeon-spider-01" as never, riskLevel: 2, activeRuleIds: active })).toEqual(disclosedRuleIds({ campaignSeed: "seed", dungeonId: "dungeon-spider-01" as never, riskLevel: 2, activeRuleIds: active }));
  });

  it("조언 순서는 입력을 보존하며 같은 입력에서 재현된다", () => {
    const first = presentShuffledAdvice({ campaignSeed: "seed", dungeonId: "dungeon-spider-01" as never, attempt: 1, depth: 2, event: event as never });
    const second = presentShuffledAdvice({ campaignSeed: "seed", dungeonId: "dungeon-spider-01" as never, attempt: 1, depth: 2, event: event as never });
    expect(first).toEqual(second);
    expect(event.advice.map((option) => option.id)).toEqual(["a", "b", "c"]);
    expect(first[0]).not.toHaveProperty("outcome");
  });

  it("살아 있는 파티원 반응으로 실행 여부를 결정하고 적용 뒤 신뢰를 계산한다", () => {
    const member = { id: "character-a", name: "A", classId: "test", personality: "righteous", maxHp: 10, hp: 10, trust: 100, gold: 10, alive: true, gravelyWounded: false } as never;
    const decision = decideImmediateAdvice({ campaignSeed: "seed", dungeonId: "dungeon-spider-01" as never, attempt: 1, depth: 1, event: event as never, adviceId: "a" as never, members: [member] });
    expect(decision.reactions).toHaveLength(1);
    expect(typeof decision.executed).toBe("boolean");
    expect(() => finalizeImmediateAdviceTrust({ decision, members: [member], applied: { executed: decision.executed, resultText: "결과" } })).not.toThrow();
  });
});
