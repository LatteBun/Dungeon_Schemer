import { describe, expect, it } from "vitest";
import { MOCK_CARDS, MOCK_PARTY } from "@/lib/mock";
import { createInfoCardHarnessResult } from "@/lib/dev-tools/test-snapshots";

describe("정보 카드 개발 테스트 하네스 스냅샷", () => {
  it("같은 정보 카드 입력과 seed를 완전히 재현한다", () => {
    const options = {
      seed: "info-card-harness-seed",
      audience: "party" as const,
      cardIndex: 0,
    };
    const first = createInfoCardHarnessResult(options);
    const second = createInfoCardHarnessResult(options);

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

});
