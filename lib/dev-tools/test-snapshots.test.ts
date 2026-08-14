import { describe, expect, it } from "vitest";
import { MOCK_CARDS, MOCK_PARTY } from "@/lib/mock";
import { TRUST_ACTIONS } from "@/lib/rules/trust";
import {
  createIntegrationSnapshot,
  createR3HarnessResult,
} from "@/lib/dev-tools/test-snapshots";

describe("개발 테스트 하네스 스냅샷", () => {
  it("같은 정보 카드 입력과 seed를 완전히 재현한다", () => {
    const options = {
      seed: "r3-harness-seed",
      audience: "party" as const,
      cardIndex: 0,
    };
    const first = createR3HarnessResult(options);
    const second = createR3HarnessResult(options);

    expect(first).toEqual(second);
    expect(first.card).toEqual(MOCK_CARDS[0]);
    expect(first.party).toEqual(MOCK_PARTY);
    expect(first.evaluation.audience).toBe("party");
    if (first.evaluation.audience !== "party") {
      throw new Error("파티 결과가 필요하다.");
    }
    expect(first.evaluation.memberResults).toHaveLength(
      MOCK_PARTY.filter((member) => member.alive).length,
    );
  });

  it("통합 스냅샷이 파티·신뢰·정보 카드·던전·RunState 결과를 함께 가진다", () => {
    const snapshot = createIntegrationSnapshot({
      seed: "integration-seed",
      audience: "party",
      cardIndex: 0,
      memberIndex: 0,
      trustAction: TRUST_ACTIONS[0],
    });

    expect(snapshot.party.length).toBeGreaterThanOrEqual(3);
    expect(snapshot.dungeon.dungeon.nodes.length).toBeGreaterThan(1);
    expect(snapshot.trustEvaluation.member.id).toBe(snapshot.party[0].id);
    expect(snapshot.infoEvaluation.audience).toBe("party");
    expect(snapshot.run.seed).toBe(snapshot.seed);
    expect(snapshot.run.party).toEqual(snapshot.party);
    expect(snapshot.run.dungeon).toEqual(snapshot.dungeon.dungeon);
  });

  it("카드와 seed를 바꾸면 통합 결과의 해당 규칙 결과가 바뀐다", () => {
    const truth = createIntegrationSnapshot({
      seed: "comparison-seed",
      audience: "party",
      cardIndex: 0,
      memberIndex: 0,
      trustAction: "actHonestly",
    });
    const lie = createIntegrationSnapshot({
      seed: "comparison-seed",
      audience: "party",
      cardIndex: 1,
      memberIndex: 0,
      trustAction: "actHonestly",
    });
    const otherSeed = createIntegrationSnapshot({
      seed: "other-comparison-seed",
      audience: "party",
      cardIndex: 0,
      memberIndex: 0,
      trustAction: "actHonestly",
    });

    expect(truth.card.id).not.toBe(lie.card.id);
    expect(truth.party).not.toEqual(otherSeed.party);
  });
});
