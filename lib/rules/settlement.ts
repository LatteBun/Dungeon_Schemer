import {
  REPUTATION_MIN,
  RISK_LEVEL_MAX,
  RuleError,
  TRUST_MAX,
  TRUST_MIN,
  contractRewardForSurvivors,
  isContractRewardInRange,
} from "@/lib/domain";
import type {
  CampaignState,
  Character,
  SettlementCauseChain,
  SettlementResult,
  SettlementSnapshot,
} from "@/lib/domain";
import { rewardForSurvivors } from "@/lib/domain";

export interface SettlementExecution {
  readonly campaign: CampaignState;
  readonly result: SettlementResult;
}

function invalid(message: string, details: Record<string, unknown> = {}): never {
  throw new RuleError("INVALID_SETTLEMENT", message, details);
}

function validateCharacter(member: Character, before: Character | undefined): void {
  if (before === undefined) invalid("정산 파티원이 캠페인 풀에 없다", { characterId: member.id });
  if (member.maxHp !== before.maxHp || member.classId !== before.classId) {
    invalid("정산 뒤 고정 캐릭터 정보가 바뀌었다", { characterId: member.id });
  }
  if (!Number.isSafeInteger(member.hp) || member.hp < 0 || member.hp > member.maxHp) {
    invalid("정산 HP가 유효하지 않다", { characterId: member.id, hp: member.hp });
  }
  if (!Number.isSafeInteger(member.trust) || member.trust < TRUST_MIN || member.trust > TRUST_MAX) {
    invalid("정산 신뢰가 유효하지 않다", { characterId: member.id, trust: member.trust });
  }
  if (before.trust === TRUST_MIN && member.trust > TRUST_MIN) {
    invalid("정산으로 신뢰 0을 회복할 수 없다", { characterId: member.id });
  }
  if (!Number.isSafeInteger(member.gold) || member.gold < 0) {
    invalid("정산 골드가 유효하지 않다", { characterId: member.id, gold: member.gold });
  }
  if (member.alive !== (member.hp > 0)) {
    invalid("정산 생존 상태와 HP가 모순된다", { characterId: member.id });
  }
}

function validateSettlement(campaign: CampaignState, snapshot: SettlementSnapshot): void {
  const dungeon = campaign.dungeons.find((candidate) => candidate.id === snapshot.dungeonId);
  if (dungeon === undefined) invalid("정산 던전이 없다", { dungeonId: snapshot.dungeonId });
  if (dungeon.riskLevel !== snapshot.contractRisk) {
    invalid("계약 위험도와 현재 던전 위험도가 다르다", {
      dungeonId: snapshot.dungeonId,
      contractRisk: snapshot.contractRisk,
      currentRisk: dungeon.riskLevel,
    });
  }
  if (!isContractRewardInRange(snapshot.contractRisk, snapshot.contractReward)) {
    invalid("계약 보상이 위험도 범위를 벗어났다", {
      contractRisk: snapshot.contractRisk,
      contractReward: snapshot.contractReward,
    });
  }
  if (snapshot.party.memberIds.length !== 3 || new Set(snapshot.party.memberIds).size !== 3) {
    invalid("정산 파티는 서로 다른 3명이어야 한다");
  }
  if (snapshot.finalMembers.length !== 3) invalid("최종 파티원이 3명이 아니다");
  const partyIds = new Set(snapshot.party.memberIds);
  const finalIds = new Set(snapshot.finalMembers.map((member) => member.id));
  if (finalIds.size !== 3 || snapshot.finalMembers.some((member) => !partyIds.has(member.id))) {
    invalid("최종 파티원이 계약 파티와 다르다");
  }
  if (new Set(snapshot.finalMembers.map((member) => member.classId)).size !== 3) {
    invalid("정산 파티는 서로 다른 3개 클래스여야 한다");
  }
  for (const id of snapshot.party.memberIds) {
    const member = snapshot.finalMembers.find((candidate) => candidate.id === id);
    const before = campaign.pool.byId[id];
    if (member === undefined) invalid("계약 파티원의 최종 상태가 없다", { characterId: id });
    validateCharacter(member, before);
  }
  const survivorCount = snapshot.finalMembers.filter((member) => member.alive).length;
  if (snapshot.status === "cleared" && survivorCount === 0) invalid("클리어 결과에 생존자가 없다");
  if (snapshot.status === "wiped" && survivorCount !== 0) invalid("전멸 결과에 생존자가 있다");
}

function normalizedMember(member: Character): Character {
  return {
    ...member,
    gravelyWounded: member.alive && member.hp * 5 < member.maxHp,
  };
}

function createCauseChain(
  snapshot: SettlementSnapshot,
  survivorCount: 0 | 1 | 2 | 3,
  reputationDelta: number,
  goldDelta: number,
  relicGold: number,
  riskBefore: number,
  riskAfter: number,
): SettlementCauseChain {
  return {
    choice: snapshot.causeInputs.choice,
    reactions: snapshot.causeInputs.reactions,
    damage: snapshot.causeInputs.damage,
    economy: survivorCount === 0
      ? `전멸: 명성 ${reputationDelta}, 유품 골드 ${relicGold}`
      : `${survivorCount}명 생존: 명성 ${reputationDelta}, 계약 골드 ${goldDelta}`,
    campaignChange: riskBefore === riskAfter
      ? `던전 위험도 ★${riskBefore} 유지`
      : `던전 위험도 ★${riskBefore} → ★${riskAfter}`,
  };
}

export function settleExpedition(
  campaign: CampaignState,
  snapshot: SettlementSnapshot,
): SettlementExecution {
  validateSettlement(campaign, snapshot);
  const dungeon = campaign.dungeons.find((candidate) => candidate.id === snapshot.dungeonId);
  if (dungeon === undefined) invalid("정산 던전이 없다");

  const finalMembers = snapshot.finalMembers.map(normalizedMember);
  const survivorIds = finalMembers.filter((member) => member.alive).map((member) => member.id);
  const survivorCount = survivorIds.length as 0 | 1 | 2 | 3;
  const fullReward = contractRewardForSurvivors(snapshot.contractReward, 3);
  const clearReward = contractRewardForSurvivors(snapshot.contractReward, survivorCount);
  const wiped = snapshot.status === "wiped";
  const riskBefore = dungeon.riskLevel;
  const riskAfter = wiped ? Math.min(RISK_LEVEL_MAX, riskBefore + 1) as typeof riskBefore : riskBefore;
  const relicGold = wiped
    ? finalMembers.filter((member) => !member.alive).reduce((total, member) => total + member.gold, 0)
    : 0;
  const reputationDelta = wiped ? -fullReward.reputation : clearReward.reputation;
  const goldDelta = wiped ? 0 : clearReward.gold;
  const memberChanges = finalMembers.map((after) => ({
    characterId: after.id,
    before: campaign.pool.byId[after.id],
    after: wiped && !after.alive ? { ...after, gold: 0 } : after,
  })).map((change) => ({
    ...change,
    after: normalizedMember(change.after),
  }));
  const nextById = { ...campaign.pool.byId };
  for (const change of memberChanges) nextById[change.characterId] = change.after;
  const nextDungeons = campaign.dungeons.map((candidate) => candidate.id !== dungeon.id
    ? candidate
    : wiped
      ? { ...candidate, riskLevel: riskAfter, attempts: candidate.attempts + 1 }
      : { ...candidate, status: "cleared" as const });
  const nextCampaign: CampaignState = {
    ...campaign,
    reputation: Math.max(REPUTATION_MIN, campaign.reputation + reputationDelta),
    gold: campaign.gold + goldDelta + relicGold,
    cumulativeGold: campaign.cumulativeGold + goldDelta + relicGold,
    pool: { ...campaign.pool, byId: nextById },
    dungeons: nextDungeons,
  };
  const result: SettlementResult = {
    expeditionId: snapshot.expeditionId,
    dungeonId: snapshot.dungeonId,
    status: snapshot.status,
    survivorIds,
    survivorCount,
    memberChanges,
    reputationDelta,
    goldDelta,
    relicGold,
    riskBefore,
    riskAfter,
    riskCapped: wiped && riskBefore === RISK_LEVEL_MAX,
    nextReward: wiped ? rewardForSurvivors(riskAfter, 3) : null,
    causeChain: createCauseChain(snapshot, survivorCount, reputationDelta, goldDelta, relicGold, riskBefore, riskAfter),
  };
  return { campaign: nextCampaign, result };
}
