import { CLASSES } from "@/lib/content/classes";
import { createRng } from "@/lib/rng";
import { inSeatOrder } from "./party-seat-order";
import { contractRewardForSurvivors, RANK_RISK_LIMIT } from "@/lib/domain";
import { PERSONALITY_LABEL, portraitSrcForCharacterId } from "./character-labels";
import {
  partyMemberBattleAbilityStatus,
  type PartyMemberBattleAbilityStatus,
} from "./party-member-ability-view";
import type {
  BoardOffer,
  CampaignState,
  CharacterId,
  ContractReward,
  RiskLevel,
  ThemeId,
} from "@/lib/domain";

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
  battleAbilityStatus?: PartyMemberBattleAbilityStatus;
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

export function contractOutcomesForReward(
  fullReward: ContractReward,
): readonly U3ContractOutcomeView[] {
  const full = contractRewardForSurvivors(fullReward, 3);
  const two = contractRewardForSurvivors(fullReward, 2);
  const one = contractRewardForSurvivors(fullReward, 1);

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
      reputation: two.reputation,
      gold: two.gold,
      reputationLoss: 0,
    },
    {
      survivors: 1,
      label: "1명 생존 시",
      reputation: one.reputation,
      gold: one.gold,
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

/*
 * 게시판에 걸리는 차례를 섞는다.
 *
 * `C1` 은 접근 가능한 것 중 위험도 높은 쪽부터 고르고 파티도 그 차례로 짝지어
 * 준다. 어느 공고가 걸리느냐는 그 규칙의 몫이라 건드리지 않는다. 다만 그 차례가
 * 그대로 벽에 걸리면 언제나 첫 자리가 가장 위험한 던전이라, 길잡이가 공고를 읽지
 * 않고 자리만 보고 고르게 된다. 게시판은 누가 먼저 와서 붙였는지 모르는 벽이다.
 *
 * 고르는 일이 끝난 뒤(다섯 장을 추린 뒤)에 섞으므로 무엇이 걸리는지는 그대로다.
 * 같은 시드와 같은 월드턴이면 같은 차례가 나온다 — 화면이 렌더마다 다시 섞으면
 * 누르려던 공고가 손 밑에서 움직인다.
 */
function boardOrder(campaign: CampaignState, offers: readonly BoardOffer[]): readonly BoardOffer[] {
  const shown = offers.slice(0, 5);
  return createRng(`${campaign.seed}/board-order/${campaign.worldTurn}`).derive("card").shuffle(shown);
}

export function createU3BoardView(
  campaign: CampaignState,
  offers: readonly BoardOffer[],
): U3BoardView {
  const notices: U3BoardNoticeView[] = [];
  const detailsByOfferId: Record<string, U3OfferDetailView> = {};

  for (const offer of boardOrder(campaign, offers)) {
    const dungeon = campaign.dungeons.find(
      (candidate) => candidate.id === offer.dungeonId,
    );
    if (dungeon === undefined) {
      throw new Error(`U3 공고의 던전을 찾을 수 없습니다: ${offer.dungeonId}`);
    }

    const notice: U3BoardNoticeView = {
      offerId: offer.id,
      dungeonId: offer.dungeonId,
      dungeonName: dungeon.name,
      theme: dungeon.theme,
      themeLabel: THEME_LABELS[dungeon.theme],
      riskLevel: offer.riskLevel,
      reputationReward: offer.reward.reputation,
      goldReward: offer.reward.gold,
      locked: offer.lockReason !== null,
      lockReasonLabel: lockReasonLabel(campaign, offer),
    };

    const party = inSeatOrder(campaign.seed, offer.party.memberIds, String).map((memberId) => {
      const character = campaign.pool.byId[memberId];
      if (character === undefined) {
        throw new Error(`U3 파티원을 찾을 수 없습니다: ${memberId}`);
      }

      /* 주입된 초상이 없으면 공용 매핑으로 채운다. 화면마다 빈 자리가 나오면 안 된다. */
      const portraitSrc = portraitSrcForCharacterId(character.id);
      const classDef = CLASSES.find((candidate) => candidate.id === character.classId);
      if (classDef === undefined) {
        throw new Error(`U3 파티원의 직업 정의를 찾을 수 없습니다: ${character.classId}`);
      }
      const battleAbilityStatus = partyMemberBattleAbilityStatus(
        classDef.battleAbility,
        classDef.battleAbility?.usesPerExpedition,
      );
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
        ...(battleAbilityStatus === undefined ? {} : { battleAbilityStatus }),
      } satisfies U3PartyMemberView;
    });

    notices.push(notice);
    detailsByOfferId[offer.id] = {
      ...notice,
      party,
      contractOutcomes: contractOutcomesForReward(offer.reward),
    };
  }

  return { notices, detailsByOfferId };
}
