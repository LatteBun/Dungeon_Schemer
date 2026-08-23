import { CAMPAIGN_DUNGEON_COUNT, DENOUNCE_THRESHOLD, TRUST_MIN } from "@/lib/domain";
import type { CampaignEnding, CampaignState, Character } from "@/lib/domain";
import { canCreateEmergencyParty } from "./board";

export interface CampaignTrustModifier {
  accept: number;
  expose: number;
}

/** 캠페인 풀에서 살아 있는 신뢰 0 인원만 센다. 사망자는 누적에서 빠진다. */
export function countLivingZeroTrust(campaign: CampaignState): number {
  return campaign.pool.order.reduce((count, id) => {
    const member = campaign.pool.byId[id];
    return count + Number(member?.alive === true && member.trust === TRUST_MIN);
  }, 0);
}

/** C6이 E2에 공급하는 캠페인 전체 신뢰 보정이다. */
export function getCampaignTrustModifier(campaign: CampaignState): CampaignTrustModifier {
  switch (countLivingZeroTrust(campaign)) {
    case 2: return { accept: -5, expose: 0 };
    case 3: return { accept: -10, expose: 5 };
    case 4: return { accept: -15, expose: 15 };
    default: return { accept: 0, expose: 0 };
  }
}

/**
 * 한 조언 결과 또는 보스 정보 검증의 신뢰 변화 묶음 적용 직후 C7이 호출한다.
 * 이 함수는 결과만 만들며 캠페인·파티·정산 상태를 변경하지 않는다.
 */
export function evaluateImmediateDistrustEnding(
  campaign: CampaignState,
  partyMembers: readonly Character[],
): CampaignEnding | null {
  const survivors = partyMembers.filter((member) => member.alive);
  if (survivors.length === 0 || survivors.some((member) => member.trust !== TRUST_MIN)) return null;

  const survivorIds = new Set(survivors.map((member) => member.id));
  const triggerCharacterIds = campaign.pool.order.filter((id) => survivorIds.has(id));
  return {
    kind: "distrust",
    title: "불신의 대가",
    reason: "원정 생존자 전원이 길잡이를 더는 믿지 않습니다.",
    finalRank: campaign.rank,
    triggerCharacterIds,
  };
}

/** 월드턴 뒤 응급 후보까지 포함해 세 직업을 만들 수 없을 때만 성립한다. */
export function isPersonnelExhausted(campaign: CampaignState): boolean {
  return !canCreateEmergencyParty(campaign.pool);
}

function buildEnding(
  campaign: CampaignState,
  kind: CampaignEnding["kind"],
  title: string,
  reason: string,
  triggerCharacterIds: readonly CampaignEnding["triggerCharacterIds"][number][] = [],
): CampaignEnding {
  return {
    kind,
    title,
    reason,
    finalRank: campaign.rank,
    triggerCharacterIds,
  };
}

function denouncedEnding(campaign: CampaignState): CampaignEnding {
  const ids = new Set(
    campaign.pool.order.filter((id) => {
      const member = campaign.pool.byId[id];
      return member?.alive === true && member.trust === TRUST_MIN;
    }),
  );
  return buildEnding(
    campaign,
    "denounced",
    "누적 고발",
    "살아 있는 용사 5명 이상이 길잡이를 불신합니다.",
    campaign.pool.order.filter((id) => ids.has(id)),
  );
}

function completedEnding(campaign: CampaignState): CampaignEnding {
  return buildEnding(campaign, "completed", "원정 종료", "15개의 던전을 모두 돌파했습니다.");
}

function exhaustedEnding(campaign: CampaignState): CampaignEnding {
  return buildEnding(campaign, "exhausted", "인력 소진", "서로 다른 직업 3명으로 원정을 꾸릴 수 없습니다.");
}

function unemployedEnding(campaign: CampaignState): CampaignEnding {
  return buildEnding(campaign, "unemployed", "실직", "남은 모든 공고가 현재 길잡이 등급보다 높습니다.");
}

/** C3 월드턴 뒤 C7이 호출하는 정상 엔딩 판정이다. */
export function evaluateCampaignEnding(campaign: CampaignState): CampaignEnding | null {
  if (countLivingZeroTrust(campaign) >= DENOUNCE_THRESHOLD) return denouncedEnding(campaign);
  if (
    campaign.dungeons.length === CAMPAIGN_DUNGEON_COUNT
    && campaign.dungeons.every((dungeon) => dungeon.status === "cleared")
  ) return completedEnding(campaign);
  if (isPersonnelExhausted(campaign)) return exhaustedEnding(campaign);
  if (
    campaign.offers.length > 0
    && campaign.offers.every((offer) => offer.lockReason === "rankTooLow")
  ) return unemployedEnding(campaign);
  return null;
}
