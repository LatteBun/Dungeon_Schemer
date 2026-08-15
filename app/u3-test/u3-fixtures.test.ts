import { describe, expect, it } from "vitest";
import { completedCampaignOutcome } from "./u3-fixtures";

describe("completedCampaignOutcome", () => {
  it("완료 상태로 모든 던전을 처리하고 원정 종료 엔딩을 만든다", () => {
    const outcome = completedCampaignOutcome("u3-demo");

    expect(outcome.stateAfter.dungeons).toHaveLength(15);
    expect(outcome.stateAfter.dungeons.every((dungeon) => dungeon.status === "cleared")).toBe(
      true,
    );
    expect(outcome.ending?.id).toBe("expeditionComplete");
    expect(outcome.stateAfter.ending).toEqual(outcome.ending);
    expect(outcome.headerView.remainingDungeons).toBe(0);
  });
});
