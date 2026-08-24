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

  it("각 결과형 업적의 직전 값은 잠기고 도달 값은 열린다", () => {
    const firstBefore = createEmptyPlayerProgress();
    expect(firstBefore.unlocked["first-record"]).toBeUndefined();
    const firstAt = recordCompletedCampaign(firstBefore, {
      ...completed,
      runId: "first-at",
      ending: "exhausted",
    }, "2026-08-24T10:00:00.000Z");
    expect(firstAt.unlocked["first-record"]).toBeDefined();

    const conquerorBefore = recordCompletedCampaign(createEmptyPlayerProgress(), {
      ...completed,
      runId: "conqueror-before",
      ending: "exhausted",
    }, "2026-08-24T10:00:00.000Z");
    expect(conquerorBefore.unlocked["dungeon-conqueror"]).toBeUndefined();
    const conquerorAt = recordCompletedCampaign(conquerorBefore, {
      ...completed,
      runId: "conqueror-at",
      ending: "completed",
    }, "2026-08-24T10:00:00.000Z");
    expect(conquerorAt.unlocked["dungeon-conqueror"]).toBeDefined();

    const rankBefore = recordCompletedCampaign(createEmptyPlayerProgress(), {
      ...completed,
      runId: "rank-before",
      ending: "completed",
      finalRank: "A",
    }, "2026-08-24T10:00:00.000Z");
    expect(rankBefore.unlocked["s-rank-guide"]).toBeUndefined();
    const rankAt = recordCompletedCampaign(rankBefore, {
      ...completed,
      runId: "rank-at",
      ending: "completed",
      finalRank: "S",
    }, "2026-08-24T10:00:00.000Z");
    expect(rankAt.unlocked["s-rank-guide"]).toBeDefined();

    const returnedBefore = recordCompletedCampaign(createEmptyPlayerProgress(), {
      ...completed,
      runId: "returned-before",
      ending: "completed",
      deaths: 1,
    }, "2026-08-24T10:00:00.000Z");
    expect(returnedBefore.unlocked["everyone-returned"]).toBeUndefined();
    const returnedAt = recordCompletedCampaign(returnedBefore, {
      ...completed,
      runId: "returned-at",
      ending: "completed",
      deaths: 0,
    }, "2026-08-24T10:00:00.000Z");
    expect(returnedAt.unlocked["everyone-returned"]).toBeDefined();

    const rankSWithBadEnding = recordCompletedCampaign(createEmptyPlayerProgress(), {
      ...completed,
      runId: "rank-s-bad-ending",
      ending: "exhausted",
      finalRank: "S",
    }, "2026-08-24T10:00:00.000Z");
    expect(rankSWithBadEnding.unlocked["s-rank-guide"]).toBeUndefined();
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

  it("다섯 엔딩 중 네 종류는 직전이고 다섯 번째에서 숨은 업적이 열린다", () => {
    const fourEndings = ["distrust", "denounced", "completed", "exhausted"] as const;
    const before = fourEndings.reduce(
      (progress, ending, index) => recordCompletedCampaign(progress, {
        ...completed,
        runId: `four-endings-${index}`,
        ending,
      }, "2026-08-24T10:00:00.000Z"),
      createEmptyPlayerProgress(),
    );
    expect(before.unlocked["five-endings"]).toBeUndefined();
    const at = recordCompletedCampaign(before, {
      ...completed,
      runId: "five-endings-at",
      ending: "unemployed",
    }, "2026-08-24T10:00:00.000Z");
    expect(at.unlocked["five-endings"]).toBeDefined();
    const over = recordCompletedCampaign(at, {
      ...completed,
      runId: "five-endings-over",
      ending: "completed",
    }, "2026-08-24T10:00:00.000Z");
    expect(over.unlocked["five-endings"]).toBeDefined();
    expect(over.endingCounts.completed).toBe(2);
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

  it.each([
    ["hundred-advices", { advices: 99 }, { advices: 1 }],
    ["seasoned-expedition", { clearedExpeditions: 29 }, { clearedExpeditions: 1 }],
    ["death-in-the-plan", { wipedExpeditions: 9 }, { wipedExpeditions: 1 }],
  ] as const)("%s는 직전 값에서 잠기고 도달 값에서 열린다", (id, beforeTotals, atTotals) => {
    const before = recordCompletedCampaign(createEmptyPlayerProgress(), {
      ...completed,
      runId: `${id}-before`,
      advices: 0,
      clearedExpeditions: 0,
      wipedExpeditions: 0,
      ...beforeTotals,
    }, "2026-08-24T10:00:00.000Z");
    expect(before.unlocked[id]).toBeUndefined();
    const at = recordCompletedCampaign(before, {
      ...completed,
      runId: `${id}-at`,
      advices: 0,
      clearedExpeditions: 0,
      wipedExpeditions: 0,
      ...atTotals,
    }, "2026-08-24T10:00:00.000Z");
    expect(at.unlocked[id]).toBeDefined();
  });

  it.each([
    ["hundred-advices", { advices: 101 }, { current: 101, target: 100 }],
    ["seasoned-expedition", { clearedExpeditions: 31 }, { current: 31, target: 30 }],
    ["death-in-the-plan", { wipedExpeditions: 11 }, { current: 11, target: 10 }],
  ] as const)("%s는 초과 값에서도 해금 상태를 유지한다", (id, overTotals, expectedProgress) => {
    const over = recordCompletedCampaign(createEmptyPlayerProgress(), {
      ...completed,
      runId: `${id}-over`,
      advices: 0,
      clearedExpeditions: 0,
      wipedExpeditions: 0,
      ...overTotals,
    }, "2026-08-24T10:00:00.000Z");
    expect(over.unlocked[id]).toBeDefined();
    expect(achievementProgressFor(over, id)).toEqual(expectedProgress);
  });

  it.each([
    ["first-record", { ending: "exhausted" as const }],
    ["dungeon-conqueror", { ending: "completed" as const }],
    ["s-rank-guide", { ending: "completed" as const, finalRank: "S" as const }],
    ["everyone-returned", { ending: "completed" as const, deaths: 0 }],
  ] as const)("%s는 초과 완료 기록에서도 해금 상태를 유지한다", (id, result) => {
    const once = recordCompletedCampaign(createEmptyPlayerProgress(), {
      ...completed,
      ...result,
      runId: `${id}-over-1`,
    }, "2026-08-24T10:00:00.000Z");
    const over = recordCompletedCampaign(once, {
      ...completed,
      ...result,
      runId: `${id}-over-2`,
    }, "2026-08-24T10:00:00.000Z");
    expect(over.unlocked[id]).toBeDefined();
    expect(over.totals.completedCampaigns).toBe(2);
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

  it("누적 합계와 엔딩 수가 안전 정수를 넘으면 프로필을 거부한다", () => {
    const totalFields = [
      "completedCampaigns",
      "expeditions",
      "clearedExpeditions",
      "wipedExpeditions",
      "deaths",
      "advices",
    ] as const;
    for (const field of totalFields) {
      const current = createEmptyPlayerProgress();
      const overflowing = {
        ...current,
        totals: { ...current.totals, [field]: Number.MAX_SAFE_INTEGER },
      };
      expect(() => recordCompletedCampaign(overflowing, {
        ...completed,
        runId: `overflow-${field}`,
        totalExpeditions: field === "expeditions" ? 1 : 0,
        clearedExpeditions: field === "clearedExpeditions" ? 1 : 0,
        wipedExpeditions: field === "wipedExpeditions" ? 1 : 0,
        deaths: field === "deaths" ? 1 : 0,
        advices: field === "advices" ? 1 : 0,
      }, "2026-08-24T10:00:00.000Z")).toThrow(TypeError);
    }

    const current = createEmptyPlayerProgress();
    const overflowingEndingCount = {
      ...current,
      endingCounts: { ...current.endingCounts, completed: Number.MAX_SAFE_INTEGER },
    };
    expect(() => recordCompletedCampaign(overflowingEndingCount, {
      ...completed,
      runId: "overflow-ending-count",
      ending: "completed",
      totalExpeditions: 0,
      clearedExpeditions: 0,
      wipedExpeditions: 0,
      deaths: 0,
      advices: 0,
    }, "2026-08-24T10:00:00.000Z")).toThrow(TypeError);
  });
});
