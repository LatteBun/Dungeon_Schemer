import { describe, expect, it } from "vitest";
import { selectU5FeedbackMember, u5PostBattleLine, u5PreBattleLine } from "./u5-combat-feedback-adapter";

describe("u5 combat feedback adapter", () => {
  it.each([
    ["accepted", -2, "네 말을 믿은 게 실수였군."],
    ["accepted", 2, "이번에는 네 조언이 맞았어."],
    ["suspected", -2, "역시 그대로 따르지 않길 잘했어."],
    ["suspected", 2, "의심하느라 기회를 놓쳤군."],
  ] as const)("%s 반응과 신뢰 부호를 고정 대사로 바꾼다", (reaction, delta, text) => {
    expect(u5PostBattleLine(reaction, delta)).toBe(text);
  });

  it("전투 전 반응은 승인된 고정 문구만 쓴다", () => {
    expect(u5PreBattleLine("accepted")).toBe("알겠어. 네 말대로 하지.");
    expect(u5PreBattleLine("suspected")).toBe("잠깐, 그대로 따르기엔 수상한데.");
    expect(u5PreBattleLine("exposed")).toBe("처음부터 우릴 속이려 했군.");
  });

  it("신뢰 변화 절댓값이 같으면 파티 seat order가 빠른 인물을 고른다", () => {
    expect(selectU5FeedbackMember([
      { memberId: "second", before: 3, after: 1 },
      { memberId: "first", before: 5, after: 7 },
    ], ["first", "second"])?.memberId).toBe("first");
  });
});
