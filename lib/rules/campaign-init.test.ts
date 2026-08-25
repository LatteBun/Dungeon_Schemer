import { describe, expect, it } from "vitest";
import { INITIAL_DUNGEON_SLOTS } from "@/lib/content/campaign-dungeons";
import { THEMES, selectThemeBoss } from "@/lib/content/themes";
import {
  CAMPAIGN_DUNGEON_COUNT,
  CAMPAIGN_DUNGEON_ORDERS,
  createCampaignHistory,
  createCampaignStatistics,
  GOLD_START,
  REPUTATION_START,
} from "@/lib/domain";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { validateCampaignBalance } from "@/lib/rules/balance-validation";

function themeOf(themeId: (typeof THEMES)[number]["id"]) {
  const theme = THEMES.find((candidate) => candidate.id === themeId);
  if (theme === undefined) throw new Error(`fixture 오류: ${themeId} 테마가 없다`);
  return theme;
}

describe("initializeCampaign", () => {
  it("캠페인 생성 전에 공통 밸런스 설정을 검증한다", () => {
    expect(() => validateCampaignBalance()).not.toThrow();
    expect(() => initializeCampaign("c1-validated-balance")).not.toThrow();
  });

  it("인트로에 필요한 초기 자원과 콘텐츠를 생성한다", () => {
    const state = initializeCampaign("c1-initial-state");

    expect(state.seed).toBe("c1-initial-state");
    expect(state.phase).toBe("intro");
    expect(state.rank).toBe("C");
    expect(state.reputation).toBe(REPUTATION_START);
    expect(state.gold).toBe(GOLD_START);
    expect(state.cumulativeGold).toBe(0);
    expect(state.offers).toEqual([]);
    expect(state.worldTurn).toBe(0);
    expect(state.ending).toBeNull();
    expect(state.pool.order).toHaveLength(30);
    expect(state.dungeons).toHaveLength(CAMPAIGN_DUNGEON_COUNT);
    expect(state.dungeons.map((dungeon) => dungeon.campaignOrder)).toEqual(CAMPAIGN_DUNGEON_ORDERS);
    expect(state.statistics).toEqual(createCampaignStatistics());
    expect(state.history).toEqual(createCampaignHistory());
    expect(state.history.events).toEqual([]);
    expect(state.history.turningPoints).toEqual([]);
  });

  it("고정 슬롯마다 패키지와 보스를 테마·위험도에 맞춰 연결한다", () => {
    const state = initializeCampaign("c1-dungeon-contract");

    for (const [index, slot] of INITIAL_DUNGEON_SLOTS.entries()) {
      const dungeon = state.dungeons[index];
      const theme = themeOf(slot.theme);
      const profile = theme.ecologyProfiles.find(
        (candidate) => candidate.id === dungeon.ecologyProfileId,
      );

      expect(dungeon.id).toBe(slot.id);
      expect(dungeon.campaignOrder).toBe(slot.campaignOrder);
      expect(dungeon.name).toBe(slot.name);
      expect(dungeon.theme).toBe(slot.theme);
      expect(dungeon.initialRiskLevel).toBe(slot.initialRiskLevel);
      expect(dungeon.riskLevel).toBe(slot.initialRiskLevel);
      expect(dungeon.status).toBe("unexplored");
      expect(dungeon.attempts).toBe(0);
      expect(profile).toBeDefined();
      expect(profile?.initialRiskLevel).toBe(slot.initialRiskLevel);
      expect(dungeon.activeRuleIds).toEqual(profile?.activeRuleIds);
      expect(dungeon.activeMonsterIds).toEqual(profile?.activeMonsterIds);
      expect(dungeon.bossId).toBe(selectThemeBoss(theme, slot.initialRiskLevel).id);
    }
  });

  it("같은 시드는 값은 같고 생성 배열과 객체 참조는 공유하지 않는다", () => {
    const first = initializeCampaign("c1-repro");
    const second = initializeCampaign("c1-repro");

    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second.pool).not.toBe(first.pool);
    expect(second.history).not.toBe(first.history);
    expect(second.history.events).not.toBe(first.history.events);
    expect(second.history.turningPoints).not.toBe(first.history.turningPoints);
    expect(second.dungeons).not.toBe(first.dungeons);
    expect(second.dungeons[0]).not.toBe(first.dungeons[0]);
    expect(second.dungeons[0].activeRuleIds).not.toBe(first.dungeons[0].activeRuleIds);
    expect(second.dungeons[0].activeMonsterIds).not.toBe(first.dungeons[0].activeMonsterIds);
  });

  it("시드는 같은 테마·같은 위험도 프로필의 슬롯 순서만 바꾼다", () => {
    const assignments = new Set<string>();

    for (let index = 0; index < 100; index += 1) {
      const state = initializeCampaign(`c1-ecology-${index}`);
      const spiderRiskOne = state.dungeons
        .filter((dungeon) => dungeon.theme === "spider" && dungeon.initialRiskLevel === 1)
        .map((dungeon) => dungeon.ecologyProfileId)
        .join(",");
      const desertRiskTwo = state.dungeons
        .filter((dungeon) => dungeon.theme === "desert" && dungeon.initialRiskLevel === 2)
        .map((dungeon) => dungeon.ecologyProfileId)
        .join(",");
      const graveyardRiskThree = state.dungeons
        .filter((dungeon) => dungeon.theme === "graveyard" && dungeon.initialRiskLevel === 3)
        .map((dungeon) => dungeon.ecologyProfileId)
        .join(",");
      assignments.add(`${spiderRiskOne}|${desertRiskTwo}|${graveyardRiskThree}`);

      for (const dungeon of state.dungeons) {
        const candidates = themeOf(dungeon.theme).ecologyProfiles.filter(
          (profile) => profile.initialRiskLevel === dungeon.initialRiskLevel,
        );
        expect(candidates.map((profile) => profile.id)).toContain(dungeon.ecologyProfileId);
      }
    }

    expect(assignments.size).toBeGreaterThan(1);
  });
});
