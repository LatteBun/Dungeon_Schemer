import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENT_CATALOG,
  achievementProgressFor,
  createEmptyPlayerProgress,
  recordCompletedCampaign,
  unlockedAchievementCount,
} from "./player-progress";
import type { CompletedCampaignRecord } from "./player-progress";

const completed: CompletedCampaignRecord = {
  runId: "run-1",
  ending: "completed",
  finalRank: "A",
  totalExpeditions: 18,
  clearedExpeditions: 15,
  wipedExpeditions: 3,
  deaths: 4,
  advices: 72,
};

describe("플레이어 업적 프로필", () => {
  it("V1 빈 프로필을 만든다", () => {
    expect(createEmptyPlayerProgress()).toEqual({
      version: 1,
      totals: {
        completedCampaigns: 0,
        expeditions: 0,
        clearedExpeditions: 0,
        wipedExpeditions: 0,
        deaths: 0,
        advices: 0,
      },
      endingCounts: {
        distrust: 0,
        denounced: 0,
        completed: 0,
        exhausted: 0,
        unemployed: 0,
      },
      unlocked: {},
      recordedRunIds: [],
    });
  });

  it("완료 결과를 불변 누적하고 같은 runId는 다시 세지 않는다", () => {
    const before = createEmptyPlayerProgress();
    const once = recordCompletedCampaign(before, completed, "2026-08-24T10:00:00.000Z");
    const twice = recordCompletedCampaign(once, completed, "2026-08-25T10:00:00.000Z");

    expect(once).not.toBe(before);
    expect(before.totals.completedCampaigns).toBe(0);
    expect(once.totals).toMatchObject({ completedCampaigns: 1, expeditions: 18, advices: 72 });
    expect(twice).toBe(once);
  });

  it("결과형 네 개를 마지막 완료 기록으로 판정한다", () => {
    const first = recordCompletedCampaign(createEmptyPlayerProgress(), completed, "2026-08-24T10:00:00.000Z");
    expect(Object.keys(first.unlocked)).toContain("first-record");
    expect(Object.keys(first.unlocked)).toContain("dungeon-conqueror");
    expect(Object.keys(first.unlocked)).not.toContain("s-rank-guide");
    expect(Object.keys(first.unlocked)).not.toContain("everyone-returned");

    const perfect = recordCompletedCampaign(first, {
      ...completed,
      runId: "run-2",
      finalRank: "S",
      deaths: 0,
    }, "2026-08-25T10:00:00.000Z");
    expect(perfect.unlocked["s-rank-guide"]?.unlockedAt).toBe("2026-08-25T10:00:00.000Z");
    expect(perfect.unlocked["everyone-returned"]?.unlockedAt).toBe("2026-08-25T10:00:00.000Z");
    expect(perfect.unlocked["first-record"]?.unlockedAt).toBe("2026-08-24T10:00:00.000Z");
  });

  it("엔딩 다섯 종류의 마지막 기록에서 숨은 업적을 연다", () => {
    const endings = ["distrust", "denounced", "completed", "exhausted", "unemployed"] as const;
    const result = endings.reduce(
      (progress, ending, index) => recordCompletedCampaign(progress, {
        ...completed,
        runId: `ending-${index}`,
        ending,
      }, `2026-08-${20 + index}T10:00:00.000Z`),
      createEmptyPlayerProgress(),
    );
    expect(result.unlocked["five-endings"]).toBeDefined();
  });

  it.each([
    ["hundred-advices", { advices: 100 }],
    ["seasoned-expedition", { clearedExpeditions: 30 }],
    ["death-in-the-plan", { wipedExpeditions: 10 }],
  ] as const)("%s는 문턱에서 열린다", (id, totals) => {
    const result = recordCompletedCampaign(createEmptyPlayerProgress(), {
      ...completed,
      runId: id,
      advices: 0,
      clearedExpeditions: 0,
      wipedExpeditions: 0,
      ...totals,
    }, "2026-08-24T10:00:00.000Z");
    expect(result.unlocked[id]).toBeDefined();
  });

  it("카탈로그 순서와 공개 누적 진행도를 제공한다", () => {
    expect(ACHIEVEMENT_CATALOG.map(({ id }) => id)).toEqual([
      "first-record",
      "dungeon-conqueror",
      "s-rank-guide",
      "everyone-returned",
      "five-endings",
      "hundred-advices",
      "seasoned-expedition",
      "death-in-the-plan",
    ]);
    expect(new Set(ACHIEVEMENT_CATALOG.map(({ id }) => id)).size).toBe(8);

    const progress = recordCompletedCampaign(createEmptyPlayerProgress(), completed, "2026-08-24T10:00:00.000Z");
    expect(achievementProgressFor(progress, "hundred-advices")).toEqual({ current: 72, target: 100 });
    expect(achievementProgressFor(progress, "seasoned-expedition")).toEqual({ current: 15, target: 30 });
    expect(achievementProgressFor(progress, "death-in-the-plan")).toEqual({ current: 3, target: 10 });
    expect(achievementProgressFor(progress, "five-endings")).toBeNull();
    expect(unlockedAchievementCount(progress)).toBe(2);
  });

  it("승인된 업적 문양 경로를 카탈로그 순서대로 고정한다", () => {
    expect(ACHIEVEMENT_CATALOG.map(({ imageSrc }) => imageSrc)).toEqual([
      "/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/achievements/achievement_guild.png",
      "/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/achievements/achievement_conquest.png",
      "/assets/achievements/achievement_s_rank.png",
      "/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/achievements/achievement_together.png",
      "/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/achievements/achievement_return.png",
      "/assets/achievements/achievement_advice.png",
      "/assets/achievements/achievement_expedition.png",
      "/assets/achievements/achievement_wipe.png",
    ]);
  });

  it("음수·소수·비안전 정수와 빈 runId를 거부한다", () => {
    for (const field of [
      "totalExpeditions",
      "clearedExpeditions",
      "wipedExpeditions",
      "deaths",
      "advices",
    ] as const) {
      expect(() => recordCompletedCampaign(createEmptyPlayerProgress(), {
        ...completed,
        [field]: -1,
      }, "2026-08-24T10:00:00.000Z")).toThrow(TypeError);
      expect(() => recordCompletedCampaign(createEmptyPlayerProgress(), {
        ...completed,
        [field]: 1.5,
      }, "2026-08-24T10:00:00.000Z")).toThrow(TypeError);
      expect(() => recordCompletedCampaign(createEmptyPlayerProgress(), {
        ...completed,
        [field]: Number.MAX_SAFE_INTEGER + 1,
      }, "2026-08-24T10:00:00.000Z")).toThrow(TypeError);
    }
    expect(() => recordCompletedCampaign(createEmptyPlayerProgress(), {
      ...completed,
      runId: "",
    }, "2026-08-24T10:00:00.000Z")).toThrow(TypeError);
  });
});
