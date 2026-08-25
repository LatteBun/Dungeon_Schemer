import { classLabel, portraitSrcForCharacterId } from "./character-labels";
import type {
  CampaignState,
  GuideRank,
  RiskLevel,
  SettlementResult,
  ThemeId,
} from "@/lib/domain";
import { DENOUNCE_THRESHOLD, TRUST_MIN } from "@/lib/domain";
import { countLivingZeroTrust, getCampaignTrustModifier } from "@/lib/rules/ending";

/**
 * U6 정산 화면의 모델 경계.
 *
 * 화면은 CampaignState 를 직접 읽지 않는다. 정산 계산은 C4가 만들고, 이
 * 어댑터는 정산 직후 CampaignState와 SettlementResult를 화면이 받을 모양으로
 * 변환한다. 승급은 게시판의 C5 규칙과 U3 화면이 소유하며 이 모델에는 포함하지
 * 않는다.
 */

export interface U6SettlementView {
  readonly dungeonName: string;
  readonly themeId: ThemeId;
  readonly reputationDelta: number;
  readonly goldDelta: number;
  /** 전멸에서만 회수한다. 그 외에는 0. */
  readonly relicGold: number;
  readonly outcome: U6SettlementOutcome;
  readonly causes: readonly U6SettlementCause[];
  readonly dungeonOutcome: U6DungeonOutcome;
  readonly trustPressure: U6TrustPressureView | null;
  /*
   * 이 원정을 다녀온 사람들.
   *
   * 정산은 누가 돌아왔는지에 대한 셈이다. 그런데 숫자만 있고 사람이 없어,
   * "2명 생존" 이 누구를 말하는지 화면에서 알 수 없었다.
   */
  readonly members: readonly U6SettlementMember[];
}

export interface U6SettlementMember {
  readonly id: string;
  readonly name: string;
  readonly classLabel: string;
  readonly portraitSrc: string;
  readonly alive: boolean;
  readonly diedThisExpedition: boolean;
  readonly gravelyWounded: boolean;
  readonly hp: { readonly before: number; readonly after: number; readonly max: number };
  readonly trust: {
    readonly before: number;
    readonly after: number;
    readonly changed: boolean;
    readonly isZero: boolean;
    readonly becameZero: boolean;
    readonly countsTowardCampaign: boolean;
  };
}

export interface U6SettlementOutcome {
  readonly kind: SettlementResult["status"];
  readonly title: string;
  readonly summary: string;
}

export interface U6SettlementCause {
  readonly kind: "choice" | "reactions";
  readonly label: "마지막 조언" | "파티의 판단";
  readonly detail: string;
}

export type U6DungeonOutcome =
  | { readonly kind: "cleared" }
  | { readonly kind: "riskIncreased"; readonly before: RiskLevel; readonly after: RiskLevel }
  | { readonly kind: "riskCapped"; readonly level: RiskLevel };

export interface U6TrustPressureView {
  readonly beforeCount: number;
  readonly afterCount: number;
  readonly threshold: number;
  readonly acceptModifier: number;
  readonly exposeModifier: number;
  readonly reachedThreshold: boolean;
}

const RANK_CREST_ROOT = "/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/ranks";

export function rankCrestSrc(rank: GuideRank): string {
  return `${RANK_CREST_ROOT}/rank_${rank.toLowerCase()}.png`;
}

function countLivingZeroTrustBefore(
  campaignAfterSettlement: CampaignState,
  settlement: SettlementResult,
): number {
  const beforeById = new Map(
    settlement.memberChanges.map((change) => [String(change.characterId), change.before] as const),
  );

  return campaignAfterSettlement.pool.order.reduce((count, id) => {
    const member = beforeById.get(String(id)) ?? campaignAfterSettlement.pool.byId[id];
    return count + Number(member?.alive === true && member.trust === TRUST_MIN);
  }, 0);
}

function outcomeFor(
  settlement: SettlementResult,
  dungeonName: string,
  members: readonly U6SettlementMember[],
): U6SettlementOutcome {
  if (settlement.status === "wiped") {
    return { kind: "wiped", title: "원정대 전멸", summary: "3명 전원 사망 · 계약 실패" };
  }

  const deadNames = members.filter((member) => member.diedThisExpedition).map((member) => member.name);
  return {
    kind: "cleared",
    title: `${dungeonName} 정복`,
    summary: deadNames.length === 0
      ? "전원 귀환"
      : `${settlement.survivorCount}명 귀환 · ${deadNames.join(", ")} 사망`,
  };
}

function dungeonOutcomeFor(settlement: SettlementResult): U6DungeonOutcome {
  if (settlement.status === "cleared") return { kind: "cleared" };
  if (settlement.riskCapped) return { kind: "riskCapped", level: settlement.riskAfter };
  return { kind: "riskIncreased", before: settlement.riskBefore, after: settlement.riskAfter };
}

export function createU6SettlementView(
  campaignAfterSettlement: CampaignState,
  settlement: SettlementResult,
  dungeonName: string,
  themeId: ThemeId,
): U6SettlementView {
  const members = settlement.memberChanges.map(({ before, after }) => ({
    id: String(after.id),
    name: after.name,
    classLabel: classLabel(after.classId),
    portraitSrc: portraitSrcForCharacterId(after.id),
    alive: after.alive,
    diedThisExpedition: before.alive && !after.alive,
    gravelyWounded: after.gravelyWounded,
    hp: { before: before.hp, after: after.hp, max: after.maxHp },
    trust: {
      before: before.trust,
      after: after.trust,
      changed: before.trust !== after.trust,
      isZero: after.trust === TRUST_MIN,
      becameZero: before.trust > TRUST_MIN && after.trust === TRUST_MIN,
      countsTowardCampaign: after.alive && after.trust === TRUST_MIN,
    },
  }));
  const causes: readonly U6SettlementCause[] = [
    { kind: "choice", label: "마지막 조언", detail: settlement.causeInputs.choice },
    { kind: "reactions", label: "파티의 판단", detail: settlement.causeInputs.reactions },
  ];
  const beforeCount = countLivingZeroTrustBefore(campaignAfterSettlement, settlement);
  const afterCount = countLivingZeroTrust(campaignAfterSettlement);
  const modifier = getCampaignTrustModifier(campaignAfterSettlement);
  const trustPressure = beforeCount === 0 && afterCount === 0 ? null : {
    beforeCount,
    afterCount,
    threshold: DENOUNCE_THRESHOLD,
    acceptModifier: modifier.accept,
    exposeModifier: modifier.expose,
    reachedThreshold: afterCount >= DENOUNCE_THRESHOLD,
  };

  return {
    dungeonName,
    themeId,
    reputationDelta: settlement.reputationDelta,
    goldDelta: settlement.goldDelta,
    relicGold: settlement.relicGold,
    outcome: outcomeFor(settlement, dungeonName, members),
    causes,
    dungeonOutcome: dungeonOutcomeFor(settlement),
    trustPressure,
    members,
  };
}
