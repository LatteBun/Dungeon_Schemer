import { describe, expect, it } from "vitest";
import { ADVICE_OUTCOMES, ECOLOGY_RELATIONS } from "@/lib/domain";

describe("ADVICE_OUTCOMES", () => {
  it("도움·방해·중립 셋이다", () => {
    expect([...ADVICE_OUTCOMES].toSorted()).toEqual(["harm", "help", "neutral"]);
  });
});

describe("ECOLOGY_RELATIONS", () => {
  it("정합·모순·무관 셋이다", () => {
    expect([...ECOLOGY_RELATIONS].toSorted()).toEqual([
      "consistent",
      "contradictory",
      "unrelated",
    ]);
  });
});
