import { CLASSES } from "@/lib/content/classes";
import { THEMES } from "@/lib/content/themes";
import { RANK_RISK_LIMIT } from "@/lib/domain";
import type {
  BoardOffer,
  CampaignState,
  Personality,
  RiskLevel,
  ThemeId,
} from "@/lib/domain";

const FULL_SURVIVOR_REWARD = {
  1: { reputation: 6, gold: 12 },
  2: { reputation: 10, gold: 20 },
  3: { reputation: 15, gold: 32 },
  4: { reputation: 21, gold: 45 },
  5: { reputation: 28, gold: 60 },
} as const satisfies Readonly<
  Record<RiskLevel, { reputation: number; gold: number }>
>;

const PERSONALITY_LABELS: Readonly<Record<Personality, string>> = {
  suspicious: "의심 많은",
  righteous: "정의로운",
  greedy: "탐욕적인",
  prudent: "신중한",
  impulsive: "충동적인",
};

const THEME_LABELS: Readonly<Record<ThemeId, string>> = {
  spider: "거미굴",
  desert: "사막",
  graveyard: "묘지",
};

export interface U3ContractOutcomeView {
  survivors: 0 | 1 | 2 | 3;
  label: "전원 생존 시" | "2명 생존 시" | "1명 생존 시" | "전원 사망 시";
  reputation: number;
  gold: number;
  reputationLoss: number;
}

export interface U3PartyMemberView {
  id: string;
  name: string;
  classLabel: string;
  personalityLabel: string;
  hp: number;
  maxHp: number;
  trust: number;
  gold: number;
}

export interface U3BoardNoticeView {
  offerId: string;
  dungeonId: string;
  dungeonName: string;
  theme: ThemeId;
  themeLabel: string;
  riskLevel: RiskLevel;
  environmentLabel: string;
  reputationReward: number;
  goldReward: number;
  locked: boolean;
  lockReasonLabel: string | null;
}

export interface U3OfferDetailView extends U3BoardNoticeView {
  scoutedRules: readonly string[];
  party: readonly U3PartyMemberView[];
  contractOutcomes: readonly U3ContractOutcomeView[];
}

export interface U3BoardView {
  notices: readonly U3BoardNoticeView[];
  detailsByOfferId: Readonly<Record<string, U3OfferDetailView>>;
}

export function contractOutcomesForRisk(
  riskLevel: RiskLevel,
): readonly U3ContractOutcomeView[] {
  const full = FULL_SURVIVOR_REWARD[riskLevel];

  return [
    {
      survivors: 3,
      label: "전원 생존 시",
      reputation: full.reputation,
      gold: full.gold,
      reputationLoss: 0,
    },
    {
      survivors: 2,
      label: "2명 생존 시",
      reputation: Math.floor(full.reputation * 0.6),
      gold: Math.floor(full.gold * 0.6),
      reputationLoss: 0,
    },
    {
      survivors: 1,
      label: "1명 생존 시",
      reputation: Math.floor(full.reputation * 0.3),
      gold: Math.floor(full.gold * 0.3),
      reputationLoss: 0,
    },
    {
      survivors: 0,
      label: "전원 사망 시",
      reputation: 0,
      gold: 0,
      reputationLoss: full.reputation,
    },
  ];
}

export function scoutedRuleCountForRisk(riskLevel: RiskLevel): 1 | 2 | 3 {
  if (riskLevel <= 2) return 3;
  if (riskLevel === 3) return 2;
  return 1;
}

function classLabel(classId: string): string {
  return CLASSES.find((candidate) => candidate.id === classId)?.name ?? classId;
}

function lockReasonLabel(
  campaign: CampaignState,
  offer: BoardOffer,
): string | null {
  if (offer.lockReason === null) return null;

  if (offer.lockReason === "rankTooLow") {
    return `현재 ${campaign.rank}급은 ★${offer.riskLevel} 던전에 진입할 수 없습니다. (최대 ★${RANK_RISK_LIMIT[campaign.rank]})`;
  }

  return "현재 이 공고에는 진입할 수 없습니다.";
}

function scoutedRules(
  campaign: CampaignState,
  offer: BoardOffer,
): readonly string[] {
  const dungeon = campaign.dungeons.find(
    (candidate) => candidate.id === offer.dungeonId,
  );
  if (dungeon === undefined) {
    throw new Error(`U3 공고의 던전을 찾을 수 없습니다: ${offer.dungeonId}`);
  }

  const theme = THEMES.find((candidate) => candidate.id === dungeon.theme);
  if (theme === undefined) {
    throw new Error(`U3 던전 테마를 찾을 수 없습니다: ${dungeon.theme}`);
  }

  return dungeon.activeRuleIds
    .slice(0, scoutedRuleCountForRisk(offer.riskLevel))
    .map((ruleId) => {
      const rule = theme.rules.find((candidate) => candidate.id === ruleId);
      if (rule === undefined) {
        throw new Error(`U3 답사 규칙을 찾을 수 없습니다: ${ruleId}`);
      }
      return rule.text;
    });
}

export function createU3BoardView(
  campaign: CampaignState,
  offers: readonly BoardOffer[],
): U3BoardView {
  const notices: U3BoardNoticeView[] = [];
  const detailsByOfferId: Record<string, U3OfferDetailView> = {};

  for (const offer of offers.slice(0, 5)) {
    const dungeon = campaign.dungeons.find(
      (candidate) => candidate.id === offer.dungeonId,
    );
    if (dungeon === undefined) {
      throw new Error(`U3 공고의 던전을 찾을 수 없습니다: ${offer.dungeonId}`);
    }

    const fullReward = FULL_SURVIVOR_REWARD[offer.riskLevel];
    const notice: U3BoardNoticeView = {
      offerId: offer.id,
      dungeonId: offer.dungeonId,
      dungeonName: dungeon.name,
      theme: dungeon.theme,
      themeLabel: THEME_LABELS[dungeon.theme],
      riskLevel: offer.riskLevel,
      environmentLabel: offer.publicEnvironmentTag.label,
      reputationReward: fullReward.reputation,
      goldReward: fullReward.gold,
      locked: offer.lockReason !== null,
      lockReasonLabel: lockReasonLabel(campaign, offer),
    };

    const party = offer.party.memberIds.map((memberId) => {
      const character = campaign.pool.byId[memberId];
      if (character === undefined) {
        throw new Error(`U3 파티원을 찾을 수 없습니다: ${memberId}`);
      }

      return {
        id: character.id,
        name: character.name,
        classLabel: classLabel(character.classId),
        personalityLabel: PERSONALITY_LABELS[character.personality],
        hp: character.hp,
        maxHp: character.maxHp,
        trust: character.trust,
        gold: character.gold,
      } satisfies U3PartyMemberView;
    });

    notices.push(notice);
    detailsByOfferId[offer.id] = {
      ...notice,
      scoutedRules: scoutedRules(campaign, offer),
      party,
      contractOutcomes: contractOutcomesForRisk(offer.riskLevel),
    };
  }

  return { notices, detailsByOfferId };
}
