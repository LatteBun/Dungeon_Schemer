import { CLASSES } from "@/lib/content/classes";
import { RANK_RISK_LIMIT } from "@/lib/domain";
import { PERSONALITY_LABEL, portraitSrcForCharacter } from "./character-labels";
import type {
  BoardOffer,
  CampaignState,
  CharacterId,
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
  id: CharacterId;
  name: string;
  classLabel: string;
  personalityLabel: string;
  hp: number;
  maxHp: number;
  trust: number;
  gold: number;
  /** 향후 캐릭터 고유 초상 자산이 준비되면 ID 매핑으로 주입한다. */
  portraitSrc?: string;
}

export interface U3BoardNoticeView {
  offerId: string;
  dungeonId: string;
  dungeonName: string;
  theme: ThemeId;
  themeLabel: string;
  riskLevel: RiskLevel;
  reputationReward: number;
  goldReward: number;
  locked: boolean;
  lockReasonLabel: string | null;
}

export interface U3OfferDetailView extends U3BoardNoticeView {
  party: readonly U3PartyMemberView[];
  contractOutcomes: readonly U3ContractOutcomeView[];
}

export interface U3BoardView {
  notices: readonly U3BoardNoticeView[];
  detailsByOfferId: Readonly<Record<string, U3OfferDetailView>>;
}

export type U3PortraitMap = Readonly<Partial<Record<CharacterId, string>>>;

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

export function createU3BoardView(
  campaign: CampaignState,
  offers: readonly BoardOffer[],
  portraitByCharacterId: U3PortraitMap = {},
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

      /* 주입된 초상이 없으면 공용 매핑으로 채운다. 화면마다 빈 자리가 나오면 안 된다. */
      const portraitSrc = portraitByCharacterId[character.id]
        ?? portraitSrcForCharacter({
          id: character.id,
          classId: character.classId,
          alive: character.alive,
        });
      return {
        id: character.id,
        name: character.name,
        classLabel: classLabel(character.classId),
        personalityLabel: PERSONALITY_LABEL[character.personality],
        hp: character.hp,
        maxHp: character.maxHp,
        trust: character.trust,
        gold: character.gold,
        ...(portraitSrc === undefined ? {} : { portraitSrc }),
      } satisfies U3PartyMemberView;
    });

    notices.push(notice);
    detailsByOfferId[offer.id] = {
      ...notice,
      party,
      contractOutcomes: contractOutcomesForRisk(offer.riskLevel),
    };
  }

  return { notices, detailsByOfferId };
}
