import { describe, expect, it } from "vitest";
import { createFixtureCampaignState } from "@/lib/rules/fixtures";
import {
  CAMPAIGN_PHASES,
  type CampaignState,
} from "@/lib/domain";

describe("캠페인 도메인 계약", () => {
  it("현재 명성·두 골드·영구 등급을 분리한다", () => {
    const state: CampaignState = createFixtureCampaignState();

    expect(state.currentReputation).toBe(0);
    expect(state.currentGold).toBe(10);
    expect(state.cumulativeGold).toBe(0);
    expect(state.rank).toBe("C");
    expect(state.phase).toBe("board");
    expect(state.expedition).toBeNull();
  });

  it("보드부터 캠페인 종료까지의 단계는 닫힌 목록이다", () => {
    expect(CAMPAIGN_PHASES).toEqual([
      "board",
      "contract",
      "map",
      "infoOpportunity",
      "event",
      "boss",
      "settlement",
      "ended",
    ]);
  });

  it("캠페인 인물 상태는 개인 HP·신뢰·골드·기억을 함께 보존한다", () => {
    const state = createFixtureCampaignState();
    const member = state.members[0];

    expect(member).toMatchObject({
      maxHp: 100,
      currentHp: 100,
      trust: 50,
      carriedGold: 20,
      alive: true,
    });
    expect(member.memory).toEqual([]);
  });

  it("fixture 호출마다 중첩 배열도 서로 공유하지 않는다", () => {
    const first = createFixtureCampaignState();
    const second = createFixtureCampaignState();

    first.members[0].memory.push({
      at: 1,
      kind: "event",
      summary: "fixture 격리 확인",
    });
    first.parties[0].memberIds.pop();

    expect(second.members[0].memory).toEqual([]);
    expect(second.parties[0].memberIds).toHaveLength(3);
  });
});
