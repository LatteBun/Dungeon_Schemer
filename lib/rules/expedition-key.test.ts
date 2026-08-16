import { describe, expect, it } from "vitest";
import { createFixtureCampaignState } from "@/lib/rules/fixtures";
import { expeditionKey } from "./expedition-key";

describe("expeditionKey", () => {
  it("캠페인 시드와 던전 id와 실패 횟수를 잇는다", () => {
    const state = createFixtureCampaignState("씨앗");
    expect(expeditionKey(state, state.dungeons[0])).toBe("씨앗/dungeon-001#0");
  });

  it("실패 횟수가 다르면 다른 키가 된다", () => {
    const state = createFixtureCampaignState("씨앗");
    const retried = { ...state.dungeons[0], failureCount: 1 };
    expect(expeditionKey(state, retried)).not.toBe(
      expeditionKey(state, state.dungeons[0]),
    );
  });

  it("공고와 파티는 키에 들어가지 않는다", () => {
    const state = createFixtureCampaignState("씨앗");
    const otherBoard = {
      ...state,
      board: [{ ...state.board[0], partyId: state.board[0].partyId }],
      parties: [],
    };
    expect(expeditionKey(otherBoard, otherBoard.dungeons[0])).toBe(
      expeditionKey(state, state.dungeons[0]),
    );
  });
});
