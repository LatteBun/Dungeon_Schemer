import { classLabel, portraitSrcForCharacter } from "./character-labels";
import type {
  GuideRank,
  RiskLevel,
  Reward,
  SettlementResult,
  ThemeId,
} from "@/lib/domain";

/**
 * U6 정산 화면의 모델 경계.
 *
 * 화면은 CampaignState 를 직접 읽지 않는다. 정산 계산은 C4가 만들고, 이
 * 어댑터는 SettlementResult를 화면이 받을 모양으로만 변환한다. 승급은
 * 게시판의 C5 규칙과 U3 화면이 소유하며 이 모델에는 포함하지 않는다.
 */

/** 선택 → 개인 반응 → 피해 → 보상·손실 → 캠페인 변화. */
export const CAUSE_ORDER = [1, 2, 3, 4, 5] as const;

export type U6CauseOrder = (typeof CAUSE_ORDER)[number];

export interface U6CauseStep {
  order: U6CauseOrder;
  label: string;
  detail: string;
}

export interface U6SettlementView {
  dungeonName: string;
  themeId: ThemeId;
  /** 0 이면 전멸이다. */
  survivors: 0 | 1 | 2 | 3;
  causeChain: readonly U6CauseStep[];
  riskBefore: RiskLevel;
  riskAfter: RiskLevel;
  /** ★5 전멸이라 위험도가 더 오르지 않았다. */
  riskCapped: boolean;
  reputationDelta: number;
  goldDelta: number;
  /** 전멸에서만 회수한다. 그 외에는 0. */
  relicGold: number;
  nextReward: Reward | null;
  /*
   * 이 원정을 다녀온 사람들.
   *
   * 정산은 누가 돌아왔는지에 대한 셈이다. 그런데 숫자만 있고 사람이 없어,
   * "2명 생존" 이 누구를 말하는지 화면에서 알 수 없었다.
   */
  members: readonly U6SettlementMember[];
}

export interface U6SettlementMember {
  id: string;
  name: string;
  classLabel: string;
  portraitSrc: string;
  alive: boolean;
  hp: { before: number; after: number; max: number };
  trust: { before: number; after: number };
}

const RANK_CREST_ROOT = "/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/ranks";

export function rankCrestSrc(rank: GuideRank): string {
  return `${RANK_CREST_ROOT}/rank_${rank.toLowerCase()}.png`;
}

/*
 * 무엇에 대한 칸인지가 이름에 있어야 한다.
 *
 * 「선택」 아래에 "다른 길을 찾아보라고 하세요" 만 놓여 있으면 그것이 누가 한
 * 말인지, 무엇을 고른 것인지가 떠 있다. 길잡이가 마지막으로 건넨 조언이다.
 */
const CAUSE_LABELS = ["마지막 조언", "파티의 반응", "피해", "보상·손실", "캠페인 변화"] as const;

export function createU6SettlementView(
  settlement: SettlementResult,
  dungeonName: string,
  themeId: ThemeId,
): U6SettlementView {
  const details = [
    settlement.causeChain.choice,
    settlement.causeChain.reactions,
    settlement.causeChain.damage,
    settlement.causeChain.economy,
    settlement.causeChain.campaignChange,
  ] as const;
  return {
    dungeonName,
    themeId,
    survivors: settlement.survivorCount,
    causeChain: CAUSE_ORDER.map((order, index) => ({
      order,
      label: CAUSE_LABELS[index],
      detail: details[index],
    })),
    riskBefore: settlement.riskBefore,
    riskAfter: settlement.riskAfter,
    riskCapped: settlement.riskCapped,
    reputationDelta: settlement.reputationDelta,
    goldDelta: settlement.goldDelta,
    relicGold: settlement.relicGold,
    nextReward: settlement.nextReward,
    members: settlement.memberChanges.map(({ before, after }) => ({
      id: String(after.id),
      name: after.name,
      classLabel: classLabel(after.classId),
      portraitSrc: portraitSrcForCharacter({ id: after.id, classId: after.classId, alive: after.alive }),
      alive: after.alive,
      hp: { before: before.hp, after: after.hp, max: after.maxHp },
      trust: { before: before.trust, after: after.trust },
    })),
  };
}
