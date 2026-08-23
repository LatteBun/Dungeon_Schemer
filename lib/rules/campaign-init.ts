import { INITIAL_DUNGEON_SLOTS, type CampaignDungeonSlot } from "@/lib/content/campaign-dungeons";
import { generateCharacterPool } from "@/lib/content/character-pool";
import { THEMES, selectThemeBoss } from "@/lib/content/themes";
import { createRng } from "@/lib/rng";
import {
  CAMPAIGN_DUNGEON_COUNT,
  createCampaignHistory,
  createCampaignStatistics,
  GOLD_START,
  REPUTATION_START,
  RuleError,
} from "@/lib/domain";
import type { CampaignState, EcologyProfile, ThemeContent, ThemeId } from "@/lib/domain";

interface EcologyAssignmentGroup {
  theme: ThemeId;
  initialRiskLevel: CampaignDungeonSlot["initialRiskLevel"];
  slots: CampaignDungeonSlot[];
  profiles: EcologyProfile[];
}

function invalidGeneration(message: string, details: Record<string, unknown>): never {
  throw new RuleError("INVALID_GENERATION", message, details);
}

function themeById(themeId: ThemeId): ThemeContent {
  const theme = THEMES.find((candidate) => candidate.id === themeId);
  if (theme === undefined) {
    return invalidGeneration(`테마 콘텐츠가 없다: ${themeId}`, {
      contentType: "theme",
      theme: themeId,
    });
  }
  return theme;
}

function assignEcologyProfiles(seed: string): ReadonlyMap<CampaignDungeonSlot["id"], EcologyProfile> {
  if (INITIAL_DUNGEON_SLOTS.length !== CAMPAIGN_DUNGEON_COUNT) {
    invalidGeneration("고정 던전 슬롯 수가 계약과 다르다", {
      contentType: "campaignDungeonSlot",
      seed,
      expected: CAMPAIGN_DUNGEON_COUNT,
      actual: INITIAL_DUNGEON_SLOTS.length,
    });
  }

  const groups = new Map<string, EcologyAssignmentGroup>();
  for (const slot of INITIAL_DUNGEON_SLOTS) {
    const key = `${slot.theme}/${slot.initialRiskLevel}`;
    const group = groups.get(key);
    if (group === undefined) {
      const theme = themeById(slot.theme);
      groups.set(key, {
        theme: slot.theme,
        initialRiskLevel: slot.initialRiskLevel,
        slots: [slot],
        profiles: theme.ecologyProfiles.filter(
          (profile) => profile.initialRiskLevel === slot.initialRiskLevel,
        ),
      });
    } else {
      group.slots.push(slot);
    }
  }

  const assignments = new Map<CampaignDungeonSlot["id"], EcologyProfile>();
  for (const group of groups.values()) {
    if (group.profiles.length !== group.slots.length) {
      invalidGeneration("테마·위험도별 생태 패키지 수가 슬롯 수와 다르다", {
        contentType: "ecologyProfile",
        seed,
        theme: group.theme,
        initialRiskLevel: group.initialRiskLevel,
        expected: group.slots.length,
        actual: group.profiles.length,
      });
    }

    const shuffled = createRng(`${seed}/${group.theme}`).derive("ecology").shuffle(group.profiles);
    for (const [index, slot] of group.slots.entries()) {
      const profile = shuffled[index];
      if (profile === undefined) {
        invalidGeneration("생태 패키지 배정이 누락됐다", {
          contentType: "ecologyProfile",
          seed,
          theme: group.theme,
          initialRiskLevel: group.initialRiskLevel,
          dungeonId: slot.id,
        });
      }
      assignments.set(slot.id, profile);
    }
  }

  return assignments;
}

/** C1에서 시드 하나로 첫 캠페인 상태를 만든다. */
export function initializeCampaign(seed: string): CampaignState {
  const ecologyByDungeon = assignEcologyProfiles(seed);
  const dungeons = INITIAL_DUNGEON_SLOTS.map((slot) => {
    const profile = ecologyByDungeon.get(slot.id);
    if (profile === undefined) {
      return invalidGeneration("던전에 생태 패키지가 배정되지 않았다", {
        contentType: "campaignDungeon",
        seed,
        dungeonId: slot.id,
      });
    }
    const theme = themeById(slot.theme);
    return {
      id: slot.id,
      name: slot.name,
      theme: slot.theme,
      campaignOrder: slot.campaignOrder,
      initialRiskLevel: slot.initialRiskLevel,
      riskLevel: slot.initialRiskLevel,
      ecologyProfileId: profile.id,
      activeRuleIds: [...profile.activeRuleIds],
      activeMonsterIds: [...profile.activeMonsterIds],
      bossId: selectThemeBoss(theme, slot.initialRiskLevel).id,
      status: "unexplored" as const,
      attempts: 0,
    };
  });

  return {
    seed,
    phase: "intro",
    rank: "C",
    reputation: REPUTATION_START,
    gold: GOLD_START,
    cumulativeGold: 0,
    pool: generateCharacterPool(createRng(seed)),
    dungeons,
    offers: [],
    worldTurn: 0,
    ending: null,
    settledExpeditionIds: [],
    statistics: createCampaignStatistics(),
    history: createCampaignHistory(),
  };
}
